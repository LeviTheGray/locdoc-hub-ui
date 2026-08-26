/**
 * Wix Custom Element — Fleet Management  (<fleet-management>)
 *
 * A VIN/title registry for vehicles and trailers not tracked in Enterprise Fleet Management.
 * Any manager can view, add, edit, or delete a record — access is company-wide, not scoped to a
 * department (fleet assets aren't department-specific the way employees are).
 *
 * Data handoff (mirrors employee-lifecycle.js's admin-panel shape):
 *   • Velo → element :  init-data    { canManage } | { error }
 *                       list-result  { items:[Asset] } | { error }               (carries _ts)
 *                       save-result  { ok:true, asset:Asset } | { ok:false, error } (carries _ts)
 *                       delete-result{ ok:true, id } | { ok:false, error }        (carries _ts)
 *   • element → Velo :  'list-assets'   { term }
 *                       'save-asset'    { asset: Asset }   // asset._id present = edit, else create
 *                       'delete-asset'  { id }
 *                       'navigate'      { key: 'hub' }
 *
 * Asset shape: { _id?, assetType:'vehicle'|'trailer', unitNumber, make, model, year, plateNumber,
 *                vin, titleNumber, titleState, lienholder, registrationExpiration, notes }
 *
 * The backend re-checks manager status on every method (backend/fleetManagement.web.js) — the
 * `canManage` flag here only decides what UI to paint.
 *
 * Editor setup: Add → Embed Code → Custom Element → this file, tag `fleet-management`,
 * element ID `fleetManagement`.
 */

import { styles, ensureMaterialSymbols } from './tokens.js';

const FIELDS = [
  { key: 'unitNumber', label: 'Unit #', type: 'text', half: true },
  { key: 'assetType', label: 'Type', type: 'select', options: [['vehicle', 'Vehicle'], ['trailer', 'Trailer']], half: true },
  { key: 'make', label: 'Make', type: 'text', half: true },
  { key: 'model', label: 'Model', type: 'text', half: true },
  { key: 'year', label: 'Year', type: 'text', half: true },
  { key: 'plateNumber', label: 'Plate #', type: 'text', half: true },
  { key: 'vin', label: 'VIN', type: 'text' },
  { key: 'titleNumber', label: 'Title #', type: 'text', half: true },
  { key: 'titleState', label: 'Title state', type: 'text', half: true },
  { key: 'lienholder', label: 'Lienholder', type: 'text', half: true },
  { key: 'registrationExpiration', label: 'Registration expires', type: 'date', half: true },
  { key: 'notes', label: 'Notes', type: 'textarea' },
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
  .asset .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .asset .info { flex: 1; min-width: 180px; }
  .asset .name { font-size: 15px; font-weight: 700; }
  .asset .meta { font-size: 12px; color: var(--gray-600); margin-top: 2px; }
  .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; background: var(--gray-100); color: var(--gray-600); }
  .asset .actions { display: flex; gap: 8px; }
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
  @media (max-width: 560px) { .field-grid { grid-template-columns: 1fr; } }
