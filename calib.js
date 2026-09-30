// Calibration: two-point, per-axis linear mapping (no rotation).
// Ported from references/clickapp_tkcv-main/click_app/click_gui.py :: compute_transform
//
//   X = r0.x + (x - p0.x) * scaleX      scaleX = (r1.x - r0.x) / (p1.x - p0.x)
//   Y = r0.y + (y - p0.y) * scaleY      scaleY = (r1.y - r0.y) / (p1.y - p0.y)
//
// scaleY is normally negative when the real-world Y axis points up, because image
// Y grows downward. That falls out of the formula and needs no special casing.

'use strict';

/**
 * @typedef {{x: number, y: number}} Pt
 * @typedef {{p0: Pt, r0: Pt, scaleX: number, scaleY: number}} Transform
 */

/**
 * Build the image->real transform from two calibration point pairs.
 * @param {[Pt, Pt]} imgPts image coordinates of the two clicked points
 * @param {[Pt, Pt]} realPts real-world coordinates entered for those points
 * @returns {{transform: Transform, warnings: string[]}} warnings are UI message keys
 *   (translated by app.js through STRINGS), so this stays independent of the UI language
 */
function computeTransform(imgPts, realPts) {
  const [p0, p1] = imgPts;
  const [r0, r1] = realPts;
  const warnings = [];

  const dxImg = p1.x - p0.x;
  const dyImg = p1.y - p0.y;

  let scaleX = 1;
  let scaleY = 1;
  if (dxImg === 0) {
    warnings.push('calib.sameImgX');
  } else {
    scaleX = (r1.x - r0.x) / dxImg;
  }
  if (dyImg === 0) {
    warnings.push('calib.sameImgY');
  } else {
    scaleY = (r1.y - r0.y) / dyImg;
  }
  if (scaleX === 0) warnings.push('calib.zeroScaleX');
  if (scaleY === 0) warnings.push('calib.zeroScaleY');

  return {
    transform: { p0: { x: p0.x, y: p0.y }, r0: { x: r0.x, y: r0.y }, scaleX, scaleY },
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
  module.exports = { computeTransform, pixelToReal, realToPixel };
}
