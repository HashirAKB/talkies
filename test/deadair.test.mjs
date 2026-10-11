import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staticIntervals, mergeIntervals, keepSegments, totalLength } from '../src/media/deadair.mjs';

test('staticIntervals: gaps of at least minFreeze between changing frames are dead air', () => {
  const changing = [0, 0.04, 0.08, 2.0, 2.04, 5.0];
  assert.deepEqual(staticIntervals(changing, 6, 0.8), [[0.08, 2.0], [2.04, 5.0], [5.0, 6]]);
});

test('staticIntervals: short stills are left alone', () => {
  assert.deepEqual(staticIntervals([0, 0.5, 1.0], 1.5, 0.8), []);
});

test('mergeIntervals: overlapping and touching intervals merge, order does not matter', () => {
  assert.deepEqual(mergeIntervals([[5, 6], [1, 3], [2, 4], [4, 4.5]]), [[1, 4.5], [5, 6]]);
});

test('keepSegments: each dead stretch keeps its first `keep` seconds', () => {
  // window 0–10, dead 2–6 → keep 0–2.4, then 6–10
  assert.deepEqual(keepSegments(0, 10, [[2, 6]], 0.4), [[0, 2.4], [6, 10]]);
});

test('keepSegments: dead air shorter than `keep` is not cut', () => {
  assert.deepEqual(keepSegments(0, 10, [[2, 2.3]], 0.4), [[0, 10]]);
});

test('keepSegments: dead air is clipped to the window', () => {
  // dead 8–20 overlaps the end of window 5–12 → keep 5–8.4 only
  assert.deepEqual(keepSegments(5, 12, [[8, 20]], 0.4), [[5, 8.4]]);
});

test('keepSegments: a window that starts inside dead air keeps its first moment', () => {
  assert.deepEqual(keepSegments(3, 10, [[0, 6]], 0.4), [[3, 3.4], [6, 10]]);
});

test('keepSegments: slivers shorter than a frame are dropped', () => {
  assert.deepEqual(keepSegments(0, 6.02, [[2, 6]], 0.4), [[0, 2.4]]);
});

test('totalLength sums interval lengths', () => {
  assert.equal(totalLength([[0, 2.4], [6, 10]]), 6.4);
});
