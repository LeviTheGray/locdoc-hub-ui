/**
 * Wix Custom Element — Resources Hub  (<resources-hub>)
 *
 * A styled front door to the company's SOPs / policies / processes / tutorials. Content is managed
 * in the Wix CMS collection `ProcessPoliciesTutorials` (populated by an n8n automation that watches
 * a Google Drive folder of Google Docs). This element renders that collection as a searchable,
 * category-filterable library, with an in-site READER view (title + body + a "View document"
 * button) so people stay on the portal instead of bouncing straight to Google Docs.
 *
 * Lives on the /resources page (Resources.lhdsf) and syncs through the Wix Git integration.
 *
 * Data handoff:
 *   • Velo → element :  setAttribute('init-data', JSON.stringify({ resources: [ … ] }))
 *       resources[] item shape (mapped from the collection by the page code):
 *         { id, title, desc, category, body, docUrl, updated, fileType, googleDocId }
 *       - desc     : short summary for the card (optional)
 *       - body     : rich-text/HTML shown in the reader (optional; falls back to desc). Ignored
 *                    when fileType resolves to an embed (see resolveEmbedUrl below).
 *       - docUrl   : link to the Google Doc/Drive file (optional; drives the "View document" button)
 *       - updated  : ISO date string (optional; shown as "Updated …")
 *       - fileType : 'doc' (default) | 'pdf' | 'slides' — 'doc' renders `body` as HTML; other types
 *                    render an inline iframe embed (via resolveEmbedUrl) instead, using googleDocId.
 *       - googleDocId: Drive file ID, extracted upstream from docUrl — required for embed types.
 *   • element → Velo :  none (external doc links open in a new tab from inside the element).
 *
 * Categories are derived from the data, so they track whatever the collection contains.
 * If no `resources` are provided, the PLACEHOLDER list below renders so the layout is previewable.
 *
 * Deep links (read straight off the URL — no Velo involvement):
 *   ?tag=<category>  pre-filters to one category and retitles the hero, so a single Resources page
 *                    can serve as the landing page for a content type. `/resources?tag=parts-spotlight`
 *                    is the Parts Spotlight view. The tag is slug-matched against the categories in
 *                    the data, so `parts-spotlight`, `Parts Spotlight` and `parts%20spotlight` all hit.
 *                    Adding a content type = a new Drive folder + category value upstream; no new page.
 *   ?doc=<id|title>  opens that resource's reader directly.
 *   ?q=<term>        pre-fills the search box.
 *
 * Editor setup (one time): Add → Embed Code → Custom Element → choose this file, set the tag name
 * to `resources-hub`, give the element the ID `resourcesHub`, and set the page to Members-Only.
 */

import { TOKENS, ensureMaterialSymbols } from './tokens.js';

// Material Symbols glyph per category (line-art, tinted with --icon). Unknown categories use the
// default. Keys are lowercased for lookup.
const CATEGORY_ICON = {
  'sop': 'description',
  'policy': 'gavel',
  'policy update': 'campaign',
  'process': 'account_tree',
  'tutorial': 'school',
  'form': 'edit_document',
  'guide': 'menu_book',
  'parts spotlight': 'inventory_2',
};
const DEFAULT_ICON = 'description';

// Hero copy per category for the ?tag= landing view. Categories without an entry fall back to a
// generic "<Category>" heading, so a new content type works without touching this map.
const CATEGORY_HERO = {
  'parts spotlight': {
    title: 'Parts Spotlight',
    blurb: 'Deep-dives from the purchasing team on the parts we stock — what they are, when to use them, and what to order.',
  },
};

