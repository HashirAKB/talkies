// out/clips/*.mp4 → out/final.mp4: lossless join, then one encode with fades.
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorkspace } from '../workspace.mjs';
import { ffmpeg, duration } from '../media/ffmpeg.mjs';
import { settings } from '../settings.mjs';
import { TalkiesError } from '../errors.mjs';

export default async function assemble({ dir, log }) {
  const ws = loadWorkspace(dir);
  const { fade } = settings();
  const order = join(ws.out, 'clips', 'order.txt');
  if (!existsSync(order)) throw new TalkiesError('no clips yet', { hint: 'talkies cut' });

  const joined = join(ws.out, 'joined.mp4');
  const final = join(ws.out, 'final.mp4');
  // Every clip shares codecs and parameters, so the concat demuxer copies them without re-encoding.
  await ffmpeg(['-f', 'concat', '-safe', '0', '-i', order, '-c', 'copy', joined]);
  const fadeOut = Math.max(0, (await duration(joined)) - fade).toFixed(3);
  await ffmpeg([
    '-i', joined,
    '-vf', `fade=t=in:st=0:d=${fade},fade=t=out:st=${fadeOut}:d=${fade}`,
    '-af', `afade=t=in:st=0:d=${fade},afade=t=out:st=${fadeOut}:d=${fade}`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', final,
  ]);
  rmSync(joined, { force: true });
  log(`✓ out/final.mp4 (${(await duration(final)).toFixed(1)}s)`);
}
