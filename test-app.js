const Database = require('./src/database');
const { initializeSampleData } = require('./src/init-sample-data');

async function testApp() {
  console.log('Testing Ajit Bar & Restaurant POS Application...');
  
  try {
    // Test database initialization
    console.log('1. Testing database initialization...');
    const db = new Database();
    await db.initialize();
    console.log('✓ Database initialized successfully');
    
    // Test sample data
    console.log('2. Testing sample data initialization...');
    await initializeSampleData(db);
    console.log('✓ Sample data added successfully');
    
    // Test basic operations
    console.log('3. Testing basic operations...');
    
    // Get products
    const products = await db.getProducts();
    console.log(`✓ Found ${products.length} products`);
    
    // Get inventory
    const inventory = await db.getInventory();
    console.log(`✓ Found ${inventory.length} inventory items`);
    
    // Test a stock transfer
    if (inventory.length > 0) {
      const product = inventory[0];
      if (product.godown_stock > 0) {
        await db.transferStock(product.id, 1, 'godown', 'counter');
        console.log(`✓ Stock transfer successful for ${product.name}`);
      }
    }
    
    // Get sales (should be empty initially)
    const sales = await db.getSales();
    console.log(`✓ Found ${sales.length} sales records`);
    
    console.log('\n🎉 All tests passed! The application is ready to use.');
    console.log('\nTo start the application:');
    console.log('  npm run dev  (for development)');
    console.log('  npm start    (for production)');
    
    db.close();
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testApp();
