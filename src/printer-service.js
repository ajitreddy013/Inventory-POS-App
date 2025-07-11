const escpos = require('escpos');
const fs = require('fs');
const path = require('path');

// Install driver for your printer type
escpos.USB = require('escpos-usb');
escpos.Network = require('escpos-network');
escpos.Serial = require('escpos-serialport');

class PrinterService {
  constructor() {
    this.printer = null;
    this.device = null;
    this.isConnected = false;
    this.config = this.loadConfig();
    this.printerType = this.config.thermal_printer.type;
    this.networkConfig = this.config.thermal_printer.settings.network;
    this.serialConfig = this.config.thermal_printer.settings.serial;
  }

  loadConfig() {
    try {
      const configPath = path.join(__dirname, '..', 'printer-config.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error('Error loading printer config:', error);
      // Return default config if file doesn't exist
      return {
        thermal_printer: {
          enabled: true,
          type: 'usb',
          settings: {
            usb: { auto_detect: true, vendor_id: null, product_id: null },
            network: { host: '192.168.1.100', port: 9100, timeout: 5000 },
            serial: { path: '/dev/ttyUSB0', baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' }
          },
          paper_settings: { width: 80, characters_per_line: 32, line_spacing: 1 },
          formatting: { shop_name_bold: true, item_name_max_length: 18, cut_paper_after_print: true, beep_after_print: false }
        }
      };
    }
  }

  async initialize() {
    console.log("Initializing thermal printer service...");
    try {
      await this.connectThermalPrinter();
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to initialize printer:', error);
      this.isConnected = false;
      this.device = "Connection Failed";
      return Promise.resolve(); // Don't fail the app if printer fails
    }
  }

  async connectThermalPrinter() {
    try {
      if (this.printerType === 'usb') {
        // Try to connect to USB thermal printer
        const devices = escpos.USB.findPrinter();
        if (devices.length > 0) {
          this.device = new escpos.USB(devices[0].vendorId, devices[0].productId);
          this.isConnected = true;
          console.log('USB thermal printer connected:', devices[0]);
        } else {
          console.log('No USB thermal printer found');
          this.isConnected = false;
          this.device = "No USB Printer Found";
        }
      } else if (this.printerType === 'network') {
        this.device = new escpos.Network(this.networkConfig.host, this.networkConfig.port);
        this.isConnected = true;
        console.log('Network thermal printer configured');
      } else if (this.printerType === 'serial') {
        this.device = new escpos.Serial(this.serialConfig.path, {
          baudRate: this.serialConfig.baudRate
        });
        this.isConnected = true;
        console.log('Serial thermal printer configured');
      }
    } catch (error) {
      console.error('Error connecting to thermal printer:', error);
      this.isConnected = false;
      this.device = "Connection Error";
    }
  }


  async printBill(billData) {
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
      tableNumber,
      saleType,
      barSettings,
    } = billData;

    const shopName = barSettings?.bar_name || "Ajit Bar & Restaurant";
    const shopAddress = barSettings?.address || "Address not set";
    const shopPhone = barSettings?.contact_number || "Phone not set";
    const gstNumber = barSettings?.gst_number || "";
    const thankYouMessage =
      barSettings?.thank_you_message || "Thank you for visiting!";

    // Format date as DD/MM/YYYY
    const date = new Date(saleDate);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;
    const formattedTime = date.toLocaleTimeString("en-IN");

    if (this.isConnected && this.device) {
      try {
        // Print to actual thermal printer
        const printer = new escpos.Printer(this.device);
        
        await new Promise((resolve, reject) => {
          this.device.open((error) => {
            if (error) {
              console.error('Error opening printer:', error);
              reject(error);
              return;
            }

            // Start printing
            printer
              .font('a')
              .align('ct')
              .style('bu')
              .size(1, 1)
              .text(shopName.toUpperCase())
              .text('')
              .style('normal')
              .size(0, 0)
              .text(shopAddress)
              .text(`Tel: ${shopPhone}`)
              .text(gstNumber ? `GST: ${gstNumber}` : '')
              .text('================================')
              .text('')
              .align('lt')
              .style('b')
              .text('BILL')
              .style('normal')
              .text(`Bill No: ${saleNumber}`)
              .text(`Date: ${formattedDate}`)
              .text(`Time: ${formattedTime}`);

            // Sale type and table info
            if (saleType === "table" && tableNumber) {
              printer.text(`Table: ${tableNumber}`);
            } else {
              printer.text('PARCEL ORDER');
            }

            // Customer info if provided
            if (customerName && customerName.trim() !== "") {
              printer.text(`Customer: ${customerName}`);
            }
            if (customerPhone && customerPhone.trim() !== "") {
              printer.text(`Phone: ${customerPhone}`);
            }

            printer
              .text('================================')
              .text('ITEM                QTY  RATE  AMT')
              .text('================================');

            // Print each item
            items.forEach((item) => {
              const itemName = item.name.length > 18
                ? item.name.substring(0, 15) + "..."
                : item.name.padEnd(18);
              const qtyStr = item.quantity.toString().padStart(3);
              const rateStr = item.unitPrice.toFixed(2).padStart(6);
              const amountStr = item.totalPrice.toFixed(2).padStart(6);
              printer.text(`${itemName} ${qtyStr} ${rateStr} ${amountStr}`);
            });

            printer.text('================================');
            
            // Summary section
            printer.text(`Subtotal:                ${subtotal.toFixed(2).padStart(8)}`);
            
            if (discountAmount > 0) {
              printer.text(`Discount:                ${discountAmount.toFixed(2).padStart(8)}`);
            }
            
            if (taxAmount > 0) {
              printer.text(`Tax:                     ${taxAmount.toFixed(2).padStart(8)}`);
            }
            
            printer
              .text('================================')
              .style('b')
              .text(`TOTAL:                   ${totalAmount.toFixed(2).padStart(8)}`)
              .style('normal')
              .text(`Payment: ${paymentMethod.toUpperCase()}`)
              .text('================================')
              .text('')
              .align('ct')
              .style('b')
              .text(thankYouMessage)
              .style('normal')
              .text('Visit us again!')
              .text('================================')
              .text('')
              .cut()
              .close(() => {
                console.log('Bill printed successfully');
                resolve();
              });
          });
        });

        return { success: true };
      } catch (error) {
        console.error('Error printing bill:', error);
        // Fall back to console logging
        this.logBillToConsole(billData);
        return { success: false, error: error.message };
      }
    } else {
      // Fall back to console logging
      this.logBillToConsole(billData);
      return { success: true, fallback: true };
    }
  }

  logBillToConsole(billData) {
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
      tableNumber,
      saleType,
      barSettings,
    } = billData;

    const shopName = barSettings?.bar_name || "Ajit Bar & Restaurant";
    const shopAddress = barSettings?.address || "Address not set";
    const shopPhone = barSettings?.contact_number || "Phone not set";
    const gstNumber = barSettings?.gst_number || "";
    const thankYouMessage =
      barSettings?.thank_you_message || "Thank you for visiting!";

    // Format date as DD/MM/YYYY
    const date = new Date(saleDate);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const formattedDate = `${day}/${month}/${year}`;

    // Simulate thermal printer output with proper formatting
    const receipt = `
${shopName.toUpperCase().padEnd(32)}
${shopAddress.padEnd(32)}
Tel: ${shopPhone.padEnd(25)}
${gstNumber ? `GST: ${gstNumber.padEnd(25)}` : ""}
${"=".repeat(32)}
BILL NO: ${saleNumber.padEnd(20)}
DATE: ${formattedDate.padEnd(20)}
TIME: ${new Date(saleDate).toLocaleTimeString("en-IN").padEnd(20)}
${
  saleType === "table" && tableNumber
    ? `TABLE: ${tableNumber.padEnd(20)}`
    : "PARCEL ORDER".padEnd(32)
}
${
  customerName && customerName.trim() !== ""
    ? `CUSTOMER: ${customerName.padEnd(20)}`
    : ""
}
${
  customerPhone && customerPhone.trim() !== ""
    ? `PHONE: ${customerPhone.padEnd(20)}`
    : ""
}
${"=".repeat(32)}
ITEM                    QTY   RATE    AMOUNT
${"=".repeat(32)}
${items
  .map((item) => {
    const itemName =
      item.name.length > 18
        ? item.name.substring(0, 15) + "..."
        : item.name.padEnd(18);
    const qtyStr = item.quantity.toString().padStart(3);
    const rateStr = item.unitPrice.toFixed(2).padStart(7);
    const amountStr = item.totalPrice.toFixed(2).padStart(8);
    return `${itemName} ${qtyStr} ${rateStr} ${amountStr}`;
  })
  .join("\n")}
${"=".repeat(32)}
SUBTOTAL:                    ${subtotal.toFixed(2).padStart(8)}
${
  discountAmount > 0
    ? `DISCOUNT:                    ${discountAmount.toFixed(2).padStart(8)}`
    : ""
}
${
  taxAmount > 0
    ? `TAX:                       ${taxAmount.toFixed(2).padStart(8)}`
    : ""
}
${"=".repeat(32)}
TOTAL:                       ${totalAmount.toFixed(2).padStart(8)}
PAYMENT: ${paymentMethod.toUpperCase().padEnd(25)}
${"=".repeat(32)}

${thankYouMessage.padEnd(32)}
Visit us again!
${"=".repeat(32)}
    `;

    console.log("=== THERMAL PRINTER OUTPUT ===");
    console.log(receipt);
    console.log("=== END THERMAL PRINTER OUTPUT ===");
  }

