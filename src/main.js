const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const cron = require('node-cron');
const Database = require('./database');
const PrinterService = require('./printer-service');
const PDFService = require('./pdf-service');
const EmailService = require('./email-service');
const { initializeSampleData } = require('./init-sample-data');

let mainWindow;
let database;
let printerService;
let pdfService;
let emailService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
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
      console.log('No existing products found, initializing sample data...');
      await initializeSampleData(database);
    }
  } catch (error) {
    console.log('Sample data initialization skipped:', error.message);
  }

  // Initialize services
  printerService = new PrinterService();
  pdfService = new PDFService();
  emailService = new EmailService();

  // Setup daily email report cron job (runs at 11:59 PM every day)
  cron.schedule('59 23 * * *', async () => {
    console.log('Running daily email report job...');
    await sendDailyEmailReport();
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Function to send daily email report
async function sendDailyEmailReport() {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const salesData = await database.getSales({
      start: startOfDay.toISOString(),
      end: endOfDay.toISOString()
    });
    
    const reportData = {
      totalAmount: salesData.reduce((sum, sale) => sum + sale.total_amount, 0),
      totalTransactions: salesData.length,
      tableSales: salesData.filter(sale => sale.sale_type === 'table').length,
      parcelSales: salesData.filter(sale => sale.sale_type === 'parcel').length,
      topItems: await getTopSellingItems(salesData)
    };
    
    const result = await emailService.sendDailyReport(reportData);
    if (result.success) {
      console.log('Daily email report sent successfully');
    } else {
      console.error('Failed to send daily email report:', result.error);
    }
  } catch (error) {
    console.error('Error in daily email report:', error);
  }
}

// Function to get top selling items
async function getTopSellingItems(salesData) {
  const itemMap = new Map();
  
  for (const sale of salesData) {
    try {
      const saleItems = JSON.parse(sale.items || '[]');
      saleItems.forEach(item => {
        if (itemMap.has(item.name)) {
          const existing = itemMap.get(item.name);
          existing.quantity += item.quantity;
          existing.revenue += item.quantity * item.price;
        } else {
          itemMap.set(item.name, {
            name: item.name,
            quantity: item.quantity,
            revenue: item.quantity * item.price
          });
        }
      });
    } catch (error) {
      console.error('Error parsing sale items:', error);
    }
  }
  
  return Array.from(itemMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for database operations
ipcMain.handle('get-products', async () => {
  return await database.getProducts();
});

ipcMain.handle('add-product', async (event, product) => {
  return await database.addProduct(product);
});

ipcMain.handle('update-product', async (event, id, product) => {
  return await database.updateProduct(id, product);
});

ipcMain.handle('delete-product', async (event, id) => {
  return await database.deleteProduct(id);
});

ipcMain.handle('get-inventory', async () => {
  return await database.getInventory();
});

ipcMain.handle('update-stock', async (event, productId, godownStock, counterStock) => {
  return await database.updateStock(productId, godownStock, counterStock);
});

ipcMain.handle('transfer-stock', async (event, productId, quantity, fromLocation, toLocation) => {
  return await database.transferStock(productId, quantity, fromLocation, toLocation);
});

ipcMain.handle('create-sale', async (event, saleData) => {
  return await database.createSale(saleData);
});

ipcMain.handle('get-sales', async (event, dateRange) => {
  return await database.getSales(dateRange);
});

ipcMain.handle('print-bill', async (event, billData) => {
  try {
    await printerService.printBill(billData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-pdf', async (event, billData) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `bill-${Date.now()}.pdf`,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ]
    });
    
    if (!result.canceled) {
      await pdfService.generateBill(billData, result.filePath);
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: 'Save cancelled' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-printer-status', async () => {
  return await printerService.getStatus();
});

// Table management IPC handlers
ipcMain.handle('get-tables', async () => {
  return await database.getTables();
});

ipcMain.handle('add-table', async (event, table) => {
  return await database.addTable(table);
});

ipcMain.handle('update-table', async (event, id, table) => {
  return await database.updateTable(id, table);
});

ipcMain.handle('delete-table', async (event, id) => {
  return await database.deleteTable(id);
});

// Table order IPC handlers
ipcMain.handle('get-table-order', async (event, tableId) => {
  return await database.getTableOrder(tableId);
});

ipcMain.handle('save-table-order', async (event, orderData) => {
  return await database.saveTableOrder(orderData);
});

ipcMain.handle('clear-table-order', async (event, tableId) => {
  return await database.clearTableOrder(tableId);
});

// KOT printing
ipcMain.handle('print-kot', async (event, kotData) => {
  try {
    await printerService.printKOT(kotData);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Email-related IPC handlers
ipcMain.handle('get-email-settings', async () => {
  return emailService.getSettings();
});

ipcMain.handle('save-email-settings', async (event, settings) => {
  return emailService.saveSettings(settings);
});

ipcMain.handle('test-email-connection', async () => {
  return await emailService.testConnection();
});

ipcMain.handle('send-test-email', async () => {
  try {
    const testData = {
      totalAmount: 1500.50,
      totalTransactions: 10,
      tableSales: 6,
      parcelSales: 4,
      topItems: [
        { name: 'Chicken Biryani', quantity: 5, revenue: 750 },
        { name: 'Mutton Curry', quantity: 3, revenue: 450 }
      ]
    };
    return await emailService.sendDailyReport(testData);
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('send-daily-email-now', async () => {
  try {
    await sendDailyEmailReport();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Daily transfer IPC handlers
ipcMain.handle('save-daily-transfer', async (event, transferData) => {
  return await database.saveDailyTransfer(transferData);
});

ipcMain.handle('get-daily-transfers', async (event, dateRange) => {
  return await database.getDailyTransfers(dateRange);
});

// Bar settings IPC handlers
ipcMain.handle('get-bar-settings', async () => {
  return await database.getBarSettings();
});

ipcMain.handle('save-bar-settings', async (event, settings) => {
  return await database.saveBarSettings(settings);
});

// PDF generation for reports
ipcMain.handle('export-stock-report', async (event, reportData, reportType) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${reportType}-stock-report-${Date.now()}.pdf`,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ]
    });
    
    if (!result.canceled) {
      await pdfService.generateStockReport(reportData, reportType, result.filePath);
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: 'Save cancelled' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-transfer-report', async (event, transferData) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `daily-transfer-report-${Date.now()}.pdf`,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] }
      ]
    });
    
    if (!result.canceled) {
      await pdfService.generateTransferReport(transferData, result.filePath);
      return { success: true, filePath: result.filePath };
    }
    return { success: false, error: 'Save cancelled' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Set up menu
const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit();
        }
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' }
    ]
  }
];

Menu.setApplicationMenu(Menu.buildFromTemplate(template));
