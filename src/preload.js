const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Product operations
  getProducts: () => ipcRenderer.invoke("get-products"),
  addProduct: (product) => ipcRenderer.invoke("add-product", product),
  updateProduct: (id, product) =>
    ipcRenderer.invoke("update-product", id, product),
  deleteProduct: (id) => ipcRenderer.invoke("delete-product", id),

  // Inventory operations
  getInventory: () => ipcRenderer.invoke("get-inventory"),
  updateStock: (productId, godownStock, counterStock) =>
    ipcRenderer.invoke("update-stock", productId, godownStock, counterStock),
  transferStock: (productId, quantity, fromLocation, toLocation) =>
    ipcRenderer.invoke(
      "transfer-stock",
      productId,
      quantity,
      fromLocation,
      toLocation
    ),

  // Sales operations
  createSale: (saleData) => ipcRenderer.invoke("create-sale", saleData),
  getSales: (dateRange) => ipcRenderer.invoke("get-sales", dateRange),
  getSalesWithDetails: (dateRange) => ipcRenderer.invoke("get-sales-with-details", dateRange),

  // Printing and PDF operations
  printBill: (billData) => ipcRenderer.invoke("print-bill", billData),
  exportPDF: (billData) => ipcRenderer.invoke("export-pdf", billData),
  getPrinterStatus: () => ipcRenderer.invoke("get-printer-status"),
  configurePrinter: (config) => ipcRenderer.invoke("configure-printer", config),
  testPrinterConnection: () => ipcRenderer.invoke("test-printer-connection"),
  reconnectPrinter: () => ipcRenderer.invoke("reconnect-printer"),

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
