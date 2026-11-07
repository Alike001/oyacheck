// Short, opt-in voice messages only. No audio is written to disk or persisted.
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const MAX_TRANSCRIPT_CHARS = 2000;
const AUDIO_TYPES = new Map([
  ['audio/webm','webm'],['audio/ogg','ogg'],['audio/mp4','mp4'],
  ['audio/wav','wav'],['audio/x-wav','wav'],['audio/mpeg','mp3'],
]);
export function audioExtension(contentType) {
  const base=String(contentType||'').split(';')[0].toLowerCase().trim();
  return AUDIO_TYPES.get(base) || null;
}
export function keyIsConfigured(key = process.env.GROQ_API_KEY) {
  return /^gsk_[A-Za-z0-9_-]+$/.test(String(key || '').trim());
}
export function readAudio(req, maxBytes = MAX_AUDIO_BYTES) {
  return new Promise((resolve,reject)=>{
    const chunks=[]; let length=0; let rejected=false;
    req.on('data', chunk=>{
      if(rejected)return;
      length+=chunk.length;
      if(length > maxBytes){rejected=true;req.resume();const error=new Error('Voice clip is too large (max 2 MB).');error.status=413;reject(error);return;}
      chunks.push(chunk);
    });
    req.on('end',()=>{if(!rejected)resolve(Buffer.concat(chunks));});
    req.on('error',err=>{if(!rejected)reject(err);});
    req.on('aborted',()=>{if(!rejected)reject(new Error('Audio upload interrupted.'));});
  });
}
export async function transcribeAudio(bytes,contentType,language,{key=process.env.GROQ_API_KEY,fetcher=fetch}={}) {
  const ext=audioExtension(contentType);
  if(!ext){const e=new Error('Unsupported recording format.');e.status=415;throw e;}
  if(!Buffer.isBuffer(bytes) || bytes.length < 100 || bytes.length > MAX_AUDIO_BYTES){const e=new Error('The audio clip is empty or too large.');e.status=400;throw e;}
  if(!keyIsConfigured(key)){const e=new Error('Speech transcription is not configured. Type your question instead.');e.status=503;throw e;}
  const form=new FormData();
  form.append('file',new Blob([bytes],{type:String(contentType).split(';')[0]}),`voice.${ext}`);
  form.append('model','whisper-large-v3-turbo');
  form.append('response_format','json');
  if(language==='pcm') {
    // No official Pidgin language code is declared supported for this model.
    form.append('prompt','Nigerian Pidgin and English speech about suspicious messages, online scams, URLs, OTP, BVN, NIN, NCC and phishing. Transcribe the words exactly; do not translate.');
  } else {
    form.append('language','en');
  }
  let response;
  try{
    response=await fetcher('https://api.groq.com/openai/v1/audio/transcriptions',{
      method:'POST',headers:{Authorization:`Bearer ${String(key).trim()}`},body:form,signal:AbortSignal.timeout(22_000)
    });
  }catch{const e=new Error('Speech service is temporarily unavailable. Please type your question.');e.status=503;throw e;}
  if(!response.ok){const e=new Error(response.status===429?'Speech free-tier limit reached; type your question.':'Speech recognition did not complete. Try again or type.');e.status=response.status===429?429:503;throw e;}
  const data=await response.json().catch(()=>null);
  const text=typeof data?.text==='string'?data.text.trim():'';
  if(!text || text.length>MAX_TRANSCRIPT_CHARS){const e=new Error('Could not reliably transcribe this recording. Please try again or type.');e.status=422;throw e;}
  return {text,language:language==='pcm'?'pcm':'en',engine:'groq-whisper',reviewRequired:true};
}
