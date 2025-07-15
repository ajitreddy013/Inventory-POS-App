const PrinterService = require('../src/printer-service');

async function testThermalPrinter() {
  console.log('Testing Thermal Printer Service...');
  
  const printerService = new PrinterService();
  
  // Initialize the printer service
  await printerService.initialize();
  
  // Check status
  const status = await printerService.getStatus();
  console.log('Printer Status:', status);
  
  // Test bill printing with sample data
  const testBillData = {
    saleNumber: 'TEST-001',
    customerName: 'John Doe',
    customerPhone: '1234567890',
    items: [
      { name: 'Chicken Biryani', quantity: 2, unitPrice: 150, totalPrice: 300 },
      { name: 'Mutton Curry', quantity: 1, unitPrice: 200, totalPrice: 200 },
      { name: 'Naan', quantity: 3, unitPrice: 30, totalPrice: 90 }
    ],
    subtotal: 590,
    taxAmount: 59,
    discountAmount: 0,
    totalAmount: 649,
    paymentMethod: 'cash',
    saleDate: new Date().toISOString(),
    tableNumber: '5',
    saleType: 'table',
    barSettings: {
      bar_name: 'Test Restaurant',
      address: '123 Test Street, Test City',
      contact_number: '9876543210',
      gst_number: 'GST123456789',
      thank_you_message: 'Thank you for dining with us!'
    }
  };
  
  console.log('Testing bill printing...');
  const printResult = await printerService.printBill(testBillData);
  console.log('Print Result:', printResult);
  
  // Test with different item counts to verify dynamic height
  const shortBillData = {
    ...testBillData,
    saleNumber: 'TEST-002',
    items: [
      { name: 'Tea', quantity: 1, unitPrice: 20, totalPrice: 20 }
    ],
    subtotal: 20,
    taxAmount: 2,
    totalAmount: 22
  };
  
  console.log('Testing bill with fewer items...');
  const shortPrintResult = await printerService.printBill(shortBillData);
  console.log('Short Print Result:', shortPrintResult);
  
  // Test with many items
  const longBillData = {
    ...testBillData,
    saleNumber: 'TEST-003',
    items: [
      { name: 'Chicken Biryani', quantity: 2, unitPrice: 150, totalPrice: 300 },
      { name: 'Mutton Curry', quantity: 1, unitPrice: 200, totalPrice: 200 },
      { name: 'Naan', quantity: 3, unitPrice: 30, totalPrice: 90 },
      { name: 'Rice', quantity: 2, unitPrice: 50, totalPrice: 100 },
      { name: 'Dal', quantity: 1, unitPrice: 80, totalPrice: 80 },
      { name: 'Paneer Tikka', quantity: 1, unitPrice: 180, totalPrice: 180 },
      { name: 'Roti', quantity: 4, unitPrice: 25, totalPrice: 100 },
      { name: 'Lassi', quantity: 2, unitPrice: 60, totalPrice: 120 },
      { name: 'Pickle', quantity: 1, unitPrice: 10, totalPrice: 10 },
      { name: 'Papad', quantity: 2, unitPrice: 15, totalPrice: 30 }
    ],
    subtotal: 1210,
    taxAmount: 121,
    totalAmount: 1331
  };
  
  console.log('Testing bill with many items...');
  const longPrintResult = await printerService.printBill(longBillData);
  console.log('Long Print Result:', longPrintResult);
  
  // Test printer configuration
  console.log('Testing printer configuration...');
  printerService.setPrinterType('network');
  printerService.setNetworkConfig('192.168.1.100', 9100);
  
  const statusAfterConfig = await printerService.getStatus();
  console.log('Status after configuration:', statusAfterConfig);
  
  console.log('Thermal printer test completed!');
}

// Run the test
testThermalPrinter().catch(console.error);
