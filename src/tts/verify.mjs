// --verify: transcribe a voiced line and compare it with the script.
// Catches the main TTS failure mode found in practice: style directions read aloud.
import { readFileSync } from 'node:fs';

const words = (text) => text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);

/**
 * Compare what was heard with what was scripted. Pure.
 * @returns {{ leaked: string[], extra: number }}  style words heard but not scripted; surplus word count
 */
export function checkTranscript(script, heard, style = '') {
  const said = new Set(words(heard));
  const scripted = new Set(words(script));
  const leaked = words(style).filter((w) => w.length > 2 && said.has(w) && !scripted.has(w));
  return { leaked: [...new Set(leaked)], extra: words(heard).length - words(script).length };
}

/**
 * Transcribe a WAV with a Gemini text model (the only transcriber wired up; needs GEMINI_API_KEY).
 * @returns {Promise<string | null>}  null when unavailable or nothing came back after retries
 */
export async function transcribe(file, env = process.env) {
  const key = env.GEMINI_API_KEY;
  if (!key) return null;
  const model = env.VERIFY_MODEL ?? 'gemini-3.8-flash';
  const data = readFileSync(file).toString('base64');
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ inlineData: { mimeType: 'audio/wav', data } }, { text: 'Transcribe this audio verbatim. Output only the transcript.' }] }],
      }),
    });
    const body = await res.json().catch(() => ({}));
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
    if (text) return text;
  }
  return null;
}
