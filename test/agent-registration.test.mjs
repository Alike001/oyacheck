import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AbiFunction, AbiEvent, AbiParameters } from 'ox';
import { fromDataSuffix } from '@celo/attribution-tags';
import { server } from '../server.mjs';
import { OWNER_AGENT_WALLET, IDENTITY_REGISTRY, AGENT_URI } from '../lib/agent-identity.mjs';
import { REGISTER, REGISTERED, TRANSFER, registrationTransaction, auditOwnedIdentities,
  checkPublishedMetadata, verifyRegistrationReceipt, postRegistrationMetadata, readOnlyRPC, registrationPreview, registrationReceiptStatus } from '../lib/agent-registration.mjs';
const metadata = JSON.parse(await readFile(new URL('../public/agent-registration.json',import.meta.url),'utf8'));
const hash = '0x'+'a'.repeat(64), blockHash = '0x'+'b'.repeat(64);
const address = '0x'+'2'.repeat(40);
const block = { number:'0x100',hash:blockHash,timestamp:'0x1000',baseFeePerGas:'0x1' };
function fixture(overrides = {}) {
  const log = {address:IDENTITY_REGISTRY, ...AbiEvent.encode(REGISTERED,{agentId:7n,owner:OWNER_AGENT_WALLET}),
    data:AbiParameters.encode(AbiParameters.from('string'),[AGENT_URI])};
  const mint = {address:IDENTITY_REGISTRY,...AbiEvent.encode(TRANSFER,{from:'0x'+'0'.repeat(40),to:OWNER_AGENT_WALLET,tokenId:7n}),data:'0x'};
  const transaction = {...registrationTransaction(),hash,blockHash,input:registrationTransaction().data};
  const receipt = {status:'0x1',gasUsed:'0x2',effectiveGasPrice:'0x3',l1Fee:'0x0',transactionHash:hash,blockNumber:block.number,blockHash,
    from:OWNER_AGENT_WALLET,to:IDENTITY_REGISTRY,logs:[log,mint]};
  const calls = [];
  const rpc = async (method,params) => {
    calls.push(method);
    if (overrides[method]) return overrides[method](params);
    if (method === 'eth_chainId') return '0xa4ec';
    if (method === 'eth_getBlockByNumber') return block;
    if (method === 'eth_getCode') return '0x6000';
    if (method === 'eth_getBalance') return '0x0';
    if (method === 'eth_estimateGas') return '0x30000';
    if (method === 'eth_gasPrice') return '0x1';
    if (method === 'eth_maxPriorityFeePerGas') return '0x1';
    if (method === 'eth_getTransactionReceipt') return receipt;
    if (method === 'eth_getTransactionByHash') return transaction;
    if (method === 'eth_call') {
      if (params[0].to.toLowerCase()==='0x420000000000000000000000000000000000000f') return AbiParameters.encode(AbiParameters.from('uint256'),[0n]);
      const selector = params[0].data.slice(0,10);
      if (selector==='0xf2c298be') return AbiFunction.encodeResult(REGISTER,999n);
      for (const [signature,value] of [
        ['function balanceOf(address) view returns(uint256)',0n],
        ['function ownerOf(uint256) view returns(address)',OWNER_AGENT_WALLET],
        ['function tokenURI(uint256) view returns(string)',AGENT_URI],
        ['function getAgentWallet(uint256) view returns(address)',OWNER_AGENT_WALLET],
      ]) { const fn = AbiFunction.from(signature); if (AbiFunction.encodeData(fn,[signature.includes('balanceOf')?OWNER_AGENT_WALLET:7n]).slice(0,10) === selector) return AbiFunction.encodeResult(fn,value); }
    }
    throw new Error('Unexpected read-only method');
  };
  return {rpc,receipt,transaction,calls};
}
test('exact tagged register(string) keeps the reviewed URI and issued code', () => {
  const tx = registrationTransaction();
  assert.equal(tx.from,OWNER_AGENT_WALLET);
  assert.equal(tx.to,IDENTITY_REGISTRY);
  assert.equal(tx.chainId,'0xa4ec');
  assert.equal(tx.value,'0x0');
  assert.equal(tx.data.slice(0,10),'0xf2c298be');
  assert.deepEqual(AbiFunction.decodeData(REGISTER,tx.data),[AGENT_URI]);
  assert.deepEqual(fromDataSuffix(tx.data),{codes:['celo_03e76ac742c7'],schemaId:0});
});
test('zero finalized balance is complete only for current NFT ownership',async()=>{
  const {rpc} = fixture();const result = await auditOwnedIdentities(rpc);
  assert.equal(result.currentOwnedCount,'0');assert.equal(result.completeForCurrentOwnership,true);
  assert.match(result.receivingWalletOrHistoricalIdentitySearch,/Not covered/);
});
test('RPC failure, wrong chain and missing registry never imply no identities',async()=>{
  for (const changes of [{eth_call:()=>{throw new Error('RPC unavailable');}},
    {eth_chainId:()=> '0x1'}, {eth_getCode:()=> '0x'},
    {eth_getBlockByNumber:([tag])=>tag==='finalized'?block:{...block,hash:'0x'+'c'.repeat(64)}}]) {
    await assert.rejects(auditOwnedIdentities(fixture(changes).rpc));
  }
  const fn = AbiFunction.from('function balanceOf(address) view returns(uint256)');
  const existing = await auditOwnedIdentities(fixture({eth_call:()=>AbiFunction.encodeResult(fn,1n)}).rpc);
  assert.equal(existing.completeForCurrentOwnership,false);assert.match(existing.conclusion,/identities exist/);
});
test('read-only RPC denies all signing and broadcast methods before network access',async()=>{
  for (const method of ['eth_sendTransaction','eth_sendRawTransaction','personal_sign','eth_signTypedData_v4']) await assert.rejects(readOnlyRPC()(method,[]),/not read-only/);
});
test('metadata URL needs successful JSON equal to reviewed content',async()=>{
  for (const response of [new Response('Not found',{status:404}),
    new Response(JSON.stringify(metadata),{headers:{'content-type':'text/html'}}),
    new Response('{broken',{headers:{'content-type':'application/json'}}),
    new Response(JSON.stringify({...metadata,x402Support:true}),{headers:{'content-type':'application/json'}})]) {
    assert.equal((await checkPublishedMetadata(metadata,async()=>response)).published,false);
  }
  assert.equal((await checkPublishedMetadata(metadata,async()=>Response.json(metadata))).published,true);
});
test('unpublished metadata and empty gas balance cannot become registration readiness',async()=>{
  const result = await registrationPreview(fixture().rpc,metadata,async()=>new Response('',{status:404}));
  assert.equal(result.registrationReady,false);assert.equal(result.authorizedToSignOrBroadcast,false);
  assert.equal(result.gas.sufficientForIndicativeExecutionCost,false);
  const published = await registrationPreview(fixture().rpc,metadata,async()=>Response.json(metadata));
  assert.equal(published.registrationReady,false);
});
test('receipt verifies actual event ID and builds unpublished post-registration metadata',async()=>{
  const f = fixture();const result = await verifyRegistrationReceipt(f.rpc,hash);
  assert.equal(result.registration.agentId,7);assert.equal(result.agentWallet.toLowerCase(),OWNER_AGENT_WALLET.toLowerCase());
  assert.deepEqual(postRegistrationMetadata(metadata,result).registrations,[result.registration]);
  assert.throws(()=>postRegistrationMetadata(metadata,{}),/Verified receipt/);
  assert.ok(f.calls.every(name=>!name.includes('send')&&!name.includes('sign')));
});
test('forged events, failed transactions and mismatched on-chain identity are rejected',async()=>{
  const cases = [f=>f.receipt.status='0x0',f=>f.receipt.logs[0].address=address,
    f=>f.receipt.logs.pop(),f=>f.transaction.from=address,
    f=>f.transaction.input=f.transaction.input.slice(0,-2),
    f=>f.receipt.blockNumber='0x101',f=>f.receipt.blockHash='0x'+'d'.repeat(64),
    f=>f.receipt.logs[0].removed=true];
  for (const mutate of cases) { const f=fixture();mutate(f);await assert.rejects(verifyRegistrationReceipt(f.rpc,hash)); }
  const f=fixture();
  const rpc=async(method,params)=> method==='eth_call' ? AbiFunction.encodeResult(AbiFunction.from('function ownerOf(uint256) view returns(address)'),address) : f.rpc(method,params);
  await assert.rejects(verifyRegistrationReceipt(rpc,hash));
});
test('stable public metadata route is JSON and does not enable financial endpoints',async t=>{
  server.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const response=await fetch(origin+'/agent-registration.json');
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^application\/json/);
  assert.deepEqual(await response.json(),metadata);
  assert.equal(metadata.x402Support,false);assert.equal(metadata.services.length,1);assert.equal(metadata.services[0].name,'web');
  for (const path of ['/api/mainnet/session','/api/buy/quote','/api/buy/inspect']) assert.equal((await fetch(origin+path)).status,403);
});

