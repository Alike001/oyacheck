import test from 'node:test';
import assert from 'node:assert/strict';
import {audioExtension, keyIsConfigured, transcribeAudio, MAX_AUDIO_BYTES} from '../lib/voice.mjs';
const key='gsk_test_only_key';
const sample=Buffer.alloc(250,1);
test('supports recognized audio formats and rejects other types',()=>{
  assert.equal(audioExtension('audio/webm;codecs=opus'),'webm');
  assert.equal(audioExtension('audio/wav'),'wav');
  assert.equal(audioExtension('audio/mpeg'),'mp3');
  assert.equal(audioExtension('application/json'),null);
});
test('rejects absent API key',async()=>{
  await assert.rejects(transcribeAudio(sample,'audio/webm','en',{key:''}),/not configured/);
});
test('rejects unsupported format without a provider request',async()=>{
  await assert.rejects(transcribeAudio(sample,'text/html','en',{key}),/Unsupported/);
});
test('rejects missing or excessive bytes',async()=>{
  await assert.rejects(transcribeAudio(Buffer.alloc(1),'audio/wav','en',{key}),/empty or too large/);
  await assert.rejects(transcribeAudio(Buffer.alloc(MAX_AUDIO_BYTES+1),'audio/wav','en',{key}),/empty or too large/);
});
test('transcribes English through an isolated fake provider',async()=>{
  let captured;
  const result=await transcribeAudio(sample,'audio/webm;codecs=opus','en',{key,fetcher:async(url,options)=>{
    captured={url,method:options.method,model:options.body.get('model'),language:options.body.get('language'),prompt:options.body.get('prompt')};
    return {ok:true,json:async()=>({text:'Is this website real?'})};
  }});
  assert.equal(captured.url,'https://api.groq.com/openai/v1/audio/transcriptions');
  assert.equal(captured.model,'whisper-large-v3-turbo');
  assert.equal(captured.language,'en');
  assert.equal(result.text,'Is this website real?');
  assert.equal(result.reviewRequired,true);
});
test('Pidgin uses a dialect hint without a fabricated language code',async()=>{
  let language, prompt;
  const result=await transcribeAudio(sample,'audio/ogg','pcm',{key,fetcher:async(_,options)=>{
    language=options.body.get('language'); prompt=options.body.get('prompt');
    return {ok:true,json:async()=>({text:'Wetin be this link?'})};
  }});
  assert.equal(language,null);
  assert.match(prompt,/Pidgin/);
  assert.equal(result.language,'pcm');
});
test('rejects provider failure and rate-limited response',async()=>{
  await assert.rejects(transcribeAudio(sample,'audio/ogg','en',{key,fetcher:async()=>({ok:false,status:429})}),/limit/);
  await assert.rejects(transcribeAudio(sample,'audio/ogg','en',{key,fetcher:async()=>({ok:false,status:500})}),/did not complete/);
});
test('rejects empty transcript',async()=>{
  await assert.rejects(transcribeAudio(sample,'audio/ogg','en',{key,fetcher:async()=>({ok:true,json:async()=>({text:''})})}),/Could not reliably/);
});
test('API key format is checked',()=>{
  assert.equal(keyIsConfigured(''),false);
  assert.equal(keyIsConfigured('mysecret'),false);
  assert.equal(keyIsConfigured(key),true);
});
