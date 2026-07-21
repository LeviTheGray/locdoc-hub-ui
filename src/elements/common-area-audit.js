/**
 * Wix Custom Element — Common Area Audit  (<common-area-audit>)
 *
 * QR-posted audit for a shared common area (break room, bathrooms, lock shop, …). The QR encodes
 * ?branch=&area=; the Velo page resolves the area + the logged-in submitter + the branch roster and
 * hands them in. The submitter marks a fixed checklist, optionally attaches photos, and credits the
 * person who actually CLEANED the area. Both the cleaner and the submitter earn common-area
 * recognition points on the scorecard.
 *
 * Data handoff:
 *   • Velo → element :  init-data     { area:{branch,areaKey,areaName}, submitter:{id,name}, cleaners:[{_id,name}] } | { error }
 *                       photo-result  { id, url } | { id, error }     (correlated by id)
 *                       submit-result { ok:true, report } | { ok:false, error }
 *   • element → Velo :  'upload-photo' { detail: { id, slot, dataUrl } }
 *                       'submit-audit' { detail: record }
 *                       'navigate'     { detail: { key:'hub' } }
 *
 * Editor: Add → Embed Code → Custom Element → source = this file,
 * tag name `common-area-audit`, element ID `commonAreaAudit`.
 */

import { TOKENS } from './tokens.js';

// Fixed checklist + optional photos shared by every common area (v1 — not per-area configurable).
const CHECKLIST = [
  { key: 'surfaces',  label: 'Counters / Surfaces Wiped Down?' },
  { key: 'floor',     label: 'Floor Swept / Mopped?' },
  { key: 'trash',     label: 'Trash Emptied?' },
  { key: 'restocked', label: 'Supplies Restocked (soap, paper, etc.)?' },
  { key: 'tidy',      label: 'Area Tidy & Organized?' },
];
const PHOTOS = [
  { key: 'area', label: 'Photo of the Area' },
];
const SECTION = 'common';

