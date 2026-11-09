# First registration: read-only recovery evidence

Observed on 2026-11-07. **PENDING finality; mined success independently confirmed
with high confidence.** No new wallet request, signing, broadcast, nonce change,
reservation reset, push or deployment was performed during this recovery.
The local server at http://127.0.0.1:4188/ was restarted in recovery-only mode;
`/policy` returns `sendingEnabled:false`. The reservation remains immutable.

## Preserved attempt and exact lifecycle

- `.oyacheck/registration-attempt.json` was created at
  **2026-11-07T17:29:51.419Z**, with the approved exact transaction and fingerprint
  `sha256:c895acd4673689be17df6f78ed427d53b7c88450be472abb736b7da1fd2cf253`.
- Its SHA-256 is
  `29fe8e0fc0d73f36f93144d8cfd9fdd48e6857abb695b6dc2bce96f9ca2c9ff8`.
- `.oyacheck/registration-attempt.json.tx` filesystem modification time is
  **2026-11-07T17:30:05.849371348Z**. It stores the public transaction hash
  `0x56b7126b6040de24af3d78017e913aac6ff749ba05878e4776a1437e314de74c`.
  Its SHA-256 is
  `4d6a9ff39d1fdb74878c6abe84f41ab5534d77f5a153ccd35a9b8581c33a72cb`.
  The hash file has no separate application timestamp. Both files remain mode
  0600 and were neither edited nor released.
- The backend validates the reviewed plan, repeats RPC checks, then creates the
  exclusive journal with `wx` and fsync before returning the claim response.
- The browser checks that claim response, rechecks `eth_chainId`/`eth_accounts`,
  rechecks review freshness, and only then invokes its single
  `eth_sendTransaction`. Thus **reserved=true can precede any wallet call**.
  Expiry, account/chain change, failed claim response or RPC can stop after
  reservation without invoking the wallet. Reservation alone proves no send.
- A returned wallet hash is sent to `/attach-hash`, which exclusively creates
  the immutable companion. The recovery form can also attach a known public
  hash through this route. Therefore the companion cannot independently prove
  which browser attachment path was used.
- No provider-call/error timestamps or access logs were implemented. The live
  server's available output contained its startup message, without request or
  upstream error records. The connected automation browser contained no owner
  registration tab or relevant console error. The exact historical MetaMask
  invocation/return/error sequence cannot be recovered from this telemetry.
  The real signed mainnet transaction is independently established below;
  it is consistent with the expected MetaMask path, but that path is not logged.

Raw public RPC responses and the original journal hashes are retained locally
in `.oyacheck/registration-forensic-evidence.json` (ignored, mode 0600). This file
includes both RPC receipts, event logs, exact transaction, snapshot blocks,
nonce reads, state reads and provisional fee evidence. It is not a replacement
journal or authorization. No transaction ID was invented.

## Mainnet evidence

Read-only `https://forno.celo.org` and independent `https://celo.drpc.org` both
returned chain ID `0xa4ec` and the same successful receipt for the recorded hash.

| Evidence | Result |
| --- | --- |
| Receipt status | `0x1`, mined successfully |
| Transaction block | 82171849 / `0x4e5d7c9` |
| Canonical block hash, both RPC receipts | `0x4e0adac3ea25a8d53083a7a1e419872cf29b2d392808112ef6769c53d9492dbe` |
| Block timestamp | 2026-11-07T17:30:07Z |
| Sender | `0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a` |
| Recipient | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Value / nonce | 0 CELO / 0 |
| Function and URI | `register(string)`, `https://oyacheck-beta.onrender.com/agent-registration.json` |
| Decoded ERC-8021 attribution | `celo_03e76ac742c7`, schema 0 |
| Journal request comparison | All request fields including gas and fee caps match |
| Actual Registered event agentId | **10051** |
| Registered owner | Exact approved wallet |
| Owner-filtered Registered logs | One matching event from receipt block through snapshot latest block |
| Latest/pending account nonce | 1 / 1 |
| Finalized account nonce | 0 at the lagging finalized snapshot |
| Latest currently owned identities | 1 |
| Finalized currently owned identities | 0 at the lagging finalized snapshot |
| Latest balance | 0.323860635 CELO |
| Gas used / effective gas price | 178466 / 202.5 gwei |
| Receipt L1 fee / queried operator fee | 0 / 0 wei |
| Settled gas cost | **0.036139365 CELO**, below 0.08744715 CELO |

