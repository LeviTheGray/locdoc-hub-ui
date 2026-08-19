/**
 * Wix Custom Element — Cleanliness Report  (<cleanliness-report>)
 *
 * Port of the htmlCleanlinessReport HtmlComponent. Read-only: week selector,
 * summary tiles, per-branch breakdown, non-submitters, trend chart, photo gallery.
 * See CUSTOM-ELEMENTS.md for the recipe.
 *
 * Data handoff:
 *   • Velo → element :  init-data { scope, meScope, meId, participants, audits } | { error }
 *                       pto-result { ok, error? }  (carries a _ts nonce; a successful mark/unmark
 *                                    is followed by a fresh init-data with the updated audit rows —
 *                                    this attribute only carries busy/error state)
 *   • element → Velo :  'navigate'   { detail: { key:'hub' } }
 *                       'mark-pto'   { detail: { employeeId, weekStart } }
 *                       'unmark-pto' { detail: { employeeId, weekStart } }
 *
 * PTO is a separate PTO collection (EmployeeID, weekStart, weekEnd, source, markedByName); the
 * Velo page merges PTO rows into the same `audits` list as real CleanlinessAudit submissions, each
 * carrying `isPTO`/`markedByName`, so this element never needs to know they come from different
 * collections. Everything downstream treats an isPTO row as "exempt, not missing" rather than a
 * real score.
 *
 * meScope is the manager's raw Employees.manager value ("" = not a manager, "Operations" = every
 * department, otherwise a comma-separated department list) — it decides which participants the
 * Mark PTO control can act on. It's separate from `scope`, which only controls how much of the
 * report is VISIBLE (any manager sees the whole company).
 *
 * Editor: Add → Embed Code → Custom Element → source = this file,
 * tag name `cleanliness-report`, element ID `cleanlinessReport`.
 */

import { TOKENS } from './tokens.js';

