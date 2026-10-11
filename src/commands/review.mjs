// Inspect out/final.mp4 without watching it: a per-scene timing table, a probe line, and
// out/sheet.png (one row per scene: its first and last frame). Built for humans and AI agents alike.
import { existsSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorkspace, audioFor } from '../workspace.mjs';
import { ffmpeg, duration, run } from '../media/ffmpeg.mjs';
import { settings } from '../settings.mjs';
import { TalkiesError } from '../errors.mjs';

export default async function review({ dir, flags = {}, log }) {
  const ws = loadWorkspace(dir);
  const { fade } = settings();
  const final = join(ws.out, 'final.mp4');
  if (!existsSync(final)) throw new TalkiesError('no final video yet', { hint: 'talkies assemble' });
  const ids = [...readFileSync(join(ws.out, 'clips', 'order.txt'), 'utf8').matchAll(/'([^']+)\.mp4'/g)].map((m) => m[1]);

  const rows = [];
  let at = 0;
  for (const id of ids) {
    const length = await duration(join(ws.out, 'clips', `${id}.mp4`));
    const scene = ws.config.scenes.find((s) => s.id === id);
    const wav = !flags.noVoice && scene && audioFor(ws, scene);
    rows.push({ scene: id, starts: +at.toFixed(2), length: +length.toFixed(2), speech: wav ? +(await duration(wav)).toFixed(2) : 0, narration: (scene?.narration ?? '').slice(0, 56) });
    at += length;
  }
  console.table(rows);

  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', final]);
  const probe = JSON.parse(stdout);
  const video = probe.streams.find((s) => s.codec_type === 'video');
  const hasAudio = probe.streams.some((s) => s.codec_type === 'audio');
  log(`final.mp4: ${video.width}x${video.height}, ${Number(probe.format.duration).toFixed(1)}s, audio: ${hasAudio ? 'yes' : 'NO'}`);

  const tmp = join(ws.out, 'sheet-tmp');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp);
  let n = 0;
  for (const [i, r] of rows.entries()) {
    // Sample just inside each scene; for the first and last, step past the fades.
    const head = Math.min(i === 0 ? fade + 0.15 : 0.3, r.length / 4);
    const tail = i === rows.length - 1 ? fade + 0.15 : 0.4;
    for (const t of [head, Math.max(0, r.length - tail)]) {
      await ffmpeg(['-ss', (r.starts + t).toFixed(3), '-i', final, '-frames:v', '1', '-vf', 'scale=640:-2', join(tmp, `${String(n++).padStart(3, '0')}.png`)]);
    }
  }
  await ffmpeg(['-framerate', '1', '-i', join(tmp, '%03d.png'), '-vf', `tile=2x${rows.length}:padding=6:color=gray`, '-frames:v', '1', join(ws.out, 'sheet.png')]);
  rmSync(tmp, { recursive: true, force: true });
  log('✓ out/sheet.png (one row per scene: first and last frame)');
}
