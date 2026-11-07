import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoiceSession} from '../public/voice-session.js';
function fixture({media=false}={}){
  const states=[],texts=[],timers=new Map();let number=0,starts=0,stops=0,fetches=0,rec,recognition,utterance,fetcher=async()=>({ok:true,json:async()=>({text:'Please check this message'})});
  const env={isSecureContext:true,performance:{now:()=>0},setTimeout(fn,ms){timers.set(++number,{fn,ms});return number;},clearTimeout(id){timers.delete(id);},setInterval(){return 100;},clearInterval(){},
    navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stops++;}}]})}},
    MediaRecorder:class{static isTypeSupported(){return true;}constructor(){rec=this;this.state='inactive';this.mimeType='audio/webm';}start(){starts++;this.state='recording';this.onstart();}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['a'.repeat(150)])});this.onstop();}},
    SpeechRecognition:class{constructor(){recognition=this;}start(){starts++;this.onaudiostart?.();}stop(){this.onend?.();}abort(){this.onend?.();}},
    speechSynthesis:{cancel(){},getVoices:()=>[{name:'English test voice',lang:'en-GB'}],speak(s){utterance=s;}},SpeechSynthesisUtterance:class{constructor(t){this.text=t;}},
    fetch(...args){fetches++;return fetcher(...args);}
  };
  const session=createVoiceSession({env,render:v=>states.push(v),transcript:async t=>texts.push(t),getLanguage:()=> 'pcm'});
  session.configure(media);
  return {env,session,states,texts,timers,get starts(){return starts;},get stops(){return stops;},get fetches(){return fetches;},get rec(){return rec;},get recognition(){return recognition;},get utterance(){return utterance;},fetcher(fn){fetcher=fn;}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('voice is inert on load and unsupported recognition fails honestly',async()=>{
  const f=fixture();assert.equal(f.starts,0);assert.equal(f.fetches,0);f.env.SpeechRecognition=undefined;await f.session.start();assert.equal(f.states.at(-1).state,'error');assert.match(f.states.at(-1).detail,/unavailable/);
});
test('native capture waits for actual audio event and a transcript still goes to review callback',async()=>{
  const f=fixture();await f.session.start();assert.equal(f.states.at(-1).state,'listening');f.recognition.onresult({results:[[{transcript:'Abeg no share your OTP'}]]});f.session.stop();await flush();assert.deepEqual(f.texts,['Abeg no share your OTP']);assert.equal(f.fetches,0);
});
test('denied browser permission restores a non-active error with actionable fallback',async()=>{
  const f=fixture();await f.session.start();f.recognition.onerror({error:'not-allowed'});f.recognition.onend();assert.equal(f.states.at(-1).active,false);assert.match(f.states.at(-1).detail,/address bar/);assert.equal(f.texts.length,0);
});
test('cancel ignores native late transcript and end events',async()=>{
  const f=fixture();await f.session.start();const rec=f.recognition;f.session.cancel();rec.onresult({results:[[{transcript:'late private message'}]]});rec.onend();await flush();assert.deepEqual(f.texts,[]);assert.equal(f.states.at(-1).state,'stopped');
});
test('no speech is an error, never an invented transcript',async()=>{
  const f=fixture();await f.session.start();f.recognition.onend();await flush();assert.equal(f.states.at(-1).state,'error');assert.equal(f.texts.length,0);
});
test('duplicate recording clicks make only one capture and no extra transcription',async()=>{
  const f=fixture({media:true});await f.session.start();await f.session.start();assert.equal(f.starts,1);f.session.stop();await flush();assert.equal(f.fetches,1);assert.equal(f.stops,1);assert.equal(f.texts.length,1);
});
test('cancel during permission closes a late stream without recording or uploading',async()=>{
  const f=fixture({media:true});let resolve;f.env.navigator.mediaDevices.getUserMedia=()=>new Promise(r=>{resolve=r;});const pending=f.session.start();f.session.cancel();resolve({getTracks:()=>[{stop(){f.env.closed=true;}}]});await pending;assert.equal(f.env.closed,true);assert.equal(f.starts,0);assert.equal(f.fetches,0);
});
test('cancel during transcription aborts upload and ignores late response',async()=>{
  const f=fixture({media:true});let resolve,signal;f.fetcher((url,options)=>{signal=options.signal;return new Promise(r=>{resolve=r;});});await f.session.start();f.session.stop();assert.equal(f.states.at(-1).state,'transcribing');f.session.cancel();assert.equal(signal.aborted,true);resolve({ok:true,json:async()=>({text:'late transcript'})});await flush();assert.deepEqual(f.texts,[]);assert.equal(f.states.at(-1).state,'stopped');
});
test('transcription provider failure is surfaced without retries or losing control',async()=>{
  const f=fixture({media:true});f.fetcher(async()=>({ok:false,json:async()=>({error:'Provider unavailable; type instead'})}));await f.session.start();f.session.stop();await flush();assert.equal(f.fetches,1);assert.equal(f.states.at(-1).state,'error');assert.match(f.states.at(-1).detail,/Provider unavailable/);
});
test('unsupported formats stop tracks before any upload',async()=>{
  const f=fixture({media:true});f.env.MediaRecorder.isTypeSupported=()=>false;await f.session.start();assert.equal(f.stops,1);assert.equal(f.fetches,0);assert.equal(f.states.at(-1).state,'error');
});
test('capture errors discard the recording even when recorder emits stop afterwards',async()=>{
  const f=fixture({media:true});await f.session.start();f.rec.onerror();f.rec.stop();await flush();assert.equal(f.fetches,0);assert.equal(f.states.at(-1).state,'error');
});
test('playback only reports Speaking on actual start; stop invalidates callbacks',()=>{
  const f=fixture();f.session.speak('The actual findings.','pcm');assert.equal(f.states.at(-1).state,'preparing');assert.match(f.states.at(-1).detail,/Pidgin/);const u=f.utterance;u.onstart();assert.equal(f.states.at(-1).state,'speaking');f.session.stop();u.onend();assert.equal(f.states.at(-1).state,'stopped');assert.match(f.states.at(-1).detail,/Playback stopped/);
});
test('no playback voice and playback failures are honest errors',()=>{
  const f=fixture();f.env.speechSynthesis.getVoices=()=>[];f.session.speak('Actual findings');assert.equal(f.states.at(-1).state,'error');assert.equal(f.utterance,undefined);f.env.speechSynthesis.getVoices=()=>[{name:'English',lang:'en'}];f.session.speak('Findings');f.utterance.onerror();assert.equal(f.states.at(-1).state,'error');
});
test('hard recording limit is installed even when Web Audio resume stalls',async()=>{
  const f=fixture({media:true});f.env.AudioContext=class{createMediaStreamSource(){return{connect(){}};}createAnalyser(){return{};}resume(){return new Promise(()=>{});}close(){return Promise.resolve();}};
  void f.session.start();await flush();assert.ok([...f.timers.values()].some(t=>t.ms===18000));f.session.cancel();
});

test('permission timeout invalidates a late capture instead of recording it',async()=>{
  const f=fixture({media:true});let resolve;f.env.navigator.mediaDevices.getUserMedia=()=>new Promise(r=>{resolve=r;});const pending=f.session.start();[...f.timers.values()].find(t=>t.ms===20000).fn();assert.equal(f.states.at(-1).state,'error');resolve({getTracks:()=>[{stop(){f.env.closed=true;}}]});await pending;assert.equal(f.env.closed,true);assert.equal(f.starts,0);
});
test('native recognition timeout stops and does not retry',async()=>{
  const f=fixture();await f.session.start();[...f.timers.values()].find(t=>t.ms===18000).fn();assert.equal(f.states.at(-1).state,'error');assert.equal(f.starts,1);assert.equal(f.texts.length,0);
});
test('media permission denial restores typing without a transcription request',async()=>{
  const f=fixture({media:true});f.env.navigator.mediaDevices.getUserMedia=async()=>{const e=Error();e.name='NotAllowedError';throw e;};await f.session.start();assert.equal(f.states.at(-1).state,'error');assert.equal(f.states.at(-1).active,false);assert.match(f.states.at(-1).detail,/permission denied/);assert.equal(f.fetches,0);
});
test('upload timeout aborts once and never retries',async()=>{
  const f=fixture({media:true});f.fetcher((url,options)=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('abort')))));await f.session.start();f.session.stop();[...f.timers.values()].find(t=>t.ms===25000).fn();await flush();assert.equal(f.states.at(-1).state,'error');assert.match(f.states.at(-1).detail,/timed out/);assert.equal(f.fetches,1);
});
test('delayed playback has a stop control and a bounded timeout',()=>{
  const f=fixture();f.session.speak('The findings');assert.equal(f.states.at(-1).state,'preparing');f.session.stop();assert.equal(f.states.at(-1).state,'stopped');f.session.speak('The findings');[...f.timers.values()].find(t=>t.ms===7000).fn();assert.equal(f.states.at(-1).state,'error');assert.match(f.states.at(-1).detail,/did not start/);
});
test('late old recorder stop and error cannot close a new recording',async()=>{
  const f=fixture({media:true});await f.session.start();const previous=f.rec;previous.stop=function(){this.state='inactive';};f.session.cancel();await f.session.start();const stops=f.stops;previous.onstop();previous.onerror();assert.equal(f.stops,stops);assert.equal(f.rec.state,'recording');assert.equal(f.states.at(-1).state,'listening');f.session.cancel();
});
test('browser provider errors distinguish audio capture from network failure',async()=>{
  for(const [code,phrase]of [['audio-capture','microphone and device'],['network','connection'],['service-not-allowed','provider blocked'],['no-speech','No speech recognised']]){const f=fixture();await f.session.start();f.recognition.onerror({error:code});assert.match(f.states.at(-1).detail,new RegExp(phrase));assert.equal(f.states.at(-1).active,false);}
});
test('diagnostics local-only playback never selects remote voices',()=>{
  const f=fixture();let spoken=0;f.env.speechSynthesis.getVoices=()=>[{name:'Remote English',lang:'en-NG',localService:false}];f.env.speechSynthesis.speak=()=>spoken++;
  const states=[];const session=createVoiceSession({env:f.env,render:v=>states.push(v),transcript:async()=>{},getLanguage:()=> 'en',localPlaybackOnly:true});session.speak('test');assert.equal(spoken,0);assert.equal(states.at(-1).state,'error');
  f.env.speechSynthesis.getVoices=()=>[{name:'Local English',lang:'en-GB',localService:true}];session.speak('test');assert.equal(spoken,1);
});
test('real recognition result transitions to Reviewing before deliberate submission',async()=>{
  const f=fixture();await f.session.start();f.recognition.onresult({results:[[{transcript:'A message to review'}]]});f.recognition.onend();await flush();assert.equal(f.states.at(-1).state,'reviewing');assert.equal(f.states.at(-1).active,false);assert.equal(f.fetches,0);
});
test('missing recognition backend is unavailable before the user tries to speak',()=>{
  const f=fixture();f.env.SpeechRecognition=undefined;f.session.configure(false);assert.equal(f.states.at(-1).state,'error');assert.match(f.states.at(-1).detail,/unavailable/);assert.equal(f.starts,0);assert.equal(f.states.at(-1).active,false);
});
