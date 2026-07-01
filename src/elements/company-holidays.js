/**
 * Wix Custom Element — Company Holidays  (<company-holidays>)
 *
 * The /holidays page. Two parts:
 *   1. A computed schedule for the CURRENT year — each observed holiday's actual date plus the day
 *      the office is closed. Weekend rule: Saturday → closed Friday, Sunday → closed Monday.
 *   2. The company Holiday policy doc (from the ProcessPoliciesTutorials CMS collection), embedded
 *      below the schedule and passed in via init-data by the page code.
 *
 * ⚠️ CONFIRM THE HOLIDAY LIST: the HOLIDAYS array below is a standard US default — edit it to the
 * holidays LocDoc actually observes. Dates are computed per year from the rule, so it stays correct
 * every year with no edits.
 *
 * Data handoff:
 *   • Velo → element : setAttribute('init-data', JSON.stringify({ doc: { title, body, docUrl, updated } }))
 *
 * Editor setup (one time): Add → Embed Code → Custom Element → choose this file, tag name
 * `company-holidays`, element ID `companyHolidays`, page Members-Only.
 */

import { TOKENS, ensureMaterialSymbols } from './tokens.js';

// ---- date-rule helpers (compute a holiday's date for a given year) ----
const fixed = (month, day) => (y) => new Date(y, month, day);
const nthWeekday = (month, weekday, n) => (y) => {         // n-th <weekday> of <month>
  const d = new Date(y, month, 1);
  const offset = (weekday - d.getDay() + 7) % 7;
  return new Date(y, month, 1 + offset + (n - 1) * 7);
};
const lastWeekday = (month, weekday) => (y) => {           // last <weekday> of <month>
  const d = new Date(y, month + 1, 0);                     // last day of month
  const offset = (d.getDay() - weekday + 7) % 7;
  return new Date(y, month + 1, 0 - offset);
};
const afterThanksgiving = () => (y) => {                   // day after 4th-Thursday-of-Nov
  const t = nthWeekday(10, 4, 4)(y);
  return new Date(y, 10, t.getDate() + 1);
};

// ⚠️ EDITABLE default set. Weekday numbers: Sun=0 … Sat=6. Months: Jan=0 … Dec=11.
const HOLIDAYS = [
  { name: "New Year's Day",        date: fixed(0, 1) },
  { name: 'Memorial Day',          date: lastWeekday(4, 1) },   // last Monday of May
  { name: 'Independence Day',      date: fixed(6, 4) },
  { name: 'Labor Day',             date: nthWeekday(8, 1, 1) },  // 1st Monday of September
  { name: 'Thanksgiving',          date: nthWeekday(10, 4, 4) }, // 4th Thursday of November
  { name: 'Day after Thanksgiving', date: afterThanksgiving() },
  { name: 'Christmas Eve',         date: fixed(11, 24) },
  { name: 'Christmas Day',         date: fixed(11, 25) },
];

