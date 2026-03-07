/**
 * SQLite Database Service for WaiterFlow Mobile App
 * 
 * This module provides local offline storage that mirrors Firestore collections.
 * It includes sync tracking tables for offline-first functionality.
 */

import * as SQLite from 'expo-sqlite';

const DB_NAME = 'waiterflow.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Initialize and return the SQLite database instance
 */
export async function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbInstance;
}

/**
 * Create all database tables
 * Mirrors Firestore schema with additional sync tracking
 */
export async function initializeDatabase(): Promise<void> {
  const db = await openDatabase();

  try {
    // Enable foreign keys
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Waiters table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS waiters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pin TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_waiters_pin ON waiters(pin);
    `);

    // Sections table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Tables table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS tables (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        section_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('available', 'occupied', 'pending_bill')),
        capacity INTEGER DEFAULT 4,
        is_active INTEGER DEFAULT 1,
        current_order_id TEXT,
        occupied_since INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (section_id) REFERENCES sections(id)
      );
      CREATE INDEX IF NOT EXISTS idx_tables_section ON tables(section_id);
      CREATE INDEX IF NOT EXISTS idx_tables_status ON tables(status);
    `);

    // Migration: Add missing columns to existing tables
    await db.execAsync('ALTER TABLE sections ADD COLUMN is_active INTEGER DEFAULT 1;').catch(() => {});
    await db.execAsync('ALTER TABLE tables ADD COLUMN capacity INTEGER DEFAULT 4;').catch(() => {});
    await db.execAsync('ALTER TABLE tables ADD COLUMN is_active INTEGER DEFAULT 1;').catch(() => {});
    await db.execAsync('ALTER TABLE tables ADD COLUMN occupied_since INTEGER;').catch(() => {});

    // Menu categories table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS menu_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_order INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Menu items table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category_id TEXT NOT NULL,
        item_category TEXT NOT NULL CHECK (item_category IN ('food', 'drink')),
        is_out_of_stock INTEGER NOT NULL DEFAULT 0,
        is_bar_item INTEGER NOT NULL DEFAULT 0,
        available_modifier_ids TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (category_id) REFERENCES menu_categories(id)
      );
      CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
      CREATE INDEX IF NOT EXISTS idx_menu_items_stock ON menu_items(is_out_of_stock);
    `);

    // Modifiers table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS modifiers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('spice_level', 'paid_addon')),
        price REAL NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Orders table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number TEXT NOT NULL,
        table_id TEXT NOT NULL,
        waiter_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'completed', 'cancelled')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (table_id) REFERENCES tables(id),
        FOREIGN KEY (waiter_id) REFERENCES waiters(id)
      );
      CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
      CREATE INDEX IF NOT EXISTS idx_orders_waiter ON orders(waiter_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
    `);

    // Order items table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        menu_item_id TEXT NOT NULL,
        menu_item_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        base_price REAL NOT NULL,
        total_price REAL NOT NULL,
        sent_to_kitchen INTEGER NOT NULL DEFAULT 0,
        modifiers TEXT,
        category TEXT NOT NULL CHECK (category IN ('food', 'drink')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
      );
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    `);

    // Sync queue table - tracks pending changes when offline
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);
    `);

    // Device info table - stores device-specific metadata
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS device_info (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Drop all tables (for testing/reset purposes)
 */
export async function dropAllTables(): Promise<void> {
  const db = await openDatabase();

  const tables = [
    'order_items',
    'orders',
    'menu_items',
    'menu_categories',
    'modifiers',
    'tables',
    'sections',
    'waiters',
    'sync_queue',
    'device_info'
  ];

  for (const table of tables) {
    await db.execAsync(`DROP TABLE IF EXISTS ${table};`);
  }

  console.log('All tables dropped');
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  tables: { name: string; count: number }[];
  pendingSyncCount: number;
}> {
  const db = await openDatabase();

  const tables = [
    'waiters',
    'sections',
    'tables',
    'menu_categories',
    'menu_items',
    'modifiers',
    'orders',
    'order_items',
    'sync_queue'
  ];

  const stats: { name: string; count: number }[] = [];

  for (const table of tables) {
    const result = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM ${table}`
    );
    stats.push({ name: table, count: result?.count || 0 });
  }

  const syncResult = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sync_queue WHERE synced = 0'
  );

  return {
    tables: stats,
    pendingSyncCount: syncResult?.count || 0
  };
}
