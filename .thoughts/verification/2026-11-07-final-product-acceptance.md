# Verification Audit: OyaCheck final read-only product acceptance

## Verdict

**GO for the bounded read-only public beta, after separate owner release approval
and successful Render build/post-deployment checks.** Paid execution remains
disabled. No push, merge, deploy, signing, purchase or submission occurred.
This audit does not certify comprehensive phishing detection or formal WCAG
conformance. Physical phone audio and fresh live AI quality are follow-ups.

## Artifacts Checked

- Owner's final acceptance checklist and preceding product requirements.
- `docs/PRODUCT-UX-AUDIT.md`, `docs/PRODUCT-UX-VERIFICATION.md` and identity/release
  evidence; current HTML/CSS/JS, analyzer, API, feature gates and tests.
- Candidate base `3f585b207103ff7cded199434e4c2da1c1be254e`, plus only the verified
  defects below. Exact fixed release SHA is in the handoff and ignored local
  `.playwright-mcp/final-acceptance/release-plan.md` generated after the commit.
- Actual Chromium pages, eight full-page screenshots, local HTTP responses,
  read-only Render service/deploy data and GitHub remote refs.

## Requirement Traceability

| Acceptance area | Implementation/evidence | Result |
| --- | --- | --- |
| Actual landing/app and responsive hierarchy | Real Chromium at 320/360/390/412/768/1440; no document overflow | Pass |
| Eight readable screenshots | Desktop/mobile landing, empty checker, completed userinfo URL and OTP message | Captured and inspected |
| Hero/navigation/CTAs | Header Product/How/FAQ/Open App; hero primary/secondary; FAQ app link; footer privacy/home; brand home; metadata/project destinations | Pass |
| Retained drafts/history | Landing draft and unsent checker draft survive SPA navigation/back; forward does not re-submit | Pass |
| Controlled examples | example.org unverified; userinfo warns and shows unrelated.example; OTP message suspicious without invented host; harmless message no obvious signs | Pass |
| English/Pidgin | Explicit re-analysis retains deterministic status; both labels/guidance work | Pass |
| Loading/error/keyboard/voice fallback | Disabled duplicate submission; injected 503 retains draft and hides stale result; keyboard FAQ/focus and mocked permission denial | Pass |
| Truthful claims | Copy discloses limited evidence, no submitted-site inspection and no safety guarantee | Pass |
| Real identity metadata | Local route HTTP 200; agent 10051, correct registry/web URI and x402Support false | Pass |
| Financial/mock isolation | GET and POST financial 403s; mock/operator source paths unavailable; ledger creation blocked in production even with flags on | Pass |
| Quality/security gates | Tests, syntax, dependency audit, secret-pattern review, release preflight, whitespace checks | Pass |
| Push/deploy/rollback | Reproducible fixed-SHA procedure below; authorization remains pending | Prepared only |

## Acceptance Criteria Coverage: actual defects fixed

1. At 390x844, clicking the lower FAQ's app CTA left scrollY 1213, with the
   focused textarea from y=-540 to -435. `showView` focused with preventScroll
   but did not bring the composer into view. It now centers that input when
   navigating to the app. Regression checks cover all six widths and verify
   landing draft retention when going back.
2. Product CSS reset reason-list left padding to zero while inherited bullet
   markers stayed absolutely positioned at left zero. Markers overlapped the
   first character. Restored a 20px text inset; screenshots verify separation.
3. The old `.evidence-content#evidence-empty p` selector overrode the newer text
   style. Its #819485 text on white was below 4.5:1. The matching selector now
   applies #536875 and 14px text, above 4.5:1. No general restyling occurred.

## Detection coverage: facts, not accuracy claims

`lib/analyze.mjs` detects or reports:

- Exact matches to the four manually curated NCC-reported threat hosts:
  secure-verifymydevice.ng, verifymydevice.com.ng,
  embed-ncc.registrmydevice.ng and verifymydevice.ng.
- A small separate set of exact NCC-documented official hostnames; hostname
  matching is not page/content/authenticity verification.
