/**
 * Wix Custom Element — Fleet Management  (<fleet-management>)
 *
 * A VIN/title registry for vehicles and trailers not tracked in Enterprise Fleet Management.
 * Any manager can view, add, or archive a record — access is company-wide, not scoped to a
 * department (fleet assets aren't department-specific the way employees are).
 *
 * No edit — the fields here (VIN, title/record label, etc.) aren't things that change on an
 * existing vehicle; a change in reality means a new vehicle record, not an edit to this one.
 * No hard delete either — "removing" an asset means archiving it (status → Retired), so the
 * record (and its history) stays around. Retired assets can be restored back to Active.
 *
 * Data handoff:
 *   • Velo → element :  init-data      { canManage, employees:[{_id,name}] } | { error }
 *                       list-result    { items:[Asset] } | { error }                  (carries _ts)
 *                       save-result    { ok:true, asset:Asset } | { ok:false, error }  (carries _ts)
 *                       archive-result { ok:true, asset:Asset } | { ok:false, error }  (carries _ts)
 *   • element → Velo :  'list-assets'    { term }
 *                       'save-asset'     { asset: Asset }        // always a new record — no _id
 *                       'archive-asset'  { id, archived: boolean } // true = retire, false = restore
 *                       'navigate'       { key: 'hub' }
 *
 * Asset shape matches the FleetAssets collection as imported from the legacy fleet tracker (field
 * keys are the exact ones Wix generated on CSV import; two-word labels camelCase, "NC Quickpass #"
 * became `ncQuickpass`):
 *   { _id?, title, unitnumber, model, ncQuickpass, dateAdded, year, make, color, vin,
 *     plateNumber, assignedTo, assignedToName, status:'Active'|'Retired' }
 * `assignedTo` is an Employees `_id` for newly-created records (picked from a dropdown so it's
 * searchable/consistent) — existing legacy rows still hold a plain typed name instead, since
 * there's no reliable way to match old free-text names back to an employee record. The backend
 * resolves whichever it is into `assignedToName` for display and search, so both kinds of rows
 * work the same in the UI. No assetType/title-number/lienholder/registration fields — those were
 * guessed before the real data existed and don't apply to what's actually tracked (the imported
 * "Title" column is an internal record label/serial from the legacy system, not a legal title).
 *
 * The backend re-checks manager status on every method (backend/fleetManagement.web.js) — the
 * `canManage` flag here only decides what UI to paint.
 *
 * Editor setup: Add → Embed Code → Custom Element → this file, tag `fleet-management`,
 * element ID `fleetManagement`.
 */

import { styles, ensureMaterialSymbols } from './tokens.js';

const FIELDS = [
  { key: 'unitnumber', label: 'Van / Unit #', type: 'text', half: true },
  { key: 'plateNumber', label: 'Plate #', type: 'text', half: true },
  { key: 'assignedTo', label: 'Assigned to', type: 'employee-select', half: true },
  { key: 'status', label: 'Status', type: 'select', options: [['Active', 'Active'], ['Retired', 'Retired']], half: true },
  { key: 'make', label: 'Make', type: 'text', half: true },
  { key: 'model', label: 'Model', type: 'text', half: true },
  { key: 'year', label: 'Year', type: 'text', half: true },
  { key: 'color', label: 'Color', type: 'text', half: true },
  { key: 'vin', label: 'VIN', type: 'text', half: true },
  { key: 'ncQuickpass', label: 'NC Quickpass #', type: 'text', half: true },
  { key: 'dateAdded', label: 'Date added', type: 'text', half: true },
  { key: 'title', label: 'Title / record label', type: 'text', half: true },
];

