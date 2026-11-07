# OyaCheck identity and read-only release candidate

Verified 2026-11-07 on `fix/ai-reliability-mobile`, starting at
`79135e80bba4b9ff13a56787dbda146df6b533a5`. Deadline supplied by owner:
2026-11-09 09:00 GMT. Event code supplied by owner: `celo_03e76ac742c7`.
This document supplements MAINNET-RELEASE-PLAN.md and supersedes its production
activation assumptions. No financial action, registration, signing, funding,
broadcast, push, merge, deployment or submission is authorized by this document.

## Official sources and reconciliation

- [Celo ERC-8004](https://docs.celo.org/build/agents/8004): mainnet deployment,
  registration order, wallet ownership and receipt verification.
- [ERC-8004 specification](https://eips.ethereum.org/EIPS/eip-8004): registration
  JSON, identity tuple, optional domain proof and verified wallet semantics.
- [Registry implementation](https://github.com/erc-8004/erc-8004-contracts/blob/master/contracts/IdentityRegistryUpgradeable.sol):
  overloads, `Registered`, `ownerOf`, `tokenURI`, `getAgentWallet`, wallet reset on transfer.
- [Celo attribution instructions](https://docs.celo.org/build/agents/attribution-tags)
  and [official SDK](https://github.com/celo-org/attribution-tags/tree/main/sdk).
- [Loops rules and FAQ](https://www.loops.house/agents-on-open-rails): ERC-8004
  required for every track; Build with buy exemption; independent-user criteria.
- [Render disks](https://render.com/docs/disks) and
  [free-service limitations](https://render.com/docs/free).

Context7 was consulted for Celo and Render. Its Celo registration excerpt used
an older `type: Agent`/`endpoints` schema. The live Celo page and ERC specification
agree on `type: https://eips.ethereum.org/EIPS/eip-8004#registration-v1` and
`services`; the draft follows these primary sources. The standard remains draft.
The old EIPs `/EIPS/eip-8021` URL returned 404; use Celo's current SDK/reference.

## Read-only audit: facts and limits

| Item | Verified result |
| --- | --- |
| Public repository | GitHub API: `Alike001/oyacheck`, `private: false`, default branch `main`; local origin matches |
| Existing registration files | No matching registration/8004/8021/wallet paths in tracked baseline or the complete public `main` tree; public `/agent-registration.json` and `/.well-known/agent-registration.json` both 404 |
| Existing ERC-8004 identity | Unknown. No owner-supplied mainnet wallet, agent ID, registry receipt or registration URI. These file/path checks cannot prove absence of an identity elsewhere |
| Dedicated agent wallet | Unknown; `OYACHECK_AGENT_WALLET` unset. No wallet was created/imported. No mainnet wallet ownership claim |
| Local buy accounts | Read-only `buy account list`: only `sandbox`, Sepolia, public address `0x593d4667e0eaeD29A38763FC485513C45e5fa357` |
| Sandbox balance | `buy --sandbox whoami`: 0.973364 test USDC, 0 S-CELO; not mainnet funding or agent identity |
| Local mainnet configuration | `OYACHECK_BUY_ACCOUNT`, `OYACHECK_BUY_PAYER`, `OYACHECK_PURCHASE_DB`, prepare and execute flags unset; inspected presence only |
| Render service | `oyacheck-beta`, `srv-dbng37tg1s2s73ck2970`, free Node, Frankfurt, one instance; API response has no disk configuration |
| Production revision | Live deploy `dep-dbng9is9v7es73cmsig0`, commit `638e61fff3256a8dce74b6937dddc9a888559c8c`; branch `chore/public-beta-deployment`, auto deploy off |
| Production health | HTTP 200, v0.10.0; sandbox/browser/demo flags false, AI and transcription configuration true; no actual AI completion or quota verification |
| Production secrets/settings | Complete environment not requested. Existing health lacks newer mainnet flag. Mainnet configuration on that revision cannot be inferred from local files |
| Event entry URL / qualifying users | Unknown; issued event code does not establish identity registration, entry URL or independent users |

The current free Render service cannot attach a persistent disk. Default storage,
including an absolute SQLite path, is ephemeral across restarts, redeploys and
idle spin-down. SQLite WAL/FULL protects transactions on its filesystem; it does
not turn ephemeral storage into durable storage. No production ledger is enabled.

## Accurate metadata and dedicated wallet path

`docs/agent-registration.draft.json` is a local, unpublished pre-registration
draft. Its web and favicon endpoints exist on the current beta. It advertises no
MCP/A2A endpoint, independent validation, reputation, TEE or guaranteed safety.
`x402Support: false` means OyaCheck does not accept x402 payments; being a buy
client does not make it a paid x402 resource server. `active: true` describes the
existing reachable web service, not a claim of registered identity or live spending.
Empty `registrations` intentionally means incomplete; never submit it as proof
of a registered agent. Do not invent an ID to fill it.

`.env.example` documents `OYACHECK_AGENT_WALLET`, left empty until the owner supplies
a public address. `lib/agent-identity.mjs` validates a nonzero public EVM address;
configuration never marks ownership/registration verified. `release:check` reads
only this public configuration. The variable is not automatically a buy payer,
NFT owner or registry receiving wallet. Record each role separately and verify
it against the entry and chain before connecting financial authority.

Keep signing in an owner-controlled external wallet or existing backend buy
account. No key/seed/browser import field, signer endpoint or signing script was
added. Do not request wallet exports or commit buy account stores. The example is
public-only; ledger files and `.env` are ignored. Shell environment exports must
be deliberate; the application does not automatically load the example file.

## ERC-8004 registration and verification procedure (future approval only)

1. Owner supplies public agent wallet, intended NFT owner and any existing agent
   ID/registration hash/URI plus event entry URL. Check existing identity before
   proposing a new mint. Public addresses alone do not prove control.
2. On a trusted read-only Celo RPC, verify `eth_chainId` is `0xa4ec` (42220), and
   `eth_getCode` at `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` is nonempty.
   Recheck that address and ABI against the current official deployment.
3. If an ID exists, use `ownerOf(id)`, `tokenURI(id)` and `getAgentWallet(id)` via
   `eth_call`. Compare the exact NFT owner, receiving wallet and metadata. Search
   registry `Registered` and ERC-721 `Transfer` logs for the supplied owner, using
   bounded/paginated ranges or explorer indexing. Include transfers into the owner;
   registration logs alone miss acquired identities. Balance zero does not rule
   out a different receiving wallet. Confirm any candidate's current owner/URI.
4. Review the draft with the owner. Select an owner-controlled HTTPS metadata URI
   (or IPFS); publishing requires separate approval. It must return valid JSON
   without authentication, and the advertised web/image URLs must resolve.
   Keep the registration list empty/omitted for the initial mint; the ID is not
   known until mining. Never use a simulation's predicted token ID as fact.
5. Present a concrete registration request for approval: chain 42220, registry,
   exact `register(string)` ABI calldata and agentURI, NFT owner/sender, zero
   native value, bounded estimated gas/fee and event tag. Registration mints to
   `msg.sender` and initializes `agentWallet` to that sender. Decide ownership
   before signing. No registration command is included or run in this candidate.
6. Only after separate explicit approval, an owner-controlled signer would send
   that transaction, with `tagDirectCalldata(encodedRegisterCall)` appended before
   simulation and signing. Verify trailing calldata compatibility for the exact
   registry/wallet path; don't assume arbitrary contracts ignore trailing data.
7. Read the successful receipt on Celo mainnet, confirm its destination and
   sender, and decode **that registry's** `Registered(agentId, agentURI, owner)`
   plus mint `Transfer` event. Record actual hash, block and finality. Verify the
   transaction input ends in our issued code using the official SDK decoder.
8. Read `ownerOf`, `tokenURI`, `getAgentWallet` again. Add the actual ID and
   `agentRegistry: eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
   to the public metadata. Updating a stable HTTPS file needs publication approval;
   an immutable IPFS/data URI changes and requires a separately approved tagged
   `setAgentURI` transaction. Verify the final URI resolves to the matching tuple.
9. Optional domain proof: publish `/.well-known/agent-registration.json` containing
   the same registrations when endpoint and primary metadata domains differ.
   This is not an MCP/A2A agent card. The spec does not require it when the
   primary registration URI already proves the same endpoint domain.
10. If the intended receiving wallet differs, `setAgentWallet` requires new-wallet
    EIP-712/ERC-1271 proof and owner/operator authority, under separate signing
    approval. Editing JSON or `setMetadata('agentWallet',...)` does not establish
    that binding. Transferring the NFT clears the verified wallet. Retain a public
    evidence bundle; explorer indexing alone is not ownership verification.

## Event ERC-8021 integration and exact exemption

`lib/attribution.mjs` uses pinned `@celo/attribution-tags` 0.5.0. It encodes the
issued code directly, never derives a replacement from the hostname and never
claims platform codes. `tagDirectCalldata` is an offline preparation helper:
append it to encoded direct contract calldata or use its suffix for a plain
value transfer. It preserves an existing matching tag and rejects an unrelated
existing tag for explicit review. No direct transaction sender currently exists
in OyaCheck, so there is no live send site to wire or transaction to manufacture.
Use this helper for any future approved direct registration, URI update or other
wallet-controlled transaction, then decode actual chain input to verify it.
Bundlers/relayers can alter calldata; verify the final transaction/user operation.

Loops' specific **How is Build with buy judged?** answer says: **No attribution
tag needed here.** It requires useful verified paid calls from the entry's wallet
into independent services, proof of payment, and independent users. General
transaction tagging rules still apply to direct transactions under our control.
For x402, the organizer asks for PayTo addresses; record the provider's actual
recipient alongside OyaCheck's payer without mislabeling OyaCheck as the provider.

The buy adapter delegates x402 v1 signing/settlement to buy and its facilitator.
Do not append bytes to HTTP JSON/payment headers, alter signed authorizations,
add an unsupported CLI flag or create a separate transaction to fake attribution.
Current Celo guidance says facilitator Schema 2 attribution is not live; the
future `builder-code` extension is v2-only. This pilot intentionally accepts v1.
The exemption does not waive mainnet, identity, entry-wallet or useful-service
proof requirements. Historical sandbox receipts remain testnet evidence only.

## Read-only release, verification and rollback

`render.yaml` keeps the free service, auto deploy off, all four financial/demo
flags at zero and `OYACHECK_READ_ONLY=1`. It adds offline `release:check` after
syntax/tests. No database path or signer/account is configured by the Blueprint.
The policy blocks mainnet preparation, sandbox purchases and mainnet execution
in production, on Render, or with the read-only flag. MainnetStore refuses even
to create a ledger there, regardless of flags or an apparently absolute path.
This candidate intentionally cannot enable hosted spending by changing flags.
A future durable hosted pilot needs reviewed code and operations, not an env flip.

Tests run in a process explicitly marked `NODE_ENV=test`, `RENDER=false`,
`OYACHECK_READ_ONLY=0` so Render build variables cannot prevent isolated fake-ledger
tests. They do not change the web process environment. The release preflight
runs afterward in the actual build environment and fails on enabled feature
flags or a configured purchase database. Missing agent wallet is reported unknown
and does not block the nonfinancial beta. It does block identity/financial claims.

Before any later approved release: review the exact local commit and diff, obtain
push and deployment approval separately, keep auto deploy off, compare actual
Dashboard non-secret flags with the Blueprint, and use Node >=22.13 <25. After
release verify health and deterministic analyze; confirm `/api/mainnet/session`
and buy quote/inspect routes return 403, demo off, and no ledger configured. Do
not use a real paid quote, rental or AI completion as a deployment smoke test.

Rollback (requires separate deployment approval): keep financial flags off and
redeploy recorded baseline `638e61fff3256a8dce74b6937dddc9a888559c8c` using Render's
manual deploy/rollback UI. Verify `/api/health` and disabled routes again. Render
rollback does not guarantee environment-variable rollback: inspect flags manually.
Do not delete or replace a future purchase ledger to roll application code back.
If any purchase was ever attempted, stop execution and preserve the ledger plus
WAL/SHM and receipts; reconcile the original transaction, never repurchase.

Before later financial authorization: demonstrate single-host durable storage,
restart/redeploy reservation retention, SQLite-native consistent backups and an
off-host restore drill, operator ownership/access, handling of lost cookies and
stale attempts, receipt reconciliation and no-retry response. Recovery must
retain every irreversible payer reservation, including attempts after the backup;
an old backup must never restore spending allowance. Current paid-disk deployment,
backup/restore and operational acceptance are **not verified**. Multi-host SQLite,
public purchase authorization and live provider recovery remain unsupported.

## Results and next human decision

See the final verification record below. No external mutation or financial test
is part of validation. Next owner input: supply the public wallet and any existing
ERC-8004/entry evidence for read-only verification. Next action needing approval:
publish reviewed metadata and, only if no suitable identity exists, approve the
exact registration transaction described above. Push/deployment are separate
approvals; a paid mainnet service call needs its own bounded purchase approval.

### Final local verification record

- `npm ci --include=dev --ignore-scripts`: passed, 11 packages installed;
  `npm audit --omit=dev`: zero vulnerabilities.
- `npm run check`: passed. Metadata JSON and all three browser-verifier scripts
  also passed parse/syntax checks; `git diff --check` passed.
- `npm test`: **240 total, 237 passed, 3 skipped, 0 failed** after clean install.
  The same suite passed under production/Render build variables. New regression
  coverage proves forced flags cannot enable hosted purchases or create SQLite,
  checks public wallet unknown/invalid states and the official event suffix.
- `node test-explain.mjs`: **5/5 passed**, uses `--no-ai` only.
- `OYACHECK_RUN_LIVE_DEMO=1 npm run demo:live`: initial default Chrome run failed
  all three screenshot captures with `Page.captureScreenshot timed out`. With a
  temporary local `CHROMIUM_PATH` wrapper invoking `/usr/bin/google-chrome
  --disable-gpu "$@"`, all **3 passed, 0 skipped, 0 failed**. No browser code was
  changed; default GPU capture remains an environment limitation.
- Real Playwright ran `scripts/verify-mainnet-browser.mjs` on two fresh financial
  fake fixtures: success/partial outcomes, unavailable/funds failures, cancel,
  expiry, request, reload recovery and 320/360/390/412/768 widths passed. One
  fake financial call per outcome; zero real financial calls and no retries.
- Real Playwright ran `scripts/verify-buy-browser.mjs` against the local production
  process with intercepted buy responses: cancel/Escape, invalid/expired quotes,
  deterministic finding, success/failure receipt links passed; two mock
  inspection requests, zero real purchases, zero automatic retries.
- Production-style local smoke: `/api/health` 200, deterministic `/api/analyze`
  200 with known-phishing finding; mainnet session, buy quote/inspect and demo
  inspect all 403. Local test process had no Groq key. `release:check` passed
  with production/read-only/off flags and unknown wallet; deliberately enabling
  execute made it exit nonzero. No ledger was opened by preflight.
- No real Groq/voice completion, paid service, wallet mutation, signing,
  transaction, funding, registry mutation, public publication, deployment,
  push, merge or hackathon submission occurred.
