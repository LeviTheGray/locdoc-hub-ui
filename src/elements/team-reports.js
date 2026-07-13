/**
 * Wix Custom Element — Team Scorecard / Monthly Manager Meeting  (<team-reports>)
 *
 * Port of the htmlTeamReports HtmlComponent. Manager-gated, tabbed view: Meeting
 * Checklist, Team Scorecard (+ member drawer), plus Operations-only Weekly Check
 * and Managers roll-up. See CUSTOM-ELEMENTS.md for the recipe.
 *
 * Data handoff:
 *   • Velo → element :  init-data { hasAccess, months, period, periodLabel,
 *                                   scorecards, checklist, rollup, weeklyCheck, isOperations } | { error }
 *                       data      same render payload for a new period (period change)
 *   • element → Velo :  'change-period' { detail: { period } }
 *                       'navigate'      { detail: { key:'hub' } }
 *
 * Editor: Add → Embed Code → Custom Element → source = this file,
 * tag name `team-reports`, element ID `teamReports`.
 */

import { TOKENS } from './tokens.js';

const ONE_ON_ONE_URL = '/one-on-ones'; // in-site: relative, not a hardcoded team.locdoc.net URL

function initials(n) { return (n || '?').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase(); }
function avatar(p) { return p.headshotUrl ? `<img class="avatar" src="${p.headshotUrl}" alt="">` : `<div class="avatar">${initials(p.name)}</div>`; }
function scoreColor(v) { return v >= 85 ? '#10b981' : v >= 50 ? '#f59e0b' : '#ef4444'; }
function escHtml(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function weekRangeLabel(ws) {
  const d = new Date(ws + 'T00:00:00'); const end = new Date(d); end.setDate(end.getDate() + 6);
  const f = x => x.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${f(d)} – ${f(end)}`;
}
function wcPill(label, v) { return (v == null || v === '') ? '' : `<span class="status-chip partial">${label}: ${v}</span>`; }

const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ${TOKENS}
  :host { background:var(--gray-50); }
  .backbtn { display:inline-flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; color:#6b7280; font:600 13px system-ui,-apple-system,sans-serif; padding:12px 16px 0; }
  .header { background:var(--primary); color:#fff; padding:16px 24px; box-shadow:var(--shadow-md); }
  .header h1 { font-size:18px; font-weight:700; }
  .header p { font-size:12px; opacity:.75; margin-top:2px; }
  .main { max-width:820px; margin:0 auto; padding:24px 16px; }
  .loading-state { text-align:center; padding:64px 0; color:var(--gray-400); font-size:15px; }
  .empty-state { text-align:center; padding:40px 0; color:var(--gray-400); font-size:14px; }
  .toolbar { display:flex; align-items:center; gap:12px; margin-bottom:18px; flex-wrap:wrap; }
  .toolbar label { font-size:13px; font-weight:600; color:var(--gray-600); }
  .toolbar select { padding:7px 36px 7px 10px; border:1px solid var(--gray-200); border-radius:8px; font-size:14px; background:#fff; cursor:pointer; min-width:170px; -webkit-appearance:none; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M6 8L1 3h10z' fill='%236b7280'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; }
  .toolbar select:focus { outline:2px solid var(--primary); outline-offset:-1px; }
  .print-btn { margin-left:auto; background:var(--gray-100); border:1px solid var(--gray-200); color:var(--gray-600); border-radius:8px; padding:7px 14px; font-size:13px; font-weight:600; cursor:pointer; }
  .print-btn:hover { background:var(--gray-200); }
  .tab-bar { display:flex; gap:4px; margin-bottom:22px; border-bottom:2px solid var(--gray-200); flex-wrap:wrap; }
  .tab-btn { padding:12px 16px; background:none; border:none; font-size:14px; font-weight:600; color:var(--gray-400); cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-2px; -webkit-tap-highlight-color:transparent; }
  .tab-btn.active { color:var(--primary); border-bottom-color:var(--primary); }
  .tab-btn:hover:not(.active){ color:var(--gray-600); }
  .card { background:#fff; border:1px solid var(--gray-200); border-radius:var(--radius); box-shadow:var(--shadow); padding:18px 20px; margin-bottom:14px; }
  .card-title { font-size:14px; font-weight:800; margin-bottom:2px; display:flex; align-items:center; gap:8px; }
  .card-sub { font-size:12px; color:var(--gray-400); margin-bottom:14px; }
  .chk-summary { font-size:13px; font-weight:700; padding:3px 12px; border-radius:100px; }
  .chk-grid { display:flex; flex-direction:column; gap:8px; }
  .chk-row { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; background:var(--gray-50); }
  .chk-name { font-size:13px; font-weight:600; }
  .chk-dot { margin-left:auto; font-size:16px; }
  .log-link { font-size:12px; font-weight:700; color:var(--primary); text-decoration:none; }
  .lb-row { display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px solid var(--gray-200); border-radius:10px; background:#fff; margin-bottom:8px; cursor:pointer; transition:box-shadow .12s; }
  .lb-row:hover { box-shadow:var(--shadow-md); }
  .lb-rank { width:24px; font-size:14px; font-weight:800; color:var(--gray-400); text-align:center; }
  .avatar { width:36px; height:36px; border-radius:50%; background:var(--gray-200); color:var(--gray-600); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; flex-shrink:0; object-fit:cover; }
  .lb-name { font-size:14px; font-weight:700; }
  .lb-dept { font-size:12px; color:var(--gray-400); }
  .lb-right { margin-left:auto; text-align:right; }
  .lb-score { font-size:18px; font-weight:800; }
  .lb-meta { font-size:11px; color:var(--gray-400); }
  .pips { display:flex; gap:4px; margin-top:4px; justify-content:flex-end; }
  .pip { width:9px; height:9px; border-radius:3px; background:var(--gray-200); }
  .pip.on { background:var(--primary); }
  .pip.partial { background:#f59e0b; }
  .ru-bar-track { height:8px; background:var(--gray-200); border-radius:4px; overflow:hidden; min-width:80px; }
  .ru-bar-fill { height:100%; border-radius:4px; }
  .drawer-overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); z-index:200; display:none; align-items:flex-end; justify-content:center; }
  .drawer-overlay.open { display:flex; }
  .drawer { background:var(--gray-50); width:100%; max-width:760px; max-height:88vh; overflow-y:auto; border-radius:16px 16px 0 0; padding:20px 18px 40px; }
  .drawer-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
  .drawer-title { font-size:17px; font-weight:800; }
  .drawer-close { background:none; border:none; font-size:24px; color:var(--gray-400); cursor:pointer; line-height:1; }
  .m-row { display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--gray-200); }
  .m-emoji { font-size:18px; } .m-label { font-size:14px; font-weight:600; flex:1; }
  .status-chip { font-size:12px; font-weight:700; padding:3px 10px; border-radius:100px; }
  .ok{background:#dcfce7;color:#14532d}.miss{background:#fee2e2;color:#991b1b}.partial{background:#fef9c3;color:#78350f}
  .section-title { font-size:13px; font-weight:800; color:var(--gray-600); margin:18px 0 10px; text-transform:uppercase; letter-spacing:.03em; }
  .wc-metrics { display:flex; gap:8px; flex-wrap:wrap; margin:10px 0 4px; }
  .wc-answer { font-size:13px; color:var(--gray-600); margin-top:6px; line-height:1.45; }
  .wc-answer strong { color:var(--gray-900); }
  @media (max-width:600px){ .main{padding:16px 12px;} .toolbar select{min-width:0;width:100%;font-size:16px;} }
  @media print {
    .header, .toolbar, .tab-bar, .print-btn, .log-link, .backbtn, button { display:none !important; }
    .main { max-width:none; padding:0; }
    .card, .lb-row { box-shadow:none; break-inside:avoid; }
    #viewChecklist, #viewTeam, #viewWeeklyCheck, #viewManagers { display:block !important; }
    .print-only { display:block !important; }
  }
  .print-only { display:none; }
`;

class TeamReports extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'data']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._data = null;
    this._months = [];
    this._currentTab = 'checklist';
    this._selectedWeek = null;
  }

  connectedCallback() {
    this._renderShell();
    if (this.hasAttribute('init-data')) this._applyInit(this.getAttribute('init-data'));
  }

  attributeChangedCallback(name, _old, value) {
    if (!value) return;
    if (name === 'init-data') this._applyInit(value);
    if (name === 'data') this._applyData(value);
  }

  _$(id) { return this.shadowRoot.getElementById(id); }

  _renderShell() {
    if (this._shell) return;
    this._shell = true;
    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <button class="backbtn" data-action="back-hub">&#8592; Back to Employee Hub</button>
      <header class="header"><h1>Team Scorecard</h1><p>LocDoc · Monthly Manager Meeting</p></header>
      <main class="main">
        <div id="loadingState" class="loading-state">Loading…</div>
        <div id="noAccess" class="empty-state" style="display:none">Team Scorecard is available to managers. If you should have access, ask Operations to set your <em>manager</em> field.</div>
        <div id="content" style="display:none">
          <div class="print-only" id="printHead"></div>
          <div class="toolbar">
            <label for="monthSelect">Period:</label>
            <select id="monthSelect"></select>
            <button class="print-btn" data-action="print">🖨 Print / Export</button>
          </div>
          <div class="tab-bar" id="tabBar"></div>
          <div id="viewChecklist"></div>
          <div id="viewTeam" style="display:none"></div>
          <div id="viewWeeklyCheck" style="display:none"></div>
          <div id="viewManagers" style="display:none"></div>
        </div>
      </main>
      <div id="drawerOverlay" class="drawer-overlay">
        <div class="drawer">
          <div class="drawer-head"><div class="drawer-title" id="drawerTitle"></div><button class="drawer-close" data-action="close-drawer">&times;</button></div>
          <div id="drawerBody"></div>
        </div>
      </div>`;

    const root = this.shadowRoot;
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="back-hub"]')) {
        this.dispatchEvent(new CustomEvent('navigate', { detail: { key: 'hub' }, bubbles: true, composed: true }));
        return;
      }
      if (e.target.closest('[data-action="print"]')) { window.print(); return; }
      if (e.target.closest('[data-action="close-drawer"]')) { this._closeDrawer(); return; }
      if (e.target === this._$('drawerOverlay')) { this._closeDrawer(); return; }
      const tab = e.target.closest('[data-tab]');
      if (tab) { this._switchTab(tab.getAttribute('data-tab')); return; }
      const row = e.target.closest('[data-member]');
      if (row) this._openMember(parseInt(row.getAttribute('data-member'), 10));
    });
    root.addEventListener('change', (e) => {
      if (e.target && e.target.id === 'monthSelect') {
        this.dispatchEvent(new CustomEvent('change-period', { detail: { period: e.target.value }, bubbles: true, composed: true }));
      }
      if (e.target && e.target.id === 'weekSelect') { this._selectedWeek = e.target.value; this._renderWeeklyCheck(); }
    });
  }

  _applyInit(json) {
    let p;
    try { p = JSON.parse(json); } catch (e) { p = { error: 'Failed to load.' }; }
    if (p.error) { this._$('loadingState').innerHTML = `<span style="color:#b91c1c">${p.error}</span>`; return; }
    this._months = p.months || [];
    this._$('loadingState').style.display = 'none';
    if (!p.hasAccess) { this._$('noAccess').style.display = ''; return; }
    this._data = p;
    this._$('content').style.display = '';
    this._buildMonthSelector();
    this._renderAll();
  }

  _applyData(json) {
    let p;
    try { p = JSON.parse(json); } catch (e) { return; }
    this._data = p;
    this._buildMonthSelector();
    this._renderAll();
  }

  _buildTabs() {
    const tabs = [['checklist', '📋 Meeting Checklist'], ['team', '🏆 Team Scorecard']];
    if (this._data.isOperations) tabs.push(['weeklycheck', '📝 Weekly Check']);
    if (this._data.isOperations) tabs.push(['managers', '👔 Managers']);
    this._$('tabBar').innerHTML = tabs.map(([k, l]) => `<button class="tab-btn ${k === this._currentTab ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('');
  }

  _switchTab(t) {
    this._currentTab = t; this._buildTabs();
    this._$('viewChecklist').style.display = t === 'checklist' ? '' : 'none';
    this._$('viewTeam').style.display = t === 'team' ? '' : 'none';
    this._$('viewWeeklyCheck').style.display = t === 'weeklycheck' ? '' : 'none';
    this._$('viewManagers').style.display = t === 'managers' ? '' : 'none';
  }

  _renderChecklist() {
    const c = this._data.checklist;
    const el = this._$('viewChecklist');
    if (!c || !c.items || !c.items.length || !c.reports.length) {
      el.innerHTML = `<div class="card"><div class="empty-state">No managerial measurables or direct reports to review.</div></div>`;
      return;
    }
    el.innerHTML = c.items.map(item => {
      const done = item.rows.filter(r => r.done).length;
      const total = item.rows.length;
      const pct = total ? Math.round(done / total * 100) : 0;
      const chipCls = pct === 100 ? 'ok' : pct > 0 ? 'partial' : 'miss';
      const rows = item.rows.map(r => `<div class="chk-row"><span class="chk-name">${r.name}</span>
        ${!r.done && item.key === 'oneOnOne' ? `<a class="log-link" href="${ONE_ON_ONE_URL}" target="_top">Log 1:1 →</a>` : ''}
        <span class="chk-dot">${r.done ? '🟢' : '⚪'}</span></div>`).join('');
      return `<div class="card"><div class="card-title">${item.emoji || '✅'} ${item.label}
        <span class="chk-summary ${chipCls}" style="margin-left:auto">${done}/${total} done</span></div>
        <div class="card-sub">Have you completed this for each report in ${this._data.periodLabel}?</div>
        <div class="chk-grid">${rows}</div></div>`;
    }).join('');
  }

  _renderTeam() {
    const el = this._$('viewTeam');
    const cards = this._data.scorecards || [];
    if (!cards.length) { el.innerHTML = `<div class="card"><div class="empty-state">No team members in scope.</div></div>`; return; }
    const rows = cards.map((c, i) => {
      const pips = c.metrics.map(m => `<div class="pip ${m.done ? 'on' : m.achievement > 0 ? 'partial' : ''}" title="${m.label}"></div>`).join('');
      return `<div class="lb-row" data-member="${i}">
        <span class="lb-rank">${i + 1}</span>${avatar(c)}
        <div><div class="lb-name">${c.name}</div><div class="lb-dept">${c.department || ''} · Lvl ${c.level ? c.level.level : 1} · ${c.streak}🔥</div></div>
        <div class="lb-right"><div class="lb-score" style="color:${scoreColor(c.composite)}">${c.composite}</div>
          <div class="lb-meta">${c.points} pts</div><div class="pips">${pips}</div></div></div>`;
    }).join('');
    el.innerHTML = `<div class="card" style="padding:14px 20px"><div class="card-sub" style="margin:0">Ranked by composite score for ${this._data.periodLabel}. Tap a member for detail.</div></div>${rows}`;
  }

  _openMember(i) {
    const c = this._data.scorecards[i];
    this._$('drawerTitle').textContent = `${c.name} — ${c.composite}/100`;
    const badges = (c.badges || []).map(b => `<span class="status-chip ok" style="margin-right:6px">${b.emoji} ${b.label}</span>`).join('');
    const rows = c.metrics.map(m => {
      let chip;
      if (m.key === 'submissions') {
        const items = (m.detail && m.detail.items) || [];
        const d = items.filter(i => i.done).length, t = items.length || 3;
        const cls = d === t ? 'ok' : d === 0 ? 'miss' : 'partial';
        chip = `<span class="status-chip ${cls}">${d}/${t} submitted</span>`;
      } else if (m.valueType === 'quality') {
        chip = m.value == null
          ? '<span class="status-chip miss">No data</span>'
          : `<span class="status-chip ${m.achievement >= .85 ? 'ok' : m.achievement >= .5 ? 'partial' : 'miss'}">${m.max === 4 ? Number(m.value).toFixed(1) + ' / 4' : m.value + '%'}</span>`;
      } else if (m.valueType === 'completion') {
        chip = m.done ? '<span class="status-chip ok">✓ Done</span>' : '<span class="status-chip miss">Not yet</span>';
      } else {
        chip = `<span class="status-chip ${m.achievement >= 1 ? 'ok' : m.achievement >= .5 ? 'partial' : 'miss'}">${m.detail.value != null ? m.detail.value : '—'}${m.targetValue ? ' / ' + m.targetValue : ''}</span>`;
      }
      return `<div class="m-row"><span class="m-emoji">${m.emoji || '📊'}</span><span class="m-label">${m.label}</span><span class="lb-meta" style="margin-right:10px">+${m.points}</span>${chip}</div>`;
    }).join('');
    this._$('drawerBody').innerHTML = `<div style="margin-bottom:14px">${badges || '<span class="lb-meta">No badges yet this period.</span>'}</div>${rows}`;
    this._$('drawerOverlay').classList.add('open');
  }
  _closeDrawer() { this._$('drawerOverlay').classList.remove('open'); }

  _renderManagers() {
    const el = this._$('viewManagers');
    const ru = this._data.rollup;
    if (!ru || !ru.rows || !ru.rows.length) { el.innerHTML = `<div class="card"><div class="empty-state">No managers to review.</div></div>`; return; }
    el.innerHTML = `<div class="card" style="padding:14px 20px"><div class="card-sub" style="margin:0">Each manager's completion of their managerial measurables for ${this._data.periodLabel}.</div></div>` +
      ru.rows.map(r => {
        const pct = r.completionPct == null ? 0 : r.completionPct;
        const col = scoreColor(pct);
        const detail = r.perMetric.map(m => `${m.emoji || ''} ${m.label}: ${m.done}/${m.total}`).join(' · ');
        return `<div class="lb-row" style="cursor:default">${avatar(r)}
          <div style="flex:1"><div class="lb-name">${r.name}</div><div class="lb-dept">${r.reportCount} report(s) · ${detail}</div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:8px"><div class="ru-bar-track" style="flex:1"><div class="ru-bar-fill" style="width:${pct}%;background:${col}"></div></div></div></div>
          <div class="lb-right"><div class="lb-score" style="color:${col}">${r.completionPct == null ? '—' : pct + '%'}</div></div></div>`;
      }).join('');
  }

  _renderWeeklyCheck() {
    const el = this._$('viewWeeklyCheck');
    const wc = this._data.weeklyCheck;
    if (!wc || !wc.weeks || !wc.weeks.length) {
      el.innerHTML = `<div class="card"><div class="empty-state">No weekly report data available.</div></div>`; return;
    }
    if (!this._selectedWeek || !wc.weeks.includes(this._selectedWeek)) this._selectedWeek = wc.weeks[0];
    const opts = wc.weeks.map((w, i) => `<option value="${w}"${w === this._selectedWeek ? ' selected' : ''}>${weekRangeLabel(w)}${i === 0 ? ' (current)' : ''}</option>`).join('');
    const wk = wc.byWeek[this._selectedWeek] || { submitted: [] };
    const submitted = (wk.submitted || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const submittedIds = new Set(submitted.map(s => s.subjectId));
    const notSubmitted = (wc.reports || []).filter(r => !submittedIds.has(r._id)).sort((a, b) => a.name.localeCompare(b.name));
    const total = (wc.reports || []).length;

    const subCards = submitted.length ? submitted.map(s => `
      <div class="card">
        <div class="card-title">${escHtml(s.name)}<span class="chk-summary ok" style="margin-left:auto">🟢 Submitted</span></div>
        ${s.department ? `<div class="card-sub" style="margin-bottom:0">${escHtml(s.department)}</div>` : ''}
        <div class="wc-metrics">${wcPill('Stress', s.stressLevel)}${wcPill('Morale', s.morale)}${wcPill('Workload', s.workload)}</div>
        ${s.weekHigh ? `<div class="wc-answer"><strong>High:</strong> ${escHtml(s.weekHigh)}</div>` : ''}
        ${s.weekLow ? `<div class="wc-answer"><strong>Low:</strong> ${escHtml(s.weekLow)}</div>` : ''}
        ${s.additionalNotes ? `<div class="wc-answer"><strong>Notes:</strong> ${escHtml(s.additionalNotes)}</div>` : ''}
      </div>`).join('') : `<div class="card"><div class="empty-state">No reports submitted for this week.</div></div>`;

    const notRows = notSubmitted.length
      ? `<div class="card"><div class="chk-grid">${notSubmitted.map(r => `<div class="chk-row"><span class="chk-name">${escHtml(r.name)}</span><span class="chk-dot">⚪</span></div>`).join('')}</div></div>`
      : `<div class="card"><div class="empty-state">Everyone submitted this week 🎉</div></div>`;

    el.innerHTML = `
      <div class="card" style="padding:14px 20px">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap">
          <label for="weekSelect" style="font-size:13px; font-weight:600; color:var(--gray-600)">Week:</label>
          <select id="weekSelect" style="padding:7px 36px 7px 10px; border:1px solid var(--gray-200); border-radius:8px; font-size:14px; background:#fff; cursor:pointer;">${opts}</select>
          <span class="card-sub" style="margin:0; margin-left:auto">${submitted.length}/${total} submitted</span>
        </div>
      </div>
      <div class="section-title">✅ Submitted (${submitted.length})</div>
      ${subCards}
      <div class="section-title">⚠️ Not submitted (${notSubmitted.length})</div>
      ${notRows}`;
  }

  _renderAll() {
    this._$('printHead').innerHTML = `<h2 style="margin-bottom:4px">Monthly Manager Meeting — ${this._data.periodLabel}</h2>`;
    this._buildTabs(); this._renderChecklist(); this._renderTeam();
    if (this._data.isOperations) { this._renderWeeklyCheck(); this._renderManagers(); }
  }

  _buildMonthSelector() {
    const sel = this._$('monthSelect');
    const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    sel.innerHTML = this._months.map(m => { const [y, mm] = m.split('-').map(Number); return `<option value="${m}">${names[mm - 1]} ${y}</option>`; }).join('');
    if (this._data) sel.value = this._data.period;
  }
}

customElements.define('team-reports', TeamReports);
