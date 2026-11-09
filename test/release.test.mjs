import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fromDataSuffix, toDataSuffix } from '@celo/attribution-tags';
import { tagDirectCalldata, EVENT_CODE, EVENT_SUFFIX } from '../lib/attribution.mjs';
import { agentWalletConfig } from '../lib/agent-identity.mjs';

test('event tag preserves contract calldata and decodes with the official SDK', () => {
  const call = '0xa9059cbb' + '0'.repeat(128);
  const tagged = tagDirectCalldata(call);
  assert.equal(tagged.slice(0, call.length), call);
  assert.deepEqual(fromDataSuffix(tagged), { codes: ['celo_03e76ac742c7'], schemaId: 0 });
  assert.equal(tagDirectCalldata(), EVENT_SUFFIX);
  assert.equal(tagDirectCalldata(tagged), tagged);
  assert.equal(EVENT_CODE, 'celo_03e76ac742c7');
  assert.equal(EVENT_SUFFIX, '0x63656c6f5f303365373661633734326337110080218021802180218021802180218021');
  assert.throws(() => tagDirectCalldata(call + toDataSuffix('another_app').slice(2)), /explicit review/);
  for (const invalid of ['0x1', 'abc', '0xzz', null]) assert.throws(() => tagDirectCalldata(invalid));
});
test('public agent wallet remains unknown until supplied, and never implies verified ownership', () => {
  assert.equal(agentWalletConfig({}).address, null);
  for (const address of ['secret', '0x' + '0'.repeat(40)]) assert.throws(() => agentWalletConfig({ OYACHECK_AGENT_WALLET: address }));
  const configured = agentWalletConfig({ OYACHECK_AGENT_WALLET: '0x' + '1'.repeat(40) });
  assert.equal(configured.configured, true);
  assert.equal(configured.ownershipVerified, false);
});
for (const gate of [{ NODE_ENV: 'production' }, { RENDER: 'true' }, { OYACHECK_READ_ONLY: '1' }]) {
  test(`hosted/read-only financial flags cannot create a ledger: ${JSON.stringify(gate)}`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'oya-release-'));
    const file = join(dir, 'must-not-exist.sqlite');
    try {
      const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { MainnetStore } from './lib/mainnet-store.mjs';
        import { sandboxEnabled } from './lib/buy-browser.mjs';
        import { mainnetConfig, createMainnetTransport } from './lib/mainnet-buy.mjs';
        import { mainnetPreparationEnabled } from './lib/mainnet-http.mjs';
        assert.equal(sandboxEnabled(), false);
        assert.equal(mainnetPreparationEnabled(), false);
        assert.equal(mainnetConfig().execute, false);
        assert.throws(() => new MainnetStore(process.argv[1]), { code: 'storage-disabled' });
        await assert.rejects(createMainnetTransport({execute:true}).buy({}), {code:'execution-disabled'});
      `, file], { env: { ...process.env, NODE_ENV: 'test', RENDER: 'false', OYACHECK_READ_ONLY: '0',
        BUY_BROWSER_SANDBOX: '1', OYACHECK_MAINNET_PREPARE: '1', OYACHECK_MAINNET_EXECUTE: '1', ...gate }, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(existsSync(file), false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
