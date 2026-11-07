import http from 'node:http';
import { mainnetHTTP, mainnetPreparationEnabled } from './lib/mainnet-http.mjs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { analyze } from './lib/analyze.mjs';
import { groqExplanation, fallbackExplanation } from './lib/explain.mjs';
import { chatReply } from './lib/chat.mjs';
import { generalReply } from './lib/general.mjs';
import { sandboxEnabled, isLocalRequest, obtainQuote, inspectPaidSource, getScreenshot, budgetStatus } from './lib/buy-browser.mjs';
import {audioExtension, keyIsConfigured, readAudio, transcribeAudio, MAX_AUDIO_BYTES} from './lib/voice.mjs';
import { DEMO_SCENARIOS, fixtureFor, scenarioValid } from './lib/demo-inspection.mjs';
import { inspectSyntheticPage, chromiumBinary } from './lib/demo-browser.mjs';
import { demoReply } from './lib/demo-conversation.mjs';
import { randomBytes } from 'node:crypto';

const ROOT = fileURLToPath(new URL('./public/', import.meta.url));
const PUBLIC_FILES = new Map([
  ['/', ['index.html','text/html; charset=utf-8']],
  ['/index.html', ['index.html','text/html; charset=utf-8']],
  ['/app', ['index.html','text/html; charset=utf-8']],
  ['/product.css', ['product.css','text/css; charset=utf-8']],
  ['/fonts/lato-regular.ttf', ['fonts/lato-regular.ttf','font/ttf']],
  ['/fonts/lato-bold.ttf', ['fonts/lato-bold.ttf','font/ttf']],
  ['/fonts/OFL-Lato.txt', ['fonts/OFL-Lato.txt','text/plain; charset=utf-8']],
  ['/app.js', ['app.js','text/javascript; charset=utf-8']],
  ['/voice-session.js', ['voice-session.js','text/javascript; charset=utf-8']],
  ['/voice-policy.js', ['voice-policy.js','text/javascript; charset=utf-8']],
  ['/voice-activity.js', ['voice-activity.js','text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css','text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg','image/svg+xml']],
  ['/agent-registration.json', ['agent-registration.json','application/json; charset=utf-8']],
]);
const PORT = Number(process.env.PORT || 4173);
const RATE = new Map();
const DEMO_RESULTS = new Map();
const DEMO_SCREENSHOTS = new Map();
let demoBusy = false;
function demoAllowed(ip) { return process.env.OYACHECK_DEMO_BROWSER === '1' && isLocalRequest(ip); }
function removeExpiredDemoEntries(){
  const now=Date.now();
  for (const [k,v] of DEMO_SCREENSHOTS) if(v.expires<now) DEMO_SCREENSHOTS.delete(k);
  for (const [k,v] of DEMO_RESULTS) if(v.expires<now) DEMO_RESULTS.delete(k);
}

