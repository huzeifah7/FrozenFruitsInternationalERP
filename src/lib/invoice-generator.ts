import { Firestore, doc, runTransaction, getDocs, collection, query, writeBatch } from '@/firebase/firestore-override';

export type InvoiceNamespace = 'main' | 'credit_note' | 'proforma';

export async function generateNextInvoiceNumber(
  db: Firestore,
  params: {
    invoiceType?: string;
    source: 'sales_invoice' | 'supply_chain_loading';
    year: number;
  }
): Promise<string> {
  const { invoiceType, source, year } = params;
  const yy = String(year).slice(-2);
  
  let namespace: InvoiceNamespace = 'main';
  let prefix = yy;

  const normalizedType = (invoiceType || '').toLowerCase();

  if (normalizedType.includes('credit') || normalizedType === 'credit_note') {
    namespace = 'credit_note';
    prefix = `CN${yy}`;
  } else if (normalizedType.includes('proforma')) {
    namespace = 'proforma';
    prefix = `PF${yy}`;
  }

  const counterId = `${namespace}_${year}`;
  const counterRef = doc(db, 'invoiceCounters', counterId);
  const oldCounterRef = doc(db, 'counters', `invoice_${yy}`);

  const newNumber = await runTransaction(db, async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let lastNumber = 0;
    
    if (counterDoc.exists()) {
      lastNumber = counterDoc.data().lastNumber || 0;
    }

    if (namespace === 'main') {
      const oldCounterDoc = await transaction.get(oldCounterRef);
      if (oldCounterDoc.exists()) {
        const oldSeq = oldCounterDoc.data().lastSequence || 0;
        if (oldSeq > lastNumber) {
          lastNumber = oldSeq;
        }
      }
    }

    const nextNumber = lastNumber + 1;
    const formattedSequence = String(nextNumber).padStart(3, '0');
    const invoiceNumber = `${prefix}${formattedSequence}`;

    transaction.set(counterRef, {
      year,
      namespace,
      lastNumber: nextNumber,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    if (namespace === 'main') {
      transaction.set(oldCounterRef, {
        lastSequence: nextNumber,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    return invoiceNumber;
  });

  return newNumber;
}

// Backfill function to initialize counters and fix broken loading invoices
export async function runInvoiceBackfill(db: Firestore, year: number) {
  const yy = String(year).slice(-2);
  
  // 1. Initialize Counters
  const mainPrefix = yy;
  const cnPrefix = `CN${yy}`;
  const pfPrefix = `PF${yy}`;
  
  let maxMain = 0;
  let maxCN = 0;
  let maxPF = 0;

  // Read all invoices
  const invoicesSnap = await getDocs(collection(db, 'invoices'));
  invoicesSnap.forEach(docSnap => {
    const data = docSnap.data();
    const invNum = data.invoice_number;
    if (!invNum || typeof invNum !== 'string') return;
    
    if (invNum.startsWith(cnPrefix)) {
      const seq = parseInt(invNum.replace(cnPrefix, ''), 10);
      if (!isNaN(seq) && seq > maxCN) maxCN = seq;
    } else if (invNum.startsWith(pfPrefix)) {
      const seq = parseInt(invNum.replace(pfPrefix, ''), 10);
      if (!isNaN(seq) && seq > maxPF) maxPF = seq;
    } else if (invNum.startsWith(mainPrefix) && !invNum.startsWith('CN') && !invNum.startsWith('PF')) {
      const seq = parseInt(invNum.replace(mainPrefix, ''), 10);
      if (!isNaN(seq) && seq > maxMain) maxMain = seq;
    }
  });

  // Read all loadings (they share the MAIN namespace)
  const loadingsSnap = await getDocs(collection(db, 'supply_chain_loadings'));
  const loadingsToFix: { id: string, data: any }[] = [];
  
  loadingsSnap.forEach(docSnap => {
    const data = docSnap.data();
    const invNum = data.invoice_number;
    
    if (!invNum || invNum === '-' || invNum.trim() === '') {
      loadingsToFix.push({ id: docSnap.id, data });
    } else if (typeof invNum === 'string' && invNum.startsWith(mainPrefix)) {
      const seq = parseInt(invNum.replace(mainPrefix, ''), 10);
      if (!isNaN(seq) && seq > maxMain) maxMain = seq;
    }
  });

  // Set initial max values in counters
  const mainCounterRef = doc(db, 'invoiceCounters', `main_${year}`);
  const cnCounterRef = doc(db, 'invoiceCounters', `credit_note_${year}`);
  const pfCounterRef = doc(db, 'invoiceCounters', `proforma_${year}`);

  await runTransaction(db, async (t) => {
    const mainDoc = await t.get(mainCounterRef);
    const cnDoc = await t.get(cnCounterRef);
    const pfDoc = await t.get(pfCounterRef);

    if (!mainDoc.exists()) {
      t.set(mainCounterRef, { year, namespace: 'main', lastNumber: maxMain, updatedAt: new Date().toISOString() });
    } else {
      maxMain = Math.max(maxMain, mainDoc.data().lastNumber || 0);
    }
    
    if (!cnDoc.exists()) {
      t.set(cnCounterRef, { year, namespace: 'credit_note', lastNumber: maxCN, updatedAt: new Date().toISOString() });
    }
    
    if (!pfDoc.exists()) {
      t.set(pfCounterRef, { year, namespace: 'proforma', lastNumber: maxPF, updatedAt: new Date().toISOString() });
    }
  });

  // 2. Fix broken loadings using transaction
  let currentMainMax = maxMain;
  const batch = writeBatch(db);
  let batchCount = 0;
  
  // Sort loadings chronologically
  loadingsToFix.sort((a, b) => {
    const dateA = new Date(a.data.date || a.data.createdAt || 0).getTime();
    const dateB = new Date(b.data.date || b.data.createdAt || 0).getTime();
    return dateA - dateB;
  });

  for (const loading of loadingsToFix) {
    currentMainMax++;
    const formattedSequence = String(currentMainMax).padStart(3, '0');
    const newInvoiceNumber = `${mainPrefix}${formattedSequence}`;
    
    batch.update(doc(db, 'supply_chain_loadings', loading.id), { invoice_number: newInvoiceNumber });
    batchCount++;
  }

  if (batchCount > 0) {
    // Also update the counter to reflect the newly assigned numbers
    batch.set(mainCounterRef, { 
      year, 
      namespace: 'main', 
      lastNumber: currentMainMax, 
      updatedAt: new Date().toISOString() 
    }, { merge: true });
    
    await batch.commit();
  }

  return { fixedLoadingsCount: batchCount, maxMain: currentMainMax };
}
