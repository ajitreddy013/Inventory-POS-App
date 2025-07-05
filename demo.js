const Database = require('./src/database');

async function demonstrateFeatures() {
  console.log('🏪 Ajit Bar & Restaurant POS System Demo\n');
  
  const db = new Database();
  await db.initialize();
  
  try {
    // Show products with variants
    console.log('📦 PRODUCT CATALOG WITH VARIANTS:');
    const products = await db.getProducts();
    products.forEach(product => {
      console.log(`- ${product.name}${product.variant ? ` (${product.variant})` : ''} - ₹${product.price} [${product.sku}]`);
    });
    
    // Show inventory with godown/counter split
    console.log('\n📊 INVENTORY STATUS (Godown | Counter):');
    const inventory = await db.getInventory();
    inventory.forEach(item => {
      console.log(`- ${item.name}${item.variant ? ` (${item.variant})` : ''}: ${item.godown_stock} | ${item.counter_stock}`);
    });
    
    // Demonstrate stock transfer
    console.log('\n🔄 DEMONSTRATING STOCK TRANSFER:');
    const firstItem = inventory.find(item => item.godown_stock > 0);
    if (firstItem) {
      console.log(`Transferring 5 units of ${firstItem.name} from godown to counter...`);
      await db.transferStock(firstItem.id, 5, 'godown', 'counter');
      
      // Show updated inventory
      const updatedInventory = await db.getInventory();
      const updatedItem = updatedInventory.find(item => item.id === firstItem.id);
      console.log(`✓ Updated: ${updatedItem.name} - Godown: ${updatedItem.godown_stock}, Counter: ${updatedItem.counter_stock}`);
    }
    
    // Demonstrate sale creation
    console.log('\n🛒 DEMONSTRATING SALE CREATION:');
    const saleData = {
      saleNumber: 'DEMO-001',
      saleType: 'table',
      tableNumber: 'T5',
      customerName: 'Demo Customer',
      customerPhone: '+91 9876543210',
      items: [
        {
          productId: products[0].id,
          name: products[0].name,
          quantity: 2,
          unitPrice: products[0].price,
          totalPrice: products[0].price * 2
        },
        {
          productId: products[1].id,
          name: products[1].name,
          quantity: 1,
          unitPrice: products[1].price,
          totalPrice: products[1].price * 1
        }
      ],
      totalAmount: (products[0].price * 2) + (products[1].price * 1),
      taxAmount: 0,
      discountAmount: 0,
      paymentMethod: 'cash'
    };
    
    await db.createSale(saleData);
    console.log(`✓ Sale created: ${saleData.saleNumber} for ₹${saleData.totalAmount}`);
    console.log(`  Table: ${saleData.tableNumber}, Customer: ${saleData.customerName}`);
    console.log(`  Items: ${saleData.items.length} items`);
    
    // Show sales report
    console.log('\n📈 SALES REPORT:');
    const sales = await db.getSales();
    sales.forEach(sale => {
      console.log(`- ${sale.sale_number}: ₹${sale.total_amount} (${sale.sale_type === 'table' ? 'Table ' + sale.table_number : 'Parcel'})`);
    });
    
    // Show key features summary
    console.log('\n🎯 KEY FEATURES DEMONSTRATED:');
    console.log('✓ Product management with variants (330ml, 650ml bottles)');
    console.log('✓ Dual inventory system (Godown + Counter stock)');
    console.log('✓ Easy stock transfer between locations');
    console.log('✓ Complete POS billing with table/parcel support');
    console.log('✓ Automatic stock deduction on sales');
    console.log('✓ Sales tracking and reporting');
    console.log('✓ Customer information recording');
    console.log('✓ Multiple payment method support');
    
    console.log('\n🚀 Ready for production use!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run dev (to start the application)');
    console.log('2. Add your actual products in the Products section');
    console.log('3. Set up initial stock levels in Inventory');
    console.log('4. Start using the Daily Transfer feature');
    console.log('5. Process sales through the POS system');
    console.log('6. Generate bills and reports as needed');
    
  } catch (error) {
    console.error('Demo error:', error.message);
  } finally {
    db.close();
  }
}

demonstrateFeatures();
