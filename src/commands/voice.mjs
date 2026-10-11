// Voice every scene's narration into audio/<id>.wav, through the shared cache.
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorkspace } from '../workspace.mjs';
import { resolveVoice, voiceLine } from '../tts/index.mjs';
import { checkTranscript, transcribe } from '../tts/verify.mjs';
import { duration } from '../media/ffmpeg.mjs';

export default async function voice({ dir, flags, log }) {
  const ws = loadWorkspace(dir);
  const resolved = resolveVoice(ws.config.voice);
  const { provider, style } = resolved;
  mkdirSync(ws.audio, { recursive: true });

  if (provider.experimental) {
    log(`⚠ voice provider "${provider.name}" is experimental: built from the API docs but not yet tested end to end. Use --verify and listen to the result.`);
  }
  if (style && provider.name === 'gemini') {
    log('⚠ "style" with Gemini is sometimes read aloud; --verify catches it.');
  }
  if (flags.verify && !process.env.GEMINI_API_KEY) {
    log('⚠ --verify transcribes with Gemini and needs GEMINI_API_KEY; skipping verification.');
  }

  for (const scene of ws.config.scenes) {
    const target = join(ws.audio, `${scene.id}.wav`);
    if (!scene.narration?.trim()) {
      rmSync(target, { force: true });
      log(`· ${scene.id}: silent`);
      continue;
    }
    const { file, fresh } = await voiceLine(resolved, scene.narration);
    copyFileSync(file, target);
    log(`✓ ${scene.id}: ${(await duration(file)).toFixed(2)}s${fresh ? '' : ' (cached)'}`);

    if (fresh && flags.verify && process.env.GEMINI_API_KEY) {
      const heard = await transcribe(file);
      if (!heard) {
        log('  ⚠ UNVERIFIED: no transcript came back after 3 tries; listen to this line');
        continue;
      }
      const { leaked, extra } = checkTranscript(scene.narration, heard, style);
      log(`  heard: ${heard}`);
      if (leaked.length) {
        rmSync(file, { force: true }); // drop the bad take so the next run re-voices it
        rmSync(target, { force: true });
        log(`  ⚠ style spoken aloud ("${leaked.join(' ')}"): removed from cache; drop or change "style" and run again`);
      } else if (extra > 0) {
        log(`  ⚠ ${extra} more word(s) than the script: listen to this line`);
      }
    }
  }
}
