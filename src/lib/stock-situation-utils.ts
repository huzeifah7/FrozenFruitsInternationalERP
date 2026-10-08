import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  doc,
  getDoc
} from '@/firebase/firestore-override';
import { Firestore } from '@/firebase/firestore-override';

// Categorization functions
export const isCorner = (name: string): boolean => {
  const n = (name || '').toLowerCase();
  return n.includes('corner') || n.includes('corniere') || n.includes('cornière') || n.includes('angle') || n.includes('coin');
};

export const isChapeau = (name: string): boolean => {
  const n = (name || '').toLowerCase();
  return n.includes('chapeau') || n.includes('hat') || n.includes('cap');
};

export const isPallet = (name: string): boolean => {
  const n = (name || '').toLowerCase();
  return (n.includes('pallet') || n.includes('palette')) && !n.includes('chapeau');
};

export const isFeuillard = (name: string): boolean => {
  const n = (name || '').toLowerCase();
  return n.includes('feuillard') || n.includes('roll') || n.includes('strap') || n.includes('bande');
};

export const isChappes = (name: string): boolean => {
  const n = (name || '').toLowerCase();
  return n.includes('chappe') || n.includes('clip') || n.includes('chappes');
};

export const is4KG = (name: string, weightPerUnit?: number): boolean => {
  const n = (name || '').toLowerCase();
  return n.includes('4kg') || n.includes('4 kg') || weightPerUnit === 4;
};

// Calculate consumable stock per location and season
export async function calculateConsumableLocationStock(
  db: Firestore, 
  seasonId: string, 
  consumableId: string, 
  locationId: string
): Promise<void> {
  if (!db || !seasonId || !consumableId || !locationId) return;

  try {
    let locationName = 'Unknown Location';
    const linesSnap = await getDocs(collection(db, 'processing_lines'));
    const lineDoc = linesSnap.docs.find(d => d.id === locationId);
    if (lineDoc) {
      locationName = lineDoc.data().title || locationName;
    } else {
      const locsSnap = await getDocs(collection(db, 'locations'));
      const locDoc = locsSnap.docs.find(d => d.id === locationId);
      if (locDoc) {
        locationName = locDoc.data().name || locDoc.data().title || locationName;
      }
    }

    const consumableDoc = await getDoc(doc(db, 'consumables', consumableId));
    if (!consumableDoc.exists()) return;
    const cData = consumableDoc.data();
    const consumableName = cData.name || '';
    const isPkg = !!cData.is_packaging || !!cData.packaging;
    const weightPerUnit = Number(cData.weight_per_unit || cData.weightPerUnit || 0);

    // 1. Fetch manual IN/OUT
    let manualIn = 0;
    let manualOut = 0;

    const manualQuery = query(
      collection(db, 'stock_situations'),
      where('locationId', '==', locationId),
      where('seasonId', '==', seasonId)
    );
    const manualSnap = await getDocs(manualQuery);

    manualSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const items = data.items || [];
      items.forEach((item: any) => {
        const cId = item.consumableId || item.consomableId;
        if (cId === consumableId) {
          const qty = Number(item.quantity || 0);
          if (item.operation === 'IN') manualIn += qty;
          else if (item.operation === 'OUT') manualOut += qty;
        }
      });
    });

    // 2. Fetch manual adjustments from manual_stock_adjustments if any
    const manualAdjQuery = query(
      collection(db, 'manual_stock_adjustments'),
      where('locationId', '==', locationId),
      where('consumableId', '==', consumableId),
      where('seasonId', '==', seasonId)
    );
    const manualAdjSnap = await getDocs(manualAdjQuery);
    manualAdjSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const qty = Number(data.quantity || 0);
      if (data.operationType === 'IN') manualIn += qty;
      else if (data.operationType === 'OUT') manualOut += qty;
    });

    // 3. Fetch auto-consumption
    let autoOut = 0;
    let remainingBalance = 0;
    
    const outputsQuery = query(
      collection(db, 'production_output'),
      where('locationId', '==', locationId),
      where('palletisationType', 'in', ['Final product', 'Final Product', 'final product'])
    );
    const outputsSnap = await getDocs(outputsQuery);

    let cornersPallets = 0;
    let chapeauPallets = 0;
    let palletPallets = 0;
    let chappesConsumedUnits = 0;
    let cartonBoxes = 0;

    outputsSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (data.seasonId && data.seasonId !== seasonId) return; // filter by seasonId if it exists

      cornersPallets++;
      chapeauPallets++;
      palletPallets++;

      const pkgId = data.packagingTypeId;
      const pkgName = data.packagingTypeName || '';
      const isPkg4 = is4KG(pkgName, weightPerUnit);

      if (isPkg4) {
        chappesConsumedUnits += 9;
      } else {
        chappesConsumedUnits += 7;
      }

      if (pkgId === consumableId) {
        const itemsList = data.items || [];
        cartonBoxes += itemsList.reduce((sum: number, it: any) => sum + Number(it.numberOfBoxes || 0), 0);
      }
    });

    if (isCorner(consumableName)) {
      autoOut = cornersPallets * 4;
    } else if (isChapeau(consumableName)) {
      autoOut = chapeauPallets * 1;
    } else if (isPallet(consumableName)) {
      autoOut = palletPallets * 1;
    } else if (isFeuillard(consumableName)) {
      // FEUILLARD is now handled via explicit OUT transactions during production output
      autoOut = 0;
      remainingBalance = 0;
    } else if (isChappes(consumableName)) {
      autoOut = Math.floor(chappesConsumedUnits / 2000) * 2000;
      remainingBalance = chappesConsumedUnits % 2000;
    } else if (cartonBoxes > 0) {
      autoOut = cartonBoxes;
    }

    const available = manualIn - manualOut - autoOut;

    const counterRef = doc(db, 'stock_situation_counters', `${seasonId}_${locationId}_${consumableId}`);
    const batch = writeBatch(db);
    batch.set(counterRef, {
      seasonId,
      locationId,
      locationName,
      consumableId,
      consumableName,
      manualIn,
      manualOut,
      autoOut,
      available,
      remainingBalance,
      updatedAt: new Date(),
    });
    await batch.commit();

  } catch (error) {
    console.error('Error in calculateConsumableLocationStock:', error);
  }
}

