/**
 * Wix Custom Element — Employee onboarding / offboarding admin panel  (<employee-lifecycle>)
 *
 * A small operations panel (allowlist-gated, see lifecycleAuth.js) with two jobs:
 *   1. CREATE a new employee from a form and immediately kick off onboarding.
 *   2. LOOK UP an existing employee and Onboard / Offboard them with one button.
 *
 * The Employees `active` checkbox is the SOURCE OF TRUTH: onboard sets it true, offboard sets it
 * false. Each button also fires an n8n webhook (backend employeeLifecycle.web.js) so downstream
 * apps run the matching automation; the webhook outcome comes back as `automation` and is shown
 * inline so a failed automation is visible, not silent.
 *
 * Data handoff (mirrors tech-spotlight-submit):
 *   • Velo → element :  init-data      { admin } | { error }
 *                       search-result  { items:[{ _id, firstName, lastName, email, title,
 *                                        manager, active, automation }] } | { error }   (carries _ts)
 *                       action-result  { ok:true, employee, automation } |
 *                                       { ok:false, error }                              (carries _ts)
 *   • element → Velo :  'search'            { term }
 *                       'onboard'           { employeeId }
 *                       'offboard'          { employeeId }
 *                       'submit-and-onboard'{ firstName, lastName, email, title, manager }
 *                       'navigate'          { key }
 *
 * The backend re-checks authorization on every method, so a non-admin who forces `admin:true` here
 * still gets rejected server-side — the flag only decides what UI to paint.
 *
 * Editor setup: Add → Embed Code → Custom Element → this file, tag `employee-lifecycle`,
 * element ID `employeeLifecycle`.
 */

import { styles, ensureMaterialSymbols } from './tokens.js';

const STYLES = styles(`
  .main { max-width: 680px; margin: 0 auto; padding: 24px 16px 56px; }
  .sub { font-size: 14px; color: var(--gray-600); margin-bottom: 20px; }
  .section { margin-top: 28px; }
  .section h2 { font-size: 15px; font-weight: 700; margin-bottom: 12px; }
  label.f { display: block; font-size: 13px; font-weight: 700; margin: 14px 0 5px; }
  input[type=text], input[type=email] { width: 100%; padding: 10px 12px; border: 1.5px solid var(--gray-200);
    border-radius: 8px; font-size: 15px; font-family: inherit; }
  input:focus { outline: none; border-color: var(--primary); }
  .row2 { display: flex; gap: 12px; } .row2 > div { flex: 1; }
  .searchbar { display: flex; gap: 8px; }
  .searchbar input { flex: 1; }
  .searchbar .btn { flex-shrink: 0; }
  .list { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }
  .emp { padding: 14px 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .emp .info { flex: 1; min-width: 180px; }
  .emp .name { font-size: 15px; font-weight: 700; }
  .emp .meta { font-size: 12px; color: var(--gray-600); margin-top: 2px; }
  .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .pill.on  { background: #e2ece0; color: var(--primary-dk); }
  .pill.off { background: var(--gray-100); color: var(--gray-600); }
  .emp .actions { display: flex; gap: 8px; }
  .btn.ghost { background: var(--gray-100); color: var(--gray-900); }
  .btn.ghost:hover { background: var(--gray-200); }
  .btn.danger { background: var(--error); }
  .btn.danger:hover { background: #8a1705; }
  .btn.sm { padding: 8px 12px; font-size: 13px; }
  .auto { font-size: 11px; margin-top: 4px; }
  .auto.err { color: var(--error); } .auto.ok { color: var(--success); }
  .empty { font-size: 13px; color: var(--gray-400); padding: 12px 0; }
  .msg { margin-top: 16px; padding: 12px 14px; border-radius: 8px; font-size: 14px; display: none; }
  .msg.err { display: block; background: #fee2e2; color: #b91c1c; }
  .msg.ok  { display: block; background: #d1fae5; color: var(--primary-dk); }
  .link { background: none; border: none; color: var(--primary-dk); font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 20px; }
`);

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Parse the JSON automation blob the backend stamps onto a row into a short, human line.
function autoLine(raw) {
  if (!raw) return null;
  let a;
  try { a = JSON.parse(raw); } catch (e) { return null; }
  if (!a || !a.action) return null;
  const when = a.at ? new Date(a.at).toLocaleString() : '';
  if (a.status === 'error') return { err: true, text: `${a.action} automation failed: ${a.error || 'unknown'} · ${when}` };
  return { err: false, text: `${a.action} automation ${a.status} · ${when}` };
}

