/**
 * Firebase Admin SDK Integration for Electron Main Process
 * 
 * This file provides example IPC handlers and integration patterns for using
 * Firebase Admin SDK in the Electron desktop application.
 * 
 * Usage: Import these handlers in your main Electron process file (public/electron.js)
 */

const { ipcMain } = require('electron');
const bcrypt = require('bcrypt');
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
    registerManagerHandlers();
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
  ipcMain.handle('firebase:deactivate-waiter', async (event, waiterId, isActive = false) => {
    try {
      await updateDocument('waiters', waiterId, {
        isActive,
        updatedAt: new Date()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating waiter status:', error);
      return { success: false, error: 'Failed to update waiter status' };
    }
  });
}

/**
 * MANAGER AUTHENTICATION HANDLERS
 * 
 * These handlers manage manager accounts with bcrypt-hashed PINs.
 * Managers have elevated privileges for sensitive operations.
 */
function registerManagerHandlers() {
  const SALT_ROUNDS = 10;
  
  // Create new manager
  ipcMain.handle('firebase:create-manager', async (event, managerData) => {
    try {
      const { name, pin, role } = managerData;
      
      // Validate input
      if (!name || !pin || !role) {
        return { success: false, error: 'All fields are required' };
      }
      
      // Validate PIN format (4-6 digits)
      if (!/^\d{4,6}$/.test(pin)) {
        return { success: false, error: 'PIN must be 4-6 digits' };
      }
      
      // Validate role
      const validRoles = ['owner', 'manager', 'supervisor'];
      if (!validRoles.includes(role)) {
        return { success: false, error: 'Invalid role' };
      }
      
      // Hash PIN with bcrypt
      const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);
      
      // Create manager document
      const managerId = `manager_${Date.now()}`;
      await setDocument('managers', managerId, {
        name,
        pinHash,
        role,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return {
        success: true,
        manager: { id: managerId, name, role }
      };
    } catch (error) {
      console.error('Error creating manager:', error);
      return { success: false, error: 'Failed to create manager' };
    }
  });
  
  // Update manager details
  ipcMain.handle('firebase:update-manager', async (event, managerId, updates) => {
    try {
      const { name, role } = updates;
      
      // Validate role if provided
      if (role) {
        const validRoles = ['owner', 'manager', 'supervisor'];
        if (!validRoles.includes(role)) {
          return { success: false, error: 'Invalid role' };
        }
      }
      
      // Update manager document
      const updateData = {
        updatedAt: new Date()
      };
      
      if (name) updateData.name = name;
      if (role) updateData.role = role;
      
      await updateDocument('managers', managerId, updateData);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating manager:', error);
      return { success: false, error: 'Failed to update manager' };
    }
  });
  
  // Change manager's own PIN
  ipcMain.handle('firebase:change-manager-pin', async (event, managerId, oldPin, newPin) => {
    try {
      // Validate new PIN format
      if (!newPin || !/^\d{4,6}$/.test(newPin)) {
        return { success: false, error: 'New PIN must be 4-6 digits' };
      }
      
      // Get manager document
      const manager = await getDocument('managers', managerId);
      
      if (!manager) {
        return { success: false, error: 'Manager not found' };
      }
      
      // Verify old PIN
      const isOldPinValid = await bcrypt.compare(oldPin, manager.pinHash);
      
      if (!isOldPinValid) {
        return { success: false, error: 'Current PIN is incorrect' };
      }
      
      // Hash and update new PIN
      const newPinHash = await bcrypt.hash(newPin, SALT_ROUNDS);
      await updateDocument('managers', managerId, {
        pinHash: newPinHash,
        updatedAt: new Date()
      });
      
      return { success: true, message: 'PIN updated successfully' };
    } catch (error) {
      console.error('Error changing manager PIN:', error);
      return { success: false, error: 'Failed to change PIN' };
    }
  });
  
  // Get all managers
  ipcMain.handle('firebase:get-managers', async () => {
    try {
      const managers = await queryCollection('managers', [], {
        orderBy: { field: 'name', direction: 'asc' }
      });
      
      // Remove pinHash from response for security
      const sanitizedManagers = managers.map(({ pinHash, ...manager }) => manager);
      
      return { success: true, managers: sanitizedManagers };
    } catch (error) {
      console.error('Error getting managers:', error);
      return { success: false, error: 'Failed to get managers' };
    }
  });
  
  // Deactivate/reactivate manager
  ipcMain.handle('firebase:deactivate-manager', async (event, managerId, isActive = false) => {
    try {
      await updateDocument('managers', managerId, {
        isActive,
        updatedAt: new Date()
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating manager status:', error);
      return { success: false, error: 'Failed to update manager status' };
    }
  });
  
  // Authenticate manager with PIN (for protected operations)
  ipcMain.handle('firebase:authenticate-manager', async (event, pin) => {
    try {
      // Validate PIN format
      if (!pin || !/^\d{4,6}$/.test(pin)) {
        return { success: false, error: 'Invalid PIN format' };
      }
      
      // Get all active managers
      const managers = await queryCollection('managers', [
        { field: 'isActive', operator: '==', value: true }
      ]);
      
      // Check PIN against all managers
      for (const manager of managers) {
        const isMatch = await bcrypt.compare(pin, manager.pinHash);
        if (isMatch) {
          return {
            success: true,
            manager: {
              id: manager.id,
              name: manager.name,
              role: manager.role
            }
          };
        }
      }
      
      return { success: false, error: 'Invalid PIN' };
    } catch (error) {
      console.error('Error authenticating manager:', error);
      return { success: false, error: 'Authentication failed' };
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
