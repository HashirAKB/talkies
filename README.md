<h1 align="center">talkies 🎬</h1>

<p align="center">
  <b>Narrated product demo videos of web apps, as code.</b><br/>
  Playwright scenes · automatic dead-air cutting · AI voiceover · one synced MP4 · zero hand editing
</p>

<p align="center">
  <a href="https://github.com/HashirAKB/talkies/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/HashirAKB/talkies/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="Node 22+" src="https://img.shields.io/badge/node-22%2B-339933">
  <img alt="MIT" src="https://img.shields.io/badge/license-MIT-blue">
  <img alt="Works with Claude Code" src="https://img.shields.io/badge/agent%20skill-Claude%20Code%20%7C%20Cursor%20%7C%20Codex-8A63D2">
</p>

<p align="center">
  <img src="assets/todomvc-demo.gif" width="560" alt="A talkies take of TodoMVC: a cursor glides to the input, types three todos, ticks two off and filters to Active">
  <br/>
  <sub>Silent preview. The full take, with Gemini narration, is <a href="assets/todomvc-demo.mp4"><code>assets/todomvc-demo.mp4</code></a> (16 s, made by <code>talkies take</code> from <a href="examples/todomvc">examples/todomvc</a>).</sub>
</p>

---

The silent films became *talkies* when they got a soundtrack. This tool does the same for your web app: you write what happens and what is said, and `talkies take` produces the finished, narrated MP4.

```sh
talkies take --dir demo/
#   voice     narration → speech (cached)
#   record    Playwright replays your scenes at 1280x720, with a visible gliding cursor
#   cut       removes spinners and dead air, then fits each scene exactly to its line
#   assemble  joins and fades → out/final.mp4
#   review    timing table + a contact sheet, so you (or your AI agent) can check it without pressing play
```

A scene is a few lines of ordinary Playwright:

```js
// scenes/02-filter.js: "Filter by country and level, and the count updates straight away."
export default async ({ page, demo }) => {
  await demo.choose('Country', 'India');
  await demo.choose('Level', 'L3 Senior');
  await demo.point(page.getByText(/Showing 1 to/));
};
```

## Why I built this