- HTTP, nonstandard ports, username/password URL syntax, IDN/punycode, a fixed
  shortener list, selected external-redirect parameter patterns, misleading
  domain-looking subdomains, limited familiar-name letter/number substitutions,
  NCC-lookalike text and subdomains of listed threat hosts.
- Message urgency and sensitive-information wording, with limited suppression
  for negated advice; message-only analysis with no invented hostname.
- Malformed/unsupported/private/raw-IP addresses and multiple distinct links
  produce inconclusive/review-required results rather than safety judgments.

The only confirmed-threat source is the **small manually curated NCC-CSIRT
advisory list**, linked to NCC-CSIRT-2610-040 (published 2026-10-30), whose exact
URL is retained in the analyzer and source evidence. There is no comprehensive
threat database, automated global reputation feed or live malicious-site scan.

The engine cannot establish safety, sender identity, story accuracy, current
site content, TLS validity, redirects' actual destinations, forms, downloads or
attachments. Legitimate HTTP, IDNs, urgency and sensitive-word contexts can flag;
novel phishing can pass with no configured warning. No accuracy, false-positive
or false-negative rate is inferred from fixtures or passing tests. The result
timestamp is processing time, not a live website-inspection timestamp.

## Quality Gates

- `npm test`: **306 total, 303 passed, 3 skipped, 0 failed**.
- `npm run check`: passed, including the amended browser regression helper.
- `CHROMIUM_PATH=/tmp/oya-product-chrome OYACHECK_RUN_LIVE_DEMO=1 npm run demo:live`:
  **3 passed, 0 failed** (the default suite's three opt-in skips, synthetic only).
- `npm ls --depth=0`: exact pinned dependencies installed.
- `npm audit --omit=dev`: **0 vulnerabilities**, no dependency changes.
- Production/read-only `npm run release:check`: passed; offline registration
  status is not a chain audit and does not override the existing real evidence.
- Full tracked-text secret-pattern scan: zero findings. Changed files manually
  reviewed. No ignored key stores or secret env files were read. This is a
  bounded pattern scan, not an exhaustive guarantee; gitleaks is not installed.
- `git diff --check`: passed. No build script exists; Node serves source directly.
- Chromium actual HTTP: zero external website requests and zero financial
  requests; no page errors. No live Groq completion or real audio capture.
- Original registration journal/hash-file SHA-256 values remain exactly those
  in `docs/REGISTRATION-RECOVERY-FORENSICS.md`; no new reservation.

## Production Differences and release process

Read-only Render inspection: service `srv-dbng37tg1s2s73ck2970`, Frankfurt/free,
linked repo `Alike001/oyacheck`, branch `chore/public-beta-deployment`, auto-deploy
**off**. Live deploy `dep-dbnk7emc6qcc73e4ia6g` serves
`4a1ab5bd57d4f2c7c8aa75f8a79e2b6d045b9b81`.

Remote feature branch is still at that SHA; linked release branch is at
`638e61fff3256a8dce74b6937dddc9a888559c8c`; main is at
`41b04233a8430975d498d5ab502596700449ab0e`. Recheck refs before later publication.

Production HTTP: homepage 200 on bounded recheck (first request timed out),
`/app` 404, metadata 200 with registrations empty and x402Support false, health
200 with financial/demo features false, financial/demo routes 403. Candidate
local HTTP: `/` and `/app` 200, metadata 200 with ID 10051, same disabled gates.
Initial Node fetch attempts to local port 4190 failed with its restricted-port
error; curl and Chromium verified actual HTTP. This is a test-client restriction.

Relative to production, the candidate adds landing/app UX, general input-mode
and parser improvements, metadata registration and isolated operator/recovery
helpers and evidence. Financial execution/storage policies and render.yaml have
**no diff** against the live commit. Mock findings are not in the application
response path; actual analysis recomputes them. `/__mock/stats` and operator/test
source routes return 404; synthetic public lab routes return 403.

The actual dashboard build is `npm ci --include=dev && npm run check && npm test`;
start is `npm start`. There is **no GitHub Actions workflow** in this repository,
so no candidate GitHub CI pass is claimed. Existing Render build checks enforce
tests; the independent release preflight must also be run with production flags.
Changing the build command is not included in this release approval scope.

After separate owner approval only:

1. Recheck origin URL, branch refs, clean working tree and exact approved SHA.
   Verify old remote feature head is its ancestor. Fast-forward push that exact
   SHA to `refs/heads/fix/ai-reliability-mobile`, without force. Literal commands
   are recorded in the local release-plan handoff after the SHA is known.
2. Confirm all four browser/mainnet flags remain 0, NODE_ENV production,
   OYACHECK_READ_ONLY 1, public agent wallet unchanged and purchase DB unset.
   Never add a wallet, purchase journal or spending capability to free Render.
3. Render Dashboard > Manual Deploy > **Deploy a specific commit**, paste the
   approved SHA from the same linked repository. Do not use Deploy latest commit:
   that targets the linked release branch. Keep auto-deploy off. Current MCP
   trigger cannot select a SHA. If exact-SHA deployment is unavailable and a
   protected-branch merge becomes necessary, stop for separate approval.
4. Inspect build results, Live status and actual deployed SHA, then run the
   bounded smoke plan below. See [Render exact-commit docs](https://render.com/docs/deploys).

## Post-deployment smoke and rollback

Bounded smoke, with explicit `explain:false` and no audio, signing or paid calls:

- GET `/`, `/app`, `/product.css`, `/app.js`, `/api/health`: 200 and correct types;
  health browser/mainnet/demo flags false. Inspect actual deploy SHA separately.
- GET `/agent-registration.json`: 200 JSON, real agentId 10051 and
  `eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`, stable tokenURI
  `https://oyacheck-beta.onrender.com/agent-registration.json`, one real web
  endpoint `https://oyacheck-beta.onrender.com/`, x402Support false.
- Four controlled POST `/api/analyze` calls: example.org URL unverified; userinfo
  confusion warns and shows real host; OTP wording suspicious; harmless no-link
  message unverified. No arbitrary submitted URL is fetched.
- Financial/demo GETs remain 403, mock route 404. No paid route is invoked as a
  purchase. One desktop/mobile landing-to-result smoke, keyboard and history.
- No fake scan results, source invention, guarantee language or exposed inputs.

If build/deploy/critical smoke fails, stop. Roll back to Live deploy
`dep-dbnk7emc6qcc73e4ia6g` / commit
`4a1ab5bd57d4f2c7c8aa75f8a79e2b6d045b9b81`. Dashboard rollback reuses the target
artifact and selected historical config; verify flags again because deploy env
and environment-group behavior can differ. Do not assume rollback preserves
current env. Keep auto-deploy off and record the resulting SHA. If its artifact
is unavailable, manually redeploy the exact known-good SHA only within approved
rollback scope. Restore the old HTTP baseline (/app 404 is expected there).
Never erase/restore-over operational journals or re-register the identity.
[Render rollback docs](https://render.com/docs/rollbacks).

## Gaps And Risks / Follow-ups

No blocker found for this limited read-only beta after the three fixes. Physical
mobile microphone/keyboard behavior and fresh live AI quality are unverified;
prepared guidance and typed checks function without them. Headless responsive
checks and the targeted contrast fix do not equal a complete accessibility audit.
Lack of global threat coverage is a product limitation disclosed throughout,
not a reason to label unknown links safe. Paid/general browsing remains outside
this release. Owner authorization to push/deploy is still required.

## Evidence Log

Ignored local artifacts under `.playwright-mcp/final-acceptance/`: eight PNGs,
HTTP response evidence, financial/mock gate results, secret-pattern scan and the
exact-SHA release plan. Chromium scripts use reserved/controlled examples and
actual local analysis. Screenshot capture resets scroll before full-page output;
no findings were edited or fabricated. Audit and the three defect fixes belong
to the focused acceptance commit; generated screenshots are not committed assets.
