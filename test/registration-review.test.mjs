import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { createReviewServer } from '../scripts/registration-review.mjs';
import { connectForReview, previewUsable } from '../local/registration-review.js';
import { registrationTransaction } from '../lib/agent-registration.mjs';
const preview=()=>({generatedAt:new Date().toISOString(),transaction:registrationTransaction(),metadata:{published:true},
  simulation:{passed:true},audit:{currentOwnedCount:'0',latest:{currentOwnedCount:'0'}},gas:{feeBudget:{}}});
test('fresh review and an explicit gesture are required before requesting account access',async()=>{
  let calls=0;const provider={request:async()=>{calls++;}};
  await assert.rejects(connectForReview(provider,preview(),false),/Review a fresh/);
  const stale={...preview(),generatedAt:new Date(Date.now()-601000).toISOString()};
  await assert.rejects(connectForReview(provider,stale,true),/Review a fresh/);
  assert.equal(calls,0);assert.equal(previewUsable({...preview(),metadata:{published:false}}),false);
  assert.equal(previewUsable({...preview(),audit:{currentOwnedCount:'0',latest:{currentOwnedCount:'1'}}}),false);
});
test('wallet review checks network before permissions, exact sole account, and never sends or signs',async()=>{
  const methods=[];let chain='0x1',wallet=registrationTransaction().from;
  const provider={request:async({method})=>{methods.push(method);if(method==='eth_chainId')return chain;if(['eth_accounts','eth_requestAccounts'].includes(method))return [wallet];throw new Error('Forbidden wallet method');}};
  await assert.rejects(connectForReview(provider,preview(),true),/Select Celo/);
  assert.deepEqual(methods,['eth_chainId']);methods.length=0;chain='0xa4ec';
  const result=await connectForReview(provider,preview(),true);
  assert.equal(result.signingEnabled,false);
  assert.deepEqual(methods,['eth_chainId','eth_requestAccounts','eth_chainId','eth_accounts']);
  wallet='0x'+'2'.repeat(40);await assert.rejects(connectForReview(provider,preview(),true),/exact supplied wallet/);
});
test('loopback review server denies mutation, execution endpoints, hostile Host and cross-site origins',async t=>{
  let refreshes=0;const server=createReviewServer({load:async()=>preview(),refresh:async()=>{refreshes++;return preview();}});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const response=await fetch(origin);assert.equal(response.status,200);assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal((await fetch(origin+'/preview')).status,200);assert.equal(refreshes,0);
  assert.equal((await fetch(origin+'/refresh')).status,200);assert.equal(refreshes,1);
  assert.equal((await fetch(origin+'/refresh')).status,429);
  assert.equal((await fetch(origin+'/preview',{method:'POST'})).status,405);
  assert.equal((await fetch(origin+'/send')).status,404);
  assert.equal((await fetch(origin+'/refresh',{headers:{origin:'https://evil.example'}})).status,403);
  const hostileStatus=await new Promise((resolve,reject)=>{
    const request=http.get(origin+'/refresh',{headers:{Host:'evil.example'}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);
  });
  assert.equal(hostileStatus,403);
});
