/**
 * Wix Custom Element — 1:1 Meetings (Manager)  (<one-on-one>)
 *
 * Port of the htmlOneOnOne HtmlComponent. Manager picks a report and walks through a guided
 * 1:1: review what they've submitted, review a site visit together, work through a set of
 * conversation prompts, then capture follow-ups. Sees past 1:1s. See CUSTOM-ELEMENTS.md for the
 * recipe.
 *
 * Data handoff:
 *   • Velo → element :  init-data   { currentUser, roster, history, submissions, period,
 *                                      periodLabel, isOperations } | { error }
 *                       save-result { ok:true, record } | { ok:false, error }
 *
 * Roster entries carry `isManager` (from Employees.manager being set). Operations sees every
 * active employee, which gets long fast (50+) — so the roster picker defaults its department
 * filter to "Managers Only" when the caller is Operations and any managers are in scope; a
 * department manager's already-short roster still defaults to "All Departments". The filter is
 * just a client-side view — it doesn't change who can actually be selected.
 *   • element → Velo :  'save-meeting' { detail: { employeeId, meetingDate, sections, siteVisits,
 *                                                   followUps } }
 *                       'navigate'     { detail: { key:'hub' } }
 *
 * `sections` keys: areasOfImprovement, whatsGoingWell, whatsNotGoingWell, needs, howCanIHelp.
 * Numbers/submissions are reviewed by the manager beforehand (cards shown for reference, not
 * re-typed) — areasOfImprovement is the one field that captures what came out of that review.
 * `siteVisits`: [{ label, notes }] — freeform, part of the same Review section, captured only on
 * this meeting's record (no separate collection).
 *
 * Editor: Add → Embed Code → Custom Element → source = this file,
 * tag name `one-on-one`, element ID `oneOnOne`.
 */

import { TOKENS } from './tokens.js';

