/**
 * Scoring core — PURE compute, no Wix APIs.
 *
 * SOURCE OF TRUTH. This module holds the framework-agnostic scorecard math so the exact same
 * logic runs in two places: the Wix Velo backend (teamwix/src/backend/scorecard.web.js feeds it
 * rows from wix-data) and the standalone hub app backend (which feeds it rows from the Wix Data
 * REST API). The teamwix copy at src/backend/scoring-core.js is GENERATED from this file by
 * scripts/sync-to-teamwix.mjs — edit here, then run `npm run sync:teamwix`.
 *
 * Keep this file free of any wix-* imports or side effects beyond reading `Date` — it must run
 * in plain Node and in the browser. Inputs are plain collection rows; outputs are plain objects.
 */

export const LEVELS = [
  { level: 1, min: 0,    name: 'Rookie' },
  { level: 2, min: 300,  name: 'Steady' },
  { level: 3, min: 700,  name: 'Pro' },
  { level: 4, min: 1200, name: 'Elite' },
  { level: 5, min: 2000, name: 'Legend' },
];

// Display config for the live-derived measurables. The scorecard has three grouped measurables:
// one participation measurable (Submissions, which expands to the three things being submitted)
// and two quality measurables (Team Assessments avg /4, Cleanliness avg %).
export const LIVE_DEFS = {
  submissions:        { key: 'submissions',        label: 'Submissions',      emoji: '📥', category: 'Participation', valueType: 'completion', whoCompletes: 'employee', weight: 1 },
  assessmentQuality:  { key: 'assessmentQuality',  label: 'Team Assessments', emoji: '🤝', category: 'Quality',       valueType: 'quality', max: 4,   whoCompletes: 'employee', weight: 1 },
  cleanlinessQuality: { key: 'cleanlinessQuality', label: 'Cleanliness',      emoji: '🧹', category: 'Quality',       valueType: 'quality', max: 100, whoCompletes: 'employee', weight: 1 },
  // Recognition bonus — points for cleaning/submitting shared common-area audits. Additive to the
  // point total/level (drives the leaderboard) but NOT part of the quality composite, since not
  // everyone works common areas — its absence must not penalize field staff.
  commonArea:         { key: 'commonArea',         label: 'Common Areas',     emoji: '🧽', category: 'Recognition',   valueType: 'bonus', whoCompletes: 'employee', weight: 1 },
};

// Common-area recognition points: credited per cleaning and per submission, capped monthly so a
// single busy branch can't run away with the leaderboard.
export const COMMON_AREA_POINTS = { clean: 25, submit: 10, monthlyCap: 100 };
export const ASSESSMENT_KEYS = ['humble', 'hungry', 'smart', 'helpfulKind', 'fastResponse', 'solvesProblems'];

export function currentPeriod() { return new Date().toISOString().slice(0, 7); }

export function resolveWixImage(wixUrl) {
  if (!wixUrl || typeof wixUrl !== 'string') return null;
  if (wixUrl.startsWith('http')) return wixUrl;
  const m = wixUrl.match(/wix:image:\/\/v1\/([^/#]+)/);
  return m ? `https://static.wixstatic.com/media/${m[1]}` : null;
}

export function getMonday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}
export function weeksInMonth(period) {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const mondays = new Set();
  for (let day = 1; day <= last; day++) {
    mondays.add(getMonday(`${period}-${String(day).padStart(2, '0')}`));
  }
  return [...mondays].filter(ws => ws.slice(0, 7) === period).sort();
}
// Recent week-start Mondays, current week first (descending). Drives the Weekly Check week picker.
export function recentMondays(n = 8) {
  const out = [];
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day)); // this week's Monday
  for (let i = 0; i < n; i++) { out.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() - 7); }
  return out;
}

export function levelFor(points) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) cur = l;
  const next = LEVELS.find(l => l.min > points) || null;
  return { ...cur, nextAt: next ? next.min : null, nextName: next ? next.name : null };
}

/* ───────── compliance + monthly streak ─────────
 * Score is submission-driven: each month an employee "completes" up to three things — weekly
 * reports (all weeks), a peer assessment (≥1), and cleanliness audits (all weeks). Compliance %
 * = how many of the three were done (0/33/67/100). The streak is the number of consecutive
 * months with all three done; the in-progress current month is given grace (it neither counts
 * nor resets the streak until it's complete).
 */
export function monthKey(dateStr) { return (dateStr || '').slice(0, 7); }
export function periodMinus(period, k) {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1 - k, 1).toISOString().slice(0, 7);
}

