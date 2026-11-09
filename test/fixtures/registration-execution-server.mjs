// TEST ONLY: isolated fake previews, temporary journals, no live RPC or wallet.
import http from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReviewServer } from '../../scripts/registration-review.mjs';
import { RegistrationAttempt } from '../../lib/registration-attempt.mjs';
import { APPROVED_REQUEST_FINGERPRINT } from '../../local/registration-flow.js';
export async function executionUIFixture(){
  const directory=await mkdtemp(join(tmpdir(),'oya-execution-mock-'));
  const saved=JSON.parse(await readFile(new URL('../../docs/registration/unsigned-preview.json',import.meta.url),'utf8'));
  const fresh=async()=>({...structuredClone(saved),generatedAt:new Date().toISOString()});
  const attempts=new RegistrationAttempt(join(directory,'attempt.json'));
  const review=createReviewServer({sendingEnabled:true,approvedFingerprint:APPROVED_REQUEST_FINGERPRINT,attempts,load:fresh,refresh:fresh,
    verify:async hash=>({state:'needs-review',hash,instruction:'MOCK receipt unavailable; no genuine registration occurred. Never resubmit.'})});
  const server=http.createServer((req,res)=>{
    if(req.url==='/__mock/status'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({mock:true,kind:'registration-execution',realRPC:false,realWallet:false}));return;}
    review.emit('request',req,res);
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  return {origin:`http://127.0.0.1:${server.address().port}`,close:async()=>{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const fixtures=await Promise.all([executionUIFixture(),executionUIFixture(),executionUIFixture()]);
  console.log(JSON.stringify({mock:true,pid:process.pid,origins:fixtures.map(f=>f.origin)}));
  process.on('SIGINT',async()=>{await Promise.all(fixtures.map(f=>f.close()));process.exit(0);});
}
