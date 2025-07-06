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

  // Printing and PDF operations
  printBill: (billData) => ipcRenderer.invoke("print-bill", billData),
  exportPDF: (billData) => ipcRenderer.invoke("export-pdf", billData),
  getPrinterStatus: () => ipcRenderer.invoke("get-printer-status"),
  printKOT: (kotData) => ipcRenderer.invoke("print-kot", kotData),

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

  // Bar settings operations
  getBarSettings: () => ipcRenderer.invoke("get-bar-settings"),
  saveBarSettings: (settings) =>
    ipcRenderer.invoke("save-bar-settings", settings),

  // Report generation
  exportStockReport: (reportData, reportType) =>
    ipcRenderer.invoke("export-stock-report", reportData, reportType),
  exportTransferReport: (transferData) =>
    ipcRenderer.invoke("export-transfer-report", transferData),

  // Email operations
  getEmailSettings: () => ipcRenderer.invoke("get-email-settings"),
  saveEmailSettings: (settings) =>
    ipcRenderer.invoke("save-email-settings", settings),
  testEmailConnection: () => ipcRenderer.invoke("test-email-connection"),
  sendTestEmail: () => ipcRenderer.invoke("send-test-email"),
  sendDailyEmailNow: () => ipcRenderer.invoke("send-daily-email-now"),

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
});
