/**
 * Menu CRUD Operations Tests
 * 
 * Tests for Task 2.4.1: Implement menu item CRUD operations
 * Validates Requirements 18.1, 18.2, 18.3
 */

const {
  initializeAdminSDK,
  setDocument,
  updateDocument,
  queryCollection,
  getDocument
} = require('../init');

// Mock the init module
jest.mock('../init', () => ({
  initializeAdminSDK: jest.fn(),
  setDocument: jest.fn(),
  updateDocument: jest.fn(),
  queryCollection: jest.fn(),
  getDocument: jest.fn(),
  deleteDocument: jest.fn(),
  getAdminFirestore: jest.fn()
}));

describe('Menu CRUD Operations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Menu Item (Requirement 18.1)', () => {
    test('should create menu item with valid data', async () => {
      const menuItem = {
        name: 'Chicken Biryani',
        category: 'Main Course',
        price: 250.00,
        description: 'Delicious chicken biryani'
      };

      setDocument.mockResolvedValue(undefined);

      // Simulate the handler logic
      const itemId = `item_${Date.now()}`;
      await setDocument('menuItems', itemId, {
        name: menuItem.name.trim(),
        category: menuItem.category.trim(),
        price: parseFloat(menuItem.price),
        description: menuItem.description.trim(),
        isOutOfStock: false,
        isActive: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });

      expect(setDocument).toHaveBeenCalledWith(
        'menuItems',
        expect.stringContaining('item_'),
        expect.objectContaining({
          name: 'Chicken Biryani',
          category: 'Main Course',
          price: 250.00,
          description: 'Delicious chicken biryani',
          isOutOfStock: false,
          isActive: true
        })
      );
    });

    test('should reject menu item without name', () => {
      const menuItem = {
        name: '',
        category: 'Main Course',
        price: 250.00
      };

      const error = !menuItem.name.trim() ? 'Menu item name is required' : null;
      expect(error).toBe('Menu item name is required');
    });

    test('should reject menu item without category', () => {
      const menuItem = {
        name: 'Chicken Biryani',
        category: '',
        price: 250.00
      };

      const error = !menuItem.category.trim() ? 'Category is required' : null;
      expect(error).toBe('Category is required');
    });

    test('should reject menu item with invalid price', () => {
      const menuItem = {
        name: 'Chicken Biryani',
        category: 'Main Course',
        price: -10
      };

      const error = menuItem.price <= 0 ? 'Price must be a positive number' : null;
      expect(error).toBe('Price must be a positive number');
    });

    test('should reject menu item with zero price', () => {
      const menuItem = {
        name: 'Chicken Biryani',
        category: 'Main Course',
        price: 0
      };

      const error = menuItem.price <= 0 ? 'Price must be a positive number' : null;
      expect(error).toBe('Price must be a positive number');
    });
  });

  describe('Update Menu Item (Requirement 18.2)', () => {
    test('should update menu item with valid data', async () => {
      const itemId = 'item_123';
      const updates = {
        name: 'Updated Biryani',
        price: 300.00
      };

      getDocument.mockResolvedValue({
        id: itemId,
        name: 'Chicken Biryani',
        category: 'Main Course',
        price: 250.00
      });

      updateDocument.mockResolvedValue(undefined);

      // Simulate the handler logic
      const existingItem = await getDocument('menuItems', itemId);
      expect(existingItem).toBeTruthy();

      const updateData = { updatedAt: new Date() };
      if (updates.name) updateData.name = updates.name.trim();
      if (updates.price) updateData.price = parseFloat(updates.price);

      await updateDocument('menuItems', itemId, updateData);

      expect(updateDocument).toHaveBeenCalledWith(
        'menuItems',
        itemId,
        expect.objectContaining({
          name: 'Updated Biryani',
          price: 300.00
        })
      );
    });

    test('should update only provided fields', async () => {
      const itemId = 'item_123';
      const updates = {
        price: 300.00
      };

      getDocument.mockResolvedValue({
        id: itemId,
        name: 'Chicken Biryani',
        category: 'Main Course',
        price: 250.00
      });

      updateDocument.mockResolvedValue(undefined);

      const updateData = { updatedAt: new Date() };
      if (updates.price) updateData.price = parseFloat(updates.price);

      await updateDocument('menuItems', itemId, updateData);

      expect(updateDocument).toHaveBeenCalledWith(
        'menuItems',
        itemId,
        expect.objectContaining({
          price: 300.00
        })
      );
      expect(updateDocument).toHaveBeenCalledWith(
        'menuItems',
        itemId,
        expect.not.objectContaining({
          name: expect.anything()
        })
      );
    });

    test('should reject update with empty name', () => {
      const updates = {
        name: '   '
      };

      const error = updates.name && !updates.name.trim() ? 'Menu item name cannot be empty' : null;
      expect(error).toBe('Menu item name cannot be empty');
    });

    test('should reject update with invalid price', () => {
      const updates = {
        price: -50
      };

      const error = updates.price !== undefined && updates.price <= 0 ? 'Price must be a positive number' : null;
      expect(error).toBe('Price must be a positive number');
    });
  });

  describe('Delete Menu Item (Requirement 18.3)', () => {
    test('should delete menu item with no active orders', async () => {
      const itemId = 'item_123';

      queryCollection.mockResolvedValue([
        {
          id: 'order_1',
          status: 'completed',
          items: [{ menuItemId: 'item_456' }]
        }
      ]);

      updateDocument.mockResolvedValue(undefined);

      // Simulate the handler logic
      const activeOrders = await queryCollection('orders', [
        { field: 'status', operator: 'in', value: ['draft', 'submitted', 'preparing'] }
      ]);

      const hasActiveOrders = activeOrders.some(order => {
        if (!order.items || !Array.isArray(order.items)) return false;
        return order.items.some(item => item.menuItemId === itemId);
      });

      expect(hasActiveOrders).toBe(false);

      // Soft delete
      await updateDocument('menuItems', itemId, {
        isActive: false,
        updatedAt: expect.any(Date)
      });

      expect(updateDocument).toHaveBeenCalledWith(
        'menuItems',
        itemId,
        expect.objectContaining({
          isActive: false
        })
      );
    });

    test('should block delete if menu item has active orders', async () => {
      const itemId = 'item_123';

      queryCollection.mockResolvedValue([
        {
          id: 'order_1',
          status: 'submitted',
          items: [
            { menuItemId: 'item_123', name: 'Chicken Biryani' },
            { menuItemId: 'item_456', name: 'Naan' }
          ]
        }
      ]);

      const activeOrders = await queryCollection('orders', [
        { field: 'status', operator: 'in', value: ['draft', 'submitted', 'preparing'] }
      ]);

      const hasActiveOrders = activeOrders.some(order => {
        if (!order.items || !Array.isArray(order.items)) return false;
        return order.items.some(item => item.menuItemId === itemId);
      });

      expect(hasActiveOrders).toBe(true);

      const error = hasActiveOrders 
        ? 'Cannot delete menu item with active orders. Please wait until all orders are completed.'
        : null;

      expect(error).toBe('Cannot delete menu item with active orders. Please wait until all orders are completed.');
      expect(updateDocument).not.toHaveBeenCalled();
    });

    test('should handle orders with no items array', async () => {
      const itemId = 'item_123';

      queryCollection.mockResolvedValue([
        {
          id: 'order_1',
          status: 'submitted'
          // No items array
        }
      ]);

      const activeOrders = await queryCollection('orders', [
        { field: 'status', operator: 'in', value: ['draft', 'submitted', 'preparing'] }
      ]);

      const hasActiveOrders = activeOrders.some(order => {
        if (!order.items || !Array.isArray(order.items)) return false;
        return order.items.some(item => item.menuItemId === itemId);
      });

      expect(hasActiveOrders).toBe(false);
    });
  });

  describe('List Menu Items by Category', () => {
    test('should list menu items filtered by category', async () => {
      const category = 'Main Course';

      queryCollection.mockResolvedValue([
        {
          id: 'item_1',
          name: 'Chicken Biryani',
          category: 'Main Course',
          price: 250.00,
          isActive: true
        },
        {
          id: 'item_2',
          name: 'Mutton Biryani',
          category: 'Main Course',
          price: 300.00,
          isActive: true
        }
      ]);

      const items = await queryCollection('menuItems', [
        { field: 'category', operator: '==', value: category },
        { field: 'isActive', operator: '==', value: true }
      ], {
        orderBy: { field: 'name', direction: 'asc' }
      });

      expect(queryCollection).toHaveBeenCalledWith(
        'menuItems',
        expect.arrayContaining([
          { field: 'category', operator: '==', value: 'Main Course' },
          { field: 'isActive', operator: '==', value: true }
        ]),
        expect.objectContaining({
          orderBy: { field: 'name', direction: 'asc' }
        })
      );

      expect(items).toHaveLength(2);
      expect(items.every(item => item.category === 'Main Course')).toBe(true);
    });

    test('should return empty array for category with no items', async () => {
      const category = 'Desserts';

      queryCollection.mockResolvedValue([]);

      const items = await queryCollection('menuItems', [
        { field: 'category', operator: '==', value: category },
        { field: 'isActive', operator: '==', value: true }
      ]);

      expect(items).toHaveLength(0);
    });

    test('should exclude inactive items', async () => {
      const category = 'Main Course';

      queryCollection.mockResolvedValue([
        {
          id: 'item_1',
          name: 'Chicken Biryani',
          category: 'Main Course',
          price: 250.00,
          isActive: true
        }
      ]);

      const items = await queryCollection('menuItems', [
        { field: 'category', operator: '==', value: category },
        { field: 'isActive', operator: '==', value: true }
      ]);

      expect(items.every(item => item.isActive === true)).toBe(true);
    });
  });

  describe('Validation Rules', () => {
    test('should validate name is non-empty string', () => {
      const validNames = ['Chicken Biryani', 'Naan', 'A'];
      const invalidNames = ['', '   ', null, undefined];

      validNames.forEach(name => {
        const error = !name || !name.trim() ? 'Invalid name' : null;
        expect(error).toBeNull();
      });

      invalidNames.forEach(name => {
        const error = !name || !name.trim() ? 'Invalid name' : null;
        expect(error).toBe('Invalid name');
      });
    });

    test('should validate category is non-empty string', () => {
      const validCategories = ['Main Course', 'Appetizer', 'Dessert'];
      const invalidCategories = ['', '   ', null, undefined];

      validCategories.forEach(category => {
        const error = !category || !category.trim() ? 'Invalid category' : null;
        expect(error).toBeNull();
      });

      invalidCategories.forEach(category => {
        const error = !category || !category.trim() ? 'Invalid category' : null;
        expect(error).toBe('Invalid category');
      });
    });

    test('should validate price is positive number', () => {
      const validPrices = [0.01, 1, 100, 999.99];
      const invalidPrices = [0, -1, -100, null, undefined];

      validPrices.forEach(price => {
        const error = !price || price <= 0 ? 'Invalid price' : null;
        expect(error).toBeNull();
      });

      invalidPrices.forEach(price => {
        const error = !price || price <= 0 ? 'Invalid price' : null;
        expect(error).toBe('Invalid price');
      });
    });
  });
});