test('fresh tagged simulation, fee buffer and oracle bounds determine registration readiness',async()=>{
  const f=fixture({eth_getBalance:()=> '0xffffffffff'});
  const result=await registrationPreview(f.rpc,metadata,async()=>Response.json(metadata));
  assert.equal(result.simulation.passed,true);
  assert.equal(result.gas.feeBudget.gasLimit,'235930');
  assert.equal(result.gas.feeBudget.maxFeePerGasWei,'3');
  assert.equal(result.gas.feeBudget.recommendedReserveWei,'707790');
  assert.equal(BigInt(result.preparedRequest.gas),235930n);
  assert.equal(BigInt(result.preparedRequest.maxFeePerGas),3n);
  assert.equal(result.preparedRequest.data,result.transaction.data);
  assert.equal(result.registrationReady,true);
  assert.equal(result.authorizedToSignOrBroadcast,false);
  assert.equal(Object.hasOwn(result,'agentId'),false,'Predicted agent ID must not be published as evidence');
  assert.equal(Object.hasOwn(result.simulation,'agentId'),false);
});
test('simulation and oracle failures keep registration blocked',async()=>{
  for (const location of ['registry','oracle']){
    const f=fixture();const rpc=async(method,params)=>{
      if(method==='eth_call'&&((location==='registry'&&params[0].data.startsWith('0xf2c298be'))||
        (location==='oracle'&&params[0].to.toLowerCase()==='0x420000000000000000000000000000000000000f')))throw new Error('Simulation unavailable');
      return f.rpc(method,params);
    };
    const result=await registrationPreview(rpc,metadata,async()=>Response.json(metadata));
    assert.equal(result.registrationReady,false);
    assert.ok(result.gas.simulationError||result.gas.feeError);
  }
});

