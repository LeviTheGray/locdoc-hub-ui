/**
 * Wix Custom Element — Employee onboarding / offboarding admin panel  (<employee-lifecycle>)
 *
 * A small operations panel (allowlist-gated, see lifecycleAuth.js) with two jobs:
 *   1. CREATE a new employee from a form (no steps auto-run — trigger each individually).
 *   2. LOOK UP an existing employee and drive their onboarding/offboarding STEP BY STEP.
 *
 * Each step (see STEPS below — mirrors backend/lifecycleSteps.js) has independent status:
 * pending → sent (n8n webhook fired) → done (n8n confirmed via its callback) or error. Manual
 * steps (dataExportConfirmed, userDeleted) skip the webhook entirely — they're a plain checkbox an
 * admin ticks themselves. `active` on the row is DERIVED server-side (all required onboarding
 * steps done); this panel never sets it directly, only triggers/confirms individual steps.
 *
 * Data handoff (mirrors tech-spotlight-submit):
 *   • Velo → element :  init-data      { admin } | { error }
 *                       search-result  { items:[{ _id, firstName, lastName, email, title,
 *                                        manager, vehicleNumber, active, steps:{[key]:{status,at,error?}} }] }
 *                                      | { error }                                          (carries _ts)
 *                       action-result  { ok:true, employee } | { ok:false, error }          (carries _ts)
 *   • element → Velo :  'search'            { term }
 *                       'trigger-step'      { employeeId, stepKey }
 *                       'mark-manual'       { employeeId, stepKey, done }
 *                       'update-van'        { employeeId, vehicleNumber }
 *                       'submit-and-onboard'{ firstName, lastName, email, title, manager, vehicleNumber }
 *                       'navigate'          { key }
 *
 * The backend re-checks authorization and step validity on every method, so a non-admin who forces
 * `admin:true` here still gets rejected server-side — the flag only decides what UI to paint.
 *
 * Editor setup: Add → Embed Code → Custom Element → this file, tag `employee-lifecycle`,
 * element ID `employeeLifecycle`.
 */

import { styles, ensureMaterialSymbols } from './tokens.js';

// Mirrors backend/lifecycleSteps.js — keep the two in sync if steps change.
const ONBOARDING_STEPS = [
  { key: 'googleWorkspace', label: 'Google Workspace user', manual: false },
  { key: 'omsContact', label: 'OMS contact', manual: false },
  { key: 'omsTechnician', label: 'OMS technician', manual: false },
  { key: 'vanAssignment', label: 'Van link', manual: false, requires: (e) => !!e.vehicleNumber },
  { key: 'vcfCard', label: 'vCard emailed to team', manual: false },
];
const OFFBOARDING_STEPS = [
  { key: 'omsArchive', label: 'OMS contact archived', manual: false },
  { key: 'dataExportConfirmed', label: 'Data export confirmed', manual: true },
  { key: 'userDeleted', label: 'Google Workspace user deleted', manual: true },
];

