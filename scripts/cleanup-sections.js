/**
 * One-time script to remove duplicate sections from Firestore
 * Run with: node scripts/cleanup-sections.js
 */

require('dotenv').config();
const { initializeAdminSDK, getAdminFirestore } = require('../src/firebase/init');

async function cleanupSections() {
  await initializeAdminSDK();
  const firestore = getAdminFirestore();

  const snapshot = await firestore.collection('sections').get();
  const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`Found ${docs.length} sections:`);
  docs.forEach(d => console.log(`  ${d.id}: ${d.name}`));

  // Group by name, keep the first one, delete the rest
  const seen = new Map();
  const toDelete = [];

  for (const doc of docs) {
    const name = (doc.name || '').trim().toLowerCase();
    if (seen.has(name)) {
      toDelete.push(doc.id);
    } else {
      seen.set(name, doc.id);
    }
  }

  if (toDelete.length === 0) {
    console.log('\nNo duplicates found.');
    return;
  }

  console.log(`\nDeleting ${toDelete.length} duplicates: ${toDelete.join(', ')}`);
  for (const id of toDelete) {
    await firestore.collection('sections').doc(id).delete();
    console.log(`  Deleted: ${id}`);
  }

  console.log('\nDone. Remaining sections:');
  const remaining = await firestore.collection('sections').get();
  remaining.docs.forEach(d => console.log(`  ${d.id}: ${d.data().name}`));
}

cleanupSections().catch(console.error).finally(() => process.exit(0));
