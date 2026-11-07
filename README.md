# OyaCheck — chat-first link evidence assistant (v0.9)

**Current status: local prototype. Not a comprehensive phishing detector or a completed Celo mainnet submission.**

The assistant accepts links and forwarded messages, supplies deterministic evidence-based findings, and answers English/Pidgin follow-up questions through Groq when a key is configured. Version 0.6 introduced an explicit, **sandbox-only** Celo buy feature that rents an isolated browser to check the **official NCC advisory only**. It does not visit unknown links or inspect their credential forms.

## How to test — start here

Use Ubuntu terminal with Node 22+ and the installed `@celo/buy` CLI.

```zsh
cd ~/Desktop/celo/official-link-agent
npm run check
npm test
read -rs 'GROQ_API_KEY?Groq API key: '
echo
export GROQ_API_KEY
npm run dev
```

Visit http://localhost:4173. Submit the reported phishing example; ask a question; switch English/Pidgin. To test automatic speech stopping, tap **Speak**, say one sentence, and pause for about 1.5 seconds without touching Stop. Ordinary questions automatically submit and speak a reply; dictated URLs are held for review. The labels `LIVE AI · GROQ` and `OFFLINE GUIDANCE · NOT AI` must remain accurate.

### Optional Celo Sepolia source inspection (uses TEST USDC)

**Do not attempt this until you want to make one more paid sandbox test.** The flow is disabled by default and all tests can run without it. If you choose to test the paid integration, stop the server, then run:

```zsh
cd ~/Desktop/celo/official-link-agent
BUY_BROWSER_SANDBOX=1 npm run dev
```

For Groq in the same terminal, export `GROQ_API_KEY` before starting as above. Open the app from **http://localhost:4173 on the same machine**. Scan the `secure-verifymydevice.ng` example, then use the new **LIVE OFFICIAL SOURCE CHECK · CELO BUY** panel in the evidence desk.

1. Click **Get free sandbox quote**. This retrieves the live **Celo Sepolia test USDC** price; it does not sign a payment.
2. Read the quoted price. The server enforces a **maximum of 0.01 TEST USDC per purchase**, at most **three test purchases per server day**, and **0.02 TEST USDC total** per running process. All these limits are process-memory test protections, not a production billing system.
3. Click **Approve ... test USDC** and confirm in the browser prompt. Only then will it purchase one 1-minute browser session. Session commands do not add further fees. There are **no automatic payment retries**.
4. The browser is only permitted to open the exact official NCC-CSIRT advisory URL. It retrieves the final URL, title, source text and, if possible, a screenshot. The result presents the gateway transaction identifier and whether the page text actually mentions the examined hostname.
5. For settlement confirmation, run separately: `buy --sandbox receipts --account sandbox --resolve`. Do not repurchase if a paid inspection is incomplete: check receipts first.

The feature is automatically **disabled for non-local connections** and has **no mainnet mode**. `BUY_BROWSER_SANDBOX=1` does not grant permission to spend real funds. Temporary browser credentials stay on the server and are never returned to the UI. Session screenshots expire from memory after 2 minutes.

### Why are we limiting the browser to the advisory?

Unknown or hostile websites can redirect to private addresses, attempt to steal credentials, deliver files, and contain prompt-injection instructions. The rented browser blocks private/local direct addresses, but it does not by itself prove every untrusted redirect is safe to inspect. Until a stronger redirection and DNS-rebinding guard is tested, our app will **not** open user-submitted suspicious links. The source check confirms published evidence, not what an unknown website currently displays.

The screenshot and live-source check do not automatically update the deterministic verdict or claim that phishing forms were examined. Unknown still means unknown. No private details, form submissions, logins, or credential inputs are part of this version.

## Important scope and AI limitations

- Known phishing: exact hostname from NCC-CSIRT advisory `NCC-CSIRT-2610-040`, October 30, 2026. That is a grounded published finding, not a live crawl.
- Official hostname: matches a documented host; this is **not** certification of the page or payment request.
- Suspicious signals and unverified findings are not equivalent to a confirmed phishing incident.
- Groq handles language and follow-up explanations and cannot override the deterministic verdict. If unavailable, replies are clearly marked offline guidance.
- The app keeps its conversation in browser memory and does not use a database. Do not paste passwords, OTPs, NIN, BVN or payment credentials.
- As of this version, **no Celo mainnet buy payment, ERC-8004 identity or independent-user activity has been verified**.

## Project files

- `server.mjs`: Node HTTP backend, security headers, request limits, local-only sandbox routes.
- `lib/analyze.mjs`: authoritative-host and URL-pattern analysis.
- `lib/general.mjs`, `lib/chat.mjs`, `lib/explain.mjs`: Groq explanations and follow-up logic.
- `lib/buy-browser.mjs`: free quote, explicit capped sandbox purchase, allowlisted official-source inspection, ephemeral screenshot.
- `lib/voice.mjs`: opt-in short audio transcription through Groq Whisper; no audio persistence.
- `public/`: OyaCheck conversation interface, voice controls and evidence desk.
- `test/`: deterministic, API and security-gate tests; never calls a paid service during `npm test`.
- `docs/`: source registry and release gates.

## Hackathon next gates

1. Verify the optional sandbox source-inspection integration end to end using a fresh quote, capture a real page title, screenshot, evidence and receipt.
2. Decide how to make paid browser inspection essential to a real user task rather than redundant with free checks. Do **not** claim it detects live credential-harvest patterns until we implement safe unknown-site handling.
3. Deploy publicly with proper security review, register ERC-8004, conduct real mainnet x402 purchases for useful external work, record transaction proofs, and find qualified independent users.
4. Add a polished landing page only after the main task is working. Keep the current original visual identity and do not reproduce any reference brand or interface.

