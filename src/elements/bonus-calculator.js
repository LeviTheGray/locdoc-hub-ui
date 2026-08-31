/**
 * Wix Custom Element — Bonus Payout Calculator  (<bonus-calculator>)
 *
 * Implements the real bonus formula (from the old Quickbase-era app, provided by Levi
 * 2026-08-26): a Bonus Pool ($, entered manually — margin isn't tracked here) splits 50%
 * Reliability / 35% Profitability / 15% Tenure. Each eligible employee's share of a dimension's
 * pool = their raw score in that dimension ÷ the sum of that score across every eligible
 * (non-excluded) employee, so suggestedBonus = Σ(share × pool) over the three dimensions,
 * rounded to the nearest dollar for payroll.
 *
 * THREE STEPS, THREE PEOPLE (corrected 2026-08-27 — see bonusCalculator.web.js's header for the
 * full context): Step 1 (Set Bonus Pool) and Step 2 (Generate Payouts, review, save) are BOTH the
 * accounting manager (Andrew Ingram). Step 3 (Export) is Chris Lowery (C-Suite/payroll), who
 * reopens whatever Ingram already saved to run payroll — no confirm/exclude editing at that step.
 * Step 3 is grayed out until Step 2 has produced a saved payout for the selected period.
 *
 * A period has ONE current saved payout, not a history of every save (changed 2026-08-27, per
 * Levi — re-saving a period used to just append more rows, producing duplicates like "Baggett"
 * showing twice). Once a period has been saved, Step 2 shows a summary — pool amount, who
 * generated it and when — with an "Edit" button that reopens the same numbers for further
 * confirm/exclude or Profitability changes; saving again REPLACES that period's payout outright.
 *
 * Flow:
 *   1. Pick a period (bonuses are monthly — dropdown of last/this/next month, e.g. "August 2026",
 *      defaulting to the current month). "Set Bonus Pool" saves an amount for that period (shows
 *      whatever's currently set, if anything). Separately, Step 2 either offers "Generate
 *      suggested payouts" (reads the saved pool and returns every eligible employee's raw
 *      Reliability score + per-criterion breakdown from AssessmentScores, trailing 190 days, and
 *      Tenure years from Employees.startDate — refuses with an error if no pool exists yet) or, if
 *      the period already has a saved payout, a summary + Edit button that reuses those same
 *      already-generated numbers instead of re-pulling fresh data.
 *   2. Review table, one row per employee. Reliability/Tenure are read-only (computed).
 *      Profitability isn't a solved formula yet — the old app defaulted it to a flat 3 — so it's
 *      editable here, defaulting to 3, VISIBLY a placeholder rather than a hidden constant;
 *      changing it live-recomputes every row's shares and suggested bonus. Fixed 3-point scale
 *      (2=missed/3=hit/4=exceeded target) rendered as a 3-button toggle, not a number input —
 *      there's no in-between value, so free-typing one was both wrong and (a real bug found
 *      2026-08-27) broken: with no starting value and min="2", the spinner arrows always computed
 *      from empty and landed on 2 regardless of which arrow was clicked. An ⓘ button per row
 *      expands the full breakdown (per-criterion assessment scores, tenure detail) so a low score
 *      is explainable, not a mystery.
 *
 *      Profitability is TEAM-based (per Levi, 2026-08-27 — "did this team hit its target?"):
 *      rows are grouped by Employees.department, each group gets one header-row toggle that sets
 *      every member of that team at once. A per-employee toggle still sits on each row underneath
 *      for the rare case a single person needs to differ from their team — using a person's own
 *      toggle doesn't touch their teammates, only the team-level one mass-applies (and shows no
 *      button selected once members have diverged, since there's no single value to represent).
 *
 *      Audit, not data entry: each row gets marked ✓ Confirm (pay the suggested amount) or
 *      ✗ Exclude (pay $0 — terminated, not yet eligible, etc.). Excluding someone removes them
 *      from every dimension's sum, so every other row's share/suggested bonus recomputes live.
 *      "Save payouts" only enables once every row has been explicitly marked, so a run can't be
 *      blindly bulk-submitted without being looked at. When editing an already-saved period, the
 *      ⓘ breakdown button is disabled — the per-criterion Reliability breakdown isn't re-stored on
 *      save, only the final score, so there's nothing to show without a misleading "no data" flag.
 *
 * Data handoff:
 *   • Velo → element :  init-data        { canManage } | { error }
 *                       pool-result      { pool: Pool|null } | { error }             (carries _ts)
 *                       save-pool-result { ok:true, pool:Pool } | { ok:false, error } (carries _ts)
 *                       generate-result  { poolAmount, setByName, setDate, items:[RawRow] } | { error } (carries _ts)
 *                       save-result      { ok:true } | { ok:false, error }           (carries _ts)
 *                       saved-run-result { savedRun: SavedRun|null } | { error }     (carries _ts)
 *                       export-result    { period, rows:[ExportRow] } | { error }    (carries _ts)
 *   • element → Velo :  'get-pool'      { period }
 *                       'save-pool'     { period, poolAmount }
 *                       'generate-run'  { period }
 *                       'save-run'      { period, poolAmount, records:[FinalRow] }
 *                       'get-saved-run' { period }
 *                       'export-run'    { period }
 *                       'navigate'      { key: 'hub' }
 *
 * Pool: { period, poolAmount, setByName, setDate }.
 *
 * RawRow: { employeeId, employeeName, department, reliabilityScore, hasAssessmentData,
 * reliabilityBreakdown, assessmentCount, tenureYears, hasStartDate, startDate }.
 * FinalRow (what gets saved): RawRow's employeeId/employeeName/department/reliabilityScore/
 * tenureYears plus reliabilityShare, profitabilityScore, profitabilityShare, tenureShare,
 * suggestedBonus, status:'confirmed'|'excluded'.
 * SavedRun (a period's current saved payout — the Step 2 summary + Edit source): { poolAmount,
 * generatedByName, generatedDate, items:[RawRow-shaped, hasAssessmentData/hasStartDate hardcoded
 * true, reliabilityBreakdown:null] }.
 * ExportRow (CSV export, per Chris Lowery 2026-08-27 — every employee, not just the ones in the
 * saved run, sorted last/first name): { firstName, lastName, department, status:'Confirmed'|
 * 'Excluded'|'Not included in run', payout }.
 *
 * The backend re-checks authorization on every method (backend/bonusCalculator.web.js) — the
 * `canManage` flag here only decides what UI to paint.
 *
 * Editor setup: Add → Embed Code → Custom Element → this file, tag `bonus-calculator`,
 * element ID `bonusCalculator`.
 */

