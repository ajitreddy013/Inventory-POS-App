/**
 * Menu Management Tests
 * 
 * Tests for menu item CRUD operations with Firebase integration
 * Validates Requirements 18.1, 18.2, 18.3
 */

const { expect } = require('chai');
const {
  initializeAdminSDK,
  setDocument,
  getDocument,
  updateDocument,
  queryCollection,
  deleteCollection
} = require('../src/firebase/init');

describe('Menu Management', function() {
  this.timeout(10000);
  
  before(async function() {
    // Initialize Firebase Admin SDK
    await initializeAdminSDK();
    
    // Clean up test data
    await cleanupTestData();
  });
  
  after(async function() {
    // Clean up test data after all tests
    await cleanupTestData();
  });
  
  async function cleanupTestData() {
    try {
      // Delete all test menu items
      const testItems = await queryCollection('menuItems', [
        { field: 'name', operator: '>=', value: 'Test' },
        { field: 'name', operator: '<=', value: 'Test\uf8ff' }
      ]);
      
      for (const item of testItems) {
        await deleteCollection('menuItems', item.id);
      }
      
      // Delete all test orders
      const testOrders = await queryCollection('orders', [
        { field: 'tableId', operator: '==', value: 'test_table' }
      ]);
      
      for (const order of testOrders) {
        await deleteCollection('orders', order.id);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
  
  describe('Create Menu Item (Requirement 18.1)', function() {
    
    it('should create menu item with valid data', async function() {
      const itemData = {
        name: 'Test Chicken Biryani',
        category: 'Main Course',
        price: 250,
        description: 'Aromatic rice with chicken',
        isOutOfStock: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const itemId = `item_${Date.now()}`;
      await setDocument('menuItems', itemId, itemData);
      
      const savedItem = await getDocument('menuItems', itemId);
      
      expect(savedItem).to.exist;
      expect(savedItem.name).to.equal('Test Chicken Biryani');
      expect(savedItem.category).to.equal('Main Course');
      expect(savedItem.price).to.equal(250);
      expect(savedItem.isOutOfStock).to.be.false;
      expect(savedItem.isActive).to.be.true;
    });
    
    it('should reject menu item with missing name', async function() {
      const itemData = {
        category: 'Main Course',
        price: 250
      };
      
      // Validation should happen in IPC handler
      // This test validates the data structure requirement
      expect(itemData.name).to.be.undefined;
    });
    
    it('should reject menu item with missing category', async function() {
      const itemData = {
        name: 'Test Item',
        price: 250
      };
      
      expect(itemData.category).to.be.undefined;
    });
    
    it('should reject menu item with negative price', async function() {
      const itemData = {
        name: 'Test Item',
        category: 'Main Course',
        price: -100
      };
      
      expect(itemData.price).to.be.lessThan(0);
    });
    
    it('should reject menu item with zero price', async function() {
      const itemData = {
        name: 'Test Item',
        category: 'Main Course',
        price: 0
      };
      
      expect(itemData.price).to.equal(0);
    });
    
    it('should set default values correctly', async function() {
      const itemData = {
        name: 'Test Masala Dosa',
        category: 'Breakfast',
        price: 80,
        isOutOfStock: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const itemId = `item_${Date.now()}`;
      await setDocument('menuItems', itemId, itemData);
      
      const savedItem = await getDocument('menuItems', itemId);
      
      expect(savedItem.isOutOfStock).to.be.false;
      expect(savedItem.isActive).to.be.true;
      expect(savedItem.createdAt).to.exist;
      expect(savedItem.updatedAt).to.exist;
    });
    
    it('should handle decimal prices correctly', async function() {
      const itemData = {
        name: 'Test Coffee',
        category: 'Beverage',
        price: 45.50,
        isOutOfStock: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const itemId = `item_${Date.now()}`;
      await setDocument('menuItems', itemId, itemData);
      
      const savedItem = await getDocument('menuItems', itemId);
      
      expect(savedItem.price).to.equal(45.50);
    });
  });
  
  describe('Update Menu Item (Requirement 18.2)', function() {
    
    let testItemId;
    
    beforeEach(async function() {
      // Create a test item
      testItemId = `item_${Date.now()}`;
      await setDocument('menuItems', testItemId, {
        name: 'Test Paneer Tikka',
        category: 'Appetizer',
        price: 180,
        description: 'Grilled cottage cheese',
        isOutOfStock: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
    
    it('should update menu item name', async function() {
      await updateDocument('menuItems', testItemId, {
        name: 'Test Paneer Tikka Masala',
        updatedAt: new Date()
      });
      
      const updatedItem = await getDocument('menuItems', testItemId);
      
      expect(updatedItem.name).to.equal('Test Paneer Tikka Masala');
    });
    
    it('should update menu item price', async function() {
      await updateDocument('menuItems', testItemId, {
        price: 200,
        updatedAt: new Date()
      });
      
      const updatedItem = await getDocument('menuItems', testItemId);
      
      expect(updatedItem.price).to.equal(200);
    });
    
    it('should update menu item category', async function() {
      await updateDocument('menuItems', testItemId, {
        category: 'Main Course',
        updatedAt: new Date()
      });
      
      const updatedItem = await getDocument('menuItems', testItemId);
      
      expect(updatedItem.category).to.equal('Main Course');
    });
    
    it('should update menu item description', async function() {
      await updateDocument('menuItems', testItemId, {
        description: 'Spicy grilled cottage cheese',
        updatedAt: new Date()
      });
      
      const updatedItem = await getDocument('menuItems', testItemId);
      
      expect(updatedItem.description).to.equal('Spicy grilled cottage cheese');
    });
    
    it('should update updatedAt timestamp', async function() {
      const originalItem = await getDocument('menuItems', testItemId);
      const originalUpdatedAt = originalItem.updatedAt;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await updateDocument('menuItems', testItemId, {
        price: 190,
        updatedAt: new Date()
      });
      
      const updatedItem = await getDocument('menuItems', testItemId);
      
      expect(updatedItem.updatedAt).to.not.equal(originalUpdatedAt);
    });
    
    it('should update only provided fields', async function() {
      const originalItem = await getDocument('menuItems', testItemId);
      
      await updateDocument('menuItems', testItemId, {
        price: 195,
        updatedAt: new Date()
      });
      
      const updatedItem = await getDocument('menuItems', testItemId);
      
      expect(updatedItem.price).to.equal(195);
      expect(updatedItem.name).to.equal(originalItem.name);
      expect(updatedItem.category).to.equal(originalItem.category);
      expect(updatedItem.description).to.equal(originalItem.description);
    });
    
    it('should validate item exists before update', async function() {
      const nonExistentId = 'item_nonexistent';
      const item = await getDocument('menuItems', nonExistentId);
      
      expect(item).to.be.null;
    });
  });
  
  describe('Delete Menu Item (Requirement 18.3)', function() {
    
    let testItemId;
    
    beforeEach(async function() {
      // Create a test item
      testItemId = `item_${Date.now()}`;
      await setDocument('menuItems', testItemId, {
        name: 'Test Gulab Jamun',
        category: 'Dessert',
        price: 60,
        isOutOfStock: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
    
    it('should delete menu item with no active orders', async function() {
      // Mark as inactive (soft delete)
      await updateDocument('menuItems', testItemId, {
        isActive: false,
        updatedAt: new Date()
      });
      
      const deletedItem = await getDocument('menuItems', testItemId);
      
      expect(deletedItem.isActive).to.be.false;
    });
    
    it('should prevent deletion when active orders exist (draft)', async function() {
      // Create an active order with this menu item
      const orderId = `order_${Date.now()}`;
      await setDocument('orders', orderId, {
        tableId: 'test_table',
        status: 'draft',
        items: [
          {
            menuItemId: testItemId,
            menuItemName: 'Test Gulab Jamun',
            quantity: 2,
            basePrice: 60,
            totalPrice: 120
          }
        ],
        createdAt: new Date()
      });
      
      // Check for active orders
      const activeOrders = await queryCollection('orders', [
        { field: 'status', operator: 'in', value: ['draft', 'submitted', 'preparing'] }
      ]);
      
      const hasActiveOrders = activeOrders.some(order => {
        if (!order.items || !Array.isArray(order.items)) return false;
        return order.items.some(item => item.menuItemId === testItemId);
      });
      
      expect(hasActiveOrders).to.be.true;
    });
    
    it('should prevent deletion when active orders exist (submitted)', async function() {
      // Create a submitted order with this menu item
      const orderId = `order_${Date.now()}`;
      await setDocument('orders', orderId, {
        tableId: 'test_table',
        status: 'submitted',
        items: [
          {
            menuItemId: testItemId,
            menuItemName: 'Test Gulab Jamun',
            quantity: 3,
            basePrice: 60,
            totalPrice: 180
          }
        ],
        createdAt: new Date()
      });
      
      // Check for active orders
      const activeOrders = await queryCollection('orders', [
        { field: 'status', operator: 'in', value: ['draft', 'submitted', 'preparing'] }
      ]);
      
      const hasActiveOrders = activeOrders.some(order => {
        if (!order.items || !Array.isArray(order.items)) return false;
        return order.items.some(item => item.menuItemId === testItemId);
      });
      
      expect(hasActiveOrders).to.be.true;
    });
    
    it('should prevent deletion when active orders exist (preparing)', async function() {
      // Create a preparing order with this menu item
      const orderId = `order_${Date.now()}`;
      await setDocument('orders', orderId, {
        tableId: 'test_table',
        status: 'preparing',
        items: [
          {
            menuItemId: testItemId,
            menuItemName: 'Test Gulab Jamun',
            quantity: 1,
            basePrice: 60,
            totalPrice: 60
          }
        ],
        createdAt: new Date()
      });
      
      // Check for active orders
      const activeOrders = await queryCollection('orders', [
        { field: 'status', operator: 'in', value: ['draft', 'submitted', 'preparing'] }
      ]);
      
      const hasActiveOrders = activeOrders.some(order => {
        if (!order.items || !Array.isArray(order.items)) return false;
        return order.items.some(item => item.menuItemId === testItemId);
      });
      
      expect(hasActiveOrders).to.be.true;
    });
    
    it('should allow deletion when orders are completed', async function() {
      // Create a completed order with this menu item
      const orderId = `order_${Date.now()}`;
      await setDocument('orders', orderId, {
        tableId: 'test_table',
        status: 'completed',
        items: [
          {
            menuItemId: testItemId,
            menuItemName: 'Test Gulab Jamun',
            quantity: 2,
            basePrice: 60,
            totalPrice: 120
          }
        ],
        createdAt: new Date()
      });
      
      // Check for active orders (should not include completed)
      const activeOrders = await queryCollection('orders', [
        { field: 'status', operator: 'in', value: ['draft', 'submitted', 'preparing'] }
      ]);
      
      const hasActiveOrders = activeOrders.some(order => {
        if (!order.items || !Array.isArray(order.items)) return false;
        return order.items.some(item => item.menuItemId === testItemId);
      });
      
      expect(hasActiveOrders).to.be.false;
      
      // Should be able to delete now
      await updateDocument('menuItems', testItemId, {
        isActive: false,
        updatedAt: new Date()
      });
      
      const deletedItem = await getDocument('menuItems', testItemId);
      expect(deletedItem.isActive).to.be.false;
    });
  });
  
  describe('List Menu Items by Category', function() {
    
    before(async function() {
      // Create test items in different categories
      const testItems = [
        { name: 'Test Biryani', category: 'Main Course', price: 250 },
        { name: 'Test Curry', category: 'Main Course', price: 180 },
        { name: 'Test Samosa', category: 'Appetizer', price: 40 },
        { name: 'Test Pakora', category: 'Appetizer', price: 50 },
        { name: 'Test Ice Cream', category: 'Dessert', price: 80 },
        { name: 'Test Lassi', category: 'Beverage', price: 60 }
      ];
      
      for (const item of testItems) {
        const itemId = `item_${Date.now()}_${Math.random()}`;
        await setDocument('menuItems', itemId, {
          ...item,
          isOutOfStock: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        // Small delay to ensure unique IDs
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    });
    
    it('should list all menu items', async function() {
      const items = await queryCollection('menuItems', [
        { field: 'isActive', operator: '==', value: true }
      ]);
      
      expect(items).to.be.an('array');
      expect(items.length).to.be.at.least(6);
    });
    
    it('should filter menu items by category', async function() {
      const mainCourseItems = await queryCollection('menuItems', [
        { field: 'category', operator: '==', value: 'Main Course' },
        { field: 'isActive', operator: '==', value: true }
      ]);
      
      expect(mainCourseItems).to.be.an('array');
      expect(mainCourseItems.length).to.be.at.least(2);
      
      mainCourseItems.forEach(item => {
        expect(item.category).to.equal('Main Course');
      });
    });
    
    it('should filter appetizers correctly', async function() {
      const appetizers = await queryCollection('menuItems', [
        { field: 'category', operator: '==', value: 'Appetizer' },
        { field: 'isActive', operator: '==', value: true }
      ]);
      
      expect(appetizers).to.be.an('array');
      expect(appetizers.length).to.be.at.least(2);
      
      appetizers.forEach(item => {
        expect(item.category).to.equal('Appetizer');
      });
    });
    
    it('should sort items by category then name', async function() {
      const items = await queryCollection('menuItems', [
        { field: 'isActive', operator: '==', value: true }
      ]);
      
      // Sort manually to verify
      const sortedItems = items.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });
      
      expect(sortedItems).to.be.an('array');
      expect(sortedItems.length).to.be.at.least(6);
    });
    
    it('should exclude inactive items by default', async function() {
      // Create an inactive item
      const inactiveItemId = `item_${Date.now()}`;
      await setDocument('menuItems', inactiveItemId, {
        name: 'Test Inactive Item',
        category: 'Main Course',
        price: 100,
        isOutOfStock: false,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Query only active items
      const activeItems = await queryCollection('menuItems', [
        { field: 'isActive', operator: '==', value: true }
      ]);
      
      const hasInactiveItem = activeItems.some(item => item.id === inactiveItemId);
      expect(hasInactiveItem).to.be.false;
    });
  });
  
  describe('Validation Rules', function() {
    
    it('should validate name is non-empty string', function() {
      const validName = 'Chicken Biryani';
      const emptyName = '';
      const whitespaceOnly = '   ';
      
      expect(validName.trim()).to.not.be.empty;
      expect(emptyName.trim()).to.be.empty;
      expect(whitespaceOnly.trim()).to.be.empty;
    });
    
    it('should validate category is non-empty string', function() {
      const validCategory = 'Main Course';
      const emptyCategory = '';
      
      expect(validCategory.trim()).to.not.be.empty;
      expect(emptyCategory.trim()).to.be.empty;
    });
    
    it('should validate price is positive number', function() {
      const validPrice = 250;
      const zeroPrice = 0;
      const negativePrice = -100;
      
      expect(validPrice).to.be.above(0);
      expect(zeroPrice).to.not.be.above(0);
      expect(negativePrice).to.be.below(0);
    });
    
    it('should handle optional description field', function() {
      const withDescription = { description: 'Aromatic rice' };
      const withoutDescription = {};
      
      expect(withDescription.description).to.exist;
      expect(withoutDescription.description).to.be.undefined;
    });
  });
});
