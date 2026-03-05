/**
 * Printer Service Integration
 * 
 * Integrates thermal printer driver with mock printer for testing.
 * Automatically selects real or mock printer based on configuration.
 */

const { ThermalPrinterDriver } = require('./thermalPrinterDriver');
const { MockThermalPrinter } = require('./mockPrinter');
const { loadConfig, validateConfig } = require('./printerConfig');

/**
 * Initialize printer service based on configuration
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} Printer service instance
 */
async function initializePrinterService(options = {}) {
  const config = options.config || loadConfig(options.configPath);
  
  // Validate configuration
  const validation = validateConfig(config);
  if (!validation.valid) {
    console.error('Invalid printer configuration:', validation.errors);
    throw new Error(`Invalid printer configuration: ${validation.errors.join(', ')}`);
  }

  let printerService;

  if (config.mockMode) {
    console.log('Initializing MOCK printer service (no physical printers required)');
    printerService = new MockThermalPrinter({
      logToFile: options.logToFile !== false, // Default to true
      logDirectory: options.logDirectory
    });
  } else {
    console.log('Initializing REAL thermal printer service');
    printerService = new ThermalPrinterDriver();
  }

  // Add kitchen printer if enabled
  if (config.kitchen && config.kitchen.enabled) {
    try {
      await printerService.addPrinter('kitchen', config.kitchen);
      console.log('Kitchen printer configured');
    } catch (error) {
      console.error('Failed to configure kitchen printer:', error.message);
      if (!config.mockMode) {
        console.warn('Kitchen printer will be unavailable');
      }
    }
  }

  // Add bar printer if enabled
  if (config.bar && config.bar.enabled) {
    try {
      await printerService.addPrinter('bar', config.bar);
      console.log('Bar printer configured');
    } catch (error) {
      console.error('Failed to configure bar printer:', error.message);
      if (!config.mockMode) {
        console.warn('Bar printer will be unavailable');
      }
    }
  }

  // Start retry processor for real printers
  if (!config.mockMode && config.retry && config.retry.enabled) {
    printerService.startRetryProcessor(config.retry.checkInterval || 5000);
    console.log('Printer retry processor started');
  }

  return {
    service: printerService,
    config,
    isMock: config.mockMode
  };
}

/**
 * Create printer service wrapper with unified interface
 * @param {Object} options - Initialization options
 * @returns {Promise<Object>} Printer service wrapper
 */
async function createPrinterService(options = {}) {
  const { service, config, isMock } = await initializePrinterService(options);

  return {
    /**
     * Print KOT to specified printer
     * @param {Object} kot - KOT object
     * @param {string} printerName - Printer name ('kitchen' or 'bar')
     * @returns {Promise<Object>} Print result
     */
    async printKOT(kot, printerName) {
      return await service.printKOT(kot, printerName);
    },

    /**
     * Check printer status
     * @param {string} printerName - Printer name
     * @returns {Promise<Object>} Status object
     */
    async checkStatus(printerName) {
      return await service.checkStatus(printerName);
    },

    /**
     * Get all printer statuses
     * @returns {Promise<Object>} Status object for all printers
     */
    async getAllStatuses() {
      return await service.getAllStatuses();
    },

    /**
     * Get failed prints (real printers only)
     * @returns {Array} Array of failed print items
     */
    getFailedPrints() {
      if (isMock) {
        return [];
      }
      return service.getFailedPrints();
    },

    /**
     * Manually retry a failed print (real printers only)
     * @param {string} retryId - Retry item ID
     * @returns {Promise<Object>} Retry result
     */
    async manualRetry(retryId) {
      if (isMock) {
        return { success: false, error: 'Manual retry not available in mock mode' };
      }
      return await service.manualRetry(retryId);
    },

    /**
     * Disconnect all printers
     */
    async disconnect() {
      if (!isMock && service.stopRetryProcessor) {
        service.stopRetryProcessor();
      }
      await service.disconnectAll();
    },

    /**
     * Get service info
     * @returns {Object} Service information
     */
    getInfo() {
      return {
        isMock,
        config,
        kitchenEnabled: config.kitchen?.enabled || false,
        barEnabled: config.bar?.enabled || false
      };
    },

    /**
     * Simulate printer offline (mock mode only)
     * @param {string} printerName - Printer name
     * @param {boolean} offline - Offline status
     */
    setOffline(printerName, offline) {
      if (isMock && service.setOffline) {
        service.setOffline(printerName, offline);
      }
    },

    /**
     * Simulate paper out (mock mode only)
     * @param {string} printerName - Printer name
     * @param {boolean} paperOut - Paper out status
     */
    setPaperOut(printerName, paperOut) {
      if (isMock && service.setPaperOut) {
        service.setPaperOut(printerName, paperOut);
      }
    }
  };
}

module.exports = {
  initializePrinterService,
  createPrinterService
};
