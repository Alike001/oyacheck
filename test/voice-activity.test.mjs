import test from 'node:test';
import assert from 'node:assert/strict';
import {createVoiceActivityDetector, rmsLevel, VOICE_TIMING} from '../public/voice-activity.js';
function feed(detector, series, period=90, t=0){let out;for(let i=0;i<series.length;i++)out=detector.sample(series[i],t+i*period);return out;}
test('silence does not cause an immediate send',()=>{
  const d=createVoiceActivityDetector();
  for(let t=0;t<VOICE_TIMING.noSpeechMs;t+=90)assert.equal(d.sample(0.002,t).action,'continue');
  assert.equal(d.sample(0.002,8550).action,'no-speech');
});
test('a brief microphone click is ignored',()=>{
  const d=createVoiceActivityDetector();
  feed(d,[0.002,0.09,0.001,0.001,0.001]);
  assert.equal(d.sample(0.002,3400).action,'continue');
});
test('speech followed by natural pause stops automatically',()=>{
  const d=createVoiceActivityDetector();
  for(let t=0;t<=720;t+=90)d.sample(0.09,t);
  const before=d.sample(0.001,2100); // 1380ms since last sound
  assert.equal(before.action,'continue');
  assert.equal(d.sample(0.001,2250).action,'stop');
});
test('another phrase resets the silence clock',()=>{
  const d=createVoiceActivityDetector();
  for(let t=0;t<=540;t+=90)d.sample(0.09,t);
  assert.equal(d.sample(0.001,1600).action,'continue');
  assert.equal(d.sample(0.07,1700).action,'continue');
  assert.equal(d.sample(0.001,3000).action,'continue');
  assert.equal(d.sample(0.001,3300).action,'stop');
});
test('hard recording limit does not wait forever',()=>{
  const d=createVoiceActivityDetector();
  for(let t=0;t<=360;t+=90)d.sample(0.08,t);
  assert.equal(d.sample(0.08,18100).action,'limit');
});
test('long background fan noise does not satisfy speech threshold',()=>{
  const d=createVoiceActivityDetector();
  for(let t=0;t<=7200;t+=90){const out=d.sample(0.004,t);assert.equal(out.speechDetected,false);}
});
test('loud environmental noise could trigger, so output never implies actual transcribed speech',()=>{
  const d=createVoiceActivityDetector();
  const out=feed(d,[0.08,0.08,0.08,0.08,0.001]);
  assert.equal(out.speechDetected,true);
  assert.equal(out.action,'continue');
});
test('rms calculates signal energy and handles empty samples',()=>{
  assert.equal(rmsLevel(new Float32Array()),0);
  assert.equal(rmsLevel(new Float32Array([1,-1])),1);
  assert.ok(Math.abs(rmsLevel(new Float32Array([0.5,-0.5]))-0.5)<1e-9);
});
test('non-finite amplitude is treated as zero; invalid clock rejected',()=>{
  const d=createVoiceActivityDetector();
  assert.equal(d.sample(Number.NaN,0).level,0);
  assert.throws(()=>d.sample(0,Number.NaN), TypeError);
});
