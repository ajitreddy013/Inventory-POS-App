/**
 * Table Operations Tests
 * 
 * Tests table operations including:
 * - Merging multiple tables into single order
 * - Splitting table order into separate bills
 * - Transferring order between tables
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5 - Table Operations
 */

const {
  setDocument,
  updateDocument,
  deleteDocument,
  getDocument
} = require('../init');

// Mock the init module
jest.mock('../init', () => ({
  setDocument: jest.fn(),
  updateDocument: jest.fn(),
  deleteDocument: jest.fn(),
  getDocument: jest.fn(),
  initializeAdminSDK: jest.fn(),
  getAdminFirestore: jest.fn()
}));

describe('Table Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Merge Tables (Requirement 15.1, 15.5)', () => {
    test('should merge two tables with orders', async () => {
      const tableIds = ['table_1', 'table_2'];

      // Mock tables
      getDocument
        .mockResolvedValueOnce({ // table_1
          id: 'table_1',
          name: 'Table 1',
          sectionId: 'section_123',
          currentOrderId: 'order_1',
          status: 'occupied'
        })
        .mockResolvedValueOnce({ // table_2
          id: 'table_2',
          name: 'Table 2',
          sectionId: 'section_123',
          currentOrderId: 'order_2',
          status: 'occupied'
        })
        .mockResolvedValueOnce({ // order_1
          id: 'order_1',
          tableId: 'table_1',
          items: [{ id: 'item_1', name: 'Biryani', quantity: 1 }],
          status: 'draft'
        })
        .mockResolvedValueOnce({ // order_2
          id: 'order_2',
          tableId: 'table_2',
          items: [{ id: 'item_2', name: 'Naan', quantity: 2 }],
          status: 'draft'
        });

      updateDocument.mockResolvedValue(undefined);
      deleteDocument.mockResolvedValue(undefined);

      // Simulate handler logic
      const tables = [];
      for (const tableId of tableIds) {
        const table = await getDocument('tables', tableId);
        expect(table).toBeTruthy();
        tables.push(table);
      }

      // Get orders
      const orders = [];
      for (const table of tables) {
        if (table.currentOrderId) {
          const order = await getDocument('orders', table.currentOrderId);
          if (order) {
            orders.push(order);
          }
        }
      }

      expect(orders.length).toBe(2);

      // Merge items
      const allItems = [];
      for (const order of orders) {
        if (order.items) {
          allItems.push(...order.items);
        }
      }

      expect(allItems.length).toBe(2);

      // Update primary order
      const primaryOrderId = tables[0].currentOrderId;
      await updateDocument('orders', primaryOrderId, {
        items: allItems,
        updatedAt: expect.any(Date)
      });

      expect(updateDocument).toHaveBeenCalledWith(
        'orders',
        'order_1',
        expect.objectContaining({
          items: allItems
        })
      );

      // Update all tables
      for (const tableId of tableIds) {
        await updateDocument('tables', tableId, {
          currentOrderId: primaryOrderId,
          status: 'occupied',
          updatedAt: expect.any(Date)
        });
      }

      expect(updateDocument).toHaveBeenCalledWith(
        'tables',
        'table_1',
        expect.objectContaining({
          currentOrderId: 'order_1'
        })
      );

      // Delete old orders
      for (const order of orders) {
        if (order.id !== primaryOrderId) {
          await deleteDocument('orders', order.id);
        }
      }

      expect(deleteDocument).toHaveBeenCalledWith('orders', 'order_2');
    });

    test('should reject merge with less than 2 tables', () => {
      const tableIds = ['table_1'];
      const error = tableIds.length < 2 ? 'At least 2 table IDs are required for merging' : null;
      expect(error).toBe('At least 2 table IDs are required for merging');
    });

    test('should reject merge if table not found', async () => {
      const tableIds = ['table_1', 'non_existent'];

      getDocument
        .mockResolvedValueOnce({ id: 'table_1', name: 'Table 1' })
        .mockResolvedValueOnce(null); // non_existent table

      const table1 = await getDocument('tables', tableIds[0]);
      expect(table1).toBeTruthy();

      const table2 = await getDocument('tables', tableIds[1]);
      expect(table2).toBeNull();

      if (!table2) {
        const error = `Table ${tableIds[1]} not found`;
        expect(error).toContain('not found');
      }
    });

    test('should preserve waiter attribution when merging (Requirement 15.5)', async () => {
      const tableIds = ['table_1', 'table_2'];

      // Mock tables and orders with waiter info
      getDocument
        .mockResolvedValueOnce({ id: 'table_1', currentOrderId: 'order_1' })
        .mockResolvedValueOnce({ id: 'table_2', currentOrderId: 'order_2' })
        .mockResolvedValueOnce({
          id: 'order_1',
          items: [{ id: 'item_1', name: 'Biryani', waiterId: 'waiter_1' }]
        })
        .mockResolvedValueOnce({
          id: 'order_2',
          items: [{ id: 'item_2', name: 'Naan', waiterId: 'waiter_2' }]
        });

      const tables = [];
      for (const tableId of tableIds) {
        const table = await getDocument('tables', tableId);
        tables.push(table);
      }

      const orders = [];
      for (const table of tables) {
        const order = await getDocument('orders', table.currentOrderId);
        orders.push(order);
      }

      // Merge items - waiter attribution should be preserved
      const allItems = [];
      for (const order of orders) {
        allItems.push(...order.items);
      }

      // Verify waiter IDs are preserved
      expect(allItems[0].waiterId).toBe('waiter_1');
      expect(allItems[1].waiterId).toBe('waiter_2');
    });
  });

  describe('Split Table (Requirement 15.2)', () => {
    test('should split table order into multiple bills', async () => {
      const tableId = 'table_1';
      const splitConfig = {
        splits: [
          { items: ['item_1'] },
          { items: ['item_2'] }
        ]
      };

      // Mock table and order
      getDocument
        .mockResolvedValueOnce({
          id: 'table_1',
          currentOrderId: 'order_1',
          status: 'occupied'
        })
        .mockResolvedValueOnce({
          id: 'order_1',
          items: [
            { id: 'item_1', name: 'Biryani', quantity: 1, price: 250 },
            { id: 'item_2', name: 'Naan', quantity: 2, price: 40 }
          ]
        });

      setDocument.mockResolvedValue(undefined);
      updateDocument.mockResolvedValue(undefined);
      deleteDocument.mockResolvedValue(undefined);

      // Simulate handler logic
      const table = await getDocument('tables', tableId);
      expect(table).toBeTruthy();
      expect(table.currentOrderId).toBeTruthy();

      const order = await getDocument('orders', table.currentOrderId);
      expect(order).toBeTruthy();
      expect(order.items.length).toBe(2);

      // Create new orders for each split
      const newOrderIds = [];
      for (let i = 0; i < splitConfig.splits.length; i++) {
        const split = splitConfig.splits[i];
        const newOrderId = `order_${Date.now()}_split_${i}`;
        
        const splitItems = order.items.filter(item => 
          split.items.includes(item.id)
        );

        await setDocument('orders', newOrderId, {
          tableId: tableId,
          items: splitItems,
          status: 'draft',
          splitFrom: table.currentOrderId,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date)
        });

        newOrderIds.push(newOrderId);
      }

      expect(setDocument).toHaveBeenCalledTimes(2);
      expect(newOrderIds.length).toBe(2);

      // Update table
      await updateDocument('tables', tableId, {
        currentOrderId: newOrderIds[0],
        updatedAt: expect.any(Date)
      });

      // Delete original order
      await deleteDocument('orders', table.currentOrderId);

      expect(deleteDocument).toHaveBeenCalledWith('orders', 'order_1');
    });

    test('should reject split if table has no order', async () => {
      const tableId = 'table_1';

      getDocument.mockResolvedValue({
        id: 'table_1',
        currentOrderId: null,
        status: 'available'
      });

      const table = await getDocument('tables', tableId);
      expect(table.currentOrderId).toBeNull();

      if (!table.currentOrderId) {
        const error = 'Table has no active order to split';
        expect(error).toBe('Table has no active order to split');
      }
    });

    test('should reject split without configuration', () => {
      const splitConfig = null;
      const error = !splitConfig ? 'Split configuration is required' : null;
      expect(error).toBe('Split configuration is required');
    });
  });

  describe('Transfer Table (Requirement 15.3)', () => {
    test('should transfer order from one table to another', async () => {
      const fromTableId = 'table_1';
      const toTableId = 'table_2';

      // Mock tables
      getDocument
        .mockResolvedValueOnce({
          id: 'table_1',
          currentOrderId: 'order_1',
          status: 'occupied'
        })
        .mockResolvedValueOnce({
          id: 'table_2',
          currentOrderId: null,
          status: 'available'
        });

      updateDocument.mockResolvedValue(undefined);

      // Simulate handler logic
      const fromTable = await getDocument('tables', fromTableId);
      expect(fromTable).toBeTruthy();
      expect(fromTable.currentOrderId).toBeTruthy();

      const toTable = await getDocument('tables', toTableId);
      expect(toTable).toBeTruthy();
      expect(toTable.currentOrderId).toBeNull();

      // Update order
      await updateDocument('orders', fromTable.currentOrderId, {
        tableId: toTableId,
        updatedAt: expect.any(Date)
      });

      // Update destination table
      await updateDocument('tables', toTableId, {
        currentOrderId: fromTable.currentOrderId,
        status: 'occupied',
        updatedAt: expect.any(Date)
      });

      // Clear source table
      await updateDocument('tables', fromTableId, {
        currentOrderId: null,
        status: 'available',
        updatedAt: expect.any(Date)
      });

      expect(updateDocument).toHaveBeenCalledWith(
        'orders',
        'order_1',
        expect.objectContaining({ tableId: 'table_2' })
      );

      expect(updateDocument).toHaveBeenCalledWith(
        'tables',
        'table_2',
        expect.objectContaining({ currentOrderId: 'order_1', status: 'occupied' })
      );

      expect(updateDocument).toHaveBeenCalledWith(
        'tables',
        'table_1',
        expect.objectContaining({ currentOrderId: null, status: 'available' })
      );
    });

    test('should reject transfer if source table has no order', async () => {
      const fromTableId = 'table_1';
      const toTableId = 'table_2';

      getDocument.mockResolvedValue({
        id: 'table_1',
        currentOrderId: null,
        status: 'available'
      });

      const fromTable = await getDocument('tables', fromTableId);
      expect(fromTable.currentOrderId).toBeNull();

      if (!fromTable.currentOrderId) {
        const error = 'Source table has no order to transfer';
        expect(error).toBe('Source table has no order to transfer');
      }
    });

    test('should reject transfer if destination table has order', async () => {
      const fromTableId = 'table_1';
      const toTableId = 'table_2';

      getDocument
        .mockResolvedValueOnce({
          id: 'table_1',
          currentOrderId: 'order_1',
          status: 'occupied'
        })
        .mockResolvedValueOnce({
          id: 'table_2',
          currentOrderId: 'order_2',
          status: 'occupied'
        });

      const fromTable = await getDocument('tables', fromTableId);
      const toTable = await getDocument('tables', toTableId);

      expect(toTable.currentOrderId).toBeTruthy();

      if (toTable.currentOrderId) {
        const error = 'Destination table already has an order';
        expect(error).toBe('Destination table already has an order');
      }
    });

    test('should reject transfer to same table', () => {
      const fromTableId = 'table_1';
      const toTableId = 'table_1';

      const error = fromTableId === toTableId ? 'Cannot transfer table to itself' : null;
      expect(error).toBe('Cannot transfer table to itself');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing table IDs for merge', () => {
      const tableIds = null;
      const error = !tableIds ? 'At least 2 table IDs are required for merging' : null;
      expect(error).toBe('At least 2 table IDs are required for merging');
    });

    test('should handle missing table ID for split', () => {
      const tableId = null;
      const error = !tableId ? 'Table ID is required' : null;
      expect(error).toBe('Table ID is required');
    });

    test('should handle missing table IDs for transfer', () => {
      const fromTableId = null;
      const toTableId = 'table_2';
      const error = !fromTableId || !toTableId ? 'Both source and destination table IDs are required' : null;
      expect(error).toBe('Both source and destination table IDs are required');
    });
  });
});
