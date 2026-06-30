/**
 * Wix Custom Element — Resources Hub  (<resources-hub>)
 *
 * A styled, navigable front door to the company's SOPs / policies / forms. Discussion and the
 * actual posts still live in the Wix Groups app (/groups) — this hub does NOT query Groups; it
 * organizes curated links into the right Group/topic (or a document) by category + department,
 * with client-side search, so people can find things. Replaces the old hard-to-use forum landing.
 *
 * Lives on the /resources page (Resources.lhdsf) and syncs through the Wix Git integration.
 *
 * Data handoff (mirrors home-landing):
 *   • Velo → element :  setAttribute('init-data', JSON.stringify({ currentUser }))  (optional —
 *                       used only to pre-select the department filter to the viewer's department)
 *   • element → Velo :  dispatches 'navigate' { detail: { path } } for IN-SITE links; external
 *                       links (Groups URLs, docs) open in a new tab from inside the element.
 *
 * Editor setup (one time): Add → Embed Code → Custom Element → choose this file, set the tag name
 * to `resources-hub`, give the element the ID `resourcesHub`, and set the page to Members-Only.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * TO POPULATE: replace the PLACEHOLDER entries in RESOURCES below with real items — each needs a
 * title, desc, category, department, and EITHER `href` (a Groups/topic or document URL, opens in a
 * new tab) OR `path` (an in-site route like '/groups/<slug>', navigates in place). Adjust
 * CATEGORIES / DEPARTMENTS to match. (Future option: move RESOURCES to a Wix CMS collection so it
 * can be edited without code — not wired yet.)
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */

import { TOKENS, ensureMaterialSymbols } from './tokens.js';

// Filter taxonomies. 'All' is injected by the UI; list the real values here.
const CATEGORIES = ['SOP', 'Policy', 'Policy Update', 'Form', 'Guide'];
const DEPARTMENTS = ['Operations', 'Sales', 'Lab', 'Admin'];

// Material Symbols glyph per category (line-art, tinted with --icon).
const CATEGORY_ICON = {
  'SOP': 'description',
  'Policy': 'gavel',
  'Policy Update': 'campaign',
  'Form': 'edit_document',
  'Guide': 'menu_book',
};

// ⚠️ PLACEHOLDER DATA — replace with the real resources/links (see header note).
const RESOURCES = [
  { title: 'Service SOP — Lock Rekey', desc: 'Step-by-step standard procedure for rekeying on a service call.', category: 'SOP', department: 'Operations', path: '/groups' },
  { title: 'PTO & Time-Off Policy', desc: 'How to request time off, accrual rules, and blackout periods.', category: 'Policy', department: 'Admin', path: '/groups' },
  { title: 'New Uniform Policy (2025)', desc: 'Updated uniform standards effective this year — please review.', category: 'Policy Update', department: 'Operations', path: '/groups' },
  { title: 'Incident Report Form', desc: 'Submit a workplace incident or safety report.', category: 'Form', department: 'Operations', href: 'https://team.locdoc.net/groups' },
  { title: 'Sales Quote Builder Guide', desc: 'How to build and send a customer quote in OMS.', category: 'Guide', department: 'Sales', path: '/groups' },
  { title: 'Lab Intake SOP', desc: 'Receiving, logging, and routing lab project work.', category: 'SOP', department: 'Lab', path: '/groups' },
];

