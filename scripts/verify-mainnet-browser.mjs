// Use ONLY with test/fixtures/mainnet-server.mjs --pair. All financial effects
// are injected fakes. No production payment endpoint exists.
export async function verifyMainnetBrowser(page, origins) {
  const check=(condition,message)=>{if(!condition)throw new Error(message);};
  const results=[];
  for(const [index,origin] of origins.entries()) {
    const mode=index===0?'success':'partial';
    const url=new URL(origin);check(url.hostname==='127.0.0.1'&&url.protocol==='http:','Local fixture required');
    const setMode=async value=>page.evaluate(async mode=>{const r=await fetch('/__mock/mode',{method:'POST',body:JSON.stringify({mode})});if(!r.ok)throw new Error('Financial fake is not available');},value);
    const scan=async()=>{await page.locator('#read-aloud').uncheck();await page.locator('#message-input').fill('secure-verifymydevice.ng');await page.locator('#message-input').press('Enter');await page.locator('#evidence-result[data-status="known-phishing"]').waitFor();};
    await page.goto(origin);
    const stats=await page.evaluate(async()=>await(await fetch('/__mock/stats')).json());
    check(stats.mock===true&&stats.calls===0,'Fresh explicitly mocked financial fixture required');
    await scan();
    for(const width of [320,360,390,412,768]) {
      await page.setViewportSize({width,height:850});
      check(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Mainnet preparation widened document');
    }
    for(const [failure,message] of [['unavailable','provider is unavailable'],['funds','Insufficient token funds']]) {
      await setMode(failure);await page.locator('#mainnet-quote').click();
      await page.waitForFunction(message=>document.querySelector('#mainnet-status').textContent.includes(message),message);
    }
    await setMode('success');
    await page.locator('#mainnet-quote').click();await page.locator('#mainnet-request').waitFor({state:'visible'});
    check((await page.locator('#mainnet-plan').innerText()).includes('0.003606 USDC'),'Exact price not displayed');
    await page.locator('#mainnet-cancel').click();await page.waitForFunction(()=>document.querySelector('#mainnet-status').textContent.includes('cancelled'));
    await page.reload();await page.waitForFunction(()=>document.querySelector('#mainnet-status').textContent.includes('cancelled'));
    await scan();
    await page.locator('#mainnet-quote').click();await page.locator('#mainnet-request').waitFor({state:'visible'});
    const expired=await page.evaluate(()=>localStorage.getItem('oya-mainnet-purchase'));
    await page.evaluate(async id=>await fetch('/__mock/expire',{method:'POST',body:JSON.stringify({id})}),expired);
    await page.locator('#mainnet-refresh').click();await page.waitForFunction(()=>document.querySelector('#mainnet-status').textContent.includes('expired'));
    check(!await page.locator('#mainnet-request').isVisible(),'Expired quote remained requestable');
    await page.locator('#mainnet-quote').click();await page.locator('#mainnet-request').waitFor({state:'visible'});
    await page.locator('#mainnet-request').click();await page.waitForFunction(()=>document.querySelector('#mainnet-status').textContent.includes('Awaiting separate operator approval'));
    await page.reload();await page.waitForFunction(()=>document.querySelector('#mainnet-status').textContent.includes('Awaiting separate operator approval'));
    await scan();const finding=await page.locator('#finding-title').innerText();
    const before=await page.evaluate(async()=>await(await fetch('/__mock/stats')).json());check(before.calls===0,'Browser request triggered a financial call');
    const purchase=await page.evaluate(async()=>await(await fetch('/api/mainnet/purchases/'+localStorage.getItem('oya-mainnet-purchase'))).json());
    await setMode(mode);
    const mockExecution=await page.evaluate(async purchase=>await(await fetch('/__mock/execute',{method:'POST',body:JSON.stringify({id:purchase.id,fingerprint:purchase.fingerprint})})).json(),purchase);
    check(mockExecution.mock===true,'Only injected financial execution is permitted');
    await page.locator('#mainnet-refresh').click();
    const expected=mode==='success'?'settlement still requires':'outcome is uncertain';
    await page.waitForFunction(text=>document.querySelector('#mainnet-status').textContent.includes(text),expected);
    check(await page.locator('#finding-title').innerText()===finding,'Financial outcome changed the deterministic verdict');
    await page.reload();await page.waitForFunction(text=>document.querySelector('#mainnet-status').textContent.includes(text),expected);
    const after=await page.evaluate(async()=>await(await fetch('/__mock/stats')).json());check(after.calls===1,'Financial operation was repeated');
    check(await page.locator('#mainnet-result a').getAttribute('href')===`https://celoscan.io/tx/${'0x'+'b'.repeat(64)}`,'Mock receipt link missing after reload');
    results.push({outcome:mode,mockFinancialCalls:after.calls,realFinancialCalls:0,cancel:true,expiry:true,unavailable:true,insufficientFunds:true,reloadRecovery:true,deterministicVerdictPreserved:true});
  }
  return {browser:'real Chromium',provider:'explicit test fixture, never a real financial provider',results};
}
