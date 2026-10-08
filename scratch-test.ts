import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, addDoc } from "firebase/firestore";

const app = initializeApp({ projectId: 'test' });
const db = getFirestore(app);

const col = collection(db, 'invoices');
console.log('Collection:');
console.log('type:', (col as any).type);
console.log('path:', (col as any).path);

const q = query(col, where('status', '==', 'Paid'));
console.log('\nQuery:');
console.log('type:', (q as any).type);
console.log('path from _query?:', (q as any)._query?.path?.canonicalString());
console.log('path direct?:', (q as any).path);
