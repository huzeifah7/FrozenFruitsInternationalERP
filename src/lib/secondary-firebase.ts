import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';

// Initialize a secondary app instance
// This is used specifically to create user accounts without signing out the current admin session.
let secondaryApp;

if (!getApps().some(app => app.name === 'secondaryAuthApp')) {
  secondaryApp = initializeApp(firebaseConfig, 'secondaryAuthApp');
} else {
  secondaryApp = getApp('secondaryAuthApp');
}

export const secondaryAuth = getAuth(secondaryApp);

export async function createAuthUserWithoutLoggingOutAdmin(email: string, password: string) {
  // Uses the secondary auth app so the primary app's current user remains logged in
  const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  // Immediately sign out from the secondary auth to prevent any session conflicts
  await signOut(secondaryAuth);
  return userCredential.user;
}
