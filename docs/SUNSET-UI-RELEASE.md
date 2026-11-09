# OyaCheck sunset UI — reviewed local release

November 9, 2026. Deadline: **09:00 UTC / 10:00 WAT**.
No push, deployment, purchase, signing, wallet action or journal change was performed.

## Exact release boundary

Branch: **`feat/sunset-ui-demo`**.
Clean release worktree: **`/tmp/oyacheck-sunset-release`**.
Parent / current production / rollback:
**`a042cf6feb542a9915d8729c5252e26a8db0b80d`**.

The primary workspace contains unrelated, unpublished operator and financial
work. **Do not push or deploy its `fix/ai-reliability-mobile` HEAD for this UI
release.** This release branch starts at the exact live revision and includes
only these five reviewed paths:

- `public/index.html`: centered hero, original CSS scene markup, working modes
  and examples, secondary voice disclosure, bilingual guidance preview, source
  and public identity sections, matching checker structure and footer.
- `public/product.css`: warm peach/cream/orange palette, floating glass navigation,
  original atmospheric scenery, responsive forms/results, focus and motion rules.
- `public/app.js`: hero chips populate the existing examples and mode; primary
  hero button retains “Check now”. Existing submit/analyzer/API behavior is reused.
- `scripts/verify-product-browser.mjs`: existing regression follows the new
  secondary voice disclosure and mobile footer navigation.
- `docs/SUNSET-UI-RELEASE.md`: this verification and release procedure.

No server, analyzer, API, financial module, dependency, wallet file, private
evidence, database or payment-execution setting changes belong to this commit.

## Design and accuracy

Atmospheric color, centered composition and floating navigation were inspired
by [Homevera's hero reference](https://dribbble.com/shots/27239201-Homevera-Real-Estate-Landing-Page-Hero).
All scene geometry and styling are original CSS. No Dribbble artwork, branding,
houses, remote image, new web font, tracking script or UI dependency is used.
Existing self-hosted Lato uses `font-display:swap`; the display serif is system
Georgia. Existing font licenses remain intact. No hero image download is required.

The public app parses submitted text; it never visits a submitted suspect site.
Heuristic warning signs remain distinct from the narrow curated NCC evidence.
Unmatched input is not certified safe. The bilingual landing quotes are explicitly
labelled wording examples. Actual results still come from `/api/analyze`.
Physical voice transcription remains unverified; denial leaves typing usable.
The UI exposes no operator evidence or purchase control publicly. It makes no
new settlement or independent-user claim. The one real purchase must never be
repeated, regardless of later finality evidence.

## Verification

- **104/104** focused analyzer/server/release tests passed, including on the
  clean release worktree: `NODE_ENV=test RENDER=false OYACHECK_READ_ONLY=0 node
  --test test/analyze.test.mjs test/server.test.mjs test/release.test.mjs`.
- Syntax and `git diff --check` passed. Production/Render/read-only release
  preflight reports financial actions disabled.
- Real Chromium product regression passes at **320, 360, 390, 412, 768, 1440px**:
  real analyzer results, language preservation, keyboard examples, history/drafts,
  edit/back/new-check, clipboard, loading, error/recovery and prepared fallbacks.
  Only error transport, unavailable microphone and speech playback are doubled;
  the analyzer verdicts are not mocked. No live voice or AI provider was called.
- Hero-specific checks pass at **320, 390, 768, 1440px**: three chips populate
  exact existing examples without submitting, keyboard focus is visible, both
  modes submit to the actual analyzer and route to `/app`, no horizontal overflow,
  and reduced motion disables the loading animation.
- With production flags, `/api/mainnet/session`, `/api/mainnet/quote`,
  `/api/buy/quote`, `/api/buy/inspect`, `/api/demo/inspect` all return **403**.
  No quote, external payment request or wallet operation is made by these denials.
- Screenshots were captured from the implemented local app under production
  financial-denial settings, with actual analyzer results. They are not mockups
  or images of an already-deployed redesign. Desktop/mobile captures were visually
  inspected, including 320/390/768/1440 layouts; focus and text colors were polished.

Local screenshot/report directory in the primary workspace:
`/home/ali/Desktop/celo/official-link-agent/.playwright-mcp/sunset-redesign/`.
For each width 320/390/768/1440: `hero-WIDTH.png`, `landing-WIDTH.png`,
`checker-WIDTH.png`, `result-WIDTH.png`. Product regression also captures
`link-desktop.png`, `link-mobile.png`, `message-desktop.png`, `message-mobile.png`.
Reports: `layout.json`, `hero-regression.json`, `browser-regression.json`,
`browser-release-regression.json`. These ignored local artifacts are not in the
publication commit. No hosted screenshot URLs are invented.

## Publish and deploy — only after explicit owner approval

1. Inspect the local release and confirm its parent and exactly five paths:

   ```sh
   cd /tmp/oyacheck-sunset-release
   git status --short
   git log -1 --format='%H %s'
   git diff --name-only a042cf6feb542a9915d8729c5252e26a8db0b80d HEAD
   git diff --check a042cf6feb542a9915d8729c5252e26a8db0b80d HEAD
   ```

2. After approval to publish, push **only this branch**:

   ```sh
   git push origin HEAD:refs/heads/feat/sunset-ui-demo
   ```

3. In Render's **Alike** workspace, open **oyacheck-beta**,
   service **`srv-dbng37tg1s2s73ck2970`**. Keep automatic deploys **off**.
   Preserve production read-only configuration: `NODE_ENV=production`,
   `RENDER=true`, `OYACHECK_READ_ONLY=1`, `BUY_BROWSER_SANDBOX=0`,
   `OYACHECK_MAINNET_PREPARE=0`, `OYACHECK_MAINNET_EXECUTE=0`,
   `OYACHECK_BROWSER_DEMO=0`, and no enabled voice diagnostics. Do not configure
   a wallet, journal, keychain or operator SDK for this release.

4. After approval to deploy, choose **Manual Deploy → Deploy a specific commit**
   and paste the full SHA from step 1. Keep the existing build/start commands.
   Confirm the resulting deploy is **Live at that exact SHA**. The health version
   remains v0.10.0, so the version string alone does not prove the new revision.

5. Verify [landing](https://oyacheck-beta.onrender.com/),
   [checker](https://oyacheck-beta.onrender.com/app) and
   [health](https://oyacheck-beta.onrender.com/api/health). Confirm the new headline,
   orange working CTA, both modes and actual misleading/harmless/NCC results with
   optional AI OFF. Confirm health's mainnet, source sandbox and local demo flags
   remain false; public financial paths must still be denied. Never use the
   owner-purchase command as a smoke test.

## Rollback — only after owner approval

On the same Render service, **Manual Deploy → Deploy a specific commit**:
**`a042cf6feb542a9915d8729c5252e26a8db0b80d`**.
Confirm Live at that SHA and check `/`, `/app`, health and public financial
denials again. Keep automatic deploys off and production financial gates denied.
Do not revert operator journals or alter the consumed purchase history.

The UI release needs no database migration, environment secret change or payment
operation. No deployment or submission is implied by this local commit.
