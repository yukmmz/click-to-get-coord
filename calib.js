// Calibration: two or three points, per-axis linear mapping (no rotation).
// Ported from references/clickapp_tkcv-main/click_app/click_gui.py :: compute_transform
//
//   X = r0.x + (x - p0.x) * scaleX      scaleX = (rb.x - ra.x) / (pb.x - pa.x)
//   Y = r0.y + (y - p0.y) * scaleY      scaleY = (rd.y - rc.y) / (pd.y - pc.y)
//
// Each axis is fixed by its own pair of points whose real-world values differ on that
// axis: (a, b) for x and (c, d) for y. With two points that differ in both x and y both
// pairs are the same two points and p0 / r0 is point 1, exactly as in the original.
// With three points (e.g. origin, a point on the x axis, a point on the y axis) the pairs
// differ, so p0 / r0 takes its x from pair a and its y from pair c.
//
// scaleY is normally negative when the real-world Y axis points up, because image
// Y grows downward. That falls out of the formula and needs no special casing.

'use strict';

/**
 * @typedef {{x: number, y: number}} Pt
 * @typedef {{p0: Pt, r0: Pt, scaleX: number, scaleY: number}} Transform
 */

/**
 * Which axes the entered real-world values still leave undetermined: an axis needs at
 * least two different values among the points.
 * @param {Pt[]} realPts
 * @returns {{x: boolean, y: boolean}} true = that axis still needs a point with a different value
 */
function calibMissing(realPts) {
  return {
    x: new Set(realPts.map((p) => p.x)).size < 2,
    y: new Set(realPts.map((p) => p.y)).size < 2,
  };
}

/**
 * The pair of points that fixes one axis: the first pair, in click order (1-2, 1-3, 2-3),
 * whose real-world values differ on that axis. Anchoring on point 1 keeps it exact: with
 * origin / x-axis point / y-axis point, the origin maps to (0, 0) on both axes.
 * Falls back to points 1 and 2 when no pair differs.
 * @param {Pt[]} realPts
 * @param {'x'|'y'} axis
 * @returns {[number, number]} zero-based indices
 */
function axisPair(realPts, axis) {
  for (let i = 0; i < realPts.length; i++) {
    for (let j = i + 1; j < realPts.length; j++) {
      if (realPts[i][axis] !== realPts[j][axis]) return [i, j];
    }
  }
  return [0, 1];
}

/**
 * Build the image->real transform from two or three calibration point pairs.
 * @param {Pt[]} imgPts image coordinates of the clicked points
 * @param {Pt[]} realPts real-world coordinates entered for those points
 * @returns {{transform: Transform, warnings: string[]}} warnings are UI message keys
 *   (translated by app.js through STRINGS), so this stays independent of the UI language
 */
function computeTransform(imgPts, realPts) {
  const [a, b] = axisPair(realPts, 'x');
  const [c, d] = axisPair(realPts, 'y');
  const warnings = [];

  const dxImg = imgPts[b].x - imgPts[a].x;
  const dyImg = imgPts[d].y - imgPts[c].y;

  let scaleX = 1;
  let scaleY = 1;
  if (dxImg === 0) {
    warnings.push('calib.sameImgX');
  } else {
    scaleX = (realPts[b].x - realPts[a].x) / dxImg;
  }
  if (dyImg === 0) {
    warnings.push('calib.sameImgY');
  } else {
    scaleY = (realPts[d].y - realPts[c].y) / dyImg;
  }
  if (scaleX === 0) warnings.push('calib.zeroScaleX');
  if (scaleY === 0) warnings.push('calib.zeroScaleY');

  return {
    transform: {
      p0: { x: imgPts[a].x, y: imgPts[c].y },
      r0: { x: realPts[a].x, y: realPts[c].y },
      scaleX,
      scaleY,
    },
    warnings,
  };
}

/**
 * Convert image (pixel) coordinates to real-world coordinates.
 * @param {Transform|null} tr
 * @param {number} x
 * @param {number} y
 * @returns {Pt} {NaN, NaN} when no calibration is available
 */
function pixelToReal(tr, x, y) {
  if (!tr) return { x: NaN, y: NaN };
  return {
    x: tr.r0.x + (x - tr.p0.x) * tr.scaleX,
    y: tr.r0.y + (y - tr.p0.y) * tr.scaleY,
  };
}

/**
 * Inverse of pixelToReal. Used to draw calibrated guides back onto the frame.
 * @param {Transform|null} tr
 * @param {number} X
 * @param {number} Y
 * @returns {Pt}
 */
function realToPixel(tr, X, Y) {
  if (!tr || tr.scaleX === 0 || tr.scaleY === 0) return { x: NaN, y: NaN };
  return {
    x: tr.p0.x + (X - tr.r0.x) / tr.scaleX,
    y: tr.p0.y + (Y - tr.r0.y) / tr.scaleY,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { computeTransform, calibMissing, axisPair, pixelToReal, realToPixel };
}