const STYLES = styles(`
  .main { max-width: 760px; margin: 0 auto; padding: 24px 16px 56px; }
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
  .emp { padding: 14px 16px 16px; }
  .emp .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .emp .info { flex: 1; min-width: 180px; }
  .emp .name { font-size: 15px; font-weight: 700; }
  .emp .meta { font-size: 12px; color: var(--gray-600); margin-top: 2px; }
  .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .pill.on  { background: #e2ece0; color: var(--primary-dk); }
  .pill.off { background: var(--gray-100); color: var(--gray-600); }
  .mode-toggle { display: flex; gap: 6px; }
  .mode-toggle button { padding: 6px 10px; font-size: 12px; font-weight: 700; border-radius: 999px;
    border: 1.5px solid var(--gray-200); background: none; cursor: pointer; color: var(--gray-600); }
  .mode-toggle button.sel { background: var(--gray-900); color: #fff; border-color: var(--gray-900); }
  .steps { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
  .step { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; background: var(--gray-50, #fafafa); }
  .step .label { flex: 1; font-size: 13px; font-weight: 600; }
  .step .when { font-size: 11px; color: var(--gray-500); }
  .step-chip { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; border: none; cursor: pointer; }
  .step-chip.pending, .step-chip[disabled] { background: var(--gray-100); color: var(--gray-600); }
  .step-chip.sent { background: #fef3c7; color: #92400e; cursor: default; }
  .step-chip.done { background: #d1fae5; color: var(--primary-dk); cursor: default; }
  .step-chip.error { background: #fee2e2; color: #b91c1c; }
  .step-chip.na { background: none; color: var(--gray-400); cursor: default; }
  .step input[type=checkbox] { width: 16px; height: 16px; }
  .van-row { display: flex; gap: 8px; align-items: center; margin-top: 12px; }
  .van-row input { max-width: 140px; }
  .van-row .btn { flex-shrink: 0; }
  .emp .actions { display: flex; gap: 8px; }
  .btn.ghost { background: var(--gray-100); color: var(--gray-900); }
  .btn.ghost:hover { background: var(--gray-200); }
  .btn.danger { background: var(--error); }
  .btn.danger:hover { background: #8a1705; }
  .btn.sm { padding: 8px 12px; font-size: 13px; }
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

function fmt(at) {
  return at ? new Date(at).toLocaleString() : '';
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
    this._busyKey = null;      // `${employeeId}:${stepKey}` currently mid-action
    this._msg = null;          // { ok, text } banner
    this._creating = false;
    this._draft = {};          // create-form fields kept across re-renders
    this._vanDraft = {};       // employeeId -> in-progress van number edit
    this._mode = {};           // employeeId -> 'onboard' | 'offboard' (toggle override)
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
    this._busyKey = null;
    this._render();
  }

  _applyAction(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._busyKey = null;
    if (p.ok && p.employee) {
      const updated = p.employee;
      const i = this._items.findIndex((e) => e._id === updated._id);
      if (i >= 0) this._items[i] = updated;
      this._msg = { ok: true, text: 'Saved.' };
      if (this._creating) {
        this._creating = false;
        this._draft = {};
        this._searched = true;
        if (!this._items.some((e) => e._id === updated._id)) this._items.unshift(updated);
      }
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
        <p>Create employees and drive onboarding/offboarding step by step — each step fires its own n8n automation.</p></header>
      <main class="main" data-main></main>`;

    this.shadowRoot.addEventListener('click', (e) => {
      const step = e.target.closest('[data-step]');
      if (step && !step.disabled) {
        return this._triggerStep(step.getAttribute('data-emp'), step.getAttribute('data-step'));
      }
      const mode = e.target.closest('[data-mode]');
      if (mode) return this._setMode(mode.getAttribute('data-emp'), mode.getAttribute('data-mode'));
      const van = e.target.closest('[data-van-save]');
      if (van) return this._saveVan(van.getAttribute('data-van-save'));
      if (e.target.closest('[data-search]')) return this._search();
      if (e.target.closest('[data-create]')) return this._create();
      if (e.target.closest('[data-nav]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
    });
    this.shadowRoot.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-manual]');
      if (cb) return this._markManual(cb.getAttribute('data-emp'), cb.getAttribute('data-manual'), cb.checked);
    });
    this.shadowRoot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'q') { e.preventDefault(); this._search(); }
    });
    this.shadowRoot.addEventListener('input', (e) => {
      const k = e.target && e.target.getAttribute && e.target.getAttribute('data-field');
      if (k) this._draft[k] = e.target.value;
      const vk = e.target && e.target.getAttribute && e.target.getAttribute('data-van');
      if (vk) this._vanDraft[vk] = e.target.value;
    });
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _search() {
    const term = (this._$('q') && this._$('q').value || '').trim();
    this.dispatchEvent(new CustomEvent('search', { detail: { term }, bubbles: true, composed: true }));
  }

  _setMode(employeeId, mode) {
    this._mode[employeeId] = mode;
    this._render();
  }

  _triggerStep(employeeId, stepKey) {
    const busyKey = `${employeeId}:${stepKey}`;
    if (this._busyKey) return;
    this._busyKey = busyKey;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('trigger-step', { detail: { employeeId, stepKey }, bubbles: true, composed: true }));
  }

  _markManual(employeeId, stepKey, done) {
    this._msg = null;
    this.dispatchEvent(new CustomEvent('mark-manual', { detail: { employeeId, stepKey, done }, bubbles: true, composed: true }));
  }

  _saveVan(employeeId) {
    const vehicleNumber = (this._vanDraft[employeeId] || '').trim();
    this._msg = null;
    this.dispatchEvent(new CustomEvent('update-van', { detail: { employeeId, vehicleNumber }, bubbles: true, composed: true }));
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
        vehicleNumber: (d.vehicleNumber || '').trim(),
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
      <label class="f">Van number (optional — add later if not assigned yet)</label>
      <input type="text" data-field="vehicleNumber" value="${esc(d.vehicleNumber || '')}">
      <button class="btn ${busy}" data-create style="margin-top:18px">
        ${this._creating ? '<span class="btn-spinner"></span>Creating…' : 'Create employee'}</button>
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
    if (!this._searched) return `<p class="empty">Search to pull up an employee, or create one above.</p>`;
    if (!this._items.length) return `<p class="empty">No matches.</p>`;
    return this._items.map((e) => this._empCard(e)).join('');
  }

  _empCard(e) {
    const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email;
    const active = e.active === true;
    const mode = this._mode[e._id] || (active ? 'offboard' : 'onboard');
    const steps = mode === 'offboard' ? OFFBOARDING_STEPS : ONBOARDING_STEPS;
    const meta = [e.title, e.manager, e.email].filter(Boolean).map(esc).join(' · ');
    const van = this._vanDraft[e._id] != null ? this._vanDraft[e._id] : (e.vehicleNumber || '');

    return `<div class="emp card">
      <div class="top">
        <div class="info">
          <div class="name">${esc(name)} <span class="pill ${active ? 'on' : 'off'}">${active ? 'Active' : 'Inactive'}</span></div>
          ${meta ? `<div class="meta">${meta}</div>` : ''}
        </div>
        <div class="mode-toggle">
          <button data-mode="onboard" data-emp="${esc(e._id)}" class="${mode === 'onboard' ? 'sel' : ''}">Onboarding</button>
          <button data-mode="offboard" data-emp="${esc(e._id)}" class="${mode === 'offboard' ? 'sel' : ''}">Offboarding</button>
        </div>
      </div>
      <div class="van-row">
        <label class="f" style="margin:0">Van #</label>
        <input type="text" data-van="${esc(e._id)}" value="${esc(van)}" placeholder="none">
        <button class="btn ghost sm" data-van-save="${esc(e._id)}">Save</button>
      </div>
      <div class="steps">${steps.map((s) => this._stepRow(e, s)).join('')}</div>
    </div>`;
  }

  _stepRow(e, step) {
    const applicable = !step.requires || step.requires(e);
    const st = (e.steps && e.steps[step.key]) || null;
    const status = !applicable ? 'na' : (st && st.status) || 'pending';
    const busy = this._busyKey === `${e._id}:${step.key}`;
    const when = st && st.at ? `<span class="when">${esc(fmt(st.at))}</span>` : '';
    const errTxt = status === 'error' && st && st.error ? `<span class="when">${esc(st.error)}</span>` : '';

    let control;
    if (!applicable) {
      control = `<span class="step-chip na">N/A</span>`;
    } else if (step.manual) {
      control = `<label style="display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" data-manual="${esc(step.key)}" data-emp="${esc(e._id)}" ${status === 'done' ? 'checked' : ''}>
        <span class="step-chip ${status}">${status === 'done' ? 'Confirmed' : 'Not yet'}</span>
      </label>`;
    } else if (status === 'done') {
      control = `<span class="step-chip done">Done</span>`;
    } else if (status === 'sent' || busy) {
      control = `<span class="step-chip sent">${busy ? '…' : 'Sent'}</span>`;
    } else {
      control = `<button class="step-chip ${status === 'error' ? 'error' : 'pending'}" data-step="${esc(step.key)}" data-emp="${esc(e._id)}">
        ${status === 'error' ? 'Retry' : 'Trigger'}</button>`;
    }

    return `<div class="step">
      <span class="label">${esc(step.label)}</span>
      ${when}${errTxt}
      ${control}
    </div>`;
  }
}

customElements.define('employee-lifecycle', EmployeeLifecycle);
