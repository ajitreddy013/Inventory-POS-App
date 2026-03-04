/**
 * Unit Tests for Inventory CRUD Operations
 * 
 * Tests inventory tracking, deduction, auto out-of-stock, and manager-authenticated movements
 */

const {
  initializeAdminSDK,
  setDocument,
  getDocument,
  updateDocument,
  deleteDocument,
  queryCollection,
  runTransaction,
  getAdminFirestore
} = require('../init');

describe('Inventory CRUD Operations', () => {
  let testMenuItemId;
  let testManagerId;

  beforeAll(async () => {
    // Initialize Firebase Admin SDK
    await initializeAdminSDK();
    
    // Create test menu item
    testMenuItemId = `test_item_${Date.now()}`;
    await setDocument('menuItems', testMenuItemId, {
      name: 'Test Beer',
      category: 'Beverages',
      itemCategory: 'drink',
      price: 150,
      isBarItem: true,
      isOutOfStock: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Create test manager
    const bcrypt = require('bcrypt');
    testManagerId = `test_manager_${Date.now()}`;
    const pinHash = await bcrypt.hash('1234', 10);
    await setDocument('managers', testManagerId, {
      name: 'Test Manager',
      pinHash,
      role: 'manager',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await deleteDocument('menuItems', testMenuItemId);
      await deleteDocument('inventory', testMenuItemId);
      await deleteDocument('managers', testManagerId);
      
      // Clean up any inventory movements
      const movements = await queryCollection('inventoryMovements', [
        { field: 'menuItemId', operator: '==', value: testMenuItemId }
      ]);
      
      for (const movement of movements) {
        await deleteDocument('inventoryMovements', movement.id);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Inventory Tracking', () => {
    test('should create inventory record', async () => {
      // Create inventory
      await setDocument('inventory', testMenuItemId, {
        menuItemId: testMenuItemId,
        quantity: 100,
        autoOutOfStock: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Verify creation
      const inventory = await getDocument('inventory', testMenuItemId);
      expect(inventory).toBeDefined();
      expect(inventory.menuItemId).toBe(testMenuItemId);
      expect(inventory.quantity).toBe(100);
      expect(inventory.autoOutOfStock).toBe(true);
    });

    test('should get inventory record', async () => {
      const inventory = await getDocument('inventory', testMenuItemId);
      expect(inventory).toBeDefined();
      expect(inventory.quantity).toBeGreaterThanOrEqual(0);
    });

    test('should update inventory quantity', async () => {
      // Update inventory
      await updateDocument('inventory', testMenuItemId, {
        quantity: 50,
        updatedAt: new Date()
      });
      
      // Verify update
      const inventory = await getDocument('inventory', testMenuItemId);
      expect(inventory.quantity).toBe(50);
    });

    test('should get all inventory records', async () => {
      const inventoryRecords = await queryCollection('inventory', []);
      expect(Array.isArray(inventoryRecords)).toBe(true);
      expect(inventoryRecords.length).toBeGreaterThan(0);
    });
  });

  describe('Inventory Deduction with Transactions', () => {
    beforeEach(async () => {
      // Reset inventory to 50
      await updateDocument('inventory', testMenuItemId, {
        quantity: 50,
        updatedAt: new Date()
      });
      
      await updateDocument('menuItems', testMenuItemId, {
        isOutOfStock: false,
        updatedAt: new Date()
      });
    });

    test('should deduct inventory atomically', async () => {
      const firestore = getAdminFirestore();
      
      // Deduct 10 units
      await runTransaction(async (transaction) => {
        const inventoryRef = firestore.collection('inventory').doc(testMenuItemId);
        const inventoryDoc = await transaction.get(inventoryRef);
        
        const currentQuantity = inventoryDoc.data().quantity;
        const newQuantity = currentQuantity - 10;
        
        transaction.update(inventoryRef, {
          quantity: newQuantity,
          updatedAt: new Date()
        });
      });
      
      // Verify deduction
      const inventory = await getDocument('inventory', testMenuItemId);
      expect(inventory.quantity).toBe(40);
    });

    test('should prevent negative inventory', async () => {
      const firestore = getAdminFirestore();
      
      // Try to deduct more than available
      await expect(async () => {
        await runTransaction(async (transaction) => {
          const inventoryRef = firestore.collection('inventory').doc(testMenuItemId);
          const inventoryDoc = await transaction.get(inventoryRef);
          
          const currentQuantity = inventoryDoc.data().quantity;
          
          if (currentQuantity < 100) {
            throw new Error('Insufficient inventory');
          }
          
          transaction.update(inventoryRef, {
            quantity: currentQuantity - 100,
            updatedAt: new Date()
          });
        });
      }).rejects.toThrow('Insufficient inventory');
      
      // Verify quantity unchanged
      const inventory = await getDocument('inventory', testMenuItemId);
      expect(inventory.quantity).toBe(40); // From previous test
    });

    test('should handle concurrent deductions', async () => {
      const firestore = getAdminFirestore();
      
      // Reset to 100
      await updateDocument('inventory', testMenuItemId, {
        quantity: 100,
        updatedAt: new Date()
      });
      
      // Perform multiple concurrent deductions
      const deductions = [
        runTransaction(async (transaction) => {
          const inventoryRef = firestore.collection('inventory').doc(testMenuItemId);
          const inventoryDoc = await transaction.get(inventoryRef);
          const currentQuantity = inventoryDoc.data().quantity;
          transaction.update(inventoryRef, {
            quantity: currentQuantity - 5,
            updatedAt: new Date()
          });
        }),
        runTransaction(async (transaction) => {
          const inventoryRef = firestore.collection('inventory').doc(testMenuItemId);
          const inventoryDoc = await transaction.get(inventoryRef);
          const currentQuantity = inventoryDoc.data().quantity;
          transaction.update(inventoryRef, {
            quantity: currentQuantity - 10,
            updatedAt: new Date()
          });
        }),
        runTransaction(async (transaction) => {
          const inventoryRef = firestore.collection('inventory').doc(testMenuItemId);
          const inventoryDoc = await transaction.get(inventoryRef);
          const currentQuantity = inventoryDoc.data().quantity;
          transaction.update(inventoryRef, {
            quantity: currentQuantity - 15,
            updatedAt: new Date()
          });
        })
      ];
      
      await Promise.all(deductions);
      
      // Verify final quantity
      const inventory = await getDocument('inventory', testMenuItemId);
      expect(inventory.quantity).toBe(70); // 100 - 5 - 10 - 15
    });
  });

  describe('Auto Out-of-Stock Logic', () => {
    test('should mark item out of stock when inventory reaches zero', async () => {
      const firestore = getAdminFirestore();
      
      // Set inventory to 5
      await updateDocument('inventory', testMenuItemId, {
        quantity: 5,
        updatedAt: new Date()
      });
      
      // Deduct all inventory
      await runTransaction(async (transaction) => {
        const inventoryRef = firestore.collection('inventory').doc(testMenuItemId);
        const menuItemRef = firestore.collection('menuItems').doc(testMenuItemId);
        
        const inventoryDoc = await transaction.get(inventoryRef);
        const currentQuantity = inventoryDoc.data().quantity;
        const newQuantity = currentQuantity - 5;
        
        transaction.update(inventoryRef, {
          quantity: newQuantity,
          updatedAt: new Date()
        });
        
        // Auto mark out of stock
        if (newQuantity === 0) {
          transaction.update(menuItemRef, {
            isOutOfStock: true,
            updatedAt: new Date()
          });
        }
      });
      
      // Verify out of stock status
      const menuItem = await getDocument('menuItems', testMenuItemId);
      expect(menuItem.isOutOfStock).toBe(true);
      
      const inventory = await getDocument('inventory', testMenuItemId);
      expect(inventory.quantity).toBe(0);
    });

    test('should restore in-stock status when inventory updated to positive', async () => {
      const firestore = getAdminFirestore();
      
      // Update inventory to positive
      await runTransaction(async (transaction) => {
        const inventoryRef = firestore.collection('inventory').doc(testMenuItemId);
        const menuItemRef = firestore.collection('menuItems').doc(testMenuItemId);
        
        transaction.update(inventoryRef, {
          quantity: 50,
          updatedAt: new Date()
        });
        
        // Mark as in-stock
        transaction.update(menuItemRef, {
          isOutOfStock: false,
          updatedAt: new Date()
        });
      });
      
      // Verify in-stock status
      const menuItem = await getDocument('menuItems', testMenuItemId);
      expect(menuItem.isOutOfStock).toBe(false);
      
      const inventory = await getDocument('inventory', testMenuItemId);
      expect(inventory.quantity).toBe(50);
    });
  });

  describe('Manual Out-of-Stock Marking', () => {
    test('should manually mark item out of stock', async () => {
      await updateDocument('menuItems', testMenuItemId, {
        isOutOfStock: true,
        manualOutOfStock: true,
        outOfStockReason: 'Quality issue',
        updatedAt: new Date()
      });
      
      const menuItem = await getDocument('menuItems', testMenuItemId);
      expect(menuItem.isOutOfStock).toBe(true);
      expect(menuItem.manualOutOfStock).toBe(true);
      expect(menuItem.outOfStockReason).toBe('Quality issue');
    });

    test('should get out-of-stock items dashboard', async () => {
      const outOfStockItems = await queryCollection('menuItems', [
        { field: 'isOutOfStock', operator: '==', value: true },
        { field: 'isActive', operator: '==', value: true }
      ]);
      
      expect(Array.isArray(outOfStockItems)).toBe(true);
      expect(outOfStockItems.length).toBeGreaterThan(0);
      
      const testItem = outOfStockItems.find(item => item.id === testMenuItemId);
      expect(testItem).toBeDefined();
    });

    test('should restore manual out-of-stock item', async () => {
      await updateDocument('menuItems', testMenuItemId, {
        isOutOfStock: false,
        manualOutOfStock: false,
        outOfStockReason: '',
        updatedAt: new Date()
      });
      
      const menuItem = await getDocument('menuItems', testMenuItemId);
      expect(menuItem.isOutOfStock).toBe(false);
      expect(menuItem.manualOutOfStock).toBe(false);
    });
  });

  describe('Manager-Authenticated Inventory Movements', () => {
    test('should log inventory movement with manager details', async () => {
      const firestore = getAdminFirestore();
      
      // Simulate stock movement
      const movementId = `movement_${Date.now()}`;
      await setDocument('inventoryMovements', movementId, {
        menuItemId: testMenuItemId,
        menuItemName: 'Test Beer',
        movementType: 'godown_to_counter',
        quantity: 50,
        fromLocation: 'godown',
        toLocation: 'counter',
        authorizedBy: testManagerId,
        managerName: 'Test Manager',
        reason: 'Restocking for evening rush',
        timestamp: new Date()
      });
      
      // Verify movement logged
      const movement = await getDocument('inventoryMovements', movementId);
      expect(movement).toBeDefined();
      expect(movement.menuItemId).toBe(testMenuItemId);
      expect(movement.quantity).toBe(50);
      expect(movement.authorizedBy).toBe(testManagerId);
      expect(movement.managerName).toBe('Test Manager');
      expect(movement.reason).toBe('Restocking for evening rush');
      
      // Cleanup
      await deleteDocument('inventoryMovements', movementId);
    });

    test('should get inventory movement history', async () => {
      // Create test movements
      const movementIds = [];
      for (let i = 0; i < 3; i++) {
        const movementId = `movement_${Date.now()}_${i}`;
        movementIds.push(movementId);
        
        await setDocument('inventoryMovements', movementId, {
          menuItemId: testMenuItemId,
          menuItemName: 'Test Beer',
          movementType: 'godown_to_counter',
          quantity: 10 + i,
          fromLocation: 'godown',
          toLocation: 'counter',
          authorizedBy: testManagerId,
          managerName: 'Test Manager',
          reason: `Movement ${i}`,
          timestamp: new Date()
        });
      }
      
      // Get movements
      const movements = await queryCollection('inventoryMovements', [
        { field: 'menuItemId', operator: '==', value: testMenuItemId }
      ]);
      
      expect(Array.isArray(movements)).toBe(true);
      expect(movements.length).toBeGreaterThanOrEqual(3);
      
      // Cleanup
      for (const movementId of movementIds) {
        await deleteDocument('inventoryMovements', movementId);
      }
    });

    test('should filter movements by manager', async () => {
      // Create test movement
      const movementId = `movement_${Date.now()}`;
      await setDocument('inventoryMovements', movementId, {
        menuItemId: testMenuItemId,
        menuItemName: 'Test Beer',
        movementType: 'godown_to_counter',
        quantity: 25,
        fromLocation: 'godown',
        toLocation: 'counter',
        authorizedBy: testManagerId,
        managerName: 'Test Manager',
        reason: 'Test movement',
        timestamp: new Date()
      });
      
      // Get movements by manager
      const movements = await queryCollection('inventoryMovements', [
        { field: 'authorizedBy', operator: '==', value: testManagerId }
      ]);
      
      expect(Array.isArray(movements)).toBe(true);
      expect(movements.length).toBeGreaterThan(0);
      
      // All movements should be by test manager
      for (const movement of movements) {
        expect(movement.authorizedBy).toBe(testManagerId);
      }
      
      // Cleanup
      await deleteDocument('inventoryMovements', movementId);
    });

    test('should update inventory and log movement atomically', async () => {
      const firestore = getAdminFirestore();
      
      // Get current inventory
      const currentInventory = await getDocument('inventory', testMenuItemId);
      const initialQuantity = currentInventory.quantity;
      
      // Perform atomic update
      const movementId = `movement_${Date.now()}`;
      await runTransaction(async (transaction) => {
        const inventoryRef = firestore.collection('inventory').doc(testMenuItemId);
        const menuItemRef = firestore.collection('menuItems').doc(testMenuItemId);
        const movementRef = firestore.collection('inventoryMovements').doc(movementId);
        
        const inventoryDoc = await transaction.get(inventoryRef);
        const currentQty = inventoryDoc.data().quantity;
        const newQty = currentQty + 30;
        
        // Update inventory
        transaction.update(inventoryRef, {
          quantity: newQty,
          updatedAt: new Date()
        });
        
        // Mark in-stock
        transaction.update(menuItemRef, {
          isOutOfStock: false,
          updatedAt: new Date()
        });
        
        // Log movement
        transaction.set(movementRef, {
          menuItemId: testMenuItemId,
          menuItemName: 'Test Beer',
          movementType: 'godown_to_counter',
          quantity: 30,
          fromLocation: 'godown',
          toLocation: 'counter',
          authorizedBy: testManagerId,
          managerName: 'Test Manager',
          reason: 'Atomic test',
          timestamp: new Date()
        });
      });
      
      // Verify inventory updated
      const updatedInventory = await getDocument('inventory', testMenuItemId);
      expect(updatedInventory.quantity).toBe(initialQuantity + 30);
      
      // Verify movement logged
      const movement = await getDocument('inventoryMovements', movementId);
      expect(movement).toBeDefined();
      expect(movement.quantity).toBe(30);
      
      // Cleanup
      await deleteDocument('inventoryMovements', movementId);
    });
  });

  describe('Inventory Movement Export', () => {
    test('should format movements for CSV export', async () => {
      // Create test movements
      const movements = [
        {
          timestamp: new Date(),
          menuItemName: 'Test Beer',
          quantity: 50,
          fromLocation: 'godown',
          toLocation: 'counter',
          managerName: 'Test Manager',
          reason: 'Restocking'
        },
        {
          timestamp: new Date(),
          menuItemName: 'Test Vodka',
          quantity: 30,
          fromLocation: 'godown',
          toLocation: 'counter',
          managerName: 'Test Manager',
          reason: 'Evening rush'
        }
      ];
      
      // Format as CSV
      const headers = ['Date/Time', 'Item', 'Quantity', 'From', 'To', 'Manager', 'Reason'];
      const rows = movements.map(m => [
        new Date(m.timestamp).toLocaleString(),
        m.menuItemName,
        m.quantity,
        m.fromLocation,
        m.toLocation,
        m.managerName,
        m.reason || ''
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      // Verify CSV format
      expect(csvContent).toContain('Date/Time,Item,Quantity');
      expect(csvContent).toContain('Test Beer');
      expect(csvContent).toContain('Test Vodka');
      expect(csvContent).toContain('Restocking');
    });
  });
});
