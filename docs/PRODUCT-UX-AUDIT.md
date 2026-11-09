# General link checker and product audit

OyaCheck is a general suspicious-link/forwarded-message assistant with additional
Nigerian scam intelligence. Baseline: 7f8c5f0, inspected 2026-11-07.

## What already worked

The deterministic analyzer accepts public HTTP(S) URLs and bare domains, extracts
a single link from forwarded text, normalizes hosts, and flags HTTP, nonstandard
ports, userinfo, IDN/punycode, known shorteners, external redirect parameters,
sensitive-information mentions and urgency. It never opens the submitted site,
performs DNS/TLS/reputation lookups or follows redirects. Arbitrary unlisted
hosts produce unverified findings, not a safe verdict. There is no accuracy
benchmark and passing tests are not evidence of detection performance.

Only the small manually curated NCC advisory list provides known-threat and
specific official-host evidence. NCC-lookalike rules and paid advisory refresh
are special cases, not the whole checker. English/Pidgin prepared explanations,
optional Groq, bounded voice input, local synthetic lab and strictly gated
sandbox/mainnet operator paths already exist. Registration evidence, wallet/tag,
financial gates, Render setup and journals must remain intact.

## Original UX gaps

- A conversational hero and chat-first composer obscure the actual URL check.
- URL/message/question intent is guessed; a no-link forwarded message goes to AI
  conversation instead of deterministic message-pattern analysis.
- Request submission clears the draft before success, so errors lose the input.
- Narrow NCC examples dominate the journey and suggest narrower product scope.
- No dedicated landing/app route, no FAQ/privacy hierarchy, no explicit result
  timestamp, and no simple mobile-first transition from input to evidence.
- Unknown and invalid states need clearer distinctions; no global threat database
  supports broad phishing or safety guarantees.
- The UI mixes operational instructions into the public paid-source panel.
- Existing voice and payment controls must remain available only under their
  original feature gates; a visual redesign is not authorization to activate them.

## Bounded correctness improvements

Explicit optional analysis modes preserve existing API auto behavior. Message
mode supports no-link text with wording-only findings; benign text is inconclusive
about sender/claims. Single Unicode addresses without schemes, misleading domain
names embedded in subdomains, limited letter/number substitutions and subdomains
of reported hosts gain bounded handling. Malformed triple-slash/backslash URLs,
single-label hosts and prose in explicit URL mode are rejected. Negated advice
such as "Never share your password" does not trigger the disclosure-mention rule.

These remain heuristic warnings. Internationalized names, redirects, HTTP and
sensitive words can be legitimate; subtle scams can contain none. A tiny familiar
name substitution list is not comprehensive lookalike detection. No arbitrary
suffix is declared official and no hostname match verifies page content.

## Buy positioning and outbound limits

The gateway browser contract can technically open public sites, but OyaCheck's
adapter intentionally accepts only the exact configured NCC advisory and checks
the returned final URL. General browsing would require new destination/redirect
controls, separate approval, durable operation and a reviewed integration. This
redesign does not expand it. Public paid routes remain disabled; broader paid
site inspection is unsupported. No service purchase is needed for URL/message
checks, and no call to a submitted site belongs in this product flow.

## Acceptance scope

Real local HTTP and Chromium will exercise landing to app to result, explicit
input modes, error/retry draft retention, English/Pidgin, direct /app navigation,
back/forward without putting raw inputs in URLs or persistent storage, keyboard
focus, microphone-unavailable feedback and all six requested widths. Browser
fixtures use reserved/ordinary addresses without visiting them. Public financial
routes must fail closed. Physical microphone/pronunciation acceptance and real
world accuracy evaluation remain separate, unclaimed work.
