/**
 * Wix Custom Element — Team Meetings  (<team-meetings>)
 *
 * The /meetings page as a git-synced web component: the recurring team meeting links (Google Meet),
 * on the green design system. Display-only and self-contained — "Join" links open Google Meet in a
 * new tab, so no Velo wiring is needed beyond embedding.
 *
 * Content is baked in below (owned here for now; may change later).
 *
 * Editor setup (one time): Add → Embed Code → Custom Element → choose this file, set the tag name
 * to `team-meetings`, give the element the ID `teamMeetings`, and set the page Members-Only.
 */

import { TOKENS, ensureMaterialSymbols } from './tokens.js';

// Recurring meetings. `url` is the Google Meet link (opens in a new tab).
const MEETINGS = [
  { name: 'Monday Meeting',     when: 'Mondays · 7:45 AM',        audience: 'All Team', icon: 'groups',   url: 'https://meet.google.com/iwu-yqcv-wwh' },
  { name: 'Wednesday Meeting',  when: 'Wednesdays · 7:00 AM',     audience: 'All Team', tag: 'Video', icon: 'videocam', url: 'https://meet.google.com/iep-vcwm-ifs' },
  { name: 'Wednesday Breakout', when: 'Wednesdays · Huddle Room', audience: '',         icon: 'forum',    url: 'https://meet.google.com/txt-qydw-ssu' },
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

  .main { max-width: 860px; margin: 0 auto; padding: 40px 16px 56px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
  .mtg {
    background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius); box-shadow: var(--shadow);
    padding: 22px; display: flex; flex-direction: column; gap: 14px;
    transition: border-color .15s, box-shadow .15s, transform .12s;
  }
  .mtg:hover { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(var(--primary-rgb),.08), var(--shadow-md); transform: translateY(-2px); }
  .mtg-top { display: flex; align-items: center; gap: 14px; }
  .mtg-icon { width: 46px; height: 46px; border-radius: var(--radius); flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--icon-chip-bg); color: var(--icon); }
  .mtg-icon .material-symbols-outlined { font-size: 24px; }
  .mtg-name { font-size: 16px; font-weight: 700; color: var(--gray-900); line-height: 1.25; }
  .mtg-when { font-size: 13px; color: var(--gray-600); margin-top: 2px; }
  .mtg-meta { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill { font-size: 11px; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; background: var(--icon-chip-bg); color: var(--primary-dk); }
  .join {
    margin-top: auto; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    background: var(--primary); color: #fff; text-decoration: none; border-radius: var(--radius-sm);
    padding: 11px 16px; font-size: 14px; font-weight: 700; transition: background .15s, transform .08s;
  }
  .join:hover { background: var(--primary-dk); } .join:active { transform: scale(.98); }
  .join .material-symbols-outlined { font-size: 18px; }

  @media (max-width: 600px) {
    .header { padding: 12px 16px; } .hero { padding: 32px 16px; } .hero h2 { font-size: 23px; }
    .main { padding: 28px 12px 44px; } .cards { grid-template-columns: 1fr; }
  }
`;

class TeamMeetings extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }

  connectedCallback() {
    ensureMaterialSymbols();
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <header class="header"><h1>Team Meetings</h1><p>Helping our Customers Protect their People and their Property.</p></header>
      <section class="hero">
        <h2>Join a meeting</h2>
        <p>Recurring team meetings and their Google Meet links. Add them to your calendar so you never miss one.</p>
      </section>
      <main class="main">
        <div class="cards">${MEETINGS.map(m => this._card(m)).join('')}</div>
      </main>`;
  }

  _card(m) {
    const tag = m.tag ? `<span class="pill">${m.tag}</span>` : '';
    const aud = m.audience ? `<span class="pill">${m.audience}</span>` : '';
    return `
      <div class="mtg">
        <div class="mtg-top">
          <div class="mtg-icon"><span class="material-symbols-outlined">${m.icon}</span></div>
          <div>
            <div class="mtg-name">${m.name}</div>
            <div class="mtg-when">${m.when}</div>
          </div>
        </div>
        <div class="mtg-meta">${aud}${tag}</div>
        <a class="join" href="${m.url}" target="_blank" rel="noopener">
          <span class="material-symbols-outlined">videocam</span> Join now
        </a>
      </div>`;
  }
}

customElements.define('team-meetings', TeamMeetings);
