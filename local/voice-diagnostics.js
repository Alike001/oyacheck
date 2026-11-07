import {createVoiceSession} from '/voice-session.js';
import {rmsLevel} from '/voice-activity.js';
const $=s=>document.querySelector(s);
const supportedRecognition=Boolean(window.SpeechRecognition||window.webkitSpeechRecognition);
let captureEpoch=0,stream=null,context=null,meterTimer=null,limit=null,capturing=false,sessionActive=false,analysisBusy=false,findingText='';
let permissionStatus;
const fact=(name,value)=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=String(value);$('#facts').append(dt,dd);};
function controls(){
  $('#capture').disabled=capturing||sessionActive||analysisBusy||!navigator.mediaDevices?.getUserMedia;
  $('#capture-stop').disabled=!capturing;
  $('#recognize').disabled=capturing||sessionActive||analysisBusy||!supportedRecognition;
  $('#analyze').disabled=capturing||sessionActive||analysisBusy;
  $('#speak').disabled=capturing||sessionActive||analysisBusy;
  $('#language').disabled=capturing||sessionActive||analysisBusy;
}
function voices(){
  const list=window.speechSynthesis?.getVoices()||[];$('#voices').replaceChildren();
  const shown=[...list.filter(v=>v.lang.toLowerCase().startsWith('en')),...list.filter(v=>!v.lang.toLowerCase().startsWith('en'))].slice(0,40);
  for(const voice of shown){const li=document.createElement('li');li.textContent=`${voice.name} · ${voice.lang} · ${voice.localService?'local':'remote'}${voice.default?' · default':''}`;$('#voices').append(li);}
  $('#voice-note').textContent=list.length?`${list.length} browser voice variants; first ${shown.length} shown, English first. Only local English voices are eligible for this test.`:'No browser voices reported yet. Wait for voiceschanged, refresh, then check Linux Speech Dispatcher connectivity. No package absence is inferred.';
}
async function refresh(){
  $('#facts').replaceChildren();fact('Secure context',isSecureContext);fact('Microphone capture API',!!navigator.mediaDevices?.getUserMedia);fact('Browser recognition API',supportedRecognition);
  try{
    if(!permissionStatus){permissionStatus=await navigator.permissions.query({name:'microphone'});permissionStatus.addEventListener('change',refresh);}
    fact('Microphone permission',permissionStatus.state);
  }catch{fact('Microphone permission','Query unsupported; browser prompt decides access.');}
  try{
    const response=await fetch('/api/voice/diagnostics');if(!response.ok)throw Error();const d=await response.json();
    fact('Server credential configured',d.credentialsConfigured===true?'Yes — format/presence only; validity and billing untested':'No');
    fact('Application recognition backend',d.credentialsConfigured?'Groq Whisper (server configured, untested)':supportedRecognition?'Browser SpeechRecognition (exposed, unproven)':'Unavailable — use text input');
    fact('Diagnostic recognition backend','Browser SpeechRecognition only; no Groq calls');fact('Server transcription test',d.serverTranscriptionTest);
  }catch{fact('Server configuration','Unavailable; do not infer configured or unconfigured.');}
  const formats=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'].filter(t=>window.MediaRecorder?.isTypeSupported(t));
  fact('Supported recording formats',formats.join(', ')||'No supported MediaRecorder format reported');
  fact('Capture backend','Default input through getUserMedia; activity measured with Web Audio');
  $('#devices').replaceChildren();
  try{const devices=await navigator.mediaDevices.enumerateDevices();for(const [index,device]of devices.filter(d=>d.kind==='audioinput').entries()){const li=document.createElement('li');li.textContent=`Input ${index+1}: ${device.label||'label hidden until permission'} (identifier omitted)`;$('#devices').append(li);}if(!$('#devices').children.length)$('#devices').textContent='No accessible inputs reported; permission may hide devices.';}
  catch{$('#devices').textContent='Device enumeration unavailable. Check browser permission and secure context.';}
  voices();controls();
}
function stopCapture(detail='Capture stopped. Tracks released; no audio was uploaded or stored.'){
  captureEpoch++;clearTimeout(limit);clearInterval(meterTimer);limit=meterTimer=null;
  stream?.getTracks().forEach(t=>t.stop());stream=null;if(context){void context.close().catch(()=>{});context=null;}
  capturing=false;$('#level').value=0;$('#capture-status').textContent=detail;controls();
}
$('#capture').addEventListener('click',async()=>{
  if(capturing||sessionActive||analysisBusy)return;session.cancel();capturing=true;const id=++captureEpoch;controls();
  $('#capture-status').textContent='Waiting for microphone permission. No recognition or upload will run.';
  limit=setTimeout(()=>{if(id===captureEpoch)stopCapture('Permission timed out. A late microphone stream will be closed. Try again or type.');},20000);
  try{
    const captured=await navigator.mediaDevices.getUserMedia({audio:true});
    if(id!==captureEpoch){captured.getTracks().forEach(t=>t.stop());return;}
    stream=captured;clearTimeout(limit);limit=setTimeout(()=>stopCapture(),10000);
    $('#capture-status').textContent=`Capture active: ${captured.getAudioTracks()[0]?.label||'default microphone'}. Speak; the bar shows measured activity, not recognition confidence.`;
    void refresh();const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context){$('#capture-status').textContent+=' Web Audio meter unavailable; capture alone does not prove speech was heard.';return;}
    context=new Context();const source=context.createMediaStreamSource(captured),analyser=context.createAnalyser();analyser.fftSize=2048;source.connect(analyser);await context.resume();if(id!==captureEpoch)return;
    const values=new Float32Array(analyser.fftSize);meterTimer=setInterval(()=>{if(id!==captureEpoch)return;try{analyser.getFloatTimeDomainData(values);$('#level').value=Math.min(1,rmsLevel(values)*4.5);}catch{stopCapture('Audio activity measurement failed. Tracks released; recognition was not tested.');}},90);
  }catch(error){if(id!==captureEpoch)return;stopCapture(error.name==='NotAllowedError'?'Capture permission denied. Check the address-bar microphone permission; typing still works.':error.name==='NotFoundError'?'No microphone device available. Check Ubuntu Sound input settings.':`Capture failed (${error.name||'unknown error'}). Check device access; this is not a transcription-provider failure.`);}
});
$('#capture-stop').addEventListener('click',()=>stopCapture());
const session=createVoiceSession({localPlaybackOnly:true,getLanguage:()=>$('#language').value,
  render({state,detail,active}){
    sessionActive=active||['preparing','speaking'].includes(state);$('#session-status').textContent=`${state}: ${detail}`;
    $('#stop').disabled=!sessionActive;$('#cancel').disabled=!sessionActive;$('#playback-stop').disabled=!['preparing','speaking'].includes(state);
    if(['preparing','speaking'].includes(state)||detail.match(/playback|voice|speaking/i))$('#playback-status').textContent=`${detail} Audibility is unconfirmed until you hear it.`;
    controls();
  },transcript:async text=>{
    // Never submit or overwrite an existing draft. No storage, URL or log writes.
    const previous=$('#transcript').value,combined=previous?previous+'\n'+text:text;
    if(combined.length>2000){$('#session-status').textContent='Transcript exceeds the input limit. Draft retained; try a shorter phrase.';return;}
    $('#transcript').value=combined;findingText='';$('#analysis').textContent='Transcript awaits your review; not analyzed.';$('#transcript').focus();
  }
});
session.configure(false);
$('#recognize').addEventListener('click',()=>{if(!capturing&&!sessionActive&&!analysisBusy)void session.start();});
$('#stop').addEventListener('click',()=>session.stop());$('#playback-stop').addEventListener('click',()=>session.stop());$('#cancel').addEventListener('click',()=>session.cancel());
$('#speak').addEventListener('click',()=>{if(!capturing&&!sessionActive&&!analysisBusy)session.speak(findingText||'This is OyaCheck. Check a link before you trust it.',$('#language').value);});
$('#analyze').addEventListener('click',async()=>{
  if(capturing||sessionActive||analysisBusy||!$('#transcript').value.trim())return;
  analysisBusy=true;controls();const reviewed=$('#transcript').value;$('#analysis').textContent='Analyzing reviewed text only…';
  try{const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:reviewed,mode:'message',language:$('#language').value,explain:false}),signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error();const d=await response.json();findingText=d.explanation?.text||'';$('#analysis').textContent=[d.label,d.host?`Actual domain: ${d.host}`:'No domain examined',...(d.reasons||[]).map(r=>r.text),d.scope].join('\n');}
  catch{$('#analysis').textContent='Analysis unavailable. Your editable transcript is preserved. No AI or transcription provider was called.';}
  finally{analysisBusy=false;controls();}
});
$('#transcript').addEventListener('input',()=>{findingText='';$('#analysis').textContent='';});
$('#refresh').addEventListener('click',refresh);window.speechSynthesis?.addEventListener('voiceschanged',voices);navigator.mediaDevices?.addEventListener('devicechange',refresh);
window.addEventListener('pagehide',()=>{stopCapture();session.cancel();$('#transcript').value='';findingText='';});
void refresh();
