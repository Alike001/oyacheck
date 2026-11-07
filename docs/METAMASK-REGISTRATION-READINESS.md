# OyaCheck: fresh preregistration review

Current follow-up: [final human-controlled checkpoint](FINAL-REGISTRATION-CHECKPOINT.md)
adds two-stage review, the locked future sender and durable attempt recovery.
The earlier controls and snapshot below describe the preceding checkpoint.

Updated 2026-11-07. No signing, broadcast, registration, spending, push or
deployment was performed in this check. Productiondeployment was performed
by the owner; Render independently reports `4a1ab5bd57d4f2c7c8aa75f8a79e2b6d045b9b81`
live as deploy `dep-dbnk7emc6qcc73e4ia6g`.

## Public metadata and identity

The exact stable HTTPS URI is
`https://oyacheck-beta.onrender.com/agent-registration.json`.
Fresh independent fetches returned **HTTP 200**, `application/json`, with no
redirect, and JSON equal to `public/agent-registration.json`. Every field matches
the reviewed document: OyaCheck name/description, current favicon, the existing
web endpoint, `x402Support: false`, active web service, empty registrations and
empty supported trust. There are no MCP/A2A endpoints, paid-resource claims,
security guarantees or fabricated identity IDs. This is the same domain as the
web service, so a separate well-known domain-proof file is optional.

Owner wallet: `0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a`.
Celo mainnet: **42220**, hex `0xa4ec`.
Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
Event tag: `celo_03e76ac742c7`.

The saved fresh read-only evidence is `registration/unsigned-preview.json`,
generated **2026-11-07T15:55:54.070Z** using `https://forno.celo.org`:

| Observation | Result |
| --- | --- |
| Finalized block | `0x4e5bbe7`, hash `0xa86f4ea07c02b4d5fb6bd7cd086a26a9f6ee60c33cc722fc8e89075c4dd0ea8b` |
| Finalized `balanceOf(owner)` | **0 identity NFTs** |
| Finalized native balance | **0 CELO** |
| Latest block | `0x4e5c1af`, hash `0x48e7d7da40bda7cfd56b6b36c4fadc6a5284721accb72fe28e966d1c6169c247` |
| Latest `balanceOf(owner)` | **0 identity NFTs** |
| Latest native balance | **360000000000000000 wei = 0.36 CELO** |
| Registry bytecode / chain | Nonempty / verified 42220 |

The wallet balance changed during this session. Latest-state reads show the
recent 0.36 CELO; the finalized state still shows zero. The agent did not fund
or transfer anything. The two states are labeled separately, not conflated.
There is no currently owned identity in the specified registry at either checked
snapshot. This ownership count is complete for current ERC-721 ownership; it
cannot establish absence of historical registrations or identities owned by
someone else that name this address as their receiving wallet. Any existing
owner-supplied ID or receipt still deserves verification before a new mint.

## Exact simulation and current fee plan

Both `eth_call` and `eth_estimateGas` accepted the **final tagged calldata** from
the supplied wallet for `register(string)` with the exact published agentURI.
The ABI selector is `0xf2c298be`, zero native value is transferred to the registry,
and the decoded suffix is Schema 0 with the assigned event code. The full bytes
and a prepared unsigned EIP-1559 request are in the JSON evidence file. The
simulated return value is deliberately discarded; it is not a genuine agent ID.

| Fee field | Fresh observation / planning value |
| --- | --- |
| Estimated gas | **181050** |
| RPC gas price | **202.5 gwei** |
| Indicative execution cost | **0.036662625 CELO** |
| Gas limit with 20% buffer | **217260**, hex `0x350ac` |
| Current base fee | **200 gwei** |
| RPC priority fee | **2.5 gwei** |
| Prepared max fee | **402.5 gwei**, hex `0x5db6de9900` |
| Prepared priority fee | hex `0x9502f900` |
| L1 fee upper-bound oracle result | **0 wei** |
| Operator fee oracle result | **0 wei** |
| Buffered reserve | **87447150000000000 wei = 0.08744715 CELO** |
| Latest balance covers reserve | **yes** |
| Authorized to sign or broadcast | **false** |

The planning rule is `ceil(estimatedGas * 1.2)` and
`max(2 * baseFee + priorityFee, eth_gasPrice)`, plus read-only oracle bounds.
`GasPriceOracle` at `0x420000000000000000000000000000000000000F` was queried at
the fee block for `getL1FeeUpperBound(679)` and `getOperatorFee(217260)`.
The size argument is the 167-byte tagged calldata plus a conservative 512-byte
allowance for a plain unsigned EIP-1559 envelope without access/authorization
lists. This is a planning bound, not a signed serialization or an absolute fee
guarantee. Oracle values and estimates must be refreshed before approval.
If either oracle or simulation fails, registration readiness stays false.
No stablecoin fee currency is assumed; this request pays gas in native CELO.

The current snapshot meets the implemented read-only prerequisites, using latest
state, but does not establish funding finality or transaction authorization.
Refresh after funds finalize if the owner wants finalized-balance assurance.
Nonce and current fees must still be reviewed by the human at actual signing.

## Local MetaMask review workflow

Start (or use the running instance):

```sh
npm run registration:review
```

