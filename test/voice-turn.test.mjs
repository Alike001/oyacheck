import test from 'node:test';
import assert from 'node:assert/strict';
import { voiceDecision } from '../public/voice-policy.js';

test('automatically sends ordinary English voice questions', () => {
  assert.deepEqual(voiceDecision('How do I know if a site is fake?'),{action:'send',intent:'ask',reason:'Question transcribed. Sending automatically.'});
});
test('automatically sends Nigerian Pidgin questions', () => {
  assert.equal(voiceDecision('Abeg how I go know say this link na scam?').action,'send');
});
test('spoken website requires review instead of silently trusting transcription', () => {
  assert.equal(voiceDecision('Please check secure-verifymydevice.ng').action,'review');
  assert.equal(voiceDecision('Open https://example.org/login').action,'review');
  assert.equal(voiceDecision('www.example.org').action,'review');
});
test('long numbers, disclosed codes and emails are not auto-submitted', () => {
  assert.equal(voiceDecision('My number is 08012345678').action,'review');
  assert.equal(voiceDecision('my pin is 1234').action,'review');
  assert.equal(voiceDecision('my password is abc123').action,'review');
  assert.equal(voiceDecision('email me at test@example.org').action,'review');
});
test('existing unsent draft and user choice prevent automatic sending',()=>{
  assert.equal(voiceDecision('Is this suspicious?',{hasDraft:true}).action,'review');
  assert.equal(voiceDecision('Is this suspicious?',{autoSend:false}).action,'review');
});
test('blank recordings are ignored, long turns reviewed',()=>{
  assert.equal(voiceDecision(' ').action,'discard');
  assert.equal(voiceDecision('A'.repeat(451)).action,'review');
});
test('dictated secrets require review even without is/na punctuation or long digits',()=>{
  for(const value of ['my OTP 123456','PIN 1234','BVN one two three four','my password huntertwo','NIN number one two','access code blue monkey','verification code 4567','What is an OTP?','Please use 1234','my O T P one two three four','N I N one two three','my access codes blue monkey','passwords apple pear'])assert.equal(voiceDecision(value,{autoSend:true}).action,'review',value);
});