// 'Parts Spotlight' / 'parts-spotlight' / 'parts spotlight' → 'parts-spotlight'
function slug(s) {
  return String(s == null ? '' : s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Universal embed resolver: maps a collection's fileType + Drive file ID to an embeddable iframe
// URL. 'doc' (Google Docs, the original/default type) has no inline embed — it renders `body` HTML
// instead. New file types (e.g. sheets) just need a new case here, no new fields/branches elsewhere.
function resolveEmbedUrl(fileType, docId) {
  if (!docId) return null;
  switch (fileType) {
    case 'pdf':    return `https://drive.google.com/file/d/${docId}/preview`;
    case 'slides': return `https://docs.google.com/presentation/d/${docId}/embed?start=false&loop=false&delayms=5000`;
    default:       return null;
  }
}

// ⚠️ PLACEHOLDER DATA — only used until the page passes live `resources` via init-data.
const PLACEHOLDER = [
  { id: 'p1', title: 'Service SOP — Lock Rekey', category: 'SOP', desc: 'Standard procedure for rekeying on a service call.', body: '<p>Placeholder body. Live content comes from the ProcessPoliciesTutorials collection.</p>', docUrl: 'https://docs.google.com/', updated: '2026-06-01' },
  { id: 'p2', title: 'PTO & Time-Off Policy', category: 'Policy', desc: 'How to request time off, accrual rules, and blackout periods.', body: '', docUrl: 'https://docs.google.com/', updated: '2026-05-12' },
  { id: 'p3', title: 'New Uniform Policy (2025)', category: 'Policy Update', desc: 'Updated uniform standards — please review.', body: '', docUrl: 'https://docs.google.com/', updated: '2026-04-20' },
  { id: 'p4', title: 'Onboarding a New Tech', category: 'Process', desc: 'End-to-end process for bringing a new technician online.', body: '', docUrl: 'https://docs.google.com/', updated: '2026-03-30' },
  { id: 'p5', title: 'Building a Quote in OMS', category: 'Tutorial', desc: 'Walkthrough of creating and sending a customer quote.', body: '', docUrl: 'https://docs.google.com/', updated: '2026-06-18' },
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

  /* Toolbar: search + category chips */
  .toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
  .search { position: relative; flex: 1 1 240px; min-width: 200px; }
  .search .material-symbols-outlined { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--gray-400); font-size: 20px; pointer-events: none; }
  .search input {
    width: 100%; padding: 10px 12px 10px 38px; border: 1.5px solid var(--gray-200); border-radius: var(--radius);
    font: inherit; font-size: 14px; background: #fff; color: var(--gray-900); outline: none;
  }
  .search input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(var(--primary-rgb),.12); }

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
    background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius);
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
  .res-updated { font-size: 12px; color: var(--gray-400); }
  .res-open { font-size: 12px; font-weight: 700; color: var(--primary); display: inline-flex; align-items: center; gap: 4px; }
  .res-open .material-symbols-outlined { font-size: 16px; }

  .empty { text-align: center; color: var(--gray-400); padding: 48px 0; font-size: 15px; }

  /* Reader (in-site detail view) */
  .reader { max-width: 760px; margin: 0 auto; }
  .back {
    display: inline-flex; align-items: center; gap: 6px; background: none; border: none; cursor: pointer;
    color: var(--primary); font: inherit; font-size: 14px; font-weight: 600; padding: 4px 0; margin-bottom: 18px;
  }
  .back .material-symbols-outlined { font-size: 20px; }
  .reader-img { display: block; width: 100%; max-height: 320px; object-fit: cover; border-radius: var(--radius); border: 1.5px solid var(--gray-200); box-shadow: var(--shadow); margin-bottom: 18px; }
  .reader-cat { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--primary-dk); }
  .reader h2 { font-size: 26px; font-weight: 800; line-height: 1.25; margin: 8px 0; color: var(--gray-900); }
  .reader-meta { font-size: 13px; color: var(--gray-400); margin-bottom: 20px; }
  .reader-body {
    background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius); box-shadow: var(--shadow);
    padding: 26px; font-size: 15px; line-height: 1.65; color: var(--gray-900);
  }
  .reader-body p { margin: 0 0 12px; } .reader-body p:last-child { margin-bottom: 0; }
  .reader-body h1, .reader-body h2, .reader-body h3 { margin: 18px 0 8px; line-height: 1.3; }
  .reader-body ul, .reader-body ol { margin: 0 0 12px 22px; } .reader-body li { margin: 4px 0; }
  .reader-body a { color: var(--primary); }
  .reader-none { color: var(--gray-400); font-style: italic; }
  .reader-embed {
    position: relative; width: 100%; padding-top: 129.4%; /* portrait doc/PDF aspect */
    border: 1.5px solid var(--gray-200); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden;
  }
  .reader-embed.reader-embed--slides { padding-top: 56.25%; /* 16:9 for slide decks */ }
  .reader-embed iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .doc-btn {
    display: inline-flex; align-items: center; gap: 8px; margin-top: 22px;
    background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm);
    padding: 11px 20px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; text-decoration: none;
    transition: background .15s, transform .08s;
  }
  .doc-btn:hover { background: var(--primary-dk); } .doc-btn:active { transform: scale(.98); }
  .doc-btn .material-symbols-outlined { font-size: 18px; }

  @media (max-width: 600px) {
    .header { padding: 12px 16px; }
    .hero { padding: 32px 16px; }
    .hero h2 { font-size: 23px; }
    .main { padding: 24px 12px 44px; }
    .cards { grid-template-columns: 1fr; }
    .reader-body { padding: 20px; }
  }
