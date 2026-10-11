import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDERS, resolveVoice, cacheKey } from '../src/tts/index.mjs';
import { checkTranscript } from '../src/tts/verify.mjs';

test('every provider declares the full interface', () => {
  for (const [name, p] of Object.entries(PROVIDERS)) {
    assert.equal(p.name, name);
    assert.equal(typeof p.experimental, 'boolean');
    assert.match(p.keyEnv, /^[A-Z_]+$/);
    assert.ok(p.defaults.voice && p.defaults.model, `${name} defaults`);
    assert.equal(typeof p.synthesize, 'function');
  }
});

test('only gemini is marked stable', () => {
  assert.deepEqual(Object.values(PROVIDERS).filter((p) => !p.experimental).map((p) => p.name), ['gemini']);
});

test('resolveVoice falls back to provider defaults and lets TTS_MODEL override', () => {
  const r = resolveVoice({ provider: 'openai' }, {});
  assert.equal(r.voice, 'coral');
  assert.equal(r.model, 'gpt-4o-mini-tts');
  assert.equal(r.style, '');
  assert.equal(resolveVoice({ provider: 'openai', model: 'tts-1' }, { TTS_MODEL: 'x' }).model, 'x');
});

test('cacheKey changes with every input that changes the audio, not with whitespace', () => {
  const base = resolveVoice({ provider: 'gemini' }, {});
  const key = cacheKey(base, 'Hello there.');
  assert.equal(cacheKey(base, '  Hello there.  '), key);
  assert.notEqual(cacheKey(base, 'Hello there!'), key);
  assert.notEqual(cacheKey({ ...base, voice: 'Puck' }, 'Hello there.'), key);
  assert.notEqual(cacheKey({ ...base, style: 'calm' }, 'Hello there.'), key);
  assert.notEqual(cacheKey(resolveVoice({ provider: 'openai' }, {}), 'Hello there.'), key);
});

test('checkTranscript flags style words that were read aloud', () => {
  const r = checkTranscript('We log in as the admin.', 'Calm, friendly. We log in as the admin.', 'calm, friendly');
  assert.deepEqual(r.leaked, ['calm', 'friendly']);
  assert.equal(r.extra, 2);
});

test('checkTranscript ignores style words that are part of the script', () => {
  const r = checkTranscript('A calm dashboard for admins.', 'A calm dashboard for admins.', 'calm');
  assert.deepEqual(r.leaked, []);
  assert.equal(r.extra, 0);
});

test('checkTranscript tolerates digits for spoken numbers (fewer words, not more)', () => {
  const r = checkTranscript('Ten thousand employees.', '10,000 employees.', '');
  assert.ok(r.extra <= 0);
});