test('receipt recovery classifies pending, finality, failed and genuinely verified registration',async()=>{
  const pending=fixture({eth_getTransactionReceipt:()=>null});assert.equal((await registrationReceiptStatus(pending.rpc,hash)).state,'pending');
  const failed=fixture();failed.receipt.status='0x0';assert.equal((await registrationReceiptStatus(failed.rpc,hash)).state,'failed');
  const waiting=fixture();waiting.receipt.blockNumber='0x101';assert.equal((await registrationReceiptStatus(waiting.rpc,hash)).state,'pending-finality');
  const verified=await registrationReceiptStatus(fixture().rpc,hash);assert.equal(verified.state,'verified');assert.equal(verified.evidence.registration.agentId,7);
});

test('recovered final transaction must preserve the reviewed gas and fee caps',async()=>{
  const f=fixture(),request={...registrationTransaction(),gas:'0x350ac',maxFeePerGas:'0x5db6de9900',maxPriorityFeePerGas:'0x9502f900'};
  Object.assign(f.transaction,request);assert.equal((await registrationReceiptStatus(f.rpc,hash,request)).state,'verified');
  f.transaction.maxFeePerGas='0x1';await assert.rejects(registrationReceiptStatus(f.rpc,hash,request),/gas\/fee fields differ/);
});

test('genuine receipt checks require fee evidence and reject a settled total above approval',async()=>{
  const f=fixture(),request={...registrationTransaction(),gas:'0x350ac',maxFeePerGas:'0x5db6de9900',maxPriorityFeePerGas:'0x9502f900'};
  Object.assign(f.transaction,request);const result=await registrationReceiptStatus(f.rpc,hash,request);
  assert.equal(result.evidence.fees.totalGasCostWei,'6');assert.equal(result.evidence.fees.withinApprovedCeiling,true);assert.equal(result.explorerUrl,`https://celoscan.io/tx/${hash}`);
  f.transaction.feeCurrency='0x'+'1'.repeat(40);await assert.rejects(registrationReceiptStatus(f.rpc,hash,request),/Fee currency differs/);delete f.transaction.feeCurrency;
  delete f.receipt.l1Fee;await assert.rejects(registrationReceiptStatus(f.rpc,hash,request),/lacks L1 fee evidence/);
  f.receipt.l1Fee='0x'+(87447150000000000n+1n).toString(16);await assert.rejects(registrationReceiptStatus(f.rpc,hash,request),/exceeds approval/);
});
