---
name: talkies
description: Produce a narrated product demo video of a web app as code, with no hand editing. Playwright scene scripts drive the app and record 1280x720 video with a gliding cursor and click ripples. Dead air is cut automatically, AI text-to-speech voices each scene, and ffmpeg muxes it all into one synced MP4. Use this whenever the user wants a demo video, product walkthrough, screencast, feature tour, a video for a take-home, PR or launch, or "record the app", or wants to add or redo a voiceover, even if they don't say "talkies" or name any tools. Also use it to add, fix or re-take scenes in an existing talkies workspace (a folder with talkies.json and scenes/).
---

# talkies

A take is five deterministic steps over a **workspace** folder:

```
voice → record → cut → assemble → review
```

```
<workspace>/
  talkies.json   baseUrl, envFile, voice { provider, voice, model?, style? }, scenes[{ id, file, narration }]
  scenes/*.js    one Playwright scene per narration line
  audio/ out/    generated, git-ignored
```

**Running the CLI.** Use `talkies` if it is on PATH. Otherwise use `npx -y github:HashirAKB/talkies`, or install it once with `npm i -g github:HashirAKB/talkies`. Below, `talkies …` means whichever of these works. Every command takes `--dir <workspace>`.

## Workflow

### 1. Find or create the workspace

- **Existing workspace:** look for a `talkies.json` near the project, often in a sibling folder named `<project>-demo`, or ask the user.
- **New workspace:** default to a sibling folder of the repo, not a folder inside it. Video tooling adds a browser dependency and large binary outputs that most repos don't want, and some repos forbid new dependencies outright. Check the project's CLAUDE.md, AGENTS.md or contributing rules. Put it inside the repo only if the user asks.

```sh
talkies init --dir ../<project>-demo --base-url http://localhost:5173 --env-file ../<project>/.env
```

`envFile` is how scenes get passwords (`env.secret('NAME')`) and how TTS gets its API key. Point it at the project's existing `.env` rather than copying secrets, and never print that file. `init` writes a placeholder scene called `open`; replace it with the real scenes.

### 2. Check the machine

```sh
talkies check --dir <workspace> --fix
```

This covers Node, ffmpeg, the browser, Playwright's ffmpeg build, the TTS key, every `env.secret` the scenes use, and whether the app is reachable. `--fix` installs whatever needs no sudo. For the rest, tell the user the exact command. Run the check again after writing scenes.

### 3. Agree on the story before recording

What the video shows and what the voice says is product messaging, so it belongs to the user. Use their script if they gave one. If not, draft scenes from the project's docs (a demo script, README or feature list) and **show the draft before voicing or recording**. TTS calls cost money, and a wrong story wastes a take.

A scene is one narration line of 1–3 sentences (about 4–12 s of speech), plus the actions that illustrate it. Write narration the way people talk: short sentences, no UI jargon.

**Voice providers.** `gemini` is the default and the only provider tested end to end. `openai` and `elevenlabs` are **experimental**: they were built from the API docs but not yet verified. Tell the user this if they choose one, and always take with `--verify`.

**Style.** Leave `voice.style` out unless the user asks for a particular delivery. With Gemini, style text is sometimes read aloud. With OpenAI it goes in a separate `instructions` field and is safe. ElevenLabs ignores it.

### 4. Write the scenes

Read `references/scene-api.md` for the helpers (`demo.click`, `type`, `choose`, `point`, `skip`, `snapshot`) and patterns. Two things make or break a scene:

- **Selectors.** Explore the app first rather than guessing.
  - **Public pages:** use the Playwright MCP's `browser_snapshot`, if available.
  - **Pages behind a login:** don't type passwords into MCP calls, because tool calls are logged. Add `await demo.snapshot('name')` at the end of the scene you have so far, then run `talkies record --until <that scene>`. Read `out/snapshots/name.yml` (the accessibility tree) and `name.png`. Reading the app's source for labels works too.
- **Waits.** Wait for the content the viewer should see. Don't wait on a timer, the URL alone or `networkidle`, because single-page apps often show skeleton rows after the redirect. Wrap slow but boring waits in `demo.skip`, so they are cut however busy the screen is.

End every scene on what its narration talks about, because the last frame is held while the voice finishes. Build up one scene at a time with `--until`. Scenes share one browser session, so a retake always re-records from the first scene. That is cheap, because audio is cached by text.

### 5. Take

Reset the app's data first if scenes change it. Then:

```sh
talkies take --dir <workspace> --verify    # --verify transcribes new lines back and flags mismatches
```

`--no-voice` makes a silent video, which is handy for iterating on scenes without spending on TTS.

### 6. Review before calling it done

`review` (the last step of `take`) prints a per-scene table and writes `out/sheet.png`, with one row per scene showing its first and last frame. **Read `out/sheet.png`** and check that:

- every last frame shows what its narration describes: no half-loaded pages, error toasts or open dropdowns;
- no scene's length is far beyond its speech plus about 1 s with nothing happening (about 1 s over is normal: 0.4 s lead plus 0.6 s tail);
- `final.mp4` has the expected size and audio.

Report the path, the length and anything that looked off. Ask the user to watch it, since you can't hear the voice.

## When something fails

`record` stops at the first failing scene, keeps the video so far, and writes `out/error.png`. Read that image and the error together; most failures are selectors or waits. `references/troubleshooting.md` covers known errors and the pacing tunables.

## Things not to do

- **Don't add talkies to the project's own `package.json`.** It runs on its own.
- **Don't commit `out/` or `audio/`.**
- **Don't speed up or trim speech to fit the video.** The cut step stretches the video to fit the voice, which is what keeps sync exact.
