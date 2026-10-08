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
  Edit2, 
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

const formatDateFull = (dateInput: any) => {
  if (!dateInput) return '—';
  try {
    const date = dateInput?.toDate ? dateInput.toDate() : new Date(dateInput);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
};

export default function OrderDetailsPage() {
  const { id: orderId } = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();

  const orderRef = useMemoFirebase(() => {
    if (!db || !orderId) return null;
    return doc(db, 'orders', orderId as string);
  }, [db, orderId]);

  const { data: order, isLoading: isOrderLoading } = useDoc(orderRef);

  const customersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'customers');
  }, [db, user]);

  const { data: customers } = useCollection(customersQuery);

  const outputQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'production_output');
  }, [db, user]);

  const { data: outputs } = useCollection(outputQuery);

  const productsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'products');
  }, [db, user]);

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
          <Link href="/sales/orders">Return to Orders</Link>
        </Button>
      </div>
    );
  }

  // Total value calculation removed as per request

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/sales/orders')} className="rounded-full h-12 w-12 hover:bg-primary/10 transition-all">
            <ChevronLeft className="h-6 w-6 text-primary" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
              <span>Sales</span>
              <span className="opacity-40">/</span>
              <span className="text-primary uppercase">Order Details</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">{order.poNumber}</h1>
          </div>
        </div>
        <Button asChild className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-12 px-8 rounded-xl font-bold uppercase tracking-widest transition-all">
          <Link href={`/sales/orders/${orderId}/edit`}>
            <Edit2 size={18} /> Modify Order
          </Link>
        </Button>
      </div>

      {/* Status & Progress Card */}
      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-muted/30">
            <div className="p-6 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</span>
              {getStatusDisplay(order.status)}
            </div>
            <div className="p-6 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Production Progress</span>
              {(() => {
                const totalPalletsGoal = order.items?.reduce((sum: number, item: any) => sum + (Number(item.pallets) || 0), 0) || 1;
                const producedPallets = outputs?.filter((o: any) => o.orderPoId === order.id).length || 0;
                const progressPercent = Math.min(Math.round((producedPallets / totalPalletsGoal) * 100), 100);
                
                return (
                  <div className="flex items-center gap-3">
                    <Progress value={progressPercent} className="h-3 flex-1 bg-primary/10" />
                    <span className="font-black text-primary">{progressPercent}%</span>
                  </div>
                );
              })()}
            </div>
            <div className="p-6 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ETA Week</span>
              <p className="font-bold text-primary text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-sky-500" /> WK {order.etaWeek}
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
                <FileText className="size-5" /> Order Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Customer</span>
                  <p className="font-bold text-primary text-lg">{order.customerName}</p>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Production Location</span>
                  <p className="font-bold text-primary text-lg flex items-center gap-2">
                    <Layers className="h-4 w-4 text-purple-500" /> {order.productionLocationName || '—'}
                  </p>
                </div>
              </div>

              <Separator className="bg-muted/20" />

              {/* Line Items */}
              <div className="space-y-6">
                <h4 className="text-xl font-bold text-[#3B2D59]">
                  Order Items: {order.items?.reduce((sum: number, item: any) => sum + (Number(item.pallets) || 0), 0) || 0}
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="px-4 py-4 text-sm font-bold text-[#3B2D59]">Number of pallets</th>
                        <th className="px-4 py-4 text-sm font-bold text-[#3B2D59]">Product</th>
                        <th className="px-4 py-4 text-sm font-bold text-[#3B2D59]">Caliber</th>
                        <th className="px-4 py-4 text-sm font-bold text-[#3B2D59]">Packaging Type</th>
                        <th className="px-4 py-4 text-sm font-bold text-[#3B2D59]">Pallet Type</th>
                        <th className="px-4 py-4 text-sm font-bold text-[#3B2D59]">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items?.map((item: any, idx: number) => {
                        const product = products?.find((p: any) => p.id === item.productId);
                        let fullName = 'Unknown';
                        if (product) {
                          fullName = [product.productName, product.category, product.type].filter(Boolean).join(' - ');
                        } else if (item.productName) {
                          fullName = [item.productName, item.variety].filter(Boolean).join(' - ');
                        }

                        return (
                          <tr key={idx} className="hover:bg-primary/[0.02]">
                            <td className="px-4 py-5 text-sm text-[#3B2D59]">{item.pallets}</td>
                            <td className="px-4 py-5 text-sm text-muted-foreground">{fullName}</td>
                            <td className="px-4 py-5 text-sm text-[#3B2D59]">{item.caliber}</td>
                            <td className="px-4 py-5 text-sm text-muted-foreground">{item.packagingType}</td>
                            <td className="px-4 py-5 text-sm text-muted-foreground">{item.palletType}</td>
                            <td className="px-4 py-5 text-sm text-[#3B2D59]">{item.price ? `${Number(item.price).toFixed(4)}€` : '-'}</td>
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
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Internal Remarks</span>
                    <p className="text-sm text-muted-foreground leading-relaxed bg-muted/20 p-4 rounded-xl">{order.remarks}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Shipping Details */}
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-accent/5 border-b p-6">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <Truck className="size-5" /> Shipping & Logistics
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

              <Separator className="bg-muted/20" />

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Shipping Method</span>
                <p className="text-sm text-primary font-medium flex items-center gap-2">
                  <Truck className="h-4 w-4 text-sky-500" /> {order.shippingMethod}
                </p>
              </div>

              {order.broker && (
                <>
                  <Separator className="bg-muted/20" />
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Authorized Broker</span>
                    <p className="text-sm text-primary font-medium">{order.broker.name}</p>
                    <p className="text-xs text-muted-foreground">{order.broker.address}</p>
                  </div>
                </>
              )}

              {order.exportatorNumber && (
                <>
                  <Separator className="bg-muted/20" />
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Exportator Number</span>
                    <p className="text-sm text-primary font-mono font-bold">{order.exportatorNumber}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Audit Trail */}
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-muted/30 border-b p-6">
              <CardTitle className="text-lg font-bold text-primary flex items-center gap-2 uppercase tracking-tighter">
                <Clock className="size-5" /> Audit Trail
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Created</span>
                <span className="text-xs font-bold text-primary">{formatDateFull(order.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Created By</span>
                <span className="text-xs font-bold text-primary">{order.createdByName || order.createdBy?.split('@')[0]}</span>
              </div>
              <Separator className="bg-muted/20" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Last Updated</span>
                <span className="text-xs font-bold text-primary">{formatDateFull(order.updatedAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Updated By</span>
                <span className="text-xs font-bold text-primary">{order.updatedByName || order.updatedBy?.split('@')[0]}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
