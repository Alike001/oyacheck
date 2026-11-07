// Named-wallet adapter. Only execute() can invoke a paid CLI command, and the
// operator pilot must durably claim its one allowance before calling it.
import { execFile as rawExecFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ADVISORY, analyze } from './analyze.mjs';
import { validateBrowserCatalog, purchaseLine, observeOfficialSource, closeBrowserSession } from './buy-browser.mjs';
import { digest, fail } from './mainnet-store.mjs';

const execFile = promisify(rawExecFile);
export const ENDPOINT = 'https://gateway.usebuy.ai/v1/browser/sessions';
export const BODY = '{"durationMinutes":1}';
export const TOKENS = Object.freeze({
  USDC:'0xceba9300f2b948710d2653dd7b07f33a8b32118c',
  USDT:'0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e',
  USAT:'0xd2ab3c9a02dbbab236bfec45d1d755df4267f771',
});
export const RECIPIENT = '0x20faaca5f980e29639a0fcc6dca6988e18ed333b';
export function mainnetConfig(env = process.env) {
  return { account:env.OYACHECK_BUY_ACCOUNT || '', payer:env.OYACHECK_BUY_PAYER || '',
    token:env.OYACHECK_BUY_TOKEN || 'USDC', execute:env.OYACHECK_MAINNET_EXECUTE === '1' };
}
export function validateWallet(config) {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(config.account) || !/^0x[a-fA-F0-9]{40}$/.test(config.payer) || !TOKENS[config.token]) {
    throw fail('wallet-unconfigured', 'Set an existing named mainnet account, public payer address and supported token; no wallet is created', 503);
  }
}
export function parseMainnetOffer(catalog, challenge, token) {
  validateBrowserCatalog(catalog);
  const listed = catalog.payment?.tokens?.find(t => t.symbol === token);
  if (!TOKENS[token] || catalog.payment?.chainId !== 42220 || catalog.payment.network !== 'celo' ||
      catalog.payment.payTo?.toLowerCase() !== RECIPIENT || listed?.decimals !== 6 || listed?.asset?.toLowerCase() !== TOKENS[token]) {
    throw fail('catalog-changed', 'Mainnet token or recipient contract changed; operator review required', 503);
  }
  if (challenge?.x402Version !== 1 || !Array.isArray(challenge.accepts)) throw fail('unsupported-challenge', 'This pilot requires the published x402 v1 exact-payment offer', 503);
  const offer = challenge.accepts.find(o => o.network === 'celo' && o.asset?.toLowerCase() === TOKENS[token] && o.scheme === 'exact');
  if (!offer || offer.resource !== ENDPOINT || offer.payTo?.toLowerCase() !== RECIPIENT ||
      offer.extra?.gateway?.capability !== 'browser.sessions.create' || offer.extra.gateway.durationMinutes !== 1 ||
      !/^\d{1,6}$/.test(offer.maxAmountRequired)) throw fail('invalid-quote', 'No matching bounded mainnet browser offer', 503);
  const atomic = Number(offer.maxAmountRequired);
  if (atomic <= 0 || atomic > 10000) throw fail('spend-limit', 'Quote exceeds the 0.01 token pilot ceiling');
  return { atomic, token, asset:TOKENS[token], payTo:RECIPIENT, chainId:42220, network:'Celo mainnet',
    endpoint:ENDPOINT, method:'POST', body:BODY, durationMinutes:1, capability:'browser.sessions.create', source:ADVISORY.url };
}
async function boundedJSON(response) {
  const reader = response.body.getReader(); let bytes = 0, text = '';
  const decoder = new TextDecoder();
  try {
    while (true) { const {done,value} = await reader.read(); if (done) break;
      bytes += value.length; if (bytes > 1024*1024) throw fail('provider-unavailable', 'Gateway response exceeded its bound', 503);
      text += decoder.decode(value,{stream:true});
    }
    return JSON.parse(text + decoder.decode());
  } catch { await reader.cancel().catch(()=>{}); throw fail('provider-unavailable', 'Gateway returned an unusable response', 503); }
}
async function runCLI(args) {
  try {
    return (await execFile('buy',args,{timeout:55_000,maxBuffer:1024*1024,env:{...process.env,NO_COLOR:'1',FORCE_COLOR:'0'}})).stdout;
  } catch (cause) {
    const paid=args.includes('curl');
    const error = paid ? fail('payment-uncertain', 'Buy did not return a usable result. Reconcile receipts; do not pay again', 502) : fail('wallet-unavailable','The existing named wallet could not be verified; nothing was paid',503);
    for (const line of `${cause.stdout || ''}\n${cause.stderr || ''}`.split(/\r?\n/)) {
      try { const data = JSON.parse(line), tx=data.transaction ?? data.error?.details?.transaction;
        if (/^0x[a-fA-F0-9]{64}$/.test(tx || '')) error.transaction = tx;
      } catch { /* Never expose raw CLI text or authorizations. */ }
    }
    throw error;
  }
}
export function createMainnetTransport(config = mainnetConfig()) {
  return {
    async quote(host) {
      validateWallet(config);
      let catalog, challenge;
      try {
        const c=await fetch('https://gateway.usebuy.ai/v1/catalog',{signal:AbortSignal.timeout(8000),redirect:'error'});
        if (!c.ok) throw new Error(); catalog=await boundedJSON(c);
        const q=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:BODY,signal:AbortSignal.timeout(8000),redirect:'error'});
        if (q.status !== 402) throw new Error(); challenge=await boundedJSON(q);
      } catch { throw fail('provider-unavailable','Browser provider is unavailable; nothing was authorized or paid',503); }
      const offer = parseMainnetOffer(catalog,challenge,config.token);
      // whoami is documented read-only: no key is retrieved, generated or signed.
      const identity=await runCLI(['--account',config.account,'whoami']);
      const plain=identity.replace(/\x1b\[[0-9;]*m/g,'');
      if (!plain.split('\n')[0].endsWith(' on celo') || !plain.toLowerCase().includes(`pays from ${config.payer.toLowerCase()}`)) {
        throw fail('wallet-mismatch','Configured account does not match the approved mainnet payer',503);
      }
      const balances=plain.split('\n').find(line=>line.includes('balances')) || '';
      const amount=balances.match(new RegExp(`(?:^|[ ,])([0-9]+(?:\\.[0-9]{1,6})?) ${config.token}\\b`));
      const balance=amount ? Number(amount[1].split('.')[0])*1e6+Number((amount[1].split('.')[1]||'').padEnd(6,'0')) : 0;
      if (!amount || !Number.isSafeInteger(balance) || balance < offer.atomic) throw fail('insufficient-funds','The named wallet lacks the quoted token balance; nothing was paid',409);
      return {...offer,account:config.account,payer:config.payer.toLowerCase(),host};
    },
    async buy(plan) {
      validateWallet(config);
      if (!config.execute || plan.account!==config.account || plan.payer!==config.payer.toLowerCase() || plan.token!==config.token || !Number.isSafeInteger(plan.atomic) || plan.atomic<=0 || plan.atomic>10000) throw fail('execution-disabled','The approved mainnet execution configuration does not match',403);
      const stdout=await runCLI(['--account',plan.account,'curl','--max-amount',(plan.atomic/1e6).toFixed(6),'--token',plan.token,
        '-X','POST','-H','content-type: application/json','-d',BODY,ENDPOINT]);
      try { return purchaseLine(stdout); } catch {
        const error=fail('payment-uncertain','Session result was unusable; reconcile receipts before any further action',502);
        for(const line of stdout.split(/\r?\n/))try{const value=JSON.parse(line);if(/^0x[a-fA-F0-9]{64}$/.test(value.transaction||''))error.transaction=value.transaction;}catch{}
        throw error;
      }
    },
    async observe(purchase, plan, owner) {
      try {
        if (purchase.browser.status !== 'ready') throw fail('browser-unavailable','Paid session is not ready; do not repurchase');
        const {screenshotId,...observation}=await observeOfficialSource(purchase.browser,plan.host,owner);
        return {...observation,source:ADVISORY.url,
          scope:'Only the fixed NCC advisory was inspected. The submitted website was not opened. No safety guarantee or new deterministic verdict results.'};
      } finally { await closeBrowserSession(purchase.browser).catch(()=>{}); }
    },
  };
}
export class MainnetPilot {
  constructor(store, transport, config) { this.store=store;this.transport=transport;this.config=config; }
  async quote(owner, input, requestId) {
    if (!/^[a-zA-Z0-9_-]{16,80}$/.test(requestId || '')) throw fail('invalid-request','A stable request ID is required',400);
    const report=analyze(input);
    if (!report.evidence.some(e=>e.url===ADVISORY.url)) throw fail('unsupported-input','Only an existing NCC advisory investigation can request this service',400);
    const binding=digest(JSON.stringify({host:report.host,token:this.config.token,payer:this.config.payer.toLowerCase()}));
    const existing=this.store.existing(owner,requestId,binding);if(existing)return existing;
    return this.store.create(owner,requestId,binding,await this.transport.quote(report.host));
  }
  async execute(id, fingerprint) {
    if (!this.config.execute) throw fail('execution-disabled','Mainnet execution is disabled; no financial action was taken',403);
    const existing=this.store.get(id);
    if (existing.state !== 'requested' || fingerprint !== existing.fingerprint || existing.expires <= Date.now()) throw fail('operator-approval-required','A fresh operator-approved request is required',403);
    validateWallet(this.config);
    const fresh=await this.transport.quote(existing.plan.host);
    if (JSON.stringify(fresh) !== JSON.stringify(existing.plan)) throw fail('quote-changed','Price, payer or service changed; cancel and review a fresh quote');
    const row=this.store.claim(id,fingerprint); // fsynced reservation BEFORE signing.
    try {
      const purchase=await this.transport.buy(row.plan);
      this.store.recordTransaction(id,purchase.transaction);
      const result=await this.transport.observe(purchase,row.plan,row.owner);
      return this.store.finish(id,result);
    } catch (error) {
      this.store.recordTransaction(id,error.transaction);
      // Unknown provider text is never persisted or returned to the browser.
      return this.store.finish(id,null,'payment-or-service-incomplete');
    }
  }
}
