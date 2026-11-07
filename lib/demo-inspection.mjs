/** Controlled synthetic webpage laboratory. Nothing here investigates an arbitrary URL. */
export const DEMO_SCENARIOS = Object.freeze({
  credential: 'Synthetic credential-request page',
  redirect: 'Synthetic redirect to a credential page',
  ordinary: 'Synthetic information page',
  login: 'Synthetic account login (not automatically malicious)',
});

const ESC = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NOTICE = '<div class="notice" role="alert">CONTROLLED TRAINING PAGE — Do not enter real passwords or personal details. This is not a real government or business service.</div>';
function wrap(title, content) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${ESC(title)} | OyaCheck laboratory</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:17px/1.6 system-ui,sans-serif;max-width:650px;margin:65px auto;padding:20px;color:#173b30;background:#f4f9f3}.notice{border:2px dashed #ca654c;padding:15px;background:#fff3e8;border-radius:12px;font-size:14px}h1{font-size:30px}form{background:white;padding:20px;border:1px solid #ccdcd0;border-radius:14px;display:grid;gap:10px}input{padding:10px;border:1px solid #999;border-radius:8px}button{padding:10px;color:#fff;background:#18523b;border:0;border-radius:9px}.note{color:#78644c}</style></head><body>${NOTICE}${content}</body></html>`;
}
const PAGES = Object.freeze({
  credential: wrap('Verification request — training', `<h1>Urgent verification required</h1><p>Your account will be suspended today. Verify immediately to avoid losing access.</p><form method="post" action="https://collector.example.invalid/collect"><label>Identity number <input name="nin" autocomplete="off" required></label><label>One-time verification code <input name="otp" autocomplete="off" required></label><label>Password <input type="password" name="password" required></label><button type="button">Do not submit — training only</button></form><p class="note">This deliberately contains warning signs. It does not prove anything about a real domain.</p>`),
  ordinary: wrap('Information bulletin — training', `<h1>Community information bulletin</h1><p>Welcome to a harmless training example. This page shares opening hours and general information.</p><p>No passwords or identity information are requested.</p>`),
  login: wrap('Training account sign-in', `<h1>Member sign-in</h1><p>Training portal. Login forms are common on legitimate sites too.</p><form action="/_demo/nowhere" method="post"><label>Username <input name="username" autocomplete="off"></label><label>Password <input type="password" name="password"></label><button type="button">Not an active login</button></form><p>This local form is disabled by Content Security Policy.</p>`),
});

export function scenarioValid(id) { return Object.hasOwn(DEMO_SCENARIOS,id); }
export function fixtureFor(id) {
  if (!scenarioValid(id)) return null;
  if (id === 'redirect') return {status:302,headers:{Location:'/_demo/page/credential?from=controlled-redirect'},body:''};
  return {status:200,headers:{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; navigate-to 'none'; object-src 'none'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store'},body:PAGES[id]};
}
const SENSITIVE = /(?:otp|pin|bvn|nin|password|passcode|cvv|card.?number|verification.?code|identity.?number)/i;
const URGENCY = /(?:immediately|suspended today|urgent|blocked today|expire[s]? today)/i;
export function synthesizeObservations(scenario, observed, navigation = []) {
  if (!scenarioValid(scenario)) throw new Error('Unknown demonstration scenario');
  if (!observed || typeof observed.title !== 'string' || !Array.isArray(observed.forms) || !Array.isArray(observed.headings) || typeof observed.text !== 'string') throw new Error('Browser did not return usable page observations');
  const finalUrl = new URL(observed.url);
  if (finalUrl.protocol!=='http:' || finalUrl.hostname!=='127.0.0.1' || !/^\/_demo\/page\/(credential|ordinary|login)$/.test(finalUrl.pathname)) throw new Error('Browser navigated outside the permitted local examples');
  const forms = observed.forms.slice(0,6).map(f=>({method:String(f.method||'get').slice(0,10).toUpperCase(),action:String(f.action||'').slice(0,180),fields:(Array.isArray(f.fields)?f.fields:[]).slice(0,16).map(x=>({name:String(x.name||'').slice(0,45),type:String(x.type||'').slice(0,24)}))}));
  const sensitiveFields = [...new Set(forms.flatMap(f=>f.fields).filter(f=>SENSITIVE.test(f.name)||f.type==='password').map(f=>f.name||f.type))];
  const externallySubmitted = forms.some(f=>{try{return new URL(f.action).origin!==finalUrl.origin}catch{return false}});
  const urgency = URGENCY.test(observed.text);
  const redirectCount = Math.max(0, navigation.length-1);
  const observations = [];
  if(redirectCount) observations.push(`${redirectCount} internal browser redirect(s) observed before the final page.`);
  if(sensitiveFields.length) observations.push(`Form fields requesting sensitive information: ${sensitiveFields.join(', ')}.`);
  if(externallySubmitted) observations.push('A form declares a destination outside the sample page origin. No form was submitted.');
  if(urgency) observations.push('Page text uses urgency or account-suspension language.');
  if(!observations.length) observations.push('No configured urgency or sensitive-field warning was observed in this sample. This is not a safety certificate.');
  let finding = sensitiveFields.length && urgency ? 'Multiple observable warning signs' : sensitiveFields.length ? 'Sensitive form detected — context needed' : redirectCount ? 'Internal redirect observed' : 'No configured warning signs observed';
  return {kind:'controlled-browser-demo',scenario,scenarioLabel:DEMO_SCENARIOS[scenario],finding,observations,
    page:{title:observed.title.slice(0,180),finalUrl:finalUrl.toString(),headings:observed.headings.slice(0,10).map(h=>String(h).slice(0,100)),forms,redirectCount,sensitiveFields,urgency,externalFormAction:externallySubmitted},
    scope:'Real Chromium rendered a synthetic page hosted by this local OyaCheck server. No user-submitted site was opened, no form was submitted and no Celo Buy payment took place. Warning signs are not proof of criminal intent.',checkedAt:new Date().toISOString(),payment:null,network:null};
}
