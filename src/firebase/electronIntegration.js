/**
 * Firebase Admin SDK Integration for Electron Main Process
 * 
 * This file provides example IPC handlers and integration patterns for using
 * Firebase Admin SDK in the Electron desktop application.
 * 
 * Usage: Import these handlers in your main Electron process file (public/electron.js)
 */

const { ipcMain } = require('electron');
const {
  initializeAdminSDK,
  createCustomToken,
  getDocument,
  setDocument,
  updateDocument,
  deleteDocument,
  queryCollection,
  runTransaction,
  getAdminFirestore
} = require('./init');

/**
 * Initialize Firebase Admin SDK when Electron app starts
 * 
 * Add this to your app.whenReady() handler in public/electron.js:
 * 
 * app.whenReady().then(async () => {
 *   try {
 *     await initializeFirebaseAdmin();
 *     createWindow();
 *   } catch (error) {
 *     console.error('Failed to initialize Firebase Admin:', error);
 *     app.quit();
 *   }
 * });
 */
async function initializeFirebaseAdmin() {
  try {
    console.log('Initializing Firebase Admin SDK for desktop app...');
    await initializeAdminSDK();
    console.log('Firebase Admin SDK initialized successfully');
    
    // Register IPC handlers
    registerWaiterHandlers();
    registerMenuHandlers();
    registerOrderHandlers();
    registerInventoryHandlers();
    
    console.log('Firebase IPC handlers registered');
  } catch (error) {
    console.error('Firebase Admin SDK initialization failed:', error);
    throw error;
  }
}

/**
 * WAITER AUTHENTICATION HANDLERS
 * 
 * These handlers manage waiter authentication using custom tokens.
 * The desktop app validates PINs and generates tokens for mobile apps.
 */
