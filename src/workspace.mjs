// A workspace is the folder a project owns: talkies.json, scenes/*.js, audio/ and out/.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import { TalkiesError } from './errors.mjs';
import { PROVIDERS } from './tts/index.mjs';

export const CONFIG_FILE = 'talkies.json';

/**
 * @typedef {{ id: string, file: string, narration?: string }} Scene
 * @typedef {{ provider: string, voice?: string, model?: string, style?: string }} VoiceConfig
 * @typedef {{
 *   baseUrl: string,
 *   envFile?: string,
 *   browserChannel: string,
 *   viewport: { width: number, height: number },
 *   voice: VoiceConfig,
 *   scenes: Scene[],
 * }} Config
 * @typedef {{ dir: string, out: string, audio: string, config: Config }} Workspace
 */

/** Fill defaults and reject anything that would fail later in a less obvious way. Pure. */
export function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object') throw new TalkiesError(`${CONFIG_FILE} must contain a JSON object`);
  const config = {
    baseUrl: 'http://localhost:3000',
    browserChannel: 'chrome',
    viewport: { width: 1280, height: 720 },
    ...raw,
    voice: { provider: 'gemini', ...(raw.voice ?? {}) },
    scenes: raw.scenes ?? [],
  };
  if (typeof config.baseUrl !== 'string' || !/^https?:\/\//.test(config.baseUrl)) {
    throw new TalkiesError(`baseUrl must be an http(s) URL, got ${JSON.stringify(config.baseUrl)}`);
  }
  if (!PROVIDERS[config.voice.provider]) {
    throw new TalkiesError(`unknown voice.provider "${config.voice.provider}"`, {
      hint: `one of: ${Object.keys(PROVIDERS).join(', ')}`,
    });
  }
  const { width, height } = config.viewport;
  if (!(width > 0 && height > 0 && width % 2 === 0 && height % 2 === 0)) {
    throw new TalkiesError('viewport width and height must be positive even numbers (H.264 needs even sizes)');
  }
  if (!Array.isArray(config.scenes)) throw new TalkiesError('scenes must be an array');
  const ids = new Set();
  for (const scene of config.scenes) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(scene.id ?? '')) {
      throw new TalkiesError(`scene id ${JSON.stringify(scene.id)} must be kebab-case (a-z, 0-9, -)`);
    }
    if (ids.has(scene.id)) throw new TalkiesError(`duplicate scene id "${scene.id}"`);
    if (typeof scene.file !== 'string') throw new TalkiesError(`scene "${scene.id}" needs a "file"`);
    ids.add(scene.id);
  }
  return config;
}

/**
 * Load a workspace and, once per process, the env file it names.
 * process.loadEnvFile never overrides variables already set in the shell.
 * @returns {Workspace}
 */
export function loadWorkspace(dir) {
  const root = resolve(dir);
  const file = join(root, CONFIG_FILE);
  if (!existsSync(file)) {
    throw new TalkiesError(`no ${CONFIG_FILE} in ${root}`, { hint: `talkies init --dir ${dir}` });
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new TalkiesError(`${file} is not valid JSON: ${err.message}`);
  }
  const config = normalizeConfig(raw);
  if (config.envFile) {
    const envPath = isAbsolute(config.envFile) ? config.envFile : resolve(root, config.envFile);
    if (!existsSync(envPath)) throw new TalkiesError(`envFile not found: ${envPath}`);
    process.loadEnvFile(envPath);
  }
  return { dir: root, out: join(root, 'out'), audio: join(root, 'audio'), config };
}

/** Narration wav for a scene, or null when the scene is silent or was not voiced. */
export function audioFor(ws, scene) {
  const file = join(ws.audio, `${scene.id}.wav`);
  return scene.narration?.trim() && existsSync(file) ? file : null;
}
