/**
 * ELECTRON PRELOAD SCRIPT - Secure IPC Bridge
 * 
 * This file creates a secure bridge between the Electron main process and the renderer process.
 * It exposes a limited set of APIs to the renderer while maintaining security by:
 * - Using contextBridge to safely expose APIs
 * - Not exposing Node.js APIs directly
 * - Providing a controlled interface for all backend operations
 * 
 * Security Features:
 * - No direct Node.js access from renderer
 * - Validated API calls through IPC
 * - Controlled data flow between processes
 * 
 * API Categories:
 * - Product Operations: CRUD operations for products
 * - Inventory Operations: Stock management and transfers
 * - Sales Operations: Transaction processing
 * - Printing & PDF: Bill generation and printing
 * - Table Management: Restaurant table operations
 * - Reporting: Business report generation
 * - Email Operations: Automated email reports
 * - Financial Operations: Spendings and balance management
 * - System Operations: Application management
 * 
 * @author Ajit Reddy
 * @version 1.0.0
 * @since 2024
 */

const { contextBridge, ipcRenderer } = require("electron");

/**
 * ELECTRON API BRIDGE
 * 
 * This creates a secure bridge that exposes backend functionality to the React frontend.
 * All operations are performed through IPC (Inter-Process Communication) for security.
 */
