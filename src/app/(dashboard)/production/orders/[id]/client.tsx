'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  useDoc, 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
  useUser 
} from '@/firebase';
import { doc, collection } from '@/firebase/firestore-override';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronLeft, 
  Package, 
  Truck, 
  MapPin, 
  Calendar,
  Layers,
  Clock,
  FileText
} from 'lucide-react';
import Link from 'next/link';
import { FinalisedPallets } from '@/components/erp/FinalisedPallets';

const STATUS_OPTIONS = [
  { label: 'Pending', value: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  { label: 'Confirmed', value: 'Confirmed', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  { label: 'In-Production', value: 'In-Production', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  { label: 'Produced', value: 'Produced', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { label: 'Invoiced', value: 'Invoiced', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  { label: 'Paid', value: 'Paid', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  { label: 'Shipped', value: 'Shipped', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  { label: 'Delivered', value: 'Delivered', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  { label: 'Canceled', value: 'Canceled', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
];

const formatDateFull = (dateString: string | undefined) => {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  } catch {
    return '—';
  }
};

export default function ProductionOrderViewPage() {
  const { id: orderId } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();

  const orderRef = useMemoFirebase(() => {
    if (!db || !orderId) return null;
    return doc(db, 'orders', orderId as string);
  }, [db, orderId]);

  const outputQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'production_output');
  }, [db, user]);

  const productsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'products');
  }, [db]);

  const { data: order, isLoading: isOrderLoading } = useDoc(orderRef);
  const { data: outputs } = useCollection(outputQuery);
  const { data: products } = useCollection(productsQuery);

  const getStatusDisplay = (status: string) => {
    const option = STATUS_OPTIONS.find(opt => opt.value === status) || STATUS_OPTIONS[0];
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${option.bg} ${option.text} ${option.border} border`}>
        {option.label}
      </span>
    );
  };

  if (isOrderLoading) {
    return (
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-72" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-3xl" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-muted p-6 rounded-full mb-4">
          <Package className="h-12 w-12 text-muted-foreground opacity-20" />
        </div>
        <h2 className="text-2xl font-bold text-primary">Order Not Found</h2>
        <p className="text-muted-foreground mt-2">The record you are looking for might have been archived or deleted.</p>
        <Button asChild variant="link" className="mt-4 text-primary font-bold">
          <Link href="/production/orders">Return to Orders</Link>
        </Button>
      </div>
    );
  }

  // Calculate dynamic progress
  const totalPalletsGoal = order.items?.reduce((sum: number, item: any) => sum + (Number(item.pallets) || 0), 0) || 1;
  const producedPallets = outputs?.filter((o: any) => o.orderPoId === order.id).length || 0;
  const progressPercent = Math.min(Math.round((producedPallets / totalPalletsGoal) * 100), 100);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/production/orders')} className="rounded-full h-12 w-12 hover:bg-primary/10 transition-all">
            <ChevronLeft className="h-6 w-6 text-primary" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
              <span>Production</span>
              <span className="opacity-40">/</span>
              <span className="text-primary uppercase">Order Details</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">{order.poNumber}</h1>
          </div>
        </div>
      </div>

      {/* Status & Progress Card */}
      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-muted/30">
            <div className="p-6 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</span>
              <div className="mt-1">{getStatusDisplay(order.status)}</div>
            </div>
            <div className="p-6 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Fulfillment Progress</span>
              <div className="flex items-center gap-3">
                <Progress value={progressPercent} className="h-3 flex-1 bg-primary/10" />
                <span className="font-black text-primary">{progressPercent}%</span>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">{producedPallets} of {totalPalletsGoal} Pallets Produced</p>
            </div>
            <div className="p-6 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ETA Week</span>
              <p className="font-bold text-primary text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-sky-500" /> WK {order.etaWeek}
              </p>
            </div>
            <div className="p-6 space-y-2 text-right">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Location</span>
              <p className="font-bold text-primary text-lg flex items-center justify-end gap-2">
                <Layers className="h-5 w-5 text-purple-500" /> {order.productionLocationName || '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Order Details */}
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-primary/5 border-b p-6">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <FileText className="size-5" /> Production Scope
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Customer</span>
                  <p className="font-bold text-primary text-lg">{order.customerName}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Shipping Method</span>
                  <p className="font-bold text-primary text-lg flex items-center gap-2 uppercase">
                    <Truck className="h-4 w-4 text-sky-500" /> {order.shippingMethod}
                  </p>
                </div>
              </div>

              <Separator className="bg-muted/20" />

              {/* Line Items */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-primary/50 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Package size={12} /> Target Production ({order.items?.reduce((sum: number, item: any) => sum + (Number(item.pallets) || 0), 0) || 0} Items)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-muted/30 border-b border-muted/20">
                      <tr>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pallets</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Product</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Caliber</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Packaging</th>
                        <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pallet Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-muted/20">
                      {order.items?.map((item: any, idx: number) => {
                        const product = products?.find(p => p.id === item.productId || p.productName === item.productName);
                        const displayCategory = item.category || product?.category || '';
                        const displayType = item.type || product?.type || '';
                        
                        return (
                          <tr key={idx} className="hover:bg-primary/[0.02]">
                            <td className="px-4 py-3 font-bold text-primary">{item.pallets}</td>
                            <td className="px-4 py-3 text-sm text-primary font-medium">
                              {[item.productName, displayCategory, displayType].filter(Boolean).join(' - ')}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{item.caliber}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{item.packagingType}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">{item.palletType}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Finalised Pallets Component */}
              <FinalisedPallets poNumber={order.poNumber} />

              {order.remarks && (
                <>
                  <Separator className="bg-muted/20" />
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Production Instructions</span>
                    <p className="text-sm text-muted-foreground leading-relaxed bg-muted/20 p-4 rounded-xl">{order.remarks}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Shipping Info */}
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-accent/5 border-b p-6">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <Truck className="size-5" /> Destination
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Shipping Address</span>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-accent mt-1 shrink-0" />
                  <p className="text-sm text-primary font-medium">
                    {order.shippingAddress?.street}<br />
                    {order.shippingAddress?.city}, {order.shippingAddress?.zipCode}<br />
                    <span className="font-bold text-primary/70">{order.shippingAddress?.country}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timing */}
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-muted/30 border-b p-6">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <Clock className="size-5" /> Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Order Confirmed</span>
                <span className="text-xs font-bold text-primary">{formatDateFull(order.createdAt)}</span>
              </div>
              <Separator className="bg-muted/20" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Target ETA</span>
                <span className="text-xs font-bold text-primary">Week {order.etaWeek}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
