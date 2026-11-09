import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ADVISORY } from '../lib/analyze.mjs';
import { parseSandboxQuote, purchaseLine, validateBrowserCatalog, safeSourceMatch, sourceIsSafe } from '../lib/buy-browser.mjs';

const catalog = { capabilities: [{ id: 'browser.sessions.create', available: true, method: 'POST',
  url: 'https://gateway.usebuy.ai/v1/browser/sessions', sandboxNetwork: 'celo-sepolia',
  inputSchema: { properties: { durationMinutes: { type: 'integer', enum: [1, 2] } } } }] };
const quote = '1. 0.003606 USDC (3606 atomic) on celo-sepolia\n payable yes';
const transaction = '0x' + 'a'.repeat(64);
const purchase = { capability: 'browser.sessions.create', transaction,
  browser: { sessionId: 'abc', status: 'ready', accessToken: 'FAKE_SESSION_SECRET',
    commandUrl: 'https://gateway.usebuy.ai/v1/browser/sessions/abc/commands',
    statusUrl: 'https://gateway.usebuy.ai/v1/browser/sessions/abc' } };

test('nonpayable offer cannot borrow payable status from a later offer', () => {
  assert.throws(() => parseSandboxQuote(quote.replace('payable yes', 'payable no') +
    '\n2. 0.003606 USDC (3606 atomic) on celo\n payable yes'), /not currently payable/);
});
test('atomic price mismatch and precision beyond six decimals fail closed', () => {
  assert.throws(() => parseSandboxQuote(quote.replace('3606 atomic', '9000 atomic')), /atomic amount/);
  assert.throws(() => parseSandboxQuote(quote.replace('0.003606', '0.0036061')), /No Celo Sepolia/);
});
for (const mutate of [
  c => { c.capabilities[0].available = false; },
  c => { c.capabilities[0].url = 'https://attacker.test'; },
  c => { c.capabilities[0].method = 'GET'; },
  c => { c.capabilities[0].inputSchema.properties.durationMinutes.enum = [10]; },
  c => { c.capabilities[0].sandboxNetwork = 'celo'; },
]) test(`catalog contract change is rejected: ${mutate.toString()}`, () => {
  const value = structuredClone(catalog); mutate(value);
  assert.throws(() => validateBrowserCatalog(value), /live catalog/);
});
test('current browser catalog request is supported', () => assert.doesNotThrow(() => validateBrowserCatalog(catalog)));
for (const bad of [
  'https://user:secret@gateway.usebuy.ai/v1/browser/sessions/abc/commands',
  'https://gateway.usebuy.ai:444/v1/browser/sessions/abc/commands',
  'https://gateway.usebuy.ai/v1/browser/sessions/other/commands',
  'https://gateway.usebuy.ai/v1/browser/sessions/abc/commands?redirect=evil',
  'https://gateway.usebuy.ai/v1/browser/sessions/abc/commands#secret',
  'https://evil.test/v1/browser/sessions/abc/commands',
]) test(`session credential cannot be sent to ${bad}`, () => {
  const value = structuredClone(purchase); value.browser.commandUrl = bad;
  assert.throws(() => purchaseLine(JSON.stringify(value)), /Unexpected browser command endpoint/);
});
test('purchase JSON property order is irrelevant and provider text stays private', () => {
  assert.equal(purchaseLine(JSON.stringify({ transaction, browser: purchase.browser, capability: purchase.capability })).transaction, transaction);
  assert.throws(() => purchaseLine('{"capability":"FAKE_SESSION_SECRET'), error => !error.message.includes('FAKE_SESSION_SECRET'));
});
test('only the exact official advisory path is permitted', () => {
  assert.equal(sourceIsSafe(ADVISORY.url), true);
  assert.equal(sourceIsSafe('https://csirt.ncc.gov.ng/other-page'), false);
  assert.equal(sourceIsSafe(ADVISORY.url + '?redirect=https://evil.test'), false);
});
test('live source match requires the complete hostname, not a substring', () => {
  assert.equal(safeSourceMatch(ADVISORY.url, 'verifymydevice.ng', 'secure-verifymydevice.ng').hostMentioned, false);
  assert.equal(safeSourceMatch(ADVISORY.url, 'verifymydevice.ng', 'verifymydevice.ng.evil.test').hostMentioned, false);
  assert.equal(safeSourceMatch(ADVISORY.url, 'verifymydevice.ng', '(VERIFyMYDEVICE.ng).').hostMentioned, true);
});

