import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProviderContactLine,
  formatLkrPrice,
  formatShortDisplayUrl,
  normalizeSriLankanWhatsApp,
  validateSriLankanMobile,
  buildWhatsAppUrl,
  formatColomboDateTime,
  getColomboDateKey,
  filterPublicMenuFoods,
  computeMenuStats,
  calculateCartSummary,
  evaluateOrderSubmissionItems,
  parseOrderQrPayload,
  validateFoodInput,
  validateImageFileMeta,
  sanitizePublicMenuUrl,
  isLocalhostUrl,
  detectNewCreatedOrders,
} from './menuLogic';
import type { AdminOrderRecord, Category, FoodItem } from '../types/menu';

test('formatLkrPrice formats Sri Lankan rupees accurately', () => {
  assert.equal(formatLkrPrice(850), 'Rs. 850');
  assert.equal(formatLkrPrice(1250), 'Rs. 1,250');
  assert.equal(formatLkrPrice(2800), 'Rs. 2,800');
  assert.equal(formatLkrPrice(0), 'Rs. 0');
  assert.equal(formatLkrPrice(-50), 'Rs. 0');
});

test('normalizeSriLankanWhatsApp converts 0728044969 to display and 94 international link', () => {
  const fromLocal = normalizeSriLankanWhatsApp('0728044969');
  assert.equal(fromLocal.valid, true);
  assert.equal(fromLocal.display, '072 804 4969');
  assert.equal(fromLocal.international, '94728044969');

  const fromIntl = normalizeSriLankanWhatsApp('+94728044969');
  assert.equal(fromIntl.display, '072 804 4969');
  assert.equal(fromIntl.international, '94728044969');

  const invalid = normalizeSriLankanWhatsApp('12');
  assert.equal(invalid.valid, false);
});

test('validateSriLankanMobile validates local and international mobile formats', () => {
  const local = validateSriLankanMobile('077 123 4567');
  assert.equal(local.valid, true);
  assert.equal(local.display, '077 123 4567');
  assert.equal(local.international, '94771234567');
  assert.equal(local.telHref, 'tel:+94771234567');

  const intl = validateSriLankanMobile('+94728044969');
  assert.equal(intl.valid, true);
  assert.equal(intl.display, '072 804 4969');
  assert.equal(intl.international, '94728044969');

  const intlZeroZero = validateSriLankanMobile('0094712345678');
  assert.equal(intlZeroZero.valid, true);
  assert.equal(intlZeroZero.international, '94712345678');

  const landline = validateSriLankanMobile('0112345678');
  assert.equal(landline.valid, false);

  const shortNum = validateSriLankanMobile('077123');
  assert.equal(shortNum.valid, false);
});

test('buildWhatsAppUrl builds encoded prefill link', () => {
  const url = buildWhatsAppUrl('0728044969');
  assert.equal(
    url,
    'https://wa.me/94728044969?text=Hello%20Lollipop!%20I%20would%20like%20to%20ask%20about%20your%20menu.'
  );
});

test('Colombo time helpers format timestamps in Asia/Colombo', () => {
  const iso = '2026-11-14T18:30:00.000Z'; // 2026-11-15 00:00 +05:30 in Colombo
  assert.equal(getColomboDateKey(iso), '2026-11-15');
  assert.ok(formatColomboDateTime(iso).includes('15 Nov 2026'));
});

test('filterPublicMenuFoods excludes hidden categories and combines search with category filter', () => {
  const categories: Category[] = [
    { id: 1, scope: 'prod', name: 'Breakfast', displayOrder: 1, isVisible: true },
    { id: 2, scope: 'prod', name: 'Dinner', displayOrder: 2, isVisible: true },
    { id: 3, scope: 'prod', name: 'Secret', displayOrder: 3, isVisible: false },
  ];

  const foods: FoodItem[] = [
    {
      id: 1,
      scope: 'prod',
      categoryId: 1,
      name: 'Egg Hoppers',
      description: 'Crispy bowl hopper with egg.',
      priceLkr: 180,
      imageUrl: '/seed-images/a.jpg',
      isAvailable: true,
      isVegetarian: false,
      isSpicy: false,
      isSpecial: false,
      displayOrder: 1,
      updatedAt: '2026-01-01',
    },
    {
      id: 2,
      scope: 'prod',
      categoryId: 2,
      name: 'Chicken Kottu',
      description: 'Chopped roti stir-fried with spiced chicken.',
      priceLkr: 1000,
      imageUrl: '/seed-images/b.jpg',
      isAvailable: true,
      isVegetarian: false,
      isSpicy: true,
      isSpecial: false,
      displayOrder: 1,
      updatedAt: '2026-01-01',
    },
    {
      id: 3,
      scope: 'prod',
      categoryId: 3,
      name: 'Hidden Kottu',
      description: 'Should not appear publicly.',
      priceLkr: 900,
      imageUrl: '/seed-images/c.jpg',
      isAvailable: true,
      isVegetarian: false,
      isSpicy: false,
      isSpecial: false,
      displayOrder: 1,
      updatedAt: '2026-01-01',
    },
  ];

  const allVisible = filterPublicMenuFoods(foods, categories, {
    search: '',
    categoryId: 'all',
  });
  assert.equal(allVisible.length, 2);

  const searchKottu = filterPublicMenuFoods(foods, categories, {
    search: 'kottu',
    categoryId: 'all',
  });
  assert.equal(searchKottu.length, 1);
  assert.equal(searchKottu[0].name, 'Chicken Kottu');
});

