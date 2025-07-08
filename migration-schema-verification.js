/**
 * Database Schema Verification and Migration Script
 * Purpose: Verify sales table has sale_date column and accepts explicit values
 * Date: 2024-07-08
 */

const Database = require('./src/database');

async function verifyAndMigrateSalesTable() {
  console.log('🔍 Starting database schema verification...');
  
  const db = new Database();
  
  try {
    // Initialize database connection
    await db.initialize();
    console.log('✅ Database connection established');
    
    // Check if sale_date column exists and get its definition
    const schemaInfo = await new Promise((resolve, reject) => {
      db.db.all("PRAGMA table_info(sales)", (err, columns) => {
        if (err) reject(err);
        else resolve(columns);
      });
    });
    
    console.log('📋 Sales table schema:');
    schemaInfo.forEach(col => {
      console.log(`  - ${col.name}: ${col.type} ${col.dflt_value ? `DEFAULT ${col.dflt_value}` : ''}`);
    });
    
    // Check specifically for sale_date column
    const saleDateColumn = schemaInfo.find(col => col.name === 'sale_date');
    
    if (!saleDateColumn) {
      console.log('❌ sale_date column not found! Migration required.');
      await migrateSalesTable(db);
    } else {
      console.log('✅ sale_date column found:', saleDateColumn);
      
      // Test if explicit values are accepted
      const testResult = await testExplicitSaleDate(db);
      if (testResult.success) {
        console.log('✅ Explicit sale_date values are accepted');
        console.log('✅ Database schema verification completed successfully');
      } else {
        console.log('❌ Explicit sale_date values are not accepted:', testResult.error);
        console.log('🔧 Migration may be required to remove DEFAULT constraints');
      }
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
    throw error;
  } finally {
    db.close();
  }
}

async function testExplicitSaleDate(db) {
  const testSaleNumber = `TEST-MIGRATION-${Date.now()}`;
  const testSaleDate = '2024-01-15 10:30:00';
  
  try {
    // Test inserting with explicit sale_date
    await new Promise((resolve, reject) => {
      db.db.run(
        'INSERT INTO sales (sale_number, total_amount, sale_date) VALUES (?, ?, ?)',
        [testSaleNumber, 100.00, testSaleDate],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    // Verify the date was stored correctly
    const result = await new Promise((resolve, reject) => {
      db.db.get(
        'SELECT sale_date FROM sales WHERE sale_number = ?',
        [testSaleNumber],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    // Clean up test data
    await new Promise((resolve, reject) => {
      db.db.run(
        'DELETE FROM sales WHERE sale_number = ?',
        [testSaleNumber],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
    
    if (result && result.sale_date === testSaleDate) {
      return { success: true, storedDate: result.sale_date };
    } else {
      return { success: false, error: 'Date not stored correctly', storedDate: result?.sale_date };
    }
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function migrateSalesTable(db) {
  console.log('🔧 Starting migration to add sale_date column...');
  
  try {
    // Add sale_date column if it doesn't exist
    await new Promise((resolve, reject) => {
      db.db.run(
        'ALTER TABLE sales ADD COLUMN sale_date DATETIME DEFAULT CURRENT_TIMESTAMP',
        (err) => {
          if (err) {
            // Column might already exist
            if (err.message.includes('duplicate column name')) {
              console.log('ℹ️  sale_date column already exists');
              resolve();
            } else {
              reject(err);
            }
          } else {
            console.log('✅ sale_date column added successfully');
            resolve();
          }
        }
      );
    });
    
    // Test the migration
    const testResult = await testExplicitSaleDate(db);
    if (testResult.success) {
      console.log('✅ Migration completed successfully');
    } else {
      console.log('❌ Migration test failed:', testResult.error);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Alternative migration to remove DEFAULT constraint if needed
async function removeDefaultConstraint(db) {
  console.log('🔧 Starting migration to remove DEFAULT constraint...');
  
  try {
    // SQLite doesn't support dropping constraints directly
    // We need to recreate the table without the DEFAULT constraint
    
    // 1. Create new table without DEFAULT constraint
    await new Promise((resolve, reject) => {
      db.db.run(`
        CREATE TABLE sales_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_number TEXT UNIQUE NOT NULL,
          sale_type TEXT DEFAULT 'table',
          table_number TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          total_amount REAL NOT NULL,
          tax_amount REAL DEFAULT 0,
          discount_amount REAL DEFAULT 0,
          payment_method TEXT DEFAULT 'cash',
          sale_date DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // 2. Copy data from old table to new table
    await new Promise((resolve, reject) => {
      db.db.run(`
        INSERT INTO sales_new SELECT * FROM sales
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // 3. Drop old table
    await new Promise((resolve, reject) => {
      db.db.run('DROP TABLE sales', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // 4. Rename new table
    await new Promise((resolve, reject) => {
      db.db.run('ALTER TABLE sales_new RENAME TO sales', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ DEFAULT constraint removed successfully');
    
  } catch (error) {
    console.error('❌ Failed to remove DEFAULT constraint:', error);
    throw error;
  }
}

// Run the verification
if (require.main === module) {
  verifyAndMigrateSalesTable()
    .then(() => {
      console.log('🎉 Schema verification completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Schema verification failed:', error);
      process.exit(1);
    });
}

module.exports = {
  verifyAndMigrateSalesTable,
  testExplicitSaleDate,
  migrateSalesTable,
  removeDefaultConstraint
};
