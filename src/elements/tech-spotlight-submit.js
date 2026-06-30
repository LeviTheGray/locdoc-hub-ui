/**
 * Wix Custom Element — Tech Spotlight submission  (<tech-spotlight-submit>)
 *
 * A tech submits a spotlight from their phone: title, the problem, the solution,
 * and one or more photos. Name/Email are locked to their profile. Photos are
 * downscaled to a JPEG data URL and uploaded through the page Velo (backend
 * uploadSpotlightPhoto); submit saves the row autopilot (backend submitSpotlight).
 *
 * AUTOPILOT + SCHEDULE: there is no admin approval. The form only opens if the tech
 * is scheduled on an upcoming Weekly Agenda date (scheduledDate); otherwise it shows
 * a "not scheduled" notice. The submission presents automatically on that date.
 *
 * Data handoff (mirrors cleanliness-audit):
 *   • Velo → element :  init-data    { currentUser:{ name, email }, scheduledDate } | { error }
 *                       photo-result { id, url } | { id, error }   (correlated by id, carries _ts)
 *                       submit-result { ok:true } | { ok:false, error }   (carries _ts)
 *   • element → Velo :  'upload-photo'    { id, dataUrl }
 *                       'submit-spotlight'{ title, problem, solution, photos }
 *                       'navigate'        { key }
 *
 * Editor setup: Add → Embed Code → Custom Element → this file, tag
 * `tech-spotlight-submit`, element ID `techSpotlightSubmit`.
 */

import { TOKENS } from './tokens.js';

const STYLES = `
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  ${TOKENS}
  .header { background:var(--green); color:#fff; padding:16px 24px; }
  .header h1 { font-size:18px; font-weight:700; }
  .main { max-width:620px; margin:0 auto; padding:28px 16px 56px; }
  .sub { font-size:14px; color:var(--gray-600); margin-bottom:24px; }
  label.f { display:block; font-size:14px; font-weight:700; margin:18px 0 6px; }
  input[type=text], textarea { width:100%; padding:11px 12px; border:1.5px solid var(--gray-200);
    border-radius:8px; font-size:15px; font-family:inherit; }
  textarea { min-height:88px; resize:vertical; }
  input:focus, textarea:focus { outline:none; border-color:var(--green); }
  .photo-drop { border:1.5px dashed var(--gray-200); border-radius:10px; padding:16px; text-align:center;
    cursor:pointer; color:var(--gray-600); font-size:13px; font-weight:600; background:var(--gray-50); margin-top:6px; }
  .photo-drop:active { background:var(--gray-100); }
  .thumbs { display:flex; flex-direction:column; gap:12px; margin-top:12px; }
  .photo-row { display:flex; gap:12px; align-items:flex-start; }
  .thumb { position:relative; width:90px; height:90px; border-radius:8px; overflow:hidden; border:1px solid var(--gray-200); flex-shrink:0; }
  .thumb img { width:100%; height:100%; object-fit:cover; }
  .thumb.uploading::after { content:'…'; position:absolute; inset:0; display:flex; align-items:center;
    justify-content:center; background:rgba(255,255,255,.6); font-size:22px; }
  .thumb .rm { position:absolute; top:2px; right:2px; background:rgba(0,0,0,.6); color:#fff; border:none;
    border-radius:50%; width:20px; height:20px; cursor:pointer; font-size:12px; line-height:1; }
  .cap-input { flex:1; padding:9px 11px; border:1.5px solid var(--gray-200); border-radius:8px; font-size:14px; font-family:inherit; min-height:90px; resize:vertical; }
  .cap-input:focus { outline:none; border-color:var(--green); }
  .btn { display:block; width:100%; margin-top:26px; padding:13px 0; background:var(--green); color:#fff;
    border:none; border-radius:8px; font-size:15px; font-weight:700; cursor:pointer; }
  .btn:hover { background:var(--green-dk); }
  .btn:disabled { background:var(--gray-200); color:var(--gray-400); cursor:default; }
  .msg { margin-top:16px; padding:12px 14px; border-radius:8px; font-size:14px; display:none; }
  .msg.err { display:block; background:#fee2e2; color:#b91c1c; }
  .msg.ok  { display:block; background:#d1fae5; color:var(--green-dk); }
  .done { text-align:center; padding:48px 16px; }
  .done .check { font-size:48px; } .done h2 { font-size:20px; font-weight:800; margin-top:10px; }
  .link { background:none; border:none; color:var(--green); font-weight:600; cursor:pointer; font-size:14px; margin-top:16px; }
  .who { display:flex; flex-wrap:wrap; gap:18px; background:var(--gray-50); border:1px solid var(--gray-200);
    border-radius:10px; padding:12px 14px; margin-top:6px; }
  .who .row { display:flex; flex-direction:column; gap:2px; }
  .who .who-l { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:var(--gray-400); }
  .who .who-v { font-size:14px; font-weight:600; }
  .sched { margin-top:12px; background:#ecfdf5; border:1px solid #a7f3d0; color:var(--green-dk);
    border-radius:8px; padding:10px 12px; font-size:13px; font-weight:600; }
  .notice { text-align:center; padding:44px 18px; }
  .notice .ico { font-size:44px; } .notice h2 { font-size:19px; font-weight:800; margin-top:10px; }
  .notice p { font-size:14px; color:var(--gray-600); margin-top:10px; max-width:440px; margin-left:auto; margin-right:auto; }
`;

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

