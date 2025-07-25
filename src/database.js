/**
 * DATABASE SERVICE - SQLite Database Management
 * 
 * This class handles all database operations for the Inventory POS Application.
 * It manages:
 * - Database initialization and connection
 * - Table creation and schema management
 * - CRUD operations for all business entities
 * - Data integrity and relationships
 * - Transaction management
 * 
 * Database Structure:
 * - products: Product catalog with variants and pricing
 * - inventory: Stock levels (godown and counter)
 * - sales: Sales transactions
 * - sale_items: Individual items in each sale
 * - stock_movements: Complete audit trail of stock changes
 * - tables: Restaurant/bar table management
 * - table_orders: Temporary order storage
 * - daily_transfers: Daily stock transfer records
 * - bar_settings: Business configuration
 * - spendings: Business expense tracking
 * - counter_balance: Daily cash balance management
 * - pending_bills: Bills saved for later completion
 * 
 * Features:
 * - Automatic foreign key constraints
 * - Transaction support for data integrity
 * - Comprehensive error handling
 * - Audit trail for all stock movements
 * - Date-based reporting and filtering
 * 
 * @author Ajit Reddy
 * @version 1.0.0
 * @since 2024
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const os = require("os");

/**
 * DATABASE CLASS
 * 
 * Main database service class that handles all SQLite operations.
 * Uses a single database file stored in the user's data directory.
 */
class Database {
  /**
   * CONSTRUCTOR
   * 
   * Initializes the database path and prepares for connection.
   * Handles both Electron and Node.js environments for testing.
   */
  constructor() {
    // Determine the appropriate data directory based on environment
    let userDataPath;
    try {
      // In Electron environment, use the official userData path
      const { app } = require("electron");
      userDataPath = app.getPath("userData");
    } catch (error) {
      // Fallback for testing outside Electron environment
      // Create a dedicated directory in user's home folder
      userDataPath = path.join(os.homedir(), "ajit-pos-data");
      const fs = require("fs");
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
    }
    
    // Set the database file path
    this.dbPath = path.join(userDataPath, "inventory.db");
    this.db = null; // Database connection will be established in initialize()
  }

