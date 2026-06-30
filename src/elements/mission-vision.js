/**
 * Wix Custom Element — Mission & Vision  (<mission-vision>)
 *
 * The company Vision/Traction Organizer (EOS V/TO) as a git-synced web component, replacing the
 * old editor-built /vto page. Lives in src/public/custom-elements/ and syncs through the Wix Git
 * integration — UI changes deploy on `git push`, no manual paste.
 *
 * Display-only: all content is baked in below (content owned here for now; may change later).
 * The only interaction is the "Employee Hub" pill, which dispatches a 'navigate' event for the
 * Velo page to resolve (mirrors home-landing / hub-home). Wiring the pill is optional — if the
 * page code doesn't handle 'navigate', the pill simply does nothing.
 *
 * Editor setup (one time): Add → Embed Code → Custom Element → choose this file, set the tag name
 * to `mission-vision`, and give the element the ID `missionVision`.
 */

import { TOKENS, ensureMaterialSymbols } from './tokens.js';

const VISION = 'Transform the Southeast to a unified and systematized Security Solutions provider through engaging training programs, acquisitions and continued development of digital opening management systems.';
const MISSION = 'We Help our Customers Protect Their People and Their Property.';

// Core Values — "trait / principle" pairs (EOS wall model) with the definitions from
// /core-values, revealed on hover/tap.
const CORE_VALUES = [
  { trait: 'Defined',     value: 'Expectations',   icon: 'crisis_alert',
    desc: "Don't be frustrated with unmet expectations when YOU have not clearly set them. Can the customer or teammate execute the expectations without further explanation?" },
  { trait: 'Consistent',  value: 'Communication',  icon: 'sync',
    desc: "Always communicate clear and important information that will impact our customers and our team." },
  { trait: 'Cultivate',   value: 'Trust',          icon: 'handshake',
    desc: "Start small, have patience and be consistent. Consistency builds trust!" },
  { trait: 'Outrageous',  value: 'Kindness',       icon: 'redeem',
    desc: "Treat team members, customers and your family BETTER than you want to be treated." },
  { trait: 'Courageous',  value: 'Honesty',        icon: 'visibility',
    desc: "Handle the truth with courage early and often. Don't hide things, cover up or keep things from your teammates or customers." },
  { trait: 'Refined',     value: 'Quality',        icon: 'workspace_premium',
    desc: "Factory specifications are met, shortcuts are not taken. Quality over Quantity and customer satisfaction is primary." },
  { trait: 'Unexpected',  value: 'Cleanliness',    icon: 'cleaning_services',
    desc: "Jobsite, workspace, uniforms, tools, products, installations. Everything WE touch, should be left cleaner than when we started." },
  { trait: 'Intentional', value: 'Execution',      icon: 'task_alt',
    desc: "Define what winning looks like and don't give up until it's finished. Prior Planning Prevents Poor Performance." },
];

const CORE_FOCUS = {
  purpose: 'Develops individuals operating as unified teams through training and personal development resources.',
  niche: [
    'Management of Customer Data and Information',
    'Track Service & Key Records on Openings with real time data',
    'Support Property Managers with Single Call Solutions for Lock, Door, Security and Key Card Systems',
  ],
};

const MARKETING = {
  targets: ['Commercial Property Management', 'Community Association Management', 'K-12', 'College / University'],
  uniques: ['Helpful & Kind Communication', 'Fast Response', 'SOLVE the Problem!'],
};

// Shared measurable goals (apply to every horizon).
const MEASURABLES = [
  '90+ Net Promoter Score',
  '<14 Days for Project Completion',
  '8.5+ Morale, Work Load, Stress ratings',
  '90% Time Utilization for Individual Billed Hours',
];

