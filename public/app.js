import {voiceDecision} from './voice-policy.js';
import {createVoiceActivityDetector, rmsLevel, VOICE_TIMING} from './voice-activity.js';
const $ = (selector) => document.querySelector(selector);
const form = $('#check-form');
const input = $('#message-input');
const chat = $('#chat-stream');
const sendButton = $('#send-button');
const suggestions = $('#suggestions');
const aiStatus = $('#ai-status');
const evidenceEmpty = $('#evidence-empty');
const evidenceResult = $('#evidence-result');
const evidenceIndicator = $('#evidence-indicator');
const findingIcon = $('#finding-icon');
const findingTitle = $('#finding-title');
const findingHost = $('#finding-host');
const findingReasons = $('#finding-reasons');
const sourceGroup = $('#source-group');
const findingSources = $('#finding-sources');
const officialGroup = $('#official-group');
const officialLink = $('#official-link');
const scopeText = $('#scope-text');
const copyReportButton = $('#copy-report');
const browserInvestigation = $('#browser-investigation');
const demoLab = $('#demo-lab');
const demoShortcut = $('#demo-shortcut');
const demoScenario = $('#demo-scenario');
const demoRun = $('#demo-run');
const demoProgress = $('#demo-progress');
const demoResult = $('#demo-result');
let demoActive = false;
const quoteSource = $('#quote-source');
const inspectSource = $('#inspect-source');
const browserProgress = $('#browser-progress');
const browserOutput = $('#browser-output');
const buyConfirmDialog = $('#buy-confirm-dialog');
const buyDialogAmount = $('#buy-dialog-amount');
const buyDialogNetwork = $('#buy-dialog-network');
const buyDialogClose = $('#buy-dialog-close');
const buyDialogCancel = $('#buy-dialog-cancel');
const buyDialogApprove = $('#buy-dialog-approve');
const micButton = $('#mic-button');
const voiceStatus = $('#voice-status');
const voiceMeter = $('#voice-meter');
const voiceLevel = $('#voice-level');
const readAloud = $('#read-aloud');
const autoVoice = $('#auto-voice');
const mainnetPanel=$('#mainnet-investigation');
const mainnetQuote=$('#mainnet-quote');
const mainnetRequest=$('#mainnet-request');
const mainnetCancel=$('#mainnet-cancel');
const mainnetRefresh=$('#mainnet-refresh');
let mainnetEnabled=false;
let mainnetPurchase=null;
let mainnetCSRF=null;
let browserSandboxEnabled = false;
let pendingQuote = null;
let quoteExpiresAt = 0;
let language = 'en';
let checkMode = 'url';
let lastScanMode = 'url';
let landingMode = 'url';
let report = null;
let lastScanInput = null;
let conversation = [];
let isBusy = false;
let recordState = null;
let useGroqSpeech = false;
let currentUtterance = null;
let voiceEpoch = 0;
let transcribing = false;

// An explicit URL is a scan request. A question with no link is conversation.
// The backend does the actual URL parsing and safety classification.
const HAS_LINK = /(?:https?:\/\/\S+|www\.[a-z0-9-]+\.[a-z]{2,}|(?:[a-z\d-]+\.)+[a-z]{2,}(?:\/\S*)?)/i;

