// Actual Chromium, exclusively injected fake wallets and explicit mock servers.
export async function verifyRegistrationExecution(page,origins){
  const check=(ok,message)=>{if(!ok)throw new Error(message);};const results=[];
    await page.addInitScript(({origins})=>{
      const mode=['hash-returned','rejected','ambiguous'][origins.indexOf(location.origin)];
      window.__executionMock={sends:0,methods:[],request:null,mode};
      const wallet='0x9Ceaa6aBFb2bC1aC202f96496Cdc683d86Bc458a';
      const provider={request:async({method,params})=>{
        window.__executionMock.methods.push(method);
        if(method==='eth_chainId')return '0xa4ec';if(method==='eth_accounts')return [wallet];
        if(method==='eth_sendTransaction'){
          window.__executionMock.sends++;window.__executionMock.request=params[0];
          if(mode==='rejected')throw Object.assign(new Error('MOCK rejected'),{code:4001});
          if(mode==='ambiguous')throw Object.assign(new Error('MOCK ambiguous result'),{code:-32603});
          return '0x'+'a'.repeat(64);
        }
        throw new Error('Unexpected wallet method');
      },on:()=>{},removeListener:()=>{}};
      addEventListener('eip6963:requestProvider',()=>dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'execution-mock',rdns:'io.metamask'},provider}})));
    },{origins});
  for(const [index,origin] of origins.entries()){
    const url=new URL(origin);check(url.protocol==='http:'&&url.hostname==='127.0.0.1','Local fixture required');
    const marker=await(await page.request.get(origin+'/__mock/status')).json();check(marker.mock&&marker.kind==='registration-execution'&&marker.realRPC===false,'Financial mock required');
    await page.goto(origin);await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    check((await page.evaluate(()=>window.__executionMock.sends))===0,'Automatic send on initialization');
    await page.locator('#provider').selectOption('execution-mock');await page.waitForFunction(()=>document.querySelector('#wallet').textContent.includes('account available'));
    await page.locator('#reviewed').check();await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelector('#wallet').textContent.includes('Stage 1 verified'));
    check((await page.evaluate(()=>window.__executionMock.sends))===0,'Automatic send on account review');
    await page.locator('#prepare-final').click();await page.locator('#final-stage').waitFor({state:'visible'});
    const expected=JSON.parse(await page.locator('#transaction').textContent());
    check(await page.locator('#submit').isDisabled(),'Final checkbox bypassed');
    await page.locator('#final-reviewed').check();check(await page.locator('#submit').isEnabled(),'Approved request not enabled after explicit reviews');
    await page.evaluate(()=>document.querySelector('#submit').click());
    check((await page.evaluate(()=>window.__executionMock.sends))===0,'Untrusted programmatic click sent a request');
    await page.locator('#submit').dblclick();await page.locator('#recovery').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    const state=await page.evaluate(()=>window.__executionMock);
    check(state.sends===1,'More than one request from duplicate clicks');check(JSON.stringify(state.request)===JSON.stringify(expected),'Sent request differs from reviewed fields');
    const attempt=await(await page.request.get(origin+'/attempt')).json();check(attempt.reserved,'Request was not durably reserved');check(state.mode===['hash-returned','rejected','ambiguous'][index],'Wrong mocked wallet outcome');check(index===0?attempt.hash==='0x'+'a'.repeat(64):attempt.hash===null,'Mock rejection/ambiguity outcome did not match its stored hash');
    const after=await(await page.request.get(origin+'/policy')).json();check(after.sendingEnabled===false,'Reserved authorization stayed active');
    await page.reload();await page.locator('#recovery').waitFor({state:'visible'});
    check(await page.locator('#connect').isDisabled()&&await page.locator('#prepare-final').isDisabled(),'Reload enabled another attempt');
    check((await page.evaluate(()=>window.__executionMock.sends))===0,'Reload submitted again');
    results.push({outcome:['mock-hash-returned','mock-rejection','mock-ambiguity'][index],mockRequests:1,realRequests:0,exactRequest:true,duplicateClickBlocked:true,reloadRecovery:true,automaticRequests:0});
  }
  return {browser:'real Chromium',provider:'explicit injected mock only; NO genuine registration',results};
}
