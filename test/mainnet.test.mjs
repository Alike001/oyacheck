import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MainnetStore, publicPurchase, fail } from '../lib/mainnet-store.mjs';
import { MainnetPilot, parseMainnetOffer, createMainnetTransport, validateWallet, TOKENS, RECIPIENT, ENDPOINT } from '../lib/mainnet-buy.mjs';
import { reconcileMainnet } from '../lib/mainnet-reconcile.mjs';
import { fixture, plan, config, tx } from './fixtures/mainnet-server.mjs';

async function localStore(t) {
  const dir=await mkdtemp(join(tmpdir(),'oya-ledger-'));
  const path=join(dir,'pilot.sqlite');const store=new MainnetStore(path);
  t.after(async()=>{try{store.close();}catch{}await rm(dir,{recursive:true,force:true});});
  return {store,path};
}
function requested(store,owner='owner',requestId='request-id-0000001') {
  const row=store.create(owner,requestId,'binding',plan('secure-verifymydevice.ng'));
  return store.transition(owner,row.id,'request',row.fingerprint);
}
test('idempotency persists across reopen and binds request IDs to the investigation',async t=>{
  const {store,path}=await localStore(t);const row=requested(store);
  const other=new MainnetStore(path);t.after(()=>other.close());
  assert.equal(other.existing('owner','request-id-0000001','binding').id,row.id);
  assert.throws(()=>other.existing('owner','request-id-0000001','other'),/another investigation/);
  assert.throws(()=>other.get(row.id,'stranger'),/not found/);
});
test('forged approval, cancellation and expiration cannot reserve funds',async t=>{
  const {store}=await localStore(t);const row=store.create('owner','request','binding',plan('secure-verifymydevice.ng'));
  assert.throws(()=>store.transition('owner',row.id,'request','forged'),/does not match/);
  assert.throws(()=>store.claim(row.id,row.fingerprint),/operator-approved/);
  store.transition('owner',row.id,'cancel',row.fingerprint);
  assert.throws(()=>store.claim(row.id,row.fingerprint),/operator-approved/);
  const fresh=requested(store,'owner','next');
  t.mock.method(Date,'now',()=>fresh.expires+1);
  assert.equal(store.get(fresh.id,'owner').state,'expired');
  assert.throws(()=>store.claim(fresh.id,fresh.fingerprint),/operator-approved/);
});
test('one payer allowance survives restarts, replay, multiple connections and token changes',async t=>{
  const {store,path}=await localStore(t);const row=requested(store);store.claim(row.id,row.fingerprint);
  const second=new MainnetStore(path);t.after(()=>second.close());
  assert.throws(()=>second.claim(row.id,row.fingerprint),/operator-approved/);
  store.finish(row.id,null,'interrupted');
  const other=second.create('another-user','request','binding',{...plan('secure-verifymydevice.ng'),token:'USAT',asset:TOKENS.USAT});
  second.transition('another-user',other.id,'request',other.fingerprint);
  assert.throws(()=>second.claim(other.id,other.fingerprint),/already reserved/);
});
test('immutable per-purchase and per-user daily ceilings fail closed',async t=>{
  const {store}=await localStore(t);
  for(const atomic of [0,-1,10001,1.5]) {
    const row=store.create('owner',String(atomic),'bind',{...plan('secure-verifymydevice.ng'),atomic});
    store.transition('owner',row.id,'request',row.fingerprint);
    assert.throws(()=>store.claim(row.id,row.fingerprint),/ceiling/);
  }
  const first=requested(store);store.claim(first.id,first.fingerprint);store.finish(first.id,null,'unknown');
  const row=store.create('owner','new-payer','bind',{...plan('secure-verifymydevice.ng'),atomic:10000,payer:'0x'+'2'.repeat(40)});
  store.transition('owner',row.id,'request',row.fingerprint);
  assert.throws(()=>store.claim(row.id,row.fingerprint),/daily pilot ceiling/);
});
test('crash recovery marks stale executing state without unlocking its reservation',async t=>{
  const {store}=await localStore(t);const row=requested(store);store.claim(row.id,row.fingerprint);
  const now=Date.now();t.mock.method(Date,'now',()=>now+121_000);
  assert.equal(store.get(row.id).state,'needs-review');
  assert.throws(()=>store.claim(row.id,row.fingerprint),/operator-approved/);
});
test('execution disabled and price drift make zero financial calls',async t=>{
  const {store}=await localStore(t);const row=requested(store);let calls=0;
  const transport={quote:async()=>({...row.plan,atomic:3607}),buy:async()=>{calls++;}};
  await assert.rejects(new MainnetPilot(store,transport,{...config,execute:false}).execute(row.id,row.fingerprint),/disabled/);
  await assert.rejects(new MainnetPilot(store,transport,config).execute(row.id,row.fingerprint),/changed/);
  assert.equal(calls,0);
});
for(const outcome of ['success','partial'])test(`${outcome} is durable and never automatically repeated`,async t=>{
  const f=await fixture();t.after(()=>f.close());f.setMode(outcome);
  const row=await f.pilot.quote('owner','secure-verifymydevice.ng','request-id-0000001');
  f.store.transition('owner',row.id,'request',row.fingerprint);
  const value=await f.pilot.execute(row.id,row.fingerprint);
  assert.equal(value.state,outcome==='success'?'verification-required':'needs-review');
  assert.equal(value.transaction_hash,tx);
  assert.doesNotMatch(JSON.stringify(publicPurchase(value)),/MOCK SECRET/);
  await assert.rejects(f.pilot.execute(row.id,row.fingerprint),/operator-approved/);
  assert.equal(f.stats().calls,1);
});
for(const mode of ['unavailable','funds'])test(`${mode} causes no financial operation`,async t=>{
  const f=await fixture();t.after(()=>f.close());f.setMode(mode);
  await assert.rejects(f.pilot.quote('owner','secure-verifymydevice.ng','request-id-0000001'));
  assert.equal(f.stats().calls,0);
});
test('unsupported link cannot even reach the quoting provider',async t=>{
  const f=await fixture();t.after(()=>f.close());
  await assert.rejects(f.pilot.quote('owner','example.org','request-id-0000001'),/NCC advisory/);
  assert.deepEqual(f.stats(),{calls:0,quotes:0});
});