  // Configuration methods
  setPrinterType(type) {
    this.printerType = type; // 'usb', 'network', 'serial'
    console.log(`Printer type set to: ${type}`);
  }

  setNetworkConfig(host, port = 9100) {
    this.networkConfig = { host, port };
    console.log(`Network printer configured: ${host}:${port}`);
  }

  setSerialConfig(path, baudRate = 9600) {
    this.serialConfig = { path, baudRate };
    console.log(`Serial printer configured: ${path} at ${baudRate} baud`);
  }

  async getStatus() {
    return {
      connected: this.isConnected,
      device: this.device ? `${this.printerType.toUpperCase()} Printer` : "Not connected",
      ready: this.isConnected && this.device !== null,
      type: this.printerType,
      config: this.printerType === 'network' ? this.networkConfig : 
              this.printerType === 'serial' ? this.serialConfig : 'USB Auto-detect'
    };
  }

  async reconnect() {
    console.log('Attempting to reconnect printer...');
    await this.disconnect();
    await this.connectThermalPrinter();
    return this.getStatus();
  }

  async disconnect() {
    if (this.device) {
      try {
        if (typeof this.device.close === 'function') {
          await this.device.close();
        }
      } catch (error) {
        console.error("Error closing printer connection:", error);
      }
    }
    this.isConnected = false;
    this.printer = null;
    this.device = null;
  }
}

module.exports = PrinterService;
