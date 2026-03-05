/**
 * Thermal Printer Driver Tests
 * 
 * Tests ESC/POS command generation, connection handling, and error scenarios
 * Requirements: 7.1, 23.4
 */

const { ESCPOSFormatter, ThermalPrinterDriver } = require('../thermalPrinterDriver');

// Mock the net module to prevent actual network connections
jest.mock('net', () => {
  const EventEmitter = require('events');
  
  class MockSocket extends EventEmitter {
    constructor() {
      super();
      this.destroyed = false;
    }
    
    connect(port, host, callback) {
      // Simulate connection timeout
      setTimeout(() => {
        this.emit('error', new Error(`Connection timeout after 5000ms`));
      }, 10);
      return this;
    }
    
    write(data, callback) {
      if (callback) callback();
      return true;
    }
    
    destroy() {
      this.destroyed = true;
      setTimeout(() => this.emit('close'), 0);
    }
    
    setTimeout() {}
  }
  
  return {
    Socket: MockSocket,
    createConnection: (options, callback) => {
      const socket = new MockSocket();
      socket.connect(options.port, options.host, callback);
      return socket;
    }
  };
});

describe('ESCPOSFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new ESCPOSFormatter();
  });

  describe('Command Generation', () => {
    test('should generate initialize command', () => {
      const cmd = formatter.initialize();
      expect(cmd).toBeInstanceOf(Buffer);
      expect(cmd.toString()).toContain('\x1B@');
    });

    test('should generate left alignment command', () => {
      const cmd = formatter.setAlignment('left');
      expect(cmd).toBeInstanceOf(Buffer);
      expect(cmd[cmd.length - 1]).toBe(0);
    });

    test('should generate center alignment command', () => {
      const cmd = formatter.setAlignment('center');
      expect(cmd).toBeInstanceOf(Buffer);
      expect(cmd[cmd.length - 1]).toBe(1);
    });

    test('should generate right alignment command', () => {
      const cmd = formatter.setAlignment('right');
      expect(cmd).toBeInstanceOf(Buffer);
      expect(cmd[cmd.length - 1]).toBe(2);
    });

    test('should generate bold enable command', () => {
      const cmd = formatter.setBold(true);
      expect(cmd).toBeInstanceOf(Buffer);
      expect(cmd[cmd.length - 1]).toBe(1);
    });

    test('should generate bold disable command', () => {
      const cmd = formatter.setBold(false);
      expect(cmd).toBeInstanceOf(Buffer);
      expect(cmd[cmd.length - 1]).toBe(0);
    });

    test('should generate text size command', () => {
      const cmd = formatter.setTextSize(2, 2);
      expect(cmd).toBeInstanceOf(Buffer);
      // Width 2 (index 1) = 0x10, Height 2 (index 1) = 0x01
      // Combined: 0x11
      expect(cmd[cmd.length - 1]).toBe(0x11);
    });

    test('should clamp text size to valid range', () => {
      const cmd = formatter.setTextSize(10, 10);
      expect(cmd).toBeInstanceOf(Buffer);
      // Max size is 8, so 8-1=7, 0x70 | 0x07 = 0x77
      expect(cmd[cmd.length - 1]).toBe(0x77);
    });

    test('should generate text command with line feed', () => {
      const cmd = formatter.text('Hello World');
      expect(cmd).toBeInstanceOf(Buffer);
      expect(cmd.toString()).toBe('Hello World\x0A');
    });

    test('should generate line separator', () => {
      const cmd = formatter.line(32);
      expect(cmd).toBeInstanceOf(Buffer);
      expect(cmd.toString()).toBe('================================\x0A');
    });

    test('should generate custom length line separator', () => {
      const cmd = formatter.line(10);
      expect(cmd).toBeInstanceOf(Buffer);
      expect(cmd.toString()).toBe('==========\x0A');
    });

    test('should generate feed command', () => {
      const cmd = formatter.feed(3);
      expect(cmd).toBeInstanceOf(Buffer);
      expect(cmd[cmd.length - 1]).toBe(3);
    });

    test('should generate full cut command', () => {
      const cmd = formatter.cut(false);
      expect(cmd).toBeInstanceOf(Buffer);
      expect(cmd[cmd.length - 1]).toBe(0);
    });

    test('should generate partial cut command', () => {
      const cmd = formatter.cut(true);
      expect(cmd).toBeInstanceOf(Buffer);
      expect(cmd[cmd.length - 1]).toBe(1);
    });

    test('should generate cash drawer command', () => {
      const cmd = formatter.openDrawer();
      expect(cmd).toBeInstanceOf(Buffer);
      expect(cmd.length).toBeGreaterThan(0);
    });
  });
});

