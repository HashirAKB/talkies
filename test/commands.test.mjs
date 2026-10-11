import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fitScene } from '../src/commands/cut.mjs';
import { scenesUntil, sceneEnv } from '../src/commands/record.mjs';
import { secretsUsed } from '../src/commands/check.mjs';
import init from '../src/commands/init.mjs';
import { TalkiesError } from '../src/errors.mjs';

const BIN = fileURLToPath(new URL('../bin/talkies.mjs', import.meta.url));
const opts = { lead: 0.4, tail: 0.6 };

test('fitScene: video longer than the narration keeps its length', () => {
  assert.deepEqual(fitScene(8, 3, opts), { target: 8, hold: 0 });
});

test('fitScene: narration longer than the video holds the last frame', () => {
  const { target, hold } = fitScene(2, 4, opts);
  assert.equal(target, 5);
  assert.equal(hold, 3);
});

test('fitScene: silent scenes keep their trimmed length', () => {
  assert.deepEqual(fitScene(1.5, 0, opts), { target: 1.5, hold: 0 });
});

test('scenesUntil: slices through the named scene, or rejects an unknown id', () => {
  const scenes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(scenesUntil(scenes, 'b').map((s) => s.id), ['a', 'b']);
  assert.equal(scenesUntil(scenes, undefined), scenes);
  assert.throws(() => scenesUntil(scenes, 'z'), TalkiesError);
});

test('sceneEnv.secret returns set values and fails clearly on missing ones', () => {
  const env = sceneEnv('http://x.test', { PASS: 's3cret' });
  assert.equal(env.secret('PASS'), 's3cret');
  assert.throws(() => env.secret('NOPE'), /secret NOPE is not set/);
});

test('secretsUsed finds every env.secret name in a scene source', () => {
  const src = "await x(env.secret('ADMIN_PASSWORD')); env.secret( \"API_TOKEN\" ); env.secret(`OTHER`)";
  assert.deepEqual(secretsUsed(src), ['ADMIN_PASSWORD', 'API_TOKEN', 'OTHER']);
});

test('init writes a workspace and never overwrites it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'talkies-'));
  try {
    const lines = [];
    await init({ dir, flags: { baseUrl: 'http://localhost:5173', envFile: '/abs/.env', provider: 'openai' }, log: (l) => lines.push(l) });
    const config = JSON.parse(readFileSync(join(dir, 'talkies.json'), 'utf8'));
    assert.equal(config.baseUrl, 'http://localhost:5173');
    assert.equal(config.envFile, '/abs/.env', 'absolute env paths stay absolute');
    assert.equal(config.voice.provider, 'openai');
    assert.ok(existsSync(join(dir, 'scenes', '01-open.js')));
    assert.equal(readFileSync(join(dir, '.gitignore'), 'utf8'), 'out/\naudio/\n');

    await init({ dir, flags: { baseUrl: 'http://other' }, log: (l) => lines.push(l) });
    assert.equal(JSON.parse(readFileSync(join(dir, 'talkies.json'), 'utf8')).baseUrl, 'http://localhost:5173');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('cli: --version, --help, unknown command and missing workspace', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(execFileSync(process.execPath, [BIN, '--version'], { encoding: 'utf8' }).trim(), pkg.version);
  assert.match(execFileSync(process.execPath, [BIN, '--help'], { encoding: 'utf8' }), /Usage: talkies <command>/);

  const unknown = spawnSync(process.execPath, [BIN, 'dance'], { encoding: 'utf8' });
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown command "dance"/);

  const missing = spawnSync(process.execPath, [BIN, 'record', '--dir', join(tmpdir(), 'talkies-nope')], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /no talkies.json/);
  assert.doesNotMatch(missing.stderr, /at .*\.mjs/, 'expected errors print without a stack trace');
});
