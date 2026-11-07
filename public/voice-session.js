import {createVoiceActivityDetector, rmsLevel, VOICE_TIMING} from './voice-activity.js';

// One user-initiated turn at a time. No recording, retry, or submission on load.
export function createVoiceSession({env=window, render, transcript, getLanguage, localPlaybackOnly=false}) {
  let epoch=0, state='ready', configured=false, available=false, busy=false;
  let stream, recorder, recognition, context, interval, timer, upload, utterance, playbackTimer;
  const active=()=>['permission','listening','transcribing'].includes(state);
  const update=(next,detail,level=0)=>{state=next;render({state,detail,level,active:active(),busy});};
  const clearCapture=()=>{
    env.clearInterval(interval);env.clearTimeout(timer);interval=timer=null;
    stream?.getTracks().forEach(t=>t.stop());stream=null;
    if(context){void context.close().catch(()=>{});context=null;}
  };
  const stopSpeech=()=>{
    env.clearTimeout(playbackTimer);playbackTimer=null;
    const speaking=!!utterance;utterance=null;
    env.speechSynthesis?.cancel();
    if(speaking)update('stopped','Playback stopped. Your findings remain on screen.');
  };
  const cancel=()=>{
    epoch++;upload?.abort();upload=null;
    const rec=recorder;recorder=null;
    try{if(rec?.state==='recording')rec.stop();}catch{}
    try{recognition?.abort();}catch{}recognition=null;
    clearCapture();stopSpeech();update('stopped','Stopped. Nothing from this recording will be submitted. Type or try speaking again.');
  };
  const fail=(id,message)=>{if(id!==epoch)return;clearCapture();update('error',message);};
  const accept=async(text,id)=>{
    if(id!==epoch)return;
    if(typeof text!=='string'||!text.trim()||text.length>2000){fail(id,'No usable speech recognised. Try again, or type your message.');return;}
    update('stopped','Transcript ready. Review the words and remove private details before checking.');
    await transcript(text,id);
  };
  async function transcribe(blob,id){
    if(id!==epoch)return;
    if(blob.size<100||blob.size>2*1024*1024){fail(id,'Recording was empty or too large. Try a shorter message, or type.');return;}
    update('transcribing','Transcribing with Groq. Cancel to discard this turn.');
    const controller=new AbortController();upload=controller;
    const timeout=env.setTimeout(()=>controller.abort(),25000);
    try{
      const response=await env.fetch(`/api/voice/transcribe?lang=${encodeURIComponent(getLanguage())}`,{method:'POST',headers:{'Content-Type':blob.type},body:blob,signal:controller.signal});
      const value=await response.json();
      if(!response.ok)throw Error(value.error||'Transcription service unavailable. Type instead, or retry yourself.');
      await accept(value.text,id);
    }catch(error){fail(id,controller.signal.aborted?'Transcription timed out. Type instead, or try again.':error.message||'Transcription failed. Type instead.');}
    finally{env.clearTimeout(timeout);if(upload===controller)upload=null;}
  }
  async function start(){
    if(active()||busy)return;
    stopSpeech();const id=++epoch;
    if(!available){update('error','Voice availability has not been checked. Reload, or type your message.');return;}
    if(!env.isSecureContext){fail(id,'Microphone access needs HTTPS or localhost. You can still type.');return;}
    const Recognition=env.SpeechRecognition||env.webkitSpeechRecognition;
    if(!configured){
      if(!Recognition){fail(id,'Speech input is unavailable here: server transcription is not configured and this browser has no speech recognition. Type instead.');return;}
      update('permission','Waiting for browser speech access. Your browser provider may process audio; Pidgin recognition varies.');
      const rec=new Recognition();recognition=rec;let spoken='',failed=false;
      rec.lang='en-NG';rec.interimResults=false;rec.continuous=false;rec.maxAlternatives=1;
      rec.onaudiostart=()=>{if(id===epoch)update('listening','Listening with browser recognition. No sound-level meter is available in this mode. Stop when finished.');};
      rec.onresult=e=>{if(id===epoch)spoken=Array.from(e.results||[]).map(r=>r[0]?.transcript||'').join(' ').trim();};
      rec.onerror=e=>{
        failed=true;
        const errors={
          'not-allowed':'Browser speech access denied (not-allowed). Check microphone permission in the address bar; browser or service policy can also block recognition. You can still type.',
          'audio-capture':'Browser speech could not capture audio (audio-capture). Check your microphone and device access, or type instead.',
          'network':'Browser speech service unavailable (network). Check your connection, or type instead.',
          'service-not-allowed':'Browser speech provider blocked (service-not-allowed). Try a supported browser, or type instead.',
          'no-speech':'No speech recognised (no-speech). Try again, or type your message.',
          'language-not-supported':'The browser cannot recognise this speech language. Try English, or type instead.',
        };
        fail(id,errors[e.error]||`Browser speech failed (${e.error||'unknown error'}). Try again, or type instead.`);
      };
      rec.onend=()=>{if(id!==epoch)return;clearCapture();recognition=null;if(!failed)void accept(spoken,id);};
      timer=env.setTimeout(()=>{if(id!==epoch)return;failed=true;try{rec.abort();}catch{}fail(id,'Browser speech timed out. Nothing submitted. Type or try again.');},VOICE_TIMING.maxRecordingMs);
      try{rec.start();}catch{failed=true;fail(id,'Browser speech could not start. Reload or type instead.');}
      return;
    }
    if(!env.navigator.mediaDevices?.getUserMedia||!env.MediaRecorder){fail(id,'This browser cannot record audio. Update your browser, or type instead.');return;}
    update('permission','Allow microphone access in your browser. Cancel if you prefer to type.');
    // A permission prompt can stay unanswered. Late streams are closed, never used.
    timer=env.setTimeout(()=>{if(id===epoch){cancel();update('error','Microphone permission timed out. Type, or try again and allow access.');}},20000);
    try{
      const captured=await env.navigator.mediaDevices.getUserMedia({audio:true});
      if(id!==epoch){captured.getTracks().forEach(t=>t.stop());return;}
      env.clearTimeout(timer);stream=captured;
      const type=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'].find(t=>env.MediaRecorder.isTypeSupported(t));
      if(!type){fail(id,'No supported audio recording format. Use an up-to-date browser, or type.');return;}
      const rec=new env.MediaRecorder(stream,{mimeType:type});recorder=rec;const chunks=[];let detected=false,monitorAvailable=false;
      rec.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
      rec.onerror=()=>{if(id!==epoch)return;epoch++;clearCapture();update('error','Audio recording failed. Nothing submitted. Type or try again.');};
      rec.onstop=()=>{if(id!==epoch)return;clearCapture();recorder=null;void transcribe(new Blob(chunks,{type:rec.mimeType||type}),id);};
      rec.onstart=()=>{if(id===epoch)update('listening','Listening. Speak for up to 18 seconds. Stop to transcribe, or Cancel to discard.');};
      rec.start();
      // Install the hard limit before awaiting Web Audio: resume() can remain pending.
      timer=env.setTimeout(()=>{if(id===epoch&&rec.state==='recording'){if(monitorAvailable&&!detected){cancel();update('error','No speech activity detected. Try again, or type.');}else rec.stop();}},VOICE_TIMING.maxRecordingMs);
      const Context=env.AudioContext||env.webkitAudioContext;
      if(Context){
        try{
          context=new Context();const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();analyser.fftSize=2048;source.connect(analyser);
          await context.resume();
          if(id!==epoch)return;
          monitorAvailable=true;
          const values=new Float32Array(analyser.fftSize),detector=createVoiceActivityDetector();
          interval=env.setInterval(()=>{
            if(id!==epoch||rec.state!=='recording')return;
            try{analyser.getFloatTimeDomainData(values);}catch{monitorAvailable=false;env.clearInterval(interval);update('listening','Recording without a sound meter. Tap Stop when done (18-second limit).');return;}
            const level=rmsLevel(values),result=detector.sample(level,env.performance.now());detected=result.speechDetected;
            update('listening',detected?'Microphone activity detected. Pause to finish, or choose Stop.':'Listening for microphone activity…',Math.min(1,level*4.5));
            if(result.action==='no-speech'){cancel();update('error','No speech activity detected. Check your microphone, try again, or type.');}
            else if(result.action==='stop'||result.action==='limit'){rec.stop();}
          },VOICE_TIMING.pollMs);
        }catch{/* Recording works without a meter; the hard limit below remains. */}
      }
      if(id!==epoch)return;
    }catch(error){if(id!==epoch)return;fail(id,error.name==='NotAllowedError'?'Microphone permission denied. Allow microphone access in the address bar, then try again. You can still type.':error.name==='NotFoundError'?'No microphone found. Connect one, or type your message.':`Microphone unavailable (${error.name||'capture error'}). Check device access or type.`);}
  }
  function stop(){
    if(state==='speaking'||state==='preparing'){stopSpeech();return;}
    if(state==='permission'||state==='transcribing'){cancel();return;}
    if(recorder?.state==='recording'){update('transcribing','Finishing recording…');recorder.stop();}
    else if(recognition){update('transcribing','Waiting for browser transcription…');try{recognition.stop();}catch{cancel();}}
  }
  function speak(text,language){
    if(active()||busy)return;
    stopSpeech();
    if(!env.speechSynthesis||!env.SpeechSynthesisUtterance){update('error','Spoken output is unavailable. Read the findings on screen.');return;}
    const voices=env.speechSynthesis.getVoices().filter(v=>!localPlaybackOnly||v.localService===true);
    const voice=voices.find(v=>v.lang.toLowerCase()==='en-ng')||voices.find(v=>v.lang.toLowerCase().startsWith('en'));
    if(!voice){update('error','No English playback voice is available on this device. Enable a system voice, then try again. Read the findings on screen.');return;}
    const speech=new env.SpeechSynthesisUtterance(String(text).replace(/\*\*/g,'').replace(/https?:\/\/\S+/g,'the link shown on screen').slice(0,1500));
    speech.voice=voice;speech.lang=voice.lang;speech.rate=.92;utterance=speech;
    update('preparing',`Preparing ${voice.name}. ${language==='pcm'?'Pidgin uses an English device voice; pronunciation may vary.':'Playback starts only if your device permits it.'}`);
    playbackTimer=env.setTimeout(()=>{if(utterance===speech){stopSpeech();update('error','Playback did not start. Check device audio, or read the findings.');}},7000);
    speech.onstart=()=>{if(utterance!==speech)return;env.clearTimeout(playbackTimer);update('speaking',`Speaking with ${voice.name}.${language==='pcm'?' English voice; Pidgin pronunciation may vary.':''}`);playbackTimer=env.setTimeout(()=>{if(utterance===speech){stopSpeech();update('error','Playback timed out. Read the remaining findings on screen.');}},120000);};
    speech.onend=()=>{if(utterance===speech){utterance=null;env.clearTimeout(playbackTimer);update('stopped','Finished speaking. Your findings remain on screen.');}};
    speech.onerror=()=>{if(utterance===speech){utterance=null;env.clearTimeout(playbackTimer);update('error','Voice playback failed. Check device audio, or read the findings.');}};
    try{env.speechSynthesis.speak(speech);}catch{speech.onerror();}
  }
  return {start,stop,cancel,speak,stopSpeech,
    configure(value){configured=value===true;available=true;if(!active()&&state==='ready')update('ready',configured?'Ready. Tap Speak, then review your transcript before checking.':'Browser speech fallback. Permission, network and Pidgin support vary. Type if it fails.');},
    availabilityFailed(){available=false;update('error','Voice availability could not be checked. Reload or type instead.');},
    setBusy(value){busy=value;if(value)update('analyzing','Examining the text and address. No submitted website is opened.');else if(state==='analyzing')update('ready','Ready for your next action. Read any findings or errors below.');},
  };
}
