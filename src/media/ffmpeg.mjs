// Thin promise wrappers around the system ffmpeg and ffprobe binaries.
import { spawn, spawnSync } from 'node:child_process';
import { TalkiesError } from '../errors.mjs';

/**
 * Run a binary and collect its output.
 * @param {string} bin  @param {string[]} args  @param {{ input?: Buffer }} [options]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export function run(bin, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (err) =>
      reject(err.code === 'ENOENT' ? new TalkiesError(`${bin} not found on PATH`, { hint: 'talkies check' }) : err),
    );
    child.on('close', (code) =>
      code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${bin} exited ${code}\n${stderr.slice(-2000)}`)),
    );
    child.stdin.on('error', () => {}); // ffmpeg may close stdin early; the exit code tells the story
    child.stdin.end(input);
  });
}

/** ffmpeg with quiet logging and overwrite on. */
export const ffmpeg = (args, options) => run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], options);

/** Duration of a media file in seconds. */
export async function duration(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return Number(stdout.trim());
}

/** Whether a binary is on PATH. */
export function hasBinary(bin) {
  return spawnSync(bin, ['-version'], { stdio: 'ignore' }).status === 0;
}
