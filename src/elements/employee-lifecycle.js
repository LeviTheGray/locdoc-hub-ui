/**
 * Wix Custom Element — Employee onboarding / offboarding / info admin panel  (<employee-lifecycle>)
 *
 * A small operations panel (allowlist-gated, see lifecycleAuth.js) with three jobs:
 *   1. ADD a new employee from a form (no steps auto-run — trigger each individually).
 *   2. ARCHIVE an employee who's leaving / RESTORE one who's back — see below.
 *   3. EDIT employee info (name, title, manager, department, van #, other flags) — plain data
 *      correction, no audit trail (declined). Hire date is shown but not editable.
 *
 * RESOURCE MODEL (per Levi, 2026-08-27 — a deliberate rework, see lifecycleSteps.js's header for
 * the full spec): a step is done by HAVING an external record ID, not by a bare status flag. Each
 * RESOURCE_STEP is one thing that gets created during onboarding (`recordId`) and, if
 * `offboardable`, torn down during offboarding — the SAME key both times, targeting the SAME ID,
 * not a disconnected pair of steps. Once a resource has a recordId there's no "Run" button left,
 * just the ID (click to copy) and a checkmark; once archived, same thing with an archived date.
 * Either half can also be set MANUALLY (an admin types in an ID, or marks something archived by
 * hand) — indistinguishable afterward from the automated path. A step that reached the OLD
 * `status:'done'` (before this rework, no recordId) still shows as done — no regression, it just
 * won't have a copyable ID until n8n is updated to send one (that update is outside this repo).
 *
 * `wixMember` and `loyaltyAccount` (added 2026-08-27, per Levi) look and behave exactly like
 * every other resource step here — the element doesn't know or care that they resolve via a
 * direct Wix API call in employeeLifecycle.web.js instead of an n8n webhook (`direct: true` in
 * RESOURCE_STEPS, backend-only). Hub access is gated on being a real Wix Member, which is why
 * this exists at all — not every field here needs an external system to "automate."
 *
 * ACTIVE STATE (same archive-not-delete pattern as Fleet Management): Archive flips `active:
 * false` immediately — the FIRST offboarding action, not a result of finishing it. That flag
 * decides which mode a resource's row is in: Active → its onboarding/create half; Archived → its
 * offboarding/archive half (or, if it's not offboardable, just a read-only look at its ID).
 *
 * NOT autosaved (considered during a 2026-08-27 code review, deliberately rejected per Levi): the
 * "Add a new employee" form doesn't persist drafts anywhere, unlike Tech Spotlight's essay-length
 * fields. A name/title/van # is trivial to retype, and Onboarding's actual value is the
 * accountability trail on the lifecycle tasks themselves (checkboxes/IDs below), not protecting
 * scratch input in this form — so there's nothing here worth the complexity of a draft store.
 *
 * Data handoff (mirrors tech-spotlight-submit):
 *   • Velo → element :  init-data      { admin } | { error }
 *                       search-result  { items:[{ _id, firstName, lastName, email, title, manager,
 *                                        department, vehicleNumber, bonusOptOut,
 *                                        startDate, active,
 *                                        steps:{[key]:{status,at,error?,recordId?,recordSetAt?,
 *                                          recordSetBy?,archivedAt?,archivedBy?}} }] } | { error }
 *                                                                                     (carries _ts)
 *                       action-result  { ok:true, employee } | { ok:false, error }   (carries _ts)
 *   • element → Velo :  'search'            { term }
 *                       'trigger-step'      { employeeId, stepKey }
 *                       'mark-manual'       { employeeId, stepKey, done }
 *                       'set-record-id'     { employeeId, stepKey, recordId }
 *                       'mark-archived'     { employeeId, stepKey }
 *                       'archive-employee'  { employeeId }
 *                       'restore-employee'  { employeeId }
 *                       'update-info'       { employeeId, patch }
 *                       'submit-and-onboard'{ firstName, lastName, email, title, manager, vehicleNumber }
 *                       'navigate'          { key }
 *
 * The backend re-checks authorization and step/active preconditions on every method, so a
 * non-admin who forces `admin:true` here still gets rejected server-side — the flag only decides
 * what UI to paint.
 *
 * Editor setup: Add → Embed Code → Custom Element → this file, tag `employee-lifecycle`,
 * element ID `employeeLifecycle`.
 */