function initials(name) { return (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase(); }
function avatar(p) { return p.headshotUrl ? `<img class="avatar" src="${p.headshotUrl}" alt="">` : `<div class="avatar">${initials(p.name)}</div>`; }
function todayISO() { return new Date().toISOString().split('T')[0]; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const SECTION_FIELDS = [
  { key: 'whatsGoingWell', label: "What's going well?" },
  { key: 'whatsNotGoingWell', label: "What isn't going well?" },
  { key: 'needs', label: 'What do you need from us? (tools / communication)' },
  { key: 'howCanIHelp', label: 'What can I do to help?' },
];
// SECTION_FIELDS + the Review section's own field, for save/history — areasOfImprovement gets
// its own spot in the Review markup (next to the submission cards + site visits), not rendered
// as a generic Conversation textarea.
const ALL_FIELDS = [{ key: 'areasOfImprovement', label: 'Areas for improvement' }, ...SECTION_FIELDS];

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ${TOKENS}
  :host { background:var(--gray-50); }
  .backbtn { display:inline-flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; color:#6b7280; font:600 13px system-ui,-apple-system,sans-serif; padding:12px 16px 0; }
  .header { background:var(--primary); color:#fff; padding:16px 24px; box-shadow:var(--shadow-md); }
  .header h1 { font-size:18px; font-weight:700; }
  .header p { font-size:12px; opacity:.75; margin-top:2px; }
  .main { max-width:760px; margin:0 auto; padding:24px 16px; }
  .loading-state { text-align:center; padding:64px 0; color:var(--gray-400); font-size:15px; }
  .toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:12px; }
  .toolbar select, .toolbar input { padding:8px 12px; border:1px solid var(--gray-200); border-radius:8px; font-size:14px; font-family:inherit; background:#fff; color:var(--gray-900); }
  .toolbar select { min-width:160px; }
  .toolbar input { flex:1; min-width:160px; }
  .toolbar select:focus, .toolbar input:focus { outline:2px solid var(--primary); outline-offset:-1px; }
  .count-pill { font-size:12px; font-weight:700; color:var(--gray-400); white-space:nowrap; }
  .roster { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; margin-bottom:24px; }
  .person { background:#fff; border:1px solid var(--gray-200); border-radius:var(--radius); box-shadow:var(--shadow); padding:14px; cursor:pointer; display:flex; align-items:center; gap:12px; transition:transform .12s,box-shadow .12s; -webkit-tap-highlight-color:transparent; text-align:left; width:100%; }
  .person:hover { transform:translateY(-2px); box-shadow:var(--shadow-md); }
  .person.selected { border-color:var(--primary); box-shadow:0 0 0 2px var(--primary) inset; }
  .avatar { width:40px; height:40px; border-radius:50%; background:var(--gray-200); color:var(--gray-600); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; flex-shrink:0; object-fit:cover; }
  .person-name { font-size:14px; font-weight:700; }
  .person-dept { font-size:12px; color:var(--gray-400); }
  .done-dot { margin-left:auto; font-size:18px; }
  .panel { background:#fff; border:1px solid var(--gray-200); border-radius:14px; box-shadow:var(--shadow); padding:22px; margin-bottom:18px; }
  .panel h2 { font-size:16px; font-weight:800; margin-bottom:4px; }
  .panel .sub { font-size:13px; color:var(--gray-400); margin-bottom:18px; }
  .section-num { display:flex; align-items:center; gap:10px; margin:0 0 4px; }
  .section-num .n { width:24px; height:24px; border-radius:50%; background:var(--primary); color:#fff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .section-num h3 { font-size:14px; font-weight:800; }
  .section-sub { font-size:12px; color:var(--gray-400); margin:2px 0 14px 34px; }
  .field { margin-bottom:14px; }
  .field label { display:block; font-size:13px; font-weight:600; color:var(--gray-600); margin-bottom:6px; }
  .field input, .field textarea { width:100%; padding:10px 12px; border:1px solid var(--gray-200); border-radius:8px; font-size:16px; font-family:inherit; color:var(--gray-900); background:#fff; }
  .field textarea { min-height:64px; resize:vertical; }
  .field input:focus, .field textarea:focus { outline:2px solid var(--primary); outline-offset:-1px; }
  .save-btn { width:100%; background:var(--primary); color:#fff; border:none; border-radius:10px; padding:13px; font-size:15px; font-weight:700; cursor:pointer; }
  .save-btn:disabled { opacity:.5; cursor:not-allowed; }
  .save-btn:active:not(:disabled) { transform:scale(.99); }
  .history-title { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--gray-400); margin:18px 0 10px; }
  .ooo-card { background:var(--gray-50); border:1px solid var(--gray-200); border-radius:10px; padding:14px 16px; margin-bottom:10px; }
  .ooo-date { font-size:14px; font-weight:700; margin-bottom:6px; }
  .ooo-line { font-size:13px; color:var(--gray-900); line-height:1.5; margin-bottom:3px; }
  .ooo-line strong { color:var(--gray-600); font-weight:600; }
  .empty-state { text-align:center; padding:30px 0; color:var(--gray-400); font-size:14px; }
  .toast { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); background:var(--gray-900); color:#fff; padding:12px 20px; border-radius:100px; font-size:14px; font-weight:600; opacity:0; transition:opacity .2s; pointer-events:none; z-index:300; }
  .toast.show { opacity:1; }
  /* Review Submissions cards */
  .sub-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:10px; margin:0 0 14px 34px; }
  .sub-card { background:var(--gray-50); border:1px solid var(--gray-200); border-radius:10px; padding:12px 14px; }
  .sub-card .sc-title { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--gray-600); margin-bottom:6px; }
  .sub-card .sc-empty { font-size:13px; color:var(--gray-400); font-style:italic; }
  .sub-card .sc-line { font-size:13px; color:var(--gray-900); line-height:1.5; margin-bottom:2px; }
  .sub-card .sc-line strong { color:var(--gray-600); font-weight:600; }
  /* Subsection divider within a numbered section (e.g. Review Submissions → Review Site Visits) */
  .subsection { margin:18px 0 10px 34px; padding-top:14px; border-top:1px dashed var(--gray-200); }
  .subsection-title { font-size:13px; font-weight:800; color:var(--gray-600); }
  /* Site visits */
  .sv-list { margin:0 0 10px 34px; }
  .sv-card { background:var(--gray-50); border:1px solid var(--gray-200); border-radius:10px; padding:12px 14px; margin-bottom:8px; }
  .sv-card .sv-label { font-size:13px; font-weight:700; margin-bottom:4px; }
  .sv-card .sv-notes { font-size:13px; color:var(--gray-600); line-height:1.5; }
  .sv-card .sv-remove { float:right; background:none; border:none; color:var(--error); cursor:pointer; font-size:12px; font-weight:700; }
  .sv-add { margin:0 0 14px 34px; }
  .sv-add-row { display:flex; gap:8px; margin-bottom:8px; flex-wrap:wrap; }
  .sv-add-row input, .sv-add-row textarea { flex:1; min-width:180px; padding:9px 11px; border:1px solid var(--gray-200); border-radius:8px; font-size:14px; font-family:inherit; }
  .sv-add-btn { background:var(--primary); color:#fff; border:none; border-radius:8px; padding:9px 14px; font-size:13px; font-weight:700; cursor:pointer; white-space:nowrap; }
  @media (max-width:600px){ .main{padding:16px 12px;} .sub-grid,.sv-list,.sv-add,.section-sub,.subsection{margin-left:0;} }
`;

class OneOnOne extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'save-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._user = null;
    this._roster = [];
    this._history = {};
    this._submissions = {};
    this._period = '';
    this._selectedId = null;
    this._saving = false;
    this._siteVisits = [];
    this._deptFilter = 'all';
    this._nameQuery = '';
    this._isOperations = false;
    this._hasManagers = false;
  }

  connectedCallback() {
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyInit(this.getAttribute('init-data'));
  }

  attributeChangedCallback(name, _old, value) {
    if (!value) return;
    if (name === 'init-data') this._applyInit(value);
    if (name === 'save-result') this._applySaveResult(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <button class="backbtn" data-action="back-hub">&#8592; Back to Employee Hub</button>
      <header class="header"><h1>1:1 Meetings</h1><p>LocDoc · Employee Hub</p></header>
      <main class="main">
        <div id="loadingState" class="loading-state">Loading…</div>
        <div id="content" style="display:none">
          <div id="noAccess" class="empty-state" style="display:none"></div>
          <div id="rosterWrap" style="display:none">
            <div class="panel" style="padding:16px 22px;margin-bottom:16px;">
              <div class="sub" style="margin:0">Select a team member to log or review a 1:1 for <strong id="periodLabel"></strong>. A green dot means you've logged one this month.</div>
              <div class="toolbar">
                <select id="deptFilter"></select>
                <input type="text" id="nameSearch" placeholder="Search by name…">
                <span class="count-pill" id="countPill"></span>
              </div>
            </div>
            <div id="roster" class="roster"></div>
            <div id="rosterEmpty" class="empty-state" style="display:none">No team members match.</div>
          </div>
          <div id="detail" style="display:none">
            <div class="panel">
              <h2 id="detailName"></h2>
              <div class="sub">Walk through the 1:1 together — take notes as you go.</div>
              <div class="field"><label for="mDate">Meeting date</label><input type="date" id="mDate"></div>

              <div class="section-num"><span class="n">1</span><h3>Review</h3></div>
              <div class="section-sub">Numbers should be reviewed beforehand — cards below are for reference during the conversation.</div>
              <div id="subGrid" class="sub-grid"></div>

              <div class="subsection"><div class="subsection-title">Review Site Visits</div></div>
              <div id="svList" class="sv-list"></div>
              <div class="sv-add">
                <div class="sv-add-row">
                  <input type="text" id="svLabel" placeholder="Site / address (no OMS integration yet — add manually)">
                </div>
                <div class="sv-add-row">
                  <textarea id="svNotes" placeholder="Notes on this visit" style="min-height:44px"></textarea>
                  <button type="button" class="sv-add-btn" data-action="add-site-visit">+ Add site visit</button>
                </div>
              </div>
              <div class="field" style="margin-left:34px"><label for="f_areasOfImprovement">Areas for improvement</label><textarea id="f_areasOfImprovement" placeholder="Whatever came out of reviewing the numbers and site visits together"></textarea></div>

              <div class="section-num"><span class="n">2</span><h3>Conversation</h3></div>
              <div class="section-sub">Go through these together — the goal is finding out what they need from us.</div>
              <div style="margin-left:34px">
                ${SECTION_FIELDS.map(f => `<div class="field"><label for="f_${f.key}">${f.label}</label><textarea id="f_${f.key}"></textarea></div>`).join('')}
              </div>

              <div class="section-num"><span class="n">3</span><h3>Follow-ups</h3></div>
              <div class="section-sub">Action items / commitments.</div>
              <div class="field" style="margin-left:34px"><textarea id="mFollow" placeholder="What happens next?"></textarea></div>

              <button id="saveBtn" class="save-btn" data-action="save">Log 1:1 Meeting</button>
              <div class="history-title">Past 1:1s</div>
              <div id="oooHistory"></div>
            </div>
          </div>
        </div>
      </main>
      <div id="toast" class="toast"></div>`;

    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="back-hub"]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
        return;
      }
      if (e.target.closest('[data-action="save"]')) { this._save(); return; }
      if (e.target.closest('[data-action="add-site-visit"]')) { this._addSiteVisit(); return; }
      const rm = e.target.closest('[data-remove-visit]');
      if (rm) { this._removeSiteVisit(Number(rm.getAttribute('data-remove-visit'))); return; }
      const person = e.target.closest('[data-person]');
      if (person) this._select(person.getAttribute('data-person'));
    });
    this.shadowRoot.addEventListener('change', (e) => {
      if (e.target.id === 'deptFilter') { this._deptFilter = e.target.value; this._renderRoster(); }
    });
    this.shadowRoot.addEventListener('input', (e) => {
      if (e.target.id === 'nameSearch') { this._nameQuery = e.target.value; this._renderRoster(); }
    });
  }

  _applyInit(json) {
    let p;
    try { p = JSON.parse(json); } catch (e) { p = { error: 'Failed to load.' }; }
    if (p.error) { this._$('loadingState').innerHTML = `<span style="color:#b91c1c">${p.error}</span>`; return; }
    this._user = p.currentUser || null;
    this._roster = p.roster || [];
    this._history = p.history || {};
    this._submissions = p.submissions || {};
    this._period = p.period || '';
    this._$('loadingState').style.display = 'none';
    this._$('content').style.display = '';
    this._$('periodLabel').textContent = p.periodLabel || this._period;
    if (!this._roster.length) {
      const noAccess = this._$('noAccess');
      if (p.reason === 'no-reports') {
        noAccess.innerHTML = `You're set up as a manager, but no employees currently have <em>department</em> set to match your <em>manager</em> field${p.managerScope ? ` (<strong>${p.managerScope}</strong>)` : ''}. Ask Operations to check the Employees collection.`;
      } else {
        noAccess.innerHTML = `1:1 logging is available to managers. If you should have access, ask Operations to set your <em>manager</em> field.`;
      }
      noAccess.style.display = '';
      return;
    }
    this._$('rosterWrap').style.display = '';
    this._isOperations = !!p.isOperations;
    this._hasManagers = this._roster.some(r => r.isManager);
    // Operations sees the full roster (50+), so default to just managers to keep the list
    // manageable — the department filter still opens it back up to everyone.
    this._deptFilter = (this._isOperations && this._hasManagers) ? 'managers' : 'all';
    this._nameQuery = '';
    this._buildDeptFilter();
    this._renderRoster();
  }

  _applySaveResult(json) {
    let r;
    try { r = JSON.parse(json); } catch (e) { return; }
    this._saving = false;
    this._$('saveBtn').disabled = false;
    if (r.ok) {
      const rec = r.record;
      (this._history[rec.employeeId] = this._history[rec.employeeId] || []).push(rec);
      const p = this._roster.find(x => x._id === rec.employeeId); if (p) p.doneThisMonth = true;
      this._renderRoster(); this._renderHistory(rec.employeeId);
      this._resetForm();
      this._toast('1:1 logged ✓');
    } else {
      this._toast(typeof r.error === 'string' ? r.error : 'Something went wrong');
    }
  }

  _buildDeptFilter() {
    const depts = [...new Set(this._roster.map(p => p.department))].filter(Boolean).sort();
    const managerOpt = this._hasManagers ? `<option value="managers">Managers Only</option>` : '';
    this._$('deptFilter').innerHTML = managerOpt + `<option value="all">All Departments</option>` +
      depts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join('');
    this._$('deptFilter').value = this._deptFilter;
  }

  _filteredRoster() {
    const dept = this._deptFilter || 'all';
    const q = (this._nameQuery || '').trim().toLowerCase();
    return this._roster.filter(p =>
      (dept === 'all' || (dept === 'managers' ? p.isManager : p.department === dept)) &&
      (!q || p.name.toLowerCase().includes(q)));
  }

  _renderRoster() {
    const list = this._filteredRoster();
    this._$('countPill').textContent = `${list.length} member${list.length !== 1 ? 's' : ''}`;
    this._$('roster').style.display = list.length ? '' : 'none';
    this._$('rosterEmpty').style.display = list.length ? 'none' : '';
    this._$('roster').innerHTML = list.map(p => `
      <button class="person ${p._id === this._selectedId ? 'selected' : ''}" data-person="${p._id}">
        ${avatar(p)}
        <div><div class="person-name">${p.name}</div><div class="person-dept">${p.department || ''}</div></div>
        <span class="done-dot">${p.doneThisMonth ? '🟢' : '⚪'}</span>
      </button>`).join('');
  }

  _select(id) {
    this._selectedId = id;
    const p = this._roster.find(x => x._id === id);
    if (!p) return;
    this._renderRoster();
    this._$('detail').style.display = '';
    this._$('detailName').textContent = p.name;
    this._$('mDate').value = todayISO();
    this._siteVisits = [];
    this._resetForm(false);
    this._renderSubmissions(id);
    this._renderSiteVisits();
    this._renderHistory(id);
    this._$('detail').scrollIntoView({ behavior: 'smooth' });
  }

  _resetForm(clearDate) {
    if (clearDate) this._$('mDate').value = todayISO();
    this._$('f_areasOfImprovement').value = '';
    SECTION_FIELDS.forEach(f => { this._$(`f_${f.key}`).value = ''; });
    this._$('mFollow').value = '';
    this._$('svLabel').value = ''; this._$('svNotes').value = '';
    this._siteVisits = [];
    this._renderSiteVisits();
  }

  _renderSubmissions(id) {
    const s = this._submissions[id] || {};
    const wr = s.weeklyReport, as = s.assessment, cl = s.cleanliness, dr = s.driverScore;
    const card = (title, bodyHtml) => `<div class="sub-card"><div class="sc-title">${title}</div>${bodyHtml}</div>`;
    const empty = 'None on file yet.';
    this._$('subGrid').innerHTML = [
      card('📝 Weekly Report', wr
        ? `<div class="sc-line"><strong>Week of:</strong> ${esc(wr.weekStart)}</div>
           ${wr.weekHigh ? `<div class="sc-line"><strong>High:</strong> ${esc(wr.weekHigh)}</div>` : ''}
           ${wr.weekLow ? `<div class="sc-line"><strong>Low:</strong> ${esc(wr.weekLow)}</div>` : ''}`
        : `<div class="sc-empty">${empty}</div>`),
      card('🤝 Team Assessment', as
        ? `<div class="sc-line"><strong>Avg score:</strong> ${as.avgScore != null ? as.avgScore + ' / 4' : '—'}</div>
           <div class="sc-line"><strong>Month:</strong> ${esc(as.dateMonth)} (${as.count} received)</div>`
        : `<div class="sc-empty">${empty}</div>`),
      card('🧹 Cleanliness Audit', cl
        ? `<div class="sc-line"><strong>Week of:</strong> ${esc(cl.weekStart)}</div>
           <div class="sc-line"><strong>Score:</strong> ${cl.score != null ? cl.score + '%' : '—'}</div>`
        : `<div class="sc-empty">${empty}</div>`),
      card('🚐 Driver Score', dr
        ? `<div class="sc-line"><strong>Week of:</strong> ${esc(dr.weekLabel || dr.weekStart)}</div>
           <div class="sc-line"><strong>Score:</strong> ${dr.score != null ? dr.score : '—'}${dr.classification ? ' · ' + esc(dr.classification) : ''}</div>`
        : `<div class="sc-empty">${empty}</div>`),
    ].join('');
  }

  _addSiteVisit() {
    const label = this._$('svLabel').value.trim();
    const notes = this._$('svNotes').value.trim();
    if (!label && !notes) { this._toast('Add a site or some notes first'); return; }
    this._siteVisits.push({ label, notes });
    this._$('svLabel').value = ''; this._$('svNotes').value = '';
    this._renderSiteVisits();
  }

  _removeSiteVisit(i) {
    this._siteVisits.splice(i, 1);
    this._renderSiteVisits();
  }

  _renderSiteVisits() {
    const el = this._$('svList');
    if (!this._siteVisits.length) { el.innerHTML = ''; return; }
    el.innerHTML = this._siteVisits.map((v, i) => `
      <div class="sv-card">
        <button type="button" class="sv-remove" data-remove-visit="${i}">Remove</button>
        <div class="sv-label">${esc(v.label) || '(no site name)'}</div>
        ${v.notes ? `<div class="sv-notes">${esc(v.notes)}</div>` : ''}
      </div>`).join('');
  }

  _renderHistory(id) {
    const list = (this._history[id] || []).slice().sort((a, b) => a.meetingDate < b.meetingDate ? 1 : -1);
    const el = this._$('oooHistory');
    if (!list.length) { el.innerHTML = '<div class="empty-state">No 1:1s logged yet.</div>'; return; }
    el.innerHTML = list.map(o => {
      const visits = (o.siteVisits || []).map(v => `<div class="ooo-line"><strong>Site visit:</strong> ${esc(v.label)}${v.notes ? ' — ' + esc(v.notes) : ''}</div>`).join('');
      const lines = ALL_FIELDS.map(f => o[f.key] ? `<div class="ooo-line"><strong>${f.label}:</strong> ${esc(o[f.key])}</div>` : '').join('');
      return `<div class="ooo-card"><div class="ooo-date">${o.meetingDate}</div>
        ${visits}
        ${lines}
        ${o.followUps ? `<div class="ooo-line"><strong>Follow-ups:</strong> ${esc(o.followUps)}</div>` : ''}</div>`;
    }).join('');
  }

  _toast(msg) {
    const t = this._$('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
  }

  _save() {
    if (this._saving || !this._selectedId) return;
    const meetingDate = this._$('mDate').value;
    if (!meetingDate) { this._toast('Pick a meeting date'); return; }
    this._saving = true;
    this._$('saveBtn').disabled = true;
    const sections = {};
    ALL_FIELDS.forEach(f => { sections[f.key] = this._$(`f_${f.key}`).value.trim(); });
    this.dispatchEvent(new CustomEvent('save-meeting', {
      detail: {
        employeeId: this._selectedId,
        meetingDate,
        sections,
        siteVisits: this._siteVisits.slice(),
        followUps: this._$('mFollow').value.trim(),
      },
      bubbles: true, composed: true,
    }));
  }
}

customElements.define('one-on-one', OneOnOne);
