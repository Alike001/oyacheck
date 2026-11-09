import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, ADVISORY, KNOWN_BAD } from '../lib/analyze.mjs';
import { fallbackExplanation } from '../lib/explain.mjs';

const cases = [
  ['secure-verifymydevice.ng','known-phishing'],
  ['verifymydevice.com.ng','known-phishing'],
  ['embed-ncc.registrmydevice.ng','known-phishing'],
  ['verifymydevice.ng','known-phishing'],
  ['https://secure-verifymydevice.ng','known-phishing'],
  ['http://verifymydevice.ng','known-phishing'],
  ['verifymydevice.gov.ng','official-host-match'],
  ['www.verifymydevice.gov.ng','official-host-match'],
  ['https://www.ncc.gov.ng/devicechecker','official-host-match'],
  ['https://csirt.ncc.gov.ng/index.php','official-host-match'],
  ['https://www.csirt.ncc.gov.ng/','official-host-match'],
  ['http://verifymydevice.gov.ng','suspicious'],
  ['https://verifymydevice.gov.ng:8443','suspicious'],
  ['https://user:password@verifymydevice.gov.ng','suspicious'],
  ['https://verifymydevice.gov.ng?redirect=https://evil.example','suspicious'],
  ['Send your OTP urgently to verifymydevice.gov.ng','suspicious'],
  ['Your account will be blocked today. Visit https://www.ncc.gov.ng/devicechecker','suspicious'],
  ['https://verifymydevice.gov.ng.evil.example','suspicious'],
  ['https://verifymydevice-gov.ng','suspicious'],
  ['secure-verifymedevice.ng','suspicious'],
  ['secure-verifymydevice.ng.example.com','suspicious'],
  ['https://ncc-alerts.example','suspicious'],
  ['https://bit.ly/a1234','suspicious'],
  ['https://xn--pple-43d.com','suspicious'],
  ['https://example.com','unverified'],
  ['https://www.google.com/search?q=test','unverified'],
  ['http://ordinary-example.com','suspicious'],
  ['https://safe.example/verify?something=else','unverified'],
  ['example.net','unverified'],
  ['localhost','invalid'],
  ['http://127.0.0.1','invalid'],
  ['http://169.254.169.254/latest/meta-data','invalid'],
  ['http://[::1]/','invalid'],
  ['not a URL','invalid'],
  ['javascript:alert(1)','invalid'],
  ['file:///etc/passwd','invalid'],
  ['','invalid'],
  ['https://example.com https://another.example','invalid'],
  ['Your device will be blocked today. Visit secure-verifymydevice.ng','known-phishing'],
  ['Hello, please use https://verifymydevice.gov.ng.','official-host-match'],
  ['https://example.com/login?token=secret-123','unverified'],
  ['http://verifymydevice.gov.ng.evil.example','suspicious'],
];
for (const [input, expected] of cases) {
  test(`${input || '(empty)'} -> ${expected}`,()=>assert.equal(analyze(input).status, expected));
}

test('known phishing evidence links to advisory', () => {
  const got=analyze('verifymydevice.ng');
  assert.equal(got.evidence[0].url,ADVISORY.url);
  assert.equal(got.inspected.livePage,false);
});
test('unknown does not gain an authoritative citation',()=>assert.deepEqual(analyze('example.com').evidence, []));
test('pidgin changes explanation not verdict',()=>{
  const en=analyze('verifymydevice.com.ng','en');
  const pcm=analyze('verifymydevice.com.ng','pcm');
  assert.equal(en.status,pcm.status);
  assert.notEqual(en.reasons[0].text,pcm.reasons[0].text);
});
test('privacy: query path not returned in scan',()=>{
  const r=analyze('https://example.com/a?token=secret-value');
  assert.equal(JSON.stringify(r).includes('secret-value'),false);
});
test('no confidence score is fabricated',()=>assert.equal('confidence' in analyze('example.com'),false));
test('no automatic browser fetch is claimed',()=>assert.equal(analyze('https://example.com').inspected.browserPaid,false));
test('huge input rejected',()=>assert.equal(analyze('x'.repeat(2001)).status,'invalid'));
test('control chars rejected',()=>assert.equal(analyze('https://example.com\x00').status,'invalid'));
test('pidgin fallback exists',()=>assert.ok(fallbackExplanation(analyze('example.com','pcm')).includes('never')));

// Static fixtures only: these addresses are never visited or looked up.
for(const [value,status,indicator] of [
  ['https://www.wikipedia.org/wiki/Internet','unverified',null],
  ['https://sub.example.org/path','unverified',null],
  ['münich.example/path','suspicious','unicode'],
  ['https://paypa1.com/login','suspicious','confusable'],
  ['https://paypal.com.evil.example/login','suspicious','embedded'],
  ['https://paypal.com@unrelated.example/','suspicious','userinfo'],
  ['https://login.secure-verifymydevice.ng/','suspicious','reported-parent'],
  ['https://news.bbc.co.uk/','unverified',null],
  ['https:///example.org','invalid',null],
  ['https://singlelabel/','invalid',null],
  ['https://example.org\\@other.example/','invalid',null],
  ['https://exa mple.org','invalid',null],
  ['ftp://example.org','invalid',null],
  ['https://0x7f000001/','invalid',null],
  ['https://localhost.local/','invalid',null],
])test(`general URL fixture: ${value}`,()=>{
  const r=analyze(value,'en','url');assert.equal(r.status,status);
  if(indicator)assert.ok(r.reasons.some(x=>x.code===indicator));
  assert.equal(r.inspected.livePage,false);assert.equal(r.evidence.length,0);
});
test('message mode checks no-link requests without inventing a hostname or evidence',()=>{
  const r=analyze('Final notice: your account is blocked. Send your OTP immediately.','en','message');
  assert.equal(r.status,'suspicious');assert.equal(r.host,null);assert.equal(r.analysisKind,'message');assert.deepEqual(r.evidence,[]);
  assert.ok(r.reasons.some(x=>x.code==='urgency'));assert.ok(r.reasons.some(x=>x.code==='credential'));
});
test('ordinary forwarded text and negated safety advice do not become a phishing verdict',()=>{
  for(const value of ['Lunch is at noon. See you there.','Never share your password.']){
    const r=analyze(value,'en','message');assert.equal(r.status,'unverified');assert.equal(r.host,null);assert.match(r.scope,/not verified/);
  }
});
test('explicit URL mode does not silently extract a link from prose',()=>assert.equal(analyze('Read https://example.org please','en','url').status,'invalid'));
test('Pidgin message findings retain the same indicators and status',()=>{
  const text='Act now. Send your password immediately.';const en=analyze(text,'en','message'),pcm=analyze(text,'pcm','message');
  assert.equal(en.status,pcm.status);assert.deepEqual(en.reasons.map(x=>x.code),pcm.reasons.map(x=>x.code));assert.notEqual(en.reasons[0].text,pcm.reasons[0].text);
});

test('legitimate password-reset paths are not message requests for a password',()=>{
  const r=analyze('https://example.org/account/password/reset','en','url');assert.equal(r.status,'unverified');assert.ok(!r.reasons.some(x=>x.code==='credential'));
});
test('bare public domains may include a numeric port',()=>{
  const r=analyze('example.org:8443/path','en','url');assert.equal(r.host,'example.org');assert.equal(r.status,'suspicious');assert.ok(r.reasons.some(x=>x.code==='port'));
});
