import { RegistrationFlow, pollRegistration } from './registration-flow.js';
// Account diagnostics are read-only. A transaction requires the owner's final click.
export const APPROVED_WALLET = '0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a';
export function previewProblem(preview, now = Date.now()) {
  const age=now-Date.parse(preview?.generatedAt);
  if(!preview)return 'Read-only checks are unavailable. Click Refresh read-only checks, then review again.';
  if(!Number.isFinite(age)||age<0||age>=10*60_000)return 'Refresh required: the saved checks are over ten minutes old or have an invalid timestamp. Click Refresh read-only checks, then tick the account-review checkbox again.';
  if(preview?.metadata?.published!==true)return 'Published metadata is not verified. Refresh read-only checks; Stage 1 stays blocked until verification succeeds.';
  if(preview?.simulation?.passed!==true)return 'The read-only RPC simulation failed. Refresh read-only checks before checking MetaMask.';
  if(preview?.audit?.currentOwnedCount!=='0'||preview?.audit?.latest?.currentOwnedCount!=='0')return 'Ownership checks did not confirm zero owned identities. Refresh or reconcile an existing identity; do not register again.';
  if(!preview?.gas?.feeBudget)return 'Current fee checks are unavailable. Refresh read-only checks before continuing.';
  if(typeof preview.transaction?.from!=='string'||preview.transaction.from.toLowerCase()!==APPROVED_WALLET.toLowerCase())return 'Preview wallet mismatch. Stop and restore the approved registration preview.';
  return null;
}
export const previewUsable = (preview,now=Date.now()) => previewProblem(preview,now)===null;
export function walletStatus(chain, accounts) {
  try{if(typeof chain!=='string'||!/^0x[0-9a-f]+$/i.test(chain))throw new Error();if(BigInt(chain)!==42220n)return {code:'wrong-chain',message:'Wrong chain. Select Celo mainnet (42220) in MetaMask, then recheck its status.'};}
  catch{return {code:'unavailable',message:'MetaMask returned an invalid network. Unlock or reconnect the extension, then recheck its status.'};}
  if(!Array.isArray(accounts)||accounts.some(a=>typeof a!=='string'||!/^0x[0-9a-f]{40}$/i.test(a)))return {code:'unavailable',message:'MetaMask returned invalid account data. Unlock or reconnect it, then recheck its status.'};
  if(accounts.length===0)return {code:'not-authorized',message:'No account is shared with this page. Review and click Check MetaMask account to request account access only.'};
  if(accounts.length!==1||accounts[0].toLowerCase()!==APPROVED_WALLET.toLowerCase())return {code:'wrong-account',message:`Wrong account: share only ${APPROVED_WALLET} with this page in MetaMask, then recheck its status.`};
  return {code:'ready',message:`MetaMask account available: ${accounts[0]} on Celo 42220.`};
}
export async function readWalletStatus(provider) {
  if(!provider||typeof provider.request!=='function'||provider.isConnected?.()===false)throw new Error('Provider unavailable. Unlock or reconnect MetaMask, then click Recheck MetaMask status.');
  const chain=await provider.request({method:'eth_chainId'});
  const network=walletStatus(chain,[]);
  if(['wrong-chain','unavailable'].includes(network.code))return {chain,accounts:[],...network};
  let accounts;
  try{accounts=await provider.request({method:'eth_accounts'});}catch(error){if(error.code===4100)accounts=[];else throw error;}
  return {chain,accounts,...walletStatus(chain,accounts)};
}
export async function connectForReview(provider, preview, reviewed) {
  if(!reviewed||!previewUsable(preview))throw new Error('Review a fresh successful preview before requesting account access');
  let status=await readWalletStatus(provider);
  if(!['ready','not-authorized'].includes(status.code))throw new Error(status.message);
  if(status.code==='not-authorized'){
    const accounts=await provider.request({method:'eth_requestAccounts'});
    const granted=walletStatus(status.chain,accounts);
    if(granted.code!=='ready')throw new Error(granted.message);
  }
  status=await readWalletStatus(provider);
  if(!previewUsable(preview)||status.code!=='ready')throw new Error(status.code==='ready'?'Refresh read-only checks and review again.':status.message);
  return {wallet:status.accounts[0],chainId:42220,signingEnabled:false};
}
const celo = value => { const n=BigInt(value);return `${n/10n**18n}.${(n%10n**18n).toString().padStart(18,'0').replace(/0+$/,'')||'0'} CELO`; };
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const providers = new Map();let preview,busy=true,policy,flow,connected=false,recovery={reserved:false};
  let selected=null,detach=()=>{},epoch=0,probe=0,connecting=false,expiredPreview=null;
  let wallet={code:'unselected',message:'Select MetaMask to check its network and shared accounts. No permission popup opens automatically.'};
  let loadError='',operation='Loading read-only checks…';
  const api=async(path,body)=>{const response=await fetch(path,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'content-type':'application/json','x-oyacheck-review':policy.csrf},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error||'Read-only verification unavailable');return data;};
  const usable = () => previewUsable(preview);
  const clearFinal=()=>{flow?.invalidate();$('final-stage').hidden=true;$('final-reviewed').checked=false;};
  const invalidate=()=>{epoch++;connected=false;clearFinal();$('reviewed').checked=false;};
  const available=()=>['ready','not-authorized','rejected'].includes(wallet.code);
  const update=()=>{
    const problem=previewProblem(preview);
    $('connect').disabled=busy||!policy||recovery.reserved||!$('reviewed').checked||Boolean(problem)||!selected||!available();
    $('provider').disabled=busy||!policy;$('reviewed').disabled=busy||!policy||recovery.reserved;
    $('refresh').disabled=busy;$('recheck-wallet').disabled=busy||!selected||!policy;
    $('prepare-final').disabled=busy||recovery.reserved||!connected||!$('reviewed').checked||Boolean(problem)||preview?.registrationReady!==true;
    $('submit').disabled=busy||recovery.reserved||!policy?.sendingEnabled||!flow?.final||!$('final-reviewed').checked||Date.now()-Date.parse(flow.final.preview.generatedAt)>60_000;
    $('submit').textContent=policy?.sendingEnabled?'Request one MetaMask confirmation':'Request one MetaMask confirmation · locked';
    $('attach-hash').disabled=busy||!recovery.reserved||Boolean(recovery.hash);$('receipt').disabled=busy||!recovery.hash;
    $('execution-policy').textContent=recovery.reserved?'One attempt is reserved. No additional request is authorized. Use read-only recovery.':policy?.sendingEnabled?'One owner-authorized MetaMask request, maximum total gas cost 0.08744715 CELO. Both reviews and a final button click are required; no automatic request or retry.':'Sending is locked. Review can proceed without any transaction popup.';
    $('status').textContent=busy?operation:(loadError||problem||(preview?.registrationReady?(policy?.sendingEnabled?'Read-only checks passed. Review both stages before requesting one MetaMask confirmation.':'Read-only checks passed. Sending is still locked at this checkpoint.'):'Account review is available. Stage 2 requires successful fee checks and sufficient balance.'));
    $('wallet').textContent=connected?`Stage 1 verified: ${APPROVED_WALLET} on Celo 42220. No signature requested.`:wallet.message;
    let help;
    if(busy)help=operation;
    else if(recovery.reserved)help='An existing attempt is reserved. Use read-only recovery; do not submit again.';
    else if(!policy)help='App initialization failed. Click Refresh read-only checks to retry.';
    else if(loadError||problem)help=loadError||problem;
    else if(providers.size===0)help='MetaMask provider unavailable. Install or unlock MetaMask Extension, then reload this page.';
    else if(!selected)help='Select MetaMask first.';
    else if(!available())help=wallet.message;
    else if(!$('reviewed').checked)help='Tick the account-review checkbox, then click Check MetaMask account.';
    else if(connected)help=preview?.registrationReady?'Stage 1 verified. Re-estimate and prepare final review to reach Stage 2.':'Stage 1 verified. Refresh fee/balance checks before Stage 2.';
    else help='Ready to check MetaMask. This cannot authorize a registration or payment.';
    $('stage1-help').textContent=help;
  };
  async function inspectWallet(){
    const provider=selected,version=epoch,request=++probe,wasPending=wallet.code==='pending';if(!provider)return;
    wallet={...wallet,code:'checking',message:'Checking MetaMask network and shared accounts (read-only)…'};update();
    try{
      const next=await readWalletStatus(provider);
      if(provider!==selected||version!==epoch||request!==probe)return;
      wallet=wasPending&&next.code==='not-authorized'?{...next,code:'pending',message:'Resolve the pending account-access request in MetaMask, then recheck status or reload this page.'}:next;
    }catch(error){
      if(provider!==selected||version!==epoch||request!==probe)return;
      wallet={code:'unavailable',message:'Provider unavailable. Unlock or reconnect MetaMask, then click Recheck MetaMask status.'};
    }
    update();
  }
  function selectProvider(){
    detach();invalidate();probe++;selected=providers.get($('provider').value)||null;
    wallet={code:'unselected',message:'Select MetaMask. Discovery never requests account permissions.'};
    if(!selected){update();return;}
    const provider=selected;
    const accountEvent=accounts=>{
      if(provider!==selected)return;
      const same=Array.isArray(accounts)&&Array.isArray(wallet.accounts)&&accounts.length===wallet.accounts.length&&accounts.every((a,i)=>typeof a==='string'&&a.toLowerCase()===wallet.accounts[i]?.toLowerCase());
      if(same)return;
      const next={chain:wallet.chain,accounts,...walletStatus(wallet.chain,accounts)};
      // Permission handshakes may announce the approved account while pending.
      if(!(connecting&&next.code==='ready'))invalidate();
      probe++;wallet=next;update();
      if(!next.chain)inspectWallet();
    };
    const chainEvent=chain=>{
      if(provider!==selected)return;
      try{if(wallet.chain&&BigInt(chain)===BigInt(wallet.chain))return;}catch{/* Invalid event fails closed below. */}
      invalidate();probe++;wallet={chain,accounts:wallet.accounts,...walletStatus(chain,wallet.accounts||[])};update();
      if(wallet.code!=='wrong-chain')inspectWallet();
    };
    const disconnected=()=>{if(provider!==selected)return;invalidate();probe++;wallet={code:'unavailable',message:'MetaMask disconnected. Reconnect or unlock the extension, then click Recheck MetaMask status.'};update();};
    const reconnected=()=>{if(provider!==selected)return;if(wallet.code==='unavailable'){invalidate();inspectWallet();}};
    for(const [event,handler]of [['accountsChanged',accountEvent],['chainChanged',chainEvent],['disconnect',disconnected],['connect',reconnected]])provider.on?.(event,handler);
    detach=()=>{for(const [event,handler]of [['accountsChanged',accountEvent],['chainChanged',chainEvent],['disconnect',disconnected],['connect',reconnected]])provider.removeListener?.(event,handler);};
    inspectWallet();
  }
  window.addEventListener('eip6963:announceProvider',event=>{
    const {info,provider}=event.detail||{};
    if(info?.rdns!=='io.metamask'||!info.uuid||typeof provider?.request!=='function')return;
    if(providers.has(info.uuid)){if(providers.get(info.uuid)!==provider){providers.set(info.uuid,provider);if($('provider').value===info.uuid)selectProvider();}return;}
    providers.set(info.uuid,provider);const option=document.createElement('option');option.value=info.uuid;option.textContent='MetaMask';$('provider').append(option);update();
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  function render() {
    const budget=preview.gas.feeBudget;
    const entries=[['Network','Celo mainnet · 42220'],['Required wallet',preview.transaction.from],['Registry',preview.transaction.to],
      ['Function','register(string agentURI) · 0xf2c298be'],['Metadata URL',preview.agentURI],['Native value','0 CELO'],
      ['Event tag',preview.attribution.codes.join(', ')],['Metadata',preview.metadata.published?'HTTP 200 · reviewed JSON matches':'Unverified'],
      ['Ownership',`${preview.audit.currentOwnedCount} identity NFTs at ${preview.audit.block.number}`],
      ['Wallet balance',celo(preview.audit.latest?.nativeCELOWei??preview.audit.nativeCELOWei)],['Gas estimate',preview.gas.estimate||'Unavailable'],
      ['Current gas price',`${preview.gas.priceWei} wei/gas`],['Indicative execution fee',preview.gas.indicativeExecutionCostWei?celo(preview.gas.indicativeExecutionCostWei):'Unavailable'],
      ['Maximum gas cost',budget?celo(BigInt(budget.gasLimit)*BigInt(budget.maxFeePerGasWei)):'Unavailable'],
      ['Buffered gas limit',budget?.gasLimit||'Unavailable'],['Planning fee reserve',budget?celo(budget.recommendedReserveWei):'Unavailable'],
      ['Fee details',budget?`Max fee ${budget.maxFeePerGasWei} wei/gas; priority ${budget.maxPriorityFeePerGasWei}; L1 bound ${budget.l1FeeUpperBoundWei} wei; operator ${budget.operatorFeeWei} wei`:'Fee check failed'],
      ['Captured',preview.generatedAt]];
    $('details').replaceChildren();for(const [label,value]of entries){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;$('details').append(dt,dd);}
    $('transaction').textContent=JSON.stringify(preview.preparedRequest||preview.transaction,null,2);
    update();
  }
  async function load(path){
    invalidate();probe++;busy=true;operation='Refreshing read-only checks…';loadError='';update();
    try{
      if(!policy){policy=await api('/policy');await recover();}
      const response=await fetch(path,{cache:'no-store'});if(!response.ok)throw new Error('Read-only refresh failed. Check the local server/RPC connection, then click Refresh read-only checks again.');
      preview=await response.json();expiredPreview=previewUsable(preview)?null:preview.generatedAt;render();
    }catch(error){preview=null;$('details').replaceChildren();$('transaction').textContent='';loadError=`Read-only checks failed: ${error.message} Click Refresh read-only checks to retry.`;}
    finally{busy=false;update();if(selected)await inspectWallet();}
  }
  $('refresh').addEventListener('click',()=>load('/refresh'));
  $('reviewed').addEventListener('change',update);$('provider').addEventListener('change',selectProvider);
  $('recheck-wallet').addEventListener('click',()=>{invalidate();inspectWallet();});
  $('connect').addEventListener('click',async()=>{
    if($('connect').disabled)return;
    const provider=selected,version=epoch,checkedPreview=preview;
    busy=true;connecting=true;operation='Checking the approved MetaMask account. Any permission request is account access only.';loadError='';update();
    try{
      const result=await connectForReview(provider,checkedPreview,$('reviewed').checked);
      if(provider!==selected||version!==epoch||checkedPreview!==preview)throw new Error('Wallet context changed during the check. Review and check the account again.');
      wallet={chain:'0xa4ec',accounts:[result.wallet],code:'ready',message:'Approved MetaMask account available.'};connected=true;
      flow=new RegistrationFlow({provider,expected:policy.expected,enabled:policy.sendingEnabled,approvedFingerprint:policy.approvedRequestFingerprint,
        prepare:()=>api('/final-review',{reviewed:true}),claim:body=>api('/claim',{...body,finalReviewed:true}),attach:body=>api('/attach-hash',body),recover:()=>api('/attempt')});
    }catch(error){
      connected=false;clearFinal();$('reviewed').checked=false;
      if(provider===selected&&version===epoch){
        wallet=error.code===4001?{...wallet,code:'rejected',message:'Account access rejected. Nothing signed or sent. Tick the review checkbox and click Check MetaMask account to try again manually.'}:
          error.code===-32002?{...wallet,code:'pending',message:'MetaMask has a pending account-access request. Resolve it in the extension; do not request it again. Then recheck status or reload this page.'}:
          {...wallet,code:'unavailable',message:error.message+' Recheck MetaMask status before continuing.'};
      }
    }finally{busy=false;connecting=false;update();}
  });
  $('prepare-final').addEventListener('click',async()=>{
    if($('prepare-final').disabled)return;
    const version=epoch,provider=selected;busy=true;operation='Refreshing fee, ownership and wallet checks for Stage 2…';loadError='';update();$('final-stage').hidden=true;$('final-reviewed').checked=false;
    try{
      const plan=await flow.finalReview($('reviewed').checked);
      if(version!==epoch||provider!==selected)throw new Error('Wallet changed during final review. Repeat Stage 1.');
      preview=plan.preview;render();
      $('calldata-fingerprint').textContent=plan.calldataFingerprint;$('plan-fingerprint').textContent=plan.fingerprint;
      $('final-stage').hidden=false;$('send-policy').textContent=policy.sendingEnabled?'One request authorized, at most 0.08744715 CELO gas cost. Confirm the exact request below; no retry is authorized.':'SENDING LOCKED AT THIS CHECKPOINT. No wallet signing request can be made.';
    }catch(error){clearFinal();loadError=error.message.includes('renewed owner approval')?error.message:error.message+' Refresh or recheck the wallet, then repeat review.';}
    finally{busy=false;update();}
  });
  $('final-reviewed').addEventListener('change',update);
  async function recover(){
    recovery=await api('/attempt');$('recovery').hidden=!recovery.reserved;
    if(recovery.reserved){connected=false;flow?.invalidate();$('final-stage').hidden=true;$('recovery-status').textContent=JSON.stringify(recovery,null,2);}
    update();
  }
  async function checkReceipt(){busy=true;update();try{const result=await pollRegistration(()=>api('/verify'));$('recovery-status').textContent=JSON.stringify(result,null,2);}catch(error){$('recovery-status').textContent='Recovery uncertain: '+error.message+'. Do not resubmit.';}finally{busy=false;update();}}
  $('submit').addEventListener('click',async event=>{
    if(!event.isTrusted||$('submit').disabled)return;
    busy=true;update();
    try{await flow.submit($('final-reviewed').checked,flow.final?.fingerprint);await recover();await checkReceipt();}
    catch(error){$('status').textContent=error.message;try{await recover();}catch{$('status').textContent+=' Recovery unavailable; do not resubmit.';}}
    finally{busy=false;update();}
  });
  $('receipt').addEventListener('click',checkReceipt);
  $('attach-hash').addEventListener('click',async()=>{busy=true;update();try{await api('/attach-hash',{hash:$('recovered-hash').value.trim(),fingerprint:recovery.attempt.fingerprint});await recover();}catch(error){$('recovery-status').textContent=error.message;}finally{busy=false;update();}});
  setInterval(()=>{
    if(preview&&!usable()&&expiredPreview!==preview.generatedAt){expiredPreview=preview.generatedAt;invalidate();}
    if(flow?.final&&Date.now()-Date.parse(flow.final.preview.generatedAt)>60_000){clearFinal();loadError='Final review expired. Re-estimate and prepare final review again.';}
    update();
  },1000);
  load('/preview');
}