const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// Office-closed day: Sat → Friday before, Sun → Monday after, else the day itself.
function observed(d) {
  const day = d.getDay();
  if (day === 6) return { date: addDays(d, -1), adjusted: true };
  if (day === 0) return { date: addDays(d, 1),  adjusted: true };
  return { date: d, adjusted: false };
}
const fmtFull  = (d) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const fmtShort = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const STYLES = `
  ${TOKENS}
  :host { background: var(--gray-50); }
  .header { background: var(--primary); color: #fff; padding: 14px 24px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p  { font-size: 12px; opacity: .75; margin-top: 2px; }
  .hero { background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dk) 100%); color: #fff; padding: 40px 24px; text-align: center; }
  .hero h2 { font-size: 27px; font-weight: 800; line-height: 1.2; }
  .hero p  { font-size: 15px; opacity: .92; margin: 10px auto 0; max-width: 560px; line-height: 1.5; }

  .main { max-width: 860px; margin: 0 auto; padding: 36px 16px 56px; }
  .section-title { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--gray-400); padding-bottom: 12px; margin-bottom: 18px; border-bottom: 1px solid var(--gray-200); }

  .sched { background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; }
  .row { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 12px; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--gray-200); }
  .row:last-child { border-bottom: none; }
  .row.head { background: var(--surface); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--gray-400); padding: 10px 18px; }
  .h-name { font-size: 15px; font-weight: 700; color: var(--gray-900); }
  .h-date { font-size: 14px; color: var(--gray-600); }
  .h-closed { font-size: 14px; font-weight: 700; color: var(--primary-dk); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; background: var(--icon-chip-bg); color: var(--primary-dk); padding: 2px 8px; border-radius: 999px; }
  .note { font-size: 12px; color: var(--gray-400); margin-top: 12px; }

  /* Embedded policy doc */
  .doc { margin-top: 44px; }
  .doc-body { background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius); box-shadow: var(--shadow); padding: 26px; font-size: 15px; line-height: 1.65; color: var(--gray-900); }
  .doc-body p { margin: 0 0 12px; } .doc-body p:last-child { margin-bottom: 0; }
  .doc-body h1,.doc-body h2,.doc-body h3 { margin: 18px 0 8px; line-height: 1.3; }
  .doc-body ul,.doc-body ol { margin: 0 0 12px 22px; } .doc-body li { margin: 4px 0; }
  .doc-body a { color: var(--primary); }
  .doc-meta { font-size: 13px; color: var(--gray-400); margin: 4px 0 16px; }
  .doc-btn { display: inline-flex; align-items: center; gap: 8px; margin-top: 20px; background: var(--primary); color: #fff; border-radius: var(--radius-sm); padding: 11px 20px; font-size: 14px; font-weight: 700; text-decoration: none; }
  .doc-btn:hover { background: var(--primary-dk); }
  .doc-btn .material-symbols-outlined { font-size: 18px; }

  @media (max-width: 600px) {
    .header { padding: 12px 16px; } .hero { padding: 30px 16px; } .hero h2 { font-size: 22px; }
    .main { padding: 26px 12px 44px; }
    .row { grid-template-columns: 1fr; gap: 4px; }
    .row.head { display: none; }
    .h-date::before { content: 'Date: '; color: var(--gray-400); }
    .h-closed::before { content: 'Closed: '; color: var(--gray-400); font-weight: 400; }
    .doc-body { padding: 20px; }
  }
`;

class CompanyHolidays extends HTMLElement {
  static get observedAttributes() { return ['init-data']; }
  constructor() { super(); this.attachShadow({ mode: 'open' }); this._doc = null; }

  connectedCallback() {
    ensureMaterialSymbols();
    this._render();
    if (this.hasAttribute('init-data')) this._applyData(this.getAttribute('init-data'));
  }
  attributeChangedCallback(n, _o, v) { if (n === 'init-data' && v) this._applyData(v); }

  _applyData(json) {
    let parsed = {};
    try { parsed = JSON.parse(json) || {}; } catch (e) { parsed = {}; }
    this._doc = parsed.doc || null;
    this._render();
  }

  _scheduleRows(year) {
    return HOLIDAYS
      .map(h => ({ name: h.name, actual: h.date(year) }))
      .sort((a, b) => a.actual - b.actual)
      .map(h => {
        const obs = observed(h.actual);
        return `
          <div class="row">
            <div class="h-name">${h.name}</div>
            <div class="h-date">${fmtFull(h.actual)}</div>
            <div class="h-closed">${fmtShort(obs.date)}${obs.adjusted ? '<span class="badge">observed</span>' : ''}</div>
          </div>`;
      }).join('');
  }

  _docSection() {
    const d = this._doc;
    if (!d || (!d.body && !d.docUrl)) return '';
    const updated = d.updated ? new Date(d.updated) : null;
    const meta = updated && !isNaN(updated.getTime())
      ? `<div class="doc-meta">Updated ${updated.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>` : '';
    const body = d.body ? `<div class="doc-body">${d.body}</div>` : '';
    const btn = d.docUrl ? `<a class="doc-btn" href="${d.docUrl}" target="_blank" rel="noopener">View document <span class="material-symbols-outlined">open_in_new</span></a>` : '';
    return `
      <section class="doc">
        <div class="section-title">${d.title ? this._esc(d.title) : 'Holiday Policy'}</div>
        ${meta}${body}${btn}
      </section>`;
  }

  _render() {
    const year = new Date().getFullYear();
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <header class="header"><h1>Holidays</h1><p>LocDoc · Paid company holidays</p></header>
      <section class="hero">
        <h2>${year} Holiday Schedule</h2>
        <p>When each holiday falls this year and the day the office is closed.</p>
      </section>
      <main class="main">
        <div class="section-title">${year} Schedule</div>
        <div class="sched">
          <div class="row head"><div>Holiday</div><div>Date</div><div>Office closed</div></div>
          ${this._scheduleRows(year)}
        </div>
        <div class="note">When a holiday lands on a Saturday the office is closed the Friday before; on a Sunday, the Monday after.</div>
        ${this._docSection()}
      </main>`;
  }

  _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
}

customElements.define('company-holidays', CompanyHolidays);
