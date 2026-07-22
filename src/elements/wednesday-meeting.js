/**
 * Wix Custom Element — Wednesday Morning Meeting  (<wednesday-meeting>)
 *
 * A single responsive presenter page for the weekly Wednesday meeting. Six tabs:
 *   1. Upcoming Meeting   — WeeklyAgendas (Date / Topic / Tech Spotlight) for the
 *                           next 4 weeks + a "Today's Spotlight is …" star banner.
 *   2. Cleanliness Report — the full report (week selector, summary tiles,
 *                           per-branch vehicle/office breakdown, non-submitters,
 *                           weekly trend chart, photo gallery) — ported so it
 *                           lives inside this tab.
 *   3. Driver Scorecard   — ranked tiles (vehicle #, name, color-scaled score) plus
 *                           a rule-averages panel, mirroring the cleanliness ranked list.
 *   4. Core Values        — 2 values picked at random (seeded by the meeting week, so
 *                           the pick is stable all week) with a discussion prompt.
 *   5. Tech Spotlight     — one tech/week: Problem + Solution on top, then photos
 *                           with descriptions; click a photo to enlarge for the room.
 *   6. Agenda             — this week's presentation (embedded Google Slides, titled
 *                           with the week's topic from WeeklyAgendas).
 *
 * Presenter mode (▶ button / it requests fullscreen) scales everything up for
 * projecting. ← / → step tabs (and spotlight entries); while the lightbox is open they
 * page through its images instead, and Esc closes it.
 *
 * The element merges page init-data over SAMPLE_DATA, so any unwired tab keeps
 * demo content. Editor: tag `wednesday-meeting`, element ID `wednesdayMeeting`.
 */

import { TOKENS, ensureMaterialSymbols } from './tokens.js';
import { CORE_VALUES, CORE_VALUES_CSS, valueCardHTML } from './core-values-data.js';

const TABS = [
  { key: 'upcoming',    label: 'Upcoming Meeting', icon: '📅' },
  { key: 'cleanliness', label: 'Cleanliness',      icon: '🧹' },
  { key: 'drivers',     label: 'Driver Scorecard', icon: '🚐' },
  { key: 'corevalues',  label: 'Core Values',      icon: '💎' },
  { key: 'spotlight',   label: 'Tech Spotlight',   icon: '🔧' },
  { key: 'agenda',      label: 'Agenda',           icon: '📋' },
];

const RULES = [
  { key: 'hardAccel',  label: 'Hard Acceleration' },
  { key: 'harshBrake', label: 'Harsh Braking' },
  { key: 'harshCorner',label: 'Harsh Cornering' },
  { key: 'seatbelt',   label: 'Seatbelt' },
  { key: 'speeding',   label: 'Speeding' },
  { key: 'distracted', label: 'Distracted Driving' },
];

// --- Sample data (demo only; replaced field-by-field by init-data) ---
const SAMPLE_DATA = {
  weekOf: 'Week of June 24, 2026',
  upcoming: {
    spotlightTech: 'Marcus Bell',
    rows: [
      { date: '2026-06-24', topic: 'Q3 service goals kickoff',      tech: 'Marcus Bell' },
      { date: '2026-07-01', topic: 'New dispatch routing pilot',    tech: 'Devon Carter' },
      { date: '2026-07-08', topic: 'Summer on-call schedule',       tech: 'Tonya Reyes' },
      { date: '2026-07-15', topic: 'Customer escalation playbook',  tech: 'Will Hopkins' },
    ],
  },
  cleanliness: {
    participants: [
      { _id: 'p1', name: 'Marcus Bell',  branch: 'North', owesVehicle: true,  owesOffice: false },
      { _id: 'p2', name: 'Tonya Reyes',  branch: 'North', owesVehicle: true,  owesOffice: true  },
      { _id: 'p3', name: 'Devon Carter', branch: 'South', owesVehicle: true,  owesOffice: false },
      { _id: 'p4', name: 'Priya Nair',   branch: 'South', owesVehicle: false, owesOffice: true  },
      { _id: 'p5', name: 'Will Hopkins', branch: 'West',  owesVehicle: true,  owesOffice: false },
    ],
    audits: [
      { employeeId: 'p1', name: 'Marcus Bell',  branch: 'North', weekStart: '2026-06-22', score: 95, vehicleScore: 95, officeScore: null, photoUrls: {} },
      { employeeId: 'p2', name: 'Tonya Reyes',  branch: 'North', weekStart: '2026-06-22', score: 88, vehicleScore: 90, officeScore: 86,   photoUrls: {} },
      { employeeId: 'p3', name: 'Devon Carter', branch: 'South', weekStart: '2026-06-22', score: 91, vehicleScore: 91, officeScore: null, photoUrls: {} },
      { employeeId: 'p5', name: 'Will Hopkins', branch: 'West',  weekStart: '2026-06-22', score: 79, vehicleScore: 79, officeScore: null, photoUrls: {} },
      { employeeId: 'p1', name: 'Marcus Bell',  branch: 'North', weekStart: '2026-06-15', score: 92, vehicleScore: 92, officeScore: null, photoUrls: {} },
      { employeeId: 'p2', name: 'Tonya Reyes',  branch: 'North', weekStart: '2026-06-15', score: 90, vehicleScore: 91, officeScore: 89,   photoUrls: {} },
    ],
  },
  // Mirrors the weekly Driver Safety Scorecard PDF.
  drivers: [
    { vehicle: '140', name: 'Chinno Hwang',     score: 96.87 },
    { vehicle: '138', name: 'Ben Kessel',       score: 96.79 },
    { vehicle: '143', name: 'Prince Collins',   score: 95.76 },
    { vehicle: '147', name: 'Sol Sasscer',      score: 94.76 },
    { vehicle: '144', name: 'Genadiy Shamshur', score: 93.85 },
    { vehicle: '134', name: 'Scotty Hinson',    score: 93.43 },
    { vehicle: '135', name: 'Roman Klimenko',   score: 90.75 },
    { vehicle: '148', name: 'Anthony Starr',    score: 89.90 },
    { vehicle: '139', name: 'Matthew Johnson',  score: 89.20 },
    { vehicle: '145', name: 'Craig Smith',      score: 88.47 },
    { vehicle: '214', name: 'Kevin Tench',      score: 85.18 },
    { vehicle: '146', name: 'Frank Lopez',      score: 84.86 },
    { vehicle: '213', name: 'Mike Tyler',       score: 84.60 },
    { vehicle: '212', name: 'Andrew Moody',     score: 84.03 },
    { vehicle: '120', name: 'Michael Childress',score: 83.96 },
    { vehicle: '129', name: 'Eric Spear',       score: 82.05 },
    { vehicle: '142', name: 'Derek Tyler',      score: 79.86 },
    { vehicle: '133', name: 'Leonard McConniel',score: 77.07 },
    { vehicle: '215', name: 'Elizabeth Adkins', score: 76.88 },
  ],
  driversMeta: {
    fleetScore: 87.2, dateRange: 'Jun 14 – Jun 20',
    ruleAverages: { hardAccel: 97.59, harshBrake: 99.68, harshCorner: 96.63, seatbelt: 95.99, speeding: 46.03, distracted: 99.04 },
  },
  spotlight: [
    { tech: 'Marcus Bell', title: 'Seized deadbolt on a historic mortise lock',
      problem: 'A 1920s mortise lock was fully seized — the key would not turn and the bolt was stuck thrown, locking the homeowner out of their front door.',
      solution: 'Drilled the cylinder, freed the bolt, cleaned a century of debris from the case, and rebuilt it with a new cylinder keyed to match the rest of the home.',
      photos: [
        { url: '🔩', caption: 'The seized mortise lock as we found it.' },
        { url: '🗝️', caption: 'Cylinder drilled out and the case opened up.' },
        { url: '🔐', caption: 'Rebuilt, lubricated, and rekeyed to match.' },
      ] },
  ],
  // Agenda tab embeds the next meeting's presentation, fed from WeeklyAgendas via page Velo.
  // Empty by default so demo/unwired state never shows a fake topic. { title, url, date }
  agendaSlide: { title: '', url: '', date: '' },
};

