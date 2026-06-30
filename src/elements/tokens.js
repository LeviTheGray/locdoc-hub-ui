/**
 * Design tokens + shared component CSS — SOURCE OF TRUTH for the hub look.
 *
 * These were previously copy-pasted into every custom element's `STYLES` string. They now live
 * here once and are composed into each element. Exported as plain strings so they work in any
 * environment (Wix custom elements, the standalone app's web components, even a docs page).
 *
 * Usage in an element:
 *   import { TOKENS, COMPONENTS } from 'locdoc-hub-ui/tokens';
 *   const STYLES = `${TOKENS}${COMPONENTS} .my-extra { ... }`;
 *   this.shadowRoot.innerHTML = `<style>${STYLES}</style> …`;
 *
 * NOTE: whether Wix's custom-element runtime supports importing this module at runtime is still
 * to be validated. If it doesn't, scripts/sync-to-teamwix.mjs will inline these strings into the
 * generated element copies instead — the source of truth stays here either way.
 */

// Brand palette + spacing/shadow tokens, scoped to the shadow root via :host.
// Built on the OMS3 design standard (see DESIGN_SYSTEM.md) — same tone/contrast relationships —
// but re-hued to LocDoc green (OMS3's secondary.main #64984f) as the primary brand color, since
// the company is green internally. Slate-blue is kept available as --accent-slate.
export const TOKENS = `
  :host {
    /* Brand — LocDoc green primary (OMS3 green tones). --green kept as an alias so older element
       CSS that references it keeps working. --primary-rgb mirrors --primary for rgba() glows. */
    --primary: #64984f; --primary-dk: #4f7a3f; --primary-lt: #82b06d; --primary-rgb: 100,152,79;
    --secondary: #4f6498; --green: #64984f; --green-dk: #4f7a3f; --green-lt: #82b06d;
    --accent-slate: #4f6498; --accent-violet: #5F4F98; --accent-teal: #4F8898; --accent-rust: #985F4F;

    /* Icon tint — green to match the brand (same dark-glyph-on-light-chip contrast as OMS). */
    --icon: #4f7a3f; --icon-chip-bg: #e2ece0;

    /* Surfaces — repeater convention */
    --surface: #F4F4F8;    /* repeater.main      */
    --bg: #fefefe;         /* background.default */
    --header-bar: #4f7a3f; /* green header bar (OMS3 dark-theme headerBar tone) */
    --white: #fefefe;      /* common.white (intentionally not pure white) */

    --gray-50: #f9fafb; --gray-100: #f3f4f6; --gray-200: #e5e7eb;
    --gray-400: #9ca3af; --gray-600: #4b5563; --gray-900: #111827;

    /* Status — OMS semantic set */
    --error: #A81C07; --success: #2e7d32; --warning: #ed6c02; --info: #0288d1;

    /* Shape — OMS radius 1–2 units (4–8px) */
    --radius: 8px; --radius-sm: 4px;
    --shadow: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06);
    --shadow-md: 0 4px 6px -1px rgba(0,0,0,.1);
    display: block;
    /* OMS font is Open Sans; system stack remains the guaranteed fallback. */
    font-family: 'Open Sans', 'Helvetica', 'Arial', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: var(--gray-900);
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* Material Symbols glyphs (OMS icon strategy). The font is loaded once into the document
     head by ensureMaterialSymbols() — @font-face is global so it pierces the shadow root.
     Until it loads, the ligature text is hidden to avoid a flash of the raw word. */
  .material-symbols-outlined {
    font-family: 'Material Symbols Outlined'; font-weight: normal; font-style: normal;
    line-height: 1; letter-spacing: normal; text-transform: none; white-space: nowrap;
    word-wrap: normal; direction: ltr; display: inline-block; font-size: inherit;
    -webkit-font-smoothing: antialiased; -webkit-font-feature-settings: 'liga';
    font-feature-settings: 'liga'; font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }
`;

// Reusable component patterns shared across the hub (green header bar, card, icon chip, button,
// loading spinner). Element-specific layout still lives in each element.
export const COMPONENTS = `
  .header { background: var(--header-bar); color: var(--white); padding: 16px 24px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p  { font-size: 12px; opacity: .75; margin-top: 2px; }

  .card { background: var(--surface); border: 1.5px solid var(--gray-200); border-radius: var(--radius); box-shadow: var(--shadow); }

  /* Icon-chip tints mapped to the OMS brand accents (slate/green/violet/teal/rust);
     amber/red reserved for warning/error intent. blue → primary slate. */
  .icon-chip { width: 48px; height: 48px; border-radius: var(--radius); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
  .icon-chip.green { background: #e2ece0; } .icon-chip.blue { background: #e2e7f0; } .icon-chip.amber { background: #fef3c7; }
  .icon-chip.purple { background: #e6e2f0; } .icon-chip.pink { background: #f0e2ec; } .icon-chip.red { background: #f4e0dd; }
  .icon-chip.teal { background: #e0ecef; } .icon-chip.indigo { background: #e2e7f0; }

  .btn {
    display: inline-block; padding: 10px 16px; background: var(--primary); color: var(--white); border: none;
    border-radius: var(--radius-sm); font-size: 14px; font-weight: 600; cursor: pointer; text-align: center;
    transition: background .15s, transform .08s;
  }
  .btn:hover { background: var(--primary-dk); }
  .btn:active { transform: scale(.97); }
  .btn.is-loading { background: var(--primary-dk); cursor: default; opacity: .85; pointer-events: none; }

  .btn-spinner { display: inline-block; width: 13px; height: 13px; margin-right: 7px; vertical-align: -2px; border: 2px solid rgba(255,255,255,.5); border-top-color: #fff; border-radius: 50%; animation: btnspin .6s linear infinite; }
  @keyframes btnspin { to { transform: rotate(360deg); } }
`;

// Convenience: compose tokens + shared components + element-specific CSS into one stylesheet.
export function styles(...extra) {
  return `${TOKENS}${COMPONENTS}${extra.join('\n')}`;
}

// Material Symbols loader (OMS icon strategy). Injects the Google Fonts stylesheet once into the
// document head; @font-face is not scoped to a shadow root, so the glyph spans render inside every
// element. Idempotent and SSR-safe — call from each element's connectedCallback().
export function ensureMaterialSymbols() {
  if (typeof document === 'undefined') return;
  const ID = 'locdoc-material-symbols';
  if (document.getElementById(ID)) return;
  const link = document.createElement('link');
  link.id = ID;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
  document.head.appendChild(link);
}
