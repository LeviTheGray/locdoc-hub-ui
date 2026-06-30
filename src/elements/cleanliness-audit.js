/**
 * Wix Custom Element — Cleanliness Audit  (<cleanliness-audit>)
 *
 * Port of the htmlCleanlinessAudit HtmlComponent. Submit-only: dynamic vehicle/
 * office sections (pass-fail checklist + optional photos), photo upload via Velo
 * backend, submitted/success views. See CUSTOM-ELEMENTS.md for the recipe.
 *
 * Data handoff:
 *   • Velo → element :  init-data     { currentUser, existingReport } | { error }
 *                       photo-result  { id, url } | { id, error }     (correlated by id)
 *                       submit-result { ok:true, report } | { ok:false, error }
 *   • element → Velo :  'upload-photo' { detail: { id, slot, dataUrl } }
 *                       'submit-audit' { detail: record }
 *                       'navigate'     { detail: { key:'hub' } }
 *
 * Editor: Add → Embed Code → Custom Element → source = this file,
 * tag name `cleanliness-audit`, element ID `cleanlinessAudit`.
 */

import { TOKENS } from './tokens.js';

const SECTIONS = {
  vehicle: {
    title: '{Noun}', vehicleNumber: true,
    checklist: [
      { key: 'organized', label: '{Noun} Organized?' }, { key: 'floor', label: 'Floor Clean?' },
      { key: 'shelves', label: 'Shelves / Key Machine Clean?' }, { key: 'cab', label: 'Cab Area Clean?' },
      { key: 'outside', label: 'Outside of {Noun} Clean?' }, { key: 'tires', label: 'Tires Inflated?' },
    ],
    photos: [
      { key: 'cab', label: 'Picture (Cab Area)' }, { key: 'cargo', label: 'Picture (Cargo Area)' },
      { key: 'outside', label: 'Picture (Outside of {Noun})' },
    ],
  },
  office: {
    title: 'Office', vehicleNumber: false,
    checklist: [
      { key: 'organized', label: 'Desk / Shelves / Tables Organized?' },
      { key: 'floor', label: 'Floor Clean / Swept?' }, { key: 'bathroom', label: 'Nearest Bathroom Clean?' },
    ],
    photos: [{ key: 'office', label: 'Picture of Office Space' }],
  },
};
const SECTION_ORDER = ['vehicle', 'office'];

