/**
 * Reference tests for shop pricing. These values are the behavioural contract of the CURRENT
 * SanMar shop — if a refactor changes them, that's a real pricing change to confirm with the
 * business, not a test to update.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATUS, cartTotal, hasLogoCharge, hatPlacementFee, isMemberVisibleStatus,
  needsPricingConfirmation, parseMoney, pointsForCart,
  priceLine, priceSanmarLine, validateLine,
} from '../src/elements/shop-pricing.js';

test('garment with a logo pays the flat $3 fee per unit', () => {
  const p = priceSanmarLine({ clothingPrice: 20, quantity: 2, logo: 'LocDoc', logoColor: 'White' });
  assert.equal(p.logoPricePerUnit, 3);
  assert.equal(p.placementPricePerUnit, 0);
  assert.equal(p.unitPrice, 23);
  assert.equal(p.total, 46);
});

test('garment with no logo pays no fee', () => {
  assert.equal(priceSanmarLine({ clothingPrice: 20, quantity: 1, logo: 'None' }).total, 20);
  assert.equal(priceSanmarLine({ clothingPrice: 20, quantity: 1, logo: '' }).total, 20);
  // Placeholder dropdown options must not be charged as a logo.
  assert.equal(priceSanmarLine({ clothingPrice: 20, quantity: 1, logo: 'Select a logo' }).total, 20);
});

test('HATS NEVER PAY THE GARMENT LOGO FEE — only the placement fee', () => {
  const front = priceSanmarLine({ clothingPrice: 10, quantity: 1, isHat: true, logo: 'LocDoc', logoPlacement: 'Front' });
  assert.equal(front.logoPricePerUnit, 0, 'no $3 garment fee on a hat');
  assert.equal(front.placementPricePerUnit, 3.5);
  assert.equal(front.total, 13.5);

  for (const [placement, fee] of [['Left Side', 6], ['Right Side', 6], ['Back', 6], ['Front Center', 3.5]]) {
    const p = priceSanmarLine({ clothingPrice: 10, quantity: 1, isHat: true, logo: 'LocDoc', logoPlacement: placement });
    assert.equal(p.placementPricePerUnit, fee, placement);
  }
});

test('a hat with a logo but no placement is free of fees (validation forces a placement)', () => {
  const p = priceSanmarLine({ clothingPrice: 10, quantity: 1, isHat: true, logo: 'LocDoc' });
  assert.equal(p.total, 10);
  assert.equal(validateLine({ source: 'sanmar', itemNumber: 'A1', clothingPrice: 10, quantity: 1, color: 'Black', isHat: true, hatSize: 'L', logo: 'LocDoc' }),
    'Select logo placement for hat orders with a logo.');
});

test('hat placement falls back to a substring match when the label drifts', () => {
  assert.equal(hatPlacementFee('front center'), 3.5);
  assert.equal(hatPlacementFee('Left side panel'), 6);
  assert.equal(hatPlacementFee('Rear Back'), 6);
  assert.equal(hatPlacementFee('None'), 0);
  assert.equal(hatPlacementFee(''), 0);
});

test('no-logo detection covers the placeholder options', () => {
  for (const v of ['', 'none', 'No Logo', 'n/a', 'Select a logo', 'select something']) {
    assert.equal(hasLogoCharge(v), false, `"${v}" must not be charged`);
  }
  assert.equal(hasLogoCharge('LocDoc'), true);
});

test('a submitted total is IGNORED — the line is always recomputed', () => {
  // The old backend trusted item.total whenever its own math produced 0. A crafted cart could
  // therefore set its own price. Here the bogus total is discarded.
  const tampered = { source: 'sanmar', clothingPrice: 20, quantity: 2, logo: 'LocDoc', total: 0.01, lineTotal: 0.01 };
  assert.equal(priceLine(tampered).total, 46);
  assert.equal(cartTotal([tampered]), 46);
});

test('money parses out of "$" and commas', () => {
  assert.equal(parseMoney('$1,234.50'), 1234.5);
  assert.equal(parseMoney('24'), 24);
  assert.equal(parseMoney('abc'), 0);
  assert.equal(parseMoney(null), 0);
});

test('quantity coerces to at least 1, matching the current shop', () => {
  assert.equal(priceSanmarLine({ clothingPrice: 10, quantity: 0 }).quantity, 1);
  assert.equal(priceSanmarLine({ clothingPrice: 10, quantity: -5 }).quantity, 1);
  assert.equal(priceSanmarLine({ clothingPrice: 10, quantity: '3' }).quantity, 3);
});

test('amazon + uniform lines are a flat unit price x quantity', () => {
  assert.equal(priceLine({ source: 'amazon', price: 12.5, quantity: 2 }).total, 25);
  assert.equal(priceLine({ source: 'uniform', unitPrice: 19.99, quantity: 3 }).total, 59.97);
});

test('cart total and points: points are 1:1 with dollars, rounded whole', () => {
  const lines = [
    { source: 'sanmar', clothingPrice: 20, quantity: 1, logo: 'LocDoc' }, // 23
    { source: 'amazon', price: 12.25, quantity: 2 },                      // 24.50
  ];
  assert.equal(cartTotal(lines), 47.5);
  assert.equal(pointsForCart(lines), 48); // 47.50 → 48 points
});

test('validation order and messages match the current SanMar shop', () => {
  const base = { source: 'sanmar', itemNumber: 'A1', clothingPrice: 20, quantity: 1, color: 'Black', size: 'L' };
  assert.equal(validateLine({ ...base, itemNumber: '' }), 'Enter an item number.');
  assert.equal(validateLine({ ...base, clothingPrice: 0 }), 'Enter a valid clothing price to calculate total.');
  assert.equal(validateLine({ ...base, quantity: 0 }), 'Enter a valid quantity.');
  assert.equal(validateLine({ ...base, color: '' }), 'Enter a color.');
  assert.equal(validateLine({ ...base, size: '' }), 'Enter a size.');
  assert.equal(validateLine({ ...base, isPants: true, size: '', pantSize: '' }), 'Enter pant size.');
  assert.equal(validateLine({ ...base, isPants: true, size: '', pantSize: '34', inseam: '' }), 'Enter inseam.');
  assert.equal(validateLine({ ...base, logo: 'LocDoc', logoColor: '' }), 'Select a logo color.');
  assert.equal(validateLine(base), null);
});

test('amazon link must be http(s)', () => {
  assert.equal(validateLine({ source: 'amazon', link: 'ftp://x', price: 1, quantity: 1 }), 'Enter a valid http(s) link.');
  assert.equal(validateLine({ source: 'amazon', link: 'https://a.co/x', price: 1, quantity: 1 }), null);
});

// --- status contract -------------------------------------------------------
// n8n automations trigger off these exact strings, and a status missing from the member-visible
// list makes an order silently DISAPPEAR from the member's page. Both are pinned here on purpose.

test('every workflow status stays visible to the member; only Cancelled/Archived hide', () => {
  for (const s of [
    STATUS.PENDING_PRICING, STATUS.READY_TO_ORDER, STATUS.ORDERED,
    STATUS.PARTIALLY_RECEIVED, STATUS.RECEIVED,
  ]) {
    assert.equal(isMemberVisibleStatus(s), true, `${s} must remain visible to the member`);
  }
  assert.equal(isMemberVisibleStatus(STATUS.CANCELLED), false);
  assert.equal(isMemberVisibleStatus(STATUS.ARCHIVED), false);

  // Legacy rows created before this workflow existed.
  assert.equal(isMemberVisibleStatus('Not Ordered'), true);
  assert.equal(isMemberVisibleStatus('not ordered'), true);

  // An unknown status hides the order — which is exactly why SETTABLE in shopAdmin.web.js
  // rejects anything not on the list.
  assert.equal(isMemberVisibleStatus('Shipped'), false);
  assert.equal(isMemberVisibleStatus(''), false);
});

test('status strings are exactly what the automations expect', () => {
  assert.equal(STATUS.PENDING_PRICING, 'Pending Pricing');
  assert.equal(STATUS.READY_TO_ORDER, 'Ready to Order');
  assert.equal(STATUS.ORDERED, 'Ordered'); // the vendor-email trigger
  assert.equal(STATUS.PARTIALLY_RECEIVED, 'Partially Received');
  assert.equal(STATUS.RECEIVED, 'Received');
  assert.equal(STATUS.CANCELLED, 'Cancelled');
  assert.equal(STATUS.ARCHIVED, 'Archived');
});

test('only custom items need an admin to confirm pricing', () => {
  assert.equal(needsPricingConfirmation('sanmar'), true);
  assert.equal(needsPricingConfirmation('amazon'), true);
  assert.equal(needsPricingConfirmation('uniform'), false, 'catalog price is already established');
});
