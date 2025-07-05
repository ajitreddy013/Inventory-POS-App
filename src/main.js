const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const Database = require('./database');
const PrinterService = require('./printer-service');
const PDFService = require('./pdf-service');

let mainWindow;
let database;
let printerService;
let pdfService;

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

app.whenReady().then(() => {
  // Initialize database
  database = new Database();
  database.initialize();

  // Initialize services
  printerService = new PrinterService();
  pdfService = new PDFService();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

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
