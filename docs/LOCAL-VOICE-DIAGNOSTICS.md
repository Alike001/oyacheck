# Ordinary Chrome voice diagnostics — 7 November 2026

Base commit: `bc607721ffe40d772fec8aadcdfba39d4e02ce73`.
Existing product design, deterministic engine and public metadata are unchanged.

## Local view

Open http://127.0.0.1:4190/voice-diagnostics in the owner's ordinary Chrome.
It is served only with `OYACHECK_VOICE_DIAGNOSTICS=1`, a loopback socket peer and
loopback Host header; it is always blocked when `RENDER=true`. All diagnostic
responses are no-store and retain the application security headers. Diagnostics
files are outside the public static allowlist.

The running review server is intentionally key-free. To reproduce that setup:

```sh
PORT=4190 NODE_ENV=production OYACHECK_READ_ONLY=1 \
OYACHECK_VOICE_DIAGNOSTICS=1 GROQ_API_KEY='' \
BUY_BROWSER_SANDBOX=0 OYACHECK_DEMO_BROWSER=0 \
OYACHECK_MAINNET_PREPARE=0 OYACHECK_MAINNET_EXECUTE=0 node server.mjs
```

The view shows microphone permission, device labels without raw device IDs,
supported audio formats, the application's selected recognition backend, an
explicitly separate diagnostic browser-recognition backend, credential presence
as a boolean only, browser TTS voice count/locality, capture state and playback
state. Initial empty voices update on `voiceschanged`; enumeration shows at most
40 variants, English first, to avoid an enormous Linux variant list.

Credential configuration is **not** proof of validity, provider availability,
free quota or permission to spend. Server transcription tests are blocked in this
view even when a key is configured. No Groq transcription request is made here.
Browser recognition may process audio through the browser's provider; its start
button discloses that and requires a user gesture. It does not use our Groq key.
The diagnostic playback test filters out remote TTS voices.

## Host findings and minimal correction

Observed on this machine:

- Ubuntu 26.04.1 LTS; Google Chrome stable package 153.0.8010.52-1.
- PipeWire reports a default ALSA microphone input at volume 0.33, not muted, and
  output at 1.00, not muted. This does not prove a human voice was captured.
- `libspeechd2`, `speech-dispatcher`, `speech-dispatcher-espeak-ng` and
  `libespeak-ng1` are installed. `libspeechd.so.2` resolves through the loader.
- `spd-say -O` lists `espeak-ng`; querying modules autostarted the existing
  dispatcher. Listing voices succeeds. No system package was installed, no audio
  was recorded by shell commands, and no system speech utterance was issued.
- The ordinary, non-headless Chrome process lacks `--enable-speech-dispatcher`.
  Automated Chrome also lacked it and reported zero voices.
- A separate, unmodified headless Chrome launched **with** that flag reported
  14,805 local voice variants, including English eSpeak NG. No recognition or TTS
  response was mocked in that enumeration test. Enumeration alone proves neither
  audible playback nor microphone recognition.

Chromium's Linux TTS implementation gates Speech Dispatcher initialization on
`kEnableSpeechDispatcher` and dynamically loads `libspeechd.so.2`:
[official Chromium source](https://chromium.googlesource.com/chromium/src/+/HEAD/content/browser/speech/tts_linux.cc).

Minimal owner correction: save browser work, fully quit Chrome normally, then run:

```sh
google-chrome --enable-speech-dispatcher http://127.0.0.1:4190/voice-diagnostics
```

A new command can be delegated to an existing Chrome process and ignore its new
startup flag, so a complete normal quit matters. Do not kill the owner's browser,
disable the sandbox, alter profiles or install packages blindly. If voices remain
empty, verify the startup flag and dispatcher connection before changing packages.
The website cannot add a process startup flag to an already-running browser.

## Physical acceptance procedure and observed results

1. Inspect the page in ordinary Chrome, not the automation browser. Refresh the
   read-only facts. Labels may be hidden until permission is granted; an empty
   device enumeration is not proof that no microphone exists.
2. Click **Start microphone capture test**, allow microphone access and speak.
   Watch the real RMS activity bar. It is amplitude, not speech confidence.
   Click **Stop capture**, or let the ten-second cap release all tracks. This test
   does not upload, transcribe, save or play back captured audio. Permission wait
   is bounded to twenty seconds, and late streams are closed after cancellation.
3. Select English and click **Start browser recognition**. Say: “Please check this
   message before I trust it.” Stop if needed; inspect the actual editable text.
4. Clear the field, select Nigerian Pidgin and repeat with: “Abeg check this message
   make I no fall for scam.” Browser recognition uses `en-NG`; Pidgin quality is
   unproven until compared with real speech. No confidence score is fabricated.
5. Edit the transcript. Only click **Analyze reviewed text · no AI** if you intend
   to submit that text to the local deterministic analyzer. No automatic submission
   occurs. Cancel invalidates pending recognition; preserve typing if speech fails.
6. Click **Read actual finding or sample aloud**, then **Stop spoken output**.
   This uses an available local English voice; Pidgin pronunciation can vary.
   A start/end event alone is not proof of audible output.

Owner-reported result during this checkpoint: **“Yes, speech was audible.”** This
is genuine owner-observed audio confirmation, not an automated or mocked hearing
claim. The owner has not yet supplied microphone-meter results, English/Pidgin
transcripts or physical Stop/Cancel results. Those must remain unverified; an
initial ambiguous “yes” was clarified specifically as audible speech only.

The automation profile independently reports microphone permission denied,
getUserMedia permission denial and browser SpeechRecognition `not-allowed`.
These are automation-profile observations, not claims about ordinary Chrome's
permission. Server credentials are absent locally; no server transcription test
or paid provider call was made. Recognition failure and capture denial are shown
separately from TTS voice availability.

## Verification and release status

- `npm run check`: passed.
- `npm test`: **329 passed, 3 skipped, 0 failed**, 332 total.
- Added tests verify local-only playback excludes remote voices, explicit
  diagnostic opt-in, loopback Host enforcement, no-store/CSP, GET-only diagnostic
  routes, redacted configuration shape, and mandatory Render denial.
- Real Chromium diagnostics checks: zero POST requests on load/refresh; actionable
  capture denial and separate recognition denial; editable manually typed message
  goes to the actual local analyzer with `explain:false`; reload clears the field;
  320/390/1440 layouts fit without overflow or JavaScript errors.
- That manually typed message is **not** claimed as a speech transcript. Existing
  synthetic/mocked voice regressions are likewise not physical acceptance proof.
- No new dependency, provider, financial endpoint, public metadata field or
  registration journal was introduced or changed. No push or deployment occurred.

Voice: **NO-GO for fully verified speech input**, pending owner microphone,
English/Pidgin transcript and physical Stop/Cancel checks. Audible TTS has an
owner-confirmed positive result; Linux voice enumeration has a verified correction.
Text-only read-only release: **GO**, retaining truthful optional/unavailable voice
messages, financial protections and diagnostics disabled in production. Publication
still requires the owner's separate approval; this checkpoint does not publish.
