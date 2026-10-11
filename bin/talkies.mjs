#!/usr/bin/env node
// talkies: narrated product demo videos of web apps, as code.
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { commands, TalkiesError } from '../src/index.mjs';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const HELP = `talkies ${version}: narrated demo videos of web apps, as code

Usage: talkies <command> [--dir <workspace>] [options]

Commands
  init           create a workspace (talkies.json, scenes/, .gitignore)
  check          preflight: node, ffmpeg, browser, keys, secrets, app reachable
  voice          narration → audio/<scene>.wav (cached; alias: tts)
  record         replay scenes in a browser → out/raw.webm + out/markers.json
  cut            remove dead air, fit each scene to its narration → out/clips/
  assemble       join clips with fades → out/final.mp4
  review         per-scene timing table + out/sheet.png contact sheet
  take           voice → record → cut → assemble → review
  install-skill  copy the AI-agent skill to ~/.claude/skills/talkies (or --to <dir>)

Options
  --dir <path>         workspace folder (default: current directory)
  --until <scene-id>   record: stop after this scene (build scenes one at a time)
  --headed             record: show the browser
  --no-voice           take/cut/check: silent video, no TTS calls or key
  --verify             voice: transcribe new lines back and flag mismatches
  --fix                check: install what needs no sudo
  --base-url <url>     init: the app's URL
  --env-file <path>    init: .env holding API keys and scene secrets
  --provider <name>    init: gemini (default) | openai | elevenlabs (experimental)
  --to <dir>           install-skill: target folder
  -v, --version        print version
  -h, --help           print this help

Docs: https://github.com/HashirAKB/talkies#readme`;

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      dir: { type: 'string', default: '.' },
      until: { type: 'string' },
      headed: { type: 'boolean' },
      'no-voice': { type: 'boolean' },
      verify: { type: 'boolean' },
      fix: { type: 'boolean' },
      'base-url': { type: 'string' },
      'env-file': { type: 'string' },
      provider: { type: 'string' },
      to: { type: 'string' },
      version: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
  });
} catch (err) {
  console.error(`talkies: ${err.message}\n\n${HELP}`);
  process.exit(2);
}

const { values, positionals } = parsed;
if (values.version) {
  console.log(version);
  process.exit(0);
}
const name = positionals[0] === 'tts' ? 'voice' : positionals[0];
if (values.help || !name) {
  console.log(HELP);
  process.exit(0);
}
const command = commands[name];
if (!command) {
  console.error(`talkies: unknown command "${name}"\n\n${HELP}`);
  process.exit(2);
}

const flags = {
  until: values.until,
  headed: values.headed,
  noVoice: values['no-voice'],
  verify: values.verify,
  fix: values.fix,
  baseUrl: values['base-url'],
  envFile: values['env-file'],
  provider: values.provider,
  to: values.to,
};

try {
  const result = await command({ dir: values.dir, flags, log: console.log });
  process.exit(result === false ? 1 : 0);
} catch (err) {
  if (err instanceof TalkiesError) {
    console.error(`✗ ${err.message}${err.hint ? `\n  ${err.hint.replaceAll('\n', '\n  ')}` : ''}`);
    process.exit(1);
  }
  throw err;
}
