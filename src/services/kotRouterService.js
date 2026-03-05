/**
 * KOT Router Service
 * 
 * Routes order items to appropriate printers (kitchen/bar) based on item category.
 * Generates KOTs with metadata and handles incremental orders.
 * 
 * Requirements: 7.1-7.5, 8.1-8.7, 9.1, 9.2, 9.5
 */

const { getAdminFirestore } = require('../firebase/init');
const { v4: uuidv4 } = require('uuid');

class KOTRouterService {
  constructor(printerService) {
    this.printerService = printerService;
    this.db = null;
  }

  /**
   * Initialize the KOT Router with Firestore connection
   */
  async initialize() {
    try {
      this.db = getAdminFirestore();
      console.log('KOT Router Service initialized');
    } catch (error) {
      console.error('Failed to initialize KOT Router:', error);
      throw error;
    }
  }

  /**
   * Route order items to appropriate printers
   * 
   * @param {Object} order - Order object with items
   * @param {Array} newItems - New or modified order items
   * @returns {Promise<Object>} Routing result with KOTs and errors
   * 
   * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
   */
  async routeOrder(order, newItems) {
    try {
      if (!order || !newItems || newItems.length === 0) {
        return {
          success: false,
          errors: ['Invalid order or no items to route']
        };
      }

      // Separate items by category
      const foodItems = newItems.filter(item => item.category === 'food');
      const drinkItems = newItems.filter(item => item.category === 'drink');

      const result = {
        success: true,
        kitchenKOT: null,
        barKOT: null,
        errors: []
      };

      // Generate and send kitchen KOT if there are food items
      if (foodItems.length > 0) {
        try {
          const kitchenKOT = await this.generateKOT(foodItems, {
            orderNumber: order.orderNumber || order.id,
            tableNumber: order.tableNumber || order.tableName || 'N/A',
            waiterName: order.waiterName || 'Desktop',
            timestamp: new Date()
          }, 'kitchen');

          await this.sendToPrinter(kitchenKOT, 'kitchen');
          result.kitchenKOT = kitchenKOT;

          // Mark items as sent to kitchen
          await this.markItemsAsSent(order.id, foodItems.map(i => i.id));
        } catch (error) {
          result.errors.push(`Kitchen printer error: ${error.message}`);
          result.success = false;
        }
      }

      // Generate and send bar KOT if there are drink items
      if (drinkItems.length > 0) {
        try {
          const barKOT = await this.generateKOT(drinkItems, {
            orderNumber: order.orderNumber || order.id,
            tableNumber: order.tableNumber || order.tableName || 'N/A',
            waiterName: order.waiterName || 'Desktop',
            timestamp: new Date()
          }, 'bar');

          await this.sendToPrinter(barKOT, 'bar');
          result.barKOT = barKOT;

          // Mark items as sent to kitchen
          await this.markItemsAsSent(order.id, drinkItems.map(i => i.id));
        } catch (error) {
          result.errors.push(`Bar printer error: ${error.message}`);
          result.success = false;
        }
      }

      return result;
    } catch (error) {
      console.error('Error routing order:', error);
      return {
        success: false,
        errors: [`Routing failed: ${error.message}`]
      };
    }
  }

  /**
   * Generate KOT with metadata and formatted items
   * 
   * @param {Array} items - Order items to include in KOT
   * @param {Object} metadata - KOT metadata (order number, table, waiter, timestamp)
   * @param {string} printerType - 'kitchen' or 'bar'
   * @returns {Promise<Object>} Generated KOT object
   * 
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
   */
  async generateKOT(items, metadata, printerType) {
    const kotId = uuidv4();
    const kotNumber = `KOT-${Date.now()}`;

    // Format timestamp as HH:MM
    const timestamp = new Date(metadata.timestamp);
    const hours = timestamp.getHours().toString().padStart(2, '0');
    const minutes = timestamp.getMinutes().toString().padStart(2, '0');
    const formattedTime = `${hours}:${minutes}`;

    // Format items with quantities and modifiers
    const kotItems = items.map(item => ({
      orderItemId: item.id,
      name: item.menuItemName || item.name,
      quantity: item.quantity,
      modifiers: this.formatModifiers(item.modifiers || []),
      isIncremental: item.isIncremental || false
    }));

    const kot = {
      id: kotId,
      kotNumber,
      orderNumber: metadata.orderNumber,
      tableNumber: metadata.tableNumber,
      waiterName: metadata.waiterName,
      items: kotItems,
      timestamp: formattedTime,
      printerType,
      createdAt: new Date()
    };

    // Store KOT record in Firestore
    await this.saveKOTRecord(kot);

    return kot;
  }

