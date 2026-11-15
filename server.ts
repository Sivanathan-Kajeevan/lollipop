import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import type {
  AdminOrderRecord,
  Category,
  CustomerOrderView,
  FoodItem,
  OrderItemSnapshot,
  OrderStatus,
  OrderStatusEvent,
  PaymentStatus,
  RestaurantSettings,
} from './src/types/menu';
import {
  computeMenuStats,
  evaluateOrderSubmissionItems,
  getColomboDateKey,
  isLocalhostUrl,
  MAX_IMAGE_SIZE_BYTES,
  normalizeSriLankanWhatsApp,
  ORDER_STATUSES,
  sanitizePublicMenuUrl,
  validateFoodInput,
  validateImageFileMeta,
  validateSriLankanMobile,
} from './src/utils/menuLogic';
import {
  clearSessionCookie,
  createInitialAdmin,
  getSessionFromRequest,
  hasConfiguredAdmin,
  requireAdmin,
  setSessionCookie,
  verifyAdminCredentials,
  type AuthenticatedRequest,
} from './server/auth';
import { db, initSchema, UPLOAD_DIR } from './server/db';
import { generateMenuQrStandPdf } from './server/pdfStand';
import { ACTIVE_SCOPE, ensureInitialData } from './server/seed';

initSchema();
ensureInitialData();

const PORT = Number(process.env.PORT) || 3000;

// In-memory SSE subscriber sets for prompt order & customer status updates
const adminOrderSseClients = new Set<express.Response>();
const customerOrderSseClients = new Map<string, Set<express.Response>>();

function broadcastAdminOrdersChanged(payload: Record<string, unknown>): void {
  const data = `event: orders_changed\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of adminOrderSseClients) {
    try {
      res.write(data);
    } catch {
      adminOrderSseClients.delete(res);
    }
  }
}

function broadcastCustomerOrderChanged(
  customerToken: string,
  payload: Record<string, unknown>
): void {
  const listeners = customerOrderSseClients.get(customerToken);
  if (!listeners) return;
  const data = `event: order_updated\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of listeners) {
    try {
      res.write(data);
    } catch {
      listeners.delete(res);
    }
  }
}

function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: Number(row.id),
    scope: row.scope as Category['scope'],
    name: String(row.name),
    displayOrder: Number(row.display_order),
    isVisible: Boolean(row.is_visible),
    foodCount: row.food_count !== undefined ? Number(row.food_count) : undefined,
  };
}

function mapFood(row: Record<string, unknown>): FoodItem {
  return {
    id: Number(row.id),
    scope: row.scope as FoodItem['scope'],
    categoryId: Number(row.category_id),
    categoryName: row.category_name ? String(row.category_name) : undefined,
    name: String(row.name),
    description: String(row.description),
    priceLkr: Number(row.price_lkr),
    imageUrl: String(row.image_url),
    isAvailable: Boolean(row.is_available),
    isVegetarian: Boolean(row.is_vegetarian),
    isSpicy: Boolean(row.is_spicy),
    isSpecial: Boolean(row.is_special),
    displayOrder: Number(row.display_order),
    updatedAt: String(row.updated_at || ''),
  };
}

function mapSettings(row: Record<string, unknown>): RestaurantSettings {
  return {
    scope: row.scope as RestaurantSettings['scope'],
    restaurantName: String(row.restaurant_name),
    logoUrl: String(row.logo_url),
    logoIncludesName:
      row.logo_includes_name === undefined ? true : Boolean(row.logo_includes_name),
    welcomeMessage: String(row.welcome_message),
    whatsappNumber: String(row.whatsapp_number),
    address: String(row.address || ''),
    openingHours: String(row.opening_hours || ''),
    publicMenuUrl: String(row.public_menu_url || ''),
    providerName: String(row.provider_name || 'Shop Grow Media'),
    providerLogoUrl: String(row.provider_logo_url || ''),
    providerContact: String(row.provider_contact || ''),
    providerWebsite: String(row.provider_website || ''),
  };
}

function mapOrderItem(row: Record<string, unknown>): OrderItemSnapshot {
  return {
    id: Number(row.id),
    foodId: row.food_id !== null && row.food_id !== undefined ? Number(row.food_id) : null,
    foodName: String(row.food_name),
    unitPriceLkr: Number(row.unit_price_lkr),
    quantity: Number(row.quantity),
    lineTotalLkr: Number(row.line_total_lkr),
    prepNote: String(row.prep_note || ''),
  };
}

