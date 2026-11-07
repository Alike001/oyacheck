# One human-controlled ERC-8004 request

The owner explicitly authorized enabling one MetaMask confirmation request for
this exact registration. This supersedes the sending lock in the historical
[checkpoint](FINAL-REGISTRATION-CHECKPOINT.md). No genuine transaction has been
requested, signed, broadcast or registered during implementation. No agent ID
or successful Loops House verification exists as a result of these checks.

## Exact authorization and fresh evidence

The read-only snapshot in [unsigned-preview.json](registration/unsigned-preview.json)
was refreshed at **2026-11-07T17:23:24.567Z**. Public metadata returned HTTP 200,
matched the reviewed JSON, advertised the actual web endpoint and
`x402Support:false`. Finalized and latest wallet ownership counts were both zero;
this establishes current ownership, not the absence of historical identities.
Registry code was present at the official Celo address, and the exact tagged
`register(string)` call passed simulation and gas estimation.

| Field | Approved / freshly checked value |
| --- | --- |
| Network | Celo mainnet, 42220 (`0xa4ec`) |
| Sender | `0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a` |
| Recipient | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Function | `register(string agentURI)`, `0xf2c298be` |
| URI | `https://oyacheck-beta.onrender.com/agent-registration.json` |
| ERC-8021 tag | `celo_03e76ac742c7` |
| Native value | 0 CELO; native CELO fees, feeCurrency omitted |
| Latest balance | 0.360 CELO |
| Estimate / buffered gas limit | 181050 / 217260 (`0x350ac`), 20% buffer |
| Current gas price | 202.5 gwei |
| Indicative execution cost | 0.036662625 CELO |
| Max fee / priority | 402.5 / 2.5 gwei |
| Queried L1 / operator upper bounds | 0 / 0 wei |
| Maximum total gas cost | **0.08744715 CELO**, exactly the owner's ceiling |

Exact request fingerprint, including gas and fee fields:

```text
sha256:c895acd4673689be17df6f78ed427d53b7c88450be472abb736b7da1fd2cf253
```

Full calldata byte fingerprint:

```text
sha256:3219716913a962aec107b29b62ebc6bdd8d037ffd79ea3c04b08a89f2227df01
```

The complete calldata and request are in the JSON and local review page. The
suffix is decoded by the existing official attribution SDK and the final tagged
call is simulated. Fees are observations, not a guarantee of future conditions.
The server repeats read-only checks on startup, Stage 2 and immediately before
reserving the one request. Any changed request fingerprint, cost above the
ceiling, RPC failure, unavailable/drifted metadata, existing identity or
insufficient balance blocks execution. A material change needs renewed owner
approval, even if cheaper. No automatic network switch or fee replacement exists.

## Owner's manual steps

1. Open **http://127.0.0.1:4188/**. Start the local server if needed with
   `NODE_USE_ENV_PROXY=1 npm run registration:review` (omit the proxy prefix where
   unnecessary). Refresh read-only checks. The server binds only to loopback.
2. In MetaMask select the exact approved wallet and Celo mainnet. Select MetaMask
   on the page, review the fields, tick Stage 1 and click **Check MetaMask account ·
   no signing**. Account permission, if needed, is separate from a transaction.
3. Click **Re-estimate and prepare final review**. Inspect the complete refreshed
   transaction, decoded function, URI, recipient, zero value, fee bounds and both
   fingerprints. Stage 2 expires after 60 seconds; wallet/network changes or
   refresh invalidate review. Stop if any approved field or bound differs.
4. Tick the final review statement, then deliberately click **Request one
   MetaMask confirmation** once. Only this trusted human click can invoke the
   single `eth_sendTransaction` operation. No automatic popup occurs on load,
   connection, policy initialization or review completion.
5. Personally inspect MetaMask's request. Confirm only if the sender, chain,
   recipient, zero value, data, gas and fees match. Do not edit or raise fees or
   change transaction parameters. MetaMask confirmation signs and broadcasts;
   the owner retains this decision. No private key or recovery phrase is needed.
6. If rejected, pending, missing a hash or ambiguous, **stop**. Use MetaMask
   Activity and the page's read-only recovery. Do not request another registration.

## One attempt and recovery

An exclusive, fsynced journal at the repository's absolute
`.oyacheck/registration-attempt.json` path is reserved **before** the wallet
request; its immutable `.tx` companion stores a returned public hash. These
ignored files have restrictive permissions. Duplicate clicks, tabs, reloads and
server restarts use this same journal. There is no retry/reset endpoint, fallback
signer or environment override. Keep this filesystem durable. Never delete,
move or clone the journal to create another allowance.

Rejection, ambiguity, hash persistence failure or an expired review after claim
consumes the allowance. A startup with a reserved attempt enables recovery only,
including after actual registration. A corrupt journal fails closed. If a hash
was not recorded, recover the original public hash from MetaMask Activity and
use the recovery form; no known hash can be replaced.

Receipt polling is bounded and read-only. Genuine success requires a canonical
finalized successful receipt, matching sender/recipient/zero value/tagged data,
Registered event plus matching mint, actual agentId, ownerOf, tokenURI,
getAgentWallet, reviewed gas and fee caps, native fee currency and fee evidence
within the approved total ceiling. The actual explorer link is generated only
from the real verified hash. Pending or uncertain evidence never retries a send.

After genuine receipt verification, `node scripts/agent-registration.mjs --verify
ACTUAL_PUBLIC_TRANSACTION_HASH` prepares unpublished metadata with the actual
agent ID and `agentRegistry` equal to
`eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
Review the local receipt evidence including settled fees first. Publishing that
metadata and checking the genuine identity in the owner's Loops House entry are
separate steps; no ID, Loops success or submission is invented here.

## Verification

- `npm test`: 279 total, **276 passed, 3 skipped, 0 failed**.
- `npm run check`: all syntax checks passed; `git diff --check` passed.
- Focused registration suites: **39 passed, 0 failed**.
- Opt-in synthetic Chromium demo tests: **3 passed, 0 failed**, separately
  exercising the three normally skipped tests without external purchases.
- Actual Chromium execution review, injected EIP-1193 wallet and isolated mock
  servers: hash returned, rejection and ambiguity each made exactly one mocked
  request; zero real requests. Both reviews, full request equality, untrusted
  click rejection, duplicate click protection and reload recovery passed.
  Mock hash results are not registration evidence. Fixture markers explicitly
  distinguish these servers from the owner's local execution server.

No dependencies changed. Production financial protections, deployed metadata,
wallet/tag/registry/URI remain unchanged. Nothing was pushed or deployed.
Official references: [Celo registry](https://docs.celo.org/build/agents/8004),
[Celo attribution](https://docs.celo.org/build/agents/attribution-tags),
[MetaMask transaction guide](https://docs.metamask.io/metamask-connect/evm/guides/send-transactions/).
