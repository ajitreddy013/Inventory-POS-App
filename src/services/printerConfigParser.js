/**
 * Printer Configuration Parser
 * 
 * Parses and validates printer configuration files
 * Requirements: 19.1, 19.2, 19.3, 19.4
 */

class ConfigurationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ConfigurationError';
    this.field = field;
  }
}

/**
 * Parse printer configuration from JSON string or object
 * @param {string|object} input - Configuration input
 * @returns {object} Parsed configuration
 * @throws {ConfigurationError} If configuration is invalid
 */
function parseConfiguration(input) {
  let config;

  // Parse JSON string if needed
  if (typeof input === 'string') {
    try {
      config = JSON.parse(input);
    } catch (error) {
      throw new ConfigurationError('Invalid JSON format', null);
    }
  } else if (typeof input === 'object' && input !== null) {
    config = input;
  } else {
    throw new ConfigurationError('Configuration must be a string or object', null);
  }

  // Validate required fields
  if (!config.printers || typeof config.printers !== 'object') {
    throw new ConfigurationError('Missing or invalid "printers" field', 'printers');
  }

  // Validate each printer configuration
  const validatedPrinters = {};
  
  for (const [name, printerConfig] of Object.entries(config.printers)) {
    validatedPrinters[name] = validatePrinterConfig(name, printerConfig);
  }

  return {
    printers: validatedPrinters
  };
}

/**
 * Validate individual printer configuration
 * @param {string} name - Printer name
 * @param {object} config - Printer configuration
 * @returns {object} Validated printer configuration
 * @throws {ConfigurationError} If configuration is invalid
 */
function validatePrinterConfig(name, config) {
  if (!config || typeof config !== 'object') {
    throw new ConfigurationError(`Printer "${name}" configuration must be an object`, `printers.${name}`);
  }

  // Validate host
  if (!config.host || typeof config.host !== 'string') {
    throw new ConfigurationError(`Printer "${name}" missing or invalid "host" field`, `printers.${name}.host`);
  }

  // Validate port
  if (!config.port || typeof config.port !== 'number' || config.port < 1 || config.port > 65535) {
    throw new ConfigurationError(`Printer "${name}" missing or invalid "port" field (must be 1-65535)`, `printers.${name}.port`);
  }

  // Validate timeout (optional, default 5000ms)
  const timeout = config.timeout !== undefined ? config.timeout : 5000;
  if (typeof timeout !== 'number' || timeout < 0) {
    throw new ConfigurationError(`Printer "${name}" invalid "timeout" field (must be non-negative number)`, `printers.${name}.timeout`);
  }

  return {
    host: config.host,
    port: config.port,
    timeout
  };
}

/**
 * Format configuration object to JSON string
 * @param {object} config - Configuration object
 * @returns {string} Formatted JSON string
 */
function printConfiguration(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object');
  }

  return JSON.stringify(config, null, 2);
}

module.exports = {
  parseConfiguration,
  printConfiguration,
  ConfigurationError
};
