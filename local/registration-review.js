// Browser account review only. No signer, send, typed-data or network-switch action.
export function previewUsable(preview, now = Date.now()) {
  const age = now-Date.parse(preview?.generatedAt);
  return Number.isFinite(age) && age>=0 && age<10*60_000 && preview?.metadata?.published===true &&
    preview?.simulation?.passed===true && preview?.audit?.currentOwnedCount==='0' && preview?.audit?.latest?.currentOwnedCount==='0' && Boolean(preview?.gas?.feeBudget);
}
export async function connectForReview(provider, preview, reviewed) {
  if (!reviewed || !previewUsable(preview)) throw new Error('Review a fresh successful preview before requesting account access');
  const chain = await provider.request({method:'eth_chainId'});
  if (BigInt(chain)!==42220n) throw new Error('Select Celo mainnet (42220) in MetaMask, then review again');
  const accounts = await provider.request({method:'eth_requestAccounts'});
  const currentChain = await provider.request({method:'eth_chainId'});
  const currentAccounts = await provider.request({method:'eth_accounts'});
  const matches = list => Array.isArray(list) && list.length===1 && list[0].toLowerCase()===preview.transaction.from.toLowerCase();
  if (!previewUsable(preview) || BigInt(currentChain)!==42220n || !matches(accounts) || !matches(currentAccounts)) throw new Error('Authorize only the exact supplied wallet on Celo mainnet with a fresh preview');
  return {wallet:currentAccounts[0],chainId:42220,signingEnabled:false};
}
const celo = value => { const n=BigInt(value);return `${n/10n**18n}.${(n%10n**18n).toString().padStart(18,'0').replace(/0+$/,'')||'0'} CELO`; };
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const providers = new Map();let preview, busy=false, observed;
  const usable = () => previewUsable(preview);
  const update = () => { $('connect').disabled=busy||!$('reviewed').checked||!usable()||!providers.has($('provider').value); };
  const invalidate = () => { $('reviewed').checked=false;$('wallet').textContent='Account or network changed. Review again; no signing is enabled.';update(); };
  window.addEventListener('eip6963:announceProvider',event=>{
    const {info,provider}=event.detail||{};
    if(info?.rdns!=='io.metamask'||providers.has(info.uuid))return;
    providers.set(info.uuid,provider);const option=document.createElement('option');option.value=info.uuid;option.textContent='MetaMask';$('provider').append(option);update();
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  function render() {
    $('reviewed').checked=false;$('wallet').textContent='Connected wallet: not checked.';
    const budget=preview.gas.feeBudget;
    const entries=[['Network','Celo mainnet · 42220'],['Required wallet',preview.transaction.from],['Registry',preview.transaction.to],
      ['Function','register(string agentURI) · 0xf2c298be'],['Metadata URL',preview.agentURI],['Native value','0 CELO'],
      ['Event tag',preview.attribution.codes.join(', ')],['Metadata',preview.metadata.published?'HTTP 200 · reviewed JSON matches':'Unverified'],
      ['Ownership',`${preview.audit.currentOwnedCount} identity NFTs at ${preview.audit.block.number}`],
      ['Wallet balance',celo(preview.audit.latest?.nativeCELOWei??preview.audit.nativeCELOWei)],['Gas estimate',preview.gas.estimate||'Unavailable'],
      ['Buffered gas limit',budget?.gasLimit||'Unavailable'],['Planning fee reserve',budget?celo(budget.recommendedReserveWei):'Unavailable'],
      ['Fee details',budget?`Max fee ${budget.maxFeePerGasWei} wei/gas; priority ${budget.maxPriorityFeePerGasWei}; L1 bound ${budget.l1FeeUpperBoundWei} wei; operator ${budget.operatorFeeWei} wei`:'Fee check failed'],
      ['Captured',preview.generatedAt]];
    $('details').replaceChildren();for(const [label,value]of entries){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('details').append(dt,dd);}
    $('transaction').textContent=JSON.stringify(preview.preparedRequest||preview.transaction,null,2);
    $('status').textContent=usable()?(preview.registrationReady?'Read-only checks passed. Separate transaction approval is still required.':'Read-only checks complete. Gas funding is insufficient; registration remains blocked.'):'Preview is stale or incomplete. Refresh read-only checks. Registration remains blocked.';
    update();
  }
  async function load(path){busy=true;$('reviewed').checked=false;$('refresh').disabled=true;$('wallet').textContent='Connected wallet: not checked.';update();try{const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw new Error('Read-only check failed; do not proceed');preview=await response.json();render();}catch(error){preview=null;$('details').replaceChildren();$('transaction').textContent='';$('status').textContent=error.message;}finally{busy=false;$('refresh').disabled=false;update();}}
  $('refresh').addEventListener('click',()=>load('/refresh'));
  $('reviewed').addEventListener('change',update);$('provider').addEventListener('change',invalidate);
  $('connect').addEventListener('click',async()=>{
    busy=true;update();const provider=providers.get($('provider').value);
    try {
      const result=await connectForReview(provider,preview,$('reviewed').checked);
      $('wallet').textContent=`Connected wallet: ${result.wallet} · Celo 42220. No signature or transaction requested.`;
      if(observed?.removeListener){observed.removeListener('accountsChanged',invalidate);observed.removeListener('chainChanged',invalidate);}
      observed=provider;provider.on?.('accountsChanged',invalidate);provider.on?.('chainChanged',invalidate);
    }catch(error){$('reviewed').checked=false;$('wallet').textContent=error.code===4001?'Account access rejected. Nothing signed or sent.':error.message;}
    finally{busy=false;update();}
  });
  setInterval(update,1000);load('/preview');
}
