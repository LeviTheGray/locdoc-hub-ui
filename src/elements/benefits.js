/**
 * Wix Custom Element — Employee Benefits  (<employee-benefits>)
 *
 * The /employee-benefits page: a small menu that points to each benefit's resource. Benefits is an
 * umbrella, so this stays a set of sub-links (Healthcare, Retirement, Holidays, Paid Time Off) that
 * open the relevant resource in-site. Display-only and self-contained (links are in-site anchors).
 *
 * ⚠️ CONFIRM THE LINKS: the `href` deep-links assume the Resources hub can find each doc by title
 * (/resources?doc=<title>). Make sure each `doc=` value matches the resource's title in the
 * ProcessPoliciesTutorials collection (case-insensitive contains). Holidays points at /holidays.
 *
 * Editor setup (one time): Add → Embed Code → Custom Element → choose this file, tag name
 * `employee-benefits`, element ID `employeeBenefits`, page Members-Only.
 */

import { TOKENS, ensureMaterialSymbols } from './tokens.js';

// Each benefit → where it lives. In-site links (open same tab). `note` optional small tag.
const BENEFITS = [
  { name: 'Healthcare',     desc: 'Medical, dental and vision plans and coverage details.', icon: 'local_hospital', href: '/resources?doc=Healthcare' },
  { name: 'Retirement',     desc: '401(k) and retirement savings information.',              icon: 'savings',        href: '/resources?doc=Retirement' },
  { name: 'Holidays',       desc: 'Paid company holidays and this year’s schedule.',         icon: 'calendar_month', href: '/holidays' },
  { name: 'Paid Time Off',  desc: 'PTO accrual, how to request, and approvals.',             icon: 'beach_access',   href: '/resources?doc=Paid%20Time%20Off' },
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
  .ben {
    background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius); box-shadow: var(--shadow);
    padding: 22px; display: flex; flex-direction: column; gap: 12px; text-decoration: none; color: inherit;
    transition: border-color .15s, box-shadow .15s, transform .12s; -webkit-tap-highlight-color: transparent;
  }
  .ben:hover { border-color: var(--primary); box-shadow: 0 0 0 4px rgba(var(--primary-rgb),.08), var(--shadow-md); transform: translateY(-2px); }
  .ben:active { transform: scale(.99); }
  .ben-top { display: flex; align-items: center; gap: 14px; }
  .ben-icon { width: 46px; height: 46px; border-radius: var(--radius); flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--icon-chip-bg); color: var(--icon); }
  .ben-icon .material-symbols-outlined { font-size: 24px; }
  .ben-name { font-size: 17px; font-weight: 800; color: var(--gray-900); line-height: 1.2; }
  .ben-desc { font-size: 14px; line-height: 1.55; color: var(--gray-600); }
  .ben-go { margin-top: auto; display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: var(--primary); }
  .ben-go .material-symbols-outlined { font-size: 16px; }

  @media (max-width: 600px) {
    .header { padding: 12px 16px; } .hero { padding: 32px 16px; } .hero h2 { font-size: 23px; }
    .main { padding: 28px 12px 44px; } .cards { grid-template-columns: 1fr; }
  }
`;

class EmployeeBenefits extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }

  connectedCallback() {
    ensureMaterialSymbols();
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <header class="header"><h1>My Benefits</h1><p>LocDoc · Employee benefits</p></header>
      <section class="hero">
        <h2>Your benefits</h2>
        <p>Everything you get as part of the team — pick a topic to see the details.</p>
      </section>
      <main class="main">
        <div class="cards">${BENEFITS.map(b => this._card(b)).join('')}</div>
      </main>`;
  }

  _card(b) {
    return `
      <a class="ben" href="${b.href}">
        <div class="ben-top">
          <div class="ben-icon"><span class="material-symbols-outlined">${b.icon}</span></div>
          <div class="ben-name">${b.name}</div>
        </div>
        <div class="ben-desc">${b.desc}</div>
        <span class="ben-go">Open <span class="material-symbols-outlined">chevron_right</span></span>
      </a>`;
  }
}

customElements.define('employee-benefits', EmployeeBenefits);
