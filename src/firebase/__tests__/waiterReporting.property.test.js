/**
 * Property-Based Tests for Waiter Performance Reporting
 * 
 * Property 42: Waiter Sales Sum Invariant
 * 
 * **Validates: Requirements 17.5**
 * 
 * For any time period, the sum of total_sales across all waiter reports 
 * should equal the total restaurant sales for that period.
 */

const { initializeAdminSDK, getDocument, setDocument, queryCollection, deleteDocument } = require('../init');

describe('Property-Based Tests: Waiter Performance Reporting', () => {
  let testWaiters = [];
  let testOrders = [];
  let testBills = [];
  let testTables = [];

  beforeAll(async () => {
    await initializeAdminSDK();
  });

  beforeEach(async () => {
    // Clean up test data
    testWaiters = [];
    testOrders = [];
    testBills = [];
    testTables = [];
  });

  afterEach(async () => {
    // Clean up test data
    for (const waiterId of testWaiters) {
      try {
        await deleteDocument('waiters', waiterId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    
    for (const orderId of testOrders) {
      try {
        await deleteDocument('orders', orderId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    
    for (const billId of testBills) {
      try {
        await deleteDocument('bills', billId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
    
    for (const tableId of testTables) {
      try {
        await deleteDocument('tables', tableId);
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  // Helper to generate random integer
  const randomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  // Helper to generate random float
  const randomFloat = (min, max, decimals = 2) => {
    const value = Math.random() * (max - min) + min;
    return parseFloat(value.toFixed(decimals));
  };

  // Helper to generate random string
  const randomString = (length = 10) => {
    return Math.random().toString(36).substring(2, 2 + length);
  };

  // Helper to create test waiter
  const createTestWaiter = async (name) => {
    const waiterId = `test_waiter_${Date.now()}_${randomString(6)}`;
    await setDocument('waiters', waiterId, {
      name: name || `Waiter ${randomString(4)}`,
      pin: randomInt(1000, 9999).toString(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    testWaiters.push(waiterId);
    return waiterId;
  };

  // Helper to create test table
  const createTestTable = async (name) => {
    const tableId = `test_table_${Date.now()}_${randomString(6)}`;
    await setDocument('tables', tableId, {
      name: name || `Table ${randomString(4)}`,
      sectionId: 'test_section',
      status: 'available',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    testTables.push(tableId);
    return tableId;
  };

  // Helper to create test order with bill
  const createTestOrderWithBill = async (waiterId, tableId, billTotal, completedAt) => {
    const orderId = `test_order_${Date.now()}_${randomString(6)}`;
    const billId = `test_bill_${Date.now()}_${randomString(6)}`;
    
    // Create order
    await setDocument('orders', orderId, {
      orderNumber: `ORD-${randomString(6)}`,
      tableId,
      waiterId,
      status: 'completed',
      billId,
      createdAt: new Date(completedAt.getTime() - 3600000), // 1 hour before completion
      completedAt: completedAt,
      updatedAt: completedAt
    });
    testOrders.push(orderId);
    
    // Create bill
    await setDocument('bills', billId, {
      billNumber: `BILL-${randomString(6)}`,
      orderId,
      subtotal: billTotal,
      discountAmount: 0,
      total: billTotal,
      isPending: false,
      payments: [{ type: 'cash', amount: billTotal }],
      createdAt: completedAt,
      updatedAt: completedAt
    });
    testBills.push(billId);
    
    return { orderId, billId };
  };

  describe('Property 42: Waiter Sales Sum Invariant', () => {
    /**
     * **Validates: Requirements 17.5**
     * 
     * For any time period, the sum of total_sales across all waiter reports 
     * should equal the total restaurant sales for that period.
     */
    
    test('Property 42: Sum of waiter sales equals total restaurant sales', async () => {
      // Run multiple iterations
      for (let run = 0; run < 5; run++) {
        // Create test waiters
        const numWaiters = randomInt(2, 5);
        const waiterIds = [];
        
        for (let i = 0; i < numWaiters; i++) {
          const waiterId = await createTestWaiter(`Waiter ${i + 1}`);
          waiterIds.push(waiterId);
        }
        
        // Create test tables
        const tableId = await createTestTable('Test Table');
        
        // Create orders for each waiter in the same time period
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        
        let expectedTotalSales = 0;
        
        for (const waiterId of waiterIds) {
          // Create 1-3 orders per waiter
          const numOrders = randomInt(1, 3);
          
          for (let i = 0; i < numOrders; i++) {
            const billTotal = randomFloat(100, 1000);
            expectedTotalSales += billTotal;
            
            // Random time during the day
            const completedAt = new Date(startOfDay.getTime() + randomInt(0, 86400000));
            
            await createTestOrderWithBill(waiterId, tableId, billTotal, completedAt);
          }
        }
        
        // Wait a bit for Firestore to process
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Query all waiter reports for the day
        const waiterReports = [];
        
        for (const waiterId of waiterIds) {
          const orders = await queryCollection('orders', [
            { field: 'waiterId', operator: '==', value: waiterId },
            { field: 'status', operator: '==', value: 'completed' },
            { field: 'completedAt', operator: '>=', value: startOfDay },
            { field: 'completedAt', operator: '<=', value: now }
          ]);
          
          let waiterSales = 0;
          
          for (const order of orders) {
            if (order.billId) {
              const bill = await getDocument('bills', order.billId);
              if (bill && bill.total) {
                waiterSales += bill.total;
              }
            }
          }
          
          waiterReports.push({
            waiterId,
            totalSales: waiterSales
          });
        }
        
        // Calculate sum of all waiter sales
        const sumOfWaiterSales = waiterReports.reduce((sum, report) => sum + report.totalSales, 0);
        
        // Verify invariant: sum of waiter sales equals total restaurant sales
        const tolerance = 0.01; // Allow small floating point differences
        expect(Math.abs(sumOfWaiterSales - expectedTotalSales)).toBeLessThanOrEqual(tolerance);
        
        // Clean up for next iteration
        for (const waiterId of testWaiters) {
          await deleteDocument('waiters', waiterId);
        }
        for (const orderId of testOrders) {
          await deleteDocument('orders', orderId);
        }
        for (const billId of testBills) {
          await deleteDocument('bills', billId);
        }
        for (const tableId of testTables) {
          await deleteDocument('tables', tableId);
        }
        
        testWaiters = [];
        testOrders = [];
        testBills = [];
        testTables = [];
      }
    }, 60000); // 60 second timeout for multiple iterations

    test('Property 42: Single waiter sales equals total sales', async () => {
      // Create one waiter
      const waiterId = await createTestWaiter('Solo Waiter');
      const tableId = await createTestTable('Test Table');
      
      // Create multiple orders for this waiter
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      
      let expectedTotalSales = 0;
      const numOrders = randomInt(3, 5);
      
      for (let i = 0; i < numOrders; i++) {
        const billTotal = randomFloat(100, 500);
        expectedTotalSales += billTotal;
        
        const completedAt = new Date(startOfDay.getTime() + randomInt(0, 86400000));
        await createTestOrderWithBill(waiterId, tableId, billTotal, completedAt);
      }
      
      // Wait for Firestore
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Query waiter sales
      const orders = await queryCollection('orders', [
        { field: 'waiterId', operator: '==', value: waiterId },
        { field: 'status', operator: '==', value: 'completed' },
        { field: 'completedAt', operator: '>=', value: startOfDay },
        { field: 'completedAt', operator: '<=', value: now }
      ]);
      
      let waiterSales = 0;
      
      for (const order of orders) {
        if (order.billId) {
          const bill = await getDocument('bills', order.billId);
          if (bill && bill.total) {
            waiterSales += bill.total;
          }
        }
      }
      
      // For single waiter, their sales should equal total restaurant sales
      const tolerance = 0.01;
      expect(Math.abs(waiterSales - expectedTotalSales)).toBeLessThanOrEqual(tolerance);
    }, 30000);

    test('Property 42: Zero sales when no orders', async () => {
      // Create waiters but no orders
      const numWaiters = randomInt(2, 4);
      const waiterIds = [];
      
      for (let i = 0; i < numWaiters; i++) {
        const waiterId = await createTestWaiter(`Waiter ${i + 1}`);
        waiterIds.push(waiterId);
      }
      
      // Wait for Firestore
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Query all waiter reports
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      
      let totalSales = 0;
      
      for (const waiterId of waiterIds) {
        const orders = await queryCollection('orders', [
          { field: 'waiterId', operator: '==', value: waiterId },
          { field: 'status', operator: '==', value: 'completed' },
          { field: 'completedAt', operator: '>=', value: startOfDay },
          { field: 'completedAt', operator: '<=', value: now }
        ]);
        
        let waiterSales = 0;
        
        for (const order of orders) {
          if (order.billId) {
            const bill = await getDocument('bills', order.billId);
            if (bill && bill.total) {
              waiterSales += bill.total;
            }
          }
        }
        
        totalSales += waiterSales;
      }
      
      // Total sales should be zero when no orders
      expect(totalSales).toBe(0);
    }, 30000);

    test('Property 42: Sales sum invariant holds for weekly period', async () => {
      // Create waiters
      const numWaiters = randomInt(2, 3);
      const waiterIds = [];
      
      for (let i = 0; i < numWaiters; i++) {
        const waiterId = await createTestWaiter(`Waiter ${i + 1}`);
        waiterIds.push(waiterId);
      }
      
      const tableId = await createTestTable('Test Table');
      
      // Create orders spread across the week
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      let expectedTotalSales = 0;
      
      for (const waiterId of waiterIds) {
        const numOrders = randomInt(1, 2);
        
        for (let i = 0; i < numOrders; i++) {
          const billTotal = randomFloat(100, 500);
          expectedTotalSales += billTotal;
          
          // Random time in the past week
          const completedAt = new Date(weekAgo.getTime() + randomInt(0, 7 * 24 * 60 * 60 * 1000));
          
          await createTestOrderWithBill(waiterId, tableId, billTotal, completedAt);
        }
      }
      
      // Wait for Firestore
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Query all waiter sales for the week
      let sumOfWaiterSales = 0;
      
      for (const waiterId of waiterIds) {
        const orders = await queryCollection('orders', [
          { field: 'waiterId', operator: '==', value: waiterId },
          { field: 'status', operator: '==', value: 'completed' },
          { field: 'completedAt', operator: '>=', value: weekAgo },
          { field: 'completedAt', operator: '<=', value: now }
        ]);
        
        let waiterSales = 0;
        
        for (const order of orders) {
          if (order.billId) {
            const bill = await getDocument('bills', order.billId);
            if (bill && bill.total) {
              waiterSales += bill.total;
            }
          }
        }
        
        sumOfWaiterSales += waiterSales;
      }
      
      // Verify invariant
      const tolerance = 0.01;
      expect(Math.abs(sumOfWaiterSales - expectedTotalSales)).toBeLessThanOrEqual(tolerance);
    }, 30000);

    test('Property 42: Sales sum invariant with mixed order amounts', async () => {
      // Create waiters
      const waiter1 = await createTestWaiter('Waiter 1');
      const waiter2 = await createTestWaiter('Waiter 2');
      const tableId = await createTestTable('Test Table');
      
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      
      // Waiter 1: Small orders
      const smallOrders = [50.00, 75.50, 100.25];
      for (const amount of smallOrders) {
        const completedAt = new Date(startOfDay.getTime() + randomInt(0, 43200000)); // Morning
        await createTestOrderWithBill(waiter1, tableId, amount, completedAt);
      }
      
      // Waiter 2: Large orders
      const largeOrders = [500.00, 750.75, 1000.50];
      for (const amount of largeOrders) {
        const completedAt = new Date(startOfDay.getTime() + randomInt(43200000, 86400000)); // Afternoon
        await createTestOrderWithBill(waiter2, tableId, amount, completedAt);
      }
      
      const expectedTotal = [...smallOrders, ...largeOrders].reduce((sum, amt) => sum + amt, 0);
      
      // Wait for Firestore
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Query both waiters
      let totalSales = 0;
      
      for (const waiterId of [waiter1, waiter2]) {
        const orders = await queryCollection('orders', [
          { field: 'waiterId', operator: '==', value: waiterId },
          { field: 'status', operator: '==', value: 'completed' },
          { field: 'completedAt', operator: '>=', value: startOfDay },
          { field: 'completedAt', operator: '<=', value: now }
        ]);
        
        for (const order of orders) {
          if (order.billId) {
            const bill = await getDocument('bills', order.billId);
            if (bill && bill.total) {
              totalSales += bill.total;
            }
          }
        }
      }
      
      // Verify invariant
      const tolerance = 0.01;
      expect(Math.abs(totalSales - expectedTotal)).toBeLessThanOrEqual(tolerance);
    }, 30000);

    test('Property 42: Invariant holds regardless of waiter count', async () => {
      // Test with different numbers of waiters
      for (const numWaiters of [1, 2, 5]) {
        const waiterIds = [];
        
        for (let i = 0; i < numWaiters; i++) {
          const waiterId = await createTestWaiter(`Waiter ${i + 1}`);
          waiterIds.push(waiterId);
        }
        
        const tableId = await createTestTable('Test Table');
        
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        
        let expectedTotal = 0;
        
        // Each waiter gets one order
        for (const waiterId of waiterIds) {
          const amount = randomFloat(100, 500);
          expectedTotal += amount;
          
          const completedAt = new Date(startOfDay.getTime() + randomInt(0, 86400000));
          await createTestOrderWithBill(waiterId, tableId, amount, completedAt);
        }
        
        // Wait for Firestore
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Calculate total
        let totalSales = 0;
        
        for (const waiterId of waiterIds) {
          const orders = await queryCollection('orders', [
            { field: 'waiterId', operator: '==', value: waiterId },
            { field: 'status', operator: '==', value: 'completed' },
            { field: 'completedAt', operator: '>=', value: startOfDay },
            { field: 'completedAt', operator: '<=', value: now }
          ]);
          
          for (const order of orders) {
            if (order.billId) {
              const bill = await getDocument('bills', order.billId);
              if (bill && bill.total) {
                totalSales += bill.total;
              }
            }
          }
        }
        
        // Verify invariant
        const tolerance = 0.01;
        expect(Math.abs(totalSales - expectedTotal)).toBeLessThanOrEqual(tolerance);
        
        // Clean up for next iteration
        for (const waiterId of testWaiters) {
          await deleteDocument('waiters', waiterId);
        }
        for (const orderId of testOrders) {
          await deleteDocument('orders', orderId);
        }
        for (const billId of testBills) {
          await deleteDocument('bills', billId);
        }
        for (const tableId of testTables) {
          await deleteDocument('tables', tableId);
        }
        
        testWaiters = [];
        testOrders = [];
        testBills = [];
        testTables = [];
      }
    }, 60000);
  });
});
