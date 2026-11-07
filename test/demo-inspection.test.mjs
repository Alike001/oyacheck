import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureFor, scenarioValid, synthesizeObservations } from '../lib/demo-inspection.mjs';
import { demoPrepared, demoReply } from '../lib/demo-conversation.mjs';

const observed=(overrides={})=>({url:'http://127.0.0.1:4391/_demo/page/credential',title:'Training sample',text:'Urgent! Account suspended today. Verify immediately.',headings:['Urgent verification required'],forms:[{method:'post',action:'https://collector.example.invalid/collect',fields:[{name:'nin',type:'text'},{name:'otp',type:'text'},{name:'password',type:'password'}]}],...overrides});
test('controlled scenarios are an explicit allowlist',()=>{
  assert.equal(scenarioValid('credential'),true);assert.equal(scenarioValid('redirect'),true);
  assert.equal(scenarioValid('http://example.com'),false);assert.equal(fixtureFor('https://example.com'),null);
});
test('synthetic form cannot submit credentials',()=>{
  const html=fixtureFor('credential');assert.equal(html.status,200);
  assert.match(html.headers['Content-Security-Policy'],/form-action 'none'/);
  assert.match(html.body,/CONTROLLED TRAINING PAGE/);
  assert.match(html.body,/type="button"/);
});
test('synthetic redirect stays inside local fixtures',()=>{
  const r=fixtureFor('redirect');assert.equal(r.status,302);assert.equal(r.headers.Location,'/_demo/page/credential?from=controlled-redirect');
});
test('observations classify sensitive fields and urgency separately from verdict',()=>{
  const r=synthesizeObservations('credential',observed(),['http://127.0.0.1:4391/_demo/page/credential']);
  assert.equal(r.kind,'controlled-browser-demo');assert.match(r.finding,/warning signs/i);
  assert.ok(r.page.sensitiveFields.includes('otp'));assert.equal(r.page.externalFormAction,true);
  assert.equal(r.network,null);assert.equal(r.payment,null);assert.match(r.scope,/no Celo Buy payment/i);
});
test('ordinary page shows no configured warnings, not a safety certification',()=>{
  const r=synthesizeObservations('ordinary',observed({url:'http://127.0.0.1:4391/_demo/page/ordinary',forms:[],text:'Welcome to community events.'}),[]);
  assert.match(r.observations.join(' '),/not a safety certificate/i);
  assert.doesNotMatch(r.finding,/safe/i);
});
test('login form alone does not prove phishing',()=>{
  const r=synthesizeObservations('login',observed({url:'http://127.0.0.1:4391/_demo/page/login',forms:[{method:'post',action:'http://127.0.0.1:4391/_demo/nowhere',fields:[{name:'password',type:'password'}]}],text:'Member login.'}),[]);
  assert.equal(r.page.urgency,false);assert.match(r.finding,/context needed/i);
});
test('redirect count is reported without creating a fraudulent verdict',()=>{
  const r=synthesizeObservations('redirect',observed(),['http://127.0.0.1:4391/_demo/page/redirect','http://127.0.0.1:4391/_demo/page/credential']);
  assert.equal(r.page.redirectCount,1);assert.match(r.observations.join(' '),/1 internal browser redirect/);
});
test('unexpected browser destination is rejected',()=>{
  assert.throws(()=>synthesizeObservations('credential',observed({url:'https://example.com/steal'})),/outside the permitted/);
  assert.throws(()=>synthesizeObservations('credential',observed({url:'http://127.0.0.1:4391/_demo/page/unknown'})),/outside the permitted/);
});
test('no narrative evidence from malformed browser output',()=>{
  assert.throws(()=>synthesizeObservations('credential',{url:'x',title:'x',forms:[],text:'x'}),/usable page observations/);
});
test('prepared conversation does not claim real scam findings or payment',()=>{
  const r=synthesizeObservations('credential',observed());
  assert.match(demoPrepared(r,'What did you find?'),/training page/i);
  assert.match(demoPrepared(r,'What next?', 'pcm'),/no Celo money/i);
});
test('private values in questions are rejected before AI',async()=>{
  const r=synthesizeObservations('credential',observed());
  const x=await demoReply(r,'myotp@example.com is my email');assert.equal(x.method,'local-guard');
});
