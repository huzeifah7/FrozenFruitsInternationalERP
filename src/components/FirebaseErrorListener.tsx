'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useUser } from '@/firebase';
import { getAuth } from 'firebase/auth';

export function FirebaseErrorListener() {
  const router = useRouter();
  const { isUserLoading } = useUser();

  // ✅ Ref so the handler always reads the latest value without stale closure
  const isUserLoadingRef = useRef(isUserLoading);
  useEffect(() => {
    isUserLoadingRef.current = isUserLoading;
  }, [isUserLoading]);

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      if (isUserLoadingRef.current) {
        console.warn('[FirebaseErrorListener] Skipping error during auth init');
        return;
      }
      console.warn('[FirebaseErrorListener] Firestore permission error on path:', error.request?.path);
      
      // If user is currently signed in, do not kick them to /login
      const auth = getAuth();
      if (!auth.currentUser) {
        router.push('/login');
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [router]);

  return null;
}