const catalog={capabilities:[{id:'browser.sessions.create',available:true,method:'POST',url:ENDPOINT,sandboxNetwork:'celo-sepolia',inputSchema:{properties:{durationMinutes:{type:'integer',enum:[1]}}}}],
  payment:{chainId:42220,network:'celo',payTo:RECIPIENT,tokens:Object.entries(TOKENS).map(([symbol,asset])=>({symbol,asset,decimals:6}))}};
const challenge=token=>({x402Version:1,accepts:[{scheme:'exact',network:'celo',asset:TOKENS[token],resource:ENDPOINT,payTo:RECIPIENT,maxAmountRequired:'3606',extra:{gateway:{capability:'browser.sessions.create',durationMinutes:1}}}]});
for(const token of Object.keys(TOKENS))test(`published mainnet exact offer supports ${token}`,()=>{
  assert.equal(parseMainnetOffer(catalog,challenge(token),token).atomic,3606);
});
for(const mutate of [c=>{c.accepts[0].network='celo-sepolia';},c=>{c.accepts[0].maxAmountRequired='10001';},c=>{c.accepts[0].payTo='0x'+'0'.repeat(40);},c=>{c.x402Version=2;},c=>{c.accepts[0].resource='https://evil.test';}])test('unsupported price/chain/recipient/protocol fails closed',()=>{
  const value=challenge('USDC');mutate(value);assert.throws(()=>parseMainnetOffer(catalog,value,'USDC'));
});
test('wallet validation never creates an account or falls back to a default',()=>{
  assert.throws(()=>validateWallet({...config,account:''}),/existing named/);
  assert.throws(()=>validateWallet({...config,token:'CELO'}),/existing named/);
});
test('real adapter requests only free discovery and rejects an unavailable provider',async t=>{
  t.mock.method(globalThis,'fetch',async()=>new Response('{}',{status:503}));
  await assert.rejects(createMainnetTransport(config).quote('secure-verifymydevice.ng'),/provider is unavailable/);
});
test('reconciliation requires correct chain, payer, recipient, token, time and bounded Transfer',async t=>{
  const {store}=await localStore(t);const row=requested(store);store.claim(row.id,row.fingerprint);store.recordTransaction(row.id,tx);store.finish(row.id,null,'partial');
  const topic=address=>'0x'+address.slice(2).padStart(64,'0');
  const receipt={transactionHash:tx,status:'0x1',blockNumber:'0x1',logs:[{address:TOKENS.USDC,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',topic(config.payer),topic(RECIPIENT)],data:'0xe16'}]};
  const rpc=async(method)=>method==='eth_chainId'?'0xa4ec':method==='eth_getBlockByNumber'?{timestamp:'0x'+Math.floor(Date.now()/1000).toString(16)}:receipt;
  await assert.rejects(reconcileMainnet(store,row.id,tx,async()=> '0xaa36a7'),/mainnet/);
  const copy=structuredClone(receipt);receipt.logs[0].topics[1]=topic('0x'+'2'.repeat(40));
  await assert.rejects(reconcileMainnet(store,row.id,tx,rpc),/matching bounded/);
  Object.assign(receipt,copy);
  assert.equal((await reconcileMainnet(store,row.id,tx,rpc)).state,'settled-unfulfilled');
  assert.equal(store.get(row.id).settlement.includes('3606'),true);
  const next=requested(store,'new-user','another');
  assert.throws(()=>store.claim(next.id,next.fingerprint),/already reserved/);
});

test('HTTP ownership, CSRF, server plan, cancellation and absence of payment endpoints',async t=>{
  const f=await fixture();t.after(()=>f.close());
  const first=await fetch(f.origin+'/api/mainnet/session');const csrf=(await first.json()).csrf;
  const cookie=first.headers.get('set-cookie').split(';')[0];
  const post=(path,body,extra={})=>fetch(f.origin+path,{method:'POST',headers:{cookie,origin:f.origin,'content-type':'application/json','x-oyacheck-csrf':csrf,...extra},body:JSON.stringify(body)});
  assert.equal((await post('/api/mainnet/quote',{input:'secure-verifymydevice.ng',requestId:'request-id-0000001'},{'x-oyacheck-csrf':'forged'})).status,403);
  assert.equal((await post('/api/mainnet/quote',{input:'secure-verifymydevice.ng',requestId:'request-id-0000001',atomic:1})).status,400);
  const response=await post('/api/mainnet/quote',{input:'secure-verifymydevice.ng',requestId:'request-id-0000001'});assert.equal(response.status,200);const row=await response.json();
  assert.equal((await fetch(f.origin+`/api/mainnet/purchases/${row.id}`)).status,404);
  assert.equal((await post(`/api/mainnet/purchases/${row.id}/request`,{fingerprint:'forged'})).status,403);
  assert.equal((await post(`/api/mainnet/purchases/${row.id}/request`,{fingerprint:row.fingerprint,approved:true})).status,400);
  assert.equal((await post(`/api/mainnet/purchases/${row.id}/request`,{fingerprint:row.fingerprint})).status,200);
  assert.equal((await post(`/api/mainnet/purchases/${row.id}/execute`,{fingerprint:row.fingerprint})).status,404);
  const cancelled=await post(`/api/mainnet/purchases/${row.id}/cancel`,{fingerprint:row.fingerprint});assert.equal((await cancelled.json()).state,'cancelled');
  assert.equal(f.stats().calls,0);
  const reload=await fetch(f.origin+`/api/mainnet/purchases/${row.id}`,{headers:{cookie}});assert.equal((await reload.json()).state,'cancelled');
});

test('real adapter enforces named wallet, mainnet token, exact cap and no sandbox fallback using a fake CLI',async t=>{
  const {writeFile,chmod}=await import('node:fs/promises');
  const dir=await mkdtemp(join(tmpdir(),'oya-named-wallet-'));const log=join(dir,'args.jsonl');
  const previous=process.env.PATH;process.env.PATH=dir+':'+previous;
  t.after(async()=>{process.env.PATH=previous;await rm(dir,{recursive:true,force:true});});
  await writeFile(join(dir,'buy'),`#!${process.execPath}\nconst fs=require('node:fs'),args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(args)+'\\n');if(args.includes('whoami'))console.log(${JSON.stringify(config.account+' on celo\n  pays from '+config.payer+'\n  balances 1.000000 USDC')});else console.log(JSON.stringify({capability:'browser.sessions.create',transaction:${JSON.stringify(tx)},browser:{sessionId:'session',status:'ready',accessToken:'MOCK_SECRET',commandUrl:'https://gateway.usebuy.ai/v1/browser/sessions/session/commands',statusUrl:'https://gateway.usebuy.ai/v1/browser/sessions/session'}}));\n`);
  await chmod(join(dir,'buy'),0o700);
  t.mock.method(globalThis,'fetch',async url=>Response.json(url.endsWith('/catalog')?catalog:challenge('USDC'),{status:url.endsWith('/catalog')?200:402}));
  const adapter=createMainnetTransport(config);const quoted=await adapter.quote('secure-verifymydevice.ng');
  assert.equal((await adapter.buy(quoted)).transaction,tx);
  const calls=(await readFile(log,'utf8')).trim().split('\n').map(s=>JSON.parse(s));
  assert.deepEqual(calls[0],['--account','mock-payer','whoami']);
  assert.deepEqual(calls[1].slice(0,7),['--account','mock-payer','curl','--max-amount','0.003606','--token','USDC']);
  assert.ok(calls.every(args=>!args.includes('--sandbox')&&!args.includes('setup')&&!args.includes('send')));
  await assert.rejects(createMainnetTransport({...config,execute:false}).buy(quoted),/execution configuration/);
});
test('real adapter refuses insufficient named-wallet balance before any purchase',async t=>{
  const {writeFile,chmod}=await import('node:fs/promises');const dir=await mkdtemp(join(tmpdir(),'oya-no-funds-'));
  const previous=process.env.PATH;process.env.PATH=dir+':'+previous;
  t.after(async()=>{process.env.PATH=previous;await rm(dir,{recursive:true,force:true});});
  await writeFile(join(dir,'buy'),`#!${process.execPath}\nconsole.log(${JSON.stringify(config.account+' on celo\n pays from '+config.payer+'\n balances 0 USDC')});\n`);await chmod(join(dir,'buy'),0o700);
  t.mock.method(globalThis,'fetch',async url=>Response.json(url.endsWith('/catalog')?catalog:challenge('USDC'),{status:url.endsWith('/catalog')?200:402}));
  await assert.rejects(createMainnetTransport(config).quote('secure-verifymydevice.ng'),/lacks the quoted token/);
});
test('cross-origin, DNS-rebinding Host and disabled mainnet routes fail closed',async t=>{
  const f=await fixture();t.after(()=>f.close());
  const session=await fetch(f.origin+'/api/mainnet/session');const csrf=(await session.json()).csrf;const cookie=session.headers.get('set-cookie').split(';')[0];
  const body=JSON.stringify({input:'secure-verifymydevice.ng',requestId:'request-id-0000001'});
  assert.equal((await fetch(f.origin+'/api/mainnet/quote',{method:'POST',headers:{cookie,'x-oyacheck-csrf':csrf,'content-type':'application/json',origin:'http://evil.test'},body})).status,403);
  const http=await import('node:http');
  const hostStatus=await new Promise((resolve,reject)=>{const req=http.get(f.origin+'/api/mainnet/session',{headers:{Host:'evil.test'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);});
  assert.equal(hostStatus,403);
  assert.equal(f.stats().calls,0);
});
test('a killed operator process leaves a durable reservation and cannot replay after restart',async t=>{
  const {spawn}=await import('node:child_process');
  const {store,path}=await localStore(t);const row=requested(store);
  const moduleURL=new URL('../lib/mainnet-store.mjs',import.meta.url).href;
  const source=`import {MainnetStore} from ${JSON.stringify(moduleURL)};const s=new MainnetStore(${JSON.stringify(path)});s.claim(${JSON.stringify(row.id)},${JSON.stringify(row.fingerprint)});process.kill(process.pid,'SIGKILL');`;
  const child=spawn(process.execPath,['--input-type=module','-e',source],{stdio:'ignore'});
  const signal=await new Promise((resolve,reject)=>{child.on('exit',(code,signal)=>resolve(signal));child.on('error',reject);});
  assert.equal(signal,'SIGKILL');
  assert.equal(store.get(row.id).state,'executing');
  assert.throws(()=>store.claim(row.id,row.fingerprint),/operator-approved/);
});
test('source result is only complete after a matching bounded receipt, without trusting browser assertions',async t=>{
  const {store}=await localStore(t);const row=requested(store);store.claim(row.id,row.fingerprint);store.recordTransaction(row.id,tx);
  store.finish(row.id,{sourceTextSha256:'a'.repeat(64),scope:'Only the NCC advisory was inspected.'});
  const topic=address=>'0x'+address.slice(2).padStart(64,'0');
  const receipt={transactionHash:tx,status:'0x1',blockNumber:'0x1',logs:[{address:TOKENS.USDC,topics:['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',topic(config.payer),topic(RECIPIENT)],data:'0xe16'}]};
  const rpc=async method=>method==='eth_chainId'?'0xa4ec':method==='eth_getBlockByNumber'?{timestamp:'0x'+Math.floor(Date.now()/1000).toString(16)}:receipt;
  receipt.logs[0].address=TOKENS.USDT;
  await assert.rejects(reconcileMainnet(store,row.id,tx,rpc),/matching bounded/);
  receipt.logs[0].address=TOKENS.USDC;receipt.logs[0].data='0x2711';
  await assert.rejects(reconcileMainnet(store,row.id,tx,rpc),/matching bounded/);
  receipt.logs[0].data='0xe16';
  const verified=await reconcileMainnet(store,row.id,tx,rpc);
  assert.equal(verified.state,'complete');assert.equal(publicPurchase(verified).settlement.atomic,3606);
  assert.equal(verified.result.scope,'Only the NCC advisory was inspected.');
});
test('adapter matches the independently captured genuine unpaid gateway contract for all three mainnet tokens',async()=>{
  const actual=JSON.parse(await readFile(new URL('./fixtures/buy-browser-contract.json',import.meta.url),'utf8'));
  assert.equal(actual.kind,'unpaid-public-contract');
  for(const token of ['USDC','USDT','USAT']) {
    const offer=parseMainnetOffer(actual.catalog,actual.challenge,token);
    assert.equal(offer.atomic,3606);assert.equal(offer.chainId,42220);
    assert.equal(offer.asset,actual.catalog.payment.tokens.find(t=>t.symbol===token).asset.toLowerCase());
  }
});
test('late source completion preserves a receipt already reconciled during recovery',async t=>{
  const {store}=await localStore(t);const row=requested(store);store.claim(row.id,row.fingerprint);store.recordTransaction(row.id,tx);
  const now=Date.now();t.mock.method(Date,'now',()=>now+121_000);
  assert.equal(store.get(row.id).state,'needs-review');
  store.reconcile(row.id,tx,3606);
  const result=store.finish(row.id,{scope:'Source observation completed after receipt review.'});
  assert.equal(result.state,'complete');assert.equal(publicPurchase(result).settlement.atomic,3606);
});
