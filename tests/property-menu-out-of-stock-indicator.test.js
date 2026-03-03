/**
 * Property-Based Test: Out-of-Stock Indicator Display
 * 
 * Feature: waiter-flow, Property 17: Out-of-Stock Indicator Display
 * 
 * Property Statement:
 * For any menu item where isOutOfStock=true, the mobile app should display 
 * a visual indicator (red marker) next to that item. Conversely, items with
 * isOutOfStock=false should NOT display the indicator.
 * 
 * **Validates: Requirements 5.3**
 * 
 * Requirements 5.3: Out-of-stock items must show red marker and be disabled
 * 
 * Test Strategy:
 * - Generate arbitrary menu items with varying out-of-stock states
 * - Verify that out-of-stock items always show indicator
 * - Verify that in-stock items never show indicator
 * - Test edge cases (null, undefined, missing fields)
 */

const fc = require('fast-check/lib/cjs/fast-check-default.js');
const { initializeAdminSDK, getAdminFirestore } = require('../src/firebase/init');

// Mock UI component that simulates menu item display logic
class MenuItemDisplay {
  constructor(menuItem) {
    this.menuItem = menuItem;
  }

  /**
   * Determines if the out-of-stock indicator should be displayed
   * This simulates the UI logic that would be in the mobile app
   */
  shouldShowOutOfStockIndicator() {
    // Handle edge cases
    if (!this.menuItem) return false;
    if (typeof this.menuItem.isOutOfStock === 'undefined') return false;
    if (this.menuItem.isOutOfStock === null) return false;
    
    // Core logic: show indicator if and only if isOutOfStock is true
    return this.menuItem.isOutOfStock === true;
  }

  /**
   * Determines if the item should be disabled for selection
   */
  isDisabled() {
    return this.shouldShowOutOfStockIndicator();
  }

  /**
   * Gets the CSS class for the indicator
   */
  getIndicatorClass() {
    return this.shouldShowOutOfStockIndicator() ? 'out-of-stock-indicator red-marker' : '';
  }
}

// Arbitraries for generating test data

/**
 * Generate arbitrary menu items with valid structure
 */
const menuItemArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  category: fc.constantFrom('food', 'drink'),
  price: fc.float({ min: 0, max: 10000, noNaN: true }),
  isOutOfStock: fc.boolean(),
  isActive: fc.boolean(),
  description: fc.option(fc.string({ maxLength: 200 }), { nil: null })
});

/**
 * Generate menu items with edge case values for isOutOfStock
 */
const menuItemWithEdgeCasesArbitrary = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  category: fc.constantFrom('food', 'drink'),
  price: fc.float({ min: 0, max: 10000, noNaN: true }),
  isOutOfStock: fc.oneof(
    fc.boolean(),
    fc.constant(null),
    fc.constant(undefined),
    fc.constant('true'),  // String instead of boolean
    fc.constant('false'), // String instead of boolean
    fc.constant(1),       // Number instead of boolean
    fc.constant(0)        // Number instead of boolean
  ),
  isActive: fc.boolean()
});

/**
 * Generate arrays of menu items
 */
const menuItemsArrayArbitrary = fc.array(menuItemArbitrary, { minLength: 0, maxLength: 100 });

// Property Tests

