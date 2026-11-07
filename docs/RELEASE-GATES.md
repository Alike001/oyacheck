# Release gates — 2026-11-04

## Gate A — read-only web interface
- [x] English and written Pidgin support
- [x] Source-linked NCC known-phishing findings
- [x] Official hostname match never labelled a safe page
- [x] Unknown and suspicious separated from confirmed phishing
- [x] No automatic browser fetches
- [x] Optional AI cannot override deterministic findings
- [x] Privacy-preserving AI input (sanitized evidence only)
- [x] Node test suite and syntax checks
- [ ] User reviews Pidgin wording
- [ ] User runs browser/mobile tests on their device

## Gate B — isolated browser investigation (NOT READY)
- [ ] Strict IP/DNS and redirect validation, including anti-rebinding protections
- [ ] Only safe allowlisted origins are opened; known-phishing links remain blocked
- [ ] Audited URL resolution; max redirects and timeouts
- [ ] No form submission, credentials, downloads or unapproved interactions
- [ ] Backend-only wallet and browser tokens
- [ ] Quote-before-pay, max charge and daily budget limits
- [ ] Verify actual DOM/page fields, final URL, and redact outputs
- [ ] Confirm independent user flow has a genuine need for the paid browser
- [ ] Real Celo mainnet x402 receipt and PayTo wallet registered in entry

## Gate C — competition submission (NOT READY)
- [ ] Public repo, How to Test section top of README
- [ ] ERC-8004 identity on Celo mainnet
- [ ] Qualifying independent users / truthful usage evidence
- [ ] Mainnet buy service call(s) contributing to actual user tasks
- [ ] Browser/mobile E2E tests and meaningful negative cases
- [ ] 2-minute real screen demo showing verifiable results
- [ ] Submission by 2026-11-09 09:00 GMT


## v0.5 conversation-first user experience
- The interface has a **single** message composer and a separate live evidence desk.
- A natural-language question without a link goes through `/api/ask`, not the invalid-link route.
- A link/message containing one link goes through `/api/analyze`; follow-ups use `/api/chat`.
- The UI distinguishes live AI responses from offline prepared guidance.
- In our sandbox, browser navigation to localhost is administratively blocked; desktop and mobile static layouts plus mocked browser interactions were checked separately. Real local browser acceptance remains necessary.

## v0.6: sandbox-only official-source inspection
- [x] Optional, explicit quote and purchase controls on local development server
- [x] Fixed official-source browser target; submitted suspicious URLs never navigated
- [x] Per-purchase and in-process sandbox spending caps, plus no auto retries
- [x] Backend-only browser session credential; short-lived screenshot memory
- [x] Live source title/text check and gateway transaction reference in evidence desk (implementation)
- [x] Unit tests for quote validation, source allowlist, payment gating
- [ ] Real paid Celo Sepolia v0.6 source-inspection result checked by user
- [ ] Browser screenshot from actual rented session checked by user
- [ ] Independent dynamic unknown-link inspection, with safe redirect handling and threat-isolated rendering
- [ ] Production quality spend limits, persistence, security review, and qualifying mainnet proof


## v0.7 voice gate
- [ ] English microphone transcription on Chrome with actual microphone
- [ ] Pidgin transcription evaluated by a native speaker, errors recorded
- [ ] No transcript automatically sent to model or blockchain
- [ ] Spoke replies auditioned on phone (en-NG voice may not be available)
- [ ] User can cancel speech / stop sound / deny microphone permission without breaking text
- [ ] Mainnet remains disabled; separate transaction approval required

## v0.8 — voice handoff

- [x] Automatic question submission after transcription (no second Send click)
- [x] Spoken answers enabled by default with manual Listen fallback
- [x] Voice text with domains, contact details or likely secrets requires review
- [x] Offline/Groq fallback clearly labelled as non-AI
- [x] 117 automated tests passing; mock Chromium path verified
- [ ] Actual microphone recording with live Groq STT and TTS playback on a user's device
- [ ] Natural Pidgin recognition and spoken accent validated by speaker
- [ ] Live website investigation and Celo mainnet purchase proof


## v0.9 — microphone end-of-speech gate

- [x] Short-pause auto-stop state machine with live microphone energy monitoring
- [x] Silence/no-speech timeout, hard duration limit and manual Stop fallback
- [x] No automatic submission for dictated URLs or sensitive content
- [x] 126 local tests passed
- [x] Simulated Chromium: Speak → silence → STT → chat → spoken answer, no extra click
- [ ] Live Chrome/Ubuntu microphone and Groq Whisper validated by user
- [ ] Pidgin natural cadence and pause durations checked with speaker
- [ ] Real browser audio output and microphone permissions tested on mobile
- [ ] Mainnet browser purchases, ERC-8004 identity and independent users validated
