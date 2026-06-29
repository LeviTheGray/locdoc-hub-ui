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
export const TOKENS = `
  :host {
    --green: #15803d; --green-dk: #166534; --green-lt: #10b981;
    --gray-50: #f9fafb; --gray-100: #f3f4f6; --gray-200: #e5e7eb;
    --gray-400: #9ca3af; --gray-600: #4b5563; --gray-900: #111827;
    --radius: 10px;
    --shadow: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06);
    --shadow-md: 0 4px 6px -1px rgba(0,0,0,.1);
    display: block;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: var(--gray-900);
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
`;

// Reusable component patterns shared across the hub (green header bar, card, icon chip, button,
// loading spinner). Element-specific layout still lives in each element.
export const COMPONENTS = `
  .header { background: var(--green); color: #fff; padding: 16px 24px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p  { font-size: 12px; opacity: .75; margin-top: 2px; }

  .card { background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius); box-shadow: var(--shadow); }

  .icon-chip { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
  .icon-chip.green { background: #d1fae5; } .icon-chip.blue { background: #dbeafe; } .icon-chip.amber { background: #fef3c7; }
  .icon-chip.purple { background: #ede9fe; } .icon-chip.pink { background: #fce7f3; } .icon-chip.red { background: #fee2e2; }
  .icon-chip.teal { background: #ccfbf1; } .icon-chip.indigo { background: #e0e7ff; }

  .btn {
    display: inline-block; padding: 10px 16px; background: var(--green); color: #fff; border: none;
    border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; text-align: center;
    transition: background .15s, transform .08s;
  }
  .btn:hover { background: var(--green-dk); }
  .btn:active { transform: scale(.97); }
  .btn.is-loading { background: var(--green-dk); cursor: default; opacity: .85; pointer-events: none; }

  .btn-spinner { display: inline-block; width: 13px; height: 13px; margin-right: 7px; vertical-align: -2px; border: 2px solid rgba(255,255,255,.5); border-top-color: #fff; border-radius: 50%; animation: btnspin .6s linear infinite; }
  @keyframes btnspin { to { transform: rotate(360deg); } }
`;

// Convenience: compose tokens + shared components + element-specific CSS into one stylesheet.
export function styles(...extra) {
  return `${TOKENS}${COMPONENTS}${extra.join('\n')}`;
}
