// Real Chromium UI checks with intercepted buy responses only. The actual
// local server must have payments disabled. Never contacts buy or a wallet.
export async function verifyBuyBrowser(page, origin = 'http://127.0.0.1:4173') {
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const base = new URL(origin);
  check(base.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Local server required');
  const transaction = '0x' + 'b'.repeat(64);
  let quoteMode = 'valid', outcome = 'success', inspections = 0;
  const healthRoute = async route => {
    const response = await route.fetch();
    const health = await response.json();
    check(health.sourceInspectionSandboxEnabled === false, 'Real server must have sandbox payments disabled');
    await route.fulfill({ json: { ...health, sourceInspectionSandboxEnabled: true } });
  };
  const buyRoute = async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/buy/quote') return route.fulfill({ json: {
      amount: 0.003606, token: 'USDC', network: quoteMode === 'invalid' ? 'Celo mainnet' : 'Celo Sepolia',
      sandboxOnly: true, quoteToken: 'browser-test-mock', expiresSeconds: quoteMode === 'expired' ? 0 : 90,
    } });
    if (path === '/api/buy/inspect') {
      inspections++;
      const body = route.request().postDataJSON();
      check(body.confirmation === 'approve-sandbox-test-usdc', 'Consent missing');
      check(body.input === 'secure-verifymydevice.ng', 'Unexpected scan');
      if (outcome === 'failure') return route.fulfill({ status: 502, json: { error: 'Inspection incomplete. Do not retry.', transaction } });
      return route.fulfill({ json: { finalSourceUrl: 'https://csirt.ncc.gov.ng/mock-advisory', sourceTitle: 'MOCK advisory',
        foundInLivePage: 'yes', approvedMaxTestUSDC: 0.003606, transaction, checkedAt: 'mock-time',
        scope: 'MOCK inspection: official advisory only; suspicious website NOT opened.' } });
    }
    return route.abort();
  };
  await page.route(`${base.origin}/api/health`, healthRoute);
  await page.route(`${base.origin}/api/buy/**`, buyRoute);
  try {
    await page.goto(base.origin+'/app');
    await page.setViewportSize({ width: 320, height: 850 });
    await page.locator('#read-aloud').uncheck();
    await page.locator('#message-input').fill('secure-verifymydevice.ng');
    await page.locator('#message-input').press('Enter');
    await page.locator('#evidence-result[data-status="known-phishing"]').waitFor();
    const finding = await page.locator('#finding-title').innerText();
    const quote = async () => {
      await page.locator('#quote-source').click();
      await page.waitForFunction(() => !document.querySelector('#quote-source').disabled);
    };
    await quote();
    await page.locator('#inspect-source').click();
    check(await page.locator('#buy-confirm-dialog').isVisible(), 'Review dialog missing');
    check(await page.locator('#buy-dialog-cancel').evaluate(e => e === document.activeElement), 'Cancel should receive focus');
    await page.locator('#buy-dialog-cancel').click();
    check(inspections === 0, 'Cancel caused a purchase request');
    await page.locator('#inspect-source').click();
    await page.keyboard.press('Escape');
    check(inspections === 0 && !await page.locator('#buy-confirm-dialog').isVisible(), 'Escape did not cancel');
    quoteMode = 'invalid'; await quote();
    check(!await page.locator('#inspect-source').isVisible(), 'Invalid new quote left stale approval available');
    quoteMode = 'expired'; await quote();
    await page.locator('#inspect-source').click();
    check(!await page.locator('#buy-confirm-dialog').isVisible() && inspections === 0, 'Expired quote allowed approval');
    quoteMode = 'valid'; await quote();
    await page.locator('#inspect-source').click();
    await page.locator('#buy-dialog-approve').click(); // Intercepted; never reaches server.
    await page.getByText('PAID SOURCE CHECK · CELO SEPOLIA', { exact: true }).waitFor();
    check(inspections === 1, 'Mock success did not use exactly one request');
    check(await page.locator('#finding-title').innerText() === finding, 'Paid output changed deterministic finding');
    check(await page.locator('#browser-output a').getAttribute('href') === `https://celo-sepolia.blockscout.com/tx/${transaction}`, 'Receipt explorer link incorrect');
    await page.setViewportSize({ width: 768, height: 850 });
    outcome = 'failure'; await quote();
    await page.locator('#inspect-source').click();
    await page.locator('#buy-dialog-approve').click(); // Intercepted failure.
    await page.waitForFunction(() => !document.querySelector('#send-button').disabled);
    check((await page.locator('#browser-progress').innerText()).includes('Check sandbox receipts'), 'Recovery instructions missing');
    check(await page.locator('#browser-output a').getAttribute('href') === `https://celo-sepolia.blockscout.com/tx/${transaction}`, 'Partial failure lost transaction');
    check(!(await page.locator('#browser-output').innerText()).includes('MOCK advisory'), 'Stale success remained after failure');
    check(inspections === 2, 'Unexpected automatic retry');
    return { provider: 'MOCK buy responses; real Chromium and local deterministic analysis',
      inspections, realPurchases: 0, cancel: true, escape: true, invalidQuote: true, expiredQuote: true,
      deterministicFindingPreserved: true, successAndFailureReceiptLinks: true, automaticRetries: 0 };
  } finally {
    await page.unroute(`${base.origin}/api/health`, healthRoute);
    await page.unroute(`${base.origin}/api/buy/**`, buyRoute);
  }
}
