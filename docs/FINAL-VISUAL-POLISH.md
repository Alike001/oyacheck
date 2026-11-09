# Final bounded visual polish

Base: `0706ec36652795fb4c3cdc85eac059be96ce4bb0`.
Local landing: http://127.0.0.1:4190/ · checker: http://127.0.0.1:4190/app.

## Visual diagnosis and changes

Reviewed the actual landing/checker at 1440 and 390px before editing. Also opened
[Jagora's public app](https://jagora-ai.vercel.app/app) in Chromium. It currently
presents an account entry screen; no account was created and its authenticated
browser/voice interactions were not inspected. The comparison is limited to the
visible visual hierarchy, identity, language selection, surface depth and mobile
composition. Its [repository](https://github.com/Ememzyvisuals/Jagora) is reference
context only. No source components, shaders, assets, fonts, sky/cloud visuals or
branding were copied.

| Objective deficiency | Bounded correction |
| --- | --- |
| Assistant was a small, flat meter with little identity or hierarchy. | Original nested angular aperture extends OyaCheck's existing bracket mark. Larger signal, clear state label and shared navy/aqua voice surface. |
| Speak looked like a secondary utility; mode tabs led the checker. | Speak is a larger aqua control, above text modes; Stop uses a warm active colour and Cancel stays explicit. Text input and submit remain visible in the same flow. |
| Flat hero and thin divider gave the interaction no depth. | Restrained radial light, a single inset interaction surface, tonal borders and soft shadows. Existing typography and page sections retained. |
| Repetitive introduction delayed controls on mobile. | Shorter hero and checker copy, reduced introductory spacing and a 320px headline adjustment that avoids an orphaned final word. |
| Checker examples were hidden and lacked a misleading URL. | Three visible labelled samples: bank message, misleading URL and harmless message. Each calls the real analyzer and selects the matching mode. Disabled during analysis/capture. |
| Small secondary labels and weak result surface separation. | Larger evidence/disclosure labels, clearer hostname edge, restrained elevation and a compact 320px explanation disclosure. Deterministic labels, reasons and provenance retained. |

The original Lato, heading hierarchy, single-column results, how-it-works sequence,
privacy/limitations and optional technical disclosure were already useful; retained.
No new dependencies, decorative content sections, nested scrolling or metrics.

The seven marks still use only measured RMS through the existing signal renderer.
No fabricated idle/listening wave, processing amplitude or speaking amplitude. At
zero energy, outside listening and under reduced motion the marks stay flat. State
styling and a short result entrance transition communicate real events.

## Verification

- `npm run check`: passed.
- `npm test`: **336 passed, 3 skipped, 0 failed** (339 total).
- `CHROMIUM_PATH=/tmp/oya-cohesive-chrome OYACHECK_RUN_LIVE_DEMO=1 npm run demo:live`:
  **3 passed, 0 failed**. Owned synthetic pages only, no financial service.
- `npm audit --audit-level=low`: **0 vulnerabilities**.
- `OYACHECK_READ_ONLY=1 BUY_BROWSER_SANDBOX=0 OYACHECK_DEMO_BROWSER=0 OYACHECK_MAINNET_PREPARE=0 OYACHECK_MAINNET_EXECUTE=0 npm run release:check`: passed.
- `git diff --check`: passed.

Real Chromium product checks passed at **320, 360, 390, 412, 768, 1440px**:
no horizontal overflow, page errors, external requests or financial requests.
All three visible sample chips were activated with Enter at every width; output
labels, analysis modes, hosts and full reasons match the actual API. The harmless
sample remains unverified and never receives a safe-site guarantee.

Also checked landing submission/mode/language transfer, back/forward without
resubmission, drafts, URL and message keyboard entry, English/Pidgin result changes,
Edit/Back-to-result, another check, real clipboard evidence, optional AI opt-in and
prepared fallback, question language and playback controls, loading/error/retry,
private-input storage protections, all four FAQ disclosures by keyboard, privacy
navigation and actual metadata navigation. Existing request rate limits are kept;
the expanded browser harness paces analysis requests to stay within them.

Real Web Audio/MediaRecorder capture with **synthetic PCM** passed measured-level
response, Stop, Cancel, track release, silence discard with no upload, late-result
cancellation, transcript review, sensitive auto-send blocking, landing handoff and
reduced motion. Transcription responses and output playback in that test are
explicit doubles. Ordinary browser recognition in the automation profile reports
`not-allowed` at all three screenshot widths and leaves typing available.

**Physical microphone, genuine English/Pidgin transcription and audible playback
were not accepted in this pass.** No transcription-provider request or billable AI
call was made. Synthetic capture success is not evidence of hardware or recognition
quality. Prior owner-confirmed TTS is not reclassified as a new test.

Browser evidence: `.playwright-mcp/final-polish/after/browser-results.json` and
`controls-results.json`. Local runners used the existing installed Playwright at
`/home/ali/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs`, with
`/usr/bin/google-chrome --no-sandbox --disable-gpu`. Product/voice helpers are in
`scripts/verify-product-browser.mjs` and `scripts/verify-voice-browser.mjs`.
Local runner scripts: `/tmp/oya-polish-verify.mjs`,
`/tmp/oya-polish-voice-final.mjs`, `/tmp/oya-polish-controls.mjs` and
`/tmp/oya-polish-capture.mjs`. Isolated verification server: 127.0.0.1:4192;
unchanged baseline snapshot server: 127.0.0.1:4191. Owner review uses 4190.

## Security and release decision

Agent ID **10051**, Celo registry, metadata, deterministic engine and financial
protections are unchanged. Registration attempt SHA-256:
`29fe8e0fc0d73f36f93144d8cfd9fdd48e6857abb695b6dc2bce96f9ca2c9ff8`;
transaction journal:
`4d6a9ff39d1fdb74878c6abe84f41ab5534d77f5a153ccd35a9b8581c33a72cb`.
Public metadata SHA-256:
`7abf5c414da8f0ac1c24d00e16bd019c87e895d32160ce9847f9dd4ae1583a77`.
The environment preflight honestly reports wallet/registration verification as
unconfigured; it does not re-query or alter the preserved registration evidence.

**GO for read-only, text-capable publication and owner visual review.**
**NO-GO for claiming physical voice/transcription acceptance.** URL/message pattern
checks and the narrow curated advisory list remain the detection scope. No live
reputation lookup, sender verification or safe-site guarantee was added.
No signing, funding, purchases, wallet operations, push, merge, deployment or
submission occurred.

## Screenshot inventory

All paths below are relative to the repository root
`/home/ali/Desktop/celo/official-link-agent/`. PNG artifacts are intentionally local
and git-ignored. Captures are full page, viewport height 900px; screenshots disable
CSS animation to avoid partially faded result captures. Listening captures use
actual measured synthetic input, never injected visual energy.

| State | 1440px | 390px | 320px |
| --- | --- | --- | --- |
| before landing | [.playwright-mcp/final-polish/before/landing-1440.png](../.playwright-mcp/final-polish/before/landing-1440.png) | [.playwright-mcp/final-polish/before/landing-390.png](../.playwright-mcp/final-polish/before/landing-390.png) | Not requested |
| before checker | [.playwright-mcp/final-polish/before/checker-1440.png](../.playwright-mcp/final-polish/before/checker-1440.png) | [.playwright-mcp/final-polish/before/checker-390.png](../.playwright-mcp/final-polish/before/checker-390.png) | Not requested |
| after landing | [.playwright-mcp/final-polish/after/landing-1440.png](../.playwright-mcp/final-polish/after/landing-1440.png) | [.playwright-mcp/final-polish/after/landing-390.png](../.playwright-mcp/final-polish/after/landing-390.png) | [.playwright-mcp/final-polish/after/landing-320.png](../.playwright-mcp/final-polish/after/landing-320.png) |
| after checker | [.playwright-mcp/final-polish/after/checker-1440.png](../.playwright-mcp/final-polish/after/checker-1440.png) | [.playwright-mcp/final-polish/after/checker-390.png](../.playwright-mcp/final-polish/after/checker-390.png) | [.playwright-mcp/final-polish/after/checker-320.png](../.playwright-mcp/final-polish/after/checker-320.png) |
| after result-bank | [.playwright-mcp/final-polish/after/result-bank-1440.png](../.playwright-mcp/final-polish/after/result-bank-1440.png) | [.playwright-mcp/final-polish/after/result-bank-390.png](../.playwright-mcp/final-polish/after/result-bank-390.png) | [.playwright-mcp/final-polish/after/result-bank-320.png](../.playwright-mcp/final-polish/after/result-bank-320.png) |
| after result-misleading | [.playwright-mcp/final-polish/after/result-misleading-1440.png](../.playwright-mcp/final-polish/after/result-misleading-1440.png) | [.playwright-mcp/final-polish/after/result-misleading-390.png](../.playwright-mcp/final-polish/after/result-misleading-390.png) | [.playwright-mcp/final-polish/after/result-misleading-320.png](../.playwright-mcp/final-polish/after/result-misleading-320.png) |
| after result-harmless | [.playwright-mcp/final-polish/after/result-harmless-1440.png](../.playwright-mcp/final-polish/after/result-harmless-1440.png) | [.playwright-mcp/final-polish/after/result-harmless-390.png](../.playwright-mcp/final-polish/after/result-harmless-390.png) | [.playwright-mcp/final-polish/after/result-harmless-320.png](../.playwright-mcp/final-polish/after/result-harmless-320.png) |
| after voice-ready | [.playwright-mcp/final-polish/after/voice-ready-1440.png](../.playwright-mcp/final-polish/after/voice-ready-1440.png) | [.playwright-mcp/final-polish/after/voice-ready-390.png](../.playwright-mcp/final-polish/after/voice-ready-390.png) | [.playwright-mcp/final-polish/after/voice-ready-320.png](../.playwright-mcp/final-polish/after/voice-ready-320.png) |
| after voice-listening | [.playwright-mcp/final-polish/after/voice-listening-1440.png](../.playwright-mcp/final-polish/after/voice-listening-1440.png) | [.playwright-mcp/final-polish/after/voice-listening-390.png](../.playwright-mcp/final-polish/after/voice-listening-390.png) | [.playwright-mcp/final-polish/after/voice-listening-320.png](../.playwright-mcp/final-polish/after/voice-listening-320.png) |
| after voice-transcribing | [.playwright-mcp/final-polish/after/voice-transcribing-1440.png](../.playwright-mcp/final-polish/after/voice-transcribing-1440.png) | [.playwright-mcp/final-polish/after/voice-transcribing-390.png](../.playwright-mcp/final-polish/after/voice-transcribing-390.png) | [.playwright-mcp/final-polish/after/voice-transcribing-320.png](../.playwright-mcp/final-polish/after/voice-transcribing-320.png) |
| after voice-reviewing | [.playwright-mcp/final-polish/after/voice-reviewing-1440.png](../.playwright-mcp/final-polish/after/voice-reviewing-1440.png) | [.playwright-mcp/final-polish/after/voice-reviewing-390.png](../.playwright-mcp/final-polish/after/voice-reviewing-390.png) | [.playwright-mcp/final-polish/after/voice-reviewing-320.png](../.playwright-mcp/final-polish/after/voice-reviewing-320.png) |
| after voice-speaking | [.playwright-mcp/final-polish/after/voice-speaking-1440.png](../.playwright-mcp/final-polish/after/voice-speaking-1440.png) | [.playwright-mcp/final-polish/after/voice-speaking-390.png](../.playwright-mcp/final-polish/after/voice-speaking-390.png) | [.playwright-mcp/final-polish/after/voice-speaking-320.png](../.playwright-mcp/final-polish/after/voice-speaking-320.png) |
| after voice-cancelled | [.playwright-mcp/final-polish/after/voice-cancelled-1440.png](../.playwright-mcp/final-polish/after/voice-cancelled-1440.png) | [.playwright-mcp/final-polish/after/voice-cancelled-390.png](../.playwright-mcp/final-polish/after/voice-cancelled-390.png) | [.playwright-mcp/final-polish/after/voice-cancelled-320.png](../.playwright-mcp/final-polish/after/voice-cancelled-320.png) |
| after voice-error | [.playwright-mcp/final-polish/after/voice-error-1440.png](../.playwright-mcp/final-polish/after/voice-error-1440.png) | [.playwright-mcp/final-polish/after/voice-error-390.png](../.playwright-mcp/final-polish/after/voice-error-390.png) | [.playwright-mcp/final-polish/after/voice-error-320.png](../.playwright-mcp/final-polish/after/voice-error-320.png) |
| after browser-recognition-error | [.playwright-mcp/final-polish/after/browser-recognition-error-1440.png](../.playwright-mcp/final-polish/after/browser-recognition-error-1440.png) | [.playwright-mcp/final-polish/after/browser-recognition-error-390.png](../.playwright-mcp/final-polish/after/browser-recognition-error-390.png) | [.playwright-mcp/final-polish/after/browser-recognition-error-320.png](../.playwright-mcp/final-polish/after/browser-recognition-error-320.png) |

Reference captures: `.playwright-mcp/final-polish/before/jagora-reference-1440.png` and `jagora-reference-390.png`. These show the public account entry screen only.
