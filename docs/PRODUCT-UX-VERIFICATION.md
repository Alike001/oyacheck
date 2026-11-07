# Landing and checker: implementation and verification

The actual application remains Node HTTP + local HTML/CSS/JavaScript, with its
existing analysis, explanation, voice and payment protections. No new framework,
dependencies, external fonts, tracking scripts or deployed assets were added.

## Implemented surfaces

- `/`: real navy/off-white/teal landing page; working link/message form, Product,
  How It Works and FAQ navigation, Open App, capability/privacy/limits sections,
  project links. No fabricated endorsements, metrics or scan previews.
- `/app`: explicit link, forwarded-message and optional conversation modes.
  Input comes first; completed evidence comes first on narrow screens. Results
  show normalized hostname, indicators, curated sources/dates, check time and
  limitations. There is an explicit another-check action.
- Analysis keeps the API and its default auto behavior. Optional `mode` selects
  URL/message, `explain:false` skips Groq even with a configured key, and
  `checkedAt` records server response time. The UI opts out of AI scan explanation
  by default; prepared English/Pidgin guidance remains available. Follow-up
  questions and voice retain their existing bounded optional service paths.
- Navigation retains current input/results in page memory without putting them
  in query strings, history state, localStorage or sessionStorage. Back/forward
  does not rerun checks. Reload deliberately does not persist private input.
- Loading guards, inline errors, explicit retry and draft retention; previous
  findings are hidden when a new check starts, including on error. Inputs are
  never silently fetched as websites. JS-disabled forms cannot leak raw input
  through a default GET query; a noscript notice explains the requirement.
- Existing microphone controls, unavailable/permission-error feedback and typing
  fallback are retained. Returning to the landing view stops active voice input.
  AI cannot alter deterministic status, reasons, host or published evidence.

## Bounded detection changes and honest limits

The original general HTTP(S)/domain parser, URL flags and text patterns already
worked outside NCC. Only the manually curated known-threat/official-host list
and paid source refresh are NCC-specific. New checks add single Unicode bare
addresses, numeric ports, embedded domains, limited familiar-name substitutions,
reported-parent subdomain warnings and explicit no-link message analysis.
Malformed addresses and message text in URL mode get an inconclusive result.

A normal password-reset URL path no longer counts as a message requesting a
password. Negated safety advice has a fixture. Other legitimate urgency,
internationalized names, HTTP and redirects can still cause warnings; subtle
phishing can produce no configured warning. No live reputation, sender identity,
TLS, page content, redirect destination, forms, attachments or downloads are
verified. "No known threat found" is never "safe". Fixtures are not an accuracy
benchmark and no false-positive/false-negative rate is claimed.

Paid arbitrary-site evidence remains unsupported. The existing buy contract's
browser can technically navigate public URLs, but this adapter accepts only the
fixed NCC advisory. It is not safe to expand destinations by changing a URL or
feature flag. Public financial routes remain 403; the durable store, quote
expiry, explicit approval, one-attempt allowance and receipt recovery code are
unchanged. No wallet, registration, journal or Render setting changed.

## Verification evidence

- `npm test`: **306 total, 303 passed, 3 skipped, 0 failed**.
- `npm run check`: passed, including the new browser helper syntax.
- Opt-in synthetic Chromium tests: **3 passed, 0 failed**, separately exercising
  the default suite's three skips. No external purchases.
- `git diff --check`, production/read-only release preflight and dependency audit
  passed; **0 known dependency vulnerabilities**. No production build script is
  configured: source is served directly. Existing Render build/start unchanged.
- Real Chromium used actual local analysis HTTP for 320/360/390/412/768/1440px:
  landing and result fit at every width; repeat check, direct /app, back/forward,
  URL/message landing inputs, English/Pidgin, keyboard order and result focus
  passed. Malformed, normal, lookalike, shortened, known-listed, phishing-style
  no-link message and unrelated harmless-message cases were exercised.
- An injected HTTP 503 checked loading disablement, retained draft, hidden stale
  evidence and explicit retry. Microphone-unavailable and a mocked speech
  permission-denial case restored typing. Physical recording/phone hardware and
  Pidgin pronunciation were not tested or claimed.
- The main browser run made **zero external website requests and zero financial
  requests**, with no page JavaScript errors. Privacy checks kept a synthetic
  query token out of navigation, browser storage, history state and result data.
- Separate existing browser helpers passed with **mock financial providers only**:
  sandbox Cancel/Escape, expiry/invalid quotes, success/failure receipt links and
  no retry; mainnet provider/funds failures, cancel/expiry, explicit request,
  reload recovery and success/partial outcomes. No real wallet or paid provider.

Local screenshots (ignored artifacts, not source assets):

- `.playwright-mcp/landing-1440.png`, `.playwright-mcp/landing-390.png`
- `.playwright-mcp/checker-1440.png`, `.playwright-mcp/checker-390.png`

Reproduce the nonfinancial product journey with `verifyProductBrowser` from
`scripts/verify-product-browser.mjs` on a dedicated loopback server with AI
credentials absent and all financial/demo flags off. The helper blocks unexpected
external requests. Other browser helpers now open `/app` explicitly.

## Local review and release recommendation

The current review server is at `http://127.0.0.1:4190/`; app entry is
`http://127.0.0.1:4190/app`. Examples are deterministic fixtures, never sites to
visit. `/#product`, `/#how`, `/#faq` and `/#privacy` are usable landing anchors.

This is a read-only release candidate for owner review, not a deployment. Check
physical mobile keyboard/microphone behavior and broader independent fixtures
before making stronger claims. Real Groq quota and output quality were not
retested here; all UI analysis tests used deterministic/prepared guidance.
A later approved release should keep all financial flags off, deploy the exact
reviewed commit, check `/`, `/app`, metadata and financial 403 responses, and
retain the previous known-good Render commit for rollback. Registration identity
10051, its evidence and the immutable original reservation remain unchanged.
