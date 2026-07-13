/**
 * Wix Custom Element — Company Events  (<annual-events>)
 *
 * The /annualevents page as a git-synced web component: the yearly company events, on the green
 * design system. Display-only and self-contained — any event link opens in a new tab, so no Velo
 * wiring is needed beyond embedding.
 *
 * Content is baked in below (owned here for now; may change later).
 *
 * Editor setup (one time): Add → Embed Code → Custom Element → choose this file, set the tag name
 * to `annual-events`, give the element the ID `annualEvents`, and set the page Members-Only.
 */

import { TOKENS, ensureMaterialSymbols } from './tokens.js';

// Yearly events in calendar order. `href` (optional) links to a details page: a relative path
// stays in-site in the same tab; an absolute URL is treated as external and opens in a new tab.
const EVENTS = [
  { name: 'Family Picnic', season: 'Spring', icon: 'outdoor_grill',
    desc: 'Saturday afternoon at a park — a cookout with burgers, brats, dogs & chicken. Corn hole tournament, bounce house, bike parade, and kite contest.' },
  { name: 'Family Bowling Tournament', season: 'Summer', icon: 'sports_score',
    desc: 'Saturday at the bowling alley. Compete for Highest Team Score, Best Team Uniform, Most Strikes, and Most Splits.' },
  { name: 'Golf Tournament', season: 'Fall', icon: 'golf_course',
    desc: '2-person team, best net score. Saturday at the golf course — Closest to Pin, Farthest Drive, Shortest Drive, and Longest Putt.',
    href: '/golfclassic' },
  { name: 'Christmas Breakfast', season: 'Winter', icon: 'bakery_dining',
    desc: '2nd Wednesday in December.' },
  { name: 'Annual Awards', season: 'Winter', icon: 'emoji_events',
    desc: 'Last Saturday in January.' },
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

  .main { max-width: 900px; margin: 0 auto; padding: 40px 16px 56px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .evt {
    position: relative; background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius);
    box-shadow: var(--shadow); padding: 22px; display: flex; flex-direction: column; gap: 12px;
    transition: border-color .15s, box-shadow .15s, transform .12s;
  }
  .evt:hover { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(var(--primary-rgb),.08), var(--shadow-md); transform: translateY(-2px); }
  .evt-top { display: flex; align-items: center; gap: 14px; }
  .evt-icon { width: 46px; height: 46px; border-radius: var(--radius); flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--icon-chip-bg); color: var(--icon); }
  .evt-icon .material-symbols-outlined { font-size: 24px; }
  .evt-season { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--primary-dk); }
  .evt-name { font-size: 17px; font-weight: 800; color: var(--gray-900); line-height: 1.2; }
  .evt-desc { font-size: 14px; line-height: 1.55; color: var(--gray-600); }
  .evt-link { margin-top: auto; align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--primary); text-decoration: none; }
  .evt-link:hover { text-decoration: underline; }
  .evt-link .material-symbols-outlined { font-size: 16px; }

  @media (max-width: 600px) {
    .header { padding: 12px 16px; } .hero { padding: 32px 16px; } .hero h2 { font-size: 23px; }
    .main { padding: 28px 12px 44px; } .cards { grid-template-columns: 1fr; }
  }
`;

class AnnualEvents extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }

  connectedCallback() {
    ensureMaterialSymbols();
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <header class="header"><h1>Company Events</h1><p>Helping our Customers Protect their People and their Property.</p></header>
      <section class="hero">
        <h2>Our year together</h2>
        <p>The company events we look forward to every year — bring the family and join in.</p>
      </section>
      <main class="main">
        <div class="cards">${EVENTS.map(e => this._card(e)).join('')}</div>
      </main>`;
  }

  _card(e) {
    // Relative href → an in-site page: same tab, and no "opens in a new tab" affordance.
    const external = e.href && !e.href.startsWith('/');
    const link = e.href
      ? (external
        ? `<a class="evt-link" href="${e.href}" target="_blank" rel="noopener">Details <span class="material-symbols-outlined">open_in_new</span></a>`
        : `<a class="evt-link" href="${e.href}" target="_top">Details <span class="material-symbols-outlined">chevron_right</span></a>`)
      : '';
    return `
      <div class="evt">
        <div class="evt-top">
          <div class="evt-icon"><span class="material-symbols-outlined">${e.icon}</span></div>
          <div class="evt-season">${e.season}</div>
        </div>
        <div class="evt-name">${e.name}</div>
        <div class="evt-desc">${e.desc}</div>
        ${link}
      </div>`;
  }
}

customElements.define('annual-events', AnnualEvents);
