// Independent read-only settlement verification. Never retries a purchase,
// releases a reservation, or accepts a client-supplied settlement flag.
import { fail } from './mainnet-store.mjs';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const addressTopic = address => '0x' + address.toLowerCase().slice(2).padStart(64,'0');
export async function reconcileMainnet(store,id,transaction,rpc) {
  const row=store.get(id), tx=transaction || row.transaction_hash;
  if (!/^0x[a-fA-F0-9]{64}$/.test(tx || '')) throw fail('receipt-required','Find the original transaction in the named buy account receipts; never buy again');
  if (await rpc('eth_chainId',[]) !== '0xa4ec') throw fail('wrong-chain','Reconciliation requires Celo mainnet');
  const receipt=await rpc('eth_getTransactionReceipt',[tx]);
  if (!receipt || receipt.status !== '0x1' || receipt.transactionHash?.toLowerCase() !== tx.toLowerCase()) throw fail('settlement-unknown','Successful settlement is not established; allowance remains reserved');
  const block=await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]);
  const time=Number(BigInt(block?.timestamp || '0x0'))*1000;
  if (!row.started || time < row.started-120_000 || time > row.started+600_000) throw fail('receipt-mismatch','Receipt time is outside this purchase attempt');
  const transfers=receipt.logs.filter(log=>log.address?.toLowerCase()===row.plan.asset &&
    log.topics?.[0]?.toLowerCase()===TRANSFER && log.topics?.[1]?.toLowerCase()===addressTopic(row.plan.payer) &&
    log.topics?.[2]?.toLowerCase()===addressTopic(row.plan.payTo));
  const amount=transfers.reduce((total,log)=>total+BigInt(log.data),0n);
  if (amount<=0n || amount>BigInt(row.plan.atomic)) throw fail('receipt-mismatch','No matching bounded payment from the approved payer to service recipient');
  return store.reconcile(id,tx,Number(amount));
}
export async function publicCeloRPC(method,params) {
  const response=await fetch('https://forno.celo.org',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(8000),redirect:'error'});
  if (!response.ok) throw fail('rpc-unavailable','Read-only receipt verification is unavailable',503);
  const data=await response.json();
  if (data.error) throw fail('rpc-unavailable','Read-only receipt verification failed',503);
  return data.result;
}
