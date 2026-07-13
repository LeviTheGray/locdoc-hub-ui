/**
 * Wix Custom Element — Team Portal Landing  (<home-landing>)
 *
 * The site landing page (team.locdoc.net) as a git-synced web component. This is the
 * public-facing portal entry that sits *in front of* the Employee Hub launcher
 * (/employee-hub, the <hub-home> tool grid). Lives in src/public/custom-elements/ and
 * syncs through the Wix Git integration — UI changes deploy on `git push`, no manual paste.
 *
 * Reuses the hub's design language (see hub-home.js): brand greens, rounded cards with the
 * hover lift, icon chips, and the green pill button with the "Opening…" spinner.
 *
 * Data handoff (mirrors hub-home):
 *   • Velo → element :  $w('#homeLanding').setAttribute('init-data', JSON.stringify({ currentUser }))
 *   • element → Velo :  dispatches a 'navigate' CustomEvent { detail: { key } } for INTERNAL
 *                       destinations; the page code maps key → path and calls wixLocation.to().
 *                       External destinations open in a new tab from inside the element.
 *
 * Editor setup (one time): Add → Embed Code → Custom Element → choose this file,
 * set the tag name to `home-landing`, and give the element the ID `homeLanding`.
 */

import { TOKENS, ensureMaterialSymbols } from './tokens.js';

// Internal destinations (handled by Velo via the 'navigate' event) must list their key here, and
// each key needs a matching path in PAGE_PATHS in Home.c1dmp.js — an internal tile with no route
// is a dead button. Only genuinely off-site tools (OMS, Drive, Nexus/Lab Hub) keep an `href`.
const INTERNAL_KEYS = [
  'hub', 'parts-spotlight', 'profit-sharing', 'policies',
  'meetings', 'benefits', 'events', 'mission-vision',
];

// Google Calendar embed. Paste the `src` URL from Google Calendar →
// Settings → [calendar] → Integrate calendar → "Embed code" (use the URL inside src="…").
// The calendar must be public or shared with the team to display. Leave '' to hide the band.
const CALENDAR_EMBED_SRC = 'https://calendar.google.com/calendar/embed?height=300&wkst=1&bgcolor=%23ffffff&ctz=America%2FNew_York&showNav=0&mode=AGENDA&showTitle=0&showDate=0&showPrint=0&showTabs=0&showCalendars=0&showTz=0&src=ZjFodDhiNDF1ajhrNjcyMWR1aHY5Z2RudGEwc3Y0ZnJAaW1wb3J0LmNhbGVuZGFyLmdvb2dsZS5jb20&src=M3BwbGg5ZmY2NXBwYXFvanFzc2xzNHNjdDE3aGU4aHNAaW1wb3J0LmNhbGVuZGFyLmdvb2dsZS5jb20&color=%237CB342&color=%23D81B60'; // PLACEHOLDER — e.g. 'https://calendar.google.com/calendar/embed?src=…&ctz=America/New_York'

// Landing destinations. Internal entries set `internal: true` and dispatch 'navigate';
// external entries carry an `href` and open in a new tab.
//
// NOTE: the external-tools cards below are PLACEHOLDERS — replace name/desc/href (and icon)
// with the real tools/OMS links. Add or remove entries freely.
const DESTINATIONS = [
  {
    key: 'meetings',
    internal: true, // in-site: /meetings
    icon: 'calendar_month',
    name: 'Weekly Meetings',
    desc: 'Weekly Meeting Links',
    btnText: 'Go to Meetings'
  },
  { 
    key: 'oms', 
    href: 'https://app.openingmanagement.com', 
    icon: 'build',
    name: 'OMS',
    desc: 'Open the operations management system.',
    btnText: 'Open OMS' 
  },
  {
    key: 'profit-sharing',
    internal: true, // in-site: Velo maps this to /resources?doc=Profit%20Sharing
    icon: 'payments',
    name: 'Profit Sharing',
    desc: 'Information and updates regarding the employee profit sharing program.',
    btnText: 'View Profit Sharing'
  },
  {
    key: 'benefits',
    internal: true, // in-site: /employee-benefits
    icon: 'local_hospital',
    name: 'My Benefits',
    desc: 'Access your health, dental, and other employee benefits information.',
    btnText: 'View Benefits'
  },
  {
    key: 'events',
    internal: true, // in-site: /annualevents
    icon: 'celebration',
    name: 'Company Events',
    desc: 'Stay up to date on annual company gatherings and upcoming events.',
    btnText: 'View Events'
  },
  {
    key: 'mission-vision',
    internal: true, // in-site: /vto
    icon: 'flag',
    name: 'Mission & Vision',
    desc: 'Read about our core values, mission, and long-term vision.',
    btnText: 'View Mission & Vision'
  },
  {
    key: 'policies',
    internal: true, // in-site: Velo maps this to /resource
    icon: 'policy',
    name: 'Policies',
    desc: 'Important company policies, guidelines, and internal resources.',
    btnText: 'View Policies'
  },
  {
    key: 'parts-spotlight',
    internal: true, // stays in-site: Velo maps this to /resources?tag=parts-spotlight
    icon: 'inventory_2',
    name: 'Parts Spotlight',
    desc: 'Purchasing’s deep-dives on the parts we stock — what they are and when to use them.',
    btnText: 'View Parts Spotlights'
  },
  { 
    key: 'handbook', 
    href: 'https://drive.google.com/file/d/1vyxYUy9d72Q55s3kofm9NRTSoVuvCk9R/view?usp=sharing', 
    icon: 'menu_book',
    name: 'Employee Handbook',
    desc: 'Read the official employee handbook for general rules and expectations.',
    btnText: 'Open Handbook' 
  },
  {
    key: 'nexus-hub',
    href: 'https://lab-hub.locdoc.net/',
    icon: 'support_agent',
    name: 'Nexus Hub',
    desc: 'Submit IT support tickets and track lab project management.',
    btnText: 'Open Nexus Hub' 
  }
];

