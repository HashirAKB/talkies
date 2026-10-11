// Replay the scene files in one browser session; write out/raw.webm and out/markers.json.
import { mkdirSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadWorkspace } from '../workspace.mjs';
import { createDemo } from '../scene/helpers.mjs';
import { TalkiesError } from '../errors.mjs';

const CURSOR = fileURLToPath(new URL('../scene/cursor.js', import.meta.url));

/**
 * @typedef {{ id: string, start: number, end: number, skips: [number, number][] }} Marker
 * Seconds from the first video frame.
 */

/** Scenes from the start up to and including `until` (all when unset). Pure. */
export function scenesUntil(scenes, until) {
  if (!until) return scenes;
  const index = scenes.findIndex((s) => s.id === until);
  if (index < 0) throw new TalkiesError(`--until: no scene "${until}"`, { hint: `scenes: ${scenes.map((s) => s.id).join(', ')}` });
  return scenes.slice(0, index + 1);
}

/** The `env` object scenes receive. */
export function sceneEnv(baseUrl, env = process.env) {
  return {
    baseUrl,
    /** A secret from the shell or the workspace envFile; throws when missing so a take fails early and clearly. */
    secret(name) {
      const value = env[name];
      if (!value) throw new TalkiesError(`secret ${name} is not set`, { hint: 'add it to the envFile named in talkies.json, or export it' });
      return value;
    },
  };
}

export default async function record({ dir, flags, log }) {
  const ws = loadWorkspace(dir);
  const { config } = ws;
  const scenes = scenesUntil(config.scenes, flags.until);
  if (!scenes.length) throw new TalkiesError('no scenes in talkies.json');

  const { chromium } = await import('playwright-core');
  const tmp = join(ws.out, 'video-tmp');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  rmSync(join(ws.out, 'error.png'), { force: true });

  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL ?? config.browserChannel,
    headless: !flags.headed,
  });
  const context = await browser.newContext({
    viewport: config.viewport,
    deviceScaleFactor: 1,
    recordVideo: { dir: tmp, size: config.viewport },
  });
  await context.addInitScript({ path: CURSOR });
  const page = await context.newPage();
  const t0 = Date.now(); // the video starts with the page, so this is its time zero (±~50 ms)
  const since = () => (Date.now() - t0) / 1000;
  const demo = createDemo(page, since, ws.out);
  const env = sceneEnv(process.env.BASE_URL ?? config.baseUrl);

  /** @type {Marker[]} */
  const markers = [];
  let failure = null;
  for (const scene of scenes) {
    const start = since();
    process.stdout.write(`▶ ${scene.id} `);
    try {
      const mod = await import(pathToFileURL(join(ws.dir, scene.file)).href);
      if (typeof mod.default !== 'function') throw new TalkiesError(`${scene.file} must default-export an async function`);
      await mod.default({ page, demo, env });
    } catch (err) {
      failure = { scene, err };
      await page.screenshot({ path: join(ws.out, 'error.png') }).catch(() => {});
      break;
    }
    markers.push({ id: scene.id, start, end: since(), skips: demo.skips.splice(0) });
    log(`${(since() - start).toFixed(1)}s`);
  }

  const video = page.video();
  await context.close(); // flushes the video file
  await browser.close();
  renameSync(await video.path(), join(ws.out, 'raw.webm'));
  rmSync(tmp, { recursive: true, force: true });
  writeFileSync(join(ws.out, 'markers.json'), JSON.stringify(markers, null, 2) + '\n');

  if (failure) {
    log('');
    throw new TalkiesError(`scene "${failure.scene.id}" failed: ${failure.err.message.split('\n')[0]}`, {
      hint: `page at the moment of failure: ${join(ws.out, 'error.png')}\n${failure.err.message.split('\n').slice(1, 8).join('\n')}`.trim(),
    });
  }
  log(`✓ out/raw.webm (${since().toFixed(1)}s), out/markers.json${flags.until ? ` (stopped after ${flags.until})` : ''}`);
}
