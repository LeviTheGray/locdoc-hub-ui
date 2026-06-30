/**
 * Wix Custom Element — Employee Hub Home  (<hub-home>)
 *
 * The Employee Hub home UI as a git-synced web component. Lives in
 * src/public/custom-elements/ and syncs through the Wix Git integration —
 * UI changes deploy on `git push`, no manual paste.
 *
 * Data handoff (mirrors the old postMessage bridge):
 *   • Velo → element :  $w('#hubHome').setAttribute('init-data', JSON.stringify({ currentUser }))
 *   • element → Velo :  dispatches a 'navigate' CustomEvent { detail: { key } };
 *                       the page code maps key → path and calls wixLocation.to().
 *
 * Editor setup (one time): Add → Embed Code → Custom Element → choose this file,
 * set the tag name to `hub-home`, and give the element the ID `hubHome`.
 */

import { TOKENS } from './tokens.js';

const PAGE_KEYS = ['assessment', 'weeklyReport', 'myReports', 'cleanlinessAudit', 'teamReports', 'cleanlinessReport', 'oneOnOne', 'techSpotlight'];

// Three-level layout:
//   scorecard → top row (My Scorecard, full width)
//   submit    → middle row (the three submit cards)
//   manager   → bottom row (Manager Reporting; shown only to managers)
const ALL_TOOLS = [
  { key: 'myReports',    level: 'scorecard', icon: '📊', iconClass: 'blue',  name: 'My Scorecard',
    desc: 'Your measurables, score, streak and badges — assessments, weekly reports and more, all in one place.',
    btnText: 'View My Scorecard' },

  { key: 'weeklyReport', level: 'submit', icon: '📝', iconClass: 'amber', name: 'Submit Weekly Report',
    desc: 'Submit your weekly check-in: stress, morale, workload, and your highs and lows.',
    btnText: 'Submit Weekly Report' },
  { key: 'assessment',   level: 'submit', icon: '📋', iconClass: 'green', name: 'Team Assessments',
    desc: 'Rate your teammates on the six core criteria. Monthly — one assessment per person.',
    btnText: 'Start Assessment' },
  { key: 'cleanlinessAudit', level: 'submit', icon: '🧹', iconClass: 'amber', name: 'Cleanliness Audit',
    desc: 'Submit this week\'s cleanliness audit for your branch, with scores and photos.',
    btnText: 'Submit Audit' },
  { key: 'techSpotlight', level: 'submit', icon: '🔧', iconClass: 'green', name: 'Submit a Tech Spotlight',
    desc: 'Share a job you\'re proud of — photos plus the problem and how you solved it — to present at the Wednesday meeting.',
    btnText: 'Submit Spotlight' },

  { key: 'teamReports',  level: 'manager', icon: '👥', iconClass: 'green', name: 'Team Scorecard (Manager View)',
    desc: 'The Monthly Manager Meeting view: your meeting checklist, team scores and leaderboard for the people you manage.',
    btnText: 'View Team Scorecard' },
  { key: 'cleanlinessReport', level: 'manager', icon: '📈', iconClass: 'blue', name: 'Cleanliness Report',
    desc: 'Weekly cleanliness results for your branches: non-submitters, score trends and photos.',
    btnText: 'View Cleanliness Report' },
  { key: 'oneOnOne', level: 'manager', icon: '🤝', iconClass: 'amber', name: 'Submit a 1:1',
    desc: 'Log a one-on-one meeting with a team member you manage — notes and follow-ups, counted on their scorecard.',
    btnText: 'Submit a 1:1' },
];

const STYLES = `
  ${TOKENS}
  .header { background: var(--green); color: #fff; padding: 16px 24px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p  { font-size: 12px; opacity: .75; margin-top: 2px; }
  .main { max-width: 900px; margin: 0 auto; padding: 36px 16px; }
  .welcome { margin-bottom: 36px; }
  .welcome h2 { font-size: 24px; font-weight: 700; line-height: 1.3; }
  .welcome p  { font-size: 15px; color: var(--gray-600); margin-top: 6px; }
  .loading-state { text-align: center; padding: 64px 0; color: var(--gray-400); font-size: 15px; }
  .manager-section { margin-top: 40px; }
  .section-title {
    font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    color: var(--gray-400); padding-bottom: 12px; margin-bottom: 18px; border-bottom: 1px solid var(--gray-200);
  }
  .tools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
  .tools-grid + .manager-section { margin-top: 32px; }
  .tool-tile {
    position: relative; background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius);
    padding: 22px 14px 18px; box-shadow: var(--shadow); cursor: pointer; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    transition: border-color .15s, box-shadow .15s, transform .12s; -webkit-tap-highlight-color: transparent;
  }
  .tool-tile:hover { border-color: var(--green); box-shadow: 0 0 0 4px rgba(21,128,61,.08), var(--shadow-md); transform: translateY(-2px); }
  .tool-tile:active { transform: scale(.98); }
  .tool-tile.is-loading { pointer-events: none; opacity: .9; border-color: var(--green); }
  .tool-icon { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 26px; flex-shrink: 0; }
  .tool-icon.green { background: #d1fae5; } .tool-icon.blue { background: #dbeafe; } .tool-icon.amber { background: #fef3c7; }
  .tile-name { font-size: 13px; font-weight: 700; line-height: 1.3; color: var(--gray-900); }
  .tile-info {
    position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; border-radius: 50%;
    border: 1px solid var(--gray-200); background: var(--gray-50); color: var(--gray-400);
    font: 700 12px Georgia, 'Times New Roman', serif; font-style: italic; cursor: pointer; padding: 0; line-height: 1;
    display: flex; align-items: center; justify-content: center; transition: background .15s, color .15s;
  }
  .tile-info:hover { background: var(--green); color: #fff; border-color: var(--green); }
  .tile-pop {
    display: none; position: absolute; top: 32px; right: 8px; left: 8px; z-index: 10;
    background: var(--gray-900); color: #fff; font-size: 12px; font-weight: 500; line-height: 1.45;
    text-align: left; padding: 10px 12px; border-radius: 8px; box-shadow: var(--shadow-md);
  }
  .tile-pop.open { display: block; }
  .btn-spinner { display: inline-block; width: 13px; height: 13px; margin-right: 7px; vertical-align: -2px; border: 2px solid rgba(21,128,61,.4); border-top-color: var(--green); border-radius: 50%; animation: btnspin .6s linear infinite; }
  @keyframes btnspin { to { transform: rotate(360deg); } }
  @media (max-width: 600px) {
    .main { padding: 24px 12px; } .welcome h2 { font-size: 20px; }
    .tools-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; }
    .tool-icon { width: 48px; height: 48px; font-size: 22px; }
    .tool-tile { padding: 16px 8px 14px; }
  }
`;