// The three EOS pictures. `met: true` marks a revenue line already achieved.
const PICTURES = [
  {
    key: '1yr', label: "This Year's Picture", year: '2025', profit: '12%',
    revenue: [
      { unit: 'Charlotte', amount: '$6M', met: true },
      { unit: 'Anderson',  amount: '$1M', met: true },
      { unit: 'Asheville', amount: '$1M' },
      { unit: 'Charleston', amount: '$1M' },
      { unit: 'Lab',       amount: '$750k' },
    ],
    total: '$9.75M',
    strategy: [
      'Acquire businesses in existing markets',
      'Establish new corporate structure with main holding corporation and separate entities (Charlotte, Lab, Anderson, Real Estate, Additional Branches)',
    ],
  },
  {
    key: '3yr', label: '3 Year Picture', year: '2028', profit: '13%',
    revenue: [
      { unit: 'Charlotte', amount: '$8M' },
      { unit: 'Anderson',  amount: '$2.5M' },
      { unit: 'Charleston', amount: '$2.5M' },
      { unit: 'RMR',       amount: '$3M' },
      { unit: 'Branch 4',  amount: '$1.5M' },
      { unit: 'Branch 5',  amount: '$1.5M' },
      { unit: 'Branch 6',  amount: '$1M' },
    ],
    total: '$20M',
    strategy: [],
  },
  {
    key: '10yr', label: '10 Year Target', year: '2032', profit: '15%',
    revenue: [
      { unit: 'Charlotte', amount: '$12M' },
      { unit: 'Anderson',  amount: '$4.5M' },
      { unit: 'Charleston', amount: '$4.5M' },
      { unit: 'RMR',       amount: '$5M' },
      { unit: 'Branch 4',  amount: '$2.5M' },
      { unit: 'Branch 5',  amount: '$2.5M' },
      { unit: 'Branch 6',  amount: '$2M' },
      { unit: 'Branch 7',  amount: '$1.5M' },
      { unit: 'Branch 8',  amount: '$1M' },
    ],
    total: '$35.5M',
    strategy: [
      'Acquire businesses in existing markets',
      'Implement franchise/branch ownership model',
      'Establish sales structure with sales trainer',
      'Create dedicated rotating training program',
    ],
  },
];

// Regional target maps (NC/SC/GA/FL with city pins) per horizon. Values are public Wix media URLs
// (the static.wixstatic.com form of a `wix:image://v1/<id>/<file>` reference). Leave '' to hide a
// horizon's image. NOTE: all three currently point at the same "Southeast 2024" map — the intent
// is to give 3yr/10yr their own versions with the expanded branch pins once those are created.
const SE_MAP_2024 = 'https://static.wixstatic.com/media/590ac2_495991a216cc4e85978b9d1976eaa101~mv2.png';
const MAP_URLS = {
  '1yr': SE_MAP_2024,
  '3yr': SE_MAP_2024,
  '10yr': SE_MAP_2024,
};

const ROCKS = {
  q1: [
    'ESA (Extended Service Agreements)',
    'Customer Utilization analysis',
    'Increase utilization of 5 major service offerings',
    'Acquisition activities',
  ],
  rest: 'Q2–Q4 objectives in progress.',
};

