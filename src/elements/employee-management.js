/**
 * Wix Custom Element — Employee Management  (<employee-management>)
 *
 * A grouping page for admin/HR-adjacent tools that don't fit the regular member/manager
 * tool grid on Hub Home — reached via its own "Employee Management" tile there. Each tool
 * has its own access rule and is shown/hidden independently, not gated by one blanket check:
 *   • Onboarding & Offboarding — active, links to the existing /onboarding page
 *     (employee-lifecycle.js). Shown if `canOnboard` (backend/lifecycleAuth.js allowlist).
 *   • Fleet Management  — shown if `isManager`. Active — links to /fleet-management
 *     (fleet-management.js, backend/fleetManagement.web.js).
 *   • Bonus Payout Calculator — shown if `isOperations`. Not built yet — disabled/"Coming soon".
 * New tools get added here the same way — one more entry in TOOLS, its own visibility rule.
 *
 * Data handoff:
 *   • Velo → element :  init-data { currentUser, canOnboard, isManager, isOperations } | { error }
 *   • element → Velo :  'navigate' { detail: { key: 'onboarding' | 'fleet' | 'hub' } }
 *
 * Editor: Add → Embed Code → Custom Element → source = this file,
 * tag name `employee-management`, element ID `employeeManagement`.
 */

import { TOKENS, ensureMaterialSymbols } from './tokens.js';

// `active: false` tools render disabled with a "Coming soon" badge and never dispatch navigate —
// they exist just to reserve their spot until each one gets its own scoping/build pass.
const TOOLS = [
  { key: 'onboarding', icon: 'badge', name: 'Onboarding & Offboarding',
    desc: 'Create new employees and step them through onboarding, or offboard someone leaving.',
    active: true, visible: (a) => a.canOnboard },
  { key: 'fleet', icon: 'local_shipping', name: 'Fleet Management',
    desc: 'VIN, title, and other records for vehicles and trailers not tracked in Enterprise Fleet Management.',
    active: true, visible: (a) => a.isManager },
  { key: 'bonus', icon: 'payments', name: 'Bonus Payout Calculator',
    desc: 'Enter the inputs for a payout and calculate what each person is owed.',
    active: false, visible: (a) => a.isOperations },
];

const STYLES = `
  ${TOKENS}
  :host { background: var(--gray-50); display: block; }
  .backbtn { display:inline-flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; color:#6b7280; font:600 13px system-ui,-apple-system,sans-serif; padding:12px 16px 0; }
  .header { background: var(--header-bar); color: var(--white); padding: 16px 24px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p  { font-size: 12px; opacity: .75; margin-top: 2px; }
  .main { max-width: 900px; margin: 0 auto; padding: 36px 16px; }
  .loading-state { text-align: center; padding: 64px 0; color: var(--gray-400); font-size: 15px; }
  .page-intro { margin-bottom: 28px; }
  .page-intro h2 { font-size: 22px; font-weight: 700; }
  .page-intro p { font-size: 14px; color: var(--gray-600); margin-top: 6px; }
  .empty-state { text-align: center; padding: 48px 24px; color: var(--gray-400); font-size: 14px; }
  .tools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
  .tool-tile {
    position: relative; background: var(--surface); border: 1.5px solid var(--gray-200); border-radius: var(--radius);
    padding: 24px 18px 20px; box-shadow: var(--shadow); cursor: pointer; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    transition: border-color .15s, box-shadow .15s, transform .12s; -webkit-tap-highlight-color: transparent;
  }
  .tool-tile:hover { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(var(--primary-rgb),.10), var(--shadow-md); transform: translateY(-2px); }
  .tool-tile:active { transform: scale(.98); }
  .tool-tile.is-loading { pointer-events: none; opacity: .9; border-color: var(--primary); }
  .tool-tile.disabled { cursor: default; opacity: .65; }
  .tool-tile.disabled:hover { border-color: var(--gray-200); box-shadow: var(--shadow); transform: none; }
  .tool-icon { width: 56px; height: 56px; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: var(--icon-chip-bg); color: var(--icon); }
  .tool-icon .material-symbols-outlined { font-size: 30px; }
  .tile-name { font-size: 14px; font-weight: 700; line-height: 1.3; color: var(--gray-900); }
  .tile-desc { font-size: 12px; color: var(--gray-600); line-height: 1.45; }
  .soon-badge { position: absolute; top: 10px; right: 10px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; background: var(--gray-200); color: var(--gray-600); border-radius: 100px; padding: 3px 9px; }
  .btn-spinner { display: inline-block; width: 13px; height: 13px; margin-right: 7px; vertical-align: -2px; border: 2px solid rgba(var(--primary-rgb),.4); border-top-color: var(--primary); border-radius: 50%; animation: btnspin .6s linear infinite; }
  @keyframes btnspin { to { transform: rotate(360deg); } }
  @media (max-width: 600px) {
    .main { padding: 24px 12px; }
    .tools-grid { grid-template-columns: 1fr; }
  }
`;

