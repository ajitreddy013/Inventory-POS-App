// Simplified printer service - initially just logs to console
// Can be extended with actual printer integration later

class PrinterService {
  constructor() {
    this.printer = null;
    this.device = null;
    this.isConnected = false;
  }

  async initialize() {
    // Simulate printer connection for now
    // In production, this would connect to actual thermal printer
    console.log('Initializing printer service...');
    this.isConnected = false; // Set to false for demo
    this.device = 'Simulated Printer';
    return Promise.resolve();
  }

  async printKOT(kotData) {
    // Print Kitchen Order Ticket
    console.log('=== KOT PRINTER OUTPUT ===');
    
    const {
      table,
      items,
      notes,
      timestamp,
      shopName = 'Your Shop Name'
    } = kotData;

    const kot = `
      ${shopName.toUpperCase()}
      === KITCHEN ORDER TICKET ===
      
      Table: ${table}
      Time: ${new Date(timestamp).toLocaleString()}
      ================================
      Item                      Qty
      ================================
      ${items.map(item => {
        const itemName = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
        const qtyStr = item.quantity.toString().padStart(3);
        return `${itemName.padEnd(25)} ${qtyStr}`;
      }).join('\n')}
      ================================
      ${notes ? `Notes: ${notes}` : ''}
      ================================
    `;
    
    console.log(kot);
    console.log('=== END KOT PRINTER OUTPUT ===');
    
    return { success: true };
  }

  async printBill(billData) {
    // Simulate printing by logging to console
    console.log('=== THERMAL PRINTER OUTPUT ===');
    
    const { 
      saleNumber, 
      customerName, 
      customerPhone, 
      items, 
      subtotal, 
      taxAmount, 
      discountAmount, 
      totalAmount, 
      paymentMethod,
      saleDate,
      tableName,
      shopName = 'Your Shop Name',
      shopAddress = 'Your Shop Address',
      shopPhone = 'Your Shop Phone'
    } = billData;

    // Simulate thermal printer output
    const receipt = `
      ${shopName.toUpperCase()}
      ${shopAddress}
      Tel: ${shopPhone}
      ================================
      
      Bill No: ${saleNumber}
      Date: ${new Date(saleDate).toLocaleString()}
      ${tableName ? `Table: ${tableName}` : ''}
      Customer: ${customerName || 'Walk-in Customer'}
      ${customerPhone ? `Phone: ${customerPhone}` : ''}
      ================================
      Item                 Qty   Price
      ================================
      ${items.map(item => {
        const itemName = item.name.length > 20 ? item.name.substring(0, 17) + '...' : item.name;
        const qtyStr = item.quantity.toString().padStart(3);
        const priceStr = item.totalPrice.toFixed(2).padStart(7);
        return `${itemName}\n                 ${qtyStr}   ${priceStr}`;
      }).join('\n')}
      ================================
      Subtotal:              ${subtotal.toFixed(2).padStart(7)}
      ${discountAmount > 0 ? `Discount:              ${discountAmount.toFixed(2).padStart(7)}` : ''}
      ${taxAmount > 0 ? `Tax:                   ${taxAmount.toFixed(2).padStart(7)}` : ''}
      ================================
      TOTAL:                 ${totalAmount.toFixed(2).padStart(7)}
      Payment: ${paymentMethod.toUpperCase()}
      ================================
      
      Thank you for your business!
      Visit us again!
    `;
    
    console.log(receipt);
    console.log('=== END THERMAL PRINTER OUTPUT ===');
    
    return { success: true };
  }

  async getStatus() {
    return {
      connected: this.isConnected,
      device: this.device ? 'Serial/USB' : 'Not connected',
      ready: this.isConnected && this.printer !== null
    };
  }

  async disconnect() {
    if (this.device) {
      try {
        await this.device.close();
      } catch (error) {
        console.error('Error closing printer connection:', error);
      }
    }
    this.isConnected = false;
    this.printer = null;
    this.device = null;
  }
}

module.exports = PrinterService;
