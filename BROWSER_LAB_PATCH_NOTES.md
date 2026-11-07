# OyaCheck v0.10 — Controlled browser evidence lab patch

This archive is a **patch** to the existing, already-published OyaCheck `main` snapshot (`41b0423`). It does NOT replace README.md or the existing repo's Git history. It adds new modules and tests and modifies the existing UI/server to enable controlled page inspection.

Added:
- `lib/demo-inspection.mjs`: synthetic fixtures and deterministic observations.
- `lib/demo-browser.mjs`: isolated local headless Chromium CDP read-only observer; only fixed localhost fixture navigation.
- `lib/demo-conversation.mjs`: report-grounded follow-ups and Pidgin/English fallback.
- `test/demo-inspection.test.mjs`, `test/demo-server.test.mjs`, `test/demo-live.test.mjs`.
- `docs/BROWSER-LAB.md`: scope, security boundaries and acceptance tests.

Changed:
- `server.mjs`, `package.json`, `public/app.js`, `public/index.html`, `public/styles.css`.

**Disabled unless** `OYACHECK_DEMO_BROWSER=1` on a local request. There is no wallet or Buy interaction in this new lab. The original Celo Buy sandbox official-advisory check is preserved separately.

**What does not work yet:** Arbitrary suspicious user-submitted website rendering, production remote-browser security, qualifying mainnet x402 payments, agent identity and live-user acceptance. The `demo:live` tests must pass on the user's own laptop before calling this browser milestone complete.

Installation (after verifying clean working tree):

```sh
cd ~/Desktop/celo/official-link-agent
git switch -c feat/browser-investigation  # skip if already on this branch
unzip -o ~/Downloads/oyacheck-v10-browser-lab-patch.zip -d .
npm run check
npm test
OYACHECK_RUN_LIVE_DEMO=1 npm run demo:live
OYACHECK_DEMO_BROWSER=1 npm run dev
```

Don't merge to `main` until local `demo:live` and UI acceptance pass. Don't retry payments to test this patch.
