import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { analyze } from './lib/analyze.mjs';
import { groqExplanation, fallbackExplanation } from './lib/explain.mjs';
import { chatReply } from './lib/chat.mjs';
import { generalReply } from './lib/general.mjs';
import { sandboxEnabled, isLocalRequest, obtainQuote, inspectPaidSource, getScreenshot, budgetStatus } from './lib/buy-browser.mjs';
import {audioExtension, keyIsConfigured, readAudio, transcribeAudio, MAX_AUDIO_BYTES} from './lib/voice.mjs';

const ROOT = fileURLToPath(new URL('./public/', import.meta.url));
const PUBLIC_FILES = new Map([
  ['/', ['index.html','text/html; charset=utf-8']],
  ['/index.html', ['index.html','text/html; charset=utf-8']],
  ['/app.js', ['app.js','text/javascript; charset=utf-8']],
  ['/voice-policy.js', ['voice-policy.js','text/javascript; charset=utf-8']],
  ['/voice-activity.js', ['voice-activity.js','text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css','text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg','image/svg+xml']],
]);
const PORT = Number(process.env.PORT || 4173);
const RATE = new Map();
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
  const cap = group === 'voice' ? 4 : group === 'ai-chat' || group === 'general-chat' ? 12 : group === 'ai' ? 10 : 45;
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
  if(req.method==='GET' && u.pathname==='/api/health') {respond(res,200,{ok:true,version:'0.9.0',voiceTranscription:keyIsConfigured(),browserSpeechPlayback:'client',browserInspection:false,sourceInspectionSandboxEnabled:sandboxEnabled()&&isLocalRequest(ip),sandboxBudget:budgetStatus(),aiConfigured: /^gsk_[A-Za-z0-9_-]+$/.test(process.env.GROQ_API_KEY?.trim() || '')});return;}
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
      const result=analyze(body.input,body.language);
      const explanation = rateAllowed(ip,'ai') ? await groqExplanation(result) : { text:fallbackExplanation(result), method:'prepared-text' };
      respond(res,200,{...result,explanation});
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
      const report=analyze(body.input,body.language);
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
