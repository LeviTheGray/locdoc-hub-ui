/**
 * Wix Custom Element — Credit Card Report  (<credit-card-report>)
 *
 * Standalone report (not yet on the Wednesday Meeting deck — add as a Reports sub-tab there
 * once this has run for a while and looks right). Read-only, no per-employee data: shows each
 * department's receipt-upload percentage as one WEIGHTED aggregate (sum of receipts / sum of
 * purchases across everyone in the department), not an average of individual percentages —
 * a department with 100 purchases and 99 receipts scores 99% even if one person in it is at 0%.
 * No individual names, scores, or callouts anywhere on this page by design.
 *
 * Source data: the `ExpenseTracking` collection, synced weekly by n8n from a Google Sheet that
 * already computes each employee's rolling 28-day (4-week) totals — this page does no time-
 * window math itself, it just aggregates whatever's currently in the collection by department.
 *
 * Data handoff:
 *   • Velo → element :  init-data { companyPercentage, companyPurchases, companyReceipts,
 *                                   departmentCount, departments: [{ department, totalPurchases,
 *                                   receiptsUploaded, employeeCount, percentage }] } | { error }
 *   • element → Velo :  'navigate' { detail: { key: 'hub' } }
 *
 * Editor: Add → Embed Code → Custom Element → source = this file,
 * tag name `credit-card-report`, element ID `creditCardReport`.
 */

import { TOKENS } from './tokens.js';

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function scoreColor(s) { return s == null ? 'var(--gray-400)' : s >= 90 ? 'var(--green)' : s >= 70 ? 'var(--amber)' : 'var(--red)'; }
function pillClass(s) { return s == null ? '' : s >= 90 ? 'ok' : s >= 70 ? 'warn' : 'bad'; }
function pct(v) { return v == null ? '—' : `${v}%`; }

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ${TOKENS}
  :host { --amber:#f59e0b; --red:#ef4444; background:var(--gray-50); display:block; }
  .backbtn { display:inline-flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; color:#6b7280; font:600 13px system-ui,-apple-system,sans-serif; padding:12px 16px 0; }
  .header { background: var(--primary); color: #fff; padding: 16px 24px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p  { font-size: 12px; opacity: .75; margin-top: 2px; }
  .main { max-width: 920px; margin: 0 auto; padding: 28px 16px; }
  .loading-state { text-align: center; padding: 64px 0; color: var(--gray-400); font-size: 15px; }
  .card { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 22px; box-shadow: var(--shadow); margin-bottom: 20px; }
  .card-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .card-sub { font-size: 12px; color: var(--gray-500); margin-bottom: 16px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .stat { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); }
  .stat .v { font-size: 24px; font-weight: 800; }
  .stat .l { font-size: 11px; color: var(--gray-400); margin-top: 2px; text-transform: uppercase; letter-spacing: .03em; }
  .dept-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .dept-card { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 18px; box-shadow: var(--shadow); }
  .dept-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .dept-name { font-size: 14px; font-weight: 700; }
  .pill { font-size: 11px; font-weight: 700; border-radius: 100px; padding: 3px 10px; margin-left: auto; white-space: nowrap; }
  .pill.ok { background: #dcfce7; color: #14532d; } .pill.warn { background: #fef9c3; color: #78350f; } .pill.bad { background: #fee2e2; color: #991b1b; }
  .track { height: 10px; background: var(--gray-100); border-radius: 100px; overflow: hidden; margin-bottom: 10px; }
  .fill { height: 100%; border-radius: 100px; }
  .dept-meta { font-size: 12px; color: var(--gray-500); }
  .empty-state { text-align: center; padding: 48px 24px; color: var(--gray-400); font-size: 14px; }
`;

class CreditCardReport extends HTMLElement {
  static get observedAttributes() { return ['init-data']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._departments = [];
    this._companyPercentage = null;
    this._companyPurchases = 0;
    this._companyReceipts = 0;
  }

  connectedCallback() {
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyInit(this.getAttribute('init-data'));
  }

  attributeChangedCallback(name, _old, value) {
    if (name === 'init-data' && value) this._applyInit(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <button class="backbtn" data-action="back-hub">&#8592; Back to Employee Hub</button>
      <header class="header"><h1>Credit Card Report</h1><p>LocDoc · Employee Hub</p></header>
      <main class="main">
        <div id="loadingState" class="loading-state">Loading…</div>
        <div id="report" style="display:none">
          <div class="stats" id="stats"></div>
          <div class="card">
            <div class="card-title">By Department</div>
            <div class="card-sub">Receipt uploads as a share of total purchases, over the current rolling 4-week window.</div>
            <div class="dept-grid" id="deptGrid"></div>
          </div>
        </div>
      </main>`;

    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="back-hub"]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
    });
  }

  _applyInit(json) {
    let p;
    try { p = JSON.parse(json); } catch (e) { p = { error: 'Failed to load.' }; }
    if (p.error) { this._$('loadingState').innerHTML = `<span style="color:#b91c1c">${esc(p.error)}</span>`; return; }
    this._departments = p.departments || [];
    this._companyPercentage = p.companyPercentage;
    this._companyPurchases = p.companyPurchases || 0;
    this._companyReceipts = p.companyReceipts || 0;
    this._$('loadingState').style.display = 'none';
    this._$('report').style.display = '';
    this._render();
  }

  _render() {
    const stats = [
      { v: pct(this._companyPercentage), l: 'Company Receipt %' },
      { v: this._companyPurchases, l: 'Total Purchases' },
      { v: this._companyReceipts, l: 'Receipts Uploaded' },
      { v: this._departments.length, l: 'Departments' },
    ];
    this._$('stats').innerHTML = stats.map(s => `<div class="stat"><div class="v">${esc(String(s.v))}</div><div class="l">${s.l}</div></div>`).join('');

    if (!this._departments.length) {
      this._$('deptGrid').innerHTML = `<div class="empty-state">No expense data yet — check back once the weekly sync has run.</div>`;
      return;
    }

    this._$('deptGrid').innerHTML = this._departments.map(d => {
      const color = scoreColor(d.percentage);
      return `<div class="dept-card">
        <div class="dept-head">
          <div class="dept-name">${esc(d.department)}</div>
          <div class="pill ${pillClass(d.percentage)}">${pct(d.percentage)}</div>
        </div>
        <div class="track"><div class="fill" style="width:${d.percentage ?? 0}%;background:${color}"></div></div>
        <div class="dept-meta">${d.receiptsUploaded} of ${d.totalPurchases} purchases · ${d.employeeCount} ${d.employeeCount === 1 ? 'person' : 'people'}</div>
      </div>`;
    }).join('');
  }
}

customElements.define('credit-card-report', CreditCardReport);