const STYLES = styles(`
  .main { max-width: 820px; margin: 0 auto; padding: 24px 16px 56px; }
  .sub { font-size: 14px; color: var(--gray-600); margin-bottom: 20px; }
  .section { margin-top: 24px; }
  .section h2 { font-size: 15px; font-weight: 700; margin-bottom: 12px; }
  label.f { display: block; font-size: 13px; font-weight: 700; margin: 14px 0 5px; }
  input[type=text], input[type=date], select, textarea { width: 100%; padding: 10px 12px; border: 1.5px solid var(--gray-200);
    border-radius: 8px; font-size: 15px; font-family: inherit; background: #fff; }
  textarea { min-height: 64px; resize: vertical; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--primary); }
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
  .field-grid .full { grid-column: 1 / -1; }
  .searchbar { display: flex; gap: 8px; }
  .searchbar input { flex: 1; }
  .searchbar .btn { flex-shrink: 0; }
  .list { margin-top: 16px; display: flex; flex-direction: column; gap: 10px; }
  .asset { padding: 14px 16px 16px; }
  .asset.is-retired { opacity: .7; }
  .asset .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .asset .info { flex: 1; min-width: 180px; }
  .asset .name { font-size: 15px; font-weight: 700; }
  .asset .meta { font-size: 12px; color: var(--gray-600); margin-top: 2px; }
  .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; background: var(--gray-100); color: var(--gray-600); }
  .pill.on { background: #e2ece0; color: var(--primary-dk); }
  .asset .actions { display: flex; gap: 8px; }
  .btn.ghost { background: var(--gray-100); color: var(--gray-900); }
  .btn.ghost:hover { background: var(--gray-200); }
  .btn.sm { padding: 8px 12px; font-size: 13px; }
  .empty { font-size: 13px; color: var(--gray-400); padding: 12px 0; }
  .msg { margin-top: 16px; padding: 12px 14px; border-radius: 8px; font-size: 14px; display: none; }
  .msg.err { display: block; background: #fee2e2; color: #b91c1c; }
  .msg.ok  { display: block; background: #d1fae5; color: var(--primary-dk); }
  .link { background: none; border: none; color: var(--primary-dk); font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 20px; }
  .copy-chip { border-bottom: 1.5px dotted var(--gray-400); cursor: pointer; }
  .copy-chip:hover { color: var(--primary-dk); border-bottom-color: var(--primary-dk); }
  .copy-pop { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 100;
    background: #fff; border: 1.5px solid var(--gray-200); border-radius: 12px; box-shadow: var(--shadow-md);
    padding: 14px 16px; width: min(92vw, 360px); }
  .copy-pop-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--gray-400); margin-bottom: 6px; }
  .copy-pop-row { display: flex; gap: 8px; }
  .copy-pop-row input { flex: 1; font-weight: 700; }
  .copy-pop-status { font-size: 12px; color: var(--primary-dk); margin-top: 6px; min-height: 15px; }
  @media (max-width: 560px) { .field-grid { grid-template-columns: 1fr; } }
`);

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Renders a value as click-to-copy — tapping it opens a small box (see #copyPop in the shell)
// with the raw value in a readonly, pre-selected input so it's copyable everywhere (the Clipboard
// API is tried too, as a one-tap shortcut, but the selected input is the reliable fallback).
function copyChip(label, value) {
  if (!value) return '';
  return `<span class="copy-chip" data-copy-label="${esc(label)}" data-copy-value="${esc(value)}">${esc(value)}</span>`;
}

class FleetManagement extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'list-result', 'save-result', 'archive-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._canManage = false;
    this._loaded = false;
    this._error = null;
    this._employees = [];
    this._items = [];
    this._listed = false;
    this._saving = false;
    this._archivingId = null;
    this._msg = null;
    this._draft = null;    // non-null while the add form is open
    this._copyValue = null;
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
    if (name === 'init-data')      this._applyInit(value);
    if (name === 'list-result')    this._applyList(value);
    if (name === 'save-result')    this._applySave(value);
    if (name === 'archive-result') this._applyArchive(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _applyInit(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._canManage = Boolean(p.canManage);
    this._employees = Array.isArray(p.employees) ? p.employees : [];
    this._error = p.error || null;
    this._loaded = true;
    if (this._canManage && !this._listed) this._list();
    this._render();
  }

  _applyList(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._items = Array.isArray(p.items) ? p.items : [];
    this._listed = true;
    this._render();
  }

  _applySave(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._saving = false;
    if (p.ok && p.asset) {
      this._items.unshift(p.asset);
      this._msg = { ok: true, text: 'Saved.' };
      this._draft = null;
    } else {
      this._msg = { ok: false, text: p.error || 'Save failed.' };
    }
    this._render();
  }

  _applyArchive(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._archivingId = null;
    if (p.ok && p.asset) {
      const i = this._items.findIndex((x) => x._id === p.asset._id);
      if (i >= 0) this._items[i] = p.asset;
      this._msg = { ok: true, text: p.asset.status === 'Retired' ? 'Archived.' : 'Restored.' };
    } else {
      this._msg = { ok: false, text: p.error || 'That failed.' };
    }
    this._render();
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <header class="header"><h1>🚐 Fleet Management</h1>
        <p>VIN, title, and registration records for vehicles and trailers not tracked in Enterprise Fleet Management.</p></header>
      <main class="main" data-main></main>
      <div class="copy-pop" data-copy-pop style="display:none">
        <div class="copy-pop-label" data-copy-pop-label></div>
        <div class="copy-pop-row">
          <input type="text" readonly data-copy-pop-input>
          <button type="button" class="btn sm" data-copy-pop-btn>Copy</button>
        </div>
        <div class="copy-pop-status" data-copy-pop-status></div>
      </div>`;

    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.closest('[data-search]')) return this._search();
      if (e.target.closest('[data-add]')) return this._openForm();
      if (e.target.closest('[data-cancel]')) return this._closeForm();
      if (e.target.closest('[data-save]')) return this._save();
      const archiveBtn = e.target.closest('[data-archive]');
      if (archiveBtn) return this._setArchived(archiveBtn.getAttribute('data-archive'), true);
      const restoreBtn = e.target.closest('[data-restore]');
      if (restoreBtn) return this._setArchived(restoreBtn.getAttribute('data-restore'), false);
      const chip = e.target.closest('[data-copy-value]');
      if (chip) return this._openCopy(chip.getAttribute('data-copy-label'), chip.getAttribute('data-copy-value'));
      if (e.target.closest('[data-copy-pop-btn]')) return this._copyNow();
      if (!e.target.closest('[data-copy-pop]')) this._closeCopy();
      if (e.target.closest('[data-nav]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
    });
    this.shadowRoot.addEventListener('input', (e) => {
      const k = e.target && e.target.getAttribute && e.target.getAttribute('data-field');
      if (k && this._draft) this._draft[k] = e.target.value;
    });
    this.shadowRoot.addEventListener('change', (e) => {
      const k = e.target && e.target.getAttribute && e.target.getAttribute('data-field');
      if (k && this._draft) this._draft[k] = e.target.value;
    });
    this.shadowRoot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target && e.target.id === 'q') { e.preventDefault(); this._search(); }
    });
  }

  _search() {
    const term = (this._$('q') && this._$('q').value || '').trim();
    this.dispatchEvent(new CustomEvent('list-assets', { detail: { term }, bubbles: true, composed: true }));
  }

  _list() {
    this.dispatchEvent(new CustomEvent('list-assets', { detail: { term: '' }, bubbles: true, composed: true }));
  }

  _openForm() {
    this._msg = null;
    this._draft = { status: 'Active' };
    this._render();
  }

  _closeForm() {
    this._draft = null;
    this._render();
  }

  _save() {
    if (this._saving || !this._draft) return;
    const d = this._draft;
    if (!(d.unitnumber || '').trim() && !(d.vin || '').trim()) {
      this._msg = { ok: false, text: 'Enter at least a unit number or VIN.' };
      return this._render();
    }
    this._saving = true;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('save-asset', { detail: { asset: { ...d } }, bubbles: true, composed: true }));
  }

  // Click-to-copy popover: opens with the value pre-filled and selected in a readonly input, so
  // the browser/OS copy shortcut works even if the Clipboard API write below is blocked (e.g. no
  // clipboard permission in this embed context) — that's tried too, as a one-tap shortcut.
  _openCopy(label, value) {
    this._copyValue = value;
    const input = this.shadowRoot.querySelector('[data-copy-pop-input]');
    this.shadowRoot.querySelector('[data-copy-pop-label]').textContent = label;
    this.shadowRoot.querySelector('[data-copy-pop-status]').textContent = '';
    input.value = value;
    this.shadowRoot.querySelector('[data-copy-pop]').style.display = '';
    requestAnimationFrame(() => { input.focus(); input.select(); });
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        const status = this.shadowRoot.querySelector('[data-copy-pop-status]');
        if (status) status.textContent = 'Copied ✓';
      }).catch(() => { /* clipboard permission denied — the selected input is the fallback */ });
    }
  }

  _copyNow() {
    const input = this.shadowRoot.querySelector('[data-copy-pop-input]');
    input.focus(); input.select();
    if (navigator.clipboard && navigator.clipboard.writeText && this._copyValue != null) {
      navigator.clipboard.writeText(this._copyValue).then(() => {
        const status = this.shadowRoot.querySelector('[data-copy-pop-status]');
        if (status) status.textContent = 'Copied ✓';
      }).catch(() => { /* selection above is still there for a manual copy */ });
    }
  }

  _closeCopy() {
    const pop = this.shadowRoot.querySelector('[data-copy-pop]');
    if (pop) pop.style.display = 'none';
  }

  _setArchived(id, archived) {
    if (this._archivingId) return;
    this._archivingId = id;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('archive-asset', { detail: { id, archived }, bubbles: true, composed: true }));
  }

  _render() {
    const main = this.shadowRoot.querySelector('[data-main]');
    if (!this._loaded) { main.innerHTML = `<p class="sub">Loading…</p>`; return; }
    if (this._error) {
      main.innerHTML = `<div class="msg err">${esc(this._error)}</div>
        <button class="link" data-nav>← Back to the Hub</button>`;
      return;
    }
    if (!this._canManage) {
      main.innerHTML = `<div class="msg err">You're not authorized to manage fleet records. This is available to managers.</div>
        <button class="link" data-nav>← Back to the Hub</button>`;
      return;
    }
    main.innerHTML = `
      ${this._msg ? `<div class="msg ${this._msg.ok ? 'ok' : 'err'}">${esc(this._msg.text)}</div>` : ''}
      ${this._draft ? this._formSection() : ''}
      ${this._listSection()}
      <button class="link" data-nav>← Back to the Hub</button>`;
  }

  _formSection() {
    const d = this._draft;
    const fieldHtml = (f) => {
      const val = esc(d[f.key] || '');
      let input;
      if (f.type === 'employee-select') {
        const opts = this._employees.map((e) => `<option value="${esc(e._id)}" ${d[f.key] === e._id ? 'selected' : ''}>${esc(e.name)}</option>`).join('');
        input = `<select data-field="${f.key}"><option value="">— Unassigned —</option>${opts}</select>`;
      } else if (f.type === 'select') {
        input = `<select data-field="${f.key}">${f.options.map(([v, l]) => `<option value="${v}" ${d[f.key] === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      } else if (f.type === 'textarea') {
        input = `<textarea data-field="${f.key}">${val}</textarea>`;
      } else {
        input = `<input type="${f.type}" data-field="${f.key}" value="${val}">`;
      }
      return `<div class="${f.half ? '' : 'full'}"><label class="f">${f.label}</label>${input}</div>`;
    };
    return `<div class="section card" style="padding:18px 20px">
      <h2>Add a vehicle or trailer</h2>
      <div class="field-grid">${FIELDS.map(fieldHtml).join('')}</div>
      <div style="display:flex;gap:10px;margin-top:18px">
        <button class="btn ${this._saving ? 'is-loading' : ''}" data-save>
          ${this._saving ? '<span class="btn-spinner"></span>Saving…' : 'Add asset'}</button>
        <button class="btn ghost" data-cancel>Cancel</button>
      </div>
    </div>`;
  }

  _listSection() {
    return `<div class="section">
      <h2>Fleet records</h2>
      <div class="searchbar">
        <input type="text" id="q" placeholder="Search unit #, plate, VIN, make, model, assigned to…">
        <button class="btn" data-search>Search</button>
        <button class="btn ghost" data-add>+ Add asset</button>
      </div>
      <div class="list">${this._listBody()}</div>
    </div>`;
  }

  _listBody() {
    if (!this._listed) return `<p class="empty">Loading fleet records…</p>`;
    if (!this._items.length) return `<p class="empty">No fleet records yet — add one above.</p>`;
    return this._items.map((a) => this._assetCard(a)).join('');
  }

  _assetCard(a) {
    // Unit # and plate, both individually click-to-copy, are the two things someone's actually
    // looking for at a glance — "Vehicle 139 - EBM3133".
    const idParts = [];
    if (a.unitnumber) idParts.push(copyChip('Unit #', a.unitnumber));
    if (a.plateNumber) idParts.push(copyChip('Plate #', a.plateNumber));
    const heading = idParts.length ? `Vehicle ${idParts.join(' - ')}`
      : (a.vin ? copyChip('VIN', a.vin) : (a.title ? copyChip('Title', a.title) : '(no unit # or plate)'));
    const vehicleLine = [a.year, a.make, a.model, a.color].filter(Boolean).join(' ');
    const meta = [esc(vehicleLine), a.vin ? `VIN ${copyChip('VIN', a.vin)}` : ''].filter(Boolean).join(' · ');
    const meta2 = [
      a.assignedToName ? `Assigned: ${copyChip('Assigned to', a.assignedToName)}` : '',
      a.ncQuickpass ? `Quickpass #${copyChip('NC Quickpass #', a.ncQuickpass)}` : '',
      a.dateAdded ? `Added ${esc(a.dateAdded)}` : '',
    ].filter(Boolean).join(' · ');
    const busy = this._archivingId === a._id;
    const retired = a.status === 'Retired';

    return `<div class="asset card ${retired ? 'is-retired' : ''}">
      <div class="top">
        <div class="info">
          <div class="name">${heading} <span class="pill ${retired ? '' : 'on'}">${esc(a.status || 'Active')}</span></div>
          ${meta ? `<div class="meta">${meta}</div>` : ''}
          ${meta2 ? `<div class="meta">${meta2}</div>` : ''}
        </div>
        <div class="actions">
          ${retired
            ? `<button class="btn ghost sm ${busy ? 'is-loading' : ''}" data-restore="${esc(a._id)}" ${busy ? 'disabled' : ''}>${busy ? '…' : 'Restore'}</button>`
            : `<button class="btn ghost sm ${busy ? 'is-loading' : ''}" data-archive="${esc(a._id)}" ${busy ? 'disabled' : ''}>${busy ? '…' : 'Archive'}</button>`}
        </div>
      </div>
    </div>`;
  }
}

customElements.define('fleet-management', FleetManagement);
