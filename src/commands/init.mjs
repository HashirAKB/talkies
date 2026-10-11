// Create a workspace from the templates. Never overwrites existing files.
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG_FILE } from '../workspace.mjs';

const TEMPLATES = fileURLToPath(new URL('../../templates/', import.meta.url));

export default async function init({ dir, flags, log }) {
  const root = resolve(dir);
  mkdirSync(join(root, 'scenes'), { recursive: true });

  const target = join(root, CONFIG_FILE);
  if (existsSync(target)) {
    log(`· ${CONFIG_FILE} already exists; left alone`);
  } else {
    const config = JSON.parse(readFileSync(join(TEMPLATES, CONFIG_FILE), 'utf8'));
    if (flags.baseUrl) config.baseUrl = flags.baseUrl;
    if (flags.provider) config.voice.provider = flags.provider;
    // Keep an absolute path absolute; store a relative one relative to the workspace.
    if (flags.envFile) config.envFile = isAbsolute(flags.envFile) ? flags.envFile : relative(root, resolve(flags.envFile));
    else delete config.envFile;
    writeFileSync(target, JSON.stringify(config, null, 2) + '\n');
    log(`✓ ${target}`);
  }

  for (const file of readdirSync(join(TEMPLATES, 'scenes'))) {
    const to = join(root, 'scenes', file);
    if (!existsSync(to)) {
      copyFileSync(join(TEMPLATES, 'scenes', file), to);
      log(`✓ ${to}`);
    }
  }
  const gitignore = join(root, '.gitignore');
  if (!existsSync(gitignore)) {
    writeFileSync(gitignore, 'out/\naudio/\n');
    log(`✓ ${gitignore}`);
  }
  log(`\nNext: replace the placeholder "open" scene with your own, then run talkies check --dir ${dir}`);
}
