// Pure interval maths behind dead-air removal. Times are seconds on the raw recording's timeline.

/** @typedef {[number, number]} Interval */

/**
 * Static stretches from the timestamps of frames that differ from their predecessor
 * (mpdecimate's survivors). A gap of at least `minFreeze` between two changing frames is dead air.
 * @param {number[]} changing  ascending timestamps
 * @param {number} total       recording length (the tail after the last change can be dead too)
 * @param {number} minFreeze
 * @returns {Interval[]}
 */
export function staticIntervals(changing, total, minFreeze) {
  const points = [...changing, total];
  const out = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i] - points[i - 1] >= minFreeze) out.push([points[i - 1], points[i]]);
  }
  return out;
}

/** Sort and merge overlapping or touching intervals. @param {Interval[]} intervals @returns {Interval[]} */
export function mergeIntervals(intervals) {
  const out = [];
  for (const [s, e] of [...intervals].sort((a, b) => a[0] - b[0])) {
    const last = out.at(-1);
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/**
 * The parts of window [a, b] to keep: everything except dead stretches, each of which keeps
 * its first `keep` seconds so a cut never looks like a jump.
 * @param {number} a  @param {number} b  @param {Interval[]} dead  merged, ascending  @param {number} keep
 * @returns {Interval[]}
 */
export function keepSegments(a, b, dead, keep) {
  const segments = [];
  let cursor = a;
  for (const [ds, de] of dead) {
    const s = Math.max(ds, a);
    const e = Math.min(de, b);
    if (e - s <= keep) continue;
    if (s + keep > cursor) segments.push([cursor, s + keep]);
    cursor = Math.max(cursor, e);
  }
  if (b - cursor > 0.04) segments.push([cursor, b]); // drop slivers shorter than a frame
  return segments;
}

/** Total length of a list of intervals. @param {Interval[]} intervals */
export const totalLength = (intervals) => intervals.reduce((t, [s, e]) => t + (e - s), 0);
