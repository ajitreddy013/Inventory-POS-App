const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const os = require("os");

class Database {
  constructor() {
    // Handle both Electron and Node.js contexts
    let userDataPath;
    try {
      const { app } = require("electron");
      userDataPath = app.getPath("userData");
    } catch (error) {
      // Fallback for testing outside Electron
      userDataPath = path.join(os.homedir(), "ajit-pos-data");
      const fs = require("fs");
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
    }
    this.dbPath = path.join(userDataPath, "inventory.db");
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

  addProduct(product) {
    return new Promise((resolve, reject) => {
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
      } = product;

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
                else resolve({ id: productId, ...product });
              }
            );
          }
        }
      );
    });
  }

  updateProduct(id, product) {
    return new Promise((resolve, reject) => {
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
      } = product;

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
          else resolve({ id, ...product });
        }
      );
    });
  }

  deleteProduct(id) {
    return new Promise((resolve, reject) => {
      this.db.run("DELETE FROM products WHERE id = ?", [id], function (err) {
        if (err) reject(err);
        else resolve({ deleted: this.changes > 0 });
      });
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

  // Sales operations
  createSale(saleData) {
    return new Promise((resolve, reject) => {
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
      } = saleData;

      const db = this.db;
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Insert sale
        db.run(
          `
          INSERT INTO sales (sale_number, sale_type, table_number, customer_name, customer_phone, total_amount, tax_amount, discount_amount, payment_method)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                            db.run("COMMIT");
                            resolve({ id: saleId, ...saleData });
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

      query += " ORDER BY transfer_date DESC";

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
          settings.barName,
          settings.contactNumber,
          settings.gstNumber,
          settings.address,
          settings.thankYouMessage,
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
}

module.exports = Database;
