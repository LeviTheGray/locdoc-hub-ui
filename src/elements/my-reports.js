/**
 * Wix Custom Element — My Scorecard  (<my-reports>)
 *
 * Port of the htmlMyReports HtmlComponent to a git-synced web component.
 * Lives in src/public/custom-elements/; UI changes deploy on `git push`.
 *
 * Data handoff (mirrors the old postMessage bridge):
 *   • Velo → element :  setAttribute('init-data', …)        full payload (INIT)
 *                       setAttribute('scorecard-data', …)   period-change response (SCORECARD)
 *   • element → Velo :  'change-period' { detail: { period } }  → Velo refetches + sets scorecard-data
 *                       'navigate'      { detail: { key:'hub' } } → Velo wixLocation.to('/employee-hub')
 *
 * Editor setup (one time): Add → Embed Code → Custom Element → source = this file,
 * tag name `my-reports`, element ID `myReports`.
 */

import { TOKENS } from './tokens.js';

const criteria = [
  { key: 'humble', label: 'Humble' }, { key: 'hungry', label: 'Hungry' },
  { key: 'smart', label: 'Smart' }, { key: 'helpfulKind', label: 'Helpful & Kind' },
  { key: 'fastResponse', label: 'Fast Response' }, { key: 'solvesProblems', label: 'Solves Problems' },
];
const scaleInfo = { 1: 'sc1', 2: 'sc2', 3: 'sc3', 4: 'sc4', 5: 'sc5' };

function scoreColor(v) { return v >= .85 ? '#10b981' : v >= .5 ? '#f59e0b' : '#ef4444'; }
function assessColor(avg) { return avg >= 3.5 ? '#10b981' : avg >= 2.5 ? '#3b82f6' : avg >= 1.5 ? '#f59e0b' : '#ef4444'; }
// Red→Yellow→Green color scale (0 / 50 / 100), mirroring the sheet's color-scale rule on the averages.
function colorScale(pct) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  const lerp = (a, b, t) => Math.round(a + (b - a) * t);
  const red = [230, 124, 115], yellow = [255, 214, 102], green = [87, 187, 138];
  const mix = (from, to, t) => `rgb(${lerp(from[0], to[0], t)},${lerp(from[1], to[1], t)},${lerp(from[2], to[2], t)})`;
  return p <= 50 ? mix(red, yellow, p / 50) : mix(yellow, green, (p - 50) / 50);
}
function formatMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return (names[m - 1] || ym) + ' ' + y;
}
function shortDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function shortMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[m - 1] || ym} ’${String(y).slice(2)}`;
}
function formatWeekRange(monday) {
  const s = new Date(monday + 'T00:00:00'), e = new Date(s); e.setDate(e.getDate() + 6);
  const o = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', o)} – ${e.toLocaleDateString('en-US', o)}`;
}
function statusChip(m) {
  // Submissions (participation) — show how many of the three were submitted.
  if (m.key === 'submissions') {
    const items = (m.detail && m.detail.items) || [];
    const done = items.filter(i => i.done).length;
    const total = items.length || 3;
    const cls = done === total ? 'ok' : done === 0 ? 'miss' : 'partial';
    return `<span class="status-chip ${cls}">${done}/${total} submitted</span>`;
  }
  // Quality measurables — show the average value on a red→yellow→green color scale.
  if (m.valueType === 'quality') {
    if (m.value == null) return '<span class="status-chip miss">No data yet</span>';
    const pct = m.max === 4 ? (m.value / 4 * 100) : m.value;
    const txt = m.max === 4 ? `${Number(m.value).toFixed(1)} / 4` : `${m.value}%`;
    return `<span class="status-chip" style="background:${colorScale(pct)};color:#1f2937">${txt}</span>`;
  }
  if (m.valueType === 'completion') {
    return m.done ? '<span class="status-chip ok">✓ Done</span>' : '<span class="status-chip miss">Not yet</span>';
  }
  const cls = m.achievement >= 1 ? 'ok' : m.achievement >= .5 ? 'partial' : 'miss';
  const val = m.detail.value != null ? m.detail.value : '—';
  return `<span class="status-chip ${cls}">${val}${m.targetValue ? ' / ' + m.targetValue : ''}</span>`;
}

