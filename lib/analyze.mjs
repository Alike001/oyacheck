/** Read-only, deterministic evidence analysis. No network requests here. */
import { domainToASCII } from 'node:url';

export const ADVISORY = Object.freeze({
  title: 'NCC-CSIRT Advisory NCC-CSIRT-2610-040',
  url: 'https://csirt.ncc.gov.ng/index.php/resources/security-advisories/452-phishing-campaign-impersonating-official-verifymydevice-gov-ng-device-verification-portal',
  date: '2026-10-30',
});

// Only exact hosts stated by NCC are included; never treat an arbitrary .gov.ng
// host or a substring match as "official". This list is manually curated.
export const KNOWN_BAD = new Set([
  'secure-verifymydevice.ng',
  'verifymydevice.com.ng',
  'embed-ncc.registrmydevice.ng',
  'verifymydevice.ng',
]);
export const OFFICIAL_HOSTS = new Set([
  'verifymydevice.gov.ng',
  'www.verifymydevice.gov.ng',
  'www.ncc.gov.ng',
  'ncc.gov.ng',
  'csirt.ncc.gov.ng',
  'www.csirt.ncc.gov.ng',
]);
export const OFFICIAL_DESTINATION = 'https://www.ncc.gov.ng/devicechecker';

const LABELS = {
  en: {
    'known-phishing': 'Known phishing domain',
    'official-host-match': 'Official hostname match',
    suspicious: 'Suspicious signals',
    unverified: 'No known threat found',
    invalid: 'Could not check',
  },
  pcm: {
    'known-phishing': 'Dem don report this domain for phishing',
    'official-host-match': 'Domain name match official source',
    suspicious: 'Some warning signs dey',
    unverified: 'We never verify am',
    invalid: 'We no fit check this one',
  },
};

const W = {
  en: {
    bad: 'This exact domain appears in a published NCC-CSIRT phishing advisory.',
    official: 'The hostname matches a domain named by NCC. That does not verify this page or its content.',
    unknown: 'The hostname is not in this small, curated evidence set. Unknown does not mean safe.',
    lookalike: 'The hostname resembles the NCC device-verification service but is not a documented official hostname.',
    http: 'This link uses HTTP rather than HTTPS.',
    port: 'This link uses a nonstandard port.',
    credential: 'Sensitive information is mentioned. Treat unsolicited requests for passwords, OTPs, NIN, BVN or banking details with caution.',
    urgency: 'The message uses pressure or urgency. This is a warning sign, not proof of a scam.',
    shortener: 'This is a link-shortening domain. Its final destination has not been inspected.',
    unicode: 'The hostname uses an internationalized domain encoding. This requires extra care.',
    userinfo: 'The link contains username/password syntax before the hostname; this can disguise the destination.',
    multiple: 'Multiple different links were found. Each link must be reviewed separately.',
    redirect: 'The URL contains a possible external redirect parameter. The final destination has not been inspected.',
    embedded: 'A familiar-looking domain appears inside a longer hostname. Only the complete hostname identifies the destination.',
    confusable: 'The hostname uses letter/number substitutions resembling a familiar service. Confirm its address independently; resemblance is not proof of fraud.',
    'reported-parent': 'This is a subdomain of a hostname listed in the NCC advisory. The advisory lists the parent, not this exact subdomain.',
    'message-only': 'Only message patterns were checked. No public hostname was provided and no sender, attachment or claim was verified.',
    invalid: 'Enter one valid public HTTP(S) address. Private addresses, unsupported schemes and malformed URLs cannot be checked.',
  },
  pcm: {
    bad: 'This exact domain dey inside NCC-CSIRT phishing warning.',
    official: 'The domain name match wetin NCC publish, but we never check the page content.',
    unknown: 'This domain no dey for our small verified list. E no mean say e safe.',
    lookalike: 'This domain resemble NCC device-check site, but e no match official domain.',
    http: 'This link use HTTP instead of HTTPS.',
    port: 'This link use unusual port number.',
    credential: 'Private details dey mentioned. No share password, OTP, NIN, BVN or bank information through unknown link.',
    urgency: 'The message dey put pressure on you. Na warning sign, but e no prove scam.',
    shortener: 'This na shortened link. We never check where e go land.',
    unicode: 'The domain name use internationalized encoding. Check am carefully.',
    userinfo: 'The link get username/password style inside; e fit hide the real domain.',
    multiple: 'We see different links. Check each one separately.',
    redirect: 'This link get possible redirect parameter. We never inspect the final address.',
    embedded: 'Another domain name dey inside this long hostname. Na the full hostname be the real destination.',
    confusable: 'Letters and numbers for this domain resemble familiar service name. Confirm the correct address; resemblance no prove scam.',
    'reported-parent': 'This na subdomain of domain wey NCC report. Na the parent domain dey the advisory, no be this exact subdomain.',
    'message-only': 'Na only message patterns we check. No public domain dey; we never verify sender, attachment or claim.',
    invalid: 'Paste one correct public HTTP(S) address. We no fit check private addresses or malformed links.',
  },
};

