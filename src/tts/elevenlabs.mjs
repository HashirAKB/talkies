// ElevenLabs TTS. EXPERIMENTAL: written against the public API reference,
// not yet exercised end to end by the maintainers. Reports welcome.
import { TalkiesError } from '../errors.mjs';

/** @type {import('./index.mjs').Provider} */
export default {
  name: 'elevenlabs',
  experimental: true,
  keyEnv: 'ELEVENLABS_API_KEY',
  // `voice` is an ElevenLabs voice ID; this one is the premade "Rachel" voice.
  defaults: { voice: '21m00Tcm4TlvDq8ikWAM', model: 'eleven_multilingual_v2' },
  styleSupport: 'ignored (pick a voice that already sounds right)',

  async synthesize({ text, voice, model, key }) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=pcm_24000`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'xi-api-key': key },
        body: JSON.stringify({ text, model_id: model }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body.detail?.message ?? body.detail ?? res.statusText;
      throw new TalkiesError(`ElevenLabs TTS ${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    }
    // pcm_24000 is raw signed 16-bit little-endian mono at 24 kHz.
    return { audio: Buffer.from(await res.arrayBuffer()), input: ['-f', 's16le', '-ar', '24000', '-ac', '1'] };
  },
};
