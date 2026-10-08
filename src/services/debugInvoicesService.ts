import { Firestore, collection, getDocs } from '@/firebase/firestore-override';
import { runInvoiceBackfill } from '@/lib/invoice-generator';

export async function fetchMissingInvoices(db: Firestore) {
  const invoicesSnap = await getDocs(collection(db, 'invoices'));
  const missingInvoices: any[] = [];
  invoicesSnap.forEach(doc => {
    const data = doc.data();
    if (!data.invoice_number || data.invoice_number === '-' || data.invoice_number === 'Generating...') {
      missingInvoices.push({ id: doc.id, collection: 'invoices', ...data });
    }
  });

  const loadingsSnap = await getDocs(collection(db, 'supply_chain_loadings'));
  const missingLoadings: any[] = [];
  loadingsSnap.forEach(doc => {
    const data = doc.data();
    if (!data.invoice_number || data.invoice_number === '-' || data.invoice_number === 'Generating...') {
      missingLoadings.push({ id: doc.id, collection: 'supply_chain_loadings', ...data });
    }
  });

  return { missingInvoices, missingLoadings };
}

export async function executeInvoiceBackfill(db: Firestore, year?: number) {
  const targetYear = year || new Date().getFullYear();
  return await runInvoiceBackfill(db, targetYear);
}
