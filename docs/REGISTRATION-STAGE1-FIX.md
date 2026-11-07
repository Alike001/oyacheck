# Registration Stage 1 disabled-state fix

Fixed locally from `c2385ded3bcd147d2aba161f09fe9057495ee911` on
`fix/ai-reliability-mobile`. No push, deployment, real wallet permission request,
signing, broadcasting, funding or registration occurred.

## Exact reproduction and root cause

Real Chromium with an explicitly mocked EIP-1193 MetaMask provider reproduced:

- MetaMask selected; account-review checkbox checked.
- Both account-check and final-review preparation buttons disabled.
- Wallet message: `Account or network changed. Review again; no signing is enabled.`
- **Zero wallet calls** had happened in the original reproduction.
- The saved preview was eleven minutes old. The existing ten-minute freshness
  guard made `previewUsable` false, which directly disabled Stage 1. Stage 2
  correctly remained disabled because Stage 1 had not completed.

Selecting the provider called the generic `invalidate()` handler, which falsely
labeled a provider selection as an account/network change. It did not expose the
actual blocking freshness condition beside the disabled controls. `/preview`
serves a saved/cached snapshot; checking consent cannot make it fresh. Refresh
was required, not registration approval, funding, a signature or a different tag.
Stage 2's transaction fingerprint was not a prerequisite for Stage 1 and was not
the cause of this initial disabled state.

Related event bugs were fixed too: every account/chain event previously cleared
consent unconditionally, including unchanged state; old-provider listeners
remained attached after switching providers; and late async results were not
bound to the selected provider/context. These could clear a valid review or
mark an outdated wallet context verified. They are separate from the reproduced
initial stale-preview blocker.

## Resulting behavior

- Freshness, metadata, RPC/simulation, ownership and fee failures remain blocking.
  They now explain the specific next action beside the controls, through an
  accessible live status associated with both buttons.
- Provider discovery is separated from account state. Discovery never connects
  a wallet. Selecting MetaMask only reads `eth_chainId` and `eth_accounts`.
- Wrong chain, wrong account, no shared account, unavailable/disconnected provider,
  rejected/pending account permission, refresh failure and stale checks have
  distinct messages. A read-only **Recheck MetaMask status** button restores
  eligibility after the owner corrects their extension state.
- Already shared approved accounts are verified read-only, without another
  `eth_requestAccounts`. If no account is shared, that permission is requested
  only after the explicit checkbox and account-check click. Chain and exact sole
  account are verified again after permission returns.
- Unchanged account/chain events and normal permission-handshake events preserve
  valid consent. Actual changes invalidate Stage 1 and Stage 2. Old listeners are
  detached; context/probe versions discard late results. Initial account events
  arriving during discovery cannot leave the provider stuck in an unknown state.
- Refresh clears consent/final fingerprints, verifies new read-only data, then
  rechecks selected-wallet status without permission prompts. It never silently
  re-approves the checkbox. Failed refreshes remain blocked and can be retried
  manually; successful refreshes restore eligibility after a fresh review.
- Reload does not remember approval or auto-access accounts. Stage 2 preparation
  requires completed Stage 1 plus valid fresh checks and registration readiness;
  the backend still re-estimates and checks ownership before showing Stage 2.
- The browser/server send locks, exact wallet, Celo 42220, registry, metadata URI,
  attribution suffix, fee caps, attempt journal and transaction validations were
  not changed. No new send or fallback transaction path was introduced.

## Browser evidence and repeatable regression

Run the explicit test fixture:

```sh
node test/fixtures/registration-review-server.mjs
```

Use its printed localhost origin with
`scripts/verify-registration-stage1.mjs`'s exported
`verifyRegistrationStage1(page, origin)` and a dedicated Playwright page. The
helper refuses an origin without the fixture's no-RPC marker and injects only
fake MetaMask providers. It never operates on the owner's real wallet. Synthetic
refresh responses remain clearly mocked; final preparation uses fake checks.

The real Chromium regression passed:

- Exact stale selected/checked reproduction and actionable Refresh explanation.
- Refresh invalidation/restoration; Stage 1 and Stage 2 reached safely.
- Space/Tab/Enter navigation for checkbox and buttons, visible live reasons and
  `aria-describedby` relationships.
- Permission rejection, manual retry, initial permission handshakes, wrong
  account, wrong chain, disconnect/reconnect and page reload.
- Repeated unchanged events and discovery announcements preserve consent;
  inactive-provider events do not invalidate the active wallet.
- Provider read failures, failed refresh and unverified metadata block controls
  with actionable messages; recovery requires a new explicit review.
- Layouts at 320/360/390/412/768px, including long wrong-wallet help messages.
- Only `eth_chainId`, `eth_accounts` and mocked `eth_requestAccounts` were used.
  **Zero signing calls, zero send calls, zero real wallet calls.**

## Checks

- `npm run check`: passed, including the new verifier and fixture syntax.
- `npm test`: **273 total, 270 passed, 3 skipped, 0 failed**.
- The three opt-in controlled Chromium tests were then run explicitly using a
  temporary software-GPU Chrome wrapper: **3 passed, 0 skipped, 0 failed**.
- `node test-explain.mjs`: **5/5 passed**, no AI requests.
- `git diff --check`: passed.
- The real local backend reported `sendingEnabled:false`, `reserved:false`.
  A bounded actual read-only refresh returned HTTP 200 with verified public
  metadata, zero owned identities and registration readiness true at
  `2026-11-07T16:42:49.958Z`. It changed only the running server's read-only cache;
  no registration snapshot was fabricated or re-dated in source.

## Remaining owner steps

Reload **http://127.0.0.1:4188/** to load the fixed JavaScript. If freshness has
expired, click **Refresh read-only checks**. Then select MetaMask, keep Celo
mainnet 42220 selected, and share only
`0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a` with the local page. Correct account
permissions in MetaMask if the page reports another or multiple accounts, then
use the read-only status button.

Tick the account-review checkbox and click **Check MetaMask account · no signing**.
If MetaMask needs account permission, grant only the intended account. After
Stage 1 is verified, **Re-estimate and prepare final review** can show Stage 2.
Actual account/chain changes require review again. Sending remains separately
locked; no registration or payment approval is needed to perform Stage 1.
