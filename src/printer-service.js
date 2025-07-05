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
    console.log("Initializing printer service...");
    this.isConnected = false; // Set to false for demo
    this.device = "Simulated Printer";
    return Promise.resolve();
  }

  async printKOT(kotData) {
    // Print Kitchen Order Ticket
    console.log("=== KOT PRINTER OUTPUT ===");

    const {
      table,
      items,
      notes,
      timestamp,
      shopName = "Your Shop Name",
    } = kotData;

    const kot = `
      ${shopName.toUpperCase()}
      === KITCHEN ORDER TICKET ===
      
      Table: ${table}
      Time: ${new Date(timestamp).toLocaleString()}
      ================================
      Item                      Qty
      ================================
      ${items
        .map((item) => {
          const itemName =
            item.name.length > 25
              ? item.name.substring(0, 22) + "..."
              : item.name;
          const qtyStr = item.quantity.toString().padStart(3);
          return `${itemName.padEnd(25)} ${qtyStr}`;
        })
        .join("\n")}
      ================================
      ${notes ? `Notes: ${notes}` : ""}
      ================================
    `;

    console.log(kot);
    console.log("=== END KOT PRINTER OUTPUT ===");

    return { success: true };
  }

  async printBill(billData) {
    // Simulate printing by logging to console
    console.log("=== THERMAL PRINTER OUTPUT ===");

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

    // Simulate thermal printer output with proper formatting
    const receipt = `
${shopName.toUpperCase().padEnd(32)}
${shopAddress.padEnd(32)}
Tel: ${shopPhone.padEnd(25)}
${gstNumber ? `GST: ${gstNumber.padEnd(25)}` : ""}
${"=".repeat(32)}
BILL NO: ${saleNumber.padEnd(20)}
DATE: ${new Date(saleDate).toLocaleDateString("en-IN").padEnd(20)}
TIME: ${new Date(saleDate).toLocaleTimeString("en-IN").padEnd(20)}
${
  saleType === "table" && tableNumber
    ? `TABLE: ${tableNumber.padEnd(20)}`
    : "PARCEL ORDER".padEnd(32)
}
CUSTOMER: ${(customerName || "Walk-in").padEnd(20)}
${customerPhone ? `PHONE: ${customerPhone.padEnd(20)}` : ""}
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

    console.log(receipt);
    console.log("=== END THERMAL PRINTER OUTPUT ===");

    return { success: true };
  }

  async getStatus() {
    return {
      connected: this.isConnected,
      device: this.device ? "Serial/USB" : "Not connected",
      ready: this.isConnected && this.printer !== null,
    };
  }

  async disconnect() {
    if (this.device) {
      try {
        await this.device.close();
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