const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'cutt.ly', 'shorturl.at', 'rebrand.ly']);
const URGENCY = /\b(urgent|immediately|today only|act now|blocked|suspended|last warning|verify now|within 24 hours|avoid disconnection|final notice|account locked)\b/i;
const CREDENTIAL = /\b(otp|one.time password|passcode|password|pin|bvn|nin|bank (?:details|account)|card (?:number|details)|verification code)\b/i;
const URL_MATCH = /https?:\/\/[^\s<>"'`]+/gi;
// The fallback is deliberately conservative: don't interpret arbitrary sentences
// as domains. Use whole candidate tokens rather than searching subdomains inside text.
const BARE_DOMAIN = /(?:^|[\s(])((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"'`]*)?)(?=$|[\s),;!?])/gi;

function reason(code, lang) {
  return { code, text: W[lang]?.[code] || W.en[code] || code };
}
function stripTrailingPunctuation(s) {
  return s.replace(/[.,;!?)\]}>]+$/g, '');
}
function findCandidates(input) {
  // A single address may use Unicode, userinfo, a port or a query without a scheme.
  if (!/[\s<>"'`]/u.test(input) && (!/^[a-z][a-z\d+.-]*:/i.test(input) || /^[^/?#]+:\d+(?:[/?#]|$)/.test(input)) && input.includes('.')) return [stripTrailingPunctuation(input)];
  const values = [];
  for (const m of input.matchAll(URL_MATCH)) values.push(stripTrailingPunctuation(m[0]));
  // Avoid extracting an embedded hostname inside an already detected URL.
  const withoutUrls = input.replace(URL_MATCH, ' ');
  for (const m of withoutUrls.matchAll(BARE_DOMAIN)) values.push(stripTrailingPunctuation(m[1]));
  return [...new Set(values)];
}
function isPublicHost(host) {
  if (!host || !host.includes('.') || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  if (host.startsWith('[') || /^\d+(?:\.\d+){3}$/.test(host) || host.includes(':')) return false; // no raw IPs
  if (host.length > 253) return false;
  return host.split('.').every(label => label.length > 0 && label.length <= 63 && /^[a-z0-9-]+$/.test(label) && !label.startsWith('-') && !label.endsWith('-'));
}
function isLookalike(host) {
  if (host.includes('verifymydevice') || host.includes('verifymedevice') || host.includes('registrmydevice')) return true;
  if ((host.includes('ncc') || host.includes('devicechecker')) && !OFFICIAL_HOSTS.has(host)) return true;
  return false;
}

/**
 * status describes the strength of the available EVIDENCE, not a calibrated
 * prediction, a live malware scan, or a safety guarantee.
 */
export function analyze(input, language = 'en', mode = 'auto') {
  const lang = language === 'pcm' ? 'pcm' : 'en';
  if (typeof input !== 'string' || input.length < 2 || input.length > 2000 || /[\u0000-\u0008\u000e-\u001f]/u.test(input)) {
    return invalid(lang);
  }
  if (!['auto','url','message'].includes(mode)) return invalid(lang);
  const candidates = findCandidates(input.trim());
  if (candidates.length === 0 && mode === 'message') {
    const issues = messageIndicators(input, lang);
    return { ...invalid(lang), status:issues.length ? 'suspicious' : 'unverified',
      label:issues.length ? LABELS[lang].suspicious : (lang==='pcm' ? 'We no see obvious warning signs' : 'No obvious warning signs'),
      reasons:[...issues,reason('message-only',lang)], analysisKind:'message',
      scope:lang==='pcm' ? 'Na message patterns only. We never verify sender, claims or attachments.' : 'Message patterns only. Sender, claims and attachments were not verified.' };
  }
  if (candidates.length !== 1) {
    if (candidates.length > 1) return { ...invalid(lang), reasons: [reason('multiple', lang)], candidateCount: candidates.length };
    return invalid(lang);
  }
  const candidate = candidates[0];
  if (candidate.includes('\\') || /https?:\/\/\//i.test(candidate) || (mode==='url' && stripTrailingPunctuation(input.trim())!==candidate)) return invalid(lang);
  let url;
  try { url = new URL(candidate.includes('://') ? candidate : `https://${candidate}`); }
  catch { return invalid(lang); }
  if (!['http:', 'https:'].includes(url.protocol)) return invalid(lang);
  let host;
  try { host = domainToASCII(url.hostname.toLowerCase().replace(/\.$/, '')); }
  catch { return invalid(lang); }
  if (!isPublicHost(host)) return invalid(lang);
  const knownBad = KNOWN_BAD.has(host);
  const official = OFFICIAL_HOSTS.has(host);
  const short = SHORTENERS.has(host);
  const lookalike = isLookalike(host) && !knownBad && !official;
  const issues = [];
  if (url.username || url.password) issues.push(reason('userinfo', lang));
  if (url.protocol !== 'https:') issues.push(reason('http', lang));
  if (url.port) issues.push(reason('port', lang));
  for (const [name,value] of url.searchParams) {
    if (/^(redirect|redirect_uri|redirect_url|url|next|target|dest|destination|continue|returnurl)$/i.test(name) && /^(https?:)?\/\//i.test(value)) {issues.push(reason('redirect', lang));break;}
  }
  if (short) issues.push(reason('shortener', lang));
  if (lookalike) issues.push(reason('lookalike', lang));
  if (host.startsWith('xn--') || host.includes('.xn--')) issues.push(reason('unicode', lang));
  const labels=host.split('.');
  if (labels.length>=4 && labels.slice(1,-2).some(x=>['com','org','net','gov','ng','co'].includes(x))) issues.push(reason('embedded',lang));
  const normalized=host.replace(/0/g,'o').replace(/1/g,'l').replace(/3/g,'e').replace(/5/g,'s');
  if (normalized!==host && ['paypal.com','google.com','microsoft.com','apple.com','amazon.com','facebook.com','instagram.com','whatsapp.com'].includes(normalized)) issues.push(reason('confusable',lang));
  const reportedParent=[...KNOWN_BAD].find(parent=>host.endsWith('.'+parent));
  if(reportedParent) issues.push(reason('reported-parent',lang));
  issues.push(...messageIndicators(input.replaceAll(candidate,' '),lang));

  let status = 'unverified';
  const reasons = [];
  if (knownBad) {
    status = 'known-phishing';
    reasons.push(reason('bad', lang));
  } else if (official && issues.length === 0) {
    status = 'official-host-match';
    reasons.push(reason('official', lang));
  } else if (issues.length) {
    status = 'suspicious';
    if (official) reasons.push(reason('official', lang));
    else reasons.push(reason('unknown', lang));
  } else {
    reasons.push(reason('unknown', lang));
  }
  reasons.push(...issues);

  return {
    status,
    label: LABELS[lang][status],
    host,
    reasons,
    evidence: knownBad || official ? [{ title: ADVISORY.title, url: ADVISORY.url, published: ADVISORY.date, sourceType: 'published-advisory' }] : [],
    officialAlternative: (knownBad || lookalike) ? OFFICIAL_DESTINATION : null,
    language: lang,
    analysisKind:mode==='message'?'message':'url',
    scope: 'Local curated evidence and URL/message patterns only. No link was opened; no redirects, forms, TLS or live reputation were inspected.',
    inspected: { livePage: false, redirects: false, forms: false, browserPaid: false },
  };
}
function messageIndicators(input,lang) {
  // Negated advice is not a request to disclose a secret. These remain patterns,
  // not a semantic fraud classifier; context can still create false positives.
  const text=input.replace(/\b(?:do not|don't|never|no)\s+(?:send|share|enter|provide|give)\b[^.!?\n]*/gi,'');
  const issues=[];
  if(CREDENTIAL.test(text))issues.push(reason('credential',lang));
  if(URGENCY.test(text))issues.push(reason('urgency',lang));
  return issues;
}
function invalid(lang) {
  return { status:'invalid', label:LABELS[lang].invalid, host:null, reasons:[reason('invalid',lang)], evidence:[], officialAlternative:null, language:lang,
    scope:'No network request made.', inspected:{livePage:false,redirects:false,forms:false,browserPaid:false} };
}
