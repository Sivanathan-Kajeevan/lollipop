import type {
  AdminOrderRecord,
  CartItem,
  Category,
  FoodItem,
  MenuStats,
  OrderPriceChange,
  OrderStatus,
} from '../types/menu';

export const DEFAULT_WHATSAPP_PREFILL =
  'Hello Lollipop! I would like to ask about your menu.';

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ORDER_STATUSES: OrderStatus[] = [
  'New',
  'Accepted',
  'Preparing',
  'Ready',
  'Completed',
  'Cancelled',
];

export function formatLkrPrice(price: number): string {
  const safePrice = Number.isFinite(price) && price >= 0 ? Math.round(price) : 0;
  return `Rs. ${safePrice.toLocaleString('en-US')}`;
}

export function normalizeSriLankanWhatsApp(rawInput: string): {
  display: string;
  international: string;
  valid: boolean;
} {
  const digits = String(rawInput || '').replace(/\D/g, '');
  if (!digits) {
    return { display: '', international: '', valid: false };
  }

  let localNineDigits = '';
  if (digits.startsWith('94') && digits.length === 11) {
    localNineDigits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 10) {
    localNineDigits = digits.slice(1);
  } else if (digits.length === 9 && digits.startsWith('7')) {
    localNineDigits = digits;
  }

  if (localNineDigits.length === 9) {
    const localWithZero = `0${localNineDigits}`;
    const display = `${localWithZero.slice(0, 3)} ${localWithZero.slice(3, 6)} ${localWithZero.slice(6)}`;
    const international = `94${localNineDigits}`;
    return { display, international, valid: true };
  }

  if (digits.length >= 8 && digits.length <= 15) {
    return {
      display: rawInput.trim(),
      international: digits,
      valid: true,
    };
  }

  return {
    display: rawInput.trim(),
    international: digits,
    valid: false,
  };
}

export function validateSriLankanMobile(rawInput: string): {
  valid: boolean;
  display: string;
  international: string;
  telHref: string;
  error?: string;
} {
  const cleaned = String(rawInput || '').trim();
  if (!cleaned) {
    return {
      valid: false,
      display: '',
      international: '',
      telHref: '',
      error: 'Mobile number is required.',
    };
  }

  const digits = cleaned.replace(/\D/g, '');
  let localNineDigits = '';

  if (digits.startsWith('0094') && digits.length === 13) {
    localNineDigits = digits.slice(4);
  } else if (digits.startsWith('94') && digits.length === 11) {
    localNineDigits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 10) {
    localNineDigits = digits.slice(1);
  } else if (digits.length === 9 && digits.startsWith('7')) {
    localNineDigits = digits;
  }

  if (!/^7\d{8}$/.test(localNineDigits)) {
    return {
      valid: false,
      display: cleaned,
      international: digits,
      telHref: '',
      error:
        'Enter a valid Sri Lankan mobile number (e.g., 077 123 4567 or +94 77 123 4567).',
    };
  }

  const localWithZero = `0${localNineDigits}`;
  const display = `${localWithZero.slice(0, 3)} ${localWithZero.slice(3, 6)} ${localWithZero.slice(6)}`;
  const international = `94${localNineDigits}`;

  return {
    valid: true,
    display,
    international,
    telHref: `tel:+${international}`,
  };
}

export function buildWhatsAppUrl(
  rawNumber: string,
  prefillMessage: string = DEFAULT_WHATSAPP_PREFILL
): string {
  const { international } = normalizeSriLankanWhatsApp(rawNumber);
  const target = international || '94728044969';
  const encodedText = encodeURIComponent(prefillMessage);
  return `https://wa.me/${target}?text=${encodedText}`;
}

