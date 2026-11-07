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
  const r=await fetch(origin+'/');assert.equal(r.status,200);const html=await r.text();assert.match(html,/Check a link/);assert.match(html,/Pidgin/);
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
test('voice automation remains optional and off by default',async()=>{
  const r=await fetch(origin+'/');
  const html=await r.text();
  assert.match(html,/id="auto-voice" type="checkbox"/);
  assert.doesNotMatch(html,/id="auto-voice" type="checkbox" checked/);
  assert.match(html,/id="read-aloud" type="checkbox"/);
  assert.doesNotMatch(html,/id="read-aloud" type="checkbox" checked/);
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

test('direct app route and product styles retain security headers',async()=>{
  const r=await fetch(origin+'/app');assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy'),/connect-src 'self'/);const html=await r.text();assert.match(html,/id="app-view"/);assert.match(html,/id="landing-form" action="\/app" method="post"/);assert.doesNotMatch(html,/id="landing-input" name=/);
  const css=await fetch(origin+'/product.css');assert.equal(css.status,200);assert.match(css.headers.get('content-type'),/text\/css/);
});

test('checker puts two input modes first and discloses supporting tools',async()=>{
  const html=await(await fetch(origin+'/app')).text();
  assert.equal([...html.matchAll(/data-check-mode=/g)].length,2);
  for(const id of ['voice-options','technical-details','question-panel']){
    assert.match(html,new RegExp('<details id="'+id+'"'));
    assert.doesNotMatch(html,new RegExp('<details id="'+id+'"[^>]*\\sopen(?:\\s|>)'));
  }
  assert.match(html,/id="landing-input"[^>]+placeholder="Paste a website address here/);
  assert.doesNotMatch(html,/id="landing-input"[^>]+placeholder="https?:/);
});
test('licensed self-hosted fonts are explicitly served with the existing CSP',async()=>{
  for(const path of ['/fonts/lato-regular.ttf','/fonts/lato-bold.ttf']){
    const r=await fetch(origin+path);assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'font/ttf');assert.match(r.headers.get('content-security-policy'),/font-src 'self'/);
    const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.readUInt32BE(0),0x00010000);
  }
  assert.equal((await fetch(origin+'/fonts/../server.mjs')).status,404);
});

test('visible voice docks and controller retain opt-in review and security headers',async()=>{
  const html=await(await fetch(origin+'/')).text();
  for(const prefix of ['landing','app'])assert.match(html,new RegExp('data-voice-dock="'+prefix+'"'));
  assert.match(html,/<details id="plain-language"[^>]* open/);
  assert.match(html,/id="stop-result-audio" hidden/);
  const r=await fetch(origin+'/voice-session.js');assert.equal(r.status,200);
  assert.match(r.headers.get('content-security-policy'),/connect-src 'self'/);
  assert.match(await r.text(),/createVoiceSession/);
});
