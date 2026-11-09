// Explicit, opt-in browser integration acceptance test. Does NOT call Celo Buy.
// It launches local Chromium, opens only OyaCheck-owned synthetic pages,
// and verifies actual CDP DOM evidence and screenshots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../server.mjs';
import { once } from 'node:events';
import { inspectSyntheticPage, chromiumBinary } from '../lib/demo-browser.mjs';

const enabled=process.env.OYACHECK_RUN_LIVE_DEMO==='1';
let port;
test.before(async()=>{
  if(!enabled)return;
  if(!chromiumBinary())throw new Error('Install chromium or set CHROMIUM_PATH to Chrome');
  process.env.OYACHECK_DEMO_BROWSER='1';
  server.listen(0,'127.0.0.1');await once(server,'listening');port=server.address().port;
});
test.after(async()=>{if(server.listening)await new Promise(res=>server.close(res));});
test('live Chromium observes synthetic sensitive fields and screenshot',{skip:!enabled},async()=>{
  const {report,screenshot}=await inspectSyntheticPage({scenario:'credential',port});
  assert.equal(report.kind,'controlled-browser-demo');
  assert.equal(report.page.urgency,true);
  assert.ok(report.page.sensitiveFields.includes('otp'));
  assert.ok(screenshot?.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')));
});
test('live Chromium distinguishes normal login',{skip:!enabled},async()=>{
  const {report}=await inspectSyntheticPage({scenario:'login',port});
  assert.equal(report.page.urgency,false);
  assert.match(report.finding,/context needed/i);
});
test('live Chromium records local redirect',{skip:!enabled},async()=>{
  const {report}=await inspectSyntheticPage({scenario:'redirect',port});
  assert.equal(report.page.redirectCount,1);
});
