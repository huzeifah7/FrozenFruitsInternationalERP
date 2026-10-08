'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  useUser,
} from '@/firebase';
import {
  collection,
  query,
  orderBy,
  doc,
  updateDoc
} from '@/firebase/firestore-override';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Filter,
  X,
  Download,
  Calendar,
  Layers,
  Clock,
  ShoppingCart,
  Loader2,
  FileSpreadsheet
} from 'lucide-react';
import Link from 'next/link';
import { exportProductionOrdersExcel } from '@/lib/export-orders-excel';
import { usePermissions } from '@/hooks/use-permissions';

const STATUS_TABS = [
  { label: 'All Orders', value: 'all' },
  { label: 'Confirmed Orders', value: 'confirmed' },
  { label: 'In-Production Orders', value: 'in-production' },
  { label: 'Produced Orders', value: 'produced' },
  { label: 'Shipped Orders', value: 'shipped' },
  { label: 'Delivered Orders', value: 'delivered' },
];

const PRODUCTION_STATUSES = [
  { label: 'Confirmed', value: 'Confirmed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { label: 'In-Production', value: 'In-Production', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { label: 'Produced', value: 'Produced', color: 'bg-sky-50 text-sky-700 border-sky-200' },
];

export default function ProductionOrdersPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { canUpdate } = usePermissions('production.orders');

  const [activeTab, setActiveTab] = useState('all');
  const [filterETAStart, setFilterETAStart] = useState('');
  const [filterETAEnd, setFilterETAEnd] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Data Fetching
  const ordersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  }, [db, user]);

  const outputQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'production_output');
  }, [db, user]);

  const productsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'products');
  }, [db]);

  const { data: orders, isLoading, error: ordersError } = useCollection(ordersQuery);
  const { data: outputs } = useCollection(outputQuery);
  const { data: products } = useCollection(productsQuery);

  useEffect(() => {
    console.log("Orders hook state:", { orders, isLoading, ordersError });
  }, [orders, isLoading, ordersError]);

  // Status Counts
  const statusCounts = useMemo(() => {
    // Filter out Pending/Draft from base orders to avoid counting them
    const validOrders = orders?.filter(o => o.status !== 'Pending' && o.status !== 'Draft') || [];
    
    const counts: Record<string, number> = {};
    STATUS_TABS.forEach(tab => {
      if (tab.value === 'all') {
        counts['all'] = validOrders.filter(o => ['Confirmed', 'In-Production', 'Produced'].includes(o.status)).length;
      } else {
        const matchStatus = tab.label.replace(' Orders', '');
        counts[tab.value] = validOrders.filter(o => o.status === matchStatus).length;
      }
    });
    return counts;
  }, [orders]);

  // Filtering Logic
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    
    // Only process orders that are confirmed or beyond (hide Pending)
    const validOrders = orders.filter(o => o.status !== 'Pending' && o.status !== 'Draft');

    return validOrders.filter(order => {
      let matchesTab = true;
      if (activeTab === 'all') {
        matchesTab = ['Confirmed', 'In-Production', 'Produced'].includes(order.status);
      } else {
        const selectedTabObj = STATUS_TABS.find(t => t.value === activeTab);
        const matchStatusValue = selectedTabObj ? selectedTabObj.label.replace(' Orders', '') : '';
        matchesTab = order.status === matchStatusValue;
      }

      const eta = Number(order.etaWeek);
      const start = filterETAStart ? Number(filterETAStart) : -Infinity;
      const end = filterETAEnd ? Number(filterETAEnd) : Infinity;
      const matchesETA = (!order.etaWeek && !filterETAStart && !filterETAEnd) || (eta >= start && eta <= end);

      return matchesTab && matchesETA;
    });
  }, [orders, activeTab, filterETAStart, filterETAEnd]);

  // Status Update
  const updateStatus = async (id: string, newStatus: string) => {
    if (!db || !user) return;
    setUpdatingId(id);
    const docRef = doc(db, 'orders', id);
    try {
      await updateDoc(docRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: user.email || user.displayName || 'Unknown'
      });
      toast({
        title: "Status Updated",
        description: `Order updated to ${newStatus}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Update Failed",
        description: "Could not update production status.",
        variant: "destructive"
      });
    } finally {
      setUpdatingId(null);
    }
  };

  // Production Date Update
  const updateProductionDate = async (id: string, newDate: string) => {
    if (!db || !user) return;
    setUpdatingId(id);
    const docRef = doc(db, 'orders', id);
    try {
      await updateDoc(docRef, {
        productionDate: newDate,
        updatedAt: new Date().toISOString(),
        updatedBy: user.email || user.displayName || 'Unknown'
      });
      toast({
        title: "Date Updated",
        description: `Production date has been set.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Update Failed",
        description: "Could not sync date to database.",
        variant: "destructive"
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExportExcel = async () => {
    if (isExporting || !filteredOrders || filteredOrders.length === 0) return;
    setIsExporting(true);
    try {
      const getItemType = (item: any) => {
        if (item.type) return String(item.type).toLowerCase();
        const product = products?.find(p => p.id === item.productId || p.productName === item.productName);
        if (product?.type) return String(product.type).toLowerCase();
        const strToSearch = [item.productName, item.variety, product?.productName, product?.variety]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (strToSearch.includes('bio') || strToSearch.includes('organic') || strToSearch.includes('org')) {
          return 'organic';
        }
        return 'conventional';
      };

      const getOutputRefType = (o: any) => {
        if (o.type) return String(o.type).toLowerCase();
        if (o.items && Array.isArray(o.items) && o.items.length > 0) {
          const item = o.items[0];
          if (item.type) return String(item.type).toLowerCase();
          const product = products?.find(p => p.id === item.productId || p.productName === item.productName);
          if (product?.type) return String(product.type).toLowerCase();
        }
        const product = products?.find(p => p.id === o.productId || p.productName === o.productName);
        if (product?.type) return String(product.type).toLowerCase();

        const strToSearch = [o.productName, o.variety, o.category, product?.productName, product?.variety]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (strToSearch.includes('bio') || strToSearch.includes('organic') || strToSearch.includes('org')) {
          return 'organic';
        }
        return 'conventional';
      };

      const conventionalRows: any[] = [];
      const organicRows: any[] = [];

      filteredOrders.forEach(order => {
        const orderOutputs = outputs?.filter((o: any) => o.orderPoId === order.id || o.orderPoNumber === order.poNumber || o.poNumber === order.poNumber) || [];
        
        // Group items
        const cItems = (order.items || []).filter((item: any) => getItemType(item) === 'conventional');
        const oItems = (order.items || []).filter((item: any) => getItemType(item) === 'organic');

        // Group outputs
        const cOutputs = orderOutputs.filter((o: any) => getOutputRefType(o) === 'conventional');
        const oOutputs = orderOutputs.filter((o: any) => getOutputRefType(o) === 'organic');

        const mapRow = (itemsList: any[], outputsList: any[]) => {
          let caliber10 = 0;
          let caliber12 = 0;
          let caliber14 = 0;
          let caliber16 = 0;
          let caliber18 = 0;
          let caliber20 = 0;
          let caliber22 = 0;
          let caliber24 = 0;
          let caliber26 = 0;
          let caliber28 = 0;
          let caliber30 = 0;
          let caliber32 = 0;

          itemsList.forEach((item: any) => {
            const cal = String(item.caliber || '').replace(/[^0-9]/g, '');
            const pallets = Number(item.pallets) || 0;
            if (cal === '10') caliber10 += pallets;
            else if (cal === '12') caliber12 += pallets;
            else if (cal === '14') caliber14 += pallets;
            else if (cal === '16') caliber16 += pallets;
            else if (cal === '18') caliber18 += pallets;
            else if (cal === '20') caliber20 += pallets;
            else if (cal === '22') caliber22 += pallets;
            else if (cal === '24') caliber24 += pallets;
            else if (cal === '26') caliber26 += pallets;
            else if (cal === '28') caliber28 += pallets;
            else if (cal === '30') caliber30 += pallets;
            else if (cal === '32') caliber32 += pallets;
          });

          let producedCaliber10 = 0;
          let producedCaliber12 = 0;
          let producedCaliber14 = 0;
          let producedCaliber16 = 0;
          let producedCaliber18 = 0;
          let producedCaliber20 = 0;
          let producedCaliber22 = 0;
          let producedCaliber24 = 0;
          let producedCaliber26 = 0;
          let producedCaliber28 = 0;
          let producedCaliber30 = 0;
          let producedCaliber32 = 0;

          outputsList.forEach((o: any) => {
            let cal = '';
            if (o.caliber) {
              cal = String(o.caliber).replace(/[^0-9]/g, '');
            } else if (o.items && Array.isArray(o.items) && o.items.length > 0) {
              cal = String(o.items[0].caliber || '').replace(/[^0-9]/g, '');
            }

            if (cal === '10') producedCaliber10 += 1;
            else if (cal === '12') producedCaliber12 += 1;
            else if (cal === '14') producedCaliber14 += 1;
            else if (cal === '16') producedCaliber16 += 1;
            else if (cal === '18') producedCaliber18 += 1;
            else if (cal === '20') producedCaliber20 += 1;
            else if (cal === '22') producedCaliber22 += 1;
            else if (cal === '24') producedCaliber24 += 1;
            else if (cal === '26') producedCaliber26 += 1;
            else if (cal === '28') producedCaliber28 += 1;
            else if (cal === '30') producedCaliber30 += 1;
            else if (cal === '32') producedCaliber32 += 1;
          });

          const packagingSet = new Set<string>();
          itemsList.forEach((item: any) => {
            if (item.packagingType) packagingSet.add(item.packagingType);
          });
          const packaging = Array.from(packagingSet).join(' + ');

          let fromSalesOrder = '';
          if (Array.isArray(order.linkedSalesOrders)) {
            fromSalesOrder = order.linkedSalesOrders.join(', ');
          } else if (order.linkedSalesOrders) {
            fromSalesOrder = String(order.linkedSalesOrders);
          } else if (order.salesOrderNumber) {
            fromSalesOrder = String(order.salesOrderNumber);
          } else if (order.fromSalesOrder) {
            fromSalesOrder = String(order.fromSalesOrder);
          }

          const totalPallets = caliber10 + caliber12 + caliber14 + caliber16 + caliber18 + caliber20 + caliber22 + caliber24 + caliber26 + caliber28 + caliber30 + caliber32;

          return {
            etaWeek: order.etaWeek || '',
            poNumber: order.poNumber || '',
            customerName: order.customerName || '',
            packaging,
            status: order.status || '',
            productionLocationName: order.productionLocationName || '',
            note: order.note || order.remarks || '',
            shippingMethod: order.shippingMethod || '',
            caliber10,
            caliber12,
            caliber14,
            caliber16,
            caliber18,
            caliber20,
            caliber22,
            caliber24,
            caliber26,
            caliber28,
            caliber30,
            caliber32,
            producedCaliber10,
            producedCaliber12,
            producedCaliber14,
            producedCaliber16,
            producedCaliber18,
            producedCaliber20,
            producedCaliber22,
            producedCaliber24,
            producedCaliber26,
            producedCaliber28,
            producedCaliber30,
            producedCaliber32,
            totalPallets,
            productionDate: order.productionDate || '',
            fromSalesOrder
          };
        };

        if (cItems.length > 0 || cOutputs.length > 0) {
          conventionalRows.push(mapRow(cItems, cOutputs));
        }
        if (oItems.length > 0 || oOutputs.length > 0) {
          organicRows.push(mapRow(oItems, oOutputs));
        }
      });

      await exportProductionOrdersExcel(conventionalRows, organicRows);
      
      toast({
        title: "Export Successful",
        description: `Production orders exported using ExcelJS template.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Export Failed",
        description: "Could not export production orders.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Status Dropdown Render
  const getStatusDisplay = (status: string, orderId: string) => {
    // Only these 3 are strictly for production to set.
    // If current status is not one of these, we include it but it's disabled.
    const isProductionStatus = PRODUCTION_STATUSES.some(p => p.value === status);
    
    // Fallback styling for non-production statuses
    const currentStyle = isProductionStatus 
      ? PRODUCTION_STATUSES.find(p => p.value === status)?.color 
      : 'bg-muted/30 text-muted-foreground border-muted';

    if (!canUpdate) {
      return (
        <div className="relative">
          <div className={`h-9 border-2 font-black text-[10px] uppercase tracking-wider px-3 rounded-lg flex items-center justify-center shadow-sm ${currentStyle} min-w-[140px] opacity-90`}>
            {status}
          </div>
        </div>
      );
    }

    return (
      <div className="relative">
        <Select
          defaultValue={status}
          onValueChange={(val) => updateStatus(orderId, val)}
          disabled={updatingId === orderId}
        >
          <SelectTrigger className={`h-9 border-2 font-black text-[10px] uppercase tracking-wider px-3 rounded-lg transition-all hover:scale-105 shadow-sm ${currentStyle} min-w-[140px]`}>
            {updatingId === orderId ? (
              <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin"/> Updating...</span>
            ) : (
              <SelectValue placeholder={status} />
            )}
          </SelectTrigger>
          <SelectContent className="rounded-xl shadow-2xl">
            {PRODUCTION_STATUSES.map(opt => (
              <SelectItem key={opt.value} value={opt.value} className={`font-bold text-[10px] uppercase ${opt.color.split(' ')[1]}`}>
                {opt.label}
              </SelectItem>
            ))}
            {!isProductionStatus && (
              <SelectItem value={status} disabled className="opacity-50 font-bold text-[10px] uppercase italic">
                {status} (View Mode)
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="w-full p-8 space-y-10 animate-in fade-in duration-700 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <span>Profile</span>
            <span className="opacity-40">/</span>
            <span className="text-primary uppercase">Production Orders</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Production Orders</h1>
          <p className="text-muted-foreground font-medium">Manage and fulfill sales orders in the production queue.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 border-primary/20 text-primary hover:bg-primary/5 h-12 px-6 rounded-xl font-bold transition-all"
            onClick={handleExportExcel}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> EXPORTING...
              </>
            ) : (
              <>
                <FileSpreadsheet size={18} /> EXPORT
              </>
            )}
          </Button>
          <Button
            className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-12 px-8 rounded-xl font-bold uppercase tracking-widest transition-all"
            onClick={handleExportExcel}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> EXPORTING...
              </>
            ) : (
              <>
                <Download size={18} /> DOWNLOAD
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden ring-1 ring-primary/5">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4 border-b border-primary/5">
          <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest opacity-80">
            <Filter size={14} className="text-primary" /> Filter Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-6">
            <div className="space-y-1.5 w-full sm:w-[200px]">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Start ETA Week</Label>
              <Input
                type="number"
                placeholder="Wk No."
                className="h-11 rounded-xl bg-muted/30 border-none font-bold"
                value={filterETAStart}
                onChange={e => setFilterETAStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-[200px]">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">End ETA Week</Label>
              <Input
                type="number"
                placeholder="Wk No."
                className="h-11 rounded-xl bg-muted/30 border-none font-bold"
                value={filterETAEnd}
                onChange={e => setFilterETAEnd(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2 flex-grow sm:flex-grow-0">
              <Button className="h-11 bg-primary hover:bg-primary/90 rounded-xl font-black uppercase tracking-widest gap-2 px-8">
                <Search size={16} /> Filter
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-xl border-primary/10 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                onClick={() => {
                  setFilterETAStart('');
                  setFilterETAEnd('');
                  setActiveTab('all');
                }}
              >
                <X size={18} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs & Table */}
      <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
        <TabsList className="bg-primary/5 h-auto p-1.5 flex-wrap justify-start gap-2 mb-8 rounded-2xl border border-primary/5">
          {STATUS_TABS.map(tab => (
            <TabsTrigger 
              key={tab.value} 
              value={tab.value} 
              className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 rounded-xl px-6 py-2.5 font-black uppercase text-[10px] tracking-widest transition-all"
            >
              {tab.label} {statusCounts[tab.value] !== undefined && `(${statusCounts[tab.value]})`}
            </TabsTrigger>
          ))}
        </TabsList>

        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden w-full">
          <div style={{ overflowX: 'auto' }}>
            <div className="min-w-[1400px]">
              <Table>
                <TableHeader className="bg-primary/5">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="w-[60px] py-6 pl-8"></TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 min-w-[120px]">PO Number</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 min-w-[150px]">Customer</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 min-w-[140px]">Order Progress</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 min-w-[140px]">Production Date</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 text-center min-w-[100px]">Eta Week</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 min-w-[200px]">Shipping Address</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 min-w-[200px]">Note / Remark</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 text-center min-w-[150px]">Order Status</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 min-w-[150px]">Production Location</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 min-w-[120px]">Created By</TableHead>
                    <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 pr-8 min-w-[120px]">Updated By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-none">
                        <TableCell colSpan={10} className="py-6 px-6"><Skeleton className="h-12 w-full rounded-xl" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredOrders.length === 0 ? (
                    <TableRow className="border-none">
                      <TableCell colSpan={10} className="h-64 text-center text-muted-foreground font-medium italic opacity-60">
                        <div className="flex flex-col items-center gap-3">
                          <ShoppingCart className="h-12 w-12 opacity-10" />
                          <p>No production orders found.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => {
                      return (
                        <TableRow 
                          key={order.id} 
                          className="hover:bg-primary/[0.03] transition-all border-b border-muted/20"
                        >
                          <TableCell className="pl-8"></TableCell>
                          <TableCell>
                            <Link href={`/production/orders/${order.id}`}>
                              <div className="bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-lg px-3 py-2 inline-block cursor-pointer transition-colors">
                                <span className="font-black text-[11px] text-primary tracking-[0.1em] uppercase">{order.poNumber || 'N/A'}</span>
                              </div>
                            </Link>
                          </TableCell>
                          
                          <TableCell>
                            <span className="font-black text-sm text-primary uppercase tracking-tight">{order.customerName || 'Unknown'}</span>
                          </TableCell>

                          <TableCell className="w-[140px]">
                            {(() => {
                              const totalPalletsGoal = order.items?.reduce((sum: number, item: any) => sum + (Number(item.pallets) || 0), 0) || 1;
                              const producedPallets = outputs?.filter((o: any) => o.orderPoId === order.id).length || 0;
                              const progressPercent = Math.min(Math.round((producedPallets / totalPalletsGoal) * 100), 100);
                              
                              return (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between text-[10px] font-black text-primary/60">
                                    <span>{progressPercent}% ({producedPallets}/{totalPalletsGoal})</span>
                                  </div>
                                  <div className="h-2 w-full bg-primary/5 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-1000" 
                                      style={{ width: `${progressPercent}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })()}
                          </TableCell>

                          <TableCell>
                            <Input 
                              key={`date-${order.id}-${order.productionDate || 'empty'}`}
                              type="date"
                              disabled={!canUpdate}
                              className={`h-10 w-[140px] text-xs font-bold border-transparent bg-muted/30 ${canUpdate ? 'hover:bg-muted/50 focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer' : 'opacity-70 cursor-not-allowed'} rounded-xl transition-all`}
                              defaultValue={order.productionDate || ''}
                              onBlur={(e) => {
                                if (canUpdate && e.target.value !== (order.productionDate || '')) {
                                  updateProductionDate(order.id, e.target.value);
                                }
                              }}
                            />
                          </TableCell>

                          <TableCell className="text-center">
                            <div className="bg-sky-50 border-2 border-sky-100 rounded-2xl px-3 py-1.5 inline-flex items-center gap-1.5">
                              <Clock size={12} className="text-sky-600" />
                              <span className="font-black text-[11px] text-sky-700 uppercase">WK {order.etaWeek || '-'}</span>
                            </div>
                          </TableCell>

                          <TableCell className="max-w-[200px]">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight line-clamp-2">
                              {order.shippingAddress?.street ? `${order.shippingAddress.street}, ${order.shippingAddress.city}` : 'No address'}
                            </p>
                          </TableCell>

                          <TableCell className="max-w-[200px]">
                            <p className="text-[10px] text-muted-foreground font-medium italic line-clamp-2">
                              {order.note || order.remarks || '-'}
                            </p>
                          </TableCell>

                          <TableCell className="text-center px-4">
                            {getStatusDisplay(order.status || 'Pending', order.id)}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Layers size={14} className="text-primary/40" />
                              <span className="font-black text-[10px] text-primary/80 uppercase tracking-tight">{order.productionLocationName || 'NOT ASSIGNED'}</span>
                            </div>
                          </TableCell>

                          <TableCell>
                            <span className="font-bold text-[10px] uppercase text-muted-foreground">{order.createdBy || '-'}</span>
                          </TableCell>

                          <TableCell className="pr-8">
                            <span className="font-bold text-[10px] uppercase text-muted-foreground">{order.updatedBy || '-'}</span>
                          </TableCell>

                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      </Tabs>
    </div>
  );
}
