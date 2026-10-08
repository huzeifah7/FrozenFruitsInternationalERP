const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
// You need to place your firebase service account json in the root directory named 'service-account.json'
// and install firebase-admin via: npm install firebase-admin

// Replace this path with the actual path to your service account key
let serviceAccount;
try {
  serviceAccount = require('../service-account.json');
} catch (e) {
  console.error("Please place your Firebase Admin service-account.json in the root directory.");
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// List of all business collections that need the season_id
const SEASONAL_COLLECTIONS = [
  'invoices',
  'payments',
  'credit_notes',
  'orders',
  'production_output',
  'production_feeds',
  'daily_production_reports',
  'packingLists',
  'supply_chain_loadings',
  'supply_chain_stock',
  'stock_situations',
  'raw_materials',
  'production_inventories',
  'work_time_tracking',
  'expenses',
  'cheque_follow_ups',
  'bank_account_transactions',
  'returns',
  'decays',
  'cabranes_situation'
];

async function migrate() {
  console.log('Starting backward compatibility migration...');
  
  // 1. Get the default season
  const seasonsSnap = await db.collection('seasons').where('isDefault', '==', true).get();
  if (seasonsSnap.empty) {
    console.error('No default season found! Please mark a season as default first.');
    process.exit(1);
  }
  
  const defaultSeasonId = seasonsSnap.docs[0].id;
  console.log(`Using default season ID: ${defaultSeasonId}`);

  let totalUpdated = 0;

  for (const collectionName of SEASONAL_COLLECTIONS) {
    console.log(`Migrating collection: ${collectionName}...`);
    try {
      const snapshot = await db.collection(collectionName).get();
      let batch = db.batch();
      let batchCount = 0;
      let collectionUpdated = 0;
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (!data.season_id) {
          batch.update(doc.ref, { season_id: defaultSeasonId });
          batchCount++;
          collectionUpdated++;
          totalUpdated++;
          
          if (batchCount === 450) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
          }
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
      console.log(`  -> Updated ${collectionUpdated} documents in ${collectionName}.`);
    } catch (e) {
      console.error(`  -> Failed to migrate ${collectionName}:`, e.message);
    }
  }
  
  console.log(`Migration complete! Total documents updated: ${totalUpdated}`);
}

migrate().catch(console.error);