const STYLES = `
  ${TOKENS}
  :host { background: var(--gray-50); }

  .header { background: var(--primary); color: #fff; padding: 14px 24px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p  { font-size: 12px; opacity: .75; margin-top: 2px; }

  .hero { background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dk) 100%); color: #fff; padding: 44px 24px; text-align: center; }
  .hero h2 { font-size: 28px; font-weight: 800; line-height: 1.2; }
  .hero p  { font-size: 15px; opacity: .92; margin: 10px auto 0; max-width: 560px; line-height: 1.5; }

  .main { max-width: 1000px; margin: 0 auto; padding: 32px 16px 56px; }

  /* Toolbar: search + category chips + department select */
  .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 8px; }
  .search { position: relative; flex: 1 1 240px; min-width: 200px; }
  .search .material-symbols-outlined { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 20px; pointer-events: none; }
  .search input {
    width: 100%; padding: 10px 12px 10px 38px; border: 1.5px solid var(--gray-200); border-radius: var(--radius);
    font: inherit; font-size: 14px; background: #fff; color: var(--gray-900); outline: none;
  }
  .search input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(var(--primary-rgb),.12); }
  .dept-select {
    padding: 10px 12px; border: 1.5px solid var(--gray-200); border-radius: var(--radius);
    font: inherit; font-size: 14px; background: #fff; color: var(--gray-900); cursor: pointer; min-width: 160px;
  }
  .dept-select:focus { border-color: var(--primary); outline: none; }

  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 22px; }
  .chip {
    border: 1.5px solid var(--gray-200); background: #fff; color: var(--gray-600);
    border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
    transition: background .15s, color .15s, border-color .15s; -webkit-tap-highlight-color: transparent;
  }
  .chip:hover { border-color: var(--primary); }
  .chip.active { background: var(--primary); color: #fff; border-color: var(--primary); }

  .count { font-size: 12px; color: var(--gray-400); margin-bottom: 14px; }

  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
  .res-card {
    position: relative; background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius);
    box-shadow: var(--shadow); padding: 18px; cursor: pointer; text-align: left;
    display: flex; flex-direction: column; gap: 10px;
    transition: border-color .15s, box-shadow .15s, transform .12s; -webkit-tap-highlight-color: transparent;
  }
  .res-card:hover { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(var(--primary-rgb),.08), var(--shadow-md); transform: translateY(-2px); }
  .res-card:active { transform: scale(.99); }
  .res-top { display: flex; align-items: center; gap: 12px; }
  .res-icon { width: 42px; height: 42px; border-radius: var(--radius); flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--icon-chip-bg); color: var(--icon); }
  .res-icon .material-symbols-outlined { font-size: 22px; }
  .res-cat { font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--primary-dk); }
  .res-title { font-size: 15px; font-weight: 700; color: var(--gray-900); line-height: 1.3; }
  .res-desc { font-size: 13.5px; line-height: 1.5; color: var(--gray-600); }
  .res-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }
  .res-dept { font-size: 12px; color: var(--gray-400); }
  .res-open { font-size: 12px; font-weight: 700; color: var(--primary); display: inline-flex; align-items: center; gap: 4px; }
  .res-open .material-symbols-outlined { font-size: 16px; }

  .empty { text-align: center; color: var(--gray-400); padding: 48px 0; font-size: 15px; }

  @media (max-width: 600px) {
    .header { padding: 12px 16px; }
    .hero { padding: 32px 16px; }
    .hero h2 { font-size: 23px; }
    .main { padding: 24px 12px 44px; }
    .cards { grid-template-columns: 1fr; }
  }
`;

class ResourcesHub extends HTMLElement {
  static get observedAttributes() { return ['init-data']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._q = '';
    this._category = 'All';
    this._department = 'All';
  }

  connectedCallback() {
    ensureMaterialSymbols();
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyData(this.getAttribute('init-data'));
  }

  attributeChangedCallback(name, _old, value) {
    if (name === 'init-data' && value) this._applyData(value);
  }

