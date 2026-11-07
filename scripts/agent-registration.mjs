// Read-only CLI. This file intentionally has no --send/--register action.
import { readFile } from 'node:fs/promises';
import { readOnlyRPC, auditOwnedIdentities, registrationPreview, verifyRegistrationReceipt, postRegistrationMetadata } from '../lib/agent-registration.mjs';
const [action, hash] = process.argv.slice(2);
try {
  if (!['--audit','--preview','--verify'].includes(action)) throw new Error('Usage: node scripts/agent-registration.mjs --audit | --preview | --verify HASH');
  const rpc = readOnlyRPC(process.env.OYACHECK_REGISTRATION_RPC || 'https://forno.celo.org');
  const metadata = JSON.parse(await readFile(new URL('../public/agent-registration.json',import.meta.url),'utf8'));
  let result;
  if (action === '--audit') result = await auditOwnedIdentities(rpc);
  if (action === '--preview') result = await registrationPreview(rpc,metadata);
  if (action === '--verify') {
    const evidence = await verifyRegistrationReceipt(rpc,hash);
    result = { evidence, proposedMetadata:postRegistrationMetadata(metadata,evidence), published:false,
      next:'Review and separately authorize publication, verify public JSON, then verify the real identity in Loops House' };
  }
  console.log(JSON.stringify(result,null,2));
} catch (error) { console.error(JSON.stringify({ error:error.message, authorizedToSignOrBroadcast:false })); process.exitCode=1; }
