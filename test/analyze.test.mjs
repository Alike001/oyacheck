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
