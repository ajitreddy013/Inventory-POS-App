/**
 * Property-Based Tests for KOT Router Service
 * 
 * Tests Properties 22-30 from the design document
 * Uses fast-check for property-based testing
 */

const fc = require('fast-check/lib/cjs/fast-check');
const KOTRouterService = require('../src/services/kotRouterService');

// Mock printer service
const mockPrinterService = {
  getStatus: jest.fn().mockResolvedValue({ connected: true }),
  printKOT: jest.fn().mockResolvedValue({ success: true })
};

// Mock Firestore
const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  set: jest.fn().mockResolvedValue({}),
  get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  add: jest.fn().mockResolvedValue({ id: 'mock-id' }),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({}),
  batch: jest.fn(() => ({
    update: jest.fn(),
    commit: jest.fn().mockResolvedValue({})
  }))
};

// Mock Firebase init
jest.mock('../src/firebase/init', () => ({
  getAdminFirestore: () => mockFirestore
}));

describe('KOT Router Property-Based Tests', () => {
  let kotRouter;

  beforeEach(async () => {
    jest.clearAllMocks();
    kotRouter = new KOTRouterService(mockPrinterService);
    await kotRouter.initialize();
  });

  // Arbitraries for generating test data
  const orderItemArbitrary = (category) => fc.record({
    id: fc.uuid(),
    menuItemId: fc.uuid(),
    menuItemName: fc.string({ minLength: 1, maxLength: 50 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    quantity: fc.integer({ min: 1, max: 20 }),
    category: fc.constant(category),
    modifiers: fc.array(
      fc.record({
        id: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 30 }),
        price: fc.float({ min: 0, max: 100 })
      }),
      { maxLength: 5 }
    ),
    isIncremental: fc.boolean()
  });

  const orderArbitrary = fc.record({
    id: fc.uuid(),
    orderNumber: fc.string({ minLength: 1, maxLength: 20 }),
    tableNumber: fc.string({ minLength: 1, maxLength: 10 }),
    tableName: fc.string({ minLength: 1, maxLength: 20 }),
    waiterName: fc.string({ minLength: 1, maxLength: 50 })
  });

  // Feature: waiter-flow, Property 22: Food Item Kitchen Routing
  // **Validates: Requirements 7.2**
  test('Property 22: Food items should route to kitchen printer', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderArbitrary,
        fc.array(orderItemArbitrary('food'), { minLength: 1, maxLength: 10 }),
        async (order, foodItems) => {
          // Route order with only food items
          const result = await kotRouter.routeOrder(order, foodItems);

          // Should generate kitchen KOT
          expect(result.kitchenKOT).toBeDefined();
          expect(result.kitchenKOT.printerType).toBe('kitchen');
          
          // Should not generate bar KOT
          expect(result.barKOT).toBeNull();
          
          // All items in kitchen KOT should match food items count
          expect(result.kitchenKOT.items.length).toBe(foodItems.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: waiter-flow, Property 23: Drink Item Bar Routing
  // **Validates: Requirements 7.3**
  test('Property 23: Drink items should route to bar printer', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderArbitrary,
        fc.array(orderItemArbitrary('drink'), { minLength: 1, maxLength: 10 }),
        async (order, drinkItems) => {
          // Route order with only drink items
          const result = await kotRouter.routeOrder(order, drinkItems);

          // Should generate bar KOT
          expect(result.barKOT).toBeDefined();
          expect(result.barKOT.printerType).toBe('bar');
          
          // Should not generate kitchen KOT
          expect(result.kitchenKOT).toBeNull();
          
          // All items in bar KOT should match drink items count
          expect(result.barKOT.items.length).toBe(drinkItems.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: waiter-flow, Property 24: Mixed Order Split Routing
  // **Validates: Requirements 7.4**
  test('Property 24: Mixed orders should split into kitchen and bar KOTs', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderArbitrary,
        fc.array(orderItemArbitrary('food'), { minLength: 1, maxLength: 5 }),
        fc.array(orderItemArbitrary('drink'), { minLength: 1, maxLength: 5 }),
        async (order, foodItems, drinkItems) => {
          const mixedItems = [...foodItems, ...drinkItems];
          
          // Route order with mixed items
          const result = await kotRouter.routeOrder(order, mixedItems);

          // Should generate both KOTs
          expect(result.kitchenKOT).toBeDefined();
          expect(result.barKOT).toBeDefined();
          
          // Kitchen KOT should have correct printer type
          expect(result.kitchenKOT.printerType).toBe('kitchen');
          
          // Bar KOT should have correct printer type
          expect(result.barKOT.printerType).toBe('bar');
          
          // Kitchen KOT should contain correct number of items
          expect(result.kitchenKOT.items.length).toBe(foodItems.length);
          
          // Bar KOT should contain correct number of items
          expect(result.barKOT.items.length).toBe(drinkItems.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: waiter-flow, Property 26: KOT Completeness
  // **Validates: Requirements 8.3, 8.4, 8.7**
  test('Property 26: KOT should contain all order items with quantities and modifiers', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderArbitrary,
        fc.array(orderItemArbitrary('food'), { minLength: 1, maxLength: 10 }),
        async (order, items) => {
          // Route order
          const result = await kotRouter.routeOrder(order, items);

          expect(result.kitchenKOT).toBeDefined();
          
          // KOT should contain all items
          expect(result.kitchenKOT.items.length).toBe(items.length);
          
          // Each item should have quantity
          result.kitchenKOT.items.forEach((kotItem) => {
            expect(kotItem.quantity).toBeGreaterThan(0);
            expect(kotItem.name).toBeDefined();
            expect(kotItem.modifiers).toBeDefined();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: waiter-flow, Property 27: KOT Required Metadata
  // **Validates: Requirements 8.1, 8.2, 8.5, 8.6**
  test('Property 27: KOT should contain required metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderArbitrary,
        fc.array(orderItemArbitrary('food'), { minLength: 1, maxLength: 5 }),
        async (order, items) => {
          // Route order
          const result = await kotRouter.routeOrder(order, items);

          expect(result.kitchenKOT).toBeDefined();
          const kot = result.kitchenKOT;
          
          // Should have table number
          expect(kot.tableNumber).toBeDefined();
          expect(kot.tableNumber).toBe(order.tableNumber || order.tableName || 'N/A');
          
          // Should have waiter name
          expect(kot.waiterName).toBeDefined();
          expect(kot.waiterName).toBe(order.waiterName || 'Desktop');
          
          // Should have timestamp in HH:MM format
          expect(kot.timestamp).toBeDefined();
          expect(kot.timestamp).toMatch(/^\d{2}:\d{2}$/);
          
          // Should have unique order number
          expect(kot.orderNumber).toBeDefined();
          expect(kot.orderNumber).toBe(order.orderNumber || order.id);
          
          // Should have unique KOT number
          expect(kot.kotNumber).toBeDefined();
          expect(kot.kotNumber).toMatch(/^KOT-\d+$/);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: waiter-flow, Property 28: Incremental KOT Content
  // **Validates: Requirements 9.1, 9.2**
  test('Property 28: Incremental KOTs should contain only new/incremental items', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(orderItemArbitrary('food'), { minLength: 1, maxLength: 5 }),
        fc.array(orderItemArbitrary('food'), { minLength: 1, maxLength: 3 }),
        async (orderId, existingItems, newItems) => {
          // Mock existing items in Firestore
          const mockSnapshot = {
            forEach: (callback) => {
              existingItems.forEach(item => {
                callback({
                  id: item.id,
                  data: () => ({ ...item, sentToKitchen: true })
                });
              });
            }
          };
          
          mockFirestore.get.mockResolvedValueOnce(mockSnapshot);
          
          // Handle order modification
          const incrementalItems = await kotRouter.handleOrderModification(orderId, newItems);
          
          // All returned items should be marked as new (not incremental)
          // since they don't match existing items
          incrementalItems.forEach(item => {
            expect(item.isIncremental).toBe(false);
          });
          
          // Should return all new items
          expect(incrementalItems.length).toBe(newItems.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  // Feature: waiter-flow, Property 28 (Quantity Increase): Incremental KOT with quantity increase
  // **Validates: Requirements 9.1, 9.2**
  test('Property 28 (Quantity Increase): Items with increased quantity should be marked incremental', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        orderItemArbitrary('food'),
        fc.integer({ min: 1, max: 5 }),
        async (orderId, baseItem, quantityIncrease) => {
          const existingItem = { ...baseItem, quantity: 5, sentToKitchen: true };
          const newItem = { ...baseItem, quantity: 5 + quantityIncrease };
          
          // Mock existing items in Firestore
          const mockSnapshot = {
            forEach: (callback) => {
              callback({
                id: existingItem.id,
                data: () => existingItem
              });
            }
          };
          
          mockFirestore.get.mockResolvedValueOnce(mockSnapshot);
          
          // Handle order modification
          const incrementalItems = await kotRouter.handleOrderModification(orderId, [newItem]);
          
          // Should return one incremental item
          expect(incrementalItems.length).toBe(1);
          
          // Should be marked as incremental
          expect(incrementalItems[0].isIncremental).toBe(true);
          
          // Quantity should be the increment only
          expect(incrementalItems[0].quantity).toBe(quantityIncrease);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: waiter-flow, Property 30: KOT Quantity Sum Invariant
  // **Validates: Requirements 9.5**
  test('Property 30: Sum of KOT quantities should equal current order quantity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        orderItemArbitrary('food'),
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 5 }),
        async (orderId, baseItem, quantityIncreases) => {
          let currentQuantity = 5;
          const kotQuantities = [];
          
          // Simulate multiple KOT generations with quantity increases
          for (const increase of quantityIncreases) {
            const existingItem = { ...baseItem, quantity: currentQuantity, sentToKitchen: true };
            const newItem = { ...baseItem, quantity: currentQuantity + increase };
            
            // Mock existing items
            const mockSnapshot = {
              forEach: (callback) => {
                callback({
                  id: existingItem.id,
                  data: () => existingItem
                });
              }
            };
            
            mockFirestore.get.mockResolvedValueOnce(mockSnapshot);
            
            // Handle modification
            const incrementalItems = await kotRouter.handleOrderModification(orderId, [newItem]);
            
            if (incrementalItems.length > 0) {
              kotQuantities.push(incrementalItems[0].quantity);
            }
            
            currentQuantity += increase;
          }
          
          // Sum of all KOT quantities should equal total quantity added
          const kotSum = kotQuantities.reduce((sum, qty) => sum + qty, 0);
          const totalIncrease = quantityIncreases.reduce((sum, inc) => sum + inc, 0);
          
          expect(kotSum).toBe(totalIncrease);
        }
      ),
      { numRuns: 50 }
    );
  });

  // Additional test: Category-based routing (Property 25)
  // Feature: waiter-flow, Property 25: Category-Based Routing
  // **Validates: Requirements 7.5**
  test('Property 25: Printer destination should be determined by item category', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderArbitrary,
        fc.array(
          fc.record({
            ...orderItemArbitrary('food').value,
            category: fc.constantFrom('food', 'drink')
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (order, items) => {
          // Route order
          const result = await kotRouter.routeOrder(order, items);

          // Check that each item went to correct printer based on category
          const foodItems = items.filter(i => i.category === 'food');
          const drinkItems = items.filter(i => i.category === 'drink');
          
          if (foodItems.length > 0) {
            expect(result.kitchenKOT).toBeDefined();
            expect(result.kitchenKOT.items.length).toBe(foodItems.length);
          } else {
            expect(result.kitchenKOT).toBeNull();
          }
          
          if (drinkItems.length > 0) {
            expect(result.barKOT).toBeDefined();
            expect(result.barKOT.items.length).toBe(drinkItems.length);
          } else {
            expect(result.barKOT).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Test KOT generation within 1 second (Performance requirement 7.1)
  test('KOT generation should complete within 1 second', async () => {
    await fc.assert(
      fc.asyncProperty(
        orderArbitrary,
        fc.array(orderItemArbitrary('food'), { minLength: 1, maxLength: 20 }),
        async (order, items) => {
          const startTime = Date.now();
          
          await kotRouter.routeOrder(order, items);
          
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Should complete within 1000ms
          expect(duration).toBeLessThan(1000);
        }
      ),
      { numRuns: 50 }
    );
  });
});
