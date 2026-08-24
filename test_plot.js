// node test_plot.js
'use strict';
const assert = require('assert');
const { niceTicks, tickLabel } = require('./plot.js');

{
  const { step, ticks } = niceTicks(0, 10, 5);
  assert.strictEqual(step, 2);
  assert.deepStrictEqual(ticks, [0, 2, 4, 6, 8, 10]);
}
{
  const { step, ticks } = niceTicks(-0.3, 0.3, 6);
  assert.strictEqual(step, 0.1);
  assert.ok(ticks.length >= 6 && ticks.length <= 8, `got ${ticks.length}`);
  assert.ok(ticks.some((v) => v === 0), 'zero tick is exactly 0, not -1e-17');
}
{
  // no phantom tick beyond the range
  const { ticks } = niceTicks(0, 1, 10);
  assert.ok(Math.max(...ticks) <= 1 + 1e-9);
}
{
  // degenerate range must not hang or throw
  const r = niceTicks(5, 5, 5);
  assert.deepStrictEqual(r.ticks, [5]);
}
assert.strictEqual(tickLabel(2, 2), '2');
assert.strictEqual(tickLabel(0.5, 0.1), '0.5');

console.log('test_plot.js: OK');

// --- axis ranges -------------------------------------------------------------
const { plotRanges } = require('./plot.js');
{
  // t/T on x (0..1) against degrees on y (-60..80): each axis must fit its own data,
  // otherwise x gets stretched to hundreds of units and the curve collapses to a line
  const pts = [{ x: 0, y: -60 }, { x: 0.5, y: 20 }, { x: 1, y: 80 }];
  const r = plotRanges(pts, 1070, 774, false);
  assert.ok(r.xLo < 0 && r.xHi > 1, `x range must cover the data: ${r.xLo}..${r.xHi}`);
  assert.ok(r.xHi - r.xLo < 1.5, `x range must stay close to the data span, got ${r.xHi - r.xLo}`);
  assert.ok(r.yHi - r.yLo < 200, `y range must stay close to the data span, got ${r.yHi - r.yLo}`);
  assert.ok(r.scaleX !== r.scaleY, 'independent axes by default');
}
{
  // equal aspect keeps one unit the same size on both axes
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 1 }];
  const r = plotRanges(pts, 1070, 774, true);
  assert.strictEqual(r.scaleX, r.scaleY);
  assert.ok(r.yHi - r.yLo > 5, 'the short axis is widened, not the data squashed');
}
{
  // a single point must still produce a finite, non-degenerate range
  const r = plotRanges([{ x: 3, y: -2 }], 1070, 774, false);
  assert.ok(isFinite(r.xLo) && isFinite(r.xHi) && r.xHi > r.xLo);
  assert.ok(isFinite(r.yLo) && isFinite(r.yHi) && r.yHi > r.yLo);
}
{
  // no points at all: must not throw or return NaN
  const r = plotRanges([], 1070, 774, false);
  assert.ok(isFinite(r.scaleX) && isFinite(r.scaleY));
}
console.log('test_plot.js: axis ranges OK');

// --- marker outline ----------------------------------------------------------
const { markerEdgeWidth } = require('./plot.js');
{
  // the outline must scale with the marker, and stay a small fraction of it
  const r2 = markerEdgeWidth(2);   // the default diameter of 4
  const r10 = markerEdgeWidth(10);
  assert.ok(r2 < r10, 'thicker outline for bigger markers');
  assert.ok(r2 < 2 * 0.5, `outline must not dominate a small marker, got ${r2}`);
  assert.ok(r10 <= 3, `outline is capped, got ${r10}`);
  assert.ok(markerEdgeWidth(0.5) >= 0.4, 'outline stays visible on a tiny marker');
  // monotonic in between
  for (let r = 1; r < 12; r++) assert.ok(markerEdgeWidth(r + 1) >= markerEdgeWidth(r));
}
console.log('test_plot.js: marker outline OK');
