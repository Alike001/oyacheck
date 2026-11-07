// Opt-in helper for an existing Playwright page. No provider SDK or credentials
// in the browser. Run against a dedicated local server with its existing key.
import assert from 'node:assert/strict';

export async function verifyGroqBrowser(page, origin = 'http://127.0.0.1:4173') {
  const url = new URL(origin);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Use a local server');
  assert.equal(url.protocol, 'http:');
  let calls = 0;
  const responses = [];
  const guard = async route => {
    const request = route.request();
    if (request.method() === 'GET') return route.continue();
    if (new URL(request.url()).pathname !== '/api/ask' || ++calls > 2) return route.abort();
    return route.continue();
  };
  await page.route(`${url.origin}/api/**`, guard);
  try {
    await page.goto(url.origin+'/app');
    const health = await page.evaluate(async () => (await fetch('/api/health')).json());
    assert.equal(health.aiConfigured, true, 'No configured Groq key: zero provider requests made');
    for (const [language, question] of [
      ['en', 'How can I spot a phishing message?'],
      ['pcm', 'How I go know say message na phishing? Answer for Nigerian Pidgin.'],
    ]) {
      // Each fresh conversation must use /api/ask, with no scan or follow-up.
      await page.reload();
      await page.locator('#read-aloud').uncheck();
      await page.locator(`[data-lang="${language}"]`).click();
      await page.locator('#message-input').fill(question);
      const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/api/ask', { timeout: 20_000 });
      await page.locator('#message-input').press('Enter');
      const response = await pending;
      assert.equal(response.status(), 200);
      const body = await response.json();
      assert.equal(body.answer?.method, 'groq', `Live ${language} failed: ${body.answer?.reason || 'unknown'}`);
      assert.equal(body.answer.reason, undefined);
      assert.equal(body.report, null);
      assert.ok(body.answer.text.trim().length > 0 && body.answer.text.length <= 1600);
      const rendered = page.locator('.chat-message.assistant').last();
      await rendered.locator('.message-meta').filter({ hasText: 'LIVE AI · GROQ' }).waitFor({ timeout: 5000 });
      assert.equal(await rendered.locator('p').innerText(), body.answer.text);
      assert.equal(await page.locator('html').getAttribute('lang'), language);
      responses.push({ language, method: body.answer.method, characters: body.answer.text.length, rendered: true });
    }
    assert.equal(calls, 2);
    return { provider: 'genuine Groq', requests: calls, retries: 0, responses };
  } finally {
    await page.unroute(`${url.origin}/api/**`, guard);
  }
}
