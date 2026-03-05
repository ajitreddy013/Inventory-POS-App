/**
 * Mock Printer
 * 
 * Simulates thermal printer behavior for testing without physical hardware.
 * Logs KOTs to console and optionally to files.
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/**
 * Mock Printer Connection
 * Simulates network printer connection
 */
class MockPrinterConnection extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.isConnected = false;
    this.simulateOffline = false;
    this.simulatePaperOut = false;
  }

  /**
   * Simulate connection to printer
   * @returns {Promise<void>}
   */
  async connect() {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.isConnected = true;
        this.emit('connected');
        console.log(`[MOCK] Connected to printer at ${this.config.host}:${this.config.port}`);
        resolve();
      }, 100); // Simulate connection delay
    });
  }

  /**
   * Simulate sending data to printer
   * @param {Buffer} data - Data to send
   * @returns {Promise<void>}
   */
  async send(data) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Printer not connected'));
        return;
      }

      if (this.simulateOffline) {
        reject(new Error('Printer offline'));
        return;
      }

      if (this.simulatePaperOut) {
        reject(new Error('Paper out'));
        return;
      }

      // Simulate print delay
      setTimeout(() => {
        console.log(`[MOCK] Sent ${data.length} bytes to printer`);
        resolve();
      }, 50);
    });
  }

  /**
   * Disconnect from printer
   */
  disconnect() {
    this.isConnected = false;
    this.emit('disconnected');
    console.log('[MOCK] Printer disconnected');
  }

  /**
   * Get connection status
   * @returns {boolean} Connection status
   */
  getStatus() {
    return this.isConnected && !this.simulateOffline;
  }

  /**
   * Simulate printer going offline
   */
  setOffline(offline) {
    this.simulateOffline = offline;
    if (offline) {
      this.emit('error', new Error('Printer offline'));
    }
  }

  /**
   * Simulate paper out condition
   */
  setPaperOut(paperOut) {
    this.simulatePaperOut = paperOut;
    if (paperOut) {
      this.emit('error', new Error('Paper out'));
    }
  }
}

/**
 * Mock Thermal Printer Driver
 * Simulates thermal printer operations
 */
class MockThermalPrinter {
  constructor(options = {}) {
    this.logToFile = options.logToFile || false;
    this.logDirectory = options.logDirectory || path.join(__dirname, '../../logs/kots');
    this.printers = new Map();
    
    if (this.logToFile) {
      this.ensureLogDirectory();
    }
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
      console.log(`[MOCK] Created log directory: ${this.logDirectory}`);
    }
  }

  /**
   * Add mock printer
   * @param {string} name - Printer name
   * @param {Object} config - Printer configuration
   * @returns {Promise<void>}
   */
  async addPrinter(name, config) {
    const connection = new MockPrinterConnection(config);
    
    connection.on('error', (error) => {
      console.log(`[MOCK] Printer ${name} error:`, error.message);
    });

    connection.on('disconnected', () => {
      console.log(`[MOCK] Printer ${name} disconnected`);
    });

    connection.on('connected', () => {
      console.log(`[MOCK] Printer ${name} connected`);
    });

    this.printers.set(name, connection);
    await connection.connect();
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

    const isOnline = connection.getStatus();

    return {
      status: isOnline ? 'online' : 'offline',
      online: isOnline,
      error: isOnline ? null : 'Printer offline'
    };
  }

  /**
   * Print KOT (mock)
   * @param {Object} kot - KOT object
   * @param {string} printerName - Printer name
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
      const status = await this.checkStatus(printerName);
      
      if (!status.online) {
        return {
          success: false,
          error: 'Printer offline',
          queued: true
        };
      }

      // Simulate sending to printer
      const mockData = Buffer.from('MOCK_PRINT_DATA');
      await connection.send(mockData);

      // Log to console
      this.logKOTToConsole(kot, printerName);

      // Optionally log to file
      if (this.logToFile) {
        this.logKOTToFile(kot, printerName);
      }

      return {
        success: true,
        message: `[MOCK] Printed to ${printerName} printer`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        queued: true
      };
    }
  }

  /**
   * Log KOT to console
   * @param {Object} kot - KOT object
   * @param {string} printerName - Printer name
   */
  logKOTToConsole(kot, printerName) {
    const width = 32;
    const line = '='.repeat(width);
    
    console.log('\n' + line);
    console.log(`[MOCK ${printerName.toUpperCase()} PRINTER]`);
    console.log(line);
    console.log(`${kot.printerType.toUpperCase()} ORDER`.padStart(width / 2 + 6));
    console.log(line);
    console.log(`Order #: ${kot.orderNumber}`);
    console.log(`KOT #: ${kot.kotNumber}`);
    console.log(`Table: ${kot.tableNumber}`);
    console.log(`Waiter: ${kot.waiterName}`);
    console.log(`Time: ${kot.timestamp}`);
    console.log(line);
    console.log('');
    
    kot.items.forEach(item => {
      const qtyPrefix = item.isIncremental ? '+' : '';
      console.log(`${qtyPrefix}${item.quantity}x ${item.name}`);
      if (item.modifiers) {
        console.log(`   ${item.modifiers}`);
      }
    });
    
    console.log('');
    console.log(line);
    console.log(`[END MOCK ${printerName.toUpperCase()} PRINTER]`);
    console.log(line + '\n');
  }

  /**
   * Log KOT to file
   * @param {Object} kot - KOT object
   * @param {string} printerName - Printer name
   */
  logKOTToFile(kot, printerName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${printerName}_${kot.kotNumber}_${timestamp}.txt`;
    const filepath = path.join(this.logDirectory, filename);

    const width = 32;
    const line = '='.repeat(width);
    
    const content = [
      line,
      `${kot.printerType.toUpperCase()} ORDER`,
      line,
      `Order #: ${kot.orderNumber}`,
      `KOT #: ${kot.kotNumber}`,
      `Table: ${kot.tableNumber}`,
      `Waiter: ${kot.waiterName}`,
      `Time: ${kot.timestamp}`,
      line,
      '',
      ...kot.items.flatMap(item => {
        const qtyPrefix = item.isIncremental ? '+' : '';
        const lines = [`${qtyPrefix}${item.quantity}x ${item.name}`];
        if (item.modifiers) {
          lines.push(`   ${item.modifiers}`);
        }
        return lines;
      }),
      '',
      line,
      `Printed: ${new Date().toLocaleString()}`,
      line
    ].join('\n');

    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`[MOCK] KOT saved to file: ${filepath}`);
  }

  /**
   * Simulate printer going offline
   * @param {string} name - Printer name
   * @param {boolean} offline - Offline status
   */
  setOffline(name, offline) {
    const connection = this.printers.get(name);
    if (connection) {
      connection.setOffline(offline);
      console.log(`[MOCK] Printer ${name} set to ${offline ? 'offline' : 'online'}`);
    }
  }

  /**
   * Simulate paper out condition
   * @param {string} name - Printer name
   * @param {boolean} paperOut - Paper out status
   */
  setPaperOut(name, paperOut) {
    const connection = this.printers.get(name);
    if (connection) {
      connection.setPaperOut(paperOut);
      console.log(`[MOCK] Printer ${name} paper ${paperOut ? 'out' : 'loaded'}`);
    }
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

  /**
   * Disconnect all printers
   */
  async disconnectAll() {
    for (const [name, connection] of this.printers.entries()) {
      console.log(`[MOCK] Disconnecting ${name} printer`);
      connection.disconnect();
    }

    this.printers.clear();
  }
}

module.exports = {
  MockThermalPrinter,
  MockPrinterConnection
};