`);

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

class FleetManagement extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'list-result', 'save-result', 'delete-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._canManage = false;
    this._loaded = false;
    this._error = null;
    this._items = [];
    this._listed = false;
    this._saving = false;
    this._deletingId = null;
    this._msg = null;
    this._draft = null;    // non-null while the add/edit form is open
    this._editingId = null;
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
    if (name === 'list-result')   this._applyList(value);
    if (name === 'save-result')   this._applySave(value);
    if (name === 'delete-result') this._applyDelete(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _applyInit(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._canManage = Boolean(p.canManage);
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
      const a = p.asset;
      const i = this._items.findIndex((x) => x._id === a._id);
      if (i >= 0) this._items[i] = a; else this._items.unshift(a);
      this._msg = { ok: true, text: 'Saved.' };
      this._draft = null;
      this._editingId = null;
    } else {
      this._msg = { ok: false, text: p.error || 'Save failed.' };
    }
    this._render();
  }

  _applyDelete(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._deletingId = null;
    if (p.ok) {
      this._items = this._items.filter((x) => x._id !== p.id);
      this._msg = { ok: true, text: 'Deleted.' };
    } else {
      this._msg = { ok: false, text: p.error || 'Delete failed.' };
    }
    this._render();
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <header class="header"><h1>🚐 Fleet Management</h1>
        <p>VIN, title, and registration records for vehicles and trailers not tracked in Enterprise Fleet Management.</p></header>
      <main class="main" data-main></main>`;

    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.closest('[data-search]')) return this._search();
      if (e.target.closest('[data-add]')) return this._openForm(null);
      if (e.target.closest('[data-cancel]')) return this._closeForm();
      if (e.target.closest('[data-save]')) return this._save();
      const editBtn = e.target.closest('[data-edit]');
      if (editBtn) return this._openForm(editBtn.getAttribute('data-edit'));
      const delBtn = e.target.closest('[data-delete]');
      if (delBtn) return this._delete(delBtn.getAttribute('data-delete'));
      if (e.target.closest('[data-nav]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
    });
    this.shadowRoot.addEventListener('input', (e) => {
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

  _openForm(id) {
    this._msg = null;
    if (id) {
      const a = this._items.find((x) => x._id === id);
      if (!a) return;
      this._editingId = id;
      this._draft = { ...a };
    } else {
      this._editingId = null;
      this._draft = { assetType: 'vehicle' };
    }
    this._render();
  }

  _closeForm() {
    this._draft = null;
    this._editingId = null;
    this._render();
  }

  _save() {
    if (this._saving || !this._draft) return;
    const d = this._draft;
    if (!(d.unitNumber || '').trim() && !(d.vin || '').trim()) {
      this._msg = { ok: false, text: 'Enter at least a unit number or VIN.' };
      return this._render();
    }
    this._saving = true;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('save-asset', {
      detail: { asset: { ...(this._editingId ? { _id: this._editingId } : {}), ...d } },
      bubbles: true, composed: true,
    }));
  }

  _delete(id) {
    if (this._deletingId) return;
    this._deletingId = id;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('delete-asset', { detail: { id }, bubbles: true, composed: true }));
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
    const isEdit = !!this._editingId;
    const fieldHtml = (f) => {
      const val = esc(d[f.key] || '');
      let input;
      if (f.type === 'select') {
        input = `<select data-field="${f.key}">${f.options.map(([v, l]) => `<option value="${v}" ${d[f.key] === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      } else if (f.type === 'textarea') {
        input = `<textarea data-field="${f.key}">${val}</textarea>`;
      } else {
        input = `<input type="${f.type}" data-field="${f.key}" value="${val}">`;
      }
      return `<div class="${f.half ? '' : 'full'}"><label class="f">${f.label}</label>${input}</div>`;
    };
    return `<div class="section card" style="padding:18px 20px">
      <h2>${isEdit ? 'Edit asset' : 'Add a vehicle or trailer'}</h2>
      <div class="field-grid">${FIELDS.map(fieldHtml).join('')}</div>
      <div style="display:flex;gap:10px;margin-top:18px">
        <button class="btn ${this._saving ? 'is-loading' : ''}" data-save>
          ${this._saving ? '<span class="btn-spinner"></span>Saving…' : (isEdit ? 'Save changes' : 'Add asset')}</button>
        <button class="btn ghost" data-cancel>Cancel</button>
      </div>
    </div>`;
  }

  _listSection() {
    return `<div class="section">
      <h2>Fleet records</h2>
      <div class="searchbar">
        <input type="text" id="q" placeholder="Search unit #, make, model, plate, VIN…">
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
    const name = a.unitNumber ? `Unit ${a.unitNumber}` : (a.vin || '(no unit # or VIN)');
    const vehicleLine = [a.year, a.make, a.model].filter(Boolean).join(' ');
    const meta = [vehicleLine, a.plateNumber ? `Plate ${a.plateNumber}` : '', a.vin ? `VIN ${a.vin}` : '']
      .filter(Boolean).map(esc).join(' · ');
    const titleMeta = [a.titleNumber ? `Title #${a.titleNumber}` : '', a.titleState, a.lienholder ? `Lien: ${a.lienholder}` : '', a.registrationExpiration ? `Reg. exp. ${a.registrationExpiration}` : '']
      .filter(Boolean).map(esc).join(' · ');
    const deleting = this._deletingId === a._id;

    return `<div class="asset card">
      <div class="top">
        <div class="info">
          <div class="name">${esc(name)} <span class="pill">${a.assetType === 'trailer' ? 'Trailer' : 'Vehicle'}</span></div>
          ${meta ? `<div class="meta">${meta}</div>` : ''}
          ${titleMeta ? `<div class="meta">${titleMeta}</div>` : ''}
          ${a.notes ? `<div class="meta">${esc(a.notes)}</div>` : ''}
        </div>
        <div class="actions">
          <button class="btn ghost sm" data-edit="${esc(a._id)}">Edit</button>
          <button class="btn danger sm ${deleting ? 'is-loading' : ''}" data-delete="${esc(a._id)}" ${deleting ? 'disabled' : ''}>
            ${deleting ? '…' : 'Delete'}</button>
        </div>
      </div>
    </div>`;
  }
}

customElements.define('fleet-management', FleetManagement);
