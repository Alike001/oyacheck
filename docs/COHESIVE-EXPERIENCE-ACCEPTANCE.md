# Cohesive OyaCheck experience acceptance

Base: `2cb300743ec11959c25b636bbdb378ec81680d4a`, branch `fix/ai-reliability-mobile`.
Direction: [OYACHECK-DESIGN-DIRECTION.md](OYACHECK-DESIGN-DIRECTION.md).
Local landing: http://127.0.0.1:4190/ — checker/results: http://127.0.0.1:4190/app.

## Implemented

Original bracket/check mark and SVG signal window, deep navy/aqua landing,
self-hosted existing Lato, restrained light evidence surfaces, visible English and
Naija Pidgin buttons before starting, and a shared interaction language throughout.
The checker keeps one vertical flow; the input collapses after a finding. Exact
risk label, actual hostname, reasons, next steps and plain-language guidance lead.
No external component, shader, image, font or framework was imported.

Text, speech hint and next-check language now follow the visible input language
choice. A completed result retains its own English/Pidgin explanation controls.
Landing submission transfers mode, language and draft to the real checker without
query strings or storage. Browser history retains in-memory drafts without sending
another request. Optional questions, AI and voice preferences remain secondary.

Four user-triggered sample checks use the actual deterministic API: misleading
userinfo address, suspicious OTP message, ordinary example.org URL and a hostname
from the existing published NCC advisory. These are explicitly labelled controlled
samples/published evidence, never invented customer reports or prewritten verdicts.

The SVG signal geometry responds only to measured listening RMS. It stays flat
at zero, outside Listening and under reduced motion. Browser recognition exposes
no PCM; its listening state has no fake amplitude. Speaking is shown by genuine
utterance state and a result-heading label, not simulated output levels.

A received transcript now enters Reviewing. Missing browser recognition plus
unconfigured server transcription reports unavailable before a microphone attempt.
Recording, cancellation epochs, timeouts, track release and optional playback use
the existing controller and providers. No provider call was made in this task.

A real safety defect was fixed: optional voice auto-send could miss a phrase such
as “my OTP 123456” because the old sensitive pattern required “is/na” and its digit
pattern required seven digits. Sensitive terms, plural/spaced abbreviations and
four-or-more digits now conservatively require review, even with ordinary-question
auto-send enabled. This may also require review of harmless questions about OTPs;
it does not classify such questions as scams. Default auto-send remains off.

## Results

- `npm run check`: passed.
- `npm test`: **336 passed, 3 skipped, 0 failed** (339 total). This includes all
  existing payment, identity, registration, authorization and durable-store tests.
- `CHROMIUM_PATH=/tmp/oya-cohesive-chrome OYACHECK_RUN_LIVE_DEMO=1 npm run demo:live`:
  **3 passed, 0 failed**. The wrapper invokes installed Chrome with `--disable-gpu`.
  These tests inspect owned synthetic pages; no financial service is called.
- `npm audit --audit-level=low`: **0 vulnerabilities**; no dependency changes.
- Read-only production release preflight: passed, all financial/demo flags zero,
  no purchase database configured. This environment check does not re-query the
  ERC-8004 registry or invalidate the existing verified identity evidence.
- `git diff --check`: passed.

`verify-product-browser.mjs` passed in real Chromium at **320, 360, 390, 412, 768,
1440px**, with no horizontal overflow, external requests, financial requests or
page errors. It verifies actual API labels, full deterministic reasons and hosts;
userinfo confusion; example.org and unmatched legitimate URLs; malformed input;
suspicious OTP and harmless messages; language changes; explicit AI opt-in and
prepared fallback; loading/error/retry; another-check flow; keyboard focus; FAQ;
back/forward; drafts and input privacy; real sample buttons. Added checks confirm
landing Pidgin selection reaches the actual analysis request and preserves draft.
Optional speech and permission failures in this product regression use explicit
browser test doubles; no live provider or fake threat verdict is involved.

`verify-voice-browser.mjs` passed with genuine Chromium getUserMedia, MediaRecorder
and Web Audio, using a synthetic English PCM file. It verifies measured signal
movement, reset to flat outside capture, all six listening widths, track release,
Stop/Cancel, cancellation of late transcripts, editable draft preservation,
Reviewing, blocked sensitive auto-send, actual analyzer handoff and reduced-motion
signal behavior. First recording: 17,684 bytes of audio/webm;codecs=opus. These
bytes come from synthetic media, not a physical microphone. Transcription replies,
configured-health switch and playback are mocked in that helper. Neither real
recognition quality nor audible output is established by this automated test.