class HubHome extends HTMLElement {
  static get observedAttributes() { return ['init-data']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._user = null;
    this._error = null;
    this._navigating = false;
  }

  connectedCallback() {
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyData(this.getAttribute('init-data'));
  }

  attributeChangedCallback(name, _old, value) {
    if (name === 'init-data' && value) this._applyData(value);
  }

  _applyData(json) {
    let parsed = {};
    try { parsed = JSON.parse(json) || {}; } catch (e) { parsed = { error: 'Failed to load.' }; }
    this._error = parsed.error || null;
    this._user = parsed.currentUser || null;
    this._render();
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <header class="header"><h1>Employee Hub</h1><p>LocDoc · Internal Portal</p></header>
      <main class="main">
        <div class="loading-state" data-loading>Loading…</div>
        <div data-content style="display:none">
          <div class="welcome"><h2 data-welcome>Welcome back!</h2><p data-sub></p></div>
          <div class="tools-grid" data-tools></div>
          <div class="manager-section" data-manager-section style="display:none">
            <div class="section-title">Manager Reporting</div>
            <div class="tools-grid" data-manager-tools></div>
          </div>
        </div>
      </main>`;
    this.shadowRoot.addEventListener('click', (e) => {
      const info = e.target.closest('[data-info]');
      if (info) { e.stopPropagation(); this._toggleInfo(info.getAttribute('data-info')); return; }
      const tile = e.target.closest('[data-key]');
      if (tile) { this._navigate(tile.getAttribute('data-key'), tile); return; }
      this._closeInfo(); // tap elsewhere dismisses any open popover
    });
  }

  _toggleInfo(key) {
    const pop = this.shadowRoot.querySelector(`.tile-pop[data-pop="${key}"]`);
    const wasOpen = pop && pop.classList.contains('open');
    this._closeInfo();
    if (pop && !wasOpen) pop.classList.add('open');
  }
  _closeInfo() {
    this.shadowRoot.querySelectorAll('.tile-pop.open').forEach(p => p.classList.remove('open'));
  }

  _navigate(key, tile) {
    if (this._navigating || !PAGE_KEYS.includes(key)) return;
    this._navigating = true;
    if (tile) {
      tile.classList.add('is-loading');
      const nm = tile.querySelector('.tile-name');
      if (nm) nm.innerHTML = '<span class="btn-spinner"></span>Opening…';
    }
    // Hand navigation to the Velo page code (it owns wix-location).
    this.dispatchEvent(new CustomEvent('navigate', { detail: { key }, bubbles: true, composed: true }));
  }

  _card(t) {
    return `
      <div class="tool-tile" data-key="${t.key}">
        <button class="tile-info" data-info="${t.key}" aria-label="About ${t.name}">i</button>
        <div class="tool-icon ${t.iconClass}">${t.icon}</div>
        <div class="tile-name">${t.name}</div>
        <div class="tile-pop" data-pop="${t.key}">${t.desc}</div>
      </div>`;
  }

  _render() {
    const root = this.shadowRoot;
    if (this._error) {
      root.querySelector('[data-loading]').textContent = this._error;
      return;
    }
    root.querySelector('[data-loading]').style.display = 'none';
    root.querySelector('[data-content]').style.display = '';

    const u = this._user;
    root.querySelector('[data-welcome]').textContent =
      u ? `Welcome back, ${u.firstName || u.email}!` : 'Welcome back!';
    root.querySelector('[data-sub]').textContent =
      (u && u.department) ? `${u.department} · LocDoc Employee Hub` : 'LocDoc Employee Hub';

    // Member tools (scorecard + submit) share one icon grid so all five show together.
    root.querySelector('[data-tools]').innerHTML =
      ALL_TOOLS.filter(t => t.level === 'scorecard' || t.level === 'submit').map(t => this._card(t)).join('');

    const isManager = !!(u && (u.manager || '').trim());
    const managerTools = ALL_TOOLS.filter(t => t.level === 'manager');
    const section = root.querySelector('[data-manager-section]');
    if (isManager && managerTools.length) {
      root.querySelector('[data-manager-tools]').innerHTML = managerTools.map(t => this._card(t)).join('');
      section.style.display = '';
    } else {
      section.style.display = 'none';
    }
  }
}

customElements.define('hub-home', HubHome);