const STYLES = `
  ${TOKENS}
  :host { background: var(--gray-50); }

  .header {
    background: var(--primary); color: #fff; padding: 14px 24px; box-shadow: var(--shadow-md);
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
  }
  .brand h1 { font-size: 18px; font-weight: 700; }
  .brand p  { font-size: 12px; opacity: .75; margin-top: 2px; }
  /* Hero — Vision + Mission */
  .hero { background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dk) 100%); color: #fff; padding: 52px 24px; text-align: center; }
  .hero .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; opacity: .85; margin-bottom: 14px; }
  .hero .vision { font-size: 26px; font-weight: 800; line-height: 1.3; max-width: 820px; margin: 0 auto; }
  .hero .mission-wrap { margin-top: 26px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.22); max-width: 640px; margin-left: auto; margin-right: auto; }
  .hero .mission-label { font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; opacity: .85; margin-bottom: 8px; }
  .hero .mission { font-size: 18px; font-weight: 600; line-height: 1.5; }

  .main { max-width: 1000px; margin: 0 auto; padding: 44px 16px 56px; }
  .section { margin-bottom: 44px; }
  .section-title {
    font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
    color: var(--gray-400); padding-bottom: 12px; margin-bottom: 22px; border-bottom: 1px solid var(--gray-200);
  }

  /* Core Values — seamless mosaic of tall centered tiles; tiles alternate white / light-green.
     Refined Material Symbols line-art glyph on top, two-line UPPERCASE title, definition below. */
  .values-grid {
    display: grid; grid-template-columns: repeat(4, 1fr);
    border: 1.5px solid var(--gray-200); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow);
  }
  .value-card {
    background: #fff; padding: 30px 22px 28px; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  .value-card:nth-child(even) { background: var(--icon-chip-bg); }
  .value-glyph.material-symbols-outlined {
    font-size: 46px; color: var(--primary-dk);
    font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48;
  }
  .value-title { display: flex; flex-direction: column; gap: 3px; }
  .vt-trait { font-size: 12px; font-weight: 400; letter-spacing: .2em; text-transform: uppercase; color: var(--gray-600); }
  .vt-name  { font-size: 18px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--gray-900); line-height: 1.1; }
  .value-desc { font-size: 13.5px; line-height: 1.55; color: var(--gray-600); max-width: 26ch; }

  /* Generic content cards */
  .cards { display: grid; gap: 16px; }
  .cards.two { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .cards.three { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .info-card { background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius); box-shadow: var(--shadow); padding: 22px; }
  .info-card h3 { font-size: 13px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--primary-dk); margin-bottom: 12px; }
  .info-card p { font-size: 15px; line-height: 1.55; color: var(--gray-900); }
  .info-card ul { list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .info-card li { font-size: 14px; line-height: 1.5; color: var(--gray-900); padding-left: 22px; position: relative; }
  .info-card li::before { content: '›'; position: absolute; left: 6px; color: var(--primary); font-weight: 700; }
  .info-card ol { list-style: none; counter-reset: u; display: flex; flex-direction: column; gap: 8px; }
  .info-card ol li { counter-increment: u; padding-left: 30px; }
  .info-card ol li::before { content: counter(u); left: 0; top: 0; width: 20px; height: 20px; border-radius: 50%; background: var(--primary); color: #fff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; }

  /* Picture cards (1yr / 3yr / 10yr) */
  .pic-card { background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius); box-shadow: var(--shadow); overflow: hidden; display: flex; flex-direction: column; }
  .pic-head { background: var(--surface); padding: 16px 20px; border-bottom: 1px solid var(--gray-200); }
  .pic-head .label { font-size: 14px; font-weight: 700; color: var(--gray-900); }
  .pic-head .year { font-size: 12px; font-weight: 700; color: var(--primary-dk); letter-spacing: .08em; }
  .pic-map { background: var(--gray-50); border-bottom: 1px solid var(--gray-200); padding: 12px; }
  .pic-map img { display: block; width: 100%; height: auto; object-fit: contain; }
  .pic-body { padding: 18px 20px; display: flex; flex-direction: column; gap: 16px; }
  .rev-row { display: flex; align-items: center; justify-content: space-between; font-size: 14px; padding: 5px 0; border-bottom: 1px dashed var(--gray-200); }
  .rev-row:last-of-type { border-bottom: none; }
  .rev-unit { color: var(--gray-600); display: inline-flex; align-items: center; gap: 6px; }
  .rev-unit .met { color: var(--success); font-size: 16px; line-height: 1; }
  .rev-amt { font-weight: 700; color: var(--gray-900); }
  .rev-total { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; padding: 10px 12px; background: var(--icon-chip-bg); border-radius: var(--radius-sm); }
  .rev-total .t-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--primary-dk); }
  .rev-total .t-amt { font-size: 18px; font-weight: 800; color: var(--primary-dk); }
  .pic-meta { font-size: 13px; color: var(--gray-600); }
  .pic-meta b { color: var(--gray-900); }
  .pic-strat { font-size: 13px; line-height: 1.5; color: var(--gray-900); list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .pic-strat li { padding-left: 18px; position: relative; }
  .pic-strat li::before { content: '›'; position: absolute; left: 4px; color: var(--primary); font-weight: 700; }
  .sub-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--gray-400); margin-bottom: 6px; }

  .note { font-size: 13px; color: var(--gray-600); font-style: italic; margin-top: 4px; }

  @media (max-width: 880px) { .values-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 600px) {
    .header { padding: 12px 16px; }
    .hero { padding: 40px 16px; }
    .hero .vision { font-size: 21px; }
    .main { padding: 32px 12px 44px; }
    .values-grid { grid-template-columns: 1fr; }
  }
`;

