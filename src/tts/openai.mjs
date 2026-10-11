// OpenAI TTS (gpt-4o-mini-tts). EXPERIMENTAL: written against the public API reference,
// not yet exercised end to end by the maintainers. Reports welcome.
import { TalkiesError } from '../errors.mjs';

/** @type {import('./index.mjs').Provider} */
export default {
  name: 'openai',
  experimental: true,
  keyEnv: 'OPENAI_API_KEY',
  defaults: { voice: 'coral', model: 'gpt-4o-mini-tts' },
  // gpt-4o-mini-tts takes delivery directions in a separate `instructions` field, so style is never spoken.
  styleSupport: 'instructions field (not spoken)',

  async synthesize({ text, voice, model, style, key }) {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        voice,
        input: text,
        response_format: 'wav',
        ...(style ? { instructions: style } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new TalkiesError(`OpenAI TTS ${res.status}: ${body.error?.message ?? res.statusText}`);
    }
    return { audio: Buffer.from(await res.arrayBuffer()), input: [] };
  },
};