Primary palette contrast calculations: dark body 10.41:1, hero aqua 11.94:1,
muted body 5.52:1, white microphone label 6.71:1, selected language 7.34:1.
These sampled pairs are not a claim of a comprehensive accessibility certification.
Keyboard focus, control targets and reduced motion were also checked in Chromium.

## Screenshots

Local ignored artifacts under `.playwright-mcp/cohesive/`:

| State | Before | After |
| --- | --- | --- |
| Landing desktop | before/landing-1440.png | after/landing-desktop.png |
| Landing mobile | before/landing-390.png | after/landing-mobile.png |
| Empty checker desktop | before/checker-1440.png | after/checker-desktop.png |
| Empty checker mobile | before/checker-390.png | after/checker-mobile.png |

The final landing and empty-checker images use an unmocked local page with browser
speech fallback. The following full-page screenshots are also available:

- `after/link-desktop.png`, `after/link-mobile.png`: actual suspicious userinfo result.
- `after/message-desktop.png`, `after/message-mobile.png`: actual OTP-message finding.
- `after/pidgin-desktop.png`, `after/pidgin-mobile.png`: actual Pidgin explanation.
- `after/voice-ready-{desktop,mobile}.png`, `after/voice-listening-{desktop,mobile}.png`,
  `after/voice-error-{desktop,mobile}.png`, `after/voice-reviewing-mobile.png`:
  explicitly controlled-media/provider tests, not physical acceptance evidence.
- `after/browser-recognition-error-{desktop,mobile}.png`: unmocked recognition
  `not-allowed` in the automation profile, not the owner's ordinary Chrome.

## Identity and production protections

Local HTTP: `/`, `/app`, `/agent-registration.json` all **200**;
`/api/buy/inspect`, `/api/mainnet/quote`, `/api/demo/inspect` all **403**.
Health reports mainnet preparation, sandbox inspection, demo and live-page
inspection disabled. Local AI and server transcription credentials are absent.
The local diagnostics route remains explicitly opt-in and denied on Render.

Public registration JSON is unchanged: Agent ID **10051**, same registry and
stable HTTPS URI, truthful web service, `x402Support:false`. The favicon at the
same image URI now uses the original OyaCheck mark; metadata fields are unchanged.
Registration journal SHA-256 remains
`29fe8e0fc0d73f36f93144d8cfd9fdd48e6857abb695b6dc2bce96f9ca2c9ff8`;
transaction-file SHA-256 remains
`4d6a9ff39d1fdb74878c6abe84f41ab5534d77f5a153ccd35a9b8581c33a72cb`.

## Release decision and remaining gates

**GO for text-first, read-only publication**, subject to separate owner push and
deployment approval. This checkpoint does not publish. No engine rewrite, target
website navigation, onchain operation, billable request, signing or spending.

**NO-GO for claiming verified speech input or natural Pidgin recognition.** Audible
TTS was owner-confirmed at the prior checkpoint; physical microphone energy,
genuine English/Pidgin transcripts and physical Stop/Cancel still need acceptance
in ordinary Chrome through the existing local diagnostics. Automation-profile
recognition remains `not-allowed`; that does not establish the owner's permission.
Linux TTS guidance and the confirmed local Speech Dispatcher correction remain in
[LOCAL-VOICE-DIAGNOSTICS.md](LOCAL-VOICE-DIAGNOSTICS.md). No packages were installed.

Detection remains URL/message heuristics plus the small curated NCC advisory
list. It cannot establish sender authenticity, inspect the live target, follow
redirects, read attachments, consult comprehensive reputation feeds or guarantee
safety. No accuracy percentage or new coverage claim is made.

Changed files: `public/index.html`, `public/product.css`, `public/favicon.svg`,
`public/app.js`, `public/signal.js`, `public/voice-policy.js`,
`public/voice-session.js`, `server.mjs`, `package.json`,
`scripts/verify-product-browser.mjs`, `scripts/verify-voice-browser.mjs`,
`test/signal.test.mjs`, `test/voice-turn.test.mjs`, `test/voice-session.test.mjs`,
`docs/OYACHECK-DESIGN-DIRECTION.md`, and this acceptance document.
