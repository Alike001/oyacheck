# Finalized identity, narrow metadata publication and buy payer decision

Prepared 2026-11-07. No key access, wallet creation/import, signing, payment,
broadcast, funding, push, merge, deployment or submission was performed.

## Finalized identity

At **2026-11-07T17:56:38.131Z**, independent Forno and Stakely RPCs both returned
finalized block **`0x4e5d869`**, hash
`0x301d9d9435c942d333c70b99d46e03e7407c9df70d0bb9fe69d3c8cd8336f653`, above receipt
block **82171849 / `0x4e5d7c9`**. Full `registrationReceiptStatus` verification
returned **verified** on both endpoints. This uses the literal `finalized` tag;
no latest/safe substitution. 1RPC still returned the older `0x4e5d5d4` head and
pending-finality; this lag is retained, not hidden.

[Permanent evidence](registration/registration-evidence.json) retains previous
pending observations and adds `finalizedConfirmation` with both complete
verifier outputs. Verified facts:

- Transaction: `0x56b7126b6040de24af3d78017e913aac6ff749ba05878e4776a1437e314de74c`.
- Chain 42220, successful canonical receipt, genuine Registered and mint events.
- Agent ID **10051**; registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
- Sender, finalized ownerOf and getAgentWallet:
  `0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a`.
- tokenURI and decoded `register(string)` argument:
  `https://oyacheck-beta.onrender.com/agent-registration.json`.
- Exact ERC-8021 suffix decodes to `celo_03e76ac742c7`, schema 0; native value 0.
- Reviewed gas/fee caps match; gas used 178466, effective price 202.5 gwei,
  L1/operator fee 0, settled total **0.036139365 CELO** within approval.

