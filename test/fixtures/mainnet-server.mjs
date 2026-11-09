// TEST ONLY: actual UI/HTTP/store with an injected financial fake. This module
// NEVER imports or constructs the real financial transport.
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { server as application } from '../../server.mjs';
import { MainnetStore, fail } from '../../lib/mainnet-store.mjs';
import { MainnetPilot, TOKENS, RECIPIENT, ENDPOINT, BODY } from '../../lib/mainnet-buy.mjs';
import { mainnetHTTP } from '../../lib/mainnet-http.mjs';
import { ADVISORY } from '../../lib/analyze.mjs';

export const config={account:'mock-payer',payer:'0x'+'1'.repeat(40),token:'USDC',execute:true};
export const plan=host=>({atomic:3606,token:'USDC',asset:TOKENS.USDC,payTo:RECIPIENT,chainId:42220,network:'Celo mainnet',
  endpoint:ENDPOINT,method:'POST',body:BODY,durationMinutes:1,capability:'browser.sessions.create',source:ADVISORY.url,
  account:config.account,payer:config.payer,host});
export const tx='0x'+'b'.repeat(64); // Explicit financial mock, never submission evidence.
export async function fixture() {
  const directory=await mkdtemp(join(tmpdir(),'oya-mainnet-test-'));
  const store=new MainnetStore(join(directory,'pilot.sqlite'));
  let mode='success', calls=0, quotes=0;
  const transport={
    async quote(host) {
      quotes++;
      if(mode==='unavailable')throw fail('provider-unavailable','Browser provider is unavailable; nothing was paid',503);
      if(mode==='funds')throw fail('insufficient-funds','Insufficient token funds; nothing was paid');
      return plan(host);
    },
    async buy() { calls++; if(mode==='partial')throw Object.assign(new Error('MOCK SECRET MUST NOT LEAK'),{transaction:tx}); return {transaction:tx}; },
    async observe() { return {finalSourceUrl:ADVISORY.url,sourceTitle:'MOCK NCC advisory',foundInLivePage:'yes',knownHost:'secure-verifymydevice.ng',
      sourceTextSha256:'a'.repeat(64),excerpt:'MOCK observed mention: secure-verifymydevice.ng',checkedAt:new Date().toISOString(),
      scope:'MOCK: fixed NCC advisory only. Submitted website not opened. This does not prove it safe.'}; },
  };
  const pilot=new MainnetPilot(store,transport,config);
  const respond=(res,status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
  const readJSON=async req=>{let text='';for await(const b of req){text+=b;if(text.length>8192)throw fail('too-large','Request too large',400);}return JSON.parse(text);};
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/__mock/mode'&&req.method==='POST') {mode=(await readJSON(req)).mode;respond(res,200,{mock:true});return;}
    if(url.pathname==='/__mock/execute'&&req.method==='POST') {
      const body=await readJSON(req);
      try{const result=await pilot.execute(body.id,body.fingerprint);respond(res,200,{state:result.state,mock:true});}
      catch(error){respond(res,error.status||500,{error:error.message});}return;
    }
    if(url.pathname==='/__mock/expire'&&req.method==='POST'){const body=await readJSON(req);store.db.prepare('UPDATE purchases SET expires=? WHERE id=?').run(Date.now()-1,body.id);respond(res,200,{mock:true});return;}
    if(url.pathname==='/__mock/stats'){respond(res,200,{calls,quotes,mock:true});return;}
    if(url.pathname==='/api/health'){respond(res,200,{ok:true,version:'0.10.0',mainnetPreparation:true,aiConfigured:false,sourceInspectionSandboxEnabled:false});return;}
    if(await mainnetHTTP(req,res,url,{readJSON,respond,runtime:()=>({store,pilot}),enabled:true}))return;
    application.emit('request',req,res);
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  return {server,store,pilot,transport,config,origin:`http://127.0.0.1:${server.address().port}`,
    setMode:value=>{mode=value;},stats:()=>({calls,quotes}),close:async()=>{await new Promise(resolve=>server.close(resolve));store.close();await rm(directory,{recursive:true,force:true});}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  process.env.GROQ_API_KEY='';
  const mock=await fixture();const second=process.argv.includes('--pair')?await fixture():null;console.log(`MOCK mainnet browser fixtures: ${mock.origin} ${second?.origin||''}`);
  process.on('SIGINT',async()=>{await mock.close();await second?.close();process.exit(0);});
}