Hackathon deadline: **Monday, November 9, 2026, 09:00 GMT (10:00 WAT)**.


## v0.8 — automatic voice Q&A (English + experimental Pidgin)

Product working name: **OyaCheck**. The internal directory `official-link-agent` stays unchanged for drop-in upgrades.

**Historical v0.8 behavior (superseded by v0.9 below):** With a Groq key loaded, tap **Speak**, say a short question, and tap **Stop** (or let the 18-second recording cap stop it). Transcription is sent to the OyaCheck server, which uses Groq Whisper (`whisper-large-v3-turbo`) to return text. Ordinary spoken questions are **sent automatically** to Groq GPT-OSS 120B with no additional Send click. The response appears in chat and is **spoken aloud automatically** using the device's `SpeechSynthesis` voice. Both settings are on by default and can be turned off independently.

**Review gate:** A dictated website address, email, long number, apparent secret, or a recording added to an existing unsent draft is **never auto-sent**. The transcription is placed in the composer for correction and explicit Send. This avoids checking the wrong domain or leaking credentials because transcription can be inaccurate. Speech never triggers browser rental or a Celo payment. The chat backend still validates and filters incoming questions.

**Fallbacks:** If the Groq transcription service is not configured, OyaCheck uses the browser's `SpeechRecognition` API when available. Browser speech services may process audio externally. If Groq chat is unreachable or rate-limited, OyaCheck clearly labels the text as offline guidance (not live AI) and does not claim a live investigation. A **Listen** button remains on replies if browser auto-play of speech is blocked. If audio cannot play, text remains usable.

**Privacy and limits:** Each clip is limited to 18 seconds and 2 MB; no recording is stored by OyaCheck. Transcription uses the configured Groq account and its available quota. In v0.8 there was no silence detection; v0.9 adds opt-in local microphone-level analysis and natural-pause auto-stop (see below). Pidgin transcription and speech pronunciation remain experimental and depend on model/device voices.

**Important:** Voice never changes deterministic security findings. Dictated links always require human review; website navigation and spending never follow from speech alone. Automatic voice chat may use Groq API quota, so it is not guaranteed to stay free at high usage.

### v0.8 acceptance checklist

- Tap Speak, say `How can I know if a website is fake?`, tap Stop. The user question should appear **without pressing Send**, followed by `LIVE AI · GROQ` if the provider responds.
- The response should be **read aloud automatically** when Speak answers is checked. If browser playback fails, use its Listen button.
- Switch to Pidgin and ask `Abeg how I go know say this link na scam?` — transcribed words and pronunciation require manual assessment.
- Dictate a domain such as `example.org`: it must remain **editable**, not auto-send.
- Disable `Auto-send voice questions`, then record again: the transcript must stay editable until Send.
- Disable `Speak answers`: responses must remain readable without automatic audio.
- If Groq is rate-limited, a message must visibly say `OFFLINE GUIDANCE · NOT AI`. It may be read aloud, but it is never described as a fresh AI answer.

**Verification scope:** Node tests cover the voice decision policy and API; a Chromium browser simulation with mocked microphone, transcription, AI, and speech playback verified the end-to-end UI handoff. Actual microphone acoustics, Groq free-tier availability, and Pidgin speech quality must be checked on the user's device.


## v0.9 — hands-free end-of-speech detection (English + experimental Pidgin)

**How it works:** Tap **Speak** only once. Your browser monitors microphone amplitude locally with a Web Audio analyser while MediaRecorder buffers a short clip. Once it detects speech and then about **1.5 seconds of silence**, it ends the recording automatically. A short burst of sound does not qualify as speech; if no speech is detected, it stops and asks you to retry rather than paying to transcribe an empty clip. A hard **18-second limit** also applies. You may still tap **Stop** to finish manually.

Next, the app sends the audio clip to the existing Groq Whisper transcription endpoint. Ordinary safety questions automatically enter the conversation, and the response is read aloud if **Speak answers** is checked. This depends on the network, your Groq quota and available device voices; it is not truly instantaneous. Voice never initiates a paid Celo Buy purchase.

**Privacy/safety:** Listening begins **only after tapping Speak**; it stops after end-of-speech. Audio is sent to Groq only after recording finishes (unless browser-native speech fallback is used). Audio isn't saved by this application. Spoken website addresses and potential secrets still require text review and explicit Send before processing. Background noise, a quiet microphone, speech pauses and unsupported browser APIs can affect the detector. The browser's manual Stop control is retained, with a clear fallback message.

**Tests:** 126 Node tests passed, including 9 new silence-detector and noise tests. A Chromium simulated microphone/Whisper/chat/speech synthesis flow passed the complete Speak → silence → transcription → automatic chat → spoken reply sequence. Browser navigation to live localhost was blocked by this tool environment, and a real physical microphone and real Groq transcription were not used for this test. Verify actual microphone behavior on the target device before claiming production readiness.

**Practical acceptance test:** Start app with your Groq API key set in your shell; click Speak; say “How can I know if a link is fake?”; stop talking. After about 1.5 seconds of silence, it should end the recording, send, answer, and speak without a Stop or Send click. Then test Pidgin, an empty/noisy recording, a dictated URL (must remain editable), Auto-send unchecked, and a denied microphone permission. This adds no Celo payments.

The app is still a limited evidence-based checking prototype. Unknown public websites are not rendered, and the Celo Buy integration remains sandbox-only and separately opt-in. Mainnet receipts, qualified independent users and ERC-8004 registration are still outstanding.
