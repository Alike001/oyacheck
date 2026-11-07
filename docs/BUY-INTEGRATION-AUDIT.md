# Build with buy integration and readiness audit

Verified 2026-11-07 on `fix/ai-reliability-mobile`. Deadline:
**2026-11-09 09:00 GMT**. No financial actions, deployment, push, merge,
registration or submission were performed during this audit.

## Official sources checked

- [Organizer rules and FAQ](https://www.loops.house/agents-on-open-rails)
- [buy website](https://usebuy.ai) and [current CLI docs](https://usebuy.ai/docs)
- [Official buy skill repository](https://github.com/celo-org/buy-skill)
- [Gateway skill and browser command contract](https://github.com/celo-org/buy-skill/blob/main/skills/use-api-gateway/SKILL.md)
- [Free live catalog](https://gateway.usebuy.ai/v1/catalog)
- [Render deployment documentation](https://render.com/docs/deploys)

The website documents CLI 0.8.5, which is installed locally; the gateway skill
requires 0.8.4 or newer. The live catalog advertised `browser.sessions.create`,
POST `https://gateway.usebuy.ai/v1/browser/sessions`, with a one-minute rental
supported. Its listed price was 0.003606 USDC. An actual unpaid POST of
`{"durationMinutes":1}` returned HTTP 402 with 3606 atomic USDC offers on Celo
and Celo Sepolia. The 402 for the exact request remains the price authority.
The repaired `obtainQuote` also succeeded against the actual gateway/CLI with
0.003606 test USDC, 90-second expiry and zero purchases in its budget counter.
No payment header, authorization or paid request was sent.

## Existing product journey

| Surface | Actual behavior and verification |
| --- | --- |
| Link/forwarded message | `lib/analyze.mjs` deterministically parses one public hostname, exact curated NCC matches and warning signals. It makes no network request and does not inspect the submitted website. |
| AI explanation/follow-up | `lib/explain.mjs` and `lib/chat.mjs` send bounded report facts to Groq, with prepared fallback text. General questions use `lib/general.mjs` via `/api/ask`. AI cannot replace the deterministic report/evidence fields; free-form prose still relies on model instructions against hallucination. |
| Voice | Explicit recording/transcription and device speech paths exist. Real microphone and phone pronunciation acceptance remain pending; voice is not a buy purchase. |
| Free quote | Local `/api/buy/quote` now validates the live catalog, quotes the exact fixed body with `buy --sandbox quote`, and issues a random single-use token. |
| Paid source inspection | `/api/buy/inspect` requires local connection, `BUY_BROWSER_SANDBOX=1`, explicit consent and a valid unexpired quote. `buy --sandbox curl --max-amount <quote> --token USDC` purchases an external browser session. This is real provider integration code, not the synthetic lab. |
| Useful external work | The rented browser refreshes the published NCC advisory's rendered URL/title/text and optional screenshot, checking whether the exact examined hostname appears. It does not navigate the suspicious site or create a new safety verdict. |
| Controlled browser lab | Local Chromium renders fixed synthetic fixtures; observed DOM is genuine local browser output, but the pages are owned training fixtures. No buy call or mainnet evidence results. |
| Public beta | Read-only analysis and optional Groq; paid browser inspection and synthetic lab are disabled. |
| Mainnet service purchasing | Not implemented in OyaCheck. The gateway supports mainnet, but this adapter always passes `--sandbox`; enabling its feature flag cannot enable mainnet. |

Browser rentals are appropriate for refreshing this published evidence. There is
no unrelated token-purchase integration. The gateway holds upstream browser
provider credentials; OyaCheck only receives a temporary rental credential.

## Existing genuine sandbox evidence

The local buy account list contains only `sandbox`, on Sepolia, paying from
`0x593d4667e0eaeD29A38763FC485513C45e5fa357`. Read-only `whoami` reported
**0.973364 test USDC** and 0 S-CELO. No configured default mainnet account was
found in this CLI store; wallets elsewhere are **unknown**, not absent.

Local receipts contain several confirmed browser purchases, including:

- 2026-11-07 07:52:30 UTC, 0.003606 USDC on Celo Sepolia, chain ID 11142220.
- Transaction: `0x3a1acc38577a1360a167c1aff97f9711bb0bca1ecd440a779d95c64e99d995c5`.
- [Public explorer receipt](https://celo-sepolia.blockscout.com/tx/0x3a1acc38577a1360a167c1aff97f9711bb0bca1ecd440a779d95c64e99d995c5)
- Explorer API independently returned success, block 40753962, with
  `transferWithAuthorization`, value 3606, recipient
  `0x20faAca5F980E29639A0FCC6dcA6988E18ed333B` and sandbox USDC contract
  `0x01C5C0122039549AD1493B8220cABEdD739BC44E`.

This corroborates a genuine historical sandbox payment. The README records that
the corresponding browser opened the advisory and retrieved title/text/screenshot;
those historical image/output artifacts were not independently recovered here.
The payment alone does not prove every historical browser observation. No new
rental was purchased, and this receipt is not mainnet hackathon evidence.

## Repairs completed locally

- Validate live availability, fixed URL/method, sandbox network and one-minute
  request support before quoting; fail closed on catalog incompatibility.
- Isolate each CLI offer before checking payable status, preventing a later
  offer from supplying another offer's `payable yes`. Check atomic/decimal price
  consistency, six-decimal precision, token, network and 0.01 test-USDC ceiling.
- Parse paid JSON independent of property order. Bind both session endpoints to
  the returned session ID and exact gateway paths; reject credentials in URLs,
  alternate ports, queries, fragments and other origins.
- Restrict the final source URL to the exact configured advisory, not another
  page on the same host. Require whole hostname mentions, not substrings.
- Keep raw subprocess/session errors private. Preserve only valid public
  transaction hashes on failures. Session tokens remain on backend stdin,
  never process arguments or browser responses.
- Lock out another purchase after an incomplete/ambiguous paid attempt until
  the operator reviews receipts and deliberately restarts. Never retry payment
  or navigation automatically. Cleanup still tries to end the rental.
- Clear stale client approval on every new quote attempt and stale success
  output before a new inspection. Show testnet explorer links on success and
  partial failure; label paid source checks and synthetic demos accurately.
- Display the quoted approved maximum separately from verified settled cost.
  A quote or gateway transaction string alone is not independently verified
  settlement evidence.

Existing protections remain: explicit dialog consent, 90-second single-use
quote, one in-flight purchase, 0.01 test USDC per purchase, 0.02 per UTC day and
three purchases per day per process, local-only routes, no untrusted submitted
URL navigation, no form interactions, bounded subprocess output/time, temporary
screenshots and disabled production gates.

These are local sandbox protections. Budgets, quote state, in-flight lock and
recovery lock live in process memory. Restart/multiple processes can reset or
bypass shared accounting. There is no authenticated public purchaser identity,
durable payment ledger, crash recovery or cross-instance locking. The CLI
re-probes the fixed endpoint at purchase time and enforces the approved maximum;
the UI quote is not an immutable upstream reservation. Do not enable public or
mainnet purchasing by removing `--sandbox` or flipping an environment variable.
The gateway blocks private/local destinations, but this app does not implement
request interception or pre-navigation redirect/DNS policy for arbitrary sites.
Final-URL rejection happens after navigation. Arbitrary-site inspection remains
out of scope and unsafe to enable without further isolation work.

## Verification results

- Phase A: `npm run check` exit 0; `npm test` exit 0, 179 total, 176 pass,
  3 skip, 0 fail; `git diff --check` exit 0. Commit `d7d6bfa` contains the six
  intended AI/mobile files; staged secret-pattern/artifact review passed.
- After integration repairs: `npm run check` exit 0; `npm test` exit 0,
  **205 total, 202 pass, 3 skip, 0 fail**; `git diff --check` exit 0.
- `node --test test/buy-browser.test.mjs test/buy-orchestration.test.mjs`:
  45 pass, 0 fail. Orchestration uses temporary fake buy/curl executables and a
  mocked catalog, never a wallet or paid provider. Cases include success,
  consent expiry, invalid quotes, catalog drift, endpoint credential protection,
  concurrent replay, count/amount ceilings, redirect, provider failure and
  receipt-recovery lockout.
- `OYACHECK_RUN_LIVE_DEMO=1 npm run demo:live`: exit 0, 3 pass, 0 skip,
  0 fail. These are the same three opt-in default-suite skips: sensitive fields,
  normal login and local redirect. Real local Chrome, synthetic fixtures.
- Real Chromium 153.0.8010.52: document widths 320/360/390/412/768 matched
  viewport widths; composer controls fit and glow remained clipped.
- `scripts/verify-buy-browser.mjs` passed in real Chromium at 320px/768px,
  with buy responses intercepted and the actual server's payment feature off.
  Cancel/Escape cause no inspection request, stale/invalid/expired quotes cannot
  authorize, deterministic findings survive, and success/failure receipt links
  render. Two mock inspection requests, zero real purchases, zero auto retries.
  Its intentionally simulated HTTP 502 appears as an expected browser console
  network error. It is not a real provider failure.
- Both browser helper scripts passed `node --check`.

`scripts/verify-groq-browser.mjs` remains safe to use with a dedicated local
Playwright page and a trusted local server holding an existing key. It checks
health before spending, allows at most two `/api/ask` POSTs per invocation,
blocks other API mutations, disables automatic speech and stops on the first
failure. General reply code makes one provider request without retry. Do not
rerun automatically. Local Groq credentials remain unavailable; zero genuine
Groq completions were requested in this audit. Production's key was not read or
used. Physical phone keyboard/microphone and Pidgin speaker review remain pending.

## Production configuration verified without secrets

With user-confirmed read-only access to the Alike Render workspace:

- Service `oyacheck-beta`, ID `srv-dbng37tg1s2s73ck2970`, free Node web service,
  Frankfurt, one instance, public repository `Alike001/oyacheck`.
- Linked branch: `chore/public-beta-deployment`; automatic deploy trigger **off**.
- Current live deploy `dep-dbng9is9v7es73cmsig0` serves commit
  `638e61fff3256a8dce74b6937dddc9a888559c8c`, not these local repairs.
- Build command: `npm ci --include=dev && npm run check && npm test`.
  Start: `npm start`. Health path: `/api/health`.
- [Public beta](https://oyacheck-beta.onrender.com) `/api/health` returned HTTP
  200, v0.10.0, `aiConfigured: true`, `voiceTranscription: true`,
  `sourceInspectionSandboxEnabled: false`, `localBrowserDemo: false`,
  `browserInspection: false`, `localBrowserAvailable: false`.
- The buy quote route and demo route both returned HTTP 403. No paid call was
  attempted. Groq configuration means key-format presence, not tested quota or
  a successful completion. Secret values were neither requested nor revealed.
- `render.yaml` keeps both browser features off and declares `NODE_ENV=production`.
  The running process's complete environment was not retrieved. The deployment
  does not install buy/Chrome; paid/headless features cannot simply be enabled.

## Hackathon compliance and evidence checklist

The organizer FAQ specifically exempts **Build with buy purchases** from
attribution tags. General wallet transactions have a different tagging rule;
x402 uses payment-party records instead. Do not add unrelated transactions to
manufacture tagged activity. ERC-8004 identity and independent-user requirements
still apply. Sandbox receipts do not qualify as mainnet activity.

| Item | Current evidence |
| --- | --- |
| Public GitHub repository | Verified public: https://github.com/Alike001/oyacheck |
| Project registration / entry URL | Unknown; not available in inspected project or connected account evidence |
| Registered agent wallet | Unknown; local sandbox wallet is not proof of the entry's mainnet wallet |
| ERC-8004 identity / registration transaction | Unknown; none established by inspected evidence, may exist elsewhere |
| Mainnet stablecoin funds | Unknown elsewhere; only a sandbox account exists in this local buy store |
| Build with buy mainnet receipts | Unknown elsewhere; inspected local receipts are Sepolia |
| Independent users / usage evidence | Unknown; a reachable beta is not proof of qualifying users |
| Attribution code for other direct transactions | Unknown entry tag; app has no general mainnet transaction sender; buy-specific exemption applies |
| Working public beta | Verified baseline deploy, not the new local fixes |

Before any separately approved genuine mainnet call, collect and retain:

- [ ] Entry URL, registered payer wallet and ERC-8004 identity/chain/explorer.
- [ ] User task and why refreshing the official source adds useful evidence.
- [ ] Service/capability/provider name and exact method, URL, body and duration.
- [ ] Fresh free catalog and exact 402 quote; token contract/decimals, chain ID,
      recipient, quoted price and explicit approved maximum.
- [ ] Separate human approval for that exact bounded purchase; dedicated funded
      mainnet wallet and durable charge/recovery controls before activation.
- [ ] Provider result with timestamps, final source URL, title/text observations,
      screenshot if available, and explicit inspection limitations.
- [ ] Actual settled amount, payer, recipient, chain, transaction hash and
      explorer URL, independently checked onchain and linked to the service call.
- [ ] Correlation ID/recovery status for partial failures; no automatic retry.
- [ ] Submission-safe evidence excludes session tokens, wallet keys, signatures,
      raw authorizations, poll capabilities and unrelated personal information.
- [ ] Independent-user evidence, repository revision and truthful demo.

Production blockers: local fixes are not pushed/deployed by request; no mainnet
purchase mode/durable spending system; no local mainnet account; registration,
identity, mainnet funds/evidence and independent users remain unknown; real Groq
and device acceptance remain pending. No new signing, payment authorization,
funding, broadcast, provider purchase or fake mainnet evidence was created.

**Single next human action:** provide the existing hackathon entry URL (or state
that registration has not happened), so the registered wallet and ERC-8004
identity can be verified before any mainnet activation or purchase proposal.