export function formatColomboDateTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatColomboTimeOnly(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function getColomboDateKey(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

export function filterPublicMenuFoods(
  foods: FoodItem[],
  categories: Category[],
  options: { search: string; categoryId: number | 'all' }
): FoodItem[] {
  const visibleCategoryMap = new Map<number, Category>();
  for (const cat of categories) {
    if (cat.isVisible) {
      visibleCategoryMap.set(cat.id, cat);
    }
  }

  const normalizedQuery = options.search.trim().toLowerCase();

  return foods
    .filter((food) => {
      const cat = visibleCategoryMap.get(food.categoryId);
      if (!cat) return false;

      if (options.categoryId !== 'all' && food.categoryId !== options.categoryId) {
        return false;
      }

      if (normalizedQuery) {
        const nameMatch = food.name.toLowerCase().includes(normalizedQuery);
        const descMatch = food.description.toLowerCase().includes(normalizedQuery);
        if (!nameMatch && !descMatch) return false;
      }

      return true;
    })
    .map((food) => ({
      ...food,
      categoryName: visibleCategoryMap.get(food.categoryId)?.name ?? food.categoryName ?? '',
    }))
    .sort((a, b) => {
      const catA = visibleCategoryMap.get(a.categoryId)?.displayOrder ?? 0;
      const catB = visibleCategoryMap.get(b.categoryId)?.displayOrder ?? 0;
      if (catA !== catB) return catA - catB;
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return a.id - b.id;
    });
}

export function computeMenuStats(
  foods: FoodItem[],
  categories: Category[],
  orders: Pick<AdminOrderRecord, 'orderStatus'>[] = []
): MenuStats {
  const availableFoods = foods.filter((f) => f.isAvailable).length;
  let newOrders = 0;
  let activeOrders = 0;
  let completedOrders = 0;

  for (const order of orders) {
    if (order.orderStatus === 'New') {
      newOrders += 1;
    } else if (
      order.orderStatus === 'Accepted' ||
      order.orderStatus === 'Preparing' ||
      order.orderStatus === 'Ready'
    ) {
      activeOrders += 1;
    } else if (order.orderStatus === 'Completed') {
      completedOrders += 1;
    }
  }

  return {
    totalFoods: foods.length,
    totalCategories: categories.length,
    availableFoods,
    unavailableFoods: foods.length - availableFoods,
    newOrders,
    activeOrders,
    completedOrders,
  };
}

export function calculateCartSummary(items: CartItem[]): {
  itemCount: number;
  totalLkr: number;
} {
  let itemCount = 0;
  let totalLkr = 0;
  for (const item of items) {
    const qty = Math.max(0, Math.round(item.quantity));
    const price = Math.max(0, Math.round(item.unitPriceLkr));
    itemCount += qty;
    totalLkr += qty * price;
  }
  return { itemCount, totalLkr };
}

export function evaluateOrderSubmissionItems(
  requestedItems: Array<{
    foodId: number;
    quantity: number;
    expectedPriceLkr?: number;
    note?: string;
  }>,
  currentFoodsById: Map<number, FoodItem>,
  visibleCategoryIds: Set<number>
): {
  unavailableNames: string[];
  priceChanges: OrderPriceChange[];
  computedTotalLkr: number;
  resolvedItems: Array<{
    foodId: number;
    foodName: string;
    unitPriceLkr: number;
    quantity: number;
    lineTotalLkr: number;
    prepNote: string;
  }>;
} {
  const unavailableNames: string[] = [];
  const priceChanges: OrderPriceChange[] = [];
  const resolvedItems: Array<{
    foodId: number;
    foodName: string;
    unitPriceLkr: number;
    quantity: number;
    lineTotalLkr: number;
    prepNote: string;
  }> = [];

  let computedTotalLkr = 0;

  for (const reqItem of requestedItems) {
    const food = currentFoodsById.get(Number(reqItem.foodId));
    const qty = Math.max(1, Math.min(99, Math.round(Number(reqItem.quantity) || 1)));
    const note = String(reqItem.note || '').trim().slice(0, 200);

    if (!food || !food.isAvailable || !visibleCategoryIds.has(food.categoryId)) {
      unavailableNames.push(food?.name || `Item #${reqItem.foodId}`);
      continue;
    }

    if (
      typeof reqItem.expectedPriceLkr === 'number' &&
      Number.isFinite(reqItem.expectedPriceLkr) &&
      Math.round(reqItem.expectedPriceLkr) !== food.priceLkr
    ) {
      priceChanges.push({
        foodId: food.id,
        name: food.name,
        oldPriceLkr: Math.round(reqItem.expectedPriceLkr),
        newPriceLkr: food.priceLkr,
      });
    }

    const lineTotalLkr = food.priceLkr * qty;
    computedTotalLkr += lineTotalLkr;
    resolvedItems.push({
      foodId: food.id,
      foodName: food.name,
      unitPriceLkr: food.priceLkr,
      quantity: qty,
      lineTotalLkr,
      prepNote: note,
    });
  }

  return {
    unavailableNames,
    priceChanges,
    computedTotalLkr,
    resolvedItems,
  };
}

export type ParsedQrResult =
  | { kind: 'staff_token'; token: string }
  | { kind: 'order_ref'; orderRef: string }
  | { kind: 'menu_qr' }
  | { kind: 'invalid' };

export function parseOrderQrPayload(rawInput: string): ParsedQrResult {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return { kind: 'invalid' };

  if (/^LP-[A-Z0-9-]+$/i.test(trimmed)) {
    return { kind: 'order_ref', orderRef: trimmed.toUpperCase() };
  }

  try {
    const parsed = new URL(trimmed);
    const tokenParam = parsed.searchParams.get('token');
    if (
      tokenParam &&
      (parsed.pathname === '/admin/scan' || parsed.pathname === '/admin/scan/')
    ) {
      return { kind: 'staff_token', token: tokenParam.trim() };
    }
    if (parsed.pathname === '/' || parsed.pathname === '') {
      return { kind: 'menu_qr' };
    }
    return { kind: 'invalid' };
  } catch {
    if (/^[A-Za-z0-9_-]{16,80}$/.test(trimmed)) {
      return { kind: 'staff_token', token: trimmed };
    }
    return { kind: 'invalid' };
  }
}

export function validateFoodInput(input: {
  name?: string;
  description?: string;
  priceLkr?: unknown;
  categoryId?: unknown;
  displayOrder?: unknown;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.name || !input.name.trim()) {
    errors.push('Food name is required.');
  } else if (input.name.trim().length > 100) {
    errors.push('Food name must be 100 characters or fewer.');
  }

  if (!input.description || !input.description.trim()) {
    errors.push('Short description is required.');
  } else if (input.description.trim().length > 400) {
    errors.push('Description must be 400 characters or fewer.');
  }

  const price = Number(input.priceLkr);
  if (!Number.isFinite(price) || price < 0) {
    errors.push('Price must be a non-negative number in LKR.');
  }

  const catId = Number(input.categoryId);
  if (!Number.isInteger(catId) || catId <= 0) {
    errors.push('Please select a valid category.');
  }

  if (input.displayOrder !== undefined) {
    const order = Number(input.displayOrder);
    if (!Number.isFinite(order) || order < 0) {
      errors.push('Display order must be zero or a positive number.');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateImageFileMeta(
  mimeType: string,
  sizeBytes: number
): { valid: boolean; error?: string } {
  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(
      mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]
    )
  ) {
    return {
      valid: false,
      error: 'Only JPEG, PNG, and WebP images are supported.',
    };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return {
      valid: false,
      error: 'Selected image file is empty.',
    };
  }
  if (sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Image size must be 5 MB or smaller.',
    };
  }
  return { valid: true };
}

export function sanitizePublicMenuUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    return `${parsed.origin}/`;
  } catch {
    return '';
  }
}

