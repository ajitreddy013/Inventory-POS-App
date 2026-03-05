/**
 * Printer Configuration
 * 
 * Configuration for thermal printers (kitchen and bar)
 * Supports both real printers and mock/simulator mode for testing
 */

const fs = require('fs');
const path = require('path');

/**
 * Default printer configuration
 */
const DEFAULT_CONFIG = {
  // Mock mode for testing without physical printers
  mockMode: true,
  
  // Kitchen printer configuration
  kitchen: {
    enabled: true,
    type: 'network', // 'network', 'usb', 'serial'
    host: '192.168.1.100',
    port: 9100,
    timeout: 5000
  },
  
  // Bar printer configuration
  bar: {
    enabled: true,
    type: 'network',
    host: '192.168.1.101',
    port: 9100,
    timeout: 5000
  },
  
  // Retry settings
  retry: {
    enabled: true,
    maxAttempts: 5,
    initialDelay: 1000, // 1 second
    maxDelay: 16000, // 16 seconds
    checkInterval: 5000 // Check every 5 seconds
  },
  
  // Paper settings
  paper: {
    width: 80, // mm
    charactersPerLine: 32
  }
};

/**
 * Load printer configuration from file
 * @param {string} configPath - Path to config file
 * @returns {Object} Configuration object
 */
function loadConfig(configPath) {
  try {
    const configFile = configPath || path.join(__dirname, '../../printer-config.json');
    
    if (fs.existsSync(configFile)) {
      const data = fs.readFileSync(configFile, 'utf8');
      const config = JSON.parse(data);
      console.log('Loaded printer configuration from file');
      return { ...DEFAULT_CONFIG, ...config };
    } else {
      console.log('No printer config file found, using defaults');
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    console.error('Error loading printer config:', error.message);
    return DEFAULT_CONFIG;
  }
}

/**
 * Save printer configuration to file
 * @param {Object} config - Configuration object
 * @param {string} configPath - Path to config file
 */
function saveConfig(config, configPath) {
  try {
    const configFile = configPath || path.join(__dirname, '../../printer-config.json');
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
    console.log('Saved printer configuration to file');
  } catch (error) {
    console.error('Error saving printer config:', error.message);
    throw error;
  }
}

/**
 * Validate printer configuration
 * @param {Object} config - Configuration object
 * @returns {Object} Validation result
 */
function validateConfig(config) {
  const errors = [];

  if (!config.kitchen && !config.bar) {
    errors.push('At least one printer (kitchen or bar) must be configured');
  }

  if (config.kitchen) {
    if (config.kitchen.type === 'network') {
      if (!config.kitchen.host) {
        errors.push('Kitchen printer host is required for network type');
      }
      if (!config.kitchen.port) {
        errors.push('Kitchen printer port is required for network type');
      }
    }
  }

  if (config.bar) {
    if (config.bar.type === 'network') {
      if (!config.bar.host) {
        errors.push('Bar printer host is required for network type');
      }
      if (!config.bar.port) {
        errors.push('Bar printer port is required for network type');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create example configuration file
 */
function createExampleConfig() {
  const exampleConfig = {
    ...DEFAULT_CONFIG,
    mockMode: false,
    kitchen: {
      enabled: true,
      type: 'network',
      host: '192.168.1.100', // Replace with your kitchen printer IP
      port: 9100,
      timeout: 5000
    },
    bar: {
      enabled: true,
      type: 'network',
      host: '192.168.1.101', // Replace with your bar printer IP
      port: 9100,
      timeout: 5000
    }
  };

  const examplePath = path.join(__dirname, '../../printer-config.example.json');
  fs.writeFileSync(examplePath, JSON.stringify(exampleConfig, null, 2), 'utf8');
  console.log('Created example printer configuration file');
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  validateConfig,
  createExampleConfig
};
