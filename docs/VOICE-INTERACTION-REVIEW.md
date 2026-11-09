# Voice interaction checkpoint — 7 November 2026

Base: `418da0c6532105da390b0215c4422bd58e991b52`, branch `fix/ai-reliability-mobile`.
Local review: http://127.0.0.1:4190/ and http://127.0.0.1:4190/app.

## Findings and original interaction changes

The old microphone lived inside the closed “Prefer to speak?” disclosure; that
whole input panel also closed after a result. The landing page had no microphone.
This was a discoverability defect, independent of microphone permission.

The review server deliberately has `GROQ_API_KEY` empty. Its health endpoint
reports `voiceTranscription:false`, so the old implementation selected browser
speech recognition instead of MediaRecorder/Groq. This Chromium exposes the
recognition constructor but a direct attempt returned `not-allowed`. A separate
Chromium with synthetic audio and microphone permission returned `audio-capture`.
Neither result establishes the state of the owner's physical Chrome microphone.

The original availability message claimed automatic question submission and
spoken answers even though both options defaulted off. Playback voices are
empty in this Chromium; the old implementation attempted playback anyway.
No unsupported-format failure was observed; format rejection is tested.

The original OyaCheck interface now has a visible microphone beside each primary
input, a speech-language selector, a compact status area and a live activity bar.
The navy/off-white/teal surfaces remain; input, feedback and result share the same
visual language. Real examples still invoke the actual deterministic API.
Plain-language guidance and English/Pidgin actions are open in completed results;
technical detail, optional chat and advanced preferences remain secondary.
No external design components, branding, source or assets were imported.

`public/voice-session.js` owns one turn at a time:

- Ready → Permission → Listening → Transcribing → Stopped/review; explicit Check
  starts Analyzing. Optional playback uses Preparing → Speaking → Stopped.
- Listening begins on actual recording/audio events. The meter reads Web Audio
  waveform RMS, with no idle waveform, random level or minimum fake amplitude.
  RMS detects activity, not linguistic speech or transcription confidence.
  Browser recognition does not expose a waveform; no meter is shown in that mode.
- Stop finishes capture; Cancel invalidates the turn, aborts an upload and ignores
  late callbacks. Tracks close on completion, cancellation, navigation and error.
  Old recorder events cannot close a newer recording.
- Recording has an 18-second cap, permission a 20-second cap, and upload a
  25-second cap. No-activity recordings are discarded. No automatic retries.
- Transcripts preserve drafts. Existing URL/private-information review gates and
  the default-off auto-send policy remain. Ordinary questions auto-send only
  when the user explicitly enables that existing preference.
- Playback selects an available English device voice, explains Pidgin fallback,
  and exposes Stop during preparation and speech. Missing voices, blocked start,
  playback error and timeout produce text fallback. Auto-reading remains opt-in.
- Repeated meter samples do not repeatedly announce unchanged screen-reader text.
  Focus rings, touch targets and reduced-motion behavior are retained.

Browser fallback still uses `en-NG`; this does not establish Pidgin recognition
support. Groq still uses the existing `whisper-large-v3-turbo` adapter. English
uses its supported language hint; Pidgin uses a transcription prompt without
inventing an officially supported Pidgin language code. No provider was replaced.
A configured key in health is configuration evidence, not an availability test.

## Verification and its limits

- `npm run check`: passed, including both browser verification helpers.
- `npm test`: **327 passed, 3 skipped, 0 failed** (330 total).
- 21 new controller tests cover permission, no speech, timeout, rejected formats,
  duplicate start, provider failure, cancellation, late responses, recorder races,
  missing voices, playback events and playback Stop.
- Opt-in `npm run demo:live`: **3 passed, 0 failed**, actual Chromium on owned
  synthetic pages only. No financial service or submitted website is opened.
- `scripts/verify-product-browser.mjs`: actual deterministic URL/message API,
  all widths **320/360/390/412/768/1440**, no overflow or page errors. Covers
  userinfo hostname, ordinary/unmatched links, malformed input, OTP warning,
  harmless message, exact findings/provenance, English/Pidgin, explicit AI opt-in,
  unavailable-AI fallback, drafts/history/retry, keyboard and another-check flow.
- `scripts/verify-voice-browser.mjs`: actual Chromium getUserMedia, MediaRecorder
  and Web Audio with synthetic PCM files; encoded `audio/webm;codecs=opus` uploads,
  changing RMS level, released tracks, all six listening widths, keyboard focus,
  Stop, Cancel during capture/upload, preserved draft and landing transcript review.
  Latest English-file test: first upload 16,718 bytes; subsequent uploads 4,160.
  Pidgin-worded synthetic-file test also passed capture/encoding.
