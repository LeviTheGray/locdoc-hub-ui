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
 * Two-step flow:
 *   1. Pick a period (bonuses are monthly — dropdown of last/this/next month, e.g. "August 2026",
 *      defaulting to the current month) + enter a pool amount, click Generate → backend returns every eligible
 *      employee's raw Reliability score + per-criterion breakdown (from AssessmentScores,
 *      trailing 190 days) and Tenure years (from Employees.startDate).
 *   2. Review table, one row per employee. Reliability/Tenure are read-only (computed).
 *      Profitability isn't a solved formula yet — the old app defaulted it to a flat 3 — so it's
 *      an editable number here, defaulting to 3, VISIBLY a placeholder rather than a hidden
 *      constant; editing it live-recomputes every row's shares and suggested bonus. An ⓘ button
 *      per row expands the full breakdown (per-criterion assessment scores, tenure detail) so a
 *      low score is explainable, not a mystery.
 *
 *      Audit, not data entry (per Chris, the C-Suite reviewer, via Levi 2026-08-26): each row gets
 *      marked ✓ Confirm (pay the suggested amount) or ✗ Exclude (pay $0 — terminated, not yet
 *      eligible, etc.). Excluding someone removes them from every dimension's sum, so every other
 *      row's share/suggested bonus recomputes live. "Save payouts" only enables once every row has
 *      been explicitly marked, so a run can't be blindly bulk-submitted without being looked at.
 *
 * Data handoff:
 *   • Velo → element :  init-data       { canManage } | { error }
 *                       generate-result { items:[RawRow] } | { error }              (carries _ts)
 *                       save-result     { ok:true } | { ok:false, error }           (carries _ts)
 *                       history-result  { items:[SavedRow] } | { error }            (carries _ts)
 *   • element → Velo :  'generate-run' {}
 *                       'save-run'     { period, poolAmount, records:[FinalRow] }
 *                       'list-history' { term }
 *                       'navigate'     { key: 'hub' }
 *
 * RawRow: { employeeId, employeeName, reliabilityScore, hasAssessmentData, reliabilityBreakdown,
 * assessmentCount, tenureYears, hasStartDate, startDate }.
 * FinalRow (what gets saved): RawRow's employeeId/employeeName/reliabilityScore/tenureYears plus
 * reliabilityShare, profitabilityScore, profitabilityShare, tenureShare, suggestedBonus,
 * status:'confirmed'|'excluded'.
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
  table.bonus-tbl input[type=number] { width: 70px; padding: 6px 8px; font-size: 13px; }
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
  static get observedAttributes() { return ['init-data', 'generate-result', 'save-result', 'history-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._canManage = false;
    this._loaded = false;
    this._error = null;
    this._generating = false;
    this._saving = false;
    this._msg = null;
    this._period = monthOptions()[1]; // defaults to the current month
    this._poolAmount = '';
    this._rows = null;       // null until a run is generated
    this._openInfo = null;   // index of the row whose detail panel is expanded
    this._history = [];
    this._historyLoaded = false;
    this._shell = false;
  }

  connectedCallback() {
    ensureMaterialSymbols();
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyInit(this.getAttribute('init-data'));
    else this._render();
  }

  attributeChangedCallback(name, _old, value) {
    if (!value) return;
    if (name === 'init-data')       this._applyInit(value);
    if (name === 'generate-result') this._applyGenerate(value);
    if (name === 'save-result')     this._applySave(value);
    if (name === 'history-result')  this._applyHistory(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _applyInit(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._canManage = Boolean(p.canManage);
    this._error = p.error || null;
    this._loaded = true;
    if (this._canManage && !this._historyLoaded) this._loadHistory();
    this._render();
  }

  _applyGenerate(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._generating = false;
    if (p.error) { this._msg = { ok: false, text: p.error }; this._render(); return; }
    this._rows = (p.items || []).map((r) => ({ ...r, profitabilityScore: DEFAULT_PROFITABILITY, status: 'pending' }));
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
      this._period = monthOptions()[1];
      this._poolAmount = '';
      this._loadHistory();
    } else {
      this._msg = { ok: false, text: p.error || 'Save failed.' };
    }
    this._render();
  }

  _applyHistory(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._history = Array.isArray(p.items) ? p.items : [];
    this._historyLoaded = true;
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
      if (e.target.closest('[data-generate]')) return this._generate();
      if (e.target.closest('[data-save-run]')) return this._saveRun();
      if (e.target.closest('[data-new-run]')) return this._newRun();
      if (e.target.closest('[data-search]')) return this._searchHistory();
      const info = e.target.closest('[data-info]');
      if (info) return this._toggleInfo(Number(info.getAttribute('data-info')));
      const confirmBtn = e.target.closest('[data-confirm]');
      if (confirmBtn) return this._setStatus(Number(confirmBtn.getAttribute('data-confirm')), 'confirmed');
      const excludeBtn = e.target.closest('[data-exclude]');
      if (excludeBtn) return this._setStatus(Number(excludeBtn.getAttribute('data-exclude')), 'excluded');
      if (e.target.closest('[data-nav]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
    });
    this.shadowRoot.addEventListener('input', (e) => {
      const field = e.target.getAttribute && e.target.getAttribute('data-field');
      if (field === 'period') this._period = e.target.value;
      if (field === 'poolAmount') { this._poolAmount = e.target.value; if (this._rows) this._renderTable(); }
      const rowField = e.target.getAttribute && e.target.getAttribute('data-row-field');
      if (rowField === 'profitabilityScore' && this._rows) {
        const i = Number(e.target.getAttribute('data-row-index'));
        this._rows[i].profitabilityScore = e.target.value;
        this._renderTable();
      }
    });
    this.shadowRoot.addEventListener('change', (e) => {
      if (e.target.getAttribute && e.target.getAttribute('data-field') === 'period') this._period = e.target.value;
    });
    this.shadowRoot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'hq') { e.preventDefault(); this._searchHistory(); }
    });
  }

  _generate() {
    if (this._generating) return;
    this._generating = true;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('generate-run', { detail: {}, bubbles: true, composed: true }));
  }

  _newRun() {
    this._rows = null;
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
      employeeId: r.employeeId, employeeName: r.employeeName,
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

  _searchHistory() {
    const term = (this._$('hq') && this._$('hq').value || '').trim();
    this.dispatchEvent(new CustomEvent('list-history', { detail: { term }, bubbles: true, composed: true }));
  }

  _loadHistory() {
    this.dispatchEvent(new CustomEvent('list-history', { detail: { term: '' }, bubbles: true, composed: true }));
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
      ${this._rows ? this._reviewSection() : this._startSection()}
      ${this._historySection()}
      <button class="link" data-nav>← Back to the Hub</button>`;
  }

  _startSection() {
    const opts = monthOptions().map((m) => `<option value="${esc(m)}" ${this._period === m ? 'selected' : ''}>${esc(m)}</option>`).join('');
    return `<div class="section card" style="padding:18px 20px">
      <h2>Start a bonus run</h2>
      <div class="row2">
        <div><label class="f">Period</label>
          <select data-field="period">${opts}</select></div>
        <div><label class="f">Bonus Pool</label>
          <input type="number" step="0.01" data-field="poolAmount" placeholder="0.00" value="${esc(this._poolAmount)}"></div>
      </div>
      <button class="btn ${this._generating ? 'is-loading' : ''}" data-generate style="margin-top:16px">
        ${this._generating ? '<span class="btn-spinner"></span>Generating…' : 'Generate suggested payouts'}</button>
    </div>`;
  }

  _reviewSection() {
    const total = (this._rows || []).length;
    const reviewed = (this._rows || []).filter((r) => r.status !== 'pending').length;
    const done = reviewed === total && total > 0;
    return `<div class="section card" style="padding:18px 20px" id="reviewCard">
      <h2>Review — ${esc(this._period) || '(no period set)'}</h2>
      <div class="disclaimer">These are SUGGESTED figures — Profitability defaults to 3 for everyone since it isn't a solved calculation yet. Confirm (✓) or exclude (✗) every person before saving; excluding someone recalculates everyone else's share.</div>
      <div id="tableHolder">${this._tableHtml()}</div>
      <div class="review-progress ${done ? 'done' : ''}">${reviewed} of ${total} reviewed</div>
      <div style="display:flex;gap:10px;margin-top:8px">
        <button class="btn ${this._saving ? 'is-loading' : ''}" data-save-run ${done && !this._saving ? '' : 'disabled'}>
          ${this._saving ? '<span class="btn-spinner"></span>Saving…' : 'Save payouts'}</button>
        <button class="btn ghost" data-new-run>Start over</button>
      </div>
    </div>`;
  }

  // Rebuilds the whole table (every share/suggested-bonus cell can change from one edit), but a
  // naive innerHTML replace would steal focus out from under whichever input the person is
  // actively typing in — so remember which field was focused and restore focus + cursor after.
  _renderTable() {
    const holder = this._$('tableHolder');
    if (!holder) return;
    const active = this.shadowRoot.activeElement;
    const focusField = active && active.getAttribute && active.getAttribute('data-row-field');
    const focusIndex = active && active.getAttribute && active.getAttribute('data-row-index');
    const selStart = active && active.selectionStart;
    const selEnd = active && active.selectionEnd;

    holder.innerHTML = this._tableHtml();

    if (focusField != null && focusIndex != null) {
      const next = holder.querySelector(`[data-row-field="${focusField}"][data-row-index="${focusIndex}"]`);
      if (next) {
        next.focus();
        if (typeof selStart === 'number' && next.setSelectionRange) {
          try { next.setSelectionRange(selStart, selEnd); } catch (e) { /* type=number inputs don't support range selection in some browsers */ }
        }
      }
    }
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

    const rows = computed.map((r, i) => {
      const excluded = r.status === 'excluded';
      const row = `<tr class="${excluded ? 'excluded' : ''}">
        <td><div class="name-cell">
          <button type="button" class="info-btn ${this._openInfo === i ? 'open' : ''}" data-info="${i}" aria-label="Score breakdown">i</button>
          <span class="name">${esc(r.employeeName)}</span>
        </div></td>
        <td>${r.reliabilityScore.toFixed(2)}${!r.hasAssessmentData ? '<span class="flag">no recent assessments</span>' : ''}<div class="share">${pct(r.reliabilityShare)} share</div></td>
        <td><input type="number" step="0.1" data-row-field="profitabilityScore" data-row-index="${i}" value="${esc(r.profitabilityScore)}" ${excluded ? 'disabled' : ''}><div class="share">${pct(r.profitabilityShare)} share</div></td>
        <td>${r.tenureYears.toFixed(2)}${!r.hasStartDate ? '<span class="flag">no start date</span>' : ''}<div class="share">${pct(r.tenureShare)} share</div></td>
        <td class="suggested">${money(r.suggestedBonus)}</td>
        <td><div class="review-actions">
          <button type="button" class="review-btn confirm ${r.status === 'confirmed' ? 'sel' : ''}" data-confirm="${i}" title="Confirm">✓</button>
          <button type="button" class="review-btn exclude ${excluded ? 'sel' : ''}" data-exclude="${i}" title="Exclude">✗</button>
        </div></td>
      </tr>`;
      return this._openInfo === i ? row + this._detailRow(r, i) : row;
    }).join('');

    return breakdown + `<div class="tbl-wrap"><table class="bonus-tbl">
      <thead><tr><th>Employee</th><th>Reliability</th><th>Profitability</th><th>Tenure (yrs)</th><th>Suggested</th><th>Review</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  _historySection() {
    return `<div class="section">
      <h2>Payout history</h2>
      <div class="searchbar">
        <input type="text" id="hq" placeholder="Search employee or period…">
        <button class="btn" data-search>Search</button>
      </div>
      <div class="list">${this._historyBody()}</div>
    </div>`;
  }

  _historyBody() {
    if (!this._historyLoaded) return `<p class="empty">Loading history…</p>`;
    if (!this._history.length) return `<p class="empty">No payouts saved yet.</p>`;
    return this._history.map((c) => this._historyCard(c)).join('');
  }

  _historyCard(c) {
    const meta = [c.period, c.createdDate, c.enteredByName ? `by ${c.enteredByName}` : ''].filter(Boolean).map(esc).join(' · ');
    const excluded = c.status === 'excluded';
    return `<div class="calc card">
      <div class="top">
        <div class="name">${esc(c.employeeName)}</div>
        ${excluded ? '<span class="pill excluded">Excluded</span>' : ''}
        <div class="amount">${money(c.actualPayout)}</div>
      </div>
      ${meta ? `<div class="meta">${meta}</div>` : ''}
      ${!excluded ? `<div class="meta">Reliability ${pct(c.reliabilityShare)} · Profitability ${pct(c.profitabilityShare)} · Tenure ${pct(c.tenureShare)} · Pool ${money(c.poolAmount)}</div>` : ''}
    </div>`;
  }
}

customElements.define('bonus-calculator', BonusCalculator);