// ---- helpers ----
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
// Normalize any Google Slides link (/edit, /pub, /present) to an embeddable /embed URL.
function slidesEmbed(url) {
  if (!url) return '';
  const m = String(url).match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  return m ? `https://docs.google.com/presentation/d/${m[1]}/embed?start=false&loop=false&delayms=5000` : String(url);
}
// Cleanliness audit week: Wed 9am → next Tue 11:59pm; Wed 00:00–09:00 is the locked meeting window.
// Returns the YYYY-MM-DD of the Wednesday the active week opened (local time). Scorecard stays Monday-based.
function localISODate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function getAuditWeekStart(date) { const d = new Date(date); let b = (d.getDay() + 4) % 7; if (b === 0 && d.getHours() < 9) b = 7; d.setDate(d.getDate() - b); d.setHours(0, 0, 0, 0); return localISODate(d); }
function fmtWeek(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function fmtDate(iso) { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? String(iso || '') : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
function avg(arr) { return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null; }
function avgOverExpected(scores, expected) { return expected ? Math.round(scores.reduce((a, b) => a + b, 0) / expected) : null; }
function clScoreColor(s) { return s >= 80 ? 'var(--green)' : s >= 50 ? 'var(--amber)' : 'var(--red)'; }
// 0–100 red→green scale (matches the PDF's color legend).
function drvColor(s) {
  if (s == null) return 'var(--gray-200)';
  if (s >= 90) return '#16a34a'; if (s >= 75) return '#4ade80';
  if (s >= 50) return '#facc15'; if (s >= 25) return '#fb923c'; return '#ef4444';
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
// Deterministic pick of 2 distinct core values, seeded by the meeting week so the whole room
// sees the same pair and reopening the tab mid-meeting doesn't reshuffle them.
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; return h >>> 0; }
function seededRandom(seed) {
  let t = seed;
  return function () { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
function pickWeeklyCoreValues(seedKey) {
  const n = CORE_VALUES.length;
  const rand = seededRandom(hashStr(String(seedKey || '')));
  const i = Math.floor(rand() * n);
  let j = Math.floor(rand() * (n - 1));
  if (j >= i) j++;
  return [CORE_VALUES[i], CORE_VALUES[j]];
}

const STYLES = `
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  ${TOKENS}
  :host { --amber:#b45309; --red:#ef4444; --gray-500:#6b7280; --radius:12px; --fs:1; background:var(--gray-50); }
  .header { background:var(--primary); color:#fff; padding:18px 24px; box-shadow:var(--shadow-md);
    display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
  .header h1 { font-size:calc(20px * var(--fs)); font-weight:800; }
  .header .week { font-size:13px; opacity:.85; margin-top:2px; }
  .present-btn { background:rgba(255,255,255,.15); color:#fff; border:1px solid rgba(255,255,255,.4);
    padding:8px 14px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; }
  .present-btn:hover { background:rgba(255,255,255,.25); }
  .tabbar { display:flex; gap:4px; background:#fff; border-bottom:1px solid var(--gray-200);
    padding:0 16px; overflow-x:auto; position:sticky; top:0; z-index:5; }
  .tab { display:flex; align-items:center; gap:7px; padding:14px 16px; font-size:calc(14px * var(--fs)); font-weight:600;
    color:var(--gray-500); border:none; background:none; cursor:pointer; border-bottom:3px solid transparent; white-space:nowrap; }
  .tab:hover { color:var(--gray-900); }
  .tab.active { color:var(--primary); border-bottom-color:var(--primary); }
  .tab .tab-icon { font-size:16px; }
  .main { max-width:1040px; margin:0 auto; padding:32px 20px 64px; }
  .panel { animation:fade .2s ease; }
  @keyframes fade { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
  .panel-title { font-size:calc(22px * var(--fs)); font-weight:800; margin-bottom:4px; }
  .panel-sub { font-size:calc(14px * var(--fs)); color:var(--gray-500); margin-bottom:24px; }
  .card { background:#fff; border:1.5px solid var(--gray-200); border-radius:var(--radius); box-shadow:var(--shadow); }
  .placeholder { border:2px dashed var(--gray-200); border-radius:var(--radius); padding:40px 24px; text-align:center; color:var(--gray-400); font-size:14px; }
  .list-row { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--gray-100); font-size:calc(15px * var(--fs)); }
  .list-row:last-child { border-bottom:none; }
  .list-row .meta { color:var(--gray-500); font-size:13px; }
  .spotlight-banner { background:#fef3c7; border:1.5px solid #fde68a; border-radius:var(--radius); padding:16px 20px; margin-bottom:20px; font-size:calc(16px * var(--fs)); }
  .spotlight-banner b { color:var(--amber); }
  table { width:100%; border-collapse:collapse; font-size:calc(14px * var(--fs)); }
  th { text-align:left; padding:12px 16px; background:var(--gray-50); color:var(--gray-500); font-size:12px; text-transform:uppercase; letter-spacing:.05em; border-bottom:1px solid var(--gray-200); }
  td { padding:14px 16px; border-bottom:1px solid var(--gray-100); }
  tr:last-child td { border-bottom:none; }
  .agenda-time { font-weight:800; color:var(--primary); width:60px; }
  .slide-embed { position:relative; width:100%; padding-top:56.25%; border-radius:var(--radius); overflow:hidden; background:#000; box-shadow:var(--shadow); }
  .slide-embed iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
  .slide-link { display:inline-block; margin-top:10px; color:var(--primary); font-weight:700; }

  /* Cleanliness (ported full report) */
  .cl-toolbar { display:flex; align-items:center; gap:12px; margin-bottom:18px; flex-wrap:wrap; }
  .cl-toolbar label { font-size:13px; font-weight:600; color:var(--gray-600); }
  .cl-toolbar select { padding:7px 34px 7px 10px; border:1px solid var(--gray-200); border-radius:8px; font-size:calc(14px * var(--fs)); background:#fff; cursor:pointer; min-width:200px; }
  .cl-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
  .cl-stat { background:#fff; border:1px solid var(--gray-200); border-radius:var(--radius); padding:16px; box-shadow:var(--shadow); }
  .cl-stat .v { font-size:calc(24px * var(--fs)); font-weight:800; } .cl-stat .l { font-size:11px; color:var(--gray-400); margin-top:2px; text-transform:uppercase; letter-spacing:.03em; }
  .cl-card { background:#fff; border:1px solid var(--gray-200); border-radius:var(--radius); padding:20px; box-shadow:var(--shadow); margin-bottom:16px; }
  .cl-card-title { font-size:14px; font-weight:700; margin-bottom:14px; }
  .cl-branch-head { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
  .cl-branch-name { font-size:calc(15px * var(--fs)); font-weight:700; }
  .cl-pill { font-size:11px; font-weight:700; border-radius:100px; padding:3px 10px; margin-left:auto; }
  .cl-pill.ok { background:#dcfce7; color:#14532d; } .cl-pill.warn { background:#fef9c3; color:#78350f; } .cl-pill.bad { background:#fee2e2; color:#991b1b; }
  .cl-typebars { display:flex; gap:20px; margin-bottom:8px; flex-wrap:wrap; }
  .cl-typebar { flex:1; min-width:160px; }
  .cl-tb-label { font-size:12px; font-weight:600; color:var(--gray-600); display:flex; justify-content:space-between; margin-bottom:5px; }
  .cl-track { height:10px; background:var(--gray-100); border-radius:100px; overflow:hidden; }
  .cl-fill { height:100%; border-radius:100px; }
  .cl-chips { display:flex; flex-wrap:wrap; gap:6px; }
  .cl-chip { font-size:12px; font-weight:600; padding:4px 10px; border-radius:100px; background:#fee2e2; color:#991b1b; display:inline-flex; align-items:center; gap:5px; }
  .cl-chip .tag { font-size:10px; font-weight:700; opacity:.7; }
  .cl-all-in { font-size:13px; color:#14532d; font-weight:600; }
  .cl-sub-label { font-size:12px; font-weight:700; color:#14532d; margin:6px 0 8px; }
  .cl-sub-list { display:flex; flex-direction:column; gap:4px; margin-bottom:14px; }
  .cl-sub-row { display:flex; align-items:center; gap:10px; font-size:calc(13px * var(--fs)); padding:5px 0; border-bottom:1px solid var(--gray-100); }
  .cl-sub-row:last-child { border-bottom:none; }
  .cl-sub-rank { width:18px; text-align:right; color:var(--gray-400); font-weight:700; font-size:12px; flex-shrink:0; }
  .cl-sub-name { font-weight:600; }
  .cl-sub-types { font-size:11px; color:var(--gray-400); margin-left:auto; }
  .cl-sub-score { font-weight:800; font-size:calc(14px * var(--fs)); min-width:44px; text-align:right; }
  .cl-nonsub-label { font-size:12px; font-weight:700; color:#991b1b; margin:6px 0 8px; }
  .cl-chart { display:flex; align-items:flex-end; gap:10px; height:160px; padding-top:18px; }
  .cl-bar-col { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; min-width:22px; }
  .cl-bar { width:100%; max-width:44px; border-radius:6px 6px 0 0; position:relative; }
  .cl-bar-val { position:absolute; top:-16px; left:0; right:0; text-align:center; font-size:10px; font-weight:700; color:var(--gray-600); }
  .cl-bar-label { font-size:10px; color:var(--gray-400); margin-top:6px; white-space:nowrap; }
  .cl-gallery { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:12px; }
  .cl-thumb { border:1px solid var(--gray-200); border-radius:8px; overflow:hidden; background:var(--gray-50); cursor:pointer; }
  .cl-thumb img { width:100%; height:110px; object-fit:cover; display:block; }
  .cl-thumb .cap { font-size:10px; padding:6px 8px; color:var(--gray-600); }
  .muted { color:var(--gray-400); font-size:13px; font-style:italic; }

  /* Driver scorecard — fleet + rule averages in one row (same tile language, fleet a bit
     bigger), then square name/score tiles below with a hover-only vehicle # tooltip. */
  .drv-top { display:flex; align-items:stretch; gap:12px; margin-bottom:20px; flex-wrap:wrap; }
  .drv-fleet { background:#fef9c3; border:1.5px solid #fde68a; border-radius:var(--radius); padding:16px 30px; text-align:center; min-width:190px; display:flex; flex-direction:column; justify-content:center; }
  .drv-fleet .v { font-size:calc(54px * var(--fs)); font-weight:900; line-height:1; }
  .drv-fleet .l { font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--gray-600); margin-top:6px; font-weight:700; }
  .drv-avgs-row { display:flex; gap:10px; flex-wrap:wrap; flex:1; }
  .drv-avg { border-radius:10px; padding:10px 14px; color:#1f2937; flex:1; min-width:118px; }
  .drv-avg .l { font-size:12px; font-weight:600; opacity:.85; }
  .drv-avg .v { font-size:calc(20px * var(--fs)); font-weight:900; }
  .drv-tiles-card { background:#fff; border:1.5px solid var(--gray-200); border-radius:var(--radius); box-shadow:var(--shadow); padding:16px; }
  .drv-tiles { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; }
  .drv-tile { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:8px; aspect-ratio:1; border:1.5px solid var(--gray-200); border-radius:12px; padding:16px 10px; }
  .drv-tile-rank { position:absolute; top:8px; left:10px; font-weight:800; font-size:calc(11px * var(--fs)); color:var(--gray-400); }
  .drv-tile-veh-icon { position:absolute; top:6px; right:8px; font-size:calc(13px * var(--fs)); opacity:.55; cursor:default; }
  /* Wraps onto a second line (e.g. last name) instead of truncating — a name is more useful
     whole than clipped. */
  .drv-tile-name { font-weight:700; font-size:calc(14px * var(--fs)); line-height:1.2; white-space:normal; overflow-wrap:break-word; }
  .drv-tile-score { font-weight:900; font-size:calc(19px * var(--fs)); border-radius:8px; padding:4px 12px; color:#1f2937; }
  /* Podium accents for 1st/2nd/3rd — color only, keeps focus on the score badge. */
  .drv-tile.medal-1 { background:linear-gradient(180deg,#fff8dc,#fff); border-color:#d4af37; box-shadow:0 0 0 1px #d4af37 inset; }
  .drv-tile.medal-2 { background:linear-gradient(180deg,#f5f6f7,#fff); border-color:#a7adb4; box-shadow:0 0 0 1px #a7adb4 inset; }
  .drv-tile.medal-3 { background:linear-gradient(180deg,#fbe8da,#fff); border-color:#b3703f; box-shadow:0 0 0 1px #b3703f inset; }
  .drv-legend { display:flex; align-items:center; gap:0; margin-top:14px; font-size:11px; color:var(--gray-500); }
  .drv-legend i { width:38px; height:12px; display:inline-block; }

  /* Core Values tab — reuses the mosaic tile styling from core-values-data.js, 2-up. */
  ${CORE_VALUES_CSS}
  .cv-grid.values-grid { grid-template-columns:repeat(2, minmax(0,1fr)) !important; }
  .cv-question { margin-top:12px; padding-top:14px; border-top:1px dashed var(--gray-200); font-size:calc(13px * var(--fs)); font-weight:700; color:var(--primary); }
  @media (max-width:640px) { .cv-grid.values-grid { grid-template-columns:1fr !important; } }

  /* Tech Spotlight */
  .sp-head { display:flex; align-items:baseline; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
  .sp-tech { font-size:13px; text-transform:uppercase; letter-spacing:.08em; color:var(--amber); font-weight:700; }
  .sp-ps { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px; }
  .sp-ps .card { padding:18px 20px; }
  .sp-ps h4 { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--gray-400); margin-bottom:6px; }
  .sp-ps p { font-size:calc(15px * var(--fs)); line-height:1.55; }
  .sp-photos { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:18px; }
  .sp-photo { background:#fff; border:1.5px solid var(--gray-200); border-radius:var(--radius); box-shadow:var(--shadow); overflow:hidden; }
  .sp-photo .img { width:100%; height:200px; background:var(--gray-900); display:flex; align-items:center; justify-content:center; cursor:zoom-in; }
  .sp-photo .img img { width:100%; height:100%; object-fit:cover; }
  .sp-photo .emoji { font-size:72px; }
  .sp-photo .cap { padding:12px 14px; font-size:calc(14px * var(--fs)); color:var(--gray-600); line-height:1.5; }
  .sp-zoom-hint { font-size:11px; color:var(--gray-400); padding:0 14px 12px; }
  .sp-nav { display:flex; align-items:center; gap:12px; margin-top:18px; }
  .deck-btn { background:var(--primary); color:#fff; border:none; padding:9px 16px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; }
  .deck-btn:disabled { background:var(--gray-200); color:var(--gray-400); cursor:default; }

  /* Lightbox */
  .lightbox { position:fixed; inset:0; background:rgba(0,0,0,.9); display:flex; flex-direction:column;
    align-items:center; justify-content:center; z-index:50; padding:24px; }
  .lightbox img { max-width:96vw; max-height:82vh; border-radius:8px; }
  .lightbox .emoji { font-size:200px; }
  .lightbox .cap { color:#fff; margin-top:16px; font-size:16px; max-width:800px; text-align:center; }
  .lightbox .close { position:absolute; top:18px; right:24px; background:rgba(255,255,255,.15); color:#fff;
    border:none; width:42px; height:42px; border-radius:50%; font-size:22px; cursor:pointer; }
  .lightbox .lb-arrow { position:absolute; top:50%; transform:translateY(-50%); background:rgba(255,255,255,.15);
    color:#fff; border:none; width:54px; height:54px; border-radius:50%; font-size:34px; line-height:1; cursor:pointer;
    display:flex; align-items:center; justify-content:center; }
  .lightbox .lb-arrow:hover { background:rgba(255,255,255,.3); }
  .lightbox .lb-arrow.prev { left:24px; } .lightbox .lb-arrow.next { right:24px; }
  .lightbox .lb-count { color:#fff; opacity:.8; margin-top:10px; font-size:13px; font-weight:600; letter-spacing:.04em; }

  /* ---- Presenter mode ----------------------------------------------------------------
     Projected on a conference-room TV and read from across the room, so: bigger type, and
     use the whole panel rather than a 1320px column stranded in the middle of a 65" screen.

     overflow-y is the important one. A fullscreen element does NOT scroll by default, so
     before this, anything past the bottom edge (a tall photo, a long solution) was simply
     unreachable — no scrollbar, no wheel, stuck. Scrolling is now possible but should stay
     mostly unnecessary: the photo grid below is sized so a spotlight fits one screen. */
  :host([data-present]) {
    --fs:2;
    height:100%; overflow-y:auto; background:var(--gray-50);
  }
  /* Belt and braces: presenter mode is driven by [data-present], but the user can also land in
     fullscreen via the browser's own control, which wouldn't set that attribute. */
  :host(:fullscreen) { height:100%; overflow-y:auto; background:var(--gray-50); }
  :host([data-present]) .main { max-width:min(2200px, 94vw); padding:32px 40px 64px; }
  :host([data-present]) .header { padding:22px 40px; }

  /* Photos are the point of a spotlight — make them big enough to actually see, and use
     object-fit:contain so a detail shot isn't cropped by the fixed tile height. Sizing off
     vh keeps a 1–2 photo spotlight on a single screen. */
  :host([data-present]) .sp-photos { grid-template-columns:repeat(auto-fit,minmax(460px,1fr)); gap:24px; }
  /* 44vh leaves room for the header, tabs, and the problem/solution cards above, so the photos
     land ABOVE the fold — they're the whole point of a spotlight and shouldn't need a scroll. */
  :host([data-present]) .sp-photo .img { height:min(44vh, 520px); background:#111; }
  :host([data-present]) .sp-photo .img img { object-fit:contain; }
  :host([data-present]) .sp-photo .emoji { font-size:120px; }
  :host([data-present]) .sp-photo .cap { padding:16px 20px; }
  :host([data-present]) .sp-ps { margin-bottom:18px; }
  :host([data-present]) .sp-head { margin-bottom:10px; }
  :host([data-present]) .sp-zoom-hint { display:none; } /* nobody is clicking the TV */
  :host([data-present]) .sp-ps .card { padding:24px 28px; }
  :host([data-present]) .deck-btn { padding:14px 24px; font-size:18px; }

  /* Most of the deck is fixed px and ignores --fs, so these stay 10–13px on a 65" screen and are
     unreadable from the back of the room. Scale the labels that actually appear while presenting. */
  :host([data-present]) .tab { font-size:22px; padding:14px 22px; }
  :host([data-present]) .tab .tab-icon { font-size:26px; }
  :host([data-present]) .header .week { font-size:20px; }
  :host([data-present]) .sp-tech { font-size:23px; }
  :host([data-present]) .sp-ps h4 { font-size:19px; }
  :host([data-present]) th { font-size:19px; padding:18px 20px; }
  :host([data-present]) td { font-size:23px; padding:18px 20px; }
  :host([data-present]) .list-row .meta,
  :host([data-present]) .muted,
  :host([data-present]) .placeholder { font-size:21px; }
  /* Cleanliness/driver labels that are also fixed px, unreadable from the back at 65". */
  :host([data-present]) .cl-chip,
  :host([data-present]) .cl-pill,
  :host([data-present]) .cl-tb-label,
  :host([data-present]) .cl-sub-types,
  :host([data-present]) .cl-stat .l,
  :host([data-present]) .drv-avg .l { font-size:16px; }
  :host([data-present]) .cl-sub-rank,
  :host([data-present]) .cl-nonsub-label,
  :host([data-present]) .cl-sub-label { font-size:15px; }
  /* Driver tiles: --fs scales the name/score text but the tile itself doesn't grow to match,
     so a scaled name gets crushed against the tile edge. Widen the tiles (fewer per row) so
     scaled text actually fits. */
  :host([data-present]) .drv-tiles { grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:14px; }
  :host([data-present]) .drv-tile-veh-icon { font-size:20px; top:10px; right:12px; }

  @media (max-width:760px) {
    .drv-avgs-row { flex-direction:column; }
  }
  @media (max-width:640px) {
    .main { padding:24px 14px 48px; } .sp-ps { grid-template-columns:1fr; }
    .cl-stats { grid-template-columns:1fr 1fr; } .panel-title { font-size:calc(19px * var(--fs)); }
  }
`;

class WednesdayMeeting extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'agenda-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._data = SAMPLE_DATA;
    this._tab = 'upcoming';
    this._slide = 0;        // spotlight entry index
    this._clWeek = null;    // selected cleanliness week
    this._lightbox = null;  // { items: [{ url, caption }], i } | null
    this._shell = false;
    this._cvShowAll = false; // Core Values tab: false = this week's 2 picks, true = all 8
    this._isOperations = false; // from init-data — unlocks the Agenda-tab slides editor
    this._agendaBusy = false;   // saving the agenda link
    this._agendaMsg = null;     // { ok, text } feedback after a save
    this._onKey = this._onKey.bind(this);
  }

  connectedCallback() {
    ensureMaterialSymbols();
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyData(this.getAttribute('init-data'));
    else this._render();
    window.addEventListener('keydown', this._onKey);
  }
  disconnectedCallback() { window.removeEventListener('keydown', this._onKey); }

  attributeChangedCallback(name, _old, value) {
    if (name === 'init-data' && value) this._applyData(value);
    if (name === 'agenda-result' && value) this._applyAgendaResult(value);
  }

  _applyData(json) {
    try {
      const p = JSON.parse(json);
      if (p && typeof p === 'object') { this._data = { ...SAMPLE_DATA, ...p }; this._isOperations = Boolean(p.isOperations); }
    } catch (e) { /* keep sample data */ }
    this._clWeek = null;
    this._render();
  }

  // Result of a save-agenda-slides round-trip. On success, reflect the new link locally so the
  // embed updates without waiting for a full init-data refresh.
  _applyAgendaResult(json) {
    let r = {};
    try { r = JSON.parse(json) || {}; } catch (e) { return; }
    this._agendaBusy = false;
    if (r.ok) {
      this._data.agendaSlide = { ...(this._data.agendaSlide || {}), url: r.url || '' };
      this._agendaMsg = { ok: true, text: r.url ? 'Slides link saved.' : 'Slides link removed.' };
    } else {
      this._agendaMsg = { ok: false, text: r.error || 'Could not save the slides link.' };
    }
    this._render();
  }

  _onKey(e) {
    // While the lightbox is open, arrows page through its images and Esc closes it.
    if (this._lightbox) {
      if (e.key === 'Escape') { this._lightbox = null; this._render(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        this._stepLightbox(e.key === 'ArrowRight' ? 1 : -1); e.preventDefault();
      }
      return;
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    if (this._tab === 'spotlight') {
      const n = (this._data.spotlight || []).length;
      const next = this._slide + dir;
      if (next >= 0 && next < n) { this._slide = next; this._render(); return; }
    }
    const i = TABS.findIndex(t => t.key === this._tab);
    const ni = i + dir;
    if (ni >= 0 && ni < TABS.length) { this._tab = TABS[ni].key; this._slide = 0; this._cvShowAll = false; this._render(); }
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <header class="header">
        <div><h1>Wednesday Morning Meeting</h1><div class="week" data-week></div></div>
        <button class="present-btn" data-present-toggle>▶ Presenter mode</button>
      </header>
      <nav class="tabbar" data-tabbar></nav>
      <main class="main" data-panels></main>
      <div data-lightbox-host></div>`;
    const root = this.shadowRoot;
    root.querySelector('[data-tabbar]').innerHTML = TABS.map(t =>
      `<button class="tab" data-tab="${t.key}"><span class="tab-icon">${t.icon}</span>${t.label}</button>`).join('');

    root.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-tab]');
      if (tab) { this._tab = tab.getAttribute('data-tab'); this._slide = 0; this._cvShowAll = false; this._render(); return; }
      const entry = e.target.closest('[data-entry-nav]');
      if (entry) { this._slide += Number(entry.getAttribute('data-entry-nav')); this._render(); return; }
      const lbNav = e.target.closest('[data-lb-nav]');
      if (lbNav && this._lightbox) { this._stepLightbox(Number(lbNav.getAttribute('data-lb-nav'))); return; }
      const zoom = e.target.closest('[data-zoom]');
      if (zoom) {
        // Open the whole gallery (all [data-zoom] in this group) at the clicked image,
        // so the lightbox itself can page back and forth.
        const group = zoom.closest('[data-zoom-group]') || this.shadowRoot;
        const nodes = Array.from(group.querySelectorAll('[data-zoom]'));
        const items = nodes.map(n => ({ url: n.getAttribute('data-zoom'), caption: n.getAttribute('data-cap') || '' }));
        this._lightbox = { items, i: Math.max(0, nodes.indexOf(zoom)) };
        this._render(); return;
      }
      if (e.target.closest('[data-lightbox-close]') || e.target.hasAttribute('data-lightbox-overlay')) { this._lightbox = null; this._render(); return; }
      if (e.target.closest('[data-save-agenda]')) { this._saveAgenda(); return; }
      if (e.target.closest('[data-cv-toggle]')) { this._cvShowAll = !this._cvShowAll; this._render(); return; }
      const link = e.target.closest('[data-nav]');
      if (link) { this.dispatchEvent(new CustomEvent('navigate', { detail: { key: link.getAttribute('data-nav') }, bubbles: true, composed: true })); return; }
      if (e.target.closest('[data-present-toggle]')) this._togglePresent(e.target.closest('[data-present-toggle]'));
    });
    root.addEventListener('change', (e) => {
      if (e.target && e.target.hasAttribute('data-cl-week')) { this._clWeek = e.target.value; this._render(); }
    });
    document.addEventListener('fullscreenchange', () => {
      const btn = this.shadowRoot.querySelector('[data-present-toggle]');
      if (!document.fullscreenElement && this.hasAttribute('data-present')) { this.removeAttribute('data-present'); if (btn) btn.textContent = '▶ Presenter mode'; this._render(); }
    });
  }

  _togglePresent(btn) {
    const on = this.toggleAttribute('data-present');
    btn.textContent = on ? '✕ Exit presenter' : '▶ Presenter mode';
    try { if (on) this.requestFullscreen && this.requestFullscreen().catch(() => {}); else document.fullscreenElement && document.exitFullscreen().catch(() => {}); } catch (e) { /* ignore */ }
    this._render();
  }

  // Operations-only: hand the typed Google Slides link to the page, which writes it to this
  // meeting's WeeklyAgendas row (server re-checks Operations). agendaSlide.id targets the row.
  _saveAgenda() {
    const a = this._data.agendaSlide || {};
    if (!a.id) { this._agendaMsg = { ok: false, text: "Add this meeting's topic in Weekly Agendas first." }; this._render(); return; }
    const input = this.shadowRoot.querySelector('[data-agenda-url]');
    const url = input ? input.value.trim() : '';
    if (url && !/^https?:\/\//i.test(url)) { this._agendaMsg = { ok: false, text: 'Enter a valid https:// link.' }; this._render(); return; }
    this._agendaBusy = true; this._agendaMsg = null; this._render();
    this.dispatchEvent(new CustomEvent('save-agenda-slides', { detail: { agendaId: a.id, url }, bubbles: true, composed: true }));
  }

  _render() {
    const root = this.shadowRoot, d = this._data;
    root.querySelector('[data-week]').textContent = d.weekOf || '';
    root.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === this._tab));
    root.querySelector('[data-panels]').innerHTML = `<section class="panel">${this._panel(this._tab)}</section>`;
    root.querySelector('[data-lightbox-host]').innerHTML = this._lightbox ? this._lightboxHtml() : '';
  }

  _stepLightbox(dir) {
    const lb = this._lightbox;
    if (!lb || !lb.items.length) return;
    const n = lb.items.length;
    lb.i = (lb.i + dir + n) % n; // wrap around
    this._render();
  }

  _lightboxHtml() {
    const lb = this._lightbox;
    const items = lb.items || [];
    const cur = items[lb.i] || { url: '', caption: '' };
    const isImg = /^https?:/.test(cur.url || '');
    const many = items.length > 1;
    return `<div class="lightbox" data-lightbox-overlay>
      <button class="close" data-lightbox-close>✕</button>
      ${many ? `<button class="lb-arrow prev" data-lb-nav="-1" aria-label="Previous">‹</button>` : ''}
      ${isImg ? `<img src="${esc(cur.url)}" alt="">` : `<div class="emoji">${esc(cur.url || '🔧')}</div>`}
      ${cur.caption ? `<div class="cap">${esc(cur.caption)}</div>` : ''}
      ${many ? `<div class="lb-count">${lb.i + 1} / ${items.length}</div>` : ''}
      ${many ? `<button class="lb-arrow next" data-lb-nav="1" aria-label="Next">›</button>` : ''}</div>`;
  }

  _panel(key) {
    if (key === 'upcoming')    return this._upcomingPanel();
    if (key === 'cleanliness') return this._cleanlinessPanel();
    if (key === 'drivers')     return this._driversPanel();
    if (key === 'corevalues')  return this._coreValuesPanel();
    if (key === 'spotlight')   return this._spotlightPanel();
    if (key === 'agenda')      return this._agendaPanel();
    return '';
  }

  // ---- Tab 1: Upcoming ----
  _upcomingPanel() {
    const u = this._data.upcoming || {};
    const allRows = u.rows || [];
    let spotlight = u.spotlightTech;
    const today = todayISO();
    if (!spotlight && allRows.length) {
      const row = allRows.find(r => r.date === today) || allRows.find(r => r.date >= today) || allRows[allRows.length - 1];
      spotlight = row && row.tech;
    }
    // Show only meetings in the next 4 weeks (today through +28 days).
    const horizon = (() => { const d = new Date(); d.setDate(d.getDate() + 28); return d.toISOString().slice(0, 10); })();
    const rows = allRows.filter(r => r.date && r.date >= today && r.date <= horizon);
    return `
      <div class="panel-sub" style="margin-top:0">Topics for the next 4 weeks and which tech has the spotlight.</div>
      ${spotlight ? `<div class="spotlight-banner">⭐ Today's Spotlight is: <b>${esc(spotlight)}</b></div>` : ''}
      <div class="card" style="overflow:hidden">
        ${rows.length ? `<table>
          <thead><tr><th>Date</th><th>Topic</th><th>Tech Spotlight</th></tr></thead>
          <tbody>${rows.map(r => `<tr><td>${esc(fmtDate(r.date))}</td><td>${esc(r.topic)}</td><td>${esc(r.tech || '')}</td></tr>`).join('')}</tbody>
        </table>` : '<div class="placeholder">No meetings scheduled in the next 4 weeks.</div>'}
      </div>`;
  }

  // ---- Tab 2: Cleanliness (full report) ----
  _weekOptions(audits) {
    const set = new Set(audits.map(a => a.weekStart).filter(Boolean));
    let cur = getAuditWeekStart(new Date());
    for (let i = 0; i < 8; i++) { set.add(cur); const dt = new Date(cur + 'T00:00:00'); dt.setDate(dt.getDate() - 7); cur = localISODate(dt); }
    return [...set].sort().reverse();
  }
  _cleanlinessPanel() {
    const c = this._data.cleanliness;
    if (!c || !Array.isArray(c.participants) || !c.participants.length) {
      return `<div class="placeholder">📊 The full cleanliness report loads here once the page Velo feeds
          <b>{ cleanliness: { participants, audits } }</b>.</div>`;
    }
    const audits = Array.isArray(c.audits) ? c.audits : [];
    const weeks = this._weekOptions(audits);
    // Default to the current/under-review week (matches the standalone Cleanliness Report) so a
    // stray future-dated row can't drag the deck forward; only fall back to the most-recent week
    // with data when the current week is empty.
    const thisWeek = getAuditWeekStart(new Date());
    const auditWeeks = weeks.filter(w => audits.some(a => a.weekStart === w));
    const week = this._clWeek
      || (audits.some(a => a.weekStart === thisWeek) ? thisWeek : (auditWeeks[0] || thisWeek));
    const weekAudits = audits.filter(a => a.weekStart === week);
    const byEmp = {}; weekAudits.forEach(a => { byEmp[a.employeeId] = a; });

    const submitted = c.participants.filter(p => byEmp[p._id]).length;
    const expected = c.participants.length;
    const owesVAll = c.participants.filter(p => p.owesVehicle).length;
    const owesOAll = c.participants.filter(p => p.owesOffice).length;
    // 0% baseline: average over expected headcount, not just submitters, so non-submittals pull it down.
    const overall = avgOverExpected(weekAudits.map(a => a.score), expected);
    const vAvg = avgOverExpected(weekAudits.map(a => a.vehicleScore).filter(s => s != null), owesVAll);
    const oAvg = avgOverExpected(weekAudits.map(a => a.officeScore).filter(s => s != null), owesOAll);
    const tiles = [
      { v: `${submitted}/${expected}`, l: 'Submitted' },
      { v: overall == null ? '—' : overall + '%', l: 'Avg Score' },
      { v: vAvg == null ? '—' : vAvg + '%', l: 'Vehicle Avg' },
      { v: oAvg == null ? '—' : oAvg + '%', l: 'Office Avg' },
    ];

    // Branches
    const branches = {};
    c.participants.forEach(p => { const b = p.branch || 'Unassigned'; (branches[b] = branches[b] || []).push(p); });
    const branchHtml = Object.keys(branches).sort().map(b => {
      const members = branches[b];
      const vScores = [], oScores = []; let owesV = 0, owesO = 0;
      members.forEach(m => { if (m.owesVehicle) owesV++; if (m.owesOffice) owesO++; const a = byEmp[m._id]; if (a) { if (a.vehicleScore != null) vScores.push(a.vehicleScore); if (a.officeScore != null) oScores.push(a.officeScore); } });
      const sub = members.filter(m => byEmp[m._id]).length, exp = members.length;
      const pill = sub === exp ? 'ok' : sub === 0 ? 'bad' : 'warn';
      const nonsubs = members.filter(m => !byEmp[m._id]);

      // Submitters ranked top → bottom by overall score.
      const ranked = members.filter(m => byEmp[m._id])
        .map(m => ({ m, a: byEmp[m._id] }))
        .sort((x, y) => (y.a.score || 0) - (x.a.score || 0));
      const subList = ranked.length
        ? `<div class="cl-sub-label">Submitted (${ranked.length})</div><div class="cl-sub-list">${ranked.map((s, i) => {
            const types = [s.a.vehicleScore != null ? `🚐 ${s.a.vehicleScore}%` : '', s.a.officeScore != null ? `🏢 ${s.a.officeScore}%` : ''].filter(Boolean).join(' · ');
            return `<div class="cl-sub-row"><span class="cl-sub-rank">${i + 1}</span><span class="cl-sub-name">${esc(s.m.name)}</span>${types ? `<span class="cl-sub-types">${types}</span>` : ''}<span class="cl-sub-score" style="color:${clScoreColor(s.a.score)}">${s.a.score}%</span></div>`;
          }).join('')}</div>`
        : '';

      return `<div class="cl-card">
        <div class="cl-branch-head"><div class="cl-branch-name">🏢 ${esc(b)}</div><div class="cl-pill ${pill}">${sub}/${exp} submitted</div></div>
        <div class="cl-typebars">${this._clTypeBar('🚐 Vehicle', avgOverExpected(vScores, owesV), owesV)}${this._clTypeBar('🏢 Office', avgOverExpected(oScores, owesO), owesO)}</div>
        ${subList}
        ${nonsubs.length
          ? `<div class="cl-nonsub-label">Did not submit (${nonsubs.length})</div><div class="cl-chips">${nonsubs.map(m => `<span class="cl-chip">${esc(m.name)}<span class="tag">${m.owesVehicle && m.owesOffice ? '🚐🏢' : m.owesVehicle ? '🚐' : '🏢'}</span></span>`).join('')}</div>`
          : `<div class="cl-all-in">✓ Everyone in this branch submitted</div>`}
      </div>`;
    }).join('');

    // Trend chart
    const byWeek = {};
    audits.forEach(a => { if (a.weekStart) (byWeek[a.weekStart] = byWeek[a.weekStart] || []).push(a.score); });
    const chartWeeks = Object.keys(byWeek).sort().slice(-12);
    const chartHtml = chartWeeks.length ? chartWeeks.map(w => { const a = avg(byWeek[w]); return `<div class="cl-bar-col"><div class="cl-bar" style="height:${Math.max(a, 2)}%;background:${clScoreColor(a)}"><div class="cl-bar-val">${a}%</div></div><div class="cl-bar-label">${fmtWeek(w)}</div></div>`; }).join('') : '<div class="muted">No audits submitted yet.</div>';

    // Gallery
    const thumbs = [];
    weekAudits.forEach(a => Object.keys(a.photoUrls || {}).forEach(slot => { const url = a.photoUrls[slot]; if (url) thumbs.push(`<div class="cl-thumb" data-zoom="${esc(url)}" data-cap="${esc(a.name + ' · ' + slot)}"><img src="${esc(url)}" alt=""><div class="cap">${esc(a.name)} · ${esc(slot)}</div></div>`); }));

    return `
      <div class="cl-toolbar"><label>Week:</label><select data-cl-week>${weeks.map(w => `<option value="${w}"${w === week ? ' selected' : ''}>Week of ${fmtWeek(w)}${w === getAuditWeekStart(new Date()) ? ' (current)' : ''}</option>`).join('')}</select></div>
      <div class="cl-stats">${tiles.map(t => `<div class="cl-stat"><div class="v">${t.v}</div><div class="l">${t.l}</div></div>`).join('')}</div>
      ${branchHtml}
      <div class="cl-card"><div class="cl-card-title">Average Score by Week (all branches)</div><div class="cl-chart">${chartHtml}</div></div>
      <div class="cl-card"><div class="cl-card-title">Photos This Week</div><div class="cl-gallery" data-zoom-group>${thumbs.length ? thumbs.join('') : '<div class="muted">No photos for this week.</div>'}</div></div>
      <div style="margin-top:6px"><button class="deck-btn" data-nav="cleanlinessReport">Open the standalone report →</button></div>`;
  }
  _clTypeBar(label, score, owedCount) {
    if (!owedCount) return '';
    if (score == null) return `<div class="cl-typebar"><div class="cl-tb-label"><span>${label}</span><span class="muted">no data</span></div><div class="cl-track"></div></div>`;
    return `<div class="cl-typebar"><div class="cl-tb-label"><span>${label}</span><span>${score}%</span></div><div class="cl-track"><div class="cl-fill" style="width:${score}%;background:${clScoreColor(score)}"></div></div></div>`;
  }

  // ---- Tab 3: Driver Scorecard (ranked tiles) ----
  _driversPanel() {
    const d = this._data;
    const rows = (d.drivers || []).slice().sort((a, b) => b.score - a.score);
    const m = d.driversMeta || {};
    if (!rows.length) return `<div class="placeholder">Weekly Driver Safety Scorecard loads here from the DriverScores collection.</div>`;
    const ra = m.ruleAverages || {};
    const medalCls = ['medal-1', 'medal-2', 'medal-3'];
    const tiles = rows.map((r, i) => {
      const c = drvColor(r.score);
      return `<div class="drv-tile ${medalCls[i] || ''}">
        <span class="drv-tile-rank">${i + 1}</span>
        ${r.vehicle ? `<span class="drv-tile-veh-icon" title="Vehicle #${esc(r.vehicle)}">🚐</span>` : ''}
        <span class="drv-tile-name">${esc(r.name)}</span>
        <span class="drv-tile-score" style="background:${c}33;border:1.5px solid ${c}">${(r.score).toFixed(1)}</span>
      </div>`;
    }).join('');
    const avgs = RULES.map(rule => { const v = ra[rule.key]; return `<div class="drv-avg" style="background:${drvColor(v)}33;border:1.5px solid ${drvColor(v)}"><div class="l">${rule.label}</div><div class="v">${v == null ? '—' : Number(v).toFixed(2)}</div></div>`; }).join('');
    return `
      <div class="panel-sub">${m.dateRange ? 'Week of ' + esc(m.dateRange) : 'Weekly driver safety scores.'}</div>
      <div class="drv-top">
        <div class="drv-fleet"><div class="v">${m.fleetScore == null ? '—' : Number(m.fleetScore).toFixed(1)}</div><div class="l">Average Fleet Score</div></div>
        <div class="drv-avgs-row">${avgs}</div>
      </div>
      <div class="drv-tiles-card">
        <div class="drv-tiles">${tiles}</div>
        <div class="drv-legend"><span>0</span><i style="background:#ef4444"></i><i style="background:#fb923c"></i><i style="background:#facc15"></i><i style="background:#4ade80"></i><i style="background:#16a34a"></i><span>100</span></div>
      </div>`;
  }

  // ---- Tab 4: Core Values (2 random-per-week, with a discussion prompt; "See all" for
  // business meetings that review the full list) ----
  _coreValuesPanel() {
    if (this._cvShowAll) {
      return `
        <div class="sp-head">
          <div class="panel-sub" style="margin:0">The full list, for meetings that go over all of them.</div>
          <button class="deck-btn" data-cv-toggle>← This week's picks</button>
        </div>
        <div class="values-grid">${CORE_VALUES.map(valueCardHTML).join('')}</div>`;
    }
    const seed = this._data.weekOf || todayISO();
    const picks = pickWeeklyCoreValues(seed);
    const cards = picks.map(v => `
      <div class="value-card">
        <span class="value-glyph material-symbols-outlined">${v.icon}</span>
        <div class="value-title"><span class="vt-trait">${esc(v.trait)}</span><span class="vt-name">${esc(v.value)}</span></div>
        <p class="value-desc">${esc(v.desc)}</p>
        <div class="cv-question">How have you seen this core value in action this week?</div>
      </div>`).join('');
    return `
      <div class="sp-head">
        <div class="panel-sub" style="margin:0">This week's spotlighted values — share an example.</div>
        <button class="deck-btn" data-cv-toggle>See all 8 →</button>
      </div>
      <div class="values-grid cv-grid">${cards}</div>`;
  }

  // ---- Tab 5: Tech Spotlight ----
  _spotlightPanel() {
    const items = this._data.spotlight || [];
    if (!items.length) return `<div class="placeholder">A tech submits Problem / Solution + photos; their spotlight shows here.</div>`;
    const i = Math.max(0, Math.min(this._slide, items.length - 1));
    const s = items[i];
    // A tech can present a Google Slides deck instead of photos. When they do, embed the slides in
    // place of the photo grid (photos, if any were also added, are not shown — the deck is the point).
    const slideSrc = s.slidesUrl ? slidesEmbed(s.slidesUrl) : '';
    const photos = Array.isArray(s.photos) ? s.photos : (s.photo ? [{ url: s.photo, caption: '' }] : []);
    const photoHtml = photos.map(p => {
      const isImg = /^https?:/.test(p.url || '');
      return `<div class="sp-photo">
        <div class="img" data-zoom="${esc(p.url)}" data-cap="${esc(p.caption || '')}">${isImg ? `<img src="${esc(p.url)}" alt="">` : `<span class="emoji">${esc(p.url || '🔧')}</span>`}</div>
        ${p.caption ? `<div class="cap">${esc(p.caption)}</div>` : ''}
        <div class="sp-zoom-hint">🔍 Click to enlarge</div></div>`;
    }).join('');
    const media = slideSrc
      ? `<div class="slide-embed"><iframe src="${esc(slideSrc)}" allowfullscreen></iframe></div>`
      : `<div class="sp-photos" data-zoom-group>${photoHtml || '<div class="placeholder">No photos yet.</div>'}</div>`;
    return `
      <div class="sp-head"><div class="sp-tech">${esc(s.tech || '')}</div>${items.length > 1 ? `<div class="panel-sub" style="margin:0">${i + 1} of ${items.length} · ← →</div>` : ''}</div>
      ${s.title ? `<div class="panel-title" style="font-size:calc(20px * var(--fs));margin-bottom:16px">${esc(s.title)}</div>` : ''}
      <div class="sp-ps">
        <div class="card"><h4>The problem</h4><p>${esc(s.problem)}</p></div>
        <div class="card"><h4>The solution</h4><p>${esc(s.solution)}</p></div>
      </div>
      ${media}
      ${items.length > 1 ? `<div class="sp-nav">
        <button class="deck-btn" data-entry-nav="-1" ${i === 0 ? 'disabled' : ''}>← Previous</button>
        <button class="deck-btn" data-entry-nav="1" ${i === items.length - 1 ? 'disabled' : ''}>Next →</button></div>` : ''}`;
  }

  // ---- Tab 6: Agenda (this week's presentation) ----
  _agendaPanel() {
    const a = this._data.agendaSlide || {};
    const hasTopic = !!(a.title && String(a.title).trim());
    const src = slidesEmbed(a.url);
    const sub = hasTopic
      ? `${esc(a.title)}${a.date ? ` · ${esc(fmtDate(a.date))}` : ''}`
      : 'Set the next meeting’s topic and Google Slides link in the Weekly Agendas table.';
    return `
      <div class="panel-sub" style="margin-top:0">${sub}</div>
      ${src
        ? `<div class="slide-embed"><iframe src="${esc(src)}" allowfullscreen></iframe></div>`
        : `<div class="card"><div class="placeholder">${hasTopic
            ? 'No presentation linked for this meeting yet.'
            : 'No upcoming meeting found in Weekly Agendas.'} Add a Google Slides link to the meeting's row to show it here.${a.url ? ` <a class="slide-link" href="${esc(a.url)}" target="_blank" rel="noopener">Open link</a>` : ''}</div></div>`}
      ${this._isOperations ? this._agendaEditor(a) : ''}`;
  }

  // Operations-only inline editor for the meeting's Google Slides link. Hidden while presenting —
  // nobody edits the link on the projector, and it keeps the deck clean on the TV.
  _agendaEditor(a) {
    if (this.hasAttribute('data-present')) return '';
    const msg = this._agendaMsg;
    return `
      <div class="card" style="margin-top:16px;padding:16px 18px">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">Operations · Google Slides link</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input type="text" data-agenda-url placeholder="https://docs.google.com/presentation/d/…"
            value="${esc(a.url || '')}"
            style="flex:1;min-width:220px;padding:9px 11px;border:1.5px solid var(--gray-200);border-radius:8px;font-size:14px">
          <button class="deck-btn" data-save-agenda ${this._agendaBusy ? 'disabled' : ''}>${this._agendaBusy ? 'Saving…' : 'Save'}</button>
        </div>
        ${a.id ? '' : `<div class="muted" style="margin-top:8px">Add this meeting's topic in Weekly Agendas before linking slides.</div>`}
        ${msg ? `<div style="margin-top:8px;font-size:13px;font-weight:600;color:${msg.ok ? 'var(--green)' : 'var(--red)'}">${esc(msg.text)}</div>` : ''}
      </div>`;
  }
}

customElements.define('wednesday-meeting', WednesdayMeeting);
