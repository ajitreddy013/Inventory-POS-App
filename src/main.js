const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const isDev = require("electron-is-dev");
const cron = require("node-cron");
const Database = require("./database");
const PrinterService = require("./printer-service");
const PDFService = require("./pdf-service");
const ReportService = require("./services/reportService");
const DailyReportService = require("./services/dailyReportService");
const EmailService = require("./email-service");
const { initializeSampleData } = require("./init-sample-data");
const { 
  getLocalDateString, 
  getLocalDateTimeString, 
  getStartOfDay, 
  getEndOfDay,
  formatDateTimeToString
} = require("./utils/dateUtils");

let mainWindow;
let database;
let printerService;
let pdfService;
let reportService;
let dailyReportService;
let emailService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      preload: path.join(__dirname, "preload.js"),
      sandbox: false, // Keep false for preload script access
    },
    icon: path.join(__dirname, "../assets/icon.png"),
  });

  const startUrl = isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../build/index.html")}`;

  // Force production mode for now
  const forcedUrl = `file://${path.join(__dirname, "../build/index.html")}`;
  console.log('Loading URL:', forcedUrl);
  mainWindow.loadURL(forcedUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize database
  database = new Database();
  await database.initialize();

  // Initialize sample data (only if no products exist)
  try {
    const products = await database.getProducts();
    if (products.length === 0) {
      console.log("No existing products found, initializing sample data...");
      await initializeSampleData(database);
    }
  } catch (error) {
    console.log("Sample data initialization skipped:", error.message);
  }

  // Initialize services
  printerService = new PrinterService();
  pdfService = new PDFService();
  reportService = new ReportService();
  dailyReportService = new DailyReportService();
  emailService = new EmailService();

  // Setup daily email report cron job (runs at 11:59 PM every day)
  cron.schedule("59 23 * * *", async () => {
    console.log("Running daily email report job...");
    await sendDailyEmailReport();
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Function to send daily email report
async function sendDailyEmailReport() {
  try {
    const todayDate = getLocalDateString();
    
    // Get dashboard data - inventory info
    const inventory = await database.getProducts();
    const lowStockItems = inventory.filter(
      (item) => item.godown_stock + item.counter_stock <= item.min_stock_level
    );
    
    // Get sales data with details
    const salesData = await database.getSalesWithDetails({
      start: getStartOfDay(todayDate),
      end: getEndOfDay(todayDate),
    });

    // Get spendings data
    const spendingsData = await database.getSpendings({
      start: getStartOfDay(todayDate),
      end: getEndOfDay(todayDate),
    });

    // Get counter balance data
    const counterBalances = await database.getCounterBalances({
      start: getStartOfDay(todayDate),
      end: getEndOfDay(todayDate),
    });

    // Calculate totals
    const totalRevenue = salesData.reduce((sum, sale) => sum + sale.total_amount, 0);
    const totalSpendings = spendingsData.reduce((sum, spending) => sum + spending.amount, 0);
    const totalOpeningBalance = counterBalances.reduce((sum, balance) => sum + balance.opening_balance, 0);
    const netIncome = totalRevenue - totalSpendings;
    const totalBalance = netIncome + totalOpeningBalance;

    const reportData = {
      // Dashboard values
      totalProducts: inventory.length,
      lowStockItems: lowStockItems.length,
      todaySales: salesData.length,
      // Financial values
      totalAmount: totalRevenue,
      totalRevenue: totalRevenue,
      totalSpendings: totalSpendings,
      netIncome: netIncome,
      totalOpeningBalance: totalOpeningBalance,
      totalBalance: totalBalance,
      totalTransactions: salesData.length,
      tableSales: salesData.filter((sale) => sale.sale_type === "table").length,
      parcelSales: salesData.filter((sale) => sale.sale_type === "parcel").length,
      topItems: await getTopSellingItems(salesData),
    };

    // Generate PDF reports
    const attachmentPaths = [];
    const timestamp = new Date().getTime();
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    try {
      // Generate comprehensive daily report PDF
      const dailyPdfPath = path.join(__dirname, `../temp/daily-report-${todayDate}-${timestamp}.pdf`);
      const dailyReportResult = await dailyReportService.generateDailyReport(reportData, todayDate, dailyPdfPath);
      
      if (dailyReportResult.success) {
        attachmentPaths.push({
          path: dailyPdfPath,
          filename: `daily-report-${todayDate}.pdf`
        });
      }
    } catch (error) {
      console.error("Error generating daily report PDF:", error);
    }
    
    try {
      // Generate sales report PDF
      const salesPdfPath = path.join(__dirname, `../temp/sales-report-${todayDate}-${timestamp}.pdf`);
      
      const salesResult = await reportService.generateSalesReport(salesData, todayDate, salesPdfPath);
      if (salesResult.success) {
        attachmentPaths.push({
          path: salesPdfPath,
          filename: `sales-report-${todayDate}.pdf`
        });
      }
    } catch (error) {
      console.error("Error generating sales PDF:", error);
    }

    try {
      // Generate financial report PDF
      const financialPdfPath = path.join(__dirname, `../temp/financial-report-${todayDate}-${timestamp}.pdf`);
      
      const financialReportData = {
        sales: salesData,
        spendings: spendingsData,
        counterBalances: counterBalances,
        totalRevenue: totalRevenue,
        totalSpendings: totalSpendings,
        netIncome: netIncome,
        totalOpeningBalance: totalOpeningBalance,
        totalBalance: totalBalance
      };
      
      const financialResult = await reportService.generateFinancialReport(financialReportData, todayDate, financialPdfPath);
      if (financialResult.success) {
        attachmentPaths.push({
          path: financialPdfPath,
          filename: `financial-report-${todayDate}.pdf`
        });
      }
    } catch (error) {
      console.error("Error generating financial PDF:", error);
    }

    // Send email with PDF attachments
    const result = await emailService.sendDailyReport(reportData, attachmentPaths);
    if (result.success) {
      console.log("Daily email report sent successfully with PDF attachments");
    } else {
      console.error("Failed to send daily email report:", result.error);
    }

    // Clean up temporary PDF files
    attachmentPaths.forEach(attachment => {
      try {
        if (fs.existsSync(attachment.path)) {
          fs.unlinkSync(attachment.path);
        }
      } catch (error) {
        console.error("Error cleaning up temporary PDF:", error);
      }
    });
  } catch (error) {
    console.error("Error in daily email report:", error);
  }
}

// Function to get top selling items
async function getTopSellingItems(salesData) {
  const itemMap = new Map();

  for (const sale of salesData) {
    try {
      const saleItems = JSON.parse(sale.items || "[]");
      saleItems.forEach((item) => {
        if (itemMap.has(item.name)) {
          const existing = itemMap.get(item.name);
          existing.quantity += item.quantity;
          existing.revenue += item.quantity * item.price;
        } else {
          itemMap.set(item.name, {
            name: item.name,
            quantity: item.quantity,
            revenue: item.quantity * item.price,
          });
        }
      });
    } catch (error) {
      console.error("Error parsing sale items:", error);
    }
  }

  return Array.from(itemMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Input validation helpers
function validateId(id) {
  if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
    throw new Error('Invalid ID provided');
  }
  return Number(id);
}

function validateObject(obj, requiredFields = []) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Invalid object provided');
  }
  
  for (const field of requiredFields) {
    if (!(field in obj)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  return obj;
}

// IPC handlers for database operations
ipcMain.handle("get-products", async () => {
  try {
    return await database.getProducts();
  } catch (error) {
    console.error('Error in get-products:', error);
    throw error;
  }
});

ipcMain.handle("add-product", async (event, product) => {
  try {
    validateObject(product, ['name', 'sku', 'price', 'cost']);
    return await database.addProduct(product);
  } catch (error) {
    console.error('Error in add-product:', error);
    throw error;
  }
});

ipcMain.handle("update-product", async (event, id, product) => {
  try {
    const validId = validateId(id);
    validateObject(product, ['name', 'sku', 'price', 'cost']);
    return await database.updateProduct(validId, product);
  } catch (error) {
    console.error('Error in update-product:', error);
    throw error;
  }
});

ipcMain.handle("delete-product", async (event, id) => {
  try {
    const validId = validateId(id);
    return await database.deleteProduct(validId);
  } catch (error) {
    console.error('Error in delete-product:', error);
    throw error;
  }
});

ipcMain.handle("get-inventory", async () => {
  return await database.getInventory();
});

ipcMain.handle(
  "update-stock",
  async (event, productId, godownStock, counterStock) => {
    return await database.updateStock(productId, godownStock, counterStock);
  }
);

ipcMain.handle(
  "transfer-stock",
  async (event, productId, quantity, fromLocation, toLocation) => {
    return await database.transferStock(
      productId,
      quantity,
      fromLocation,
      toLocation
    );
  }
);

ipcMain.handle("create-sale", async (event, saleData) => {
  try {
    validateObject(saleData, ['saleNumber', 'items', 'totalAmount']);
    
    if (!Array.isArray(saleData.items) || saleData.items.length === 0) {
      throw new Error('Sale must contain at least one item');
    }
    
    if (typeof saleData.totalAmount !== 'number' || saleData.totalAmount < 0) {
      throw new Error('Total amount must be a valid positive number');
    }
    
    return await database.createSale(saleData);
  } catch (error) {
    console.error('Error in create-sale:', error);
    throw error;
  }
});

ipcMain.handle("get-sales", async (event, dateRange) => {
  return await database.getSales(dateRange);
});

ipcMain.handle("get-sales-with-details", async (event, dateRange) => {
  console.log('getSalesWithDetails called with dateRange:', dateRange);
  try {
    const result = await database.getSalesWithDetails(dateRange);
    console.log('getSalesWithDetails result:', result.length, 'rows');
    return result;
  } catch (error) {
    console.error('Error in getSalesWithDetails:', error);
    throw error;
  }
});

ipcMain.handle("print-bill", async (event, billData) => {
  try {
    await printerService.printBill(billData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("export-pdf", async (event, billData) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `bill-${Date.now()}.pdf`,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    });

    if (!result.canceled) {
      await pdfService.generateBill(billData, result.filePath);
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: "Save cancelled" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-printer-status", async () => {
  return await printerService.getStatus();
});

ipcMain.handle("configure-printer", async (event, config) => {
  try {
    printerService.setPrinterType(config.type);
    if (config.type === 'network') {
      printerService.setNetworkConfig(config.networkHost, config.networkPort);
    }
    if (config.type === 'serial') {
      printerService.setSerialConfig(config.serialPath, config.serialBaudRate);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("test-printer-connection", async () => {
  try {
    const status = await printerService.getStatus();
    return { success: status.connected, error: status.connected ? null : 'Printer not connected' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("reconnect-printer", async () => {
  try {
    const status = await printerService.reconnect();
    return { success: status.connected, error: status.connected ? null : 'Printer not connected' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Table management IPC handlers
ipcMain.handle("get-tables", async () => {
  return await database.getTables();
});

ipcMain.handle("add-table", async (event, table) => {
  return await database.addTable(table);
});

ipcMain.handle("update-table", async (event, id, table) => {
  return await database.updateTable(id, table);
});

ipcMain.handle("delete-table", async (event, id) => {
  return await database.deleteTable(id);
});

// Table order IPC handlers
ipcMain.handle("get-table-order", async (event, tableId) => {
  return await database.getTableOrder(tableId);
});

ipcMain.handle("save-table-order", async (event, orderData) => {
  return await database.saveTableOrder(orderData);
});

ipcMain.handle("clear-table-order", async (event, tableId) => {
  return await database.clearTableOrder(tableId);
});


// Email-related IPC handlers
ipcMain.handle("get-email-settings", async () => {
  return emailService.getSettings();
});

ipcMain.handle("save-email-settings", async (event, settings) => {
  return emailService.saveSettings(settings);
});

ipcMain.handle("test-email-connection", async () => {
  return await emailService.testConnection();
});

ipcMain.handle("send-test-email", async () => {
  try {
    const testData = {
      totalAmount: 1500.5,
      totalTransactions: 10,
      tableSales: 6,
      parcelSales: 4,
      topItems: [
        { name: "Chicken Biryani", quantity: 5, revenue: 750 },
        { name: "Mutton Curry", quantity: 3, revenue: 450 },
      ],
    };
    return await emailService.sendDailyReport(testData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("send-daily-email-now", async () => {
  try {
    await sendDailyEmailReport();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Send email report with PDF attachments for selected date
ipcMain.handle("send-email-report-with-pdfs", async (event, selectedDate) => {
  try {
    const targetDate = selectedDate || getLocalDateString();
    
    // Get dashboard data - inventory info
    const inventory = await database.getProducts();
    const lowStockItems = inventory.filter(
      (item) => item.godown_stock + item.counter_stock <= item.min_stock_level
    );
    
    // Get sales data with details
    const salesData = await database.getSalesWithDetails({
      start: getStartOfDay(targetDate),
      end: getEndOfDay(targetDate),
    });

    // Get spendings data
    const spendingsData = await database.getSpendings({
      start: getStartOfDay(targetDate),
      end: getEndOfDay(targetDate),
    });

    // Get counter balance data
    const counterBalances = await database.getCounterBalances({
      start: getStartOfDay(targetDate),
      end: getEndOfDay(targetDate),
    });

    // Calculate totals
    const totalRevenue = salesData.reduce((sum, sale) => sum + sale.total_amount, 0);
    const totalSpendings = spendingsData.reduce((sum, spending) => sum + spending.amount, 0);
    const totalOpeningBalance = counterBalances.reduce((sum, balance) => sum + balance.opening_balance, 0);
    const netIncome = totalRevenue - totalSpendings;
    const totalBalance = netIncome + totalOpeningBalance;

    const reportData = {
      // Dashboard values
      totalProducts: inventory.length,
      lowStockItems: lowStockItems.length,
      todaySales: salesData.length,
      // Financial values
      totalAmount: totalRevenue,
      totalRevenue: totalRevenue,
      totalSpendings: totalSpendings,
      netIncome: netIncome,
      totalOpeningBalance: totalOpeningBalance,
      totalBalance: totalBalance,
      totalTransactions: salesData.length,
      tableSales: salesData.filter((sale) => sale.sale_type === "table").length,
      parcelSales: salesData.filter((sale) => sale.sale_type === "parcel").length,
      topItems: await getTopSellingItems(salesData),
    };

    // Generate PDF reports
    const attachmentPaths = [];
    const timestamp = new Date().getTime();
    
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    try {
      // Generate comprehensive daily report PDF
      const dailyPdfPath = path.join(__dirname, `../temp/daily-report-${targetDate}-${timestamp}.pdf`);
      const dailyReportResult = await dailyReportService.generateDailyReport(reportData, targetDate, dailyPdfPath);
      
      if (dailyReportResult.success) {
        attachmentPaths.push({
          path: dailyPdfPath,
          filename: `daily-report-${targetDate}.pdf`
        });
      }
    } catch (error) {
      console.error("Error generating daily report PDF:", error);
    }
    
    try {
      // Generate sales report PDF
      const salesPdfPath = path.join(__dirname, `../temp/sales-report-${targetDate}-${timestamp}.pdf`);
      
      const salesResult = await reportService.generateSalesReport(salesData, targetDate, salesPdfPath);
      if (salesResult.success) {
        attachmentPaths.push({
          path: salesPdfPath,
          filename: `sales-report-${targetDate}.pdf`
        });
      }
    } catch (error) {
      console.error("Error generating sales PDF:", error);
    }

    try {
      // Generate financial report PDF
      const financialPdfPath = path.join(__dirname, `../temp/financial-report-${targetDate}-${timestamp}.pdf`);
      
      const financialReportData = {
        sales: salesData,
        spendings: spendingsData,
        counterBalances: counterBalances,
        totalRevenue: totalRevenue,
        totalSpendings: totalSpendings,
        netIncome: netIncome,
        totalOpeningBalance: totalOpeningBalance,
        totalBalance: totalBalance
      };
      
      const financialResult = await reportService.generateFinancialReport(financialReportData, targetDate, financialPdfPath);
      if (financialResult.success) {
        attachmentPaths.push({
          path: financialPdfPath,
          filename: `financial-report-${targetDate}.pdf`
        });
      }
    } catch (error) {
      console.error("Error generating financial PDF:", error);
    }

    // Send email with PDF attachments
    const result = await emailService.sendDailyReport(reportData, attachmentPaths);
    
    // Clean up temporary PDF files
    attachmentPaths.forEach(attachment => {
      try {
        if (fs.existsSync(attachment.path)) {
          fs.unlinkSync(attachment.path);
        }
      } catch (error) {
        console.error("Error cleaning up temporary PDF:", error);
      }
    });
    
    return result;
  } catch (error) {
    console.error("Error in send-email-report-with-pdfs:", error);
    return { success: false, error: error.message };
  }
});

// Daily transfer IPC handlers
ipcMain.handle("save-daily-transfer", async (event, transferData) => {
  return await database.saveDailyTransfer(transferData);
});

// Get stock movements history IPC handler
ipcMain.handle("get-stock-movements", async (event, limit) => {
  try {
    return await database.getStockMovements(limit);
  } catch (error) {
    console.error("Error in get-stock-movements:", error);
    throw error;
  }
});

ipcMain.handle("get-daily-transfers", async (event, dateRange) => {
  return await database.getDailyTransfers(dateRange);
});

// Bar settings IPC handlers
ipcMain.handle("get-bar-settings", async () => {
  return await database.getBarSettings();
});

ipcMain.handle("save-bar-settings", async (event, settings) => {
  return await database.saveBarSettings(settings);
});

// Spendings IPC handlers
ipcMain.handle("add-spending", async (event, spending) => {
  return await database.addSpending(spending);
});

ipcMain.handle("update-spending", async (event, id, spending) => {
  return await database.updateSpending(id, spending);
});

ipcMain.handle("delete-spending", async (event, id) => {
  return await database.deleteSpending(id);
});

ipcMain.handle("get-spendings", async (event, dateRange) => {
  return await database.getSpendings(dateRange);
});

ipcMain.handle("get-spending-categories", async () => {
  return await database.getSpendingCategories();
});

ipcMain.handle("get-daily-spending-total", async (event, date) => {
  return await database.getDailySpendingTotal(date);
});

// Counter balance IPC handlers
ipcMain.handle("add-counter-balance", async (event, balance) => {
  return await database.addCounterBalance(balance);
});

ipcMain.handle("update-counter-balance", async (event, date, balance) => {
  return await database.updateCounterBalance(date, balance);
});

ipcMain.handle("get-counter-balance", async (event, date) => {
  return await database.getCounterBalance(date);
});

ipcMain.handle("get-counter-balances", async (event, dateRange) => {
  return await database.getCounterBalances(dateRange);
});

ipcMain.handle("get-previous-day-closing-balance", async (event, date) => {
  return await database.getPreviousDayClosingBalance(date);
});

// Pending bills IPC handlers
ipcMain.handle("add-pending-bill", async (event, billData) => {
  try {
    validateObject(billData, ['billNumber', 'items', 'subtotal', 'totalAmount']);
    
    if (!Array.isArray(billData.items) || billData.items.length === 0) {
      throw new Error('Pending bill must contain at least one item');
    }
    
    if (typeof billData.totalAmount !== 'number' || billData.totalAmount < 0) {
      throw new Error('Total amount must be a valid positive number');
    }
    
    const result = await database.addPendingBill(billData);
    console.log('Pending bill added successfully:', result);
    return result;
  } catch (error) {
    console.error('Error in add-pending-bill:', error);
    console.error('Bill data:', billData);
    throw error;
  }
});

ipcMain.handle("get-pending-bills", async () => {
  try {
    return await database.getPendingBills();
  } catch (error) {
    console.error('Error in get-pending-bills:', error);
    throw error;
  }
});

ipcMain.handle("update-pending-bill", async (event, id, billData) => {
  try {
    const validId = validateId(id);
    validateObject(billData, ['items', 'subtotal', 'totalAmount']);
    
    if (!Array.isArray(billData.items) || billData.items.length === 0) {
      throw new Error('Pending bill must contain at least one item');
    }
    
    if (typeof billData.totalAmount !== 'number' || billData.totalAmount < 0) {
      throw new Error('Total amount must be a valid positive number');
    }
    
    return await database.updatePendingBill(validId, billData);
  } catch (error) {
    console.error('Error in update-pending-bill:', error);
    throw error;
  }
});

ipcMain.handle("delete-pending-bill", async (event, id) => {
  try {
    const validId = validateId(id);
    return await database.deletePendingBill(validId);
  } catch (error) {
    console.error('Error in delete-pending-bill:', error);
    throw error;
  }
});

ipcMain.handle("clear-pending-bill", async (event, id) => {
  try {
    const validId = validateId(id);
    return await database.clearPendingBill(validId);
  } catch (error) {
    console.error('Error in clear-pending-bill:', error);
    throw error;
  }
});

// PDF generation for reports
ipcMain.handle("export-stock-report", async (event, reportData, reportType) => {
  try {
    const timestamp = new Date().getTime();
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${reportType}-stock-report-${timestamp}.pdf`,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    });

    if (!result.canceled) {
      await pdfService.generateStockReport(
        reportData,
        reportType,
        result.filePath
      );
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: "Save cancelled" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("export-transfer-report", async (event, transferData) => {
  try {
    const timestamp = new Date().getTime();
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `daily-transfer-report-${timestamp}.pdf`,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    });

    if (!result.canceled) {
      await pdfService.generateTransferReport(transferData, result.filePath);
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: "Save cancelled" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Export sales report PDF
ipcMain.handle("export-sales-report", async (event, salesData, selectedDate) => {
  try {
    const timestamp = new Date().getTime();
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `sales-report-${selectedDate}-${timestamp}.pdf`,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    });

    if (!result.canceled) {
      await pdfService.generateSalesReport(salesData, selectedDate, result.filePath);
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: "Save cancelled" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Export financial report PDF
ipcMain.handle("export-financial-report", async (event, reportData, selectedDate) => {
  try {
    const timestamp = new Date().getTime();
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `financial-report-${selectedDate}-${timestamp}.pdf`,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    });

    if (!result.canceled) {
      await pdfService.generateFinancialReport(reportData, selectedDate, result.filePath);
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: "Save cancelled" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Export pending bills report PDF
ipcMain.handle("export-pending-bills-report", async (event, pendingBillsData) => {
  try {
    const timestamp = new Date().getTime();
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `pending-bills-report-${timestamp}.pdf`,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    });

    if (!result.canceled) {
      await pdfService.generatePendingBillsReport(pendingBillsData, result.filePath);
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: "Save cancelled" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Export comprehensive daily report PDF
ipcMain.handle("export-daily-report", async (event, reportData, selectedDate) => {
  try {
    const timestamp = new Date().getTime();
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `daily-report-${selectedDate}-${timestamp}.pdf`,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    });

    if (!result.canceled) {
      await dailyReportService.generateDailyReport(reportData, selectedDate, result.filePath);
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: "Save cancelled" };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Set up menu
const template = [
  {
    label: "File",
    submenu: [
      {
        label: "Exit",
        accelerator: "CmdOrCtrl+Q",
        click: () => {
          app.quit();
        },
      },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
    ],
  },
  {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  },
];

// Reset application IPC handler
ipcMain.handle("reset-application", async () => {
  try {
    const result = await database.resetApplication();
    
    // Reinitialize sample data after reset
    try {
      console.log('Reinitializing sample data after reset...');
      await initializeSampleData(database);
      console.log('Sample data reinitialized successfully');
    } catch (error) {
      console.log('Sample data reinitialization failed:', error.message);
    }
    
    return { success: true, message: 'Application reset completed successfully' };
  } catch (error) {
    console.error('Error in reset-application:', error);
    return { success: false, error: error.message };
  }
});

// Handle Close Sell and generate reports
ipcMain.handle('close-sell-and-generate-reports', async () => {
  try {
    const AdmZip = require('adm-zip');
    const timestamp = new Date().getTime();
    const targetDate = getLocalDateString();
    const tempDir = path.join(__dirname, '../temp');
    const outputDir = path.join(__dirname, '../output');
    const zipPath = path.join(outputDir, `close-sell-reports-${targetDate}-${timestamp}.zip`);

    // Ensure directories exist
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const pdfPaths = [];
    const zip = new AdmZip();

    try {
      // Get all necessary data for reports
      const inventory = await database.getProducts();
      const lowStockItems = inventory.filter(
        (item) => item.godown_stock + item.counter_stock <= item.min_stock_level
      );

      // Get sales data with details
      const salesData = await database.getSalesWithDetails({
        start: getStartOfDay(targetDate),
        end: getEndOfDay(targetDate),
      });

      // Get spendings data
      const spendingsData = await database.getSpendings({
        start: getStartOfDay(targetDate),
        end: getEndOfDay(targetDate),
      });

      // Get counter balance data
      const counterBalances = await database.getCounterBalances({
        start: getStartOfDay(targetDate),
        end: getEndOfDay(targetDate),
      });

      // Get pending bills
      const pendingBills = await database.getPendingBills();

      // Calculate totals
      const totalRevenue = salesData.reduce((sum, sale) => sum + sale.total_amount, 0);
      const totalSpendings = spendingsData.reduce((sum, spending) => sum + spending.amount, 0);
      const totalOpeningBalance = counterBalances.reduce((sum, balance) => sum + balance.opening_balance, 0);
      const netIncome = totalRevenue - totalSpendings;
      const totalBalance = netIncome + totalOpeningBalance;

      const reportData = {
        totalProducts: inventory.length,
        lowStockItems: lowStockItems.length,
        todaySales: salesData.length,
        totalAmount: totalRevenue,
        totalRevenue: totalRevenue,
        totalSpendings: totalSpendings,
        netIncome: netIncome,
        totalOpeningBalance: totalOpeningBalance,
        totalBalance: totalBalance,
        totalTransactions: salesData.length,
        tableSales: salesData.filter((sale) => sale.sale_type === "table").length,
        parcelSales: salesData.filter((sale) => sale.sale_type === "parcel").length,
        topItems: await getTopSellingItems(salesData),
      };

      const financialReportData = {
        sales: salesData,
        spendings: spendingsData,
        counterBalances: counterBalances,
        totalRevenue: totalRevenue,
        totalSpendings: totalSpendings,
        netIncome: netIncome,
        totalOpeningBalance: totalOpeningBalance,
        totalBalance: totalBalance
      };

      // Generate comprehensive daily report PDF
      const dailyPdfPath = path.join(tempDir, `daily-report-${targetDate}-${timestamp}.pdf`);
      const dailyReportResult = await dailyReportService.generateDailyReport(reportData, targetDate, dailyPdfPath);
      if (dailyReportResult.success) {
        zip.addLocalFile(dailyPdfPath, '', 'daily-report.pdf');
        pdfPaths.push(dailyPdfPath);
      }

      // Generate sales report PDF
      const salesPdfPath = path.join(tempDir, `sales-report-${targetDate}-${timestamp}.pdf`);
      const salesResult = await reportService.generateSalesReport(salesData, targetDate, salesPdfPath);
      if (salesResult.success) {
        zip.addLocalFile(salesPdfPath, '', 'sales-report.pdf');
        pdfPaths.push(salesPdfPath);
      }

      // Generate financial report PDF
      const financialPdfPath = path.join(tempDir, `financial-report-${targetDate}-${timestamp}.pdf`);
      const financialResult = await reportService.generateFinancialReport(financialReportData, targetDate, financialPdfPath);
      if (financialResult.success) {
        zip.addLocalFile(financialPdfPath, '', 'financial-report.pdf');
        pdfPaths.push(financialPdfPath);
      }

      // Generate inventory stock report PDF
      const inventoryPdfPath = path.join(tempDir, `inventory-report-${targetDate}-${timestamp}.pdf`);
      try {
        await pdfService.generateStockReport(inventory, 'all', inventoryPdfPath);
        zip.addLocalFile(inventoryPdfPath, '', 'inventory-report.pdf');
        pdfPaths.push(inventoryPdfPath);
      } catch (error) {
        console.error('Error generating inventory report:', error);
      }

      // Generate pending bills report PDF if there are any
      if (pendingBills.length > 0) {
        const pendingBillsPdfPath = path.join(tempDir, `pending-bills-report-${targetDate}-${timestamp}.pdf`);
        try {
          await pdfService.generatePendingBillsReport(pendingBills, pendingBillsPdfPath);
          zip.addLocalFile(pendingBillsPdfPath, '', 'pending-bills-report.pdf');
          pdfPaths.push(pendingBillsPdfPath);
        } catch (error) {
          console.error('Error generating pending bills report:', error);
        }
      }
    } catch (error) {
      console.error('Error generating PDF reports:', error);
    }

    // Write the ZIP file
    zip.writeZip(zipPath);

    // Send email with ZIP attachment
    let emailSent = false;
    try {
      const emailSettings = emailService.getSettings();
      if (emailSettings.enabled) {
        const emailResult = await emailService.sendDailyReport(
          {
            totalAmount: 0,
            totalTransactions: 0,
            tableSales: 0,
            parcelSales: 0,
            topItems: [],
          },
          [{
            path: zipPath,
            filename: `close-sell-reports-${targetDate}.zip`
          }]
        );
        emailSent = emailResult.success;
      }
    } catch (error) {
      console.error('Error sending email:', error);
    }

    // Clean up temporary files
    pdfPaths.forEach(pdfPath => {
      try {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }
      } catch (error) {
        console.error('Error cleaning up PDF:', error);
      }
    });

    return {
      success: true,
      zipPath: zipPath,
      emailSent: emailSent,
      message: `Close Sell completed! Generated ${pdfPaths.length} reports.`
    };
  } catch (error) {
    console.error('Error in Close Sell operation:', error);
    return { success: false, error: error.message };
  }
});

Menu.setApplicationMenu(Menu.buildFromTemplate(template));
