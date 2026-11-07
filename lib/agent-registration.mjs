// Read-only registration preparation. No account import, signer or send method.
import { AbiFunction, AbiEvent } from 'ox';
import { fromDataSuffix } from '@celo/attribution-tags';
import { isDeepStrictEqual } from 'node:util';
import { CELO_CHAIN_ID, IDENTITY_REGISTRY, OWNER_AGENT_WALLET, AGENT_URI } from './agent-identity.mjs';
import { tagDirectCalldata, EVENT_CODE } from './attribution.mjs';

export const REGISTER = AbiFunction.from('function register(string agentURI) returns (uint256 agentId)');
export const REGISTERED = AbiEvent.from('event Registered(uint256 indexed agentId, string agentURI, address indexed owner)');
export const TRANSFER = AbiEvent.from('event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)');
const BALANCE = AbiFunction.from('function balanceOf(address owner) view returns (uint256)');
const OWNER = AbiFunction.from('function ownerOf(uint256 agentId) view returns (address)');
const URI = AbiFunction.from('function tokenURI(uint256 agentId) view returns (string)');
const WALLET = AbiFunction.from('function getAgentWallet(uint256 agentId) view returns (address)');
export const AGENT_REGISTRY = `eip155:${CELO_CHAIN_ID}:${IDENTITY_REGISTRY}`;
const same = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();
const READ_METHODS = new Set(['eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call','eth_getBalance',
  'eth_estimateGas','eth_gasPrice','eth_getTransactionReceipt','eth_getTransactionByHash']);

