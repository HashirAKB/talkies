// Pacing tunables. Environment variables, because they are per-take experiments, not project config.
const num = (name, fallback) => {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export const settings = () => ({
  /** Seconds of each dead stretch that survive the cut. */
  keep: num('CUT_KEEP', 0.4),
  /** Still stretches shorter than this are left alone. */
  minFreeze: num('CUT_MIN_FREEZE', 0.8),
  /** Silence before each narration line, within its scene. */
  lead: num('NARRATION_LEAD', 0.4),
  /** Silence after each narration line, within its scene. */
  tail: num('NARRATION_TAIL', 0.6),
  /** Fade in and out on the final video. */
  fade: num('FADE', 0.5),
  fps: 30,
});
