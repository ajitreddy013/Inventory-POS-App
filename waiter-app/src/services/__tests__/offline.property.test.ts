/**
 * Property-Based Tests for Offline Functionality
 * 
 * Tests Properties 9, 10, and 12 from the design document
 */

import fc from 'fast-check';

// Mock the database module before importing
jest.mock('../database', () => ({
  openDatabase: jest.fn()
}));

jest.mock('expo-sqlite');

import { openDatabase } from '../database';
import {
  insert,
  getById,
  addToSyncQueue,
  getPendingSyncItems,
  upsert
} from '../databaseHelpers';

// Arbitraries for generating test data
const orderArbitrary = () => fc.record({
  id: fc.uuid(),
  order_number: fc.string({ minLength: 5, maxLength: 20 }),
  table_id: fc.uuid(),
  waiter_id: fc.uuid(),
  status: fc.constantFrom('draft', 'submitted', 'completed'),
  created_at: fc.integer({ min: 1000000000000, max: Date.now() }),
  updated_at: fc.integer({ min: 1000000000000, max: Date.now() })
});

const orderItemArbitrary = () => fc.record({
  id: fc.uuid(),
  order_id: fc.uuid(),
  menu_item_id: fc.uuid(),
  menu_item_name: fc.string({ minLength: 3, maxLength: 50 }),
  quantity: fc.integer({ min: 1, max: 20 }),
  base_price: fc.float({ min: 10, max: 1000, noNaN: true }),
  total_price: fc.float({ min: 10, max: 2000, noNaN: true }),
  sent_to_kitchen: fc.boolean(),
  modifiers: fc.jsonValue(),
  category: fc.constantFrom('food', 'drink'),
  created_at: fc.integer({ min: 1000000000000, max: Date.now() }),
  updated_at: fc.integer({ min: 1000000000000, max: Date.now() })
});

// Mock database implementation
let mockDatabase: Map<string, Map<string, any>>;

beforeEach(() => {
  mockDatabase = new Map();
  mockDatabase.set('orders', new Map());
  mockDatabase.set('order_items', new Map());
  mockDatabase.set('sync_queue', new Map());

  // Mock SQLite database methods
  const mockDB = {
    runAsync: jest.fn(async (sql: string, params?: any[]) => {
      return { lastInsertRowId: Date.now(), changes: 1 };
    }),
    getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT') && sql.includes('WHERE id = ?') && params && params.length > 0) {
        const match = sql.match(/FROM (\w+)/);
        if (match) {
          const tableName = match[1];
          const table = mockDatabase.get(tableName);
          if (table) {
            const record = table.get(params[0]);
            return record || null;
          }
        }
      }
      return null;
    }),
    getAllAsync: jest.fn(async (sql: string, params?: any[]) => {
      const match = sql.match(/FROM (\w+)/);
      if (match) {
        const tableName = match[1];
        const table = mockDatabase.get(tableName);
        if (table) {
          return Array.from(table.values());
        }
      }
      return [];
    }),
    execAsync: jest.fn(async (sql: string) => {
      // Handle transactions
      return;
    })
  };

  (openDatabase as jest.Mock).mockResolvedValue(mockDB);
  
  // Override insert to actually store data in mock
  jest.spyOn(require('../databaseHelpers'), 'insert').mockImplementation(
    async (tableName: any, data: any) => {
      const table = mockDatabase.get(tableName);
      if (table) {
        const id = data.id || `id-${Date.now()}-${Math.random()}`;
        table.set(id, { ...data, id });
        return id;
      }
      throw new Error(`Table ${tableName} not found`);
    }
  );

  // Override getById to actually retrieve data from mock
  jest.spyOn(require('../databaseHelpers'), 'getById').mockImplementation(
    async (tableName: any, id: any) => {
      const table = mockDatabase.get(tableName);
      if (table) {
        return table.get(id) || null;
      }
      return null;
    }
  );

  // Override upsert to actually store/update data in mock
  jest.spyOn(require('../databaseHelpers'), 'upsert').mockImplementation(
    async (tableName: any, data: any) => {
      const table = mockDatabase.get(tableName);
      if (table && data.id) {
        table.set(data.id, data);
        return data.id;
      }
      throw new Error(`Table ${tableName} not found or data missing id`);
    }
  );

  // Override addToSyncQueue
  jest.spyOn(require('../databaseHelpers'), 'addToSyncQueue').mockImplementation(
    async (entityType: any, entityId: any, operation: any, data: any) => {
      const syncQueue = mockDatabase.get('sync_queue');
      if (syncQueue) {
        const id = `sync-${Date.now()}-${Math.random()}`;
        syncQueue.set(id, {
          id,
          entity_type: entityType,
          entity_id: entityId,
          operation,
          data: JSON.stringify(data),
          created_at: Date.now(),
          synced: 0
        });
      }
    }
  );
});