import { styles, ensureMaterialSymbols } from './tokens.js';

// Mirrors backend/lifecycleSteps.js — keep the two in sync if steps change.
const RESOURCE_STEPS = [
  { key: 'wixMember', label: 'Wix Member account', manual: false, offboardable: true, direct: true },
  { key: 'loyaltyAccount', label: 'Loyalty account (uniform points)', manual: false, offboardable: false, direct: true },
  { key: 'googleWorkspace', label: 'Google Workspace user', manual: false, offboardable: true },
  { key: 'omsContact', label: 'OMS contact', manual: false, offboardable: true },
  { key: 'omsTechnician', label: 'OMS technician', manual: false, offboardable: false },
  { key: 'vcfCard', label: 'vCard emailed to team', offboardLabel: 'Removal email sent to team', manual: false, offboardable: true },
];
const STANDALONE_OFFBOARD_STEPS = [
  { key: 'dataExportConfirmed', label: 'Data export confirmed', manual: true },
];
// NOT a real resource step (no RESOURCE_STEPS entry, no automation, no offboard half) — see
// _vehicleRow()'s comment for why. Styled to look like one for consistency; editable inline
// (writes Employees.vehicleNumber via update-info) or via the Edit form's Van # field.

// Mirrors backend/employeeLifecycle.web.js's EDITABLE_FIELDS.
const EDIT_FIELDS = [
  { key: 'firstName', label: 'First name', type: 'text', half: true },
  { key: 'lastName', label: 'Last name', type: 'text', half: true },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'title', label: 'Title', type: 'text', half: true },
  { key: 'manager', label: 'Manager / department scope', type: 'text', half: true },
  { key: 'department', label: 'Department', type: 'text', half: true },
  { key: 'vehicleNumber', label: 'Van #', type: 'text', half: true },
  // Covers every reason someone's excluded from bonuses — owner, owner's family member, or an
  // opted-out manager — deliberately one field, not split by reason (an earlier "Ownership"
  // checkbox was removed per Levi, 2026-08-27: it read as an access-control signal to anyone
  // building a future feature, when all it ever meant here was "don't pay them a bonus").
  { key: 'bonusOptOut', label: 'Excluded from bonus pool', type: 'checkbox' },
];

