'use client';

import React, { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';

const userCache: Record<string, UserData> = {};
const emailCache: Record<string, UserData> = {};

interface UserDisplayNameProps {
  uid: string;
  fallbackName?: string;
}

interface UserData {
  firstName?: string;
  lastName?: string;
  displayName?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _debounceTimers: Record<string, NodeJS.Timeout> = {};

export function UserDisplayName({ uid, fallbackName }: UserDisplayNameProps) {
  const [displayName, setDisplayName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const db = useFirestore();

  useEffect(() => {
    const getName = async () => {
      // If uid is not valid, use fallbackName or Unknown
      if (!uid || uid === 'N/A' || uid === '-' || uid === '') {
        const name = (fallbackName || 'Unknown').split('@')[0];
        setDisplayName(name);
        setLoading(false);
        return;
      }

      // Check if uid is an email - look up by email first
      const isEmail = uid.includes('@');
      
      // Check cache by uid or email
      if (userCache[uid]) {
        const cached = userCache[uid];
        const firstName = cached.firstName || '';
        const lastName = cached.lastName || '';
        const fullName = firstName && lastName 
          ? `${firstName} ${lastName}` 
          : firstName || lastName || fallbackName || uid;
        setDisplayName(fullName);
        setLoading(false);
        return;
      }
      
      if (isEmail && emailCache[uid]) {
        const cached = emailCache[uid];
        const firstName = cached.firstName || '';
        const lastName = cached.lastName || '';
        const fullName = firstName && lastName 
          ? `${firstName} ${lastName}` 
          : firstName || lastName || fallbackName || uid;
        setDisplayName(fullName);
        setLoading(false);
        return;
      }

      if (!db) {
        const name = (fallbackName || uid).split('@')[0];
        setDisplayName(name);
        setLoading(false);
        return;
      }

      try {
        // Try to find user - first query by email field since orders store email
        const emailQuery = collection(db, 'appUsers');
        const q = query(emailQuery, where('email', '==', uid));
        const emailSnap = await getDocs(q);
        
        if (!emailSnap.empty) {
          const data = emailSnap.docs[0].data() as UserData;
          userCache[uid] = data;
          emailCache[uid] = data;
          const firstName = data.firstName || '';
          const lastName = data.lastName || '';
          const displayName = data.displayName || '';
          const fullName = firstName && lastName 
            ? `${firstName} ${lastName}` 
            : displayName || firstName || lastName || (fallbackName || uid).split('@')[0];
          setDisplayName(fullName);
        } else {
          // Try as UID - for other docs that store uid instead of email
          const userRef = doc(db, 'appUsers', uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const data = userSnap.data() as UserData;
            userCache[uid] = data;
            const firstName = data.firstName || '';
            const lastName = data.lastName || '';
            const displayName = data.displayName || '';
            const fullName = firstName && lastName 
              ? `${firstName} ${lastName}` 
              : displayName || firstName || lastName || (fallbackName || uid).split('@')[0];
            setDisplayName(fullName);
          } else {
            // User not found - use fallback
            const name = (fallbackName || uid).split('@')[0];
            setDisplayName(name);
          }
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        const name = (fallbackName || uid).split('@')[0];
        setDisplayName(name);
      } finally {
        setLoading(false);
      }
    };

    getName();
  }, [db, uid, fallbackName]);

  if (loading) {
    return <span className="font-bold text-primary/60 text-xs animate-pulse">...</span>;
  }

  return <span className="font-bold text-primary/80 text-xs">{displayName}</span>;
}