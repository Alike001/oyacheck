# Browser evidence lab — local controlled testing only

**Feature state:** opt-in local laboratory. No arbitrary user URL inspection. No Celo Buy payments. Not a mainnet feature or a production safety verdict.

## Why this exists

The existing OyaCheck checker compares a submitted hostname with limited curated evidence; it does not open the submitted website. A meaningful future browser tool needs to gather *new, observable evidence* and report exactly what was actually seen. This lab tests that capability against OyaCheck-owned synthetic pages without contacting suspicious websites.

## Four controlled training scenarios

1. **Credential request:** sample urgency text, synthetic NIN/OTP/password fields and an off-origin form action. Forms are disabled and cannot be submitted.
2. **Internal redirect:** a local 302 leading to the credential training page; browser records the internal redirect.
3. **Ordinary login:** a password field with no urgency, showing that password forms alone do not prove fraud.
4. **Information page:** no relevant signals; that does **not** mean a real website is safe.

Both the observations and warnings are derived from actual Chromium-rendered DOM when the browser succeeds. The evidence engine never asks Groq to assign the verdict. AI can help explain the structured observations in English/Pidgin; if unavailable, OyaCheck shows explicit prepared guidance.

## Local setup (terminal)

```sh
npm run check
npm test
OYACHECK_DEMO_BROWSER=1 npm run dev
```

Open `http://localhost:4173`, click **Browser lab** below the assistant, select a scenario in the evidence desk, and click **Inspect sample in Chromium**. A genuine result displays the title, final local URL, observed form fields and redirect indicators, plus a screenshot. Ask a follow-up in the chat; it should discuss **only** the synthetic observations.

To run the full headless Chromium acceptance test from the terminal:

```sh
OYACHECK_RUN_LIVE_DEMO=1 npm run demo:live
```

Chromium/Chrome must be on the PATH. If it is installed elsewhere, use `CHROMIUM_PATH=/path/to/chrome`. Browser policies sometimes block localhost; if Chromium returns a policy error, this test is **not** a pass. Do not silently replace it with fabricated evidence.

## Security boundaries

- Server option `OYACHECK_DEMO_BROWSER=1` is required; requests must originate on localhost.
- `/api/demo/inspect` accepts a **named scenario**, never a URL, HTML blob or arbitrary pathname.
- The renderer navigates only to localhost fixture paths and rejects final navigation outside those paths.
- Static fixture Content Security Policy blocks scripts, outgoing resource requests, active form submission and form navigation.
- No private information is collected; the sample forms have no working submit button and never receive credentials.
- The browser has a short execution timeout, runs under a temporary profile, and is terminated after each sample.
- Screenshot tokens are short-lived, random and restricted to the same local client address.
- No Celo funds, wallets or x402 services are used in this demo, and the old Celo Buy sandbox gate remains separate.
- These controlled observations cannot prove accuracy against real phishing websites. Do not present them as external phishing detection or qualifying mainnet activity.

## Release gate for eventual untrusted-site investigation

**Not met.** Before opening *any* arbitrary user-submitted public webpage, add an isolated remote browser with enforced destination and redirect controls, DNS re-resolution and private-IP/metadata rejection, navigation/request interception, anti-prompt-injection handling, no credential interaction, bounded time/size/spend, evidence provenance, and representative accuracy tests (including benign lookalikes). Also test real user consent and the complete Celo mainnet payment-to-service-output flow. Do not enable paid public inspection by simply turning on this demo flag.
