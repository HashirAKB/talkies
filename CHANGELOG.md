# Changelog

## 0.1.0 (2026-10-11)

First public release.

- `talkies` CLI: `init`, `check`, `voice`, `record`, `cut`, `assemble`, `review`, `take`, `install-skill`.
- Scene helpers with a gliding cursor overlay and click ripples; `demo.skip` for declared dead air; `demo.snapshot` for finding selectors behind a login.
- Dead-air removal with `mpdecimate`, plus declared waits; each scene is fitted to its narration by holding its last frame.
- Voice providers: Gemini (stable); OpenAI and ElevenLabs (experimental).
- `--verify` transcribes newly voiced lines and flags spoken style directions.
- Narration cache shared across workspaces.
- Agent skill for Claude Code (`skills/talkies`), usable by other agents via `AGENTS.md`.
