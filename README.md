# OyaCheck — Check the link. Know the signs.

**A digital-safety assistant for Nigerians, built on Celo for the Agents on Open Rails hackathon · Build with buy track.**

[**Try the live checker**](https://oyacheck-beta.onrender.com/app) · [Landing page](https://oyacheck-beta.onrender.com/) · [Agent metadata](https://oyacheck-beta.onrender.com/agent-registration.json) · [Real Celo mainnet payment](https://celoscan.io/tx/0x9db228c768c5a82a0eb281e4ed2a2631e6bf15da22a60bf1c786bec39b24a29a) · [Official NCC advisory](https://csirt.ncc.gov.ng/index.php/resources/security-advisories/452-phishing-campaign-impersonating-official-verifymydevice-gov-ng-device-verification-portal)

> **Status (9 Nov 2026):** Public, read-only checker is deployed. A **single real Celo mainnet paid browser-service call** and resulting official NCC advisory capture have been evidenced. The transaction was successful and canonical on two RPCs at the last review; **strict settlement finality remained unverified**, and the original SDK payment status was ambiguous. Do not portray this as independently finalized settlement. No additional payment attempts are permitted under the pilot's one-shot policy. The new sunset UI is merged into `main`; its public deployment must be checked separately against Render's deployed SHA.

## How to test — start here

**No wallet, funding, API key or sign-in is required to try the public product.**

1. Open the [live OyaCheck checker](https://oyacheck-beta.onrender.com/app) (the [landing page](https://oyacheck-beta.onrender.com/) also leads to it).
2. Select **Check a link**. Try the published phishing-example domain `secure-verifymydevice.ng`, which is discussed in the [NCC-CSIRT advisory](https://csirt.ncc.gov.ng/index.php/resources/security-advisories/452-phishing-campaign-impersonating-official-verifymydevice-gov-ng-device-verification-portal). OyaCheck analyses the **text of the URL**; it does not navigate to the submitted site.
3. Select **Check a message** and paste a fictional forwarded message, for example: `URGENT: Verify your device now at secure-verifymydevice.ng. Send your OTP to keep your account.`
4. Switch between **English** and **Nigerian Pidgin** explanations, inspect the warning signals and evidence links, and review the recommended next steps. Try the provided examples, keyboard controls and mobile layout.
5. Inspect the [onchain payment transaction](https://celoscan.io/tx/0x9db228c768c5a82a0eb281e4ed2a2631e6bf15da22a60bf1c786bec39b24a29a), the [official NCC source](https://csirt.ncc.gov.ng/index.php/resources/security-advisories/452-phishing-campaign-impersonating-official-verifymydevice-gov-ng-device-verification-portal), and [public agent registration metadata](https://oyacheck-beta.onrender.com/agent-registration.json) as separate evidence of the paid-service pilot and agent identity.
6. **Do not attempt a new paid transaction** to test the product. The live website deliberately blocks financial and diagnostic execution endpoints. The genuine paid pilot has already consumed its only allowed attempt.

**Supported network for the mainnet evidence:** Celo Mainnet, chain ID **42220**. Sandbox experiments on Celo Sepolia are historical tests and do **not** count as qualifying mainnet payment evidence.

### Run locally

Requirements: Node.js **22.13+ and below 25**, npm, and a modern browser. Public link/message checking does not require a wallet, Groq key or buy service.

```bash
git clone https://github.com/Alike001/oyacheck.git
cd oyacheck
npm ci
npm run check
npm test
npm run dev
```

Open `http://localhost:4173`. Optional explanation and voice services depend on available browser support and separately configured service credentials; text checking remains the reliable fallback. Never place credentials in screenshots or commit them to source control. Tests are designed not to make paid purchases.

## The problem and the approach

People receive convincing phishing URLs and forwarded messages that imitate official services, ask for one-time passwords or create false urgency. OyaCheck makes the warning signs easier to understand rather than pretending to provide a universal phishing verdict.

- **Link checking:** deterministic hostname parsing, suspicious URL patterns, lookalike indicators and narrow curated source matches.
- **Forwarded-message checking:** warnings for urgency, payment/OTP requests and social-engineering language.
- **Understandable guidance:** English/Pidgin explanations, optional AI-assisted wording and prepared offline fallback; deterministic findings remain authoritative.
- **Accessibility:** keyboard-friendly input and optional voice controls, with text fallback. Actual physical microphone transcription and Pidgin speech quality have **not** been independently accepted across devices.
- **Source transparency:** official NCC evidence is identified separately from heuristic suspicion. **No known threat found does not mean a URL is safe.**

OyaCheck **does not** open arbitrary user-submitted websites, fill forms, collect OTPs or guarantee safety. The paid browser pilot opened only a fixed official advisory URL, not the suspicious phishing site itself.

## Genuine Build with buy — one paid mainnet investigation

The dedicated local OyaCheck operator used **buy** to acquire a **one-minute external browser session** from `buy-browser-worker` (external **Agent 9894**) for a useful, fixed task: retrieve the current content of an official Nigerian Communications Commission cyber-safety advisory.

| Proof field | Verified / recorded value |
| --- | --- |
| Network | Celo Mainnet (`42220`) |
| External service | `buy-browser-worker`, Agent `9894` |
| Request | `POST https://gateway.usebuy.ai/v1/browser/sessions` |
| Exact body | `{"durationMinutes":1}` |
| Paid amount | **3,606 atomic = 0.003606 native USDC** |
| USDC token | `0xceba9300f2b948710d2653dd7b07f33a8b32118c` |
| Dedicated payer | `0x95c21bE84c5aA943A7c451FBf85842BB5373d756` |
| Recipient | `0x20faAca5F980E29639A0FCC6dcA6988E18ed333B` |
| Mainnet transaction | [`0x9db228c768c5a82a0eb281e4ed2a2631e6bf15da22a60bf1c786bec39b24a29a`](https://celoscan.io/tx/0x9db228c768c5a82a0eb281e4ed2a2631e6bf15da22a60bf1c786bec39b24a29a) |
| Captured public source | [NCC-CSIRT phishing advisory](https://csirt.ncc.gov.ng/index.php/resources/security-advisories/452-phishing-campaign-impersonating-official-verifymydevice-gov-ng-device-verification-portal) |
| Evidence timestamp | **2026-11-09 07:18:14.347 UTC** |
| Captured content | **3,866 characters**, verified local SHA-256 `b2bbaa36b9a9d60a93f9e5889d64022ecfeee85249c6a967b8aea95f4e99e0a7` |
| Last reported pilot balance / cap | **1,394 atomic USDC remaining / spending cap ZERO** |
| Settlement caution | **Successful canonical transfer, but strict finalized settlement not yet verified; original SDK status ambiguous** |

Independent read-only RPC checks correlated the exact native USDC transfer, authorization nonce, journal reservation and gateway receipt with the paid browser evidence. The captured page URL, title, text, timestamp and content hash were locally correlated; the capture is **not a provider-signed attestation** and is **not a new deterministic finding about the suspicious site**.

The local operator used a bound HTTP 402 challenge, exact typed-data validation, an explicit human confirmation, a durable reservation before signing, no automatic retry, journal recovery and post-attempt cap reset. **One lifetime attempt has been consumed**. Neither the browser UI nor this README provides a public payment endpoint. The sole-host pilot is deliberately not deployed on ephemeral Render hosting.

**Judging limitations:** The mainnet payer is **different from the ERC-8004 registration wallet**; whether that qualifies under the track's payer rules remains unconfirmed. Evidence from an independent external end user has not been established. Do not infer independent-user adoption from a single owner-operated demonstration.

## Celo agent identity

- **ERC-8004 Agent ID:** `10051`
- **Registered agent wallet:** `0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a`
- **Registry:** `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` on Celo Mainnet
- **Registration transaction:** [`0x56b7126b6040de24af3d78017e913aac6ff749ba05878e4776a1437e314de74c`](https://celoscan.io/tx/0x56b7126b6040de24af3d78017e913aac6ff749ba05878e4776a1437e314de74c)
- **Public agent metadata:** [`/agent-registration.json`](https://oyacheck-beta.onrender.com/agent-registration.json)

The registered wallet is associated with the Loops House entry; the separate named local buy account performed the paid-service transaction. The public agent metadata correctly reports `x402Support: false` because the hosted checker does **not** expose public payment execution.

## Architecture and security boundaries

| Component | Responsibility |
| --- | --- |
| `public/` | Responsive landing/checker UI, input, bilingual feedback, optional voice interfaces |
| `server.mjs` | HTTP routes, request validation, response headers and production read-only policy |
| `lib/analyze.mjs` | Deterministic URL/message signals and curated known-source matching |
| `lib/explain.mjs`, `lib/chat.mjs`, `lib/general.mjs` | Optional natural-language explanations and fallback |
| `lib/demo-browser.mjs`, `lib/demo-inspection.mjs` | Local-only controlled synthetic browser lab; not open-web inspection |
| `lib/mainnet-*.mjs` | Locally gated mainnet preparation and reconciliation logic; not a publicly enabled purchasing API |
| `test/` | Analyzer, API, safety-gate and browser-lab tests |
| `render.yaml` | Render read-only production configuration with disabled financial routes |

Safety boundaries: never automatically visit submitted suspicious URLs; never share private session links, payment authorizations, wallet keys or personal identification documents; never retry an uncertain paid request. Public financial and diagnostic routes remain denied. Optional AI cannot override source-grounded deterministic findings.

## Demo, screenshots and reviewer notes

The [live app](https://oyacheck-beta.onrender.com/) is the functional browser experience for judges. Submission screenshots were captured from the implemented checker at desktop and mobile widths and uploaded separately to Loops House. The [Celo transaction](https://celoscan.io/tx/0x9db228c768c5a82a0eb281e4ed2a2631e6bf15da22a60bf1c786bec39b24a29a) and [NCC source page](https://csirt.ncc.gov.ng/index.php/resources/security-advisories/452-phishing-campaign-impersonating-official-verifymydevice-gov-ng-device-verification-portal) can be examined without a wallet.

For judging, evaluate the existing real journey and limitations, not unsupported claims of live unknown-website browsing, guaranteed phishing detection, finalized financial settlement, physical voice accuracy or independent-user adoption.

## Next steps

- Improve safe, observable investigation of untrusted websites only after a separate browser-isolation/security review.
- Validate accessibility, real speech recognition and Pidgin quality on physical devices.
- Add independently observed end-user testing and improve evidence provenance.
- Complete any external payer-eligibility clarification without creating further transactions from the consumed pilot.

**Hackathon:** [Celo Agents on Open Rails — Loops House](https://www.loops.house/agents-on-open-rails/) · Deadline: **November 9, 2026, 09:00 UTC (10:00 WAT)**.