Direct `ownerOf(10051)`, `tokenURI(10051)` and `getAgentWallet(10051)` reads at
both receipt block and latest returned the approved owner/wallet and exact URI.
The receipt block was independently fetched and canonical on the first RPC.
Latest account nonce 1 and this nonce-0 transaction account for its confirmed
outgoing nonce sequence at that snapshot. Pending nonce is not exhaustive proof
of every node's mempool. No second transaction or registration was attempted.

[Actual Celo explorer transaction](https://celoscan.io/tx/0x56b7126b6040de24af3d78017e913aac6ff749ba05878e4776a1437e314de74c).
The evidence above comes from RPC responses, not an assumed explorer result.

The evidence snapshot's latest block was 82172246 / `0x4e5d956`, but both RPCs'
finalized block was only 82170567 / `0x4e5d2c7`, **before** this transaction.
Finalized ownership zero is therefore expected and does not contradict latest
ownership one. The existing strict verifier returns `pending-finality` and
will not downgrade its finality requirement. There is no fully finalized
CONFIRMED_SUCCESS claim at this checkpoint. CONFIRMED_FAILURE and
NOT_SENT_WITH_STRONG_EVIDENCE are contradicted by the mined successful receipt.

## Recovery uncertainty and safe diagnostic fix

Verified defects: `/verify` previously sent every thrown verification error
through the generic server catch, hiding its cause; the browser then replaced
the entire reservation JSON (including hash) with that error text. Thus the
screenshot's missing visible hash was not evidence of a missing stored hash.

The route now preserves the original hash and specific bounded read-only error
in its response. The page keeps the recorded hash in a separate persistent
field, even when receipt checks fail. This changes diagnostics only; no
reservation, send policy, validation or retry behavior was changed.

The original error's exact upstream cause is **unknown** because it was neither
returned nor logged. A transient RPC failure or verification race is possible,
but not proven. Current calls succeed and return pending finality. The journal
is valid, its fingerprint matches and mined transaction fields match. No
corruption, expired-preview failure, wallet mismatch or duplicate-send evidence
was found. Normal finality lag yields a pending result, not the generic error;
it alone cannot explain that original message. No private browser wallet
state or MetaMask Activity history was available to prove more.

## Verification and next action

- `npm test`: **281 total, 278 passed, 3 skipped, 0 failed**.
- Focused registration suites: **41 passed, 0 failed**.
- `npm run check` and `git diff --check`: passed.
- New regression tests preserve hash/reservation on RPC 503 and pending finality.
- Real Chromium: a mocked `/verify` RPC 503 leaves the real recorded hash visible,
  displays the precise diagnostic, and keeps Stage 1, Stage 2 and send disabled.
  All browser network mutations were blocked: zero mutations and zero wallet
  requests. Screenshot: `.playwright-mcp/recovery-hash-visible.png` (ignored).
- Journal hashes were checked again after recovery; unchanged.

**Single next safe owner action:** wait for finality, then use **Check receipt ·
read-only** for the existing hash at http://127.0.0.1:4188/. Never register again.
If RPC remains unavailable or finality does not advance, retain the journal and
reconcile this same hash using independent read-only sources.

After finalized verification, the existing CLI can prepare unpublished metadata
using the genuine event ID 10051 and registry
`eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
Do not treat provisional state as finalized evidence or publish an update from
this checkpoint. No metadata, Loops House verification or submission was changed.