const STYLES = `
  ${TOKENS}
  :host { background: var(--gray-50); }
  /* Header bar with forward-facing Employee Hub pill */
  .header {
    background: var(--primary); color: #fff; padding: 14px 24px; box-shadow: var(--shadow-md);
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
  }
  .brand { display: flex; flex-direction: column; }
  .brand h1 { font-size: 18px; font-weight: 700; }
  .brand p  { font-size: 12px; opacity: .75; margin-top: 2px; }
  .hub-pill {
    display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
    background: rgba(255,255,255,.15); color: #fff; border: 1px solid rgba(255,255,255,.35);
    border-radius: 999px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
    transition: background .15s, transform .08s;
  }
  .hub-pill:hover { background: rgba(255,255,255,.28); }
  .hub-pill:active { transform: scale(.97); }

  /* Hero band */
  .hero {
    background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dk) 100%);
    color: #fff; padding: 56px 24px; text-align: center;
  }
  .hero .wordmark { font-size: 13px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; opacity: .85; margin-bottom: 14px; }
  .hero h2 { font-size: 34px; font-weight: 800; line-height: 1.2; max-width: 720px; margin: 0 auto; }
  .hero p  { font-size: 16px; opacity: .92; margin: 14px auto 28px; max-width: 560px; line-height: 1.5; }
  .hero-cta {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    background: #fff; color: var(--primary-dk); border: none; border-radius: 8px;
    padding: 13px 28px; font-size: 15px; font-weight: 700; cursor: pointer;
    box-shadow: var(--shadow-md); transition: transform .08s, box-shadow .15s, background .15s;
  }
  .hero-cta:hover { background: var(--gray-100); }
  .hero-cta:active { transform: scale(.97); }
  .hero-cta.is-loading { cursor: default; opacity: .85; pointer-events: none; }
  .hero-cta .btn-spinner { border-color: rgba(var(--primary-rgb),.35); border-top-color: var(--primary-dk); }

  /* Calendar band */
  .cal-band { max-width: 980px; margin: 0 auto; padding: 0 16px 56px; }
  .cal-title { margin-bottom: 16px; }
  .cal-frame {
    background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius);
    box-shadow: var(--shadow); overflow: hidden;
  }
  .cal-frame iframe { display: block; width: 100%; height: 600px; border: 0; }
  @media (max-width: 600px) { .cal-frame iframe { height: 420px; } }

  /* Card grid */
  .main { max-width: 980px; margin: 0 auto; padding: 44px 16px 56px; }
  .grid-title {
    font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    color: var(--gray-400); padding-bottom: 12px; margin-bottom: 22px; border-bottom: 1px solid var(--gray-200);
  }
  /* Icon-centric destination tiles (matches hub-home): icon + label, description behind the "i". */
  .tools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
  .tool-tile {
    position: relative; background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius);
    padding: 22px 14px 18px; box-shadow: var(--shadow); cursor: pointer; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    transition: border-color .15s, box-shadow .15s, transform .12s; -webkit-tap-highlight-color: transparent;
  }
  .tool-tile:hover { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(var(--primary-rgb),.08), var(--shadow-md); transform: translateY(-2px); }
  .tool-tile:active { transform: scale(.98); }
  .tool-tile.is-loading { pointer-events: none; opacity: .9; border-color: var(--primary); }
  /* OMS icon strategy: single brand tint on a neutral chip, Material Symbols glyph. */
  .tool-icon { width: 56px; height: 56px; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: var(--icon-chip-bg); color: var(--icon); }
  .tool-icon .material-symbols-outlined { font-size: 30px; }
  .tile-name { font-size: 13px; font-weight: 700; line-height: 1.3; color: var(--gray-900); }
  .tile-ext { position: absolute; top: 9px; left: 10px; font-size: 11px; color: var(--gray-400); }
  .tile-info {
    position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; border-radius: 50%;
    border: 1px solid var(--gray-200); background: var(--gray-50); color: var(--gray-400);
    font: 700 12px Georgia, 'Times New Roman', serif; font-style: italic; cursor: pointer; padding: 0; line-height: 1;
    display: flex; align-items: center; justify-content: center; transition: background .15s, color .15s;
  }
  .tile-info:hover { background: var(--primary); color: #fff; border-color: var(--primary); }
  .tile-pop {
    display: none; position: absolute; top: 32px; right: 8px; left: 8px; z-index: 10;
    background: var(--gray-900); color: #fff; font-size: 12px; font-weight: 500; line-height: 1.45;
    text-align: left; padding: 10px 12px; border-radius: 8px; box-shadow: var(--shadow-md);
  }
  .tile-pop.open { display: block; }
  .btn-spinner { display: inline-block; width: 13px; height: 13px; margin-right: 7px; vertical-align: -2px; border: 2px solid rgba(255,255,255,.5); border-top-color: #fff; border-radius: 50%; animation: btnspin .6s linear infinite; }
  @keyframes btnspin { to { transform: rotate(360deg); } }

  @media (max-width: 600px) {
    .header { padding: 12px 16px; }
    .hero { padding: 40px 16px; }
    .hero h2 { font-size: 26px; }
    .main { padding: 32px 12px 44px; }
    .tools-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; }
    .tool-icon { width: 48px; height: 48px; }
    .tool-icon .material-symbols-outlined { font-size: 26px; }
    .tool-tile { padding: 16px 8px 14px; }
  }
`;

