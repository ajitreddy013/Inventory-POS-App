const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Product operations
  getProducts: () => ipcRenderer.invoke('get-products'),
  addProduct: (product) => ipcRenderer.invoke('add-product', product),
  updateProduct: (id, product) => ipcRenderer.invoke('update-product', id, product),
  deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),

  // Inventory operations
  getInventory: () => ipcRenderer.invoke('get-inventory'),
  updateStock: (productId, godownStock, counterStock) => 
    ipcRenderer.invoke('update-stock', productId, godownStock, counterStock),
  transferStock: (productId, quantity, fromLocation, toLocation) => 
    ipcRenderer.invoke('transfer-stock', productId, quantity, fromLocation, toLocation),

  // Sales operations
  createSale: (saleData) => ipcRenderer.invoke('create-sale', saleData),
  getSales: (dateRange) => ipcRenderer.invoke('get-sales', dateRange),

  // Printing and PDF operations
  printBill: (billData) => ipcRenderer.invoke('print-bill', billData),
  exportPDF: (billData) => ipcRenderer.invoke('export-pdf', billData),
  getPrinterStatus: () => ipcRenderer.invoke('get-printer-status')
});