- **Transcription responses, configured-health switch and playback were mocked
  in those controlled-media tests.** They prove review/analysis wiring, failure
  handling and playback text selection/Stop; they do not prove recognition quality
  or audible playback. No provider call or physical microphone test was made.
- Real digital-silence capture: no-activity error, typing restored, **zero uploads**.
  `verifyVoiceSilence` reproduces that check with the same controlled health switch.
- Direct, unmocked playback check: zero available device voices; the UI correctly
  reports that an English voice must be enabled and keeps the readable findings.
- Dependency audit: **0 vulnerabilities**. Read-only release preflight passed with
  all financial/demo flags zero and no purchase database configured.
- Local metadata: HTTP 200, Agent ID 10051, same registry/URI, `x402Support:false`.
  Paid inspection: HTTP 403. No financial implementation or detection logic changed.

No phishing accuracy percentage is established by these tests. Detection remains
URL/message heuristics plus the existing small curated NCC advisory list, not a
live reputation service or website scan. Unknown/no match does not mean safe.

## Reproducing the browser checks

Keep the loopback review server key-free and read-only:

```sh
PORT=4190 NODE_ENV=production OYACHECK_READ_ONLY=1 GROQ_API_KEY='' \
BUY_BROWSER_SANDBOX=0 OYACHECK_DEMO_BROWSER=0 \
OYACHECK_MAINNET_PREPARE=0 OYACHECK_MAINNET_EXECUTE=0 node server.mjs
```

The browser helpers export functions for the existing Playwright review context.
Call `verifyProductBrowser(page, origin, artifacts)` and
`verifyVoiceBrowser(browserType, origin, artifacts, audioFile)`. The latter launches
local `/usr/bin/google-chrome` with explicit synthetic-media flags. The artifact
directory must exist. For the silent case call
`verifyVoiceSilence(browserType, origin, silenceFile)`.

Generate controlled samples using the locally available FFmpeg flite filter;
these are English synthesizer readings, **not Nigerian-speaker recordings**:

```sh
ffmpeg -v error -f lavfi -i "flite=text='Please check this message before I trust it':voice=slt" -ar 48000 -ac 1 /tmp/oya-voice-english.wav -y
ffmpeg -v error -f lavfi -i "flite=text='Abeg check this message make I no fall for scam':voice=slt" -ar 48000 -ac 1 /tmp/oya-voice-pidgin.wav -y
ffmpeg -v error -f lavfi -i anullsrc=r=48000:cl=mono -t 12 -c:a pcm_s16le /tmp/oya-voice-silence.wav -y
```

Screenshots are local, ignored artifacts in `.playwright-mcp/voice-interaction/`:
`before/landing-1440.png`, `before/landing-390.png`, `before/checker-1440.png`,
`before/checker-390.png`; `after/landing-desktop.png`, `after/landing-mobile.png`,
`after/checker-desktop.png`, `after/checker-mobile.png`, `after/link-desktop.png`,
`after/link-mobile.png`, `after/message-desktop.png`, `after/message-mobile.png`;
and `after/voice-{ready,listening,error}-{desktop,mobile}.png`.
Voice-state screenshots use the explicitly controlled media/provider test setup;
they are not evidence of a working live transcription provider.

## Remaining gate and release decision

**NO-GO for publication as a verified voice-capable release.** Local text flows and
controlled voice engineering checks pass. English/Pidgin recognition quality,
physical-device permissions and audible output remain unverified.

The next owner action is a physical-Chrome acceptance session: record a short
non-sensitive English sentence and a Pidgin sentence, compare each actual
transcript with what was spoken, edit before checking, then test Listen and Stop
with an installed device voice. Also deny permission and confirm typing remains
usable. Record actual errors and recognition differences, without assigning an
invented confidence score. If using Groq, configure only the existing approved
server-side credential through the normal secure environment; never paste it in
the browser or chat. Any billable provider call needs separate spending approval.
No automatic fallback changes provider or bypasses review.

ERC-8004 metadata and original journals are untouched. Journal SHA-256 remains
`29fe8e0fc0d73f36f93144d8cfd9fdd48e6857abb695b6dc2bce96f9ca2c9ff8`;
transaction-file SHA-256 remains
`4d6a9ff39d1fdb74878c6abe84f41ab5534d77f5a153ccd35a9b8581c33a72cb`.
No push, deployment, purchase, signing, transaction or submission occurred.
