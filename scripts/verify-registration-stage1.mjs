// Real Chromium acceptance checks. Invoke only on the explicit local mock fixture.
export async function verifyRegistrationStage1(page,origin){
  const check=(ok,message)=>{if(!ok)throw new Error(message);};
  const url=new URL(origin);check(url.hostname==='127.0.0.1'&&url.protocol==='http:','Local fixture required');
  const marker=await(await page.request.get(origin+'/__mock/status')).json();
  check(marker.mock===true&&marker.kind==='registration-ui'&&marker.realRPC===false,'Explicit no-RPC fixture required');
  const saved=await(await page.request.get(origin+'/preview')).json();
  const stale=route=>route.fulfill({status:200,json:{...structuredClone(saved),generatedAt:new Date(Date.now()-11*60000).toISOString()}});
  await page.route(origin+'/preview',stale);
  let refreshMode='good';
  const refresh=async route=>{
    if(refreshMode==='failed')return route.fulfill({status:503,json:{error:'MOCK failed refresh'}});
    const preview={...structuredClone(saved),generatedAt:new Date().toISOString()};
    if(refreshMode==='metadata')preview.metadata={published:false};
    return route.fulfill({status:200,json:preview});
  };
  await page.route(origin+'/refresh',refresh);
  await page.addInitScript(()=>{
    const approved='0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a',calls=[];
    const models={};
    const emit=(id,event,value)=>{for(const handler of models[id].listeners.get(event)||[])handler(value);};
    function model(id){
      const m={chain:'0xa4ec',accounts:[approved],reject:false,fail:false,connected:true,announcedAccounts:false,listeners:new Map()};
      m.provider={request:async({method})=>{
        calls.push({id,method});if(m.fail)throw new Error('MOCK unavailable');
        if(method==='eth_chainId')return m.chain;
        if(method==='eth_accounts'){if(!m.announcedAccounts){m.announcedAccounts=true;emit(id,'accountsChanged',[...m.accounts]);emit(id,'chainChanged',m.chain);}return [...m.accounts];}
        if(method==='eth_requestAccounts'){
          if(m.reject){m.reject=false;throw Object.assign(new Error('MOCK rejected'),{code:4001});}
          m.accounts=[approved];emit(id,'chainChanged',m.chain);emit(id,'accountsChanged',[...m.accounts]);return [...m.accounts];
        }
        throw new Error('Signing and transactions forbidden in this browser test');
      },on:(event,handler)=>{if(!m.listeners.has(event))m.listeners.set(event,new Set());m.listeners.get(event).add(handler);},
      removeListener:(event,handler)=>m.listeners.get(event)?.delete(handler),isConnected:()=>m.connected};
      models[id]=m;return m;
    }
    model('mock-primary');model('mock-secondary');
    const announce=id=>dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:id,rdns:'io.metamask'},provider:models[id].provider}}));
    addEventListener('eip6963:requestProvider',()=>{announce('mock-primary');announce('mock-secondary');});
    window.__reviewMock={calls,approved,announce,
      accounts:(accounts,id='mock-primary')=>{models[id].accounts=accounts;emit(id,'accountsChanged',[...accounts]);},
      chain:(chain,id='mock-primary')=>{models[id].chain=chain;emit(id,'chainChanged',chain);},
      reject:()=>models['mock-primary'].reject=true,
      fail:value=>models['mock-primary'].fail=value,
      disconnect:()=>{models['mock-primary'].connected=false;emit('mock-primary','disconnect',{});},
      reconnect:()=>{models['mock-primary'].connected=true;emit('mock-primary','connect',{chainId:'0xa4ec'});}};
  });
  const waitWallet=text=>page.waitForFunction(text=>document.querySelector('#wallet').textContent.includes(text),text);
  const fits=async()=>{for(const width of [320,360,390,412,768]){await page.setViewportSize({width,height:850});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));check(await page.evaluate(()=>document.documentElement.scrollWidth===innerWidth),'Review help overflows '+width+'px');}};
  const tick=async()=>{await page.locator('#reviewed').check();};
  const verify=async()=>{await tick();await page.locator('#connect').click();await waitWallet('Stage 1 verified');check(await page.locator('#prepare-final').isEnabled(),'Stage 2 preparation not enabled after Stage 1');};
  try{
    await page.goto(origin);await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    check((await page.evaluate(()=>window.__reviewMock.calls.length))===0,'Automatic wallet access on reload');
    await page.locator('#provider').selectOption('mock-primary');await waitWallet('account available');
    await page.locator('#reviewed').focus();await page.keyboard.press('Space');
    check(await page.locator('#reviewed').isChecked(),'Keyboard checkbox failed');
    check(await page.locator('#connect').isDisabled()&&await page.locator('#prepare-final').isDisabled(),'Stale checks must stay blocked');
    check((await page.locator('#stage1-help').innerText()).includes('Refresh required'),'Stale check cause was hidden');
    check(!(await page.locator('#wallet').innerText()).includes('Account or network changed'),'Provider selection was mislabeled');
    await page.locator('#refresh').focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);await waitWallet('account available');
    check(!await page.locator('#reviewed').isChecked(),'Refresh retained consent');
    check(await page.locator('#prepare-final').isDisabled(),'Stage 2 enabled before Stage 1');
    await page.locator('#reviewed').focus();await page.keyboard.press('Space');await page.keyboard.press('Tab');
    check(await page.locator('#connect').evaluate(e=>e===document.activeElement),'Keyboard cannot reach account check');
    check((await page.locator('#connect').getAttribute('aria-describedby')).includes('stage1-help'),'Disabled reason not associated with button');
    await page.keyboard.press('Enter');await waitWallet('Stage 1 verified');
    check(await page.locator('#prepare-final').isEnabled(),'Stage 1 stayed disabled');
    check(!(await page.evaluate(()=>window.__reviewMock.calls)).some(x=>x.method==='eth_requestAccounts'),'Already shared account requested permission again');
    await page.evaluate(()=>{window.__reviewMock.chain('0xa4ec');window.__reviewMock.accounts([window.__reviewMock.approved]);});
    check(await page.locator('#reviewed').isChecked(),'Repeated same-state events cleared consent');
    await page.locator('#prepare-final').focus();await page.keyboard.press('Enter');await page.locator('#final-stage').waitFor({state:'visible'});
    check(await page.locator('#submit').isDisabled(),'Transaction lock changed');
    await fits();
    await page.evaluate(()=>window.__reviewMock.accounts(['0x'+'2'.repeat(40)]));await waitWallet('Wrong account');
    check(!await page.locator('#reviewed').isChecked()&&!await page.locator('#final-stage').isVisible(),'Wrong account retained approval');
    check(await page.locator('#connect').isDisabled(),'Wrong account enabled');
    await fits();
    await page.evaluate(()=>window.__reviewMock.accounts([window.__reviewMock.approved]));await waitWallet('account available');await verify();
    await page.evaluate(()=>window.__reviewMock.chain('0x1'));await waitWallet('Wrong chain');check(await page.locator('#connect').isDisabled(),'Wrong chain enabled');
    await page.evaluate(()=>window.__reviewMock.chain('0xa4ec'));await waitWallet('account available');await verify();
    await page.evaluate(()=>window.__reviewMock.accounts([]));await waitWallet('No account is shared');await page.evaluate(()=>window.__reviewMock.reject());
    await tick();await page.locator('#connect').click();await waitWallet('Account access rejected');
    check(!await page.locator('#reviewed').isChecked()&&await page.locator('#prepare-final').isDisabled(),'Rejection retained verification');
    check((await page.evaluate(()=>window.__reviewMock.calls.filter(x=>x.method==='eth_requestAccounts').length))===1,'Rejected request retried');
    await verify();
    check((await page.evaluate(()=>window.__reviewMock.calls.filter(x=>x.method==='eth_requestAccounts').length))===2,'Manual permission retry/handshake failed');
    await page.evaluate(()=>window.__reviewMock.disconnect());await waitWallet('disconnected');check(await page.locator('#connect').isDisabled(),'Disconnected provider enabled');
    await page.evaluate(()=>window.__reviewMock.reconnect());await waitWallet('account available');await verify();
    await page.evaluate(()=>window.__reviewMock.fail(true));await page.locator('#recheck-wallet').click();await waitWallet('Provider unavailable');
    await page.evaluate(()=>window.__reviewMock.fail(false));await page.locator('#recheck-wallet').click();await waitWallet('account available');await verify();
    await page.locator('#provider').selectOption('mock-secondary');await waitWallet('account available');await verify();
    await page.evaluate(()=>{window.__reviewMock.chain('0x1','mock-primary');window.__reviewMock.announce('mock-secondary');});
    check(await page.locator('#reviewed').isChecked()&&await page.locator('#prepare-final').isEnabled(),'Old provider or repeated discovery invalidated new provider');
    refreshMode='failed';await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    check((await page.locator('#stage1-help').innerText()).includes('refresh failed'),'Refresh failure not actionable');
    check(await page.locator('#connect').isDisabled(),'Failed refresh enabled Stage 1');
    refreshMode='metadata';await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    check((await page.locator('#stage1-help').innerText()).includes('metadata'),'Metadata failure not distinguished');
    refreshMode='good';await page.locator('#refresh').click();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);await waitWallet('account available');await verify();
    const methods=await page.evaluate(()=>window.__reviewMock.calls.map(x=>x.method));check(methods.every(m=>['eth_chainId','eth_accounts','eth_requestAccounts'].includes(m)),'Signing/send call occurred');
    await page.reload();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    check(await page.locator('#provider').inputValue()===''&&!await page.locator('#reviewed').isChecked(),'Reload retained review');
    check((await page.evaluate(()=>window.__reviewMock.calls.length))===0,'Reload auto-connected wallet');
    return {browser:'real Chromium',provider:'explicit EIP-1193 mock; zero real wallet calls',
      staleStateReproduced:true,refreshRestoresEligibility:true,keyboardNavigation:true,accessibleDisabledReason:true,
      stage1:true,stage2:true,rejection:true,accountChanges:true,chainChanges:true,reconnect:true,reload:true,
      sameStateEventsPreserveReview:true,oldProviderDetached:true,refreshFailure:true,metadataFailure:true,
      mobileWidths:[320,360,390,412,768],signingCalls:0,sendCalls:0,allowedMethods:[...new Set(methods)]};
  }finally{await page.unroute(origin+'/refresh',refresh);await page.unroute(origin+'/preview',stale);}
}
