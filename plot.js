// Rendering of the two PNG artifacts:
//   - the calibrated plot (clicked points in real-world coordinates, connected)
//   - the overlay (the source frame itself with the clicked points drawn on it)
//
// niceTicks() is pure and unit-tested; the drawing functions need a canvas.

'use strict';

/**
 * @typedef {{x: number, y: number}} Pt
 */

/**
 * Human-friendly tick positions covering [min, max].
 * @param {number} min
 * @param {number} max
 * @param {number} target approximate number of ticks
 * @returns {{step: number, ticks: number[]}}
 */
function niceTicks(min, max, target) {
  if (!(isFinite(min) && isFinite(max)) || max <= min) return { step: 1, ticks: [min] };
  const raw = (max - min) / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const ticks = [];
  const first = Math.ceil(min / step) * step;
  // guard against float drift adding a phantom tick past max
  for (let v = first; v <= max + step * 1e-9; v += step) {
    ticks.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return { step, ticks };
}

/**
 * Format a tick label without trailing float noise.
 * @param {number} v
 * @param {number} step
 */
function tickLabel(v, step) {
  const decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(step)) + 1));
  let s = v.toFixed(decimals);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s === '-0' ? '0' : s;
}

/**
 * Data range and units-per-pixel for a plot box of pw x ph pixels.
 *
 * By default each axis is fitted to its own data range: x and y are usually different
 * quantities (t/T vs degrees, say), and forcing a common scale then stretches one axis
 * into uselessness. equalAspect restores the common scale for genuinely spatial data.
 *
 * @param {Pt[]} points finite real-world points
 * @param {number} pw plot box width in px
 * @param {number} ph plot box height in px
 * @param {boolean} [equalAspect]
 * @returns {{cx: number, cy: number, scaleX: number, scaleY: number,
 *            xLo: number, xHi: number, yLo: number, yHi: number}}
 */
function plotRanges(points, pw, ph, equalAspect) {
  let xMin = 0;
  let xMax = 1;
  let yMin = 0;
  let yMax = 1;
  if (points.length > 0) {
    xMin = Math.min(...points.map((p) => p.x));
    xMax = Math.max(...points.map((p) => p.x));
    yMin = Math.min(...points.map((p) => p.y));
    yMax = Math.max(...points.map((p) => p.y));
  }
  // pad each axis by a tenth of its own span so points never sit on the frame;
  // a degenerate span (single point, or a straight line) falls back to something sane
  const padX = (xMax - xMin) * 0.1 || Math.abs(xMax) * 0.1 || 1;
  const padY = (yMax - yMin) * 0.1 || Math.abs(yMax) * 0.1 || 1;
  xMin -= padX; xMax += padX; yMin -= padY; yMax += padY;

  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  let scaleX = pw / (xMax - xMin);
  let scaleY = ph / (yMax - yMin);
  if (equalAspect) scaleX = scaleY = Math.min(scaleX, scaleY);

  return {
    cx,
    cy,
    scaleX,
    scaleY,
    xLo: cx - pw / 2 / scaleX,
    xHi: cx + pw / 2 / scaleX,
    yLo: cy - ph / 2 / scaleY,
    yHi: cy + ph / 2 / scaleY,
  };
}

/**
 * Catmull-Rom through the points, emitted as cubic bezier segments.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Pt[]} pts screen coordinates
 */
function strokeSmooth(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
      p2.x, p2.y,
    );
  }
  ctx.stroke();
}

/**
 * Draw clicked points in the calibrated (real-world) coordinate system.
 * Y is drawn increasing upward, and the aspect ratio is kept 1:1 so shapes are not distorted.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Pt[]} points real-world coordinates, in click order
 * @param {{title?: string, xLabel?: string, yLabel?: string, smooth?: boolean,
 *          pointColor?: string, lineColor?: string, showIndex?: boolean,
 *          equalAspect?: boolean, indexColor?: string}} [opts]
 */
