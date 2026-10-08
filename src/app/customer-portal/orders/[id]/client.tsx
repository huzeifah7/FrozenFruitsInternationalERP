'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCustomerAuth } from '@/components/customer-auth-provider';
import { useDoc, useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { doc, collection, query, where } from '@/firebase/firestore-override';
import { 
  ChevronLeft, 
  ShoppingCart, 
  Clock, 
  Truck, 
  Calendar, 
  FileText, 
  Layers, 
  Scale, 
  Package,
  Building,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { FinalisedPallets } from '@/components/erp/FinalisedPallets';

export default function CustomerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const orderId = resolvedParams.id;
  const router = useRouter();
  const { customer } = useCustomerAuth();

  const db = useFirestore();

  const orderRef = useMemoFirebase(() => {
    if (!db || !customer?.id || !orderId) return null;
    return doc(db, 'orders', orderId);
  }, [db, customer?.id, orderId]);

  const productsQuery = useMemoFirebase(() => {
    if (!db || !customer?.id) return null;
    return collection(db, 'products');
  }, [db, customer?.id]);

  const packingListsQuery = useMemoFirebase(() => {
    if (!db || !customer?.id || !orderId) return null;
    return query(collection(db, 'packingLists'), where('orderId', '==', orderId));
  }, [db, customer?.id, orderId]);

  const { data: order, isLoading: isOrderLoading } = useDoc(orderRef);
  const { data: products } = useCollection<any>(productsQuery);
  const { data: packingLists } = useCollection<any>(packingListsQuery);

  // Security check: Make sure this order belongs to the logged-in customer!
  if (!isOrderLoading && order && order.customerId !== customer?.id) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-rose-50 p-4 rounded-full text-rose-500 mb-4">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-sm text-slate-500 max-w-md mt-2">You do not have authorization to view this resource.</p>
        <Button onClick={() => router.push('/customer-portal/orders')} className="mt-6 font-bold rounded-xl bg-primary">
          Back to Orders
        </Button>
      </div>
    );
  }

  if (isOrderLoading) {
    return (
      <div className="p-8 space-y-6 max-w-5xl mx-auto">
        <div className="h-10 w-48 bg-slate-100 animate-pulse rounded-lg" />
        <div className="h-64 w-full bg-slate-100 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-48 bg-slate-100 animate-pulse rounded-2xl md:col-span-2" />
          <div className="h-48 bg-slate-100 animate-pulse rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-muted p-5 rounded-full mb-4">
          <ShoppingCart className="h-10 w-10 text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Order Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">The order record could not be located.</p>
        <Button onClick={() => router.push('/customer-portal/orders')} className="mt-6 font-bold rounded-xl bg-primary">
          Back to Orders
        </Button>
      </div>
    );
  }

  // Calculate totals
  const totalPallets = order.items?.reduce((sum: number, item: any) => sum + (Number(item.pallets) || 0), 0) || 0;
  
  // Use packing list actuals if available, else expected fallbacks
  let totalBoxes = 0;
  let totalNetWeight = 0;

  if (packingLists && packingLists.length > 0) {
    packingLists.forEach(pl => {
      totalBoxes += Number(pl.totalBoxes || pl.numberOfBoxes || 0);
      totalNetWeight += Number(pl.totalNetWeight || pl.netWeight || 0);
    });
  } else {
    order.items?.forEach((item: any) => {
      const itemPallets = Number(item.pallets) || 0;
      const boxes = itemPallets * 80;
      let unitWeight = 4;
      const pkg = (item.packagingType || '').toLowerCase();
      if (pkg.includes('4kg')) unitWeight = 4;
      else if (pkg.includes('10kg')) unitWeight = 10;
      else if (pkg.includes('14kg')) unitWeight = 14;
      else if (pkg.includes('16kg')) unitWeight = 16;

      totalBoxes += boxes;
      totalNetWeight += boxes * unitWeight;
    });
  }

  function anyDb() {
    return (window as any).firestoreDb || null;
  }

  return (
    <div className="p-6 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="space-y-1 mb-8">
        <h1 className="text-2xl font-semibold text-slate-800">Orders</h1>
        <div className="text-sm text-slate-500">
          Profile / Orders / <span className="text-primary">View Order</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm">
        <h2 className="text-[#2e1d52] font-semibold text-xl mb-8">View Order Info</h2>
        
        <div className="space-y-6 max-w-2xl mb-12">
          <div className="grid grid-cols-[1fr_2fr] items-start gap-4">
            <div className="text-sm font-bold text-slate-800">PO Number</div>
            <div className="text-sm text-slate-600">{order.poNumber || 'N/A'}</div>
          </div>
          <div className="grid grid-cols-[1fr_2fr] items-start gap-4">
            <div className="text-sm font-bold text-slate-800">Customer</div>
            <div className="text-sm text-slate-600">{customer?.companyName || 'Unknown'}</div>
          </div>
          <div className="grid grid-cols-[1fr_2fr] items-start gap-4">
            <div className="text-sm font-bold text-slate-800">Shipping Method</div>
            <div className="text-sm text-slate-600">{order.shippingMethod || 'Standard'}</div>
          </div>
          <div className="grid grid-cols-[1fr_2fr] items-start gap-4">
            <div className="text-sm font-bold text-slate-800">Shipping Address</div>
            <div className="text-sm text-slate-600">
              {typeof order.shippingAddress === 'object' 
                ? (order.shippingAddress?.street ? `${order.shippingAddress.street}, ${order.shippingAddress.city}` : 'Netherlands') 
                : (order.shippingAddress || 'Netherlands')}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_2fr] items-start gap-4">
            <div className="text-sm font-bold text-slate-800">Broker</div>
            <div className="text-sm text-slate-600">
              {order.brokerName || (typeof order.broker === 'object' ? order.broker?.name : order.broker) || '-'}
            </div>
          </div>
          <div className="grid grid-cols-[1fr_2fr] items-start gap-4">
            <div className="text-sm font-bold text-slate-800">Order Status</div>
            <div className="text-sm text-slate-600 uppercase">{order.status || 'PENDING'}</div>
          </div>
        </div>

        {order.poNumber && <FinalisedPallets poNumber={order.poNumber} />}
      </div>
    </div>
  );
}