  /**
   * Format modifiers for display on KOT
   * 
   * @param {Array} modifiers - Array of modifier objects
   * @returns {string} Formatted modifier string
   */
  formatModifiers(modifiers) {
    if (!modifiers || modifiers.length === 0) {
      return '';
    }

    return modifiers.map(m => m.name).join(', ');
  }

  /**
   * Send KOT to printer
   * 
   * @param {Object} kot - KOT object to print
   * @param {string} printerType - 'kitchen' or 'bar'
   * @returns {Promise<void>}
   * 
   * Requirements: 7.1
   */
  async sendToPrinter(kot, printerType) {
    if (!this.printerService) {
      console.warn('Printer service not available, logging KOT to console');
      this.logKOTToConsole(kot);
      return;
    }

    try {
      // Use the new thermal printer driver
      const result = await this.printerService.printKOT(kot, printerType);
      
      if (!result.success) {
        if (result.queued) {
          console.log(`KOT ${kot.kotNumber} queued for retry`);
          // Don't throw - queued for automatic retry
          return;
        }
        throw new Error(result.error || 'Print failed');
      }

      console.log(`KOT ${kot.kotNumber} printed successfully to ${printerType} printer`);
    } catch (error) {
      console.error(`Error printing KOT to ${printerType}:`, error);
      
      // Store failed KOT for retry (fallback if driver doesn't queue)
      await this.storeFailedKOT(kot, printerType, error.message);
      
      throw error;
    }
  }

  /**
   * Format KOT for thermal printer
   * 
   * @param {Object} kot - KOT object
   * @returns {Object} Formatted KOT data for printer
   */
  formatKOTForPrinter(kot) {
    return {
      header: `${kot.printerType.toUpperCase()} ORDER`,
      orderNumber: kot.orderNumber,
      kotNumber: kot.kotNumber,
      tableNumber: kot.tableNumber,
      waiterName: kot.waiterName,
      timestamp: kot.timestamp,
      items: kot.items.map(item => ({
        quantity: item.isIncremental ? `+${item.quantity}` : item.quantity,
        name: item.name,
        modifiers: item.modifiers
      }))
    };
  }

  /**
   * Log KOT to console (fallback when printer unavailable)
   * 
   * @param {Object} kot - KOT object
   */
  logKOTToConsole(kot) {
    console.log('\n=== KOT OUTPUT ===');
    console.log(`${kot.printerType.toUpperCase()} ORDER`);
    console.log('================================');
    console.log(`Order #: ${kot.orderNumber}`);
    console.log(`KOT #: ${kot.kotNumber}`);
    console.log(`Table: ${kot.tableNumber}`);
    console.log(`Waiter: ${kot.waiterName}`);
    console.log(`Time: ${kot.timestamp}`);
    console.log('================================\n');
    
    kot.items.forEach(item => {
      const qtyPrefix = item.isIncremental ? '+' : '';
      console.log(`${qtyPrefix}${item.quantity}x ${item.name}`);
      if (item.modifiers) {
        console.log(`   ${item.modifiers}`);
      }
    });
    
    console.log('\n================================');
    console.log('=== END KOT OUTPUT ===\n');
  }

