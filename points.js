// Pure helpers for the per-frame point list. All functions return new arrays;
// nothing here mutates its input.

'use strict';

/**
 * @typedef {{x: number, y: number}} Pt
 */

/**
 * Index of the point closest to (x, y) in image coordinates.
 * @param {Pt[]} pts
 * @param {number} x
 * @param {number} y
 * @returns {number} -1 when the list is empty
 */
function nearestIndex(pts, x, y) {
  let best = -1;
  let bestD2 = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i].x - x;
    const dy = pts[i].y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}

/**
 * Append a point.
 * @param {Pt[]} pts
 * @param {Pt} pt
 * @returns {Pt[]}
 */
function addPoint(pts, pt) {
  return pts.concat([{ x: pt.x, y: pt.y }]);
}

/**
 * Remove the point closest to (x, y).
 * @param {Pt[]} pts
 * @param {number} x
 * @param {number} y
 * @returns {{points: Pt[], removedIndex: number, removed: Pt|null}}
 */
function deleteNearest(pts, x, y) {
  const idx = nearestIndex(pts, x, y);
  if (idx < 0) return { points: pts, removedIndex: -1, removed: null };
  const points = pts.slice(0, idx).concat(pts.slice(idx + 1));
  return { points, removedIndex: idx, removed: pts[idx] };
}

/**
 * Total number of points across all frames.
 * @param {Pt[][]} frames
 * @returns {number}
 */
function totalPoints(frames) {
  return frames.reduce((n, pts) => n + pts.length, 0);
}

if (typeof module !== 'undefined') {
  module.exports = { nearestIndex, addPoint, deleteNearest, totalPoints };
}
