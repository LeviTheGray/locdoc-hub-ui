/**
 * Wix Custom Element — Team Member Assessment  (<team-member-assessment>)
 *
 * Port of the htmlAssessmentWidget HtmlComponent. Three steps: pick a teammate →
 * score 6 criteria (1-4, with required feedback on 1 & 4) → success. See
 * CUSTOM-ELEMENTS.md for the recipe.
 *
 * Data handoff:
 *   • Velo → element :  init-data     { currentUser, employees, assessedIds } | { error }
 *                       submit-result { ok:true, subjectId } | { ok:false, error }
 *   • element → Velo :  'submit-assessment' { detail: record }
 *                       'navigate'          { detail: { key:'hub' } }
 *
 * Editor: Add → Embed Code → Custom Element → source = this file,
 * tag name `team-member-assessment`, element ID `assessmentWidget`.
 */

import { TOKENS } from './tokens.js';

const criteria = [
  { key: 'humble', label: 'Humble', desc: 'Acknowledges mistakes, accepts feedback, doesn\'t seek undue credit' },
  { key: 'hungry', label: 'Hungry', desc: 'Self-motivated, goes above and beyond, proactively takes on challenges' },
  { key: 'smart', label: 'Smart', desc: 'People-smart — reads the room, communicates effectively, builds rapport' },
  { key: 'helpfulKind', label: 'Helpful & Kind Communication', desc: 'Consistently helpful and kind to teammates and customers' },
  { key: 'fastResponse', label: 'Fast Response', desc: 'Promptly responds to requests, tickets, and communications' },
  { key: 'solvesProblems', label: 'Solves Problems', desc: 'Identifies root causes and finds effective, lasting solutions' },
];

const scoreInfo = {
  1: { label: 'Needs Improvement', short: 'Needs Work', cls: 's1' },
  2: { label: 'Meets Expectations', short: 'Meets', cls: 's2' },
  3: { label: 'Exceeds Expectations', short: 'Exceeds', cls: 's3' },
  4: { label: 'Outstanding', short: 'Outstanding', cls: 's4' },
};

