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
 *   • Velo → element :  init-data    { currentUser:{ name, email }, scheduledDate,
 *                                     admin, techs:[{ name, email }] } | { error }
 *
 * ADMIN OVERRIDE: when init-data says `admin`, the form can be switched to file a spotlight FOR
 * another tech on ANY date, bypassing the schedule gate — the escape hatch for a tech who was
 * never put on an agenda, or whose agenda name doesn't match their Employees record. It dispatches
 * 'submit-spotlight-for' instead of 'submit-spotlight'. Showing the panel is only a UI affordance;
 * techSpotlight.web.js re-checks admin on the server, so faking `admin` here buys nothing.
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
  .header { background:var(--primary); color:#fff; padding:16px 24px; }
  .header h1 { font-size:18px; font-weight:700; }
  .main { max-width:620px; margin:0 auto; padding:28px 16px 56px; }
  .sub { font-size:14px; color:var(--gray-600); margin-bottom:24px; }
  label.f { display:block; font-size:14px; font-weight:700; margin:18px 0 6px; }
  input[type=text], textarea { width:100%; padding:11px 12px; border:1.5px solid var(--gray-200);
    border-radius:8px; font-size:15px; font-family:inherit; }
  textarea { min-height:88px; resize:vertical; }
  input:focus, textarea:focus { outline:none; border-color:var(--primary); }
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
  .cap-input:focus { outline:none; border-color:var(--primary); }
  .btn { display:block; width:100%; margin-top:26px; padding:13px 0; background:var(--primary); color:#fff;
    border:none; border-radius:8px; font-size:15px; font-weight:700; cursor:pointer; }
  .btn:hover { background:var(--primary-dk); }
  .btn:disabled { background:var(--gray-200); color:var(--gray-400); cursor:default; }
  .msg { margin-top:16px; padding:12px 14px; border-radius:8px; font-size:14px; display:none; }
  .msg.err { display:block; background:#fee2e2; color:#b91c1c; }
  .msg.ok  { display:block; background:#d1fae5; color:var(--primary-dk); }
  .done { text-align:center; padding:48px 16px; }
  .done .check { font-size:48px; } .done h2 { font-size:20px; font-weight:800; margin-top:10px; }
  .link { background:none; border:none; color:var(--primary); font-weight:600; cursor:pointer; font-size:14px; margin-top:16px; }
  .who { display:flex; flex-wrap:wrap; gap:18px; background:var(--gray-50); border:1px solid var(--gray-200);
    border-radius:10px; padding:12px 14px; margin-top:6px; }
  .who .row { display:flex; flex-direction:column; gap:2px; }
  .who .who-l { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:var(--gray-400); }
  .who .who-v { font-size:14px; font-weight:600; }
  .sched { margin-top:12px; background:#ecfdf5; border:1px solid #a7f3d0; color:var(--primary-dk);
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
    this._order = [];         // photo ids in the order they were PICKED (not upload order)
    this._uploadWaiters = {}; // id → resolve fn, so uploads run one at a time
    this._queued = 0;         // photos still waiting their turn in the upload queue
    this._submitting = false;
    this._done = false;
    this._seq = 0;
    this._shell = false;
    this._loaded = false;
    this._error = null;
    this._scheduledDate = null; // ISO 'YYYY-MM-DD' or null (null → not scheduled, form blocked)
    // Admin override: file a spotlight FOR a tech on ANY date, bypassing the schedule gate.
    this._admin = false;        // from init-data; re-checked server-side on submit
    this._techs = [];           // [{ name, email }] roster for the picker
    this._override = false;     // is the override form active?
    this._forTech = '';         // picked tech's email
    this._forDate = '';         // picked ISO date
    this._draft = {};           // title/problem/solution kept across re-renders
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
    this._admin = Boolean(p.admin);
    this._techs = Array.isArray(p.techs) ? p.techs : [];
    this._error = p.error || null;
    this._loaded = true;
    // An admin who isn't scheduled has nothing to do here EXCEPT override, so open it for them
    // rather than showing the "you're not scheduled" dead end.
    if (this._admin && !this._scheduledDate) this._override = true;
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
      const tog = e.target.closest('[data-override-toggle]');
      if (tog) { this._saveDraft(); this._override = !this._override; this._render(); return; }
      if (e.target.closest('[data-nav]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
      }
    });
    this.shadowRoot.addEventListener('change', (e) => {
      if (!e.target) return;
      if (e.target.id === 'file') { this._onFiles(e.target.files, e.target); return; }
      // Keep the override picks in state — _render() rebuilds the form and would drop them.
      if (e.target.id === 'for-tech') { this._forTech = e.target.value; this._syncSubmit(); return; }
      if (e.target.id === 'for-date') { this._forDate = e.target.value; this._syncSubmit(); }
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
      const forTech = this._override
        && (this._techs.find(t => t.email === this._forTech) || {}).name;
      main.innerHTML = `<div class="done"><div class="check">✅</div>
        <h2>${forTech ? `Spotlight filed for ${esc(forTech)}` : 'Thanks — your spotlight is set!'}</h2>
        <p class="sub" style="margin-top:8px">It'll show automatically at the Wednesday meeting on
          ${forTech ? 'the date you picked' : 'your scheduled date'}.</p>
        <button class="link" data-nav>← Back to the Hub</button></div>`;
      return;
    }
    if (!this._loaded) { main.innerHTML = `<p class="sub">Loading…</p>`; return; }
    if (this._error) {
      main.innerHTML = `<div class="msg err" style="display:block">${esc(this._error)}</div>
        <button class="link" data-nav>← Back to the Hub</button>`;
      return;
    }
    // Not scheduled on any upcoming agenda date → block submitting. Admins are exempt: they get
    // the override instead of a dead end (that's the whole point of it).
    if (!this._scheduledDate && !this._override) {
      const who = this._user && this._user.name ? esc(this._user.name) : '';
      main.innerHTML = `<div class="notice"><div class="ico">🗓️</div>
        <h2>You're not scheduled yet</h2>
        <p>Tech Spotlights run on a schedule set in the Weekly Agenda. When your manager adds you
           to an upcoming Wednesday, this form will open up for you.</p>
        ${who ? `<p style="font-size:12px;color:var(--gray-400)">We looked for an upcoming spotlight assigned to <b>${who}</b>. If that name doesn't match the Weekly Agenda exactly, ask your manager to fix it.</p>` : ''}
        ${this._admin ? `<button class="link" data-override-toggle>Submit for a technician (admin) →</button>` : ''}
        <button class="link" data-nav>← Back to the Hub</button></div>`;
      return;
    }

    const name = this._user ? (this._user.name || this._user.email || '') : '';
    const email = this._user ? (this._user.email || '') : '';
    const d = this._draft;
    main.innerHTML = `
      <p class="sub">Share a job you're proud of. Add photos and explain the problem and how you solved it — you'll walk the team through it on Wednesday.</p>
      ${this._override ? this._overridePanel() : `
      <div class="who">
        <div class="row"><span class="who-l">Name</span><span class="who-v">${esc(name)}</span></div>
        <div class="row"><span class="who-l">Email</span><span class="who-v">${esc(email)}</span></div>
      </div>
      <div class="sched">🗓️ You're scheduled to present on <b>${esc(this._fmtSchedDate())}</b>.</div>
      ${this._admin ? `<button class="link" data-override-toggle>Submit for someone else instead (admin) →</button>` : ''}`}
      <label class="f">Title</label>
      <input type="text" id="title" placeholder="e.g. Seized deadbolt on a historic mortise lock" value="${esc(d.title || '')}">
      <label class="f">The problem</label>
      <textarea id="problem" placeholder="What was the situation / what was wrong?">${esc(d.problem || '')}</textarea>
      <label class="f">The solution</label>
      <textarea id="solution" placeholder="How did you fix it?">${esc(d.solution || '')}</textarea>
      <label class="f">Photos <span style="font-weight:400;color:var(--gray-400)">(add a short description under each — shown beneath the photo)</span></label>
      <div class="photo-drop" data-trigger>📷 Tap to take or add photos</div>
      <input type="file" id="file" accept="image/*" multiple style="display:none">
      <div class="thumbs" data-thumbs></div>
      <div class="msg" data-msg></div>
      <button class="btn" data-submit>Submit Spotlight</button>`;
    this._renderThumbs();
    this._syncSubmit();
  }

  // Admin-only: pick who the spotlight is for and which date it presents on. The date is free —
  // it does NOT have to exist on an agenda — so this covers a tech who was never scheduled, or
  // whose agenda name doesn't match their Employees record.
  _overridePanel() {
    const opts = this._techs.map(t =>
      `<option value="${esc(t.email)}" ${t.email === this._forTech ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    return `
      <div class="who">
        <div class="row" style="margin-bottom:8px"><span class="who-l">Admin override</span>
          <span class="who-v">Filing on behalf of a tech</span></div>
        <label class="f">Technician</label>
        <select id="for-tech"><option value="">Select a technician…</option>${opts}</select>
        <label class="f">Presents on</label>
        <input type="date" id="for-date" value="${esc(this._forDate)}">
        <p style="font-size:12px;color:var(--gray-400);margin-top:8px">
          Any date works — it doesn't need to be on the Weekly Agenda. A past date will save but
          won't appear in the Wednesday deck, which only shows today and upcoming.</p>
      </div>
      ${this._scheduledDate ? `<button class="link" data-override-toggle>← Back to my own spotlight</button>` : ''}`;
  }

  // _render() rebuilds the form, so stash what's typed before toggling the override on/off.
  _saveDraft() {
    const v = (id) => (this._$(id) ? this._$(id).value : '');
    this._draft = { title: v('title'), problem: v('problem'), solution: v('solution') };
  }

  _fmtSchedDate() {
    const d = new Date((this._scheduledDate || '') + 'T00:00:00');
    return isNaN(d) ? (this._scheduledDate || '') : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  _renderThumbs() {
    const wrap = this.shadowRoot.querySelector('[data-thumbs]');
    if (!wrap) return;
    wrap.innerHTML = this._order.filter(id => this._previews[id]).map(id => `
      <div class="photo-row">
        <div class="thumb ${this._pendingPhotos[id] ? 'uploading' : ''}">
          <img src="${esc(this._previews[id])}" alt="photo">
          <button class="rm" data-rm="${id}" title="Remove">✕</button>
        </div>
        <textarea class="cap-input" data-cap-id="${id}" placeholder="Describe this photo…">${esc(this._captions[id] || '')}</textarea>
      </div>`).join('');
  }

  // Photos upload ONE AT A TIME. Selecting several at once used to fire a resize + upload for
  // every file simultaneously, which on a phone connection meant several multi-MB data URLs in
  // flight together — the reported hangs and "failed to upload" errors. Serialising also fixes
  // the ordering: uploads finished out of order, and the photo list was built from whichever
  // came back first, so the captions ended up against the wrong pictures.
  async _onFiles(files, input) {
    const picked = Array.from(files || []);
    if (input) input.value = ''; // let the same file be re-picked after a failure
    this._queued += picked.length;
    for (const file of picked) {
      await this._addPhoto(file);   // eslint-disable-line no-await-in-loop -- serial on purpose
      this._queued--;
      this._syncSubmit();
    }
    this._queued = 0;
    this._syncSubmit();
  }

  // Resolves once the upload for this file has come back (or failed) — that's what makes the
  // queue in _onFiles serial. The Velo bridge answers asynchronously via the photo-result
  // attribute, so the resolver is parked in _uploadWaiters until _applyPhotoResult sees the id.
  _addPhoto(file) {
    if (!file || !/^image\//.test(file.type)) return Promise.resolve();
    const id = `p${++this._seq}`;
    this._order.push(id); // pick order — the ONLY thing that decides the final photo order
    return new Promise((resolve) => {
      const done = () => resolve();
      const reader = new FileReader();
      reader.onerror = () => { this._showMsg('Could not read that photo — please try again.', 'err'); this._dropOrder(id); done(); };
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => { this._showMsg('That file is not a readable image.', 'err'); this._dropOrder(id); done(); };
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
          this._uploadWaiters[id] = done;
          this._renderThumbs();
          this._syncSubmit();
          this.dispatchEvent(new CustomEvent('upload-photo', { detail: { id, dataUrl }, bubbles: true, composed: true }));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  _dropOrder(id) { this._order = this._order.filter(x => x !== id); }

  _removePhoto(id) {
    delete this._previews[id]; delete this._photos[id]; delete this._pendingPhotos[id]; delete this._captions[id];
    this._dropOrder(id);
    this._renderThumbs(); this._syncSubmit();
  }

  _applyPhotoResult(json) {
    let r = {}; try { r = JSON.parse(json) || {}; } catch (e) { return; }
    if (!r.id) return;
    this._pendingPhotos[r.id] = false;
    if (r.url) this._photos[r.id] = r.url;
    else { this._removePhoto(r.id); this._showMsg('A photo failed to upload — please try again.', 'err'); }
    // Release the queue so the next photo starts, whether this one succeeded or not.
    const waiter = this._uploadWaiters[r.id];
    if (waiter) { delete this._uploadWaiters[r.id]; waiter(); }
    this._renderThumbs(); this._syncSubmit();
  }

  _showMsg(text, kind) {
    const m = this.shadowRoot.querySelector('[data-msg]');
    if (m) { m.textContent = text; m.className = `msg ${kind}`; }
  }

  _syncSubmit() {
    const btn = this.shadowRoot.querySelector('[data-submit]');
    if (!btn) return;
    const uploading = Object.values(this._pendingPhotos).some(Boolean) || this._queued > 0;
    const needsPick = this._override && !(this._forTech && this._forDate);
    btn.disabled = uploading || this._submitting || needsPick;
    // Photos upload one at a time, so say how many are left — otherwise a batch of five looks
    // like the form has hung, which is what techs were reporting.
    const left = this._queued > 0 ? this._queued : Object.values(this._pendingPhotos).filter(Boolean).length;
    btn.textContent = uploading ? `Uploading photos… (${left} left)`
      : this._submitting ? 'Submitting…'
      : needsPick ? 'Pick a technician and date'
      : this._override ? 'Submit for this technician'
      : 'Submit Spotlight';
  }

  _submit() {
    if (this._submitting) return;
    const v = (id) => (this._$(id) ? this._$(id).value.trim() : '');
    const title = v('title'), problem = v('problem'), solution = v('solution');
    if (!title || !problem || !solution) { this._showMsg('Please fill in the title, problem and solution.', 'err'); return; }
    if (this._override && !(this._forTech && this._forDate)) {
      this._showMsg('Pick the technician and the date this spotlight presents on.', 'err'); return;
    }
    if (Object.values(this._pendingPhotos).some(Boolean)) { this._showMsg('Please wait for photos to finish uploading.', 'err'); return; }
    this._submitting = true; this._syncSubmit();
    // Pick order, not upload-completion order — this is what keeps captions on the right photos.
    const photos = this._order.filter(id => this._photos[id])
      .map(id => ({ url: this._photos[id], caption: (this._captions[id] || '').trim() }));

    // Override → 'submit-spotlight-for' with an explicit tech + date (admin-gated server-side).
    // Otherwise name/email are locked to the profile and re-derived server-side, so aren't sent.
    if (this._override) {
      this.dispatchEvent(new CustomEvent('submit-spotlight-for', {
        detail: { title, problem, solution, photos, techEmail: this._forTech, spotlightDate: this._forDate },
        bubbles: true, composed: true,
      }));
      return;
    }
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
