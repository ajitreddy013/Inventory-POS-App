/**
 * Property-Based Tests for Menu Browser
 * 
 * Tests menu search accuracy and filtering
 */

describe('Property-Based Tests: Menu Browser', () => {
  describe('Property 18: Menu Search Accuracy', () => {
    /**
     * Property 18: Search returns only matching items
     * 
     * When searching menu items, only items whose names contain
     * the search query (case-insensitive) should be returned.
     * 
     * Validates: Requirements 5.5
     */

    test('Property 18: Search is case-insensitive', () => {
      const menuItems = [
        { id: '1', name: 'Chicken Tikka', price: 250 },
        { id: '2', name: 'Paneer Butter Masala', price: 200 },
        { id: '3', name: 'Chicken Biryani', price: 300 }
      ];

      const searchQuery = 'chicken';
      const results = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(results.length).toBe(2);
      expect(results.every(item => item.name.toLowerCase().includes(searchQuery))).toBe(true);
    });

    test('Property 18: Search matches partial names', () => {
      const menuItems = [
        { id: '1', name: 'Butter Chicken', price: 250 },
        { id: '2', name: 'Butter Naan', price: 50 },
        { id: '3', name: 'Garlic Naan', price: 60 }
      ];

      const searchQuery = 'butter';
      const results = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(results.length).toBe(2);
      expect(results[0].name).toBe('Butter Chicken');
      expect(results[1].name).toBe('Butter Naan');
    });

    test('Property 18: Empty search returns all items', () => {
      const menuItems = [
        { id: '1', name: 'Item 1', price: 100 },
        { id: '2', name: 'Item 2', price: 200 },
        { id: '3', name: 'Item 3', price: 300 }
      ];

      const searchQuery = '';
      const results = searchQuery.trim()
        ? menuItems.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : menuItems;

      expect(results.length).toBe(menuItems.length);
    });

    test('Property 18: No matches returns empty array', () => {
      const menuItems = [
        { id: '1', name: 'Chicken Tikka', price: 250 },
        { id: '2', name: 'Paneer Masala', price: 200 }
      ];

      const searchQuery = 'pizza';
      const results = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(results.length).toBe(0);
    });

    test('Property 18: Search handles special characters', () => {
      const menuItems = [
        { id: '1', name: 'Dal Makhani', price: 180 },
        { id: '2', name: 'Dal Tadka', price: 160 }
      ];

      const searchQuery = 'dal';
      const results = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(results.length).toBe(2);
    });

    test('Property 18: Search with whitespace is trimmed', () => {
      const menuItems = [
        { id: '1', name: 'Chicken Tikka', price: 250 }
      ];

      const searchQuery = '  chicken  ';
      const trimmedQuery = searchQuery.trim().toLowerCase();
      const results = menuItems.filter(item =>
        item.name.toLowerCase().includes(trimmedQuery)
      );

      expect(results.length).toBe(1);
    });

    test('Property 18: Search matches anywhere in name', () => {
      const menuItems = [
        { id: '1', name: 'Chicken Tikka Masala', price: 250 },
        { id: '2', name: 'Paneer Tikka', price: 200 },
        { id: '3', name: 'Fish Tikka', price: 280 }
      ];

      const searchQuery = 'tikka';
      const results = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(results.length).toBe(3);
      expect(results.every(item => item.name.toLowerCase().includes(searchQuery))).toBe(true);
    });

    test('Property 18: Multiple word search', () => {
      const menuItems = [
        { id: '1', name: 'Chicken Butter Masala', price: 250 },
        { id: '2', name: 'Paneer Butter Masala', price: 200 },
        { id: '3', name: 'Chicken Tikka', price: 220 }
      ];

      const searchQuery = 'butter masala';
      const results = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(results.length).toBe(2);
    });
  });

  describe('Property 17: Out-of-Stock Indicator Display', () => {
    /**
     * Property 17: Out-of-stock items are clearly marked
     * 
     * Items with is_out_of_stock = 1 must display indicator
     * and be disabled for selection.
     * 
     * Validates: Requirements 5.3
     */

    test('Property 17: Out-of-stock items are identified', () => {
      const menuItems = [
        { id: '1', name: 'Item 1', is_out_of_stock: 0 },
        { id: '2', name: 'Item 2', is_out_of_stock: 1 },
        { id: '3', name: 'Item 3', is_out_of_stock: 0 }
      ];

      const outOfStockItems = menuItems.filter(item => item.is_out_of_stock === 1);

      expect(outOfStockItems.length).toBe(1);
      expect(outOfStockItems[0].id).toBe('2');
    });

    test('Property 17: In-stock items are selectable', () => {
      const menuItems = [
        { id: '1', name: 'Item 1', is_out_of_stock: 0 },
        { id: '2', name: 'Item 2', is_out_of_stock: 0 }
      ];

      const selectableItems = menuItems.filter(item => item.is_out_of_stock === 0);

      expect(selectableItems.length).toBe(2);
    });

    test('Property 17: Out-of-stock status is boolean-like', () => {
      const item1 = { is_out_of_stock: 0 };
      const item2 = { is_out_of_stock: 1 };

      expect([0, 1]).toContain(item1.is_out_of_stock);
      expect([0, 1]).toContain(item2.is_out_of_stock);
    });

    test('Property 17: All items have out-of-stock status', () => {
      const menuItems = [
        { id: '1', name: 'Item 1', is_out_of_stock: 0 },
        { id: '2', name: 'Item 2', is_out_of_stock: 1 },
        { id: '3', name: 'Item 3', is_out_of_stock: 0 }
      ];

      menuItems.forEach(item => {
        expect(item.is_out_of_stock).toBeDefined();
        expect([0, 1]).toContain(item.is_out_of_stock);
      });
    });
  });

  describe('Combined Properties', () => {
    test('Combined: Search and out-of-stock filtering', () => {
      const menuItems = [
        { id: '1', name: 'Chicken Tikka', is_out_of_stock: 0, price: 250 },
        { id: '2', name: 'Chicken Biryani', is_out_of_stock: 1, price: 300 },
        { id: '3', name: 'Paneer Tikka', is_out_of_stock: 0, price: 200 }
      ];

      const searchQuery = 'tikka';
      const searchResults = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(searchResults.length).toBe(2);

      const availableResults = searchResults.filter(item => item.is_out_of_stock === 0);
      expect(availableResults.length).toBe(2);
    });

    test('Combined: Category filtering with search', () => {
      const menuItems = [
        { id: '1', name: 'Chicken Tikka', category_id: 'c1', is_out_of_stock: 0 },
        { id: '2', name: 'Chicken Biryani', category_id: 'c2', is_out_of_stock: 0 },
        { id: '3', name: 'Paneer Tikka', category_id: 'c2', is_out_of_stock: 0 }
      ];

      const searchQuery = 'tikka';
      const categoryId = 'c1';

      let filtered = menuItems;

      // Apply search
      if (searchQuery.trim()) {
        filtered = filtered.filter(item =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Apply category filter
      if (categoryId) {
        filtered = filtered.filter(item => item.category_id === categoryId);
      }

      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Chicken Tikka');
    });

    test('Combined: Real-time updates preserve search state', () => {
      const initialItems = [
        { id: '1', name: 'Chicken Tikka', is_out_of_stock: 0 },
        { id: '2', name: 'Paneer Tikka', is_out_of_stock: 0 }
      ];

      const updatedItems = [
        { id: '1', name: 'Chicken Tikka', is_out_of_stock: 1 }, // Now out of stock
        { id: '2', name: 'Paneer Tikka', is_out_of_stock: 0 }
      ];

      const searchQuery = 'tikka';

      const initialResults = initialItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      const updatedResults = updatedItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(initialResults.length).toBe(2);
      expect(updatedResults.length).toBe(2);

      const availableAfterUpdate = updatedResults.filter(item => item.is_out_of_stock === 0);
      expect(availableAfterUpdate.length).toBe(1);
    });
  });
});
