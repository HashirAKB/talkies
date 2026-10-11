// out/raw.webm + markers + narration → out/clips/<id>.mp4, each with its own audio, equal lengths.
// Per scene: squeeze dead air, then hold the last frame until the narration fits.
import { readFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorkspace, audioFor } from '../workspace.mjs';
import { run, ffmpeg, duration } from '../media/ffmpeg.mjs';
import { staticIntervals, mergeIntervals, keepSegments, totalLength } from '../media/deadair.mjs';
import { settings } from '../settings.mjs';
import { TalkiesError } from '../errors.mjs';

/**
 * Final clip length for a scene: the trimmed video, stretched (last frame held) when the
 * narration plus its lead and tail needs longer. Speech is never sped up or cut. Pure.
 */
export function fitScene(kept, speech, { lead, tail }) {
  const target = Math.max(kept, speech > 0 ? lead + speech + tail : 0);
  return { target, hold: target - kept };
}

/** Timestamps of frames that differ from the previous one (block-based, so a typed character counts). */
async function changingFrames(raw) {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-v', 'info', '-i', raw, '-an', '-vf', 'mpdecimate=max=0,showinfo', '-f', 'null', '-']);
  return [...stderr.matchAll(/pts_time:\s*([\d.]+)/g)].map((m) => Number(m[1]));
}

export default async function cut({ dir, flags, log }) {
  const ws = loadWorkspace(dir);
  const opts = settings();
  const raw = join(ws.out, 'raw.webm');
  const markersFile = join(ws.out, 'markers.json');
  if (!existsSync(raw) || !existsSync(markersFile)) throw new TalkiesError('no recording yet', { hint: 'talkies record' });
  /** @type {import('./record.mjs').Marker[]} */
  const markers = JSON.parse(readFileSync(markersFile, 'utf8'));
  const rawLength = await duration(raw);

  const dead = mergeIntervals([
    ...staticIntervals(await changingFrames(raw), rawLength, opts.minFreeze),
    ...markers.flatMap((m) => m.skips ?? []),
  ]);
  log(`dead air: ${dead.map(([s, e]) => `${s.toFixed(1)}–${e.toFixed(1)}`).join(', ') || 'none'}`);

  const clipsDir = join(ws.out, 'clips');
  rmSync(clipsDir, { recursive: true, force: true });
  mkdirSync(clipsDir, { recursive: true });

  const table = [];
  for (const [i, marker] of markers.entries()) {
    const scene = ws.config.scenes.find((s) => s.id === marker.id);
    // A scene's window runs to the next scene's start, so nothing between scenes is lost.
    const a = marker.start;
    const b = markers[i + 1]?.start ?? Math.min(marker.end + 0.5, rawLength);
    const segments = keepSegments(a, b, dead, opts.keep);
    const kept = totalLength(segments);
    const wav = flags.noVoice || !scene ? null : audioFor(ws, scene);
    const speech = wav ? await duration(wav) : 0;
    const { target, hold } = fitScene(kept, speech, opts);

    const trims = segments.map(([s, e], k) => `[0:v]trim=${s.toFixed(3)}:${e.toFixed(3)},setpts=PTS-STARTPTS[s${k}]`);
    const video = `${trims.join(';')};${segments.map((_, k) => `[s${k}]`).join('')}concat=n=${segments.length}:v=1:a=0,fps=${opts.fps},tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)}[v]`;
    const audio = wav
      ? `[1:a]aresample=48000,adelay=${Math.round(opts.lead * 1000)}:all=1,apad,atrim=0:${target.toFixed(3)}[a]`
      : `anullsrc=r=48000:cl=mono,atrim=0:${target.toFixed(3)}[a]`;

    await ffmpeg([
      '-i', raw, ...(wav ? ['-i', wav] : []),
      '-filter_complex', `${video};${audio}`,
      '-map', '[v]', '-map', '[a]',
      // Near-lossless intermediates: the only real encode happens once, in assemble.
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-t', target.toFixed(3),
      join(clipsDir, `${marker.id}.mp4`),
    ]);
    table.push({ scene: marker.id, raw: +(b - a).toFixed(2), kept: +kept.toFixed(2), speech: +speech.toFixed(2), clip: +target.toFixed(2) });
  }

  console.table(table);
  log('raw = recorded · kept = after dead air removed · speech = narration · clip = final (kept, or lead + speech + tail with the last frame held)');
  writeFileSync(join(clipsDir, 'order.txt'), markers.map((m) => `file '${m.id}.mp4'`).join('\n') + '\n');
}