async function jsonPost(path, body) {
  const response = await fetch(path, {
    method: 'POST', headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(body), signal:AbortSignal.timeout(20000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || (response.status === 429 ? 'Too many requests. Try again shortly.' : 'Could not complete this request.'));
    if (typeof payload.transaction === 'string' && /^0x[a-fA-F0-9]{64}$/.test(payload.transaction)) error.transaction = payload.transaction;
    throw error;
  }
  return payload;
}
function setBusy(busy) {
  isBusy = busy;
  sendButton.disabled = busy;
  if (micButton) micButton.disabled = busy;
  input.disabled = busy;
  sendButton.textContent = busy ? 'Checking…' : checkMode==='ask' ? 'Ask question ↗' : checkMode==='message' ? 'Check message ↗' : 'Check link ↗';
  for(const button of document.querySelectorAll('[data-check-mode], .lang-button'))button.disabled=busy;
  form.setAttribute('aria-busy',String(busy));
  $('#new-chat').disabled=busy;
  $('#question-submit').disabled=busy;$('#question-input').disabled=busy;$('#explain-result').disabled=busy;
}
function removeWelcome() {
  const welcome = chat.querySelector('.empty-welcome');
  if (welcome) welcome.remove();
}
function message(role, text, method = '', extra = null) {
  removeWelcome();
  const row = document.createElement('article');
  row.className = `chat-message ${role}${method === 'error' ? ' error' : ''}`;
  if (role === 'assistant') {
    const avatar = document.createElement('span');
    avatar.className = 'message-avatar'; avatar.textContent = '✳'; avatar.setAttribute('aria-hidden','true'); row.append(avatar);
  }
  const wrapper = document.createElement('div'); wrapper.className = 'message-body';
  const byline = document.createElement('span'); byline.className = 'message-meta';
  byline.textContent = role === 'user' ? 'YOU' :
    method === 'groq' ? 'LIVE AI · GROQ' :
    method === 'source-inspection' ? 'PAID SOURCE CHECK · CELO SEPOLIA' :
    method === 'demo' ? 'LOCAL CHROMIUM · SYNTHETIC DEMO' :
    method === 'local-guard' ? 'PRIVACY CHECK' :
    method === 'status' ? 'CHECKING' :
    method === 'error' ? 'REQUEST ERROR' : 'OFFLINE GUIDANCE · NOT AI';
  const body = document.createElement('p'); body.textContent = text;
  wrapper.append(byline,body);
  if (role === 'assistant' && method !== 'status' && method !== 'error') {
    const listen = document.createElement('button');
    listen.type='button';listen.className='listen-reply';
    listen.textContent='🔊 Listen'; listen.setAttribute('aria-label','Read this answer aloud');
    listen.addEventListener('click',()=>readAnswer(text));
    wrapper.append(listen);
    if(readAloud?.checked) queueMicrotask(()=>readAnswer(text));
  }
  if (typeof extra === 'function') {
    const area = document.createElement('div');area.className = 'message-action'; extra(area);wrapper.append(area);
  }
  row.append(wrapper);chat.append(row);chat.scrollTop = chat.scrollHeight;
  return row;
}
function quickActions(area) {
  const questions = language === 'pcm' ? ['Wetin I go do next?', 'Which checks una never do?'] : ['What should I do next?', 'What checks were not performed?'];
  for (const q of questions) {
    const btn = document.createElement('button');btn.type='button';btn.textContent=q;
    btn.addEventListener('click',()=>askQuestion(q));
    area.append(btn);
  }
}
// Friendly summaries never replace the complete deterministic evidence below.
function displayReason(reason,lang){
  const en={userinfo:'The name before “@” is not the destination. Check the domain shown above.',unicode:'This address uses an internationalized domain name. Look carefully for letters that imitate another name.',embedded:'A familiar-looking domain is part of a longer address. That does not establish who owns the destination.',confusable:'Letters and numbers make this address resemble a familiar service.',http:'This link uses HTTP instead of HTTPS.',port:'This address uses an unusual port.',redirect:'The link includes a possible redirect. We have not followed it.',shortener:'This is a shortened link. Its final destination is unknown to this check.',credential:'The message mentions private information, such as passwords or OTPs. Treat unexpected requests with caution.',urgency:'The wording puts pressure on you to act quickly.',bad:'This exact domain is listed in the NCC phishing advisory below.',lookalike:'This resembles the NCC device service, but is not one of its documented official hostnames.','reported-parent':'This is below a domain named in the NCC advisory. The exact subdomain is not listed.'};
  const pcm={userinfo:'The name before “@” no be the destination. Check the domain we show above.',unicode:'This address use internationalized domain name. Check letters wey resemble another name well.',embedded:'Familiar domain name dey inside longer address. That one no prove who own the destination.',confusable:'Letters and numbers make this address resemble familiar service.',http:'This link use HTTP, no be HTTPS.',port:'This address use unusual port.',redirect:'This link get possible redirect. We never follow am.',shortener:'Na shortened link. We never know where e go land.',credential:'The message mention private details like password or OTP. Take care with unexpected requests.',urgency:'The wording dey put pressure on you to act quick.',bad:'This exact domain dey inside the NCC phishing advisory below.',lookalike:'This resemble NCC device service, but no be one of the official domains wey dem document.','reported-parent':'This dey under domain wey NCC name for advisory. This exact subdomain no dey listed.'};
  return (lang==='pcm'?pcm:en)[reason.code]||reason.text;
}
function updateEvidence(data) {
  if (buyConfirmDialog.open) buyConfirmDialog.close('cancel');
  demoActive=false;
  report = data;
  mainnetQuote.disabled=!(mainnetEnabled && (data.evidence||[]).some(e=>e.url.startsWith('https://csirt.ncc.gov.ng/')));
  pendingQuote = null;
  quoteExpiresAt = 0;
  browserOutput.hidden = true;
  browserOutput.replaceChildren();
  inspectSource.hidden = true;
  browserInvestigation.hidden = !browserSandboxEnabled || !(data.evidence||[]).some(e => typeof e.url === 'string' && e.url.startsWith('https://csirt.ncc.gov.ng/'));
  quoteSource.disabled = !browserSandboxEnabled;
  browserProgress.textContent = browserSandboxEnabled ? 'Optional sandbox-only inspection. No money spent until you confirm.' : 'Paid advisory refresh is unavailable in the public beta. General paid website inspection is unsupported.';
  evidenceEmpty.hidden = true;
  evidenceResult.hidden = false;
  evidenceResult.dataset.status = data.status;
  evidenceIndicator.textContent = data.status === 'known-phishing' ? 'PUBLISHED MATCH' : data.status === 'official-host-match' ? 'HOSTNAME MATCH' : data.status === 'suspicious' ? 'CAUTION' : data.status === 'invalid' ? 'INVALID' : 'UNVERIFIED';
  findingTitle.textContent = data.label || 'No finding';
  findingIcon.textContent = data.status === 'official-host-match' ? 'i' : data.status === 'known-phishing' || data.status === 'suspicious' ? '!' : '?';
  $('#finding-host-label').textContent=data.host?'Domain examined':'Message check';
  findingHost.textContent = data.host || (data.analysisKind==='message' ? 'Message only · no hostname' : 'No valid public hostname');
  $('#finding-time').textContent=data.checkedAt ? new Date(data.checkedAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) : 'Not recorded';
  $('#finding-time').dateTime=data.checkedAt || '';
  $('#coverage-note').textContent=data.analysisKind==='message'&&!data.host ? 'Message patterns only. Sender, claims and attachments remain unverified.' : data.evidence.length ? 'Source match from the manually curated NCC advisory list. This does not verify the live page.' : 'No published threat match in our small NCC list. URL/message patterns are not a comprehensive threat or reputation check.';
  findingReasons.replaceChildren();
  const primary=(data.reasons||[]).filter(r=>!['unknown','message-only','official'].includes(r.code));
  for(const r of primary){const li=document.createElement('li');li.textContent=displayReason(r,data.language);li.dataset.code=r.code;findingReasons.append(li);}
  $('.result-reasons').hidden=primary.length===0;
  $('#technical-reasons').replaceChildren();
  for(const r of data.reasons||[]){const li=document.createElement('li');li.textContent=r.text;li.dataset.code=r.code;$('#technical-reasons').append(li);}
  const pcm=data.language==='pcm';
  $('#result-summary').textContent= data.status==='unverified' ? (data.host ? (pcm?'We no see configured warning signs, but e no mean say this link safe.':'No configured warning signs were found. This does not establish that the link is safe.') : (pcm?'We no see obvious warning signs. We never verify sender or story.':'No obvious wording warning signs were found. The sender and claims remain unverified.')) : data.status==='invalid' ? (pcm?'We no fit complete this check. Review the address and try again.':'We could not complete this check. Review the address and try again.') : (data.host ? (pcm?'Na address and text patterns we check, no be the live website.':'These findings concern the address and text, not the live website.') : (pcm?'Na wording patterns only. We never verify sender or story.':'These are wording patterns only. The sender and story have not been verified.'));
  $('#next-step-text').textContent=data.status==='known-phishing' ? (pcm?'No enter private details or pay through this link. Contact the organisation through channel wey you already know.':'Do not enter private details or pay through this link. Contact the organisation through a channel you already know.') : data.status==='invalid' ? (pcm?'Paste one public HTTP(S) address, or choose Forwarded message to check text.':'Paste one public HTTP(S) address, or choose Forwarded message to examine text.') : (pcm?'If dem ask for login, payment or private details, pause. Confirm directly through channel wey you already trust.':'If you are being asked to log in, pay or share private details, pause. Confirm the request through a channel you already trust.');
  $('#result-explanation').textContent=data.explanation?.text || '';
  $('#result-method').textContent=data.explanation?.method==='groq'?'Optional AI explanation':'Prepared guidance · not AI';
  $('#result-audio-status').textContent='';
  for(const id of ['finding-title','finding-reasons','technical-reasons','result-explanation','result-summary','next-step-text'])document.getElementById(id).lang=data.language==='pcm'?'pcm':'en';
  $('#input-summary').textContent=data.host || (data.analysisKind==='message'?'Forwarded message':'Address needs review');
  $('#input-panel').open=false;$('#back-to-result').hidden=false;$('#question-label').textContent='Questions about this result?';
  findingSources.replaceChildren();
  for (const source of data.evidence || []) {
    if (!source?.url?.startsWith('https://csirt.ncc.gov.ng/')) continue;
    const entry=document.createElement('div');entry.className='source-entry';
    const a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=source.title || 'Published source';
    const date=document.createElement('time');date.textContent=source.published || '';
    entry.append(a,date);findingSources.append(entry);
  }
  sourceGroup.hidden = findingSources.children.length === 0;
  officialGroup.hidden = true;
  if (data.officialAlternative === 'https://www.ncc.gov.ng/devicechecker') {
    officialGroup.hidden=false;officialLink.href=data.officialAlternative;officialLink.textContent=data.officialAlternative;
  }
  scopeText.textContent = data.scope || 'No live browser or redirect checks have been performed.';
}
function trackConversation(role,text) {
  if (text.length > 450) return;
  conversation.push({role,text});
  conversation = conversation.slice(-4);
}
async function send(raw, force = 'auto') {
  if(force==='ask')return askQuestion(raw);
  const text=String(raw||'').trim();
  if (!text || isBusy) return;
  if (recordState) {voiceMessage('Stop your recording before sending.');return;}
  if(force==='scan')selectCheckMode(/\s/.test(text)?'message':'url');
  const scan = force!=='question';
  const requestedMode=checkMode;
  const questionLanguage=$('#question-language').value==='pcm'?'pcm':'en';
  if (!scan && text.length > 450) {
    message('assistant',language === 'pcm' ? 'Abeg make your question short, no pass 450 characters.' : 'Please make your question shorter than 450 characters.','local-guard'); return;
  }
  if (scan && text.length > 2000) {
    message('assistant','Please send one link or message under 2,000 characters.','local-guard');return;
  }
  stopSpeech();
  $('#request-error').hidden=true;$('#retry-check').hidden=true;
  if(scan)input.value=text;else $('#question-panel').open=true;
  setBusy(true);
  $('#question-error').hidden=true;$('#scan-progress').hidden=!scan;
  if(scan){
    $('#input-panel').open=true;chat.replaceChildren();
    report=null;lastScanInput=null;pendingQuote=null;quoteExpiresAt=0;inspectSource.hidden=true;browserInvestigation.hidden=true;mainnetQuote.disabled=true;
    evidenceResult.hidden=true;evidenceEmpty.hidden=false;evidenceIndicator.textContent='CHECKING';
    evidenceEmpty.querySelector('h3').textContent='Examining the available signs…';
    evidenceEmpty.querySelector('p').textContent='Checking the text and address only. No submitted website is being visited.';
  }
  if(!scan)message('user',text);
  const loading=scan ? document.createElement('span') : message('assistant',scan ? (language==='pcm'?'I dey compare the link with evidence we get…':'Comparing this link with available evidence…') : (language==='pcm'?'I dey think about your question…':'Thinking about your question…'),'status');
  loading.classList.add('is-thinking');
  try {
    if (scan) {
      const data=await jsonPost('/api/analyze',{input:text,language,mode:requestedMode,explain:$('#ai-explanation').checked});
      loading.remove();
      updateEvidence(data);
      lastScanInput=text;lastScanMode=requestedMode;
      conversation=[];
      const reply = data.explanation?.text || (language === 'pcm' ? 'We no get explanation for this check yet.' : 'An explanation is not available for this check.');
      if($('#ai-explanation').checked && data.explanation?.method!=='groq')$('#result-method').textContent='AI unavailable · prepared guidance';
      if(readAloud.checked)readAnswer(reply);
    } else {
      const response=demoActive ? await jsonPost('/api/demo/ask',{question:text,language:questionLanguage,history:conversation}) : report && lastScanInput ? await jsonPost('/api/chat',{question:text,input:lastScanInput,mode:lastScanMode,language:questionLanguage,history:conversation}) : await jsonPost('/api/ask',{question:text,language:questionLanguage,history:conversation});
      loading.remove();
      const answerRow=message('assistant',response.answer?.text || 'No answer available.',response.answer?.method || 'prepared-text');answerRow.lang=questionLanguage;
      if(response.answer?.method === 'prepared-text') voiceMessage('AI could not answer this turn; prepared guidance is shown. You can keep using the checker.');
      trackConversation('user',text);
      if(response.answer?.method==='groq' || response.answer?.method==='prepared-text') trackConversation('assistant',response.answer.text);
    }
  }catch(e){loading.remove();const errorText=e.name==='TimeoutError'?'The request timed out. Your input is still here; try again when you’re ready.':e.message;const errorBox=scan?$('#request-error'):$('#question-error');errorBox.textContent=errorText;errorBox.hidden=false;if(scan){$('#retry-check').hidden=false;evidenceIndicator.textContent='INCOMPLETE';evidenceEmpty.querySelector('h3').textContent='This check could not finish.';evidenceEmpty.querySelector('p').textContent='Your input is still in the form. Retry when you’re ready; no result was produced for this request.';}}
  finally{setBusy(false);$('#scan-progress').hidden=true;if(scan && report && lastScanInput===text && $('#request-error').hidden){findingTitle.focus({preventScroll:true});evidenceResult.scrollIntoView({block:'start',behavior:'instant'});}else if(scan)input.focus();}
}
function selectCheckMode(mode) {
  checkMode=['url','message'].includes(mode)?mode:'url';
  const copy={url:['Paste the link','Paste a website address here…','One public HTTP(S) address. We won’t open it.'],message:['Forwarded message','Paste the message you received…','Messages with or without a link. Remove private details. Multiple links must be checked separately.'],ask:['Safety question','Ask about the findings or online safety…','Optional conversation. Questions may be sent to Groq when configured; never include secrets.']}[checkMode];
  $('#input-label').textContent=copy[0];input.placeholder=copy[1];$('#input-guidance').textContent=copy[2];
  for(const b of document.querySelectorAll('[data-check-mode]'))b.setAttribute('aria-pressed',String(b.dataset.checkMode===checkMode));
  setBusy(isBusy);
}
function showView(focus=false) {
  const app=location.pathname==='/app'||location.hash==='#assistant';
  $('#home-view').hidden=app;$('#app-view').hidden=!app;
  if(!app){stopSpeech();voiceEpoch++;if(recordState){discardRecording=true;try{if(recorder?.state==='recording')recorder.stop();}catch{}cleanupAudio();}}
  for(const a of document.querySelectorAll('.nav-app')){if(app)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  document.title=app?'OyaCheck — Link and message checker':'OyaCheck — Check a link before you trust it';
  if(focus){if(app){$('#input-panel').open=true;input.focus({preventScroll:true});input.scrollIntoView({block:'center',behavior:'instant'});}else if(location.hash){const target=document.getElementById(location.hash.slice(1));if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});target.scrollIntoView();}}else {scrollTo(0,0);$('#intro-title').setAttribute('tabindex','-1');$('#intro-title').focus({preventScroll:true});}}
}
function navigate(path) {if(path!==location.pathname+location.hash)history.pushState(null,'',path);showView(true);}
document.addEventListener('click',event=>{
  const a=event.target.closest('a[href]');if(!a||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||a.target)return;
  const url=new URL(a.href);if(url.origin!==location.origin||!['/','/app'].includes(url.pathname))return;
  event.preventDefault();navigate(url.pathname+url.hash);
});
addEventListener('popstate',()=>showView(true));
for(const button of document.querySelectorAll('[data-check-mode]'))button.addEventListener('click',()=>{selectCheckMode(button.dataset.checkMode);input.focus();});
for(const button of document.querySelectorAll('[data-landing-mode]'))button.addEventListener('click',()=>{
  landingMode=button.dataset.landingMode;
  for(const b of document.querySelectorAll('[data-landing-mode]'))b.setAttribute('aria-pressed',String(b.dataset.landingMode===landingMode));
  $('#landing-label').textContent=landingMode==='url'?'Website address':'Forwarded message';
  $('#landing-input').placeholder=landingMode==='url'?'Paste a website address here…':'Paste the message you received…';
  $('#landing-guidance').textContent=landingMode==='url'?'Paste one public URL or domain. We won’t open it.':'Messages with or without a link. Remove private details.';
  document.querySelector('.landing-submit').textContent=landingMode==='url'?'Check this link →':'Check this message →';
});
$('#landing-form').addEventListener('submit',event=>{event.preventDefault();if(isBusy)return;const value=$('#landing-input').value;selectCheckMode(landingMode);input.value=value;navigate('/app');send(value);});
$('#retry-check').addEventListener('click',()=>send(input.value));
$('#new-check').addEventListener('click',()=>{$('#new-chat').click();$('#input-panel').open=true;input.focus();input.scrollIntoView({block:'center',behavior:'instant'});});
showView();
async function askQuestion(value){
  const text=String(value||'').trim();if(!text||isBusy)return;
  $('#question-panel').open=true;$('#question-input').value=text;
  await send(text,'question');
  if($('#question-error').hidden)$('#question-input').value='';
  $('#question-input').focus();
}
$('#question-form').addEventListener('submit',event=>{event.preventDefault();askQuestion($('#question-input').value);});
$('#listen-result').addEventListener('click',()=>readAnswer($('#result-explanation').textContent));
$('#back-to-result').addEventListener('click',()=>{$('#input-panel').open=false;findingTitle.focus();});
async function refreshExplanation(){
  if(!report||!lastScanInput||isBusy||recordState)return;
  const previous=report,draft=input.value,editing=$('#input-panel').open;
  setBusy(true);stopSpeech();$('#result-method').textContent='Updating explanation…';
  try{
    const data=await jsonPost('/api/analyze',{input:lastScanInput,mode:lastScanMode,language,explain:$('#ai-explanation').checked});
    updateEvidence(data);
    if($('#ai-explanation').checked&&data.explanation?.method!=='groq')$('#result-method').textContent='AI unavailable · prepared guidance';
    if(readAloud.checked)readAnswer(data.explanation?.text||'');
  }catch{
    language=previous.language==='pcm'?'pcm':'en';
    for(const b of document.querySelectorAll('.lang-button')){const selected=b.dataset.lang===language;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));}
    $('#result-method').textContent='Explanation update unavailable. Existing findings are unchanged.';
  }finally{input.value=draft;$('#input-panel').open=editing;$('#plain-language').open=true;setBusy(false);}
}
$('#explain-result').addEventListener('click',refreshExplanation);
$('#preview-example').addEventListener('click',async()=>{
  const button=$('#preview-example');button.disabled=true;$('#preview-status').textContent='Running the real URL check…';
  try{const data=await jsonPost('/api/analyze',{input:'https://example.org@unrelated.example/account',mode:'url',language:'en',explain:false});
    $('#preview-verdict').textContent=data.label;$('#preview-host').textContent=data.host||'No hostname';$('#preview-note').textContent=data.reasons.find(r=>r.code==='userinfo')?.text||data.scope;$('#preview-result').hidden=false;$('#preview-intro').hidden=true;$('#preview-status').textContent='Generated by the real checker. No submitted website was opened.';button.textContent='Run the example again →';
  }catch{$('#preview-status').textContent='The example check could not finish. Try again when you’re ready.';}finally{button.disabled=false;}
});
form.addEventListener('submit',event=>{event.preventDefault();send(input.value);});
input.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&(checkMode==='url'||event.ctrlKey||event.metaKey)){event.preventDefault();form.requestSubmit();}
});
suggestions.addEventListener('click',event=>{
  const chip=event.target.closest('button[data-example]');if(!chip)return;
  send(chip.dataset.example,chip.dataset.intent || 'auto');
});
for(const button of document.querySelectorAll('.lang-button')){
  button.addEventListener('click',()=>{
    language=button.dataset.lang === 'pcm'?'pcm':'en';
    // The page chrome stays English; result text carries its own language.
    for(const b of document.querySelectorAll('.lang-button')){const selected=b.dataset.lang===language;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));}
    selectCheckMode(checkMode);
    // Re-translate a completed deterministic check only on this explicit choice.
    if(report && lastScanInput && !isBusy && !recordState)refreshExplanation();
    stopSpeech();
  });
}
$('#new-chat').addEventListener('click',()=>{
  stopSpeech();
  voiceEpoch++;
  if(recordState){discardRecording=true;try{if(recorder?.state==='recording')recorder.stop();}catch{}cleanupAudio();}
  chat.replaceChildren();
  const welcome=document.createElement('div');welcome.className='empty-welcome';
  const icon=document.createElement('span');icon.className='welcome-orbit';icon.textContent='✳';icon.setAttribute('aria-hidden','true');
  const kicker=document.createElement('span');kicker.className='welcome-kicker';kicker.textContent='FRESH CONVERSATION';
  const title=document.createElement('h3');title.textContent='What do you want to check?';
  const desc=document.createElement('p');desc.textContent='Paste a link, share a forwarded message, or ask about online safety.';
  welcome.append(icon,kicker,title,desc);chat.append(welcome);
  if (buyConfirmDialog.open) buyConfirmDialog.close('cancel');
  selectCheckMode('url');$('#plain-language').open=false;
  $('#request-error').hidden=true;$('#retry-check').hidden=true;$('#input-panel').open=true;$('#back-to-result').hidden=true;$('#technical-details').open=false;$('#explanation-options').open=false;$('#question-panel').open=false;$('#ai-explanation').checked=false;$('#question-input').value='';$('#question-label').textContent='Have a safety question?';
  mainnetQuote.disabled=true;report=null;lastScanInput=null;demoActive=false;conversation=[];pendingQuote=null;quoteExpiresAt=0;browserInvestigation.hidden=true;input.value='';evidenceResult.hidden=true;evidenceEmpty.hidden=false;evidenceIndicator.textContent='NO CHECK YET';evidenceEmpty.querySelector('h3').textContent='Your next check starts here.';evidenceEmpty.querySelector('p').textContent='Paste a link or forwarded message. Findings and limits will appear here.';input.focus();
});
copyReportButton.addEventListener('click',async()=>{
  if(!report)return;
  const text=`OyaCheck — Evidence report\nFinding: ${report.label}\nDomain: ${report.host || 'none'}\n${(report.reasons||[]).map(x=>'- '+x.text).join('\n')}\nSources:\n${(report.evidence||[]).map(x=>x.url).join('\n')}\nScope: ${report.scope}`;
  try { await navigator.clipboard.writeText(text);copyReportButton.textContent='Copied ✓';}
  catch {copyReportButton.textContent='Could not copy';}
  setTimeout(()=>{copyReportButton.textContent='Copy evidence report ↗';},1600);
});

