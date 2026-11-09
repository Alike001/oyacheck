import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../server.mjs';
import { once } from 'node:events';
let origin;
test.before(async()=>{server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`;});
test.after(async()=>await new Promise(res=>server.close(res)));
test('lab stays completely closed by default',async()=>{
  delete process.env.OYACHECK_DEMO_BROWSER;
  const r=await fetch(origin+'/_demo/page/credential');assert.equal(r.status,403);
  const p=await fetch(origin+'/api/demo/inspect',{method:'POST',headers:{'content-type':'application/json'},body:'{"scenario":"credential"}'});assert.equal(p.status,403);
  const h=await (await fetch(origin+'/api/health')).json();assert.equal(h.localBrowserDemo,false);
});
test('enabled lab serves ONLY synthetic pages and denies arbitrary sites',async()=>{
  process.env.OYACHECK_DEMO_BROWSER='1';
  const page=await fetch(origin+'/_demo/page/credential');assert.equal(page.status,200);assert.match(await page.text(),/TRAINING PAGE/);
  assert.match(page.headers.get('content-security-policy'),/form-action 'none'/);
  const invalid=await fetch(origin+'/_demo/page/unknown');assert.equal(invalid.status,404);
  const url=await fetch(origin+'/_demo/page/https://example.com');assert.equal(url.status,404);
});
test('external origin is forbidden even if local lab is enabled',async()=>{
  process.env.OYACHECK_DEMO_BROWSER='1';
  const r=await fetch(origin+'/api/demo/inspect',{method:'POST',headers:{'content-type':'application/json',origin:'https://evil.test'},body:'{"scenario":"credential"}'});assert.equal(r.status,403);
});
test('no purchase path can be activated by running demo',async()=>{
  process.env.OYACHECK_DEMO_BROWSER='1';
  const r=await fetch(origin+'/api/demo/inspect',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({scenario:'https://evil.test',url:'https://evil.test'})});
  assert.equal(r.status,400);
  const receipt=await fetch(origin+'/api/buy/quote',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(receipt.status,403);
});
test('screenshot and follow-ups require a successful controlled inspection',async()=>{
  process.env.OYACHECK_DEMO_BROWSER='1';
  const img=await fetch(origin+'/api/demo/screenshot/'+ 'a'.repeat(40));assert.equal(img.status,404);
  const chat=await fetch(origin+'/api/demo/ask',{method:'POST',headers:{'content-type':'application/json'},body:'{"question":"What did you observe?"}'});assert.equal(chat.status,404);
});
