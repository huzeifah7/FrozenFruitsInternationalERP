// src/app/(dashboard)/finance/packing-list/add/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, writeBatch, serverTimestamp, query, getDocs, orderBy, limit, where } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { toast } from '@/hooks/use-toast';

// Helper type definitions
interface Order {
  id: string;
  poNumber: string;
  customer: string;
  productionType: string;
  products: Array<{
    productId: string;
    calibre: string;
    boxes: number;
    quantity: number;
    netWeight: number;
    grossWeight: number;
  }>;
  totalNetWeight: number;
  totalGrossWeight: number;
  totalBoxes: number;
  countryOfOrigin: string;
}

interface TransportCompany {
  id: string;
  name: string;
}

export default function AddPackingList() {
  const router = useRouter();
  const firestore = useFirestore();

  // Load produced orders that have not yet generated a packing list
  const ordersQuery = useMemoFirebase(() => {
    return query(
      collection(firestore, 'orders'),
      where('status', '==', 'PRODUCED'),
      where('packingListGenerated', '==', false),
      orderBy('poNumber', 'asc')
    );
  }, [firestore]);

  const {
    data: ordersData,
    isLoading: ordersLoading,
    error: ordersError,
  } = useCollection<Order>(ordersQuery);

  // Load transport companies master data
  const transportQuery = useMemoFirebase(() => {
    return collection(firestore, 'transport_companies');
  }, [firestore]);

  const {
    data: transportData,
    isLoading: transportLoading,
    error: transportError,
  } = useCollection<TransportCompany>(transportQuery);

  const [selectedProductionType, setSelectedProductionType] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [orderDetails, setOrderDetails] = useState<Order | null>(null);

  // Form fields for logistics info
  const [expeditionDate, setExpeditionDate] = useState('');
  const [etd, setEtd] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [transportCompanyId, setTransportCompanyId] = useState('');
  const [ggnNumber, setGgnNumber] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [remarks, setRemarks] = useState('');

  // When an order is selected, fetch its full document
  const { data: orderDoc } = useDoc<Order>(selectedOrderId ? doc(firestore, 'orders', selectedOrderId) : null);

  useEffect(() => {
    if (orderDoc) {
      setOrderDetails(orderDoc);
      // Auto-fill production type if it exists on the order
      setSelectedProductionType(orderDoc.productionType || '');
    }
  }, [orderDoc]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      toast({ title: 'Select Order', description: 'Please select an order first.' });
      return;
    }
    try {
      // Generate global sequential packing list number
      const seqQuery = query(collection(firestore, 'packingLists'), orderBy('sequence', 'desc'), limit(1));
      const seqSnap = await getDocs(seqQuery);
      let nextSequence = 1;
      if (!seqSnap.empty) {
        const lastDoc = seqSnap.docs[0].data();
        if (lastDoc.sequence && typeof lastDoc.sequence === 'number') {
          nextSequence = lastDoc.sequence + 1;
        }
      }

      // Format date from expeditionDate
      const plDate = new Date(expeditionDate);
      const dd = String(plDate.getDate()).padStart(2, '0');
      const mm = String(plDate.getMonth() + 1).padStart(2, '0');
      const yyyy = plDate.getFullYear();
      const sequenceStr = String(nextSequence).padStart(5, '0');
      const generatedPLNumber = `SC${dd}${mm}${yyyy}-${sequenceStr}`;

      const batch = writeBatch(firestore);
      const packingListRef = doc(collection(firestore, 'packingLists'));
      batch.set(packingListRef, {
        sequence: nextSequence,
        packingListNumber: generatedPLNumber,
        productionType: selectedProductionType,
        orderId: selectedOrderId,
        poNumber: orderDetails?.poNumber,
        customer: orderDetails?.customer,
        expeditionDate,
        etd,
        truckNumber,
        transportCompanyId,
        ggnNumber,
        sealNumber,
        remarks,
        items: orderDetails?.products || [],
        totalNetWeight: orderDetails?.totalNetWeight,
        totalGrossWeight: orderDetails?.totalGrossWeight,
        totalBoxes: orderDetails?.totalBoxes,
        countryOfOrigin: orderDetails?.countryOfOrigin,
        status: 'draft',
        createdAt: serverTimestamp(),
      });
      // Update order flags
      const orderRef = doc(firestore, 'orders', selectedOrderId);
      batch.update(orderRef, {
        packingListGenerated: true,
        status: 'READY_FOR_SHIPPING',
      });
      await batch.commit();
      toast({ title: 'Packing List Created', description: `Packing list ${generatedPLNumber} has been saved.` });
      router.push('/finance/packing-list');
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to create packing list.' });
    }
  };

  if (ordersLoading || transportLoading) return <div>Loading...</div>;
  if (ordersError || transportError) return <div>Error loading data.</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Add Packing List</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Production Type */}
        <div>
          <label className="block font-medium">Production Type</label>
          <select
            value={selectedProductionType}
            onChange={(e) => setSelectedProductionType(e.target.value)}
            required
            className="mt-1 block w-full border rounded p-2"
          >
            <option value="">Select...</option>
            <option value="Internal Production">Internal Production</option>
            <option value="Prestation">Prestation</option>
          </select>
        </div>
        {/* Order PO Number */}
        <div>
          <label className="block font-medium">Order PO Number</label>
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            required
            className="mt-1 block w-full border rounded p-2"
          >
            <option value="">Select Order...</option>
            {ordersData?.map((order) => (
              <option key={order.id} value={order.id}>
                {order.poNumber}
              </option>
            ))}
          </select>
        </div>
        {/* Auto‑filled info */}
        {orderDetails && (
          <div className="grid grid-cols-2 gap-4 border p-4 rounded bg-gray-50">
            <div>
              <label className="block font-medium">Customer</label>
              <input type="text" value={orderDetails.customer} readOnly className="mt-1 block w-full border rounded p-2 bg-gray-100" />
            </div>
            <div>
              <label className="block font-medium">PO Number</label>
              <input type="text" value={orderDetails.poNumber} readOnly className="mt-1 block w-full border rounded p-2 bg-gray-100" />
            </div>
            <div>
              <label className="block font-medium">Total Net Weight</label>
              <input type="number" value={orderDetails.totalNetWeight} readOnly className="mt-1 block w-full border rounded p-2 bg-gray-100" />
            </div>
            <div>
              <label className="block font-medium">Total Gross Weight</label>
              <input type="number" value={orderDetails.totalGrossWeight} readOnly className="mt-1 block w-full border rounded p-2 bg-gray-100" />
            </div>
            <div>
              <label className="block font-medium">Total Boxes</label>
              <input type="number" value={orderDetails.totalBoxes} readOnly className="mt-1 block w-full border rounded p-2 bg-gray-100" />
            </div>
            <div>
              <label className="block font-medium">Country Of Origin</label>
              <input type="text" value={orderDetails.countryOfOrigin} readOnly className="mt-1 block w-full border rounded p-2 bg-gray-100" />
            </div>
          </div>
        )}
        {/* Logistics fields */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-medium">Expedition Date</label>
            <input
              type="date"
              value={expeditionDate}
              onChange={(e) => setExpeditionDate(e.target.value)}
              required
              className="mt-1 block w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block font-medium">ETD</label>
            <input
              type="date"
              value={etd}
              onChange={(e) => setEtd(e.target.value)}
              required
              className="mt-1 block w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block font-medium">Truck Number</label>
            <input
              type="text"
              value={truckNumber}
              onChange={(e) => setTruckNumber(e.target.value)}
              required
              className="mt-1 block w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block font-medium">Transport Company</label>
            <select
              value={transportCompanyId}
              onChange={(e) => setTransportCompanyId(e.target.value)}
              required
              className="mt-1 block w-full border rounded p-2"
            >
              <option value="">Select...</option>
              {transportData?.map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium">GGN Number</label>
            <input
              type="text"
              value={ggnNumber}
              onChange={(e) => setGgnNumber(e.target.value)}
              className="mt-1 block w-full border rounded p-2"
            />
          </div>
          <div>
            <label className="block font-medium">Seal Number</label>
            <input
              type="text"
              value={sealNumber}
              onChange={(e) => setSealNumber(e.target.value)}
              className="mt-1 block w-full border rounded p-2"
            />
          </div>
          <div className="col-span-2">
            <label className="block font-medium">Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="mt-1 block w-full border rounded p-2"
            />
          </div>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create Packing List
        </button>
      </form>
    </div>
  );
}