function drawCalibratedPlot(canvas, points, opts = {}) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const pointColor = opts.pointColor || '#d33';
  const lineColor = opts.lineColor || '#2f6feb';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  const m = { left: 90, right: 40, top: 56, bottom: 70 };
  const pw = W - m.left - m.right;
  const ph = H - m.top - m.bottom;

  const finite = points.filter((p) => isFinite(p.x) && isFinite(p.y));
  const { cx, cy, scaleX, scaleY, xLo, xHi, yLo, yHi } = plotRanges(finite, pw, ph, opts.equalAspect);
  const toPx = (x, y) => ({
    x: m.left + pw / 2 + (x - cx) * scaleX,
    y: m.top + ph / 2 - (y - cy) * scaleY,
  });

  // grid + ticks
  const tx = niceTicks(xLo, xHi, 8);
  const ty = niceTicks(yLo, yHi, 6);
  ctx.font = '15px system-ui, sans-serif';
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const v of tx.ticks) {
    const p = toPx(v, 0);
    ctx.beginPath(); ctx.moveTo(p.x, m.top); ctx.lineTo(p.x, m.top + ph); ctx.stroke();
    ctx.fillText(tickLabel(v, tx.step), p.x, m.top + ph + 8);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const v of ty.ticks) {
    const p = toPx(0, v);
    ctx.beginPath(); ctx.moveTo(m.left, p.y); ctx.lineTo(m.left + pw, p.y); ctx.stroke();
    ctx.fillText(tickLabel(v, ty.step), m.left - 10, p.y);
  }

  // frame
  ctx.strokeStyle = '#444';
  ctx.strokeRect(m.left, m.top, pw, ph);

  // axis labels
  ctx.fillStyle = '#222';
  ctx.font = '17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(opts.xLabel || 'x_real', m.left + pw / 2, H - 30);
  ctx.save();
  ctx.translate(24, m.top + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(opts.yLabel || 'y_real', 0, 0);
  ctx.restore();
  if (opts.title) {
    ctx.textAlign = 'left';
    ctx.fillText(opts.title, m.left, 20);
  }

  if (finite.length === 0) return;

  // connecting curve
  const screen = finite.map((p) => toPx(p.x, p.y));
  if (screen.length >= 2) {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    if (opts.smooth && screen.length >= 3) {
      strokeSmooth(ctx, screen);
    } else {
      ctx.beginPath();
      ctx.moveTo(screen[0].x, screen[0].y);
      for (let i = 1; i < screen.length; i++) ctx.lineTo(screen[i].x, screen[i].y);
      ctx.stroke();
    }
  }

  // markers + index labels
  const indexColor = opts.indexColor || pointColor;
  ctx.fillStyle = pointColor;
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  screen.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    if (opts.showIndex !== false) {
      ctx.fillStyle = indexColor;
      ctx.fillText(String(i), p.x + 7, p.y - 5);
      ctx.fillStyle = pointColor;
    }
  });
}

/**
 * Draw the source frame at its native resolution with the recorded points on top.
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasImageSource} frame
 * @param {number} width
 * @param {number} height
 * @param {Pt[]} points image coordinates
 * @param {Pt[]} calibPoints image coordinates
 * @param {{pointColor?: string, calibColor?: string, radius?: number, showIndex?: boolean}} [style]
 */
function drawOverlay(canvas, frame, width, height, points, calibPoints, style = {}) {
  canvas.width = width;
  canvas.height = height;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.drawImage(frame, 0, 0, width, height);
  drawMarkers(ctx, points, calibPoints, style, 1);
}

/**
 * Outline thickness for a marker of the given radius.
 *
 * It has to follow the marker size: a fixed width that looks right on a large marker
 * swallows a small one. Kept within sane bounds so the outline stays visible when tiny
 * and does not turn into a ring when huge.
 *
 * @param {number} radius marker radius in the same units as the returned width
 * @returns {number}
 */
function markerEdgeWidth(radius) {
  return Math.min(3, Math.max(0.4, radius * 0.35));
}

/**
 * Shared marker drawing, used both for the live canvas and the exported overlay.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Pt[]} points
 * @param {Pt[]} calibPoints
 * @param {{pointColor?: string, calibColor?: string, radius?: number, showIndex?: boolean,
 *          edge?: boolean, edgeColor?: string, indexColor?: string}} style
 * @param {number} scale display scale, so markers keep a constant on-screen size
 */
function drawMarkers(ctx, points, calibPoints, style, scale) {
  const radius = style.radius || 5;
  const r = radius / scale;
  const edge = style.edge !== false;
  // the width is computed in screen units first, then converted, so zooming does not
  // thicken the outline
  ctx.lineWidth = markerEdgeWidth(radius) / scale;
  ctx.strokeStyle = style.edgeColor || '#ffffff';

  ctx.fillStyle = style.calibColor || '#12b886';
  for (const p of calibPoints) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.2, 0, Math.PI * 2);
    ctx.fill();
    if (edge) ctx.stroke();
  }

  ctx.fillStyle = style.pointColor || '#e03131';
  points.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (edge) ctx.stroke();
    if (style.showIndex) {
      // defaults to the point colour: white would vanish on the light figures this is
      // usually used with
      ctx.fillStyle = style.indexColor || style.pointColor || '#e03131';
      ctx.font = `${Math.round(12 / scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(i), p.x + r + 2 / scale, p.y - r);
      ctx.fillStyle = style.pointColor || '#e03131';
    }
  });
}

if (typeof module !== 'undefined') {
  module.exports = { niceTicks, tickLabel, plotRanges, markerEdgeWidth };
}
