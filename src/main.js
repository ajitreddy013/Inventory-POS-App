/**
 * MAIN PROCESS - Electron Application Entry Point
 * 
 * This is the main process file for the Inventory POS Application built with Electron.
 * It handles:
 * - Window creation and management
 * - Database initialization and operations
 * - IPC (Inter-Process Communication) between main and renderer processes
 * - Background services (printing, PDF generation, email reports)
 * - Scheduled tasks (daily email reports)
 * - Hardware integration (thermal printers)
 * 
 * Dependencies:
 * - electron: Desktop application framework
 * - sqlite3: Database operations
 * - node-cron: Scheduled task management
 * - Various custom services for business logic
 * 
 * @author Ajit Reddy
 * @version 1.0.0
 * @since 2024
 */

// Core Electron modules
const { app, BrowserWindow, Menu, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const isDev = require("electron-is-dev");

// Task scheduling for automated reports
const cron = require("node-cron");

// Custom services and utilities
const Database = require("./database");                    // SQLite database operations
const PrinterService = require("./printer-service");       // Thermal printer integration
const PDFService = require("./pdf-service");               // PDF generation for bills/reports
const ReportService = require("./services/reportService"); // Business report generation
const DailyReportService = require("./services/dailyReportService"); // Daily summary reports
const EmailService = require("./email-service");           // Email automation
const { initializeSampleData } = require("./init-sample-data"); // Sample data for testing

// Date utility functions for consistent date handling
const { 
  getLocalDateString,     // Get date in YYYY-MM-DD format
  getLocalDateTimeString, // Get datetime in local format
  getStartOfDay,          // Get start of day timestamp
  getEndOfDay,            // Get end of day timestamp
  formatDateTimeToString  // Format datetime to string
} = require("./utils/dateUtils");

/**
 * GLOBAL VARIABLES - Service Instances
 * These variables hold instances of various services used throughout the application.
 * They are initialized when the app starts and reused across different operations.
 */
let mainWindow;           // Main Electron window instance
let database;             // Database service instance for SQLite operations
let printerService;       // Thermal printer service instance
let pdfService;           // PDF generation service instance
let reportService;        // Business report generation service
let dailyReportService;   // Daily summary report service
let emailService;         // Email automation service

/**
 * CREATE MAIN WINDOW
 * 
 * Creates the main Electron window with security settings and loads the React application.
 * The window is configured with:
 * - Secure web preferences (no node integration, context isolation enabled)
 * - Proper preload script for secure IPC communication
 * - Icon and basic window properties
 * 
 * Security Features:
 * - nodeIntegration: false (prevents direct Node.js access from renderer)
 * - contextIsolation: true (isolates contexts for security)
 * - enableRemoteModule: false (disables remote module for security)
 * - sandbox: false (required for preload script access)
 */
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

  // Determine the URL to load based on development/production environment
  const startUrl = isDev
    ? "http://localhost:3000"                                    // Development server
    : `file://${path.join(__dirname, "../build/index.html")}`; // Production build

  // IMPORTANT: Currently forced to use production build for stability
  // This ensures consistent behavior regardless of environment
  const forcedUrl = `file://${path.join(__dirname, "../build/index.html")}`;
  console.log('Loading URL:', forcedUrl);
  mainWindow.loadURL(forcedUrl);

  // Open developer tools in development mode for debugging
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Clean up when window is closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * APPLICATION INITIALIZATION
 * 
 * This is the main initialization sequence that runs when Electron is ready.
 * It performs the following steps:
 * 1. Database initialization and setup
 * 2. Sample data loading (for first-time users)
 * 3. Service initialization (printing, PDF, email, etc.)
 * 4. Background task scheduling
 * 5. Window creation
 * 
 * The initialization is asynchronous to handle database operations properly.
 */
app.whenReady().then(async () => {
  try {
    // STEP 1: Database Initialization
    console.log('Initializing database...');
    database = new Database();
    await database.initialize();
    console.log('Database initialized successfully');

    // STEP 2: Sample Data Loading (First-time setup)
    // This ensures the application has demo data for immediate use
    try {
      const products = await database.getProducts();
      if (products.length === 0) {
        console.log("No existing products found, initializing sample data...");
        await initializeSampleData(database);
        console.log("Sample data initialized successfully");
      } else {
        console.log(`Found ${products.length} existing products, skipping sample data`);
      }
    } catch (error) {
      console.log("Sample data initialization skipped:", error.message);
    }

    // STEP 3: Service Initialization
    // Initialize all business services required for the application
    console.log('Initializing services...');
    printerService = new PrinterService();           // Thermal printer integration
    pdfService = new PDFService();                   // PDF generation for bills/reports
    reportService = new ReportService();             // Business report generation
    dailyReportService = new DailyReportService();   // Daily summary reports
    emailService = new EmailService();               // Email automation
    console.log('All services initialized successfully');

    // STEP 4: Background Task Scheduling
    // Schedule daily email report to run at 11:59 PM every day
    // This ensures business owners receive daily summaries automatically
    cron.schedule("59 23 * * *", async () => {
      console.log("Running scheduled daily email report job...");
      await sendDailyEmailReport();
    });
    console.log('Daily email report scheduled for 11:59 PM');

    // STEP 5: Window Creation
    createWindow();

    // Handle app activation (macOS behavior)
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
    
  } catch (error) {
    console.error('Failed to initialize application:', error);
    app.quit();
  }
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

ipcMain.handle("get-sale-with-items", async (event, saleId) => {
  console.log('getSaleWithItems called with saleId:', saleId);
  try {
    const validId = validateId(saleId);
    const result = await database.getSaleWithItems(validId);
    console.log('getSaleWithItems result:', result ? 'sale found' : 'no sale found');
    return result;
  } catch (error) {
    console.error('Error in getSaleWithItems:', error);
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
    
    // Delete email settings file to clear hardcoded credentials
    try {
      const emailSettingsPath = path.join(__dirname, '../email-settings.json');
      if (fs.existsSync(emailSettingsPath)) {
        fs.unlinkSync(emailSettingsPath);
        console.log('Email settings file deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting email settings file:', error);
    }
    
    // Delete bar settings file to clear any cached settings
    try {
      const barSettingsPath = path.join(__dirname, '../bar-settings.json');
      if (fs.existsSync(barSettingsPath)) {
        fs.unlinkSync(barSettingsPath);
        console.log('Bar settings file deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting bar settings file:', error);
    }
    
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

    // Backup directories
    const backupDir = path.join(__dirname, '../backups');
    const dbBackupDir = path.join(backupDir, 'database');
    const reportsBackupDir = path.join(backupDir, 'reports');

    // Ensure directories exist
    [tempDir, outputDir, backupDir, dbBackupDir, reportsBackupDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // 1. BACKUP DATABASE FIRST
    let databaseBackupPath = null;
    try {
      const dbPath = database.getDatabasePath();
      databaseBackupPath = path.join(dbBackupDir, `inventory-backup-${targetDate}-${timestamp}.db`);
      
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, databaseBackupPath);
        console.log('Database backup created:', databaseBackupPath);
      } else {
        console.warn('Database file not found at:', dbPath);
      }
    } catch (error) {
      console.error('Error creating database backup:', error);
    }

    const pdfPaths = [];
    const zip = new AdmZip();

    // Add database backup to ZIP if it exists
    if (databaseBackupPath && fs.existsSync(databaseBackupPath)) {
      zip.addLocalFile(databaseBackupPath, 'database/', 'database-backup.db');
    }

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

    // 2. SAVE REPORTS BACKUP
    let reportsBackupPath = null;
    try {
      reportsBackupPath = path.join(reportsBackupDir, `reports-${targetDate}-${timestamp}.zip`);
      fs.copyFileSync(zipPath, reportsBackupPath);
      console.log('Reports backup created:', reportsBackupPath);
    } catch (error) {
      console.error('Error creating reports backup:', error);
    }

    // Send email with individual PDF attachments (NO ZIP FILES)
    let emailSent = false;
    try {
      const emailSettings = emailService.getSettings();
      if (emailSettings.enabled && pdfPaths.length > 0) {
        // Prepare individual PDF attachments
        const pdfAttachments = [];
        
        // Add daily report
        if (fs.existsSync(path.join(tempDir, `daily-report-${targetDate}-${timestamp}.pdf`))) {
          pdfAttachments.push({
            path: path.join(tempDir, `daily-report-${targetDate}-${timestamp}.pdf`),
            filename: 'DailyReport.pdf'
          });
        }
        
        // Add sales report
        if (fs.existsSync(path.join(tempDir, `sales-report-${targetDate}-${timestamp}.pdf`))) {
          pdfAttachments.push({
            path: path.join(tempDir, `sales-report-${targetDate}-${timestamp}.pdf`),
            filename: 'SalesReport.pdf'
          });
        }
        
        // Add financial report
        if (fs.existsSync(path.join(tempDir, `financial-report-${targetDate}-${timestamp}.pdf`))) {
          pdfAttachments.push({
            path: path.join(tempDir, `financial-report-${targetDate}-${timestamp}.pdf`),
            filename: 'FinancialReport.pdf'
          });
        }
        
        // Add inventory report
        if (fs.existsSync(path.join(tempDir, `inventory-report-${targetDate}-${timestamp}.pdf`))) {
          pdfAttachments.push({
            path: path.join(tempDir, `inventory-report-${targetDate}-${timestamp}.pdf`),
            filename: 'InventoryReport.pdf'
          });
        }
        
        // Add pending bills report if exists
        if (fs.existsSync(path.join(tempDir, `pending-bills-report-${targetDate}-${timestamp}.pdf`))) {
          pdfAttachments.push({
            path: path.join(tempDir, `pending-bills-report-${targetDate}-${timestamp}.pdf`),
            filename: 'PendingBillsReport.pdf'
          });
        }
        
        // Send email with comprehensive report data and PDF attachments
        const emailResult = await emailService.sendDailyReport(reportData, pdfAttachments);
        emailSent = emailResult.success;
        
        if (emailSent) {
          console.log(`Email sent successfully with ${pdfAttachments.length} PDF attachments`);
        } else {
          console.error('Failed to send email with PDF reports');
        }
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

    // 3. PRESERVE ALL HISTORICAL DATA - NO AUTOMATIC CLEANUP
    // All backups are preserved permanently for historical reference
    console.log('All backups preserved permanently - no cleanup performed');

    return {
      success: true,
      zipPath: zipPath,
      databaseBackupPath: databaseBackupPath,
      reportsBackupPath: reportsBackupPath,
      emailSent: emailSent,
      message: `Close Sell completed! Generated ${pdfPaths.length} reports and created backups.\n\n📁 Reports: ${zipPath}\n💾 Database Backup: ${databaseBackupPath}\n📊 Reports Backup: ${reportsBackupPath}`
    };
  } catch (error) {
    console.error('Error in Close Sell operation:', error);
    return { success: false, error: error.message };
  }
});

Menu.setApplicationMenu(Menu.buildFromTemplate(template));