// Separate local-only investigation lab. Inspecting a synthetic page never spends
// funds or opens a user-supplied URL. Results are not real-world phishing verdicts.
demoShortcut.addEventListener('click',()=>{
  if(demoLab.hidden){message('assistant','The local browser lab is disabled. Start the local server with OYACHECK_DEMO_BROWSER=1 to use synthetic training pages.','local-guard');return;}
  demoLab.scrollIntoView({behavior:'smooth',block:'center'});
  demoScenario.focus();
});
demoRun.addEventListener('click',async()=>{
  if(demoRun.disabled || demoLab.hidden)return;
  demoRun.disabled=true;demoProgress.textContent='Launching isolated local Chromium and inspecting the synthetic page…';
  demoResult.hidden=true;demoResult.replaceChildren();
  try{
    const d=await jsonPost('/api/demo/inspect',{scenario:demoScenario.value});
    if(d.kind!=='controlled-browser-demo'||!Array.isArray(d.observations)||d.payment!==null||!d.scope.includes('synthetic'))throw new Error('Unexpected demonstration evidence');
    demoActive=true;mainnetQuote.disabled=true;report=null;lastScanInput=null;conversation=[];
    demoResult.hidden=false;
    const heading=document.createElement('strong');heading.textContent=d.finding;demoResult.append(heading);
    const title=document.createElement('p');title.textContent=`Rendered page: ${d.page.title}`;demoResult.append(title);
    const url=document.createElement('p');url.textContent=`Final sample URL: ${d.page.finalUrl}`;demoResult.append(url);
    for(const line of d.observations){const para=document.createElement('p');para.textContent='• '+line;demoResult.append(para);}
    const scope=document.createElement('p');scope.className='demo-scope';scope.textContent=d.scope;demoResult.append(scope);
    appendSandboxReceipt(d.transaction);
    if(d.screenshotId){const img=document.createElement('img');img.alt='Screenshot of the controlled synthetic training page rendered in local Chromium';img.loading='lazy';img.src='/api/demo/screenshot/'+d.screenshotId;demoResult.append(img);}
    demoProgress.textContent='Synthetic page inspected; no form submitted and no payment made.';
    message('assistant',`I inspected a controlled training page in local Chromium. ${d.observations.join(' ')} This is browser-observed test evidence, not a verdict about a public website. Ask me about these findings.`, 'demo');
  }catch(e){demoProgress.textContent=`Browser lab did not finish: ${e.message}`;message('assistant',demoProgress.textContent,'error');}
  finally{demoRun.disabled=false;}
});

