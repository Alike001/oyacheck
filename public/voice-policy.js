// Pure client-side gate: a casual voice question may be auto-submitted;
// a dictated URL, sensitive value or existing draft must be reviewed first.
// This does not decide if a URL is safe; the server evidence engine does that.
const HOST = /(?:https?:\/\/|www\.|\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b)/i;
const EMAIL = /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/i;
const LONG_DIGITS = /(?:\+?\d[\s-]?){7,}/;
const CREDENTIAL = /\b(?:my\s+)?(?:password|passcode|otp|one[- ]time code|pin|bvn|nin|cvv|private key|seed phrase)\b\s*(?:is|are|na|=|:|number|code)\s*[^\s,.!?]{3,}/i;
export function voiceDecision(transcript,{autoSend=true,hasDraft=false}={}) {
  const text=String(transcript||'').trim();
  if(!text) return {action:'discard',reason:'No speech detected.'};
  if(hasDraft) return {action:'review',reason:'You already have an unsent draft. Review the combined message before sending.'};
  if(HOST.test(text)) return {action:'review',reason:'Website addresses can be misheard. Confirm the exact link before checking.'};
  if(EMAIL.test(text) || LONG_DIGITS.test(text) || CREDENTIAL.test(text))
    return {action:'review',reason:'This may contain private information. Remove it before sending.'};
  if(text.length>450) return {action:'review',reason:'The spoken question is too long for automatic chat. Review it first.'};
  if(!autoSend) return {action:'review',reason:'Automatic voice sending is off. Press Send when ready.'};
  return {action:'send',intent:'ask',reason:'Question transcribed. Sending automatically.'};
}
