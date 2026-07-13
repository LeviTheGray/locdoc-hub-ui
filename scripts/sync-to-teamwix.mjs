/**
 * Sync generated copies of shared sources into the teamwix Wix repo.
 *
 * Wix git-sync requires files to live physically in teamwix/src/, so the shared package can't be
 * imported as a node_module at Wix runtime. Instead this script writes GENERATED copies into
 * teamwix from the source-of-truth files here. Edit the sources in this repo, then run:
 *
 *   npm run sync:teamwix              # uses ../teamwix-v2
 *   TEAMWIX_PATH=/path/to/teamwix npm run sync:teamwix
 *
 * The Wix-connected repo is teamwix-v2 (Loc-Doc-Security org). The older ../teamwix is the
 * personal-account repo that lost its Wix integration — it still exists on disk, so the default
 * below must stay pinned to teamwix-v2 or syncs land in a repo that no longer deploys.
 *
 * The Wix custom-element runtime DOES resolve sibling imports (validated with a probe), so the
 * elements import './tokens.js' directly — no inlining needed; we just copy the files.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const teamwix = process.env.TEAMWIX_PATH || resolve(repoRoot, '..', 'teamwix-v2');

if (!existsSync(teamwix)) {
  console.error(`✗ teamwix repo not found at: ${teamwix}\n  Set TEAMWIX_PATH=/path/to/teamwix and retry.`);
  process.exit(1);
}

function bannerFor(srcRel) {
  return `/**\n * ⚠️  GENERATED FILE — DO NOT EDIT HERE.\n * Source of truth: locdoc-hub-ui/${srcRel}\n * Regenerate with: npm run sync:teamwix  (from the locdoc-hub-ui repo)\n */\n`;
}

// 'replace' swaps the source's leading JSDoc block for the banner (used where the source header is
// just docs). 'prepend' keeps the file's own header (e.g. an element's editor-setup notes) and
// puts a one-line banner above it.
function applyBanner(src, srcRel, mode) {
  if (mode === 'replace') return src.replace(/^\/\*\*[\s\S]*?\*\/\n/, bannerFor(srcRel));
  return `// ⚠️ GENERATED from locdoc-hub-ui/${srcRel} — edit there, run npm run sync:teamwix. Do not edit here.\n` + src;
}

const CE = join(teamwix, 'src', 'public', 'custom-elements');
const ELEMENTS = [
  'tokens.js', 'hub-home.js', 'home-landing.js', 'my-reports.js',
  'weekly-report.js', 'cleanliness-audit.js', 'team-member-assessment.js',
  'tech-spotlight-submit.js', 'one-on-one.js', 'team-reports.js',
  'cleanliness-report.js', 'wednesday-meeting.js', 'mission-vision.js',
  'core-values-data.js', 'core-values.js', 'resources-hub.js',
  'meetings.js', 'annual-events.js', 'company-holidays.js', 'benefits.js',
];
const targets = [
  { src: 'src/scoring-core.js', to: join(teamwix, 'src', 'backend', 'scoring-core.js'), mode: 'replace' },
  ...ELEMENTS.map(name => ({ src: `src/elements/${name}`, to: join(CE, name), mode: 'prepend' })),
];

for (const { src, to, mode } of targets) {
  const out = applyBanner(readFileSync(join(repoRoot, src), 'utf8'), src, mode);
  writeFileSync(to, out);
  console.log(`✓ synced ${src} → ${to}`);
}
console.log('Done.');
