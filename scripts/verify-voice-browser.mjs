// Controlled-media acceptance. Never calls a transcription provider or financial API.
// PCM capture/encoding/meter are real Chromium APIs. Provider and playback responses
// below are explicit test doubles, not evidence of recognition or audible output.
export async function verifyVoiceBrowser(browserType,origin,artifacts,audioFile){
  if(new URL(origin).hostname!=='127.0.0.1')throw Error('Loopback required');
  const browser=await browserType.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${audioFile}`]});
  const context=await browser.newContext({permissions:['microphone']});const page=await context.newPage();
  const check=(v,m)=>{if(!v)throw Error(m);},errors=[],uploads=[],external=[];let responseMode='failure',analyses=0,questions=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.__captures=0;window.__tracks=[];
    navigator.mediaDevices.getUserMedia=async options=>{window.__captures++;const stream=await original(options);window.__tracks.push(...stream.getTracks());return stream;};
    window.__playback=[];window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
    window.speechSynthesis.getVoices=()=>[{name:'Controlled English voice',lang:'en-GB'}];
    window.speechSynthesis.speak=utterance=>{window.__playback.push(utterance.text);window.__utterance=utterance;utterance.onstart();};
  });
  await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin){external.push(url.origin);return route.abort();}
    if(url.pathname==='/api/health'){const response=await route.fetch(),health=await response.json();check(!health.aiConfigured&&!health.sourceInspectionSandboxEnabled&&!health.mainnetPreparation,'Financial-off key-free server required');return route.fulfill({json:{...health,voiceTranscription:true}});}
    if(url.pathname==='/api/voice/transcribe'){
      uploads.push({bytes:request.postDataBuffer()?.length,type:request.headers()['content-type'],language:url.searchParams.get('lang')});
      if(responseMode==='failure')return route.fulfill({status:503,json:{error:'Controlled provider outage. Type or retry.'}});
      if(responseMode==='delay'){await new Promise(resolve=>setTimeout(resolve,3000));}
      return route.fulfill({json:{text:responseMode==='sensitive'?'my OTP 123456':url.searchParams.get('lang')==='pcm'?'Abeg no share your OTP with anybody':'Please check this message before I trust it',reviewRequired:true}});
    }
    if(request.method()!=='GET'&&!['/api/analyze','/api/chat','/api/ask'].includes(url.pathname))throw Error('Unexpected mutation '+url.pathname);
    if(url.pathname==='/api/analyze')analyses++;if(['/api/ask','/api/chat'].includes(url.pathname))questions++;
    return route.continue();
  });
  const dock=()=>page.locator('[data-voice-dock="app"]');
  const capture=async name=>{for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});if(name==='voice-listening')await page.waitForFunction(()=>[...document.querySelectorAll('[data-voice-dock=app] [data-signal-bar]')].some(e=>Number(e.getAttribute('height'))>8));await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:`${artifacts}/${name}-${width}.png`,fullPage:true,animations:'disabled'});}};

  try{
    await page.goto(origin+'/app');await page.waitForFunction(()=>document.querySelector('#voice-status').textContent.includes('Ready.'));
    check(await page.evaluate(()=>window.__captures)===0,'Automatic microphone capture');
    await capture('voice-ready');await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:`${artifacts}/voice-ready-desktop.png`,fullPage:true});
    await page.locator('#mic-button').click();
    await page.waitForFunction(()=>document.querySelector('[data-voice-dock="app"]').dataset.state==='listening'&&parseInt(document.querySelector('#voice-level').style.width)>0);
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-voice-dock=app] [data-signal-bar]')].some(e=>Number(e.getAttribute('height'))>8));
    const realLevel=await page.locator('#voice-level').evaluate(e=>e.style.width);
    check(await page.locator('#suggestions button[data-example]:disabled').count()===3,'Examples remained active during capture');
    await capture('voice-listening');
    for(const width of [320,360,390,412,768,1440]){await page.setViewportSize({width,height:1000});check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Voice overflow at ${width}`);}
    await page.locator('#mic-button').focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');check(await page.locator('#mic-button').evaluate(e=>getComputedStyle(e).outlineStyle!=='none'),'Microphone focus invisible');
    await page.screenshot({path:`${artifacts}/voice-listening-desktop.png`,fullPage:true});
    await page.locator('#mic-button').click();await page.waitForFunction(()=>document.querySelector('[data-voice-dock="app"]').dataset.state==='error');
    check(uploads.length===1&&uploads[0].bytes>100&&uploads[0].type.startsWith('audio/'),'Real encoded recording absent');
    check(await page.evaluate(()=>window.__tracks.every(t=>t.readyState==='ended')),'Microphone left live');check(await page.locator('[data-voice-dock=app] [data-signal-bar]').evaluateAll(es=>es.every(e=>e.getAttribute('height')==='8')),'Idle signal invented activity');
    await capture('voice-error');
    check(await page.locator('#send-button').isEnabled(),'Typing not restored');await page.screenshot({path:`${artifacts}/voice-error-desktop.png`,fullPage:true});
    responseMode='success';await page.locator('#mic-button').click();await page.waitForFunction(()=>document.querySelector('[data-voice-dock="app"]').dataset.state==='listening');await dock().locator('[data-voice-cancel]').click();
    check(uploads.length===1,'Cancel uploaded a recording');await capture('voice-cancelled');
    await page.locator('#message-input').fill('Existing unsent draft.');await page.locator('[data-voice-dock=app] [data-session-language=pcm]').click();
    await page.locator('#mic-button').click();await page.waitForFunction(()=>document.querySelector('[data-voice-dock="app"]').dataset.state==='listening'&&parseInt(document.querySelector('#voice-level').style.width)>0);await page.locator('#mic-button').click();
    await page.waitForFunction(()=>document.querySelector('#message-input').value.includes('Abeg no share'));
    check((await page.locator('#message-input').inputValue()).startsWith('Existing unsent draft.'),'Transcript lost draft');check(analyses===0,'Transcript auto-submitted');check(uploads.at(-1).language==='pcm','Pidgin request hint lost');
    await page.locator('#send-button').click();await page.locator('#evidence-result').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#send-button').disabled);
    await page.locator('#listen-result').click();await page.locator('#stop-result-audio').waitFor({state:'visible'});await capture('voice-speaking');check(await page.evaluate(()=>window.__playback[0])===await page.locator('#result-explanation').textContent(),'Playback did not use actual finding');await page.locator('#stop-result-audio').click();check(await page.locator('#stop-result-audio').isHidden(),'Playback stop failed');
    await page.locator('#new-check').click();await page.reload();await page.waitForFunction(()=>document.querySelector('#voice-status').textContent.includes('Ready.'));await page.setViewportSize({width:390,height:900});await page.screenshot({path:`${artifacts}/voice-ready-mobile.png`,fullPage:true});await page.locator('[data-voice-dock=app] [data-session-language=pcm]').click();
    await page.locator('#mic-button').click();await page.waitForFunction(()=>document.querySelector('[data-voice-dock="app"]').dataset.state==='listening'&&parseInt(document.querySelector('#voice-level').style.width)>0);await page.screenshot({path:`${artifacts}/voice-listening-mobile.png`,fullPage:true});await dock().locator('[data-voice-cancel]').click();
    responseMode='delay';await page.locator('#mic-button').click();await page.waitForFunction(()=>document.querySelector('[data-voice-dock="app"]').dataset.state==='listening'&&parseInt(document.querySelector('#voice-level').style.width)>0);await page.locator('#mic-button').click();await page.waitForFunction(()=>document.querySelector('[data-voice-dock="app"]').dataset.state==='transcribing');await capture('voice-transcribing');await dock().locator('[data-voice-cancel]').click();await page.waitForTimeout(3100);check(await page.locator('#message-input').inputValue()==='','Late cancelled transcript accepted');
    responseMode='failure';await page.locator('#mic-button').click();await page.waitForFunction(()=>document.querySelector('[data-voice-dock="app"]').dataset.state==='listening'&&parseInt(document.querySelector('#voice-level').style.width)>0);await page.locator('#mic-button').click();await page.waitForFunction(()=>document.querySelector('[data-voice-dock="app"]').dataset.state==='error');await page.screenshot({path:`${artifacts}/voice-error-mobile.png`,fullPage:true});
    responseMode='sensitive';await page.locator('#voice-options > summary').click();await page.locator('#auto-voice').check();
    await page.locator('#mic-button').click();await page.waitForFunction(()=>document.querySelector('[data-voice-dock="app"]').dataset.state==='listening'&&parseInt(document.querySelector('#voice-level').style.width)>0);await page.locator('#mic-button').click();
    await page.waitForFunction(()=>document.querySelector('[data-voice-dock="app"]').dataset.state==='reviewing');check(await page.locator('#message-input').inputValue()==='my OTP 123456','Sensitive transcript not held for review');check(analyses===1&&questions===0,'Sensitive transcript auto-submitted');await page.locator('#auto-voice').uncheck();
    await capture('voice-reviewing');
    await page.screenshot({path:`${artifacts}/voice-reviewing-mobile.png`,fullPage:true});
    await page.getByRole('link',{name:'OyaCheck home'}).click();responseMode='success';await page.locator('#landing-mic').click();await page.waitForFunction(()=>document.querySelector('[data-voice-dock="landing"]').dataset.state==='listening'&&parseInt(document.querySelector('#landing-voice-level').style.width)>0);await page.locator('#landing-mic').click();await page.waitForFunction(()=>document.querySelector('#landing-input').value.includes('Abeg no share'));check(analyses===1,'Landing transcript auto-submitted');
    await page.emulateMedia({reducedMotion:'reduce'});check(await page.locator('#landing-voice-level').evaluate(e=>getComputedStyle(e).transitionDuration)==='0s','Reduced motion ignored');
    await page.locator('#landing-mic').click();await page.waitForFunction(()=>document.querySelector('[data-voice-dock="landing"]').dataset.state==='listening'&&parseInt(document.querySelector('#landing-voice-level').style.width)>0);
    check(await page.locator('[data-voice-dock=landing] [data-signal-bar]').evaluateAll(es=>es.every(e=>e.getAttribute('height')==='8')),'Reduced-motion signal moved');await page.locator('[data-voice-dock=landing] [data-voice-cancel]').click();
    check(external.length===0,'External provider called');check(errors.length===0,errors.join('; '));
    return {capture:'real Chromium getUserMedia + MediaRecorder; synthetic PCM input',realLevel,uploads,transcription:'mocked only; recognition quality unproven',playback:'mocked only; actual result text, stop verified',cancelAndLateResults:true,draftsAndReview:true,sensitiveAutoSendBlocked:true,landingVoice:true,signalDrivenByRealCapture:true,reducedMotion:true,voiceViewports:[320,360,390,412,768,1440],physicalMicrophone:'not tested',external,errors};
  }finally{await browser.close();}
}