  _applyData(json) {
    let parsed = {};
    try { parsed = JSON.parse(json) || {}; } catch (e) { parsed = {}; }
    const dept = parsed.currentUser && parsed.currentUser.department;
    // Pre-select the viewer's department if it's one we filter on.
    if (dept && DEPARTMENTS.includes(dept)) {
      this._department = dept;
      const sel = this.shadowRoot.querySelector('.dept-select');
      if (sel) sel.value = dept;
    }
    this._renderCards();
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    const chips = ['All', ...CATEGORIES]
      .map(c => `<button class="chip${c === this._category ? ' active' : ''}" data-cat="${c}">${c}</button>`)
      .join('');
    const deptOpts = ['All', ...DEPARTMENTS]
      .map(d => `<option value="${d}">${d === 'All' ? 'All departments' : d}</option>`).join('');

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <header class="header"><h1>Resources</h1><p>SOPs · Policies · Forms · Guides</p></header>
      <section class="hero">
        <h2>Find what you need</h2>
        <p>Search and filter company SOPs, policies and forms. Open a resource to read or discuss it in Groups.</p>
      </section>
      <main class="main">
        <div class="toolbar">
          <label class="search">
            <span class="material-symbols-outlined">search</span>
            <input type="search" placeholder="Search resources…" data-search aria-label="Search resources">
          </label>
          <select class="dept-select" data-dept aria-label="Filter by department">${deptOpts}</select>
        </div>
        <div class="chips" data-chips>${chips}</div>
        <div class="count" data-count></div>
        <div class="cards" data-cards></div>
      </main>`;

    const root = this.shadowRoot;
    root.querySelector('[data-search]').addEventListener('input', (e) => {
      this._q = e.target.value.trim().toLowerCase();
      this._renderCards();
    });
    root.querySelector('[data-dept]').addEventListener('change', (e) => {
      this._department = e.target.value;
      this._renderCards();
    });
    root.querySelector('[data-chips]').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-cat]');
      if (!chip) return;
      this._category = chip.getAttribute('data-cat');
      root.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
      this._renderCards();
    });
    root.querySelector('[data-cards]').addEventListener('click', (e) => {
      const card = e.target.closest('[data-idx]');
      if (card) this._open(RESOURCES[Number(card.getAttribute('data-idx'))]);
    });

    this._renderCards();
  }

  _matches(r) {
    if (this._category !== 'All' && r.category !== this._category) return false;
    if (this._department !== 'All' && r.department !== this._department) return false;
    if (this._q) {
      const hay = `${r.title} ${r.desc} ${r.category} ${r.department}`.toLowerCase();
      if (!hay.includes(this._q)) return false;
    }
    return true;
  }

  _card(r, idx) {
    const icon = CATEGORY_ICON[r.category] || 'description';
    const ext = r.href ? 'open_in_new' : 'chevron_right';
    return `
      <div class="res-card" data-idx="${idx}">
        <div class="res-top">
          <div class="res-icon"><span class="material-symbols-outlined">${icon}</span></div>
          <div class="res-cat">${r.category}</div>
        </div>
        <div class="res-title">${r.title}</div>
        <div class="res-desc">${r.desc}</div>
        <div class="res-foot">
          <span class="res-dept">${r.department}</span>
          <span class="res-open">Open <span class="material-symbols-outlined">${ext}</span></span>
        </div>
      </div>`;
  }

  _renderCards() {
    const root = this.shadowRoot;
    const matched = RESOURCES.map((r, i) => [r, i]).filter(([r]) => this._matches(r));
    const cards = root.querySelector('[data-cards]');
    const count = root.querySelector('[data-count]');
    if (!matched.length) {
      cards.innerHTML = '';
      count.textContent = '';
      cards.innerHTML = '<div class="empty">No resources match your filters.</div>';
      return;
    }
    count.textContent = `${matched.length} resource${matched.length === 1 ? '' : 's'}`;
    cards.innerHTML = matched.map(([r, i]) => this._card(r, i)).join('');
  }

  _open(r) {
    if (!r) return;
    if (r.href) {
      window.open(r.href, '_blank', 'noopener');
    } else if (r.path) {
      this.dispatchEvent(new CustomEvent('navigate', { detail: { path: r.path }, bubbles: true, composed: true }));
    }
  }
}

customElements.define('resources-hub', ResourcesHub);
