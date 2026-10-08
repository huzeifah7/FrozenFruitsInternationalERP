'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, getDocs, query } from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';

interface MasterDataContextType {
  farms: any[];
  smallFarms: any[];
  suppliers: any[];
  procurementSuppliers: any[];
  products: any[];
  processingLines: any[];
  locations: any[];
  appUsers: any[];
  consumables: any[];
  isLoading: boolean;
}

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);
const masterDataCache: Record<string, any[]> = {};

export function MasterDataProvider({ children }: { children: React.ReactNode }) {
  const db = useFirestore();
  const [farms, setFarms] = useState<any[]>(masterDataCache.main_farms || []);
  const [smallFarms, setSmallFarms] = useState<any[]>(masterDataCache.small_farms || []);
  const [suppliers, setSuppliers] = useState<any[]>(masterDataCache.suppliers || []);
  const [procurementSuppliers, setProcurementSuppliers] = useState<any[]>(masterDataCache.procurement_suppliers || []);
  const [products, setProducts] = useState<any[]>(masterDataCache.products || []);
  const [processingLines, setProcessingLines] = useState<any[]>(masterDataCache.processing_lines || []);
  const [locations, setLocations] = useState<any[]>(masterDataCache.locations || []);
  const [appUsers, setAppUsers] = useState<any[]>(masterDataCache.appUsers || []);
  const [consumables, setConsumables] = useState<any[]>(masterDataCache.consumables || []);

  const [loadingStates, setLoadingStates] = useState({
    farms: !masterDataCache.main_farms,
    smallFarms: !masterDataCache.small_farms,
    suppliers: !masterDataCache.suppliers,
    procurementSuppliers: !masterDataCache.procurement_suppliers,
    products: !masterDataCache.products,
    processingLines: !masterDataCache.processing_lines,
    locations: !masterDataCache.locations,
    appUsers: !masterDataCache.appUsers,
    consumables: !masterDataCache.consumables,
  });

  useEffect(() => {
    if (!db) return;

    let isMounted = true;

    const fetchData = async (colName: string, setter: (val: any[]) => void, loadingKey: keyof typeof loadingStates) => {
      if (masterDataCache[colName]) {
        if (isMounted) {
          setter(masterDataCache[colName]);
          setLoadingStates((prev) => ({ ...prev, [loadingKey]: false }));
        }
        return;
      }
      try {
        const q = query(collection(db, colName));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        masterDataCache[colName] = list;
        if (isMounted) {
          setter(list);
          setLoadingStates((prev) => ({ ...prev, [loadingKey]: false }));
        }
      } catch (error) {
        console.error(`Error loading master data: ${colName}`, error);
        if (isMounted) {
          setLoadingStates((prev) => ({ ...prev, [loadingKey]: false }));
        }
      }
    };

    fetchData('main_farms', setFarms, 'farms');
    fetchData('small_farms', setSmallFarms, 'smallFarms');
    fetchData('suppliers', setSuppliers, 'suppliers');
    fetchData('procurement_suppliers', setProcurementSuppliers, 'procurementSuppliers');
    fetchData('products', setProducts, 'products');
    fetchData('processing_lines', setProcessingLines, 'processingLines');
    fetchData('locations', setLocations, 'locations');
    fetchData('appUsers', setAppUsers, 'appUsers');
    fetchData('consumables', setConsumables, 'consumables');

    return () => {
      isMounted = false;
    };
  }, [db]);

  const isLoading = Object.values(loadingStates).some(Boolean);

  return (
    <MasterDataContext.Provider
      value={{
        farms,
        smallFarms,
        suppliers,
        procurementSuppliers,
        products,
        processingLines,
        locations,
        appUsers,
        consumables,
        isLoading,
      }}
    >
      {children}
    </MasterDataContext.Provider>
  );
}

export function useMasterData() {
  const context = useContext(MasterDataContext);
  if (context === undefined) {
    throw new Error('useMasterData must be used within a MasterDataProvider');
  }
  return context;
}