class TechSpotlightSubmit extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'photo-result', 'submit-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._user = null;
    this._photos = {};        // id → url (uploaded)
    this._pendingPhotos = {}; // id → true while uploading
    this._previews = {};      // id → dataUrl (for thumb)
    this._captions = {};      // id → caption text
    this._submitting = false;
    this._done = false;
    this._seq = 0;
    this._shell = false;
    this._loaded = false;
    this._error = null;
    this._scheduledDate = null; // ISO 'YYYY-MM-DD' or null (null → not scheduled, form blocked)
  }

  connectedCallback() {
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyInit(this.getAttribute('init-data'));
    else this._render();
  }

  attributeChangedCallback(name, _old, value) {
    if (!value) return;
    if (name === 'init-data')     this._applyInit(value);
    if (name === 'photo-result')  this._applyPhotoResult(value);
    if (name === 'submit-result') this._applySubmitResult(value);
  }

  _applyInit(json) {
    let p = {};
    try { p = JSON.parse(json) || {}; } catch (e) { /* ignore */ }
    this._user = p.currentUser || null;
    this._scheduledDate = p.scheduledDate || null;
    this._error = p.error || null;
    this._loaded = true;
    this._render();
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style>
      <header class="header"><h1>🔧 Submit a Tech Spotlight</h1></header>
      <main class="main" data-main></main>`;
    this.shadowRoot.addEventListener('click', (e) => {
      const drop = e.target.closest('[data-trigger]');
      if (drop) { const i = this._$('file'); if (i) i.click(); return; }
      const rm = e.target.closest('[data-rm]');
      if (rm) { this._removePhoto(rm.getAttribute('data-rm')); return; }
      if (e.target.closest('[data-submit]')) { this._submit(); return; }
      if (e.target.closest('[data-nav]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
    });
    this.shadowRoot.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'file') this._onFiles(e.target.files, e.target);
    });
    this.shadowRoot.addEventListener('input', (e) => {
      const id = e.target && e.target.getAttribute && e.target.getAttribute('data-cap-id');
      if (id) this._captions[id] = e.target.value;
    });
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _render() {
    const main = this.shadowRoot.querySelector('[data-main]');
    if (this._done) {
      main.innerHTML = `<div class="done"><div class="check">✅</div>
        <h2>Thanks — your spotlight is set!</h2>
        <p class="sub" style="margin-top:8px">It'll show automatically at the Wednesday meeting on your scheduled date.</p>
        <button class="link" data-nav>← Back to the Hub</button></div>`;
      return;
    }
    if (!this._loaded) { main.innerHTML = `<p class="sub">Loading…</p>`; return; }
    if (this._error) {
      main.innerHTML = `<div class="msg err" style="display:block">${esc(this._error)}</div>
        <button class="link" data-nav>← Back to the Hub</button>`;
      return;
    }
    // Not scheduled on any upcoming agenda date → block submitting.
    if (!this._scheduledDate) {
      const who = this._user && this._user.name ? esc(this._user.name) : '';
      main.innerHTML = `<div class="notice"><div class="ico">🗓️</div>
        <h2>You're not scheduled yet</h2>
        <p>Tech Spotlights run on a schedule set in the Weekly Agenda. When your manager adds you
           to an upcoming Wednesday, this form will open up for you.</p>
        ${who ? `<p style="font-size:12px;color:var(--gray-400)">We looked for an upcoming spotlight assigned to <b>${who}</b>. If that name doesn't match the Weekly Agenda exactly, ask your manager to fix it.</p>` : ''}
        <button class="link" data-nav>← Back to the Hub</button></div>`;
      return;
    }

    const name = this._user ? (this._user.name || this._user.email || '') : '';
    const email = this._user ? (this._user.email || '') : '';
    main.innerHTML = `
      <p class="sub">Share a job you're proud of. Add photos and explain the problem and how you solved it — you'll walk the team through it on Wednesday.</p>
      <div class="who">
        <div class="row"><span class="who-l">Name</span><span class="who-v">${esc(name)}</span></div>
        <div class="row"><span class="who-l">Email</span><span class="who-v">${esc(email)}</span></div>
      </div>
      <div class="sched">🗓️ You're scheduled to present on <b>${esc(this._fmtSchedDate())}</b>.</div>
      <label class="f">Title</label>
      <input type="text" id="title" placeholder="e.g. Seized deadbolt on a historic mortise lock">
      <label class="f">The problem</label>
      <textarea id="problem" placeholder="What was the situation / what was wrong?"></textarea>
      <label class="f">The solution</label>
      <textarea id="solution" placeholder="How did you fix it?"></textarea>
      <label class="f">Photos <span style="font-weight:400;color:var(--gray-400)">(add a short description under each — shown beneath the photo)</span></label>
      <div class="photo-drop" data-trigger>📷 Tap to take or add photos</div>
      <input type="file" id="file" accept="image/*" multiple style="display:none">
      <div class="thumbs" data-thumbs></div>
      <div class="msg" data-msg></div>
      <button class="btn" data-submit>Submit Spotlight</button>`;
    this._renderThumbs();
    this._syncSubmit();
  }

  _fmtSchedDate() {
    const d = new Date((this._scheduledDate || '') + 'T00:00:00');
    return isNaN(d) ? (this._scheduledDate || '') : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  _renderThumbs() {
    const wrap = this.shadowRoot.querySelector('[data-thumbs]');
    if (!wrap) return;
    wrap.innerHTML = Object.keys(this._previews).map(id => `
      <div class="photo-row">
        <div class="thumb ${this._pendingPhotos[id] ? 'uploading' : ''}">
          <img src="${esc(this._previews[id])}" alt="photo">
          <button class="rm" data-rm="${id}" title="Remove">✕</button>
        </div>
        <textarea class="cap-input" data-cap-id="${id}" placeholder="Describe this photo…">${esc(this._captions[id] || '')}</textarea>
      </div>`).join('');
  }

  _onFiles(files, input) {
    Array.from(files || []).forEach(file => this._addPhoto(file));
    if (input) input.value = '';
  }

  _addPhoto(file) {
    if (!file || !/^image\//.test(file.type)) return;
    const id = `p${++this._seq}`;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        let { width, height } = img;
        if (width > max || height > max) {
          if (width >= height) { height = Math.round(height * max / width); width = max; }
          else { width = Math.round(width * max / height); height = max; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        this._previews[id] = dataUrl;
        this._pendingPhotos[id] = true;
        this._renderThumbs();
        this._syncSubmit();
        this.dispatchEvent(new CustomEvent('upload-photo', { detail: { id, dataUrl }, bubbles: true, composed: true }));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  _removePhoto(id) {
    delete this._previews[id]; delete this._photos[id]; delete this._pendingPhotos[id]; delete this._captions[id];
    this._renderThumbs(); this._syncSubmit();
  }

  _applyPhotoResult(json) {
    let r = {}; try { r = JSON.parse(json) || {}; } catch (e) { return; }
    if (!r.id) return;
    this._pendingPhotos[r.id] = false;
    if (r.url) this._photos[r.id] = r.url;
    else { this._removePhoto(r.id); this._showMsg('A photo failed to upload — please try again.', 'err'); }
    this._renderThumbs(); this._syncSubmit();
  }

  _showMsg(text, kind) {
    const m = this.shadowRoot.querySelector('[data-msg]');
    if (m) { m.textContent = text; m.className = `msg ${kind}`; }
  }

  _syncSubmit() {
    const btn = this.shadowRoot.querySelector('[data-submit]');
    if (!btn) return;
    const uploading = Object.values(this._pendingPhotos).some(Boolean);
    btn.disabled = uploading || this._submitting;
    btn.textContent = uploading ? 'Waiting for photos…' : (this._submitting ? 'Submitting…' : 'Submit Spotlight');
  }

  _submit() {
    if (this._submitting) return;
    const v = (id) => (this._$(id) ? this._$(id).value.trim() : '');
    const title = v('title'), problem = v('problem'), solution = v('solution');
    if (!title || !problem || !solution) { this._showMsg('Please fill in the title, problem and solution.', 'err'); return; }
    if (Object.values(this._pendingPhotos).some(Boolean)) { this._showMsg('Please wait for photos to finish uploading.', 'err'); return; }
    this._submitting = true; this._syncSubmit();
    const photos = Object.keys(this._photos).filter(id => this._photos[id])
      .map(id => ({ url: this._photos[id], caption: (this._captions[id] || '').trim() }));
    // Name/email are locked to the profile and re-derived server-side, so they're not sent.
    this.dispatchEvent(new CustomEvent('submit-spotlight',
      { detail: { title, problem, solution, photos }, bubbles: true, composed: true }));
  }

  _applySubmitResult(json) {
    let r = {}; try { r = JSON.parse(json) || {}; } catch (e) { return; }
    this._submitting = false;
    if (r.ok) { this._done = true; this._render(); }
    else { this._showMsg(r.error || 'Submit failed — please try again.', 'err'); this._syncSubmit(); }
  }
}

customElements.define('tech-spotlight-submit', TechSpotlightSubmit);
