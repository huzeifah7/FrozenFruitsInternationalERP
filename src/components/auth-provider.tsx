'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from '@/firebase/firestore-override';
import { useAuth, useFirestore } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  role: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  role: null, 
  loading: true 
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const auth = useAuth();
  const db = useFirestore();

  const pathnameRef = React.useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Auth listener: subscribe once on auth instance
  useEffect(() => {
    if (!auth) return;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      const currentPath = (pathnameRef.current || '').replace(/\/$/, '');
      const isAuthPage = currentPath === '/login' || currentPath.startsWith('/customer-portal');

      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
        if (!isAuthPage) {
          router.replace('/login');
        }
      } else if (currentPath === '/login') {
        router.replace('/overview');
      }
    });

    return () => unsubscribeAuth();
  }, [auth, router]);

  // Sync profile data and auto-provision if missing
  useEffect(() => {
    if (!user || !db) {
      if (!user) setLoading(false);
      return;
    }

    setLoading(true);
    let resolved = false;

    // Safety timeout: if profile loading takes > 3 seconds, unblock UI with fallback profile
    const timer = setTimeout(() => {
      if (!resolved) {
        console.warn('Profile fetch timed out, applying default user profile');
        setProfile((prev: any) => prev || {
          id: user.uid,
          email: user.email,
          firstName: user.displayName?.split(' ')[0] || 'User',
          lastName: user.displayName?.split(' ')[1] || '',
          role: 'User',
        });
        setLoading(false);
      }
    }, 3000);

    const userDocRef = doc(db, 'appUsers', user.uid);
    
    const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
      resolved = true;
      clearTimeout(timer);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(data);
        setLoading(false);
      } else {
        const names = user.displayName?.split(' ') || [];
        const newProfile = {
          id: user.uid,
          email: user.email,
          firstName: names[0] || 'User',
          lastName: names[1] || 'New',
          role: 'User',
          isActive: true,
          lastLoginDate: new Date().toISOString()
        };
        
        setProfile(newProfile);
        setLoading(false);

        setDoc(userDocRef, newProfile).catch(e => {
          console.error("Provisioning failed:", e);
        });
      }
    }, (error) => {
      resolved = true;
      clearTimeout(timer);
      console.warn("Profile sync warning (falling back to local profile):", error?.message || error);
      // Fallback profile on Firestore error so UI never hangs
      setProfile({
        id: user.uid,
        email: user.email,
        firstName: user.displayName?.split(' ')[0] || 'User',
        lastName: user.displayName?.split(' ')[1] || '',
        role: 'User',
      });
      setLoading(false);
    });

    return () => {
      clearTimeout(timer);
      unsubscribeProfile();
    };
  }, [user, db]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-[#193A7B]" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading session...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      role: profile?.role || null, 
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);