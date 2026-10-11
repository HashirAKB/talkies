import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/workspace.mjs';
import { TalkiesError } from '../src/errors.mjs';

const scene = { id: 'login', file: 'scenes/01-login.js', narration: 'Hi.' };

test('fills defaults', () => {
  const config = normalizeConfig({ scenes: [scene] });
  assert.equal(config.baseUrl, 'http://localhost:3000');
  assert.equal(config.browserChannel, 'chrome');
  assert.deepEqual(config.viewport, { width: 1280, height: 720 });
  assert.equal(config.voice.provider, 'gemini');
});

test('keeps explicit values', () => {
  const config = normalizeConfig({ baseUrl: 'https://x.test', voice: { provider: 'openai', voice: 'alloy' }, scenes: [] });
  assert.equal(config.baseUrl, 'https://x.test');
  assert.deepEqual(config.voice, { provider: 'openai', voice: 'alloy' });
});

for (const [name, raw, pattern] of [
  ['non-http baseUrl', { baseUrl: 'localhost:3000' }, /baseUrl/],
  ['unknown provider', { voice: { provider: 'acme-tts' } }, /unknown voice.provider/],
  ['odd viewport', { viewport: { width: 1281, height: 720 } }, /even/],
  ['scenes not an array', { scenes: {} }, /array/],
  ['bad scene id', { scenes: [{ ...scene, id: 'Log In' }] }, /kebab-case/],
  ['duplicate scene id', { scenes: [scene, scene] }, /duplicate/],
  ['scene without file', { scenes: [{ id: 'x' }] }, /needs a "file"/],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(() => normalizeConfig(raw), (err) => err instanceof TalkiesError && pattern.test(err.message));
  });
}
