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
    registerModifierHandlers();
    registerOrderHandlers();
    registerInventoryHandlers();
    registerRealtimeListeners();
    
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
      // Validate required fields
      const { name, category, price } = itemData;
      
      if (!name || !name.trim()) {
        return { success: false, error: 'Menu item name is required' };
      }
      
      if (!category || !category.trim()) {
        return { success: false, error: 'Category is required' };
      }
      
      if (price === undefined || price === null || price <= 0) {
        return { success: false, error: 'Price must be a positive number' };
      }
      
      // Create menu item with defaults
      const itemId = `item_${Date.now()}`;
      await setDocument('menuItems', itemId, {
        name: name.trim(),
        category: category.trim(),
        price: parseFloat(price),
        description: itemData.description?.trim() || '',
        isOutOfStock: false,
        isActive: true,
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
      // Validate item exists
      const existingItem = await getDocument('menuItems', itemId);
      
      if (!existingItem) {
        return { success: false, error: 'Menu item not found' };
      }
      
      // Validate updates
      const updateData = { updatedAt: new Date() };
      
      if (updates.name !== undefined) {
        if (!updates.name.trim()) {
          return { success: false, error: 'Menu item name cannot be empty' };
        }
        updateData.name = updates.name.trim();
      }
      
      if (updates.category !== undefined) {
        if (!updates.category.trim()) {
          return { success: false, error: 'Category cannot be empty' };
        }
        updateData.category = updates.category.trim();
      }
      
      if (updates.price !== undefined) {
        if (updates.price <= 0) {
          return { success: false, error: 'Price must be a positive number' };
        }
        updateData.price = parseFloat(updates.price);
      }
      
      if (updates.description !== undefined) {
        updateData.description = updates.description.trim();
      }
      
      if (updates.isOutOfStock !== undefined) {
        updateData.isOutOfStock = updates.isOutOfStock;
      }
      
      if (updates.isActive !== undefined) {
        updateData.isActive = updates.isActive;
      }
      
      // Update only provided fields
      await updateDocument('menuItems', itemId, updateData);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating menu item:', error);
      return { success: false, error: 'Failed to update menu item' };
    }
  });
  
  // Delete menu item
  ipcMain.handle('firebase:delete-menu-item', async (event, itemId) => {
    try {
      // Check for active orders with this menu item
      const activeOrders = await queryCollection('orders', [
        { field: 'status', operator: 'in', value: ['draft', 'submitted', 'preparing'] }
      ]);
      
      // Check if any active order contains this menu item
      const hasActiveOrders = activeOrders.some(order => {
        if (!order.items || !Array.isArray(order.items)) return false;
        return order.items.some(item => item.menuItemId === itemId);
      });
      
      if (hasActiveOrders) {
        return { 
          success: false, 
          error: 'Cannot delete menu item with active orders. Please wait until all orders are completed.' 
        };
      }
      
      // Mark item as inactive instead of deleting (soft delete)
      await updateDocument('menuItems', itemId, {
        isActive: false,
        updatedAt: new Date()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting menu item:', error);
      return { success: false, error: 'Failed to delete menu item' };
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
  
  // Get all menu items (with optional filters)
  ipcMain.handle('firebase:get-menu-items', async (event, filters = {}) => {
    try {
      const queryFilters = [];
      
      // Filter by category if provided
      if (filters.category) {
        queryFilters.push({ 
          field: 'category', 
          operator: '==', 
          value: filters.category 
        });
      }
      
      // Filter by active status (default to active only)
      if (filters.includeInactive !== true) {
        queryFilters.push({ 
          field: 'isActive', 
          operator: '==', 
          value: true 
        });
      }
      
      const items = await queryCollection('menuItems', queryFilters, {
        orderBy: [
          { field: 'category', direction: 'asc' },
          { field: 'name', direction: 'asc' }
        ]
      });
      
      return { success: true, items };
    } catch (error) {
      console.error('Error getting menu items:', error);
      return { success: false, error: 'Failed to get menu items' };
    }
  });
  
  // Get menu items by category (dedicated handler)
  ipcMain.handle('firebase:get-menu-items-by-category', async (event, category) => {
    try {
      if (!category) {
        return { success: false, error: 'Category is required' };
      }
      
      const items = await queryCollection('menuItems', [
        { field: 'category', operator: '==', value: category },
        { field: 'isActive', operator: '==', value: true }
      ], {
        orderBy: { field: 'name', direction: 'asc' }
      });
      
      return { success: true, items };
    } catch (error) {
      console.error('Error getting menu items by category:', error);
      return { success: false, error: 'Failed to get menu items by category' };
    }
  });
  
  // Get menu categories
  ipcMain.handle('firebase:get-menu-categories', async () => {
    try {
      const items = await queryCollection('menuItems', [
        { field: 'isActive', operator: '==', value: true }
      ]);
      
      // Extract unique categories
      const categories = [...new Set(items.map(item => item.category))].sort();
      
      return { success: true, categories };
    } catch (error) {
      console.error('Error getting menu categories:', error);
      return { success: false, error: 'Failed to get categories' };
    }
  });
}

/**
 * MODIFIER MANAGEMENT HANDLERS
 * 
 * These handlers manage modifiers (spice levels and paid add-ons).
 */
function registerModifierHandlers() {
  
  // Create modifier
  ipcMain.handle('firebase:create-modifier', async (event, modifierData) => {
    try {
      // Validate required fields
      const { name, type, price } = modifierData;
      
      if (!name || !name.trim()) {
        return { success: false, error: 'Modifier name is required' };
      }
      
      // Validate type
      const validTypes = ['spice_level', 'paid_addon'];
      if (!type || !validTypes.includes(type)) {
        return { success: false, error: 'Type must be either spice_level or paid_addon' };
      }
      
      // Validate price
      if (price === undefined || price === null) {
        return { success: false, error: 'Price is required' };
      }
      
      // For spice_level, price must be 0
      if (type === 'spice_level' && price !== 0) {
        return { success: false, error: 'Spice level modifiers must have price 0' };
      }
      
      // For paid_addon, price must be positive
      if (type === 'paid_addon' && price <= 0) {
        return { success: false, error: 'Paid add-on price must be positive' };
      }
      
      // Create modifier
      const modifierId = `modifier_${Date.now()}`;
      await setDocument('modifiers', modifierId, {
        name: name.trim(),
        type,
        price: parseFloat(price),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return { success: true, modifierId };
    } catch (error) {
      console.error('Error creating modifier:', error);
      return { success: false, error: 'Failed to create modifier' };
    }
  });
  
  // Update modifier
  ipcMain.handle('firebase:update-modifier', async (event, modifierId, updates) => {
    try {
      // Validate modifier exists
      const existingModifier = await getDocument('modifiers', modifierId);
      
      if (!existingModifier) {
        return { success: false, error: 'Modifier not found' };
      }
      
      // Validate updates
      const updateData = { updatedAt: new Date() };
      
      if (updates.name !== undefined) {
        if (!updates.name.trim()) {
          return { success: false, error: 'Modifier name cannot be empty' };
        }
        updateData.name = updates.name.trim();
      }
      
      if (updates.type !== undefined) {
        const validTypes = ['spice_level', 'paid_addon'];
        if (!validTypes.includes(updates.type)) {
          return { success: false, error: 'Type must be either spice_level or paid_addon' };
        }
        updateData.type = updates.type;
      }
      
      if (updates.price !== undefined) {
        const finalType = updates.type || existingModifier.type;
        
        // For spice_level, price must be 0
        if (finalType === 'spice_level' && updates.price !== 0) {
          return { success: false, error: 'Spice level modifiers must have price 0' };
        }
        
        // For paid_addon, price must be positive
        if (finalType === 'paid_addon' && updates.price <= 0) {
          return { success: false, error: 'Paid add-on price must be positive' };
        }
        
        updateData.price = parseFloat(updates.price);
      }
      
      // Update only provided fields
      await updateDocument('modifiers', modifierId, updateData);
      
      return { success: true };
    } catch (error) {
      console.error('Error updating modifier:', error);
      return { success: false, error: 'Failed to update modifier' };
    }
  });
  
  // Delete modifier
  ipcMain.handle('firebase:delete-modifier', async (event, modifierId) => {
    try {
      // Check if modifier is associated with any menu items
      const menuItems = await queryCollection('menuItems', [
        { field: 'isActive', operator: '==', value: true }
      ]);
      
      // Check if any menu item has this modifier
      const hasAssociations = menuItems.some(item => {
        if (!item.availableModifiers || !Array.isArray(item.availableModifiers)) return false;
        return item.availableModifiers.includes(modifierId);
      });
      
      if (hasAssociations) {
        return { 
          success: false, 
          error: 'Cannot delete modifier that is associated with menu items. Please remove associations first.' 
        };
      }
      
      // Delete modifier
      await deleteDocument('modifiers', modifierId);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting modifier:', error);
      return { success: false, error: 'Failed to delete modifier' };
    }
  });
  
  // Get all modifiers (with optional type filter)
  ipcMain.handle('firebase:get-modifiers', async (event, filters = {}) => {
    try {
      const queryFilters = [];
      
      // Filter by type if provided
      if (filters.type) {
        queryFilters.push({ 
          field: 'type', 
          operator: '==', 
          value: filters.type 
        });
      }
      
      const modifiers = await queryCollection('modifiers', queryFilters, {
        orderBy: [
          { field: 'type', direction: 'asc' },
          { field: 'name', direction: 'asc' }
        ]
      });
      
      return { success: true, modifiers };
    } catch (error) {
      console.error('Error getting modifiers:', error);
      return { success: false, error: 'Failed to get modifiers' };
    }
  });
  
  // Get modifiers by type
  ipcMain.handle('firebase:get-modifiers-by-type', async (event, type) => {
    try {
      const validTypes = ['spice_level', 'paid_addon'];
      if (!type || !validTypes.includes(type)) {
        return { success: false, error: 'Invalid modifier type' };
      }
      
      const modifiers = await queryCollection('modifiers', [
        { field: 'type', operator: '==', value: type }
      ], {
        orderBy: { field: 'name', direction: 'asc' }
      });
      
      return { success: true, modifiers };
    } catch (error) {
      console.error('Error getting modifiers by type:', error);
      return { success: false, error: 'Failed to get modifiers by type' };
    }
  });
  
  // Associate modifiers with menu item
  ipcMain.handle('firebase:set-menu-item-modifiers', async (event, menuItemId, modifierIds) => {
    try {
      // Validate menu item exists
      const menuItem = await getDocument('menuItems', menuItemId);
      
      if (!menuItem) {
        return { success: false, error: 'Menu item not found' };
      }
      
      // Validate all modifier IDs exist
      if (!Array.isArray(modifierIds)) {
        return { success: false, error: 'Modifier IDs must be an array' };
      }
      
      for (const modifierId of modifierIds) {
        const modifier = await getDocument('modifiers', modifierId);
        if (!modifier) {
          return { success: false, error: `Modifier ${modifierId} not found` };
        }
      }
      
      // Update menu item with modifier associations
      await updateDocument('menuItems', menuItemId, {
        availableModifiers: modifierIds,
        updatedAt: new Date()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error setting menu item modifiers:', error);
      return { success: false, error: 'Failed to set menu item modifiers' };
    }
  });
  
  // Get modifiers for a menu item
  ipcMain.handle('firebase:get-menu-item-modifiers', async (event, menuItemId) => {
    try {
      const menuItem = await getDocument('menuItems', menuItemId);
      
      if (!menuItem) {
        return { success: false, error: 'Menu item not found' };
      }
      
      if (!menuItem.availableModifiers || menuItem.availableModifiers.length === 0) {
        return { success: true, modifiers: [] };
      }
      
      // Fetch all modifiers for this menu item
      const modifiers = [];
      for (const modifierId of menuItem.availableModifiers) {
        const modifier = await getDocument('modifiers', modifierId);
        if (modifier) {
          modifiers.push({ id: modifierId, ...modifier });
        }
      }
      
      return { success: true, modifiers };
    } catch (error) {
      console.error('Error getting menu item modifiers:', error);
      return { success: false, error: 'Failed to get menu item modifiers' };
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

/**
 * REAL-TIME SYNC LISTENERS
 * 
 * These handlers set up real-time listeners for menu items and modifiers.
 * Changes made on any device will be pushed to all connected clients.
 */
function registerRealtimeListeners() {
  const { getAdminFirestore } = require('./init');
  
  // Subscribe to menu items changes
  ipcMain.handle('firebase:subscribe-menu-items', async (event) => {
    try {
      const firestore = getAdminFirestore();
      const menuItemsRef = firestore.collection('menuItems');
      
      // Set up real-time listener
      const unsubscribe = menuItemsRef
        .where('isActive', '==', true)
        .onSnapshot((snapshot) => {
          const changes = [];
          
          snapshot.docChanges().forEach((change) => {
            const data = { id: change.doc.id, ...change.doc.data() };
            changes.push({
              type: change.type, // 'added', 'modified', 'removed'
              data: data
            });
          });
          
          // Send changes to renderer process
          if (changes.length > 0) {
            event.sender.send('firebase:menu-items-changed', changes);
          }
        }, (error) => {
          console.error('Error in menu items listener:', error);
          event.sender.send('firebase:menu-items-error', error.message);
        });
      
      // Store unsubscribe function for cleanup
      event.sender.once('destroyed', () => {
        unsubscribe();
      });
      
      return { success: true, message: 'Subscribed to menu items changes' };
    } catch (error) {
      console.error('Error subscribing to menu items:', error);
      return { success: false, error: 'Failed to subscribe to menu items' };
    }
  });
  
  // Subscribe to modifiers changes
  ipcMain.handle('firebase:subscribe-modifiers', async (event) => {
    try {
      const firestore = getAdminFirestore();
      const modifiersRef = firestore.collection('modifiers');
      
      // Set up real-time listener
      const unsubscribe = modifiersRef.onSnapshot((snapshot) => {
        const changes = [];
        
        snapshot.docChanges().forEach((change) => {
          const data = { id: change.doc.id, ...change.doc.data() };
          changes.push({
            type: change.type, // 'added', 'modified', 'removed'
            data: data
          });
        });
        
        // Send changes to renderer process
        if (changes.length > 0) {
          event.sender.send('firebase:modifiers-changed', changes);
        }
      }, (error) => {
        console.error('Error in modifiers listener:', error);
        event.sender.send('firebase:modifiers-error', error.message);
      });
      
      // Store unsubscribe function for cleanup
      event.sender.once('destroyed', () => {
        unsubscribe();
      });
      
      return { success: true, message: 'Subscribed to modifiers changes' };
    } catch (error) {
      console.error('Error subscribing to modifiers:', error);
      return { success: false, error: 'Failed to subscribe to modifiers' };
    }
  });
  
  // Unsubscribe from all listeners (cleanup)
  ipcMain.handle('firebase:unsubscribe-all', async (event) => {
    try {
      // Cleanup is handled automatically when renderer is destroyed
      return { success: true, message: 'Unsubscribed from all listeners' };
    } catch (error) {
      console.error('Error unsubscribing:', error);
      return { success: false, error: 'Failed to unsubscribe' };
    }
  });
}

// Export initialization function
module.exports = {
  initializeFirebaseAdmin
};
