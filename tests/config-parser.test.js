/**
 * Unit Tests for Configuration Parser
 * 
 * Tests configuration parsing, validation, and round-trip integrity
 * Requirements: 19.1, 19.2, 19.3, 19.4
 */

const { parseConfiguration, printConfiguration, ConfigurationError } = require('../src/services/printerConfigParser');

describe('Configuration Parser Tests', () => {
  describe('Valid Configuration Parsing', () => {
    test('should parse valid configuration object', () => {
      const config = {
        printers: {
          kitchen: {
            host: '192.168.1.100',
            port: 9100,
            timeout: 5000
          }
        }
      };

      const parsed = parseConfiguration(config);
      
      expect(parsed.printers.kitchen.host).toBe('192.168.1.100');
      expect(parsed.printers.kitchen.port).toBe(9100);
      expect(parsed.printers.kitchen.timeout).toBe(5000);
    });

    test('should parse valid configuration JSON string', () => {
      const configStr = JSON.stringify({
        printers: {
          kitchen: {
            host: '192.168.1.100',
            port: 9100,
            timeout: 5000
          }
        }
      });

      const parsed = parseConfiguration(configStr);
      
      expect(parsed.printers.kitchen.host).toBe('192.168.1.100');
      expect(parsed.printers.kitchen.port).toBe(9100);
      expect(parsed.printers.kitchen.timeout).toBe(5000);
    });

    test('should apply default timeout when not specified', () => {
      const config = {
        printers: {
          kitchen: {
            host: '192.168.1.100',
            port: 9100
          }
        }
      };

      const parsed = parseConfiguration(config);
      
      expect(parsed.printers.kitchen.timeout).toBe(5000);
    });

    test('should handle multiple printers', () => {
      const config = {
        printers: {
          kitchen: {
            host: '192.168.1.100',
            port: 9100,
            timeout: 3000
          },
          bar: {
            host: '192.168.1.101',
            port: 9101,
            timeout: 5000
          }
        }
      };

      const parsed = parseConfiguration(config);
      
      expect(parsed.printers.kitchen.host).toBe('192.168.1.100');
      expect(parsed.printers.bar.host).toBe('192.168.1.101');
    });
  });

  describe('Invalid Configuration Rejection', () => {
    test('should reject invalid JSON string', () => {
      expect(() => parseConfiguration('{ invalid json')).toThrow('Invalid JSON format');
    });

    test('should reject non-object input', () => {
      expect(() => parseConfiguration(null)).toThrow('Configuration must be a string or object');
      expect(() => parseConfiguration(123)).toThrow('Configuration must be a string or object');
    });

    test('should reject missing printers field', () => {
      expect(() => parseConfiguration({})).toThrow('Missing or invalid "printers" field');
    });

    test('should reject invalid printers field', () => {
      expect(() => parseConfiguration({ printers: null })).toThrow('Missing or invalid "printers" field');
      expect(() => parseConfiguration({ printers: 'invalid' })).toThrow('Missing or invalid "printers" field');
    });

    test('should reject invalid printer configuration', () => {
      expect(() => parseConfiguration({ printers: { kitchen: null } })).toThrow('configuration must be an object');
    });

    test('should reject missing host field', () => {
      expect(() => parseConfiguration({ printers: { kitchen: { port: 9100 } } })).toThrow('missing or invalid "host" field');
    });

    test('should reject invalid host field', () => {
      expect(() => parseConfiguration({ printers: { kitchen: { host: 123, port: 9100 } } })).toThrow('missing or invalid "host" field');
    });

    test('should reject missing port field', () => {
      expect(() => parseConfiguration({ printers: { kitchen: { host: '192.168.1.1' } } })).toThrow('missing or invalid "port" field');
    });

    test('should reject invalid port field', () => {
      expect(() => parseConfiguration({ printers: { kitchen: { host: '192.168.1.1', port: 'invalid' } } })).toThrow('missing or invalid "port" field');
      expect(() => parseConfiguration({ printers: { kitchen: { host: '192.168.1.1', port: 0 } } })).toThrow('missing or invalid "port" field');
      expect(() => parseConfiguration({ printers: { kitchen: { host: '192.168.1.1', port: 70000 } } })).toThrow('missing or invalid "port" field');
    });

    test('should reject invalid timeout field', () => {
      expect(() => parseConfiguration({ printers: { kitchen: { host: '192.168.1.1', port: 9100, timeout: -1 } } })).toThrow('invalid "timeout" field');
      expect(() => parseConfiguration({ printers: { kitchen: { host: '192.168.1.1', port: 9100, timeout: 'invalid' } } })).toThrow('invalid "timeout" field');
    });
  });

  describe('Configuration Printing', () => {
    test('should format configuration to JSON string', () => {
      const config = {
        printers: {
          kitchen: {
            host: '192.168.1.100',
            port: 9100,
            timeout: 5000
          }
        }
      };

      const printed = printConfiguration(config);
      
      expect(typeof printed).toBe('string');
      expect(() => JSON.parse(printed)).not.toThrow();
    });

    test('should format with consistent indentation', () => {
      const config = {
        printers: {
          kitchen: {
            host: '192.168.1.100',
            port: 9100,
            timeout: 5000
          }
        }
      };

      const printed = printConfiguration(config);
      
      expect(printed).toContain('  "printers"');
      expect(printed).toContain('    "kitchen"');
    });

    test('should reject invalid input', () => {
      expect(() => printConfiguration(null)).toThrow('Configuration must be an object');
      expect(() => printConfiguration('invalid')).toThrow('Configuration must be an object');
    });
  });

  describe('Property 43: Configuration Round-Trip Integrity', () => {
    test('should maintain integrity through parse-print-parse cycle', () => {
      const originalConfig = {
        printers: {
          kitchen: {
            host: '192.168.1.100',
            port: 9100,
            timeout: 5000
          },
          bar: {
            host: '192.168.1.101',
            port: 9101,
            timeout: 3000
          }
        }
      };

      const parsed1 = parseConfiguration(originalConfig);
      const printed = printConfiguration(parsed1);
      const parsed2 = parseConfiguration(printed);
      
      expect(parsed2).toEqual(parsed1);
    });

    test('should maintain integrity through print-parse-print cycle', () => {
      const originalConfig = {
        printers: {
          kitchen: {
            host: '192.168.1.100',
            port: 9100,
            timeout: 5000
          }
        }
      };

      const printed1 = printConfiguration(originalConfig);
      const parsed = parseConfiguration(printed1);
      const printed2 = printConfiguration(parsed);
      
      expect(printed2).toBe(printed1);
    });

    test('should preserve all printer configurations', () => {
      const originalConfig = {
        printers: {
          kitchen: {
            host: '192.168.1.100',
            port: 9100,
            timeout: 5000
          },
          bar: {
            host: '192.168.1.101',
            port: 9101,
            timeout: 3000
          },
          counter: {
            host: '192.168.1.102',
            port: 9102,
            timeout: 4000
          }
        }
      };

      const parsed = parseConfiguration(originalConfig);
      
      expect(Object.keys(parsed.printers).sort()).toEqual(['bar', 'counter', 'kitchen']);
      
      for (const name of Object.keys(originalConfig.printers)) {
        expect(parsed.printers[name]).toHaveProperty('host');
        expect(parsed.printers[name]).toHaveProperty('port');
        expect(parsed.printers[name]).toHaveProperty('timeout');
        expect(parsed.printers[name].host).toBe(originalConfig.printers[name].host);
        expect(parsed.printers[name].port).toBe(originalConfig.printers[name].port);
        expect(parsed.printers[name].timeout).toBe(originalConfig.printers[name].timeout);
      }
    });

    test('should handle edge cases in round-trip', () => {
      const edgeCases = [
        {
          printers: {
            p1: { host: '0.0.0.0', port: 1, timeout: 0 }
          }
        },
        {
          printers: {
            p1: { host: '255.255.255.255', port: 65535, timeout: 30000 }
          }
        },
        {
          printers: {
            a: { host: '192.168.1.1', port: 9100, timeout: 5000 },
            b: { host: '192.168.1.2', port: 9101, timeout: 5000 },
            c: { host: '192.168.1.3', port: 9102, timeout: 5000 },
            d: { host: '192.168.1.4', port: 9103, timeout: 5000 },
            e: { host: '192.168.1.5', port: 9104, timeout: 5000 }
          }
        }
      ];

      for (const config of edgeCases) {
        const parsed1 = parseConfiguration(config);
        const printed = printConfiguration(parsed1);
        const parsed2 = parseConfiguration(printed);
        
        expect(parsed2).toEqual(parsed1);
      }
    });
  });
});
