import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseConfig } from './config';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkOrders() {
  const snap = await getDocs(collection(db, 'orders'));
  console.log('Total Orders:', snap.size);
  if (snap.size > 0) {
    const data = snap.docs[0].data();
    console.log('Sample Order:', {
      poNumber: data.poNumber,
      customerId: data.customerId,
      customer_id: data.customer_id,
      seasonId: data.seasonId,
      season_id: data.season_id,
      customerName: data.customerName,
      status: data.status
    });
  }
}

checkOrders().catch(console.error);
