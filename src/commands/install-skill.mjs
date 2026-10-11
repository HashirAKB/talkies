// Copy the bundled agent skill (SKILL.md + references) into an agent's skills folder.
// Default target: Claude Code's user-level skills, ~/.claude/skills/talkies.
import { cpSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = fileURLToPath(new URL('../../skills/talkies/', import.meta.url));

export default async function installSkill({ flags, log }) {
  const target = resolve(flags.to ?? join(homedir(), '.claude', 'skills', 'talkies'));
  const existed = existsSync(target);
  cpSync(SKILL, target, { recursive: true, force: true });
  log(`✓ ${existed ? 'updated' : 'installed'} skill at ${target}`);
  log('  Claude Code picks it up in new sessions: ask for "a demo video of my app", or type /talkies.');
}