function securityHeaders() {
  return {
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Referrer-Policy':'no-referrer',
    'Cache-Control':'no-store',
    'Cross-Origin-Resource-Policy':'same-origin',
    'Permissions-Policy':'camera=(), microphone=(self), geolocation=()',
    'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  };
}
function respond(res, status, obj) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8', ...securityHeaders()});
  res.end(JSON.stringify(obj));
}
function rateAllowed(ip, group) {
  const now = Date.now();
  const key = `${ip}:${group}`;
  const cap = group === 'voice' ? 4 : group === 'ai-chat' || group === 'general-chat' ? 12 : group === 'ai' ? 10 : group === 'demo' ? 4 : 45;
  let bucket = RATE.get(key);
  if (!bucket || now-bucket.start > 60_000) bucket = {start:now,count:0};
  bucket.count++;
  RATE.set(key,bucket);
  if (RATE.size > 2000) for (const [k,v] of RATE) if(now-v.start>120_000) RATE.delete(k);
  return bucket.count <= cap;
}
async function readJSON(req) {
  return await new Promise((resolve,reject)=>{
    const pieces=[]; let size=0; let over=false;
    req.on('data',chunk=>{
      size+=chunk.length;
      if(size>8*1024) {over=true;req.destroy();reject(new Error('Input too long'));return;}
      pieces.push(chunk);
    });
    req.on('end',()=>{
      if(over)return;
      try{resolve(JSON.parse(Buffer.concat(pieces).toString('utf8')));}catch{reject(new Error('Invalid JSON'));}
    });
    req.on('error',reject);
  });
}
const server = http.createServer(async (req,res)=>{
  const u = new URL(req.url,'http://localhost');
  const ip=req.socket.remoteAddress || 'local';
  const origin=req.headers.origin;
  const expected=`${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
  if(origin && origin !== expected && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) {
    respond(res,403,{error:'Cross-origin request blocked'});return;
  }
  const diagnosticsFiles=new Map([['/voice-diagnostics',['voice-diagnostics.html','text/html']],['/voice-diagnostics.js',['voice-diagnostics.js','text/javascript']],['/voice-diagnostics.css',['voice-diagnostics.css','text/css']]]);
  if(diagnosticsFiles.has(u.pathname)||u.pathname==='/api/voice/diagnostics'){
    let localHost=false;try{localHost=['127.0.0.1','localhost','[::1]'].includes(new URL(`http://${req.headers.host}`).hostname);}catch{}
    if(process.env.OYACHECK_VOICE_DIAGNOSTICS!=='1'||process.env.RENDER==='true'||!isLocalRequest(ip)||!localHost){respond(res,403,{error:'Local voice diagnostics disabled'});return;}
    if(req.method!=='GET'){respond(res,405,{error:'Read-only diagnostics'});return;}
    if(u.pathname==='/api/voice/diagnostics'){respond(res,200,{credentialsConfigured:keyIsConfigured(),configurationOnly:true,serverTranscriptionTest:'blocked: no provider call authorized',recordingsStored:false});return;}
    const [name,type]=diagnosticsFiles.get(u.pathname);
    try{const bytes=await readFile(new URL(`./local/${name}`,import.meta.url));res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,...securityHeaders()});res.end(bytes);}catch{respond(res,500,{error:'Diagnostics file unavailable'});}return;
  }
  if (u.pathname.startsWith('/api/mainnet/')) {
    if(!rateAllowed(ip,'mainnet-prepare')) {respond(res,429,{error:'Preparation rate limited'});return;}
    await mainnetHTTP(req,res,u,{readJSON,respond});return;
  }
  if(req.method==='GET' && u.pathname==='/api/health') {respond(res,200,{ok:true,mainnetPreparation:mainnetPreparationEnabled()&&isLocalRequest(ip),version:'0.10.0',voiceTranscription:keyIsConfigured(),browserSpeechPlayback:'client',browserInspection:false,sourceInspectionSandboxEnabled:sandboxEnabled()&&isLocalRequest(ip),sandboxBudget:budgetStatus(),localBrowserDemo:demoAllowed(ip),localBrowserAvailable:Boolean(chromiumBinary()),aiConfigured: /^gsk_[A-Za-z0-9_-]+$/.test(process.env.GROQ_API_KEY?.trim() || '')});return;}
  // Local lab: ONLY fixed synthetic pages served by this app. No paid calls,
  // no external URL input, no real form submission and no remote exposure.
  if(u.pathname.startsWith('/_demo/') || u.pathname.startsWith('/api/demo/')) {
    if(!demoAllowed(ip)){respond(res,403,{error:'Local demonstration is disabled'});return;}
    if(req.method==='GET' && /^\/_demo\/page\/[a-z]+$/.test(u.pathname)) {
      const scenario=u.pathname.split('/').at(-1);const sample=fixtureFor(scenario);
      if(!sample){respond(res,404,{error:'Unknown controlled sample'});return;}
      res.writeHead(sample.status,sample.headers);res.end(sample.body);return;
    }
    if(req.method==='POST' && u.pathname==='/api/demo/inspect') {
      if(!rateAllowed(ip,'demo')){respond(res,429,{error:'Demonstration rate limited'});return;}
      if(req.headers['content-type']?.split(';')[0]!=='application/json'){respond(res,415,{error:'Send JSON'});return;}
      try {
        const body=await readJSON(req);
        if(typeof body.scenario!=='string'||!scenarioValid(body.scenario)){respond(res,400,{error:'Choose a supported controlled sample'});return;}
        if(demoBusy){respond(res,409,{error:'One browser demonstration is already running'});return;}
        demoBusy=true;
        try {
          const {report,screenshot}=await inspectSyntheticPage({scenario:body.scenario,port:server.address().port});
          removeExpiredDemoEntries();
          DEMO_RESULTS.set(ip,{report,expires:Date.now()+600000});
          let screenshotId=null;
          if(screenshot?.length && screenshot.length<=2*1024*1024){
            screenshotId=randomBytes(20).toString('hex');
            DEMO_SCREENSHOTS.set(screenshotId,{buf:screenshot,ip,expires:Date.now()+120000});
          }
          respond(res,200,{...report,screenshotId});
        } finally {demoBusy=false;}
      } catch(e) {if(!res.headersSent&&!res.destroyed)respond(res,503,{error:'Local browser demonstration unavailable: '+e.message});}
      return;
    }
    if(req.method==='GET' && /^\/api\/demo\/screenshot\/[a-f0-9]{40}$/.test(u.pathname)) {
      removeExpiredDemoEntries();const entry=DEMO_SCREENSHOTS.get(u.pathname.split('/').at(-1));
      if(!entry||entry.ip!==ip){respond(res,404,{error:'Screenshot expired'});return;}
      res.writeHead(200,{'Content-Type':'image/png',...securityHeaders()});res.end(entry.buf);return;
    }
    if(req.method==='POST' && u.pathname==='/api/demo/ask') {
      if(!rateAllowed(ip,'ai-chat')){respond(res,429,{error:'Chat limit reached'});return;}
      if(req.headers['content-type']?.split(';')[0]!=='application/json'){respond(res,415,{error:'Send JSON'});return;}
      try{
        removeExpiredDemoEntries();const latest=DEMO_RESULTS.get(ip);
        if(!latest){respond(res,404,{error:'Run a controlled browser demonstration first'});return;}
        const body=await readJSON(req);
        if(typeof body.question!=='string'||body.question.length>450){respond(res,400,{error:'Invalid question'});return;}
        const answer=await demoReply(latest.report,body.question,body.language,body.history);
        respond(res,200,{answer,scope:latest.report.scope});
      } catch {if(!res.headersSent&&!res.destroyed)respond(res,400,{error:'Invalid demonstration question'});}
      return;
    }
    respond(res,404,{error:'Unknown demonstration route'});return;
  }
  // User-initiated short audio. Raw audio is proxied to Groq Whisper only when
  // configured. Nothing is stored; never log bodies or provider credentials.
  if(req.method==='POST' && u.pathname==='/api/voice/transcribe') {
    if(!rateAllowed(ip,'voice')) {respond(res,429,{error:'Voice limit reached; please type instead.'});return;}
    const contentType = req.headers['content-type'] || '';
    if(!audioExtension(contentType)) {respond(res,415,{error:'Unsupported recording format.'});return;}
    if(!keyIsConfigured()) {respond(res,503,{error:'Voice transcription is not configured; type your question instead.'});return;}
    if(Number(req.headers['content-length'] || 0)>MAX_AUDIO_BYTES) {respond(res,413,{error:'Recording is too large (2 MB max).'});return;}
    try {
      const bytes=await readAudio(req);
      const result=await transcribeAudio(bytes,contentType,u.searchParams.get('lang'));
      respond(res,200,result);
    }catch(e){if(!res.headersSent && !res.destroyed)respond(res,e.status||503,{error:e.message||'Transcription failed.'});}
    return;
  }
  // This local-only sandbox gate cannot be used to spend mainnet assets.
  if (u.pathname.startsWith('/api/buy/') && (!sandboxEnabled() || !isLocalRequest(ip))) {
    respond(res,403,{error:'Sandbox source inspection disabled or not a local connection'});return;
  }
  if(req.method==='POST' && u.pathname==='/api/buy/quote') {
    if(!rateAllowed(ip,'buy-quote')) {respond(res,429,{error:'Quote rate limited'});return;}
    try{const data=await obtainQuote(ip);respond(res,200,data);}
    catch(e){respond(res,503,{error:e.message});}
    return;
  }
  if(req.method==='POST' && u.pathname==='/api/buy/inspect') {
    if(!rateAllowed(ip,'buy-inspect')) {respond(res,429,{error:'Investigation rate limited'});return;}
    if(req.headers['content-type']?.split(';')[0]!== 'application/json'){respond(res,415,{error:'Send JSON'});return;}
    try{
      const body=await readJSON(req);
      if(body.confirmation!=='approve-sandbox-test-usdc'||typeof body.input!=='string'||body.input.length>2000||typeof body.quoteToken!=='string') {
        respond(res,400,{error:'Explicit sandbox consent and valid quote required'});return;
      }
      const result=await inspectPaidSource({clientId:ip,input:body.input,quoteToken:body.quoteToken});
      respond(res,200,result);
    }catch(e){if(!res.headersSent&&!res.destroyed)respond(res,e.status||400,{error:e.message,transaction:e.transaction||null});}
    return;
  }
  if(req.method==='GET' && /^\/api\/buy\/screenshot\/[a-f0-9]{40}$/.test(u.pathname)) {
    if(!sandboxEnabled()||!isLocalRequest(ip)){respond(res,403,{error:'Not allowed'});return;}
    const buf=getScreenshot(u.pathname.split('/').at(-1),ip);
    if(!buf){respond(res,404,{error:'Screenshot expired'});return;}
    res.writeHead(200,{'Content-Type':'image/png',...securityHeaders()});res.end(buf);return;
  }
  if(req.method==='POST' && u.pathname==='/api/analyze') {
    if(!rateAllowed(ip,'scan')){respond(res,429,{error:'Too many requests. Try again shortly.'});return;}
    if(req.headers['content-type']?.split(';')[0] !== 'application/json') {respond(res,415,{error:'Send JSON'});return;}
    try{
      const body=await readJSON(req);
      if(body.mode!==undefined&&!['url','message','auto'].includes(body.mode))throw new Error('Unsupported analysis mode');
      const result=analyze(body.input,body.language,body.mode);
      const explanation = body.explain!==false && rateAllowed(ip,'ai') ? await groqExplanation(result) : { text:fallbackExplanation(result), method:'prepared-text' };
      respond(res,200,{...result,checkedAt:new Date().toISOString(),explanation});
    }catch(e){if(!res.headersSent && !res.destroyed)respond(res,400,{error:'Invalid or oversized request'});}
    return;
  }
  if(req.method==='POST' && u.pathname==='/api/chat') {
    if(!rateAllowed(ip,'ai-chat')){respond(res,429,{error:'Too many messages. Please try again shortly.'});return;}
    if(req.headers['content-type']?.split(';')[0] !== 'application/json') {respond(res,415,{error:'Send JSON'});return;}
    try {
      const body=await readJSON(req);
      if(typeof body.question !== 'string' || body.question.length>450 || !Array.isArray(body.history) && body.history!==undefined) {
        respond(res,400,{error:'Invalid question or history'});return;
      }
      const report=analyze(body.input,body.language,body.mode);
      const answer=await chatReply(report,body.question,body.history);
      respond(res,200,{answer,status:report.status,host:report.host,language:report.language});
    }catch{if(!res.headersSent && !res.destroyed)respond(res,400,{error:'Invalid or oversized request'});}
    return;
  }
  if(req.method==='POST' && u.pathname==='/api/ask') {
    if(!rateAllowed(ip,'general-chat')) {respond(res,429,{error:'Too many messages. Please try again shortly.'});return;}
    if(req.headers['content-type']?.split(';')[0] !== 'application/json') {respond(res,415,{error:'Send JSON'});return;}
    try {
      const body = await readJSON(req);
      if(typeof body.question !== 'string' || body.question.length>450 || (!Array.isArray(body.history) && body.history!==undefined)) {
        respond(res,400,{error:'Invalid question or history'});return;
      }
      const answer = await generalReply(body.question,body.language,body.history);
      respond(res,200,{answer,language:body.language==='pcm'?'pcm':'en',report:null});
    }catch {if(!res.headersSent && !res.destroyed) respond(res,400,{error:'Invalid or oversized request'});}
    return;
  }
  if(req.method==='POST' && u.pathname==='/api/ai') {
    // Disabled: all model use must happen only through evidence-first analyze.
    respond(res,404,{error:'Not found'});return;
  }
  const file=PUBLIC_FILES.get(u.pathname);
  if(req.method==='GET' && file){
    try{
      const data=await readFile(new URL(`./public/${file[0]}`,import.meta.url));
      res.writeHead(200,{'Content-Type':file[1],...securityHeaders()});res.end(data);
    }catch{respond(res,500,{error:'File unavailable'});}
    return;
  }
  respond(res,404,{error:'Not found'});
});
const calledDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (calledDirectly) server.listen(PORT, '0.0.0.0',()=>console.log(`OyaCheck running at http://localhost:${PORT}`));
export { server };
