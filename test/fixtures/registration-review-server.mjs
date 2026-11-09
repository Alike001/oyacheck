// TEST ONLY: stale saved preview, fresh mocked checks and no real wallet/RPC.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createReviewServer } from '../../scripts/registration-review.mjs';
export async function registrationUIFixture(){
  const saved=JSON.parse(await readFile(new URL('../../docs/registration/unsigned-preview.json',import.meta.url),'utf8'));
  const fresh=async()=>({...structuredClone(saved),generatedAt:new Date().toISOString()});
  const review=createReviewServer({load:async()=>({...await fresh(),generatedAt:new Date(Date.now()-11*60000).toISOString()}),refresh:fresh,
    attempts:{status:()=>({reserved:false}),claim:()=>{throw new Error('Fixture cannot claim');}}});
  const server=http.createServer((req,res)=>{
    if(req.url==='/__mock/status'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({mock:true,kind:'registration-ui',realWallet:false,realRPC:false}));return;}
    review.emit('request',req,res);
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  return {server,origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const fixture=await registrationUIFixture();console.log(`MOCK registration UI: ${fixture.origin} PID ${process.pid}`);
  process.on('SIGINT',async()=>{await fixture.close();process.exit(0);});
}
