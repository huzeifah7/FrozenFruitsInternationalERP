// This file is deprecated in favor of src/firebase/index.ts
// Redirecting to use standardized initialization
import { initializeFirebase } from '@/firebase';

const { auth, firestore: db } = initializeFirebase();

export { auth, db };