  /**
   * Mark order items as sent to kitchen
   * 
   * @param {string} orderId - Order ID
   * @param {Array} itemIds - Array of order item IDs
   * @returns {Promise<void>}
   */
  async markItemsAsSent(orderId, itemIds) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    try {
      const batch = this.db.batch();

      for (const itemId of itemIds) {
        const itemRef = this.db
          .collection('orders')
          .doc(orderId)
          .collection('items')
          .doc(itemId);

        batch.update(itemRef, {
          sentToKitchen: true,
          sentAt: new Date()
        });
      }

      await batch.commit();
      console.log(`Marked ${itemIds.length} items as sent for order ${orderId}`);
    } catch (error) {
      console.error('Error marking items as sent:', error);
      throw error;
    }
  }

  /**
   * Save KOT record to Firestore
   * 
   * @param {Object} kot - KOT object
   * @returns {Promise<void>}
   * 
   * Requirements: 8.7
   */
  async saveKOTRecord(kot) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    try {
      await this.db.collection('kots').doc(kot.id).set({
        kotNumber: kot.kotNumber,
        orderId: kot.orderNumber,
        printerType: kot.printerType,
        items: kot.items.map(item => ({
          orderItemId: item.orderItemId,
          itemName: item.name,
          quantity: item.quantity,
          modifiers: item.modifiers,
          isIncremental: item.isIncremental
        })),
        printedAt: kot.createdAt,
        printStatus: 'printed'
      });

      console.log(`KOT record saved: ${kot.kotNumber}`);
    } catch (error) {
      console.error('Error saving KOT record:', error);
      throw error;
    }
  }

  /**
   * Store failed KOT for manual retry
   * 
   * @param {Object} kot - KOT object
   * @param {string} printerType - 'kitchen' or 'bar'
   * @param {string} errorMessage - Error message
   * @returns {Promise<void>}
   */
  async storeFailedKOT(kot, printerType, errorMessage) {
    if (!this.db) {
      console.error('Cannot store failed KOT: Firestore not initialized');
      return;
    }

    try {
      await this.db.collection('failedKOTs').add({
        kotId: kot.id,
        kotNumber: kot.kotNumber,
        kotData: kot,
        printerType,
        errorMessage,
        retryCount: 0,
        createdAt: new Date()
      });

      console.log(`Failed KOT stored for retry: ${kot.kotNumber}`);
    } catch (error) {
      console.error('Error storing failed KOT:', error);
    }
  }

  /**
   * Handle incremental order modifications
   * Detects new items vs quantity increases and generates incremental KOTs
   * 
   * @param {string} orderId - Order ID
   * @param {Array} newItems - New or modified order items
   * @returns {Promise<Array>} Array of incremental items
   * 
   * Requirements: 9.1, 9.2
   */
  async handleOrderModification(orderId, newItems) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    try {
      // Get existing order items that were sent to kitchen
      const orderItemsSnapshot = await this.db
        .collection('orders')
        .doc(orderId)
        .collection('items')
        .where('sentToKitchen', '==', true)
        .get();

      const existingItems = [];
      orderItemsSnapshot.forEach(doc => {
        existingItems.push({ id: doc.id, ...doc.data() });
      });

      // Identify truly new items vs quantity increases
      const incrementalItems = [];

      for (const newItem of newItems) {
        const existing = existingItems.find(e =>
          e.menuItemId === newItem.menuItemId &&
          JSON.stringify(e.modifiers) === JSON.stringify(newItem.modifiers)
        );

        if (existing) {
          // Quantity increase - create incremental KOT item
          const incrementalQty = newItem.quantity - existing.quantity;
          if (incrementalQty > 0) {
            incrementalItems.push({
              ...newItem,
              quantity: incrementalQty,
              isIncremental: true
            });
          }
        } else {
          // Completely new item
          incrementalItems.push({
            ...newItem,
            isIncremental: false
          });
        }
      }

      return incrementalItems;
    } catch (error) {
      console.error('Error handling order modification:', error);
      throw error;
    }
  }

  /**
   * Retry failed KOT printing
   * 
   * @param {string} failedKOTId - Failed KOT document ID
   * @returns {Promise<Object>} Retry result
   */
  async retryFailedKOT(failedKOTId) {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    try {
      const failedKOTDoc = await this.db
        .collection('failedKOTs')
        .doc(failedKOTId)
        .get();

      if (!failedKOTDoc.exists) {
        return { success: false, error: 'Failed KOT not found' };
      }

      const failedKOT = failedKOTDoc.data();
      const { kotData, printerType, retryCount } = failedKOT;

      // Maximum 3 retry attempts
      if (retryCount >= 3) {
        return {
          success: false,
          error: 'Maximum retry attempts reached'
        };
      }

      try {
        // Attempt to print again
        await this.sendToPrinter(kotData, printerType);

        // Success - delete failed KOT record
        await this.db.collection('failedKOTs').doc(failedKOTId).delete();

        return {
          success: true,
          message: `KOT ${kotData.kotNumber} printed successfully`
        };
      } catch (error) {
        // Increment retry count
        await this.db.collection('failedKOTs').doc(failedKOTId).update({
          retryCount: retryCount + 1,
          lastRetryAt: new Date(),
          lastError: error.message
        });

        return {
          success: false,
          error: error.message,
          retriesRemaining: 3 - (retryCount + 1)
        };
      }
    } catch (error) {
      console.error('Error retrying failed KOT:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all failed KOTs
   * 
   * @returns {Promise<Array>} Array of failed KOTs
   */
  async getFailedKOTs() {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    try {
      const snapshot = await this.db
        .collection('failedKOTs')
        .where('retryCount', '<', 3)
        .orderBy('createdAt', 'desc')
        .get();

      const failedKOTs = [];
      snapshot.forEach(doc => {
        failedKOTs.push({ id: doc.id, ...doc.data() });
      });

      return failedKOTs;
    } catch (error) {
      console.error('Error getting failed KOTs:', error);
      throw error;
    }
  }
}

module.exports = KOTRouterService;
