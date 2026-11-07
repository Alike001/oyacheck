// Dedicated loopback review server; never exposes a signer or financial route.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readOnlyRPC, registrationPreview } from '../lib/agent-registration.mjs';
const readJSON = async path => JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const assets = new Map([['/',['registration-review.html','text/html']],['/review.js',['registration-review.js','text/javascript']],['/review.css',['registration-review.css','text/css']]]);
export function createReviewServer({load=()=>readJSON('../docs/registration/unsigned-preview.json'),
  refresh=async()=>registrationPreview(readOnlyRPC(),await readJSON('../public/agent-registration.json'))}={}) {
  let cached,refreshing=false,lastRefresh=0;
  return http.createServer(async(req,res)=>{
    const host=req.headers.host,expected=`127.0.0.1:${req.socket.localPort}`;
    const headers={'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",'referrer-policy':'no-referrer'};
    const reply=(status,data,type='application/json')=>{res.writeHead(status,{'content-type':type,...headers});res.end(type==='application/json'?JSON.stringify(data):data);};
    if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||host!==expected||
      (req.headers.origin&&req.headers.origin!==`http://${expected}`)||req.headers['sec-fetch-site']==='cross-site')return reply(403,{error:'Direct loopback origin required'});
    if(req.method!=='GET')return reply(405,{error:'Read-only review server'});
    const path=new URL(req.url,`http://${expected}`).pathname;
    try {
      if(assets.has(path)){const [file,type]=assets.get(path);return reply(200,await readFile(new URL(`../local/${file}`,import.meta.url)),type);}
      if(path==='/preview'){cached??=await load();return reply(200,cached);}
      if(path==='/refresh'){
        if(refreshing||Date.now()-lastRefresh<30_000)return reply(429,{error:'Wait before refreshing again'});
        refreshing=true;lastRefresh=Date.now();
        try{cached=await refresh();return reply(200,cached);}finally{refreshing=false;}
      }
      reply(404,{error:'No signing, execution or other operation exists'});
    }catch{cached=null;reply(503,{error:'Read-only check unavailable; no authorization was requested'});}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=createReviewServer();server.listen(4188,'127.0.0.1',()=>console.log('OyaCheck registration review: http://127.0.0.1:4188 · no signing or broadcasting'));
}
