/**
 * Tests for Data Validation
 * 
 * Properties 36, 48, 49, 50: Data validation properties
 * Requirements: 12.3, 12.5, 14.1, 24.1, 24.2, 24.3, 24.4, 24.5
 */

const { validateOrder, validateBill, calculateOrderTotal, ValidationError } = require('../src/services/dataValidator');

describe('Order Validation Tests', () => {
  const validOrder = {
    id: 'order_123',
    orderNumber: 'ORD-001',
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
      }
    ],
    total: 500
  };

  describe('Property 48: Empty Order Rejection (Requirement 24.1)', () => {
    test('should reject order with no items', () => {
      const order = { ...validOrder, items: [] };
      
      expect(() => validateOrder(order)).toThrow('Order must have at least one item');
    });

    test('should reject order with undefined items', () => {
      const order = { ...validOrder, items: undefined };
      
      expect(() => validateOrder(order)).toThrow('Order must have at least one item');
    });

    test('should accept order with at least one item', () => {
      expect(() => validateOrder(validOrder)).not.toThrow();
    });
  });

  describe('Property 49: Positive Quantity Validation (Requirement 24.2)', () => {
    test('should reject item with zero quantity', () => {
      const order = {
        ...validOrder,
        items: [{ ...validOrder.items[0], quantity: 0 }],
        total: 0
      };
      
      expect(() => validateOrder(order)).toThrow('must have positive quantity');
    });

    test('should reject item with negative quantity', () => {
      const order = {
        ...validOrder,
        items: [{ ...validOrder.items[0], quantity: -1 }],
        total: -250
      };
      
      expect(() => validateOrder(order)).toThrow('must have positive quantity');
    });

    test('should accept item with positive quantity', () => {
      expect(() => validateOrder(validOrder)).not.toThrow();
    });

    test('should accept multiple items with positive quantities', () => {
      const order = {
        ...validOrder,
        items: [
          { ...validOrder.items[0], quantity: 1 },
          { ...validOrder.items[0], id: 'item_2', quantity: 5 }
        ],
        total: 1500
      };
      
      expect(() => validateOrder(order)).not.toThrow();
    });
  });

  describe('Valid Modifiers (Requirement 24.3)', () => {
    test('should accept items with valid modifiers', () => {
      expect(() => validateOrder(validOrder)).not.toThrow();
    });

    test('should accept items without modifiers', () => {
      const order = {
        ...validOrder,
        items: [{ ...validOrder.items[0], modifiers: [] }]
      };
      
      expect(() => validateOrder(order)).not.toThrow();
    });

    test('should reject invalid modifier structure', () => {
      const order = {
        ...validOrder,
        items: [{ ...validOrder.items[0], modifiers: [null] }]
      };
      
      expect(() => validateOrder(order)).toThrow(ValidationError);
    });

    test('should reject modifier with missing id', () => {
      const order = {
        ...validOrder,
        items: [{
          ...validOrder.items[0],
          modifiers: [{ name: 'Extra Spicy', price: 0 }]
        }]
      };
      
      expect(() => validateOrder(order)).toThrow('must have valid id');
    });

    test('should reject modifier with negative price', () => {
      const order = {
        ...validOrder,
        items: [{
          ...validOrder.items[0],
          modifiers: [{ id: 'mod_1', name: 'Extra Spicy', price: -10 }]
        }],
        total: 480
      };
      
      expect(() => validateOrder(order)).toThrow('must have non-negative price');
    });
  });

  describe('Property 50: Order Total Calculation Invariant (Requirement 24.5)', () => {
    test('should accept order with correct total', () => {
      expect(() => validateOrder(validOrder)).not.toThrow();
    });

    test('should reject order with incorrect total', () => {
      const order = { ...validOrder, total: 999 };
      
      expect(() => validateOrder(order)).toThrow('does not match calculated total');
    });

    test('should calculate total correctly with modifiers', () => {
      const order = {
        ...validOrder,
        items: [{
          id: 'item_1',
          menuItemId: 'menu_1',
          name: 'Biryani',
          quantity: 2,
          price: 250,
          modifiers: [
            { id: 'mod_1', name: 'Extra Spicy', price: 0 },
            { id: 'mod_2', name: 'Extra Raita', price: 20 }
          ]
        }],
        total: 540 // (250 + 0 + 20) * 2
      };
      
      expect(() => validateOrder(order)).not.toThrow();
    });

    test('should calculate total correctly with multiple items', () => {
      const order = {
        ...validOrder,
        items: [
          {
            id: 'item_1',
            menuItemId: 'menu_1',
            name: 'Biryani',
            quantity: 2,
            price: 250,
            modifiers: []
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
        total: 680 // (250 * 2) + (180 * 1)
      };
      
      expect(() => validateOrder(order)).not.toThrow();
    });

    test('should reject negative total', () => {
      const order = { ...validOrder, total: -100 };
      
      expect(() => validateOrder(order)).toThrow('must be a non-negative number');
    });
  });

  describe('Calculate Order Total', () => {
    test('should calculate total for single item', () => {
      const items = [
        { id: 'item_1', quantity: 2, price: 250, modifiers: [] }
      ];
      
      expect(calculateOrderTotal(items)).toBe(500);
    });

    test('should calculate total with modifiers', () => {
      const items = [
        {
          id: 'item_1',
          quantity: 2,
          price: 250,
          modifiers: [
            { id: 'mod_1', price: 20 }
          ]
        }
      ];
      
      expect(calculateOrderTotal(items)).toBe(540); // (250 + 20) * 2
    });

    test('should calculate total for multiple items', () => {
      const items = [
        { id: 'item_1', quantity: 2, price: 250, modifiers: [] },
        { id: 'item_2', quantity: 1, price: 180, modifiers: [] }
      ];
      
      expect(calculateOrderTotal(items)).toBe(680);
    });
  });
});

