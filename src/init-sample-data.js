// This script can be run to add sample data to test the application
// It should be called from the main process after database initialization

const sampleProducts = [
  {
    name: "Kingfisher Beer",
    variant: "330ml",
    sku: "KF-330",
    barcode: "1234567890001",
    price: 80.00,
    cost: 60.00,
    category: "Beer",
    description: "Kingfisher Premium Beer 330ml bottle",
    unit: "bottle"
  },
  {
    name: "Kingfisher Beer",
    variant: "650ml",
    sku: "KF-650",
    barcode: "1234567890002",
    price: 150.00,
    cost: 120.00,
    category: "Beer",
    description: "Kingfisher Premium Beer 650ml bottle",
    unit: "bottle"
  },
  {
    name: "Chicken Tikka",
    variant: "Full",
    sku: "CT-FULL",
    barcode: "1234567890003",
    price: 280.00,
    cost: 180.00,
    category: "Non-Veg",
    description: "Boneless chicken tikka - full portion",
    unit: "plate"
  },
  {
    name: "Chicken Tikka",
    variant: "Half",
    sku: "CT-HALF",
    barcode: "1234567890004",
    price: 160.00,
    cost: 100.00,
    category: "Non-Veg",
    description: "Boneless chicken tikka - half portion",
    unit: "plate"
  },
  {
    name: "Paneer Butter Masala",
    variant: "Regular",
    sku: "PBM-REG",
    barcode: "1234567890005",
    price: 220.00,
    cost: 140.00,
    category: "Veg",
    description: "Rich and creamy paneer butter masala",
    unit: "plate"
  },
  {
    name: "Naan",
    variant: "Plain",
    sku: "NAAN-PLAIN",
    barcode: "1234567890006",
    price: 30.00,
    cost: 15.00,
    category: "Bread",
    description: "Fresh tandoor naan bread",
    unit: "pcs"
  },
  {
    name: "Naan",
    variant: "Butter",
    sku: "NAAN-BUTTER",
    barcode: "1234567890007",
    price: 40.00,
    cost: 20.00,
    category: "Bread",
    description: "Butter naan bread",
    unit: "pcs"
  },
  {
    name: "Whiskey",
    variant: "Royal Stag 60ml",
    sku: "RS-60",
    barcode: "1234567890008",
    price: 120.00,
    cost: 90.00,
    category: "Spirits",
    description: "Royal Stag whiskey 60ml peg",
    unit: "glass"
  },
  {
    name: "Whiskey",
    variant: "Royal Stag 30ml",
    sku: "RS-30",
    barcode: "1234567890009",
    price: 80.00,
    cost: 60.00,
    category: "Spirits",
    description: "Royal Stag whiskey 30ml peg",
    unit: "glass"
  },
  {
    name: "Jeera Rice",
    variant: "Regular",
    sku: "JR-REG",
    barcode: "1234567890010",
    price: 120.00,
    cost: 70.00,
    category: "Rice",
    description: "Aromatic jeera rice",
    unit: "plate"
  }
];

const sampleStock = [
  { productId: 1, godownStock: 50, counterStock: 10 },
  { productId: 2, godownStock: 30, counterStock: 8 },
  { productId: 3, godownStock: 0, counterStock: 0 }, // Show out of stock
  { productId: 4, godownStock: 20, counterStock: 5 },
  { productId: 5, godownStock: 25, counterStock: 6 },
  { productId: 6, godownStock: 40, counterStock: 15 },
  { productId: 7, godownStock: 35, counterStock: 12 },
  { productId: 8, godownStock: 20, counterStock: 4 },
  { productId: 9, godownStock: 25, counterStock: 6 },
  { productId: 10, godownStock: 30, counterStock: 8 }
];

async function initializeSampleData(database) {
  try {
    console.log('Initializing sample data...');
    
    // Add sample products
    for (const product of sampleProducts) {
      try {
        await database.addProduct(product);
        console.log(`Added product: ${product.name} ${product.variant}`);
      } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
          console.log(`Product ${product.name} ${product.variant} already exists, skipping...`);
        } else {
          console.error(`Error adding product ${product.name}:`, error.message);
        }
      }
    }
    
    // Update stock levels
    for (const stock of sampleStock) {
      try {
        await database.updateStock(stock.productId, stock.godownStock, stock.counterStock);
        console.log(`Updated stock for product ID ${stock.productId}`);
      } catch (error) {
        console.error(`Error updating stock for product ID ${stock.productId}:`, error.message);
      }
    }
    
    console.log('Sample data initialization completed!');
    
  } catch (error) {
    console.error('Error initializing sample data:', error);
  }
}

module.exports = { initializeSampleData, sampleProducts, sampleStock };
