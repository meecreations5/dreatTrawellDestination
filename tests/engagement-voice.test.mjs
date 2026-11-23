import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VOICE_LANGUAGES,
  TRANSLATABLE_SOURCES,
  getVoiceLanguage,
  getTranslationLanguageName,
  appendVoiceNote,
  collectRecognitionText,
  getSpeechErrorMessage
} from '../lib/engagementVoiceText.js';

test('English, Hindi and Marathi voice input are offered with correct speech locale codes', () => {
  assert.deepEqual(VOICE_LANGUAGES.map(item => item.value), ['en-IN', 'hi-IN', 'mr-IN']);
  assert.equal(getVoiceLanguage('en-IN').source, null);
  assert.equal(getVoiceLanguage('hi-IN').source, 'hi');
  assert.equal(getVoiceLanguage('mr-IN').source, 'mr');
  assert.equal(getVoiceLanguage('mr-IN').label, 'Marathi voice → English text');
});

test('only supported Hindi and Marathi transcripts are sent for translation', () => {
  assert.deepEqual([...TRANSLATABLE_SOURCES], ['hi', 'mr']);
  assert.equal(TRANSLATABLE_SOURCES.includes('en'), false);
  assert.equal(TRANSLATABLE_SOURCES.includes('gu'), false);
  assert.equal(getTranslationLanguageName('mr'), 'Marathi');
  assert.equal(getTranslationLanguageName('hi'), 'Hindi');
});

test('unrecognised locale uses safe English input rather than an arbitrary translator', () => {
  assert.equal(getVoiceLanguage('unknown').value, 'en-IN');
});

test('voice text appends to, rather than replacing, an existing human-written engagement or lead note', () => {
  assert.equal(appendVoiceNote('Asked about Singapore', 'Wants updated rates'), 'Asked about Singapore\nWants updated rates');
  assert.equal(appendVoiceNote('', 'Spoke with the agent'), 'Spoke with the agent');
  assert.equal(appendVoiceNote('Existing note', '  '), 'Existing note');
  assert.equal(appendVoiceNote('First line\n', 'Second line'), 'First line\nSecond line');
  assert.equal(appendVoiceNote('First call', 'दुबईचे दर पाठवले'), 'First call\nदुबईचे दर पाठवले');
});

test('interim speech changes do not duplicate completed segments', () => {
  const earlier = [{ 0: { transcript: 'Agent called' }, isFinal: true }, { 0: { transcript: 'asking...' }, isFinal: false }];
  const later = [{ 0: { transcript: 'Agent called' }, isFinal: true }, { 0: { transcript: 'asking for rates' }, isFinal: true }];
  assert.deepEqual(collectRecognitionText(earlier), { finalText: 'Agent called', interimText: 'asking...' });
  assert.deepEqual(collectRecognitionText(later), { finalText: 'Agent called asking for rates', interimText: '' });
});

test('unsupported or rejected microphone scenarios have actionable messages', () => {
  assert.match(getSpeechErrorMessage('not-allowed'), /permission/i);
  assert.match(getSpeechErrorMessage('network'), /network/i);
  assert.match(getSpeechErrorMessage('audio-capture'), /microphone/i);
  assert.match(getSpeechErrorMessage('language-not-supported'), /language/i);
});
