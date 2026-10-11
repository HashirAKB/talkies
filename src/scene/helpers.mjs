// The `demo` object scenes receive: human-paced mouse and keyboard so the overlay cursor
// glides instead of teleporting, plus markers that tell the cut step what to drop.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param {import('playwright-core').Page} page
 * @param {() => number} clock  seconds since the recording started
 * @param {string} outDir       workspace out/ folder (for snapshots)
 */
export function createDemo(page, clock, outDir) {
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  let pos = { x: viewport.width / 2, y: viewport.height / 2 };
  /** @type {[number, number][]} */
  const skips = [];

  /** Glide the real mouse to (x, y); step count scales with distance so speed looks constant. */
  async function glide(x, y) {
    const distance = Math.hypot(x - pos.x, y - pos.y);
    const steps = Math.max(8, Math.min(40, Math.round(distance / 15)));
    await page.mouse.move(x, y, { steps });
    pos = { x, y };
  }

  /**
   * Scroll a locator into view and glide to its centre. Frameworks often swap the DOM node right
   * after a click (re-render on filter, route change), so a detached element is retried, not fatal.
   */
  async function moveTo(locator) {
    for (let attempt = 1; ; attempt++) {
      try {
        await locator.scrollIntoViewIfNeeded();
        const box = await locator.boundingBox();
        if (!box) throw new Error(`moveTo: ${locator} is not visible`);
        return glide(box.x + box.width / 2, box.y + box.height / 2);
      } catch (err) {
        if (attempt >= 3 || !/not attached|detached/i.test(err.message)) throw err;
        await page.waitForTimeout(100);
      }
    }
  }

  return {
    /** Spans recorded by skip(); the recorder drains this after every scene. */
    skips,
    glide,
    moveTo,

    /** A deliberate beat. Kept only if something moves; long still stretches are squeezed anyway. */
    pause: (ms = 600) => page.waitForTimeout(ms),

    /**
     * Glide, settle, click; the ripple lands where the cursor is.
     * `raw: true` presses the real mouse at the cursor instead of locator.click(). Use it when a
     * wrapper covers the target (common in styled selects) and Playwright refuses to click.
     */
    async click(locator, { settle = 180, raw = false } = {}) {
      await moveTo(locator);
      await page.waitForTimeout(settle);
      if (raw) await page.mouse.click(pos.x, pos.y);
      else await locator.click();
    },

    /** Click a field, clear it, and type like a person. */
    async type(locator, text, { delay = 55 } = {}) {
      await this.click(locator);
      await locator.fill('');
      await locator.pressSequentially(text, { delay });
    },

    /** Open a select or multi-select by its accessible name and click options by visible text. */
    async choose(label, ...options) {
      await this.click(page.getByRole('combobox', { name: label, exact: true }), { raw: true });
      for (const option of options) {
        await this.click(page.getByRole('option', { name: option, exact: true }));
      }
      await page.keyboard.press('Escape');
    },

    /** Glide to something and rest on it, so the viewer's eye follows the narration. */
    async point(locator, ms = 900) {
      await moveTo(locator);
      await page.waitForTimeout(ms);
    },

    /**
     * Run a wait nobody should sit through (spinner, slow request). The span is cut from the
     * video however busy the screen is, keeping only its first moment. Returns fn's result.
     * @template T  @param {() => Promise<T>} fn  @returns {Promise<T>}
     */
    async skip(fn) {
      const start = clock();
      try {
        return await fn();
      } finally {
        skips.push([start, clock()]);
      }
    },

    /**
     * Authoring aid: save the accessibility tree (out/snapshots/<name>.yml) and a screenshot, to
     * find role and label names on pages behind a login. Remove it once the scene works.
     */
    async snapshot(name) {
      const dir = join(outDir, 'snapshots');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${name}.yml`), await page.locator('body').ariaSnapshot());
      await page.screenshot({ path: join(dir, `${name}.png`) });
    },
  };
}
