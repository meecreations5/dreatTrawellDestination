import assert from 'node:assert/strict';
import test from 'node:test';
import {
  VOICE_LANGUAGES,
  appendVoiceNote,
  collectRecognitionText,
  getSpeechErrorMessage
} from '../lib/engagementVoiceText.js';

test('only the requested English and Hindi dictation modes are presented', () => {
  assert.deepEqual(VOICE_LANGUAGES.map(item => item.value), ['en-IN', 'hi-IN']);
});

test('voice text appends to, rather than replacing, an existing human-written engagement note', () => {
  assert.equal(appendVoiceNote('Asked about Singapore', 'Wants updated rates'), 'Asked about Singapore\nWants updated rates');
  assert.equal(appendVoiceNote('', 'Spoke with the agent'), 'Spoke with the agent');
  assert.equal(appendVoiceNote('Existing note', '  '), 'Existing note');
  assert.equal(appendVoiceNote('First line\n', 'Second line'), 'First line\nSecond line');
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
});