const STYLES = `
  ${TOKENS}
  :host { background: var(--gray-50); }
  .backbtn { display:inline-flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; color:#6b7280; font:600 13px system-ui,-apple-system,sans-serif; padding:12px 16px 0; }
  .header { background: var(--primary); color: #fff; padding: 16px 24px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header p  { font-size: 12px; opacity: .75; margin-top: 2px; }
  .main { max-width: 760px; margin: 0 auto; padding: 24px 16px; }
  .loading-state { text-align: center; padding: 64px 0; color: var(--gray-400); font-size: 15px; }
  .toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .toolbar label { font-size: 13px; font-weight: 600; color: var(--gray-600); }
  .toolbar select {
    padding: 7px 36px 7px 10px; border: 1px solid var(--gray-200); border-radius: 8px;
    font-size: 14px; background: #fff; color: var(--gray-900); cursor: pointer; min-width: 180px;
    -webkit-appearance: none; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M6 8L1 3h10z' fill='%236b7280'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
  }
  .toolbar select:focus { outline: 2px solid var(--primary); outline-offset: -1px; }
  .hero { background: #fff; border: 1px solid var(--gray-200); border-radius: 14px; box-shadow: var(--shadow); padding: 22px 24px; margin-bottom: 18px; display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
  .ring { position: relative; width: 104px; height: 104px; flex-shrink: 0; }
  .ring svg { transform: rotate(-90deg); }
  .ring-label { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .ring-score { font-size: 26px; font-weight: 800; line-height: 1; }
  .ring-sub { font-size: 11px; color: var(--gray-400); margin-top: 2px; }
  .hero-meta { flex: 1; min-width: 200px; }
  .hero-name { font-size: 18px; font-weight: 800; }
  .hero-level { font-size: 13px; color: var(--gray-600); margin-top: 2px; }
  .hero-stats { display: flex; gap: 18px; margin-top: 14px; flex-wrap: wrap; }
  .stat .stat-num { font-size: 20px; font-weight: 800; }
  .stat .stat-lab { font-size: 11px; color: var(--gray-400); text-transform: uppercase; letter-spacing: .04em; }
  .level-bar-track { height: 6px; background: var(--gray-100); border-radius: 4px; margin-top: 12px; overflow: hidden; }
  .level-bar-fill { height: 100%; background: var(--primary); border-radius: 4px; }
  .level-next { font-size: 11px; color: var(--gray-400); margin-top: 5px; }
  .badges { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
  .badge { display: inline-flex; align-items: center; gap: 6px; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 100px; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  .tile { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); box-shadow: var(--shadow); padding: 16px; cursor: pointer; text-align: left; transition: transform .12s, box-shadow .12s; -webkit-tap-highlight-color: transparent; }
  .tile:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .tile:active { transform: scale(.99); }
  .tile-top { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .tile-emoji { font-size: 22px; }
  .tile-label { font-size: 14px; font-weight: 700; }
  .tile-cat { font-size: 11px; color: var(--gray-400); }
  .tile-status { display: flex; align-items: center; justify-content: space-between; }
  .status-chip { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 100px; }
  .ok { background: #dcfce7; color: #14532d; } .miss { background: #fee2e2; color: #991b1b; } .partial { background: #fef9c3; color: #78350f; }
  .tile-points { font-size: 12px; font-weight: 700; color: var(--gray-400); }
  .tile-bar-track { height: 6px; background: var(--gray-100); border-radius: 4px; margin-top: 12px; overflow: hidden; }
  .tile-bar-fill { height: 100%; border-radius: 4px; }
  .sub-item { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--gray-200); }
  .sub-item:last-child { border-bottom: none; }
  .sub-item-emoji { font-size: 20px; }
  .sub-item-label { font-size: 14px; font-weight: 700; flex: 1; }
  .cl-gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; margin-top: 10px; }
  .cl-thumb { border: 1px solid var(--gray-200); border-radius: 8px; overflow: hidden; background: var(--gray-100); }
  .cl-thumb img { width: 100%; height: 80px; object-fit: cover; display: block; }
  .tile-caret { margin-left: auto; font-size: 10px; color: var(--gray-400); align-self: flex-start; }
  .tile.active { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,100,152,.10), var(--shadow-md); }
  .panel { background: var(--gray-50); border: 1.5px solid var(--primary); border-radius: var(--radius); padding: 18px 16px 22px; margin-top: 14px; box-shadow: var(--shadow); }
  .panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .panel-title { font-size: 16px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
  .panel-close { background: none; border: none; font-size: 24px; color: var(--gray-400); cursor: pointer; line-height: 1; }
  .trend-block { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); margin-top: 12px; }
  .trend-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
  .trend-title { font-size: 13px; font-weight: 700; color: var(--gray-900); }
  .range-toggle { display: inline-flex; border: 1px solid var(--gray-200); border-radius: 8px; overflow: hidden; }
  .range-toggle .rt { background: #fff; border: none; padding: 5px 12px; font-size: 12px; font-weight: 700; color: var(--gray-600); cursor: pointer; }
  .range-toggle .rt.on { background: var(--primary); color: #fff; }
  .trend-svg { width: 100%; height: auto; display: block; }
  .trend-legend { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 8px; }
  .trend-legend .leg { font-size: 11px; font-weight: 600; color: var(--gray-600); display: inline-flex; align-items: center; gap: 5px; }
  .trend-legend .leg i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .result-card { background:#fff; border:1px solid var(--gray-200); border-radius:var(--radius); padding:24px; box-shadow:var(--shadow); margin-bottom:12px; }
  .result-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:22px; flex-wrap:wrap; gap:10px; }
  .result-count { font-size:14px; color:var(--gray-600); }
  .overall-badge { font-size:13px; font-weight:700; padding:4px 14px; border-radius:100px; }
  .score-bars { margin-bottom:22px; }
  .score-row { display:flex; align-items:center; gap:12px; margin-bottom:10px; }
  .score-label { width:170px; font-size:13px; font-weight:600; color:var(--gray-900); flex-shrink:0; }
  .score-bar-track { flex:1; height:8px; background:var(--gray-200); border-radius:4px; overflow:hidden; }
  .score-bar-fill { height:100%; border-radius:4px; }
  .score-num { width:36px; font-size:13px; font-weight:700; text-align:right; flex-shrink:0; }
  .feedback-section { border-top:1px solid var(--gray-200); padding-top:16px; margin-top:4px; }
  .feedback-title { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:var(--gray-400); margin-bottom:10px; }
  .feedback-item { font-size:13px; color:var(--gray-600); padding:10px 14px; background:var(--gray-50); border-left:3px solid var(--gray-200); border-radius:0 6px 6px 0; margin-bottom:8px; line-height:1.55; }
  .empty-state { text-align:center; padding:40px 0; color:var(--gray-400); font-size:14px; }
  .team-list { display:flex; flex-direction:column; gap:14px; }
  .team-report-card { background:#fff; border:1px solid var(--gray-200); border-radius:var(--radius); padding:20px 24px; box-shadow:var(--shadow); }
  .trc-header { display:flex; align-items:center; gap:14px; margin-bottom:16px; }
  .trc-name { font-size:15px; font-weight:700; }
  .trc-dept { font-size:12px; color:var(--gray-400); margin-top:2px; }
  .trc-scores { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; }
  .trc-score-pill { font-size:12px; font-weight:700; padding:4px 12px; border-radius:100px; border:1px solid var(--gray-200); display:flex; align-items:center; gap:5px; }
  .trc-score-pill .pill-label { font-weight:400; color:var(--gray-600); }
  .sc1{background:#fee2e2;color:#991b1b}.sc2{background:#fef9c3;color:#78350f}.sc3{background:#dbeafe;color:#1e3a8a}.sc4{background:#dcfce7;color:#14532d}.sc5{background:#d1fae5;color:#064e3b}
  .trc-answers { display:flex; flex-direction:column; gap:8px; }
  .trc-answer { font-size:13px; color:var(--gray-900); line-height:1.5; }
  .trc-answer strong { color:var(--gray-600); font-weight:600; }
  @media (max-width: 600px) {
    .main { padding: 16px 12px; }
    .score-label { width: 110px; font-size: 12px; }
    .team-report-card { padding: 16px; }
    .toolbar { flex-direction: column; align-items: stretch; gap: 8px; }
    .toolbar select { min-width: 0; width: 100%; font-size: 16px; }
  }
`;