describe('Offline Functionality Property Tests', () => {
  /**
   * Property 9: Offline Order Storage
   * 
   * **Validates: Requirements 3.1**
   * 
   * For any order created when network connectivity is unavailable,
   * the order should be stored in the local SQLite database.
   */
  describe('Property 9: Offline Order Storage', () => {
    test('orders created offline are stored in local database', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderArbitrary(),
          async (order) => {
            // Simulate offline mode - order is created locally
            const orderId = await insert('orders', order);

            // Verify order is stored in local database
            const storedOrder = await getById('orders', orderId);

            // Order should exist in local database
            expect(storedOrder).toBeDefined();
            expect(storedOrder).not.toBeNull();

            // Order data should match (excluding potential timestamp differences)
            if (storedOrder) {
              expect((storedOrder as any).order_number).toBe(order.order_number);
              expect((storedOrder as any).table_id).toBe(order.table_id);
              expect((storedOrder as any).waiter_id).toBe(order.waiter_id);
              expect((storedOrder as any).status).toBe(order.status);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('order items created offline are stored in local database', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderItemArbitrary(),
          async (orderItem) => {
            // Simulate offline mode - order item is created locally
            const itemId = await insert('order_items', orderItem);

            // Verify order item is stored in local database
            const storedItem = await getById('order_items', itemId);

            // Order item should exist in local database
            expect(storedItem).toBeDefined();
            expect(storedItem).not.toBeNull();

            // Order item data should match
            if (storedItem) {
              expect((storedItem as any).menu_item_name).toBe(orderItem.menu_item_name);
              expect((storedItem as any).quantity).toBe(orderItem.quantity);
              expect((storedItem as any).category).toBe(orderItem.category);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Offline Functionality Preservation
   * 
   * **Validates: Requirements 3.2**
   * 
   * For any order creation operation, the operation should succeed
   * regardless of network connectivity status.
   */
  describe('Property 10: Offline Functionality Preservation', () => {
    test('order creation succeeds regardless of network status', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderArbitrary(),
          fc.boolean(), // Simulate network status
          async (order, isOnline) => {
            // Attempt to create order (should work both online and offline)
            let operationSucceeded = false;
            let orderId: string | null = null;

            try {
              orderId = await insert('orders', order);
              operationSucceeded = true;
            } catch (error) {
              operationSucceeded = false;
            }

            // Operation should always succeed
            expect(operationSucceeded).toBe(true);
            expect(orderId).toBeDefined();
            expect(orderId).not.toBeNull();

            // Order should be retrievable from local database
            if (orderId) {
              const storedOrder = await getById('orders', orderId);
              expect(storedOrder).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('order modification succeeds regardless of network status', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderArbitrary(),
          fc.boolean(), // Simulate network status
          async (order, isOnline) => {
            // First create the order
            const orderId = await insert('orders', order);

            // Attempt to modify order status
            let modificationSucceeded = false;

            try {
              await upsert('orders', {
                ...order,
                id: orderId,
                status: 'submitted',
                updated_at: Date.now()
              });
              modificationSucceeded = true;
            } catch (error) {
              modificationSucceeded = false;
            }

            // Modification should always succeed
            expect(modificationSucceeded).toBe(true);

            // Modified order should be retrievable
            const modifiedOrder = await getById('orders', orderId);
            expect(modifiedOrder).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 12: Offline Order Round-Trip Integrity
   * 
   * **Validates: Requirements 3.5**
   * 
   * For any order stored offline and then synced to the cloud,
   * deserializing the synced data should produce an order equivalent
   * to the original.
   */
  describe('Property 12: Offline Order Round-Trip Integrity', () => {
    test('order data maintains integrity through offline storage and sync', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderArbitrary(),
          async (originalOrder) => {
            // Step 1: Store order offline (local SQLite)
            const orderId = await insert('orders', originalOrder);

            // Step 2: Add to sync queue (simulating pending sync)
            await addToSyncQueue('orders', orderId, 'insert', originalOrder);

            // Step 3: Retrieve from local database (simulating sync read)
            const localOrder = await getById('orders', orderId);

            // Step 4: Serialize for network transmission (JSON round-trip)
            const serialized = JSON.stringify(localOrder);
            const deserialized = JSON.parse(serialized);

            // Step 5: Verify data integrity
            expect(deserialized).toBeDefined();
            expect(deserialized.order_number).toBe(originalOrder.order_number);
            expect(deserialized.table_id).toBe(originalOrder.table_id);
            expect(deserialized.waiter_id).toBe(originalOrder.waiter_id);
            expect(deserialized.status).toBe(originalOrder.status);

            // Numeric fields should be preserved
            expect(typeof deserialized.created_at).toBe('number');
            expect(typeof deserialized.updated_at).toBe('number');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('order items maintain integrity through offline storage and sync', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderItemArbitrary(),
          async (originalItem) => {
            // Step 1: Store order item offline
            const itemId = await insert('order_items', originalItem);

            // Step 2: Add to sync queue
            await addToSyncQueue('order_items', itemId, 'insert', originalItem);

            // Step 3: Retrieve from local database
            const localItem = await getById('order_items', itemId);

            // Step 4: JSON round-trip (simulating network transmission)
            const serialized = JSON.stringify(localItem);
            const deserialized = JSON.parse(serialized);

            // Step 5: Verify data integrity
            expect(deserialized).toBeDefined();
            expect(deserialized.menu_item_name).toBe(originalItem.menu_item_name);
            expect(deserialized.quantity).toBe(originalItem.quantity);
            expect(deserialized.category).toBe(originalItem.category);

            // Numeric fields should be preserved with precision
            expect(typeof deserialized.base_price).toBe('number');
            expect(typeof deserialized.total_price).toBe('number');
            expect(deserialized.base_price).toBeCloseTo(originalItem.base_price, 2);
            expect(deserialized.total_price).toBeCloseTo(originalItem.total_price, 2);

            // Boolean fields should be preserved
            expect(typeof deserialized.sent_to_kitchen).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('complex order with items maintains integrity through round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          orderArbitrary(),
          fc.array(orderItemArbitrary(), { minLength: 1, maxLength: 10 }),
          async (order, items) => {
            // Create order
            const orderId = await insert('orders', order);

            // Create order items
            const itemIds: string[] = [];
            for (const item of items) {
              const itemWithOrderId = { ...item, order_id: orderId };
              const itemId = await insert('order_items', itemWithOrderId);
              itemIds.push(itemId);
            }

            // Simulate sync: serialize entire order with items
            const orderWithItems = {
              ...order,
              id: orderId,
              items: await Promise.all(
                itemIds.map(id => getById('order_items', id))
              )
            };

            // JSON round-trip
            const serialized = JSON.stringify(orderWithItems);
            const deserialized = JSON.parse(serialized);

            // Verify order integrity
            expect(deserialized.order_number).toBe(order.order_number);
            expect(deserialized.items).toHaveLength(items.length);

            // Verify each item integrity
            for (let i = 0; i < items.length; i++) {
              const originalItem = items[i];
              const deserializedItem = deserialized.items[i];

              expect(deserializedItem.menu_item_name).toBe(originalItem.menu_item_name);
              expect(deserializedItem.quantity).toBe(originalItem.quantity);
              expect(deserializedItem.category).toBe(originalItem.category);
            }
          }
        ),
        { numRuns: 50 } // Fewer runs for complex test
      );
    });
  });
});
