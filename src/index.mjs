// Programmatic API: the same commands the CLI runs, plus the pure building blocks.
import init from './commands/init.mjs';
import check from './commands/check.mjs';
import voice from './commands/voice.mjs';
import record from './commands/record.mjs';
import cut from './commands/cut.mjs';
import assemble from './commands/assemble.mjs';
import review from './commands/review.mjs';
import installSkill from './commands/install-skill.mjs';

/** tts → record → cut → assemble → review. With noVoice, skips TTS and renders silent clips. */
async function take(ctx) {
  if (!ctx.flags.noVoice) await voice(ctx);
  await record(ctx);
  await cut(ctx);
  await assemble(ctx);
  await review(ctx);
}

export const commands = { init, check, voice, record, cut, assemble, review, take, 'install-skill': installSkill };
export { TalkiesError } from './errors.mjs';
export { loadWorkspace, normalizeConfig } from './workspace.mjs';
export { PROVIDERS } from './tts/index.mjs';
export { staticIntervals, mergeIntervals, keepSegments } from './media/deadair.mjs';