class MyReports extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'scorecard-data']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._user = null;
    this._scorecard = null;
    this._months = [];
    this._myAssessments = [];
    this._myReports = [];
    this._myOneOnOnes = [];
    this._myCleanliness = [];
    this._openKey = null;   // which measurable's inline panel is expanded
    this._range = 'year';   // trend timeframe: 'year' (12 mo) | 'quarter' (3 mo)
  }

  connectedCallback() {
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyInit(this.getAttribute('init-data'));
  }

  attributeChangedCallback(name, _old, value) {
    if (!value) return;
    if (name === 'init-data') this._applyInit(value);
    if (name === 'scorecard-data') this._applyScorecard(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _applyInit(json) {
    let p;
    try { p = JSON.parse(json); } catch (e) { p = { error: 'Failed to load.' }; }
    if (p.error) { this._$('loadingState').innerHTML = `<span style="color:#b91c1c">${p.error}</span>`; return; }
    this._user = p.currentUser || null;
    this._scorecard = p.scorecard || null;
    this._months = p.months || [];
    this._myAssessments = p.myAssessments || [];
    this._myReports = p.myReports || [];
    this._myOneOnOnes = p.myOneOnOnes || [];
    this._myCleanliness = p.myCleanliness || [];
    this._$('loadingState').style.display = 'none';
    this._$('content').style.display = '';
    this._renderAll();
  }

  _applyScorecard(json) {
    try { this._scorecard = JSON.parse(json); } catch (e) { return; }
    this._renderAll();
  }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <button class="backbtn" data-action="back-hub">&#8592; Back to Employee Hub</button>
      <header class="header"><h1>My Scorecard</h1><p>LocDoc · Employee Hub</p></header>
      <main class="main">
        <div id="loadingState" class="loading-state">Loading…</div>
        <div id="content" style="display:none">
          <div class="toolbar">
            <label for="monthSelect">Period:</label>
            <select id="monthSelect"></select>
          </div>
          <div id="scoreEmpty" class="loading-state" style="display:none">No scorecard has been posted for this period yet. Check back once it's been generated.</div>
          <div id="scoreBody">
            <div id="hero" class="hero"></div>
            <div id="badges" class="badges"></div>
            <div id="tiles" class="tiles"></div>
            <div id="panel" class="panel" style="display:none">
              <div class="panel-head">
                <div class="panel-title" id="panelTitle"></div>
                <button class="panel-close" data-action="close-panel" aria-label="Close">&times;</button>
              </div>
              <div id="panelBody"></div>
            </div>
          </div>
        </div>
      </main>`;

    const root = this.shadowRoot;
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="back-hub"]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
        return;
      }
      if (e.target.closest('[data-action="close-panel"]')) { this._closePanel(); return; }
      const rangeBtn = e.target.closest('[data-range]');
      if (rangeBtn) { this._setRange(rangeBtn.getAttribute('data-range')); return; }
      const tile = e.target.closest('[data-tile-key]');
      if (tile) this._togglePanel(tile.getAttribute('data-tile-key'));
    });
    root.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'monthSelect') {
        this.dispatchEvent(new CustomEvent('change-period', { detail: { period: e.target.value }, bubbles: true, composed: true }));
      }
    });
  }

  // ── RENDER ──
  _renderAll() {
    this._buildMonthSelector();
    const has = !!(this._scorecard && this._scorecard.metrics);
    this._$('scoreBody').style.display = has ? '' : 'none';
    this._$('scoreEmpty').style.display = has ? 'none' : '';
    this._closePanel(); // collapse any open detail when the data/period changes
    if (has) { this._renderHero(); this._renderBadges(); this._renderTiles(); }
  }

  _buildMonthSelector() {
    const sel = this._$('monthSelect');
    sel.innerHTML = this._months.length
      ? this._months.map(m => `<option value="${m}">${formatMonth(m)}</option>`).join('')
      : '<option value="">No data</option>';
    if (this._scorecard) sel.value = this._scorecard.period;
  }

  _renderHero() {
    const c = this._scorecard;
    const R = 46, C = 2 * Math.PI * R;
    const pct = (c.composite || 0) / 100;
    const col = scoreColor(pct);
    const lvl = c.level || { level: 1, name: 'Rookie', nextAt: null, min: 0, nextName: null };
    const towardNext = lvl.nextAt ? Math.min((c.points - lvl.min) / (lvl.nextAt - lvl.min), 1) : 1;
    this._$('hero').innerHTML = `
      <div class="ring">
        <svg width="104" height="104">
          <circle cx="52" cy="52" r="${R}" fill="none" stroke="#e5e7eb" stroke-width="9"/>
          <circle cx="52" cy="52" r="${R}" fill="none" stroke="${col}" stroke-width="9"
            stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/>
        </svg>
        <div class="ring-label"><div class="ring-score" style="color:${col}">${c.composite}</div><div class="ring-sub">/ 100</div></div>
      </div>
      <div class="hero-meta">
        <div class="hero-name">${c.name || 'You'}</div>
        <div class="hero-level">Level ${lvl.level} · ${lvl.name} · ${formatMonth(c.period)}</div>
        <div class="hero-stats">
          <div class="stat"><div class="stat-num">${c.points}</div><div class="stat-lab">Points</div></div>
          <div class="stat"><div class="stat-num">${c.streak}🔥</div><div class="stat-lab">Month Streak</div></div>
          <div class="stat"><div class="stat-num">${c.participation != null ? c.participation : 0}/3</div><div class="stat-lab">Submitted</div></div>
        </div>
        <div class="level-bar-track"><div class="level-bar-fill" style="width:${(towardNext * 100).toFixed(0)}%"></div></div>
        <div class="level-next">${lvl.nextAt ? `${lvl.nextAt - c.points} pts to ${lvl.nextName}` : 'Max level reached 🎉'}</div>
      </div>`;
  }

  _renderBadges() {
    const el = this._$('badges');
    const b = this._scorecard.badges;
    el.innerHTML = (b && b.length) ? b.map(x => `<span class="badge">${x.emoji} ${x.label}</span>`).join('') : '';
  }

  _renderTiles() {
    this._$('tiles').innerHTML = this._scorecard.metrics.map(m => `
      <div class="tile${this._openKey === m.key ? ' active' : ''}" data-tile-key="${m.key}">
        <div class="tile-top">
          <span class="tile-emoji">${m.emoji || '📊'}</span>
          <div><div class="tile-label">${m.label}</div><div class="tile-cat">${m.category || ''}</div></div>
          <span class="tile-caret">${this._openKey === m.key ? '▲' : '▼'}</span>
        </div>
        <div class="tile-status">${statusChip(m)}<span class="tile-points">+${m.points}</span></div>
        <div class="tile-bar-track"><div class="tile-bar-fill" style="width:${(m.achievement * 100).toFixed(0)}%;background:${scoreColor(m.achievement)}"></div></div>
      </div>`).join('');
  }

  // ── DRILL-DOWN (inline accordion panel below the tiles) ──
  _togglePanel(key) {
    if (this._openKey === key) { this._closePanel(); return; }
    const m = this._scorecard.metrics.find(x => x.key === key);
    if (!m) return;
    this._openKey = key;
    this._$('panelTitle').innerHTML = `${m.emoji || '📊'} ${m.label}`;
    this._$('panelBody').innerHTML = this._drawerBody(m);
    this._$('panel').style.display = '';
    this._renderTiles(); // refresh active state / carets
    // Bring the panel into view (it renders just under the grid).
    const p = this._$('panel');
    if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  _closePanel() {
    this._openKey = null;
    this._$('panel').style.display = 'none';
    this._$('panelBody').innerHTML = '';
    if (this._scorecard && this._scorecard.metrics) this._renderTiles();
  }
  // Re-render the currently open panel (used by the Quarter/Year toggle).
  _refreshPanel() {
    if (!this._openKey) return;
    const m = this._scorecard.metrics.find(x => x.key === this._openKey);
    if (m) this._$('panelBody').innerHTML = this._drawerBody(m);
  }
  _setRange(range) {
    if (range !== 'quarter' && range !== 'year') return;
    this._range = range;
    this._refreshPanel();
  }

  // ── TREND CHARTS ──
  _rangeCutoff() {
    const d = new Date();
    d.setMonth(d.getMonth() - (this._range === 'quarter' ? 3 : 12));
    return d.toISOString().slice(0, 10);
  }
  _rangeToggle() {
    return `<div class="range-toggle">
      <button class="rt${this._range === 'quarter' ? ' on' : ''}" data-range="quarter">Quarter</button>
      <button class="rt${this._range === 'year' ? ' on' : ''}" data-range="year">Year</button>
    </div>`;
  }
  _trendBlock(title, inner) {
    return `<div class="trend-block"><div class="trend-head"><div class="trend-title">${title}</div>${this._rangeToggle()}</div>${inner}</div>`;
  }

  // Generic multi-series line chart. `xs` = [{label}], each series.points aligned to xs (null = gap).
  _lineChart(xs, series, domain, yTicks) {
    const pointsCount = series.reduce((n, s) => n + s.points.filter(y => y != null).length, 0);
    if (xs.length < 2 || pointsCount < 2) return '<div class="muted" style="font-size:12px;color:var(--gray-400)">Not enough history yet for a trend — keep submitting and this will fill in.</div>';
    const W = 320, H = 132, padL = 30, padR = 10, padT = 12, padB = 26;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const [lo, hi] = domain, n = xs.length;
    const xAt = i => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const yAt = v => padT + innerH - ((v - lo) / (hi - lo)) * innerH;
    const grid = yTicks.map(t => {
      const y = yAt(t).toFixed(1);
      return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--gray-200)" stroke-width="1"/>` +
             `<text x="${padL - 4}" y="${(+y + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--gray-400)">${t}</text>`;
    }).join('');
    const step = Math.max(1, Math.ceil(n / 6));
    const xlabels = xs.map((x, i) => (i % step === 0 || i === n - 1)
      ? `<text x="${xAt(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="var(--gray-400)">${x.label}</text>` : '').join('');
    const lines = series.map(s => {
      const pts = s.points.map((y, i) => y == null ? null : `${xAt(i).toFixed(1)},${yAt(y).toFixed(1)}`).filter(Boolean).join(' ');
      const dots = s.points.map((y, i) => y == null ? '' : `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(y).toFixed(1)}" r="2.5" fill="${s.color}"/>`).join('');
      return `<polyline fill="none" stroke="${s.color}" stroke-width="2" points="${pts}"/>${dots}`;
    }).join('');
    const legend = series.length > 1
      ? `<div class="trend-legend">${series.map(s => `<span class="leg"><i style="background:${s.color}"></i>${s.label}</span>`).join('')}</div>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" class="trend-svg" preserveAspectRatio="xMidYMid meet">${grid}${xlabels}${lines}</svg>${legend}`;
  }

  _weeklyTrend() {
    const cut = this._rangeCutoff();
    const rows = this._myReports.filter(r => r.weekStart && r.weekStart >= cut).sort((a, b) => a.weekStart < b.weekStart ? -1 : 1);
    const xs = rows.map(r => ({ label: shortDate(r.weekStart) }));
    const num = v => typeof v === 'number' ? v : (v != null && !isNaN(+v) ? +v : null);
    const series = [
      { label: 'Stress',   color: '#ef4444', points: rows.map(r => num(r.stressLevel)) },
      { label: 'Morale',   color: '#10b981', points: rows.map(r => num(r.morale)) },
      { label: 'Workload', color: '#3b82f6', points: rows.map(r => num(r.workload)) },
    ];
    return this._trendBlock('Weekly check-in trends (1–5)', this._lineChart(xs, series, [1, 5], [1, 3, 5]));
  }
  _cleanTrend() {
    const cut = this._rangeCutoff();
    const rows = this._myCleanliness.filter(r => r.weekStart && r.weekStart >= cut).sort((a, b) => a.weekStart < b.weekStart ? -1 : 1);
    const xs = rows.map(r => ({ label: shortDate(r.weekStart) }));
    const series = [{ label: 'Score', color: '#15803d', points: rows.map(r => typeof r.score === 'number' ? r.score : null) }];
    return this._trendBlock('Cleanliness score trend (%)', this._lineChart(xs, series, [0, 100], [0, 50, 100]));
  }
  _assessTrend() {
    const cut = this._rangeCutoff();
    const rows = this._myAssessments.filter(a => a.dateMonth && a.dateMonth >= cut);
    const byMonth = {};
    rows.forEach(a => {
      const mk = a.dateMonth.slice(0, 7);
      criteria.forEach(c => { if (typeof a[c.key] === 'number') { (byMonth[mk] = byMonth[mk] || []).push(a[c.key]); } });
    });
    const months = Object.keys(byMonth).sort();
    const xs = months.map(mk => ({ label: shortMonth(mk) }));
    const series = [{ label: 'Avg', color: '#3b82f6', points: months.map(mk => {
      const arr = byMonth[mk]; return arr.length ? +(arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(2) : null;
    }) }];
    return this._trendBlock('Assessment score trend (/4)', this._lineChart(xs, series, [1, 4], [1, 2, 3, 4]));
  }

  _drawerBody(m) {
    if (m.key === 'submissions') return this._submissionsDetail(m);
    if (m.key === 'assessmentQuality') return this._assessmentDetail(m);
    if (m.key === 'cleanlinessQuality') return this._cleanlinessDetail(m);
    if (m.key === 'oneOnOne') return this._oneOnOneDetail(m);
    return this._genericDetail(m);
  }

  _assessmentDetail(m) {
    const month = this._scorecard.period;
    const list = this._myAssessments.filter(a => a.dateMonth && a.dateMonth.startsWith(month));
    const intro = `<div class="trc-answer" style="margin-bottom:14px"><strong>How your teammates scored you</strong> this month, across the six criteria.</div>`;
    if (!list.length) return intro + `<div class="empty-state">No assessments received for ${formatMonth(month)}.</div>`;
    const totals = {}; criteria.forEach(c => totals[c.key] = 0);
    list.forEach(a => criteria.forEach(c => totals[c.key] += (a[c.key] || 0)));
    const avgs = {}; criteria.forEach(c => avgs[c.key] = totals[c.key] / list.length);
    const overall = criteria.reduce((s, c) => s + avgs[c.key], 0) / criteria.length;
    const bars = `<div class="score-bars">${criteria.map(c => { const a = avgs[c.key], col = assessColor(a); return `<div class="score-row"><span class="score-label">${c.label}</span><div class="score-bar-track"><div class="score-bar-fill" style="width:${(a / 4 * 100).toFixed(1)}%;background:${col}"></div></div><span class="score-num" style="color:${col}">${a.toFixed(1)}</span></div>`; }).join('')}</div>`;
    const fb = list.flatMap(a => (a.feedback || '').split('\n\n').map(s => s.trim()).filter(Boolean));
    const fbHtml = fb.length ? `<div class="feedback-section"><div class="feedback-title">Feedback received</div>${fb.map(f => `<div class="feedback-item">${f}</div>`).join('')}</div>` : '';
    return intro + `<div class="result-card"><div class="result-header"><span class="result-count">${list.length} received</span><span class="overall-badge" style="background:${colorScale(overall / 4 * 100)};color:#1f2937">Overall ${overall.toFixed(1)} / 4</span></div>${bars}${fbHtml}</div>` + this._assessTrend();
  }

  _submissionsDetail(m) {
    const items = (m.detail && m.detail.items) || [];
    const intro = `<div class="trc-answer" style="margin-bottom:14px"><strong>Your participation this month</strong> — the three things to submit.</div>`;
    const rows = items.map(it => {
      const cls = it.done ? 'ok' : 'miss';
      const status = it.done ? '✓ Submitted' : 'Not yet';
      const count = it.expected != null ? ` (${it.count || 0}/${it.expected} weeks)`
        : (it.count != null ? ` (${it.count})` : '');
      return `<div class="sub-item"><span class="sub-item-emoji">${it.emoji || ''}</span><span class="sub-item-label">${it.label}</span><span class="status-chip ${cls}">${status}${count}</span></div>`;
    }).join('');
    return intro + `<div class="result-card">${rows}</div>` + this._weeklyTrend();
  }

  _weeklyDetail(m) {
    const all = this._myReports.filter(r => r.weekStart).sort((a, b) => a.weekStart < b.weekStart ? 1 : -1);
    const summary = `<div class="trc-answer" style="margin-bottom:14px"><strong>This month:</strong> ${m.detail.count || 0} of ${m.detail.expected || 0} weeks submitted</div>`;
    if (!all.length) return summary + `<div class="empty-state">No weekly reports yet.</div>`;
    const cards = all.slice(0, 16).map(r => {
      const pills = [['Stress', r.stressLevel], ['Morale', r.morale], ['Workload', r.workload]].map(([l, v]) => `<div class="trc-score-pill ${scaleInfo[v] || ''}"><span class="pill-label">${l}:</span> ${v != null ? v : '—'}</div>`).join('');
      return `<div class="team-report-card"><div class="trc-header"><div><div class="trc-name">Week of ${formatWeekRange(r.weekStart)}</div></div></div><div class="trc-scores">${pills}</div><div class="trc-answers">${r.weekHigh ? `<div class="trc-answer"><strong>High:</strong> ${r.weekHigh}</div>` : ''}${r.weekLow ? `<div class="trc-answer"><strong>Low:</strong> ${r.weekLow}</div>` : ''}${r.additionalNotes ? `<div class="trc-answer"><strong>Notes:</strong> ${r.additionalNotes}</div>` : ''}</div></div>`;
    }).join('');
    return summary + `<div class="team-list">${cards}</div>`;
  }

  _cleanlinessDetail(m) {
    const month = this._scorecard.period;
    const list = this._myCleanliness.filter(r => (r.weekStart || '').startsWith(month)).sort((a, b) => a.weekStart < b.weekStart ? 1 : -1);
    const avg = m.detail && m.detail.avgScore != null ? m.detail.avgScore : null;
    const summary = `<div class="trc-answer" style="margin-bottom:14px"><strong>This month:</strong> ${m.detail.count || 0} of ${m.detail.expected || 0} weeks submitted${avg != null ? ` · avg <span style="color:${colorScale(avg)};font-weight:800">${avg}%</span>` : ''}</div>`;
    if (!list.length) return summary + `<div class="empty-state">No cleanliness audits for ${formatMonth(month)}.</div>` + this._cleanTrend();
    const cards = list.map(r => {
      const pills = [['Overall', r.score], ['Vehicle', r.vehicleScore], ['Office', r.officeScore]]
        .filter(([, v]) => v != null)
        .map(([l, v]) => `<div class="trc-score-pill"><span class="pill-label">${l}:</span> ${v}%</div>`).join('');
      let ph = r.photoUrls;
      if (typeof ph === 'string') { try { ph = JSON.parse(ph); } catch (e) { ph = {}; } }
      const urls = ph && typeof ph === 'object' ? Object.values(ph).filter(u => typeof u === 'string' && u) : [];
      const photos = urls.map(u => `<div class="cl-thumb"><img src="${u}" alt="audit photo"></div>`).join('');
      return `<div class="team-report-card"><div class="trc-header"><div><div class="trc-name">Week of ${formatWeekRange(r.weekStart)}</div></div></div><div class="trc-scores">${pills}</div>${photos ? `<div class="cl-gallery">${photos}</div>` : ''}</div>`;
    }).join('');
    return summary + `<div class="team-list">${cards}</div>` + this._cleanTrend();
  }

  _oneOnOneDetail(m) {
    const list = this._myOneOnOnes.slice().sort((a, b) => a.meetingDate < b.meetingDate ? 1 : -1);
    const status = `<div class="trc-answer" style="margin-bottom:14px"><strong>This month:</strong> ${m.done ? '1:1 logged ✓' : 'No 1:1 logged yet'}</div>`;
    if (!list.length) return status + `<div class="empty-state">No 1:1 meetings logged yet.</div>`;
    const cards = list.slice(0, 12).map(o => `<div class="team-report-card"><div class="trc-header"><div><div class="trc-name">${o.meetingDate || ''} with ${o.managerName || 'Manager'}</div></div></div><div class="trc-answers">${o.topics ? `<div class="trc-answer"><strong>Topics:</strong> ${o.topics}</div>` : ''}${o.notes ? `<div class="trc-answer"><strong>Notes:</strong> ${o.notes}</div>` : ''}${o.followUps ? `<div class="trc-answer"><strong>Follow-ups:</strong> ${o.followUps}</div>` : ''}</div></div>`).join('');
    return status + `<div class="team-list">${cards}</div>`;
  }

  _genericDetail(m) {
    const d = m.detail || {};
    const rows = [];
    if (d.value != null) rows.push(`<div class="trc-answer"><strong>Value:</strong> ${d.value}${m.targetValue ? ` (target ${m.targetValue})` : ''}</div>`);
    if (m.valueType === 'completion') rows.push(`<div class="trc-answer"><strong>Status:</strong> ${m.done ? 'Complete ✓' : 'Not complete'}</div>`);
    if (d.notes) rows.push(`<div class="trc-answer"><strong>Notes:</strong> ${d.notes}</div>`);
    if (d.enteredByName) rows.push(`<div class="trc-answer"><strong>Recorded by:</strong> ${d.enteredByName}</div>`);
    return `<div class="team-report-card"><div class="trc-answers">${rows.join('') || '<div class="empty-state">No data recorded for this period.</div>'}</div></div>`;
  }
}

customElements.define('my-reports', MyReports);
