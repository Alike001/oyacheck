// Public identity configuration, independent of any signing account. Never
// read private keys here or expose a browser wallet import flow.
export const CELO_CHAIN_ID = 42220;
export const IDENTITY_REGISTRY = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
export function agentWalletConfig(env = process.env) {
  const address = env.OYACHECK_AGENT_WALLET || null;
  if (address !== null && (!/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/i.test(address))) {
    throw new Error('OYACHECK_AGENT_WALLET must be a nonzero public EVM address');
  }
  return { chainId: CELO_CHAIN_ID, address, configured: address !== null,
    ownershipVerified: false, registrationVerified: false };
}
