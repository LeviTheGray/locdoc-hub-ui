/**
 * Wix Custom Element — Driver Scorecard Upload  (<driver-scorecard-upload>)
 *
 * WHY THIS EXISTS (per Levi, 2026-09-16): the automated path (n8n polling a watched Google Drive
 * folder, downloading the newest PDF, extracting with Claude) was duplicating a step someone
 * already does by hand every week — downloading the Geotab PDF, then re-uploading it to Drive
 * just so n8n could pull it back down. That extra hop is also where the automation kept failing
 * ("Google's side"). This lets that same person skip Drive entirely: pick the PDF here, and the
 * exact same extraction/validation/matching pipeline (ported to backend/driverScorecardUpload.web.js
 * from driver-scorecard-n8n.json — not reinvented) runs directly, writing the same DriverScores
 * rows the automated path would have. Both paths can coexist; whichever runs for a given week last
 * simply replaces that week's rows, same replace-semantics the n8n workflow already used.
 *
 * The PDF never touches Wix Media — read client-side via FileReader as a data URL, the base64
 * payload is sent straight to the backend, matching exactly what n8n's own "To Base64" step did.
 *
 * Data handoff:
 *   • Velo → element :  init-data      { canUpload } | { error }
 *                       upload-result  { ok:true, weekStart, weekLabel, count, parkedCount } |
 *                                      { ok:false, error }                          (carries _ts)
 *   • element → Velo :  'upload-pdf'  { pdfBase64 }
 *                       'navigate'    { key: 'hub' | 'wednesdayMeeting' }  — the latter is a
 *                       "View this week's scores →" link to /wednesday-meeting's Driver
 *                       Scorecard tab (added 2026-09-18, per Levi).
 *
 * The backend re-checks manager status on every call — `canUpload` here only decides what UI to
 * paint.
 *
 * Editor setup: Add → Embed Code → Custom Element → this file, tag `driver-scorecard-upload`,
 * element ID `driverScorecardUpload`.
 */

