'use client';

import React, { useMemo, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

// Intercept console.error and window unhandled exceptions immediately at module level
if (typeof window !== 'undefined') {
  const isFirestoreAssertion = (s: any) => {
    if (!s) return false;
    try {
      const str = typeof s === 'string' ? s : (s.stack || s.message || JSON.stringify(s) || '');
      return (
        str.includes('INTERNAL ASSERTION FAILED') ||
        str.includes('ID: ca9') ||
        str.includes('ID: b815') ||
        str.includes('"ve":-1') ||
        str.includes('ve: -1') ||
        (str.includes('Unexpected state') && (str.includes('ca9') || str.includes('b815')))
      );
    } catch {
      return false;
    }
  };

  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const shouldSuppress = args.some(arg => isFirestoreAssertion(arg));
    if (shouldSuppress) {
      console.warn('[Firebase] Suppressed internal SDK assertion error from dev overlay');
      return;
    }
    originalConsoleError.apply(console, args);
  };

  window.addEventListener(
    'unhandledrejection',
    (event: PromiseRejectionEvent) => {
      if (isFirestoreAssertion(event.reason)) {
        console.warn('[Firebase] Handled internal assertion failure:', event.reason);
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    },
    { capture: true }
  );

  window.addEventListener(
    'error',
    (event: ErrorEvent) => {
      if (isFirestoreAssertion(event.error) || isFirestoreAssertion(event.message)) {
        console.warn('[Firebase] Handled internal error:', event.message || event.error);
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    },
    { capture: true }
  );
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    // Initialize Firebase on the client side, once per component mount.
    return initializeFirebase();
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      storage={firebaseServices.storage}
    >
      {children}
    </FirebaseProvider>
  );
}
