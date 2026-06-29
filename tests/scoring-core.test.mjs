/**
 * Unit tests for the pure scoring core (src/scoring-core.js).
 * Run with:  npm test   (node --test tests/)
 *
 * The values below are the reference outputs the scorecard must keep producing — if a refactor
 * changes them, that's a real behavior change to confirm, not a test nuisance.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLiveMeasurables, computeStreak, levelFor, weeksInMonth,
} from '../src/scoring-core.js';

const pts = (r) => buildLiveMeasurables(r).metrics.reduce((s, m) => s + m.points, 0);

test('blended composite + points — a full month', () => {
  const r = { wDone: 4, expected: 4, aCount: 1, receivedAvg: 3.6, cDone: 4, avgScore: 88 };
  const out = buildLiveMeasurables(r);
  assert.equal(out.composite, 93);       // mean(1, .90, .88) → 93
  assert.equal(out.participation, 3);
  assert.equal(pts(r), 278);             // 100 + 90 + 88
  assert.equal(out.metrics.length, 3);
  assert.equal(out.metrics[0].key, 'submissions');
});

test('partial submissions + mid quality', () => {
  const r = { wDone: 4, expected: 4, aCount: 0, receivedAvg: 3.0, cDone: 4, avgScore: 50 };
  const out = buildLiveMeasurables(r);
  assert.equal(out.participation, 2);    // weekly + cleanliness, no assessment submitted
  assert.equal(out.composite, 64);       // mean(.667, .75, .50) → 64
  assert.equal(pts(r), 192);             // 67 + 75 + 50
});

test('no quality data is excluded from the blend (no penalty)', () => {
  const r = { wDone: 4, expected: 4, aCount: 0, receivedAvg: null, cDone: 0, avgScore: null };
  const out = buildLiveMeasurables(r);
  assert.equal(out.participation, 1);
  assert.equal(out.composite, 33);       // mean(.333) → 33, quality omitted
  assert.equal(pts(r), 33);
});

test('monthly streak counts consecutive complete months with current-month grace', () => {
  const weeks = (p) => weeksInMonth(p).map(w => ({ weekStart: w }));
  const weekly = [...weeks('2026-04'), ...weeks('2026-05')];
  const clean  = [...weeks('2026-04'), ...weeks('2026-05')];
  const sub    = [{ dateMonth: '2026-04-10' }, { dateMonth: '2026-05-10' }];
  assert.equal(computeStreak('2026-06', weekly, sub, clean), 2);
  assert.equal(computeStreak('2026-06', weekly, sub, weeks('2026-04')), 0);
});

test('levelFor thresholds', () => {
  assert.equal(levelFor(278).level, 1);
  assert.equal(levelFor(278).nextAt, 300);
  assert.equal(levelFor(300).level, 2);
  assert.equal(levelFor(2000).nextAt, null);
});
