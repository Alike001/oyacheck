// Read-only environment inspection: no network, wallet CLI, ledger or signing.
import { agentWalletConfig } from '../lib/agent-identity.mjs';
import { financialActionsBlocked } from '../lib/release-policy.mjs';
import { EVENT_CODE, EVENT_SUFFIX } from '../lib/attribution.mjs';
const flags = ['BUY_BROWSER_SANDBOX', 'OYACHECK_DEMO_BROWSER', 'OYACHECK_MAINNET_PREPARE', 'OYACHECK_MAINNET_EXECUTE'];
try {
  if (!financialActionsBlocked() || flags.some(key => process.env[key] && process.env[key] !== '0') || process.env.OYACHECK_PURCHASE_DB) {
    throw new Error('Release requires read-only mode, financial/demo flags off and purchase database unset');
  }
  console.log(JSON.stringify({ release: 'read-only', wallet: agentWalletConfig(), eventCode: EVENT_CODE,
    directTransactionSuffix: EVENT_SUFFIX, registration: 'unverified', financialActions: 'disabled' }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
