// Operator-only entry point. This file is never served to the browser.
// --show and --reconcile are read-only with respect to money. --execute needs
// separate explicit human approval, fresh user consent AND an opt-in flag.
import { MainnetStore, publicPurchase } from '../lib/mainnet-store.mjs';
import { MainnetPilot, createMainnetTransport, mainnetConfig } from '../lib/mainnet-buy.mjs';
import { reconcileMainnet, publicCeloRPC } from '../lib/mainnet-reconcile.mjs';

const args=process.argv.slice(2);
const action=args[0], id=args[1];
if (!['--show','--execute','--reconcile'].includes(action) || !/^[a-f0-9-]{36}$/.test(id || '')) {
  console.error('Usage: node scripts/mainnet-pilot.mjs --show ID | --execute ID --approve FINGERPRINT | --reconcile ID [--transaction HASH]');
  process.exitCode=1;
} else {
  let store;
  try {
    // Executing without both gates must not even open/create a financial ledger.
    const fingerprint=args[2]==='--approve' ? args[3] : '';
    if (action==='--execute' && (process.env.OYACHECK_MAINNET_EXECUTE!=='1' || !/^[a-f0-9]{64}$/.test(fingerprint || ''))) {
      throw new Error('Execution disabled: obtain separate approval of the exact quote and enable execution explicitly');
    }
    store=new MainnetStore(process.env.OYACHECK_PURCHASE_DB || '');
    let row;
    if (action==='--show') row=store.get(id);
    if (action==='--reconcile') row=await reconcileMainnet(store,id,args[2]==='--transaction'?args[3]:null,publicCeloRPC);
    if (action==='--execute') {
      const config=mainnetConfig();row=await new MainnetPilot(store,createMainnetTransport(config),config).execute(id,fingerprint);
    }
    console.log(JSON.stringify(publicPurchase(row),null,2));
  } catch (error) {
    console.error(JSON.stringify({error:(error.safe ? error.code : 'operator-check-failed'),message:error.safe ? error.message : 'Operator configuration or storage check failed; no automatic payment retry'}));
    process.exitCode=1;
  } finally {store?.close();}
}
