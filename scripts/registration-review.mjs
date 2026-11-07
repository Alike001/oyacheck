// Dedicated loopback review server. Backend never signs. The only authorized
// browser request requires two reviews, a matching fingerprint and durable claim.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readOnlyRPC, registrationPreview, registrationTransaction, registrationReceiptStatus } from '../lib/agent-registration.mjs';
import { randomBytes, randomUUID } from 'node:crypto';
import { RegistrationAttempt } from '../lib/registration-attempt.mjs';
import { fingerprint, validateFinal, APPROVED_MAX_TOTAL_GAS_WEI, APPROVED_REQUEST_FINGERPRINT } from '../local/registration-flow.js';
import { financialActionsBlocked } from '../lib/release-policy.mjs';
const readJSON = async path => JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const attemptPath=fileURLToPath(new URL('../.oyacheck/registration-attempt.json',import.meta.url));
const assets = new Map([['/',['registration-review.html','text/html']],['/review.js',['registration-review.js','text/javascript']],['/review.css',['registration-review.css','text/css']],['/registration-flow.js',['registration-flow.js','text/javascript']]]);
export function createReviewServer({load=()=>readJSON('../docs/registration/unsigned-preview.json'),
  refresh=async()=>registrationPreview(readOnlyRPC(),await readJSON('../public/agent-registration.json')),
  sendingEnabled=false, approvedFingerprint=null, attempts=new RegistrationAttempt(attemptPath),
  verify=(hash,request)=>registrationReceiptStatus(readOnlyRPC(),hash,request)}={}) {
  let cached,refreshing=false,lastRefresh=0,finalPlan;
  const csrf=randomBytes(32).toString('hex'),enabled=sendingEnabled&&!financialActionsBlocked();
  const expectedTransaction=registrationTransaction();
  return http.createServer(async(req,res)=>{
    const host=req.headers.host,expected=`127.0.0.1:${req.socket.localPort}`;
    const headers={'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",'referrer-policy':'no-referrer'};
    const reply=(status,data,type='application/json')=>{res.writeHead(status,{'content-type':type,...headers});res.end(type==='application/json'?JSON.stringify(data):data);};
    if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||host!==expected||
      (req.headers.origin&&req.headers.origin!==`http://${expected}`)||req.headers['sec-fetch-site']==='cross-site')return reply(403,{error:'Direct loopback origin required'});

    const path=new URL(req.url,`http://${expected}`).pathname;
    try {
      if(req.method==='POST' && ['/final-review','/claim','/attach-hash'].includes(path)){
        if(req.headers.origin!==`http://${expected}`||req.headers['x-oyacheck-review']!==csrf||req.headers['content-type']!=='application/json')return reply(403,{error:'Same-origin review token required'});
        if(path==='/claim'&&!enabled)return reply(403,{error:'Sending locked at this checkpoint'});
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048)return reply(413,{error:'Request too large'});}const body=JSON.parse(raw);
        if(path==='/attach-hash')return reply(200,attempts.attach(body.hash,body.fingerprint));
        if(attempts.status().reserved)return reply(409,{error:'Existing attempt requires recovery; no resubmission'});
        if(refreshing)return reply(409,{error:'Read-only checks in progress'});
        if(path==='/final-review'){
          if(body.reviewed!==true)return reply(403,{error:'First-stage human review required'});
          refreshing=true;
          try{
            finalPlan=null;cached=await refresh();validateFinal(cached,expectedTransaction);
            finalPlan={id:randomUUID(),preview:cached,fingerprint:await fingerprint(cached.preparedRequest),calldataFingerprint:await fingerprint(cached.preparedRequest.data,true)};
            if(approvedFingerprint&&finalPlan.fingerprint!==approvedFingerprint){finalPlan=null;return reply(409,{error:'Request changed. Stop for renewed owner approval.'});}
            return reply(200,finalPlan);
          }finally{refreshing=false;}
        }
        if(body.finalReviewed!==true||!finalPlan||body.id!==finalPlan.id||body.fingerprint!==finalPlan.fingerprint)return reply(409,{error:'Final plan changed or final review absent'});
        validateFinal(finalPlan.preview,expectedTransaction);refreshing=true;
        try{
          const fresh=await refresh();validateFinal(fresh,expectedTransaction);
          if(await fingerprint(fresh.preparedRequest)!==finalPlan.fingerprint){finalPlan=null;return reply(409,{error:'Fees or transaction changed. Stop for renewed owner approval.'});}
          validateFinal(finalPlan.preview,expectedTransaction);
          const claimed=attempts.claim(finalPlan);finalPlan=null;return reply(200,claimed);
        }finally{refreshing=false;}
      }
      if(req.method!=='GET')return reply(405,{error:'No such review operation'});
      if(path==='/policy')return reply(200,{sendingEnabled:enabled&&!attempts.status().reserved,csrf,expected:expectedTransaction,approvedRequestFingerprint:approvedFingerprint,maxTotalGasCostWei:APPROVED_MAX_TOTAL_GAS_WEI.toString()});
      if(path==='/attempt')return reply(200,attempts.status());
      if(path==='/verify'){
        const state=attempts.status();if(!state.hash)return reply(409,{state:'needs-review',error:'Recover the original public hash from MetaMask Activity; never resubmit'});
        return reply(200,await verify(state.hash,state.attempt.transaction));
      }
      if(assets.has(path)){const [file,type]=assets.get(path);return reply(200,await readFile(new URL(`../local/${file}`,import.meta.url)),type);}
      if(path==='/preview'){cached??=await load();return reply(200,cached);}
      if(path==='/refresh'){
        if(refreshing||Date.now()-lastRefresh<30_000)return reply(429,{error:'Wait before refreshing again'});
        refreshing=true;lastRefresh=Date.now();
        try{cached=await refresh();return reply(200,cached);}finally{refreshing=false;}
      }
      reply(404,{error:'No signing, execution or other operation exists'});
    }catch(error){cached=null;finalPlan=null;reply(503,{state:'needs-review',error:error.code==='approval-ceiling'?error.message:'Review or recovery check failed safely; do not resubmit'});}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const attempts=new RegistrationAttempt(attemptPath),reserved=attempts.status().reserved;
    if(financialActionsBlocked())throw new Error('Registration execution is local-only and blocked in this environment');
    let snapshot;
    if(!reserved){
      snapshot=await registrationPreview(readOnlyRPC(),await readJSON('../public/agent-registration.json'));
      validateFinal(snapshot,registrationTransaction());
      if(await fingerprint(snapshot.preparedRequest)!==APPROVED_REQUEST_FINGERPRINT)throw new Error('Request changed. Stop for renewed owner approval.');
    }
    // Owner authorization permits one exact human-clicked confirmation request.
    // A reserved attempt starts recovery-only; no reset or retry is exposed.
    const server=createReviewServer({sendingEnabled:!reserved,approvedFingerprint:APPROVED_REQUEST_FINGERPRINT,attempts,...(snapshot?{load:async()=>snapshot}:{})});
    server.listen(4188,'127.0.0.1',()=>console.log(`OyaCheck registration: http://127.0.0.1:4188 · ${reserved?'recovery only':'one human-triggered request authorized; no automatic signing'}`));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
