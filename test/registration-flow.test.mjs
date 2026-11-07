import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { RegistrationFlow, fingerprint, validateFinal, pollRegistration } from '../local/registration-flow.js';
import { RegistrationAttempt } from '../lib/registration-attempt.mjs';
import { registrationTransaction } from '../lib/agent-registration.mjs';
import { createReviewServer } from '../scripts/registration-review.mjs';
const saved=JSON.parse(await readFile(new URL('../docs/registration/unsigned-preview.json',import.meta.url),'utf8'));
const expected=registrationTransaction(),hash='0x'+'a'.repeat(64);
const fresh=()=>({...structuredClone(saved),generatedAt:new Date().toISOString()});
async function fixture(t,{enabled=true,walletError=null}={}){
  const dir=await mkdtemp(join(tmpdir(),'oya-registration-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const journal=new RegistrationAttempt(join(dir,'attempt.json'));let sends=0,chain='0xa4ec',account=expected.from;
  const provider={request:async({method,params})=>{
    if(method==='eth_chainId')return chain;if(method==='eth_accounts')return [account];
    if(method==='eth_sendTransaction'){sends++;assert.equal(journal.status().reserved,true);assert.deepEqual(params,[saved.preparedRequest]);if(walletError)throw walletError;return hash;}
    throw new Error('Unexpected provider method');
  }};
  const plan=async()=>{const preview=fresh();return {id:'test-plan',preview,fingerprint:await fingerprint(preview.preparedRequest),calldataFingerprint:await fingerprint(preview.transaction.data,true)};};
  const flow=new RegistrationFlow({enabled,provider,expected,prepare:plan,recover:async()=>journal.status(),
    claim:async()=>journal.claim(await plan()),attach:async body=>journal.attach(body.hash,body.fingerprint)});
  return {flow,journal,plan,provider,sends:()=>sends,setChain:v=>chain=v,setAccount:v=>account=v};
}
test('checkpoint lock denies send before any wallet request',async t=>{
  const f=await fixture(t,{enabled:false});let calls=0;f.flow.provider={request:()=>{calls++;}};
  await assert.rejects(f.flow.submit(true,'anything'),/Sending locked/);assert.equal(calls,0);assert.equal(f.journal.status().reserved,false);
});
test('two reviews bind a one-use exact request and persistent recovery blocks a second submission',async t=>{
  const f=await fixture(t);
  await assert.rejects(f.flow.finalReview(false),/First-stage/);
  const plan=await f.flow.finalReview(true);
  await assert.rejects(f.flow.submit(false,plan.fingerprint),/Final review/);
  const result=await f.flow.submit(true,plan.fingerprint);assert.equal(result.hash,hash);assert.equal(f.sends(),1);
  await assert.rejects(f.flow.submit(true,plan.fingerprint));
  const reopened=new RegistrationAttempt(f.journal.path);assert.equal(reopened.status().hash,hash);
  const another=new RegistrationFlow({...f.flow,recover:async()=>reopened.status()});
  await assert.rejects(another.finalReview(true),/Existing attempt/);assert.equal(f.sends(),1);
});
test('duplicate clicks produce exactly one request',async t=>{
  const f=await fixture(t);const plan=await f.flow.finalReview(true);
  const results=await Promise.allSettled([f.flow.submit(true,plan.fingerprint),f.flow.submit(true,plan.fingerprint)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.sends(),1);
});
for(const code of [4001,-32002,-32603])test(`wallet error ${code} preserves an attempt and never retries`,async t=>{
  const f=await fixture(t,{walletError:{code,message:'Mock wallet failure'}}),plan=await f.flow.finalReview(true);
  await assert.rejects(f.flow.submit(true,plan.fingerprint));assert.equal(f.journal.status().reserved,true);assert.equal(f.sends(),1);
  await assert.rejects(f.flow.finalReview(true));await assert.rejects(f.flow.submit(true,plan.fingerprint));assert.equal(f.sends(),1);
});
test('wrong chain, wrong account, rejected RPC and expired review fail before submission',async t=>{
  const f=await fixture(t);f.setChain('0x1');await assert.rejects(f.flow.finalReview(true),/Wrong/);
  f.setChain('0xa4ec');f.setAccount('0x'+'2'.repeat(40));await assert.rejects(f.flow.finalReview(true),/Wrong/);
  f.setAccount(expected.from);const plan=await f.flow.finalReview(true);f.flow.final={...plan,preview:{...plan.preview,generatedAt:new Date(Date.now()-61000).toISOString()}};
  await assert.rejects(f.flow.submit(true,plan.fingerprint),/Fresh successful/);assert.equal(f.sends(),0);
  f.flow.prepare=async()=>{throw new Error('RPC failed');};await assert.rejects(f.flow.finalReview(true),/RPC failed/);assert.equal(f.sends(),0);
});
test('owned identity, malformed metadata, changed calldata and insufficient balance block final review',()=>{
  for(const mutate of [p=>p.audit.latest.currentOwnedCount='1',p=>p.metadata.matchesReviewedMetadata=false,
    p=>p.preparedRequest.data+='00',p=>p.preparedRequest.to='0x'+'2'.repeat(40),p=>p.audit.latest.nativeCELOWei='0',
    p=>p.gas.feeBudget.recommendedReserveWei='1']){const p=fresh();mutate(p);assert.throws(()=>validateFinal(p,expected));}
});
test('hash persistence failure is ambiguous and never permits another request',async t=>{
  const f=await fixture(t);f.flow.attach=async()=>{throw new Error('disk unavailable');};const plan=await f.flow.finalReview(true);
  await assert.rejects(f.flow.submit(true,plan.fingerprint),/disk unavailable/);assert.equal(f.journal.status().reserved,true);assert.equal(f.sends(),1);
  f.journal.attach(hash,plan.fingerprint);assert.equal(new RegistrationAttempt(f.journal.path).status().hash,hash);
  assert.throws(()=>f.journal.attach('0x'+'b'.repeat(64),plan.fingerprint),/cannot be replaced/);
});
test('bounded receipt polling checks only the original hash, pending stays reserved and RPC errors stop',async()=>{
  let calls=0;const result=await pollRegistration(async()=>{calls++;return {state:'pending',hash};},{attempts:3,wait:async()=>{}});
  assert.equal(calls,3);assert.equal(result.state,'pending');assert.match(result.instruction,/never resubmit/);
  calls=0;await assert.rejects(pollRegistration(async()=>{calls++;throw new Error('RPC failed');},{wait:async()=>{}}));assert.equal(calls,1);
});
test('local server hard lock rejects claiming and stores no attempt',async t=>{
  const f=await fixture(t);const server=createReviewServer({load:async()=>fresh(),refresh:async()=>fresh(),attempts:f.journal});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`,policy=await(await fetch(origin+'/policy')).json();assert.equal(policy.sendingEnabled,false);
  const headers={'content-type':'application/json',origin,'x-oyacheck-review':policy.csrf};
  const plan=await(await fetch(origin+'/final-review',{method:'POST',headers,body:JSON.stringify({reviewed:true})})).json();assert.ok(plan.fingerprint);
  const denied=await fetch(origin+'/claim',{method:'POST',headers,body:JSON.stringify({id:plan.id,fingerprint:plan.fingerprint,finalReviewed:true})});assert.equal(denied.status,403);assert.equal(f.journal.status().reserved,false);
});
test('future unlocked mock server rechecks identity before claiming',async t=>{
  const f=await fixture(t);let changed=false;const server=createReviewServer({attempts:f.journal,sendingEnabled:true,load:async()=>fresh(),refresh:async()=>{const p=fresh();if(changed)p.audit.latest.currentOwnedCount='1';return p;}});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`,policy=await(await fetch(origin+'/policy')).json();
  const headers={'content-type':'application/json',origin,'x-oyacheck-review':policy.csrf};
  const plan=await(await fetch(origin+'/final-review',{method:'POST',headers,body:JSON.stringify({reviewed:true})})).json();changed=true;
  const response=await fetch(origin+'/claim',{method:'POST',headers,body:JSON.stringify({id:plan.id,fingerprint:plan.fingerprint,finalReviewed:true})});assert.equal(response.status,503);assert.equal(f.journal.status().reserved,false);
});

test('a changed fresh fee cap requires new review and cannot reserve or submit',async t=>{
  const f=await fixture(t);let changed=false;
  const server=createReviewServer({attempts:f.journal,sendingEnabled:true,load:async()=>fresh(),refresh:async()=>{
    const p=fresh();if(changed){const b=p.gas.feeBudget;b.maxFeePerGasWei=(BigInt(b.maxFeePerGasWei)-1n).toString();p.preparedRequest.maxFeePerGas='0x'+BigInt(b.maxFeePerGasWei).toString(16);b.recommendedReserveWei=(BigInt(b.gasLimit)*BigInt(b.maxFeePerGasWei)+BigInt(b.l1FeeUpperBoundWei)+BigInt(b.operatorFeeWei)).toString();}return p;
  }});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`,policy=await(await fetch(origin+'/policy')).json();
  const headers={'content-type':'application/json',origin,'x-oyacheck-review':policy.csrf};
  assert.equal((await fetch(origin+'/final-review',{method:'POST',headers:{'content-type':'application/json',origin},body:'{}'})).status,403);
  const plan=await(await fetch(origin+'/final-review',{method:'POST',headers,body:JSON.stringify({reviewed:true})})).json();changed=true;
  const response=await fetch(origin+'/claim',{method:'POST',headers,body:JSON.stringify({id:plan.id,fingerprint:plan.fingerprint,finalReviewed:true})});
  assert.equal(response.status,409);assert.equal(f.journal.status().reserved,false);assert.equal(f.sends(),0);
});

test('owner total-gas ceiling rejects even one wei above approval before a request',async t=>{
  const f=await fixture(t),p=fresh();p.gas.feeBudget.l1FeeUpperBoundWei='1';p.gas.feeBudget.recommendedReserveWei=(BigInt(p.gas.feeBudget.recommendedReserveWei)+1n).toString();
  assert.throws(()=>validateFinal(p,expected),{code:'approval-ceiling'});f.flow.prepare=async()=>({...await f.plan(),preview:p});
  await assert.rejects(f.flow.finalReview(true),/owner-approved/);assert.equal(f.sends(),0);assert.equal(f.journal.status().reserved,false);
});
test('pinned owner fingerprint rejects changed fee fields even below the approved ceiling',async t=>{
  const f=await fixture(t);f.flow.approvedFingerprint=await fingerprint(saved.preparedRequest);
  f.flow.prepare=async()=>{const p=fresh(),b=p.gas.feeBudget;b.maxFeePerGasWei=(BigInt(b.maxFeePerGasWei)-1n).toString();p.preparedRequest.maxFeePerGas='0x'+BigInt(b.maxFeePerGasWei).toString(16);b.recommendedReserveWei=(BigInt(b.gasLimit)*BigInt(b.maxFeePerGasWei)).toString();return {id:'changed',preview:p,fingerprint:await fingerprint(p.preparedRequest)};};
  await assert.rejects(f.flow.finalReview(true),/renewed owner approval/);assert.equal(f.sends(),0);assert.equal(f.journal.status().reserved,false);
});

test('ambiguous claim response cannot open a wallet confirmation',async t=>{
  const f=await fixture(t);f.flow.claim=async()=>({reserved:false});const plan=await f.flow.finalReview(true);
  await assert.rejects(f.flow.submit(true,plan.fingerprint),/Reservation response is ambiguous/);assert.equal(f.sends(),0);
  await assert.rejects(f.flow.submit(true,plan.fingerprint));assert.equal(f.sends(),0);
});
test('server pins the owner request and rejects material changes below the fee ceiling',async t=>{
  const f=await fixture(t);const approvedFingerprint=await fingerprint(saved.preparedRequest);
  const server=createReviewServer({attempts:f.journal,sendingEnabled:true,approvedFingerprint,load:async()=>fresh(),refresh:async()=>{
    const p=fresh(),b=p.gas.feeBudget;b.maxFeePerGasWei=(BigInt(b.maxFeePerGasWei)-1n).toString();p.preparedRequest.maxFeePerGas='0x'+BigInt(b.maxFeePerGasWei).toString(16);b.recommendedReserveWei=(BigInt(b.gasLimit)*BigInt(b.maxFeePerGasWei)).toString();return p;
  }});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`,policy=await(await fetch(origin+'/policy')).json();
  const response=await fetch(origin+'/final-review',{method:'POST',headers:{'content-type':'application/json',origin,'x-oyacheck-review':policy.csrf},body:JSON.stringify({reviewed:true})});
  assert.equal(response.status,409);assert.match((await response.json()).error,/renewed owner approval/);assert.equal(f.journal.status().reserved,false);
});

test('a review that expires while claiming cannot request MetaMask and stays reserved',async t=>{
  const f=await fixture(t),plan=await f.flow.finalReview(true),claim=f.flow.claim;
  f.flow.claim=async body=>{const result=await claim(body);f.flow.final={...plan,preview:{...plan.preview,generatedAt:new Date(Date.now()-61000).toISOString()}};return result;};
  await assert.rejects(f.flow.submit(true,plan.fingerprint),/Fresh successful/);
  assert.equal(f.sends(),0);assert.equal(f.journal.status().reserved,true);
});

test('read-only recovery preserves the recorded hash and precise failure without releasing the attempt',async t=>{
  const f=await fixture(t),plan=await f.plan();f.journal.claim(plan);f.journal.attach(hash,plan.fingerprint);
  const server=createReviewServer({attempts:f.journal,verify:async()=>{throw new Error('RPC HTTP 503');}});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`,response=await fetch(origin+'/verify'),body=await response.json();
  assert.equal(response.status,503);assert.equal(body.hash,hash);assert.equal(body.state,'needs-review');assert.match(body.error,/RPC HTTP 503/);
  assert.equal(f.journal.status().reserved,true);assert.equal(f.journal.status().hash,hash);assert.equal(f.sends(),0);
  assert.equal((await(await fetch(origin+'/policy')).json()).sendingEnabled,false);
});

test('a mined receipt awaiting finality remains read-only pending, with its original hash',async t=>{
  const f=await fixture(t),plan=await f.plan();f.journal.claim(plan);f.journal.attach(hash,plan.fingerprint);
  const server=createReviewServer({attempts:f.journal,verify:async()=>({state:'pending-finality',hash})});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const response=await fetch(`http://127.0.0.1:${server.address().port}/verify`);assert.deepEqual(await response.json(),{state:'pending-finality',hash});assert.equal(f.journal.status().reserved,true);assert.equal(f.sends(),0);
});
