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

import { TOKENS } from './tokens.js';

// Internal destinations (handled by Velo via the 'navigate' event) must list their key here.
const INTERNAL_KEYS = ['hub'];

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
    href: 'https://team.locdoc.net/meetings',
    icon: '🗓️',
    iconClass: 'green', 
    name: 'Weekly Meetings',
    desc: 'Weekly Meeting Links',
    btnText: 'Go to Meetings' 
  },
  { 
    key: 'oms', 
    href: 'https://app.openingmanagement.com', 
    icon: '🛠️', 
    iconClass: 'blue', 
    name: 'OMS',
    desc: 'Open the operations management system.',
    btnText: 'Open OMS' 
  },
  { 
    key: 'profit-sharing', 
    href: 'https://team.locdoc.net/profitsharing', 
    icon: '💰', 
    iconClass: 'amber', 
    name: 'Profit Sharing',
    desc: 'Information and updates regarding the employee profit sharing program.',
    btnText: 'View Profit Sharing' 
  },
  { 
    key: 'benefits', 
    href: 'https://team.locdoc.net/employee-benefits', 
    icon: '🏥', 
    iconClass: 'purple', 
    name: 'My Benefits',
    desc: 'Access your health, dental, and other employee benefits information.',
    btnText: 'View Benefits' 
  },
  { 
    key: 'events', 
    href: 'https://team.locdoc.net/annualevents', 
    icon: '🎉', 
    iconClass: 'pink', 
    name: 'Company Events',
    desc: 'Stay up to date on annual company gatherings and upcoming events.',
    btnText: 'View Events' 
  },
  { 
    key: 'mission-vision', 
    href: 'https://team.locdoc.net/vto', 
    icon: '🎯', 
    iconClass: 'red', 
    name: 'Mission & Vision',
    desc: 'Read about our core values, mission, and long-term vision.',
    btnText: 'View Mission & Vision' 
  },
  { 
    key: 'policies', 
    href: 'https://team.locdoc.net/resource', 
    icon: '📋', 
    iconClass: 'teal', 
    name: 'Policies',
    desc: 'Important company policies, guidelines, and internal resources.',
    btnText: 'View Policies' 
  },
  { 
    key: 'handbook', 
    href: 'https://drive.google.com/file/d/1vyxYUy9d72Q55s3kofm9NRTSoVuvCk9R/view?usp=sharing', 
    icon: '📖', 
    iconClass: 'indigo', 
    name: 'Employee Handbook',
    desc: 'Read the official employee handbook for general rules and expectations.',
    btnText: 'Open Handbook' 
  },
  { 
    key: 'nexus-hub', 
    href: 'https://team.locdoc.net/nexus', // Placeholder - update with the real URL
    icon: '🖥️', 
    iconClass: 'cyan', 
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
    background: var(--green); color: #fff; padding: 14px 24px; box-shadow: var(--shadow-md);
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
    background: linear-gradient(135deg, var(--green) 0%, var(--green-dk) 100%);
    color: #fff; padding: 56px 24px; text-align: center;
  }
  .hero .wordmark { font-size: 13px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; opacity: .85; margin-bottom: 14px; }
  .hero h2 { font-size: 34px; font-weight: 800; line-height: 1.2; max-width: 720px; margin: 0 auto; }
  .hero p  { font-size: 16px; opacity: .92; margin: 14px auto 28px; max-width: 560px; line-height: 1.5; }
  .hero-cta {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    background: #fff; color: var(--green-dk); border: none; border-radius: 8px;
    padding: 13px 28px; font-size: 15px; font-weight: 700; cursor: pointer;
    box-shadow: var(--shadow-md); transition: transform .08s, box-shadow .15s, background .15s;
  }
  .hero-cta:hover { background: var(--gray-100); }
  .hero-cta:active { transform: scale(.97); }
  .hero-cta.is-loading { cursor: default; opacity: .85; pointer-events: none; }
  .hero-cta .btn-spinner { border-color: rgba(21,128,61,.35); border-top-color: var(--green-dk); }

  /* Calendar band */
  .cal-band { max-width: 980px; margin: 0 auto; padding: 36px 16px 0; }
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
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; }
  .tool-card {
    background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius); padding: 24px;
    box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px;
    transition: border-color .15s, box-shadow .15s, transform .12s;
  }
  .tool-card:hover { border-color: var(--green); box-shadow: 0 0 0 4px rgba(21,128,61,.08), var(--shadow-md); transform: translateY(-2px); }
  .tool-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
  .tool-icon.green { background: #d1fae5; } .tool-icon.blue { background: #dbeafe; } .tool-icon.amber { background: #fef3c7; }
  .tool-icon.purple { background: #ede9fe; } .tool-icon.pink { background: #fce7f3; } .tool-icon.red { background: #fee2e2; }
  .tool-icon.teal { background: #ccfbf1; } .tool-icon.indigo { background: #e0e7ff; }
  .tool-name { font-size: 16px; font-weight: 700; }
  .tool-desc { font-size: 13px; color: var(--gray-600); line-height: 1.5; flex: 1; }
  .tool-btn {
    display: block; width: 100%; padding: 10px 0; background: var(--green); color: #fff; border: none;
    border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; text-align: center; margin-top: 4px;
    transition: background .15s, transform .08s;
  }
  .tool-btn:hover { background: var(--green-dk); }
  .tool-btn:active { transform: scale(.97); }
  .tool-btn.is-loading { background: var(--green-dk); cursor: default; opacity: .85; pointer-events: none; }
  .btn-spinner { display: inline-block; width: 13px; height: 13px; margin-right: 7px; vertical-align: -2px; border: 2px solid rgba(255,255,255,.5); border-top-color: #fff; border-radius: 50%; animation: btnspin .6s linear infinite; }
  @keyframes btnspin { to { transform: rotate(360deg); } }

  @media (max-width: 600px) {
    .header { padding: 12px 16px; }
    .hero { padding: 40px 16px; }
    .hero h2 { font-size: 26px; }
    .main { padding: 32px 12px 44px; }
    .cards { grid-template-columns: 1fr; }
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
      ${CALENDAR_EMBED_SRC ? `
      <section class="cal-band">
        <div class="cal-frame">
          <iframe src="${CALENDAR_EMBED_SRC}" title="Team Calendar" loading="lazy" scrolling="no"></iframe>
        </div>
      </section>` : ''}
      <main class="main">
        <div class="grid-title">Destinations</div>
        <div class="cards" data-cards></div>
      </main>`;
    this.shadowRoot.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-key]');
      if (btn) this._go(btn.getAttribute('data-key'), btn);
    });
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
    return `
      <div class="tool-card">
        <div class="tool-icon ${d.iconClass}">${d.icon}</div>
        <div class="tool-name">${d.name}</div>
        <div class="tool-desc">${d.desc}</div>
        <button class="tool-btn" data-key="${d.key}">${d.btnText}</button>
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
