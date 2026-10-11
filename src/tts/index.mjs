// Provider registry plus the provider-independent parts: caching and audio normalisation.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ffmpeg } from '../media/ffmpeg.mjs';
import { TalkiesError } from '../errors.mjs';
import gemini from './gemini.mjs';
import openai from './openai.mjs';
import elevenlabs from './elevenlabs.mjs';

/**
 * A text-to-speech backend. Adding one = one file exporting this shape, plus an entry below.
 * @typedef {{
 *   name: string,
 *   experimental: boolean,
 *   keyEnv: string,
 *   defaults: { voice: string, model: string },
 *   styleSupport: string,
 *   synthesize(args: { text: string, voice: string, model: string, style: string, key: string }):
 *     Promise<{ audio: Buffer, input: string[] }>,
 * }} Provider
 * `input` holds ffmpeg input options describing `audio` ([] when it is a self-describing file such as WAV).
 */

/** @type {Record<string, Provider>} */
export const PROVIDERS = { gemini, openai, elevenlabs };

/** Resolve provider, voice, model and style from a workspace's voice config and the environment. */
export function resolveVoice(voiceConfig, env = process.env) {
  const provider = PROVIDERS[voiceConfig.provider];
  if (!provider) throw new TalkiesError(`unknown voice provider "${voiceConfig.provider}"`);
  return {
    provider,
    voice: voiceConfig.voice ?? provider.defaults.voice,
    model: env.TTS_MODEL ?? voiceConfig.model ?? provider.defaults.model,
    style: (voiceConfig.style ?? '').trim(),
  };
}

/** Cache file name for one line: any change to provider, model, voice, style or text is a new entry. Pure. */
export function cacheKey({ provider, model, voice, style }, text) {
  return createHash('sha256').update(JSON.stringify([provider.name, model, voice, style, text.trim()])).digest('hex').slice(0, 20);
}

export const cacheDir = () => process.env.TALKIES_CACHE ?? join(homedir(), '.cache', 'talkies', 'tts');

/**
 * Voice one line into a cached 24 kHz mono WAV with leading and trailing silence trimmed,
 * so pacing is decided only by the cut step.
 * @returns {Promise<{ file: string, fresh: boolean }>}
 */
export async function voiceLine(resolved, text, env = process.env) {
  const dir = cacheDir();
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${cacheKey(resolved, text)}.wav`);
  if (existsSync(file)) return { file, fresh: false };

  const { provider } = resolved;
  const key = env[provider.keyEnv];
  if (!key) throw new TalkiesError(`${provider.keyEnv} is not set`, { hint: 'add it to the envFile named in talkies.json, or export it' });
  const { audio, input } = await provider.synthesize({ ...resolved, text: text.trim(), key });
  const trim = 'silenceremove=start_periods=1:start_threshold=-50dB';
  await ffmpeg([...input, '-i', 'pipe:0', '-af', `${trim},areverse,${trim},areverse`, '-ar', '24000', '-ac', '1', file], { input: audio });
  return { file, fresh: true };
}
