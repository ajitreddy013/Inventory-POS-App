/**
 * Tests for Order Data Serialization
 * 
 * Property 44: Order Serialization Round-Trip Integrity
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
 */

const { serializeOrder, deserializeOrder, SerializationError } = require('../src/services/orderSerializer');

describe('Order Serialization Tests', () => {
  const validOrder = {
    id: 'order_123',
    orderNumber: 'ORD-001',
    tableId: 'table_1',
    tableNumber: 'T1',
    waiterId: 'waiter_1',
    waiterName: 'John Doe',
    items: [
      {
        id: 'item_1',
        menuItemId: 'menu_1',
        name: 'Chicken Biryani',
        quantity: 2,
        price: 250,
        modifiers: [
          { id: 'mod_1', name: 'Extra Spicy', price: 0 }
        ]
      },
      {
        id: 'item_2',
        menuItemId: 'menu_2',
        name: 'Paneer Tikka',
        quantity: 1,
        price: 180,
        modifiers: []
      }
    ],
    status: 'pending',
    total: 680,
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-01-15T10:30:00Z',
    sentToKitchenAt: null
  };

  describe('Serialization (Requirement 20.1)', () => {
    test('should serialize valid order to JSON string', () => {
      const json = serializeOrder(validOrder);
      
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    test('should include all order fields', () => {
      const json = serializeOrder(validOrder);
      const parsed = JSON.parse(json);
      
      expect(parsed.id).toBe('order_123');
      expect(parsed.orderNumber).toBe('ORD-001');
      expect(parsed.tableId).toBe('table_1');
      expect(parsed.tableNumber).toBe('T1');
      expect(parsed.waiterId).toBe('waiter_1');
      expect(parsed.waiterName).toBe('John Doe');
      expect(parsed.status).toBe('pending');
      expect(parsed.total).toBe(680);
    });

    test('should include all items with modifiers', () => {
      const json = serializeOrder(validOrder);
      const parsed = JSON.parse(json);
      
      expect(parsed.items).toHaveLength(2);
      expect(parsed.items[0].name).toBe('Chicken Biryani');
      expect(parsed.items[0].quantity).toBe(2);
      expect(parsed.items[0].modifiers).toHaveLength(1);
      expect(parsed.items[1].name).toBe('Paneer Tikka');
    });

    test('should include timestamps', () => {
      const json = serializeOrder(validOrder);
      const parsed = JSON.parse(json);
      
      expect(parsed.createdAt).toBe('2025-01-15T10:30:00Z');
      expect(parsed.updatedAt).toBe('2025-01-15T10:30:00Z');
      expect(parsed.sentToKitchenAt).toBeNull();
    });

    test('should handle order with sentToKitchenAt', () => {
      const order = { ...validOrder, sentToKitchenAt: '2025-01-15T10:35:00Z' };
      const json = serializeOrder(order);
      const parsed = JSON.parse(json);
      
      expect(parsed.sentToKitchenAt).toBe('2025-01-15T10:35:00Z');
    });

    test('should reject null order', () => {
      expect(() => serializeOrder(null)).toThrow('Order must be an object');
    });

    test('should reject non-object order', () => {
      expect(() => serializeOrder('invalid')).toThrow('Order must be an object');
    });
  });

  describe('Deserialization (Requirement 20.2)', () => {
    test('should deserialize valid JSON string to order object', () => {
      const json = serializeOrder(validOrder);
      const deserialized = deserializeOrder(json);
      
      expect(deserialized).toMatchObject({
        id: 'order_123',
        orderNumber: 'ORD-001',
        tableId: 'table_1',
        tableNumber: 'T1',
        waiterId: 'waiter_1',
        waiterName: 'John Doe',
        status: 'pending',
        total: 680
      });
    });

    test('should deserialize object directly', () => {
      const deserialized = deserializeOrder(validOrder);
      
      expect(deserialized.id).toBe('order_123');
      expect(deserialized.orderNumber).toBe('ORD-001');
    });

    test('should reject invalid JSON string', () => {
      expect(() => deserializeOrder('{ invalid json')).toThrow('Invalid JSON format');
    });

    test('should reject missing required fields', () => {
      const invalidOrders = [
        { ...validOrder, id: undefined },
        { ...validOrder, orderNumber: undefined },
        { ...validOrder, tableId: undefined },
        { ...validOrder, waiterId: undefined },
        { ...validOrder, waiterName: undefined },
        { ...validOrder, status: undefined },
        { ...validOrder, items: undefined },
        { ...validOrder, total: undefined },
        { ...validOrder, createdAt: undefined },
        { ...validOrder, updatedAt: undefined }
      ];

      for (const order of invalidOrders) {
        expect(() => deserializeOrder(order)).toThrow(SerializationError);
      }
    });

    test('should reject invalid field types', () => {
      expect(() => deserializeOrder({ ...validOrder, id: 123 })).toThrow('Missing or invalid "id" field');
      expect(() => deserializeOrder({ ...validOrder, items: 'invalid' })).toThrow('Missing or invalid "items" field');
      expect(() => deserializeOrder({ ...validOrder, total: 'invalid' })).toThrow('Missing or invalid "total" field');
      expect(() => deserializeOrder({ ...validOrder, total: -10 })).toThrow('Missing or invalid "total" field');
    });

    test('should reject invalid item structure', () => {
      const invalidItems = [
        { ...validOrder, items: [null] },
        { ...validOrder, items: [{ id: 'item_1' }] }, // missing fields
        { ...validOrder, items: [{ ...validOrder.items[0], quantity: 0 }] }, // invalid quantity
        { ...validOrder, items: [{ ...validOrder.items[0], price: -10 }] } // invalid price
      ];

      for (const order of invalidItems) {
        expect(() => deserializeOrder(order)).toThrow(SerializationError);
      }
    });
  });

  describe('Error Handling (Requirement 20.4)', () => {
    test('should provide descriptive error messages', () => {
      try {
        deserializeOrder({ ...validOrder, id: undefined });
      } catch (error) {
        expect(error).toBeInstanceOf(SerializationError);
        expect(error.message).toContain('id');
        expect(error.field).toBe('id');
      }
    });

    test('should identify field causing error', () => {
      try {
        deserializeOrder({ ...validOrder, items: [{ ...validOrder.items[0], quantity: -1 }] });
      } catch (error) {
        expect(error).toBeInstanceOf(SerializationError);
        expect(error.field).toContain('items[0].quantity');
      }
    });
  });

  describe('Property 44: Order Serialization Round-Trip Integrity (Requirement 20.5)', () => {
    test('should maintain order integrity through serialize-deserialize cycle', () => {
      const serialized = serializeOrder(validOrder);
      const deserialized = deserializeOrder(serialized);
      
      expect(deserialized).toMatchObject({
        id: validOrder.id,
        orderNumber: validOrder.orderNumber,
        tableId: validOrder.tableId,
        tableNumber: validOrder.tableNumber,
        waiterId: validOrder.waiterId,
        waiterName: validOrder.waiterName,
        status: validOrder.status,
        total: validOrder.total,
        createdAt: validOrder.createdAt,
        updatedAt: validOrder.updatedAt,
        sentToKitchenAt: validOrder.sentToKitchenAt
      });
    });

    test('should preserve all items through round-trip', () => {
      const serialized = serializeOrder(validOrder);
      const deserialized = deserializeOrder(serialized);
      
      expect(deserialized.items).toHaveLength(validOrder.items.length);
      
      for (let i = 0; i < validOrder.items.length; i++) {
        expect(deserialized.items[i]).toMatchObject({
          id: validOrder.items[i].id,
          menuItemId: validOrder.items[i].menuItemId,
          name: validOrder.items[i].name,
          quantity: validOrder.items[i].quantity,
          price: validOrder.items[i].price
        });
      }
    });

    test('should preserve modifiers through round-trip', () => {
      const serialized = serializeOrder(validOrder);
      const deserialized = deserializeOrder(serialized);
      
      expect(deserialized.items[0].modifiers).toHaveLength(1);
      expect(deserialized.items[0].modifiers[0]).toMatchObject({
        id: 'mod_1',
        name: 'Extra Spicy',
        price: 0
      });
    });

    test('should handle multiple round-trips', () => {
      let current = validOrder;
      
      for (let i = 0; i < 5; i++) {
        const serialized = serializeOrder(current);
        current = deserializeOrder(serialized);
      }
      
      expect(current).toMatchObject({
        id: validOrder.id,
        orderNumber: validOrder.orderNumber,
        total: validOrder.total
      });
    });

    test('should handle edge cases in round-trip', () => {
      const edgeCases = [
        { ...validOrder, items: [] }, // empty items
        { ...validOrder, total: 0 }, // zero total
        { ...validOrder, sentToKitchenAt: '2025-01-15T10:35:00Z' }, // with sentToKitchenAt
        {
          ...validOrder,
          items: [
            {
              id: 'item_1',
              menuItemId: 'menu_1',
              name: 'Item with special chars: @#$%',
              quantity: 100,
              price: 9999.99,
              modifiers: []
            }
          ]
        }
      ];

      for (const order of edgeCases) {
        const serialized = serializeOrder(order);
        const deserialized = deserializeOrder(serialized);
        
        expect(deserialized.id).toBe(order.id);
        expect(deserialized.items.length).toBe(order.items.length);
        expect(deserialized.total).toBe(order.total);
      }
    });
  });
});