// Done flags for one month, derived from broad (multi-month) row sets.
export function monthDoneFlags(period, weeklyRows, submittedAssessRows, cleanRows) {
  const weeks = weeksInMonth(period);
  const expected = weeks.length || 1;
  const wSet = new Set(weeklyRows.map(r => r.weekStart));
  const cSet = new Set(cleanRows.map(r => r.weekStart));
  const wDone = weeks.filter(w => wSet.has(w)).length >= expected;
  const cDone = weeks.filter(w => cSet.has(w)).length >= expected;
  const aDone = submittedAssessRows.some(r => monthKey(r.dateMonth) === period);
  return { wDone, cDone, aDone };
}

// Consecutive months (ending at `period`) with all three done. The current in-progress month
// doesn't reset the streak — it's skipped if not yet complete.
export function computeStreak(period, weeklyRows, submittedAssessRows, cleanRows) {
  const isCurrent = period === currentPeriod();
  let streak = 0;
  for (let k = 0; k <= 24; k++) {
    const p = periodMinus(period, k);
    const f = monthDoneFlags(p, weeklyRows, submittedAssessRows, cleanRows);
    if (f.wDone && f.cDone && f.aDone) { streak++; continue; }
    if (k === 0 && isCurrent) continue; // grace for the in-progress month
    break;
  }
  return streak;
}

/* ───────── measurable builder ─────────
 * Given raw monthly counts/values, produce the three display measurables plus the blended
 * overall (participation + the two quality averages). Used by both the single and batch paths.
 */
export function buildLiveMeasurables(raw) {
  const { wDone, expected, aCount, receivedAvg, cDone, avgScore, caCleans = 0, caSubmits = 0 } = raw;
  const wOk = wDone >= expected, aOk = aCount > 0, cOk = cDone >= expected;
  const doneCount = (wOk ? 1 : 0) + (aOk ? 1 : 0) + (cOk ? 1 : 0);
  const partFrac = doneCount / 3;

  const submissions = {
    ...LIVE_DEFS.submissions,
    achievement: +partFrac.toFixed(2), done: doneCount === 3, points: Math.round(100 * partFrac),
    detail: { items: [
      { key: 'weeklyReport',    label: 'Weekly Reports',    emoji: '📝', done: wOk, count: wDone, expected },
      { key: 'peerAssessment',  label: 'Team Assessment',   emoji: '🤝', done: aOk, count: aCount },
      { key: 'cleanlinessAudit', label: 'Cleanliness Audit', emoji: '🧹', done: cOk, count: cDone, expected },
    ] },
  };

  const aFrac = receivedAvg != null ? receivedAvg / 4 : null;
  const assessmentQuality = {
    ...LIVE_DEFS.assessmentQuality,
    value: receivedAvg, achievement: aFrac != null ? +aFrac.toFixed(2) : 0,
    points: aFrac != null ? Math.round(100 * aFrac) : 0,
    detail: { receivedAvg },
  };

  const cFrac = avgScore != null ? avgScore / 100 : null;
  const cleanlinessQuality = {
    ...LIVE_DEFS.cleanlinessQuality,
    value: avgScore, achievement: cFrac != null ? +cFrac.toFixed(2) : 0,
    points: cFrac != null ? Math.round(avgScore) : 0,
    detail: { avgScore, count: cDone, expected },
  };

  // Common-area recognition — additive point bonus, NOT folded into the composite (see LIVE_DEFS).
  const caRaw = caCleans * COMMON_AREA_POINTS.clean + caSubmits * COMMON_AREA_POINTS.submit;
  const caPoints = Math.min(COMMON_AREA_POINTS.monthlyCap, caRaw);
  const commonArea = {
    ...LIVE_DEFS.commonArea,
    value: caCleans + caSubmits, points: caPoints, done: caPoints > 0,
    detail: { cleaned: caCleans, submitted: caSubmits, capped: caRaw > COMMON_AREA_POINTS.monthlyCap },
  };

  // Blended overall = mean of the available normalized components (quality with no data yet
  // is excluded so it neither helps nor hurts). Common-area bonus is intentionally excluded.
  const comps = [partFrac];
  if (aFrac != null) comps.push(aFrac);
  if (cFrac != null) comps.push(cFrac);
  const composite = Math.round(comps.reduce((s, x) => s + x, 0) / comps.length * 100);

  return { metrics: [submissions, assessmentQuality, cleanlinessQuality, commonArea], composite, participation: doneCount };
}
