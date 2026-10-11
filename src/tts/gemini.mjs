// Google Gemini TTS. Tested end to end; the default provider.
import { TalkiesError } from '../errors.mjs';

/** @type {import('./index.mjs').Provider} */
export default {
  name: 'gemini',
  experimental: false,
  keyEnv: 'GEMINI_API_KEY',
  defaults: { voice: 'Kore', model: 'gemini-3.8-flash-tts' },
  // Gemini has no separate style field, and system instructions are refused by TTS models.
  // A bracketed tag is the least-bad option, but the model still reads it aloud on some lines.
  styleSupport: 'inline-tag (may be spoken; use --verify)',

  async synthesize({ text, voice, model, style, key }) {
    const prompt = style ? `[${style}] ${text}` : text;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new TalkiesError(`Gemini TTS ${res.status}: ${body.error?.message ?? res.statusText}`);
    const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) throw new TalkiesError(`Gemini TTS returned no audio (finishReason: ${body.candidates?.[0]?.finishReason ?? 'unknown'})`);
    // Newer models return a WAV file; older ones raw s16le PCM with the rate in the mime type.
    const { mimeType, data } = part.inlineData;
    const input = /wav/i.test(mimeType) ? [] : ['-f', 's16le', '-ar', /rate=(\d+)/.exec(mimeType)?.[1] ?? '24000', '-ac', '1'];
    return { audio: Buffer.from(data, 'base64'), input };
  },
};
