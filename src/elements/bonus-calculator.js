/**
 * Wix Custom Element — Bonus Payout Calculator  (<bonus-calculator>)
 *
 * Implements the real bonus formula (from the old Quickbase-era app, provided by Levi
 * 2026-08-26): a Bonus Pool ($, entered manually — margin isn't tracked here) splits 50%
 * Reliability / 35% Profitability / 15% Tenure. Each eligible employee's share of a dimension's
 * pool = their raw score in that dimension ÷ the sum of that score across every eligible
 * employee, so suggestedBonus = Σ(share × pool) over the three dimensions.
 *
 * Two-step flow:
 *   1. Enter a period label + pool amount, click Generate → backend returns every eligible
 *      employee's raw Reliability score (from AssessmentScores, trailing 190 days) and Tenure
 *      years (from Employees.startDate).
 *   2. Review table, one row per employee. Reliability/Tenure are read-only (computed).
 *      Profitability isn't a solved formula yet — the old app defaulted it to a flat 3 — so it's
 *      an editable number here, defaulting to 3, VISIBLY a placeholder rather than a hidden
 *      constant. Editing any Profitability value live-recomputes every row's shares and suggested
 *      bonus (that dimension's sum-across-everyone changed) — all done here in the browser, not a
 *      round trip, so the whole formula stays legible instead of a black box. Actual Payout
 *      defaults to the suggested bonus but is freely editable — the confirm/override step.
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
 * RawRow: { employeeId, employeeName, reliabilityScore, hasAssessmentData, tenureYears, hasStartDate }
 * FinalRow (what gets saved): RawRow's employeeId/employeeName plus reliabilityShare,
 * profitabilityScore, profitabilityShare, tenureShare, suggestedBonus, actualPayout.
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

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(n) { return `$${(Number(n) || 0).toFixed(2)}`; }
function pct(n) { return `${((Number(n) || 0) * 100).toFixed(1)}%`; }

const STYLES = styles(`
  .main { max-width: 1040px; margin: 0 auto; padding: 24px 16px 56px; }
  .sub { font-size: 14px; color: var(--gray-600); margin-bottom: 20px; }
  .section { margin-top: 24px; }
  .section h2 { font-size: 15px; font-weight: 700; margin-bottom: 12px; }
  label.f { display: block; font-size: 13px; font-weight: 700; margin: 14px 0 5px; }
  input[type=text], input[type=number] { padding: 10px 12px; border: 1.5px solid var(--gray-200);
    border-radius: 8px; font-size: 15px; font-family: inherit; background: #fff; width: 100%; }
  input:focus { outline: none; border-color: var(--primary); }
  .row2 { display: flex; gap: 12px; } .row2 > div { flex: 1; }
  .disclaimer { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #92400e; margin-bottom: 16px; }
  .pool-breakdown { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
  .pool-tile { background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 10px; padding: 12px 16px; flex: 1; min-width: 140px; }
  .pool-tile .l { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--gray-400); }
  .pool-tile .v { font-size: 18px; font-weight: 800; margin-top: 2px; }
  .tbl-wrap { overflow-x: auto; }
  table.bonus-tbl { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 900px; }
  table.bonus-tbl th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: var(--gray-400); padding: 8px 10px; border-bottom: 2px solid var(--gray-200); white-space: nowrap; }
  table.bonus-tbl td { padding: 8px 10px; border-bottom: 1px solid var(--gray-100); vertical-align: middle; }
  table.bonus-tbl input[type=number] { width: 80px; padding: 6px 8px; font-size: 13px; }
  table.bonus-tbl .name { font-weight: 700; }
  table.bonus-tbl .flag { font-size: 10px; font-weight: 700; color: #b91c1c; display: block; }
  table.bonus-tbl .share { color: var(--gray-500); font-size: 11px; }
  table.bonus-tbl .suggested { font-weight: 800; color: var(--primary-dk); }
  .searchbar { display: flex; gap: 8px; }
  .searchbar input { flex: 1; }
  .searchbar .btn { flex-shrink: 0; }
  .list { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }
  .calc { padding: 14px 16px 16px; }
  .calc .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .calc .name { font-size: 15px; font-weight: 700; }
  .calc .amount { font-size: 16px; font-weight: 800; color: var(--primary-dk); margin-left: auto; }
  .calc .meta { font-size: 12px; color: var(--gray-600); margin-top: 4px; }
  .empty { font-size: 13px; color: var(--gray-400); padding: 12px 0; }
  .msg { margin-top: 16px; padding: 12px 14px; border-radius: 8px; font-size: 14px; display: none; }
  .msg.err { display: block; background: #fee2e2; color: #b91c1c; }
  .msg.ok  { display: block; background: #d1fae5; color: var(--primary-dk); }
  .link { background: none; border: none; color: var(--primary-dk); font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 20px; }
  .btn.ghost { background: var(--gray-100); color: var(--gray-900); }
  .btn.ghost:hover { background: var(--gray-200); }
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
    this._period = '';
    this._poolAmount = '';
    this._rows = null;       // null until a run is generated
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
    this._rows = (p.items || []).map((r) => ({ ...r, profitabilityScore: DEFAULT_PROFITABILITY, actualPayout: null, actualPayoutTouched: false }));
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
      this._period = '';
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
      if (e.target.closest('[data-nav]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
    });
    this.shadowRoot.addEventListener('input', (e) => {
      const field = e.target.getAttribute && e.target.getAttribute('data-field');
      if (field === 'period') this._period = e.target.value;
      if (field === 'poolAmount') { this._poolAmount = e.target.value; if (this._rows) this._renderTable(); }
      const rowField = e.target.getAttribute && e.target.getAttribute('data-row-field');
      if (rowField && this._rows) {
        const i = Number(e.target.getAttribute('data-row-index'));
        if (rowField === 'profitabilityScore') this._rows[i].profitabilityScore = e.target.value;
        if (rowField === 'actualPayout') { this._rows[i].actualPayout = e.target.value; this._rows[i].actualPayoutTouched = true; }
        this._renderTable();
      }
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
    this._msg = null;
    this._render();
  }

  // Sums, shares, and each row's suggested bonus — recomputed from current state (including
  // whatever's been typed into Profitability) every time this is called, never cached.
  _computeShares() {
    const pool = Number(this._poolAmount) || 0;
    const pools = { reliability: pool * SPLIT.reliability, profitability: pool * SPLIT.profitability, tenure: pool * SPLIT.tenure };
    const rows = this._rows || [];
    const sums = { reliability: 0, profitability: 0, tenure: 0 };
    rows.forEach((r) => {
      sums.reliability += Number(r.reliabilityScore) || 0;
      sums.profitability += Number(r.profitabilityScore) || 0;
      sums.tenure += Number(r.tenureYears) || 0;
    });
    return rows.map((r) => {
      const reliabilityShare = sums.reliability ? (Number(r.reliabilityScore) || 0) / sums.reliability : 0;
      const profitabilityShare = sums.profitability ? (Number(r.profitabilityScore) || 0) / sums.profitability : 0;
      const tenureShare = sums.tenure ? (Number(r.tenureYears) || 0) / sums.tenure : 0;
      const suggestedBonus = reliabilityShare * pools.reliability + profitabilityShare * pools.profitability + tenureShare * pools.tenure;
      return { ...r, reliabilityShare, profitabilityShare, tenureShare, suggestedBonus };
    });
  }

  _saveRun() {
    if (this._saving || !this._rows) return;
    const computed = this._computeShares();
    const records = computed.map((r) => ({
      employeeId: r.employeeId, employeeName: r.employeeName,
      reliabilityScore: r.reliabilityScore, reliabilityShare: r.reliabilityShare,
      profitabilityScore: Number(r.profitabilityScore) || 0, profitabilityShare: r.profitabilityShare,
      tenureYears: r.tenureYears, tenureShare: r.tenureShare,
      suggestedBonus: r.suggestedBonus,
      actualPayout: r.actualPayoutTouched && r.actualPayout !== null ? (Number(r.actualPayout) || 0) : r.suggestedBonus,
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
    return `<div class="section card" style="padding:18px 20px">
      <h2>Start a bonus run</h2>
      <div class="row2">
        <div><label class="f">Period <span style="font-weight:400;color:var(--gray-400)">(e.g. "Q3 2026")</span></label>
          <input type="text" data-field="period" value="${esc(this._period)}"></div>
        <div><label class="f">Bonus Pool</label>
          <input type="number" step="0.01" data-field="poolAmount" placeholder="0.00" value="${esc(this._poolAmount)}"></div>
      </div>
      <button class="btn ${this._generating ? 'is-loading' : ''}" data-generate style="margin-top:16px">
        ${this._generating ? '<span class="btn-spinner"></span>Generating…' : 'Generate suggested payouts'}</button>
    </div>`;
  }

  _reviewSection() {
    return `<div class="section card" style="padding:18px 20px" id="reviewCard">
      <h2>Review — ${esc(this._period) || '(no period set)'}</h2>
      <div class="disclaimer">These are SUGGESTED figures from the formula below — Profitability defaults to 3 for everyone since it isn't a solved calculation yet. Review and adjust before treating any number as final.</div>
      <div id="tableHolder">${this._tableHtml()}</div>
      <div style="display:flex;gap:10px;margin-top:16px">
        <button class="btn ${this._saving ? 'is-loading' : ''}" data-save-run>
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
      const payoutVal = r.actualPayoutTouched && r.actualPayout !== null ? r.actualPayout : r.suggestedBonus.toFixed(2);
      return `<tr>
        <td class="name">${esc(r.employeeName)}</td>
        <td>${r.reliabilityScore.toFixed(2)}${!r.hasAssessmentData ? '<span class="flag">no recent assessments</span>' : ''}<div class="share">${pct(r.reliabilityShare)} share</div></td>
        <td><input type="number" step="0.1" data-row-field="profitabilityScore" data-row-index="${i}" value="${esc(r.profitabilityScore)}"><div class="share">${pct(r.profitabilityShare)} share</div></td>
        <td>${r.tenureYears.toFixed(2)}${!r.hasStartDate ? '<span class="flag">no start date</span>' : ''}<div class="share">${pct(r.tenureShare)} share</div></td>
        <td class="suggested">${money(r.suggestedBonus)}</td>
        <td><input type="number" step="0.01" data-row-field="actualPayout" data-row-index="${i}" value="${payoutVal}"></td>
      </tr>`;
    }).join('');

    return breakdown + `<div class="tbl-wrap"><table class="bonus-tbl">
      <thead><tr><th>Employee</th><th>Reliability</th><th>Profitability</th><th>Tenure (yrs)</th><th>Suggested</th><th>Actual payout</th></tr></thead>
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
    const overridden = Math.round((c.actualPayout || 0) * 100) !== Math.round((c.suggestedBonus || 0) * 100);
    return `<div class="calc card">
      <div class="top">
        <div class="name">${esc(c.employeeName)}</div>
        <div class="amount">${money(c.actualPayout)}${overridden ? ` <span class="share">(suggested ${money(c.suggestedBonus)})</span>` : ''}</div>
      </div>
      ${meta ? `<div class="meta">${meta}</div>` : ''}
      <div class="meta">Reliability ${pct(c.reliabilityShare)} · Profitability ${pct(c.profitabilityShare)} · Tenure ${pct(c.tenureShare)} · Pool ${money(c.poolAmount)}</div>
    </div>`;
  }
}

customElements.define('bonus-calculator', BonusCalculator);