// This code never opens the submitted URL. Only the fixed, verified NCC advisory
// can be opened on demand and ONLY with an explicitly confirmed sandbox purchase.
quoteSource.addEventListener('click',async()=>{
  if(!report || !browserSandboxEnabled || isBusy)return;
  pendingQuote=null;quoteExpiresAt=0;inspectSource.hidden=true;
  quoteSource.disabled=true;browserProgress.textContent='Requesting a free price quote…';
  try {
    const q=await jsonPost('/api/buy/quote',{});
    if(q.network!=='Celo Sepolia' || q.token!=='USDC' || q.sandboxOnly!==true || !Number.isFinite(Number(q.amount)) || Number(q.amount)<=0 || Number(q.amount)>0.01 || typeof q.quoteToken!=='string' || q.quoteToken.length===0) throw new Error('Unexpected quote. No payment was authorized.');
    pendingQuote=q;
    quoteExpiresAt=Date.now()+Math.min(90, Math.max(0, Number(q.expiresSeconds) || 0))*1000;
    browserProgress.textContent=`Celo Sepolia testnet: ${q.amount} test USDC for a 1-minute browser session. The official advisory only will be inspected.`;
    inspectSource.hidden=false;
    inspectSource.textContent=`Approve ${q.amount} test USDC ↗`;
  }catch(e){browserProgress.textContent=`Quote unavailable: ${e.message}`;}
  finally{quoteSource.disabled=false;}
});
function appendSandboxReceipt(transaction) {
  if (typeof transaction !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(transaction)) return;
  const link=document.createElement('a');
  link.href=`https://celo-sepolia.blockscout.com/tx/${transaction}`;
  link.target='_blank';link.rel='noopener noreferrer';
  link.textContent='View Celo Sepolia transaction (testnet)';
  browserOutput.append(link);browserOutput.hidden=false;
}
// A native <dialog> gives us in-app styling, focus management and Escape-to-cancel.
// No network call or payment happens when the approval dialog opens.
function closeBuyDialog() {
  if (buyConfirmDialog.open) buyConfirmDialog.close('cancel');
}
buyDialogClose.addEventListener('click', closeBuyDialog);
buyDialogCancel.addEventListener('click', closeBuyDialog);
inspectSource.addEventListener('click',()=>{
  const q=pendingQuote;
  if(!q || !report || !lastScanInput || isBusy)return;
  if(Date.now()>=quoteExpiresAt){
    pendingQuote=null;inspectSource.hidden=true;
    browserProgress.textContent='Quote expired. Request a new free quote; nothing was paid.';
    return;
  }
  buyDialogAmount.textContent=`${q.amount} test ${q.token}`;
  buyDialogNetwork.textContent=q.network;
  buyConfirmDialog.showModal();
  buyDialogCancel.focus();
});
buyDialogApprove.addEventListener('click',async()=>{
  const q=pendingQuote;
  if(!buyConfirmDialog.open || !q || !report || !lastScanInput || isBusy)return;
  if(Date.now()>=quoteExpiresAt){
    closeBuyDialog();pendingQuote=null;inspectSource.hidden=true;
    browserProgress.textContent='Quote expired. Request a new free quote; nothing was paid.';
    return;
  }
  closeBuyDialog();
  pendingQuote=null;quoteExpiresAt=0;inspectSource.hidden=true;quoteSource.disabled=true;setBusy(true);
  browserOutput.replaceChildren();browserOutput.hidden=true;
  browserProgress.textContent='Sandbox payment and remote official-source inspection in progress. This can take a minute…';
  try{
    const d=await jsonPost('/api/buy/inspect',{input:lastScanInput,quoteToken:q.quoteToken,confirmation:'approve-sandbox-test-usdc'});
    browserOutput.replaceChildren();browserOutput.hidden=false;
    const items=[`Official source opened: ${d.finalSourceUrl}`,`Page title: ${d.sourceTitle||'Not returned'}`,`Published source text mentions examined domain: ${d.foundInLivePage}`,`Quoted sandbox price / approved maximum: ${d.approvedMaxTestUSDC} test USDC; verify settled cost in receipts`,`Gateway transaction: ${d.transaction||'See sandbox receipts'}`,`Checked: ${d.checkedAt}`,d.scope];
    for(const line of items){const el=document.createElement('p');el.textContent=line;browserOutput.append(el);}
    appendSandboxReceipt(d.transaction);
    if(d.screenshotId){const img=document.createElement('img');img.alt='Screenshot of the official NCC advisory opened in the rented browser';img.loading='lazy';img.src=`/api/buy/screenshot/${d.screenshotId}`;browserOutput.append(img);}
    browserProgress.textContent='Official source inspection finished (sandbox only). The suspicious link was not opened.';
    scopeText.textContent='The trusted NCC advisory was opened in an isolated sandbox browser. The submitted suspicious link was not opened; its redirects, credential forms, TLS and reputation remain unchecked.';
    message('assistant',`I used a paid Celo Sepolia sandbox browser to inspect the official NCC advisory. ${d.foundInLivePage==='yes'?'The rendered source text includes the examined domain.':'I could not confirm an exact domain mention from the extracted page text.'} The submitted suspicious site was never opened. See the evidence desk for the transaction and source.`, 'source-inspection');
  }catch(e){appendSandboxReceipt(e.transaction);browserProgress.textContent=e.message+' Check sandbox receipts before another paid attempt.';message('assistant',browserProgress.textContent,'error');}
  finally{quoteSource.disabled=false;setBusy(false);}
});