import { styles, ensureMaterialSymbols } from './tokens.js';

const SPLIT = { reliability: 0.5, profitability: 0.35, tenure: 0.15 };
const DEFAULT_PROFITABILITY = 3;
// Fixed 3-point scale, not a free number — 2=missed target, 3=hit (default), 4=exceeded.
const PROFIT_SCALE = [
  { value: 2, label: '2', title: 'Missed target' },
  { value: 3, label: '3', title: 'Hit target' },
  { value: 4, label: '4', title: 'Exceeded target' },
];
function profitToggle({ selected, dataAttr, dataValuePrefix, disabled }) {
  return `<div class="profit-toggle${dataAttr === 'data-team-profit' ? ' team' : ''}">${PROFIT_SCALE.map((o) =>
    `<button type="button" title="${esc(o.title)}" ${dataAttr}="${esc(dataValuePrefix)}:${o.value}" class="${selected === o.value ? 'sel' : ''}" ${disabled ? 'disabled' : ''}>${o.label}</button>`
  ).join('')}</div>`;
}
const CRITERIA_LABELS = {
  humble: 'Humble', hungry: 'Hungry', smart: 'Smart',
  helpfulKind: 'Helpful & Kind Communication', fastResponse: 'Fast Response', solvesProblems: 'Solves Problems',
};

