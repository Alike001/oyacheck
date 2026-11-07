# OyaCheck v0.10.0 AI and mobile verification

Branch: `fix/ai-reliability-mobile`. Local verification: 2026-11-07.

## Changes

- General Groq completion budget: 700 tokens. Completed English/Pidgin replies,
  including short replies and replies above the former 1100-character limit,
  are accepted. Display text is capped at 1600 UTF-16 code units, with an
  ellipsis that does not split a surrogate pair.
- Only `finish_reason: stop` is accepted as complete. Output-limit, other
  incomplete, empty, malformed, rate-limited, provider-error and network-error
  responses have separate reason codes and honest offline guidance. Provider
  error bodies and partial replies are not displayed. No retries were added.
- Chromium confirmed Send was clipped at 320px. Narrow-screen composer controls
  now wrap. The intro glow was already correctly clipped; it was left unchanged.

## Commands and results

- `npm run check`: exit 0.
- `npm test`: exit 0; 179 tests, 176 passed, 3 skipped, 0 failed.
- `git diff --check`: exit 0; no output.
- `node --test test/general.test.mjs`: exit 0; 27 passed, 0 failed.
- `node --check scripts/verify-groq-browser.mjs`: exit 0.
- `OYACHECK_RUN_LIVE_DEMO=1 npm run demo:live`: exit 0; 3 passed,
  0 skipped, 0 failed, using real local Chrome and controlled synthetic fixtures.

The default suite's three opt-in skips are the live Chromium sensitive-fields,
normal-login and redirect tests in `test/demo-live.test.mjs`. All three passed
when explicitly enabled separately. Payment/demo route protection tests remained
in the full suite; payment code and server routes were not changed.

## Real browser results

Playwright MCP used Chromium 153.0.8010.52 against the actual local server.
At 320, 360, 390, 412 and 768 CSS pixels:

- Document scroll width equalled viewport width.
- Intro glow remained inside an `overflow: hidden` card.
- Textarea, language toggle, microphone and Send stayed within the composer.
- English and Pidgin mock replies rendered with the correct live-AI label.
  These were intercepted provider responses, not genuine Groq responses.
- Enter submitted; Shift+Enter inserted a newline. Focus returned to the input.
- A genuine deterministic local phishing check rendered its NCC finding and
  published source. No suspicious URL was opened.
- At a reduced 400px viewport height, the focused textarea and microphone/Send
  controls remained reachable by scrolling. This simulates available space,
  not a physical phone's virtual keyboard.

At 320px, a 1595-character mock answer containing HTML-like text rendered as
text, without images or script execution and without widening the document.
Adversarial AI verdict/source fields did not change the evidence desk. The
browser speech-recognition fallback reported `not-allowed` and left typing and
Send usable; a subsequent typed follow-up succeeded. No real audio recording,
Groq transcription or audio playback was verified.

The deterministic verdict and evidence collection are structurally isolated
from model output. System prompts prohibit invented evidence and inspection
claims. Arbitrary free-form model prose is still model-generated; the tests do
not establish a universal guarantee against hallucinations in that prose.

## Bounded genuine Groq browser test

Prepared helper: `scripts/verify-groq-browser.mjs`. It accepts an existing
Playwright `page`; it adds no application dependency. Example from a Node
Playwright session with a page already created:

```js
const { verifyGroqBrowser } = await import('./scripts/verify-groq-browser.mjs');
console.log(await verifyGroqBrowser(page, 'http://127.0.0.1:4173'));
```

Use a dedicated local server started from the shell/environment that already
holds the configured Groq credential. Keep `BUY_BROWSER_SANDBOX=0` and
`OYACHECK_DEMO_BROWSER=0`. Do not paste credentials into the browser or logs.

The helper checks health before any provider request. It submits exactly one
English and one Pidgin safety question in fresh conversations, with at most two
`/api/ask` POSTs total, no retry, and all other API mutations blocked in that
page. It stops on the first failure. Each successful response must have method
`groq`, no failure reason, nonempty text at most 1600 characters, no report,
and identical rendered text with the live Groq label. It logs only language,
method, length and rendering status. Review the Pidgin wording as well; language
selection alone does not prove linguistic quality. Never automatically rerun a
failed live test.

Current status: BLOCKED. No configured `GROQ_API_KEY` was present in the task
shell, no pre-existing OyaCheck service was listening, and local health reported
`aiConfigured: false`. No credential file was provided. Zero genuine external
provider requests were made. The helper imported and passed syntax checking;
its genuine provider path is pending credentials.

Production was not contacted or verified. Physical-phone keyboard, actual
microphone/audio, native-speaker Pidgin review and genuine Groq rendering remain
pending. No signing, broadcasting, purchases or fabricated payment evidence
occurred. No push, merge, deployment or submission occurred. The user authorized committing the documented mock-tested fixes despite the
missing local Groq credential; genuine provider verification remains pending.