describe('ThermalPrinterDriver', () => {
  let driver;
  let consoleErrorSpy;
  let consoleLogSpy;

  beforeEach(() => {
    driver = new ThermalPrinterDriver();
    // Suppress console output during tests
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    await driver.disconnectAll();
    // Give time for all async operations to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    // Restore console
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('Printer Management', () => {
    test('should initialize with empty printer list', () => {
      expect(driver.printers.size).toBe(0);
      expect(driver.printQueue.size).toBe(0);
    });

    test('should add printer configuration', async () => {
      const config = {
        host: '192.168.1.100',
        port: 9100,
        timeout: 5000
      };

      // This will fail to connect but should still add the printer
      await driver.addPrinter('kitchen', config);
      
      expect(driver.printers.has('kitchen')).toBe(true);
      expect(driver.printQueue.has('kitchen')).toBe(true);
    });

    test('should check printer status when not configured', async () => {
      const status = await driver.checkStatus('kitchen');
      
      expect(status.status).toBe('not_configured');
      expect(status.online).toBe(false);
      expect(status.error).toBe('Printer not configured');
    });

    test('should get all printer statuses', async () => {
      const config = {
        host: '192.168.1.100',
        port: 9100,
        timeout: 5000
      };

      await driver.addPrinter('kitchen', config);
      await driver.addPrinter('bar', config);

      const statuses = await driver.getAllStatuses();
      
      expect(statuses).toHaveProperty('kitchen');
      expect(statuses).toHaveProperty('bar');
    });
  });

  describe('KOT Formatting', () => {
    test('should format KOT with all required fields', () => {
      const kot = {
        id: 'kot_123',
        kotNumber: 'KOT-001',
        orderNumber: 'ORD-001',
        tableNumber: 'T1',
        waiterName: 'John',
        timestamp: '14:30',
        printerType: 'kitchen',
        items: [
          {
            id: 'item_1',
            name: 'Chicken Biryani',
            quantity: 2,
            modifiers: 'Extra Spicy',
            isIncremental: false
          }
        ]
      };

      const buffer = driver.formatKOT(kot);
      
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      
      const content = buffer.toString();
      expect(content).toContain('KITCHEN ORDER');
      expect(content).toContain('ORD-001');
      expect(content).toContain('KOT-001');
      expect(content).toContain('T1');
      expect(content).toContain('John');
      expect(content).toContain('14:30');
      expect(content).toContain('Chicken Biryani');
    });

    test('should format incremental items with + prefix', () => {
      const kot = {
        id: 'kot_123',
        kotNumber: 'KOT-002',
        orderNumber: 'ORD-001',
        tableNumber: 'T1',
        waiterName: 'John',
        timestamp: '14:35',
        printerType: 'kitchen',
        items: [
          {
            id: 'item_1',
            name: 'Chicken Biryani',
            quantity: 1,
            modifiers: '',
            isIncremental: true
          }
        ]
      };

      const buffer = driver.formatKOT(kot);
      const content = buffer.toString();
      
      expect(content).toContain('+1');
    });

    test('should format items with modifiers', () => {
      const kot = {
        id: 'kot_123',
        kotNumber: 'KOT-003',
        orderNumber: 'ORD-002',
        tableNumber: 'T2',
        waiterName: 'Jane',
        timestamp: '15:00',
        printerType: 'bar',
        items: [
          {
            id: 'item_1',
            name: 'Mojito',
            quantity: 2,
            modifiers: 'Extra Mint, No Sugar',
            isIncremental: false
          }
        ]
      };

      const buffer = driver.formatKOT(kot);
      const content = buffer.toString();
      
      expect(content).toContain('Mojito');
      expect(content).toContain('Extra Mint, No Sugar');
    });

    test('should format multiple items', () => {
      const kot = {
        id: 'kot_123',
        kotNumber: 'KOT-004',
        orderNumber: 'ORD-003',
        tableNumber: 'T3',
        waiterName: 'Bob',
        timestamp: '16:00',
        printerType: 'kitchen',
        items: [
          {
            id: 'item_1',
            name: 'Chicken Biryani',
            quantity: 2,
            modifiers: 'Medium Spicy',
            isIncremental: false
          },
          {
            id: 'item_2',
            name: 'Paneer Tikka',
            quantity: 1,
            modifiers: '',
            isIncremental: false
          }
        ]
      };

      const buffer = driver.formatKOT(kot);
      const content = buffer.toString();
      
      expect(content).toContain('Chicken Biryani');
      expect(content).toContain('Paneer Tikka');
      expect(content).toContain('Medium Spicy');
    });
  });

  describe('Print Queue and Retry', () => {
    test('should queue failed print for retry', async () => {
      const kot = {
        id: 'kot_123',
        kotNumber: 'KOT-005',
        orderNumber: 'ORD-004',
        tableNumber: 'T4',
        waiterName: 'Alice',
        timestamp: '17:00',
        printerType: 'kitchen',
        items: []
      };

      await driver.queueForRetry(kot, 'kitchen', 'Printer offline');
      
      expect(driver.retryQueue.length).toBe(1);
      expect(driver.retryQueue[0].kot.kotNumber).toBe('KOT-005');
      expect(driver.retryQueue[0].errorMessage).toBe('Printer offline');
    });

    test('should get failed prints', async () => {
      const kot1 = {
        id: 'kot_1',
        kotNumber: 'KOT-006',
        orderNumber: 'ORD-005',
        tableNumber: 'T5',
        waiterName: 'Charlie',
        timestamp: '18:00',
        printerType: 'bar',
        items: []
      };

      const kot2 = {
        id: 'kot_2',
        kotNumber: 'KOT-007',
        orderNumber: 'ORD-006',
        tableNumber: 'T6',
        waiterName: 'Diana',
        timestamp: '18:30',
        printerType: 'kitchen',
        items: []
      };

      await driver.queueForRetry(kot1, 'bar', 'Paper out');
      await driver.queueForRetry(kot2, 'kitchen', 'Connection lost');

      const failedPrints = driver.getFailedPrints();
      
      expect(failedPrints.length).toBe(2);
      expect(failedPrints[0].kotNumber).toBe('KOT-006');
      expect(failedPrints[1].kotNumber).toBe('KOT-007');
    });

    test('should track retry count', async () => {
      const kot = {
        id: 'kot_123',
        kotNumber: 'KOT-008',
        orderNumber: 'ORD-007',
        tableNumber: 'T7',
        waiterName: 'Eve',
        timestamp: '19:00',
        printerType: 'kitchen',
        items: []
      };

      await driver.queueForRetry(kot, 'kitchen', 'Test error');
      
      const failedPrints = driver.getFailedPrints();
      expect(failedPrints[0].retryCount).toBe(0);
      expect(failedPrints[0].maxRetries).toBe(5);
    });
  });

  describe('Error Handling', () => {
    test('should handle printer not configured error', async () => {
      const kot = {
        id: 'kot_123',
        kotNumber: 'KOT-009',
        orderNumber: 'ORD-008',
        tableNumber: 'T8',
        waiterName: 'Frank',
        timestamp: '20:00',
        printerType: 'kitchen',
        items: []
      };

      const result = await driver.printKOT(kot, 'kitchen');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    test('should handle printer offline error', async () => {
      const config = {
        host: '192.168.1.100',
        port: 9100,
        timeout: 1000
      };

      await driver.addPrinter('kitchen', config);

      const kot = {
        id: 'kot_123',
        kotNumber: 'KOT-010',
        orderNumber: 'ORD-009',
        tableNumber: 'T9',
        waiterName: 'Grace',
        timestamp: '21:00',
        printerType: 'kitchen',
        items: []
      };

      const result = await driver.printKOT(kot, 'kitchen');
      
      expect(result.success).toBe(false);
      expect(result.queued).toBe(true);
    });
  });

  describe('Retry Processor', () => {
    test('should start retry processor', () => {
      driver.startRetryProcessor(1000);
      expect(driver.retryInterval).toBeDefined();
    });

    test('should stop retry processor', () => {
      driver.startRetryProcessor(1000);
      driver.stopRetryProcessor();
      expect(driver.retryInterval).toBeNull();
    });

    test('should not crash if stopped when not started', () => {
      expect(() => driver.stopRetryProcessor()).not.toThrow();
    });
  });
});

describe('Integration Tests', () => {
  test('should format and prepare KOT for printing', () => {
    const driver = new ThermalPrinterDriver();
    
    const kot = {
      id: 'kot_integration',
      kotNumber: 'KOT-INT-001',
      orderNumber: 'ORD-INT-001',
      tableNumber: 'T10',
      waiterName: 'Integration Test',
      timestamp: '22:00',
      printerType: 'kitchen',
      items: [
        {
          id: 'item_1',
          name: 'Test Item 1',
          quantity: 3,
          modifiers: 'Test Modifier',
          isIncremental: false
        },
        {
          id: 'item_2',
          name: 'Test Item 2',
          quantity: 1,
          modifiers: '',
          isIncremental: true
        }
      ]
    };

    const buffer = driver.formatKOT(kot);
    
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
    
    const content = buffer.toString();
    expect(content).toContain('KITCHEN ORDER');
    expect(content).toContain('KOT-INT-001');
    expect(content).toContain('Test Item 1');
    expect(content).toContain('Test Item 2');
    expect(content).toContain('+1'); // Incremental item
  });
});
