/**
 * Clean up duplicate tables in Firestore and re-sync from SQLite
 * Run with: node scripts/fix-firestore-tables.js
 */

require('dotenv').config();
const path = require('path');
const os = require('os');
const sqlite3 = require('sqlite3').verbose();
const { initializeAdminSDK, getAdminFirestore } = require('../src/firebase/init');

// Section ID mapping from SQLite integer IDs to Firestore string IDs
// These come from the Firestore sections collection
const SECTION_ID_MAP = {
  6: 'Y26NFdjzJvvFFH2ATmm3',  // AC
  5: 'HFmKgb4DnTmMVeRvfs7b',  // Cabin
  7: '07tIhbl7ZYc3vrw1PHH3',  // Garden
  11: '8m0uQSFJhw3s8Kww9eFi', // Rooftop
};

function getSQLiteTables() {
  return new Promise((resolve, reject) => {
    const dbPath = path.join(os.homedir(), 'Library/Application Support/counterflow-pos/inventory.db');
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
    });
    db.all(
      `SELECT t.id, t.name, t.section_id, s.name as section_name 
       FROM tables t LEFT JOIN sections s ON t.section_id = s.id 
       ORDER BY s.name, t.name`,
      (err, rows) => {
        db.close();
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

async function fixTables() {
  await initializeAdminSDK();
  const firestore = getAdminFirestore();

  // 1. Delete all existing tables in Firestore
  console.log('Deleting all existing Firestore tables...');
  const existing = await firestore.collection('tables').get();
  const batch = firestore.batch();
  existing.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`  Deleted ${existing.size} tables`);

  // 2. Load tables from SQLite
  console.log('\nLoading tables from SQLite...');
  const sqliteTables = await getSQLiteTables();
  console.log(`  Found ${sqliteTables.length} tables`);

  // 3. Insert clean tables into Firestore
  console.log('\nInserting tables into Firestore...');
  const insertBatch = firestore.batch();
  for (const table of sqliteTables) {
    const firestoreSectionId = SECTION_ID_MAP[table.section_id] || null;
    const docRef = firestore.collection('tables').doc(`table_${table.id}`);
    insertBatch.set(docRef, {
      name: table.name,
      section_id: firestoreSectionId,
      status: 'available',
      currentOrderId: null,
      current_order_id: null,
      currentBillAmount: 0,
      current_bill_amount: 0,
      occupiedSince: null,
      occupied_since: null,
      updatedAt: new Date(),
    });
    console.log(`  ${table.name} -> section: ${table.section_name} (${firestoreSectionId})`);
  }
  await insertBatch.commit();

  console.log('\nDone! Firestore tables are now clean and synced.');
}

fixTables().catch(console.error).finally(() => process.exit(0));