// Cleanliness audit week runs Wed 9:00am → next Tue 11:59pm (presented at the Wednesday meeting).
// The Wed 00:00–09:00 window is locked: no submissions; the form is disabled. getAuditWeekStart
// returns the YYYY-MM-DD of the Wednesday the active week opened (local time).
function localISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function getAuditWeekStart(date) {
  const d = new Date(date);
  let daysBack = (d.getDay() + 4) % 7; // days since most recent Wednesday (Wed=0 … Tue=6)
  if (daysBack === 0 && d.getHours() < 9) daysBack = 7; // Wed before 9am → previous week
  d.setDate(d.getDate() - daysBack);
  d.setHours(0, 0, 0, 0);
  return localISODate(d);
}
function isAuditLocked(date) {
  const d = new Date(date);
  return d.getDay() === 3 && d.getHours() < 9; // Wednesday 00:00–08:59
}
function formatWeekRange(weekStartISO) {
  const start = new Date(weekStartISO + 'T00:00:00');
  const end = new Date(start); end.setDate(end.getDate() + 6); // week start (Wed) → Tue
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function pid(section, slot) { return `${section}.${slot}`; }
function asObj(v) { if (!v) return {}; if (typeof v === 'object') return v; try { return JSON.parse(v) || {}; } catch (e) { return {}; } }

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
  .vnum-field { margin-bottom: 16px; display: flex; align-items: center; gap: 10px; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px; padding: 12px 14px; }
  .vnum-field .vnum-label { font-size: 13px; font-weight: 600; color: var(--gray-600); }
  .vnum-field .vnum-value { font-size: 16px; font-weight: 800; margin-left: auto; }
  .vnum-field .vnum-empty { font-size: 13px; font-style: italic; color: var(--gray-400); margin-left: auto; }
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
  .submitted-banner { background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; }
  .submitted-banner .check { width: 36px; height: 36px; border-radius: 50%; background: #059669; color: #fff; font-size: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .submitted-banner .msg { font-size: 14px; font-weight: 600; color: #065f46; }
  .submitted-banner .sub { font-size: 12px; color: #047857; margin-top: 2px; }
  .ro-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--gray-100); font-size: 14px; }
  .ro-item:last-child { border-bottom: none; }
  .ro-pass { color: #14532d; font-weight: 700; } .ro-fail { color: #991b1b; font-weight: 700; }
  .ro-sub { font-size: 12px; font-weight: 700; color: var(--gray-400); text-transform: uppercase; letter-spacing: .03em; margin: 18px 0 4px; }
  .score-big { font-size: 28px; font-weight: 800; }
  .ro-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; margin-top: 12px; }
  .ro-gallery img { width: 100%; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid var(--gray-200); }
  .success-card { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 56px 40px; text-align: center; box-shadow: var(--shadow); }
  .success-icon { width: 72px; height: 72px; border-radius: 50%; background: #d1fae5; color: #059669; font-size: 34px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
  .success-card h2 { font-size: 24px; font-weight: 700; }
  .success-card p  { font-size: 14px; color: var(--gray-600); margin-top: 8px; }
  @media (max-width: 600px) {
    .main { padding: 16px 12px; } .form-card { padding: 20px 16px; } .success-card { padding: 40px 24px; } .pf { width: 150px; }
  }
`;

class CleanlinessAudit extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'photo-result', 'submit-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._user = null;
    this._existing = null;
    this._pending = false;
    this._active = { vehicle: false, office: false };
    this._vehicleNoun = 'vehicle';
    this._answers = { vehicle: {}, office: {} };
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
  _noun(text) { return String(text).replace(/\{Noun\}/g, cap(this._vehicleNoun)).replace(/\{noun\}/g, this._vehicleNoun); }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <button class="backbtn" data-action="back-hub">&#8592; Back to Employee Hub</button>
      <header class="header"><h1>Cleanliness Audit</h1><p>LocDoc · Employee Hub</p></header>
      <main class="main">
        <div id="loadingState" class="loading-state">Loading…</div>
        <div id="viewMine" style="display:none">
          <div id="submittedView" style="display:none">
            <div class="submitted-banner"><div class="check">&#10003;</div>
              <div><div class="msg">Audit submitted for this week</div><div class="sub" id="submittedSubtext"></div></div>
            </div>
            <div class="form-card">
              <div class="card-title">Your Submission <span id="submittedWeekLabel"></span></div>
              <div style="text-align:center;margin-bottom:6px"><div class="score-big" id="ro-score"></div><div style="font-size:12px;color:var(--gray-400)">cleanliness score</div></div>
              <div id="ro-body"></div>
            </div>
          </div>
          <div id="submitView" style="display:none">
            <div class="val-banner" id="valBanner"></div>
            <div id="sectionsContainer"></div>
            <div class="form-card" id="noSectionsCard" style="display:none">
              <div style="text-align:center;color:var(--gray-400);font-size:14px;padding:12px 0">No cleanliness audit areas are assigned to your profile. Contact Operations if this is unexpected.</div>
            </div>
            <div class="form-card" id="submitCard" style="display:none">
              <div class="form-actions"><button class="btn-primary" id="submitBtn" data-action="submit">Submit Cleanliness Audit</button></div>
            </div>
          </div>
          <div id="successView" style="display:none">
            <div class="success-card"><div class="success-icon">&#10003;</div><h2>Audit Submitted!</h2><p id="successMsg"></p></div>
          </div>
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
        </div>
      </main>`;

    const root = this.shadowRoot;
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="back-hub"]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
        return;
      }
      if (e.target.closest('[data-action="submit"]')) { this._submit(); return; }
      const pf = e.target.closest('[data-pf-section]');
      if (pf) { this._setAnswer(pf.getAttribute('data-pf-section'), pf.getAttribute('data-pf-key'), pf.getAttribute('data-pf-val') === 'true'); return; }
      const drop = e.target.closest('[data-photo-trigger]');
      if (drop) { const inp = this._$(drop.getAttribute('data-photo-trigger')); if (inp) inp.click(); }
    });
    root.addEventListener('change', (e) => {
      if (e.target && e.target.hasAttribute('data-photo')) {
        this._handlePhoto(e.target.getAttribute('data-section'), e.target.getAttribute('data-slot'), e.target);
      }
    });
  }

  _applyInit(json) {
    let p;
    try { p = JSON.parse(json); } catch (e) { p = { error: 'Failed to load.' }; }
    if (p.error) { this._$('loadingState').innerHTML = `<span style="color:#b91c1c">${p.error}</span>`; return; }
    this._user = p.currentUser || null;
    this._existing = p.existingReport || null;
    this._active.vehicle = !!(this._user && this._user.vehicleNumber && String(this._user.vehicleNumber).trim());
    this._active.office = !!(this._user && this._user.hasOffice);
    this._vehicleNoun = (this._user && this._user.vehicleNoun) ? String(this._user.vehicleNoun).toLowerCase() : 'vehicle';
    this._renderPage();
  }

  _renderPage() {
    this._$('loadingState').style.display = 'none';
    this._$('viewMine').style.display = '';
    if (this._existing) this._showSubmitted(this._existing);
    else if (isAuditLocked(new Date())) this._showLocked();
    else this._showForm();
  }

  _showLocked() {
    this._$('lockedView').style.display = '';
    this._$('submitView').style.display = 'none';
    this._$('submittedView').style.display = 'none';
    this._$('successView').style.display = 'none';
  }

  _showForm() {
    this._$('submitView').style.display = '';
    this._$('lockedView').style.display = 'none';
    this._$('submittedView').style.display = 'none';
    this._$('successView').style.display = 'none';

    const container = this._$('sectionsContainer');
    container.innerHTML = '';
    let any = false;
    SECTION_ORDER.forEach(section => {
      if (!this._active[section]) return;
      any = true;
      const cfg = SECTIONS[section];
      const card = document.createElement('div');
      card.className = 'form-card';
      let html = `<div class="card-title">${this._noun(cfg.title)} <span>Mark each item Pass or Fail</span></div>`;
      if (cfg.vehicleNumber) {
        const vnum = this._user && this._user.vehicleNumber ? String(this._user.vehicleNumber) : '';
        html += `<div class="vnum-field"><span class="vnum-label">${this._noun('{Noun}')} Number</span>${vnum ? `<span class="vnum-value">${esc(vnum)}</span>` : `<span class="vnum-empty">not set on your profile</span>`}</div>`;
      }
      cfg.checklist.forEach(item => {
        html += `<div class="check-item"><div class="check-label">${this._noun(item.label)}</div>
            <div class="pf">
              <button type="button" class="pf-btn pass" id="pf-${section}-${item.key}-pass" data-pf-section="${section}" data-pf-key="${item.key}" data-pf-val="true">Pass</button>
              <button type="button" class="pf-btn fail" id="pf-${section}-${item.key}-fail" data-pf-section="${section}" data-pf-key="${item.key}" data-pf-val="false">Fail</button>
            </div></div>`;
      });
      if (cfg.photos.length) html += `<div class="photos-divider"></div>`;
      cfg.photos.forEach(p => {
        html += `<div class="photo-field">
            <label>${this._noun(p.label)} <span class="opt">(optional — counts toward your score)</span></label>
            <div class="photo-drop" data-photo-trigger="file-${section}-${p.key}">📷 Tap to take or upload a photo</div>
            <input type="file" accept="image/*" id="file-${section}-${p.key}" data-photo data-section="${section}" data-slot="${p.key}">
            <div class="photo-preview" id="prev-${section}-${p.key}"><img id="img-${section}-${p.key}" alt="${esc(this._noun(p.label))}"></div>
            <div class="photo-status" id="stat-${section}-${p.key}"></div>
          </div>`;
      });
      card.innerHTML = html;
      container.appendChild(card);
    });

    this._$('submitCard').style.display = any ? '' : 'none';
    this._$('noSectionsCard').style.display = any ? 'none' : '';
  }

  _showSubmitted(report) {
    this._$('submittedView').style.display = '';
    this._$('submitView').style.display = 'none';
    this._$('successView').style.display = 'none';
    this._$('submittedSubtext').textContent =
      `Submitted ${new Date(report.submittedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    this._$('submittedWeekLabel').textContent = `Week of ${formatWeekRange(report.weekStart)}`;
    this._$('ro-score').textContent = `${report.score}%`;

    const parsed = asObj(report.answers);
    const pUrls = asObj(report.photoUrls);
    const body = this._$('ro-body');
    body.innerHTML = '';
    SECTION_ORDER.forEach(section => {
      const ans = parsed[section];
      if (!ans) return;
      const cfg = SECTIONS[section];
      let html = `<div class="ro-sub">${this._noun(cfg.title)}</div>`;
      if (section === 'vehicle' && report.vehicleNumber) {
        html += `<div class="ro-item"><span>${this._noun('{Noun}')} Number</span><span style="font-weight:700">${esc(report.vehicleNumber)}</span></div>`;
      }
      cfg.checklist.forEach(item => {
        if (!(item.key in ans)) return;
        const pass = ans[item.key] === true;
        html += `<div class="ro-item"><span>${this._noun(item.label)}</span><span class="${pass ? 'ro-pass' : 'ro-fail'}">${pass ? '✓ Pass' : '✕ Fail'}</span></div>`;
      });
      const imgs = cfg.photos.map(p => pUrls[pid(section, p.key)]).filter(Boolean);
      if (imgs.length) html += `<div class="ro-gallery">${imgs.map(u => `<img src="${esc(u)}" alt="audit photo">`).join('')}</div>`;
      body.innerHTML += html;
    });
  }

  _setAnswer(section, key, pass) {
    this._answers[section][key] = pass;
    this._$(`pf-${section}-${key}-pass`).classList.toggle('sel', pass);
    this._$(`pf-${section}-${key}-fail`).classList.toggle('sel', !pass);
    this._$('valBanner').style.display = 'none';
  }

  _handlePhoto(section, slot, input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const id = pid(section, slot);
    const statusEl = this._$(`stat-${section}-${slot}`);
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

        this._$(`img-${section}-${slot}`).src = dataUrl;
        this._$(`prev-${section}-${slot}`).style.display = 'block';

        this._photoPending[id] = true;
        statusEl.textContent = 'Uploading…';
        this._updateSubmitState();
        this.dispatchEvent(new CustomEvent('upload-photo', { detail: { id, slot: `${section}-${slot}`, dataUrl }, bubbles: true, composed: true }));
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
    const [section, slot] = id.split('.');
    const s = this._$(`stat-${section}-${slot}`);
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
    btn.textContent = uploading ? 'Waiting for photos…' : (this._pending ? 'Submitting…' : 'Submit Cleanliness Audit');
  }

  _submit() {
    if (this._pending) return;
    if (isAuditLocked(new Date())) { this._showLocked(); return; }
    const vehicleNumberValue = this._user && this._user.vehicleNumber ? String(this._user.vehicleNumber) : '';

    const missing = [];
    SECTION_ORDER.forEach(section => {
      if (!this._active[section]) return;
      const cfg = SECTIONS[section];
      const sLabel = this._noun(cfg.title);
      cfg.checklist.forEach(item => { if (!(item.key in this._answers[section])) missing.push(`${sLabel}: ${this._noun(item.label)}`); });
    });
    if (missing.length) {
      const banner = this._$('valBanner');
      banner.style.display = 'block';
      banner.textContent = `Please complete: ${missing.slice(0, 3).join(' · ')}${missing.length > 3 ? ` (+${missing.length - 3} more)` : ''}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const out = {};
    const photoUrls = {};
    const sectionScores = {};
    let pass = 0, total = 0, num = 0, den = 0;
    SECTION_ORDER.forEach(section => {
      if (!this._active[section]) return;
      const cfg = SECTIONS[section];
      out[section] = {};
      let sPass = 0;
      cfg.checklist.forEach(item => {
        const v = this._answers[section][item.key] === true;
        out[section][item.key] = v;
        total++; if (v) { pass++; sPass++; }
      });
      let sPhotos = 0;
      cfg.photos.forEach(p => {
        const id = pid(section, p.key);
        if (this._photos[id]) { photoUrls[id] = this._photos[id]; sPhotos++; }
      });
      const sNum = sPass + sPhotos;
      const sDen = cfg.checklist.length + cfg.photos.length;
      sectionScores[section] = sDen ? Math.round((sNum / sDen) * 100) : 0;
      num += sNum; den += sDen;
    });
    const score = den ? Math.round((num / den) * 100) : 0;

    const today = new Date().toISOString().split('T')[0];
    const u = this._user;
    const record = {
      employeeId: u ? (u._id || '') : '',
      submitterName: u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '',
      email: u ? u.email : '',
      weekStart: getAuditWeekStart(new Date()),
      branch: u ? (u.branch || '') : '',
      hasVehicle: !!this._active.vehicle,
      hasOffice: !!this._active.office,
      vehicleNumber: this._active.vehicle ? vehicleNumberValue : '',
      answers: out,
      passCount: pass,
      totalCount: total,
      score,
      vehicleScore: this._active.vehicle ? sectionScores.vehicle : null,
      officeScore: this._active.office ? sectionScores.office : null,
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
      this._existing = r.report;
      this._$('submitView').style.display = 'none';
      this._$('submittedView').style.display = 'none';
      this._$('successView').style.display = '';
      this._$('successMsg').textContent = `Your cleanliness audit (${r.report.score}%) has been saved. See you next week!`;
    } else {
      this._updateSubmitState();
      const banner = this._$('valBanner');
      banner.style.display = 'block';
      banner.textContent = r.error || 'Could not save. Please try again.';
    }
  }
}

customElements.define('cleanliness-audit', CleanlinessAudit);