fetch('/api/health').then(r=>r.json()).then(health=>{
  browserSandboxEnabled = health.sourceInspectionSandboxEnabled === true;
  mainnetEnabled=health.mainnetPreparation===true;
  mainnetPanel.hidden=!mainnetEnabled;
  if(mainnetEnabled) restoreMainnet();
  demoLab.hidden=health.localBrowserDemo!==true;
  demoShortcut.hidden=health.localBrowserDemo!==true;
  if(health.localBrowserDemo && !health.localBrowserAvailable){demoProgress.textContent='Chromium is not installed. Set CHROMIUM_PATH or install chromium.';demoRun.disabled=true;}
  quoteSource.disabled = !browserSandboxEnabled;
  const configured=health.aiConfigured===true;
  aiStatus.classList.toggle('online',configured);
  aiStatus.replaceChildren();
  const dot=document.createElement('span');aiStatus.append(dot,configured?'Groq configured':'AI not connected');
}).catch(()=>{aiStatus.textContent='AI status unavailable';});


// Voice is opt-in; microphone amplitude is analysed locally to find pauses.
// Transcribed URLs/private information still require human review before sending.
function voiceMessage(value) { voiceStatus.textContent=value;if(report)$('#result-audio-status').textContent=value; }
function stopSpeech() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  currentUtterance=null;
}
function readAnswer(value) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    voiceMessage('Your browser does not support spoken replies. You can still read the answer.');return;
  }
  if(currentUtterance && window.speechSynthesis.speaking) {stopSpeech();return;}
  const text=String(value||'').replace(/\*\*/g,'').replace(/https?:\/\/\S+/g,'the official link shown in the evidence panel');
  const utterance=new SpeechSynthesisUtterance(text.slice(0,950));
  utterance.lang='en-NG';utterance.rate=.92;
  const voices=window.speechSynthesis.getVoices();
  utterance.voice=voices.find(v=>v.lang.toLowerCase()==='en-ng') || voices.find(v=>v.lang.toLowerCase().startsWith('en-')) || null;
  if(utterance.voice) utterance.lang=utterance.voice.lang;
  utterance.onstart=()=>{if(currentUtterance===utterance)voiceMessage('Speaking the answer…');};
  utterance.onend=()=>{if(currentUtterance===utterance){currentUtterance=null;voiceMessage('Finished speaking. Tap Speak for another question.');}};
  utterance.onerror=()=>{if(currentUtterance===utterance){currentUtterance=null;voiceMessage('Voice playback failed. Read the reply on screen.');}};
  currentUtterance=utterance;
  window.speechSynthesis.speak(utterance);
}
readAloud?.addEventListener('change',()=>{
  if(!readAloud.checked)stopSpeech();
  voiceMessage(readAloud.checked?'Spoken replies are on. Sound depends on your device voice.':'Spoken replies are off. Use 🔊 on a reply to hear it.');
});

