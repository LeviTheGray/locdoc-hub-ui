/**
 * Wix Custom Element — unified Shop  (<locdoc-shop>)
 *
 * One page, one cart, three item sources:
 *   • Uniform — the Wix Stores catalog (product / size / color / qty)
 *   • SanMar  — custom item: item number + typed price + color/size, with hat / pants / logo options
 *   • Amazon  — custom item: product URL + typed price + color/size/width
 *
 * Everything is paid for with loyalty points (1:1 with dollars). Replaces three pages: the native
 * Wix Stores uniform shop, San Mar Shop.awvof.js (993 lines wired to ~40 editor element IDs, with
 * fallback ID lists for the ones that drifted) and Amazon Shop.xktwt.js.
 *
 * Data handoff (see CUSTOM-ELEMENTS.md):
 *   Velo → element : init-data      { currentUser, points, catalog, orders }
 *                    submit-result  { ok, error?, points? }   (carries a _ts nonce)
 *                    quote-result   { total, points, _q }
 *   element → Velo : submit-cart    (detail: cart lines)
 *                    quote-cart     (detail: { q, lines }) — server re-prices; browser never decides
 *                    navigate       (detail: { key })
 *
 * Pricing is imported from ./shop-pricing.js — the SAME module the backend uses — so the preview a
 * user sees and the total they're charged come from one source. The server still re-prices at
 * checkout and ignores anything this element sends as a total; the local math is for responsiveness.
 *
 * Editor setup (one time): Add → Embed Code → Custom Element → source
 * src/public/custom-elements/shop.js, tag `locdoc-shop`, element ID `locdocShop`. Page: Members Only.
 */

import { TOKENS, ensureMaterialSymbols } from './tokens.js';
import { cartTotal, pointsForCart, priceLine, validateLine } from './shop-pricing.js';

const HAT_PLACEMENTS = ['Front', 'Front Center', 'Left Side', 'Right Side', 'Back'];
const LOGO_OPTIONS = ['None', 'LocDoc', 'LocDoc + Name'];
const LOGO_COLORS = ['White', 'Black', 'Green', 'Grey'];

const STYLES = `
  ${TOKENS}
  :host { background: var(--gray-50); }

  .header { background: var(--primary); color: #fff; padding: 14px 24px; display: flex; align-items: center; gap: 16px; box-shadow: var(--shadow-md); }
  .header h1 { font-size: 18px; font-weight: 700; }
  .header .pts { margin-left: auto; display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,.16); padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; }

  .main { max-width: 1080px; margin: 0 auto; padding: 24px 16px 64px; display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; }
  @media (max-width: 900px) { .main { grid-template-columns: 1fr; } }
  /* Admin has no cart, so don't reserve the 340px column for it — the review screen wants the room. */
  .main.no-cart { grid-template-columns: 1fr; }

  .tabs { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
  .tab { border: 1.5px solid var(--gray-200); background: #fff; color: var(--gray-600); border-radius: 999px; padding: 8px 16px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .tab.active { background: var(--primary); color: #fff; border-color: var(--primary); }

  .card { background: #fff; border: 1.5px solid var(--gray-200); border-radius: var(--radius); box-shadow: var(--shadow); padding: 18px; }
  .card + .card { margin-top: 16px; }
  .card h2 { font-size: 15px; font-weight: 700; margin-bottom: 14px; }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  label.f { display: flex; flex-direction: column; gap: 5px; font-size: 12px; font-weight: 600; color: var(--gray-600); }
  input, select { padding: 9px 10px; border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); font: inherit; font-size: 14px; background: #fff; color: var(--gray-900); outline: none; width: 100%; }
  input:focus, select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(var(--primary-rgb),.12); }
  .checks { display: flex; gap: 18px; margin: 14px 0; }
  .chk { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--gray-600); cursor: pointer; }
  .chk input { width: auto; }
  .sub { margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--gray-200); }

  .preview { margin-top: 14px; font-size: 13px; color: var(--gray-600); }
  .preview b { color: var(--gray-900); font-size: 15px; }

  .btn { border: none; border-radius: var(--radius-sm); padding: 10px 16px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; background: var(--primary); color: #fff; }
  .btn:hover { background: var(--primary-dk); }
  .btn:disabled { opacity: .5; cursor: not-allowed; }
  .btn.ghost { background: none; color: var(--primary); border: 1.5px solid var(--gray-200); }
  .row { display: flex; gap: 10px; align-items: center; margin-top: 14px; }

  .err { color: var(--error); font-size: 13px; font-weight: 600; margin-top: 10px; }
  .ok  { color: var(--success); font-size: 13px; font-weight: 600; margin-top: 10px; }

  /* Catalog */
  .prods { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
  .prod { border: 1.5px solid var(--gray-200); border-radius: var(--radius); padding: 10px; cursor: pointer; text-align: left; background: #fff; }
  .prod:hover, .prod.sel { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(var(--primary-rgb),.10); }
  .prod img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--radius-sm); background: var(--gray-100); margin-bottom: 8px; }
  .prod .n { font-size: 13px; font-weight: 700; line-height: 1.3; }
  .prod .p { font-size: 12px; color: var(--gray-600); margin-top: 2px; }

  /* Cart */
  .cart { position: sticky; top: 16px; }
  .line { display: flex; gap: 10px; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid var(--gray-100); font-size: 13px; }
  .line .t { flex: 1; }
  .line .t b { display: block; color: var(--gray-900); }
  .line .t span { color: var(--gray-400); font-size: 12px; }
  .line .amt { font-weight: 700; white-space: nowrap; }
  .line .x { background: none; border: none; cursor: pointer; color: var(--gray-400); font: inherit; padding: 0 2px; }
  .line .x:hover { color: var(--error); }
  .totals { display: flex; justify-content: space-between; align-items: baseline; margin-top: 14px; font-weight: 700; }
  .totals .big { font-size: 20px; }
  .short { background: #fdecea; color: var(--error); border-radius: var(--radius-sm); padding: 8px 10px; font-size: 12.5px; font-weight: 600; margin-top: 10px; }
  .empty { color: var(--gray-400); font-size: 13px; padding: 14px 0; }

  /* Orders */
  .ord { border-top: 1px solid var(--gray-100); padding: 10px 0; font-size: 13px; }
  .ord:first-child { border-top: none; }
  .ord .h { display: flex; justify-content: space-between; gap: 8px; }
  .ord .st { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--primary-dk); }
  .ord .m { color: var(--gray-400); font-size: 12px; margin-top: 2px; }

  .material-symbols-outlined { font-size: 18px; }
`;