class EmployeeManagement extends HTMLElement {
  static get observedAttributes() { return ['init-data']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._user = null;
    this._access = { canOnboard: false, isManager: false, isOperations: false };
    this._error = null;
    this._navigating = false;
  }

  connectedCallback() {
    ensureMaterialSymbols();
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyInit(this.getAttribute('init-data'));
  }

  attributeChangedCallback(name, _old, value) {
    if (name === 'init-data' && value) this._applyInit(value);
  }

  _$(sel) { return this.shadowRoot.querySelector(sel); }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <button class="backbtn" data-action="back-hub">&#8592; Back to Employee Hub</button>
      <header class="header"><h1>Employee Management</h1><p>LocDoc · Employee Hub</p></header>
      <main class="main">
        <div class="loading-state" data-loading>Loading…</div>
        <div data-content style="display:none">
          <div class="page-intro">
            <h2>Employee Management</h2>
            <p>Onboarding, fleet records, and bonus payouts — access to each tool below varies by role.</p>
          </div>
          <div class="tools-grid" data-tools></div>
          <div class="empty-state" data-empty style="display:none">No admin tools are available to your account.</div>
        </div>
      </main>`;

    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="back-hub"]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
        return;
      }
      const tile = e.target.closest('[data-key]');
      if (tile && !tile.classList.contains('disabled')) this._navigate(tile.getAttribute('data-key'), tile);
    });
  }

  _applyInit(json) {
    let p;
    try { p = JSON.parse(json); } catch (e) { p = { error: 'Failed to load.' }; }
    if (p.error) { this._$('[data-loading]').innerHTML = `<span style="color:#b91c1c">${p.error}</span>`; return; }
    this._user = p.currentUser || null;
    this._access = { canOnboard: !!p.canOnboard, isManager: !!p.isManager, isOperations: !!p.isOperations };
    this._render();
  }

  _navigate(key, tile) {
    if (this._navigating) return;
    this._navigating = true;
    tile.classList.add('is-loading');
    const nm = tile.querySelector('.tile-name');
    if (nm) nm.innerHTML = '<span class="btn-spinner"></span>Opening…';
    this._navTimeout = setTimeout(() => {
      this._navigating = false;
      tile.classList.remove('is-loading');
      const t = TOOLS.find(x => x.key === key);
      if (nm && t) nm.textContent = t.name;
      console.error(`[EmployeeManagement] Navigation for "${key}" did not complete within 6s.`);
    }, 6000);
    this.dispatchEvent(new CustomEvent('navigate', { detail: { key }, bubbles: true, composed: true }));
  }

  _card(t) {
    const disabled = !t.active;
    return `
      <div class="tool-tile ${disabled ? 'disabled' : ''}" ${disabled ? '' : `data-key="${t.key}"`}>
        ${disabled ? '<span class="soon-badge">Coming soon</span>' : ''}
        <div class="tool-icon"><span class="material-symbols-outlined">${t.icon}</span></div>
        <div class="tile-name">${t.name}</div>
        <div class="tile-desc">${t.desc}</div>
      </div>`;
  }

  _render() {
    if (!this._shell) this._renderShell();
    this._$('[data-loading]').style.display = 'none';
    this._$('[data-content]').style.display = '';

    const visibleTools = TOOLS.filter(t => t.visible(this._access));
    const grid = this._$('[data-tools]');
    const empty = this._$('[data-empty]');
    if (!visibleTools.length) {
      grid.innerHTML = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    grid.innerHTML = visibleTools.map(t => this._card(t)).join('');
  }
}

customElements.define('employee-management', EmployeeManagement);
