// node tests/test_calib.js
'use strict';
const assert = require('assert');
const { computeTransform, calibMissing, axisPair, pixelToReal, realToPixel } = require('../calib.js');

// Real-world Y axis pointing up: image y grows downward, so scaleY must be negative.
{
  const { transform, warnings } = computeTransform(
    [{ x: 100, y: 400 }, { x: 300, y: 200 }],
    [{ x: 0, y: 0 }, { x: 10, y: 10 }],
  );
  assert.strictEqual(warnings.length, 0);
  assert.strictEqual(transform.scaleX, 10 / 200);
  assert.strictEqual(transform.scaleY, 10 / -200);

  const r = pixelToReal(transform, 200, 300);
  assert.ok(Math.abs(r.x - 5) < 1e-12, `x=${r.x}`);
  assert.ok(Math.abs(r.y - 5) < 1e-12, `y=${r.y}`);

  // round trip
  const p = realToPixel(transform, r.x, r.y);
  assert.ok(Math.abs(p.x - 200) < 1e-9 && Math.abs(p.y - 300) < 1e-9);
}

// Degenerate calibration: identical x -> warning and scaleX = 1
{
  const { transform, warnings } = computeTransform(
    [{ x: 50, y: 10 }, { x: 50, y: 110 }],
    [{ x: 0, y: 0 }, { x: 0, y: 5 }],
  );
  assert.ok(warnings.length >= 1);
  assert.strictEqual(transform.scaleX, 1);
  assert.strictEqual(transform.scaleY, 5 / 100);
}

// Three points: origin, a point on the x axis, a point on the y axis
{
  const img = [{ x: 100, y: 400 }, { x: 300, y: 401 }, { x: 99, y: 200 }];
  const real = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
  const { transform, warnings } = computeTransform(img, real);
  assert.strictEqual(warnings.length, 0);
  // x from the origin / x-axis pair, y from the origin / y-axis pair
  assert.ok(Math.abs(transform.scaleX - 10 / 200) < 1e-12, `scaleX=${transform.scaleX}`);
  assert.ok(Math.abs(transform.scaleY - 10 / -200) < 1e-12, `scaleY=${transform.scaleY}`);
  // every calibration point maps back onto the value typed for it on the axis it fixes
  const o = pixelToReal(transform, 100, 400);
  assert.ok(Math.abs(o.x) < 1e-12 && Math.abs(o.y) < 1e-12, `origin=${o.x},${o.y}`);
  assert.ok(Math.abs(pixelToReal(transform, 300, 401).x - 10) < 1e-12);
  assert.ok(Math.abs(pixelToReal(transform, 99, 200).y - 10) < 1e-12);
}

// Two points that differ in both x and y: the original two-point formula, p0 = point 1
{
  const { transform } = computeTransform(
    [{ x: 100, y: 400 }, { x: 300, y: 200 }],
    [{ x: 0, y: 0 }, { x: 10, y: 10 }],
  );
  assert.deepStrictEqual(transform.p0, { x: 100, y: 400 });
  assert.deepStrictEqual(transform.r0, { x: 0, y: 0 });
}

// Which axes still need a point
{
  assert.deepStrictEqual(calibMissing([{ x: 0, y: 0 }]), { x: true, y: true });
  assert.deepStrictEqual(calibMissing([{ x: 0, y: 0 }, { x: 10, y: 10 }]), { x: false, y: false });
  assert.deepStrictEqual(calibMissing([{ x: 0, y: 0 }, { x: 10, y: 0 }]), { x: false, y: true });
  assert.deepStrictEqual(calibMissing([{ x: 0, y: 0 }, { x: 0, y: 5 }]), { x: true, y: false });
  assert.deepStrictEqual(calibMissing([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]), { x: false, y: false });
}

// Each axis is fixed by the first pair in click order whose values differ
{
  const real = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
  assert.deepStrictEqual(axisPair(real, 'x'), [0, 1]);
  assert.deepStrictEqual(axisPair(real, 'y'), [0, 2]);
}

// No calibration -> NaN
{
  const r = pixelToReal(null, 1, 2);
  assert.ok(Number.isNaN(r.x) && Number.isNaN(r.y));
}

console.log('test_calib.js: OK');
