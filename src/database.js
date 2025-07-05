const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron');

class Database {
  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'inventory.db');
    this.db = null;
  }

  initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          this.createTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  }

  createTables() {
    return new Promise((resolve, reject) => {
      const queries = [
        // Products table
        `CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          sku TEXT UNIQUE NOT NULL,
          barcode TEXT UNIQUE,
          price REAL NOT NULL,
          cost REAL NOT NULL,
          category TEXT,
          description TEXT,
          unit TEXT DEFAULT 'pcs',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // Inventory table
        `CREATE TABLE IF NOT EXISTS inventory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          godown_stock INTEGER DEFAULT 0,
          counter_stock INTEGER DEFAULT 0,
          min_stock_level INTEGER DEFAULT 0,
          max_stock_level INTEGER DEFAULT 1000,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
        )`,
        
        // Sales table
        `CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_number TEXT UNIQUE NOT NULL,
          customer_name TEXT,
          customer_phone TEXT,
          total_amount REAL NOT NULL,
          tax_amount REAL DEFAULT 0,
          discount_amount REAL DEFAULT 0,
          payment_method TEXT DEFAULT 'cash',
          sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        
        // Sale items table
        `CREATE TABLE IF NOT EXISTS sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER NOT NULL,
          product_id INTEGER NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price REAL NOT NULL,
          total_price REAL NOT NULL,
          FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
          FOREIGN KEY (product_id) REFERENCES products (id)
        )`,
        
        // Stock movements table
        `CREATE TABLE IF NOT EXISTS stock_movements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          product_id INTEGER NOT NULL,
          movement_type TEXT NOT NULL, -- 'in', 'out', 'transfer', 'adjustment'
          quantity INTEGER NOT NULL,
          from_location TEXT, -- 'godown', 'counter', null
          to_location TEXT, -- 'godown', 'counter', null
          reference_id INTEGER, -- sale_id if movement is due to sale
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (product_id) REFERENCES products (id)
        )`
      ];

      let completed = 0;
      const total = queries.length;

      queries.forEach(query => {
        this.db.run(query, (err) => {
          if (err) {
            reject(err);
          } else {
            completed++;
            if (completed === total) {
              resolve();
            }
          }
        });
      });
    });
  }

  // Product operations
  getProducts() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT p.*, i.godown_stock, i.counter_stock, i.min_stock_level, i.max_stock_level
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        ORDER BY p.name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  addProduct(product) {
    return new Promise((resolve, reject) => {
      const { name, sku, barcode, price, cost, category, description, unit } = product;
      
      this.db.run(`
        INSERT INTO products (name, sku, barcode, price, cost, category, description, unit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [name, sku, barcode, price, cost, category, description, unit], function(err) {
        if (err) {
          reject(err);
        } else {
          // Create inventory record
          const productId = this.lastID;
          this.db.run(`
            INSERT INTO inventory (product_id, godown_stock, counter_stock)
            VALUES (?, 0, 0)
          `, [productId], (err) => {
            if (err) reject(err);
            else resolve({ id: productId, ...product });
          });
        }
      });
    });
  }

  updateProduct(id, product) {
    return new Promise((resolve, reject) => {
      const { name, sku, barcode, price, cost, category, description, unit } = product;
      
      this.db.run(`
        UPDATE products 
        SET name = ?, sku = ?, barcode = ?, price = ?, cost = ?, 
            category = ?, description = ?, unit = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [name, sku, barcode, price, cost, category, description, unit, id], function(err) {
        if (err) reject(err);
        else resolve({ id, ...product });
      });
    });
  }

  deleteProduct(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ deleted: this.changes > 0 });
      });
    });
  }

  // Inventory operations
  getInventory() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT p.*, i.godown_stock, i.counter_stock, i.min_stock_level, i.max_stock_level,
               (i.godown_stock + i.counter_stock) as total_stock
        FROM products p
        JOIN inventory i ON p.id = i.product_id
        ORDER BY p.name
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  updateStock(productId, godownStock, counterStock) {
    return new Promise((resolve, reject) => {
      this.db.run(`
        UPDATE inventory 
        SET godown_stock = ?, counter_stock = ?, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ?
      `, [godownStock, counterStock, productId], function(err) {
        if (err) reject(err);
        else resolve({ updated: this.changes > 0 });
      });
    });
  }

  transferStock(productId, quantity, fromLocation, toLocation) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        // Update inventory
        const updateQuery = fromLocation === 'godown' 
          ? 'UPDATE inventory SET godown_stock = godown_stock - ?, counter_stock = counter_stock + ? WHERE product_id = ?'
          : 'UPDATE inventory SET counter_stock = counter_stock - ?, godown_stock = godown_stock + ? WHERE product_id = ?';
        
        this.db.run(updateQuery, [quantity, quantity, productId], function(err) {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
          } else {
            // Record stock movement
            this.db.run(`
              INSERT INTO stock_movements (product_id, movement_type, quantity, from_location, to_location)
              VALUES (?, 'transfer', ?, ?, ?)
            `, [productId, quantity, fromLocation, toLocation], function(err) {
              if (err) {
                this.db.run('ROLLBACK');
                reject(err);
              } else {
                this.db.run('COMMIT');
                resolve({ transferred: true });
              }
            });
          }
        });
      });
    });
  }

  // Sales operations
  createSale(saleData) {
    return new Promise((resolve, reject) => {
      const { saleNumber, customerName, customerPhone, items, totalAmount, taxAmount, discountAmount, paymentMethod } = saleData;
      
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        // Insert sale
        this.db.run(`
          INSERT INTO sales (sale_number, customer_name, customer_phone, total_amount, tax_amount, discount_amount, payment_method)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [saleNumber, customerName, customerPhone, totalAmount, taxAmount, discountAmount, paymentMethod], function(err) {
          if (err) {
            this.db.run('ROLLBACK');
            reject(err);
            return;
          }
          
          const saleId = this.lastID;
          let itemsProcessed = 0;
          
          items.forEach(item => {
            // Insert sale item
            this.db.run(`
              INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
              VALUES (?, ?, ?, ?, ?)
            `, [saleId, item.productId, item.quantity, item.unitPrice, item.totalPrice], (err) => {
              if (err) {
                this.db.run('ROLLBACK');
                reject(err);
                return;
              }
              
              // Update counter stock
              this.db.run(`
                UPDATE inventory 
                SET counter_stock = counter_stock - ?
                WHERE product_id = ?
              `, [item.quantity, item.productId], (err) => {
                if (err) {
                  this.db.run('ROLLBACK');
                  reject(err);
                  return;
                }
                
                // Record stock movement
                this.db.run(`
                  INSERT INTO stock_movements (product_id, movement_type, quantity, from_location, reference_id)
                  VALUES (?, 'out', ?, 'counter', ?)
                `, [item.productId, item.quantity, saleId], (err) => {
                  if (err) {
                    this.db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  
                  itemsProcessed++;
                  if (itemsProcessed === items.length) {
                    this.db.run('COMMIT');
                    resolve({ id: saleId, ...saleData });
                  }
                });
              });
            });
          });
        });
      });
    });
  }

  getSales(dateRange) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT s.*, 
               COUNT(si.id) as item_count,
               GROUP_CONCAT(p.name || ' x' || si.quantity) as items_summary
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        LEFT JOIN products p ON si.product_id = p.id
      `;
      
      const params = [];
      
      if (dateRange && dateRange.start && dateRange.end) {
        query += ' WHERE s.sale_date BETWEEN ? AND ?';
        params.push(dateRange.start, dateRange.end);
      }
      
      query += ' GROUP BY s.id ORDER BY s.sale_date DESC';
      
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = Database;
