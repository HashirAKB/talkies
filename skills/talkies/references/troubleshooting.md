# Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Executable doesn't exist at …/ms-playwright/ffmpeg-NNNN` | Playwright's own ffmpeg build (separate from the system ffmpeg) is missing for this playwright-core version | `talkies check --fix` |
| `Chromium distribution 'chrome' is not found` | Google Chrome is not installed | Install Chrome, or set `"browserChannel": "chromium"` and run `talkies check --fix` |
| `… intercepts pointer events` | A styled wrapper covers the real input | `demo.click(locator, { raw: true })`, or `demo.choose(...)` for selects |
| `strict mode violation: getByLabel('Password') resolved to 2 elements` | The input plus its "toggle visibility" button | `getByRole('textbox', { name: 'Password' })` |
| `Element is not attached to the DOM` | The framework re-rendered the element mid-action | `demo.*` helpers already retry this. In raw Playwright calls, re-query the locator after the action that triggers the re-render |
| The narration starts with extra words | The `style` text was read aloud (Gemini). Even a short bracketed tag leaks on some lines | Remove `style` (it is optional and off by default) or reword it. `talkies voice --verify` flags it and evicts the bad take from the cache |
| `--verify` prints `UNVERIFIED` | Three transcription attempts returned no text | Listen to that line yourself |
| A scene's last frame shows skeleton or placeholder rows | The scene waited for the URL or `networkidle`, not for the data | Wait for content that only exists once loaded, inside `demo.skip` |
| The last frame of the final scene looks dim | The 0.5 s fade-out | Expected. `review` samples just before the fade |
| A spinner stays in the video | Spinners count as motion | Wrap that wait in `demo.skip` |
| Typing or cursor movement gets cut | Unlikely: dead-air detection is block-based | Raise `CUT_MIN_FREEZE` (default 0.8) |
| `Gemini TTS 404 … no longer available` | The model was retired | Set `voice.model` in `talkies.json` or the `TTS_MODEL` variable. List the current models with `curl -H "x-goog-api-key: $GEMINI_API_KEY" https://generativelanguage.googleapis.com/v1beta/models \| grep tts` |
| Retakes change the app's data | Scenes perform real actions | Reset the app's data before each full take |
| `.playwright-mcp/` appears in your repo | Your agent explored the app with the Playwright MCP, which writes snapshots to the current directory | Delete it, or add it to `.gitignore` |

## Tunables (environment variables)

| Variable | Default | Effect |
|---|---|---|
| `CUT_KEEP` | `0.4` | Seconds of each dead stretch that survive |
| `CUT_MIN_FREEZE` | `0.8` | Still stretches shorter than this are left alone |
| `NARRATION_LEAD` / `NARRATION_TAIL` | `0.4` / `0.6` | Silence before and after each line, within its scene |
| `FADE` | `0.5` | Fade in and out on the final video |
| `TTS_MODEL` | provider default | Overrides `voice.model` |
| `VERIFY_MODEL` | `gemini-3.8-flash` | Transcription model used by `--verify` |
| `TALKIES_CACHE` | `~/.cache/talkies/tts` | Shared narration cache |
| `BASE_URL`, `BROWSER_CHANNEL` | from `talkies.json` | Per-run overrides |