import { styles, ensureMaterialSymbols } from './tokens.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STYLES = styles(`
  .main { max-width: 640px; margin: 0 auto; padding: 24px 16px 56px; }
  .sub { font-size: 14px; color: var(--gray-600); margin-bottom: 20px; }
  .section { margin-top: 24px; }
  .drop { border: 2px dashed var(--gray-200); border-radius: 12px; padding: 28px 20px; text-align: center; }
  .drop input[type=file] { margin-top: 10px; }
  .filename { margin-top: 10px; font-size: 13px; font-weight: 700; color: var(--gray-700); }
  .msg { margin-top: 16px; padding: 12px 14px; border-radius: 8px; font-size: 14px; display: none; white-space: pre-wrap; }
  .msg.err { display: block; background: #fee2e2; color: #b91c1c; }
  .msg.ok  { display: block; background: #d1fae5; color: var(--primary-dk); }
  .link { background: none; border: none; color: var(--primary-dk); font-weight: 700; font-size: 14px; cursor: pointer; margin-top: 20px; }
  .btn:disabled { background: var(--gray-200); color: var(--gray-400); cursor: default; }
`);

class DriverScorecardUpload extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'upload-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._canUpload = false;
    this._loaded = false;
    this._error = null;
    this._fileName = '';
    this._pdfBase64 = '';
    this._uploading = false;
    this._msg = null;
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
    if (name === 'init-data') this._applyInit(value);
    if (name === 'upload-result') this._applyUpload(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _applyInit(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._canUpload = Boolean(p.canUpload);
    this._error = p.error || null;
    this._loaded = true;
    this._render();
  }

  _applyUpload(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._uploading = false;
    if (p.ok) {
      const parkedNote = p.parkedCount ? ` (${p.parkedCount} parked)` : '';
      this._msg = { ok: true, text: `Loaded ${p.count} driver(s) for ${p.weekLabel}${parkedNote}.` };
      this._fileName = '';
      this._pdfBase64 = '';
    } else {
      this._msg = { ok: false, text: p.error || 'Upload failed.' };
    }
    this._render();
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <header class="header"><h1>📊 Driver Scorecard Upload</h1>
        <p>Upload this week's Geotab PDF directly — no need to also drop it in the Drive folder.</p></header>
      <main class="main" data-main></main>`;

    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.closest('[data-upload]')) return this._upload();
      const navBtn = e.target.closest('[data-nav]');
      if (navBtn) {
        const key = navBtn.getAttribute('data-nav') || 'hub';
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key }, bubbles: true, composed: true }));
      }
    });
    this.shadowRoot.addEventListener('change', (e) => {
      if (e.target.getAttribute && e.target.getAttribute('data-file') != null) this._onFile(e.target.files && e.target.files[0]);
    });
  }

  _onFile(file) {
    this._msg = null;
    if (!file) { this._fileName = ''; this._pdfBase64 = ''; return this._render(); }
    if (file.type !== 'application/pdf') {
      this._msg = { ok: false, text: 'Please choose a PDF file.' };
      this._fileName = ''; this._pdfBase64 = '';
      return this._render();
    }
    this._fileName = file.name;
    this._render();
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result is a data: URL ("data:application/pdf;base64,....") — the backend strips
      // the prefix itself, but stripping here too keeps this element's own state clean.
      const result = String(reader.result || '');
      this._pdfBase64 = result.replace(/^data:application\/pdf;base64,/, '');
      this._render();
    };
    reader.onerror = () => {
      this._msg = { ok: false, text: 'Could not read that file — try again.' };
      this._fileName = ''; this._pdfBase64 = '';
      this._render();
    };
    reader.readAsDataURL(file);
  }

  _upload() {
    if (this._uploading || !this._pdfBase64) return;
    this._uploading = true;
    this._msg = null;
    this._render();
    this.dispatchEvent(new CustomEvent('upload-pdf', { detail: { pdfBase64: this._pdfBase64 }, bubbles: true, composed: true }));
  }

  _render() {
    // Guard against attributeChangedCallback firing before connectedCallback (a real crash hit
    // 2026-09-22 — "Cannot set properties of null" — Wix can set init-data on the element before
    // it's connected to the DOM, so _renderShell() may not have run yet).
    this._renderShell();
    const main = this.shadowRoot.querySelector('[data-main]');
    if (!this._loaded) { main.innerHTML = `<p class="sub">Loading…</p>`; return; }
    if (this._error) {
      main.innerHTML = `<div class="msg err">${esc(this._error)}</div>
        <button class="link" data-nav>← Back to the Hub</button>`;
      return;
    }
    if (!this._canUpload) {
      main.innerHTML = `<div class="msg err">You're not authorized to upload the driver scorecard. This is available to managers.</div>
        <button class="link" data-nav>← Back to the Hub</button>`;
      return;
    }
    const ready = !!this._pdfBase64 && !this._uploading;
    main.innerHTML = `
      ${this._msg ? `<div class="msg ${this._msg.ok ? 'ok' : 'err'}">${esc(this._msg.text)}</div>` : ''}
      <button class="link" data-nav="wednesdayMeeting" style="margin-top:0">View this week's scores on Wednesday Meeting →</button>
      <div class="section card" style="padding:18px 20px">
        <h2>This week's PDF</h2>
        <div class="drop">
          <div>Choose the Geotab "Driver Safety Scorecard (Expanded)" PDF — the same one you'd normally save each week.</div>
          <input type="file" accept="application/pdf" data-file>
          ${this._fileName ? `<div class="filename">${esc(this._fileName)}</div>` : ''}
        </div>
        <button class="btn ${this._uploading ? 'is-loading' : ''}" data-upload ${ready ? '' : 'disabled'} style="margin-top:16px">
          ${this._uploading ? '<span class="btn-spinner"></span>Reading & scoring…' : 'Load scores from this PDF'}</button>
      </div>
      <button class="link" data-nav>← Back to the Hub</button>`;
  }
}

customElements.define('driver-scorecard-upload', DriverScorecardUpload);
