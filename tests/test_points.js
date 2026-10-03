// node tests/test_points.js
'use strict';
const assert = require('assert');
const { nearestIndex, addPoint, deleteNearest, totalPoints } = require('../points.js');

const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

assert.strictEqual(nearestIndex(pts, 9, 1), 1);
assert.strictEqual(nearestIndex(pts, -5, -5), 0);
assert.strictEqual(nearestIndex([], 0, 0), -1);

// addPoint does not mutate
const added = addPoint(pts, { x: 1, y: 2 });
assert.strictEqual(pts.length, 3);
assert.strictEqual(added.length, 4);
assert.deepStrictEqual(added[3], { x: 1, y: 2 });

// deleteNearest removes exactly one and keeps order
const res = deleteNearest(pts, 11, 9);
assert.strictEqual(res.removedIndex, 2);
assert.deepStrictEqual(res.points, [{ x: 0, y: 0 }, { x: 10, y: 0 }]);
assert.strictEqual(pts.length, 3);

// deleting from an empty frame is a no-op
const empty = deleteNearest([], 0, 0);
assert.strictEqual(empty.removedIndex, -1);
assert.strictEqual(empty.removed, null);

assert.strictEqual(totalPoints([[], pts, [{ x: 1, y: 1 }]]), 4);

console.log('test_points.js: OK');