// Cleanliness audit week runs Wed 9:00am → next Tue 11:59pm (reporting is presented at the
// Wednesday meeting). The Wed 00:00–09:00 window is locked. getAuditWeekStart returns the
// YYYY-MM-DD of the Wednesday the active week opened — during the lock it's the just-closed
// week (the one under review). All times are local (browser) time.
function localISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getAuditWeekStart(date) {
  const d = new Date(date);
  let daysBack = (d.getDay() + 4) % 7; // days since most recent Wednesday (Wed=0 … Tue=6)
  if (daysBack === 0 && d.getHours() < 9) daysBack = 7; // Wed before 9am → previous week
  d.setDate(d.getDate() - daysBack);
  d.setHours(0, 0, 0, 0);
  return localISODate(d);
}
function fmtWeek(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function avg(arr) { return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null; }
// 0% baseline: average the submitted scores over the EXPECTED headcount, so everyone who owed an
// audit but didn't submit counts as 0%. Returns null only when nobody owed it (nothing to show).
function avgOverExpected(scores, expected) { return expected ? Math.round(scores.reduce((a, b) => a + b, 0) / expected) : null; }
function scoreColor(s) { return s >= 80 ? 'var(--green)' : s >= 50 ? 'var(--amber)' : 'var(--red)'; }
function branchLabel(b) { return b || 'Unassigned'; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ${TOKENS}
  :host { --amber:#f59e0b; --red:#ef4444; background:var(--gray-50); }
  .backbtn { display:inline-flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; color:#6b7280; font:600 13px system-ui,-apple-system,sans-serif; padding:12px 16px 0; }
  .header { background: var(--primary); color: #fff; padding: 16px 24px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p  { font-size: 12px; opacity: .75; margin-top: 2px; }
  .main { max-width: 920px; margin: 0 auto; padding: 28px 16px; }
  .loading-state { text-align: center; padding: 64px 0; color: var(--gray-400); font-size: 15px; }
  .card { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 22px; box-shadow: var(--shadow); margin-bottom: 20px; }
  .card-title { font-size: 15px; font-weight: 700; margin-bottom: 16px; }
  .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .toolbar label { font-size: 13px; font-weight: 600; color: var(--gray-600); }
  .toolbar select {
    padding: 7px 36px 7px 10px; border: 1px solid var(--gray-200); border-radius: 8px; font-size: 14px;
    background: #fff; color: var(--gray-900); cursor: pointer; min-width: 200px; -webkit-appearance: none; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M6 8L1 3h10z' fill='%236b7280'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
  }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .stat { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); }
  .stat .v { font-size: 24px; font-weight: 800; }
  .stat .l { font-size: 11px; color: var(--gray-400); margin-top: 2px; text-transform: uppercase; letter-spacing: .03em; }
  .branch-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
  .branch-name { font-size: 15px; font-weight: 700; }
  .pill { font-size: 11px; font-weight: 700; border-radius: 100px; padding: 3px 10px; margin-left: auto; }
  .pill.ok { background: #dcfce7; color: #14532d; } .pill.warn { background: #fef9c3; color: #78350f; } .pill.bad { background: #fee2e2; color: #991b1b; }
  .typebars { display: flex; gap: 20px; margin-bottom: 14px; flex-wrap: wrap; }
  .typebar { flex: 1; min-width: 160px; }
  .typebar .tb-label { font-size: 12px; font-weight: 600; color: var(--gray-600); display: flex; justify-content: space-between; margin-bottom: 5px; }
  .track { height: 10px; background: var(--gray-100); border-radius: 100px; overflow: hidden; }
  .fill { height: 100%; border-radius: 100px; }
  .tb-na { font-size: 12px; color: var(--gray-400); font-style: italic; }
  .sub-label { font-size: 12px; font-weight: 700; color: #14532d; margin: 6px 0 8px; }
  .sub-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
  .sub-row { display: flex; align-items: center; gap: 10px; font-size: 13px; padding: 5px 0; border-bottom: 1px solid var(--gray-100); }
  .sub-row:last-child { border-bottom: none; }
  .sub-rank { width: 18px; text-align: right; color: var(--gray-400); font-weight: 700; font-size: 12px; flex-shrink: 0; }
  .sub-name { font-weight: 600; }
  .sub-types { font-size: 11px; color: var(--gray-400); margin-left: auto; }
  .sub-score { font-weight: 800; font-size: 14px; min-width: 44px; text-align: right; }
  .nonsub-label { font-size: 12px; font-weight: 700; color: #991b1b; margin: 6px 0 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 100px; background: #fee2e2; color: #991b1b; display: inline-flex; align-items: center; gap: 5px; }
  .chip .tag { font-size: 10px; font-weight: 700; opacity: .7; }
  .chip.done { background: #dcfce7; color: #14532d; }
  .all-in { font-size: 13px; color: #14532d; font-weight: 600; }
  .pto-toggle { font-size: 12px; font-weight: 700; border: 1px solid var(--gray-200); background: #fff; color: var(--gray-600); border-radius: 100px; padding: 5px 12px; cursor: pointer; margin-left: auto; }
  .pto-toggle:disabled { opacity: .5; cursor: default; }
  .pto-err { font-size: 12px; color: #991b1b; margin-bottom: 8px; }
  .pto-picker { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
  .pto-picker select { padding: 6px 10px; border: 1px solid var(--gray-200); border-radius: 8px; font-size: 13px; flex: 1; min-width: 180px; }
  .pto-picker button { font-size: 12px; font-weight: 700; border: none; background: var(--primary); color: #fff; border-radius: 8px; padding: 7px 14px; cursor: pointer; }
  .pto-row { display: flex; align-items: center; gap: 10px; font-size: 13px; padding: 6px 0; border-bottom: 1px solid var(--gray-100); }
  .pto-row:last-child { border-bottom: none; }
  .pto-name { font-weight: 600; }
  .pto-branch { color: var(--gray-400); font-size: 12px; }
  .pto-by { color: var(--gray-400); font-size: 11px; margin-left: auto; }
  .pto-remove { font-size: 11px; font-weight: 700; border: none; background: #fee2e2; color: #991b1b; border-radius: 100px; padding: 4px 10px; cursor: pointer; }
  .pto-remove:disabled { opacity: .5; cursor: default; }
  .ca-label { font-size: 12px; font-weight: 700; color: #1e3a8a; margin: 14px 0 8px; padding-top: 12px; border-top: 1px dashed var(--gray-200); }
  .ca-row { display: flex; align-items: center; gap: 10px; font-size: 13px; padding: 5px 0; border-bottom: 1px solid var(--gray-100); }
  .ca-row:last-child { border-bottom: none; }
  .ca-name { font-weight: 600; }
  .ca-by { font-size: 11px; color: var(--gray-400); margin-left: auto; }
  .ca-score { font-weight: 800; font-size: 14px; min-width: 44px; text-align: right; }
  .ca-stars { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
  .clean-chip { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 100px; background: #dbeafe; color: #1e3a8a; display: inline-flex; align-items: center; gap: 5px; }
  .clean-chip .n { font-size: 10px; font-weight: 700; opacity: .7; }
  .chart { display: flex; align-items: flex-end; gap: 10px; height: 160px; padding-top: 18px; }
  .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 22px; }
  .bar { width: 100%; max-width: 44px; border-radius: 6px 6px 0 0; position: relative; }
  .bar .bar-val { position: absolute; top: -16px; left: 0; right: 0; text-align: center; font-size: 10px; font-weight: 700; color: var(--gray-600); }
  .bar-label { font-size: 10px; color: var(--gray-400); margin-top: 6px; white-space: nowrap; }
  .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; }
  .thumb { border: 1px solid var(--gray-200); border-radius: 8px; overflow: hidden; background: var(--gray-50); }
  .thumb img { width: 100%; height: 110px; object-fit: cover; display: block; }
  .thumb .cap { font-size: 10px; padding: 6px 8px; color: var(--gray-600); }
  .muted { color: var(--gray-400); font-size: 13px; font-style: italic; }
  @media (max-width: 600px) {
    .main { padding: 16px 12px; }
    .card { padding: 16px; }
    .stats { grid-template-columns: 1fr 1fr; }
    .toolbar select { width: 100%; font-size: 16px; }
  }
`;

class CleanlinessReport extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'pto-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._scope = 'self';
    this._meScope = '';
    this._meId = null;
    this._participants = [];
    this._audits = [];
    this._commonAreaAudits = [];
    this._ptoPickerOpen = false;
    this._ptoBusy = false;
    this._ptoErr = '';
  }

  connectedCallback() {
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyInit(this.getAttribute('init-data'));
  }

  attributeChangedCallback(name, _old, value) {
    if (name === 'init-data' && value) this._applyInit(value);
    if (name === 'pto-result' && value) this._applyPtoResult(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <button class="backbtn" data-action="back-hub">&#8592; Back to Employee Hub</button>
      <header class="header"><h1>Cleanliness Report</h1><p>LocDoc · Employee Hub</p></header>
      <main class="main">
        <div id="loadingState" class="loading-state">Loading…</div>
        <div id="report" style="display:none">
          <div class="toolbar"><label for="weekFilter">Week:</label><select id="weekFilter"></select></div>
          <div class="stats" id="stats"></div>
          <div id="ptoSection"></div>
          <div id="branches"></div>
          <div class="card"><div class="card-title">Average Score by Week (all branches)</div><div id="chart" class="chart"></div></div>
          <div class="card"><div class="card-title">Photos This Week</div><div id="gallery" class="gallery"></div></div>
        </div>
      </main>`;

    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="back-hub"]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
      if (e.target.closest('[data-action="toggle-pto-picker"]')) {
        this._ptoPickerOpen = !this._ptoPickerOpen;
        this._ptoErr = '';
        this._render();
      }
      if (e.target.closest('[data-action="confirm-mark-pto"]')) {
        const sel = this._$('ptoPick');
        const employeeId = sel && sel.value;
        if (employeeId) this._sendPto('mark-pto', employeeId);
      }
      const unmarkBtn = e.target.closest('[data-action="unmark-pto"]');
      if (unmarkBtn) this._sendPto('unmark-pto', unmarkBtn.getAttribute('data-emp'));
    });
    this.shadowRoot.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'weekFilter') this._render();
    });
  }

  _applyInit(json) {
    let p;
    try { p = JSON.parse(json); } catch (e) { p = { error: 'Failed to load.' }; }
    if (p.error) { this._$('loadingState').innerHTML = `<span style="color:#b91c1c">${p.error}</span>`; return; }
    this._scope = p.scope; this._meScope = p.meScope || ''; this._meId = p.meId;
    this._participants = p.participants || []; this._audits = p.audits || [];
    this._commonAreaAudits = p.commonAreaAudits || [];
    this._$('loadingState').style.display = 'none';
    this._$('report').style.display = '';
    this._buildWeekOptions();
    this._render();
  }

  // Departments the current manager can mark/unmark PTO for — "" (not a manager) can't act on
  // anyone, "Operations" can act on everyone. Server re-checks this on every mark/unmark, so a
  // stale or forged client value can't get someone unauthorized PTO'd.
  _canMarkPto(department) {
    if (!this._meScope) return false;
    if (this._meScope === 'Operations') return true;
    const owned = this._meScope.split(',').map(s => s.trim());
    const depts = String(department || '').split(',').map(s => s.trim()).filter(Boolean);
    return depts.some(d => owned.includes(d));
  }

  _sendPto(kind, employeeId) {
    this._ptoBusy = true;
    this._ptoErr = '';
    this.dispatchEvent(new CustomEvent(kind, {
      detail: { employeeId, weekStart: this._selectedWeek() }, bubbles: true, composed: true,
    }));
    this._render();
  }

  // A success here is deliberately silent: the mark/unmark webMethod wrote/removed a
  // CleanlinessAudit row, and the Velo handler immediately re-runs init-data with the updated
  // rows, which lands as a normal attributeChangedCallback and does the actual re-render.
  _applyPtoResult(json) {
    let d;
    try { d = JSON.parse(json); } catch (e) { return; }
    this._ptoBusy = false;
    if (!d.ok) { this._ptoErr = d.error || 'That failed.'; this._render(); return; }
    this._ptoErr = '';
    this._ptoPickerOpen = false;
  }

  _selectedWeek() { return this._$('weekFilter').value; }

  _buildWeekOptions() {
    const set = new Set(this._audits.map(a => a.weekStart).filter(Boolean));
    let cur = getAuditWeekStart(new Date());
    for (let i = 0; i < 8; i++) {
      set.add(cur);
      const d = new Date(cur + 'T00:00:00'); d.setDate(d.getDate() - 7);
      cur = localISODate(d);
    }
    const weeks = [...set].sort().reverse();
    const thisWeek = getAuditWeekStart(new Date());
    this._$('weekFilter').innerHTML = weeks.map(w =>
      `<option value="${w}"${w === thisWeek ? ' selected' : ''}>Week of ${fmtWeek(w)}${w === thisWeek ? ' (current)' : ''}</option>`).join('');
  }

  _render() {
    const week = this._selectedWeek();
    const weekAudits = this._audits.filter(a => a.weekStart === week);
    // A PTO week is a CleanlinessAudit row with isPTO:true instead of real scores — split it out
    // before building byEmp, so it never reads as a submission.
    const ptoAudits = weekAudits.filter(a => a.isPTO);
    const realAudits = weekAudits.filter(a => !a.isPTO);
    const byEmp = {};
    realAudits.forEach(a => { byEmp[a.employeeId] = a; });
    const ptoIds = new Set(ptoAudits.map(a => a.employeeId));
    this._renderPtoSection(ptoAudits, ptoIds);
    this._renderStats(realAudits, byEmp, ptoIds);
    this._renderBranches(byEmp, ptoIds);
    this._renderChart();
    this._renderGallery(realAudits);
  }

  // Employees marked PTO for the week: shown separately below, so they're never treated as a
  // silent non-submission or assumed data error — and excluded from every score/denominator.
  _renderPtoSection(ptoAudits, ptoIds) {
    const el = this._$('ptoSection');
    const canPick = this._participants.some(p => !ptoIds.has(p._id) && this._canMarkPto(p.department));

    const ptoRows = ptoAudits.map(a => {
      const emp = this._participants.find(x => x._id === a.employeeId);
      if (!emp) return '';
      const canRemove = this._canMarkPto(emp.department);
      return `<div class="pto-row">
        <span class="pto-name">${esc(emp.name)}</span>
        <span class="pto-branch">${esc(branchLabel(emp.branch))}</span>
        ${a.markedByName ? `<span class="pto-by">marked by ${esc(a.markedByName)}</span>` : ''}
        ${canRemove ? `<button class="pto-remove" data-action="unmark-pto" data-emp="${emp._id}" ${this._ptoBusy ? 'disabled' : ''}>Remove</button>` : ''}
      </div>`;
    }).join('');

    const picker = this._ptoPickerOpen ? this._ptoPickerHtml(ptoIds) : '';
    const toggleBtn = this._meScope
      ? `<button class="pto-toggle" data-action="toggle-pto-picker" ${!canPick && !this._ptoPickerOpen ? 'disabled' : ''}>
          ${this._ptoPickerOpen ? 'Cancel' : '+ Mark PTO'}
        </button>` : '';

    if (!ptoRows && !toggleBtn) { el.innerHTML = ''; return; }

    el.innerHTML = `<div class="card">
      <div class="branch-head"><div class="branch-name">🌴 PTO this week</div>${toggleBtn}</div>
      ${this._ptoErr ? `<div class="pto-err">${esc(this._ptoErr)}</div>` : ''}
      ${picker}
      ${ptoRows || '<div class="muted">No one is marked PTO this week.</div>'}
    </div>`;
  }

  _ptoPickerHtml(ptoIds) {
    const eligible = this._participants
      .filter(p => !ptoIds.has(p._id) && this._canMarkPto(p.department))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!eligible.length) return '<div class="muted">No one left in your department(s) to mark.</div>';
    return `<div class="pto-picker">
      <select id="ptoPick">${eligible.map(p => `<option value="${p._id}">${esc(p.name)} · ${esc(branchLabel(p.branch))}</option>`).join('')}</select>
      <button data-action="confirm-mark-pto" ${this._ptoBusy ? 'disabled' : ''}>${this._ptoBusy ? 'Marking…' : 'Mark PTO'}</button>
    </div>`;
  }

  _renderStats(weekAudits, byEmp, ptoIds) {
    const active = this._participants.filter(p => !ptoIds.has(p._id));
    const submitted = active.filter(p => byEmp[p._id]).length;
    const expected = active.length;
    // 0% baseline: every average is taken over the expected headcount (owed the audit), not just
    // the people who submitted — so non-submittals pull the numbers down. PTO'd people are excluded
    // from `active` entirely, so they don't count toward the denominator either.
    const owesV = active.filter(p => p.owesVehicle).length;
    const owesO = active.filter(p => p.owesOffice).length;
    const overall = avgOverExpected(active.filter(p => byEmp[p._id]).map(p => byEmp[p._id].score), expected);
    const vAvg = avgOverExpected(active.filter(p => byEmp[p._id] && byEmp[p._id].vehicleScore != null).map(p => byEmp[p._id].vehicleScore), owesV);
    const oAvg = avgOverExpected(active.filter(p => byEmp[p._id] && byEmp[p._id].officeScore != null).map(p => byEmp[p._id].officeScore), owesO);
    const tiles = [
      { v: `${submitted}/${expected}`, l: 'Submitted' },
      { v: overall == null ? '—' : overall + '%', l: 'Avg Score' },
      { v: vAvg == null ? '—' : vAvg + '%', l: 'Vehicle Avg' },
      { v: oAvg == null ? '—' : oAvg + '%', l: 'Office Avg' },
    ];
    this._$('stats').innerHTML = tiles.map(t => `<div class="stat"><div class="v">${t.v}</div><div class="l">${t.l}</div></div>`).join('')
      + `<div class="stat-note" style="grid-column:1/-1;font-size:11px;color:var(--gray-400);margin-top:-6px">Averages count non-submissions as 0%.</div>`;
  }

  _typeBar(label, score, owedCount) {
    if (!owedCount) return '';
    if (score == null) return `<div class="typebar"><div class="tb-label"><span>${label}</span><span class="tb-na">no data</span></div><div class="track"></div></div>`;
    return `<div class="typebar"><div class="tb-label"><span>${label}</span><span>${score}%</span></div><div class="track"><div class="fill" style="width:${score}%;background:${scoreColor(score)}"></div></div></div>`;
  }

  _renderBranches(byEmp, ptoIds) {
    const week = this._selectedWeek();
    const branches = {};
    this._participants.filter(p => !ptoIds.has(p._id)).forEach(p => { const b = branchLabel(p.branch); (branches[b] = branches[b] || []).push(p); });
    const names = Object.keys(branches).sort();
    const wrap = this._$('branches');
    if (!names.length) { wrap.innerHTML = '<div class="card"><div class="muted">No participants in your view.</div></div>'; return; }

    wrap.innerHTML = names.map(b => {
      const members = branches[b];
      const submittedMembers = members.filter(m => byEmp[m._id]);
      const vScores = [], oScores = [];
      let owesV = 0, owesO = 0;
      members.forEach(m => {
        if (m.owesVehicle) owesV++;
        if (m.owesOffice) owesO++;
        const a = byEmp[m._id];
        if (a) { if (a.vehicleScore != null) vScores.push(a.vehicleScore); if (a.officeScore != null) oScores.push(a.officeScore); }
      });
      const sub = submittedMembers.length, exp = members.length;
      const pillCls = sub === exp ? 'ok' : sub === 0 ? 'bad' : 'warn';
      const nonsubs = members.filter(m => !byEmp[m._id]);

      // Submitters ranked top → bottom by overall score.
      const ranked = submittedMembers
        .map(m => ({ m, a: byEmp[m._id] }))
        .sort((x, y) => (y.a.score || 0) - (x.a.score || 0));
      const subList = ranked.length
        ? `<div class="sub-label">Submitted (${ranked.length})</div><div class="sub-list">${ranked.map((s, i) => {
            const types = [s.a.vehicleScore != null ? `🚐 ${s.a.vehicleScore}%` : '', s.a.officeScore != null ? `🏢 ${s.a.officeScore}%` : ''].filter(Boolean).join(' · ');
            return `<div class="sub-row"><span class="sub-rank">${i + 1}</span><span class="sub-name">${esc(s.m.name)}</span>${types ? `<span class="sub-types">${types}</span>` : ''}<span class="sub-score" style="color:${scoreColor(s.a.score)}">${s.a.score}%</span></div>`;
          }).join('')}</div>`
        : '';

      return `<div class="card">
          <div class="branch-head"><div class="branch-name">🏢 ${esc(b)}</div><div class="pill ${pillCls}">${sub}/${exp} submitted</div></div>
          <div class="typebars">${this._typeBar('🚐 Vehicle', avgOverExpected(vScores, owesV), owesV)}${this._typeBar('🏢 Office', avgOverExpected(oScores, owesO), owesO)}</div>
          ${subList}
          ${nonsubs.length
            ? `<div class="nonsub-label">Did not submit (${nonsubs.length})</div><div class="chips">${nonsubs.map(m => `<span class="chip">${esc(m.name)}<span class="tag">${m.owesVehicle && m.owesOffice ? '🚐🏢' : m.owesVehicle ? '🚐' : '🏢'}</span></span>`).join('')}</div>`
            : `<div class="all-in">✓ Everyone in this branch submitted</div>`}
          ${this._renderCommonAreas(b, week)}
        </div>`;
    }).join('');
  }

  // Per-branch shared-space audits for the selected week: each area's score + who cleaned, plus a
  // highlight of the branch's cleaners (name + number of areas they cleaned that week).
  _renderCommonAreas(branchName, week) {
    const rows = this._commonAreaAudits.filter(a => a.weekStart === week && branchLabel(a.branch) === branchName);
    if (!rows.length) return '';
    const areaHtml = rows
      .slice()
      .sort((x, y) => (y.score || 0) - (x.score || 0))
      .map(a => `<div class="ca-row"><span class="ca-name">${esc(a.areaName || 'Common Area')}</span>${a.cleanerName ? `<span class="ca-by">cleaned by ${esc(a.cleanerName)}</span>` : ''}<span class="ca-score" style="color:${scoreColor(a.score)}">${a.score}%</span></div>`)
      .join('');
    const byCleaner = {};
    rows.forEach(a => { if (a.cleanerName) byCleaner[a.cleanerName] = (byCleaner[a.cleanerName] || 0) + 1; });
    const cleaners = Object.keys(byCleaner).sort((x, y) => byCleaner[y] - byCleaner[x]);
    const stars = cleaners.length
      ? `<div class="ca-stars">${cleaners.map(n => `<span class="clean-chip">🧽 ${esc(n)}${byCleaner[n] > 1 ? `<span class="n">×${byCleaner[n]}</span>` : ''}</span>`).join('')}</div>`
      : '';
    return `<div class="ca-label">🧽 Common Areas (${rows.length})</div><div class="sub-list">${areaHtml}</div>${stars}`;
  }

  _renderChart() {
    const byWeek = {};
    this._audits.forEach(a => { if (a.weekStart && !a.isPTO) (byWeek[a.weekStart] = byWeek[a.weekStart] || []).push(a.score); });
    const weeks = Object.keys(byWeek).sort().slice(-12);
    const chart = this._$('chart');
    if (!weeks.length) { chart.innerHTML = '<div class="muted">No audits submitted yet.</div>'; return; }
    chart.innerHTML = weeks.map(w => {
      const a = avg(byWeek[w]);
      return `<div class="bar-col"><div class="bar" style="height:${Math.max(a, 2)}%;background:${scoreColor(a)}"><div class="bar-val">${a}%</div></div><div class="bar-label">${fmtWeek(w)}</div></div>`;
    }).join('');
  }

  _renderGallery(weekAudits) {
    const thumbs = [];
    weekAudits.forEach(a => {
      Object.keys(a.photoUrls || {}).forEach(slot => {
        const url = a.photoUrls[slot];
        if (url) thumbs.push(`<div class="thumb"><img src="${esc(url)}" alt="${esc(slot)}"><div class="cap">${esc(a.name)} · ${esc(slot)}</div></div>`);
      });
    });
    this._$('gallery').innerHTML = thumbs.length ? thumbs.join('') : '<div class="muted">No photos for this week.</div>';
  }
}

customElements.define('cleanliness-report', CleanlinessReport);