class LocDocShop extends HTMLElement {
  static get observedAttributes() { return ['init-data', 'submit-result', 'quote-result', 'admin-result']; }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._tab = 'uniform';
    this._cart = [];
    this._catalog = [];
    this._orders = [];
    this._points = 0;
    this._user = null;
    this._sel = null;       // selected uniform product
    this._editingId = null; // cart line being edited
    this._err = '';
    this._msg = '';
    this._busy = false;
    this._loading = true;
    this._q = 0;            // quote nonce
    this._serverTotal = null;

    // ---- Admin tab. Shown only when init-data says isAdmin; every backend method re-checks,
    // so this is an affordance, not a gate.
    this._isAdmin = false;
    this._adminOrders = [];   // the queue
    this._adminOrder = null;  // { order, items, charged } — the order open for review
    this._adminStatuses = [];
    this._adminBusy = false;
    this._adminErr = '';
    this._adminMsg = '';
    this._adminLoaded = false;
    this._adminPreview = null;   // { points, charged, delta, total } — the pending decision
    this._adminConfirmed = null; // the prices that preview was computed from
  }

  connectedCallback() {
    ensureMaterialSymbols();
    this._render();
  }

  attributeChangedCallback(name, _old, value) {
    if (!value) return;
    let data = {};
    try { data = JSON.parse(value) || {}; } catch (e) { return; }

    if (name === 'init-data') {
      this._loading = false;
      if (data.ok === false) { this._err = data.reason || 'Could not load the shop.'; this._render(); return; }
      this._user = data.currentUser || null;
      this._points = Number(data.points) || 0;
      this._catalog = Array.isArray(data.catalog) ? data.catalog : [];
      this._orders = Array.isArray(data.orders) ? data.orders : [];
      this._isAdmin = Boolean(data.isAdmin);
      this._render();
    }

    if (name === 'admin-result') this._applyAdminResult(data);

    if (name === 'quote-result') {
      // Ignore a stale quote that lands after a newer one.
      if (Number(data._q) !== this._q) return;
      this._serverTotal = { total: Number(data.total) || 0, points: Number(data.points) || 0 };
      this._renderCart();
    }

    if (name === 'submit-result') {
      this._busy = false;
      if (data.ok) {
        this._cart = [];
        this._serverTotal = null;
        this._msg = 'Order submitted. Points have been deducted.';
        this._err = '';
        if (Number.isFinite(data.points)) this._points -= Number(data.points);
      } else {
        this._err = data.error || 'Submit failed.';
        this._msg = '';
      }
      this._render();
    }
  }

  // ---- cart ----------------------------------------------------------------

  get _total() { return this._serverTotal ? this._serverTotal.total : cartTotal(this._cart); }
  get _cost() { return this._serverTotal ? this._serverTotal.points : pointsForCart(this._cart); }
  get _short() { return this._cost - this._points; }

  _addLine(line) {
    const problem = validateLine(line);
    if (problem) { this._err = problem; this._render(); return; }

    // Editing replaces in place. The old shop DELETED the line and refilled the form, so navigating
    // away mid-edit silently lost it.
    if (this._editingId) {
      const i = this._cart.findIndex((l) => l._id === this._editingId);
      if (i >= 0) this._cart[i] = { ...line, _id: this._editingId };
      this._editingId = null;
    } else {
      this._cart.push({ ...line, _id: `l${Date.now()}${Math.random().toString(36).slice(2, 6)}` });
    }
    this._err = '';
    this._msg = '';
    this._sel = null;
    this._requestQuote();
    this._render();
  }

  _removeLine(id) {
    this._cart = this._cart.filter((l) => l._id !== id);
    if (this._editingId === id) this._editingId = null;
    this._requestQuote();
    this._render();
  }

  _editLine(id) {
    const line = this._cart.find((l) => l._id === id);
    if (!line) return;
    this._editingId = id;
    this._tab = line.source;
    this._err = '';
    this._render();
    this._fillForm(line);
  }

  // Ask Velo (→ backend) to price the cart. The browser's own total is only a preview.
  _requestQuote() {
    this._q += 1;
    if (!this._cart.length) { this._serverTotal = null; return; }
    this.dispatchEvent(new CustomEvent('quote-cart', {
      detail: { q: this._q, lines: this._cart },
      bubbles: true, composed: true,
    }));
  }

  _submit() {
    if (!this._cart.length || this._busy) return;
    if (this._short > 0) {
      // Caught BEFORE submit — the old shop only surfaced this after the round-trip failed.
      this._err = `Insufficient points. You have ${this._points}, this order costs ${this._cost}.`;
      this._render();
      return;
    }
    this._busy = true;
    this._err = '';
    this._render();
    this.dispatchEvent(new CustomEvent('submit-cart', { detail: this._cart, bubbles: true, composed: true }));
  }

  // ---- admin ---------------------------------------------------------------

  // Every admin action goes out as an event and comes back through the single `admin-result`
  // attribute, tagged with `kind` so we know which request it answers.
  _adminSend(kind, detail) {
    this._adminBusy = true;
    this._adminErr = '';
    this.dispatchEvent(new CustomEvent(kind, { detail, bubbles: true, composed: true }));
    this._renderPanel();
  }

  _applyAdminResult(data) {
    this._adminBusy = false;
    const kind = data.kind || '';

    if (data.ok === false) {
      // A refused confirm is the interesting case: the backend rejects rather than pushing the
      // member negative, and its message says how many points short they are. Surface it verbatim.
      this._adminErr = data.error || 'That admin action failed.';
      this._renderPanel();
      return;
    }

    if (kind === 'list') {
      this._adminOrders = Array.isArray(data.orders) ? data.orders : [];
      this._adminStatuses = Array.isArray(data.statuses) ? data.statuses : [];
      this._adminLoaded = true;
    } else if (kind === 'review') {
      this._adminOrder = { order: data.order, items: data.items || [], charged: Number(data.charged) || 0 };
      this._adminPreview = null;   // a freshly opened order has no pending decision
      this._adminConfirmed = null;
    } else if (kind === 'preview') {
      // Nothing has been written yet — this is the decision step.
      this._adminPreview = {
        points: Number(data.points) || 0,
        charged: Number(data.charged) || 0,
        delta: Number(data.delta) || 0,
        total: Number(data.total) || 0,
      };
    } else if (kind === 'confirm') {
      const d = Number(data.delta) || 0;
      this._adminMsg = data.settled
        ? `Prices confirmed — ${data.points} pts. `
          + (d > 0 ? `${d} pts refunded to the member.` : `${Math.abs(d)} pts charged to the member.`)
        : `Prices confirmed — ${data.points} pts. Member's points left as charged (${data.charged} pts).`;
      this._adminPreview = null;
      this._adminOrder = null;
      this._adminRefresh();
    } else if (kind === 'status') {
      this._adminMsg = `Status set to ${data.status}.`;
      this._adminOrder = null;
      this._adminRefresh();
    } else if (kind === 'cancel') {
      this._adminMsg = `Order cancelled — ${data.refunded} pts refunded.`;
      this._adminOrder = null;
      this._adminRefresh();
    }
    this._renderPanel();
  }

  _adminRefresh() { this._adminSend('admin-list', {}); }

  _adminPanel() {
    if (this._adminOrder) return this._adminReview();

    if (!this._adminLoaded && !this._adminBusy) { this._adminRefresh(); }

    const rows = this._adminOrders.map((o) => `
      <div class="ord">
        <div class="h">
          <b>${this._esc(o.orderNumber || 'Order')}</b>
          <span class="st">${this._esc(o.status)}</span>
        </div>
        <div class="m">
          ${this._esc(o.memberName || o.memberEmail || '')} · ${this._esc(o.shopSource)} ·
          ${o.charged} pts${o.pricingConfirmed ? '' : ' (estimated)'} · ${this._fmtDate(o.submittedDate)}
        </div>
        <div class="row" style="margin-top:8px">
          <button class="btn" data-review="${this._escA(o._id)}">Review</button>
        </div>
      </div>`).join('');

    return `
      <h2>Order queue</h2>
      ${this._adminMsg ? `<div class="ok">${this._esc(this._adminMsg)}</div>` : ''}
      ${this._adminErr ? `<div class="short">${this._esc(this._adminErr)}</div>` : ''}
      ${this._adminBusy && !this._adminLoaded ? '<div class="empty">Loading orders…</div>' : ''}
      ${this._adminLoaded && !this._adminOrders.length ? '<div class="empty">No open orders.</div>' : rows}`;
  }

  _adminReview() {
    const { order, items, charged } = this._adminOrder;
    const isSanmar = String(order.shopSource || '').toLowerCase() === 'sanmar';

    // SanMar lines price off clothingPrice (logo/placement fees are added on top by the pricing
    // module); everything else prices off unitPrice. Edit whichever this source actually uses.
    const lines = items.map((it) => {
      const price = isSanmar ? it.clothingPrice : it.unitPrice;
      const label = it.itemNumber || it.name || it.productName || 'Item';
      const bits = [it.size || it.hatSize || it.pantSize, it.color, `Qty ${Number(it.quantity) || 1}`].filter(Boolean);
      return `
        <div class="line">
          <div class="t">
            <b>${this._esc(label)}</b>
            <span>${this._esc(bits.join(' · '))}</span>
          </div>
          <label style="display:flex;align-items:center;gap:6px">
            <span style="color:var(--gray-400);font-size:12px">Unit $</span>
            <input type="number" step="0.01" min="0" style="width:90px"
              data-price="${this._escA(it._id)}" value="${Number(price) || 0}">
          </label>
        </div>`;
    }).join('');

    const statusOpts = this._adminStatuses
      .map((s) => `<option value="${this._escA(s)}" ${s === order.status ? 'selected' : ''}>${this._esc(s)}</option>`)
      .join('');

    return `
      <div class="row" style="justify-content:space-between;align-items:baseline">
        <h2>${this._esc(order.orderNumber || 'Order')} · ${this._esc(order.shopSource)}</h2>
        <button class="btn" data-admin-back>← Back to queue</button>
      </div>
      <div class="m" style="color:var(--gray-400);font-size:13px;margin-bottom:12px">
        ${this._esc(order.memberName || order.memberEmail || '')} · status <b>${this._esc(order.status)}</b> ·
        charged <b>${charged} pts</b>${order.pricingConfirmed ? '' : ' (member\'s estimate)'}
      </div>

      ${this._adminErr ? `<div class="short">${this._esc(this._adminErr)}</div>` : ''}

      <h2 style="margin-top:8px">Line items</h2>
      ${lines || '<div class="empty">No line items found for this order.</div>'}
      ${this._adminPreview ? this._adminDecision() : `
        <div class="row" style="margin-top:12px">
          <button class="btn" data-admin-price ${this._adminBusy ? 'disabled' : ''}>
            ${this._adminBusy ? 'Working…' : 'Price this order'}
          </button>
        </div>
        <div class="m" style="color:var(--gray-400);font-size:12px;margin-top:6px">
          Re-prices every line from the figures above. Nothing is saved and no points move until you
          decide on the next screen.
        </div>`}

      <h2 style="margin-top:20px">Fulfilment</h2>
      <div class="row">
        <select data-admin-status>${statusOpts}</select>
        <button class="btn" data-admin-setstatus ${this._adminBusy ? 'disabled' : ''}>Set status</button>
      </div>

      <h2 style="margin-top:20px">Cancel</h2>
      <div class="row">
        <input type="text" data-admin-reason placeholder="Reason (optional)" style="flex:1">
        <button class="btn" data-admin-cancel ${this._adminBusy ? 'disabled' : ''}>Cancel &amp; refund</button>
      </div>
      <div class="m" style="color:var(--gray-400);font-size:12px;margin-top:6px">
        Refunds all ${charged} pts to the member.
      </div>`;
  }

  // The decision step. Points do NOT move on their own: SanMar quotes full price and our provider
  // discounts 15% on anything $25+, so a confirmed price coming in LOWER is the normal case and we
  // deliberately keep the difference (it covers the stock room). The admin only adjusts when they
  // choose to — typically when the price came in HIGHER, or when it's so much lower that it looks
  // like a typo. So "keep the points" is the primary action and adjusting is the deliberate one.
  _adminDecision() {
    const { points, charged, delta } = this._adminPreview;
    const over = delta > 0;   // member paid more than the order really costs
    const under = delta < 0;  // member paid less
    const n = Math.abs(delta);

    const verdict = !delta
      ? `Confirmed price matches what the member was charged (${charged} pts). Nothing to decide.`
      : over
        ? `Confirmed price is <b>${n} pts LOWER</b> than the member was charged (${charged} → ${points} pts).`
        : `Confirmed price is <b>${n} pts HIGHER</b> than the member was charged (${charged} → ${points} pts).`;

    const guidance = !delta ? ''
      : over
        ? `Normally you keep the points as charged — the difference covers the stock room. Only
           refund if it looks wrong (e.g. a stray zero in the estimate).`
        : `You can charge the member the extra ${n} pts, or absorb it and leave their points alone.`;

    return `
      <div class="card" style="margin-top:14px;border-color:var(--primary)">
        <h2>Confirm pricing</h2>
        <div class="m" style="font-size:14px;margin-bottom:6px">${verdict}</div>
        ${guidance ? `<div class="m" style="color:var(--gray-400);font-size:12px;margin-bottom:12px">${guidance}</div>` : ''}
        <div class="row">
          <button class="btn" data-admin-keep ${this._adminBusy ? 'disabled' : ''}>
            ${delta ? 'Confirm, keep points as charged' : 'Confirm'}
          </button>
          ${delta ? `
          <button class="btn" data-admin-settle ${this._adminBusy ? 'disabled' : ''}
            style="background:var(--gray-600)">
            Confirm &amp; ${over ? `refund ${n} pts` : `charge ${n} pts`}
          </button>` : ''}
          <button class="btn" data-admin-redo style="background:transparent;color:var(--gray-600)">
            ← Edit prices
          </button>
        </div>
      </div>`;
  }

  _confirmedFrom(panel) {
    return [...panel.querySelectorAll('[data-price]')].map((i) => ({
      _id: i.getAttribute('data-price'),
      unitPrice: Number(i.value) || 0,
    }));
  }

  _wireAdmin(panel) {
    panel.querySelectorAll('[data-review]').forEach((b) =>
      b.addEventListener('click', () => this._adminSend('admin-review', { orderId: b.getAttribute('data-review') })));

    const back = panel.querySelector('[data-admin-back]');
    if (back) back.addEventListener('click', () => {
      this._adminOrder = null;
      this._adminPreview = null;
      this._adminConfirmed = null;
      this._adminErr = '';
      this._renderPanel();
    });

    // Step 1: price it (writes nothing) and show the decision.
    const price = panel.querySelector('[data-admin-price]');
    if (price) price.addEventListener('click', () => {
      // Remember the exact prices we priced, so the confirm sends the same figures the admin was
      // shown — the inputs are still on screen, but this makes the two steps agree by construction.
      this._adminConfirmed = this._confirmedFrom(panel);
      this._adminSend('admin-preview', {
        orderId: this._adminOrder.order._id,
        confirmed: this._adminConfirmed,
      });
    });

    // Step 2: the decision. Same prices either way — `settle` is the only difference.
    const send = (settle) => this._adminSend('admin-confirm', {
      orderId: this._adminOrder.order._id,
      confirmed: this._adminConfirmed || this._confirmedFrom(panel),
      settle,
    });
    const keep = panel.querySelector('[data-admin-keep]');
    if (keep) keep.addEventListener('click', () => send(false));
    const settle = panel.querySelector('[data-admin-settle]');
    if (settle) settle.addEventListener('click', () => send(true));

    const redo = panel.querySelector('[data-admin-redo]');
    if (redo) redo.addEventListener('click', () => { this._adminPreview = null; this._renderPanel(); });

    const setStatus = panel.querySelector('[data-admin-setstatus]');
    if (setStatus) setStatus.addEventListener('click', () => {
      const sel = panel.querySelector('[data-admin-status]');
      this._adminSend('admin-status', { orderId: this._adminOrder.order._id, status: sel ? sel.value : '' });
    });

    const cancel = panel.querySelector('[data-admin-cancel]');
    if (cancel) cancel.addEventListener('click', () => {
      const reason = panel.querySelector('[data-admin-reason]');
      this._adminSend('admin-cancel', {
        orderId: this._adminOrder.order._id,
        reason: reason ? reason.value.trim() : '',
      });
    });
  }

  // ---- render --------------------------------------------------------------

  _render() {
    const r = this.shadowRoot;
    if (!this._shell) {
      this._shell = true;
      r.innerHTML = `<style>${STYLES}</style>
        <header class="header">
          <h1>Shop</h1>
          <div class="pts"><span class="material-symbols-outlined">stars</span><span data-pts></span></div>
        </header>
        <main class="main">
          <div>
            <div class="tabs" data-tabs></div>
            <div data-panel></div>
          </div>
          <aside data-side></aside>
        </main>`;
      r.querySelector('[data-tabs]').addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab]');
        if (!t) return;
        this._tab = t.getAttribute('data-tab');
        this._editingId = null;
        this._err = '';
        this._render();
      });
    }

    r.querySelector('[data-pts]').textContent = this._loading ? '…' : `${this._points} pts`;
    r.querySelector('.main').classList.toggle('no-cart', this._tab === 'admin');
    const tabs = [['uniform', 'Uniform'], ['sanmar', 'SanMar Custom'], ['amazon', 'Amazon']];
    if (this._isAdmin) tabs.push(['admin', 'Admin']);
    r.querySelector('[data-tabs]').innerHTML = tabs
      .map(([k, label]) => `<button class="tab${this._tab === k ? ' active' : ''}" data-tab="${k}">${label}</button>`).join('');

    this._renderPanel();
    this._renderCart();
  }

  _renderPanel() {
    const panel = this.shadowRoot.querySelector('[data-panel]');
    if (this._loading) { panel.innerHTML = `<div class="card"><div class="empty">Loading…</div></div>`; return; }

    // Admin is a different screen, not another order form — it has no cart and no Add button.
    if (this._tab === 'admin') {
      panel.innerHTML = `<div class="card">${this._adminPanel()}</div>`;
      this._wireAdmin(panel);
      return;
    }

    panel.innerHTML = `<div class="card">${this._form()}</div>`;

    const add = panel.querySelector('[data-add]');
    if (add) add.addEventListener('click', () => this._addLine(this._readForm()));

    const cancel = panel.querySelector('[data-cancel]');
    if (cancel) cancel.addEventListener('click', () => { this._editingId = null; this._err = ''; this._render(); });

    // Live preview + conditional sections
    panel.addEventListener('input', () => this._syncForm());
    panel.addEventListener('change', () => this._syncForm());

    panel.querySelectorAll('[data-prod]').forEach((el) => {
      el.addEventListener('click', () => {
        this._sel = this._catalog.find((p) => p.productId === el.getAttribute('data-prod')) || null;
        this._renderPanel();
      });
    });

    this._syncForm();
  }

  _form() {
    if (this._tab === 'uniform') return this._uniformForm();
    if (this._tab === 'amazon') return this._amazonForm();
    return this._sanmarForm();
  }

  _actions() {
    const editing = Boolean(this._editingId);
    return `
      <div class="preview">Line total: <b data-prev>$0.00</b></div>
      ${this._err ? `<div class="err">${this._esc(this._err)}</div>` : ''}
      <div class="row">
        <button class="btn" data-add>${editing ? 'Update item' : 'Add to cart'}</button>
        ${editing ? '<button class="btn ghost" data-cancel>Cancel</button>' : ''}
      </div>`;
  }

  _uniformForm() {
    if (!this._catalog.length) {
      return `<h2>Uniform</h2><div class="empty">The uniform catalog isn't available right now. You can still order SanMar and Amazon items.</div>`;
    }
    const p = this._sel;
    return `<h2>Uniform</h2>
      <div class="prods">
        ${this._catalog.map((c) => `
          <button class="prod${p && p.productId === c.productId ? ' sel' : ''}" data-prod="${this._escA(c.productId)}">
            ${c.image ? `<img src="${this._escA(c.image)}" alt="" loading="lazy">` : ''}
            <div class="n">${this._esc(c.name)}</div>
            <div class="p">$${Number(c.price).toFixed(2)}</div>
          </button>`).join('')}
      </div>
      ${p ? `<div class="sub">
        <div class="grid">
          ${p.sizes.length ? this._sel_('Size', 'u-size', p.sizes) : this._in('Size', 'u-size')}
          ${p.colors.length ? this._sel_('Color', 'u-color', p.colors) : this._in('Color', 'u-color')}
          ${this._in('Quantity', 'u-qty', 'number', '1')}
        </div>
        ${this._actions()}
      </div>` : '<div class="empty">Pick a product to continue.</div>'}`;
  }

  _sanmarForm() {
    return `<h2>SanMar custom item</h2>
      <div class="grid">
        ${this._in('Item number', 's-item')}
        ${this._in('Clothing price ($)', 's-price', 'number')}
        ${this._in('Quantity', 's-qty', 'number', '1')}
        ${this._in('Color', 's-color')}
      </div>
      <div class="checks">
        <label class="chk"><input type="checkbox" data-f="s-hat"> Hat</label>
        <label class="chk"><input type="checkbox" data-f="s-pants"> Pants</label>
      </div>
      <div class="grid" data-plain>${this._in('Size', 's-size')}</div>
      <div class="grid" data-hat hidden>
        ${this._in('Hat size', 's-hatsize')}
        ${this._sel_('Logo placement', 's-place', HAT_PLACEMENTS)}
      </div>
      <div class="grid" data-pants hidden>
        ${this._in('Pant size (waist)', 's-pantsize')}
        ${this._in('Inseam', 's-inseam')}
      </div>
      <div class="sub grid">
        ${this._sel_('Logo', 's-logo', LOGO_OPTIONS)}
        ${this._sel_('Logo color', 's-logocolor', LOGO_COLORS)}
      </div>
      <div class="preview" data-fees></div>
      ${this._actions()}`;
  }

  _amazonForm() {
    return `<h2>Amazon item</h2>
      <div class="grid">
        ${this._in('Product URL', 'a-link')}
        ${this._in('Price ($)', 'a-price', 'number')}
        ${this._in('Quantity', 'a-qty', 'number', '1')}
        ${this._in('Color', 'a-color')}
        ${this._in('Size', 'a-size')}
        ${this._in('Width', 'a-width')}
      </div>
      ${this._actions()}`;
  }

  _in(label, key, type = 'text', value = '') {
    return `<label class="f">${label}<input type="${type}" data-f="${key}" value="${this._escA(value)}"></label>`;
  }

  _sel_(label, key, opts) {
    return `<label class="f">${label}<select data-f="${key}">
      ${opts.map((o) => `<option value="${this._escA(o)}">${this._esc(o)}</option>`).join('')}
    </select></label>`;
  }

  _v(key) {
    const el = this.shadowRoot.querySelector(`[data-f="${key}"]`);
    if (!el) return '';
    return el.type === 'checkbox' ? el.checked : el.value;
  }

  _readForm() {
    if (this._tab === 'uniform') {
      const p = this._sel || {};
      return {
        source: 'uniform', productId: p.productId, name: p.name, unitPrice: Number(p.price) || 0,
        size: this._v('u-size'), color: this._v('u-color'), quantity: Number(this._v('u-qty')) || 1,
      };
    }
    if (this._tab === 'amazon') {
      return {
        source: 'amazon', link: this._v('a-link'), price: this._v('a-price'),
        quantity: Number(this._v('a-qty')) || 1, color: this._v('a-color'),
        size: this._v('a-size'), width: this._v('a-width'),
      };
    }
    const isHat = Boolean(this._v('s-hat'));
    const isPants = Boolean(this._v('s-pants'));
    return {
      source: 'sanmar',
      itemNumber: this._v('s-item'),
      clothingPrice: this._v('s-price'),
      quantity: Number(this._v('s-qty')) || 1,
      color: this._v('s-color'),
      isHat, isPants,
      size: isHat || isPants ? '' : this._v('s-size'),
      hatSize: isHat ? this._v('s-hatsize') : '',
      logoPlacement: isHat ? this._v('s-place') : '',
      pantSize: isPants ? this._v('s-pantsize') : '',
      inseam: isPants ? this._v('s-inseam') : '',
      logo: this._v('s-logo'),
      logoColor: this._v('s-logocolor'),
    };
  }

  _fillForm(line) {
    const set = (k, v) => {
      const el = this.shadowRoot.querySelector(`[data-f="${k}"]`);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = Boolean(v);
      else el.value = v == null ? '' : String(v);
    };
    if (line.source === 'uniform') {
      this._sel = this._catalog.find((p) => p.productId === line.productId) || null;
      this._renderPanel();
      set('u-size', line.size); set('u-color', line.color); set('u-qty', line.quantity);
    } else if (line.source === 'amazon') {
      set('a-link', line.link); set('a-price', line.price != null ? line.price : line.unitPrice);
      set('a-qty', line.quantity); set('a-color', line.color); set('a-size', line.size); set('a-width', line.width);
    } else {
      set('s-item', line.itemNumber); set('s-price', line.clothingPrice); set('s-qty', line.quantity);
      set('s-color', line.color); set('s-hat', line.isHat); set('s-pants', line.isPants);
      set('s-size', line.size); set('s-hatsize', line.hatSize); set('s-place', line.logoPlacement);
      set('s-pantsize', line.pantSize); set('s-inseam', line.inseam);
      set('s-logo', line.logo); set('s-logocolor', line.logoColor);
    }
    this._syncForm();
  }

  /** Toggle the hat/pants sections and refresh the live line-total preview. */
  _syncForm() {
    const r = this.shadowRoot;
    if (this._tab === 'sanmar') {
      const isHat = Boolean(this._v('s-hat'));
      const isPants = Boolean(this._v('s-pants'));
      const show = (sel, on) => { const el = r.querySelector(sel); if (el) el.hidden = !on; };
      show('[data-hat]', isHat);
      show('[data-pants]', isPants);
      show('[data-plain]', !isHat && !isPants);

      const fees = r.querySelector('[data-fees]');
      if (fees) {
        const p = priceLine(this._readForm());
        const bits = [];
        if (p.logoPricePerUnit) bits.push(`logo $${p.logoPricePerUnit.toFixed(2)}/unit`);
        if (p.placementPricePerUnit) bits.push(`placement $${p.placementPricePerUnit.toFixed(2)}/unit`);
        fees.textContent = bits.length ? `Includes ${bits.join(' + ')}.` : '';
      }
    }
    const prev = r.querySelector('[data-prev]');
    if (prev) {
      const line = this._readForm();
      const ok = this._tab !== 'uniform' || this._sel;
      prev.textContent = ok ? `$${priceLine(line).total.toFixed(2)}` : '$0.00';
    }
  }

  _renderCart() {
    const side = this.shadowRoot.querySelector('[data-side]');
    if (!side) return;

    // The Admin tab is reviewing someone else's order — showing your own cart beside it is noise.
    if (this._tab === 'admin') { side.innerHTML = ''; return; }

    const short = this._short > 0 && this._cart.length;

    side.innerHTML = `
      <div class="card cart">
        <h2>Cart</h2>
        ${this._cart.length ? this._cart.map((l) => this._cartLine(l)).join('') : '<div class="empty">Your cart is empty.</div>'}
        ${this._cart.length ? `
          <div class="totals"><span>Total</span><span class="big">$${this._total.toFixed(2)}</span></div>
          <div class="totals" style="font-weight:600;font-size:13px;color:var(--gray-600)">
            <span>Points charged</span><span>${this._cost} pts</span>
          </div>
          ${short ? `<div class="short">You're ${this._short} points short. Remove an item or earn more points.</div>` : ''}
          ${this._msg ? `<div class="ok">${this._esc(this._msg)}</div>` : ''}
          <div class="row">
            <button class="btn" data-submit ${this._busy || short ? 'disabled' : ''} style="width:100%">
              ${this._busy ? 'Submitting…' : 'Submit order'}
            </button>
          </div>` : (this._msg ? `<div class="ok">${this._esc(this._msg)}</div>` : '')}
      </div>
      ${this._orders.length ? `<div class="card">
        <h2>My active orders</h2>
        ${this._orders.map((o) => {
          // A custom (SanMar/Amazon) order is charged at the member's ESTIMATE until an admin
          // confirms the real price, so say so rather than showing it as a settled amount.
          const pending = o.pricingConfirmed === false || o.status === 'Pending Pricing';
          return `
          <div class="ord">
            <div class="h"><b>${this._esc(o.orderNumber || 'Order')}</b><span class="st">${this._esc(o.status || '')}</span></div>
            <div class="m">${this._fmtDate(o.dateOrdered)} · ${Number(o.totalPoints) || 0} pts${pending ? ' (estimated)' : ''}</div>
            ${pending ? '<div class="m">Awaiting price confirmation — your points will be adjusted if the final price differs.</div>' : ''}
          </div>`;
        }).join('')}
      </div>` : ''}`;

    const submit = side.querySelector('[data-submit]');
    if (submit) submit.addEventListener('click', () => this._submit());

    side.querySelectorAll('[data-rm]').forEach((b) =>
      b.addEventListener('click', () => this._removeLine(b.getAttribute('data-rm'))));
    side.querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => this._editLine(b.getAttribute('data-edit'))));
  }

  _cartLine(l) {
    const p = priceLine(l);
    const title = l.source === 'uniform' ? (l.name || 'Uniform item')
      : l.source === 'amazon' ? 'Amazon item'
      : `${l.itemNumber || 'Item'}${l.isHat ? ' (Hat)' : l.isPants ? ' (Pants)' : ''}`;
    const bits = [l.size || l.hatSize || l.pantSize, l.color, `Qty ${p.quantity}`].filter(Boolean);
    return `
      <div class="line">
        <div class="t">
          <b>${this._esc(title)}</b>
          <span>${this._esc(bits.join(' · '))}</span>
        </div>
        <div class="amt">$${p.total.toFixed(2)}</div>
        <button class="x" data-edit="${this._escA(l._id)}" title="Edit"><span class="material-symbols-outlined">edit</span></button>
        <button class="x" data-rm="${this._escA(l._id)}" title="Remove"><span class="material-symbols-outlined">close</span></button>
      </div>`;
  }

  _fmtDate(v) {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  _esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  _escA(s) { return this._esc(s).replace(/"/g, '&quot;'); }
}

customElements.define('locdoc-shop', LocDocShop);
