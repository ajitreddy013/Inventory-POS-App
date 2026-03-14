import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

const DB_NAME = 'waiterflow.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function deleteDbFile(): Promise<void> {
  try {
    const base = `${FileSystem.documentDirectory}SQLite/${DB_NAME}`;
    for (const path of [base, `${base}-wal`, `${base}-shm`]) {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
    console.log('Deleted stale DB files');
  } catch { /* ignore */ }
}

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync(DB_NAME);
  }
  return dbInstance;
}

export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  return getDatabase();
}

export async function initializeDatabase(): Promise<void> {
  // Try opening; if locked delete the file and reopen fresh
  try {
    const db = SQLite.openDatabaseSync(DB_NAME);
    db.execSync('SELECT 1'); // test for lock
    dbInstance = db;
  } catch {
    console.log('DB locked — deleting and recreating...');
    dbInstance = null;
    await deleteDbFile();
    dbInstance = SQLite.openDatabaseSync(DB_NAME);
  }

  const db = dbInstance!;
  db.execSync('PRAGMA journal_mode = WAL');
  db.execSync('PRAGMA busy_timeout = 10000');
  db.execSync('PRAGMA foreign_keys = OFF');

  const statements = [
    `CREATE TABLE IF NOT EXISTS waiters (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, pin TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_waiters_pin ON waiters(pin)`,
    `CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, section_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available', capacity INTEGER DEFAULT 4,
      is_active INTEGER DEFAULT 1, current_order_id TEXT, occupied_since INTEGER,
      created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tables_section ON tables(section_id)`,
    `CREATE TABLE IF NOT EXISTS menu_categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, display_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL DEFAULT 0,
      category_id TEXT, category TEXT, item_category TEXT DEFAULT 'food',
      is_out_of_stock INTEGER NOT NULL DEFAULT 0, is_bar_item INTEGER NOT NULL DEFAULT 0,
      available_modifier_ids TEXT,
      created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id)`,
    `CREATE TABLE IF NOT EXISTS modifiers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT DEFAULT 'paid_addon',
      price REAL NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, order_number TEXT NOT NULL, table_id TEXT NOT NULL,
      waiter_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
      created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id)`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY, order_id TEXT NOT NULL, menu_item_id TEXT NOT NULL,
      menu_item_name TEXT NOT NULL, quantity INTEGER NOT NULL DEFAULT 1,
      base_price REAL NOT NULL DEFAULT 0, total_price REAL NOT NULL DEFAULT 0,
      sent_to_kitchen INTEGER NOT NULL DEFAULT 0, modifiers TEXT,
      category TEXT DEFAULT 'food',
      created_at INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`,
    `CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL, operation TEXT NOT NULL, data TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0, synced INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS device_info (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  ];

  for (const sql of statements) {
    db.execSync(sql);
  }

  const migrations = [
    'ALTER TABLE sections ADD COLUMN is_active INTEGER DEFAULT 1',
    'ALTER TABLE tables ADD COLUMN capacity INTEGER DEFAULT 4',
    'ALTER TABLE tables ADD COLUMN is_active INTEGER DEFAULT 1',
    'ALTER TABLE tables ADD COLUMN occupied_since INTEGER',
    'ALTER TABLE menu_items ADD COLUMN category TEXT',
    'ALTER TABLE menu_categories ADD COLUMN display_order INTEGER DEFAULT 0',
  ];
  for (const sql of migrations) {
    try { db.execSync(sql); } catch { /* already exists */ }
  }

  console.log('Database initialized successfully');
}

export async function dropAllTables(): Promise<void> {
  const db = getDatabase();
  for (const table of [
    'order_items', 'orders', 'menu_items', 'menu_categories',
    'modifiers', 'tables', 'sections', 'waiters', 'sync_queue', 'device_info'
  ]) {
    db.execSync(`DROP TABLE IF EXISTS ${table}`);
  }
}

export async function getDatabaseStats(): Promise<{
  tables: { name: string; count: number }[];
  pendingSyncCount: number;
}> {
  const db = getDatabase();
  const tableNames = [
    'waiters', 'sections', 'tables', 'menu_categories',
    'menu_items', 'modifiers', 'orders', 'order_items', 'sync_queue'
  ];
  const stats = tableNames.map(name => ({
    name,
    count: db.getFirstSync<{ count: number }>(`SELECT COUNT(*) as count FROM ${name}`)?.count || 0
  }));
  const pendingSyncCount = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0'
  )?.count || 0;
  return { tables: stats, pendingSyncCount };
}