`;

class ResourcesHub extends HTMLElement {
  static get observedAttributes() { return ['init-data']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._resources = PLACEHOLDER;
    this._q = '';
    this._category = 'All';
    this._view = 'list';
    this._activeId = null;
    this._deepDoc = null; // pending ?doc= deep-link to open once data arrives
    this._deepTag = null; // pending ?tag= category filter, resolved once data arrives
  }

  connectedCallback() {
    ensureMaterialSymbols();
    // Best-effort only — on Wix this usually finds NOTHING. Wix rewrites the page URL during its
    // own routing and drops the query string before this element mounts, which is why ?tag= links
    // kept landing on the unfiltered list. The authoritative source is the `deepLink` the page code
    // reads from wixLocation.query at onReady and passes via init-data (see _applyData). This read
    // still matters for standalone/non-Wix use, where the URL is all there is.
    try {
      const params = new URLSearchParams(window.location.search);
      this._deepDoc = params.get('doc');
      this._deepTag = params.get('tag');
      const q = params.get('q');
      if (q) this._q = q.trim().toLowerCase();
    } catch (e) { /* no-op */ }
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyData(this.getAttribute('init-data'));
    else this._maybeOpenDeepLink(); // allow deep-link against placeholder data too
  }

  attributeChangedCallback(name, _old, value) {
    if (name === 'init-data' && value) this._applyData(value);
  }

  _applyData(json) {
    let parsed = {};
    try { parsed = JSON.parse(json) || {}; } catch (e) { parsed = {}; }
    if (Array.isArray(parsed.resources) && parsed.resources.length) {
      this._resources = parsed.resources;
    }
    // Deep-link params from the page code (wixLocation.query, captured before Wix strips the query
    // string). These WIN over whatever connectedCallback managed to scrape off window.location.
    const dl = parsed.deepLink || {};
    if (dl.tag) this._deepTag = dl.tag;
    if (dl.doc) this._deepDoc = dl.doc;
    if (dl.q)   this._q = String(dl.q).trim().toLowerCase();

    // Resolve ?tag= against the categories the live data actually has. Only reset to 'All' when
    // there's no tag to honour — otherwise the incoming CMS data would clobber the deep-link.
    this._category = this._resolveTag() || 'All';
    this._renderList();
    this._maybeOpenDeepLink();
  }

  // ?tag=parts-spotlight → the real category string ('Parts Spotlight') if the data has one that
  // slug-matches. An unknown tag returns null, so the page falls back to the full list rather than
  // rendering an empty one.
  _resolveTag() {
    if (!this._deepTag) return null;
    const want = slug(this._deepTag);
    return this._categories().find(c => slug(c) === want) || null;
  }

  // If the URL carried ?doc=<value>, open the matching resource once (by id, googleDocId, or a
  // case-insensitive title match). Cleared after opening so the Back button returns to the list.
  _maybeOpenDeepLink() {
    if (!this._deepDoc) return;
    const v = String(this._deepDoc).trim().toLowerCase();
    const hit = this._resources.find(r =>
      String(r.id).toLowerCase() === v ||
      (r.googleDocId && String(r.googleDocId).toLowerCase() === v) ||
      (r.title && r.title.toLowerCase().includes(v))
    );
    this._deepDoc = null;
    if (hit) this._openReader(hit.id);
  }

  _categories() {
    const seen = [];
    for (const r of this._resources) {
      const c = (r.category || '').trim();
      if (c && !seen.includes(c)) seen.push(c);
    }
    seen.sort((a, b) => a.localeCompare(b));
    return seen;
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <header class="header"><h1>Resources</h1><p>SOPs · Policies · Processes · Tutorials</p></header>
      <section class="hero" data-hero></section>
      <main class="main" data-main></main>`;
    this._renderList();
  }

  // Hero tracks the active category, so a ?tag= link reads as that content type's own landing page.
  _renderHero() {
    const hero = this.shadowRoot.querySelector('[data-hero]');
    if (!hero) return;
    const copy = this._category === 'All'
      ? {
          title: 'Find what you need',
          blurb: 'Search and filter company processes, policies and tutorials. Open one to read it here or jump to the source document.',
        }
      : (CATEGORY_HERO[this._category.toLowerCase()] || {
          title: this._category,
          blurb: `Browse the latest ${this._category} documents.`,
        });
    hero.innerHTML = `<h2>${this._esc(copy.title)}</h2><p>${this._esc(copy.blurb)}</p>`;
  }

  // ---- List view ----
  _renderList() {
    this._renderHero();
    const main = this.shadowRoot.querySelector('[data-main]');
    main.innerHTML = `
      <div class="toolbar">
        <label class="search">
          <span class="material-symbols-outlined">search</span>
          <input type="search" placeholder="Search resources…" data-search aria-label="Search resources" value="${this._escAttr(this._q)}">
        </label>
      </div>
      <div class="chips" data-chips></div>
      <div class="count" data-count></div>
      <div class="cards" data-cards></div>`;

    main.querySelector('[data-search]').addEventListener('input', (e) => {
      this._q = e.target.value.trim().toLowerCase();
      this._renderCards();
    });
    main.querySelector('[data-chips]').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-cat]');
      if (!chip) return;
      this._category = chip.getAttribute('data-cat');
      this._renderHero();
      this._renderChips();
      this._renderCards();
    });
    main.querySelector('[data-cards]').addEventListener('click', (e) => {
      const card = e.target.closest('[data-id]');
      if (card) this._openReader(card.getAttribute('data-id'));
    });

    this._renderChips();
    this._renderCards();
  }

  _renderChips() {
    const box = this.shadowRoot.querySelector('[data-chips]');
    if (!box) return;
    const cats = ['All', ...this._categories()];
    box.innerHTML = cats
      .map(c => `<button class="chip${c === this._category ? ' active' : ''}" data-cat="${this._escAttr(c)}">${c}</button>`)
      .join('');
  }

  _matches(r) {
    if (this._category !== 'All' && r.category !== this._category) return false;
    if (this._q) {
      const hay = `${r.title || ''} ${r.desc || ''} ${r.category || ''}`.toLowerCase();
      if (!hay.includes(this._q)) return false;
    }
    return true;
  }

  _renderCards() {
    const root = this.shadowRoot;
    const cards = root.querySelector('[data-cards]');
    const count = root.querySelector('[data-count]');
    if (!cards) return;
    const matched = this._resources.filter(r => this._matches(r));
    if (!matched.length) {
      count.textContent = '';
      cards.innerHTML = '<div class="empty">No resources match your filters.</div>';
      return;
    }
    count.textContent = `${matched.length} resource${matched.length === 1 ? '' : 's'}`;
    cards.innerHTML = matched.map(r => this._card(r)).join('');
  }

  _card(r) {
    const icon = CATEGORY_ICON[(r.category || '').toLowerCase()] || DEFAULT_ICON;
    const updated = this._fmtDate(r.updated);
    return `
      <div class="res-card" data-id="${this._escAttr(r.id)}">
        <div class="res-top">
          <div class="res-icon"><span class="material-symbols-outlined">${icon}</span></div>
          <div class="res-cat">${this._esc(r.category || 'Resource')}</div>
        </div>
        <div class="res-title">${this._esc(r.title || 'Untitled')}</div>
        ${r.desc ? `<div class="res-desc">${this._esc(r.desc)}</div>` : ''}
        <div class="res-foot">
          <span class="res-updated">${updated ? 'Updated ' + updated : ''}</span>
          <span class="res-open">Read <span class="material-symbols-outlined">chevron_right</span></span>
        </div>
      </div>`;
  }

  // ---- Reader view ----
  _openReader(id) {
    this._activeId = id;
    this._view = 'detail';
    this._renderReader();
    this.shadowRoot.querySelector('[data-main]').scrollIntoView({ block: 'start' });
  }

  _renderReader() {
    const r = this._resources.find(x => String(x.id) === String(this._activeId));
    const main = this.shadowRoot.querySelector('[data-main]');
    if (!r) { this._view = 'list'; this._renderList(); return; }
    const updated = this._fmtDate(r.updated);
    const effective = this._fmtDate(r.effectiveDate);
    const meta = [effective ? 'Effective ' + effective : '', updated ? 'Updated ' + updated : '']
      .filter(Boolean).join(' · ');
    const img = r.image ? `<img class="reader-img" src="${this._escAttr(r.image)}" alt="" loading="lazy">` : '';
    const embedUrl = resolveEmbedUrl(r.fileType, r.googleDocId);
    const bodyHtml = embedUrl
      ? `<div class="reader-embed${r.fileType === 'slides' ? ' reader-embed--slides' : ''}">
           <iframe src="${this._escAttr(embedUrl)}" allowfullscreen loading="lazy"></iframe>
         </div>`
      : (r.body
          ? `<div class="reader-body">${r.body}</div>`
          : (r.desc ? `<div class="reader-body">${this._esc(r.desc)}</div>`
                    : `<div class="reader-body reader-none">No preview available — open the document to read it.</div>`));
    const docBtn = r.docUrl
      ? `<a class="doc-btn" href="${this._escAttr(r.docUrl)}" target="_blank" rel="noopener">View document <span class="material-symbols-outlined">open_in_new</span></a>`
      : '';
    main.innerHTML = `
      <div class="reader">
        <button class="back" data-back><span class="material-symbols-outlined">arrow_back</span> All resources</button>
        ${img}
        <div class="reader-cat">${this._esc(r.category || 'Resource')}</div>
        <h2>${this._esc(r.title || 'Untitled')}</h2>
        <div class="reader-meta">${meta}</div>
        ${bodyHtml}
        ${docBtn}
      </div>`;
    main.querySelector('[data-back]').addEventListener('click', () => {
      this._view = 'list';
      this._renderList();
    });
  }

  // ---- helpers ----
  _fmtDate(v) {
    if (!v) return '';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  _escAttr(s) {
    return this._esc(s).replace(/"/g, '&quot;');
  }
}

customElements.define('resources-hub', ResourcesHub);
