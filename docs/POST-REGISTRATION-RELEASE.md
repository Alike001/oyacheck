# Registered identity, metadata candidate and Build with buy readiness

Current status: [finalized identity and buy payer readiness](FINAL-IDENTITY-AND-BUY-READINESS.md).
Forno and Stakely now verify finality, and the owner confirms Loops House CELO ALL SET.
Pending observations below are historical snapshots retained as evidence.

This is a local read-only release candidate, prepared 2026-11-07. No new
registration, signing, broadcasting, spending, push, deployment or submission
was performed. The original one-attempt journal and hash companion are intact.
The earlier [recovery report](REGISTRATION-RECOVERY-FORENSICS.md) remains history.

## Registration evidence and exact finality status

[Machine-readable evidence](registration/registration-evidence.json) records
fresh RPC receipts, transaction fields, decoded event/input, mint, latest state,
canonical receipt block, fee evidence and explicit **finalized** head reads.
At **2026-11-07T17:48:31.645Z**, Forno, Stakely and 1RPC all reported:

- Receipt block **82171849**, `0x4e5d7c9`, successful status `0x1`.
- Canonical receipt block hash
  `0x4e0adac3ea25a8d53083a7a1e419872cf29b2d392808112ef6769c53d9492dbe`.
- Finalized head `0x4e5d5d4`, **below the receipt block**. Status remains
  **PENDING FINALITY; mined success confirmed**, not finalized success.
- Genuine `Registered` event and matching mint for agent **10051**.
- Exact sender/owner/agent wallet
  `0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a`.
- Registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, chain **42220**.
- `register(string)` input URI
  `https://oyacheck-beta.onrender.com/agent-registration.json`, zero native value,
  attribution `celo_03e76ac742c7` (ERC-8021 schema 0).
- Latest `ownerOf`, `tokenURI`, `getAgentWallet` match on all three endpoints.
- Gas used **178466**, effective gas price **202.5 gwei**, L1 fee and queried
  operator fee **0**. Total **0.036139365 CELO**, below **0.08744715 CELO**.