// Calculate supplier stock per location and season
export async function calculateSupplierLocationStock(
  db: Firestore, 
  seasonId: string, 
  supplierId: string, 
  locationId: string
): Promise<void> {
  if (!db || !seasonId || !supplierId || !locationId) return;

  try {
    let locationName = 'Unknown Location';
    const linesSnap = await getDocs(collection(db, 'processing_lines'));
    const lineDoc = linesSnap.docs.find(d => d.id === locationId);
    if (lineDoc) {
      locationName = lineDoc.data().title || locationName;
    } else {
      const locsSnap = await getDocs(collection(db, 'locations'));
      const locDoc = locsSnap.docs.find(d => d.id === locationId);
      if (locDoc) {
        locationName = locDoc.data().name || locDoc.data().title || locationName;
      }
    }

    let supplierName = 'Unknown Supplier';
    let supSnap = await getDoc(doc(db, 'suppliers', supplierId));
    if (supSnap.exists()) {
      const data = supSnap.data();
      supplierName = data.name || data.supplierName || data.title || data.companyName || supplierName;
    } else {
      const procSupSnap = await getDoc(doc(db, 'procurement_suppliers', supplierId));
      if (procSupSnap.exists()) {
        const data = procSupSnap.data();
        supplierName = data.name || data.supplierName || data.title || data.companyName || supplierName;
      }
    }

    let totalIn = 0;
    let totalOut = 0;

    const manualQuery = query(
      collection(db, 'stock_situations'),
      where('locationId', '==', locationId),
      where('seasonId', '==', seasonId)
    );
    const manualSnap = await getDocs(manualQuery);

    manualSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const items = data.items || [];
      items.forEach((item: any) => {
        if (item.supplierId === supplierId) {
          const qty = Number(item.quantity || 0);
          const isChappe = isChappes(item.consumableName || item.consomableName || '');
          const effectiveQty = isChappe ? qty / 2000 : qty;
          
          if (item.operation === 'IN') totalIn += effectiveQty;
          else if (item.operation === 'OUT') totalOut += effectiveQty;
        }
      });
    });

    const available = totalIn - totalOut;

    const counterRef = doc(db, 'stock_supplier_counters', `${seasonId}_${locationId}_${supplierId}`);
    const batch = writeBatch(db);
    batch.set(counterRef, {
      seasonId,
      locationId,
      locationName,
      supplierId,
      supplierName,
      totalIn,
      totalOut,
      available,
      updatedAt: new Date(),
    });
    await batch.commit();

  } catch (error) {
    console.error('Error in calculateSupplierLocationStock:', error);
  }
}

// Recalculate affected stock groups
export async function recalculateAffectedStockGroups(
  db: Firestore, 
  seasonId: string, 
  affectedConsumableLocationPairs: string[], 
  affectedSupplierLocationPairs: string[]
): Promise<void> {
  const uniqueConsumables = Array.from(new Set(affectedConsumableLocationPairs));
  const uniqueSuppliers = Array.from(new Set(affectedSupplierLocationPairs));

  const promises = [];

  for (const pair of uniqueConsumables) {
    const [cId, lId] = pair.split('_');
    if (cId && lId) {
      promises.push(calculateConsumableLocationStock(db, seasonId, cId, lId));
    }
  }

  for (const pair of uniqueSuppliers) {
    const [sId, lId] = pair.split('_');
    if (sId && lId && sId !== 'none' && sId !== 'undefined') {
      promises.push(calculateSupplierLocationStock(db, seasonId, sId, lId));
    }
  }

  await Promise.all(promises);
}

// Keep the old one for backwards compatibility but make it invoke the new logic if seasonId is available
export async function recalculateStockCounters(db: Firestore, locationId: string): Promise<void> {
  // Try to grab season_id from localStorage if we are in browser
  let seasonId = '';
  if (typeof window !== 'undefined') {
    seasonId = localStorage.getItem('season_id') || '';
  }
  if (!seasonId) return; // Cannot recalculate entire location without season context in new system

  try {
    const consumablesSnap = await getDocs(collection(db, 'consumables'));
    const affectedConsumables = consumablesSnap.docs.map(d => `${d.id}_${locationId}`);
    
    // Also get affected suppliers for this location
    const manualQuery = query(
      collection(db, 'stock_situations'),
      where('locationId', '==', locationId),
      where('seasonId', '==', seasonId)
    );
    const manualSnap = await getDocs(manualQuery);
    const supplierPairs = new Set<string>();
    manualSnap.docs.forEach(docSnap => {
      const items = docSnap.data().items || [];
      items.forEach((item: any) => {
        if (item.supplierId) {
          supplierPairs.add(`${item.supplierId}_${locationId}`);
        }
      });
    });

    await recalculateAffectedStockGroups(db, seasonId, affectedConsumables, Array.from(supplierPairs));
  } catch (error) {
    console.error('Error in backward compatible recalculateStockCounters:', error);
  }
}
