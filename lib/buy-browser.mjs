/** Explicit sandbox-only Celo buy browser investigation of a FIXED, verified official source.
 * No user-provided URL is ever visited. No mainnet mode or automatic paid retries.
 */
import { execFile as rawExecFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { ADVISORY, analyze } from './analyze.mjs';

const execFile = promisify(rawExecFile);
const BUY_ENDPOINT = 'https://gateway.usebuy.ai/v1/browser/sessions';
const BODY = JSON.stringify({ durationMinutes: 1 });
const LIMIT_USDC = 0.01;
const DAY_LIMIT_USDC = 0.02;
const ALLOWED_SOURCE = new URL(ADVISORY.url);
const quoteCache = new Map();
const screenshots = new Map();
let spent = 0;
let purchaseCount = 0;
let purchaseDay = '';
let inFlight = false;
let recoveryRequired = false;

export function sandboxEnabled() { return process.env.BUY_BROWSER_SANDBOX === '1'; }
export function isLocalRequest(ip) { return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'; }
export function sourceIsSafe(url) {
  try {const u=new URL(url);return u.protocol === 'https:' && u.hostname === ALLOWED_SOURCE.hostname && u.port === '' && u.username === '' && u.password === '' && u.pathname === ALLOWED_SOURCE.pathname && !u.search && !u.hash;}catch{return false;}
}
export function reportCanCheck(input) {
  const r = analyze(input);
  return r.status !== 'invalid' && r.evidence.some(e => e.url === ADVISORY.url);
}
export function parseSandboxQuote(s) {
  const offers = String(s).split(/(?=^\s*\d+\.\s)/m);
  const offer = offers.find(block => /^\s*\d+\.\s+[\d.]+\s+USDC\s+\([^\n]*\)\s+on\s+celo-sepolia\b/i.test(block));
  const m = offer?.match(/^\s*\d+\.\s+(\d+(?:\.\d{1,6})?)\s+USDC\s+\((\d+) atomic\)\s+on\s+celo-sepolia\b/i);
  if (!m) throw new Error('No Celo Sepolia USDC offer in the current quote');
  const amount = Number(m[1]);
  if (!Number.isFinite(amount) || amount <= 0 || amount > LIMIT_USDC) throw new Error('Quoted test USDC cost exceeds the fixed sandbox cap');
  if (BigInt(m[2]) !== BigInt(Math.round(amount * 1e6))) throw new Error('Quote atomic amount does not match its USDC price');
  if (!/^\s*payable\s+yes\b/im.test(offer)) throw new Error('Sandbox USDC offer is not currently payable');
  return amount;
}
export function validateBrowserCatalog(catalog) {
  const capability = catalog?.capabilities?.find(c => c.id === 'browser.sessions.create');
  const duration = capability?.inputSchema?.properties?.durationMinutes;
  if (capability?.available !== true || capability.method !== 'POST' || capability.url !== BUY_ENDPOINT ||
      duration?.type !== 'integer' || !duration.enum?.includes(1) || capability.sandboxNetwork !== 'celo-sepolia') {
    throw new Error('The live catalog does not support this bounded sandbox browser request');
  }
}
function transactionHash(value) { return typeof value === 'string' && /^0x[a-fA-F0-9]{64}$/.test(value) ? value : null; }
export function purchaseLine(text) {
  let value;
  for (const line of String(text).split(/\r?\n/)) {
    try {
      const candidate = JSON.parse(line);
      if (candidate?.capability === 'browser.sessions.create') { value = candidate; break; }
    } catch { /* CLI may print non-JSON progress; never expose it. */ }
  }
  if (!value) throw new Error('Buy returned no usable purchase response; check receipts before any retry');
  const browser = value.browser;
  if (!browser || !/^[A-Za-z0-9_-]{1,128}$/.test(browser.sessionId || '') ||
      typeof browser.accessToken !== 'string' || !browser.accessToken) {
    throw new Error('Session credentials missing from a potentially settled purchase; do not retry automatically');
  }
  for (const [key, suffix] of [['commandUrl', '/commands'], ['statusUrl', '']]) {
    let url;
    try { url = new URL(browser[key]); } catch { throw new Error('Unexpected browser command endpoint'); }
    if (url.origin !== 'https://gateway.usebuy.ai' || url.username || url.password || url.search || url.hash ||
        url.pathname !== `/v1/browser/sessions/${browser.sessionId}${suffix}`) throw new Error('Unexpected browser command endpoint');
  }
  return value;
}
function dailyReset() {
  const d=new Date().toISOString().slice(0,10);
  if (d!==purchaseDay){purchaseDay=d;spent=0;purchaseCount=0;}
}
export function budgetStatus(){dailyReset();return {spentTestUSDC:Number(spent.toFixed(6)),remainingTestUSDC:Number(Math.max(0,DAY_LIMIT_USDC-spent).toFixed(6)),purchases:purchaseCount,maxPurchases:3};}
async function runBuy(subcommand, cap) {
  const args=['--sandbox',subcommand];
  if (subcommand==='curl') args.push('--max-amount',String(cap),'--token','USDC');
  args.push('-X','POST','-H','content-type: application/json','-d',BODY,BUY_ENDPOINT);
  try {
    const {stdout}=await execFile('buy',args,{timeout:subcommand==='curl'?55000:20000,maxBuffer:1024*1024,env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}});
    return stdout;
  } catch (cause) {
    // execFile errors include raw stdout/stderr, which can contain session
    // credentials or payment authorizations. Surface only a fixed safe message.
    const error = new Error('Buy request failed or timed out; settlement must be checked before another purchase');
    for (const line of `${cause.stdout || ''}\n${cause.stderr || ''}`.split(/\r?\n/)) {
      try { const data = JSON.parse(line); error.transaction = transactionHash(data.transaction ?? data.error?.transaction) || error.transaction; } catch {}
    }
    throw error;
  }
}
function escapeCurlConfig(value) {return String(value).replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/[\r\n]/g,'');}
async function curlSession(url, token, payload, method='POST') {
  // Browser access token is passed on stdin, not in shell history or process arguments.
  const cfg = ['silent','show-error','fail-with-body','max-time = 11',`request = "${method}"`,`url = "${escapeCurlConfig(url)}"`,`header = "Authorization: Bearer ${escapeCurlConfig(token)}"`];
  if (method==='POST') cfg.push('header = "Content-Type: application/json"',`data = "${escapeCurlConfig(JSON.stringify(payload))}"`);
  return await new Promise((resolve,reject)=>{
    const p=spawn('curl',['--config','-'],{stdio:['pipe','pipe','pipe']});
    let stdout='';let size=0;let done=false;
    const fail=e=>{if(!done){done=true;reject(e);}};
    const timer=setTimeout(()=>{p.kill('SIGKILL');fail(new Error('Browser command timed out; purchase may have settled, do not retry automatically'));},13500);
    p.stdout.on('data',b=>{size+=b.length;if(size>3*1024*1024){p.kill('SIGKILL');fail(new Error('Browser response too large'));}else stdout+=b.toString();});
    p.stderr.resume();
    p.on('error',fail);
    p.on('close',code=>{clearTimeout(timer);if(done)return;done=true;
      if(code!==0){reject(new Error(`Browser command failed (curl ${code}): session details withheld`));return;}
      try{const data=JSON.parse(stdout);resolve(method==='POST'?data.output:data);}catch{reject(new Error('Unexpected browser response format'));}
    });
    p.stdin.end(cfg.join('\n')+'\n');
  });
}
function pickField(value,key){
  if(typeof value==='string')return value;
  if(!value||typeof value!=='object')return '';
  const nested=value.data && typeof value.data==='object' ? value.data : {};
  const output=value.output && typeof value.output==='object' ? value.output : {};
  const found=value[key]??nested[key]??output[key]??value.value??value.text;
  return typeof found==='string'?found:'';
}
export function safeSourceMatch(finalUrl, knownHost, text) {
  if(!sourceIsSafe(finalUrl)) return {validOrigin:false,hostMentioned:false};
  return {validOrigin:true,hostMentioned:typeof knownHost==='string'&&knownHost.length>3 && typeof text==='string' && text.toLowerCase().split(/[^a-z0-9.-]+/).some(word => word.replace(/\.$/, '') === knownHost.toLowerCase())};
}
export async function obtainQuote(clientId) {
  if(!sandboxEnabled())throw new Error('Sandbox browser integration is disabled');
  if(recoveryRequired)throw new Error('Receipt recovery required before another purchase; inspect sandbox receipts and restart only after review');
  if(inFlight)throw new Error('A browser investigation is already in progress');
  const catalog = await fetch('https://gateway.usebuy.ai/v1/catalog', { signal: AbortSignal.timeout(8000), redirect: 'error' });
  if (!catalog.ok) throw new Error('Live browser catalog unavailable; no purchase attempted');
  validateBrowserCatalog(await catalog.json());
  const amount=parseSandboxQuote(await runBuy('quote'));
  dailyReset();
  if(purchaseCount>=3 || spent+amount>DAY_LIMIT_USDC)throw new Error('Daily sandbox test budget exhausted');
  const quoteToken=randomBytes(16).toString('hex');
  quoteCache.set(clientId,{amount,quoteToken,expires:Date.now()+90000});
  return {amount,token:'USDC',network:'Celo Sepolia',quoteToken,expiresSeconds:90,source:ADVISORY.url,sandboxOnly:true};
}
export async function inspectPaidSource({clientId,input,quoteToken}) {
  if(!sandboxEnabled())throw new Error('Sandbox browser integration is disabled');
  if(!reportCanCheck(input))throw new Error('Only reports linked to our verified NCC advisory can be inspected');
  if(recoveryRequired)throw new Error('Receipt recovery required before another purchase; inspect sandbox receipts and restart only after review');
  if(inFlight)throw new Error('A browser investigation is already in progress');
  const q=quoteCache.get(clientId);quoteCache.delete(clientId);
  if(!q || quoteToken!==q.quoteToken || Date.now()>q.expires)throw new Error('Quote expired or already used. Get a fresh free quote first');
  dailyReset();
  if(purchaseCount>=3 || spent+q.amount>DAY_LIMIT_USDC)throw new Error('Daily sandbox budget exhausted');
  inFlight=true;spent+=q.amount;purchaseCount++;
  let browser=null;
  let transaction=null;
  try {
    // Never buy automatically after a failed or ambiguous settlement.
    const purchase=purchaseLine(await runBuy('curl',q.amount));
    transaction=transactionHash(purchase.transaction);
    browser=purchase.browser;
    if(browser.status!=='ready')throw new Error('Paid browser is not ready; check receipt before retrying');
    // Fixed official URL, never the user-supplied suspect URL.
    await curlSession(browser.commandUrl,browser.accessToken,{action:'open',url:ADVISORY.url});
    const where=await curlSession(browser.commandUrl,browser.accessToken,{action:'get',kind:'url'});
    const finalUrl=pickField(where,'url');
    if(!sourceIsSafe(finalUrl)) throw new Error('Official source unexpectedly redirected; inspection stopped');
    const titleData=await curlSession(browser.commandUrl,browser.accessToken,{action:'get',kind:'title'}).catch(()=>null);
    let textData=await curlSession(browser.commandUrl,browser.accessToken,{action:'get',kind:'text',target:'body'}).catch(()=>null);
    let sourceText=pickField(textData,'text');
    if(!sourceText) {
      const snap=await curlSession(browser.commandUrl,browser.accessToken,{action:'snapshot',interactive:false,compact:true,depth:2}).catch(()=>null);
      // A snapshot may lack text; do not infer evidence from it.
      if(typeof snap?.data?.text === 'string') sourceText=snap.data.text;
    }
    const host=analyze(input).host;
    const matching=safeSourceMatch(finalUrl,host,sourceText);
    let screenshotId=null;
    try{
      const img=await curlSession(browser.commandUrl,browser.accessToken,{action:'screenshot'});
      if(img?.mimeType==='image/png'&&typeof img.base64==='string'&&img.base64.length<2.8e6){
        const buf=Buffer.from(img.base64,'base64');
        if(buf.length>0&&buf.length<=2*1024*1024&&buf.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))){
          screenshotId=randomBytes(20).toString('hex');screenshots.set(screenshotId,{buf,ip:clientId,until:Date.now()+120000});
        }
      }
    }catch{/* screenshot is optional; never repurchase */}
    return {
      status:'source-inspected',network:'Celo Sepolia (testnet)',token:'test USDC',quotedTestUSDC:q.amount,approvedMaxTestUSDC:q.amount,
      transaction,chainId:11142220,explorerUrl:transaction ? `https://celo-sepolia.blockscout.com/tx/${transaction}` : null,capability:'browser.sessions.create',source:ADVISORY.url,finalSourceUrl:finalUrl,sourceTitle:pickField(titleData,'title').slice(0,180),
      foundInLivePage: matching.hostMentioned ? 'yes' : sourceText ? 'not-in-extracted-text' : 'text-unavailable',
      knownHost:host,checkedAt:new Date().toISOString(),screenshotId,
      scope:'Only the publicly documented NCC advisory was opened in an isolated paid browser. The submitted suspicious website was NOT opened or scanned; no credential forms were inspected.',
      receiptNote:'The quote is an approved ceiling, not independently verified settled cost. A gateway transaction hash is not an independently rechecked onchain receipt. Verify with buy --sandbox receipts --account sandbox --resolve.'
    };
  } catch(e) {
    recoveryRequired = true;
    transaction = transaction || transactionHash(e.transaction);
    const error=new Error(`Inspection incomplete: ${e.message}. Do not automatically retry; check buy sandbox receipts first.`);
    error.status=502;error.transaction=transaction;throw error;
  } finally {
    try {if(browser?.statusUrl&&browser?.accessToken)await curlSession(browser.statusUrl,browser.accessToken,null,'DELETE');}catch{}
    inFlight=false;
  }
}
export function getScreenshot(id,clientId){const s=screenshots.get(id);if(!s)return null;if(Date.now()>s.until){screenshots.delete(id);return null;}return s.ip===clientId?s.buf:null;}