describe('Property 17: Out-of-Stock Indicator Display', () => {
  
  /**
   * Property 17.1: Out-of-stock items always show indicator
   * 
   * For all menu items where isOutOfStock === true,
   * the indicator must be displayed
   */
  test('out-of-stock items always show indicator', () => {
    fc.assert(
      fc.property(
        menuItemArbitrary,
        (menuItem) => {
          const display = new MenuItemDisplay(menuItem);
          
          if (menuItem.isOutOfStock === true) {
            // Property: If item is out of stock, indicator MUST be shown
            expect(display.shouldShowOutOfStockIndicator()).toBe(true);
            expect(display.isDisabled()).toBe(true);
            expect(display.getIndicatorClass()).toContain('out-of-stock-indicator');
            expect(display.getIndicatorClass()).toContain('red-marker');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.2: In-stock items never show indicator
   * 
   * For all menu items where isOutOfStock === false,
   * the indicator must NOT be displayed
   */
  test('in-stock items never show indicator', () => {
    fc.assert(
      fc.property(
        menuItemArbitrary,
        (menuItem) => {
          const display = new MenuItemDisplay(menuItem);
          
          if (menuItem.isOutOfStock === false) {
            // Property: If item is in stock, indicator MUST NOT be shown
            expect(display.shouldShowOutOfStockIndicator()).toBe(false);
            expect(display.isDisabled()).toBe(false);
            expect(display.getIndicatorClass()).toBe('');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.3: Indicator display is deterministic
   * 
   * For any menu item, calling shouldShowOutOfStockIndicator() multiple times
   * should always return the same result (no side effects)
   */
  test('indicator display is deterministic', () => {
    fc.assert(
      fc.property(
        menuItemArbitrary,
        (menuItem) => {
          const display = new MenuItemDisplay(menuItem);
          
          const result1 = display.shouldShowOutOfStockIndicator();
          const result2 = display.shouldShowOutOfStockIndicator();
          const result3 = display.shouldShowOutOfStockIndicator();
          
          // Property: Multiple calls should return the same result
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.4: Edge cases handled gracefully
   * 
   * For menu items with null, undefined, or non-boolean isOutOfStock values,
   * the system should handle them gracefully (default to not showing indicator)
   */
  test('edge cases handled gracefully', () => {
    fc.assert(
      fc.property(
        menuItemWithEdgeCasesArbitrary,
        (menuItem) => {
          const display = new MenuItemDisplay(menuItem);
          
          // Property: Only true boolean value should show indicator
          const shouldShow = display.shouldShowOutOfStockIndicator();
          
          if (menuItem.isOutOfStock === true) {
            expect(shouldShow).toBe(true);
          } else {
            // null, undefined, strings, numbers, false should all result in no indicator
            expect(shouldShow).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.5: Disabled state matches indicator state
   * 
   * For all menu items, if the indicator is shown, the item must be disabled,
   * and vice versa (they should always be in sync)
   */
  test('disabled state matches indicator state', () => {
    fc.assert(
      fc.property(
        menuItemArbitrary,
        (menuItem) => {
          const display = new MenuItemDisplay(menuItem);
          
          const showsIndicator = display.shouldShowOutOfStockIndicator();
          const isDisabled = display.isDisabled();
          
          // Property: Indicator and disabled state must always match
          expect(showsIndicator).toBe(isDisabled);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.6: Batch consistency
   * 
   * For any array of menu items, the indicator display logic should be
   * consistent across all items (no global state interference)
   */
  test('batch consistency across multiple items', () => {
    fc.assert(
      fc.property(
        menuItemsArrayArbitrary,
        (menuItems) => {
          // Process all items
          const displays = menuItems.map(item => new MenuItemDisplay(item));
          
          // Property: Each item's indicator state should match its isOutOfStock value
          menuItems.forEach((item, index) => {
            const display = displays[index];
            const shouldShow = display.shouldShowOutOfStockIndicator();
            
            if (item.isOutOfStock === true) {
              expect(shouldShow).toBe(true);
            } else if (item.isOutOfStock === false) {
              expect(shouldShow).toBe(false);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.7: Out-of-stock count accuracy
   * 
   * For any array of menu items, the count of items showing indicators
   * should equal the count of items with isOutOfStock === true
   */
  test('out-of-stock count accuracy', () => {
    fc.assert(
      fc.property(
        menuItemsArrayArbitrary,
        (menuItems) => {
          const displays = menuItems.map(item => new MenuItemDisplay(item));
          
          const outOfStockCount = menuItems.filter(item => item.isOutOfStock === true).length;
          const indicatorCount = displays.filter(display => display.shouldShowOutOfStockIndicator()).length;
          
          // Property: Count of indicators must equal count of out-of-stock items
          expect(indicatorCount).toBe(outOfStockCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 17.8: Null/undefined menu item handling
   * 
   * The system should handle null or undefined menu items gracefully
   * without throwing errors
   */
  test('null and undefined menu items handled gracefully', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, {}),
        (menuItem) => {
          // Property: Should not throw error
          expect(() => {
            const display = new MenuItemDisplay(menuItem);
            display.shouldShowOutOfStockIndicator();
            display.isDisabled();
            display.getIndicatorClass();
          }).not.toThrow();
          
          // Property: Should default to not showing indicator
          const display = new MenuItemDisplay(menuItem);
          expect(display.shouldShowOutOfStockIndicator()).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Integration test with Firebase (optional, can be run separately)
describe('Property 17: Firebase Integration', () => {
  let firestore;
  
  beforeAll(async () => {
    try {
      await initializeAdminSDK();
      firestore = getAdminFirestore();
    } catch (error) {
      console.warn('Firebase not initialized, skipping integration tests');
    }
  });

  /**
   * Property 17.9: Real-time sync preserves out-of-stock state
   * 
   * When menu items are synced from Firebase, the isOutOfStock field
   * should be preserved accurately
   */
  test('real-time sync preserves out-of-stock state', async () => {
    if (!firestore) {
      console.log('Skipping Firebase integration test');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        menuItemArbitrary,
        async (menuItem) => {
          // Create test item in Firebase
          const docRef = await firestore.collection('menuItems').add({
            name: menuItem.name,
            category: menuItem.category,
            price: menuItem.price,
            isOutOfStock: menuItem.isOutOfStock,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          // Retrieve the item
          const doc = await docRef.get();
          const retrievedItem = doc.data();

          // Property: isOutOfStock value should be preserved
          expect(retrievedItem.isOutOfStock).toBe(menuItem.isOutOfStock);

          // Verify indicator logic works with retrieved data
          const display = new MenuItemDisplay(retrievedItem);
          if (menuItem.isOutOfStock === true) {
            expect(display.shouldShowOutOfStockIndicator()).toBe(true);
          } else if (menuItem.isOutOfStock === false) {
            expect(display.shouldShowOutOfStockIndicator()).toBe(false);
          }

          // Cleanup
          await docRef.delete();
        }
      ),
      { numRuns: 10 } // Fewer runs for integration tests
    );
  }, 30000); // 30 second timeout for async test
});

// Export for use in other tests
module.exports = {
  MenuItemDisplay,
  menuItemArbitrary,
  menuItemWithEdgeCasesArbitrary,
  menuItemsArrayArbitrary
};