test('computeMenuStats and calculateCartSummary compute accurate totals', () => {
  const categories: Category[] = [
    { id: 1, scope: 'prod', name: 'Breakfast', displayOrder: 1, isVisible: true },
    { id: 2, scope: 'prod', name: 'Lunch', displayOrder: 2, isVisible: true },
  ];
  const foods: FoodItem[] = [
    {
      id: 1,
      scope: 'prod',
      categoryId: 1,
      name: 'A',
      description: 'Desc',
      priceLkr: 180,
      imageUrl: '/x.jpg',
      isAvailable: true,
      isVegetarian: false,
      isSpicy: false,
      isSpecial: false,
      displayOrder: 1,
      updatedAt: '',
    },
    {
      id: 2,
      scope: 'prod',
      categoryId: 2,
      name: 'B',
      description: 'Desc',
      priceLkr: 850,
      imageUrl: '/y.jpg',
      isAvailable: false,
      isVegetarian: true,
      isSpicy: false,
      isSpecial: false,
      displayOrder: 1,
      updatedAt: '',
    },
  ];

  const stats = computeMenuStats(foods, categories, [
    { orderStatus: 'New' },
    { orderStatus: 'Preparing' },
    { orderStatus: 'Completed' },
  ]);
  assert.deepEqual(stats, {
    totalFoods: 2,
    totalCategories: 2,
    availableFoods: 1,
    unavailableFoods: 1,
    newOrders: 1,
    activeOrders: 1,
    completedOrders: 1,
  });

  const cartSummary = calculateCartSummary([
    {
      foodId: 1,
      name: 'Egg Hoppers',
      unitPriceLkr: 180,
      imageUrl: '/x.jpg',
      categoryName: 'Breakfast',
      quantity: 3,
      note: '',
    },
    {
      foodId: 2,
      name: 'Chicken Kottu',
      unitPriceLkr: 1000,
      imageUrl: '/y.jpg',
      categoryName: 'Dinner',
      quantity: 1,
      note: 'Less spicy',
    },
  ]);
  assert.deepEqual(cartSummary, { itemCount: 4, totalLkr: 1540 });
});

test('evaluateOrderSubmissionItems recalculates totals and flags unavailable items or price changes', () => {
  const foodsById = new Map<number, FoodItem>([
    [
      1,
      {
        id: 1,
        scope: 'prod',
        categoryId: 1,
        name: 'Egg Hoppers',
        description: 'Crisp hopper',
        priceLkr: 220, // Changed from 180!
        imageUrl: '/a.jpg',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: false,
        isSpecial: false,
        displayOrder: 1,
        updatedAt: '',
      },
    ],
    [
      2,
      {
        id: 2,
        scope: 'prod',
        categoryId: 99, // Hidden category
        name: 'Secret Dish',
        description: 'Hidden',
        priceLkr: 500,
        imageUrl: '/b.jpg',
        isAvailable: true,
        isVegetarian: false,
        isSpicy: false,
        isSpecial: false,
        displayOrder: 1,
        updatedAt: '',
      },
    ],
  ]);

  const result = evaluateOrderSubmissionItems(
    [
      { foodId: 1, quantity: 2, expectedPriceLkr: 180, note: 'Extra crispy' },
      { foodId: 2, quantity: 1, expectedPriceLkr: 500 },
    ],
    foodsById,
    new Set([1])
  );

  assert.deepEqual(result.unavailableNames, ['Secret Dish']);
  assert.equal(result.priceChanges.length, 1);
  assert.equal(result.priceChanges[0].oldPriceLkr, 180);
  assert.equal(result.priceChanges[0].newPriceLkr, 220);
  assert.equal(result.computedTotalLkr, 440);
});