class HomeLanding extends HTMLElement {
  static get observedAttributes() { return ['init-data']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._user = null;
    this._navigating = false;
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
    this._user = parsed.currentUser || null;
    this._render();
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <header class="header">
        <div class="brand"><h1>LocDoc Team Portal</h1><p>team.locdoc.net</p></div>
        <button class="hub-pill" data-key="hub">Employee Hub &#8594;</button>
      </header>
      <section class="hero">
        <div class="wordmark">LocDoc</div>
        <h2 data-headline>LocDoc Team Portal</h2>
        <p>One place for the team — reports, scorecards, meetings and the tools you use every day.</p>
        <button class="hero-cta" data-key="hub">Go to Employee Hub &#8594;</button>
      </section>
      <main class="main">
        <div class="grid-title">Destinations</div>
        <div class="tools-grid" data-cards></div>
      </main>
      ${CALENDAR_EMBED_SRC ? `
      <section class="cal-band">
        <div class="grid-title cal-title">Team Calendar</div>
        <div class="cal-frame">
          <iframe src="${CALENDAR_EMBED_SRC}" title="Team Calendar" loading="lazy" scrolling="no"></iframe>
        </div>
      </section>` : ''}`;
    this.shadowRoot.addEventListener('click', (e) => {
      const info = e.target.closest('[data-info]');
      if (info) { e.stopPropagation(); this._toggleInfo(info.getAttribute('data-info')); return; }
      const btn = e.target.closest('[data-key]');
      if (btn) { this._go(btn.getAttribute('data-key'), btn); return; }
      this._closeInfo(); // tap elsewhere dismisses any open popover
    });
  }

  _toggleInfo(key) {
    const pop = this.shadowRoot.querySelector(`.tile-pop[data-pop="${key}"]`);
    const wasOpen = pop && pop.classList.contains('open');
    this._closeInfo();
    if (pop && !wasOpen) pop.classList.add('open');
  }
  _closeInfo() {
    this.shadowRoot.querySelectorAll('.tile-pop.open').forEach(p => p.classList.remove('open'));
  }

  _go(key, btn) {
    if (this._navigating) return;
    const dest = DESTINATIONS.find(d => d.key === key) || (key === 'hub' ? { key: 'hub', internal: true } : null);
    if (!dest) return;

    if (dest.internal && INTERNAL_KEYS.includes(key)) {
      this._navigating = true;
      this._setLoading(btn);
      // Hand navigation to the Velo page code (it owns wix-location).
      this.dispatchEvent(new CustomEvent('navigate', { detail: { key }, bubbles: true, composed: true }));
    } else if (dest.href) {
      window.open(dest.href, '_blank', 'noopener');
    }
  }

  _setLoading(btn) {
    if (!btn) return;
    btn.classList.add('is-loading');
    btn.innerHTML = '<span class="btn-spinner"></span>Opening…';
  }

  _card(d) {
    const ext = d.href ? '<span class="tile-ext" title="Opens in a new tab">↗</span>' : '';
    return `
      <div class="tool-tile" data-key="${d.key}">
        ${ext}
        <button class="tile-info" data-info="${d.key}" aria-label="About ${d.name}">i</button>
        <div class="tool-icon"><span class="material-symbols-outlined">${d.icon}</span></div>
        <div class="tile-name">${d.name}</div>
        <div class="tile-pop" data-pop="${d.key}">${d.desc}</div>
      </div>`;
  }

  _render() {
    const root = this.shadowRoot;
    const u = this._user;
    const first = u && (u.firstName || (u.email ? String(u.email).split('@')[0] : ''));
    root.querySelector('[data-headline]').textContent =
      first ? `Welcome back, ${first}` : 'LocDoc Team Portal';
    root.querySelector('[data-cards]').innerHTML = DESTINATIONS.map(d => this._card(d)).join('');
  }
}

customElements.define('home-landing', HomeLanding);
