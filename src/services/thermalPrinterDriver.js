/**
 * Thermal Printer Driver
 * 
 * Handles ESC/POS command generation, printer connection management,
 * status checking, and print retry logic for thermal printers.
 * 
 * Requirements: 7.1, 22.4, 23.4
 */

const net = require('net');
const { EventEmitter } = require('events');

/**
 * ESC/POS Command Formatter
 * Generates ESC/POS commands for thermal printers
 */
class ESCPOSFormatter {
  constructor() {
    // ESC/POS control codes
    this.ESC = '\x1B';
    this.GS = '\x1D';
    this.LF = '\x0A';
    this.CR = '\x0D';
  }

  /**
   * Initialize printer
   * @returns {Buffer} Initialization command
   */
  initialize() {
    return Buffer.from(`${this.ESC}@`);
  }

  /**
   * Set text alignment
   * @param {string} align - 'left', 'center', 'right'
   * @returns {Buffer} Alignment command
   */
  setAlignment(align) {
    const alignments = {
      left: 0,
      center: 1,
      right: 2
    };
    const code = alignments[align] || 0;
    return Buffer.from(`${this.ESC}a${String.fromCharCode(code)}`);
  }

  /**
   * Set text bold
   * @param {boolean} enabled - true to enable bold
   * @returns {Buffer} Bold command
   */
  setBold(enabled) {
    const code = enabled ? 1 : 0;
    return Buffer.from(`${this.ESC}E${String.fromCharCode(code)}`);
  }

  /**
   * Set text size
   * @param {number} width - Width multiplier (1-8)
   * @param {number} height - Height multiplier (1-8)
   * @returns {Buffer} Size command
   */
  setTextSize(width, height) {
    const w = Math.max(1, Math.min(8, width)) - 1;
    const h = Math.max(1, Math.min(8, height)) - 1;
    const size = (w << 4) | h;
    return Buffer.from(`${this.GS}!${String.fromCharCode(size)}`);
  }

  /**
   * Print text
   * @param {string} text - Text to print
   * @returns {Buffer} Text buffer
   */
  text(text) {
    return Buffer.from(text + this.LF);
  }

  /**
   * Print line separator
   * @param {number} length - Line length (default 32)
   * @returns {Buffer} Line buffer
   */
  line(length = 32) {
    return Buffer.from('='.repeat(length) + this.LF);
  }

  /**
   * Feed paper
   * @param {number} lines - Number of lines to feed
   * @returns {Buffer} Feed command
   */
  feed(lines = 1) {
    return Buffer.from(`${this.ESC}d${String.fromCharCode(lines)}`);
  }

  /**
   * Cut paper
   * @param {boolean} partial - true for partial cut, false for full cut
   * @returns {Buffer} Cut command
   */
  cut(partial = false) {
    const mode = partial ? 1 : 0;
    return Buffer.from(`${this.GS}V${String.fromCharCode(mode)}`);
  }

  /**
   * Open cash drawer (if connected)
   * @returns {Buffer} Cash drawer command
   */
  openDrawer() {
    return Buffer.from(`${this.ESC}p${String.fromCharCode(0)}${String.fromCharCode(25)}${String.fromCharCode(250)}`);
  }
}

/**
 * Printer Connection Manager
 * Manages network connections to thermal printers
 */
class PrinterConnection extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.manuallyDisconnected = false; // Flag to prevent auto-reconnect
  }

  /**
   * Connect to network printer
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve, reject) => {
      if (this.isConnected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        if (this.socket) {
          this.socket.destroy();
        }
        reject(new Error(`Connection timeout after ${this.config.timeout}ms`));
      }, this.config.timeout || 5000);

      this.socket = net.createConnection({
        host: this.config.host,
        port: this.config.port
      });

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.emit('connected');
        console.log(`Connected to printer at ${this.config.host}:${this.config.port}`);
        resolve();
      });

      this.socket.on('error', (error) => {
        clearTimeout(timeout);
        this.isConnected = false;
        this.emit('error', error);
        console.error(`Printer connection error: ${error.message}`);
        reject(error);
      });

      this.socket.on('close', () => {
        this.isConnected = false;
        this.emit('disconnected');
        console.log('Printer connection closed');
        
        // Attempt reconnection if not manually disconnected
        if (!this.manuallyDisconnected && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });

      this.socket.on('timeout', () => {
        console.log('Printer connection timeout');
        this.socket.destroy();
      });
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts})`);
      this.connect().catch(error => {
        console.error(`Reconnect attempt ${this.reconnectAttempts} failed:`, error.message);
      });
    }, delay);
  }

  /**
   * Send data to printer
   * @param {Buffer} data - Data to send
   * @returns {Promise<void>}
   */
  async send(data) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.socket) {
        reject(new Error('Printer not connected'));
        return;
      }

      this.socket.write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Disconnect from printer
   */
  disconnect() {
    this.manuallyDisconnected = true; // Set flag to prevent auto-reconnect
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.isConnected = false;
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
  }

  /**
   * Check connection status
   * @returns {boolean} Connection status
   */
  getStatus() {
    return this.isConnected;
  }
}

