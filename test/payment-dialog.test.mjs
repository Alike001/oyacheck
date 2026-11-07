import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const html = await readFile(new URL('../public/index.html', import.meta.url),'utf8');
const js = await readFile(new URL('../public/app.js', import.meta.url),'utf8');
const css = await readFile(new URL('../public/styles.css', import.meta.url),'utf8');

test('payment approval uses an accessible native dialog',()=>{
  assert.match(html,/<dialog id="buy-confirm-dialog"[^>]+aria-labelledby="buy-dialog-title"[^>]+aria-describedby="buy-dialog-description"/);
  for(const id of ['buy-dialog-close','buy-dialog-cancel','buy-dialog-approve','buy-dialog-amount','buy-dialog-network']) {
    assert.ok(html.includes(`id="${id}"`), `${id} missing`);
  }
  assert.match(html, /submitted suspicious website will not be visited/);
});
test('no browser confirm or alert interrupts checkout',()=>{
  assert.doesNotMatch(js,/window\.(?:confirm|alert)\s*\(/);
  assert.match(js, /buyConfirmDialog\.showModal\(\)/);
  assert.match(js,/buyDialogCancel\.addEventListener\('click', closeBuyDialog\)/);
  assert.match(js,/buyDialogApprove\.addEventListener\('click',async/);
});
test('payment is approved only inside the explicit approval handler',()=>{
  const approval=js.indexOf("buyDialogApprove.addEventListener('click',async");
  const payment=js.indexOf("jsonPost('/api/buy/inspect'");
  const modalOpen=js.indexOf('buyConfirmDialog.showModal()');
  assert.ok(modalOpen>0 && approval>modalOpen && payment>approval);
  assert.match(js.slice(approval,payment),/Date\.now\(\)>=quoteExpiresAt/);
  assert.match(js.slice(approval,payment),/setBusy\(true\)/);
  assert.match(js.slice(approval,payment),/pendingQuote=null/);
});
test('quote is verified as testnet USDC and capped before display',()=>{
  assert.match(js, /q\.network!=='Celo Sepolia'/);
  assert.match(js, /q\.token!=='USDC'/);
  assert.match(js, /q\.sandboxOnly!==true/);
  assert.match(js, /Number\(q\.amount\)>0\.01/);
});
test('dialog is styled on desktop and mobile, and successful source inspection scope is accurate',()=>{
  assert.match(css, /\.payment-dialog::backdrop/);
  assert.match(css, /@media\(max-width:510px\)[^{]*\{\.payment-dialog/);
  assert.match(js, /scopeText\.textContent='The trusted NCC advisory was opened/);
  assert.match(html, /No suspicious link opened/);
});
