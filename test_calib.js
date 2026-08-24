// node test_calib.js
'use strict';
const assert = require('assert');
const { computeTransform, pixelToReal, realToPixel } = require('./calib.js');

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

// No calibration -> NaN
{
  const r = pixelToReal(null, 1, 2);
  assert.ok(Number.isNaN(r.x) && Number.isNaN(r.y));
}

console.log('test_calib.js: OK');