/**
 * Thermal Printer Driver
 * Main driver class for thermal printer operations
 */
class ThermalPrinterDriver {
  constructor() {
    this.formatter = new ESCPOSFormatter();
    this.printers = new Map(); // printer name -> connection
    this.printQueue = new Map(); // printer name -> queue
    this.retryQueue = []; // Failed prints for retry
  }

  /**
   * Add printer configuration
   * @param {string} name - Printer name ('kitchen' or 'bar')
   * @param {Object} config - Printer configuration
   * @returns {Promise<void>}
   */
  async addPrinter(name, config) {
    const connection = new PrinterConnection(config);
    
    connection.on('error', (error) => {
      console.error(`Printer ${name} error:`, error.message);
    });

    connection.on('disconnected', () => {
      console.log(`Printer ${name} disconnected`);
    });

    connection.on('connected', () => {
      console.log(`Printer ${name} connected`);
      // Process any queued prints
      this.processQueue(name);
    });

    this.printers.set(name, connection);
    this.printQueue.set(name, []);

    try {
      await connection.connect();
    } catch (error) {
      console.error(`Failed to connect to ${name} printer:`, error.message);
      // Don't throw - allow operation without printer
    }
  }

  /**
   * Check printer status
   * @param {string} name - Printer name
   * @returns {Object} Status object
   */
  async checkStatus(name) {
    const connection = this.printers.get(name);
    
    if (!connection) {
      return {
        status: 'not_configured',
        online: false,
        error: 'Printer not configured'
      };
    }

    const isConnected = connection.getStatus();

    return {
      status: isConnected ? 'online' : 'offline',
      online: isConnected,
      error: isConnected ? null : 'Printer offline'
    };
  }

  /**
   * Print KOT to thermal printer
   * @param {Object} kot - KOT object
   * @param {string} printerName - Printer name ('kitchen' or 'bar')
   * @returns {Promise<Object>} Print result
   */
  async printKOT(kot, printerName) {
    const connection = this.printers.get(printerName);

    if (!connection) {
      return {
        success: false,
        error: `Printer ${printerName} not configured`
      };
    }

    try {
      // Check if printer is online
      const status = await this.checkStatus(printerName);
      
      if (!status.online) {
        // Queue for retry
        await this.queueForRetry(kot, printerName, 'Printer offline');
        return {
          success: false,
          error: 'Printer offline - queued for retry',
          queued: true
        };
      }

      // Generate ESC/POS commands
      const commands = this.formatKOT(kot);

      // Send to printer
      await connection.send(commands);

      console.log(`KOT ${kot.kotNumber} printed successfully to ${printerName}`);

      return {
        success: true,
        message: `Printed to ${printerName} printer`
      };
    } catch (error) {
      console.error(`Error printing KOT to ${printerName}:`, error.message);
      
      // Queue for retry
      await this.queueForRetry(kot, printerName, error.message);

      return {
        success: false,
        error: error.message,
        queued: true
      };
    }
  }

  /**
   * Format KOT with ESC/POS commands
   * @param {Object} kot - KOT object
   * @returns {Buffer} ESC/POS command buffer
   */
  formatKOT(kot) {
    const buffers = [];

    // Initialize printer
    buffers.push(this.formatter.initialize());

    // Header - centered, bold, large
    buffers.push(this.formatter.setAlignment('center'));
    buffers.push(this.formatter.setBold(true));
    buffers.push(this.formatter.setTextSize(2, 2));
    buffers.push(this.formatter.text(`${kot.printerType.toUpperCase()} ORDER`));
    buffers.push(this.formatter.setTextSize(1, 1));
    buffers.push(this.formatter.setBold(false));

    // Separator
    buffers.push(this.formatter.line(32));

    // Order details - left aligned
    buffers.push(this.formatter.setAlignment('left'));
    buffers.push(this.formatter.text(`Order #: ${kot.orderNumber}`));
    buffers.push(this.formatter.text(`KOT #: ${kot.kotNumber}`));
    buffers.push(this.formatter.text(`Table: ${kot.tableNumber}`));
    buffers.push(this.formatter.text(`Waiter: ${kot.waiterName}`));
    buffers.push(this.formatter.text(`Time: ${kot.timestamp}`));

    // Separator
    buffers.push(this.formatter.line(32));
    buffers.push(this.formatter.text(''));

    // Items - bold
    buffers.push(this.formatter.setBold(true));
    kot.items.forEach(item => {
      const qtyPrefix = item.isIncremental ? '+' : '';
      const itemLine = `${qtyPrefix}${item.quantity}x ${item.name}`;
      buffers.push(this.formatter.text(itemLine));
      
      // Modifiers - normal weight, indented
      if (item.modifiers) {
        buffers.push(this.formatter.setBold(false));
        buffers.push(this.formatter.text(`   ${item.modifiers}`));
        buffers.push(this.formatter.setBold(true));
      }
    });
    buffers.push(this.formatter.setBold(false));

    // Footer separator
    buffers.push(this.formatter.text(''));
    buffers.push(this.formatter.line(32));

    // Feed and cut
    buffers.push(this.formatter.feed(3));
    buffers.push(this.formatter.cut(false));

    // Combine all buffers
    return Buffer.concat(buffers);
  }

