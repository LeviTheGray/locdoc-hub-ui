/**
 * Wix Custom Element — Bonus Payout Calculator  (<bonus-calculator>)
 *
 * A line-item calculator, not a fixed formula: the actual payout formula isn't settled yet, so v1
 * lets Operations/C-Suite build a payout out of freeform labeled line items (e.g. "Q3 sales
 * bonus", "Safety bonus") that sum to a total, rather than guessing at a calculation that would
 * likely be wrong. Each calculation is saved as a payout record for one employee — append-only,
 * no edit/delete — so there's a running history instead of a one-off number nobody wrote down.
 *
 * Data handoff:
 *   • Velo → element :  init-data      { canManage, employees:[{_id,name}] } | { error }
 *                       history-result { items:[Calc] } | { error }                 (carries _ts)
 *                       save-result    { ok:true, calc:Calc } | { ok:false, error }  (carries _ts)
 *   • element → Velo :  'list-history'  { term }
 *                       'save-calc'     { calc: { employeeId, period, lineItems:[{label,amount}], notes } }
 *                       'navigate'      { key: 'hub' }
 *
 * Calc shape (as returned/stored): { _id, employeeId, employeeName, period, lineItems, total,
 * notes, enteredByName, createdDate }. `total` is computed server-side from lineItems, never
 * trusted from the client.
 *
 * The backend re-checks authorization on every method (backend/bonusCalculator.web.js) — the
 * `canManage` flag here only decides what UI to paint.
 *
 * Editor setup: Add → Embed Code → Custom Element → this file, tag `bonus-calculator`,
 * element ID `bonusCalculator`.
 */

import { styles, ensureMaterialSymbols } from './tokens.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(n) { return `$${(Number(n) || 0).toFixed(2)}`; }

const STYLES = styles(`
  .main { max-width: 820px; margin: 0 auto; padding: 24px 16px 56px; }
  .sub { font-size: 14px; color: var(--gray-600); margin-bottom: 20px; }
  .section { margin-top: 24px; }
  .section h2 { font-size: 15px; font-weight: 700; margin-bottom: 12px; }
  label.f { display: block; font-size: 13px; font-weight: 700; margin: 14px 0 5px; }
  input[type=text], input[type=number], select, textarea { width: 100%; padding: 10px 12px; border: 1.5px solid var(--gray-200);
    border-radius: 8px; font-size: 15px; font-family: inherit; background: #fff; }
  textarea { min-height: 56px; resize: vertical; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--primary); }
  .row2 { display: flex; gap: 12px; } .row2 > div { flex: 1; }
  .line-item { display: flex; gap: 8px; align-items: flex-end; margin-bottom: 10px; }
  .line-item .lbl { flex: 2; } .line-item .amt { flex: 1; }
  .line-item .rm { flex-shrink: 0; background: var(--gray-100); border: none; border-radius: 8px; width: 40px; height: 40px; font-size: 16px; color: var(--gray-600); cursor: pointer; }
  .line-item .rm:hover { background: #fee2e2; color: #b91c1c; }
  .total-row { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-top: 1px solid var(--gray-200); margin-top: 6px; }
  .total-row .l { font-size: 14px; font-weight: 700; color: var(--gray-600); }
  .total-row .v { font-size: 22px; font-weight: 800; color: var(--primary-dk); }
  .searchbar { display: flex; gap: 8px; }
  .searchbar input { flex: 1; }
  .searchbar .btn { flex-shrink: 0; }
  .list { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }
  .calc { padding: 14px 16px 16px; }
  .calc .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .calc .name { font-size: 15px; font-weight: 700; }
  .calc .amount { font-size: 16px; font-weight: 800; color: var(--primary-dk); margin-left: auto; }
  .calc .meta { font-size: 12px; color: var(--gray-600); margin-top: 4px; }
  .calc .items { margin-top: 8px; font-size: 13px; color: var(--gray-900); }
  .calc .items div { display: flex; justify-content: space-between; padding: 2px 0; }
  .empty { font-size: 13px; color: var(--gray-400); padding: 12px 0; }
  .msg { margin-top: 16px; padding: 12px 14px; border-radius: 8px; font-size: 14px; display: none; }
  .msg.err { display: block; background: #fee2e2; color: #b91c1c; }
  .msg.ok  { display: block; background: #d1fae5; color: var(--primary-dk); }
  .link { background: none; border: none; color: var(--primary-dk); font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 20px; }
  .btn.ghost { background: var(--gray-100); color: var(--gray-900); }
  .btn.ghost:hover { background: var(--gray-200); }
  @media (max-width: 560px) { .row2 { flex-direction: column; } }
`);