function parseStatusHistory(raw: unknown): OrderStatusEvent[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapAdminOrder(
  row: Record<string, unknown>,
  items: OrderItemSnapshot[]
): AdminOrderRecord {
  return {
    id: Number(row.id),
    orderRef: String(row.order_ref),
    customerToken: String(row.customer_token),
    staffToken: String(row.staff_token),
    customerName: String(row.customer_name),
    customerPhoneDisplay: String(row.customer_phone_display),
    customerPhoneNormalized: String(row.customer_phone_normalized),
    orderNotes: String(row.order_notes || ''),
    totalLkr: Number(row.total_lkr),
    orderStatus: String(row.order_status) as OrderStatus,
    paymentStatus: String(row.payment_status) as PaymentStatus,
    paymentMethod: 'Payment at restaurant',
    statusHistory: parseStatusHistory(row.status_history_json),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    items,
  };
}

function getOrderItemsByOrderIds(orderIds: number[]): Map<number, OrderItemSnapshot[]> {
  const grouped = new Map<number, OrderItemSnapshot[]>();
  if (orderIds.length === 0) return grouped;

  const placeholders = orderIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`
    )
    .all(...orderIds) as Record<string, unknown>[];

  for (const row of rows) {
    const orderId = Number(row.order_id);
    const list = grouped.get(orderId) ?? [];
    list.push(mapOrderItem(row));
    grouped.set(orderId, list);
  }
  return grouped;
}

function getAdminOrders(): AdminOrderRecord[] {
  const rows = db
    .prepare('SELECT * FROM orders ORDER BY created_at DESC, id DESC')
    .all() as Record<string, unknown>[];
  const ids = rows.map((r) => Number(r.id));
  const itemsMap = getOrderItemsByOrderIds(ids);
  return rows.map((row) => mapAdminOrder(row, itemsMap.get(Number(row.id)) ?? []));
}

function getAdminOrderById(orderId: number): AdminOrderRecord | null {
  const row = db
    .prepare('SELECT * FROM orders WHERE id = ?')
    .get(orderId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const items = getOrderItemsByOrderIds([orderId]).get(orderId) ?? [];
  return mapAdminOrder(row, items);
}

function getRestaurantData() {
  const settingsRow = db
    .prepare('SELECT * FROM restaurant_settings WHERE scope = ?')
    .get(ACTIVE_SCOPE) as Record<string, unknown>;

  const categoryRows = db
    .prepare(
      `
      SELECT c.*, COUNT(f.id) AS food_count
      FROM categories c
      LEFT JOIN foods f ON f.category_id = c.id AND f.scope = c.scope
      WHERE c.scope = ?
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.id ASC
      `
    )
    .all(ACTIVE_SCOPE) as Record<string, unknown>[];

  const foodRows = db
    .prepare(
      `
      SELECT f.*, c.name AS category_name
      FROM foods f
      JOIN categories c ON c.id = f.category_id
      WHERE f.scope = ?
      ORDER BY c.display_order ASC, f.display_order ASC, f.id ASC
      `
    )
    .all(ACTIVE_SCOPE) as Record<string, unknown>[];

  const orderStatusRows = db
    .prepare('SELECT order_status FROM orders')
    .all() as Array<{ order_status: OrderStatus }>;

  const categories = categoryRows.map(mapCategory);
  const foods = foodRows.map(mapFood);
  const settings = mapSettings(settingsRow);
  const stats = computeMenuStats(
    foods,
    categories,
    orderStatusRows.map((o) => ({ orderStatus: o.order_status }))
  );

  return { settings, categories, foods, stats };
}

function resolveRequestOrigin(req: express.Request): string {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto =
    typeof forwardedProto === 'string'
      ? forwardedProto.split(',')[0].trim()
      : req.protocol || 'http';
  const host = req.get('host') || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function resolvePublicMenuUrl(
  settings: RestaurantSettings,
  req: express.Request,
  overrideUrl?: string
): string {
  const candidates = [
    overrideUrl,
    settings.publicMenuUrl,
    process.env.PUBLIC_MENU_URL,
    process.env.APP_URL,
    resolveRequestOrigin(req),
  ];

  for (const candidate of candidates) {
    if (!candidate || candidate === 'MY_APP_URL') continue;
    const sanitized = sanitizePublicMenuUrl(candidate);
    if (sanitized) return sanitized;
  }

  return `${resolveRequestOrigin(req)}/`;
}

function generateOrderRef(createdIso: string): string {
  const colomboDate = getColomboDateKey(createdIso).replace(/-/g, '').slice(2); // YYMMDD
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let suffix = '';
  const bytes = crypto.randomBytes(4);
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `LP-${colomboDate}-${suffix}`;
}

async function buildOrderQrArtifacts(
  staffToken: string,
  settings: RestaurantSettings,
  req: express.Request
): Promise<{
  orderQrUrl: string;
  orderQrSvg: string;
  orderQrPngDataUrl: string;
}> {
  const baseRoot = resolvePublicMenuUrl(settings, req).replace(/\/+$/, '');
  const orderQrUrl = `${baseRoot}/admin/scan?token=${encodeURIComponent(staffToken)}`;

  const orderQrSvg = await QRCode.toString(orderQrUrl, {
    type: 'svg',
    margin: 4,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#1F1F21',
      light: '#FFFFFF',
    },
  });

  const orderQrPngDataUrl = await QRCode.toDataURL(orderQrUrl, {
    width: 720,
    margin: 4,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#1F1F21',
      light: '#FFFFFF',
    },
  });

  return { orderQrUrl, orderQrSvg, orderQrPngDataUrl };
}

async function buildCustomerOrderView(
  orderRow: Record<string, unknown>,
  req: express.Request
): Promise<CustomerOrderView> {
  const orderId = Number(orderRow.id);
  const items = getOrderItemsByOrderIds([orderId]).get(orderId) ?? [];
  const { settings } = getRestaurantData();
  const qr = await buildOrderQrArtifacts(
    String(orderRow.staff_token),
    settings,
    req
  );

  return {
    orderRef: String(orderRow.order_ref),
    customerToken: String(orderRow.customer_token),
    orderQrUrl: qr.orderQrUrl,
    orderQrPngDataUrl: qr.orderQrPngDataUrl,
    orderQrSvg: qr.orderQrSvg,
    orderNotes: String(orderRow.order_notes || ''),
    totalLkr: Number(orderRow.total_lkr),
    orderStatus: String(orderRow.order_status) as OrderStatus,
    paymentStatus: String(orderRow.payment_status) as PaymentStatus,
    paymentMethod: 'Payment at restaurant',
    statusHistory: parseStatusHistory(orderRow.status_history_json),
    createdAt: String(orderRow.created_at),
    updatedAt: String(orderRow.updated_at),
    items,
    restaurantName: settings.restaurantName,
    logoUrl: settings.logoUrl,
    whatsappNumber: settings.whatsappNumber,
  };
}

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

function hasValidImageMagicBytes(buf: Buffer, mimeType: string): boolean {
  if (buf.length < 12) return false;
  if (mimeType === 'image/jpeg') {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    );
  }
  if (mimeType === 'image/webp') {
    return (
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: '2mb' }));

  app.use(
    '/uploads',
    express.static(UPLOAD_DIR, {
      maxAge: '7d',
    })
  );
  app.use(
    '/seed-images',
    express.static(path.resolve(process.cwd(), 'src/assets/images'), {
      maxAge: '7d',
    })
  );

  // ---------------- Public Menu API ----------------
  app.get('/api/menu', (_req, res) => {
    try {
      const { settings, categories, foods } = getRestaurantData();
      const visibleCategories = categories.filter((c) => c.isVisible);
      const visibleCatIds = new Set(visibleCategories.map((c) => c.id));
      const visibleFoods = foods.filter((f) => visibleCatIds.has(f.categoryId));

      res.json({
        settings,
        categories: visibleCategories,
        foods: visibleFoods,
      });
    } catch (error) {
      console.error('Error loading public menu:', error);
      res.status(500).json({ error: 'Unable to load the menu right now.' });
    }
  });

  // ---------------- Customer Order Submission & Live Status API ----------------
  app.post('/api/orders', async (req, res) => {
    try {
      const {
        customerName,
        customerPhone,
        orderNotes = '',
        items,
        clientRequestId,
        acceptPriceChange = false,
      } = req.body ?? {};

      const reqId =
        typeof clientRequestId === 'string' && clientRequestId.trim().length >= 8
          ? clientRequestId.trim().slice(0, 80)
          : '';

      if (!reqId) {
        res.status(400).json({ error: 'Missing order request identifier.' });
        return;
      }

      // Idempotency: return existing order if this submission already succeeded
      const existingOrder = db
        .prepare('SELECT * FROM orders WHERE client_request_id = ?')
        .get(reqId) as Record<string, unknown> | undefined;

      if (existingOrder) {
        const orderView = await buildCustomerOrderView(existingOrder, req);
        res.status(200).json({ order: orderView, deduplicated: true });
        return;
      }

      const cleanName = typeof customerName === 'string' ? customerName.trim() : '';
      if (!cleanName || cleanName.length > 80) {
        res.status(400).json({
          error: 'Please enter your name (up to 80 characters).',
        });
        return;
      }

      const phoneCheck = validateSriLankanMobile(String(customerPhone || ''));
      if (!phoneCheck.valid) {
        res.status(400).json({
          error: phoneCheck.error || 'Enter a valid Sri Lankan mobile number.',
        });
        return;
      }

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'Your cart is empty.' });
        return;
      }

      const cleanOrderNotes =
        typeof orderNotes === 'string' ? orderNotes.trim().slice(0, 300) : '';

      const { categories, foods } = getRestaurantData();
      const visibleCatIds = new Set(
        categories.filter((c) => c.isVisible).map((c) => c.id)
      );
      const foodsById = new Map(foods.map((f) => [f.id, f]));

      const evaluated = evaluateOrderSubmissionItems(
        items,
        foodsById,
        visibleCatIds
      );

      if (evaluated.unavailableNames.length > 0) {
        res.status(409).json({
          code: 'ITEMS_UNAVAILABLE',
          error: `The following item(s) are no longer available: ${evaluated.unavailableNames.join(', ')}. Please update your cart.`,
          unavailableNames: evaluated.unavailableNames,
        });
        return;
      }

      if (evaluated.resolvedItems.length === 0) {
        res.status(400).json({ error: 'No valid available items in your cart.' });
        return;
      }

      if (evaluated.priceChanges.length > 0 && acceptPriceChange !== true) {
        res.status(409).json({
          code: 'PRICE_CHANGED',
          error:
            'Menu prices updated while reviewing your cart. Please confirm the updated total before placing your order.',
          changes: evaluated.priceChanges,
          updatedTotalLkr: evaluated.computedTotalLkr,
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const customerToken = crypto.randomBytes(24).toString('base64url');
      const staffToken = crypto.randomBytes(24).toString('base64url');
      const statusHistory = JSON.stringify([{ status: 'New', at: nowIso }]);

      let orderRef = generateOrderRef(nowIso);
      for (let attempt = 0; attempt < 5; attempt++) {
        const collision = db
          .prepare('SELECT id FROM orders WHERE order_ref = ?')
          .get(orderRef);
        if (!collision) break;
        orderRef = generateOrderRef(nowIso);
      }

      const insertOrderTx = db.transaction(() => {
        const orderRes = db
          .prepare(
            `
            INSERT INTO orders (
              order_ref, customer_token, staff_token, client_request_id,
              customer_name, customer_phone_raw, customer_phone_normalized, customer_phone_display,
              order_notes, total_lkr, order_status, payment_status, status_history_json,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Unpaid', ?, ?, ?)
            `
          )
          .run(
            orderRef,
            customerToken,
            staffToken,
            reqId,
            cleanName,
            String(customerPhone).trim(),
            phoneCheck.international,
            phoneCheck.display,
            cleanOrderNotes,
            evaluated.computedTotalLkr,
            statusHistory,
            nowIso,
            nowIso
          );

        const orderId = Number(orderRes.lastInsertRowid);
        const insertItemStmt = db.prepare(
          `
          INSERT INTO order_items (
            order_id, food_id, food_name, unit_price_lkr, quantity, line_total_lkr, prep_note
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `
        );

        for (const item of evaluated.resolvedItems) {
          insertItemStmt.run(
            orderId,
            item.foodId,
            item.foodName,
            item.unitPriceLkr,
            item.quantity,
            item.lineTotalLkr,
            item.prepNote
          );
        }

        return orderId;
      });

      let savedOrderId: number;
      try {
        savedOrderId = insertOrderTx();
      } catch (err) {
        // Handle rare concurrent double-tap race condition on client_request_id
        const concurrentOrder = db
          .prepare('SELECT * FROM orders WHERE client_request_id = ?')
          .get(reqId) as Record<string, unknown> | undefined;
        if (concurrentOrder) {
          const orderView = await buildCustomerOrderView(concurrentOrder, req);
          res.status(200).json({ order: orderView, deduplicated: true });
          return;
        }
        throw err;
      }

      const savedRow = db
        .prepare('SELECT * FROM orders WHERE id = ?')
        .get(savedOrderId) as Record<string, unknown>;

      const orderView = await buildCustomerOrderView(savedRow, req);
      broadcastAdminOrdersChanged({
        type: 'order_created',
        orderId: savedOrderId,
        orderRef,
        customerName: cleanName,
        totalLkr: evaluated.computedTotalLkr,
        createdAt: nowIso,
      });
      res.status(201).json({ order: orderView });
    } catch (error) {
      console.error('Order creation failed:', error);
      res.status(500).json({ error: 'Unable to submit your order right now. Please try again.' });
    }
  });

  app.get('/api/orders/customer/:customerToken', async (req, res) => {
    try {
      const token = String(req.params.customerToken || '').trim();
      if (!token) {
        res.status(400).json({ error: 'Invalid order link.' });
        return;
      }

      const orderRow = db
        .prepare('SELECT * FROM orders WHERE customer_token = ?')
        .get(token) as Record<string, unknown> | undefined;

      if (!orderRow) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }

      const orderView = await buildCustomerOrderView(orderRow, req);
      res.json({ order: orderView });
    } catch (error) {
      console.error('Error fetching customer order:', error);
      res.status(500).json({ error: 'Unable to load order details.' });
    }
  });

  app.get('/api/orders/customer/:customerToken/stream', (req, res) => {
    const token = String(req.params.customerToken || '').trim();
    if (!token) {
      res.status(400).end();
      return;
    }

    const exists = db
      .prepare('SELECT id FROM orders WHERE customer_token = ?')
      .get(token);
    if (!exists) {
      res.status(404).end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const listeners = customerOrderSseClients.get(token) ?? new Set<express.Response>();
    listeners.add(res);
    customerOrderSseClients.set(token, listeners);

    res.write('event: connected\ndata: {}\n\n');

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      listeners.delete(res);
      if (listeners.size === 0) {
        customerOrderSseClients.delete(token);
      }
    });
  });

  // ---------------- Authentication API ----------------
  app.get('/api/auth/session', (req, res) => {
    const session = getSessionFromRequest(req);
    const needsInitialSetup = !hasConfiguredAdmin();
    if (!session) {
      res.json({
        authenticated: false,
        needsInitialSetup,
      });
      return;
    }
    res.json({
      authenticated: true,
      username: session.username,
      needsInitialSetup: false,
    });
  });

  app.post('/api/auth/setup', (req, res) => {
    const { username, password } = req.body ?? {};
    const result = createInitialAdmin(String(username || ''), String(password || ''));
    if (!result.ok || !result.username) {
      res.status(400).json({ error: result.error || 'Unable to create admin account.' });
      return;
    }
    const token = setSessionCookie(req, res, result.username);
    res.status(201).json({
      authenticated: true,
      username: result.username,
      token,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body ?? {};
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      !username.trim() ||
      !password
    ) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const result = verifyAdminCredentials(username, password);
    if (!result.valid || !result.username) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const token = setSessionCookie(req, res, result.username);
    res.json({
      authenticated: true,
      username: result.username,
      token,
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  // ---------------- Protected Admin API ----------------
  app.get('/api/admin/dashboard', requireAdmin, (req: AuthenticatedRequest, res) => {
    const data = getRestaurantData();
    const resolvedPublicUrl = resolvePublicMenuUrl(data.settings, req);
    res.json({
      username: req.adminSession!.username,
      resolvedPublicUrl,
      ...data,
    });
  });

  // Orders Management & Live Stream
  app.get('/api/admin/orders/stream', requireAdmin, (req: AuthenticatedRequest, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    adminOrderSseClients.add(res);
    res.write('event: connected\ndata: {}\n\n');

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      adminOrderSseClients.delete(res);
    });
  });

  app.get('/api/admin/orders', requireAdmin, (req: AuthenticatedRequest, res) => {
    const search = String(req.query.search || '').trim().toLowerCase();
    const statusFilter = String(req.query.status || 'all');
    const paymentFilter = String(req.query.payment || 'all');
    const dateFilter = String(req.query.date || '').trim(); // YYYY-MM-DD in Asia/Colombo

    const allOrders = getAdminOrders();
    const filtered = allOrders.filter((order) => {
      if (statusFilter !== 'all' && order.orderStatus !== statusFilter) {
        return false;
      }
      if (paymentFilter !== 'all' && order.paymentStatus !== paymentFilter) {
        return false;
      }
      if (dateFilter && getColomboDateKey(order.createdAt) !== dateFilter) {
        return false;
      }
      if (search) {
        const match =
          order.orderRef.toLowerCase().includes(search) ||
          order.customerName.toLowerCase().includes(search) ||
          order.customerPhoneDisplay.toLowerCase().includes(search) ||
          order.customerPhoneNormalized.includes(search.replace(/\D/g, '') || search);
        if (!match) return false;
      }
      return true;
    });

    const { foods, categories } = getRestaurantData();
    const stats = computeMenuStats(foods, categories, allOrders);

    res.json({ orders: filtered, stats });
  });

  // Staff Order QR / Reference Lookup (strictly read-only; never changes status or payment)
  app.get('/api/admin/orders/lookup', requireAdmin, (req: AuthenticatedRequest, res) => {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    const ref = typeof req.query.ref === 'string' ? req.query.ref.trim().toUpperCase() : '';

    if (!token && !ref) {
      res.status(400).json({ error: 'Provide an order QR token or order reference.' });
      return;
    }

    const orderRow = token
      ? (db
          .prepare('SELECT * FROM orders WHERE staff_token = ?')
          .get(token) as Record<string, unknown> | undefined)
      : (db
          .prepare('SELECT * FROM orders WHERE UPPER(order_ref) = ?')
          .get(ref) as Record<string, unknown> | undefined);

    if (!orderRow) {
      res.status(404).json({
        error: 'No Lollipop order matched that QR code or reference.',
      });
      return;
    }

    const orderId = Number(orderRow.id);
    const items = getOrderItemsByOrderIds([orderId]).get(orderId) ?? [];
    res.json({ order: mapAdminOrder(orderRow, items) });
  });

  app.patch('/api/admin/orders/:id/status', requireAdmin, (req: AuthenticatedRequest, res) => {
    const orderId = Number(req.params.id);
    const nextStatus = String(req.body?.status || '') as OrderStatus;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      res.status(400).json({ error: 'Invalid order ID.' });
      return;
    }
    if (!ORDER_STATUSES.includes(nextStatus)) {
      res.status(400).json({ error: 'Invalid order status.' });
      return;
    }

    const existing = db
      .prepare('SELECT * FROM orders WHERE id = ?')
      .get(orderId) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const history = parseStatusHistory(existing.status_history_json);
    if (String(existing.order_status) !== nextStatus) {
      history.push({ status: nextStatus, at: nowIso });
    }

    db.prepare(
      `
      UPDATE orders
      SET order_status = ?, status_history_json = ?, updated_at = ?
      WHERE id = ?
      `
    ).run(nextStatus, JSON.stringify(history), nowIso, orderId);

    const updated = getAdminOrderById(orderId)!;
    broadcastAdminOrdersChanged({ type: 'order_status', orderId, orderStatus: nextStatus });
    broadcastCustomerOrderChanged(updated.customerToken, {
      type: 'order_status',
      orderStatus: nextStatus,
    });
    res.json({ order: updated });
  });

  app.patch('/api/admin/orders/:id/payment', requireAdmin, (req: AuthenticatedRequest, res) => {
    const orderId = Number(req.params.id);
    const nextPayment = String(req.body?.paymentStatus || '') as PaymentStatus;

    if (!Number.isInteger(orderId) || orderId <= 0) {
      res.status(400).json({ error: 'Invalid order ID.' });
      return;
    }
    if (nextPayment !== 'Unpaid' && nextPayment !== 'Paid') {
      res.status(400).json({ error: 'Payment status must be Unpaid or Paid.' });
      return;
    }

    const existing = db
      .prepare('SELECT id FROM orders WHERE id = ?')
      .get(orderId);
    if (!existing) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const nowIso = new Date().toISOString();
    db.prepare('UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?').run(
      nextPayment,
      nowIso,
      orderId
    );

    const updated = getAdminOrderById(orderId)!;
    broadcastAdminOrdersChanged({ type: 'order_payment', orderId, paymentStatus: nextPayment });
    broadcastCustomerOrderChanged(updated.customerToken, {
      type: 'order_payment',
      paymentStatus: nextPayment,
    });
    res.json({ order: updated });
  });

  // Image Uploads
  app.post(
    '/api/admin/upload',
    requireAdmin,
    express.raw({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      limit: MAX_IMAGE_SIZE_BYTES,
    }),
    (req: AuthenticatedRequest, res) => {
      const mimeType = String(req.headers['content-type'] || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      const buffer = req.body;

      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        res.status(400).json({ error: 'Please select a valid JPEG, PNG, or WebP image.' });
        return;
      }

      const validation = validateImageFileMeta(mimeType, buffer.length);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      if (!hasValidImageMagicBytes(buffer, mimeType)) {
        res.status(400).json({
          error: 'Uploaded file does not match a valid JPEG, PNG, or WebP image.',
        });
        return;
      }

      const ext = MIME_EXTENSION[mimeType] || '.jpg';
      const filename = `lollipop-${crypto.randomUUID()}${ext}`;
      const destination = path.join(UPLOAD_DIR, filename);

      try {
        fs.writeFileSync(destination, buffer);
        res.status(201).json({ url: `/uploads/${filename}` });
      } catch (writeErr) {
        console.error('Upload save failed:', writeErr);
        res.status(500).json({ error: 'Failed to save uploaded image.' });
      }
    }
  );

  app.use(
    (
      err: { type?: string; status?: number },
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err?.type === 'entity.too.large' || err?.status === 413) {
        res.status(400).json({ error: 'Image size must be 5 MB or smaller.' });
        return;
      }
      next(err);
    }
  );

  // Foods CRUD
  app.post('/api/admin/foods', requireAdmin, (req: AuthenticatedRequest, res) => {
    const {
      name,
      description,
      priceLkr,
      categoryId,
      imageUrl,
      isAvailable = true,
      isVegetarian = false,
      isSpicy = false,
      isSpecial = false,
      displayOrder = 0,
    } = req.body ?? {};

    const check = validateFoodInput({
      name,
      description,
      priceLkr,
      categoryId,
      displayOrder,
    });
    if (!check.valid) {
      res.status(400).json({ error: check.errors[0], errors: check.errors });
      return;
    }

    if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
      res.status(400).json({ error: 'Please upload or provide a food photograph.' });
      return;
    }

    const categoryRow = db
      .prepare('SELECT id FROM categories WHERE id = ? AND scope = ?')
      .get(Number(categoryId), ACTIVE_SCOPE);
    if (!categoryRow) {
      res.status(400).json({ error: 'Selected category does not exist.' });
      return;
    }

    const result = db
      .prepare(
        `
        INSERT INTO foods (
          scope, category_id, name, description, price_lkr, image_url,
          is_available, is_vegetarian, is_spicy, is_special, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        ACTIVE_SCOPE,
        Number(categoryId),
        String(name).trim(),
        String(description).trim(),
        Math.round(Number(priceLkr)),
        imageUrl.trim(),
        isAvailable ? 1 : 0,
        isVegetarian ? 1 : 0,
        isSpicy ? 1 : 0,
        isSpecial ? 1 : 0,
        Math.max(0, Math.round(Number(displayOrder) || 0))
      );

    const created = db
      .prepare(
        `
        SELECT f.*, c.name AS category_name
        FROM foods f
        JOIN categories c ON c.id = f.category_id
        WHERE f.id = ?
        `
      )
      .get(Number(result.lastInsertRowid)) as Record<string, unknown>;

    res.status(201).json({ food: mapFood(created) });
  });

  app.put('/api/admin/foods/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    const foodId = Number(req.params.id);
    if (!Number.isInteger(foodId) || foodId <= 0) {
      res.status(400).json({ error: 'Invalid food ID.' });
      return;
    }

    const existing = db
      .prepare('SELECT * FROM foods WHERE id = ? AND scope = ?')
      .get(foodId, ACTIVE_SCOPE) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Food item not found.' });
      return;
    }

    const {
      name = existing.name,
      description = existing.description,
      priceLkr = existing.price_lkr,
      categoryId = existing.category_id,
      imageUrl = existing.image_url,
      isAvailable = Boolean(existing.is_available),
      isVegetarian = Boolean(existing.is_vegetarian),
      isSpicy = Boolean(existing.is_spicy),
      isSpecial = Boolean(existing.is_special),
      displayOrder = existing.display_order,
    } = req.body ?? {};

    const check = validateFoodInput({
      name: String(name),
      description: String(description),
      priceLkr,
      categoryId,
      displayOrder,
    });
    if (!check.valid) {
      res.status(400).json({ error: check.errors[0], errors: check.errors });
      return;
    }

    if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
      res.status(400).json({ error: 'Food photograph is required.' });
      return;
    }

    const categoryRow = db
      .prepare('SELECT id FROM categories WHERE id = ? AND scope = ?')
      .get(Number(categoryId), ACTIVE_SCOPE);
    if (!categoryRow) {
      res.status(400).json({ error: 'Selected category does not exist.' });
      return;
    }

    db.prepare(
      `
      UPDATE foods
      SET category_id = ?, name = ?, description = ?, price_lkr = ?, image_url = ?,
          is_available = ?, is_vegetarian = ?, is_spicy = ?, is_special = ?,
          display_order = ?, updated_at = datetime('now')
      WHERE id = ? AND scope = ?
      `
    ).run(
      Number(categoryId),
      String(name).trim(),
      String(description).trim(),
      Math.round(Number(priceLkr)),
      imageUrl.trim(),
      isAvailable ? 1 : 0,
      isVegetarian ? 1 : 0,
      isSpicy ? 1 : 0,
      isSpecial ? 1 : 0,
      Math.max(0, Math.round(Number(displayOrder) || 0)),
      foodId,
      ACTIVE_SCOPE
    );

    const updated = db
      .prepare(
        `
        SELECT f.*, c.name AS category_name
        FROM foods f
        JOIN categories c ON c.id = f.category_id
        WHERE f.id = ?
        `
      )
      .get(foodId) as Record<string, unknown>;

    res.json({ food: mapFood(updated) });
  });

  app.delete('/api/admin/foods/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    const foodId = Number(req.params.id);
    if (!Number.isInteger(foodId) || foodId <= 0) {
      res.status(400).json({ error: 'Invalid food ID.' });
      return;
    }

    const info = db
      .prepare('DELETE FROM foods WHERE id = ? AND scope = ?')
      .run(foodId, ACTIVE_SCOPE);

    if (info.changes === 0) {
      res.status(404).json({ error: 'Food item not found.' });
      return;
    }

    res.json({ ok: true });
  });

  // Categories CRUD
  app.post('/api/admin/categories', requireAdmin, (req: AuthenticatedRequest, res) => {
    const { name, isVisible = true } = req.body ?? {};

    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }
    const cleanName = name.trim();
    if (cleanName.length > 50) {
      res.status(400).json({ error: 'Category name must be 50 characters or fewer.' });
      return;
    }

    const duplicate = db
      .prepare('SELECT id FROM categories WHERE scope = ? AND LOWER(name) = LOWER(?)')
      .get(ACTIVE_SCOPE, cleanName);
    if (duplicate) {
      res.status(409).json({ error: 'A category with that name already exists.' });
      return;
    }

    const maxRow = db
      .prepare('SELECT COALESCE(MAX(display_order), 0) AS max_order FROM categories WHERE scope = ?')
      .get(ACTIVE_SCOPE) as { max_order: number };

    const result = db
      .prepare(
        `
        INSERT INTO categories (scope, name, display_order, is_visible)
        VALUES (?, ?, ?, ?)
        `
      )
      .run(ACTIVE_SCOPE, cleanName, Number(maxRow.max_order) + 1, isVisible ? 1 : 0);

    const created = db
      .prepare('SELECT *, 0 AS food_count FROM categories WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as Record<string, unknown>;

    res.status(201).json({ category: mapCategory(created) });
  });

  app.put('/api/admin/categories/reorder', requireAdmin, (req: AuthenticatedRequest, res) => {
    const { orderedIds } = req.body ?? {};
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      res.status(400).json({ error: 'orderedIds array is required.' });
      return;
    }

    const updateStmt = db.prepare(
      'UPDATE categories SET display_order = ? WHERE id = ? AND scope = ?'
    );
    const tx = db.transaction((ids: number[]) => {
      ids.forEach((catId, index) => {
        updateStmt.run(index + 1, Number(catId), ACTIVE_SCOPE);
      });
    });
    tx(orderedIds.map(Number));

    res.json({ ok: true });
  });

  app.put('/api/admin/categories/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    const catId = Number(req.params.id);
    if (!Number.isInteger(catId) || catId <= 0) {
      res.status(400).json({ error: 'Invalid category ID.' });
      return;
    }

    const existing = db
      .prepare('SELECT * FROM categories WHERE id = ? AND scope = ?')
      .get(catId, ACTIVE_SCOPE) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const {
      name = existing.name,
      isVisible = Boolean(existing.is_visible),
      displayOrder = existing.display_order,
    } = req.body ?? {};

    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Category name is required.' });
      return;
    }

    const cleanName = name.trim();
    const duplicate = db
      .prepare(
        'SELECT id FROM categories WHERE scope = ? AND LOWER(name) = LOWER(?) AND id != ?'
      )
      .get(ACTIVE_SCOPE, cleanName, catId);
    if (duplicate) {
      res.status(409).json({ error: 'Another category already uses this name.' });
      return;
    }

    db.prepare(
      `
      UPDATE categories
      SET name = ?, is_visible = ?, display_order = ?
      WHERE id = ? AND scope = ?
      `
    ).run(
      cleanName,
      isVisible ? 1 : 0,
      Math.max(0, Number(displayOrder) || 0),
      catId,
      ACTIVE_SCOPE
    );

    const updated = db
      .prepare(
        `
        SELECT c.*, COUNT(f.id) AS food_count
        FROM categories c
        LEFT JOIN foods f ON f.category_id = c.id AND f.scope = c.scope
        WHERE c.id = ?
        GROUP BY c.id
        `
      )
      .get(catId) as Record<string, unknown>;

    res.json({ category: mapCategory(updated) });
  });

  app.delete('/api/admin/categories/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
    const catId = Number(req.params.id);
    if (!Number.isInteger(catId) || catId <= 0) {
      res.status(400).json({ error: 'Invalid category ID.' });
      return;
    }

    const existing = db
      .prepare('SELECT * FROM categories WHERE id = ? AND scope = ?')
      .get(catId, ACTIVE_SCOPE);
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const countRow = db
      .prepare('SELECT COUNT(*) AS cnt FROM foods WHERE category_id = ? AND scope = ?')
      .get(catId, ACTIVE_SCOPE) as { cnt: number };

    const moveToRaw = req.body?.moveToCategoryId ?? req.query.moveToCategoryId;
    const moveToId = moveToRaw !== undefined ? Number(moveToRaw) : null;

    if (countRow.cnt > 0) {
      if (!moveToId || !Number.isInteger(moveToId) || moveToId === catId) {
        res.status(409).json({
          error: `This category contains ${countRow.cnt} food item(s). Move them to another category before deleting.`,
          requiresMove: true,
          foodCount: countRow.cnt,
        });
        return;
      }

      const targetCat = db
        .prepare('SELECT id FROM categories WHERE id = ? AND scope = ?')
        .get(moveToId, ACTIVE_SCOPE);
      if (!targetCat) {
        res.status(400).json({ error: 'Destination category does not exist.' });
        return;
      }

      const moveAndDelete = db.transaction(() => {
        db.prepare('UPDATE foods SET category_id = ? WHERE category_id = ? AND scope = ?').run(
          moveToId,
          catId,
          ACTIVE_SCOPE
        );
        db.prepare('DELETE FROM categories WHERE id = ? AND scope = ?').run(catId, ACTIVE_SCOPE);
      });
      moveAndDelete();
      res.json({ ok: true, movedFoods: countRow.cnt });
      return;
    }

    db.prepare('DELETE FROM categories WHERE id = ? AND scope = ?').run(catId, ACTIVE_SCOPE);
    res.json({ ok: true, movedFoods: 0 });
  });

  // Restaurant Settings
  app.put('/api/admin/settings', requireAdmin, (req: AuthenticatedRequest, res) => {
    const existing = db
      .prepare('SELECT * FROM restaurant_settings WHERE scope = ?')
      .get(ACTIVE_SCOPE) as Record<string, unknown>;

    const {
      restaurantName = existing.restaurant_name,
      logoUrl = existing.logo_url,
      logoIncludesName = Boolean(existing.logo_includes_name ?? 1),
      welcomeMessage = existing.welcome_message,
      whatsappNumber = existing.whatsapp_number,
      address = existing.address,
      openingHours = existing.opening_hours,
      publicMenuUrl = existing.public_menu_url,
      providerName = existing.provider_name ?? 'Shop Grow Media',
      providerLogoUrl = existing.provider_logo_url ?? '',
      providerContact = existing.provider_contact ?? '',
      providerWebsite = existing.provider_website ?? '',
    } = req.body ?? {};

    if (typeof restaurantName !== 'string' || !restaurantName.trim()) {
      res.status(400).json({ error: 'Restaurant name is required.' });
      return;
    }
    if (typeof welcomeMessage !== 'string' || !welcomeMessage.trim()) {
      res.status(400).json({ error: 'Welcome message is required.' });
      return;
    }

    const phone = normalizeSriLankanWhatsApp(String(whatsappNumber));
    if (!phone.valid) {
      res.status(400).json({
        error: 'Enter a valid WhatsApp number (e.g., 0728044969 or +94728044969).',
      });
      return;
    }

    let cleanedPublicUrl = '';
    if (typeof publicMenuUrl === 'string' && publicMenuUrl.trim()) {
      cleanedPublicUrl = sanitizePublicMenuUrl(publicMenuUrl);
      if (!cleanedPublicUrl) {
        res.status(400).json({ error: 'Public menu URL must be a valid http/https URL.' });
        return;
      }
    }

    const cleanProviderName =
      typeof providerName === 'string' && providerName.trim()
        ? providerName.trim().slice(0, 80)
        : 'Shop Grow Media';

    const cleanProviderLogo =
      typeof providerLogoUrl === 'string' ? providerLogoUrl.trim().slice(0, 500) : '';
    const cleanProviderContact =
      typeof providerContact === 'string' ? providerContact.trim().slice(0, 80) : '';
    const cleanProviderWebsite =
      typeof providerWebsite === 'string' ? providerWebsite.trim().slice(0, 160) : '';

    db.prepare(
      `
      UPDATE restaurant_settings
      SET restaurant_name = ?, logo_url = ?, logo_includes_name = ?, welcome_message = ?,
          whatsapp_number = ?, address = ?, opening_hours = ?, public_menu_url = ?,
          provider_name = ?, provider_logo_url = ?, provider_contact = ?, provider_website = ?
      WHERE scope = ?
      `
    ).run(
      restaurantName.trim(),
      String(logoUrl || existing.logo_url).trim(),
      logoIncludesName ? 1 : 0,
      welcomeMessage.trim(),
      String(whatsappNumber).trim(),
      String(address || '').trim(),
      String(openingHours || '').trim(),
      cleanedPublicUrl,
      cleanProviderName,
      cleanProviderLogo,
      cleanProviderContact,
      cleanProviderWebsite,
      ACTIVE_SCOPE
    );

    const updated = db
      .prepare('SELECT * FROM restaurant_settings WHERE scope = ?')
      .get(ACTIVE_SCOPE) as Record<string, unknown>;

    res.json({ settings: mapSettings(updated) });
  });

  // Restaurant Menu QR Code Generator
  app.get('/api/admin/qr', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { settings } = getRestaurantData();
      const overrideParam =
        typeof req.query.url === 'string' ? req.query.url : undefined;
      const targetUrl = resolvePublicMenuUrl(settings, req, overrideParam);

      const svg = await QRCode.toString(targetUrl, {
        type: 'svg',
        margin: 4,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#1F1F21',
          light: '#FFFFFF',
        },
      });

      const pngDataUrl = await QRCode.toDataURL(targetUrl, {
        width: 1024,
        margin: 4,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#1F1F21',
          light: '#FFFFFF',
        },
      });

      res.json({
        url: targetUrl,
        isLocalhost: isLocalhostUrl(targetUrl),
        svg,
        pngDataUrl,
      });
    } catch (error) {
      console.error('QR generation failed:', error);
      res.status(500).json({ error: 'Unable to generate QR code.' });
    }
  });

  // Printable A5 Portrait Restaurant Menu QR Stand PDF
  app.get('/api/admin/qr/stand.pdf', requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { settings } = getRestaurantData();
      const overrideParam =
        typeof req.query.url === 'string' ? req.query.url : undefined;
      const targetUrl = resolvePublicMenuUrl(settings, req, overrideParam);
      const pdfBuffer = await generateMenuQrStandPdf(settings, targetUrl);

      const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="Lollipop_Menu_QR_Stand.pdf"`
      );
      res.setHeader('Cache-Control', 'no-store');
      res.send(pdfBuffer);
    } catch (error) {
      console.error('QR Stand PDF generation failed:', error);
      res.status(500).json({ error: 'Unable to generate menu QR stand PDF.' });
    }
  });

  // ---------------- Frontend Serving ----------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lollipop Restaurant server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
