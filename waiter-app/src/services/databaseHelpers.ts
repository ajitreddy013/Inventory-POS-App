/**
 * Database Helper Functions
 * 
 * Provides CRUD operations, transactions, and upsert functionality
 * for the SQLite database.
 */

import * as SQLite from 'expo-sqlite';
import { openDatabase } from './database';

/**
 * Generic insert function
 */
export async function insert<T extends Record<string, any>>(
  tableName: string,
  data: T
): Promise<string> {
  const db = await openDatabase();
  
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => '?').join(', ');
  
  const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
  
  const result = await db.runAsync(sql, values);
  
  // Return the ID (either from data or lastInsertRowId)
  return data.id || result.lastInsertRowId.toString();
}

/**
 * Generic update function
 */
export async function update<T extends Record<string, any>>(
  tableName: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  const db = await openDatabase();
  
  const columns = Object.keys(data);
  const values = Object.values(data);
  const setClause = columns.map(col => `${col} = ?`).join(', ');
  
  const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;
  
  await db.runAsync(sql, [...values, id]);
}

/**
 * Generic delete function
 */
export async function deleteRecord(
  tableName: string,
  id: string
): Promise<void> {
  const db = await openDatabase();
  
  const sql = `DELETE FROM ${tableName} WHERE id = ?`;
  
  await db.runAsync(sql, [id]);
}

/**
 * Generic query function - get single record by ID
 */
export async function getById<T>(
  tableName: string,
  id: string
): Promise<T | null> {
  const db = await openDatabase();
  
  const sql = `SELECT * FROM ${tableName} WHERE id = ?`;
  
  const result = await db.getFirstAsync<T>(sql, [id]);
  
  return result || null;
}

/**
 * Generic query function - get all records
 */
export async function getAll<T>(
  tableName: string,
  orderBy?: string
): Promise<T[]> {
  const db = await openDatabase();
  
  let sql = `SELECT * FROM ${tableName}`;
  if (orderBy) {
    sql += ` ORDER BY ${orderBy}`;
  }
  
  const results = await db.getAllAsync<T>(sql);
  
  return results;
}

/**
 * Generic query function with WHERE clause
 */
export async function query<T>(
  tableName: string,
  whereClause: string,
  params: any[] = [],
  orderBy?: string
): Promise<T[]> {
  const db = await openDatabase();
  
  let sql = `SELECT * FROM ${tableName} WHERE ${whereClause}`;
  if (orderBy) {
    sql += ` ORDER BY ${orderBy}`;
  }
  
  const results = await db.getAllAsync<T>(sql, params);
  
  return results;
}

/**
 * Upsert function - insert or update if exists
 */
export async function upsert<T extends Record<string, any>>(
  tableName: string,
  data: T
): Promise<string> {
  const db = await openDatabase();
  
  if (!data.id) {
    throw new Error('Upsert requires an id field');
  }
  
  // Check if record exists
  const existing = await getById(tableName, data.id);
  
  if (existing) {
    // Update existing record
    await update(tableName, data.id, data);
    return data.id;
  } else {
    // Insert new record
    return await insert(tableName, data);
  }
}

/**
 * Execute a transaction
 */
export async function executeTransaction(
  operations: (db: SQLite.SQLiteDatabase) => Promise<void>
): Promise<void> {
  const db = await openDatabase();
  
  try {
    await db.execAsync('BEGIN TRANSACTION');
    await operations(db);
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

/**
 * Batch insert function
 */
export async function batchInsert<T extends Record<string, any>>(
  tableName: string,
  records: T[]
): Promise<void> {
  if (records.length === 0) return;
  
  await executeTransaction(async (db) => {
    const columns = Object.keys(records[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    for (const record of records) {
      const values = Object.values(record);
      await db.runAsync(sql, values);
    }
  });
}

/**
 * Count records in a table
 */
export async function count(
  tableName: string,
  whereClause?: string,
  params: any[] = []
): Promise<number> {
  const db = await openDatabase();
  
  let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
  if (whereClause) {
    sql += ` WHERE ${whereClause}`;
  }
  
  const result = await db.getFirstAsync<{ count: number }>(sql, params);
  
  return result?.count || 0;
}

/**
 * Clear all data from a table
 */
export async function clearTable(tableName: string): Promise<void> {
  const db = await openDatabase();
  
  await db.runAsync(`DELETE FROM ${tableName}`);
}

// Specialized helper functions for common operations

/**
 * Add item to sync queue
 */
export async function addToSyncQueue(
  entityType: string,
  entityId: string,
  operation: 'insert' | 'update' | 'delete',
  data: any
): Promise<void> {
  await insert('sync_queue', {
    entity_type: entityType,
    entity_id: entityId,
    operation,
    data: JSON.stringify(data),
    created_at: Date.now(),
    synced: 0
  });
}

/**
 * Get pending sync items
 */
export async function getPendingSyncItems(): Promise<Array<{
  id: number;
  entity_type: string;
  entity_id: string;
  operation: string;
  data: string;
  created_at: number;
}>> {
  return await query(
    'sync_queue',
    'synced = ?',
    [0],
    'created_at ASC'
  );
}

/**
 * Mark sync item as synced
 */
export async function markSynced(syncQueueId: number): Promise<void> {
  const db = await openDatabase();
  
  await db.runAsync(
    'UPDATE sync_queue SET synced = 1 WHERE id = ?',
    [syncQueueId]
  );
}

/**
 * Get or set device info
 */
export async function getDeviceInfo(key: string): Promise<string | null> {
  const db = await openDatabase();
  
  const result = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM device_info WHERE key = ?',
    [key]
  );
  
  return result?.value || null;
}

export async function setDeviceInfo(key: string, value: string): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO device_info (key, value) VALUES (?, ?)',
    [key, value]
  );
}

/**
 * Get order with items
 */
export async function getOrderWithItems(orderId: string): Promise<{
  order: any;
  items: any[];
} | null> {
  const order = await getById('orders', orderId);
  
  if (!order) {
    return null;
  }
  
  const items = await query('order_items', 'order_id = ?', [orderId]);
  
  return { order, items };
}

/**
 * Get tables by section
 */
export async function getTablesBySection(sectionId: string): Promise<any[]> {
  return await query('tables', 'section_id = ?', [sectionId], 'name ASC');
}

/**
 * Get menu items by category
 */
export async function getMenuItemsByCategory(categoryId: string): Promise<any[]> {
  return await query('menu_items', 'category_id = ?', [categoryId], 'name ASC');
}

/**
 * Search menu items by name
 */
export async function searchMenuItems(searchTerm: string): Promise<any[]> {
  return await query(
    'menu_items',
    'name LIKE ?',
    [`%${searchTerm}%`],
    'name ASC'
  );
}