class MissionVision extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    ensureMaterialSymbols();
    this._render();
  }

  _valueCard(v) {
    return `
      <div class="value-card">
        <span class="value-glyph material-symbols-outlined">${v.icon}</span>
        <div class="value-title">
          <span class="vt-trait">${v.trait}</span>
          <span class="vt-name">${v.value}</span>
        </div>
        <p class="value-desc">${v.desc}</p>
      </div>`;
  }

  _picCard(p) {
    const rows = p.revenue.map(r => `
      <div class="rev-row">
        <span class="rev-unit">${r.unit}${r.met ? '<span class="met material-symbols-outlined">check_circle</span>' : ''}</span>
        <span class="rev-amt">${r.amount}</span>
      </div>`).join('');
    const strat = p.strategy.length ? `
      <div>
        <div class="sub-label">Strategic Direction</div>
        <ul class="pic-strat">${p.strategy.map(s => `<li>${s}</li>`).join('')}</ul>
      </div>` : '';
    const mapUrl = MAP_URLS[p.key];
    const map = mapUrl ? `<div class="pic-map"><img src="${mapUrl}" alt="${p.label} target markets — NC, SC, GA, FL" loading="lazy"></div>` : '';
    return `
      <div class="pic-card">
        <div class="pic-head"><div class="label">${p.label}</div><div class="year">${p.year}</div></div>
        ${map}
        <div class="pic-body">
          <div>
            <div class="sub-label">Revenue Targets</div>
            ${rows}
            <div class="rev-total"><span class="t-label">Total</span><span class="t-amt">${p.total}</span></div>
          </div>
          <div class="pic-meta"><b>Profit:</b> Maintain ${p.profit} across all business units</div>
          ${strat}
        </div>
      </div>`;
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <header class="header">
        <div class="brand"><h1>Mission &amp; Vision</h1><p>Vision / Traction Organizer™</p></div>
      </header>

      <section class="hero">
        <div class="eyebrow">Our Vision</div>
        <div class="vision">${VISION}</div>
        <div class="mission-wrap">
          <div class="mission-label">Our Mission</div>
          <div class="mission">${MISSION}</div>
        </div>
      </section>

      <main class="main">
        <section class="section">
          <div class="section-title">Core Values</div>
          <div class="values-grid">${CORE_VALUES.map(v => this._valueCard(v)).join('')}</div>
        </section>

        <section class="section">
          <div class="section-title">Core Focus</div>
          <div class="cards two">
            <div class="info-card"><h3>Purpose / Cause / Passion</h3><p>${CORE_FOCUS.purpose}</p></div>
            <div class="info-card"><h3>Our Niche</h3><ul>${CORE_FOCUS.niche.map(n => `<li>${n}</li>`).join('')}</ul></div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">Marketing Strategy</div>
          <div class="cards two">
            <div class="info-card"><h3>Target Market</h3><ul>${MARKETING.targets.map(t => `<li>${t}</li>`).join('')}</ul></div>
            <div class="info-card"><h3>3 Uniques</h3><ol>${MARKETING.uniques.map(u => `<li>${u}</li>`).join('')}</ol></div>
          </div>
        </section>

        <section class="section">
          <div class="section-title">The Picture — 1 / 3 / 10 Years</div>
          <div class="cards three">${PICTURES.map(p => this._picCard(p)).join('')}</div>
          <div class="info-card" style="margin-top:16px">
            <h3>Measurable Goals — every horizon</h3>
            <ul>${MEASURABLES.map(m => `<li>${m}</li>`).join('')}</ul>
          </div>
        </section>

        <section class="section">
          <div class="section-title">Quarterly Objectives (Rocks)</div>
          <div class="cards two">
            <div class="info-card"><h3>Q1 · Jan–Mar</h3><ul>${ROCKS.q1.map(r => `<li>${r}</li>`).join('')}</ul></div>
            <div class="info-card"><h3>Q2–Q4</h3><p class="note">${ROCKS.rest}</p></div>
          </div>
        </section>
      </main>`;
  }
}

customElements.define('mission-vision', MissionVision);