const STYLES = styles(`
  .main { max-width: 780px; margin: 0 auto; padding: 24px 16px 56px; }
  .sub { font-size: 14px; color: var(--gray-600); margin-bottom: 20px; }
  .section { margin-top: 28px; }
  .section h2 { font-size: 15px; font-weight: 700; margin-bottom: 12px; }
  label.f { display: block; font-size: 13px; font-weight: 700; margin: 14px 0 5px; }
  input[type=text], input[type=email] { width: 100%; padding: 10px 12px; border: 1.5px solid var(--gray-200);
    border-radius: 8px; font-size: 15px; font-family: inherit; }
  input:focus { outline: none; border-color: var(--primary); }
  .row2 { display: flex; gap: 12px; flex-wrap: wrap; } .row2 > div { flex: 1; min-width: 160px; }
  .checkline { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--gray-600); padding: 10px 0; }
  .checkline input { width: 16px; height: 16px; }
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
  .lifecycle-actions { display: flex; gap: 8px; }
  .edit-form { margin-top: 14px; padding: 14px; background: var(--gray-50); border-radius: 10px; }
  .static-note { font-size: 12px; color: var(--gray-500); font-style: italic; margin-top: 8px; }
  .steps { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
  .step { padding: 8px 10px; border-radius: 8px; background: var(--gray-50, #fafafa); }
  .step-row { display: flex; align-items: center; gap: 10px; }
  .step .label { flex: 1; font-size: 13px; font-weight: 600; }
  .step .when { font-size: 11px; color: var(--gray-500); }
  .step-chip { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; border: none; cursor: pointer; }
  .step-chip.pending, .step-chip[disabled] { background: var(--gray-100); color: var(--gray-600); }
  .step-chip.sent { background: #fef3c7; color: #92400e; cursor: default; }
  .step-chip.done { background: #d1fae5; color: var(--primary-dk); cursor: default; }
  .step-chip.error { background: #fee2e2; color: #b91c1c; }
  .step-chip.na { background: none; color: var(--gray-400); cursor: default; }
  .step-chip.archived { background: var(--gray-200); color: var(--gray-600); cursor: default; }
  .step input[type=checkbox] { width: 16px; height: 16px; }
  .record-id { font-size: 12px; font-weight: 700; color: var(--gray-900); border-bottom: 1.5px dotted var(--gray-400); cursor: pointer; }
  .record-id:hover { color: var(--primary-dk); border-bottom-color: var(--primary-dk); }
  .link-sm { background: none; border: none; color: var(--primary-dk); font-weight: 600; font-size: 11px; cursor: pointer; text-decoration: underline; }
  .manual-entry { display: flex; gap: 6px; margin-top: 8px; margin-left: 0; }
  .manual-entry input { flex: 1; padding: 6px 8px; font-size: 12px; }
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
function fmtDate(at) {
  return at ? new Date(at).toLocaleDateString() : '';
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
    this._lifecycleBusyId = null; // employeeId currently mid archive/restore
    this._msg = null;          // { ok, text } banner
    this._creating = false;
    this._draft = {};          // create-form fields kept across re-renders
    this._editingId = null;    // employeeId with the edit form open
    this._editDraft = {};      // that employee's in-progress edits
    this._savingEdit = false;
    this._manualOpenKey = null; // `${employeeId}:${stepKey}` with the "enter ID manually" input open
    this._manualValue = '';
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
    this._lifecycleBusyId = null;
    this._savingEdit = false;
    if (p.ok && p.employee) {
      const updated = p.employee;
      const i = this._items.findIndex((e) => e._id === updated._id);
      if (i >= 0) this._items[i] = updated;
      this._msg = { ok: true, text: 'Saved.' };
      if (this._editingId === updated._id) this._editingId = null;
      this._manualOpenKey = null;
      this._manualValue = '';
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
        <p>Add employees, archive/restore them, and edit their info — onboarding/offboarding steps fire their own n8n automations.</p></header>
      <main class="main" data-main></main>`;

    this.shadowRoot.addEventListener('click', (e) => {
      const step = e.target.closest('[data-step]');
      if (step && !step.disabled) {
        return this._triggerStep(step.getAttribute('data-emp'), step.getAttribute('data-step'));
      }
      const copy = e.target.closest('[data-copy-id]');
      if (copy) return this._copyId(copy.getAttribute('data-copy-id'));
      const manualToggle = e.target.closest('[data-manual-toggle]');
      if (manualToggle) return this._toggleManualEntry(manualToggle.getAttribute('data-emp'), manualToggle.getAttribute('data-step'));
      const manualSave = e.target.closest('[data-manual-save]');
      if (manualSave) return this._saveManualId(manualSave.getAttribute('data-emp'), manualSave.getAttribute('data-step'));
      const markArchived = e.target.closest('[data-mark-archived]');
      if (markArchived) return this._markArchivedManually(markArchived.getAttribute('data-emp'), markArchived.getAttribute('data-step'));
      const archive = e.target.closest('[data-archive]');
      if (archive) return this._archive(archive.getAttribute('data-archive'));
      const restore = e.target.closest('[data-restore]');
      if (restore) return this._restore(restore.getAttribute('data-restore'));
      const edit = e.target.closest('[data-edit]');
      if (edit) return this._toggleEdit(edit.getAttribute('data-edit'));
      if (e.target.closest('[data-cancel-edit]')) return this._toggleEdit(null);
      const saveEdit = e.target.closest('[data-save-edit]');
      if (saveEdit) return this._saveEdit(saveEdit.getAttribute('data-save-edit'));
      if (e.target.closest('[data-search]')) return this._search();
      if (e.target.closest('[data-create]')) return this._create();
      if (e.target.closest('[data-nav]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
    });
    this.shadowRoot.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-manual]');
      if (cb) return this._markManual(cb.getAttribute('data-emp'), cb.getAttribute('data-manual'), cb.checked);
      const ef = e.target.closest('[data-editfield]');
      if (ef && ef.type === 'checkbox') this._editDraft[ef.getAttribute('data-editfield')] = ef.checked;
    });
    this.shadowRoot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'q') { e.preventDefault(); this._search(); }
    });
    this.shadowRoot.addEventListener('input', (e) => {
      const k = e.target && e.target.getAttribute && e.target.getAttribute('data-field');
      if (k) this._draft[k] = e.target.value;
      const ef = e.target.closest && e.target.closest('[data-editfield]');
      if (ef && ef.type !== 'checkbox') this._editDraft[ef.getAttribute('data-editfield')] = ef.value;
      if (e.target.getAttribute && e.target.getAttribute('data-manual-input') != null) this._manualValue = e.target.value;
    });
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  // Click-to-copy — no popover, just a clipboard write + a reused status banner. Simpler than
  // Fleet's box-with-selected-input treatment since this panel doesn't need the offline fallback
  // as much (IDs get pasted straight into another browser tab, not printed/handed off).
  _copyId(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value)
        .then(() => { this._msg = { ok: true, text: `Copied: ${value}` }; this._render(); })
        .catch(() => { this._msg = { ok: false, text: `Could not copy — here it is: ${value}` }; this._render(); });
    }
  }

  _search() {
    const term = (this._$('q') && this._$('q').value || '').trim();
    this.dispatchEvent(new CustomEvent('search', { detail: { term }, bubbles: true, composed: true }));
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

  _toggleManualEntry(employeeId, stepKey) {
    const key = `${employeeId}:${stepKey}`;
    this._manualOpenKey = this._manualOpenKey === key ? null : key;
    this._manualValue = '';
    this._render();
  }

  _saveManualId(employeeId, stepKey) {
    const value = (this._manualValue || '').trim();
    if (!value) { this._msg = { ok: false, text: 'Enter a value.' }; return this._render(); }
    this._msg = null;
    // Vehicle Number isn't a real resource step (no automation exists or is wanted — per Levi,
    // 2026-08-27, "the van number IS the assigned portion," fleet software owns everything else)
    // — it's a plain Employees field that just LOOKS like a step's ID for consistency. So this one
    // case writes through update-info instead of set-record-id, keeping Employees.vehicleNumber as
    // the single source of truth rather than duplicating it into steps.vehicleNumber.recordId.
    if (stepKey === 'vehicleNumber') {
      this.dispatchEvent(new CustomEvent('update-info', { detail: { employeeId, patch: { vehicleNumber: value } }, bubbles: true, composed: true }));
      return;
    }
    this.dispatchEvent(new CustomEvent('set-record-id', { detail: { employeeId, stepKey, recordId: value }, bubbles: true, composed: true }));
  }

  _markArchivedManually(employeeId, stepKey) {
    this._msg = null;
    this.dispatchEvent(new CustomEvent('mark-archived', { detail: { employeeId, stepKey }, bubbles: true, composed: true }));
  }

  _archive(employeeId) {
    if (this._lifecycleBusyId) return;
    this._lifecycleBusyId = employeeId;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('archive-employee', { detail: { employeeId }, bubbles: true, composed: true }));
  }

  _restore(employeeId) {
    if (this._lifecycleBusyId) return;
    this._lifecycleBusyId = employeeId;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('restore-employee', { detail: { employeeId }, bubbles: true, composed: true }));
  }

  _toggleEdit(employeeId) {
    if (!employeeId) { this._editingId = null; this._render(); return; }
    if (this._editingId === employeeId) { this._editingId = null; this._render(); return; }
    const e = this._items.find((x) => x._id === employeeId);
    if (!e) return;
    this._editingId = employeeId;
    this._editDraft = {
      firstName: e.firstName || '', lastName: e.lastName || '', email: e.email || '',
      title: e.title || '', manager: e.manager || '', department: e.department || '',
      vehicleNumber: e.vehicleNumber || '', bonusOptOut: !!e.bonusOptOut,
    };
    this._msg = null;
    this._render();
  }

  _saveEdit(employeeId) {
    if (this._savingEdit) return;
    this._savingEdit = true;
    this._msg = null;
    this._render();
    const patch = { ...this._editDraft };
    EDIT_FIELDS.forEach((f) => { if (f.type !== 'checkbox' && typeof patch[f.key] === 'string') patch[f.key] = patch[f.key].trim(); });
    this.dispatchEvent(new CustomEvent('update-info', { detail: { employeeId, patch }, bubbles: true, composed: true }));
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
    const active = e.active !== false;
    const meta = [e.title, e.manager, e.email].filter(Boolean).map(esc).join(' · ');
    const editing = this._editingId === e._id;
    const lcBusy = this._lifecycleBusyId === e._id;
    // Every resource shows up regardless of phase (archived-but-not-offboardable ones just go
    // read-only); the standalone manual step only makes sense once archived.
    const stepList = active ? RESOURCE_STEPS : [...RESOURCE_STEPS, ...STANDALONE_OFFBOARD_STEPS];

    return `<div class="emp card">
      <div class="top">
        <div class="info">
          <div class="name">${esc(name)} <span class="pill ${active ? 'on' : 'off'}">${active ? 'Active' : 'Archived'}</span></div>
          ${meta ? `<div class="meta">${meta}</div>` : ''}
        </div>
        <div class="lifecycle-actions">
          ${active
            ? `<button class="btn danger sm ${lcBusy ? 'is-loading' : ''}" data-archive="${esc(e._id)}" ${lcBusy ? 'disabled' : ''}>${lcBusy ? '…' : 'Archive'}</button>`
            : `<button class="btn ghost sm ${lcBusy ? 'is-loading' : ''}" data-restore="${esc(e._id)}" ${lcBusy ? 'disabled' : ''}>${lcBusy ? '…' : 'Restore'}</button>`}
          <button class="btn ghost sm" data-edit="${esc(e._id)}">${editing ? 'Cancel' : 'Edit'}</button>
        </div>
      </div>
      ${editing ? this._editForm(e) : ''}
      <div class="steps">${this._vehicleRow(e)}${stepList.map((s) => this._stepRow(e, s, active)).join('')}</div>
    </div>`;
  }

  // Not a real resource step — no automation exists or is wanted here (per Levi, 2026-08-27: the
  // van number itself IS the "assigned" signal; actual vehicle assignment/tracking lives entirely
  // in separate fleet software, this app just records the number). Styled and behaves like an
  // ID-tracked step for consistency (click-to-copy once set, inline "enter it" when not) — but the
  // value is Employees.vehicleNumber directly, not steps.vehicleNumber.recordId, and there's no
  // Run button because there's nothing to automate. No offboarding half either, for the same
  // reason (fleet software owns that transition, not this panel).
  _vehicleRow(e) {
    const val = (e.vehicleNumber || '').trim();
    const manualKey = `${e._id}:vehicleNumber`;
    const manualOpen = this._manualOpenKey === manualKey;
    if (val) {
      return this._rowShell('Vehicle Number', '', `<span class="record-id" data-copy-id="${esc(val)}" title="Click to copy">${esc(val)}</span>`);
    }
    const control = manualOpen
      ? `<button class="btn ghost sm" data-manual-toggle data-emp="${esc(e._id)}" data-step="vehicleNumber">Cancel</button>`
      : `<button class="btn ghost sm" data-manual-toggle data-emp="${esc(e._id)}" data-step="vehicleNumber">Enter number</button>`;
    const manualRow = manualOpen
      ? `<div class="manual-entry">
          <input type="text" placeholder="Van #" data-manual-input value="${esc(this._manualValue)}">
          <button class="btn sm" data-manual-save data-emp="${esc(e._id)}" data-step="vehicleNumber">Save</button>
        </div>`
      : '';
    return this._rowShell('Vehicle Number', '', control, manualRow);
  }

  _editForm(e) {
    const d = this._editDraft;
    const fieldHtml = (f) => {
      if (f.type === 'checkbox') {
        return `<label class="checkline"><input type="checkbox" data-editfield="${f.key}" ${d[f.key] ? 'checked' : ''}> ${f.label}</label>`;
      }
      return `<div><label class="f">${f.label}</label><input type="${f.type}" data-editfield="${f.key}" value="${esc(d[f.key] || '')}"></div>`;
    };
    return `<div class="edit-form">
      <div class="row2">${EDIT_FIELDS.filter((f) => f.type !== 'checkbox').map(fieldHtml).join('')}</div>
      ${EDIT_FIELDS.filter((f) => f.type === 'checkbox').map(fieldHtml).join('')}
      ${e.startDate ? `<div class="static-note">Start date (not editable here): ${esc(String(e.startDate).slice(0, 10))}</div>` : ''}
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn ${this._savingEdit ? 'is-loading' : ''}" data-save-edit="${esc(e._id)}">
          ${this._savingEdit ? '<span class="btn-spinner"></span>Saving…' : 'Save changes'}</button>
        <button class="btn ghost" data-cancel-edit>Cancel</button>
      </div>
    </div>`;
  }

  // A resource step's row depends on phase (active = create half, archived = archive half) and
  // whether an ID/archived date already exists — see the header comment for the full model.
  _stepRow(e, step, active) {
    const applicable = !step.requires || step.requires(e);
    const st = (e.steps && e.steps[step.key]) || {};
    const busyKey = `${e._id}:${step.key}`;
    const busy = this._busyKey === busyKey;
    const manualKey = busyKey;
    const manualOpen = this._manualOpenKey === manualKey;
    const idChip = (id) => `<span class="record-id" data-copy-id="${esc(id)}" title="Click to copy">${esc(id)}</span>`;

    if (!applicable) {
      return this._rowShell(step.label, '', `<span class="step-chip na">N/A</span>`);
    }

    if (step.manual) {
      // Dual-phase manual step (vcfCard): onboarding and offboarding are two DIFFERENT
      // confirmations on the same key — read/write the direction-specific fields, and swap in
      // offboardLabel once archived, since it really is a different action ("send the vCard" vs
      // "tell the team to remove them").
      const isDualPhase = step.offboardable !== undefined;
      const label = isDualPhase && !active && step.offboardLabel ? step.offboardLabel : step.label;
      const done = isDualPhase ? !!(active ? st.confirmedAt : st.offboardConfirmedAt) : st.status === 'done';
      const control = `<label style="display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" data-manual="${esc(step.key)}" data-emp="${esc(e._id)}" ${done ? 'checked' : ''}>
        <span class="step-chip ${done ? 'done' : 'pending'}">${done ? 'Confirmed' : 'Not yet'}</span>
      </label>`;
      return this._rowShell(label, '', control);
    }

    // ---- Resource step ----
    // Same offboardLabel swap as the manual dual-phase branch above — a resource step that's
    // offboardable can be a genuinely different action once archived (e.g. vcfCard: "email the
    // vCard" on the way in, "email the team to remove them" on the way out), not just a teardown
    // of the same thing.
    const label = !active && step.offboardLabel ? step.offboardLabel : step.label;
    if (active) {
      // Create half.
      if (st.recordId) {
        const by = st.recordSetBy === 'manual' ? ' (entered manually)' : '';
        return this._rowShell(label, `${idChip(st.recordId)}${by}`, `<span class="step-chip done">✓ Done</span>`);
      }
      if (st.status === 'done') {
        // Legacy completion, from before this rework — no ID to show, still counts as done.
        return this._rowShell(label, '', `<span class="step-chip done">Done</span>`);
      }
      const when = st.at ? `<span class="when">${esc(fmt(st.at))}</span>` : '';
      const errTxt = st.status === 'error' && st.error ? `<span class="when">${esc(st.error)}</span>` : '';
      let control;
      if (st.status === 'sent' || busy) {
        control = `<span class="step-chip sent">${busy ? '…' : 'Sent'}</span>`;
      } else {
        control = `<button class="step-chip ${st.status === 'error' ? 'error' : 'pending'}" data-step="${esc(step.key)}" data-emp="${esc(e._id)}">
          ${st.status === 'error' ? 'Retry' : 'Run'}</button>`;
      }
      const manualToggleBtn = `<button type="button" class="link-sm" data-manual-toggle data-emp="${esc(e._id)}" data-step="${esc(step.key)}">${manualOpen ? 'Cancel' : 'Enter ID manually'}</button>`;
      const manualRow = manualOpen ? `<div class="manual-entry">
          <input type="text" placeholder="Record ID" data-manual-input value="${esc(this._manualValue)}">
          <button type="button" class="btn ghost sm" data-manual-save data-emp="${esc(e._id)}" data-step="${esc(step.key)}">Save</button>
        </div>` : '';
      return this._rowShell(label, `${when}${errTxt}`, control, `${manualToggleBtn}${manualRow}`);
    }

    // Archived employee.
    if (!step.offboardable) {
      // No teardown half — just show whatever ID it has on file, nothing to do.
      return this._rowShell(label, st.recordId ? idChip(st.recordId) : '<span class="empty" style="padding:0">no record on file</span>', '');
    }
    if (st.archivedAt) {
      const by = st.archivedBy === 'manual' ? ' (marked manually)' : '';
      const idNote = st.recordId ? ` — ${idChip(st.recordId)}` : '';
      return this._rowShell(label, `Archived ${esc(fmtDate(st.archivedAt))}${by}${idNote}`, `<span class="step-chip archived">✓ Archived</span>`);
    }
    if (st.status === 'done') {
      return this._rowShell(label, '', `<span class="step-chip done">Done</span>`);
    }
    const when = st.at ? `<span class="when">${esc(fmt(st.at))}</span>` : '';
    const errTxt = st.status === 'error' && st.error ? `<span class="when">${esc(st.error)}</span>` : '';
    let control;
    if (st.status === 'sent' || busy) {
      control = `<span class="step-chip sent">${busy ? '…' : 'Sent'}</span>`;
    } else {
      control = `<button class="step-chip ${st.status === 'error' ? 'error' : 'pending'}" data-step="${esc(step.key)}" data-emp="${esc(e._id)}">
        ${st.status === 'error' ? 'Retry' : 'Run'}</button>`;
    }
    const manualToggleBtn = `<button type="button" class="link-sm" data-mark-archived data-emp="${esc(e._id)}" data-step="${esc(step.key)}">Mark archived manually</button>`;
    const idNote = st.recordId ? `${idChip(st.recordId)} — ` : '';
    return this._rowShell(label, `${idNote}${when}${errTxt}`, control, manualToggleBtn);
  }

  _rowShell(label, meta, control, extraLine) {
    return `<div class="step">
      <div class="step-row">
        <span class="label">${esc(label)}</span>
        ${meta}
        ${control}
      </div>
      ${extraLine || ''}
    </div>`;
  }
}

customElements.define('employee-lifecycle', EmployeeLifecycle);
