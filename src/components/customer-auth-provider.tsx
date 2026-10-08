'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc 
} from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';

interface CustomerPortalUser {
  id: string;
  customer_id: string;
  first_name: string;
  last_name: string;
  email: string;
  function: string;
  user_type: string;
  active: boolean;
}

interface CustomerAuthContextType {
  user: CustomerPortalUser | null;
  customer: any | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export async function hashPasswordSHA256(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CustomerPortalUser | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const db = useFirestore();
  const router = useRouter();

  const fetchCustomerData = async (customerId: string): Promise<any> => {
    if (!db) return null;
    try {
      const d = await getDoc(doc(db, 'customers', customerId));
      if (d.exists()) {
        return { id: d.id, ...d.data() };
      }
    } catch (e) {
      console.error('Failed to fetch customer:', e);
    }
    return null;
  };

  useEffect(() => {
    const checkSession = async () => {
      if (!db) return;

      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const asCustomerParam = urlParams?.get('asCustomer');

      if (asCustomerParam) {
        const cust = await fetchCustomerData(asCustomerParam);
        if (cust) {
          const syntheticUser: CustomerPortalUser = {
            id: `admin_view_${cust.id}`,
            customer_id: cust.id,
            first_name: cust.companyName || 'Customer',
            last_name: 'View',
            email: cust.email || 'portal@customer.com',
            function: 'Customer',
            user_type: 'Customer',
            active: true
          };
          setUser(syntheticUser);
          setCustomer(cust);
          localStorage.setItem('customer_portal_user', JSON.stringify(syntheticUser));
          setLoading(false);
          return;
        }
      }

      const stored = localStorage.getItem('customer_portal_user');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.id?.startsWith('admin_view_')) {
            const cust = await fetchCustomerData(parsed.customer_id);
            if (cust) {
              setUser(parsed);
              setCustomer(cust);
            } else {
              localStorage.removeItem('customer_portal_user');
            }
          } else {
            const uDoc = await getDoc(doc(db, 'customer_portal_users', parsed.id));
            if (uDoc.exists() && uDoc.data().active !== false) {
              const userData = { id: uDoc.id, ...uDoc.data() } as any;
              setUser(userData);
              const cust = await fetchCustomerData(userData.customer_id);
              setCustomer(cust);
            } else {
              localStorage.removeItem('customer_portal_user');
            }
          }
        } catch (e) {
          localStorage.removeItem('customer_portal_user');
        }
      }
      setLoading(false);
    };
    checkSession();
  }, [db]);

  const login = async (email: string, pass: string): Promise<boolean> => {
    if (!db) return false;
    try {
      const q = query(
        collection(db, 'customer_portal_users'), 
        where('email', '==', email.toLowerCase().trim())
      );
      const snap = await getDocs(q);
      if (snap.empty) return false;

      const uDoc = snap.docs[0];
      const uData = uDoc.data();
      
      if (uData.active === false) return false;

      const hashed = await hashPasswordSHA256(pass);
      if (uData.password === hashed) {
        const userData = { id: uDoc.id, ...uData } as any;
        setUser(userData);
        const cust = await fetchCustomerData(userData.customer_id);
        setCustomer(cust);
        localStorage.setItem('customer_portal_user', JSON.stringify(userData));
        return true;
      }
    } catch (err) {
      console.error('Login error:', err);
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setCustomer(null);
    localStorage.removeItem('customer_portal_user');
    router.replace('/customer-portal/login');
  };

  const refreshUser = async () => {
    if (!db || !user) return;
    try {
      const uDoc = await getDoc(doc(db, 'customer_portal_users', user.id));
      if (uDoc.exists()) {
        const userData = { id: uDoc.id, ...uDoc.data() } as any;
        setUser(userData);
        const cust = await fetchCustomerData(userData.customer_id);
        setCustomer(cust);
        localStorage.setItem('customer_portal_user', JSON.stringify(userData));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <CustomerAuthContext.Provider value={{ user, customer, loading, login, logout, refreshUser }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return ctx;
}