  /**
   * Queue failed print for retry
   * @param {Object} kot - KOT object
   * @param {string} printerName - Printer name
   * @param {string} errorMessage - Error message
   */
  async queueForRetry(kot, printerName, errorMessage) {
    const retryItem = {
      id: `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      kot,
      printerName,
      errorMessage,
      retryCount: 0,
      maxRetries: 5,
      nextRetryAt: Date.now() + 1000, // Retry in 1 second
      createdAt: Date.now()
    };

    this.retryQueue.push(retryItem);
    console.log(`Queued KOT ${kot.kotNumber} for retry (${this.retryQueue.length} in queue)`);
  }

  /**
   * Process retry queue with exponential backoff
   */
  async processRetryQueue() {
    const now = Date.now();
    const itemsToRetry = this.retryQueue.filter(item => item.nextRetryAt <= now);

    for (const item of itemsToRetry) {
      if (item.retryCount >= item.maxRetries) {
        console.log(`Max retries reached for KOT ${item.kot.kotNumber}, removing from queue`);
        this.retryQueue = this.retryQueue.filter(i => i.id !== item.id);
        continue;
      }

      console.log(`Retrying KOT ${item.kot.kotNumber} (attempt ${item.retryCount + 1}/${item.maxRetries})`);

      const result = await this.printKOT(item.kot, item.printerName);

      if (result.success) {
        // Success - remove from queue
        console.log(`Retry successful for KOT ${item.kot.kotNumber}`);
        this.retryQueue = this.retryQueue.filter(i => i.id !== item.id);
      } else {
        // Failed - update retry info with exponential backoff
        item.retryCount++;
        const backoffDelay = 1000 * Math.pow(2, item.retryCount); // 1s, 2s, 4s, 8s, 16s
        item.nextRetryAt = now + backoffDelay;
        console.log(`Retry failed for KOT ${item.kot.kotNumber}, next retry in ${backoffDelay}ms`);
      }
    }
  }

  /**
   * Start automatic retry processing
   * @param {number} intervalMs - Check interval in milliseconds
   */
  startRetryProcessor(intervalMs = 5000) {
    this.retryInterval = setInterval(() => {
      if (this.retryQueue.length > 0) {
        this.processRetryQueue();
      }
    }, intervalMs);
    console.log('Retry processor started');
  }

  /**
   * Stop automatic retry processing
   */
  stopRetryProcessor() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
      console.log('Retry processor stopped');
    }
  }

  /**
   * Get failed prints
   * @returns {Array} Array of failed print items
   */
  getFailedPrints() {
    return this.retryQueue.map(item => ({
      id: item.id,
      kotNumber: item.kot.kotNumber,
      printerName: item.printerName,
      errorMessage: item.errorMessage,
      retryCount: item.retryCount,
      maxRetries: item.maxRetries,
      nextRetryAt: new Date(item.nextRetryAt),
      createdAt: new Date(item.createdAt)
    }));
  }

  /**
   * Manually retry a failed print
   * @param {string} retryId - Retry item ID
   * @returns {Promise<Object>} Retry result
   */
  async manualRetry(retryId) {
    const item = this.retryQueue.find(i => i.id === retryId);

    if (!item) {
      return {
        success: false,
        error: 'Retry item not found'
      };
    }

    const result = await this.printKOT(item.kot, item.printerName);

    if (result.success) {
      // Remove from queue
      this.retryQueue = this.retryQueue.filter(i => i.id !== retryId);
      return {
        success: true,
        message: `KOT ${item.kot.kotNumber} printed successfully`
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  }

  /**
   * Process queued prints for a printer
   * @param {string} printerName - Printer name
   */
  async processQueue(printerName) {
    const queue = this.printQueue.get(printerName);
    
    if (!queue || queue.length === 0) {
      return;
    }

    console.log(`Processing ${queue.length} queued prints for ${printerName}`);

    while (queue.length > 0) {
      const kot = queue.shift();
      await this.printKOT(kot, printerName);
    }
  }

  /**
   * Disconnect all printers
   */
  async disconnectAll() {
    this.stopRetryProcessor();
    
    for (const [name, connection] of this.printers.entries()) {
      console.log(`Disconnecting ${name} printer`);
      connection.disconnect();
    }

    this.printers.clear();
    this.printQueue.clear();
  }

  /**
   * Get all printer statuses
   * @returns {Promise<Object>} Status object for all printers
   */
  async getAllStatuses() {
    const statuses = {};

    for (const [name] of this.printers.entries()) {
      statuses[name] = await this.checkStatus(name);
    }

    return statuses;
  }
}

module.exports = {
  ThermalPrinterDriver,
  ESCPOSFormatter,
  PrinterConnection
};