describe('Bill Validation Tests', () => {
  const validBill = {
    id: 'bill_123',
    orderId: 'order_123',
    total: 500,
    payments: [
      { method: 'Cash', amount: 500 }
    ],
    status: 'paid'
  };

  describe('Property 36: Split Payment Method Limit (Requirement 12.3)', () => {
    test('should accept bill with 1 payment method', () => {
      expect(() => validateBill(validBill)).not.toThrow();
    });

    test('should accept bill with 2 payment methods', () => {
      const bill = {
        ...validBill,
        payments: [
          { method: 'Cash', amount: 300 },
          { method: 'Card', amount: 200 }
        ]
      };
      
      expect(() => validateBill(bill)).not.toThrow();
    });

    test('should reject bill with more than 2 payment methods', () => {
      const bill = {
        ...validBill,
        payments: [
          { method: 'Cash', amount: 200 },
          { method: 'Card', amount: 200 },
          { method: 'UPI', amount: 100 }
        ]
      };
      
      expect(() => validateBill(bill)).toThrow('cannot have more than 2 payment methods');
    });
  });

  describe('Property 37: Split Payment Sum Validation (Requirement 12.5)', () => {
    test('should accept bill where payment sum equals total', () => {
      expect(() => validateBill(validBill)).not.toThrow();
    });

    test('should accept split payment where sum equals total', () => {
      const bill = {
        ...validBill,
        payments: [
          { method: 'Cash', amount: 300 },
          { method: 'Card', amount: 200 }
        ]
      };
      
      expect(() => validateBill(bill)).not.toThrow();
    });

    test('should reject bill where payment sum is less than total', () => {
      const bill = {
        ...validBill,
        payments: [
          { method: 'Cash', amount: 400 }
        ]
      };
      
      expect(() => validateBill(bill)).toThrow('Payment sum (400) must equal bill total (500)');
    });

    test('should reject bill where payment sum is more than total', () => {
      const bill = {
        ...validBill,
        payments: [
          { method: 'Cash', amount: 600 }
        ]
      };
      
      expect(() => validateBill(bill)).toThrow('Payment sum (600) must equal bill total (500)');
    });
  });

  describe('Property 39: Pending Bill Phone Requirement (Requirement 14.1)', () => {
    test('should accept pending bill with customer phone', () => {
      const bill = {
        ...validBill,
        status: 'pending',
        customerPhone: '+91-9876543210'
      };
      
      expect(() => validateBill(bill)).not.toThrow();
    });

    test('should reject pending bill without customer phone', () => {
      const bill = {
        ...validBill,
        status: 'pending'
      };
      
      expect(() => validateBill(bill)).toThrow('Pending bills must have customer phone number');
    });

    test('should accept paid bill without customer phone', () => {
      const bill = {
        ...validBill,
        status: 'paid'
      };
      
      expect(() => validateBill(bill)).not.toThrow();
    });
  });

  describe('Payment Validation', () => {
    test('should reject bill with no payments', () => {
      const bill = { ...validBill, payments: [] };
      
      expect(() => validateBill(bill)).toThrow('Bill must have at least one payment');
    });

    test('should reject payment with invalid method', () => {
      const bill = {
        ...validBill,
        payments: [{ method: null, amount: 500 }]
      };
      
      expect(() => validateBill(bill)).toThrow('must have valid method');
    });

    test('should reject payment with zero amount', () => {
      const bill = {
        ...validBill,
        payments: [{ method: 'Cash', amount: 0 }]
      };
      
      expect(() => validateBill(bill)).toThrow('must have positive amount');
    });

    test('should reject payment with negative amount', () => {
      const bill = {
        ...validBill,
        payments: [{ method: 'Cash', amount: -100 }]
      };
      
      expect(() => validateBill(bill)).toThrow('must have positive amount');
    });
  });
});