// Bonuses are paid monthly — 3 choices (last/this/next month), labeled "August 2026" etc.,
// defaulting to the current month. `period` is still saved as this plain label string.
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function monthOptions() {
  const now = new Date();
  return [-1, 0, 1].map((offset) => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(n) { return `$${Math.round(Number(n) || 0).toLocaleString()}`; }
function pct(n) { return `${((Number(n) || 0) * 100).toFixed(1)}%`; }

const STYLES = styles(`
  .main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 56px; }
  .sub { font-size: 14px; color: var(--gray-600); margin-bottom: 20px; }
  .section { margin-top: 24px; }
  .section h2 { font-size: 15px; font-weight: 700; margin-bottom: 12px; }
  label.f { display: block; font-size: 13px; font-weight: 700; margin: 14px 0 5px; }
  input[type=text], input[type=number] { padding: 10px 12px; border: 1.5px solid var(--gray-200);
    border-radius: 8px; font-size: 15px; font-family: inherit; background: #fff; width: 100%; }
  input:focus { outline: none; border-color: var(--primary); }
  .row2 { display: flex; gap: 12px; } .row2 > div { flex: 1; }
  .disclaimer { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #92400e; margin-bottom: 16px; }
  .review-progress { font-size: 13px; font-weight: 700; color: var(--gray-600); margin-bottom: 12px; }
  .review-progress.done { color: var(--primary-dk); }
  .pool-breakdown { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
  .pool-tile { background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 10px; padding: 12px 16px; flex: 1; min-width: 140px; }
  .pool-tile .l { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--gray-400); }
  .pool-tile .v { font-size: 18px; font-weight: 800; margin-top: 2px; }
  .tbl-wrap { overflow-x: auto; }
  table.bonus-tbl { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 940px; }
  table.bonus-tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: var(--gray-400); padding: 8px 10px; border-bottom: 2px solid var(--gray-200); white-space: nowrap; }
  table.bonus-tbl td { padding: 8px 10px; border-bottom: 1px solid var(--gray-100); vertical-align: middle; }
  table.bonus-tbl tr.excluded td { opacity: .45; }
  table.bonus-tbl tr.team-row td { background: var(--gray-50); border-bottom: 1.5px solid var(--gray-200); padding: 10px; }
  table.bonus-tbl tr.team-row .team-name { font-weight: 800; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: var(--gray-600); }
  table.bonus-tbl tr.team-row .team-field { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--gray-500); }
  table.bonus-tbl input[type=number] { width: 70px; padding: 6px 8px; font-size: 13px; }
  .profit-toggle { display: inline-flex; border: 1.5px solid var(--gray-200); border-radius: 8px; overflow: hidden; }
  .profit-toggle button { border: none; background: #fff; padding: 5px 10px; font-size: 12px; font-weight: 700; color: var(--gray-500); cursor: pointer; border-right: 1px solid var(--gray-200); }
  .profit-toggle button:last-child { border-right: none; }
  .profit-toggle button:hover { background: var(--gray-50); }
  .profit-toggle button.sel { background: var(--primary); color: #fff; }
  .profit-toggle button:disabled { cursor: default; opacity: .5; }
  .profit-toggle.team button { padding: 6px 12px; font-size: 13px; }
  table.bonus-tbl .name-cell { display: flex; align-items: center; gap: 6px; }
  table.bonus-tbl .name { font-weight: 700; }
  table.bonus-tbl .flag { font-size: 10px; font-weight: 700; color: #b91c1c; display: block; }
  table.bonus-tbl .share { color: var(--gray-500); font-size: 11px; }
  table.bonus-tbl .suggested { font-weight: 800; color: var(--primary-dk); }
  .info-btn { width: 20px; height: 20px; border-radius: 50%; border: 1px solid var(--gray-200); background: var(--gray-50); color: var(--gray-400);
    font: 700 11px Georgia, 'Times New Roman', serif; font-style: italic; cursor: pointer; padding: 0; line-height: 1; flex-shrink: 0; }
  .info-btn:hover, .info-btn.open { background: var(--primary); color: #fff; border-color: var(--primary); }
  .review-actions { display: flex; gap: 4px; }
  .review-btn { width: 30px; height: 30px; border-radius: 8px; border: 1.5px solid var(--gray-200); background: #fff; cursor: pointer; font-size: 14px; font-weight: 700; color: var(--gray-400); }
  .review-btn.confirm.sel { background: #dcfce7; border-color: var(--primary); color: #14532d; }
  .review-btn.exclude.sel { background: #fee2e2; border-color: #ef4444; color: #991b1b; }
  .detail-row td { background: var(--gray-50); font-size: 12px; padding: 12px 16px; }
  .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px 20px; }
  .detail-crit { display: flex; justify-content: space-between; padding: 2px 0; }
  .detail-crit.low { color: #b91c1c; font-weight: 700; }
  .detail-note { color: var(--gray-500); font-style: italic; margin-top: 8px; }
  .searchbar { display: flex; gap: 8px; }
  .searchbar input { flex: 1; }
  .searchbar .btn { flex-shrink: 0; }
  .list { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }
  .calc { padding: 14px 16px 16px; }
  .calc .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .calc .name { font-size: 15px; font-weight: 700; }
  .calc .amount { font-size: 16px; font-weight: 800; color: var(--primary-dk); margin-left: auto; }
  .calc .meta { font-size: 12px; color: var(--gray-600); margin-top: 4px; }
  .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; background: var(--gray-100); color: var(--gray-600); }
  .pill.excluded { background: #fee2e2; color: #991b1b; }
  .empty { font-size: 13px; color: var(--gray-400); padding: 12px 0; }
  .step-disabled { opacity: .5; pointer-events: none; }
  .summary-line { font-size: 13px; color: var(--gray-600); margin-top: 4px; }
  .msg { margin-top: 16px; padding: 12px 14px; border-radius: 8px; font-size: 14px; display: none; }
  .msg.err { display: block; background: #fee2e2; color: #b91c1c; }
  .msg.ok  { display: block; background: #d1fae5; color: var(--primary-dk); }
  .link { background: none; border: none; color: var(--primary-dk); font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 20px; }
  .btn.ghost { background: var(--gray-100); color: var(--gray-900); }
  .btn.ghost:hover { background: var(--gray-200); }
  .btn:disabled { background: var(--gray-200); color: var(--gray-400); cursor: default; }
  @media (max-width: 560px) { .row2 { flex-direction: column; } }
`);

class BonusCalculator extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'pool-result', 'save-pool-result', 'generate-result', 'save-result', 'saved-run-result', 'export-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._canManage = false;
    this._loaded = false;
    this._error = null;
    this._generating = false;
    this._saving = false;
    this._msg = null;
    this._period = monthOptions()[1]; // defaults to the current month, shared by both steps
    this._poolInput = '';        // the "set pool" step's editable field
    this._currentPool = undefined; // undefined = not fetched yet, null = fetched, none set
    this._savingPool = false;
    this._poolMsg = null;
    this._poolAmount = null;     // the locked-in pool amount for the generated/edited run (read-only)
    this._rows = null;       // null until a run is being generated or edited
    this._editingSavedRun = false; // true when _rows came from reopening a saved run (Edit), not a fresh Generate
    this._openInfo = null;   // index of the row whose detail panel is expanded
    this._savedRun = undefined; // undefined = not fetched yet for this period, null = none saved, else SavedRun
    this._shell = false;
    this._exporting = false;
    this._exportMsg = null;
  }

  connectedCallback() {
    ensureMaterialSymbols();
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyInit(this.getAttribute('init-data'));
    else this._render();
  }

  attributeChangedCallback(name, _old, value) {
    if (!value) return;
    if (name === 'init-data')        this._applyInit(value);
    if (name === 'pool-result')      this._applyPool(value);
    if (name === 'save-pool-result') this._applySavePool(value);
    if (name === 'generate-result')  this._applyGenerate(value);
    if (name === 'save-result')      this._applySave(value);
    if (name === 'saved-run-result') this._applySavedRun(value);
    if (name === 'export-result')    this._applyExport(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _applyInit(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._canManage = Boolean(p.canManage);
    this._error = p.error || null;
    this._loaded = true;
    if (this._canManage) {
      this._fetchPool();
      this._fetchSavedRun();
    }
    this._render();
  }

  _fetchPool() {
    this.dispatchEvent(new CustomEvent('get-pool', { detail: { period: this._period }, bubbles: true, composed: true }));
  }

  _fetchSavedRun() {
    this.dispatchEvent(new CustomEvent('get-saved-run', { detail: { period: this._period }, bubbles: true, composed: true }));
  }

  _applySavedRun(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._savedRun = p.savedRun || null;
    this._render();
  }

  _applyPool(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._currentPool = p.pool || null;
    if (this._currentPool) this._poolInput = String(this._currentPool.poolAmount);
    this._render();
  }

  _applySavePool(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._savingPool = false;
    if (p.ok) {
      this._currentPool = p.pool;
      this._poolMsg = { ok: true, text: `Bonus pool set to ${money(p.pool.poolAmount)} for ${p.pool.period}.` };
    } else {
      this._poolMsg = { ok: false, text: p.error || 'Could not save the bonus pool.' };
    }
    this._render();
  }

  _applyGenerate(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._generating = false;
    if (p.error) { this._msg = { ok: false, text: p.error }; this._render(); return; }
    this._poolAmount = p.poolAmount;
    this._rows = (p.items || []).map((r) => ({ ...r, profitabilityScore: DEFAULT_PROFITABILITY, status: 'pending' }));
    this._editingSavedRun = false;
    this._openInfo = null;
    this._msg = null;
    this._render();
  }

  _applySave(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._saving = false;
    if (p.ok) {
      this._msg = { ok: true, text: `Saved ${this._rows.length} payout${this._rows.length === 1 ? '' : 's'} for ${this._period || 'this run'}.` };
      this._rows = null;
      this._editingSavedRun = false;
      this._poolAmount = null;
      this._savedRun = undefined; // re-fetch so the Step 2 summary/Step 3 export reflect what was just saved
      this._fetchSavedRun();
    } else {
      this._msg = { ok: false, text: p.error || 'Save failed.' };
    }
    this._render();
  }

  // Builds the actual CSV file and triggers a browser download — nothing server-side generates or
  // stores it, this is the only place the file itself comes into being.
  _applyExport(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._exporting = false;
    if (p.error) {
      this._exportMsg = { ok: false, text: p.error };
      this._render();
      return;
    }
    const csvField = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['Last Name', 'First Name', 'Department', 'Status', 'Payout'];
    const lines = [header.join(',')].concat(
      (p.rows || []).map((r) => [r.lastName, r.firstName, r.department, r.status, r.payout].map(csvField).join(','))
    );
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bonus-payouts-${(p.period || 'export').replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this._exportMsg = { ok: true, text: `Exported ${(p.rows || []).length} employees for ${p.period}.` };
    this._render();
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <header class="header"><h1>💰 Bonus Payout Calculator</h1>
        <p>Reliability (50%) + Profitability (35%) + Tenure (15%) of the pool, split by each person's share.</p></header>
      <main class="main" data-main></main>`;

    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.closest('[data-save-pool]')) return this._savePool();
      if (e.target.closest('[data-generate]')) return this._generate();
      if (e.target.closest('[data-save-run]')) return this._saveRun();
      if (e.target.closest('[data-new-run]')) return this._newRun();
      if (e.target.closest('[data-edit-run]')) return this._editRun();
      if (e.target.closest('[data-export]')) return this._exportRun();
      const info = e.target.closest('[data-info]');
      if (info) return this._toggleInfo(Number(info.getAttribute('data-info')));
      const confirmBtn = e.target.closest('[data-confirm]');
      if (confirmBtn) return this._setStatus(Number(confirmBtn.getAttribute('data-confirm')), 'confirmed');
      const excludeBtn = e.target.closest('[data-exclude]');
      if (excludeBtn) return this._setStatus(Number(excludeBtn.getAttribute('data-exclude')), 'excluded');
      // Profitability is a fixed 3-point scale (2=missed/3=hit/4=exceeded target), not a free-
      // number field — a toggle group, not a number input (which had a real bug: with no starting
      // value and min="2", the up/down spinner always computed from empty and landed on the floor
      // no matter which arrow you clicked).
      const rowProfit = e.target.closest('[data-row-profit]');
      if (rowProfit && this._rows) {
        const [i, value] = rowProfit.getAttribute('data-row-profit').split(':');
        this._rows[Number(i)].profitabilityScore = Number(value);
        return this._renderTable();
      }
      const teamProfit = e.target.closest('[data-team-profit]');
      if (teamProfit && this._rows) {
        const sep = teamProfit.getAttribute('data-team-profit').lastIndexOf(':');
        const team = teamProfit.getAttribute('data-team-profit').slice(0, sep);
        const value = Number(teamProfit.getAttribute('data-team-profit').slice(sep + 1));
        this._rows.forEach((r) => { if (((r.department || '').trim() || 'No Team') === team) r.profitabilityScore = value; });
        return this._renderTable();
      }
      if (e.target.closest('[data-nav]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
    });
    this.shadowRoot.addEventListener('input', (e) => {
      const field = e.target.getAttribute && e.target.getAttribute('data-field');
      if (field === 'poolInput') this._poolInput = e.target.value;
    });
    this.shadowRoot.addEventListener('change', (e) => {
      if (e.target.getAttribute && e.target.getAttribute('data-field') === 'period') this._onPeriodChange(e.target.value);
    });
  }

  _onPeriodChange(value) {
    this._period = value;
    this._currentPool = undefined;
    this._poolInput = '';
    this._poolMsg = null;
    this._rows = null;
    this._editingSavedRun = false;
    this._poolAmount = null;
    this._savedRun = undefined;
    this._msg = null;
    this._render();
    this._fetchPool();
    this._fetchSavedRun();
  }

  _savePool() {
    if (this._savingPool) return;
    const amount = Number(this._poolInput);
    if (!(amount > 0)) { this._poolMsg = { ok: false, text: 'Enter a bonus pool amount greater than $0.' }; return this._render(); }
    this._savingPool = true;
    this._poolMsg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('save-pool', { detail: { period: this._period, poolAmount: amount }, bubbles: true, composed: true }));
  }

  _generate() {
    if (this._generating) return;
    // Fail fast client-side (per the ask: Generate should error without a pool) — the backend
    // double-checks this too, in case _currentPool is stale (e.g. someone else just set one).
    if (!this._currentPool) {
      this._msg = { ok: false, text: `No bonus pool has been set for ${this._period} yet — set one above first.` };
      return this._render();
    }
    this._generating = true;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('generate-run', { detail: { period: this._period }, bubbles: true, composed: true }));
  }

  _newRun() {
    this._rows = null;
    this._editingSavedRun = false;
    this._openInfo = null;
    this._msg = null;
    this._render();
  }

  // Reopens the period's current saved payout for further confirm/exclude or Profitability
  // changes, reusing its already-generated numbers rather than re-pulling fresh Reliability/
  // Tenure data (per Levi, 2026-08-27) — saving again replaces that period's payout outright.
  _editRun() {
    if (!this._savedRun) return;
    this._poolAmount = this._savedRun.poolAmount;
    this._rows = this._savedRun.items.map((r) => ({ ...r }));
    this._editingSavedRun = true;
    this._openInfo = null;
    this._msg = null;
    this._render();
  }

  _toggleInfo(i) {
    this._openInfo = this._openInfo === i ? null : i;
    this._renderTable();
  }

  // Toggling the same status again clears it back to 'pending' (undo), which also un-excludes
  // the person for share purposes.
  _setStatus(i, status) {
    if (!this._rows || !this._rows[i]) return;
    this._rows[i].status = this._rows[i].status === status ? 'pending' : status;
    this._renderTable();
  }

  // Sums, shares, and each row's suggested bonus — recomputed from current state (Profitability
  // edits, exclude/confirm toggles) every time this is called, never cached. Excluded rows are
  // dropped from every dimension's sum (per Chris's audit workflow) and forced to $0.
  _computeShares() {
    const pool = Number(this._poolAmount) || 0;
    const pools = { reliability: pool * SPLIT.reliability, profitability: pool * SPLIT.profitability, tenure: pool * SPLIT.tenure };
    const rows = this._rows || [];
    const counted = rows.filter((r) => r.status !== 'excluded');
    const sums = { reliability: 0, profitability: 0, tenure: 0 };
    counted.forEach((r) => {
      sums.reliability += Number(r.reliabilityScore) || 0;
      sums.profitability += Number(r.profitabilityScore) || 0;
      sums.tenure += Number(r.tenureYears) || 0;
    });
    return rows.map((r) => {
      if (r.status === 'excluded') return { ...r, reliabilityShare: 0, profitabilityShare: 0, tenureShare: 0, suggestedBonus: 0 };
      const reliabilityShare = sums.reliability ? (Number(r.reliabilityScore) || 0) / sums.reliability : 0;
      const profitabilityShare = sums.profitability ? (Number(r.profitabilityScore) || 0) / sums.profitability : 0;
      const tenureShare = sums.tenure ? (Number(r.tenureYears) || 0) / sums.tenure : 0;
      const suggestedBonus = reliabilityShare * pools.reliability + profitabilityShare * pools.profitability + tenureShare * pools.tenure;
      return { ...r, reliabilityShare, profitabilityShare, tenureShare, suggestedBonus };
    });
  }

  _allReviewed() {
    return (this._rows || []).every((r) => r.status !== 'pending');
  }

  _saveRun() {
    if (this._saving || !this._rows || !this._allReviewed()) return;
    const computed = this._computeShares();
    const records = computed.map((r) => ({
      employeeId: r.employeeId, employeeName: r.employeeName, department: r.department || '',
      reliabilityScore: r.reliabilityScore, reliabilityShare: r.reliabilityShare,
      profitabilityScore: Number(r.profitabilityScore) || 0, profitabilityShare: r.profitabilityShare,
      tenureYears: r.tenureYears, tenureShare: r.tenureShare,
      suggestedBonus: r.suggestedBonus,
      status: r.status,
    }));
    this._saving = true;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('save-run', {
      detail: { period: this._period.trim(), poolAmount: Number(this._poolAmount) || 0, records },
      bubbles: true, composed: true,
    }));
  }

  // Always exports the currently-selected period's saved payout — Step 3 is scoped to one period
  // at a time (per Levi, 2026-08-27), not a cross-period picker, since that's how Chris actually
  // uses it (open the period Ingram just finished, export, run payroll).
  _exportRun() {
    if (this._exporting || !this._savedRun) return;
    this._exporting = true;
    this._exportMsg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('export-run', { detail: { period: this._period }, bubbles: true, composed: true }));
  }

  _render() {
    const main = this.shadowRoot.querySelector('[data-main]');
    if (!this._loaded) { main.innerHTML = `<p class="sub">Loading…</p>`; return; }
    if (this._error) {
      main.innerHTML = `<div class="msg err">${esc(this._error)}</div>
        <button class="link" data-nav>← Back to the Hub</button>`;
      return;
    }
    if (!this._canManage) {
      main.innerHTML = `<div class="msg err">You're not authorized to use the Bonus Payout Calculator. This is available to Operations and C-Suite.</div>
        <button class="link" data-nav>← Back to the Hub</button>`;
      return;
    }
    main.innerHTML = `
      ${this._msg ? `<div class="msg ${this._msg.ok ? 'ok' : 'err'}">${esc(this._msg.text)}</div>` : ''}
      ${this._poolSection()}
      ${this._rows ? this._reviewSection() : this._payoutSection()}
      ${this._exportSection()}
      <button class="link" data-nav>← Back to the Hub</button>`;
  }

  _poolSection() {
    const opts = monthOptions().map((m) => `<option value="${esc(m)}" ${this._period === m ? 'selected' : ''}>${esc(m)}</option>`).join('');
    const periodPicker = `<div><label class="f">Period</label><select data-field="period">${opts}</select></div>`;

    let poolStatus;
    if (this._currentPool === undefined) poolStatus = `<p class="empty" style="padding:6px 0 0">Checking…</p>`;
    else if (this._currentPool) poolStatus = `<p class="empty" style="padding:6px 0 0;color:var(--primary-dk)">Currently set to ${money(this._currentPool.poolAmount)}, by ${esc(this._currentPool.setByName)} on ${esc(this._currentPool.setDate)}.</p>`;
    else poolStatus = `<p class="empty" style="padding:6px 0 0">No bonus pool has been set for ${esc(this._period)} yet.</p>`;

    return `<div class="section card" style="padding:18px 20px">
      <h2>Step 1 — Set Bonus Pool <span style="font-weight:400;color:var(--gray-400);text-transform:none;letter-spacing:0;font-size:12px">(the accounting manager)</span></h2>
      <div class="row2">
        ${periodPicker}
        <div><label class="f">Bonus Pool amount</label>
          <input type="number" step="0.01" data-field="poolInput" placeholder="0.00" value="${esc(this._poolInput)}"></div>
      </div>
      ${poolStatus}
      ${this._poolMsg ? `<div class="msg ${this._poolMsg.ok ? 'ok' : 'err'}" style="margin-top:10px">${esc(this._poolMsg.text)}</div>` : ''}
      <button class="btn ${this._savingPool ? 'is-loading' : ''}" data-save-pool style="margin-top:16px">
        ${this._savingPool ? '<span class="btn-spinner"></span>Saving…' : 'Set Bonus Pool'}</button>
    </div>`;
  }

  // Step 2 — dynamic on whether this period already has a saved payout: a summary + Edit button
  // if so, or the original "Generate suggested payouts" button if this is a brand-new period.
  _payoutSection() {
    const heading = `<h2>Step 2 — Generate Payouts <span style="font-weight:400;color:var(--gray-400);text-transform:none;letter-spacing:0;font-size:12px">(the accounting manager)</span></h2>`;

    if (this._savedRun === undefined) {
      return `<div class="section card" style="padding:18px 20px">${heading}<p class="empty">Checking for an existing payout…</p></div>`;
    }

    if (this._savedRun) {
      const sr = this._savedRun;
      const confirmedCount = sr.items.filter((r) => r.status !== 'excluded').length;
      return `<div class="section card" style="padding:18px 20px">
        ${heading}
        <div class="pool-breakdown" style="margin-bottom:0">
          <div class="pool-tile"><div class="l">Total Pool</div><div class="v">${money(sr.poolAmount)}</div></div>
          <div class="pool-tile"><div class="l">Confirmed</div><div class="v">${confirmedCount} of ${sr.items.length}</div></div>
        </div>
        <div class="summary-line">Generated by ${esc(sr.generatedByName)} on ${esc(sr.generatedDate)}.</div>
        <button class="btn ghost" data-edit-run style="margin-top:16px">Edit</button>
      </div>`;
    }

    return `<div class="section card" style="padding:18px 20px">
      ${heading}
      <div class="sub" style="margin-bottom:0">Period: <strong>${esc(this._period)}</strong> — generates against whatever pool was set in Step 1.</div>
      <button class="btn ${this._generating ? 'is-loading' : ''}" data-generate style="margin-top:16px">
        ${this._generating ? '<span class="btn-spinner"></span>Generating…' : 'Generate suggested payouts'}</button>
    </div>`;
  }

  _reviewSection() {
    const total = (this._rows || []).length;
    const reviewed = (this._rows || []).filter((r) => r.status !== 'pending').length;
    const done = reviewed === total && total > 0;
    const title = this._editingSavedRun ? `Edit — ${esc(this._period) || '(no period set)'}` : `Review — ${esc(this._period) || '(no period set)'}`;
    const cancelLabel = this._editingSavedRun ? 'Cancel' : 'Start over';
    return `<div class="section card" style="padding:18px 20px" id="reviewCard">
      <h2>${title}</h2>
      <div class="disclaimer">These are SUGGESTED figures — Profitability defaults to 3 for everyone since it isn't a solved calculation yet. Confirm (✓) or exclude (✗) every person before saving; excluding someone recalculates everyone else's share.</div>
      <div id="tableHolder">${this._tableHtml()}</div>
      <div class="review-progress ${done ? 'done' : ''}">${reviewed} of ${total} reviewed</div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="btn ${this._saving ? 'is-loading' : ''}" data-save-run ${done && !this._saving ? '' : 'disabled'}>
          ${this._saving ? '<span class="btn-spinner"></span>Saving…' : 'Save payouts'}</button>
        <button class="btn ghost" data-new-run>${cancelLabel}</button>
      </div>
    </div>`;
  }

  // Step 3 — Chris Lowery's step (per Levi, 2026-08-27): grayed out until Step 2 has produced a
  // saved payout for the selected period; once it has, shows who/when it was generated and an
  // Export CSV button. No period picker here — always the currently-selected period (this._period).
  _exportSection() {
    const ready = !!this._savedRun;
    return `<div class="section card ${ready ? '' : 'step-disabled'}" style="padding:18px 20px">
      <h2>Step 3 — Export <span style="font-weight:400;color:var(--gray-400);text-transform:none;letter-spacing:0;font-size:12px">(C-Suite / payroll)</span></h2>
      ${ready
        ? `<div class="summary-line">Generated by ${esc(this._savedRun.generatedByName)} on ${esc(this._savedRun.generatedDate)} — ready to export.</div>`
        : `<p class="empty">Generate and save a payout for ${esc(this._period)} first.</p>`}
      ${this._exportMsg ? `<div class="msg ${this._exportMsg.ok ? 'ok' : 'err'}" style="margin-top:10px">${esc(this._exportMsg.text)}</div>` : ''}
      <button class="btn ${this._exporting ? 'is-loading' : ''}" data-export style="margin-top:16px" ${ready && !this._exporting ? '' : 'disabled'}>
        ${this._exporting ? '<span class="btn-spinner"></span>Exporting…' : 'Export CSV'}</button>
    </div>`;
  }

  // Rebuilds the whole table (every share/suggested-bonus cell can change from one edit). Used to
  // also restore focus/cursor into a Profitability text input mid-edit; that field is a click
  // toggle now (no typing, nothing to steal focus from), so this is just a plain re-render.
  _renderTable() {
    const holder = this._$('tableHolder');
    if (!holder) return;
    holder.innerHTML = this._tableHtml();
    const reviewCard = this._$('reviewCard');
    if (reviewCard) {
      const total = (this._rows || []).length;
      const reviewed = (this._rows || []).filter((r) => r.status !== 'pending').length;
      const done = reviewed === total && total > 0;
      const progress = reviewCard.querySelector('.review-progress');
      if (progress) { progress.textContent = `${reviewed} of ${total} reviewed`; progress.className = `review-progress ${done ? 'done' : ''}`; }
      const saveBtn = reviewCard.querySelector('[data-save-run]');
      if (saveBtn) saveBtn.disabled = !(done && !this._saving);
    }
  }

  _detailRow(r, i) {
    const crit = Object.keys(CRITERIA_LABELS).map((key) => {
      const v = r.reliabilityBreakdown ? r.reliabilityBreakdown[key] : null;
      const low = v != null && v < 3;
      return `<div class="detail-crit ${low ? 'low' : ''}"><span>${CRITERIA_LABELS[key]}</span><span>${v == null ? '—' : v.toFixed(2)}</span></div>`;
    }).join('');
    return `<tr class="detail-row"><td colspan="6">
      <div class="detail-grid">${crit}</div>
      <div class="detail-note">Reliability = average of the 6 criteria above, each averaged over ${r.assessmentCount || 0} assessment(s) received in the trailing 190 days.
      Tenure = ${r.hasStartDate ? `${r.tenureYears.toFixed(2)} years since ${esc(String(r.startDate).slice(0, 10))}` : 'no start date on file'}.
      Profitability is not yet a solved calculation — this is a flat default, not a measured score.</div>
    </td></tr>`;
  }

  _tableHtml() {
    const pool = Number(this._poolAmount) || 0;
    const pools = { reliability: pool * SPLIT.reliability, profitability: pool * SPLIT.profitability, tenure: pool * SPLIT.tenure };
    const computed = this._computeShares();

    const breakdown = `<div class="pool-breakdown">
      <div class="pool-tile"><div class="l">Total Pool</div><div class="v">${money(pool)}</div></div>
      <div class="pool-tile"><div class="l">Reliability (50%)</div><div class="v">${money(pools.reliability)}</div></div>
      <div class="pool-tile"><div class="l">Profitability (35%)</div><div class="v">${money(pools.profitability)}</div></div>
      <div class="pool-tile"><div class="l">Tenure (15%)</div><div class="v">${money(pools.tenure)}</div></div>
    </div>`;

    if (!computed.length) return breakdown + `<p class="empty">No eligible employees found.</p>`;

    // Group by team (Employees.department) for the team-level Profitability control, keeping each
    // row's original index (into this._rows) so the row's own inputs/buttons still address the
    // right record after grouping reorders the display.
    const withIndex = computed.map((r, i) => ({ ...r, _i: i }));
    const groups = new Map();
    withIndex.forEach((r) => {
      const team = (r.department || '').trim() || 'No Team';
      if (!groups.has(team)) groups.set(team, []);
      groups.get(team).push(r);
    });
    const teamNames = Array.from(groups.keys()).sort((a, b) => a === 'No Team' ? 1 : b === 'No Team' ? -1 : a.localeCompare(b));

    const rows = teamNames.map((team) => {
      const members = groups.get(team);
      // The team toggle only shows a value "selected" when every member currently shares one —
      // otherwise (after individual overrides diverge) it shows none selected, since there's no
      // single team-wide value to represent.
      const memberScores = new Set(members.map((r) => Number(r.profitabilityScore)));
      const teamSelected = memberScores.size === 1 ? Array.from(memberScores)[0] : null;
      const teamHeader = `<tr class="team-row"><td colspan="2" class="team-name">${esc(team)}</td>
        <td><div class="team-field">Team Profitability
          ${profitToggle({ selected: teamSelected, dataAttr: 'data-team-profit', dataValuePrefix: team })}
        </div></td>
        <td colspan="3"></td>
      </tr>`;
      const memberRows = members.map((r) => {
        const i = r._i;
        const excluded = r.status === 'excluded';
        const row = `<tr class="${excluded ? 'excluded' : ''}">
          <td><div class="name-cell">
            <button type="button" class="info-btn ${this._openInfo === i ? 'open' : ''}" data-info="${i}" aria-label="Score breakdown" ${this._editingSavedRun ? 'disabled title="Breakdown only available right after generating"' : ''}>i</button>
            <span class="name">${esc(r.employeeName)}</span>
          </div></td>
          <td>${r.reliabilityScore.toFixed(2)}${!r.hasAssessmentData ? '<span class="flag">no recent assessments</span>' : ''}<div class="share">${pct(r.reliabilityShare)} share</div></td>
          <td>${profitToggle({ selected: Number(r.profitabilityScore), dataAttr: 'data-row-profit', dataValuePrefix: i, disabled: excluded })}<div class="share">${pct(r.profitabilityShare)} share</div></td>
          <td>${r.tenureYears.toFixed(2)}${!r.hasStartDate ? '<span class="flag">no start date</span>' : ''}<div class="share">${pct(r.tenureShare)} share</div></td>
          <td class="suggested">${money(r.suggestedBonus)}</td>
          <td><div class="review-actions">
            <button type="button" class="review-btn confirm ${r.status === 'confirmed' ? 'sel' : ''}" data-confirm="${i}" title="Confirm">✓</button>
            <button type="button" class="review-btn exclude ${excluded ? 'sel' : ''}" data-exclude="${i}" title="Exclude">✗</button>
          </div></td>
        </tr>`;
        return this._openInfo === i ? row + this._detailRow(r, i) : row;
      }).join('');
      return teamHeader + memberRows;
    }).join('');

    return breakdown + `<div class="tbl-wrap"><table class="bonus-tbl">
      <thead><tr><th>Employee</th><th>Reliability</th><th>Profitability</th><th>Tenure (yrs)</th><th>Suggested</th><th>Review</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

}

customElements.define('bonus-calculator', BonusCalculator);
