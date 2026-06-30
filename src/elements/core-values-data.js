/**
 * Shared Core Values data — SINGLE SOURCE OF TRUTH for the company core values.
 *
 * Consumed by both <mission-vision> (the V/TO page) and <core-values> (the standalone
 * /core-values page) so the trait/principle pairs, icons, and definitions can't drift between
 * the two. Edit here; both elements pick it up. (Listed in scripts/sync-to-teamwix.mjs so the
 * sibling import resolves at Wix runtime.)
 *
 * `icon` values are Material Symbols Outlined glyph names. Order matches the printed wall model.
 */
export const CORE_VALUES = [
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

// Shared CSS for the Core Values mosaic (the grid + tiles). Composed into an element's <style>
// after TOKENS. Keeps the look identical across <mission-vision> and <core-values>.
export const CORE_VALUES_CSS = `
  /* Core Values — seamless mosaic of tall centered tiles; tiles alternate white / light-green.
     Refined Material Symbols line-art glyph on top, two-line UPPERCASE title, definition below. */
  .values-grid {
    display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px;
    background: var(--gray-200); border: 1.5px solid var(--gray-200);
    border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow);
  }
  .value-card {
    background: #fff; padding: 30px 22px 28px; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  /* True 4-col checkerboard (period of 8): green tiles at positions 2,4,5,7. */
  @media (min-width: 881px) {
    .value-card:nth-child(8n+2), .value-card:nth-child(8n+4),
    .value-card:nth-child(8n+5), .value-card:nth-child(8n+7) { background: var(--icon-chip-bg); }
  }
  .value-glyph.material-symbols-outlined {
    font-size: 46px; color: var(--primary-dk);
    font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 48;
  }
  .value-title { display: flex; flex-direction: column; gap: 3px; }
  .vt-trait { font-size: 12px; font-weight: 400; letter-spacing: .2em; text-transform: uppercase; color: var(--gray-600); }
  .vt-name  { font-size: 18px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--gray-900); line-height: 1.1; }
  .value-desc { font-size: 13.5px; line-height: 1.55; color: var(--gray-600); max-width: 26ch; }

  /* 2-col checkerboard (period of 4): green at positions 2,3. */
  @media (min-width: 601px) and (max-width: 880px) {
    .values-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .value-card:nth-child(4n+2), .value-card:nth-child(4n+3) { background: var(--icon-chip-bg); }
  }
  @media (max-width: 600px) {
    .values-grid { grid-template-columns: 1fr; }
    .value-card:nth-child(even) { background: var(--icon-chip-bg); }
  }
`;

// Markup for one value tile. Shared so both elements render identical cards.
export function valueCardHTML(v) {
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