class EmployeeLifecycle extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'search-result', 'action-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._admin = false;
    this._loaded = false;
    this._error = null;
    this._items = [];          // search results
    this._searched = false;    // has a search run yet?
    this._busy = null;         // employeeId currently mid-action (disables its buttons)
    this._msg = null;          // { ok, text } banner for the create form
    this._creating = false;
    this._draft = {};          // create-form fields kept across re-renders
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
    if (name === 'init-data')     this._applyInit(value);
    if (name === 'search-result') this._applySearch(value);
    if (name === 'action-result') this._applyAction(value);
  }

  _applyInit(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._admin = Boolean(p.admin);
    this._error = p.error || null;
    this._loaded = true;
    this._render();
  }

  _applySearch(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._items = Array.isArray(p.items) ? p.items : [];
    this._searched = true;
    this._busy = null;
    this._render();
  }

  _applyAction(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._busy = null;
    if (p.ok && p.employee) {
      // Splice the updated row back into the list so the pill + automation line refresh in place.
      const updated = { ...p.employee, automation: JSON.stringify(p.automation || {}) };
      const i = this._items.findIndex((e) => e._id === updated._id);
      if (i >= 0) this._items[i] = updated;
      const a = autoLine(updated.automation);
      const warn = a && a.err ? ` (but the automation failed — see below)` : '';
      this._msg = { ok: true, text: `Saved${warn}.` };
      if (this._creating) { this._creating = false; this._draft = {}; }
    } else {
      this._msg = { ok: false, text: p.error || 'Action failed.' };
    }
    this._render();
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <header class="header"><h1>👤 Employee Onboarding</h1>
        <p>Create, onboard, and offboard employees — fires the automations in n8n.</p></header>
      <main class="main" data-main></main>`;

    this.shadowRoot.addEventListener('click', (e) => {
      const on = e.target.closest('[data-onboard]');
      if (on) return this._action('onboard', on.getAttribute('data-onboard'));
      const off = e.target.closest('[data-offboard]');
      if (off) return this._action('offboard', off.getAttribute('data-offboard'));
      if (e.target.closest('[data-search]')) return this._search();
      if (e.target.closest('[data-create]')) return this._create();
      if (e.target.closest('[data-nav]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
    });
    this.shadowRoot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'q') { e.preventDefault(); this._search(); }
    });
    this.shadowRoot.addEventListener('input', (e) => {
      const k = e.target && e.target.getAttribute && e.target.getAttribute('data-field');
      if (k) this._draft[k] = e.target.value;
    });
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _search() {
    const term = (this._$('q') && this._$('q').value || '').trim();
    this.dispatchEvent(new CustomEvent('search', { detail: { term }, bubbles: true, composed: true }));
  }

  _action(action, employeeId) {
    if (this._busy) return;
    this._busy = employeeId;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent(action, { detail: { employeeId }, bubbles: true, composed: true }));
  }

  _create() {
    const d = this._draft;
    if (!(d.email || '').trim()) { this._msg = { ok: false, text: 'Email is required.' }; return this._render(); }
    this._creating = true;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('submit-and-onboard', {
      detail: {
        firstName: (d.firstName || '').trim(),
        lastName: (d.lastName || '').trim(),
        email: (d.email || '').trim(),
        title: (d.title || '').trim(),
        manager: (d.manager || '').trim(),
      },
      bubbles: true, composed: true,
    }));
  }

  _render() {
    const main = this.shadowRoot.querySelector('[data-main]');
    if (!this._loaded) { main.innerHTML = `<p class="sub">Loading…</p>`; return; }
    if (this._error) {
      main.innerHTML = `<div class="msg err">${esc(this._error)}</div>
        <button class="link" data-nav>← Back to the Hub</button>`;
      return;
    }
    if (!this._admin) {
      main.innerHTML = `<div class="msg err">You're not authorized to manage onboarding.</div>
        <button class="link" data-nav>← Back to the Hub</button>`;
      return;
    }
    main.innerHTML = `
      ${this._msg ? `<div class="msg ${this._msg.ok ? 'ok' : 'err'}">${esc(this._msg.text)}</div>` : ''}
      ${this._createSection()}
      ${this._lookupSection()}
      <button class="link" data-nav>← Back to the Hub</button>`;
  }

  _createSection() {
    const d = this._draft;
    const busy = this._creating ? 'is-loading' : '';
    return `<div class="section card" style="padding:18px 20px">
      <h2>Add a new employee</h2>
      <div class="row2">
        <div><label class="f">First name</label>
          <input type="text" data-field="firstName" value="${esc(d.firstName || '')}"></div>
        <div><label class="f">Last name</label>
          <input type="text" data-field="lastName" value="${esc(d.lastName || '')}"></div>
      </div>
      <label class="f">Email *</label>
      <input type="email" data-field="email" value="${esc(d.email || '')}">
      <div class="row2">
        <div><label class="f">Title</label>
          <input type="text" data-field="title" value="${esc(d.title || '')}"></div>
        <div><label class="f">Manager / team</label>
          <input type="text" data-field="manager" value="${esc(d.manager || '')}"></div>
      </div>
      <button class="btn ${busy}" data-create style="margin-top:18px">
        ${this._creating ? '<span class="btn-spinner"></span>Onboarding…' : 'Create & start onboarding'}</button>
    </div>`;
  }

  _lookupSection() {
    return `<div class="section">
      <h2>Find an existing employee</h2>
      <div class="searchbar">
        <input type="text" id="q" placeholder="Search name or email…">
        <button class="btn" data-search>Search</button>
      </div>
      <div class="list">${this._listBody()}</div>
    </div>`;
  }

  _listBody() {
    if (!this._searched) return `<p class="empty">Search to pull up an employee.</p>`;
    if (!this._items.length) return `<p class="empty">No matches.</p>`;
    return this._items.map((e) => {
      const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email;
      const active = e.active === true;
      const busy = this._busy === e._id;
      const a = autoLine(e.automation);
      const meta = [e.title, e.manager, e.email].filter(Boolean).map(esc).join(' · ');
      return `<div class="emp card">
        <div class="info">
          <div class="name">${esc(name)} <span class="pill ${active ? 'on' : 'off'}">${active ? 'Active' : 'Inactive'}</span></div>
          ${meta ? `<div class="meta">${meta}</div>` : ''}
          ${a ? `<div class="auto ${a.err ? 'err' : 'ok'}">${esc(a.text)}</div>` : ''}
        </div>
        <div class="actions">
          ${active
            ? `<button class="btn danger sm ${busy ? 'is-loading' : ''}" data-offboard="${esc(e._id)}">
                 ${busy ? '<span class="btn-spinner"></span>…' : 'Offboard'}</button>`
            : `<button class="btn sm ${busy ? 'is-loading' : ''}" data-onboard="${esc(e._id)}">
                 ${busy ? '<span class="btn-spinner"></span>…' : 'Onboard'}</button>`}
        </div>
      </div>`;
    }).join('');
  }
}

customElements.define('employee-lifecycle', EmployeeLifecycle);
