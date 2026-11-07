// Pure offline calldata preparation. This module has no wallet or RPC client.
import { toDataSuffix, fromDataSuffix } from '@celo/attribution-tags';
export const EVENT_CODE = 'celo_03e76ac742c7';
export const EVENT_SUFFIX = toDataSuffix(EVENT_CODE);
export function tagDirectCalldata(data = '0x') {
  if (typeof data !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(data)) throw new Error('Expected byte-aligned hex calldata');
  const existing = fromDataSuffix(data);
  if (existing) {
    if (existing.codes.includes(EVENT_CODE)) return data;
    throw new Error('Existing attribution requires explicit review before combining tags');
  }
  return data + EVENT_SUFFIX.slice(2);
}