function avatarInner(headshotUrl, initials) {
  return headshotUrl
    ? `<img src="${headshotUrl}" alt="${initials}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : initials;
}
// Deterministic shuffle — same seed → same selection (stable for the month).
function pickStable(arr, n, seed) {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (h * 33 ^ seed.charCodeAt(i)) >>> 0;
  const rand = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
  return [...arr].sort(() => rand() - 0.5).slice(0, n);
}

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ${TOKENS}
  :host { --red:#ef4444; background:var(--gray-50); }
  .backbtn { display:inline-flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; color:#6b7280; font:600 13px system-ui,-apple-system,sans-serif; padding:12px 16px 0; }
  .header { background: var(--primary); color: #fff; padding: 16px 24px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p  { font-size: 12px; opacity: .75; margin-top: 2px; }
  .main { max-width: 1100px; margin: 0 auto; padding: 28px 16px; }
  .page-intro { margin-bottom: 22px; }
  .page-intro h2 { font-size: 21px; font-weight: 700; }
  .page-intro p  { font-size: 14px; color: var(--gray-600); margin-top: 4px; }
  .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .toolbar label { font-size: 13px; font-weight: 600; color: var(--gray-600); }
  .toolbar select {
    padding: 7px 36px 7px 10px; border: 1px solid var(--gray-200); border-radius: 8px; font-size: 14px;
    background: #fff; color: var(--gray-900); cursor: pointer; min-width: 210px; -webkit-appearance: none; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M6 8L1 3h10z' fill='%236b7280'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
  }
  .toolbar select:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
  .count-pill { font-size: 12px; font-weight: 600; background: var(--gray-100); color: var(--gray-600); border-radius: 100px; padding: 3px 10px; }
  .emp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .emp-card { background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius); padding: 18px; cursor: pointer; box-shadow: var(--shadow); transition: border-color .15s, box-shadow .15s, transform .12s; }
  .emp-card:hover { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(var(--primary-rgb),.1), var(--shadow-md); transform: translateY(-2px); }
  .emp-card:active { transform: scale(.98); border-color: var(--primary); }
  .emp-avatar { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-lt), var(--primary)); color: #fff; font-size: 17px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; }
  .emp-name { font-size: 14px; font-weight: 700; line-height: 1.3; }
  .emp-dept { font-size: 12px; color: var(--gray-400); margin-top: 3px; }
  .emp-btn { display: block; width: 100%; margin-top: 14px; padding: 8px 0; background: var(--primary); color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .15s; }
  .emp-btn:hover { background: var(--primary-dk); }
  .no-results { text-align: center; padding: 64px 0; color: var(--gray-400); font-size: 15px; }
  .ext-badge { display: inline-block; margin-top: 6px; font-size: 10px; font-weight: 600; color: var(--gray-600); background: var(--gray-100); border: 1px solid var(--gray-200); border-radius: 100px; padding: 2px 8px; }
  .form-topbar { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
  .btn-back { padding: 8px 14px; border: 1px solid var(--gray-200); border-radius: 7px; background: #fff; font-size: 13px; color: var(--gray-600); cursor: pointer; white-space: nowrap; transition: all .15s; }
  .btn-back:hover { border-color: var(--gray-400); background: var(--gray-50); }
  .subject-block { display: flex; align-items: center; gap: 14px; flex: 1; }
  .subject-avatar { width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-lt), var(--primary)); color: #fff; font-size: 20px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .subject-block h2 { font-size: 19px; font-weight: 700; }
  .subject-block p  { font-size: 13px; color: var(--gray-400); margin-top: 2px; }
  .form-card { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow); }
  .card-title { font-size: 15px; font-weight: 700; padding-bottom: 14px; border-bottom: 1px solid var(--gray-200); margin-bottom: 24px; }
  .val-banner { display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #b91c1c; margin-bottom: 20px; }
  .slider-field { margin-bottom: 28px; }
  .slider-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .slider-label-text { font-size: 14px; font-weight: 700; }
  .slider-desc { font-size: 12px; color: var(--gray-400); margin-top: 2px; }
  .score-chip { font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 100px; white-space: nowrap; flex-shrink: 0; transition: background .2s, color .2s; }
  .s1 { background: #fee2e2; color: #991b1b; } .s2 { background: #fef3c7; color: #78350f; } .s3 { background: #dbeafe; color: #1e3a8a; } .s4 { background: #d1fae5; color: #064e3b; }
  .seg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .seg-btn { -webkit-appearance: none; appearance: none; font-family: inherit; border: 1.5px solid var(--gray-200); background: #fff; border-radius: 10px; padding: 12px 6px; min-height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; cursor: pointer; transition: border-color .12s, background .12s, transform .08s; -webkit-tap-highlight-color: transparent; }
  .seg-btn:active { transform: scale(.96); }
  .seg-num { font-size: 19px; font-weight: 800; line-height: 1; color: var(--gray-600); }
  .seg-cap { font-size: 10.5px; font-weight: 600; color: var(--gray-400); text-align: center; line-height: 1.2; }
  .seg-btn.sel { border-width: 2px; }
  .seg-btn.sel .seg-cap { color: var(--gray-900); }
  .seg-btn.sel-1 { border-color:#ef4444; background:#fee2e2; } .seg-btn.sel-1 .seg-num { color:#991b1b; }
  .seg-btn.sel-2 { border-color:#f59e0b; background:#fef3c7; } .seg-btn.sel-2 .seg-num { color:#78350f; }
  .seg-btn.sel-3 { border-color:#3b82f6; background:#dbeafe; } .seg-btn.sel-3 .seg-num { color:#1e3a8a; }
  .seg-btn.sel-4 { border-color:#10b981; background:#d1fae5; } .seg-btn.sel-4 .seg-num { color:#064e3b; }
  .feedback-box { display: none; margin-top: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; animation: fadeSlide .2s ease; }
  .feedback-box.active { display: block; }
  @keyframes fadeSlide { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
  .feedback-box label { display: block; font-size: 12px; font-weight: 700; color: #b91c1c; margin-bottom: 8px; }
  .feedback-box textarea { width: 100%; border: 1.5px solid #fca5a5; border-radius: 6px; padding: 8px 10px; font-size: 13px; font-family: inherit; resize: vertical; min-height: 72px; background: #fff; transition: border-color .15s; }
  .feedback-box textarea:focus  { outline: none; border-color: #ef4444; }
  .feedback-box textarea.filled { border-color: #6ee7b7; }
  .feedback-box textarea.error  { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,.15); }
  .divider { border: none; border-top: 1px solid var(--gray-200); margin: 24px 0; }
  .gen-feedback label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px; }
  .gen-feedback .opt { font-size: 12px; color: var(--gray-400); font-weight: 400; }
  .gen-feedback textarea { width: 100%; border: 1px solid var(--gray-200); border-radius: 8px; padding: 10px 12px; font-size: 14px; font-family: inherit; resize: vertical; min-height: 90px; }
  .gen-feedback textarea:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
  .form-actions { display: flex; gap: 12px; padding-top: 24px; border-top: 1px solid var(--gray-200); margin-top: 24px; }
  .btn-primary { flex: 1; padding: 12px 20px; background: var(--primary); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background .15s, transform .1s; }
  .btn-primary:hover { background: var(--primary-dk); transform: translateY(-1px); }
  .btn-secondary { padding: 12px 20px; background: transparent; border: 1px solid var(--gray-200); border-radius: 8px; font-size: 14px; color: var(--gray-600); cursor: pointer; transition: all .15s; }
  .btn-secondary:hover { border-color: var(--gray-400); background: var(--gray-50); }
  .emp-card--done { opacity: .6; cursor: default; pointer-events: none; }
  .emp-btn--done { background: var(--gray-200) !important; color: var(--gray-400) !important; cursor: default; }
  .assessed-badge { display: inline-block; margin-top: 6px; font-size: 10px; font-weight: 600; color: #065f46; background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 100px; padding: 2px 8px; }
  .loading-state { text-align: center; padding: 64px 0; color: var(--gray-400); font-size: 15px; }
  .success-wrap { max-width: 480px; margin: 48px auto; }
  .success-card { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 56px 40px; text-align: center; box-shadow: var(--shadow); }
  .success-icon { width: 72px; height: 72px; border-radius: 50%; background: #d1fae5; color: #059669; font-size: 34px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
  .success-card h2 { font-size: 24px; font-weight: 700; }
  .success-card p  { font-size: 14px; color: var(--gray-600); margin-top: 8px; }
  .success-card .btn-primary { display: inline-block; margin-top: 28px; padding: 12px 28px; flex: none; }
  @media (max-width: 600px) {
    .main { padding: 16px 12px; }
    .toolbar { flex-direction: column; align-items: stretch; gap: 8px; }
    .toolbar select { min-width: 0; width: 100%; font-size: 16px; }
    .emp-grid { grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 10px; }
    .emp-card { padding: 14px; }
    .form-topbar { flex-wrap: wrap; }
    .form-card { padding: 20px 16px; }
    .seg { gap: 6px; } .seg-btn { padding: 10px 3px; min-height: 58px; } .seg-num { font-size: 17px; } .seg-cap { font-size: 9.5px; }
    .feedback-box textarea, .gen-feedback textarea { font-size: 16px; }
    .form-actions { flex-direction: column-reverse; }
    .btn-primary, .btn-secondary { width: 100%; text-align: center; }
    .success-card { padding: 40px 24px; }
  }
`;

class TeamMemberAssessment extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'submit-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._user = null;
    this._userDept = null;
    this._employees = [];
    this._assessed = new Set();
    this._selected = null;
    this._extras = [];
    this._scores = {};
    this._pending = false;
  }

  connectedCallback() {
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyInit(this.getAttribute('init-data'));
  }

  attributeChangedCallback(name, _old, value) {
    if (!value) return;
    if (name === 'init-data') this._applyInit(value);
    if (name === 'submit-result') this._applyResult(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <button class="backbtn" data-action="back-hub">&#8592; Back to Employee Hub</button>
      <header class="header"><h1>Team Member Assessment</h1><p>LocDoc · Performance Reviews</p></header>
      <main class="main">
        <div id="step-list">
          <div class="page-intro"><h2>Select a Team Member to Assess</h2><p>Choose someone from the filtered list below to begin their assessment.</p></div>
          <div class="toolbar">
            <label for="teamFilter">Filter by Team:</label>
            <select id="teamFilter"></select>
            <span class="count-pill" id="countPill"></span>
          </div>
          <div id="empGrid" class="emp-grid"><div class="loading-state">Loading team members…</div></div>
          <div id="noResults" class="no-results" style="display:none">No team members found.</div>
        </div>
        <div id="step-form" style="display:none">
          <div class="form-topbar">
            <button class="btn-back" data-step="list">&#8592; Back to Team</button>
            <div class="subject-block">
              <div class="subject-avatar" id="subjectAvatar"></div>
              <div><h2 id="subjectName"></h2><p id="subjectDept"></p></div>
            </div>
          </div>
          <div class="form-card">
            <div class="card-title">Performance Ratings — Score each area 1 to 4</div>
            <div class="val-banner" id="valBanner"></div>
            <div id="slidersContainer"></div>
            <hr class="divider">
            <div class="gen-feedback">
              <label for="generalFeedback">Additional Feedback <span class="opt">(optional)</span></label>
              <textarea id="generalFeedback" placeholder="Any other comments about this team member's performance…"></textarea>
            </div>
            <div class="form-actions">
              <button class="btn-secondary" data-step="list">Cancel</button>
              <button class="btn-primary" id="submitBtn" data-action="submit">Submit Assessment</button>
            </div>
          </div>
        </div>
        <div id="step-success" style="display:none">
          <div class="success-wrap"><div class="success-card">
            <div class="success-icon">&#10003;</div><h2>Assessment Submitted!</h2>
            <p id="successMsg"></p>
            <button class="btn-primary" data-step="list">Assess Another Team Member</button>
          </div></div>
        </div>
      </main>`;

    this._buildSliders();

    const root = this.shadowRoot;
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="back-hub"]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
        return;
      }
      const stepBtn = e.target.closest('[data-step]');
      if (stepBtn) { this._showStep(stepBtn.getAttribute('data-step')); return; }
      if (e.target.closest('[data-action="submit"]')) { this._submit(); return; }
      const seg = e.target.closest('[data-score-key]');
      if (seg) { this._setScore(seg.getAttribute('data-score-key'), parseInt(seg.getAttribute('data-score-val'), 10)); return; }
      const card = e.target.closest('[data-select]');
      if (card) this._selectEmployee(card.getAttribute('data-select'));
    });
    root.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'teamFilter') this._filterEmployees();
    });
    root.addEventListener('input', (e) => {
      if (e.target && e.target.hasAttribute('data-fb')) {
        e.target.classList.toggle('filled', e.target.value.trim().length > 0);
        e.target.classList.remove('error');
      }
    });
  }

  // ── INIT ──
  _applyInit(json) {
    let p;
    try { p = JSON.parse(json); } catch (e) { p = { error: 'Failed to load.' }; }
    if (p.error) { this._$('empGrid').innerHTML = `<div class="loading-state" style="color:#b91c1c">${p.error}</div>`; return; }
    this._user = p.currentUser || null;
    this._userDept = this._user ? (this._user.department || null) : null;
    this._employees = p.employees || [];
    (p.assessedIds || []).forEach(id => this._assessed.add(id));

    const selfEmail = this._user ? this._user.email : null;
    const myTeam = this._userDept ? this._employees.filter(e => e.department === this._userDept && e.email !== selfEmail) : [];
    const extrasNeeded = Math.max(2, 5 - myTeam.length);
    const outsiders = this._employees.filter(e => e.email !== selfEmail && (this._userDept ? e.department !== this._userDept : true));
    const userId = this._user ? (this._user._id || this._user.email) : 'anon';
    const month = new Date().toISOString().slice(0, 7);
    this._extras = pickStable(outsiders, extrasNeeded, userId + month);

    this._buildTeamFilter();
    this._filterEmployees();
  }

  _applyResult(json) {
    let r;
    try { r = JSON.parse(json); } catch (e) { return; }
    this._pending = false;
    if (r.ok) {
      this._assessed.add(r.subjectId);
      this._filterEmployees();
      const s = this._selected;
      this._$('successMsg').textContent = `Assessment for ${s.firstName} ${s.lastName} recorded on ${new Date().toLocaleDateString()}.`;
      this._showStep('success');
    } else {
      const btn = this._$('submitBtn');
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Assessment'; }
      const banner = this._$('valBanner');
      banner.style.display = 'block';
      banner.textContent = r.error || 'Could not save. Please try again.';
    }
  }

  _buildTeamFilter() {
    const depts = [...new Set(this._employees.map(e => e.department))].filter(Boolean).sort();
    const sel = this._$('teamFilter');
    if (this._userDept) {
      sel.innerHTML = `<option value="myTeam">My Team (${this._userDept})</option>` +
        depts.filter(d => d !== this._userDept).map(d => `<option value="${d}">${d}</option>`).join('');
    } else {
      sel.innerHTML = `<option value="all">All Teams</option>` +
        depts.map(d => `<option value="${d}">${d}</option>`).join('');
    }
  }

  _filterEmployees() {
    const val = this._$('teamFilter').value;
    const grid = this._$('empGrid');
    const noRes = this._$('noResults');
    const pill = this._$('countPill');
    const selfEmail = this._user ? this._user.email : null;

    let list;
    if (val === 'myTeam') {
      const myTeam = this._employees.filter(e => e.department === this._userDept && e.email !== selfEmail);
      list = [...myTeam, ...this._extras.map(e => ({ ...e, _extra: true }))];
    } else if (val === 'all') {
      list = this._employees.filter(e => e.email !== selfEmail);
    } else {
      list = this._employees.filter(e => e.department === val && e.email !== selfEmail);
    }

    pill.textContent = `${list.length} member${list.length !== 1 ? 's' : ''}`;
    if (list.length === 0) { grid.innerHTML = ''; noRes.style.display = 'block'; return; }
    noRes.style.display = 'none';

    grid.innerHTML = list.map(emp => {
      const empId = emp._id || emp.id;
      const done = this._assessed.has(empId);
      const initials = emp.firstName[0] + emp.lastName[0];
      const extraBadge = emp._extra ? `<div class="ext-badge">↗ ${emp.department}</div>` : '';
      const assessedBadge = done ? `<div class="assessed-badge">✓ Assessed</div>` : '';
      const cardCls = done ? 'emp-card emp-card--done' : 'emp-card';
      const btnCls = done ? 'emp-btn emp-btn--done' : 'emp-btn';
      const btnText = done ? '✓ Assessed' : 'Begin Assessment';
      return `
        <div class="${cardCls}" data-select="${empId}">
          <div class="emp-avatar">${avatarInner(emp.headshotUrl, initials)}</div>
          <div class="emp-name">${emp.firstName} ${emp.lastName}</div>
          <div class="emp-dept">${emp.department}</div>
          ${extraBadge}${assessedBadge}
          <button class="${btnCls}" data-select="${empId}">${btnText}</button>
        </div>`;
    }).join('');
  }

  _buildSliders() {
    this._$('slidersContainer').innerHTML = criteria.map(c => `
      <div class="slider-field" id="field-${c.key}">
        <div class="slider-header">
          <div><div class="slider-label-text">${c.label}</div><div class="slider-desc">${c.desc}</div></div>
          <div class="score-chip s2" id="chip-${c.key}">Meets Expectations</div>
        </div>
        <div class="seg" role="group" aria-label="${c.label} score">
          ${[1, 2, 3, 4].map(n => `
            <button type="button" class="seg-btn" id="seg-${c.key}-${n}" data-score-key="${c.key}" data-score-val="${n}">
              <span class="seg-num">${n}</span><span class="seg-cap">${scoreInfo[n].short}</span>
            </button>`).join('')}
        </div>
        <div class="feedback-box" id="fb-${c.key}">
          <label id="fbl-${c.key}"></label>
          <textarea id="fbt-${c.key}" data-fb placeholder="Provide specific examples or context…"></textarea>
        </div>
      </div>`).join('');
  }

  _setScore(key, val) {
    const info = scoreInfo[val];
    this._scores[key] = val;
    [1, 2, 3, 4].forEach(n => {
      const b = this._$(`seg-${key}-${n}`);
      b.classList.remove('sel', 'sel-1', 'sel-2', 'sel-3', 'sel-4');
      if (n === val) b.classList.add('sel', `sel-${val}`);
    });
    const chip = this._$(`chip-${key}`);
    chip.className = `score-chip ${info.cls}`;
    chip.textContent = info.label;

    const fb = this._$(`fb-${key}`), fbl = this._$(`fbl-${key}`), fbt = this._$(`fbt-${key}`);
    if (val === 1 || val === 4) {
      fb.classList.add('active');
      fbl.textContent = val === 1
        ? '⚠  Score is 1 — Why does this area need improvement? (Required)'
        : '★  Score is 4 — What makes this area outstanding? (Required)';
    } else {
      fb.classList.remove('active');
      fbt.value = '';
      fbt.classList.remove('filled', 'error');
    }
  }

  _selectEmployee(id) {
    this._selected = this._employees.find(e => (e._id || e.id) === id);
    if (!this._selected) return;
    const s = this._selected;
    const initials = s.firstName[0] + s.lastName[0];
    this._$('subjectAvatar').innerHTML = avatarInner(s.headshotUrl, initials);
    this._$('subjectName').textContent = `${s.firstName} ${s.lastName}`;
    this._$('subjectDept').textContent = s.department;
    this._resetForm();
    this._showStep('form');
  }

  _resetForm() {
    criteria.forEach(c => this._setScore(c.key, 2));
    this._$('generalFeedback').value = '';
    this._$('valBanner').style.display = 'none';
    const btn = this._$('submitBtn'); // re-enable after a prior submit
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Assessment'; }
  }

  _validate() {
    const missing = [];
    criteria.forEach(c => {
      const val = this._scores[c.key];
      if (val === 1 || val === 4) {
        const fbt = this._$(`fbt-${c.key}`);
        if (!fbt.value.trim()) { missing.push(c.label); fbt.classList.add('error'); fbt.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      }
    });
    const banner = this._$('valBanner');
    if (missing.length) { banner.style.display = 'block'; banner.textContent = `Required feedback missing for: ${missing.join(', ')}`; return false; }
    banner.style.display = 'none';
    return true;
  }

  _submit() {
    if (this._pending) return;
    if (!this._validate()) return;

    const feedbackParts = [];
    criteria.forEach(c => {
      const val = this._scores[c.key];
      if (val === 1 || val === 4) feedbackParts.push(`${c.label} (${val}): ${this._$(`fbt-${c.key}`).value.trim()}`);
    });
    const general = this._$('generalFeedback').value.trim();
    if (general) feedbackParts.push(`General: ${general}`);

    const s = this._selected, u = this._user;
    const record = {
      subject: `${s.firstName} ${s.lastName}`,
      subjectId: s._id || s.id,
      submitter: u ? `${u.firstName} ${u.lastName}` : '',
      email: u ? u.email : '',
      humble: this._scores.humble, hungry: this._scores.hungry, smart: this._scores.smart,
      helpfulKind: this._scores.helpfulKind, fastResponse: this._scores.fastResponse, solvesProblems: this._scores.solvesProblems,
      feedback: feedbackParts.join('\n\n'),
    };

    this._pending = true;
    const btn = this._$('submitBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
    this.dispatchEvent(new CustomEvent('submit-assessment', { detail: record, bubbles: true, composed: true }));
  }

  _showStep(step) {
    this._$('step-list').style.display = step === 'list' ? '' : 'none';
    this._$('step-form').style.display = step === 'form' ? '' : 'none';
    this._$('step-success').style.display = step === 'success' ? '' : 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

customElements.define('team-member-assessment', TeamMemberAssessment);
