# OyaCheck focused UX redesign

Baseline: 6b1f6222073682bbec2891e96a0739b96fc1eab3. Same existing Node/vanilla
application, engine, APIs and Render start/build contract. No push, deployment,
registration, wallet operation, purchase or signing was performed.

## Problems addressed

The previous acceptance review checked correctness but left a chat-first interface
with two equally dominant panes, competing controls, duplicated verdict text,
nested conversation scrolling and technical detail visible before the next step.
Default inputs looked like examples, while advanced voice and AI settings crowded
the core interaction. The landing hierarchy relied on repeated explanatory blocks
and small print rather than a clear primary action.

The redesign changes the information architecture:

- A lighter editorial landing with a navy entry card, a serif accent in the hero,
  locally served Lato UI fonts, restrained teal, fewer sections and larger body
  copy. Font files are intentional licensed assets, with the SIL OFL notice
  bundled and served locally; no external font/CDN tracking request.
- Neutral empty input; Link/Forwarded message choices. Examples are explicitly
  labelled and run the actual analyzer only when clicked. The interactive product
  preview has no prewritten threat verdict and does not visit its example URL.
- One centered checker/result column. After a completed check, the editor becomes
  a compact Edit summary. A user can edit, return to the result or start another
  check. Message Enter inserts a newline; Link Enter submits; Ctrl/Command+Enter
  can explicitly submit a message.
- A result headed by the exact deterministic label, actual domain/message scope,
  concise warning summaries and next steps. Full original reason text/codes,
  timestamps, coverage and limits remain in Evidence & technical details.
  Informational reasons are retained there instead of repeated beside warnings.
  Friendly summaries change wording, not the underlying finding or provenance.
- Optional English/Pidgin explanation, audio and AI disclosure. Language/AI updates
  retain the result, current draft and question thread. Checking the AI box alone
  makes no request. Updating is an explicit action; prepared fallback is labelled.
- Optional voice settings and an optional supporting question form. Neither
  competes with the primary two-mode checker. Chat uses document scrolling, not
  another scroll pane. Questions have their own draft and reply-language choice;
  they cannot overwrite an unsent link/message. Voice auto-send and auto-play
  default off, while their existing opt-in functionality is preserved.

No new framework, paid service, threat database or arbitrary-site browsing was
introduced. The small NCC list and URL/message heuristics remain exactly as before.
No known threat found is never a safe verdict. Sender/story authenticity, live
pages, TLS, forms, redirects, attachments and comprehensive reputation remain
unverified. No accuracy or false-positive/false-negative rate is claimed.

## Same-state before/after evidence

Captured from the actual local app at 1440px and 390px, before changing the UI and
again after completion. Each set has landing, empty checker, completed userinfo
URL and completed bank OTP message, eight PNGs per set:

```text
.playwright-mcp/redesign/before/landing-desktop.png
.playwright-mcp/redesign/before/landing-mobile.png
.playwright-mcp/redesign/before/checker-desktop.png
.playwright-mcp/redesign/before/checker-mobile.png
.playwright-mcp/redesign/before/link-desktop.png
.playwright-mcp/redesign/before/link-mobile.png
.playwright-mcp/redesign/before/message-desktop.png
.playwright-mcp/redesign/before/message-mobile.png
```

Matching after files have the same names under `.playwright-mcp/redesign/after/`.
The same userinfo input is `https://example.org@unrelated.example/account`; the
same message is `Final notice: your bank account is blocked. Send your OTP
immediately.` All displayed verdicts came from the real analyzer. Screenshots
are ignored review artifacts, not deployed/generated production assets. A separate
`live-preview-desktop.png` captures the explicitly run real product example.

## Visual review, separate from test counting

The screenshots were inspected directly, without claiming a second human or
external reviewer. Before/after comparisons show the following structural gains:

- The hero has a clear reading order and one obvious check action; a labelled
  example is distinct from the user's own input.
- The empty phone checker fits one task rather than presenting settings plus
  a chat transcript plus an empty evidence pane.
- Completed results put the finding, actual domain and action in one reading
  path. The full editor and optional conversation no longer precede the result.
- Voice, AI, dates and detailed evidence require a deliberate disclosure, keeping
  their function while removing default clutter. Body copy is larger and the
  disclosure labels and controls have visible keyboard focus.
- Message findings still require some document scrolling on a narrow phone;
  important reasons were not deleted to manufacture a shorter screenshot.

The new UI is coherent enough for owner review as a read-only beta. This does not
claim a formal accessibility audit, physical-device audio acceptance or live AI
quality validation. Optional disclosures trade an extra deliberate click for a
clearer primary task. Initial font delivery is local; no performance score was
invented or claimed.

## Actual checks and safeguards

- `npm test`: **308 total; 305 passed, 3 skipped, 0 failed**.
- `npm run check`: passed, including updated browser helpers.
- Opt-in synthetic Chromium tests: **3 passed**, the same three default skips.
- Real Chromium at **320, 360, 390, 412, 768 and 1440px**: no horizontal overflow,
  two primary input choices, single result column, collapsed optional controls,
  actual verdict/provenance preservation, history/draft retention and another check.
- Controlled fixtures: example.org and Wikipedia URL unverified; userinfo identifies
  unrelated.example; bank OTP wording suspicious without an invented host;
  ordinary lunch message unverified; malformed input inconclusive; exact curated
  NCC example retains its genuine published-source match.
- English/Pidgin preserve indicator codes; original complete reason text exactly
  matches the actual API response. AI opt-in uses the real prepared fallback on
  the key-free review server. No genuine Groq completion was requested here.
- Audio click wiring uses mocked playback. Browser speech unavailable/permission
  denial are mocked and restore typing. No physical microphone capture or real
  pronunciation claim. Voice automation defaults are now explicit opt-ins.
- Loading/duplicate prevention, mocked transport failure, retained input, explicit
  retry, keyboard path/FAQ and private query exclusion from navigation, storage,
  history state and report all pass. The real preview uses the actual API.
- Separate real-Chromium tests of sandbox and mainnet UI use financial fakes only:
  cancellation, expiry, invalid offers, receipt links, partial outcome, insufficient
  funds and reload recovery pass, with no real purchases or automatic retries.
- Local `/`, `/app`, metadata and self-hosted fonts return 200. Financial/demo
  routes return 403; `/__mock/stats` returns 404. Production headers/CSP remain.
- Production/read-only release preflight passed; dependency audit reports
  **0 vulnerabilities**. No dependency/lockfile changes. No build script is
  configured; the existing Render source-serving setup remains compatible.
- Changed-file secret/artifact review and `git diff --check` passed. Only intended
  font assets and their license are added; before/after screenshots stay ignored.
- Engine, paid adapters, durable ledger/recovery policy, release-policy, render.yaml
  and public agent metadata have no diff. Agent ID **10051**, its registered URI,
  registry, x402Support false and the original registration journal remain intact.
  Journal SHA-256 values still match the prior forensic record.

## Local review and release recommendation

Landing: http://127.0.0.1:4190/ ; checker: http://127.0.0.1:4190/app .

**GO for owner visual review and an explicitly approved read-only release.**
The exact candidate SHA is the local redesign commit reported in the handoff.
Do not reuse the older acceptance SHA when publishing. Keep all public financial
and demo flags off, purchase DB unset, and deploy only an approved exact SHA.
No insecure ephemeral spending store is introduced. Physical phone/microphone
acceptance and real AI quality remain follow-ups; typed deterministic checks
work independently. No push, merge, deploy or hackathon submission is authorized
by this recommendation.
