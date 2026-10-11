# Instructions for AI coding agents

This file serves two kinds of agent: one **using** talkies to make a demo video, and one **working on** the talkies codebase.

## Making a demo video with talkies

Follow [`skills/talkies/SKILL.md`](skills/talkies/SKILL.md). It is written for Claude Code but is plain Markdown that any agent can follow: Cursor, Codex, Copilot, Gemini CLI, Windsurf, Aider and others. The short version:

1. `talkies init --dir ../<project>-demo --base-url <url> --env-file <project>/.env`
2. `talkies check --dir … --fix`
3. Agree on the scenes and narration with the user **before** voicing or recording.
4. Write `scenes/*.js` using the helpers in [`skills/talkies/references/scene-api.md`](skills/talkies/references/scene-api.md), one scene at a time with `talkies record --until <id>`.
5. `talkies take --dir … --verify`, then read `out/sheet.png` before reporting back.

Never print the user's `.env`, never type secrets into browser-automation tool calls, and never commit `out/` or `audio/`.

## Working on talkies itself

- **Runtime:** Node 22+ and plain ES modules. Nothing to build or transpile. The only runtime dependency is `playwright-core`, pinned exactly. Don't add dependencies lightly: native `fetch`, `node:test` and `node:util.parseArgs` cover most needs.
- **Layout:**
  - `bin/talkies.mjs` is the CLI.
  - `src/commands/*` holds one module per command.
  - `src/media/deadair.mjs` is the pure interval maths.
  - `src/tts/*` holds the providers.
  - `src/scene/*` holds the `demo` helpers and the cursor overlay.
- **Tests:** `npm test` (`node:test`, no network, no browser). Keep the logic pure and testable: anything that decides (intervals, config, transcripts, cache keys, CLI parsing) lives in a function with no I/O and has a test. The CI `example` job runs a real silent take of `examples/todomvc`.
- **Errors:** throw `TalkiesError(message, { hint })` for anything the user can fix. The CLI prints it without a stack trace. Any other error is a bug, and its stack trace is kept.
- **Style:** 2-space indent, single quotes, semicolons. Comments explain *why*. Keep functions small.