export function isLocalhostUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1'
    );
  } catch {
    return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(rawUrl);
  }
}

export function formatShortDisplayUrl(rawUrl: string): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    const pathPart = parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/+$/, '');
    return `${parsed.host}${pathPart}`;
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  }
}

export function buildProviderContactLine(input: {
  providerContact?: string;
  providerWebsite?: string;
}): string {
  const parts: string[] = [];
  const contact = String(input.providerContact || '').trim();
  const website = formatShortDisplayUrl(String(input.providerWebsite || ''));
  if (contact) parts.push(contact);
  if (website) parts.push(website);
  return parts.join('  •  ');
}

export interface NewOrderNotificationItem {
  orderId: number;
  orderRef: string;
  customerName: string;
  totalLkr: number;
  createdAt: string;
}

export function detectNewCreatedOrders(
  previousKnownIds: Set<number> | null,
  orders: AdminOrderRecord[],
  alreadyNotifiedIds: Set<number>
): {
  nextKnownIds: Set<number>;
  newOrders: NewOrderNotificationItem[];
} {
  const nextKnownIds = new Set<number>(orders.map((o) => o.id));

  if (previousKnownIds === null) {
    return {
      nextKnownIds,
      newOrders: [],
    };
  }

  const newOrders: NewOrderNotificationItem[] = [];
  for (const order of orders) {
    if (!previousKnownIds.has(order.id) && !alreadyNotifiedIds.has(order.id)) {
      newOrders.push({
        orderId: order.id,
        orderRef: order.orderRef,
        customerName: order.customerName,
        totalLkr: order.totalLkr,
        createdAt: order.createdAt,
      });
    }
  }

  return {
    nextKnownIds,
    newOrders,
  };
}

