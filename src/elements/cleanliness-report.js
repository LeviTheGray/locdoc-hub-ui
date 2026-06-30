/**
 * Wix Custom Element — Cleanliness Report  (<cleanliness-report>)
 *
 * Port of the htmlCleanlinessReport HtmlComponent. Read-only: week selector,
 * summary tiles, per-branch breakdown, non-submitters, trend chart, photo gallery.
 * See CUSTOM-ELEMENTS.md for the recipe.
 *
 * Data handoff:
 *   • Velo → element :  init-data { scope, meId, participants, audits } | { error }
 *   • element → Velo :  'navigate' { detail: { key:'hub' } }
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
  static get observedAttributes() { return ['init-data']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._scope = 'self';
    this._meId = null;
    this._participants = [];
    this._audits = [];
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
      <header class="header"><h1>Cleanliness Report</h1><p>LocDoc · Employee Hub</p></header>
      <main class="main">
        <div id="loadingState" class="loading-state">Loading…</div>
        <div id="report" style="display:none">
          <div class="toolbar"><label for="weekFilter">Week:</label><select id="weekFilter"></select></div>
          <div class="stats" id="stats"></div>
          <div id="branches"></div>
          <div class="card"><div class="card-title">Average Score by Week (all branches)</div><div id="chart" class="chart"></div></div>
          <div class="card"><div class="card-title">Photos This Week</div><div id="gallery" class="gallery"></div></div>
        </div>
      </main>`;

    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="back-hub"]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
    });
    this.shadowRoot.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'weekFilter') this._render();
    });
  }

  _applyInit(json) {
    let p;
    try { p = JSON.parse(json); } catch (e) { p = { error: 'Failed to load.' }; }
    if (p.error) { this._$('loadingState').innerHTML = `<span style="color:#b91c1c">${p.error}</span>`; return; }
    this._scope = p.scope; this._meId = p.meId;
    this._participants = p.participants || []; this._audits = p.audits || [];
    this._$('loadingState').style.display = 'none';
    this._$('report').style.display = '';
    this._buildWeekOptions();
    this._render();
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
    const byEmp = {};
    weekAudits.forEach(a => { byEmp[a.employeeId] = a; });
    this._renderStats(weekAudits, byEmp);
    this._renderBranches(byEmp);
    this._renderChart();
    this._renderGallery(weekAudits);
  }

  _renderStats(weekAudits, byEmp) {
    const submitted = this._participants.filter(p => byEmp[p._id]).length;
    const expected = this._participants.length;
    const overall = avg(weekAudits.map(a => a.score));
    const vAvg = avg(weekAudits.map(a => a.vehicleScore).filter(s => s != null));
    const oAvg = avg(weekAudits.map(a => a.officeScore).filter(s => s != null));
    const tiles = [
      { v: `${submitted}/${expected}`, l: 'Submitted' },
      { v: overall == null ? '—' : overall + '%', l: 'Avg Score' },
      { v: vAvg == null ? '—' : vAvg + '%', l: 'Vehicle Avg' },
      { v: oAvg == null ? '—' : oAvg + '%', l: 'Office Avg' },
    ];
    this._$('stats').innerHTML = tiles.map(t => `<div class="stat"><div class="v">${t.v}</div><div class="l">${t.l}</div></div>`).join('');
  }

  _typeBar(label, score, owedCount) {
    if (!owedCount) return '';
    if (score == null) return `<div class="typebar"><div class="tb-label"><span>${label}</span><span class="tb-na">no data</span></div><div class="track"></div></div>`;
    return `<div class="typebar"><div class="tb-label"><span>${label}</span><span>${score}%</span></div><div class="track"><div class="fill" style="width:${score}%;background:${scoreColor(score)}"></div></div></div>`;
  }

  _renderBranches(byEmp) {
    const branches = {};
    this._participants.forEach(p => { const b = branchLabel(p.branch); (branches[b] = branches[b] || []).push(p); });
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
          <div class="typebars">${this._typeBar('🚐 Vehicle', avg(vScores), owesV)}${this._typeBar('🏢 Office', avg(oScores), owesO)}</div>
          ${subList}
          ${nonsubs.length
            ? `<div class="nonsub-label">Did not submit (${nonsubs.length})</div><div class="chips">${nonsubs.map(m => `<span class="chip">${esc(m.name)}<span class="tag">${m.owesVehicle && m.owesOffice ? 'VEH+OFF' : m.owesVehicle ? 'VEH' : 'OFF'}</span></span>`).join('')}</div>`
            : `<div class="all-in">✓ Everyone in this branch submitted</div>`}
        </div>`;
    }).join('');
  }

  _renderChart() {
    const byWeek = {};
    this._audits.forEach(a => { if (a.weekStart) (byWeek[a.weekStart] = byWeek[a.weekStart] || []).push(a.score); });
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
