/**
 * Sync generated copies of shared sources into the teamwix Wix repo.
 *
 * Wix git-sync requires files to live physically in teamwix/src/, so the shared package can't be
 * imported as a node_module at Wix runtime. Instead this script writes GENERATED copies into
 * teamwix from the source-of-truth files here. Edit the sources in this repo, then run:
 *
 *   npm run sync:teamwix              # uses ../teamwix
 *   TEAMWIX_PATH=/path/to/teamwix npm run sync:teamwix
 *
 * Currently synced: scoring-core.js (pure compute). Element/token inlining is added here once
 * the Wix custom-element import question is resolved.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const teamwix = process.env.TEAMWIX_PATH || resolve(repoRoot, '..', 'teamwix');

if (!existsSync(teamwix)) {
  console.error(`✗ teamwix repo not found at: ${teamwix}\n  Set TEAMWIX_PATH=/path/to/teamwix and retry.`);
  process.exit(1);
}

const GENERATED_BANNER =
`/**
 * ⚠️  GENERATED FILE — DO NOT EDIT HERE.
 * Source of truth: locdoc-hub-ui/src/scoring-core.js
 * Regenerate with: npm run sync:teamwix  (from the locdoc-hub-ui repo)
 */
`;

// Replace the source's leading JSDoc block with the generated banner, keep the rest verbatim.
function withBanner(src) {
  return src.replace(/^\/\*\*[\s\S]*?\*\/\n/, GENERATED_BANNER);
}

const targets = [
  { from: join(repoRoot, 'src', 'scoring-core.js'), to: join(teamwix, 'src', 'backend', 'scoring-core.js') },
];

for (const { from, to } of targets) {
  const out = withBanner(readFileSync(from, 'utf8'));
  writeFileSync(to, out);
  console.log(`✓ synced ${from.replace(repoRoot + '/', '')} → ${to}`);
}
console.log('Done.');
