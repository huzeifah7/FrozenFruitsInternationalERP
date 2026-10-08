import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  "projectId": "studio-8693314642-3af5a",
  "appId": "1:443348282907:web:9f1fe95b88535014d312be",
  "apiKey": "AIzaSyDHAvTduWYIAItfPQElpYnzABb1Pg1MQYU",
  "authDomain": "studio-8693314642-3af5a.firebaseapp.com",
  "storageBucket": "studio-8693314642-3af5a.firebasestorage.app",
  "measurementId": "",
  "messagingSenderId": "443348282907"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const rmSnap = await getDocs(collection(db, 'raw_materials'));
  console.log(`Total raw materials in DB: ${rmSnap.size}`);
  rmSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`RM ID: ${doc.id}, Lot: ${data.lotNumber}, LocationId: ${data.locationId}`);
  });

  const pSnap = await getDocs(collection(db, 'palletizations'));
  console.log(`\nTotal palletizations in DB: ${pSnap.size}`);
  pSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`Pallet ID: ${doc.id}, Barcode: ${data.barcode}, Type: ${data.type}, RawMaterialId: ${data.rawMaterialId}, Lot: ${data.lotNumber}`);
  });
}

main().catch(err => {
  console.error("Error running script:", err);
});
