/**
 * Wix Custom Element — Core Values  (<core-values>)
 *
 * The standalone /core-values page as a git-synced web component, replacing the old editor-built
 * layout. Shares the trait/principle data, definitions, icons, and mosaic styling with
 * <mission-vision> via core-values-data.js — edit the values once there, both pages update.
 *
 * Display-only and self-contained. Syncs through the Wix Git integration — deploys on `git push`.
 *
 * Editor setup (one time): Add → Embed Code → Custom Element → choose this file, set the tag name
 * to `core-values`, and give the element the ID `coreValues`.
 */

import { TOKENS, ensureMaterialSymbols } from './tokens.js';
import { CORE_VALUES, CORE_VALUES_CSS, valueCardHTML } from './core-values-data.js';

const STYLES = `
  ${TOKENS}
  :host { background: var(--gray-50); }

  .header { background: var(--primary); color: #fff; padding: 14px 24px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p  { font-size: 12px; opacity: .75; margin-top: 2px; }

  .hero { background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dk) 100%); color: #fff; padding: 48px 24px; text-align: center; }
  .hero .eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; opacity: .85; margin-bottom: 12px; }
  .hero h2 { font-size: 30px; font-weight: 800; line-height: 1.2; }
  .hero p  { font-size: 16px; opacity: .92; margin: 12px auto 0; max-width: 560px; line-height: 1.5; }

  .main { max-width: 1000px; margin: 0 auto; padding: 44px 16px 56px; }

  ${CORE_VALUES_CSS}

  @media (max-width: 600px) {
    .header { padding: 12px 16px; }
    .hero { padding: 36px 16px; }
    .hero h2 { font-size: 24px; }
    .main { padding: 28px 12px 44px; }
  }
`;

class CoreValues extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    ensureMaterialSymbols();
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <header class="header"><h1>Core Values</h1><p>LocDoc · What we stand for</p></header>
      <section class="hero">
        <div class="eyebrow">Loc-Doc Inc. Core Values</div>
        <h2>The standards we hold each other to.</h2>
        <p>Eight values that define how we work, treat each other, and serve our customers.</p>
      </section>
      <main class="main">
        <div class="values-grid">${CORE_VALUES.map(valueCardHTML).join('')}</div>
      </main>`;
  }
}

customElements.define('core-values', CoreValues);