let recorder, recordStream, recordChunks=[], recordTimer, discardRecording=false;
let voiceAudioContext=null, voiceSource=null, voiceAnalyser=null, voiceMonitor=null;
let voiceSpeechSeen=false;
function stopVoiceMonitor(){
  if(voiceMonitor){clearInterval(voiceMonitor);voiceMonitor=null;}
  if(voiceSource){try{voiceSource.disconnect();}catch{}voiceSource=null;}
  if(voiceAnalyser){try{voiceAnalyser.disconnect();}catch{}voiceAnalyser=null;}
  if(voiceAudioContext){void voiceAudioContext.close().catch(()=>{});voiceAudioContext=null;}
  if(voiceMeter)voiceMeter.hidden=true;
  if(voiceLevel)voiceLevel.style.width='0%';
  voiceSpeechSeen=false;
}
function autoStopAfterSilence(stream,epoch){
  const Context=window.AudioContext || window.webkitAudioContext;
  if(!Context){
    voiceMessage('Listening… Your browser has no silence detection. Tap Stop when finished (18-second limit).');
    return;
  }
  try{
    const context=new Context();voiceAudioContext=context;
    voiceSource=context.createMediaStreamSource(stream);
    voiceAnalyser=context.createAnalyser();
    voiceAnalyser.fftSize=2048;
    voiceSource.connect(voiceAnalyser); // NEVER connect the microphone to the speakers.
    const values=new Float32Array(voiceAnalyser.fftSize);
    const detector=createVoiceActivityDetector();
    if(voiceMeter)voiceMeter.hidden=false;
    void context.resume().catch(()=>{
      voiceMessage('Microphone active. Silence detection unavailable: tap Stop when done.');
      stopVoiceMonitor();
    });
    voiceMonitor=setInterval(()=>{
      if(epoch!==voiceEpoch || recorder?.state!=='recording' || recordState!=='recording')return;
      try{
        voiceAnalyser.getFloatTimeDomainData(values);
        const level=rmsLevel(values);
        const result=detector.sample(level,performance.now());
        if(voiceLevel)voiceLevel.style.width=`${Math.max(4,Math.min(100,Math.round(level*450)))}%`;
        if(result.speechDetected && !voiceSpeechSeen){
          voiceSpeechSeen=true;
          voiceMessage('I can hear you. Finish your thought; I’ll stop after a short pause.');
        }
        if(result.action==='no-speech'){
          discardRecording=true;
          voiceMessage('No speech detected. Tap Speak and try again.');
          recorder.stop();
        } else if(result.action==='stop' || result.action==='limit'){
          voiceMessage(result.action==='limit'?'Recording limit reached. Processing your words…':'You finished speaking. Processing your question…');
          recorder.stop();
        }
      }catch{
        stopVoiceMonitor();
        voiceMessage('Silence detection unavailable. Tap Stop to finish the recording.');
      }
    }, VOICE_TIMING.pollMs);
  }catch{
    stopVoiceMonitor();
    voiceMessage('Listening… Tap Stop to finish; silence detection is unavailable on this device.');
  }
}
function cleanupAudio() {
  stopVoiceMonitor();
  if(recordTimer){clearTimeout(recordTimer);recordTimer=null;}
  if(recordStream){recordStream.getTracks().forEach(t=>t.stop());recordStream=null;}
  if(micButton){micButton.classList.remove('recording');micButton.setAttribute('aria-pressed','false');micButton.setAttribute('aria-label','Start recording a voice question');micButton.innerHTML='🎙 <span>Speak</span>';}
  recordState=null;
  if(!isBusy && !transcribing)sendButton.disabled=false;
}
async function acceptTranscript(value,epoch) {
  if(epoch!==voiceEpoch)return;
  const hasDraft=Boolean(input.value.trim());
  const decision=voiceDecision(value,{autoSend:autoVoice?.checked!==false,hasDraft});
  if(decision.action==='discard'){voiceMessage(decision.reason);return;}
  if(decision.action==='review'){
    input.value=(hasDraft?input.value.trim()+' ':'')+value.trim();
    input.focus();voiceMessage(decision.reason);return;
  }
  voiceMessage('Heard your question. Getting an answer now…');
  // Voice questions never spend funds or trigger browser navigation.
  await send(value,decision.intent);
}
async function transmitRecording(blob,epoch) {
  if(epoch!==voiceEpoch)return;
  if(blob.size>2*1024*1024){voiceMessage('Clip too large. Record a shorter question.');return;}
  if(!blob.size){voiceMessage('No speech captured. Please try again.');return;}
  transcribing=true;
  voiceMessage('Transcribing your message…');micButton.disabled=true;sendButton.disabled=true;
  try {
    const response=await fetch(`/api/voice/transcribe?lang=${encodeURIComponent(language)}`,{method:'POST',headers:{'Content-Type':blob.type||'audio/webm'},body:blob});
    const d=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(d.error||'Transcription unavailable.');
    if(epoch!==voiceEpoch)return;
    await acceptTranscript(d.text,epoch);
  }catch(e){if(epoch===voiceEpoch)voiceMessage(e.message||'Could not transcribe. Please type your question.');}
  finally{transcribing=false;micButton.disabled=isBusy;if(!isBusy)sendButton.disabled=false;}
}
async function beginRecording() {
  if(transcribing){voiceMessage('Processing your previous recording.');return;}
  stopSpeech();
  if(!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder==='undefined' || !useGroqSpeech){
    beginBrowserRecognition();return;
  }
  try{
    discardRecording=false;
    const epoch=voiceEpoch;
    recordStream=await navigator.mediaDevices.getUserMedia({audio:true});
    if(epoch!==voiceEpoch){cleanupAudio();return;}
    const type=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
    recorder=new MediaRecorder(recordStream,type?{mimeType:type}:{});
    recordChunks=[];
    recorder.ondataavailable=e=>{if(e.data?.size)recordChunks.push(e.data);};
    recorder.onerror=()=>{voiceMessage('Microphone recording failed. Please try typing.');cleanupAudio();};
    recorder.onstop=()=>{
      const audio=new Blob(recordChunks,{type:recorder.mimeType||type||'audio/webm'});
      const canceled=discardRecording;cleanupAudio();discardRecording=false;
      if(!canceled && epoch===voiceEpoch)void transmitRecording(audio,epoch);
    };
    recorder.start();recordState='recording';sendButton.disabled=true;
    micButton.classList.add('recording');micButton.setAttribute('aria-pressed','true');
    micButton.setAttribute('aria-label','Stop recording');micButton.innerHTML='■ <span>Stop</span>';
    voiceMessage('Listening… Speak naturally; OyaCheck stops when you pause. You can also tap Stop.');
    // Safety fallback if the tab is suspended and the level monitor stops ticking.
    recordTimer=setTimeout(()=>{
      if(recorder?.state==='recording'){
        if(!voiceSpeechSeen){discardRecording=true;voiceMessage('No speech detected. Try again.');}
        else voiceMessage('Maximum recording time reached. Processing…');
        recorder.stop();
      }
    }, VOICE_TIMING.maxRecordingMs);
    autoStopAfterSilence(recordStream,epoch);
  }catch{cleanupAudio();voiceMessage('Microphone unavailable or permission denied. Please type your question.');}
}
function beginBrowserRecognition() {
  const Recognition=window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!Recognition){voiceMessage('Speech input is unavailable in this browser. Please type.');return;}
  stopSpeech();
  const epoch=voiceEpoch;
  const recognition=new Recognition();
  recognition.lang='en-NG';recognition.interimResults=false;recognition.maxAlternatives=1;recognition.continuous=false;
  recordState='native';sendButton.disabled=true;
  micButton.classList.add('recording');micButton.setAttribute('aria-pressed','true');
  micButton.setAttribute('aria-label','Stop voice recognition');micButton.innerHTML='■ <span>Stop</span>';
  voiceMessage('Listening using browser speech recognition. Audio may be processed by your browser provider.');
  let spoken='',failed=false;
  recognition.onresult=e=>{spoken=e.results?.[0]?.[0]?.transcript?.trim()||'';};
  recognition.onerror=e=>{failed=true;voiceMessage(`Browser speech recognition unavailable (${e.error||'error'}). Type your question instead.`);};
  recognition.onend=()=>{
    cleanupAudio();
    if(!failed && spoken && epoch===voiceEpoch)void acceptTranscript(spoken,epoch);
  };
  recorder={stop:()=>recognition.stop(),state:'recording'};
  try{recognition.start();}catch{cleanupAudio();voiceMessage('Could not start speech recognition. Please type instead.');}
}
micButton?.addEventListener('click',()=>{
  if(recordState){
    if(recorder?.state==='recording')recorder.stop();
    else cleanupAudio();
    return;
  }
  if(isBusy || transcribing)return;
  void beginRecording();
});
window.addEventListener('pagehide',()=>{
  stopSpeech();voiceEpoch++;discardRecording=true;
  try{if(recorder?.state==='recording')recorder.stop();}catch{}
  cleanupAudio();
});
fetch('/api/health').then(r=>r.json()).then(d=>{
  useGroqSpeech=d.voiceTranscription===true;
  voiceMessage(useGroqSpeech?'Tap Speak once and talk. Silence detection stops recording after about 1.5 seconds; questions auto-send and replies speak aloud. URLs require review.':'Browser speech recognition is available if supported; voice questions auto-send after your browser detects the end of speech.');
}).catch(()=>voiceMessage('Voice availability could not be checked; typing still works.'));