  /**
   * INITIALIZE DATABASE
   * 
   * Establishes connection to SQLite database and creates all required tables.
   * This method must be called before any database operations.
   * 
   * @returns {Promise} Resolves when database is ready for use
   */
  initialize() {
    return new Promise((resolve, reject) => {
      // Create database connection
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Failed to connect to database:', err);
          reject(err);
        } else {
          console.log('Connected to SQLite database at:', this.dbPath);
          // Create all required tables
          this.createTables()
            .then(() => {
              console.log('Database tables created/verified successfully');
              resolve();
            })
            .catch(reject);
        }
      });
    });
  }

  /**
   * CREATE TABLES
   * 
   * Creates all required tables for the application if they don't exist.
   * This method is idempotent - it's safe to run multiple times.
   * 
   * Tables created:
   * - products: Product catalog
   * - inventory: Stock levels
   * - sales: Sales transactions
   * - sale_items: Items in each sale
   * - stock_movements: Stock movement audit trail
   * - tables: Restaurant/bar tables
   * - table_orders: Temporary order storage
   * - daily_transfers: Daily transfer records
   * - bar_settings: Business configuration
   * - spendings: Business expenses
   * - counter_balance: Daily cash balance
   * - pending_bills: Bills saved for later
   * 
   * @returns {Promise} Resolves when all tables are created
   */
  createTables() {
    return new Promise((resolve, reject) => {
      const queries = [
        // Products table
        `CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          variant TEXT,
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
          sale_type TEXT DEFAULT 'table',
          table_number TEXT,
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
        )`,

        // Tables table
        `CREATE TABLE IF NOT EXISTS tables (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          capacity INTEGER NOT NULL,
          area TEXT NOT NULL, -- 'restaurant' or 'bar'
          status TEXT DEFAULT 'available', -- 'available', 'occupied', 'reserved'
          current_bill_amount REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Table orders table (for saving orders before completion)
        `CREATE TABLE IF NOT EXISTS table_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_id INTEGER NOT NULL,
          customer_name TEXT,
          customer_phone TEXT,
          items TEXT, -- JSON string of cart items
          discount REAL DEFAULT 0,
          tax REAL DEFAULT 0,
          notes TEXT,
          subtotal REAL DEFAULT 0,
          total REAL DEFAULT 0,
          kot_printed BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (table_id) REFERENCES tables (id) ON DELETE CASCADE
        )`,

        // Daily transfer reports table
        `CREATE TABLE IF NOT EXISTS daily_transfers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transfer_date DATE NOT NULL,
          total_items INTEGER DEFAULT 0,
          total_quantity INTEGER DEFAULT 0,
          items_transferred TEXT, -- JSON string of transferred items
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Bar settings table
        `CREATE TABLE IF NOT EXISTS bar_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bar_name TEXT NOT NULL,
          contact_number TEXT,
          gst_number TEXT,
          address TEXT,
          thank_you_message TEXT DEFAULT 'Thank you for visiting!',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Spendings table
        `CREATE TABLE IF NOT EXISTS spendings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          category TEXT NOT NULL,
          spending_date DATE NOT NULL,
          payment_method TEXT DEFAULT 'cash',
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Counter balance table
        `CREATE TABLE IF NOT EXISTS counter_balance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          balance_date DATE UNIQUE NOT NULL,
          opening_balance REAL DEFAULT 0,
          closing_balance REAL DEFAULT 0,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Pending bills table
        `CREATE TABLE IF NOT EXISTS pending_bills (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          bill_number TEXT UNIQUE NOT NULL,
          sale_type TEXT DEFAULT 'table',
          table_number TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          items TEXT NOT NULL, -- JSON string of cart items
          subtotal REAL NOT NULL,
          tax_amount REAL DEFAULT 0,
          discount_amount REAL DEFAULT 0,
          total_amount REAL NOT NULL,
          payment_method TEXT DEFAULT 'cash',
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
      ];

      let completed = 0;
      const total = queries.length;

      queries.forEach((query) => {
        this.db.run(query, (err) => {
          if (err) {
            reject(err);
          } else {
            completed++;
            if (completed === total) {
              this.runMigrations()
                .then(() => resolve())
                .catch(reject);
            }
          }
        });
      });
    });
  }

  runMigrations() {
    return new Promise((resolve, reject) => {
      // Check if variant column exists in products table
      this.db.get("PRAGMA table_info(products)", (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        // Check if variant column exists
        this.db.all("PRAGMA table_info(products)", (err, columns) => {
          if (err) {
            reject(err);
            return;
          }

          const hasVariantColumn = columns.some(
            (col) => col.name === "variant"
          );

          if (!hasVariantColumn) {
            // Add variant column if it doesn't exist
            this.db.run(
              "ALTER TABLE products ADD COLUMN variant TEXT",
              (err) => {
                if (err) {
                  console.log(
                    "Variant column already exists or error adding it:",
                    err.message
                  );
                } else {
                  console.log("Added variant column to products table");
                }
                resolve();
              }
            );
          } else {
            resolve();
          }
        });
      });
    });
  }

  // Product operations
  getProducts() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT p.*, i.godown_stock, i.counter_stock, i.min_stock_level, i.max_stock_level
        FROM products p
        LEFT JOIN inventory i ON p.id = i.product_id
        ORDER BY p.name
      `,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  validateProduct(product) {
    const { name, sku, price, cost } = product;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Product name is required and must be a valid string');
    }
    if (!sku || typeof sku !== 'string' || sku.trim().length === 0) {
      throw new Error('Product SKU is required and must be a valid string');
    }
    if (typeof price !== 'number' || price < 0) {
      throw new Error('Product price must be a valid positive number');
    }
    if (typeof cost !== 'number' || cost < 0) {
      throw new Error('Product cost must be a valid positive number');
    }
    
    // Sanitize strings
    return {
      ...product,
      name: name.trim(),
      sku: sku.trim(),
      variant: product.variant ? product.variant.trim() : null,
      barcode: product.barcode ? product.barcode.trim() : null,
      category: product.category ? product.category.trim() : null,
      description: product.description ? product.description.trim() : null,
      unit: product.unit ? product.unit.trim() : 'pcs'
    };
  }

  addProduct(product) {
    return new Promise((resolve, reject) => {
      try {
        const validatedProduct = this.validateProduct(product);
        const {
          name,
          variant,
          sku,
          barcode,
          price,
          cost,
          category,
          description,
          unit,
        } = validatedProduct;

        const db = this.db;
        db.run(
          `
          INSERT INTO products (name, variant, sku, barcode, price, cost, category, description, unit)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [name, variant, sku, barcode, price, cost, category, description, unit],
        function (err) {
          if (err) {
            reject(err);
          } else {
            // Create inventory record
            const productId = this.lastID;
            db.run(
              `
            INSERT INTO inventory (product_id, godown_stock, counter_stock)
            VALUES (?, 0, 0)
          `,
              [productId],
              (err) => {
                if (err) reject(err);
                else resolve({ id: productId, ...validatedProduct });
              }
            );
          }
        }
      );
      } catch (error) {
        reject(error);
      }
    });
  }

  updateProduct(id, product) {
    return new Promise((resolve, reject) => {
      try {
        // Validate product ID
        if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
          throw new Error('Invalid product ID');
        }
        
        const validatedProduct = this.validateProduct(product);
        const {
          name,
          variant,
          sku,
          barcode,
          price,
          cost,
          category,
          description,
          unit,
        } = validatedProduct;

        this.db.run(
          `
          UPDATE products 
          SET name = ?, variant = ?, sku = ?, barcode = ?, price = ?, cost = ?, 
              category = ?, description = ?, unit = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
          [
            name,
            variant,
            sku,
            barcode,
            price,
            cost,
            category,
            description,
            unit,
            id,
          ],
          function (err) {
            if (err) reject(err);
            else resolve({ id, ...validatedProduct });
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  deleteProduct(id) {
    return new Promise((resolve, reject) => {
      try {
        // Validate product ID
        if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
          throw new Error('Invalid product ID');
        }
        
        this.db.run("DELETE FROM products WHERE id = ?", [Number(id)], function (err) {
          if (err) reject(err);
          else resolve({ deleted: this.changes > 0 });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Inventory operations
  getInventory() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT p.*, i.godown_stock, i.counter_stock, i.min_stock_level, i.max_stock_level,
               (i.godown_stock + i.counter_stock) as total_stock
        FROM products p
        JOIN inventory i ON p.id = i.product_id
        ORDER BY p.name
      `,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  updateStock(productId, godownStock, counterStock) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `
        UPDATE inventory 
        SET godown_stock = ?, counter_stock = ?, updated_at = CURRENT_TIMESTAMP
        WHERE product_id = ?
      `,
        [godownStock, counterStock, productId],
        function (err) {
          if (err) reject(err);
          else resolve({ updated: this.changes > 0 });
        }
      );
    });
  }

  transferStock(productId, quantity, fromLocation, toLocation) {
    return new Promise((resolve, reject) => {
      const db = this.db;
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Update inventory
        const updateQuery =
          fromLocation === "godown"
            ? "UPDATE inventory SET godown_stock = godown_stock - ?, counter_stock = counter_stock + ? WHERE product_id = ?"
            : "UPDATE inventory SET counter_stock = counter_stock - ?, godown_stock = godown_stock + ? WHERE product_id = ?";

        db.run(updateQuery, [quantity, quantity, productId], function (err) {
          if (err) {
            db.run("ROLLBACK");
            reject(err);
          } else {
            // Record stock movement
            db.run(
              `
              INSERT INTO stock_movements (product_id, movement_type, quantity, from_location, to_location)
              VALUES (?, 'transfer', ?, ?, ?)
            `,
              [productId, quantity, fromLocation, toLocation],
              function (err) {
                if (err) {
                  db.run("ROLLBACK");
                  reject(err);
                } else {
                  db.run("COMMIT");
                  resolve({ transferred: true });
                }
              }
            );
          }
        });
      });
    });
  }

  // Get stock movements history
  getStockMovements(limit = 30) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT sm.*, p.name AS product_name
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        ORDER BY sm.created_at DESC
        LIMIT ?
        `,
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // Sales operations
  validateSaleData(saleData) {
    const { saleNumber, items, totalAmount, saleDate } = saleData;
    
    if (!saleNumber || typeof saleNumber !== 'string' || saleNumber.trim().length === 0) {
      throw new Error('Sale number is required and must be a valid string');
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Sale items are required and must be a non-empty array');
    }
    if (typeof totalAmount !== 'number' || totalAmount < 0) {
      throw new Error('Total amount must be a valid positive number');
    }
    
    // Validate saleDate - it should be provided and be a valid date string or Date object
    if (!saleDate) {
      throw new Error('Sale date is required');
    }
    
    // Validate each item
    items.forEach((item, index) => {
      if (!item.productId || !Number.isInteger(Number(item.productId)) || Number(item.productId) <= 0) {
        throw new Error(`Item ${index + 1}: Invalid product ID`);
      }
      if (!item.quantity || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
        throw new Error(`Item ${index + 1}: Invalid quantity`);
      }
      if (typeof item.unitPrice !== 'number' || item.unitPrice < 0) {
        throw new Error(`Item ${index + 1}: Invalid unit price`);
      }
      if (typeof item.totalPrice !== 'number' || item.totalPrice < 0) {
        throw new Error(`Item ${index + 1}: Invalid total price`);
      }
    });
    
    return {
      ...saleData,
      saleNumber: saleData.saleNumber.trim(),
      customerName: saleData.customerName ? saleData.customerName.trim() : null,
      customerPhone: saleData.customerPhone ? saleData.customerPhone.trim() : null,
      tableNumber: saleData.tableNumber ? saleData.tableNumber.trim() : null,
      saleDate: saleDate, // Ensure saleDate is passed through
    };
  }

  createSale(saleData) {
    return new Promise((resolve, reject) => {
      try {
        const validatedSaleData = this.validateSaleData(saleData);
        const {
          saleNumber,
          saleType,
          tableNumber,
          customerName,
          customerPhone,
          items,
          totalAmount,
          taxAmount,
          discountAmount,
          paymentMethod,
          saleDate,
        } = validatedSaleData;

        const db = this.db;
        db.serialize(() => {
          db.run("BEGIN TRANSACTION");

          // Insert sale
          db.run(
            `
            INSERT INTO sales (sale_number, sale_type, table_number, customer_name, customer_phone, total_amount, tax_amount, discount_amount, payment_method, sale_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
            [
              saleNumber,
              saleType,
              tableNumber,
              customerName,
              customerPhone,
              totalAmount,
              taxAmount,
              discountAmount,
              paymentMethod,
              saleDate,
            ],
            function (err) {
              if (err) {
                db.run("ROLLBACK");
                reject(err);
                return;
              }

              const saleId = this.lastID;
              let itemsProcessed = 0;

              items.forEach((item) => {
                // Insert sale item
                db.run(
                  `
                INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?)
              `,
                  [
                    saleId,
                    Number(item.productId),
                    Number(item.quantity),
                    item.unitPrice,
                    item.totalPrice,
                  ],
                  (err) => {
                    if (err) {
                      db.run("ROLLBACK");
                      reject(err);
                      return;
                    }

                    // Update counter stock
                    db.run(
                      `
                  UPDATE inventory 
                  SET counter_stock = counter_stock - ?
                  WHERE product_id = ?
                `,
                      [Number(item.quantity), Number(item.productId)],
                      (err) => {
                        if (err) {
                          db.run("ROLLBACK");
                          reject(err);
                          return;
                        }

                        // Record stock movement
                        db.run(
                          `
                    INSERT INTO stock_movements (product_id, movement_type, quantity, from_location, reference_id)
                    VALUES (?, 'out', ?, 'counter', ?)
                  `,
                          [Number(item.productId), Number(item.quantity), saleId],
                          (err) => {
                            if (err) {
                              db.run("ROLLBACK");
                              reject(err);
                              return;
                            }

                            itemsProcessed++;
                            if (itemsProcessed === items.length) {
                              db.run("COMMIT");
                              resolve({ id: saleId, ...validatedSaleData });
                            }
                          }
                        );
                      }
                    );
                  }
                );
              });
            }
          );
        });
      } catch (error) {
        reject(error);
      }
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
        query += " WHERE s.sale_date BETWEEN ? AND ?";
        params.push(dateRange.start, dateRange.end);
      }

      query += " GROUP BY s.id ORDER BY s.sale_date DESC";

      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  // Get sales with detailed cost price and profit calculations
  getSalesWithDetails(dateRange) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT s.*, 
               COUNT(si.id) as item_count,
               GROUP_CONCAT(p.name || ' x' || si.quantity) as items_summary,
               SUM(si.quantity * p.cost) as total_cost_price,
               SUM(si.total_price) as total_sale_price,
               (SUM(si.total_price) - SUM(si.quantity * p.cost)) as profit
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        LEFT JOIN products p ON si.product_id = p.id
      `;

      const params = [];

      if (dateRange && dateRange.start && dateRange.end) {
        query += " WHERE s.sale_date BETWEEN ? AND ?";
        params.push(dateRange.start, dateRange.end);
      }

      query += " GROUP BY s.id ORDER BY s.sale_date DESC";

      console.log('getSalesWithDetails query:', query);
      console.log('getSalesWithDetails params:', params);

      this.db.all(query, params, (err, rows) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          console.log('Database query result:', rows.length, 'rows');
          resolve(rows);
        }
      });
    });
  }

  // Get individual sale with complete item details
  getSaleWithItems(saleId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, 
               JSON_GROUP_ARRAY(
                 JSON_OBJECT(
                   'name', p.name,
                   'quantity', si.quantity,
                   'unitPrice', si.unit_price,
                   'totalPrice', si.total_price
                 )
               ) as items
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        LEFT JOIN products p ON si.product_id = p.id
        WHERE s.id = ?
        GROUP BY s.id
      `;

      this.db.get(query, [saleId], (err, row) => {
        if (err) {
          console.error('Database query error:', err);
          reject(err);
        } else {
          if (row && row.items) {
            try {
              row.items = JSON.parse(row.items);
            } catch (e) {
              console.error('Error parsing items JSON:', e);
              row.items = [];
            }
          }
          resolve(row);
        }
      });
    });
  }

  // Table operations
  getTables() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `
        SELECT t.*, tord.total as current_bill_amount
        FROM tables t
        LEFT JOIN table_orders tord ON t.id = tord.table_id
        ORDER BY t.area, t.name
      `,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  addTable(table) {
    return new Promise((resolve, reject) => {
      const { name, capacity, area, status } = table;

      this.db.run(
        `
        INSERT INTO tables (name, capacity, area, status)
        VALUES (?, ?, ?, ?)
      `,
        [name, capacity, area, status],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...table });
          }
        }
      );
    });
  }

  updateTable(id, table) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const values = [];

      Object.keys(table).forEach((key) => {
        if (table[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(table[key]);
        }
      });

      if (fields.length === 0) {
        resolve({ updated: false });
        return;
      }

      values.push(id);

      this.db.run(
        `
        UPDATE tables 
        SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        values,
        function (err) {
          if (err) reject(err);
          else resolve({ updated: this.changes > 0 });
        }
      );
    });
  }

  deleteTable(id) {
    return new Promise((resolve, reject) => {
      this.db.run("DELETE FROM tables WHERE id = ?", [id], function (err) {
        if (err) reject(err);
        else resolve({ deleted: this.changes > 0 });
      });
    });
  }

  // Table order operations
  getTableOrder(tableId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `
        SELECT * FROM table_orders WHERE table_id = ?
      `,
        [tableId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            // Parse the items JSON
            try {
              row.items = JSON.parse(row.items || "[]");
            } catch (e) {
              row.items = [];
            }
            resolve(row);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  saveTableOrder(orderData) {
    return new Promise((resolve, reject) => {
      const {
        table_id,
        customer_name,
        customer_phone,
        items,
        discount,
        tax,
        notes,
        subtotal,
        total,
        kot_printed,
      } = orderData;

      // Convert items to JSON string
      const itemsJson = JSON.stringify(items);

      // Check if order already exists
      this.db.get(
        "SELECT id FROM table_orders WHERE table_id = ?",
        [table_id],
        (err, existing) => {
          if (err) {
            reject(err);
            return;
          }

          if (existing) {
            // Update existing order
            this.db.run(
              `
            UPDATE table_orders 
            SET customer_name = ?, customer_phone = ?, items = ?, discount = ?, 
                tax = ?, notes = ?, subtotal = ?, total = ?, kot_printed = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE table_id = ?
          `,
              [
                customer_name,
                customer_phone,
                itemsJson,
                discount,
                tax,
                notes,
                subtotal,
                total,
                kot_printed,
                table_id,
              ],
              function (err) {
                if (err) reject(err);
                else resolve({ id: existing.id, updated: true });
              }
            );
          } else {
            // Insert new order
            this.db.run(
              `
            INSERT INTO table_orders (table_id, customer_name, customer_phone, items, discount, tax, notes, subtotal, total, kot_printed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
              [
                table_id,
                customer_name,
                customer_phone,
                itemsJson,
                discount,
                tax,
                notes,
                subtotal,
                total,
                kot_printed,
              ],
              function (err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, created: true });
              }
            );
          }
        }
      );
    });
  }

  clearTableOrder(tableId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "DELETE FROM table_orders WHERE table_id = ?",
        [tableId],
        function (err) {
          if (err) reject(err);
          else resolve({ deleted: this.changes > 0 });
        }
      );
    });
  }

  // Daily transfer operations
  saveDailyTransfer(transferData) {
    return new Promise((resolve, reject) => {
      const { transfer_date, total_items, total_quantity, items_transferred } =
        transferData;
      const itemsJson = JSON.stringify(items_transferred);

      this.db.run(
        `
        INSERT INTO daily_transfers (transfer_date, total_items, total_quantity, items_transferred)
        VALUES (?, ?, ?, ?)
      `,
        [transfer_date, total_items, total_quantity, itemsJson],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...transferData });
        }
      );
    });
  }

  getDailyTransfers(dateRange) {
    return new Promise((resolve, reject) => {
      let query = "SELECT * FROM daily_transfers";
      const params = [];

      if (dateRange && dateRange.start && dateRange.end) {
        query += " WHERE transfer_date BETWEEN ? AND ?";
        params.push(dateRange.start, dateRange.end);
      }

      // Order by created_at timestamp first (most recent first), then by transfer_date
      query += " ORDER BY created_at DESC, transfer_date DESC";

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Parse the items_transferred JSON
          const transfers = rows.map((row) => {
            try {
              row.items_transferred = JSON.parse(row.items_transferred || "[]");
            } catch (e) {
              row.items_transferred = [];
            }
            return row;
          });
          resolve(transfers);
        }
      });
    });
  }

  // Bar settings operations
  getBarSettings() {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM bar_settings ORDER BY id DESC LIMIT 1",
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            resolve(row);
          } else {
            // Return default settings if none exist
            resolve({
              bar_name: "My Bar",
              contact_number: "",
              gst_number: "",
              address: "",
              thank_you_message: "Thank you for visiting!",
            });
          }
        }
      );
    });
  }

  saveBarSettings(settings) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO bar_settings (id, bar_name, contact_number, gst_number, address, thank_you_message, updated_at)
        VALUES (1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      this.db.run(
        query,
        [
          settings.bar_name || settings.barName,
          settings.contact_number || settings.contactNumber,
          settings.gst_number || settings.gstNumber,
          settings.address,
          settings.thank_you_message || settings.thankYouMessage,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });
  }

  // Spendings methods
  addSpending(spending) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO spendings (description, amount, category, spending_date, payment_method, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        query,
        [
          spending.description,
          spending.amount,
          spending.category,
          spending.spendingDate,
          spending.paymentMethod || "cash",
          spending.notes || "",
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });
  }

  updateSpending(id, spending) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE spendings 
        SET description = ?, amount = ?, category = ?, spending_date = ?, 
            payment_method = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db.run(
        query,
        [
          spending.description,
          spending.amount,
          spending.category,
          spending.spendingDate,
          spending.paymentMethod || "cash",
          spending.notes || "",
          id,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  deleteSpending(id) {
    return new Promise((resolve, reject) => {
      const query = `DELETE FROM spendings WHERE id = ?`;

      this.db.run(query, [id], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  getSpendings(dateRange = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT * FROM spendings 
        ORDER BY spending_date DESC, created_at DESC
      `;

      let params = [];

      if (dateRange && dateRange.start && dateRange.end) {
        query = `
          SELECT * FROM spendings 
          WHERE spending_date BETWEEN ? AND ?
          ORDER BY spending_date DESC, created_at DESC
        `;
        params = [dateRange.start, dateRange.end];
      }

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getSpendingCategories() {
    return new Promise((resolve, reject) => {
      const query = `SELECT DISTINCT category FROM spendings ORDER BY category`;

      this.db.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map((row) => row.category));
        }
      });
    });
  }

  getDailySpendingTotal(date) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT COALESCE(SUM(amount), 0) as total 
        FROM spendings 
        WHERE spending_date = ?
      `;

      this.db.get(query, [date], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.total);
        }
      });
    });
  }

  // Counter balance methods
  addCounterBalance(balance) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO counter_balance (balance_date, opening_balance, closing_balance, notes, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      this.db.run(
        query,
        [
          balance.balanceDate,
          balance.openingBalance,
          balance.closingBalance,
          balance.notes || "",
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });
  }

  updateCounterBalance(date, balance) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE counter_balance 
        SET opening_balance = ?, closing_balance = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE balance_date = ?
      `;

      this.db.run(
        query,
        [
          balance.openingBalance,
          balance.closingBalance,
          balance.notes || "",
          date,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  getCounterBalance(date) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM counter_balance WHERE balance_date = ?`;

      this.db.get(query, [date], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  getCounterBalances(dateRange = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT * FROM counter_balance 
        ORDER BY balance_date DESC
      `;

      let params = [];

      if (dateRange && dateRange.start && dateRange.end) {
        query = `
          SELECT * FROM counter_balance 
          WHERE balance_date BETWEEN ? AND ?
          ORDER BY balance_date DESC
        `;
        params = [dateRange.start, dateRange.end];
      }

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  getPreviousDayClosingBalance(date) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT closing_balance 
        FROM counter_balance 
        WHERE balance_date < ? 
        ORDER BY balance_date DESC 
        LIMIT 1
      `;

      this.db.get(query, [date], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.closing_balance : 0);
        }
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }

  // Reset application - clear all data and reinitialize
  resetApplication() {
    return new Promise((resolve, reject) => {
      const tables = [
        'pending_bills',
        'counter_balance',
        'spendings',
        'daily_transfers',
        'table_orders',
        'tables',
        'stock_movements',
        'sale_items',
        'sales',
        'inventory',
        'products',
        'bar_settings'
      ];

      const db = this.db;
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        let completed = 0;
        const total = tables.length;
        
        tables.forEach((table) => {
          db.run(`DELETE FROM ${table}`, (err) => {
            if (err) {
              console.error(`Error clearing table ${table}:`, err);
              // Continue with other tables even if one fails
            }
            
            completed++;
            if (completed === total) {
              // Reset sqlite_sequence for auto-increment IDs
              db.run('DELETE FROM sqlite_sequence', (err) => {
                if (err) {
                  console.error('Error resetting sequences:', err);
                }
                
                db.run('COMMIT', (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    reject(err);
                  } else {
                    console.log('Application reset completed successfully');
                    resolve({ success: true, message: 'Application reset completed' });
                  }
                });
              });
            }
          });
        });
      });
    });
  }

  // Pending bills methods
  addPendingBill(billData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO pending_bills (bill_number, sale_type, table_number, customer_name, customer_phone, items, 
                                  subtotal, tax_amount, discount_amount, total_amount, payment_method, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        query,
        [
          billData.billNumber,
          billData.saleType,
          billData.tableNumber,
          billData.customerName,
          billData.customerPhone,
          JSON.stringify(billData.items),
          billData.subtotal,
          billData.taxAmount,
          billData.discountAmount,
          billData.totalAmount,
          billData.paymentMethod,
          billData.notes || "",
        ],
        function (err) {
          if (err) {
            console.error("Failed to add pending bill:", err);
            reject(err);
          } else {
            resolve({ id: this.lastID, ...billData });
          }
        }
      );
    });
  }

  getPendingBills() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM pending_bills 
        ORDER BY created_at DESC
      `;

      this.db.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const bills = rows.map((row) => {
            try {
              row.items = JSON.parse(row.items || "[]");
            } catch (e) {
              row.items = [];
            }
            return row;
          });
          resolve(bills);
        }
      });
    });
  }

  updatePendingBill(id, billData) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE pending_bills 
        SET sale_type = ?, table_number = ?, customer_name = ?, customer_phone = ?, items = ?, 
            subtotal = ?, tax_amount = ?, discount_amount = ?, total_amount = ?, payment_method = ?, 
            notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db.run(
        query,
        [
          billData.saleType,
          billData.tableNumber,
          billData.customerName,
          billData.customerPhone,
          JSON.stringify(billData.items),
          billData.subtotal,
          billData.taxAmount,
          billData.discountAmount,
          billData.totalAmount,
          billData.paymentMethod,
          billData.notes || "",
          id,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({ changes: this.changes });
          }
        }
      );
    });
  }

  deletePendingBill(id) {
    return new Promise((resolve, reject) => {
      const query = `DELETE FROM pending_bills WHERE id = ?`;

      this.db.run(query, [id], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  clearPendingBill(id) {
    return new Promise((resolve, reject) => {
      const db = this.db;
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Get the pending bill data
        db.get(
          "SELECT * FROM pending_bills WHERE id = ?",
          [id],
          (err, pendingBill) => {
            if (err) {
              db.run("ROLLBACK");
              reject(err);
              return;
            }

            if (!pendingBill) {
              db.run("ROLLBACK");
              reject(new Error("Pending bill not found"));
              return;
            }

            // Parse items
            let items;
            try {
              items = JSON.parse(pendingBill.items);
            } catch (e) {
              db.run("ROLLBACK");
              reject(new Error("Invalid items data"));
              return;
            }

            // Generate new sale number
            const now = new Date();
            const day = now.getDate().toString().padStart(2, "0");
            const month = (now.getMonth() + 1).toString().padStart(2, "0");
            const year = now.getFullYear().toString().slice(-2);
            const randomNum = Math.floor(Math.random() * 900) + 100;
            const saleNumber = `${day}${month}${year}${randomNum}`;

            // Create sale record
            db.run(
              `
              INSERT INTO sales (sale_number, sale_type, table_number, customer_name, customer_phone, 
                                total_amount, tax_amount, discount_amount, payment_method, sale_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
              [
                saleNumber,
                pendingBill.sale_type,
                pendingBill.table_number,
                pendingBill.customer_name,
                pendingBill.customer_phone,
                pendingBill.total_amount,
                pendingBill.tax_amount,
                pendingBill.discount_amount,
                pendingBill.payment_method,
                new Date().toISOString(),
              ],
              function (err) {
                if (err) {
                  db.run("ROLLBACK");
                  reject(err);
                  return;
                }

                const saleId = this.lastID;
                let itemsProcessed = 0;

                items.forEach((item) => {
                  // Insert sale item
                  db.run(
                    `
                    INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
                    VALUES (?, ?, ?, ?, ?)
                  `,
                    [
                      saleId,
                      item.productId,
                      item.quantity,
                      item.unitPrice,
                      item.totalPrice,
                    ],
                    (err) => {
                      if (err) {
                        db.run("ROLLBACK");
                        reject(err);
                        return;
                      }

                      // Update counter stock
                      db.run(
                        `
                        UPDATE inventory 
                        SET counter_stock = counter_stock - ?
                        WHERE product_id = ?
                      `,
                        [item.quantity, item.productId],
                        (err) => {
                          if (err) {
                            db.run("ROLLBACK");
                            reject(err);
                            return;
                          }

                          // Record stock movement
                          db.run(
                            `
                            INSERT INTO stock_movements (product_id, movement_type, quantity, from_location, reference_id)
                            VALUES (?, 'out', ?, 'counter', ?)
                          `,
                            [item.productId, item.quantity, saleId],
                            (err) => {
                              if (err) {
                                db.run("ROLLBACK");
                                reject(err);
                                return;
                              }

                              itemsProcessed++;
                              if (itemsProcessed === items.length) {
                                // Delete the pending bill
                                db.run(
                                  "DELETE FROM pending_bills WHERE id = ?",
                                  [id],
                                  (err) => {
                                    if (err) {
                                      db.run("ROLLBACK");
                                      reject(err);
                                      return;
                                    }

                                    db.run("COMMIT");
                                    resolve({ 
                                      success: true, 
                                      saleId: saleId, 
                                      saleNumber: saleNumber,
                                      saleData: {
                                        saleNumber: saleNumber,
                                        saleType: pendingBill.sale_type,
                                        tableNumber: pendingBill.table_number,
                                        customerName: pendingBill.customer_name,
                                        customerPhone: pendingBill.customer_phone,
                                        items: items,
                                        subtotal: pendingBill.subtotal,
                                        taxAmount: pendingBill.tax_amount,
                                        discountAmount: pendingBill.discount_amount,
                                        totalAmount: pendingBill.total_amount,
                                        paymentMethod: pendingBill.payment_method,
                                        saleDate: new Date().toISOString()
                                      }
                                    });
                                  }
                                );
                              }
                            }
                          );
                        }
                      );
                    }
                  );
                });
              }
            );
          }
        );
      });
    });
  }

  /**
   * GET DATABASE PATH
   * 
   * Returns the absolute path to the SQLite database file.
   * Useful for backup operations.
   * 
   * @returns {string} The absolute path to the database file
   */
  getDatabasePath() {
    return this.dbPath;
  }
}

module.exports = Database;
