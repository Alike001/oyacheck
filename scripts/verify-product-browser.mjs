// Dedicated loopback review: actual deterministic API, no live AI key or payments.
// Only transport failure and browser audio availability are mocked; verdicts are not.
export async function verifyProductBrowser(page,origin,artifacts){
  const base=new URL(origin),check=(v,m)=>{if(!v)throw Error(m);};
  check(base.hostname==='127.0.0.1'&&base.protocol==='http:','Loopback review server required');
  const health=await(await page.request.get(origin+'/api/health')).json();
  check(!health.aiConfigured&&!health.voiceTranscription&&!health.sourceInspectionSandboxEnabled&&!health.mainnetPreparation&&!health.localBrowserDemo,'Use an AI-free financial-off server');
  const errors=[],external=[],requests=[],responses=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    Object.defineProperty(window,'SpeechRecognition',{value:undefined,configurable:true});
    Object.defineProperty(window,'webkitSpeechRecognition',{value:undefined,configurable:true});
    window.__reviewSpoken=0;
    window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
    if(window.speechSynthesis){window.speechSynthesis.getVoices=()=>[{lang:'en-NG',name:'Test voice'}];window.speechSynthesis.speak=utterance=>{window.__reviewSpoken++;utterance.onstart?.();};}
  });
  await page.route('**/*',route=>{const r=route.request(),u=new URL(r.url());
    if(u.origin!==base.origin){external.push(u.origin);return route.abort();}
    if(r.method()!=='GET'){requests.push({path:u.pathname,body:r.postDataJSON()});if(!['/api/analyze','/api/chat','/api/ask'].includes(u.pathname))return route.abort();}
    return route.continue();
  });
  const record=async action=>{const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/analyze'&&r.status()===200);await action();responses.push(await(await pending).json());};
  const fit=async width=>check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow at ${width}`);
  const capture=async(name,width)=>{if(![390,1440].includes(width))return;await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:`${artifacts}/${name}-${width===1440?'desktop':'mobile'}.png`,fullPage:true,animations:'disabled'});};
  const edit=async()=>{if(!await page.locator('#input-panel').evaluate(e=>e.open))await page.locator('#input-panel > summary').click();};
  const scan=async(value,mode='url')=>{await edit();await page.locator(`[data-check-mode="${mode}"]`).click();await page.locator('#message-input').fill(value);await record(()=>page.locator('#send-button').click());await page.waitForFunction(()=>!document.querySelector('#evidence-result').hidden&&!document.querySelector('#send-button').disabled);};
  const verifyExact=async()=>{
    const data=responses.at(-1);check(data,'Missing actual API evidence');
    check(await page.locator('#finding-title').textContent()===data.label,'Deterministic verdict changed');
    check(await page.locator('#technical-reasons li').allTextContents().then(list=>JSON.stringify(list)===JSON.stringify(data.reasons.map(x=>x.text))),'Full provenance lost');
    if(data.host)check(await page.locator('#finding-host').textContent()===data.host,'Wrong actual hostname');
  };
  await page.goto(origin+'/');await page.locator('[data-voice-dock=landing] [data-session-language=pcm]').click();
  await page.locator('[data-landing-mode=message]').click();const landingText='Final notice: your bank account is blocked. Send your OTP immediately.';await page.locator('#landing-input').fill(landingText);
  await record(()=>page.locator('.landing-submit').click());await page.waitForFunction(()=>!document.querySelector('#send-button').disabled&&!document.querySelector('#evidence-result').hidden);
  check(new URL(page.url()).pathname==='/app'&&await page.locator('#message-input').inputValue()===landingText,'Landing lost submitted draft');check(responses.at(-1).language==='pcm'&&responses.at(-1).status==='suspicious','Landing language/mode not applied');await verifyExact();
  const landingCalls=requests.length;await page.goBack();await page.goForward();check(requests.length===landingCalls,'Landing history re-submitted input');
  const results=[];
  for(const width of [320,360,390,412,768,1440]){
    await page.setViewportSize({width,height:900});await page.goto(origin+'/');await page.evaluate(()=>document.fonts.ready);
    check(await page.locator('#landing-input').inputValue()==='','Prefilled landing input');
    check(!(await page.locator('#landing-input').getAttribute('placeholder')).includes('example.'),'Hardcoded default domain');await fit(width);await capture('landing',width);
    await page.locator('#landing-input').fill('https://example.org/unsent');await page.locator('#faq .inline-link').click();
    check(await page.locator('#message-input').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'Lower CTA hid input');
    await page.goBack();check(await page.locator('#landing-input').inputValue()==='https://example.org/unsent','Landing draft lost');
    await page.goto(origin+'/app');await capture('checker',width);
    check(await page.locator('[data-check-mode]').count()===2,'Primary checker has competing modes');
    check(await page.locator('#voice-options').evaluate(e=>!e.open)&&await page.locator('#question-panel').evaluate(e=>!e.open),'Advanced tools not optional');
    await scan('https://example.org@unrelated.example/account');await verifyExact();await fit(width);
    check(await page.locator('#finding-host').textContent()==='unrelated.example','Userinfo confused destination');
    check(!await page.locator('#input-panel').evaluate(e=>e.open),'Result competes with expanded editor');
    check(await page.locator('#plain-language').evaluate(e=>e.open)&&await page.locator('#technical-details').evaluate(e=>!e.open),'Secondary detail not disclosed');
    await capture('link',width);
    const calls=requests.length;await page.locator('.main-nav a[href="/#how"]').click();await page.goBack();check(requests.length===calls,'History re-submitted');check(await page.locator('#message-input').inputValue()==='https://example.org@unrelated.example/account','History lost draft');
    await scan('Final notice: your bank account is blocked. Send your OTP immediately.','message');await verifyExact();await fit(width);await capture('message',width);
    check(responses.at(-1).status==='suspicious'&&responses.at(-1).host===null,'Message invented hostname/verdict');
    await page.locator('#new-check').click();check(await page.locator('#message-input').inputValue()==='','Another-check did not clear input');check(await page.locator('#evidence-result').isHidden(),'Stale result remained');
    results.push({width,fit:true,singleColumn:true,primaryTabs:2,optionalTools:true,exactFindings:true,historyAndDraft:true,anotherCheck:true});
  }
  await page.locator('[data-check-mode="message"]').click();await page.locator('#message-input').fill('First line');const beforeEnter=requests.length;await page.locator('#message-input').press('Enter');check((await page.locator('#message-input').inputValue()).includes('\n')&&requests.length===beforeEnter,'Message Enter submitted prematurely');
  for(const [value,mode,expected]of [['https://example.org','url','unverified'],['https://www.wikipedia.org/wiki/Internet','url','unverified'],['Lunch is at noon. See you there.','message','unverified'],['not a valid URL','url','invalid'],['https://secure-verifymydevice.ng','url','known-phishing']]){
    await scan(value,mode);check(responses.at(-1).status===expected,`Unexpected controlled finding: ${value}`);await verifyExact();
  }
  await scan('Final notice: your bank account is blocked. Send your OTP immediately.','message');
  const codes=responses.at(-1).reasons.map(x=>x.code).join(',');
  if(!await page.locator('#plain-language').evaluate(e=>e.open))await page.locator('#plain-language > summary').click();await record(()=>page.locator('[data-lang="pcm"]').click());await page.waitForFunction(()=>document.querySelector('#finding-title').textContent==='Some warning signs dey'&&!document.querySelector('#send-button').disabled);await verifyExact();
  check(responses.at(-1).reasons.map(x=>x.code).join(',')===codes,'Language changed indicators');
  await capture('pidgin',1440);await page.setViewportSize({width:390,height:900});await capture('pidgin',390);await page.setViewportSize({width:1440,height:900});
  await record(()=>page.locator('[data-lang="en"]').click());await page.waitForFunction(()=>document.querySelector('#finding-title').textContent==='Suspicious signals'&&!document.querySelector('#send-button').disabled);
  await page.locator('#explanation-options > summary').click();const count=requests.length;await page.locator('#ai-explanation').check();check(requests.length===count,'AI checkbox made an automatic request');
  await record(()=>page.locator('#explain-result').click());await page.waitForFunction(()=>!document.querySelector('#send-button').disabled&&document.querySelector('#result-method').textContent.includes('AI unavailable'));
  check(requests.at(-1).body.explain===true,'Explicit AI opt-in absent');await verifyExact();
  await page.locator('#listen-result').click();check(await page.evaluate(()=>window.__reviewSpoken)===1,'Optional audio action not connected');
  await edit();await page.locator('#message-input').fill('https://example.org/unsent-draft');await page.locator('#question-panel > summary').click();await page.locator('#question-input').fill('What was not checked?');await page.locator('#question-submit').click();await page.waitForFunction(()=>!document.querySelector('#question-submit').disabled&&document.querySelectorAll('.chat-message.assistant').length>0);
  check(await page.locator('#message-input').inputValue()==='https://example.org/unsent-draft','Chat overwrote checker draft');
  check(await page.locator('#chat-stream').evaluate(e=>getComputedStyle(e).overflowY==='visible'&&getComputedStyle(e).maxHeight==='none'),'Nested conversation scroll');
  await page.locator('#new-check').click();await page.locator('#mic-button').click();check((await page.locator('#voice-status').textContent()).includes('unavailable'),'Missing voice availability state');
  await page.evaluate(()=>Object.defineProperty(window,'SpeechRecognition',{configurable:true,value:class{start(){queueMicrotask(()=>{this.onerror({error:'not-allowed'});this.onend();});}stop(){this.onend();}}}));
  await page.locator('#mic-button').click();await page.waitForFunction(()=>document.querySelector('#voice-status').textContent.includes('not-allowed'));check(await page.locator('#send-button').isEnabled(),'Permission failure blocked typing');
  const secret='https://example.org/private?token=redesign-private-fixture';
  await page.route(origin+'/api/analyze',async route=>{await new Promise(r=>setTimeout(r,200));await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary review outage'})});},{times:1});
  await page.locator('#message-input').fill(secret);await page.locator('#send-button').click();check(await page.locator('#send-button').isDisabled(),'Loading duplicate guard missing');await page.locator('#request-error').waitFor({state:'visible'});check(await page.locator('#message-input').inputValue()===secret,'Error lost draft');check(await page.locator('#evidence-result').isHidden(),'Error retained stale finding');await page.locator('#retry-check').click();await page.waitForFunction(()=>!document.querySelector('#send-button').disabled&&!document.querySelector('#evidence-result').hidden);
  check(!page.url().includes('redesign-private-fixture')&&await page.evaluate(()=>![JSON.stringify(history.state),JSON.stringify(localStorage),JSON.stringify(sessionStorage)].some(x=>x.includes('redesign-private-fixture'))),'Private input persisted');
  check(!(await page.locator('#evidence-result').textContent()).includes('redesign-private-fixture'),'Private query exposed in report');
  await page.locator('#new-check').click();await page.locator('#message-input').focus();await page.keyboard.press('Tab');check(await page.evaluate(()=>document.activeElement.id)==='send-button','Primary keyboard path unclear');
  await page.locator('#voice-options > summary').click();await page.locator('#read-aloud').check();
  await scan('https://example.org');await page.waitForFunction(()=>window.__reviewSpoken===2);check(await page.locator('#stop-result-audio').isVisible(),'Explicit automatic playback has no Stop control');await page.locator('#stop-result-audio').click();await edit();await page.locator('#read-aloud').uncheck();
  await page.getByRole('link',{name:'FAQ',exact:true}).click();await page.locator('#faq summary').first().focus();await page.keyboard.press('Enter');check(await page.locator('#faq details').first().evaluate(e=>e.open),'Keyboard FAQ failed');
  await page.locator('#preview-example').click();await page.waitForFunction(()=>!document.querySelector('#preview-result').hidden&&!document.querySelector('#preview-example').disabled);check(await page.locator('#preview-host').textContent()==='unrelated.example','Preview did not use actual analyzer');
  await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:`${artifacts}/live-preview-desktop.png`,fullPage:true});
  for(const [kind,status] of [['message','suspicious'],['ordinary','unverified'],['advisory','known-phishing']]){await record(()=>page.locator(`[data-preview="${kind}"]`).click());check(responses.at(-1).status===status,'Example invented a finding');check(await page.locator('#preview-verdict').textContent()===responses.at(-1).label,'Preview changed actual label');}
  for(const path of ['/fonts/lato-regular.ttf','/fonts/lato-bold.ttf'])check((await page.request.get(origin+path)).status()===200,'Local font missing');
  check(external.length===0,'Unexpected external navigation/service');check(errors.length===0,errors.join('; '));
  return {browser:'real Chromium',viewports:results,controlledFixtures:5,languagePreservesIndicators:true,AI:'explicit opt-in; actual prepared fallback, no live key',audio:'mocked playback; explicit Listen, opt-in automatic reading and Stop',questionDraftPreserved:true,noNestedScroll:true,voicePermission:'mocked denial restored typing',errorAndRetry:true,privateInput:true,keyboard:true,realPreview:true,landingLanguageAndSubmission:true,externalRequests:external,financialRequests:0,pageErrors:errors};
}
