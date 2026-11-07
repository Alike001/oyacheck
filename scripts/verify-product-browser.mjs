// Run against a dedicated local server with AI credentials absent and payments off.
// Uses actual analysis HTTP. Only the error/voice-availability cases are mocked.
export async function verifyProductBrowser(page,origin,artifacts){
  const base=new URL(origin),check=(ok,message)=>{if(!ok)throw new Error(message);};
  check(base.hostname==='127.0.0.1'&&base.protocol==='http:','Dedicated loopback server required');
  const health=await(await page.request.get(origin+'/api/health')).json();
  check(health.aiConfigured===false&&!health.sourceInspectionSandboxEnabled&&!health.mainnetPreparation&&!health.localBrowserDemo,'Use an AI-free, financial-off test server');
  const errors=[],outbound=[],mutations=[];let scans=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    // Disable actual audio; no microphone or transcription request in this test.
    Object.defineProperty(window,'SpeechRecognition',{value:undefined,configurable:true});
    Object.defineProperty(window,'webkitSpeechRecognition',{value:undefined,configurable:true});
    addEventListener('DOMContentLoaded',()=>{const read=document.getElementById('read-aloud');if(read)read.checked=false;});
  });
  await page.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==base.origin){outbound.push(url.origin);return route.abort();}
    if(request.method()!=='GET'){mutations.push(url.pathname);if(url.pathname==='/api/analyze')scans++;if(!['/api/analyze','/api/ask','/api/chat'].includes(url.pathname))return route.abort();}
    return route.continue();
  });
  const fit=async()=>page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth}));
  const results=[];
  for(const width of [320,360,390,412,768,1440]){
    await page.setViewportSize({width,height:900});await page.goto(origin+'/');
    check(await page.locator('#home-view').isVisible(),'Landing unavailable');let size=await fit();check(size.documentWidth<=width,`Landing overflow at ${width}`);
    if(width===390||width===1440)await page.screenshot({path:`${artifacts}/landing-${width}.png`,fullPage:true});
    // A lower-page CTA must reveal the focused composer, even after deep scrolling.
    await page.locator('#landing-input').fill('https://example.org/draft');
    await page.locator('#faq .inline-link').click();
    check(await page.locator('#message-input').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),`FAQ CTA left input off-screen at ${width}`);
    await page.goBack();await page.waitForFunction(()=>!document.querySelector('#home-view').hidden);
    check(await page.locator('#landing-input').inputValue()==='https://example.org/draft','CTA navigation lost landing draft');
    await page.locator('#landing-input').fill('https://paypal.com.evil.example/login');await page.locator('.landing-submit').click();
    await page.waitForFunction(()=>document.querySelector('#finding-host').textContent==='paypal.com.evil.example'&&!document.querySelector('#send-button').disabled);
    check(new URL(page.url()).pathname==='/app'&&!new URL(page.url()).search,'Private navigation URL');
    check(await page.locator('#finding-title').textContent()==='Suspicious signals','Real warning missing');
    check(await page.locator('#message-input').inputValue()==='https://paypal.com.evil.example/login','Draft lost');
    check(await page.evaluate(()=>document.activeElement.id)==='finding-title','Result focus missing');
    size=await fit();check(size.documentWidth<=width,`Result overflow at ${width}`);
    check(await page.locator('#browser-investigation').isHidden()&&await page.locator('#mainnet-investigation').isHidden(),'Financial UI exposed');
    if(width===390||width===1440)await page.screenshot({path:`${artifacts}/checker-${width}.png`,fullPage:true});
    const before=scans;await page.goBack();await page.waitForFunction(()=>!document.querySelector('#home-view').hidden);await page.goForward();await page.waitForFunction(()=>!document.querySelector('#app-view').hidden);
    check(scans===before,'History triggered analysis again');check(await page.locator('#finding-host').textContent()==='paypal.com.evil.example','History lost result');
    await page.locator('#new-check').click();check(await page.locator('#message-input').inputValue()==='','New check not cleared');
    results.push({width,landingFits:true,resultFits:true,realAnalysis:true,historyPreserved:true,anotherCheck:true,lowerPageCTA:true,landingDraftPreserved:true});
  }
  await page.goto(origin+'/');await page.locator('[data-landing-mode="message"]').click();await page.locator('#landing-input').fill('Lunch is at noon. See you there.');await page.locator('.landing-submit').click();await page.waitForFunction(()=>document.querySelector('#finding-title').textContent==='No obvious warning signs');
  await page.goto(origin+'/app');check(await page.locator('#app-view').isVisible(),'Direct app route unavailable');
  for(const [value,label] of [['https://www.wikipedia.org','No known threat found'],['not a valid URL','Could not check'],['https://paypa1.com','Suspicious signals'],['https://bit.ly/example','Suspicious signals'],['https://secure-verifymydevice.ng','Known phishing domain']]){
    await page.locator('#message-input').fill(value);await page.locator('#message-input').press('Enter');
    await page.waitForFunction(expected=>document.querySelector('#finding-title').textContent===expected&&!document.querySelector('#send-button').disabled,label);
  }
  await page.locator('[data-check-mode="message"]').click();await page.locator('#message-input').fill('Final notice. Your account is blocked. Send your OTP immediately.');await page.locator('#send-button').click();
  await page.waitForFunction(()=>document.querySelector('#finding-host').textContent.includes('Message only')&&!document.querySelector('#send-button').disabled);
  check(await page.locator('#finding-title').textContent()==='Suspicious signals','Message-only warnings missing');
  await page.locator('[data-lang="pcm"]').click();await page.waitForFunction(()=>document.querySelector('#finding-title').textContent==='Some warning signs dey'&&!document.querySelector('#send-button').disabled);
  await page.locator('[data-lang="en"]').click();await page.waitForFunction(()=>document.querySelector('#finding-title').textContent==='Suspicious signals'&&!document.querySelector('#send-button').disabled);
  await page.locator('#message-input').fill('Lunch is at noon. See you there.');await page.locator('#send-button').click();await page.waitForFunction(()=>document.querySelector('#finding-title').textContent==='No obvious warning signs'&&!document.querySelector('#send-button').disabled);
  await page.locator('[data-check-mode="url"]').click();
  const secret='https://example.org/path?token=private-browser-fixture';
  await page.route(origin+'/api/analyze',async route=>{await new Promise(resolve=>setTimeout(resolve,250));return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary test outage. Please retry.'})});},{times:1});
  await page.locator('#message-input').fill(secret);await page.locator('#send-button').click();check(await page.locator('#send-button').isDisabled(),'Missing loading guard');
  await page.locator('#request-error').waitFor({state:'visible'});check(await page.locator('#message-input').inputValue()===secret,'Error lost private draft');check(await page.locator('#evidence-result').isHidden(),'Stale result shown after error');
  await page.locator('#retry-check').click();await page.waitForFunction(()=>document.querySelector('#finding-host').textContent==='example.org'&&!document.querySelector('#send-button').disabled);
  check(!page.url().includes('private-browser-fixture'),'Sensitive URL leaked into navigation');
  check(await page.evaluate(()=>!JSON.stringify(history.state).includes('private-browser-fixture')&&!JSON.stringify(localStorage).includes('private-browser-fixture')&&!JSON.stringify(sessionStorage).includes('private-browser-fixture')),'Input persisted');
  check(!(await page.locator('#evidence-result').textContent()).includes('private-browser-fixture'),'Sensitive query leaked into report');
  await page.locator('#mic-button').click();check((await page.locator('#voice-status').textContent()).includes('unavailable'),'Microphone availability feedback missing');
  await page.evaluate(()=>Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:class {start(){queueMicrotask(()=>{this.onerror({error:'not-allowed'});this.onend();});}stop(){this.onend();}}}));
  await page.locator('#mic-button').click();await page.waitForFunction(()=>document.querySelector('#voice-status').textContent.includes('not-allowed'));
  check(await page.locator('#mic-button').getAttribute('aria-pressed')==='false'&&await page.locator('#send-button').isEnabled(),'Permission denial did not restore typing');
  await page.locator('#message-input').focus();await page.keyboard.press('Tab');check(await page.evaluate(()=>document.activeElement.id)==='ai-explanation','Keyboard order skips explanation choice');
  await page.getByRole('link',{name:'FAQ',exact:true}).click();check(await page.locator('#home-view').isVisible(),'FAQ navigation did not restore landing');
  const summary=page.locator('#faq summary').first();await summary.focus();await page.keyboard.press('Enter');check(await summary.evaluate(e=>e.parentElement.open),'Keyboard FAQ failed');
  await page.getByRole('link',{name:'Product',exact:true}).click();check(new URL(page.url()).hash==='#product','Product navigation failed');
  check(outbound.length===0,'Submitted site or external service opened');check(errors.length===0,errors.join('; '));
  return {browser:'real Chromium',viewports:results,fixtures:7,messageAndPidgin:true,errorRetryRetainsInput:true,staleResultHidden:true,privateHistory:true,microphoneUnavailable:true,mockedPermissionDenied:true,keyboard:true,pageErrors:errors,externalRequests:outbound,allowedMutations:[...new Set(mutations)],financialRequests:0};
}
