# Final human-controlled ERC-8004 registration checkpoint

Historical locked checkpoint. The owner subsequently authorized one exact
human-triggered request; see [current execution authorization](REGISTRATION-EXECUTION-AUTHORIZATION.md).
The locked-state instructions below describe the earlier checkpoint.

Local URL: **http://127.0.0.1:4188/**. Start with `npm run registration:review`
(or `NODE_USE_ENV_PROXY=1 npm run registration:review` in this Node 24 proxy
environment). The dedicated server binds only to loopback. Nothing in this
checkpoint was pushed or deployed. No real MetaMask permission, signing request,
broadcast, registration, funding or spending was performed.

## Field summary and fresh evidence

`docs/registration/unsigned-preview.json` was refreshed at
**2026-11-07T16:14:17.023Z** using read-only Celo RPC and the public HTTPS metadata.
It contains every unsigned transaction byte and fee field, with no signature.

| Field | Reviewed value |
| --- | --- |
| Network | Celo mainnet, 42220 / `0xa4ec` |
| Sender | `0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a` |
| Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Function | `register(string agentURI)`, selector `0xf2c298be` |
| Metadata | `https://oyacheck-beta.onrender.com/agent-registration.json` |
| Native value | **0 CELO** |
| Attribution | `celo_03e76ac742c7`, verified ERC-8021 suffix |
| Metadata response | **HTTP 200**, JSON matches reviewed document, `x402Support:false` |
| Latest native balance | **0.360 CELO** |
| Currently owned identities | **0**, both checked finalized and latest snapshots |
| Estimated gas | **181050** |
| Current gas price | **202.5 gwei** |
| Indicative execution fee | **0.036662625 CELO** |
| Buffered gas limit | **217260**, `0x350ac` |
| Max fee / priority fee | **402.5 / 2.5 gwei** |
| Maximum execution gas cost | **0.08744715 CELO** |
| Queried L1 upper bound / operator fee | **0 / 0 wei** |
| Planning reserve, including those bounds | **0.08744715 CELO** |
| Sending | **locked** |

Full calldata fingerprint (SHA-256 of the raw calldata bytes):

```text
sha256:3219716913a962aec107b29b62ebc6bdd8d037ffd79ea3c04b08a89f2227df01
```

Exact request fingerprint (SHA-256 of JSON with lexically sorted transaction
keys, including sender, chain, recipient, value, data, gas and fee caps):

```text
sha256:c895acd4673689be17df6f78ed427d53b7c88450be472abb736b7da1fd2cf253
```

The gas buffer is 20%; max fee is the greater of twice the current base fee plus
RPC priority fee, or RPC gas price. The existing read-only GasPriceOracle bounds
are included. This is a time-bound planning reserve, not a promise about future
network conditions. Stage 2 regenerates it. The latest balance covers it; the
JSON separately labels finalized state, which can lag recent funding. An
ERC-721 ownership count does not rule out historical or differently owned
identities. No ID is inferred from a simulated return value.

## Two human reviews and the checkpoint lock

1. **Stage 1:** select MetaMask, inspect every field, and check the initial review
   statement. Only a human click can request account access. Network is checked
   first; only the exact single wallet on chain 42220 is accepted. No network
   switch or account popup happens automatically. No keys or seed are requested.
2. Click **Re-estimate and prepare final review**. The server fetches published
   metadata and current ownership/balance, simulates the exact tagged call and
   re-estimates fees. Malformed/drifted metadata, any RPC failure, existing owned
   identity, mismatched call or insufficient balance blocks final review.
3. **Stage 2:** inspect the newly displayed full request, calldata fingerprint,
   transaction fingerprint and maximum gas cost; explicitly check the second
   statement. This review expires after **60 seconds**. Network/account changes
   invalidate it. Refreshing also clears approval.
4. The **Request one MetaMask confirmation** control remains disabled in this
   checkpoint, even after both reviews. The browser controller rejects before
   any wallet call, and the backend `/claim` route independently returns 403.
   A DOM change or guessed endpoint cannot bypass the backend lock.

The exact unsigned request intentionally leaves nonce selection to MetaMask;
the owner reviews it at confirmation. No access/authorization list is requested.

