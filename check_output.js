import { initializeApp } from 'firebase/admin/app';
import { getFirestore } from 'firebase/admin/firestore';
import * as admin from 'firebase-admin';

// Initialize firebase admin
const serviceAccount = require('./serviceAccountKey.json'); // assuming it exists, or use default

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore();

async function checkOutputs() {
  const q = await db.collection('production_output').limit(5).get();
  q.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}
checkOutputs();
