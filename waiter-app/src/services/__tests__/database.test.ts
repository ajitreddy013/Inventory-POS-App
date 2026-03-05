/**
 * Unit tests for database operations
 */

import * as SQLite from 'expo-sqlite';
import {
  insert,
  update,
  deleteRecord,
  getById,
  getAll,
  query,
  upsert,
  executeTransaction,
  batchInsert,
  count,
  addToSyncQueue,
  getPendingSyncItems,
  markSynced
} from '../databaseHelpers';

// Mock database instance
const mockDb = {
  runAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  getAllAsync: jest.fn(),
  execAsync: jest.fn()
};

// Mock openDatabase
jest.mock('../database', () => ({
  openDatabase: jest.fn(() => Promise.resolve(mockDb))
}));

describe('Database Helper Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('insert', () => {
    it('should insert a record and return the ID', async () => {
      const testData = {
        id: 'test-123',
        name: 'Test Item',
        price: 100
      };

      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1 });

      const result = await insert('menu_items', testData);

      expect(result).toBe('test-123');
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT INTO menu_items (id, name, price) VALUES (?, ?, ?)',
        ['test-123', 'Test Item', 100]
      );
    });

    it('should return lastInsertRowId if no ID in data', async () => {
      const testData = {
        name: 'Test Item',
        price: 100
      };

      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 42 });

      const result = await insert('menu_items', testData);

      expect(result).toBe('42');
    });
  });

  describe('update', () => {
    it('should update a record by ID', async () => {
      const updates = {
        name: 'Updated Item',
        price: 150
      };

      mockDb.runAsync.mockResolvedValue({});

      await update('menu_items', 'test-123', updates);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'UPDATE menu_items SET name = ?, price = ? WHERE id = ?',
        ['Updated Item', 150, 'test-123']
      );
    });
  });

  describe('deleteRecord', () => {
    it('should delete a record by ID', async () => {
      mockDb.runAsync.mockResolvedValue({});

      await deleteRecord('menu_items', 'test-123');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM menu_items WHERE id = ?',
        ['test-123']
      );
    });
  });

  describe('getById', () => {
    it('should retrieve a record by ID', async () => {
      const mockRecord = {
        id: 'test-123',
        name: 'Test Item',
        price: 100
      };

      mockDb.getFirstAsync.mockResolvedValue(mockRecord);

      const result = await getById('menu_items', 'test-123');

      expect(result).toEqual(mockRecord);
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM menu_items WHERE id = ?',
        ['test-123']
      );
    });

    it('should return null if record not found', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const result = await getById('menu_items', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should retrieve all records from a table', async () => {
      const mockRecords = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' }
      ];

      mockDb.getAllAsync.mockResolvedValue(mockRecords);

      const result = await getAll('menu_items');

      expect(result).toEqual(mockRecords);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith('SELECT * FROM menu_items');
    });

    it('should retrieve all records with ordering', async () => {
      const mockRecords = [
        { id: '1', name: 'Item A' },
        { id: '2', name: 'Item B' }
      ];

      mockDb.getAllAsync.mockResolvedValue(mockRecords);

      const result = await getAll('menu_items', 'name ASC');

      expect(result).toEqual(mockRecords);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM menu_items ORDER BY name ASC'
      );
    });
  });

  describe('query', () => {
    it('should query records with WHERE clause', async () => {
      const mockRecords = [
        { id: '1', category_id: 'cat-1', name: 'Item 1' }
      ];

      mockDb.getAllAsync.mockResolvedValue(mockRecords);

      const result = await query('menu_items', 'category_id = ?', ['cat-1']);

      expect(result).toEqual(mockRecords);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM menu_items WHERE category_id = ?',
        ['cat-1']
      );
    });

    it('should query records with WHERE clause and ordering', async () => {
      const mockRecords = [
        { id: '1', category_id: 'cat-1', name: 'Item A' },
        { id: '2', category_id: 'cat-1', name: 'Item B' }
      ];

      mockDb.getAllAsync.mockResolvedValue(mockRecords);

      const result = await query(
        'menu_items',
        'category_id = ?',
        ['cat-1'],
        'name ASC'
      );

      expect(result).toEqual(mockRecords);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM menu_items WHERE category_id = ? ORDER BY name ASC',
        ['cat-1']
      );
    });
  });

  describe('upsert', () => {
    it('should insert if record does not exist', async () => {
      const testData = {
        id: 'test-123',
        name: 'Test Item',
        price: 100
      };

      mockDb.getFirstAsync.mockResolvedValue(null);
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1 });

      const result = await upsert('menu_items', testData);

      expect(result).toBe('test-123');
      expect(mockDb.getFirstAsync).toHaveBeenCalled();
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'INSERT INTO menu_items (id, name, price) VALUES (?, ?, ?)',
        ['test-123', 'Test Item', 100]
      );
    });

    it('should update if record exists', async () => {
      const testData = {
        id: 'test-123',
        name: 'Updated Item',
        price: 150
      };

      mockDb.getFirstAsync.mockResolvedValue({ id: 'test-123', name: 'Old Item' });
      mockDb.runAsync.mockResolvedValue({});

      const result = await upsert('menu_items', testData);

      expect(result).toBe('test-123');
      expect(mockDb.getFirstAsync).toHaveBeenCalled();
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'UPDATE menu_items SET id = ?, name = ?, price = ? WHERE id = ?',
        ['test-123', 'Updated Item', 150, 'test-123']
      );
    });

    it('should throw error if no ID provided', async () => {
      const testData = {
        name: 'Test Item',
        price: 100
      };

      await expect(upsert('menu_items', testData)).rejects.toThrow(
        'Upsert requires an id field'
      );
    });
  });

  describe('executeTransaction', () => {
    it('should execute operations in a transaction and commit', async () => {
      mockDb.execAsync.mockResolvedValue({});

      const operations = jest.fn(async () => {
        // Simulate some operations
      });

      await executeTransaction(operations);

      expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(operations).toHaveBeenCalledWith(mockDb);
      expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback transaction on error', async () => {
      mockDb.execAsync.mockResolvedValue({});

      const operations = jest.fn(async () => {
        throw new Error('Operation failed');
      });

      await expect(executeTransaction(operations)).rejects.toThrow('Operation failed');

      expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(operations).toHaveBeenCalledWith(mockDb);
      expect(mockDb.execAsync).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('batchInsert', () => {
    it('should insert multiple records in a transaction', async () => {
      const records = [
        { id: '1', name: 'Item 1', price: 100 },
        { id: '2', name: 'Item 2', price: 200 }
      ];

      mockDb.execAsync.mockResolvedValue({});
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1 });

      await batchInsert('menu_items', records);

      expect(mockDb.execAsync).toHaveBeenCalledWith('BEGIN TRANSACTION');
      expect(mockDb.runAsync).toHaveBeenCalledTimes(2);
      expect(mockDb.execAsync).toHaveBeenCalledWith('COMMIT');
    });

    it('should do nothing if records array is empty', async () => {
      await batchInsert('menu_items', []);

      expect(mockDb.execAsync).not.toHaveBeenCalled();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('count', () => {
    it('should count all records in a table', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 42 });

      const result = await count('menu_items');

      expect(result).toBe(42);
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM menu_items',
        []
      );
    });

    it('should count records with WHERE clause', async () => {
      mockDb.getFirstAsync.mockResolvedValue({ count: 10 });

      const result = await count('menu_items', 'category_id = ?', ['cat-1']);

      expect(result).toBe(10);
      expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM menu_items WHERE category_id = ?',
        ['cat-1']
      );
    });

    it('should return 0 if count is null', async () => {
      mockDb.getFirstAsync.mockResolvedValue(null);

      const result = await count('menu_items');

      expect(result).toBe(0);
    });
  });

  describe('addToSyncQueue', () => {
    it('should add an item to the sync queue', async () => {
      const data = { id: 'order-123', status: 'submitted' };
      mockDb.runAsync.mockResolvedValue({ lastInsertRowId: 1 });

      await addToSyncQueue('orders', 'order-123', 'insert', data);

      expect(mockDb.runAsync).toHaveBeenCalled();
      const callArgs = mockDb.runAsync.mock.calls[0];
      expect(callArgs[0]).toContain('INSERT INTO sync_queue');
      expect(callArgs[1]).toContain('orders');
      expect(callArgs[1]).toContain('order-123');
      expect(callArgs[1]).toContain('insert');
    });
  });

  describe('getPendingSyncItems', () => {
    it('should retrieve all unsynced items', async () => {
      const mockItems = [
        {
          id: 1,
          entity_type: 'orders',
          entity_id: 'order-1',
          operation: 'insert',
          data: '{}',
          created_at: Date.now()
        }
      ];

      mockDb.getAllAsync.mockResolvedValue(mockItems);

      const result = await getPendingSyncItems();

      expect(result).toEqual(mockItems);
      expect(mockDb.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM sync_queue WHERE synced = ? ORDER BY created_at ASC',
        [0]
      );
    });
  });

  describe('markSynced', () => {
    it('should mark a sync queue item as synced', async () => {
      mockDb.runAsync.mockResolvedValue({});

      await markSynced(42);

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'UPDATE sync_queue SET synced = 1 WHERE id = ?',
        [42]
      );
    });
  });
});