[Actual transaction](https://celoscan.io/tx/0x56b7126b6040de24af3d78017e913aac6ff749ba05878e4776a1437e314de74c).
The calldata byte fingerprint is
`sha256:3219716913a962aec107b29b62ebc6bdd8d037ffd79ea3c04b08a89f2227df01`.

Provider caveats are preserved: dRPC returned HTTP 400 / method unavailable for
receipt/finalized queries; PublicNode returned a much older finalized head.
An earlier single Stakely read returned `0x4e5d869` above the transaction, then
its full recheck returned the lower head above. That inconsistency cannot
establish finality. No latest or safe head was substituted for finalized.
A final recheck at **2026-11-07T17:51:05.383Z** failed with `fetch failed` on
both Forno and 1RPC. It supplies no newer finality evidence. The earlier
successful pending-finality observations are retained rather than overwritten.

For later permanent finalized evidence, repeat the existing read-only receipt
verification against at least two working endpoints, require both finalized
heads at/above the canonical receipt block and full verification to pass, then
record those snapshots. Do not register again. Safe local preparation below
uses the real mined event ID and does not claim finality.

## Ready-to-publish metadata and smallest safe release

Only the `registrations` array in `public/agent-registration.json` changed:

```json
[{"agentId":10051,"agentRegistry":"eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"}]
```

Description, public web endpoint, image, active status and `x402Support:false`
remain unchanged. No MCP, A2A or paid receiving capability is advertised. The
onchain tokenURI stays the same; publishing JSON at that URI requires no new
onchain registration or update transaction.

The real application served this exact JSON locally with HTTP 200 and JSON
content type. Under production/read-only settings, mainnet session, sandbox
quote/inspection and demo inspection routes returned **403**. The release
preflight passed with the public agent wallet configured, all four financial/
demo flags zero, and purchase database unset. Its `registration:unverified`
output is deliberately an offline preflight result, not a chain-verification
claim; the evidence file supplies current chain observations.

The live HTTPS metadata still has an empty registrations array: publication
remains outstanding. The previous essential recovery diagnostics are in parent
commit `8fbe910`; the current change adds metadata, evidence and regression
assertions without changing financial execution code or flags.

For a separately authorized publication: review the exact candidate commit;
recheck finality; push only with approval; identify the actual Render-linked
branch and exact-commit deployment method. Stop if a protected-branch merge is
needed without its own approval. Keep auto-deploy off, read-only mode on,
`BUY_BROWSER_SANDBOX`, `OYACHECK_DEMO_BROWSER`, `OYACHECK_MAINNET_PREPARE` and
`OYACHECK_MAINNET_EXECUTE` at **0**, and purchase DB unset. After deployment,
verify public HTTP 200/JSON, identity fields and financial 403 responses again.
Free Render has no approved durable spending store and must remain read-only.

Rollback: redeploy the previously owner-confirmed Render commit
`4a1ab5bd57d4f2c7c8aa75f8a79e2b6d045b9b81`, preserving financial flags at zero,
then recheck metadata/health/403 responses. Rollback changes hosted files; it
cannot unregister the real identity. Never delete or roll back the local
registration journal or any future financial ledger. No release action was
performed here.

## Loops House owner verification, without another transaction

Onchain attribution is verifiable from the existing registration input. The
[official event page](https://www.loops.house/agents-on-open-rails) requires the
agent wallet and identity on the entry. Its Build with buy FAQ exempts purchases
from attribution tags. This exemption does not remove the wallet/identity
requirement and is not evidence that the entry's controls passed.

The owner's authenticated entry URL and verification result were not available;
no entry was edited and no verification control was invoked. Using the controls
named by the owner:

1. Open the actual existing event entry while signed in. Confirm the recorded
   wallet is the exact address above and its issued tag is `celo_03e76ac742c7`.
2. Use **Verify Tag** for that entry. If it requests a transaction hash, supply
   the existing `0x56b7126b6040de24af3d78017e913aac6ff749ba05878e4776a1437e314de74c`.
   Preserve the actual result and observation time. If indexing/finality is
   pending, wait and recheck this same transaction; never create a new one.
3. Use **Check on Celo** for chain 42220, registry above and real agent ID 10051,
   following whatever fields that actual control presents. Compare its result
   with ownerOf/tokenURI/getAgentWallet and the explorer evidence.
4. After approved metadata publication, verify the stable public URI contains
   the real registrations array. Save actual control output or screenshots;
   do not infer green status from our local evidence. No final submission here.

## Remaining Build with buy blockers and shortest bounded route

Current official rules judge useful, verified paid service calls into services
outside the builder's control; independent users are a qualifier. Cheapest-call
spam does not satisfy the stated judging criteria. Mainnet payment evidence is
needed; historical Sepolia receipts and this ERC-8004 registration are not such
service-call evidence. See the [organizer FAQ](https://www.loops.house/agents-on-open-rails).

A fresh free catalog GET and **unpaid, unsigned** POST of `{"durationMinutes":1}`
to `https://gateway.usebuy.ai/v1/browser/sessions` returned **402**. The existing
`parseMainnetOffer` validator accepted its offer: **3606 atomic USDC = 0.003606
USDC**, chain 42220, USDC contract
`0xceba9300f2b948710d2653dd7b07f33a8b32118c`, recipient
`0x20faAca5F980E29639A0FCC6dcA6988E18ed333B`. This is an observation, not a
standing approved price. No paid authorization/header or `buy curl` was used.
The catalog identifies `buy-browser-worker`, agent 9894, as the browser provider;
it is a distinct service identity, not OyaCheck's agent ID.

The shortest useful path already implemented is one externally rented browser
refresh of the exact published NCC advisory referenced by a deterministic
OyaCheck report. Retain final URL/title/text, hostname match, time, snapshot and
hash, and independently reconcile the genuine payment. This does not browse the
suspicious submitted site or establish a new safety verdict. Browser session
commands use the returned secret credential server-side; never publish it.
See the [official gateway contract](https://github.com/celo-org/buy-skill/blob/main/skills/use-api-gateway/SKILL.md).

Current blockers, freshly checked:

- `buy account list` exposes only the existing **sandbox / Sepolia** account.
  No existing mainnet named account is available to the adapter. MetaMask
  registration does not connect MetaMask to buy. The adapter calls a named buy
  account; it has no MetaMask payment-provider integration. Identify a supported
  secure connection for the registered payer without exporting its private key
  or seed. Do not install a fallback signer or silently use a different payer.
- Read-only calls show **0 USDC, 0 USDT and 0 USAT** on the registered wallet.
  CELO is not the quoted stablecoin. A separately approved owner funding step
  would be needed before payment; no funding or conversion was done here.
- Mainnet account/payer and purchase DB are unset in the inspected local command
  environment. Select an actual durable private operator-host ledger path and
  verify restart/recovery operations before enabling anything. Free Render's
  ephemeral storage cannot host spending reservations. Preserve the separate
  ERC-8004 journal permanently; it is not a purchase allowance.
- Keep execution zero. Once wallet/funds/storage are verified under separate
  authorization, enable only free local preparation, obtain the exact fresh
  plan ID/fingerprint/token/amount/payer/recipient/source and review it with
  `scripts/mainnet-pilot.mjs --show ID`. The prior release plan documents the
  narrowly scoped future approval text. No approval or execute command here.
- A separately approved single purchase must durably reserve one attempt before
  payment, stop on ambiguity, and reconcile original receipts without retry.
  No genuine mainnet paid browser result exists for this adapter yet.
- Independent-user evidence, real usefulness and the owner's Loops verification
  results remain outstanding. Do not fabricate another user or assume one
  paid call alone completes eligibility.

## Checks

- Full suite: **281 total, 278 passed, 3 skipped, 0 failed**.
- Focused identity/registration/mainnet suites: **71 passed, 0 failed**.
- Syntax checks, production read-only release preflight and whitespace checks passed.
- Local real HTTP: metadata 200; `/api/mainnet/session`, `/api/buy/quote`,
  `/api/buy/inspect`, `/api/demo/inspect` all 403 under production settings.
- Original reservation and hash-file SHA-256 values match the recovery report.
