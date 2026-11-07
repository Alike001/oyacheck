// Isolated one-use submission controller; active policy comes from the local server.
export const APPROVED_MAX_TOTAL_GAS_WEI=87447150000000000n;
export const APPROVED_REQUEST_FINGERPRINT='sha256:c895acd4673689be17df6f78ed427d53b7c88450be472abb736b7da1fd2cf253';
const WALLET='0x9ceaa6abfb2bc1ac202f96496cdc683d86bc458a';
const REGISTRY='0x8004a169fb4a3325136eb29fa0ceb6d2e539a432';
const URI='https://oyacheck-beta.onrender.com/agent-registration.json';
const hex = value => typeof value==='string' && /^0x[0-9a-f]+$/i.test(value);
export async function fingerprint(value, bytes=false) {
  const input=bytes?Uint8Array.from(value.slice(2).match(/../g)||[],x=>parseInt(x,16)):
    new TextEncoder().encode(JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]]))));
  return 'sha256:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',input)),x=>x.toString(16).padStart(2,'0')).join('');
}
export function validateFinal(preview, expected, now=Date.now()) {
  const p=preview,tx=p?.preparedRequest,b=p?.gas?.feeBudget,age=now-Date.parse(p?.generatedAt);
  if(!Number.isFinite(age)||age<0||age>60_000||p?.registrationReady!==true||p?.metadata?.published!==true||
    p.metadata.matchesReviewedMetadata!==true||p.metadata.url!==URI||p?.simulation?.passed!==true||
    p.audit?.currentOwnedCount!=='0'||p.audit?.latest?.currentOwnedCount!=='0'||p.gas.simulationError||p.gas.feeError||!tx||!b)throw new Error('Fresh successful metadata, ownership, simulation and fee checks required');
  if(tx.from?.toLowerCase()!==WALLET||tx.to?.toLowerCase()!==REGISTRY||tx.chainId!=='0xa4ec'||tx.value!=='0x0'||p.agentURI!==URI||
    !expected||Object.entries(expected).some(([k,v])=>tx[k]!==v)||
    Object.keys(tx).sort().join(',')!=='chainId,data,from,gas,maxFeePerGas,maxPriorityFeePerGas,to,value'||
    !hex(tx.data)||tx.data.length%2!==0||!['gas','maxFeePerGas','maxPriorityFeePerGas'].every(k=>hex(tx[k])))throw new Error('Transaction does not match the exact approved registration contract and calldata');
  if(BigInt(tx.gas)!==BigInt(b.gasLimit)||BigInt(tx.maxFeePerGas)!==BigInt(b.maxFeePerGasWei)||
    BigInt(tx.maxPriorityFeePerGas)!==BigInt(b.maxPriorityFeePerGasWei)||BigInt(tx.gas)<=0n||BigInt(tx.maxFeePerGas)<=0n||
    BigInt(tx.maxPriorityFeePerGas)>BigInt(tx.maxFeePerGas)||BigInt(b.l1FeeUpperBoundWei)<0n||BigInt(b.operatorFeeWei)<0n)throw new Error('Fee fields mismatch');
  const reserve=BigInt(tx.gas)*BigInt(tx.maxFeePerGas)+BigInt(b.l1FeeUpperBoundWei)+BigInt(b.operatorFeeWei);
  if(reserve>APPROVED_MAX_TOTAL_GAS_WEI)throw Object.assign(new Error('Maximum total gas cost exceeds owner-approved 0.08744715 CELO. Stop for renewed owner approval.'),{code:'approval-ceiling'});
  if(reserve!==BigInt(b.recommendedReserveWei)||BigInt(p.audit.latest.nativeCELOWei)<reserve)throw new Error('Insufficient balance or inconsistent maximum gas cost');
  return true;
}
async function walletMatches(provider, expected) {
  const chain=await provider.request({method:'eth_chainId'}),accounts=await provider.request({method:'eth_accounts'});
  if(BigInt(chain)!==42220n||!Array.isArray(accounts)||accounts.length!==1||accounts[0].toLowerCase()!==expected.from.toLowerCase())throw new Error('Wrong connected wallet or chain');
}
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export class RegistrationFlow {
  constructor({provider,expected,prepare,claim,attach,recover,enabled=false,approvedFingerprint=null}){Object.assign(this,{provider,expected,prepare,claim,attach,recover,enabled,approvedFingerprint});this.busy=false;this.blocked=false;this.final=null;}
  invalidate(){this.final=null;}
  async finalReview(reviewed){
    if(!reviewed||this.busy||this.blocked)throw new Error('First-stage review required; no overlapping or repeated attempt');
    this.busy=true;this.final=null;
    try{
      if((await this.recover()).reserved){this.blocked=true;throw new Error('Existing attempt requires read-only recovery');}
      await walletMatches(this.provider,this.expected);
      const plan=await this.prepare();validateFinal(plan.preview,this.expected);
      if(await fingerprint(plan.preview.preparedRequest)!==plan.fingerprint)throw new Error('Review fingerprint mismatch');
      if(this.approvedFingerprint&&plan.fingerprint!==this.approvedFingerprint)throw new Error('Request changed. Stop for renewed owner approval.');
      await walletMatches(this.provider,this.expected);
      this.final=freeze(structuredClone(plan));return this.final;
    }finally{this.busy=false;}
  }
  async submit(reviewed,approvedFingerprint){
    // Check this BEFORE any wallet request; no automatic request is permitted.
    if(!this.enabled)throw new Error('Sending locked at this checkpoint; separate explicit human authorization required');
    if(!reviewed||!this.final||approvedFingerprint!==this.final.fingerprint||this.busy||this.blocked)throw new Error('Final review or one-use submission guard failed');
    this.busy=true;
    try{
      validateFinal(this.final.preview,this.expected);
      if(this.approvedFingerprint&&await fingerprint(this.final.preview.preparedRequest)!==this.approvedFingerprint)throw new Error('Request changed. Stop for renewed owner approval.');
      await walletMatches(this.provider,this.expected);
      // A durable irreversible claim precedes the only wallet send operation.
      this.blocked=true;
      const claimed=await this.claim({id:this.final.id,fingerprint:approvedFingerprint});
      if(claimed?.reserved!==true||claimed.attempt?.fingerprint!==approvedFingerprint)throw new Error('Reservation response is ambiguous; reconcile without requesting MetaMask');
      await walletMatches(this.provider,this.expected);
      validateFinal(this.final?.preview,this.expected);
      const hash=await this.provider.request({method:'eth_sendTransaction',params:[structuredClone(this.final.preview.preparedRequest)]});
      if(!/^0x[0-9a-f]{64}$/i.test(hash||''))throw new Error('Ambiguous wallet result; reconcile without resubmitting');
      const recorded=await this.attach({hash,fingerprint:approvedFingerprint});
      if(recorded?.reserved!==true||recorded.hash?.toLowerCase()!==hash.toLowerCase())throw new Error('Hash persistence is ambiguous; reconcile without resubmitting');
      return {hash,state:'pending'};
    }catch(error){
      const message=error.code===4001?'MetaMask rejected the request. Attempt remains locked; review before any new authorization.':
        error.code===-32002?'MetaMask has a pending request. Reconcile it; do not submit another.':error.message;
      throw new Error(message);
    }finally{this.final=null;this.busy=false;}
  }
}
export async function pollRegistration(check, {attempts=6,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  for(let i=0;i<attempts;i++){
    const result=await check();
    if(!['pending','pending-finality'].includes(result.state))return result;
    if(i===attempts-1)return {...result,instruction:'Still pending. Reconcile the same hash; never resubmit.'};
    await wait(5000);
  }
}