// Same real capture path, with digital silence and no transcription response.
export async function verifyVoiceSilence(browserType,origin,audioFile){
  if(new URL(origin).hostname!=='127.0.0.1')throw Error('Loopback required');
  const browser=await browserType.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-gpu','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${audioFile}`]});
  try{
    const context=await browser.newContext({permissions:['microphone']}),page=await context.newPage();let uploads=0;
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
      if(url.pathname==='/api/health'){const d=await(await route.fetch()).json();if(d.aiConfigured||d.mainnetPreparation||d.sourceInspectionSandboxEnabled)throw Error('Key-free financial-off server required');return route.fulfill({json:{...d,voiceTranscription:true}});}
      if(route.request().method()!=='GET'){uploads++;return route.abort();}return route.continue();
    });
    await page.goto(origin+'/app');await page.waitForFunction(()=>document.querySelector('#voice-status').textContent.includes('Ready.'));
    await page.locator('#mic-button').click();await page.waitForFunction(()=>document.querySelector('[data-voice-dock="app"]').dataset.state==='error',null,{timeout:20000});
    const status=await page.locator('#voice-status').textContent();if(uploads!==0||!status.includes('No speech activity')||!await page.locator('#send-button').isEnabled())throw Error('Silence not discarded safely');
    return {status,uploads,typing:true,input:'synthetic digital silence; real capture'};
  }finally{await browser.close();}
}
