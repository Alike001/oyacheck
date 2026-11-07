import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../server.mjs';
import { once } from 'node:events';

// Tests run without Groq credentials, external requests, payment or blockchain.
process.env.GROQ_API_KEY='';
let origin;
test.before(async()=>{server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`;});
test.after(async()=>{await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));});
test('health distinguishes link inspection from optional source inspection',async()=>{
  const r=await fetch(origin+'/api/health');assert.equal(r.status,200);assert.equal((await r.json()).browserInspection,false);
});
test('homepage works',async()=>{
  const r=await fetch(origin+'/');assert.equal(r.status,200);const html=await r.text();assert.match(html,/Before you click/);assert.match(html,/Pidgin/);
});
test('javascript and CSS accessible with CSP',async()=>{
  const r=await fetch(origin+'/app.js');assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/script-src 'self'/);
  assert.ok((await r.text()).includes('check-form'));
});
test('source file cannot be leaked through static path',async()=>{
  const r=await fetch(origin+'/lib/analyze.mjs');assert.equal(r.status,404);
});
test('API returns verified evidence and fallback explanation without key',async()=>{
  const r=await fetch(origin+'/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:'Your device will be blocked today: secure-verifymydevice.ng',language:'pcm'})});
  const d=await r.json();assert.equal(r.status,200);assert.equal(d.status,'known-phishing');assert.equal(d.language,'pcm');assert.equal(d.explanation.method,'prepared-text');assert.equal(d.inspected.livePage,false);
});
test('no invented live browsing',async()=>{
  const r=await fetch(origin+'/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:'https://example.com',language:'en'})});
  assert.equal((await r.json()).inspected.redirects,false);
});
test('rejects content type other than JSON',async()=>{
  const r=await fetch(origin+'/api/analyze',{method:'POST',headers:{'content-type':'text/plain'},body:'hello'});
  assert.equal(r.status,415);
});
test('rejects invalid JSON',async()=>{
  const r=await fetch(origin+'/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:'{not json'});
  assert.equal(r.status,400);
});
test('blocks unknown routes',async()=>{
  const r=await fetch(origin+'/api/wallet-key');assert.equal(r.status,404);
});
test('blocks unrelated request origin',async()=>{
  const r=await fetch(origin+'/api/analyze',{method:'POST',headers:{'content-type':'application/json',origin:'https://attacker.example'},body:'{}'});
  assert.equal(r.status,403);
});

test('default server cannot sell a browser session',async()=>{
  const r=await fetch(origin+'/api/buy/quote',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(r.status,403);
});
test('default server cannot start paid inspection',async()=>{
  const r=await fetch(origin+'/api/buy/inspect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:'secure-verifymydevice.ng',confirmation:'approve-sandbox-test-usdc',quoteToken:'x'})});
  assert.equal(r.status,403);
});
test('screenshot access blocked with payments off',async()=>{
  const r=await fetch(origin+'/api/buy/screenshot/'+'a'.repeat(40));
  assert.equal(r.status,403);
});

test('health advertises voice configuration truthfully',async()=>{
  const r=await fetch(origin+'/api/health');const d=await r.json();
  assert.equal(d.voiceTranscription,false);assert.equal(d.browserSpeechPlayback,'client');
});
test('microphone is permitted only for same-origin',async()=>{
  const r=await fetch(origin+'/');
  assert.match(r.headers.get('permissions-policy'),/microphone=\(self\)/);
  assert.match(r.headers.get('content-security-policy'),/connect-src 'self'/);
});
test('voice endpoint rejects invalid content type',async()=>{
  const r=await fetch(origin+'/api/voice/transcribe',{method:'POST',headers:{'content-type':'text/plain'},body:'not audio'});
  assert.equal(r.status,415);
});
test('voice endpoint refuses use without a configured API key',async()=>{
  const r=await fetch(origin+'/api/voice/transcribe',{method:'POST',headers:{'content-type':'audio/wav'},body:Buffer.alloc(200)});
  assert.equal(r.status,503);
  assert.match((await r.json()).error,/not configured/);
});
test('voice route rejects cross-origin upload',async()=>{
  const r=await fetch(origin+'/api/voice/transcribe',{method:'POST',headers:{'content-type':'audio/wav','origin':'https://untrusted.test'},body:Buffer.alloc(200)});
  assert.equal(r.status,403);
});
test('voice policy module is served with security headers and no secrets',async()=>{
  const r=await fetch(origin+'/voice-policy.js');
  assert.equal(r.status,200);
  assert.match(r.headers.get('content-type'),/javascript/);
  assert.match(await r.text(),/voiceDecision/);
});
test('voice-first toggles are enabled by default',async()=>{
  const r=await fetch(origin+'/');
  const html=await r.text();
  assert.match(html,/id="auto-voice" type="checkbox" checked/);
  assert.match(html,/id="read-aloud" type="checkbox" checked/);
});

test('explicit message analysis supports harmless no-link text and timestamps without AI',async()=>{
  const r=await fetch(origin+'/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({input:'See you at lunch tomorrow.',mode:'message',explain:false})});
  const d=await r.json();assert.equal(r.status,200);assert.equal(d.analysisKind,'message');assert.equal(d.status,'unverified');assert.equal(d.host,null);assert.equal(d.explanation.method,'prepared-text');assert.ok(Number.isFinite(Date.parse(d.checkedAt)));
});
test('explicit URL analysis rejects message text and unsupported modes',async()=>{
  const post=body=>fetch(origin+'/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await(await post({input:'Read https://example.org please',mode:'url',explain:false})).json()).status,'invalid');
  assert.equal((await post({input:'https://example.org',mode:'browser'})).status,400);
});
