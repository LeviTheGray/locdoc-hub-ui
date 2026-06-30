/**
 * Wix Custom Element — 1:1 Meetings (Manager)  (<one-on-one>)
 *
 * Port of the htmlOneOnOne HtmlComponent. Manager picks a report, logs a 1:1,
 * sees past 1:1s. See CUSTOM-ELEMENTS.md for the recipe.
 *
 * Data handoff:
 *   • Velo → element :  init-data   { currentUser, roster, history, period, periodLabel } | { error }
 *                       save-result { ok:true, record } | { ok:false, error }
 *   • element → Velo :  'save-meeting' { detail: { employeeId, meetingDate, topics, notes, followUps } }
 *                       'navigate'     { detail: { key:'hub' } }
 *
 * Editor: Add → Embed Code → Custom Element → source = this file,
 * tag name `one-on-one`, element ID `oneOnOne`.
 */

import { TOKENS } from './tokens.js';

function initials(name) { return (name || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase(); }
function avatar(p) { return p.headshotUrl ? `<img class="avatar" src="${p.headshotUrl}" alt="">` : `<div class="avatar">${initials(p.name)}</div>`; }
function todayISO() { return new Date().toISOString().split('T')[0]; }

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ${TOKENS}
  :host { background:var(--gray-50); }
  .backbtn { display:inline-flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; color:#6b7280; font:600 13px system-ui,-apple-system,sans-serif; padding:12px 16px 0; }
  .header { background:var(--green); color:#fff; padding:16px 24px; box-shadow:var(--shadow-md); }
  .header h1 { font-size:18px; font-weight:700; }
  .header p { font-size:12px; opacity:.75; margin-top:2px; }
  .main { max-width:760px; margin:0 auto; padding:24px 16px; }
  .loading-state { text-align:center; padding:64px 0; color:var(--gray-400); font-size:15px; }
  .roster { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; margin-bottom:24px; }
  .person { background:#fff; border:1px solid var(--gray-200); border-radius:var(--radius); box-shadow:var(--shadow); padding:14px; cursor:pointer; display:flex; align-items:center; gap:12px; transition:transform .12s,box-shadow .12s; -webkit-tap-highlight-color:transparent; text-align:left; width:100%; }
  .person:hover { transform:translateY(-2px); box-shadow:var(--shadow-md); }
  .person.selected { border-color:var(--green); box-shadow:0 0 0 2px var(--green) inset; }
  .avatar { width:40px; height:40px; border-radius:50%; background:var(--gray-200); color:var(--gray-600); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; flex-shrink:0; object-fit:cover; }
  .person-name { font-size:14px; font-weight:700; }
  .person-dept { font-size:12px; color:var(--gray-400); }
  .done-dot { margin-left:auto; font-size:18px; }
  .panel { background:#fff; border:1px solid var(--gray-200); border-radius:14px; box-shadow:var(--shadow); padding:22px; margin-bottom:18px; }
  .panel h2 { font-size:16px; font-weight:800; margin-bottom:4px; }
  .panel .sub { font-size:13px; color:var(--gray-400); margin-bottom:18px; }
  .field { margin-bottom:14px; }
  .field label { display:block; font-size:13px; font-weight:600; color:var(--gray-600); margin-bottom:6px; }
  .field input, .field textarea { width:100%; padding:10px 12px; border:1px solid var(--gray-200); border-radius:8px; font-size:16px; font-family:inherit; color:var(--gray-900); background:#fff; }
  .field textarea { min-height:64px; resize:vertical; }
  .field input:focus, .field textarea:focus { outline:2px solid var(--green); outline-offset:-1px; }
  .save-btn { width:100%; background:var(--green); color:#fff; border:none; border-radius:10px; padding:13px; font-size:15px; font-weight:700; cursor:pointer; }
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
  @media (max-width:600px){ .main{padding:16px 12px;} }
`;

class OneOnOne extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'save-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._user = null;
    this._roster = [];
    this._history = {};
    this._period = '';
    this._selectedId = null;
    this._saving = false;
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
          <div id="noAccess" class="empty-state" style="display:none">1:1 logging is available to managers. If you should have access, ask Operations to set your <em>manager</em> field.</div>
          <div id="rosterWrap" style="display:none">
            <div class="panel" style="padding:16px 22px;margin-bottom:16px;">
              <div class="sub" style="margin:0">Select a team member to log or review a 1:1 for <strong id="periodLabel"></strong>. A green dot means you've logged one this month.</div>
            </div>
            <div id="roster" class="roster"></div>
          </div>
          <div id="detail" style="display:none">
            <div class="panel">
              <h2 id="detailName"></h2>
              <div class="sub">Log a 1:1 meeting</div>
              <div class="field"><label for="mDate">Meeting date</label><input type="date" id="mDate"></div>
              <div class="field"><label for="mTopics">Topics discussed</label><textarea id="mTopics" placeholder="What did you cover?"></textarea></div>
              <div class="field"><label for="mNotes">Notes</label><textarea id="mNotes" placeholder="Key takeaways, how they're doing…"></textarea></div>
              <div class="field"><label for="mFollow">Follow-ups</label><textarea id="mFollow" placeholder="Action items / commitments"></textarea></div>
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
      const person = e.target.closest('[data-person]');
      if (person) this._select(person.getAttribute('data-person'));
    });
  }

  _applyInit(json) {
    let p;
    try { p = JSON.parse(json); } catch (e) { p = { error: 'Failed to load.' }; }
    if (p.error) { this._$('loadingState').innerHTML = `<span style="color:#b91c1c">${p.error}</span>`; return; }
    this._user = p.currentUser || null;
    this._roster = p.roster || [];
    this._history = p.history || {};
    this._period = p.period || '';
    this._$('loadingState').style.display = 'none';
    this._$('content').style.display = '';
    this._$('periodLabel').textContent = p.periodLabel || this._period;
    if (!this._roster.length) { this._$('noAccess').style.display = ''; return; }
    this._$('rosterWrap').style.display = '';
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
      this._$('mTopics').value = ''; this._$('mNotes').value = ''; this._$('mFollow').value = '';
      this._toast('1:1 logged ✓');
    } else {
      this._toast(typeof r.error === 'string' ? r.error : 'Something went wrong');
    }
  }

  _renderRoster() {
    this._$('roster').innerHTML = this._roster.map(p => `
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
    this._$('mTopics').value = ''; this._$('mNotes').value = ''; this._$('mFollow').value = '';
    this._renderHistory(id);
    this._$('detail').scrollIntoView({ behavior: 'smooth' });
  }

  _renderHistory(id) {
    const list = (this._history[id] || []).slice().sort((a, b) => a.meetingDate < b.meetingDate ? 1 : -1);
    const el = this._$('oooHistory');
    if (!list.length) { el.innerHTML = '<div class="empty-state">No 1:1s logged yet.</div>'; return; }
    el.innerHTML = list.map(o => `<div class="ooo-card"><div class="ooo-date">${o.meetingDate}</div>
      ${o.topics ? `<div class="ooo-line"><strong>Topics:</strong> ${o.topics}</div>` : ''}
      ${o.notes ? `<div class="ooo-line"><strong>Notes:</strong> ${o.notes}</div>` : ''}
      ${o.followUps ? `<div class="ooo-line"><strong>Follow-ups:</strong> ${o.followUps}</div>` : ''}</div>`).join('');
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
    this.dispatchEvent(new CustomEvent('save-meeting', {
      detail: {
        employeeId: this._selectedId,
        meetingDate,
        topics: this._$('mTopics').value.trim(),
        notes: this._$('mNotes').value.trim(),
        followUps: this._$('mFollow').value.trim(),
      },
      bubbles: true, composed: true,
    }));
  }
}

customElements.define('one-on-one', OneOnOne);