export function readOnlyRPC(endpoint = 'https://forno.celo.org') {
  if (new URL(endpoint).protocol !== 'https:') throw new Error('HTTPS RPC required');
  return async (method, params = []) => {
    if (!READ_METHODS.has(method)) throw new Error('RPC method is not read-only or supported');
    const response = await fetch(endpoint, { method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}), signal:AbortSignal.timeout(20_000), redirect:'error' });
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(`RPC ${data.error.code}: ${String(data.error.message).slice(0,250)}`);
    if (!Object.hasOwn(data, 'result')) throw new Error('RPC result missing');
    return data.result;
  };
}
export async function chainSnapshot(rpc) {
  if (BigInt(await rpc('eth_chainId')) !== BigInt(CELO_CHAIN_ID)) throw new Error('Wrong chain; Celo mainnet required');
  const block = await rpc('eth_getBlockByNumber',['finalized',false]);
  if (!block?.hash || !block?.number) throw new Error('Finalized block unavailable');
  const code = await rpc('eth_getCode',[IDENTITY_REGISTRY,block.number]);
  if (!/^0x[0-9a-f]+$/i.test(code) || code === '0x0') throw new Error('Registry bytecode missing');
  return { number:block.number, hash:block.hash, timestamp:block.timestamp };
}
async function call(rpc, fn, args, block) {
  return AbiFunction.decodeResult(fn,await rpc('eth_call',[{to:IDENTITY_REGISTRY,data:AbiFunction.encodeData(fn,args)},block]));
}
export async function auditOwnedIdentities(rpc) {
  const block = await chainSnapshot(rpc);
  const count = await call(rpc,BALANCE,[OWNER_AGENT_WALLET],block.number);
  const nativeWei = await rpc('eth_getBalance',[OWNER_AGENT_WALLET,block.number]);
  const canonical = await rpc('eth_getBlockByNumber',[block.number,false]);
  if (!same(canonical?.hash,block.hash)) throw new Error('Snapshot changed; repeat ownership audit');
  return { wallet:OWNER_AGENT_WALLET, chainId:CELO_CHAIN_ID, registry:IDENTITY_REGISTRY, block,
    currentOwnedCount:count.toString(), completeForCurrentOwnership:count === 0n,
    conclusion:count === 0n ? 'No identities currently owned by this wallet at this finalized snapshot' : 'Owned identities exist; enumerate and verify before proposing registration',
    receivingWalletOrHistoricalIdentitySearch:'Not covered by ERC-721 balanceOf; do not infer absence',
    nativeCELOWei:BigInt(nativeWei).toString() };
}
export function registrationTransaction() {
  const encoded = AbiFunction.encodeData(REGISTER,[AGENT_URI]);
  const data = tagDirectCalldata(encoded);
  if (AbiFunction.decodeData(REGISTER,data)[0] !== AGENT_URI ||
      !fromDataSuffix(data)?.codes.includes(EVENT_CODE)) throw new Error('Registration calldata/tag did not round-trip');
  return { from:OWNER_AGENT_WALLET, to:IDENTITY_REGISTRY, value:'0x0', data, chainId:'0xa4ec' };
}
export async function checkPublishedMetadata(expected, fetcher = fetch) {
  try {
    const response = await fetcher(AGENT_URI,{redirect:'error',signal:AbortSignal.timeout(30_000)});
    if (!response.ok) return { published:false, url:AGENT_URI, status:response.status, reason:'Metadata URL is not successful' };
    if (!/^application\/json\b/i.test(response.headers.get('content-type') || '')) throw new Error('Metadata content type must be application/json');
    const text = await response.text();
    if (text.length > 64*1024) throw new Error('Metadata exceeds bound');
    const data = JSON.parse(text);
    if (!isDeepStrictEqual(data,expected)) throw new Error('Published metadata differs from reviewed local metadata');
    return { published:true, url:AGENT_URI, status:response.status, matchesReviewedMetadata:true };
  } catch (error) { return { published:false, url:AGENT_URI, reason:error.message }; }
}
export async function registrationPreview(rpc, metadata, fetcher = fetch) {
  const audit = await auditOwnedIdentities(rpc);
  const transaction = registrationTransaction();
  const published = await checkPublishedMetadata(metadata,fetcher);
  let gasEstimate = null, simulationError = null;
  try { gasEstimate = BigInt(await rpc('eth_estimateGas',[transaction])).toString(); }
  catch (error) { simulationError = error.message; }
  const gasPriceWei = BigInt(await rpc('eth_gasPrice')).toString();
  const indicativeGasCostWei = gasEstimate ? (BigInt(gasEstimate)*BigInt(gasPriceWei)).toString() : null;
  return { generatedAt:new Date().toISOString(), network:'Celo mainnet', agentURI:AGENT_URI,
    transaction, attribution:fromDataSuffix(transaction.data), audit, metadata:published,
    gas:{ estimate:gasEstimate, priceWei:gasPriceWei, indicativeExecutionCostWei:indicativeGasCostWei,
      simulationError, feeCurrency:'native CELO (feeCurrency omitted)',
      sufficientForIndicativeExecutionCost:indicativeGasCostWei !== null && BigInt(audit.nativeCELOWei) >= BigInt(indicativeGasCostWei),
      limitations:'Time-bound estimate, not a fee cap; refresh in MetaMask. L1 data fee and fee buffer may add cost.' },
    registrationReady:published.published && audit.currentOwnedCount === '0' && gasEstimate !== null &&
      BigInt(audit.nativeCELOWei) >= BigInt(indicativeGasCostWei),
    authorizedToSignOrBroadcast:false };
}
export async function verifyRegistrationReceipt(rpc, hash) {
  if (!/^0x[0-9a-f]{64}$/i.test(hash || '')) throw new Error('Public transaction hash required');
  const finalized = await chainSnapshot(rpc);
  const receipt = await rpc('eth_getTransactionReceipt',[hash]);
  const transaction = await rpc('eth_getTransactionByHash',[hash]);
  const expected = registrationTransaction();
  if (!receipt || receipt.status !== '0x1' || !same(receipt.transactionHash,hash) ||
      !same(receipt.to,expected.to) || !same(receipt.from,expected.from) ||
      !transaction || !same(transaction.hash,hash) || !same(transaction.to,expected.to) ||
      !same(transaction.from,expected.from) || transaction.input !== expected.data || BigInt(transaction.value) !== 0n ||
      BigInt(transaction.chainId) !== BigInt(CELO_CHAIN_ID)) throw new Error('Registration transaction/receipt mismatch');
  if (!same(transaction.blockHash,receipt.blockHash) || BigInt(receipt.blockNumber) > BigInt(finalized.number)) throw new Error('Registration is not finalized');
  const block = await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]);
  if (!same(block?.hash,receipt.blockHash)) throw new Error('Receipt block is not canonical');
  const events = [];
  let mint;
  for (const log of receipt.logs) {
    if (!same(log.address,IDENTITY_REGISTRY) || log.removed) continue;
    try { events.push(AbiEvent.decode(REGISTERED,log)); } catch { /* Other registry event. */ }
    try { const value = AbiEvent.decode(TRANSFER,log); if (same(value.from,'0x'+'0'.repeat(40)) && same(value.to,OWNER_AGENT_WALLET)) mint=value; } catch { /* Other registry event. */ }
  }
  if (events.length !== 1 || !same(events[0].owner,OWNER_AGENT_WALLET) || events[0].agentURI !== AGENT_URI || mint?.tokenId !== events[0].agentId) throw new Error('Genuine registry Registered/mint events missing or mismatched');
  const agentId = events[0].agentId;
  const owner = await call(rpc,OWNER,[agentId],finalized.number);
  const uri = await call(rpc,URI,[agentId],finalized.number);
  const wallet = await call(rpc,WALLET,[agentId],finalized.number);
  if (!same(owner,OWNER_AGENT_WALLET) || uri !== AGENT_URI || !same(wallet,OWNER_AGENT_WALLET)) throw new Error('Current ownerOf/tokenURI/getAgentWallet mismatch');
  // Keep the actual integer precise; EIP registration files use JSON numbers.
  if (agentId > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Agent ID needs a lossless JSON workflow');
  return { verified:true, transactionHash:hash, chainId:CELO_CHAIN_ID, finalized, owner, agentURI:uri, agentWallet:wallet,
    registration:{ agentId:Number(agentId), agentRegistry:AGENT_REGISTRY } };
}
export function postRegistrationMetadata(metadata, evidence) {
  if (!evidence?.verified || evidence.registration?.agentRegistry !== AGENT_REGISTRY ||
      !Number.isSafeInteger(evidence.registration.agentId) || evidence.registration.agentId < 0) throw new Error('Verified receipt evidence required');
  return { ...metadata, registrations:[evidence.registration] };
}
