
// Mock Electron modules
const mockApp = { isPackaged: false, getPath: () => '/tmp' };
const mockIpcMain = { handle: () => {} };
require.cache[require.resolve('electron')] = { 
  exports: { 
    app: mockApp, 
    ipcMain: mockIpcMain,
    BrowserWindow: class {},
    Menu: { buildFromTemplate: () => ({ setApplicationMenu: () => {} }), setApplicationMenu: () => {} },
    dialog: {}
  } 
};

const { initializeFirebaseAdmin, queryCollection } = require('./src/firebase/electronIntegration');

async function test() {
  try {
    await initializeFirebaseAdmin();
    console.log('--- TABLES ---');
    const tables = await queryCollection('tables', []);
    tables.forEach(t => {
      console.log(`Table: ${t.name}, ID: ${t.id}, LocalID: ${t.local_id}, Bill: ${t.current_bill_amount}, Status: ${t.status}`);
    });

    console.log('\n--- ORDERS ---');
    const orders = await queryCollection('orders', [
      { field: 'status', operator: 'in', value: ['draft', 'submitted'] }
    ]);
    orders.forEach(o => {
      console.log(`Order ID: ${o.id}, Status: ${o.status || o.order_status}, TableID: ${o.tableId || o.table_id}, Total: ${o.total || o.totalAmount || o.bill_amount}, Items: ${o.items?.length || 0}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
