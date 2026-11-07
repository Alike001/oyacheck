// Deterministic amplitude-driven voice activity state machine.
// It is NOT speech recognition: environmental noise may trigger it and quiet
// voices may not. Transcription and the existing review gate remain authoritative.
export const VOICE_TIMING = Object.freeze({
  pollMs: 90,
  endSilenceMs: 1500,
  minVoicedMs: 270,
  noSpeechMs: 8500,
  maxRecordingMs: 18000,
});

export function createVoiceActivityDetector(config = {}) {
  const settings = { ...VOICE_TIMING, ...config };
  let start = null;
  let lastSample = null;
  let currentVoicedMs = 0;
  let speechDetected = false;
  let lastSpeechAt = null;
  let noiseFloor = 0.003;

  return {
    sample(value, now) {
      const time = Number(now);
      if (!Number.isFinite(time)) throw new TypeError('Invalid sample time');
      const rms = Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
      if (start === null) start = time;
      const elapsed = Math.max(0, time - start);
      const dt = lastSample === null ? settings.pollMs : Math.max(0, Math.min(200, time - lastSample));
      lastSample = time;

      // An adaptive noise floor helps with quiet rooms or constant fan noise,
      // while a minimum threshold avoids treating microphone hiss as speech.
      const threshold = Math.max(0.014, Math.min(0.065, noiseFloor * 3.2));
      const active = rms >= threshold;
      if (!active && !speechDetected) {
        noiseFloor = noiseFloor * 0.96 + Math.min(rms, 0.018) * 0.04;
      }
      if (active) {
        currentVoicedMs += dt;
        if (currentVoicedMs >= settings.minVoicedMs) speechDetected = true;
        if (speechDetected) lastSpeechAt = time;
      } else {
        currentVoicedMs = 0;
      }

      const silenceMs = lastSpeechAt === null ? null : Math.max(0, time - lastSpeechAt);
      let action = 'continue';
      if (speechDetected && silenceMs >= settings.endSilenceMs) action = 'stop';
      else if (!speechDetected && elapsed >= settings.noSpeechMs) action = 'no-speech';
      else if (elapsed >= settings.maxRecordingMs) action = speechDetected ? 'limit' : 'no-speech';
      return { action, active, speechDetected, elapsed, silenceMs, threshold, level:rms };
    },
  };
}

// Compute root mean square energy from Web Audio waveform samples.
export function rmsLevel(samples) {
  if (!samples?.length) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}
