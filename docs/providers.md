# Voice providers

| Provider | Status | Key | Default voice | Default model | `style` |
|---|---|---|---|---|---|
| `gemini` | **Stable**, tested end to end | `GEMINI_API_KEY` | `Kore` | `gemini-3.8-flash-tts` | Sent as an inline `[tag]`. Sometimes spoken; use `--verify` |
| `openai` | **Experimental** | `OPENAI_API_KEY` | `coral` | `gpt-4o-mini-tts` | Sent in the separate `instructions` field. Never spoken |
| `elevenlabs` | **Experimental** | `ELEVENLABS_API_KEY` | `21m00Tcm4TlvDq8ikWAM` (premade "Rachel") | `eleven_multilingual_v2` | Ignored: pick a voice that already sounds right |

> **About "experimental".** talkies was built and tested with Gemini, the provider the author had a key for. The OpenAI and ElevenLabs providers were written against their public API references and are covered by the same unit tests, but no maintainer has run them end to end yet. They should work, but if a request shape has drifted they will fail loudly, with the provider's own error message. `talkies voice` prints a warning when you use one. If you use one, please [open an issue](https://github.com/HashirAKB/talkies/issues) either way, saying whether it worked or failed, and I'll promote it or fix it.

Pick one in `talkies.json`:

```json
"voice": { "provider": "openai", "voice": "coral", "style": "warm and upbeat, like a product launch" }
```

`--verify` always transcribes with Gemini, so it needs `GEMINI_API_KEY` whichever provider does the voicing. Without that key it is skipped with a warning.

## Adding a provider

A provider is one file in `src/tts/` that exports this shape, plus one line in the `PROVIDERS` map in `src/tts/index.mjs`:

```js
export default {
  name: 'acme',
  experimental: true,                       // until someone has run it end to end
  keyEnv: 'ACME_TTS_KEY',
  defaults: { voice: 'narrator', model: 'acme-tts-1' },
  styleSupport: 'instructions field (not spoken)',

  /** @returns {Promise<{ audio: Buffer, input: string[] }>} */
  async synthesize({ text, voice, model, style, key }) {
    const res = await fetch('https://api.acme.example/tts', { /* … */ });
    if (!res.ok) throw new TalkiesError(`Acme TTS ${res.status}: …`);
    // `input` is the ffmpeg input options for `audio`: [] for self-describing formats (WAV, MP3),
    // or e.g. ['-f', 's16le', '-ar', '24000', '-ac', '1'] for raw PCM.
    return { audio: Buffer.from(await res.arrayBuffer()), input: [] };
  },
};
```

Caching, silence trimming, resampling and verification are handled outside the provider, so a new provider only has to turn text into audio. The unit tests check that every registered provider declares the full interface.