I built talkies while finishing a take-home assignment, [ACME Salary Manager](https://github.com/HashirAKB/salary-management), which had to ship with a 3–5 minute demo video. I had already been driving the app through the Playwright MCP from Claude Code for manual testing. Recording a polished video by hand meant many retakes, awkward pauses while pages loaded, a voiceover recorded separately, and an editing pass to stitch it all together. Doing it again after every UI change wasn't realistic.

So I treated the video like the rest of the project: **as code, reproducible, and checkable by a machine.** A take became a pipeline: scene scripts, a narration line per scene, and a deterministic set of ffmpeg steps. Change a label and the take is re-recorded. Reword a line and only that line is re-voiced.

Along the way I hit a few problems that look small but break a video. Solving them shaped the design:

| Problem I hit | What talkies does |
|---|---|
| Playwright teleports the mouse, so viewers can't follow the clicks | An injected overlay draws a cursor that **glides** to each target and leaves a **ripple** on each click |
| ffmpeg's `freezedetect` classed a whole login-typing sequence as "frozen" (it averages the difference over the whole frame) | Dead air is detected with **`mpdecimate`** (8x8 blocks, so one typed character counts as motion), plus **declared waits** via `demo.skip()` for spinners, which move but are boring |
| Hand-tuned `waitForTimeout`s to make video match the voice | **The video fits the voice**: each scene lasts as long as its line needs, holding the last frame if necessary. Sync is exact by construction, and speech is never sped up or cut |
| Gemini TTS sometimes **reads the style directions aloud** ("Calm, friendly. This is ACME…") | **`--verify`** transcribes each new line back with a second model, flags style words it hears, and evicts the bad take from the cache |
| An AI agent can't watch the video it made | **`review`** writes a per-scene timing table and a contact sheet (first and last frame of every scene) that an agent can read like a storyboard |
| Re-voicing everything after a one-word edit costs money | Narration is **cached by content hash** across all workspaces |

There is more detail in [docs/how-it-works.md](docs/how-it-works.md).

## Quick start

**Prerequisites:** Node.js 22+, ffmpeg, and Google Chrome or Chromium. `talkies check --fix` installs everything else it needs.

```sh
# 1. Install the CLI (no npm publish yet; it installs straight from GitHub)
npm i -g github:HashirAKB/talkies        # or prefix any command with: npx -y github:HashirAKB/talkies

# 2. Try the example: a public TodoMVC app, no API key needed when silent
git clone https://github.com/HashirAKB/talkies && cd talkies && npm ci
talkies check --dir examples/todomvc --no-voice --fix
talkies take  --dir examples/todomvc --no-voice
open examples/todomvc/out/final.mp4     # xdg-open on Linux

# 3. With narration: put GEMINI_API_KEY in your environment, then
talkies take --dir examples/todomvc --verify
```

## Make a video of your app

```sh
talkies init  --dir ../my-app-demo --base-url http://localhost:5173 --env-file ../my-app/.env
talkies check --dir ../my-app-demo --fix
```

`talkies.json` is the whole project file:

```jsonc
{
  "baseUrl": "http://localhost:5173",
  "envFile": "../my-app/.env",            // API keys + scene secrets; never copied, never printed
  "browserChannel": "chrome",             // or "chromium"
  "viewport": { "width": 1280, "height": 720 },
  "voice": { "provider": "gemini", "voice": "Kore" },  // optional: model, style
  "scenes": [
    { "id": "login",  "file": "scenes/01-login.js",  "narration": "Let's sign in as the HR admin." },
    { "id": "filter", "file": "scenes/02-filter.js", "narration": "Filter by country and level, and the count updates straight away." }
  ]
}
```

Write each scene with the [scene API](skills/talkies/references/scene-api.md), building up one at a time:

```sh
talkies record --dir ../my-app-demo --until login --headed   # watch it, fix selectors, repeat
talkies take   --dir ../my-app-demo --verify                 # → out/final.mp4 + out/sheet.png
```

Passwords come from `env.secret('DEMO_ADMIN_PASSWORD')` and never appear in scene files. Keep the workspace **outside** your app's repo, or git-ignore `out/` and `audio/` (`init` does that for you).

### Commands

| Command | Does |
|---|---|
| `init` | Creates a workspace: `talkies.json`, a placeholder scene, `.gitignore` |
| `check [--fix] [--no-voice]` | Preflight: node, ffmpeg, browser, Playwright's ffmpeg build, TTS key, every `env.secret` your scenes use, and whether the app is reachable |
| `voice [--verify]` | Narration → `audio/<scene>.wav`, cached (alias: `tts`) |
| `record [--until id] [--headed]` | Replays the scenes → `out/raw.webm`, `out/markers.json`. On failure it writes `out/error.png` |
| `cut [--no-voice]` | Removes dead air and fits each scene to its narration → `out/clips/` |
| `assemble` | Joins the clips and fades → `out/final.mp4` (H.264, AAC, faststart) |
| `review` | Timing table + `out/sheet.png` contact sheet |
| `take` | `voice → record → cut → assemble → review` |
| `install-skill [--to dir]` | Installs the AI-agent skill (below) |

Pacing tunables (`CUT_KEEP`, `CUT_MIN_FREEZE`, `NARRATION_LEAD`, `NARRATION_TAIL`, `FADE`) and the known errors are listed in [troubleshooting](skills/talkies/references/troubleshooting.md).

## Use it from your AI coding agent

talkies was designed to be driven by an agent. With the skill installed, you can say *"make a 2-minute demo video of the app: log in, show the dashboard filters, then the export"* and the agent will:

- set up the workspace;
- agree the script with you;
- explore the UI for selectors (without putting your passwords into tool calls);
- write and debug the scenes;
- take the video;
- check the contact sheet before handing it to you.

**Claude Code**

```sh
talkies install-skill                  # → ~/.claude/skills/talkies (all projects)
talkies install-skill --to .claude/skills/talkies   # or just this project
```

Start a new session, then ask for a demo video or type `/talkies`. The skill tells Claude when to use the Playwright MCP, how to handle pages behind a login, and what to check in the review.

**Cursor, Codex, Copilot, Gemini CLI, Windsurf, Aider and others**

The skill is plain Markdown. Point your agent at [`skills/talkies/SKILL.md`](skills/talkies/SKILL.md): add it to your rules file (`.cursor/rules`, `AGENTS.md`, `GEMINI.md`, `.github/copilot-instructions.md`), or paste *"Follow https://github.com/HashirAKB/talkies/blob/main/skills/talkies/SKILL.md"* into the chat. [`AGENTS.md`](AGENTS.md) in this repo has the short version.

## Voice providers

| Provider | Status | Key |
|---|---|---|
| `gemini` | ✅ Stable, tested end to end | `GEMINI_API_KEY` |
| `openai` (`gpt-4o-mini-tts`) | 🧪 Experimental | `OPENAI_API_KEY` |
| `elevenlabs` | 🧪 Experimental | `ELEVENLABS_API_KEY` |

> **Experimental** means the provider was written against its public API reference and passes the unit tests, but no maintainer has run it end to end yet. I built and tested talkies with Gemini, the key I had. If you try OpenAI or ElevenLabs, please [open an issue](https://github.com/HashirAKB/talkies/issues) saying whether it worked or failed. Adding a provider is one small file: see [docs/providers.md](docs/providers.md).

## Limitations

- **Chromium only.** Playwright's video recorder works best there, and a demo needs only one browser.
- **A retake re-records every scene.** Scenes share one browser session (login, state), so you can't re-record one in isolation. Recording is free and audio is cached, so this is cheap in practice.
- **Scenes perform real actions.** Reset your app's data before a take, just as you would before a live demo.
- **Video quality.** Playwright's recorder uses a fixed VP8 bitrate. That's fine for app UIs at 720p, but it isn't screen-capture quality for heavy motion.

## Contributing

Issues and PRs are welcome, especially provider reports. `npm test` runs the unit tests (`node:test`, no network). CI also runs a real silent take of the TodoMVC example. [AGENTS.md](AGENTS.md) covers the code layout and conventions.

## License

[MIT](LICENSE) © HashirAKB
