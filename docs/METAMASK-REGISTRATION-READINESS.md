# OyaCheck: unsigned MetaMask registration readiness

Prepared 2026-11-07 from `42ab6def0afce199c182b973e0ecfbea28c72f70` on
`fix/ai-reliability-mobile`. This is local preparation, not permission to publish,
fund, sign, register, broadcast or submit. The deadline is 2026-11-09 09:00 GMT.

## Owner-confirmed configuration

- Wallet: `0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a` (valid checksum).
- Network: Celo mainnet, chain `42220` / `0xa4ec`.
- Identity registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
- Event code: `celo_03e76ac742c7`.
- Intended stable agentURI: `https://oyacheck-beta.onrender.com/agent-registration.json`.

Public constants, `.env.example` and the local Render Blueprint now record the
confirmed wallet. This does not establish wallet control, an existing identity,
an event-entry association, or a buy payer. No private key/seed is accepted.
Existing buy account/payer settings remain separate and unset by this change.

## Primary sources

- [Live Celo ERC-8004 guide](https://docs.celo.org/build/agents/8004): registry,
  mint ownership/default receiving wallet, receipt ID and metadata update order.
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004): registration JSON and
  optional domain proof. Live Celo/spec guidance takes precedence over the older
  Context7 Celo excerpts retrieved in this session.