function blankLineItem() { return { label: '', amount: '' }; }

class BonusCalculator extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'history-result', 'save-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._canManage = false;
    this._loaded = false;
    this._error = null;
    this._employees = [];
    this._history = [];
    this._historyLoaded = false;
    this._saving = false;
    this._msg = null;
    this._draft = { employeeId: '', period: '', notes: '', lineItems: [blankLineItem()] };
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
    if (name === 'init-data')      this._applyInit(value);
    if (name === 'history-result') this._applyHistory(value);
    if (name === 'save-result')    this._applySave(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _applyInit(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._canManage = Boolean(p.canManage);
    this._employees = Array.isArray(p.employees) ? p.employees : [];
    this._error = p.error || null;
    this._loaded = true;
    if (this._canManage && !this._historyLoaded) this._loadHistory();
    this._render();
  }

  _applyHistory(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._history = Array.isArray(p.items) ? p.items : [];
    this._historyLoaded = true;
    this._render();
  }

  _applySave(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._saving = false;
    if (p.ok && p.calc) {
      this._history.unshift(p.calc);
      this._msg = { ok: true, text: `Saved — ${money(p.calc.total)} for ${p.calc.employeeName}.` };
      this._draft = { employeeId: '', period: '', notes: '', lineItems: [blankLineItem()] };
    } else {
      this._msg = { ok: false, text: p.error || 'Save failed.' };
    }
    this._render();
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <header class="header"><h1>💰 Bonus Payout Calculator</h1>
        <p>Build a payout from line items and save it — a running history, not a one-off number.</p></header>
      <main class="main" data-main></main>`;

    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.closest('[data-add-line]')) return this._addLine();
      const rm = e.target.closest('[data-rm-line]');
      if (rm) return this._removeLine(Number(rm.getAttribute('data-rm-line')));
      if (e.target.closest('[data-save]')) return this._save();
      if (e.target.closest('[data-search]')) return this._searchHistory();
      if (e.target.closest('[data-nav]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
    });
    this.shadowRoot.addEventListener('input', (e) => {
      const field = e.target.getAttribute && e.target.getAttribute('data-field');
      if (field) { this._draft[field] = e.target.value; if (field !== 'notes') this._renderTotal(); }
      const lineField = e.target.getAttribute && e.target.getAttribute('data-line-field');
      if (lineField) {
        const i = Number(e.target.getAttribute('data-line-index'));
        this._draft.lineItems[i][lineField] = e.target.value;
        this._renderTotal();
      }
    });
    this.shadowRoot.addEventListener('change', (e) => {
      const field = e.target.getAttribute && e.target.getAttribute('data-field');
      if (field === 'employeeId') this._draft.employeeId = e.target.value;
    });
    this.shadowRoot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'hq') { e.preventDefault(); this._searchHistory(); }
    });
  }

  _addLine() {
    this._draft.lineItems.push(blankLineItem());
    this._render();
  }

  _removeLine(i) {
    if (this._draft.lineItems.length <= 1) return;
    this._draft.lineItems.splice(i, 1);
    this._render();
  }

  _total() {
    return this._draft.lineItems.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);
  }

  _renderTotal() {
    const el = this._$('totalValue');
    if (el) el.textContent = money(this._total());
  }

  _save() {
    if (this._saving) return;
    const d = this._draft;
    if (!d.employeeId) { this._msg = { ok: false, text: 'Select an employee.' }; return this._render(); }
    const lineItems = d.lineItems.filter((li) => (li.label || '').trim() || Number(li.amount));
    if (!lineItems.length) { this._msg = { ok: false, text: 'Add at least one line item.' }; return this._render(); }

    this._saving = true;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('save-calc', {
      detail: { calc: { employeeId: d.employeeId, period: d.period.trim(), notes: d.notes.trim(), lineItems } },
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
      ${this._formSection()}
      ${this._historySection()}
      <button class="link" data-nav>← Back to the Hub</button>`;
  }

  _formSection() {
    const d = this._draft;
    const empOpts = this._employees.map((e) => `<option value="${esc(e._id)}" ${d.employeeId === e._id ? 'selected' : ''}>${esc(e.name)}</option>`).join('');
    const lines = d.lineItems.map((li, i) => `
      <div class="line-item">
        <div class="lbl"><input type="text" placeholder="e.g. Q3 sales bonus" data-line-field="label" data-line-index="${i}" value="${esc(li.label)}"></div>
        <div class="amt"><input type="number" step="0.01" placeholder="0.00" data-line-field="amount" data-line-index="${i}" value="${esc(li.amount)}"></div>
        <button type="button" class="rm" data-rm-line="${i}" title="Remove line">×</button>
      </div>`).join('');

    return `<div class="section card" style="padding:18px 20px">
      <h2>New calculation</h2>
      <div class="row2">
        <div><label class="f">Employee</label>
          <select data-field="employeeId"><option value="">— Select —</option>${empOpts}</select></div>
        <div><label class="f">Period <span style="font-weight:400;color:var(--gray-400)">(optional — e.g. "Q3 2026")</span></label>
          <input type="text" data-field="period" value="${esc(d.period)}"></div>
      </div>
      <label class="f">Line items</label>
      ${lines}
      <button type="button" class="btn ghost" data-add-line style="margin-top:4px">+ Add line item</button>
      <div class="total-row"><span class="l">Total</span><span class="v" id="totalValue">${money(this._total())}</span></div>
      <label class="f">Notes <span style="font-weight:400;color:var(--gray-400)">(optional)</span></label>
      <textarea data-field="notes">${esc(d.notes)}</textarea>
      <button class="btn ${this._saving ? 'is-loading' : ''}" data-save style="margin-top:16px">
        ${this._saving ? '<span class="btn-spinner"></span>Saving…' : 'Save calculation'}</button>
    </div>`;
  }

  _historySection() {
    return `<div class="section">
      <h2>Payout history</h2>
      <div class="searchbar">
        <input type="text" id="hq" placeholder="Search employee, period, notes…">
        <button class="btn" data-search>Search</button>
      </div>
      <div class="list">${this._historyBody()}</div>
    </div>`;
  }

  _historyBody() {
    if (!this._historyLoaded) return `<p class="empty">Loading history…</p>`;
    if (!this._history.length) return `<p class="empty">No calculations saved yet.</p>`;
    return this._history.map((c) => this._calcCard(c)).join('');
  }

  _calcCard(c) {
    const items = (c.lineItems || []).map((li) => `<div><span>${esc(li.label || '(no label)')}</span><span>${money(li.amount)}</span></div>`).join('');
    const meta = [c.period, c.createdDate, c.enteredByName ? `by ${c.enteredByName}` : ''].filter(Boolean).map(esc).join(' · ');
    return `<div class="calc card">
      <div class="top">
        <div class="name">${esc(c.employeeName)}</div>
        <div class="amount">${money(c.total)}</div>
      </div>
      ${meta ? `<div class="meta">${meta}</div>` : ''}
      <div class="items">${items}</div>
      ${c.notes ? `<div class="meta">${esc(c.notes)}</div>` : ''}
    </div>`;
  }
}

customElements.define('bonus-calculator', BonusCalculator);