function registerWaiterHandlers() {
  
  // Authenticate waiter with PIN
  ipcMain.handle('firebase:authenticate-waiter', async (event, pin) => {
    try {
      // Validate PIN format
      if (!pin || !/^\d{4,6}$/.test(pin)) {
        return { success: false, error: 'Invalid PIN format' };
      }
      
      // Query Firestore for waiter with matching PIN
      const waiters = await queryCollection('waiters', [
        { field: 'pin', operator: '==', value: pin },
        { field: 'isActive', operator: '==', value: true }
      ]);
      
      if (waiters.length === 0) {
        return { success: false, error: 'Invalid PIN or inactive account' };
      }
      
      const waiter = waiters[0];
      
      // Create custom token for mobile app authentication
      const customToken = await createCustomToken(waiter.id, {
        name: waiter.name,
        role: 'waiter'
      });
      
      return {
        success: true,
        token: customToken,
        waiter: {
          id: waiter.id,
          name: waiter.name,
          pin: waiter.pin
        }
      };
    } catch (error) {
      console.error('Error authenticating waiter:', error);
      return { success: false, error: 'Authentication failed' };
    }
  });
  
  // Create new waiter
  ipcMain.handle('firebase:create-waiter', async (event, waiterData) => {
    try {
      const { name, pin } = waiterData;
      
      // Validate input
      if (!name || !pin || !/^\d{4,6}$/.test(pin)) {
        return { success: false, error: 'Invalid waiter data' };
      }
      
      // Check PIN uniqueness
      const existingWaiters = await queryCollection('waiters', [
        { field: 'pin', operator: '==', value: pin }
      ]);
      
      if (existingWaiters.length > 0) {
        return { success: false, error: 'PIN already in use' };
      }
      
      // Create waiter document
      const waiterId = `waiter_${Date.now()}`;
      await setDocument('waiters', waiterId, {
        name,
        pin,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return {
        success: true,
        waiter: { id: waiterId, name, pin }
      };
    } catch (error) {
      console.error('Error creating waiter:', error);
      return { success: false, error: 'Failed to create waiter' };
    }
  });
  
  // Update waiter PIN
  ipcMain.handle('firebase:update-waiter-pin', async (event, waiterId, newPin) => {
    try {
      // Validate PIN format
      if (!newPin || !/^\d{4,6}$/.test(newPin)) {
        return { success: false, error: 'Invalid PIN format' };
      }
      
      // Check PIN uniqueness
      const existingWaiters = await queryCollection('waiters', [
        { field: 'pin', operator: '==', value: newPin }
      ]);
      
      if (existingWaiters.length > 0 && existingWaiters[0].id !== waiterId) {
        return { success: false, error: 'PIN already in use' };
      }
      
      // Update waiter PIN
      await updateDocument('waiters', waiterId, {
        pin: newPin,
        updatedAt: new Date()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error updating waiter PIN:', error);
      return { success: false, error: 'Failed to update PIN' };
    }
  });
  
  // Get all waiters
  ipcMain.handle('firebase:get-waiters', async () => {
    try {
      const waiters = await queryCollection('waiters', [], {
        orderBy: { field: 'name', direction: 'asc' }
      });
      return { success: true, waiters };
    } catch (error) {
      console.error('Error getting waiters:', error);
      return { success: false, error: 'Failed to get waiters' };
    }
  });
  
  // Deactivate waiter
  ipcMain.handle('firebase:deactivate-waiter', async (event, waiterId) => {
    try {
      await updateDocument('waiters', waiterId, {
        isActive: false,
        updatedAt: new Date()
      });
      return { success: true };
    } catch (error) {
      console.error('Error deactivating waiter:', error);
      return { success: false, error: 'Failed to deactivate waiter' };
    }
  });
}

/**
 * MENU MANAGEMENT HANDLERS
 * 
 * These handlers manage menu items, categories, and modifiers.
 */
function registerMenuHandlers() {
  
  // Create menu item
  ipcMain.handle('firebase:create-menu-item', async (event, itemData) => {
    try {
      const itemId = `item_${Date.now()}`;
      await setDocument('menuItems', itemId, {
        ...itemData,
        isOutOfStock: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { success: true, itemId };
    } catch (error) {
      console.error('Error creating menu item:', error);
      return { success: false, error: 'Failed to create menu item' };
    }
  });
  
  // Update menu item
  ipcMain.handle('firebase:update-menu-item', async (event, itemId, updates) => {
    try {
      await updateDocument('menuItems', itemId, {
        ...updates,
        updatedAt: new Date()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating menu item:', error);
      return { success: false, error: 'Failed to update menu item' };
    }
  });
  
  // Mark item out of stock
  ipcMain.handle('firebase:mark-out-of-stock', async (event, itemId, isOutOfStock) => {
    try {
      await updateDocument('menuItems', itemId, {
        isOutOfStock,
        updatedAt: new Date()
      });
      return { success: true };
    } catch (error) {
      console.error('Error marking item out of stock:', error);
      return { success: false, error: 'Failed to update stock status' };
    }
  });
  
  // Get all menu items
  ipcMain.handle('firebase:get-menu-items', async () => {
    try {
      const items = await queryCollection('menuItems', [], {
        orderBy: { field: 'name', direction: 'asc' }
      });
      return { success: true, items };
    } catch (error) {
      console.error('Error getting menu items:', error);
      return { success: false, error: 'Failed to get menu items' };
    }
  });
}

/**
 * ORDER MANAGEMENT HANDLERS
 * 
 * These handlers manage orders from the desktop app.
 */
function registerOrderHandlers() {
  
  // Create order from desktop
  ipcMain.handle('firebase:create-order', async (event, orderData) => {
    try {
      const orderId = `order_${Date.now()}`;
      await setDocument('orders', orderId, {
        ...orderData,
        createdBy: 'desktop',
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { success: true, orderId };
    } catch (error) {
      console.error('Error creating order:', error);
      return { success: false, error: 'Failed to create order' };
    }
  });
  
  // Submit order (send to kitchen)
  ipcMain.handle('firebase:submit-order', async (event, orderId) => {
    try {
      await updateDocument('orders', orderId, {
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date()
      });
      return { success: true };
    } catch (error) {
      console.error('Error submitting order:', error);
      return { success: false, error: 'Failed to submit order' };
    }
  });
  
  // Get orders for a table
  ipcMain.handle('firebase:get-table-orders', async (event, tableId) => {
    try {
      const orders = await queryCollection('orders', [
        { field: 'tableId', operator: '==', value: tableId },
        { field: 'status', operator: 'in', value: ['draft', 'submitted'] }
      ]);
      return { success: true, orders };
    } catch (error) {
      console.error('Error getting table orders:', error);
      return { success: false, error: 'Failed to get orders' };
    }
  });
}

/**
 * INVENTORY MANAGEMENT HANDLERS
 * 
 * These handlers manage inventory with atomic transactions.
 */
function registerInventoryHandlers() {
  
  // Deduct inventory (atomic transaction)
  ipcMain.handle('firebase:deduct-inventory', async (event, itemId, quantity) => {
    try {
      const firestore = getAdminFirestore();
      
      const result = await runTransaction(async (transaction) => {
        const itemRef = firestore.collection('inventory').doc(itemId);
        const itemDoc = await transaction.get(itemRef);
        
        if (!itemDoc.exists) {
          throw new Error('Item not found');
        }
        
        const currentQuantity = itemDoc.data().quantity || 0;
        
        if (currentQuantity < quantity) {
          throw new Error('Insufficient inventory');
        }
        
        const newQuantity = currentQuantity - quantity;
        
        transaction.update(itemRef, {
          quantity: newQuantity,
          updatedAt: new Date()
        });
        
        // Auto mark out of stock if quantity reaches zero
        if (newQuantity === 0) {
          const menuItemRef = firestore.collection('menuItems').doc(itemId);
          transaction.update(menuItemRef, {
            isOutOfStock: true,
            updatedAt: new Date()
          });
        }
        
        return { newQuantity };
      });
      
      return { success: true, ...result };
    } catch (error) {
      console.error('Error deducting inventory:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Update inventory
  ipcMain.handle('firebase:update-inventory', async (event, itemId, quantity) => {
    try {
      const firestore = getAdminFirestore();
      
      await runTransaction(async (transaction) => {
        const itemRef = firestore.collection('inventory').doc(itemId);
        
        transaction.set(itemRef, {
          quantity,
          updatedAt: new Date()
        }, { merge: true });
        
        // Update out of stock status
        const menuItemRef = firestore.collection('menuItems').doc(itemId);
        transaction.update(menuItemRef, {
          isOutOfStock: quantity === 0,
          updatedAt: new Date()
        });
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error updating inventory:', error);
      return { success: false, error: 'Failed to update inventory' };
    }
  });
}

// Export initialization function
module.exports = {
  initializeFirebaseAdmin
};
