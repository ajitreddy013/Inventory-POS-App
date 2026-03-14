/**
 * Sync Firestore sections to match SQLite (4 sections: AC, Cabin, Garden, Rooftop)
 * Run with: node scripts/fix-firestore-sections.js
 */

require('dotenv').config();
const { initializeAdminSDK, getAdminFirestore } = require('../src/firebase/init');

const KEEP_SECTIONS = ['ac', 'cabin', 'garden', 'rooftop'];

async function fixSections() {
  await initializeAdminSDK();
  const firestore = getAdminFirestore();

  const snapshot = await firestore.collection('sections').get();
  const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log('Current Firestore sections:');
  docs.forEach(d => console.log(`  ${d.id}: "${d.name}"`));

  const toDelete = docs.filter(d => !KEEP_SECTIONS.includes((d.name || '').trim().toLowerCase()));

  if (toDelete.length === 0) {
    console.log('\nNo extra sections to delete.');
  } else {
    console.log(`\nDeleting ${toDelete.length} extra section(s):`);
    for (const doc of toDelete) {
      await firestore.collection('sections').doc(doc.id).delete();
      console.log(`  Deleted: "${doc.name}" (${doc.id})`);
    }
  }

  console.log('\nRemaining sections:');
  const remaining = await firestore.collection('sections').get();
  remaining.docs.forEach(d => console.log(`  ${d.id}: "${d.data().name}"`));
}

fixSections().catch(console.error).finally(() => process.exit(0));
