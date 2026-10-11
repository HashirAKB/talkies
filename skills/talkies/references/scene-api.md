# Scene API

A scene is an ES module in `<workspace>/scenes/` that default-exports one async function:

```js
export default async ({ page, demo, env }) => {
  // …
};
```

- **`page`** is a Playwright [`Page`](https://playwright.dev/docs/api/class-page) (playwright-core 1.64). All of Playwright works. Prefer role, label and text locators: they survive styling changes, and they read like the narration.
- **`demo`** holds the helpers below. They make actions look human on camera.
- **`env.baseUrl`** comes from `talkies.json` and can be overridden with `BASE_URL`.
- **`env.secret(name)`** returns an environment variable, including those loaded from the workspace `envFile`, and throws a clear error when it is missing. Use it for every password and token. Never hard-code a secret into a scene or into `talkies.json`, because both are meant to be committed and shared. `talkies check` verifies every `env.secret('…')` it finds in your scenes.

## `demo` helpers

| Helper | What the viewer sees | Notes |
|---|---|---|
| `demo.click(locator)` | The cursor glides to the target, settles for about 180 ms, clicks, and a ripple appears | Uses `locator.click()`, so Playwright's actionability waits apply |
| `demo.click(locator, { raw: true })` | Same | Presses the real mouse at the cursor's position. Use it when Playwright reports "*element* intercepts pointer events", which is common with styled selects (Mantine, MUI, Headless UI) where a wrapper covers the input |
| `demo.type(locator, text, { delay })` | A click, then the text typed one character at a time (55 ms each by default) | Clears the field first. Use `delay: 25` for long values and secrets |
| `demo.choose(label, ...options)` | Opens a select by its accessible name and clicks each option | Finds `getByRole('combobox', { name: label, exact: true })` and clicks it with `raw`. Other widget shapes need their clicks written by hand |
| `demo.point(locator, ms = 900)` | The cursor glides to something and rests on it | Use it wherever the narration says "here you can see…". Scrolls into view first |
| `demo.pause(ms = 600)` | A beat | Kept only if something on screen moves. Still stretches over 0.8 s get squeezed anyway |
| `demo.skip(async () => …)` | Nothing: the span is cut from the video | Wrap waits nobody wants to watch, such as login spinners, slow requests and page loads. Returns the callback's value |
| `demo.snapshot(name)` | Wasted recording time, so remove it before the final take | An authoring aid. Writes `out/snapshots/<name>.yml` (the accessibility tree, with role and label names) and `<name>.png`, so you can find selectors on pages behind a login |
| `demo.glide(x, y)`, `demo.moveTo(locator)` | Cursor movement only | Low-level |

## Patterns

**Log in once, early.** Scenes share one browser session, so a login scene at the start keeps you logged in for every later scene.

```js
export default async ({ page, demo, env }) => {
  await page.goto(`${env.baseUrl}/login`);
  await demo.pause(800);
  await demo.type(page.getByLabel('Email'), 'admin@example.test');
  await demo.type(page.getByRole('textbox', { name: 'Password' }), env.secret('DEMO_ADMIN_PASSWORD'), { delay: 25 });
  await demo.click(page.getByRole('button', { name: 'Log in' }));
  // Wait for loaded content, not just the URL: many apps show skeleton rows after the redirect.
  await demo.skip(() => page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 60_000 }));
  await demo.point(page.getByText('Admin (demo)'));
};
```

**End each scene on what its narration is about.** The cut step holds a scene's last frame until the narration finishes, so finish with `demo.point(...)` on the thing being described. If the narration mentions something below the fold, point at it, since `point` scrolls it into view.

**Wait for the result, not a timer.** Use `await page.getByText(/Showing 1 to/).waitFor()`, not `waitForTimeout(2000)`, not `waitForURL` alone and not `waitForLoadState('networkidle')`. On most single-page apps the last two return before the client-side data arrives. Wrap slow waits in `demo.skip`.

**Password inputs with a reveal toggle** often match `getByLabel('Password')` twice: once for the input and once for the toggle button. Use `getByRole('textbox', { name: 'Password' })`.

**Reset data before a take.** A take changes the app's state (it records a raise, adds a todo), so reset the app with its seed or reset command before each full take. Retakes then look identical.

**Build one scene at a time.** `talkies record --until <scene-id>` runs from the first scene through the one named. Add `--headed` to watch the browser.