test('parseOrderQrPayload separates order QR tokens, order refs, menu QRs, and invalid strings', () => {
  assert.deepEqual(
    parseOrderQrPayload('https://lollipop.lk/admin/scan?token=abcDEF1234567890_xyz'),
    { kind: 'staff_token', token: 'abcDEF1234567890_xyz' }
  );
  assert.deepEqual(parseOrderQrPayload('LP-261114-A7K2'), {
    kind: 'order_ref',
    orderRef: 'LP-261114-A7K2',
  });
  assert.deepEqual(parseOrderQrPayload('https://lollipop.lk/'), {
    kind: 'menu_qr',
  });
  assert.deepEqual(parseOrderQrPayload('https://example.com/random'), {
    kind: 'invalid',
  });
});

test('validateFoodInput, validateImageFileMeta, and URL helpers validate properly', () => {
  const bad = validateFoodInput({
    name: '',
    description: '',
    priceLkr: -10,
    categoryId: 0,
  });
  assert.equal(bad.valid, false);
  assert.equal(bad.errors.length, 4);

  assert.equal(validateImageFileMeta('image/jpeg', 1024 * 500).valid, true);
  assert.equal(validateImageFileMeta('application/pdf', 1024).valid, false);
  assert.equal(
    sanitizePublicMenuUrl('https://lollipop.example.com/admin/login?foo=bar'),
    'https://lollipop.example.com/'
  );
  assert.equal(isLocalhostUrl('http://localhost:3000/'), true);
  assert.equal(isLocalhostUrl('https://lollipop-menu.run.app/'), false);
});

test('formatShortDisplayUrl and buildProviderContactLine format stand footer cleanly', () => {
  assert.equal(formatShortDisplayUrl('https://lollipop.lk/'), 'lollipop.lk');
  assert.equal(
    formatShortDisplayUrl('https://ais-pre-app.run.app/menu/'),
    'ais-pre-app.run.app/menu'
  );
  assert.equal(
    buildProviderContactLine({ providerContact: '', providerWebsite: '' }),
    ''
  );
  assert.equal(
    buildProviderContactLine({
      providerContact: '077 000 1122',
      providerWebsite: 'https://shopgrowmedia.lk/',
    }),
    '077 000 1122  •  shopgrowmedia.lk'
  );
});

test('detectNewCreatedOrders skips baseline orders, detects new orders once, and respects alreadyNotifiedIds', () => {
  const makeOrder = (id: number, ref: string): AdminOrderRecord => ({
    id,
    orderRef: ref,
    customerToken: `cust-${id}`,
    staffToken: `staff-${id}`,
    customerName: `Guest ${id}`,
    customerPhoneDisplay: '077 123 4567',
    customerPhoneNormalized: '94771234567',
    orderNotes: '',
    totalLkr: 1200,
    orderStatus: 'New',
    paymentStatus: 'Unpaid',
    paymentMethod: 'Cash',
    statusHistory: [{ status: 'New', at: '2026-11-15T10:00:00.000Z' }],
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-15T10:00:00.000Z',
    items: [],
  });

  const order1 = makeOrder(1, 'LP-261115-AAA1');
  const order2 = makeOrder(2, 'LP-261115-BBB2');
  const order3 = makeOrder(3, 'LP-261115-CCC3');
  const notified = new Set<number>([1]);

  // Baseline load: should not fire notifications
  const initial = detectNewCreatedOrders(null, [order1], notified);
  assert.equal(initial.newOrders.length, 0);
  assert.deepEqual([...initial.nextKnownIds], [1]);

  // Poll finds order2 (new) and order3 (already notified via SSE)
  notified.add(3);
  const next = detectNewCreatedOrders(initial.nextKnownIds, [order3, order2, order1], notified);
  assert.equal(next.newOrders.length, 1);
  assert.equal(next.newOrders[0].orderId, 2);
  assert.equal(next.newOrders[0].orderRef, 'LP-261115-BBB2');

  // Repeated refresh with same orders produces zero alerts
  const repeat = detectNewCreatedOrders(next.nextKnownIds, [order3, order2, order1], notified);
  assert.equal(repeat.newOrders.length, 0);
});

