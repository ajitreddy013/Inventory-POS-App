const { app, BrowserWindow } = require('electron');
const path = require('path');
const Database = require('./src/database');

// Initialize tables T1-T10
async function initializeTables() {
  const database = new Database();
  
  try {
    await database.initialize();
    console.log('Database initialized successfully');
    
    // Check existing tables
    const existingTables = await database.getAllTables();
    const existingTableNames = existingTables.map(table => table.name);
    
    console.log('Existing tables:', existingTableNames);
    
    // Create T1-T10 tables if they don't exist
    const requiredTables = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'];
    
    for (const tableName of requiredTables) {
      if (!existingTableNames.includes(tableName)) {
        await database.addTable({
          name: tableName,
          capacity: 4,
          area: 'restaurant',
          status: 'available'
        });
        console.log(`Created table: ${tableName}`);
      } else {
        console.log(`Table ${tableName} already exists`);
      }
    }
    
    console.log('Table initialization completed');
    
    // Show final state
    const allTables = await database.getAllTables();
    console.log('All tables:', allTables.map(t => ({ name: t.name, status: t.status, bill_amount: t.current_bill_amount })));
    
  } catch (error) {
    console.error('Error initializing tables:', error);
  } finally {
    process.exit(0);
  }
}

// Check if we're running directly or imported
if (require.main === module) {
  initializeTables();
}

module.exports = initializeTables;
