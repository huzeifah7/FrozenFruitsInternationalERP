import { 
  collection, 
  getDocs, 
  serverTimestamp,
  doc,
  writeBatch
} from '@/firebase/firestore-override';

const SEED_KEY = 'seed_suppliers_situation_v1';

export async function seedSuppliersSituationData(db: any, userEmail: string = 'admin@optimum.com') {
  // Guard: never run more than once per browser session (survives HMR remounts in development)
  if (typeof window !== 'undefined' && localStorage.getItem(SEED_KEY)) return;

  try {
    // 1. Check & Seed Suppliers
    const suppliersRef = collection(db, 'procurement_suppliers');
    const suppliersSnapshot = await getDocs(suppliersRef);
    let suppliersList = suppliersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));

    if (suppliersList.length === 0) {
      console.log('Seeding mock procurement suppliers...');
      const mockSuppliers = [
        { name: 'Souss Agri S.A.', if: '45210982', ice: '001672345000088', expenseType: 'Raw Materials & Packing' },
        { name: 'Atlas Growers Co.', if: '89104523', ice: '002098411000152', expenseType: 'Farming Equipment' },
        { name: 'Coop Agritech Souss', if: '73029481', ice: '001928734000032', expenseType: 'Organic Fertilizers' }
      ];

      const supplierBatch = writeBatch(db);
      for (const sup of mockSuppliers) {
        const newDocRef = doc(collection(db, 'procurement_suppliers'));
        supplierBatch.set(newDocRef, { ...sup, created_at: serverTimestamp() });
      }
      await supplierBatch.commit();

      const freshSnapshot = await getDocs(suppliersRef);
      suppliersList = freshSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
    }

    // 2. Check & Seed Invoices
    const invoicesRef = collection(db, 'suppliers_situation_invoices');
    const invoicesSnapshot = await getDocs(invoicesRef);

    // Track the seeded invoice ID for INV-2026-001 so we can link the payment
    let inv001Id: string | null = null;

    if (invoicesSnapshot.empty && suppliersList.length > 0) {
      console.log('Seeding mock supplier invoices...');
      const s1 = suppliersList[0];
      const s2 = suppliersList[1] || suppliersList[0];
      const s3 = suppliersList[2] || suppliersList[0];

      const mockInvoices = [
        {
          invoiceNumber: 'INV-2026-001',
          poOrderNumber: 'PO-2026-901',
          date: '2026-05-01',
          dueDate: '2026-05-15',
          invoiceType: 'invoice',
          supplierId: s1.id,
          supplierName: s1.name,
          customerName: 'Export Optimum S.A.R.L.',
          invoicingAddress: 'Zone Industrielle Aït Melloul, Lot 234, Agadir',
          shippingAddress: 'Zone Industrielle Aït Melloul, Lot 234, Agadir',
          ice: s1.ice || '—',
          iff: s1.if || '—',
          remarks: 'Standard payment terms net 14 days.',
          taxRate: 20,
          discount: 100,
          items: [
            { description: 'Cardboard Box Packaging (Medium)', quantity: 5000, price: 0.85 },
            { description: 'Plastic Pallet Wraps (Rolls)', quantity: 200, price: 4.50 }
          ],
          createdBy: userEmail
        },
        {
          invoiceNumber: 'INV-2026-002',
          poOrderNumber: 'PO-2026-902',
          date: '2026-05-10',
          dueDate: '2026-06-10',
          invoiceType: 'produce',
          supplierId: s1.id,
          supplierName: s1.name,
          customerName: 'Export Optimum S.A.R.L.',
          invoicingAddress: 'Zone Industrielle Aït Melloul, Lot 234, Agadir',
          shippingAddress: 'Agadir Port Terminal 2, Morocco',
          countryOfOrigin: 'Morocco',
          totalGrossWeight: 12500,
          totalBoxes: 620,
          ice: s1.ice || '—',
          iff: s1.if || '—',
          remarks: 'Temperature controlled container delivery.',
          taxRate: 10,
          discount: 0,
          items: [
            { product: 'Avocado Hass', calibre: '14', quantity: 6000, price: 1.80 },
            { product: 'Avocado Hass', calibre: '16', quantity: 6500, price: 1.65 }
          ],
          createdBy: userEmail
        },
        {
          invoiceNumber: 'CN-2026-001',
          poOrderNumber: 'PO-2026-901',
          date: '2026-05-12',
          dueDate: '2026-05-12',
          invoiceType: 'credit_note',
          supplierId: s1.id,
          supplierName: s1.name,
          customerName: 'Export Optimum S.A.R.L.',
          invoicingAddress: 'Zone Industrielle Aït Melloul, Lot 234, Agadir',
          shippingAddress: 'Zone Industrielle Aït Melloul, Lot 234, Agadir',
          ice: s1.ice || '—',
          iff: s1.if || '—',
          remarks: 'Compensation for damaged cardboard packaging.',
          taxRate: 20,
          discount: 0,
          items: [
            { product: 'Cardboard Box Packaging (Medium)', description: 'Returned damaged items', quantity: 300, price: 0.85 }
          ],
          createdBy: userEmail
        },
        {
          invoiceNumber: 'INV-2026-003',
          poOrderNumber: 'PO-2026-903',
          date: '2026-05-14',
          dueDate: '2026-05-28',
          invoiceType: 'invoice',
          supplierId: s2.id,
          supplierName: s2.name,
          customerName: 'Export Optimum S.A.R.L.',
          invoicingAddress: 'Zone Industrielle Aït Melloul, Lot 234, Agadir',
          shippingAddress: 'Zone Industrielle Aït Melloul, Lot 234, Agadir',
          ice: s2.ice || '—',
          iff: s2.if || '—',
          remarks: 'Payment via Bank transfer.',
          taxRate: 20,
          discount: 50,
          items: [
            { description: 'Farming Micro-irrigation Pipes (100m)', quantity: 15, price: 120.00 },
            { description: 'Pressure regulator valves 2"', quantity: 45, price: 18.50 }
          ],
          createdBy: userEmail
        },
        {
          invoiceNumber: 'PROF-2026-001',
          poOrderNumber: 'PO-2026-904',
          date: '2026-05-18',
          dueDate: '2026-06-18',
          invoiceType: 'proforma',
          supplierId: s3.id,
          supplierName: s3.name,
          customerName: 'Export Optimum S.A.R.L.',
          invoicingAddress: 'Zone Industrielle Aït Melloul, Lot 234, Agadir',
          shippingAddress: 'Zone Industrielle Aït Melloul, Lot 234, Agadir',
          countryOfOrigin: 'Morocco',
          totalGrossWeight: 3400,
          totalBoxes: 150,
          ice: s3.ice || '—',
          iff: s3.if || '—',
          remarks: 'Proforma quote for organic soil nutrient inputs.',
          taxRate: 20,
          discount: 200,
          items: [
            { product: 'Soil Booster Bio', calibre: 'Bag 25kg', quantity: 150, price: 15.00 }
          ],
          createdBy: userEmail
        }
      ];

      // Use a single batch for all invoices instead of individual addDoc calls
      const invoiceBatch = writeBatch(db);

      for (const inv of mockInvoices) {
        const amountHT = inv.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const tvaAmount = (amountHT * inv.taxRate) / 100;
        const totalTTC = amountHT + tvaAmount - inv.discount;
        const isProforma = inv.invoiceType === 'proforma';
        let paidAmount = 0;
        if (inv.invoiceNumber === 'INV-2026-001') paidAmount = 1500;

        const openAmount = isProforma ? 0 : (totalTTC - paidAmount);
        let status = 'unpaid';
        if (isProforma) status = 'proforma';
        else if (paidAmount >= totalTTC) status = 'paid';
        else if (paidAmount > 0) status = 'partially_paid';

        const dueDate = new Date(inv.dueDate);
        const now = new Date('2026-05-20');
        if (status !== 'paid' && status !== 'proforma' && dueDate < now) status = 'overdue';

        const newInvRef = doc(invoicesRef);
        if (inv.invoiceNumber === 'INV-2026-001') inv001Id = newInvRef.id;

        invoiceBatch.set(newInvRef, {
          ...inv,
          totalAmount: totalTTC,
          paidAmount,
          openAmount,
          status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      await invoiceBatch.commit();
    } else if (!invoicesSnapshot.empty) {
      // Invoices already exist — look up INV-2026-001 for payment seeding
      const existing001 = invoicesSnapshot.docs.find(d => d.data().invoiceNumber === 'INV-2026-001');
      if (existing001) inv001Id = existing001.id;
    }

    // 3. Check & Seed Payments
    const paymentsRef = collection(db, 'suppliers_situation_payments');
    const paymentsSnapshot = await getDocs(paymentsRef);

    if (paymentsSnapshot.empty && inv001Id && suppliersList.length > 0) {
      console.log('Seeding mock payments...');
      const s1 = suppliersList[0];
      const paymentBatch = writeBatch(db);
      const payRef = doc(paymentsRef);
      paymentBatch.set(payRef, {
        invoiceId: inv001Id,
        invoiceNumber: 'INV-2026-001',
        supplierId: s1.id,
        supplierName: s1.name,
        operationType: 'Payment',
        date: '2026-05-11',
        amount: 1500,
        exchangeRate: 10.82,
        amountMAD: 1500 * 10.82,
        note: 'Bank Wire transfer confirmation #599201',
        createdBy: userEmail,
        createdAt: serverTimestamp()
      });
      await paymentBatch.commit();
    }

    // Mark as seeded permanently so it never re-runs even after HMR
    if (typeof window !== 'undefined') {
      localStorage.setItem(SEED_KEY, 'true');
    }

    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Seeding mock data failed: ', err);
  }
}
