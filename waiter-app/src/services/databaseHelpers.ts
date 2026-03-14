import * as SQLite from 'expo-sqlite';
import { getDatabase, openDatabase } from './database';

export async function insert<T extends Record<string, any>>(
  tableName: string,
  data: T
): Promise<string> {
  const db = getDatabase();
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => '?').join(', ');
  const result = db.runSync(
    `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );
  return data.id || result.lastInsertRowId.toString();
}

export async function update<T extends Record<string, any>>(
  tableName: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  const db = getDatabase();
  const columns = Object.keys(data);
  const values = Object.values(data);
  const setClause = columns.map(col => `${col} = ?`).join(', ');
  db.runSync(`UPDATE ${tableName} SET ${setClause} WHERE id = ?`, [...values, id]);
}

export async function deleteRecord(tableName: string, id: string): Promise<void> {
  getDatabase().runSync(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
}

export async function getById<T>(tableName: string, id: string): Promise<T | null> {
  return getDatabase().getFirstSync<T>(`SELECT * FROM ${tableName} WHERE id = ?`, [id]) || null;
}

export async function getAll<T>(tableName: string, orderBy?: string): Promise<T[]> {
  const sql = `SELECT * FROM ${tableName}${orderBy ? ` ORDER BY ${orderBy}` : ''}`;
  return getDatabase().getAllSync<T>(sql);
}

export async function query<T>(
  tableName: string,
  whereClause: string,
  params: any[] = [],
  orderBy?: string
): Promise<T[]> {
  const sql = `SELECT * FROM ${tableName} WHERE ${whereClause}${orderBy ? ` ORDER BY ${orderBy}` : ''}`;
  return getDatabase().getAllSync<T>(sql, params);
}

export async function upsert<T extends Record<string, any>>(
  tableName: string,
  data: T
): Promise<string> {
  if (!data.id) throw new Error('Upsert requires an id field');
  const db = getDatabase();
  const columns = Object.keys(data);
  const placeholders = columns.map(() => '?').join(', ');
  db.runSync(
    `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
    Object.values(data)
  );
  return data.id;
}

export async function bulkUpsert<T extends Record<string, any>>(
  tableName: string,
  records: T[]
): Promise<void> {
  if (records.length === 0) return;
  const db = getDatabase();
  const columns = Object.keys(records[0]);
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
  for (const record of records) {
    db.runSync(sql, Object.values(record));
  }
}

export async function executeTransaction(
  operations: (db: SQLite.SQLiteDatabase) => Promise<void>
): Promise<void> {
  const db = getDatabase();
  await operations(db);
}

export async function batchInsert<T extends Record<string, any>>(
  tableName: string,
  records: T[]
): Promise<void> {
  if (records.length === 0) return;
  const db = getDatabase();
  const columns = Object.keys(records[0]);
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
  for (const record of records) {
    db.runSync(sql, Object.values(record));
  }
}

export async function count(
  tableName: string,
  whereClause?: string,
  params: any[] = []
): Promise<number> {
  const sql = `SELECT COUNT(*) as count FROM ${tableName}${whereClause ? ` WHERE ${whereClause}` : ''}`;
  return getDatabase().getFirstSync<{ count: number }>(sql, params)?.count || 0;
}

export async function clearTable(tableName: string): Promise<void> {
  getDatabase().runSync(`DELETE FROM ${tableName}`);
}

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

export async function getPendingSyncItems(): Promise<Array<{
  id: number;
  entity_type: string;
  entity_id: string;
  operation: string;
  data: string;
  created_at: number;
}>> {
  return query('sync_queue', 'synced = ?', [0], 'created_at ASC');
}

export async function markSynced(syncQueueId: number): Promise<void> {
  getDatabase().runSync('UPDATE sync_queue SET synced = 1 WHERE id = ?', [syncQueueId]);
}

export async function getDeviceInfo(key: string): Promise<string | null> {
  return getDatabase().getFirstSync<{ value: string }>(
    'SELECT value FROM device_info WHERE key = ?', [key]
  )?.value || null;
}

export async function setDeviceInfo(key: string, value: string): Promise<void> {
  getDatabase().runSync(
    'INSERT OR REPLACE INTO device_info (key, value) VALUES (?, ?)', [key, value]
  );
}

export async function getOrderWithItems(orderId: string): Promise<{ order: any; items: any[] } | null> {
  const order = await getById('orders', orderId);
  if (!order) return null;
  const items = await query('order_items', 'order_id = ?', [orderId]);
  return { order, items };
}

export async function getTablesBySection(sectionId: string): Promise<any[]> {
  return query('tables', 'section_id = ?', [sectionId], 'name ASC');
}

export async function getMenuItemsByCategory(categoryId: string): Promise<any[]> {
  return query('menu_items', 'category_id = ?', [categoryId], 'name ASC');
}

export async function searchMenuItems(searchTerm: string): Promise<any[]> {
  return query('menu_items', 'name LIKE ?', [`%${searchTerm}%`], 'name ASC');
}