[Actual explorer transaction](https://celoscan.io/tx/0x56b7126b6040de24af3d78017e913aac6ff749ba05878e4776a1437e314de74c).
The owner now confirms Loops House **CELO ALL SET**, with wallet, onchain tag and
ERC-8004 checks passed. This is recorded as owner-reported dashboard evidence;
we did not independently open or edit the authenticated entry. No re-registration
or new tag transaction is needed.

The original journal and hash companion are unchanged. Their SHA-256 values
remain `29fe8e0fc0d73f36f93144d8cfd9fdd48e6857abb695b6dc2bce96f9ca2c9ff8`
and `4d6a9ff39d1fdb74878c6abe84f41ab5534d77f5a153ccd35a9b8581c33a72cb`.
Do not remove them after successful finality verification.

## Exact narrow release and publication gate

`public/agent-registration.json` already has agentId 10051 and agentRegistry
`eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`. Its stable HTTPS URI,
web endpoint, truthful description, image and `x402Support:false` are unchanged.
There are no MCP/A2A endpoints. Metadata HTTP 200 and all relevant financial/demo
403 responses were verified locally under production/read-only settings.

Read-only GitHub/Render inspection found:

| Item | Actual value |
| --- | --- |
| Repository | `https://github.com/Alike001/oyacheck` |
| Remote feature branch | `fix/ai-reliability-mobile` at `4a1ab5bd57d4f2c7c8aa75f8a79e2b6d045b9b81` |
| Remote linked release branch | `chore/public-beta-deployment` at `638e61fff3256a8dce74b6937dddc9a888559c8c` |
| Remote main | `41b04233a8430975d498d5ab502596700449ab0e` |
| Render service | `oyacheck-beta`, `srv-dbng37tg1s2s73ck2970`, free, Frankfurt |
| Live deployment | `dep-dbnk7emc6qcc73e4ia6g`, manual, Live |
| Live commit | `4a1ab5bd57d4f2c7c8aa75f8a79e2b6d045b9b81` |
| Linked branch / auto-deploy | `chore/public-beta-deployment` / off |
| Dashboard build / start | `npm ci --include=dev && npm run check && npm test` / `npm start` |

The local history to publish after the remote feature branch consists of:

```text
200bd9628dc3e185ea0a44de3f40fe2799fb8a3c local preregistration review
c2385ded3bcd147d2aba161f09fe9057495ee911 locked one-use workflow
8515c81537dd7b074f2537ab5d2f7e6641cc3279 Stage 1 eligibility fix
b9fe0dddfa81298fd1f9d8d2b5d72b2f1db7e555 one-request owner authorization
8fbe910f16a4e782a05bfc43cb45341c2952120f read-only recovery diagnostics
7f8046f345c8bbf4d2c88e1b90e8d939ef821829 metadata with ID and initial evidence
```

The local commit containing this document adds finalized evidence and readiness
instructions. Its exact SHA is reported in the task handoff; use that fixed SHA
as the candidate if publishing this complete reviewed branch. A comparison of
public files, server.mjs, render.yaml and release-policy against the live commit
shows only `public/agent-registration.json` changed. Remaining runtime helpers
are isolated local operator tools; production financial gates are unchanged.

**Not authorized yet:** pushing even the feature branch or deploying any SHA.
After explicit release approval:

1. Recheck remote divergence, then fast-forward push the reviewed feature branch
   without force. Verify GitHub CI for the exact candidate (not available before
   the new local commit has been pushed).
2. Use Render Dashboard **Manual Deploy > Deploy a specific commit** and the
   approved exact SHA. The [official deployment documentation](https://render.com/docs/deploys)
   supports a SHA from the linked repository rather than only its linked branch.
   A feature push alone does not deploy. The current MCP trigger cannot choose
   an exact SHA; use authenticated Dashboard or a separately approved API path.
   If that path requires a protected-branch merge, stop for separate approval.
3. Verify production env without exposing secrets: NODE_ENV=production,
   OYACHECK_READ_ONLY=1, four browser/mainnet flags 0, purchase DB unset, same
   public agent wallet. Dashboard build currently omits release:check although
   render.yaml includes it; retain the independently passed preflight and obtain
   approval before changing dashboard configuration.
4. After Live, verify actual deployed SHA, metadata HTTP 200/JSON with the real
   registration, unchanged URI/web/x402Support false, homepage and health, and
   financial/demo 403 responses. Restart/re-fetch only within approved bounded
   verification. No paid browser, AI spending test or wallet request is needed.
5. On failure, manually roll back to known live SHA `4a1ab5b...` (full SHA above)
   or that exact historical deploy, retaining all financial flags off. Recheck
   HTTP responses and recorded deployed SHA. Never roll back operational journals
   or attempt to unregister the onchain identity.

## Exact supported buy account and signing model

Sources checked: [official client docs](https://usebuy.ai/docs), current npm
metadata, installed CLI and package source **@celo/buy 0.8.5** (also npm latest),
and [official gateway contract](https://github.com/celo-org/buy-skill/blob/main/skills/use-api-gateway/SKILL.md).
Context7 was consulted but indexed unrelated celocli account documentation, so
its Ledger/account instructions were not applied to buy.

The supported CLI model is a **named local account** with network `mainnet`
(displayed as `celo`), a public EOA address and a locally held signing key.
Setup generates a key or imports a raw key. The default backend is the OS
credential store via `@napi-rs/keyring`; the plaintext file backend explicitly
refuses mainnet. `loadSigner` derives the address and checks it against account
metadata. CLI curl signs a bounded EIP-3009/x402 payment authorization locally,
then sends the payment header to the gateway for sponsored settlement.

There is **no documented MetaMask/EIP-1193, WalletConnect or hardware-wallet
connection in this installed client**. Registering with MetaMask did not create
a buy account. Existing-wallet import would require raw key material and is
outside this workflow: do not export the MetaMask key, request it, or configure
an alternative signer. No setup/import/signer-loading command was run. The
only listed account remains sandbox, on Sepolia, address
`0x593d4667e0eaeD29A38763FC485513C45e5fa357`.

OyaCheck's sandbox adapter explicitly uses `--sandbox`. Its separate mainnet
adapter uses `--account NAME`, verifies whoami network/public payer/token balance,
and never falls back to the default wallet or sandbox. It has no browser-wallet
payment path. Current MetaMask cannot simply be substituted through an env var.

## Must the buy payer equal the registered agent wallet?

**Protocol:** the observed x402 offer binds payer authorization, token, amount,
recipient and chain. It does not require payer's ERC-8004 ID, and the provider's
agent ID 9894 is not our buyer's ID. Settlement transaction sender can be a
sponsoring facilitator; the token Transfer sender is the payer to reconcile.

**Track qualification:** the [event FAQ](https://www.loops.house/agents-on-open-rails)
refers to verified calls from the entry's tagged wallet and exempts buy purchases
from calldata tagging. It gives no explicit rule allowing a different payment
wallet to inherit the existing registered wallet's eligibility. Therefore the
safe default is the verified entry wallet as payer; an alternate payer is
**not established as qualifying** merely because the protocol accepts it.
Organizer confirmation of a supported alternate-payer mapping is required before
choosing, creating or funding a different buy account. No such confirmation was
invented. A new registration or identity migration is not proposed here.

If exact same payer is required, the current CLI cannot meet the no-key-export
constraint with this MetaMask wallet. A separately reviewed supported external
signing integration would be needed. If organizers allow a distinct named buy
account tied to this entry, account creation/association and secure keychain
availability each need their own owner authorization. Neither path is enabled.

## Prepared real external service quote, not a purchase

[Unpaid quote evidence](registration/buy-readiness-quote.json) captures a free
catalog request and unsigned POST returning HTTP 402 for:

```text
POST https://gateway.usebuy.ai/v1/browser/sessions
{"durationMinutes":1}
```

The existing adapter accepted the actual challenge. Provider:
`buy-browser-worker`, agent 9894. Recipient:
`0x20faAca5F980E29639A0FCC6dcA6988E18ed333B`, chain 42220.

| Supported token | Contract | Observed one-minute price |
| --- | --- | --- |
| USDC | `0xceba9300f2b948710d2653dd7b07f33a8b32118c` | 3606 atomic = 0.003606 USDC |
| USDT | `0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e` | 3606 atomic = 0.003606 USDT |
| USAT | `0xd2ab3c9a02dbbab236bfec45d1d755df4267f771` | 3606 atomic = 0.003606 USAT |

All are six decimals. Prices are observations, not approved spending or a locked
reservation. Token and payer remain unselected/unconfirmed; **no exact funding
instruction is issued**. Earlier checked registered-wallet balances were zero
for all three; recheck the actual selected payer before any funding requirement.
The documented gateway sponsors settlement gas, so do not add registration gas
or assume CELO is the token to fund for this service.

Useful output is an externally rendered refresh of the exact configured NCC
advisory for an OyaCheck report: final URL, title, retained bounded text snapshot,
whole-hostname mention, excerpt, SHA-256 and observation time. The exact URL is
in the quote evidence. No suspicious-site navigation, forms or changed safety
verdict. Commands within that rental do not require a second rental purchase.
After a real result, independently correlate payment and observations; a payment
receipt alone does not prove useful provider work.

## Isolated operator environment and safety audit

Keep the public free Render beta permanently read-only for this candidate.
`financialActionsBlocked` refuses production, RENDER=true or OYACHECK_READ_ONLY=1
before opening a ledger. Mainnet HTTP is loopback+Host+Origin/CSRF constrained
and exposes preparation/request/cancel/read, **no execute endpoint**.

Use the existing `.env.example` as a public-config template on a separate owner
host; do not modify the public beta or load a wallet into its browser. Account,
payer and absolute private purchase DB path remain blank. Keep read-only=1,
PREPARE=0 and EXECUTE=0 until prerequisites and a later preparation scope are
approved. Mainnet keychain availability and a durable filesystem have not been
verified on an operator host, so no operational purchase journal was created.

The existing SQLite store uses WAL, synchronous FULL, BEGIN IMMEDIATE and an
irreversible one-attempt row per payer across tokens/restarts. It reserves before
calling the paid CLI. Rejection, timeout, crash or ambiguous settlement does not
release it. Tests cover reopened stores, concurrency, killed processes, expiry,
amount/token bounds, one-attempt replay denial and late-result recovery. Actual
host disk durability, backup and restore while retaining the reservation remain
operator acceptance tasks; test files in temporary directories are not that proof.

Reconciliation requires chain 42220, successful receipt, attempt time window,
configured token Transfer from approved payer to approved recipient, amount
positive and within quote, and original hash consistency. It **does not establish
finalized/canonical settlement or uniquely bind a token authorization nonce**.
Do not call its `complete` state finality evidence: separately inspect canonical
receipt/finalized head and correlate the buy receipt/provider request before
claiming finalized paid-call evidence. A future strengthening can remain
read-only; no financial activation is justified by current tests alone.

Secrets remain confined to the buy key store and transient backend processing.
Session access tokens travel through curl stdin rather than argv and are not
written into public purchase records; raw subprocess errors are not returned.
Only sanitized source results and public payment references belong in evidence.
Keep actual paid responses containing credentials in protected temporary storage
if needed for reconciliation; publish sanitized evidence only. No keys, session
credentials or payment authorization headers were requested or produced here.

## Independent user and one-purchase human checklist

The official event definition requires an unrelated wallet, not initially funded
by the builder or main funder, with Celo activity predating the hackathon.
For a real consenting user, retain their public address, independent prior chain
activity, provenance evidence sufficient to check that criterion, actual product
use, dated feedback and consent to publish minimal evidence. Never manufacture,
fund or impersonate a qualifying user. Recruit outside the builder's controlled
wallets; no outreach was sent by this agent.

An operator-paid backend call does not itself prove the user's wallet signed or
qualified. Confirm the track's user metric with organizers and distinguish real
product usage from onchain independent-user qualification. New-user onboarding
may be useful but must be labelled accurately.

Before asking for **one** purchase approval, all must be concrete:

- Organizer-approved payer/entry relationship; verified existing named mainnet
  account and public address; chosen token and current balance; no key export.
- Durable private single-host ledger path, permissions, retention/restart/crash
  recovery and backup behavior accepted; hosted execution still off.
- Fresh exact quote and server plan ID/fingerprint/90-second expiry, fixed body,
  chain, token contract, recipient, source URL and maximum, at most 0.01 token.
- Explicit user request for that investigation and operator approval of that
  exact plan; one attempt, no retry, one-minute rental only.
- Agreed observation evidence and original receipt recovery procedure. Pending,
  missing hash or ambiguous service outcome means reconcile, never repay.

Once payer/service/token are confirmed, calculate only the selected token's
shortfall from the fresh quote and actual balance, and explain the sponsor's gas
model. Any funding is a separate owner action. There is no spend-ready plan ID,
funding request or approved execution in this checkpoint.

**Single next human action for buy readiness:** obtain organizer confirmation
whether a distinct buy-managed payer can be linked to this already verified
entry, or whether payment must come from its current MetaMask wallet. Do not
create or fund a wallet while that choice is unresolved. Metadata publication
can separately await explicit approval of the fixed candidate commit.

## Current validation

- `npm test`: 281 total, **278 passed, 3 skipped, 0 failed**.
- Focused registration/mainnet/buy suites: **116 passed, 0 failed**.
- Syntax checks and production read-only release preflight passed.
- `npm ls --depth=0`: exact pinned dependencies present; `npm audit --omit=dev`:
  **0 vulnerabilities**. No dependency or lockfile changes.
- Local metadata HTTP 200 with ID 10051; mainnet session, sandbox quote/inspection
  and demo inspection HTTP 403. No Groq or paid smoke call performed.
- `git diff --check` passed. Original registration journal checksums unchanged.
