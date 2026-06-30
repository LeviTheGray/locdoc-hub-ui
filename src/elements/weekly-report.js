/**
 * Wix Custom Element — Weekly Report  (<weekly-report>)
 *
 * Port of the htmlWeeklyReport HtmlComponent. Submit-only page: shows this week's
 * submission (read-only) or the form. See CUSTOM-ELEMENTS.md for the recipe.
 *
 * Data handoff:
 *   • Velo → element :  init-data      { currentUser, existingReport } | { error }
 *                       submit-result  { ok:true, report } | { ok:false, error }
 *   • element → Velo :  'submit-report' { detail: record }
 *                       'navigate'      { detail: { key:'hub' } }
 *
 * Editor: Add → Embed Code → Custom Element → source = this file,
 * tag name `weekly-report`, element ID `weeklyReport`.
 */

import { TOKENS } from './tokens.js';

const scaleInfo = {
  stress: {
    1: { label: '1 — Very Low', cls: 'sc5' }, 2: { label: '2 — Low', cls: 'sc4' },
    3: { label: '3 — Moderate', cls: 'sc3' }, 4: { label: '4 — High', cls: 'sc2' },
    5: { label: '5 — Very High', cls: 'sc1' },
  },
  morale: {
    1: { label: '1 — Very Low', cls: 'sc1' }, 2: { label: '2 — Low', cls: 'sc2' },
    3: { label: '3 — Moderate', cls: 'sc3' }, 4: { label: '4 — Good', cls: 'sc4' },
    5: { label: '5 — Great', cls: 'sc5' },
  },
  workload: {
    1: { label: '1 — Very Light', cls: 'sc5' }, 2: { label: '2 — Light', cls: 'sc4' },
    3: { label: '3 — Moderate', cls: 'sc3' }, 4: { label: '4 — Heavy', cls: 'sc2' },
    5: { label: '5 — Very Heavy', cls: 'sc1' },
  },
};

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}
function formatWeekRange(mondayISO) {
  const start = new Date(mondayISO + 'T00:00:00');
  const end = new Date(start); end.setDate(end.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}
function scaleLabel(key, val) {
  return scaleInfo[key] && scaleInfo[key][val] ? scaleInfo[key][val].label : String(val);
}

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ${TOKENS}
  :host { --red:#ef4444; background:var(--gray-50); }
  .backbtn { display:inline-flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; color:#6b7280; font:600 13px system-ui,-apple-system,sans-serif; padding:12px 16px 0; }
  .header { background: var(--green); color: #fff; padding: 16px 24px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p  { font-size: 12px; opacity: .75; margin-top: 2px; }
  .main { max-width: 720px; margin: 0 auto; padding: 28px 16px; }
  .loading-state { text-align: center; padding: 64px 0; color: var(--gray-400); font-size: 15px; }
  .form-card { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 28px; box-shadow: var(--shadow); }
  .card-title { font-size: 16px; font-weight: 700; padding-bottom: 14px; border-bottom: 1px solid var(--gray-200); margin-bottom: 24px; }
  .card-title span { display: block; font-size: 12px; font-weight: 400; color: var(--gray-400); margin-top: 3px; }
  .scale-field { margin-bottom: 28px; }
  .scale-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
  .scale-label { font-size: 14px; font-weight: 700; }
  .scale-desc  { font-size: 12px; color: var(--gray-400); margin-top: 2px; }
  .score-chip { font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 100px; white-space: nowrap; flex-shrink: 0; transition: background .2s, color .2s; }
  .sc1 { background: #fee2e2; color: #991b1b; } .sc2 { background: #fef9c3; color: #78350f; } .sc3 { background: #dbeafe; color: #1e3a8a; } .sc4 { background: #dcfce7; color: #14532d; } .sc5 { background: #d1fae5; color: #064e3b; }
  .seg { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .seg-btn { -webkit-appearance: none; appearance: none; font-family: inherit; border: 1.5px solid var(--gray-200); background: #fff; border-radius: 10px; padding: 12px 4px; min-height: 48px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: border-color .12s, background .12s, transform .08s, color .12s; -webkit-tap-highlight-color: transparent; }
  .seg-btn:active { transform: scale(.95); }
  .seg-num { font-size: 17px; font-weight: 800; color: var(--gray-600); }
  .seg-btn.sel { border-width: 2px; border-color: currentColor; }
  .seg-btn.sel .seg-num { color: inherit; }
  .text-field { margin-bottom: 24px; }
  .text-field label { display: block; font-size: 14px; font-weight: 700; margin-bottom: 8px; }
  .text-field .opt { font-size: 12px; font-weight: 400; color: var(--gray-400); }
  .text-field textarea { width: 100%; border: 1px solid var(--gray-200); border-radius: 8px; padding: 10px 12px; font-size: 14px; font-family: inherit; resize: vertical; min-height: 80px; }
  .text-field textarea:focus { outline: 2px solid var(--green); outline-offset: -1px; }
  .text-field textarea.error { border-color: var(--red); box-shadow: 0 0 0 3px rgba(239,68,68,.15); }
  .divider { border: none; border-top: 1px solid var(--gray-200); margin: 24px 0; }
  .val-banner { display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px 16px; font-size: 13px; font-weight: 600; color: #b91c1c; margin-bottom: 20px; }
  .form-actions { display: flex; gap: 12px; padding-top: 24px; border-top: 1px solid var(--gray-200); margin-top: 8px; }
  .btn-primary { flex: 1; padding: 12px 20px; background: var(--green); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background .15s, transform .1s; }
  .btn-primary:hover { background: var(--green-dk); transform: translateY(-1px); }
  .btn-primary:active { transform: scale(.98); }
  .btn-primary:disabled { background: var(--gray-200); color: var(--gray-400); cursor: default; transform: none; }
  .submitted-banner { background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; }
  .submitted-banner .check { width: 36px; height: 36px; border-radius: 50%; background: #059669; color: #fff; font-size: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .submitted-banner .msg { font-size: 14px; font-weight: 600; color: #065f46; }
  .submitted-banner .sub { font-size: 12px; color: #047857; margin-top: 2px; }
  .readonly-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .readonly-cell { background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px; padding: 14px; }
  .readonly-cell .rc-label { font-size: 11px; font-weight: 600; color: var(--gray-400); margin-bottom: 6px; }
  .readonly-cell .rc-value { font-size: 15px; font-weight: 700; }
  .readonly-text { background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: 8px; padding: 14px; margin-bottom: 12px; }
  .readonly-text .rt-label { font-size: 11px; font-weight: 600; color: var(--gray-400); margin-bottom: 6px; }
  .readonly-text .rt-value { font-size: 14px; color: var(--gray-900); line-height: 1.5; }
  .readonly-text .rt-empty { font-size: 14px; color: var(--gray-400); font-style: italic; }
  .success-card { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 56px 40px; text-align: center; box-shadow: var(--shadow); }
  .success-icon { width: 72px; height: 72px; border-radius: 50%; background: #d1fae5; color: #059669; font-size: 34px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
  .success-card h2 { font-size: 24px; font-weight: 700; }
  .success-card p  { font-size: 14px; color: var(--gray-600); margin-top: 8px; }
  @media (max-width: 600px) {
    .main { padding: 16px 12px; }
    .form-card { padding: 20px 16px; }
    .readonly-grid { grid-template-columns: 1fr 1fr; }
    .success-card { padding: 40px 24px; }
    .text-field textarea { font-size: 16px; }
  }
`;

class WeeklyReport extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'submit-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._user = null;
    this._existing = null;
    this._pending = false;
    this._scaleVals = { stress: 3, morale: 3, workload: 3 };
  }

  connectedCallback() {
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyInit(this.getAttribute('init-data'));
  }

  attributeChangedCallback(name, _old, value) {
    if (!value) return;
    if (name === 'init-data') this._applyInit(value);
    if (name === 'submit-result') this._applySubmitResult(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _applyInit(json) {
    let p;
    try { p = JSON.parse(json); } catch (e) { p = { error: 'Failed to load.' }; }
    if (p.error) { this._$('loadingState').innerHTML = `<span style="color:#b91c1c">${p.error}</span>`; return; }
    this._user = p.currentUser || null;
    this._existing = p.existingReport || null;
    this._renderPage();
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
      this._$('successMsg').textContent = 'Your weekly report has been saved. See you next week!';
    } else {
      const btn = this._$('submitBtn');
      btn.disabled = false; btn.textContent = 'Submit Weekly Report';
      const banner = this._$('valBanner');
      banner.style.display = 'block';
      banner.textContent = r.error || 'Could not save. Please try again.';
    }
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    const seg = (key) => [1, 2, 3, 4, 5].map(n =>
      `<button type="button" class="seg-btn" data-scale="${key}" data-val="${n}"><span class="seg-num">${n}</span></button>`).join('');
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <button class="backbtn" data-action="back-hub">&#8592; Back to Employee Hub</button>
      <header class="header"><h1>Weekly Report</h1><p>LocDoc · Employee Hub</p></header>
      <main class="main">
        <div id="loadingState" class="loading-state">Loading…</div>
        <div id="viewMine" style="display:none">
          <div id="submittedView" style="display:none">
            <div class="submitted-banner"><div class="check">&#10003;</div>
              <div><div class="msg">Report submitted for this week</div><div class="sub" id="submittedSubtext"></div></div>
            </div>
            <div class="form-card">
              <div class="card-title">Your Submission <span id="submittedWeekLabel"></span></div>
              <div class="readonly-grid">
                <div class="readonly-cell"><div class="rc-label">Stress</div><div class="rc-value" id="ro-stress"></div></div>
                <div class="readonly-cell"><div class="rc-label">Morale</div><div class="rc-value" id="ro-morale"></div></div>
                <div class="readonly-cell"><div class="rc-label">Workload</div><div class="rc-value" id="ro-workload"></div></div>
              </div>
              <div class="readonly-text"><div class="rt-label">Week High</div><div id="ro-high" class="rt-value"></div></div>
              <div class="readonly-text"><div class="rt-label">Week Low</div><div id="ro-low" class="rt-value"></div></div>
              <div class="readonly-text"><div class="rt-label">Additional Notes</div><div id="ro-notes"></div></div>
            </div>
          </div>
          <div id="submitView" style="display:none">
            <div class="form-card">
              <div class="card-title">Weekly Check-In <span id="weekLabel"></span></div>
              <div class="val-banner" id="valBanner"></div>
              <div class="scale-field">
                <div class="scale-header"><div><div class="scale-label">Stress Level</div><div class="scale-desc">1 = very low stress &nbsp;·&nbsp; 5 = very high stress</div></div><div class="score-chip sc3" id="chip-stress">3 — Moderate</div></div>
                <div class="seg" role="group" aria-label="Stress level">${seg('stress')}</div>
              </div>
              <div class="scale-field">
                <div class="scale-header"><div><div class="scale-label">Morale</div><div class="scale-desc">1 = lowest morale &nbsp;·&nbsp; 5 = highest morale</div></div><div class="score-chip sc3" id="chip-morale">3 — Moderate</div></div>
                <div class="seg" role="group" aria-label="Morale">${seg('morale')}</div>
              </div>
              <div class="scale-field">
                <div class="scale-header"><div><div class="scale-label">Workload</div><div class="scale-desc">1 = lightest &nbsp;·&nbsp; 5 = heaviest</div></div><div class="score-chip sc3" id="chip-workload">3 — Moderate</div></div>
                <div class="seg" role="group" aria-label="Workload">${seg('workload')}</div>
              </div>
              <hr class="divider">
              <div class="text-field"><label for="weekHigh">What was your high this week?</label><textarea id="weekHigh" data-clearerr placeholder="A win, a proud moment, something that went well…"></textarea></div>
              <div class="text-field"><label for="weekLow">What was your low this week?</label><textarea id="weekLow" data-clearerr placeholder="A challenge, a frustration, something you'd do differently…"></textarea></div>
              <div class="text-field"><label for="additionalNotes">Anything else to mention? <span class="opt">(optional)</span></label><textarea id="additionalNotes" placeholder="Any other context, shoutouts, or feedback…"></textarea></div>
              <div class="form-actions"><button class="btn-primary" id="submitBtn" data-action="submit">Submit Weekly Report</button></div>
            </div>
          </div>
          <div id="successView" style="display:none">
            <div class="success-card"><div class="success-icon">&#10003;</div><h2>Report Submitted!</h2><p id="successMsg"></p></div>
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
      const seg = e.target.closest('[data-scale]');
      if (seg) this._setScale(seg.getAttribute('data-scale'), parseInt(seg.getAttribute('data-val'), 10));
    });
    root.addEventListener('input', (e) => {
      if (e.target.hasAttribute && e.target.hasAttribute('data-clearerr')) {
        e.target.classList.remove('error');
        this._$('valBanner').style.display = 'none';
      }
    });
  }

  _renderPage() {
    this._$('loadingState').style.display = 'none';
    this._$('viewMine').style.display = '';
    const thisMonday = getMonday(new Date());
    if (this._existing) this._showSubmitted(this._existing);
    else this._showForm(thisMonday);
  }

  _showForm(monday) {
    this._$('submitView').style.display = '';
    this._$('submittedView').style.display = 'none';
    this._$('successView').style.display = 'none';
    this._$('weekLabel').textContent = `Week of ${formatWeekRange(monday)}`;
    ['stress', 'morale', 'workload'].forEach(k => this._setScale(k, 3));
  }

  _showSubmitted(report) {
    this._$('submittedView').style.display = '';
    this._$('submitView').style.display = 'none';
    this._$('successView').style.display = 'none';
    this._$('submittedSubtext').textContent =
      `Submitted ${new Date(report.submittedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    this._$('submittedWeekLabel').textContent = `Week of ${formatWeekRange(report.weekStart)}`;
    this._$('ro-stress').textContent = scaleLabel('stress', report.stressLevel);
    this._$('ro-morale').textContent = scaleLabel('morale', report.morale);
    this._$('ro-workload').textContent = scaleLabel('workload', report.workload);
    this._$('ro-high').textContent = report.weekHigh || '';
    this._$('ro-low').textContent = report.weekLow || '';
    const notesEl = this._$('ro-notes');
    if (report.additionalNotes) { notesEl.className = 'rt-value'; notesEl.textContent = report.additionalNotes; }
    else { notesEl.className = 'rt-empty'; notesEl.textContent = 'None'; }
  }

  _setScale(key, val) {
    const info = scaleInfo[key][val];
    this._scaleVals[key] = val;
    this.shadowRoot.querySelectorAll(`[data-scale="${key}"]`).forEach(b => {
      const n = parseInt(b.getAttribute('data-val'), 10);
      b.classList.remove('sel', 'sc1', 'sc2', 'sc3', 'sc4', 'sc5');
      if (n === val) b.classList.add('sel', info.cls);
    });
    const chip = this._$(`chip-${key}`);
    chip.className = `score-chip ${info.cls}`;
    chip.textContent = info.label;
  }

  _submit() {
    if (this._pending) return;
    const high = this._$('weekHigh').value.trim();
    const low = this._$('weekLow').value.trim();
    const notes = this._$('additionalNotes').value.trim();

    const missing = [];
    if (!high) { this._$('weekHigh').classList.add('error'); missing.push('Week High'); }
    if (!low) { this._$('weekLow').classList.add('error'); missing.push('Week Low'); }
    if (missing.length) {
      const banner = this._$('valBanner');
      banner.style.display = 'block';
      banner.textContent = `Required: ${missing.join(', ')}`;
      this._$(missing[0] === 'Week High' ? 'weekHigh' : 'weekLow').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const monday = getMonday(new Date());
    const u = this._user;
    const record = {
      employeeId: u ? (u._id || '') : '',
      submitterName: u ? `${u.firstName} ${u.lastName}` : '',
      email: u ? u.email : '',
      weekStart: monday,
      stressLevel: this._scaleVals.stress,
      morale: this._scaleVals.morale,
      workload: this._scaleVals.workload,
      weekHigh: high, weekLow: low, additionalNotes: notes,
      submittedDate: today,
    };

    this._pending = true;
    const btn = this._$('submitBtn');
    btn.disabled = true; btn.textContent = 'Submitting…';
    this.dispatchEvent(new CustomEvent('submit-report', { detail: record, bubbles: true, composed: true }));
  }
}

customElements.define('weekly-report', WeeklyReport);
