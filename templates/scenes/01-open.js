// One scene = one narration line. Scenes share a browser session: this one's end is the next one's start.
// Helpers: https://github.com/HashirAKB/talkies/blob/main/docs/scene-api.md
export default async ({ page, demo, env }) => {
  await page.goto(env.baseUrl);
  await demo.pause(800);
  await demo.point(page.locator('h1, h2').first());
};
