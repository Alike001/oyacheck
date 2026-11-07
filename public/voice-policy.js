// Pure client-side gate: a casual voice question may be auto-submitted;
// a dictated URL, sensitive value or existing draft must be reviewed first.
// This does not decide if a URL is safe; the server evidence engine does that.
const HOST = /(?:https?:\/\/|www\.|\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b)/i;
const EMAIL = /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/i;
const LONG_DIGITS = /(?:\+?\d[\s-]?){4,}/;
// Dictation can omit punctuation, "is", or read secrets as words. Conservatively
// review any sensitive term, including a harmless question about that term.
const CREDENTIAL = /\b(?:passwords?|passcodes?|o\s*t\s*ps?|one[- ]time (?:codes?|passwords?)|pins?|b\s*v\s*ns?|n\s*i\s*ns?|cvv|private keys?|seed phrases?|recovery phrases?|access codes?|verification codes?|security codes?)\b/i;
export function voiceDecision(transcript,{autoSend=true,hasDraft=false}={}) {
  const text=String(transcript||'').trim();
  if(!text) return {action:'discard',reason:'No speech detected.'};
  if(hasDraft) return {action:'review',reason:'You already have an unsent draft. Review the combined message before sending.'};
  if(HOST.test(text)) return {action:'review',reason:'Website addresses can be misheard. Confirm the exact link before checking.'};
  if(EMAIL.test(text) || LONG_DIGITS.test(text) || CREDENTIAL.test(text))
    return {action:'review',reason:'This may contain private information. Remove it before sending.'};
  if(text.length>450) return {action:'review',reason:'The spoken question is too long for automatic chat. Review it first.'};
  if(!autoSend) return {action:'review',reason:'Review the transcript and remove private details before choosing Check.'};
  return {action:'send',intent:'ask',reason:'Question transcribed. Sending automatically.'};
}
