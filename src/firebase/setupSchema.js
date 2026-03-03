/**
 * Firestore Database Schema Setup Script
 * 
 * This script initializes all Firestore collections with sample data
 * and creates necessary indexes for the WaiterFlow system.
 * 
 * Run with: node src/firebase/setupSchema.js
 */

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc,
  serverTimestamp,
  Timestamp
} = require('firebase/firestore');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log('🔥 Firebase initialized successfully');
console.log('📦 Starting database schema setup...\n');

/**
 * Create managers collection with sample data
 */
async function setupManagers() {
  console.log('👤 Setting up managers collection...');
  
  const managersData = [
    {
      name: 'Rajesh Kumar',
      pin: await bcrypt.hash('123456', 10),
      email: 'rajesh@counterflow.com',
      role: 'owner',
      isActive: true
    },
    {
      name: 'Priya Sharma',
      pin: await bcrypt.hash('234567', 10),
      email: 'priya@counterflow.com',
      role: 'manager',
      isActive: true
    }
  ];

  for (const manager of managersData) {
    const docRef = await addDoc(collection(db, 'managers'), {
      ...manager,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log(`  ✓ Created manager: ${manager.name} (ID: ${docRef.id})`);
  }
}

/**
 * Create waiters collection with sample data
 */
async function setupWaiters() {
  console.log('\n👨‍🍳 Setting up waiters collection...');
  
  const waitersData = [
    { name: 'Amit Patel', pin: '1234' },
    { name: 'Neha Singh', pin: '5678' },
    { name: 'Vikram Reddy', pin: '9012' },
    { name: 'Anita Desai', pin: '3456' }
  ];

  for (const waiter of waitersData) {
    const docRef = await addDoc(collection(db, 'waiters'), {
      ...waiter,
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log(`  ✓ Created waiter: ${waiter.name} (PIN: ${waiter.pin}, ID: ${docRef.id})`);
  }
}

/**
 * Create sections collection with sample data
 */
async function setupSections() {
  console.log('\n🏢 Setting up sections collection...');
  
  const sectionsData = [
    { name: 'AC Section' },
    { name: 'Garden' },
    { name: 'Rooftop' }
  ];

  const sectionIds = [];
  for (const section of sectionsData) {
    const docRef = await addDoc(collection(db, 'sections'), {
      ...section,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    sectionIds.push(docRef.id);
    console.log(`  ✓ Created section: ${section.name} (ID: ${docRef.id})`);
  }
  
  return sectionIds;
}

/**
 * Create tables collection with sample data
 */
async function setupTables(sectionIds) {
  console.log('\n🪑 Setting up tables collection...');
  
  const tablesData = [
    { name: 'T1', sectionId: sectionIds[0], status: 'available' },
    { name: 'T2', sectionId: sectionIds[0], status: 'available' },
    { name: 'T3', sectionId: sectionIds[0], status: 'available' },
    { name: 'G1', sectionId: sectionIds[1], status: 'available' },
    { name: 'G2', sectionId: sectionIds[1], status: 'available' },
    { name: 'R1', sectionId: sectionIds[2], status: 'available' },
    { name: 'R2', sectionId: sectionIds[2], status: 'available' }
  ];

  for (const table of tablesData) {
    const docRef = await addDoc(collection(db, 'tables'), {
      ...table,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log(`  ✓ Created table: ${table.name} in section ${table.sectionId}`);
  }
}

/**
 * Create menuCategories collection with sample data
 */
async function setupMenuCategories() {
  console.log('\n📋 Setting up menuCategories collection...');
  
  const categoriesData = [
    { name: 'Starters', displayOrder: 1 },
    { name: 'Main Course', displayOrder: 2 },
    { name: 'Breads', displayOrder: 3 },
    { name: 'Beverages', displayOrder: 4 },
    { name: 'Desserts', displayOrder: 5 }
  ];

  const categoryIds = [];
  for (const category of categoriesData) {
    const docRef = await addDoc(collection(db, 'menuCategories'), {
      ...category,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    categoryIds.push(docRef.id);
    console.log(`  ✓ Created category: ${category.name} (ID: ${docRef.id})`);
  }
  
  return categoryIds;
}

/**
 * Create modifiers collection with sample data
 */
async function setupModifiers() {
  console.log('\n🌶️ Setting up modifiers collection...');
  
  const modifiersData = [
    { name: 'Mild', type: 'spice_level', price: 0 },
    { name: 'Medium', type: 'spice_level', price: 0 },
    { name: 'Hot', type: 'spice_level', price: 0 },
    { name: 'Extra Cheese', type: 'paid_addon', price: 30 },
    { name: 'Extra Butter', type: 'paid_addon', price: 20 }
  ];

  const modifierIds = [];
  for (const modifier of modifiersData) {
    const docRef = await addDoc(collection(db, 'modifiers'), {
      ...modifier,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    modifierIds.push(docRef.id);
    console.log(`  ✓ Created modifier: ${modifier.name} (${modifier.type})`);
  }
  
  return modifierIds;
}

/**
 * Create menuItems collection with sample data
 */
async function setupMenuItems(categoryIds, modifierIds) {
  console.log('\n🍽️ Setting up menuItems collection...');
  
  const menuItemsData = [
    {
      name: 'Paneer Tikka',
      price: 250,
      categoryId: categoryIds[0],
      itemCategory: 'food',
      isBarItem: false,
      isOutOfStock: false,
      availableModifierIds: [modifierIds[0], modifierIds[1], modifierIds[2]]
    },
    {
      name: 'Chicken Biryani',
      price: 350,
      categoryId: categoryIds[1],
      itemCategory: 'food',
      isBarItem: false,
      isOutOfStock: false,
      availableModifierIds: [modifierIds[0], modifierIds[1], modifierIds[2]]
    },
    {
      name: 'Butter Naan',
      price: 40,
      categoryId: categoryIds[2],
      itemCategory: 'food',
      isBarItem: false,
      isOutOfStock: false,
      availableModifierIds: [modifierIds[4]]
    },
    {
      name: 'Kingfisher Beer',
      price: 150,
      categoryId: categoryIds[3],
      itemCategory: 'drink',
      isBarItem: true,
      isOutOfStock: false,
      availableModifierIds: []
    },
    {
      name: 'Mango Lassi',
      price: 80,
      categoryId: categoryIds[3],
      itemCategory: 'drink',
      isBarItem: false,
      isOutOfStock: false,
      availableModifierIds: []
    },
    {
      name: 'Gulab Jamun',
      price: 60,
      categoryId: categoryIds[4],
      itemCategory: 'food',
      isBarItem: false,
      isOutOfStock: false,
      availableModifierIds: []
    }
  ];

  const menuItemIds = [];
  for (const item of menuItemsData) {
    const docRef = await addDoc(collection(db, 'menuItems'), {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    menuItemIds.push(docRef.id);
    console.log(`  ✓ Created menu item: ${item.name} (${item.itemCategory})`);
  }
  
  return menuItemIds;
}

/**
 * Create inventory collection with sample data
 */
async function setupInventory(menuItemIds) {
  console.log('\n📦 Setting up inventory collection...');
  
  // Only bar items need inventory tracking
  const inventoryData = [
    { menuItemId: menuItemIds[3], quantity: 100, autoOutOfStock: true } // Kingfisher Beer
  ];

  for (const inv of inventoryData) {
    await setDoc(doc(db, 'inventory', inv.menuItemId), {
      ...inv,
      updatedAt: serverTimestamp()
    });
    console.log(`  ✓ Created inventory for item: ${inv.menuItemId} (qty: ${inv.quantity})`);
  }
}

/**
 * Create customers collection with sample data
 */
async function setupCustomers() {
  console.log('\n📞 Setting up customers collection...');
  
  const customersData = [
    { phone: '9876543210', name: 'Rahul Verma' },
    { phone: '9123456789', name: 'Sneha Kapoor' }
  ];

  for (const customer of customersData) {
    const docRef = await addDoc(collection(db, 'customers'), {
      ...customer,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log(`  ✓ Created customer: ${customer.name} (${customer.phone})`);
  }
}

/**
 * Main setup function
 */
async function setupDatabase() {
  try {
    await setupManagers();
    await setupWaiters();
    const sectionIds = await setupSections();
    await setupTables(sectionIds);
    const categoryIds = await setupMenuCategories();
    const modifierIds = await setupModifiers();
    const menuItemIds = await setupMenuItems(categoryIds, modifierIds);
    await setupInventory(menuItemIds);
    await setupCustomers();
    
    console.log('\n✅ Database schema setup complete!');
    console.log('\n📊 Summary:');
    console.log('  - Managers: 2');
    console.log('  - Waiters: 4');
    console.log('  - Sections: 3');
    console.log('  - Tables: 7');
    console.log('  - Menu Categories: 5');
    console.log('  - Modifiers: 5');
    console.log('  - Menu Items: 6');
    console.log('  - Inventory Items: 1');
    console.log('  - Customers: 2');
    
    console.log('\n🔍 Next Steps:');
    console.log('  1. Check Firebase Console to verify collections');
    console.log('  2. Set up composite indexes (see FIREBASE_SETUP.md)');
    console.log('  3. Configure security rules');
    console.log('  4. Test with Firebase emulator');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error setting up database:', error);
    process.exit(1);
  }
}

// Run setup
setupDatabase();
