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
  buildLiveMeasurables, computeStreak, currentPeriod, levelFor, periodMinus, weeksInMonth,
} from '../src/scoring-core.js';

const pts = (r) => buildLiveMeasurables(r).metrics.reduce((s, m) => s + m.points, 0);

test('blended composite + points — a full month', () => {
  const r = { wDone: 4, expected: 4, aCount: 1, receivedAvg: 3.6, cDone: 4, avgScore: 88 };
  const out = buildLiveMeasurables(r);
  assert.equal(out.composite, 93);       // mean(1, .90, .88) → 93
  assert.equal(out.participation, 3);
  assert.equal(pts(r), 278);             // 100 + 90 + 88 (+0 common-area, none this month)
  assert.equal(out.metrics.length, 4);   // submissions, assessment, cleanliness, common-area
  assert.equal(out.metrics[0].key, 'submissions');
  assert.equal(out.metrics[3].key, 'commonArea');
});

test('common-area recognition adds points without touching the composite', () => {
  const base = { wDone: 4, expected: 4, aCount: 1, receivedAvg: 3.6, cDone: 4, avgScore: 88 };
  const out = buildLiveMeasurables({ ...base, caCleans: 2, caSubmits: 1 });
  const ca = out.metrics.find(m => m.key === 'commonArea');
  assert.equal(ca.points, 60);           // 2×25 + 1×10, under the 100 cap
  assert.equal(ca.detail.capped, false);
  assert.equal(out.composite, 93);       // composite unchanged vs the no-common-area case
  assert.equal(pts({ ...base, caCleans: 2, caSubmits: 1 }), 338); // 278 + 60

  const capped = buildLiveMeasurables({ ...base, caCleans: 5, caSubmits: 3 }); // 155 raw → capped
  assert.equal(capped.metrics.find(m => m.key === 'commonArea').points, 100);
  assert.equal(capped.metrics.find(m => m.key === 'commonArea').detail.capped, true);
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

// computeStreak decides grace by comparing `period` against the real wall clock (currentPeriod()),
// so these periods are derived rather than hardcoded — a fixed month silently stops exercising the
// grace branch the moment it falls into the past.
test('monthly streak counts consecutive complete months with current-month grace', () => {
  const weeks = (p) => weeksInMonth(p).map(w => ({ weekStart: w }));
  const now = currentPeriod();
  const prev1 = periodMinus(now, 1);
  const prev2 = periodMinus(now, 2);

  const weekly = [...weeks(prev2), ...weeks(prev1)];
  const clean  = [...weeks(prev2), ...weeks(prev1)];
  const sub    = [{ dateMonth: `${prev2}-10` }, { dateMonth: `${prev1}-10` }];

  // The in-progress month has no data yet, but is skipped rather than resetting the streak.
  assert.equal(computeStreak(now, weekly, sub, clean), 2);

  // Grace covers only the current month: the gap in prev1 still breaks the streak.
  assert.equal(computeStreak(now, weekly, sub, weeks(prev2)), 0);
});

test('an incomplete PAST month gets no grace and resets the streak', () => {
  const weeks = (p) => weeksInMonth(p).map(w => ({ weekStart: w }));
  const now = currentPeriod();
  const prev1 = periodMinus(now, 1);
  const prev2 = periodMinus(now, 2);

  // prev2 is complete, prev1 is empty. Scoring prev1 — a past, incomplete month — earns no grace.
  const weekly = weeks(prev2);
  const clean  = weeks(prev2);
  const sub    = [{ dateMonth: `${prev2}-10` }];
  assert.equal(computeStreak(prev1, weekly, sub, clean), 0);

  // Same data scored at prev2 itself, which IS complete, counts it.
  assert.equal(computeStreak(prev2, weekly, sub, clean), 1);
});

test('levelFor thresholds', () => {
  assert.equal(levelFor(278).level, 1);
  assert.equal(levelFor(278).nextAt, 300);
  assert.equal(levelFor(300).level, 2);
  assert.equal(levelFor(2000).nextAt, null);
});