// Common-area audits are tied to the same Wed 9:00am → next Tue 11:59pm week as the cleanliness
// audit, and locked Wed 00:00–09:00. getAuditWeekStart returns the YYYY-MM-DD of the active
// Wednesday (local time). Keep in sync with cleanliness-audit.js / the Velo pages.
function localISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getAuditWeekStart(date) {
  const d = new Date(date);
  let daysBack = (d.getDay() + 4) % 7;
  if (daysBack === 0 && d.getHours() < 9) daysBack = 7;
  d.setDate(d.getDate() - daysBack);
  d.setHours(0, 0, 0, 0);
  return localISODate(d);
}
function isAuditLocked(date) {
  const d = new Date(date);
  return d.getDay() === 3 && d.getHours() < 9;
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function pid(section, slot) { return `${section}.${slot}`; }

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ${TOKENS}
  :host { --amber:#f59e0b; --red:#ef4444; background:var(--gray-50); }
  .backbtn { display:inline-flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; color:#6b7280; font:600 13px system-ui,-apple-system,sans-serif; padding:12px 16px 0; }
  .header { background: var(--primary); color: #fff; padding: 16px 24px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p  { font-size: 12px; opacity: .75; margin-top: 2px; }
  .main { max-width: 720px; margin: 0 auto; padding: 28px 16px; }
  .loading-state { text-align: center; padding: 64px 0; color: var(--gray-400); font-size: 15px; }
  .form-card { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow); margin-bottom: 20px; }
  .card-title { font-size: 16px; font-weight: 700; padding-bottom: 14px; border-bottom: 1px solid var(--gray-200); margin-bottom: 20px; }
  .card-title span { display: block; font-size: 12px; font-weight: 400; color: var(--gray-400); margin-top: 3px; }
  .who-field { margin-bottom: 16px; display: flex; align-items: center; gap: 10px; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px; padding: 12px 14px; }
  .who-field .who-label { font-size: 13px; font-weight: 600; color: var(--gray-600); }
  .who-field .who-value { font-size: 15px; font-weight: 800; margin-left: auto; }
  .picker-field { margin-bottom: 20px; }
  .picker-field > label { display: block; font-size: 14px; font-weight: 700; margin-bottom: 8px; }
  .picker-field select {
    width: 100%; padding: 12px 36px 12px 12px; border: 1.5px solid var(--gray-200); border-radius: 10px; font-size: 15px;
    background: #fff; color: var(--gray-900); cursor: pointer; -webkit-appearance: none; appearance: none; min-height: 46px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M6 8L1 3h10z' fill='%236b7280'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
  }
  .check-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--gray-100); }
  .check-item:last-child { border-bottom: none; }
  .check-label { font-size: 14px; font-weight: 600; flex: 1; }
  .pf { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; flex-shrink: 0; width: 168px; }
  .pf-btn { -webkit-appearance: none; appearance: none; font-family: inherit; border: 1.5px solid var(--gray-200); background: #fff; border-radius: 10px; padding: 10px 4px; min-height: 44px; font-size: 13px; font-weight: 700; color: var(--gray-600); cursor: pointer; transition: border-color .12s, background .12s, color .12s, transform .08s; -webkit-tap-highlight-color: transparent; }
  .pf-btn:active { transform: scale(.95); }
  .pf-btn.pass.sel { border-color: var(--green); background: #dcfce7; color: #14532d; }
  .pf-btn.fail.sel { border-color: var(--red); background: #fee2e2; color: #991b1b; }
  .photo-field { margin-top: 18px; }
  .photo-field > label { display: block; font-size: 14px; font-weight: 700; margin-bottom: 8px; }
  .photo-field .opt { font-size: 12px; font-weight: 400; color: var(--gray-400); }
  .photo-drop { border: 1.5px dashed var(--gray-200); border-radius: 10px; padding: 16px; text-align: center; cursor: pointer; color: var(--gray-600); font-size: 13px; font-weight: 600; background: var(--gray-50); }
  .photo-drop:active { background: var(--gray-100); }
  .photo-preview { margin-top: 10px; display: none; }
  .photo-preview img { max-width: 100%; border-radius: 10px; border: 1px solid var(--gray-200); }
  .photo-status { font-size: 12px; color: var(--gray-400); margin-top: 6px; }
  input[type="file"] { display: none; }
  .photos-divider { border: none; border-top: 1px solid var(--gray-200); margin-top: 24px; padding-top: 4px; }
  .val-banner { display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #b91c1c; margin-bottom: 20px; }
  .form-actions { display: flex; gap: 12px; }
  .btn-primary { flex: 1; padding: 14px 20px; background: var(--primary); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background .15s, transform .1s; }
  .btn-primary:hover { background: var(--primary-dk); transform: translateY(-1px); }
  .btn-primary:active { transform: scale(.98); }
  .btn-primary:disabled { background: var(--gray-200); color: var(--gray-400); cursor: default; transform: none; }
  .success-card { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 56px 40px; text-align: center; box-shadow: var(--shadow); }
  .success-icon { width: 72px; height: 72px; border-radius: 50%; background: #d1fae5; color: #059669; font-size: 34px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
  .success-card h2 { font-size: 24px; font-weight: 700; }
  .success-card p  { font-size: 14px; color: var(--gray-600); margin-top: 8px; }
  .error-card { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 40px 28px; text-align: center; box-shadow: var(--shadow); }
  @media (max-width: 600px) {
    .main { padding: 16px 12px; } .form-card { padding: 20px 16px; } .success-card { padding: 40px 24px; } .pf { width: 150px; }
  }
`;

class CommonAreaAudit extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'photo-result', 'submit-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._area = null;         // { branch, areaKey, areaName }
    this._submitter = null;    // { id, name }
    this._cleaners = [];       // [{ _id, name }]
    this._cleanerId = '';
    this._pending = false;
    this._answers = {};
    this._photos = {};
    this._photoPending = {};
  }

  connectedCallback() {
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyInit(this.getAttribute('init-data'));
  }

  attributeChangedCallback(name, _old, value) {
    if (!value) return;
    if (name === 'init-data') this._applyInit(value);
    if (name === 'photo-result') this._applyPhotoResult(value);
    if (name === 'submit-result') this._applySubmitResult(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <button class="backbtn" data-action="back-hub">&#8592; Back to Employee Hub</button>
      <header class="header"><h1>Common Area Audit</h1><p>LocDoc · Employee Hub</p></header>
      <main class="main">
        <div id="loadingState" class="loading-state">Loading…</div>
        <div id="errorView" style="display:none"><div class="error-card"><div style="font-size:34px;margin-bottom:8px">&#9888;&#65039;</div><div class="card-title" style="justify-content:center" id="errorMsg"></div></div></div>
        <div id="lockedView" style="display:none">
          <div class="form-card" style="text-align:center;padding:28px 18px">
            <div style="font-size:34px;margin-bottom:8px">&#128274;</div>
            <div class="card-title" style="justify-content:center">Reporting is locked</div>
            <p style="font-size:14px;color:var(--gray-600);margin-top:6px">
              Audits are locked during the Wednesday meeting (12:00am&ndash;9:00am). Reporting reopens
              at 9:00am &mdash; submissions then count toward next week.
            </p>
          </div>
        </div>
        <div id="submitView" style="display:none">
          <div class="val-banner" id="valBanner"></div>
          <div class="form-card">
            <div class="card-title" id="areaTitle"></div>
            <div class="who-field"><span class="who-label">Submitted by</span><span class="who-value" id="submitterName"></span></div>
            <div class="picker-field">
              <label for="cleanerSelect">Who cleaned this area?</label>
              <select id="cleanerSelect"><option value="">Select the person who cleaned…</option></select>
            </div>
          </div>
          <div class="form-card">
            <div class="card-title">Checklist <span>Mark each item Pass or Fail</span></div>
            <div id="checklist"></div>
            <div class="photos-divider"></div>
            <div id="photos"></div>
          </div>
          <div class="form-card">
            <div class="form-actions"><button class="btn-primary" id="submitBtn" data-action="submit">Submit Common Area Audit</button></div>
          </div>
        </div>
        <div id="successView" style="display:none">
          <div class="success-card"><div class="success-icon">&#10003;</div><h2>Audit Submitted!</h2><p id="successMsg"></p></div>
        </div>
      </main>`;

    const root = this.shadowRoot;
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="back-hub"]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
        return;
      }
      if (e.target.closest('[data-action="submit"]')) { this._submit(); return; }
      const pf = e.target.closest('[data-pf-key]');
      if (pf) { this._setAnswer(pf.getAttribute('data-pf-key'), pf.getAttribute('data-pf-val') === 'true'); return; }
      const drop = e.target.closest('[data-photo-trigger]');
      if (drop) { const inp = this._$(drop.getAttribute('data-photo-trigger')); if (inp) inp.click(); }
    });
    root.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'cleanerSelect') {
        this._cleanerId = e.target.value;
        this._$('valBanner').style.display = 'none';
        return;
      }
      if (e.target && e.target.hasAttribute('data-photo')) {
        this._handlePhoto(e.target.getAttribute('data-slot'), e.target);
      }
    });
  }

  _applyInit(json) {
    let p;
    try { p = JSON.parse(json); } catch (e) { p = { error: 'Failed to load.' }; }
    if (p.error) { this._showError(p.error); return; }
    this._area = p.area || null;
    this._submitter = p.submitter || null;
    this._cleaners = Array.isArray(p.cleaners) ? p.cleaners : [];
    if (!this._area || !this._area.areaKey) { this._showError('This QR code is not linked to a known common area. Contact Operations.'); return; }
    if (!this._submitter || !this._submitter.id) { this._showError('We could not match your login to an employee record. Contact Operations.'); return; }
    this._renderPage();
  }

  _showError(msg) {
    this._$('loadingState').style.display = 'none';
    this._$('submitView').style.display = 'none';
    this._$('lockedView').style.display = 'none';
    this._$('successView').style.display = 'none';
    this._$('errorView').style.display = '';
    this._$('errorMsg').textContent = msg;
  }

  _renderPage() {
    this._$('loadingState').style.display = 'none';
    if (isAuditLocked(new Date())) { this._$('lockedView').style.display = ''; return; }
    this._$('submitView').style.display = '';

    this._$('areaTitle').innerHTML = `${esc(this._area.areaName || 'Common Area')} <span>${esc(this._area.branch || '')}</span>`;
    this._$('submitterName').textContent = this._submitter.name || '—';

    const sel = this._$('cleanerSelect');
    sel.innerHTML = `<option value="">Select the person who cleaned…</option>` +
      this._cleaners.map(c => `<option value="${esc(c._id)}">${esc(c.name)}</option>`).join('');

    this._$('checklist').innerHTML = CHECKLIST.map(item => `
      <div class="check-item"><div class="check-label">${esc(item.label)}</div>
        <div class="pf">
          <button type="button" class="pf-btn pass" id="pf-${item.key}-pass" data-pf-key="${item.key}" data-pf-val="true">Pass</button>
          <button type="button" class="pf-btn fail" id="pf-${item.key}-fail" data-pf-key="${item.key}" data-pf-val="false">Fail</button>
        </div></div>`).join('');

    this._$('photos').innerHTML = PHOTOS.map(p => `
      <div class="photo-field">
        <label>${esc(p.label)} <span class="opt">(optional — counts toward the score)</span></label>
        <div class="photo-drop" data-photo-trigger="file-${p.key}">📷 Tap to take or upload a photo</div>
        <input type="file" accept="image/*" id="file-${p.key}" data-photo data-slot="${p.key}">
        <div class="photo-preview" id="prev-${p.key}"><img id="img-${p.key}" alt="${esc(p.label)}"></div>
        <div class="photo-status" id="stat-${p.key}"></div>
      </div>`).join('');
  }

  _setAnswer(key, pass) {
    this._answers[key] = pass;
    this._$(`pf-${key}-pass`).classList.toggle('sel', pass);
    this._$(`pf-${key}-fail`).classList.toggle('sel', !pass);
    this._$('valBanner').style.display = 'none';
  }

  _handlePhoto(slot, input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const id = pid(SECTION, slot);
    const statusEl = this._$(`stat-${slot}`);
    statusEl.textContent = 'Processing…';

    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const r = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * r); height = Math.round(height * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

        this._$(`img-${slot}`).src = dataUrl;
        this._$(`prev-${slot}`).style.display = 'block';

        this._photoPending[id] = true;
        statusEl.textContent = 'Uploading…';
        this._updateSubmitState();
        this.dispatchEvent(new CustomEvent('upload-photo', { detail: { id, slot: `common-area-${slot}`, dataUrl }, bubbles: true, composed: true }));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  _applyPhotoResult(json) {
    let r;
    try { r = JSON.parse(json); } catch (e) { return; }
    const id = r.id;
    this._photoPending[id] = false;
    const slot = id.split('.')[1];
    const s = this._$(`stat-${slot}`);
    if (r.error) {
      if (s) s.textContent = 'Upload failed — tap to retry';
    } else {
      this._photos[id] = r.url;
      if (s) s.textContent = '✓ Photo attached';
    }
    this._updateSubmitState();
  }

  _updateSubmitState() {
    const uploading = Object.values(this._photoPending).some(Boolean);
    const btn = this._$('submitBtn');
    if (!btn) return;
    btn.disabled = uploading || this._pending;
    btn.textContent = uploading ? 'Waiting for photos…' : (this._pending ? 'Submitting…' : 'Submit Common Area Audit');
  }

  _submit() {
    if (this._pending) return;
    if (isAuditLocked(new Date())) { this._$('submitView').style.display = 'none'; this._$('lockedView').style.display = ''; return; }

    const banner = this._$('valBanner');
    if (!this._cleanerId) {
      banner.style.display = 'block';
      banner.textContent = 'Please select who cleaned this area.';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const missing = CHECKLIST.filter(item => !(item.key in this._answers)).map(item => item.label);
    if (missing.length) {
      banner.style.display = 'block';
      banner.textContent = `Please complete: ${missing.slice(0, 3).join(' · ')}${missing.length > 3 ? ` (+${missing.length - 3} more)` : ''}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const out = {};
    const photoUrls = {};
    let pass = 0, total = 0;
    CHECKLIST.forEach(item => {
      const v = this._answers[item.key] === true;
      out[item.key] = v;
      total++; if (v) pass++;
    });
    let photoCount = 0;
    PHOTOS.forEach(p => {
      const id = pid(SECTION, p.key);
      if (this._photos[id]) { photoUrls[id] = this._photos[id]; photoCount++; }
    });
    const num = pass + photoCount;
    const den = CHECKLIST.length + PHOTOS.length;
    const score = den ? Math.round((num / den) * 100) : 0;

    const cleaner = this._cleaners.find(c => c._id === this._cleanerId) || null;
    const today = new Date().toISOString().split('T')[0];
    const record = {
      branch: this._area.branch || '',
      areaKey: this._area.areaKey,
      areaName: this._area.areaName || '',
      weekStart: getAuditWeekStart(new Date()),
      submitterId: this._submitter.id,
      submitterName: this._submitter.name || '',
      cleanerId: this._cleanerId,
      cleanerName: cleaner ? cleaner.name : '',
      answers: out,
      passCount: pass,
      totalCount: total,
      score,
      photoUrls,
      submittedDate: today,
    };

    this._pending = true;
    this._updateSubmitState();
    this.dispatchEvent(new CustomEvent('submit-audit', { detail: record, bubbles: true, composed: true }));
  }

  _applySubmitResult(json) {
    let r;
    try { r = JSON.parse(json); } catch (e) { return; }
    this._pending = false;
    if (r.ok) {
      this._$('submitView').style.display = 'none';
      this._$('successView').style.display = '';
      const who = (r.report && r.report.cleanerName) ? ` ${r.report.cleanerName} earned cleaning points.` : '';
      this._$('successMsg').textContent = `Thanks! This area's audit (${r.report ? r.report.score : ''}%) has been saved.${who}`;
    } else {
      this._updateSubmitState();
      const banner = this._$('valBanner');
      banner.style.display = 'block';
      banner.textContent = r.error || 'Could not save. Please try again.';
    }
  }
}

customElements.define('common-area-audit', CommonAreaAudit);
