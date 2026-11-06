import test from 'node:test';
import assert from 'node:assert/strict';
import { damp, dampAngle, radialStick, throwPower, findPath, segmentClear } from '../mechanics.js';

test('a resting thumb has a dead zone and diagonal movement stays normalized', () => {
  assert.deepEqual(radialStick(.04, -.05), { x: 0, y: 0 });
  const diagonal = radialStick(1, 1);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
  assert.ok(Math.hypot(...Object.values(radialStick(.5, 0))) < .5);
});
test('camera and motion smoothing do not depend on refresh rate', () => {
  let slow = 0, fast = 0;
  for (let i = 0; i < 30; i++) slow = damp(slow, 1, 12, 1 / 30);
  for (let i = 0; i < 120; i++) fast = damp(fast, 1, 12, 1 / 120);
  assert.ok(Math.abs(slow - fast) < 1e-10);
  const turn = dampAngle(Math.PI - .05, -Math.PI + .05, 10, .1);
  assert.ok(turn > Math.PI - .05 && turn < Math.PI + .05);
});
test('a tap is a gentle throw and holding reaches a bounded stronger throw', () => {
  assert.ok(throwPower(0) > 0);
  assert.ok(throwPower(.6) > throwPower(.05) * 1.7);
  assert.equal(throwPower(2), throwPower(20));
  assert.equal(throwPower(-1), throwPower(0));
});
test('granny walks around furniture instead of cutting through its corners', () => {
  const blocks = [{ x: 0, z: 0, w: 1.2, d: 1.2 }];
  const start = [-3, 0], end = [3, 0];
  const path = findPath(start, end, blocks);
  assert.ok(path.length > 2);
  assert.ok(!segmentClear(start, end, blocks));
  for (let i = 1; i < path.length; i++) assert.ok(segmentClear(path[i - 1], path[i], blocks), JSON.stringify(path));
  assert.ok(Math.hypot(path.at(-1)[0] - end[0], path.at(-1)[1] - end[1]) < .4);
});
test('a sound from inside a table leads granny to its edge', () => {
  const blocks = [{ x: 0, z: 0, w: 1, d: 1 }];
  const path = findPath([-3, 0], [0, 0], blocks);
  assert.ok(path.length);
  const last = path.at(-1);
  assert.ok(Math.abs(last[0]) >= 1.3 || Math.abs(last[1]) >= 1.3);
  for (let i = 1; i < path.length; i++) assert.ok(segmentClear(path[i - 1], path[i], blocks));
});
test('unreachable areas terminate without inventing a path through a wall', () => {
  const wall = [{ x: 0, z: 0, w: .25, d: 6 }];
  assert.deepEqual(findPath([-3, 0], [3, 0], wall), []);
});