// Preparation only. There is deliberately no browser endpoint that executes a
// mainnet payment or grants operator spending approval.
async function mainnetAPI(path, body) {
  if(!mainnetCSRF) {
    const response=await fetch('/api/mainnet/session');
    if(!response.ok)throw new Error('Local mainnet preparation is unavailable.');
    mainnetCSRF=(await response.json()).csrf;
  }
  const response=await fetch(path,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json','x-oyacheck-csrf':mainnetCSRF},body:JSON.stringify(body)});
  const value=await response.json();
  if(!response.ok)throw new Error(value.error||'Preparation failed. No automatic payment retry.');
  return value;
}
function renderMainnet(value) {
  mainnetPurchase=value;
  localStorage.setItem('oya-mainnet-purchase',value.id);
  const plan=$('#mainnet-plan');plan.replaceChildren();
  for(const text of [`Service: ${value.plan.capability} · ${value.plan.durationMinutes} minute`,
    `Investigation: ${value.plan.host} · official NCC advisory only`,
    `Chain: ${value.plan.network} (${value.plan.chainId})`,
    `Quoted price and maximum: ${(value.plan.atomic/1e6).toFixed(6)} ${value.plan.token}`,
    `Payer: ${value.plan.payer}`,`Recipient: ${value.plan.payTo}`,
    `Quote expires: ${new Date(value.expires).toISOString()}`,`Plan fingerprint: ${value.fingerprint}`]) {
    const line=document.createElement('p');line.textContent=text;plan.append(line);
  }
  const editable=['quoted','requested'].includes(value.state)&&value.expires>Date.now();
  mainnetRequest.hidden=!editable||value.state==='requested';
  mainnetCancel.hidden=!editable;mainnetRefresh.hidden=false;
  const status={quoted:'Quote ready. Review the exact plan before requesting operator review.',
    requested:'Awaiting separate operator approval. This browser cannot spend funds.',
    cancelled:'Request cancelled before execution. Nothing was authorized by this request.',expired:'Quote expired. Request a fresh quote for new review.',
    executing:'Operator attempt in progress. Do not retry; refresh status or review receipts.',
    'needs-review':'Payment or service outcome is uncertain. Do not pay again. Operator receipt reconciliation is required.',
    'verification-required':'Source observations received. Mainnet settlement still requires independent receipt verification.',
    'settled-unfulfilled':'Payment verified, but source inspection did not complete. Do not repurchase automatically.',
    complete:'Source observations and payment verified. This does not prove the submitted website safe.'};
  $('#mainnet-status').textContent=status[value.state]||'Operator review required.';
  const result=$('#mainnet-result');result.replaceChildren();result.hidden=!value.result&&!value.transaction;
  if(value.result)for(const text of [value.result.scope,`Final source: ${value.result.finalSourceUrl}`,`Page title: ${value.result.sourceTitle||'Unavailable'}`,
    `Exact domain mention: ${value.result.foundInLivePage}`,`Observed excerpt: ${value.result.excerpt||'Unavailable'}`,
    `Source text SHA-256: ${value.result.sourceTextSha256||'Unavailable'}`,`Observed at: ${value.result.checkedAt}`]) {
    const p=document.createElement('p');p.textContent=text;result.append(p);
  }
  if(/^0x[a-fA-F0-9]{64}$/.test(value.transaction||'')) {
    const link=document.createElement('a');link.href=`https://celoscan.io/tx/${value.transaction}`;
    link.target='_blank';link.rel='noopener noreferrer';link.textContent='View recorded Celo mainnet transaction';result.append(link);
  }
}
async function restoreMainnet() {
  const id=localStorage.getItem('oya-mainnet-purchase');if(!id)return;
  try{renderMainnet(await mainnetAPI(`/api/mainnet/purchases/${id}`));}
  catch(error){$('#mainnet-status').textContent=error.message+' Existing attempts must not be automatically repeated.';}
}
mainnetQuote.addEventListener('click',async()=>{
  if(!mainnetEnabled||!report||!lastScanInput||isBusy)return;
  mainnetQuote.disabled=true;
  let requestId=sessionStorage.getItem('oya-mainnet-request');
  if(!requestId){requestId=crypto.randomUUID();sessionStorage.setItem('oya-mainnet-request',requestId);}
  try {renderMainnet(await mainnetAPI('/api/mainnet/quote',{input:lastScanInput,requestId}));sessionStorage.removeItem('oya-mainnet-request');}
  catch(error){$('#mainnet-status').textContent=error.message;}
  finally{mainnetQuote.disabled=false;}
});
for(const [button,action] of [[mainnetRequest,'request'],[mainnetCancel,'cancel']])button.addEventListener('click',async()=>{
  if(!mainnetPurchase)return;button.disabled=true;
  try{renderMainnet(await mainnetAPI(`/api/mainnet/purchases/${mainnetPurchase.id}/${action}`,{fingerprint:mainnetPurchase.fingerprint}));}
  catch(error){$('#mainnet-status').textContent=error.message;}
  finally{button.disabled=false;}
});
mainnetRefresh.addEventListener('click',restoreMainnet);