The actual CLI entry point calls
`createReviewServer({sendingEnabled:false})`. There is **no environment flag**
that enables this checkpoint. The public beta and all purchase flags are
unchanged. Production/Render/read-only environments also reject future claim
activation. The browser has one isolated `eth_sendTransaction` path for the
future approved state; no batch call, transfer, wallet_sendTransaction, signing
API, relayer, third-party registration site or fallback spend path exists.

## What must be approved before enabling sending

The owner must explicitly authorize a reviewed local change enabling **one**
registration request from the exact wallet on chain 42220, to this registry,
using this metadata URI and tagged calldata, with the freshly reviewed request
fingerprint and native gas/fee limits. The request above is a concrete candidate;
if its fees/fingerprint change, review and approve the new values. This is
separate from account connection and from this preparation checkpoint.

After that authorization and local code change, a deliberate Stage 2 button
click can request **one MetaMask transaction confirmation**. The owner alone
confirms there; confirming normally signs and broadcasts. Account authorization
is already handled in Stage 1, so submission does not open an additional account
permission prompt. Nothing automatically submits when the policy changes.

Immediately before any future wallet request, the server rechecks current
metadata/ownership/balance/simulation/fees and requires the same exact request
fingerprint. A fee change forces a fresh two-stage review. The connected wallet
and chain are checked again after the durable claim and before the wallet call.

## One-use reservation and recovery

The future claim creates `.oyacheck/registration-attempt.json` with exclusive
creation, restrictive permissions and fsync, **before** the wallet request.
The public transaction hash is recorded once in an immutable `.tx` companion.
These files are ignored by Git and contain no secrets. Reloading, another tab,
a second process or duplicate clicks cannot reserve another attempt at the same
journal path. Keep this path and its parent filesystem durable and use the same
working directory across restarts. This is a single-host local operator flow,
not public or distributed purchase infrastructure.

Any wallet rejection, already-pending request, unknown error, missing hash or
failed hash persistence leaves the allowance reserved. There is no reset or retry
endpoint. A timeout while claiming is also ambiguous: inspect recovery before
considering further action. Never delete the journal to escape an uncertain
result, never switch working directories to create a new allowance, and do not
manually submit another registration. A corrupt journal fails closed and needs
operator-assisted reconciliation.

On reload, the page reads the existing attempt and displays **recovery only**.
If MetaMask returned no hash, obtain the original public hash from its Activity
view, then record it in the recovery form. A recorded hash cannot be replaced.
The receipt button polls only that hash, at most six times five seconds apart.
Pending or not-yet-finalized receipts remain pending. RPC/verification errors
stop polling; they do not cause another wallet request. Manual receipt checks
are read-only and never re-register.

Successful verification requires the actual canonical finalized receipt, the
registry's genuine `Registered` event and mint Transfer, `ownerOf`, `tokenURI`
and `getAgentWallet`, the exact sender/destination/value/tagged input, and the
reviewed gas limit and fee caps. A pending, failed or mismatched transaction
stays reserved for review. The genuine event provides the ID, never simulation.

For later metadata publication, the existing read-only CLI remains available:

```sh
node scripts/agent-registration.mjs --verify ACTUAL_PUBLIC_TRANSACTION_HASH
```

Its evidence/proposedMetadata can then be reviewed with the actual ID and
`eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`. Updating the stable
HTTPS JSON and checking the owner's real Loops House entry require their
separate authorized steps. No ID, entry URL, Loops verification success or final
submission was invented or performed.

## Validation

- Focused registration, final-action and recovery tests: **29 passed, 0 failed**.
  Full suite: **269 total, 266 passed, 3 skipped, 0 failed**. Syntax and whitespace
  checks passed. All wallet providers and journal mutations in those tests are
  mocks or isolated temporary files, never the owner's wallet or live journal.
- Real Chromium with a mock wallet and fake read-only preview exercised both
  review stages, zero automatic wallet requests, the disabled send control,
  fingerprints and layouts at 320/360/390/412/768px. A connected wallet string
  initially caused overflow; it now wraps correctly. No real wallet permission
  or transaction method was requested.
- The real local backend reports sending disabled, and claiming is denied before
  any journal reservation. The one permitted future submission call is tested
  only against injected mock providers.
- Sources: [MetaMask transaction/error guidance](https://docs.metamask.io/metamask-connect/evm/guides/send-transactions/),
  [Celo ERC-8004](https://docs.celo.org/build/agents/8004), and the existing
  [Celo attribution instructions](https://docs.celo.org/build/agents/attribution-tags).
