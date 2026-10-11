// Preflight: everything a take needs, with the exact fix for each miss. --fix repairs what needs no sudo.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { loadWorkspace } from '../workspace.mjs';
import { hasBinary } from '../media/ffmpeg.mjs';
import { resolveVoice } from '../tts/index.mjs';

/** Names passed to env.secret('…') in a scene's source. Pure. */
export function secretsUsed(source) {
  return [...source.matchAll(/env\.secret\(\s*['"`]([A-Za-z0-9_]+)['"`]\s*\)/g)].map((m) => m[1]);
}

/** Launch the browser and record a blank page: proves the channel and Playwright's ffmpeg build exist. */
async function probeRecording(channel, dir) {
  const { chromium } = await import('playwright-core');
  const tmp = join(dir, 'out', 'probe');
  const browser = await chromium.launch({ channel });
  try {
    const context = await browser.newContext({ recordVideo: { dir: tmp } });
    await context.newPage();
    await context.close();
  } finally {
    await browser.close();
    rmSync(tmp, { recursive: true, force: true });
  }
}

export default async function check({ dir, flags, log }) {
  let ok = true;
  const report = (pass, label, fix) => {
    log(`${pass ? '✓' : '✗'} ${label}${!pass && fix ? `\n    fix: ${fix}` : ''}`);
    if (!pass) ok = false;
  };

  const major = Number(process.versions.node.split('.')[0]);
  report(major >= 22, `node ${process.versions.node} (need 22+)`, 'install Node.js 22 or newer');
  report(hasBinary('ffmpeg') && hasBinary('ffprobe'), 'ffmpeg and ffprobe on PATH', 'sudo apt install ffmpeg  ·  brew install ffmpeg  ·  winget install ffmpeg');

  let ws;
  try {
    ws = loadWorkspace(dir);
    report(true, `workspace ${ws.dir}`);
  } catch (err) {
    report(false, `workspace: ${err.message}`, err.hint);
    return ok;
  }
  const { config } = ws;

  const missing = config.scenes.filter((s) => !existsSync(join(ws.dir, s.file))).map((s) => s.file);
  report(config.scenes.length > 0 && !missing.length, `scene files (${config.scenes.length} scenes)`, missing.length ? `create ${missing.join(', ')}` : 'add scenes to talkies.json');
  if (config.scenes.some((s) => s.id === 'open' && s.file === 'scenes/01-open.js')) log('· the template scene "open" is still listed: replace it with your own');

  const secrets = new Set();
  for (const s of config.scenes) {
    const file = join(ws.dir, s.file);
    if (existsSync(file)) secretsUsed(readFileSync(file, 'utf8')).forEach((name) => secrets.add(name));
  }
  for (const name of secrets) report(Boolean(process.env[name]), `secret ${name}`, 'add it to the envFile named in talkies.json, or export it');

  if (!flags.noVoice && config.scenes.some((s) => s.narration?.trim())) {
    const { provider } = resolveVoice(config.voice);
    report(Boolean(process.env[provider.keyEnv]), `${provider.keyEnv} for voice provider "${provider.name}"${provider.experimental ? ' (experimental)' : ''}`, 'add it to the envFile, export it, or record silently with --no-voice');
  }

  const baseUrl = process.env.BASE_URL ?? config.baseUrl;
  const up = await fetch(baseUrl, { signal: AbortSignal.timeout(8000) }).then((r) => r.status < 500, () => false);
  report(up, `app reachable at ${baseUrl}`, 'start the app, or fix baseUrl in talkies.json');

  const channel = process.env.BROWSER_CHANNEL ?? config.browserChannel;
  let err = await probeRecording(channel, ws.dir).then(() => null, (e) => e);
  const cli = join(createRequire(import.meta.url).resolve('playwright-core/package.json'), '..', 'cli.js');
  const needsFfmpeg = (e) => /ffmpeg/i.test(e?.message ?? '');
  const needsBrowser = (e) => /distribution|executable doesn't exist|not found/i.test(e?.message ?? '') && !needsFfmpeg(e);
  if (err && flags.fix && (needsFfmpeg(err) || (needsBrowser(err) && channel === 'chromium'))) {
    spawnSync(process.execPath, [cli, 'install', needsFfmpeg(err) ? 'ffmpeg' : 'chromium'], { stdio: 'inherit' });
    err = await probeRecording(channel, ws.dir).then(() => null, (e) => e);
  }
  const fix = needsFfmpeg(err)
    ? `talkies check --fix  (downloads Playwright's ffmpeg build: node ${cli} install ffmpeg)`
    : channel === 'chromium'
      ? 'talkies check --fix  (downloads Chromium)'
      : `install Google Chrome, or set "browserChannel": "chromium" in talkies.json and run talkies check --fix`;
  report(!err, `browser "${channel}" launches and records video`, err ? `${fix}\n    error: ${err.message.split('\n')[0]}` : '');

  return ok;
}
