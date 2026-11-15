import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'lollipop.db');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS restaurant_settings (
      scope TEXT PRIMARY KEY CHECK (scope IN ('demo', 'prod')),
      restaurant_name TEXT NOT NULL,
      logo_url TEXT NOT NULL,
      logo_includes_name INTEGER NOT NULL DEFAULT 1,
      welcome_message TEXT NOT NULL,
      whatsapp_number TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      opening_hours TEXT NOT NULL DEFAULT '',
      public_menu_url TEXT NOT NULL DEFAULT '',
      provider_name TEXT NOT NULL DEFAULT 'Shop Grow Media',
      provider_logo_url TEXT NOT NULL DEFAULT '',
      provider_contact TEXT NOT NULL DEFAULT '',
      provider_website TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL CHECK (scope IN ('demo', 'prod')),
      name TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_visible INTEGER NOT NULL DEFAULT 1,
      UNIQUE(scope, name)
    );

    CREATE TABLE IF NOT EXISTS foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL CHECK (scope IN ('demo', 'prod')),
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price_lkr INTEGER NOT NULL CHECK (price_lkr >= 0),
      image_url TEXT NOT NULL,
      is_available INTEGER NOT NULL DEFAULT 1,
      is_vegetarian INTEGER NOT NULL DEFAULT 0,
      is_spicy INTEGER NOT NULL DEFAULT 0,
      is_special INTEGER NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_ref TEXT NOT NULL UNIQUE,
      customer_token TEXT NOT NULL UNIQUE,
      staff_token TEXT NOT NULL UNIQUE,
      client_request_id TEXT UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone_raw TEXT NOT NULL,
      customer_phone_normalized TEXT NOT NULL,
      customer_phone_display TEXT NOT NULL,
      order_notes TEXT NOT NULL DEFAULT '',
      total_lkr INTEGER NOT NULL CHECK (total_lkr >= 0),
      order_status TEXT NOT NULL CHECK (order_status IN ('New', 'Accepted', 'Preparing', 'Ready', 'Completed', 'Cancelled')) DEFAULT 'New',
      payment_status TEXT NOT NULL CHECK (payment_status IN ('Unpaid', 'Paid')) DEFAULT 'Unpaid',
      status_history_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      food_id INTEGER,
      food_name TEXT NOT NULL,
      unit_price_lkr INTEGER NOT NULL CHECK (unit_price_lkr >= 0),
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      line_total_lkr INTEGER NOT NULL CHECK (line_total_lkr >= 0),
      prep_note TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_token ON orders(customer_token);
    CREATE INDEX IF NOT EXISTS idx_orders_staff_token ON orders(staff_token);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
  `);

  const existingCols = new Set(
    (
      db.prepare('PRAGMA table_info(restaurant_settings)').all() as Array<{
        name: string;
      }>
    ).map((c) => c.name)
  );

  const migrations: Array<[string, string]> = [
    ['logo_includes_name', 'ALTER TABLE restaurant_settings ADD COLUMN logo_includes_name INTEGER NOT NULL DEFAULT 1'],
    ['provider_name', "ALTER TABLE restaurant_settings ADD COLUMN provider_name TEXT NOT NULL DEFAULT 'Shop Grow Media'"],
    ['provider_logo_url', "ALTER TABLE restaurant_settings ADD COLUMN provider_logo_url TEXT NOT NULL DEFAULT ''"],
    ['provider_contact', "ALTER TABLE restaurant_settings ADD COLUMN provider_contact TEXT NOT NULL DEFAULT ''"],
    ['provider_website', "ALTER TABLE restaurant_settings ADD COLUMN provider_website TEXT NOT NULL DEFAULT ''"],
  ];

  for (const [col, sql] of migrations) {
    if (!existingCols.has(col)) {
      db.exec(sql);
    }
  }
}