In this proxy-enabled Node 24 environment use
`NODE_USE_ENV_PROXY=1 npm run registration:review` so refresh can reach the RPC.
The local user-facing URL is **http://127.0.0.1:4188/**.
It binds only to loopback and requires the exact local Host. It is not a route
on the public beta, and is not deployed by this task.

1. Open that URL in the owner's browser with MetaMask Extension installed.
   It displays the network, required wallet, registry, decoded function, published
   metadata URI, zero native value, tag, current balance, estimated/buffered fees
   and full unsigned request. No account is accessed on page load.
2. Click **Refresh read-only checks**. This reruns the safe existing RPC/metadata
   checks and simulations, writes nothing public and clears prior review consent.
   No wallet interaction occurs. Refresh is limited to once per 30 seconds;
   previews older than ten minutes cannot request account access.
3. Select MetaMask discovered through EIP-6963. Review every field and explicitly
   check the review checkbox. Only then is **Check MetaMask account · no signing**
   enabled. That button requests account access, not transaction authorization.
4. The page first reads `eth_chainId` and rejects a wrong network before asking
   for account permission. The human must select Celo manually; this page does
   not request network changes. After the user gesture it may call
   `eth_requestAccounts`, followed by `eth_chainId`/`eth_accounts`. Authorize only
   the exact supplied account. A different account, multiple accounts, stale
   preview or changed chain stops the check. Network/account changes clear review.
5. **Stop.** There is no send/sign/register button or wallet signing method in
   this page. Real MetaMask access was not requested by the agent. Browser tests
   used only an explicit fake provider, including fake account permissions.
   No private key or recovery phrase is requested or exported.

A future registration still needs separate explicit human approval of this exact
request and fresh fees. The owner can then use MetaMask Extension's documented
hex-data transaction flow: Celo 42220, exact sender, registry recipient, zero CELO
value and the complete tagged data. If the installed UI cannot prepare this
zero-value contract interaction correctly, stop and prepare a separately reviewed
provider submission workflow. An explorer write form or third-party registration
site is not part of this workflow. **MetaMask Confirm normally signs and
broadcasts**; it must not be clicked during the current preparation task.

## Receipt verification and genuine metadata update

After a future approved registration supplies a real public transaction hash:

```sh
node scripts/agent-registration.mjs --verify ACTUAL_TRANSACTION_HASH
```

The existing read-only verifier checks chain, registry code, receipt success,
canonical finalized block, exact sender/recipient/value/tagged input, the genuine
registry `Registered` event and matching mint `Transfer`. It obtains the actual
ID from that event, then verifies `ownerOf(id)`, `tokenURI(id)` and
`getAgentWallet(id)` against the supplied wallet and exact URI. Pending, failed,
reorged or mismatched evidence fails closed. No receipt/agent ID is invented here.

The CLI emits receipt evidence and `proposedMetadata`, with the actual ID and
`agentRegistry: eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`.
It does not update any file or publish. Review only the proposed metadata object,
then separately authorize updating/publishing `public/agent-registration.json`.
Refetch the public JSON and compare the tuple to chain reads. Keeping this stable
HTTPS URI means no `setAgentURI` transaction is needed for the JSON update.

Finally the owner checks their actual Loops House entry: the exact agent wallet
must be associated with the entry, and its genuine mainnet registry/ID must pass
the organizer's current identity checks. Entry URL and authenticated verification
status remain unknown. Do not invent Loops API endpoints, button names or a
successful verification/submission. Identity does not replace the other track
requirements. No final hackathon submission is authorized here.

## Financial protections and verification

Fresh public checks returned health **200** with mainnet preparation, sandbox
purchases and demo disabled; their probed routes returned **403**. No financial
configuration changed. The free Render spending-store restriction and guards
remain. No push, deployment, restart, signing, spending or registration occurred.

`npm run check`, release preflight and `git diff --check` passed.
Full suite: **254 total, 251 passed, 3 skipped, 0 failed**.
Focused tests: **14 passed, 0 failed**, across registration and review modules: exact
calldata/tag, failed RPC and simulations, ownership scope, fees/oracle bounds,
receipt/identity checks, proposed actual-ID metadata, review-before-permission,
wrong wallet/network and loopback HTTP guards. Real Chromium with a mock
MetaMask provider verified zero automatic wallet requests, the explicit review
gate, only the four allowed account/chain methods, invalidation on network change,
and fitting widths 320/360/390/412/768. No real wallet authorization was tested.

Primary sources checked:
- [Celo registration](https://docs.celo.org/build/agents/8004)
- [Celo attribution](https://docs.celo.org/build/agents/attribution-tags)
- [MetaMask provider API](https://docs.metamask.io/metamask-connect/evm/reference/provider-api/)
- [MetaMask account guidance](https://github.com/MetaMask/metamask-docs/blob/main/metamask-connect/evm/guides/manage-user-accounts.md)
- [MetaMask hex-data setting](https://support.metamask.io/configure/transactions/how-to-add-a-memo-to-a-transaction/)
- [Celo GasPriceOracle source](https://github.com/celo-org/optimism/blob/celo-rebase-19/packages/contracts-bedrock/src/L2/GasPriceOracle.sol)
- [Loops House](https://www.loops.house/agents-on-open-rails)

**Next human action:** open the local review page, refresh and review the exact
request with the intended MetaMask account. Separate registration/signing approval
is still required before any transaction authorization request or spending.