contextBridge.exposeInMainWorld("electronAPI", {
  /**
   * PRODUCT OPERATIONS
   * Complete CRUD operations for product catalog management
   */
  getProducts: () => ipcRenderer.invoke("get-products"),                    // Retrieve all products
  addProduct: (product) => ipcRenderer.invoke("add-product", product),      // Add new product
  updateProduct: (id, product) =>                                          // Update existing product
    ipcRenderer.invoke("update-product", id, product),
  deleteProduct: (id) => ipcRenderer.invoke("delete-product", id),         // Delete product

  /**
   * INVENTORY OPERATIONS
   * Stock management and transfer operations between godown and counter
   */
  getInventory: () => ipcRenderer.invoke("get-inventory"),                 // Get current stock levels
  updateStock: (productId, godownStock, counterStock) =>                   // Update stock levels
    ipcRenderer.invoke("update-stock", productId, godownStock, counterStock),
  transferStock: (productId, quantity, fromLocation, toLocation) =>        // Transfer stock between locations
    ipcRenderer.invoke(
      "transfer-stock",
      productId,
      quantity,
      fromLocation,
      toLocation
    ),

  /**
   * SALES OPERATIONS
   * Transaction processing and sales data management
   */
  createSale: (saleData) => ipcRenderer.invoke("create-sale", saleData),   // Process new sale
  getSales: (dateRange) => ipcRenderer.invoke("get-sales", dateRange),     // Get sales data
  getSalesWithDetails: (dateRange) => ipcRenderer.invoke("get-sales-with-details", dateRange), // Get detailed sales

  /**
   * PRINTING AND PDF OPERATIONS
   * Bill generation, printing, and PDF export functionality
   */
  printBill: (billData) => ipcRenderer.invoke("print-bill", billData),     // Print bill on thermal printer
  exportPDF: (billData) => ipcRenderer.invoke("export-pdf", billData),     // Export bill as PDF
  getPrinterStatus: () => ipcRenderer.invoke("get-printer-status"),        // Check printer status
  configurePrinter: (config) => ipcRenderer.invoke("configure-printer", config), // Configure printer
  testPrinterConnection: () => ipcRenderer.invoke("test-printer-connection"), // Test printer connection
  reconnectPrinter: () => ipcRenderer.invoke("reconnect-printer"),         // Reconnect to printer

  // Table management operations
  getTables: () => ipcRenderer.invoke("get-tables"),
  addTable: (table) => ipcRenderer.invoke("add-table", table),
  updateTable: (id, table) => ipcRenderer.invoke("update-table", id, table),
  deleteTable: (id) => ipcRenderer.invoke("delete-table", id),

  // Table order operations
  getTableOrder: (tableId) => ipcRenderer.invoke("get-table-order", tableId),
  saveTableOrder: (orderData) =>
    ipcRenderer.invoke("save-table-order", orderData),
  clearTableOrder: (tableId) =>
    ipcRenderer.invoke("clear-table-order", tableId),

  // Daily transfer operations
  saveDailyTransfer: (transferData) =>
    ipcRenderer.invoke("save-daily-transfer", transferData),
  getDailyTransfers: (dateRange) =>
    ipcRenderer.invoke("get-daily-transfers", dateRange),
  
  // Stock movements history
  getStockMovements: (limit) =>
    ipcRenderer.invoke("get-stock-movements", limit),

  // Bar settings operations
  getBarSettings: () => ipcRenderer.invoke("get-bar-settings"),
  saveBarSettings: (settings) =>
    ipcRenderer.invoke("save-bar-settings", settings),

  // Report generation
  exportStockReport: (reportData, reportType) =>
    ipcRenderer.invoke("export-stock-report", reportData, reportType),
  exportTransferReport: (transferData) =>
    ipcRenderer.invoke("export-transfer-report", transferData),
  exportSalesReport: (salesData, selectedDate) =>
    ipcRenderer.invoke("export-sales-report", salesData, selectedDate),
  exportFinancialReport: (reportData, selectedDate) =>
    ipcRenderer.invoke("export-financial-report", reportData, selectedDate),
  exportPendingBillsReport: (pendingBillsData) =>
    ipcRenderer.invoke("export-pending-bills-report", pendingBillsData),
  exportDailyReport: (reportData, selectedDate) =>
    ipcRenderer.invoke("export-daily-report", reportData, selectedDate),

  // Email operations
  getEmailSettings: () => ipcRenderer.invoke("get-email-settings"),
  saveEmailSettings: (settings) =>
    ipcRenderer.invoke("save-email-settings", settings),
  testEmailConnection: () => ipcRenderer.invoke("test-email-connection"),
  sendTestEmail: () => ipcRenderer.invoke("send-test-email"),
  sendDailyEmailNow: () => ipcRenderer.invoke("send-daily-email-now"),
  sendEmailReportWithPdfs: (selectedDate) => ipcRenderer.invoke("send-email-report-with-pdfs", selectedDate),

  // Spendings operations
  addSpending: (spending) => ipcRenderer.invoke("add-spending", spending),
  updateSpending: (id, spending) =>
    ipcRenderer.invoke("update-spending", id, spending),
  deleteSpending: (id) => ipcRenderer.invoke("delete-spending", id),
  getSpendings: (dateRange) => ipcRenderer.invoke("get-spendings", dateRange),
  getSpendingCategories: () => ipcRenderer.invoke("get-spending-categories"),
  getDailySpendingTotal: (date) =>
    ipcRenderer.invoke("get-daily-spending-total", date),

  // Counter balance operations
  addCounterBalance: (balance) =>
    ipcRenderer.invoke("add-counter-balance", balance),
  updateCounterBalance: (date, balance) =>
    ipcRenderer.invoke("update-counter-balance", date, balance),
  getCounterBalance: (date) => ipcRenderer.invoke("get-counter-balance", date),
  getCounterBalances: (dateRange) =>
    ipcRenderer.invoke("get-counter-balances", dateRange),
  getPreviousDayClosingBalance: (date) =>
    ipcRenderer.invoke("get-previous-day-closing-balance", date),

  // Pending bills operations
  addPendingBill: (billData) => ipcRenderer.invoke("add-pending-bill", billData),
  getPendingBills: () => ipcRenderer.invoke("get-pending-bills"),
  updatePendingBill: (id, billData) => ipcRenderer.invoke("update-pending-bill", id, billData),
  deletePendingBill: (id) => ipcRenderer.invoke("delete-pending-bill", id),
  clearPendingBill: (id) => ipcRenderer.invoke("clear-pending-bill", id),

  // Application reset
  resetApplication: () => ipcRenderer.invoke("reset-application"),
  
  // Close Sell operation
  closeSellAndGenerateReports: () => ipcRenderer.invoke("close-sell-and-generate-reports"),
});
