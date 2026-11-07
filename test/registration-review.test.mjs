import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { createReviewServer } from '../scripts/registration-review.mjs';
import { connectForReview, previewUsable, previewProblem, walletStatus, readWalletStatus } from '../local/registration-review.js';
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
  assert.deepEqual(methods,['eth_chainId','eth_accounts','eth_chainId','eth_accounts']);
  wallet='0x'+'2'.repeat(40);await assert.rejects(connectForReview(provider,preview(),true),/Wrong account/);
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

test('stale preview explains how to restore eligibility without weakening freshness',()=>{
  const old={...preview(),generatedAt:new Date(Date.now()-11*60000).toISOString()};
  assert.match(previewProblem(old),/Refresh required/);assert.equal(previewUsable(old),false);
  assert.equal(previewProblem(preview()),null);
  assert.match(previewProblem({...preview(),metadata:{published:false}}),/metadata/);
  assert.match(previewProblem({...preview(),gas:{}}),/fee checks/);
});
test('network, account authorization and malformed provider results stay distinct',async()=>{
  const wallet=registrationTransaction().from;
  assert.equal(walletStatus('0x1',[wallet]).code,'wrong-chain');
  assert.equal(walletStatus('0xa4ec',[]).code,'not-authorized');
  assert.equal(walletStatus('0xa4ec',['0x'+'2'.repeat(40)]).code,'wrong-account');
  assert.equal(walletStatus('0xa4ec',[wallet,wallet]).code,'wrong-account');
  assert.equal(walletStatus('bad',[wallet]).code,'unavailable');
  assert.equal(walletStatus('0xa4ec','bad').code,'unavailable');
  assert.equal(walletStatus('0xa4ec',[wallet.toLowerCase()]).code,'ready');
  await assert.rejects(readWalletStatus({request:()=>{},isConnected:()=>false}),/Provider unavailable/);
});
test('permission is requested only on explicit review when no account is already shared',async()=>{
  const methods=[];let accounts=[];
  const provider={request:async({method})=>{methods.push(method);if(method==='eth_chainId')return '0xa4ec';if(method==='eth_accounts')return accounts;if(method==='eth_requestAccounts'){accounts=[registrationTransaction().from];return accounts;}throw new Error('Unexpected method');}};
  await assert.rejects(connectForReview(provider,preview(),false));assert.deepEqual(methods,[]);
  assert.equal((await connectForReview(provider,preview(),true)).signingEnabled,false);
  assert.equal(methods.filter(m=>m==='eth_requestAccounts').length,1);
  methods.length=0;await connectForReview(provider,preview(),true);assert.ok(!methods.includes('eth_requestAccounts'));
});
test('rejected account access never marks a wallet verified or retries automatically',async()=>{
  const methods=[];const provider={request:async({method})=>{methods.push(method);if(method==='eth_chainId')return '0xa4ec';if(method==='eth_accounts')return [];if(method==='eth_requestAccounts')throw Object.assign(new Error('Rejected'),{code:4001});throw new Error('Unexpected method');}};
  await assert.rejects(connectForReview(provider,preview(),true),{code:4001});
  assert.equal(methods.filter(m=>m==='eth_requestAccounts').length,1);assert.ok(!methods.some(m=>/send|sign/i.test(m)));
});