- [Official Celo attribution guide](https://docs.celo.org/build/agents/attribution-tags):
  issued code and direct-calldata suffix.
- [MetaMask transaction guidance](https://docs.metamask.io/metamask-connect/evm/guides/send-transactions/)
  and [Extension hex data setting](https://support.metamask.io/configure/transactions/how-to-add-a-memo-to-a-transaction/).
- [Loops House](https://www.loops.house/agents-on-open-rails): add the agent wallet
  to the entry and register its identity from that wallet before the deadline.

## Existing identity audit and its exact scope

The successful read-only primary RPC run used `https://forno.celo.org`, checked
chain `0xa4ec`, nonempty registry code and finalized block:

- Number: `0x4e5abc9` (82160585).
- Hash: `0x4dad5fc78c45e3b79456e73c2503b1662131bb2bc06a3f4219f49c533a6cc493`.
- `balanceOf(0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a)` at that block: **0**.
- Native wallet balance at that block: **0 wei CELO**.
- The primary audit re-read the numbered block and matched its hash.
- Captured preview: `registration/unsigned-preview.json`, generated
  **2026-11-07T14:52:36.636Z**. This is an observation, not a current fee promise.

This is a complete ERC-721 current-ownership count for this exact wallet,
registry and snapshot: it owns no identity NFTs there. No log pagination is
needed to establish zero current ownership. It is **not** a complete historical
registration search or a reverse search for identities owned by someone else
that name this address in `getAgentWallet`. Do not claim the wallet has never
registered, or that no related identity can exist anywhere. An owner-supplied
historical ID/receipt should still be checked before a fresh mint.

An initial independent `https://celo.drpc.org` check also returned chain 42220,
the same finalized block/hash, nonempty registry code, ownership count zero and
native balance zero. Later repeat requests failed (HTTP 400 / fetch errors),
and a later primary refresh also failed. These failures do not produce a negative
identity result or replace the successful timestamped snapshot. Re-run a reliable
read-only check immediately before any separately approved registration. The CLI
fails closed on RPC errors, missing code, wrong chain or changed snapshot hash.
If the count becomes positive, it reports identities exist without claiming a
complete enumeration or selecting one blindly.

## Metadata and HTTPS publication gate

The former draft was finalized and moved to `public/agent-registration.json`.
It advertises only the existing web endpoint, deterministic hostname/advisory
checks and optional AI/voice English/Pidgin assistance. It states the public beta
does not open submitted sites or guarantee safety. There are no MCP/A2A endpoints,
paid-resource claims or trust attestations. `x402Support` is false because
OyaCheck's endpoints do not accept x402 payments. `active: true` refers to the
existing beta; `registrations: []` honestly represents the pre-registration state.

The server explicitly serves `/agent-registration.json` as `application/json`.
Local HTTP tests verify the full JSON and disabled financial routes. The HTTPS
URI is on the same domain as the advertised web service, so a separate
`/.well-known/agent-registration.json` domain proof is optional, not a requirement
for this same-domain arrangement.

**Published readiness: BLOCKED.** The actual HTTPS metadata URL returned HTTP
**404** during the successful preview. The new route is local only. Production
still serves commit `638e61fff3256a8dce74b6937dddc9a888559c8c` (Render deployment
read verified); health returned 200 with sandbox/browser/demo features disabled.
No successful public metadata publication is claimed.

After separately approved push and deployment, fetch the exact HTTPS URL and
require successful JSON matching the reviewed local file. `--preview` performs
this check with redirects rejected; 404, HTML, malformed/drifted JSON or a network
failure all keep readiness false. Check homepage/favicon availability too.
Do not register against the unpublished URI simply because the registry accepts
any string; the registration file must actually resolve.

## Exact unsigned transaction and gas

`registration/unsigned-preview.json` contains the full, unabridged calldata and
snapshot. `registrationTransaction()` deterministically recreates it:

| Field | Reviewed value |
| --- | --- |
| From / initial NFT owner / default receiving wallet | `0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a` |
| To | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Chain | Celo mainnet, `42220` / `0xa4ec` |
| Function | `register(string)`; selector `0xf2c298be` |
| agentURI argument | `https://oyacheck-beta.onrender.com/agent-registration.json` |
| Native value | `0x0` (zero CELO transferred to registry) |
| Attribution | Schema 0, `celo_03e76ac742c7` |
| Successful read-only gas estimate | **181050 gas** for the exact tagged calldata |
| Observed gas price | **202500000000 wei/gas** (202.5 gwei) |
| Indicative execution cost | **36662625000000000 wei = 0.036662625 CELO** |
| Native balance checked | **0 CELO** |
| Signing/broadcast authorization | **false** |

The estimate was an `eth_estimateGas`, not a send or signature. The tag round-trips
through the official SDK; ABI decoding retains exactly the intended string.
Successful estimation also tests the registry's handling of the appended bytes.
Registration must use this tagged calldata, not an explorer's untagged generic
Write Contract form. Build with buy purchases have their own exemption; a direct
registry transaction is tagged.

The preview omits `feeCurrency`, so this workflow requires native CELO for fees.
It does not assume USDC/USDT holdings or a supported MetaMask stablecoin fee flow.
The observed amount is an execution-cost calculation, not a guaranteed maximum;
refresh the estimate, L1 data fee and fee buffer in MetaMask before approval.
A human must separately authorize any funding. No funding was done. No fixed
future funding amount is prescribed from this stale quote. Nonce, gas limit,
maxFeePerGas and priority fee must be refreshed during the actual human review.

## Human-controlled MetaMask workflow — future authorization only

No signing UI, wallet connection, provider send request or signer script was
added to OyaCheck. The backend CLI is read-only and explicitly rejects signing
and broadcast RPC methods. MetaMask remains the owner's signer.

After publication is verified, the ownership check is refreshed, gas is available
and the owner separately approves registration:

1. Open the owner's existing **MetaMask Extension** and select the exact supplied
   account and Celo mainnet (42220). Do not create/import a wallet for this task,
   export secrets, connect an unrelated wallet or upgrade/delegate the account.
2. Enable the Extension's documented **Settings → Transactions → Show hex data**
   option if needed. This manual hex-data workflow is documented for Extension;
   mobile support is not assumed.
3. Prepare a native CELO send to the registry above, amount **0**, and paste the
   **entire** `transaction.data` from the freshly regenerated, reviewed JSON into
   the hex-data field. It is executable ABI calldata, not a human-readable memo.
   If the installed UI cannot prepare a zero-value contract call with exact
   data, stop; use a separately reviewed MetaMask provider helper later instead.
   Do not remove the data or switch to an untagged explorer write operation.
4. Review the resulting contract interaction, sender, network, destination, zero
   value, full calldata and current fee details. Registration makes this sender
   the NFT owner and initial receiving wallet. Any changed URI/wallet/calldata
   requires a fresh preview and review.
5. **Confirm in MetaMask signs and normally broadcasts.** There is no separate
   harmless "sign-only preview" assumed. Do not click Confirm in this preparation
   session. With explicit transaction approval later, the owner alone confirms.
   Rejecting/cancelling is safe. A pending request or uncertain result must be
   inspected in Activity before considering any replacement; do not double-mint.
6. Retain the public transaction hash. No signature/secret belongs in the repo.
   A submitted hash or simulated return value is not yet an agent ID.

## Receipt verification, genuine ID and metadata update

The prepared command below is read-only; replace the argument only with the
actual future public transaction hash. Do not use test IDs as evidence:

```sh
node scripts/agent-registration.mjs --verify ACTUAL_TRANSACTION_HASH
```

It requires Celo mainnet, registry code, successful canonical finalized receipt,
matching sender/destination/zero value/tagged input, exactly one genuine registry
`Registered` event and matching ERC-721 mint `Transfer`. It obtains the ID from
the event, never the estimate's return value. It reads `ownerOf(id)`, `tokenURI(id)`
and `getAgentWallet(id)` at a finalized snapshot and requires the supplied wallet
and exact URI. Failed/pending/reorged/mismatched receipts stop verification.

The command emits evidence plus **proposedMetadata**, containing the actual ID
and `agentRegistry: eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
It writes no public file. Review that object, then separately authorize updating
`public/agent-registration.json` and publishing it at the same HTTPS URL. Do not
publish the CLI's entire output wrapper as the registration document. Refetch
public JSON and confirm the registration tuple matches chain reads. The stable
HTTPS agentURI stays unchanged, so no `setAgentURI` transaction is needed for
this update. An immutable URI would require a separate URI-change transaction.

Finally, the owner opens their actual Loops House entry, checks that the exact
wallet is associated with it and uses the organizer's current identity
verification flow with the genuine chain/registry/ID. Confirm the entry reflects
the verified identity and retain submission-safe public links/evidence. The entry
URL and authenticated verification state are still unknown; no undocumented
Loops API, specific button name, automatic eligibility or successful submission
is assumed. Identity alone does not meet mainnet paid-call/independent-user criteria.

## Read-only release and recovery

Financial/demo flags remain off, `OYACHECK_READ_ONLY=1`, auto deploy off, and no
purchase DB/account/payer is added. The public wallet in the Blueprint is not a
signing credential. The production/Render ledger and execution guards remain.
The existing free Render filesystem remains unsuitable for financial SQLite.

Publishing this candidate needs explicit push/deployment authorization. Keep
the existing live commit recorded above as rollback target, keep financial flags
off, and verify actual Dashboard settings and public disabled routes after any
future deployment/rollback. See `IDENTITY-AND-RELEASE-RC.md` for the full recovery
constraints. No deployment, rollback, publication or external mutation happened.

## Local commands and verification

```sh
npm run check
npm test
node test-explain.mjs
NODE_ENV=production OYACHECK_READ_ONLY=1 npm run release:check
node scripts/agent-registration.mjs --audit
npm run registration:preview
```

In this proxy-enabled environment, read-only network commands used Node 24 with
`NODE_USE_ENV_PROXY=1`. Standard direct-network environments need no proxy flag.
Node 22 operators should configure their network/proxy support appropriately;
the RPC or publication check failing never means permission to proceed.

Verification: **249 total, 246 passed, 3 skipped, 0 failed**. The nine new tests
cover tagged calldata, current-ownership scope and failed queries, denied signing
methods, published metadata gating, receipt/event/owner verification and proposed
actual-ID metadata. Stable HTTP route and disabled financial routes passed.
Syntax checks and the five `--no-ai` CLI examples passed. Release preflight passed
with the supplied public wallet and financial flags off. No live AI/provider,
wallet signing or financial tests were run. Default-suite skips are the existing
opt-in local Chromium tests; no browser behavior changed in this task.

**Single next owner action:** authorize pushing and deploying the reviewed local
release commit to publish `/agent-registration.json` with every financial flag
off. This task's explicit no-push/no-deploy instruction requires that separate
authorization. After publication, read-only HTTPS verification and refreshed
preview come before any separate funding or MetaMask registration approval.
