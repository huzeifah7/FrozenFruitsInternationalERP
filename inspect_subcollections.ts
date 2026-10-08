import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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
  
  for (const rmDoc of rmSnap.docs) {
    const rmData = rmDoc.data();
    const subSnap = await getDocs(collection(db, `raw_materials/${rmDoc.id}/palletizations`));
    console.log(`RM ID: ${rmDoc.id}, Lot: ${rmData.lotNumber} -> Subcollection has ${subSnap.size} palletizations`);
    subSnap.docs.forEach(pDoc => {
      console.log(`  Sub Pallet ID: ${pDoc.id}, data:`, JSON.stringify(pDoc.data()));
    });
  }
}

main().catch(err => {
  console.error("Error running script:", err);
});