async function fixture(t, mode = 'success', price = '0.003606') {
  const dir = await mkdtemp(join(tmpdir(), 'oya-fake-buy-'));
  const previous = { PATH: process.env.PATH, BUY_BROWSER_SANDBOX: process.env.BUY_BROWSER_SANDBOX };
  process.env.PATH = `${dir}:${previous.PATH}`;
  process.env.BUY_BROWSER_SANDBOX = '1';
  t.after(async () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(dir, { recursive: true, force: true });
  });
  const log = join(dir, 'calls.jsonl');
  const preamble = `#!${process.execPath}\nconst fs=require('node:fs'); const args=process.argv.slice(2); const log=${JSON.stringify(log)};`;
  await writeFile(join(dir, 'buy'), preamble + `
fs.appendFileSync(log,JSON.stringify({binary:'buy',args})+'\\n');
if(args.includes('quote'))console.log(${JSON.stringify(quote.replace('0.003606', price).replace('3606 atomic', `${Math.round(Number(price) * 1e6)} atomic`))});
else if(${JSON.stringify(mode)}==='buy-error'){
 console.error(JSON.stringify({transaction:${JSON.stringify(transaction)},accessToken:'FAKE_SESSION_SECRET'}));process.exit(1);
}else console.log(${JSON.stringify(JSON.stringify(purchase))});
`);
  await writeFile(join(dir, 'curl'), preamble + `
let raw='';process.stdin.on('data',b=>raw+=b);process.stdin.on('end',()=>{
 fs.appendFileSync(log,JSON.stringify({binary:'curl',args,config:raw})+'\\n');
 if(${JSON.stringify(mode)}==='command-error'){console.error('FAKE_SESSION_SECRET');process.exit(22);}
 const dataLine=raw.split('\\n').find(line=>line.startsWith('data = '));
 const payload=dataLine?JSON.parse(JSON.parse(dataLine.slice(7))):{};
 let output={};
 if(payload.kind==='url')output={url:${JSON.stringify(mode === 'redirect' ? 'https://evil.test/' : ADVISORY.url)}};
 else if(payload.kind==='title')output={title:'Official advisory'};
 else if(payload.kind==='text')output={text:'NCC reports secure-verifymydevice.ng.'};
 console.log(JSON.stringify({output}));
});
`);
  await chmod(join(dir, 'buy'), 0o700); await chmod(join(dir, 'curl'), 0o700);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options }); return Response.json(catalog);
  });
  // Fresh module state for each scenario: no wallet, payment or real gateway.
  const api = await import(`../lib/buy-browser.mjs?scenario=${encodeURIComponent(dir)}`);
  return { api, calls, log: async () => (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line)) };
}
test('one consented mock purchase opens only the advisory; replay cannot charge twice', async t => {
  const { api, calls, log } = await fixture(t);
  const q = await api.obtainQuote('local-client');
  const result = await api.inspectPaidSource({ clientId: 'local-client', input: 'secure-verifymydevice.ng', quoteToken: q.quoteToken });
  assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://gateway.usebuy.ai/v1/catalog');
  assert.equal(result.transaction, transaction); assert.equal(result.chainId, 11142220);
  assert.equal(result.explorerUrl, `https://celo-sepolia.blockscout.com/tx/${transaction}`);
  assert.match(result.excerpt, /secure-verifymydevice\.ng/);
  assert.equal(result.sourceTextSha256, createHash('sha256').update(result.textSnapshot).digest('hex'));
  assert.equal(result.foundInLivePage, 'yes'); assert.equal(result.approvedMaxTestUSDC, q.amount);
  assert.match(result.scope, /suspicious website was NOT opened/);
  assert.doesNotMatch(JSON.stringify(result), /FAKE_SESSION_SECRET|commandUrl|accessToken/);
  await assert.rejects(api.inspectPaidSource({ clientId: 'local-client', input: 'secure-verifymydevice.ng', quoteToken: q.quoteToken }), /already used/);
  const entries = await log();
  const paid = entries.filter(e => e.binary === 'buy' && e.args.includes('curl'));
  assert.equal(paid.length, 1);
  assert.deepEqual(paid[0].args.slice(0, 6), ['--sandbox', 'curl', '--max-amount', String(q.amount), '--token', 'USDC']);
  const commands = entries.filter(e => e.binary === 'curl');
  assert.ok(commands.some(e => e.config.includes(ADVISORY.url)));
  assert.ok(commands.every(e => e.args.join(' ') === '--config -'));
  assert.ok(commands.some(e => e.config.includes('DELETE')));
});
for (const mode of ['buy-error', 'command-error', 'redirect']) test(`${mode} prevents another purchase pending receipt review`, async t => {
  const { api, log } = await fixture(t, mode);
  const q = await api.obtainQuote('local-client');
  await assert.rejects(api.inspectPaidSource({ clientId: 'local-client', input: 'secure-verifymydevice.ng', quoteToken: q.quoteToken }), error => {
    assert.doesNotMatch(error.message, /FAKE_SESSION_SECRET/);
    assert.match(error.message, /Do not automatically retry/);
    if (mode === 'buy-error') assert.equal(error.transaction, transaction);
    return true;
  });
  await assert.rejects(api.obtainQuote('local-client'), /Receipt recovery required/);
  const entries = await log();
  assert.equal(entries.filter(e => e.binary === 'buy' && e.args.includes('curl')).length, 1);
  assert.equal(api.budgetStatus().purchases, 1);
});
test('unsupported reports and wrong tokens never reach the payment command', async t => {
  const { api, log } = await fixture(t);
  const q = await api.obtainQuote('local-client');
  await assert.rejects(api.inspectPaidSource({ clientId: 'local-client', input: 'example.org', quoteToken: q.quoteToken }), /verified NCC advisory/);
  await assert.rejects(api.inspectPaidSource({ clientId: 'local-client', input: 'secure-verifymydevice.ng', quoteToken: 'wrong' }), /Quote expired/);
  assert.equal((await log()).filter(e => e.args.includes('curl')).length, 0);
});
test('expired consent cannot reach a paid command', async t => {
  const { api, log } = await fixture(t);
  const q = await api.obtainQuote('local-client');
  const now = Date.now(); t.mock.method(Date, 'now', () => now + 91_000);
  await assert.rejects(api.inspectPaidSource({ clientId: 'local-client', input: 'secure-verifymydevice.ng', quoteToken: q.quoteToken }), /Quote expired/);
  assert.equal((await log()).filter(e => e.args.includes('curl')).length, 0);
});
test('concurrent replay allows only one paid command', async t => {
  const { api, log } = await fixture(t);
  const q = await api.obtainQuote('local-client');
  const request = { clientId: 'local-client', input: 'secure-verifymydevice.ng', quoteToken: q.quoteToken };
  const first = api.inspectPaidSource(request);
  await assert.rejects(api.inspectPaidSource(request), /already in progress/);
  await first;
  assert.equal((await log()).filter(e => e.args.includes('curl')).length, 1);
});
for (const [price, count] of [['0.003606', 3], ['0.01', 2]]) test(`purchase count and daily amount ceiling hold at price ${price}`, async t => {
  const { api, log } = await fixture(t, 'success', price);
  for (let i = 0; i < count; i++) {
    const q = await api.obtainQuote('local-client');
    await api.inspectPaidSource({ clientId: 'local-client', input: 'secure-verifymydevice.ng', quoteToken: q.quoteToken });
  }
  await assert.rejects(api.obtainQuote('local-client'), /Daily sandbox test budget exhausted/);
  assert.equal((await log()).filter(e => e.args.includes('curl')).length, count);
});
