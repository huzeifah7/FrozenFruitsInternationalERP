'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase,
  useUser,
  errorEmitter,
  FirestorePermissionError
} from '@/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  deleteDoc, 
  doc,
  updateDoc 
} from '@/firebase/firestore-override';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Search, 
  Filter, 
  X, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Download, 
  ShoppingCart, 
  Calendar,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers
} from 'lucide-react';
import Link from 'next/link';
import { useAuthContext } from '@/components/auth-provider';
import { exportSalesOrdersExcel } from '@/lib/export-orders-excel';
import { usePermissions } from '@/hooks/use-permissions';

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

export default function OrdersListingPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { role: userRole } = useAuthContext();
  const { canAdd, canUpdate, canDelete } = usePermissions('sales.orders');

  const isSales = userRole === 'sales';
  const isProduction = userRole === 'production';

  const [activeTab, setActiveTab] = useState('all');
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterETAStart, setFilterETAStart] = useState('');
  const [filterETAEnd, setFilterETAEnd] = useState('');
  const [filterLocation, setFilterLocation] = useState('all');

  // Data Fetching
  const ordersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'orders'));
  }, [db, user]);

  const customersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'customers');
  }, [db, user]);

  const processingLinesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'processing_lines');
  }, [db, user]);

  const outputQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'production_output');
  }, [db, user]);

  const { data: orders, isLoading } = useCollection(ordersQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: processingLines } = useCollection(processingLinesQuery);
  const { data: outputs } = useCollection(outputQuery);

  // Status Counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders?.length || 0 };
    STATUS_OPTIONS.forEach(opt => {
      counts[opt.value.toLowerCase()] = orders?.filter(o => o.status === opt.value).length || 0;
    });
    return counts;
  }, [orders]);

  // Filtering & Sorting Logic (Newest to Oldest)
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders
      .filter(order => {
        const matchesTab = activeTab === 'all' || order.status?.toLowerCase() === activeTab;
        const matchesCustomer = filterCustomer === 'all' || order.customerId === filterCustomer;
        const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
        
        // ETA Week filter (assuming it's a number or can be compared)
        const eta = Number(order.etaWeek);
        const start = filterETAStart ? Number(filterETAStart) : -Infinity;
        const end = filterETAEnd ? Number(filterETAEnd) : Infinity;
        const matchesETA = eta >= start && eta <= end;
        const matchesLocation = filterLocation === 'all' || order.productionLocationId === filterLocation;

        return matchesTab && matchesCustomer && matchesStatus && matchesETA && matchesLocation;
      })
      .sort((a, b) => {
        const getTime = (o: any) => {
          if (o.createdAt?.toDate) return o.createdAt.toDate().getTime();
          if (o.createdAt?.seconds) return o.createdAt.seconds * 1000;
          if (typeof o.createdAt === 'string') return new Date(o.createdAt).getTime();
          if (o.orderDate) return new Date(o.orderDate).getTime();
          return 0;
        };
        const timeA = getTime(a);
        const timeB = getTime(b);
        if (timeA && timeB && timeA !== timeB) return timeB - timeA;
        return (b.poNumber || b.id || '').localeCompare(a.poNumber || a.id || '');
      });
  }, [orders, activeTab, filterCustomer, filterStatus, filterETAStart, filterETAEnd, filterLocation]);

  const handleDelete = async (id: string) => {
    if (!db || !confirm('Are you sure you want to delete this order?')) return;
    const docRef = doc(db, 'orders', id);
    try {
      await deleteDoc(docRef).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete'
        }));
        throw err;
      });
      toast({ title: "Order Removed", description: "The purchase order record has been archived." });
    } catch (error) {
      // Handled globally
    }
  };

  const updateOrderStatus = async (id: string, newStatus: string, currentStatus: string) => {
    const allowedSalesStatuses = ["PENDING", "CONFIRMED", "CANCELED", "CANCELLED"];

    if (!allowedSalesStatuses.includes(newStatus?.toUpperCase())) {
      toast({ 
        title: "Action Blocked", 
        description: "Sales Orders status can only be changed to Pending, Confirmed, or Cancelled.",
        variant: "destructive"
      });
      return;
    }

    if (!db) return;
    const docRef = doc(db, 'orders', id);
    try {
      await updateDoc(docRef, { 
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      toast({ 
        title: "Status Updated", 
        description: "Order status updated successfully." 
      });
    } catch (error) {
      toast({ 
        title: "Update Failed", 
        description: "Could not sync status change to database.",
        variant: "destructive"
      });
    }
  };

  const getStatusDisplay = (status: string, orderId: string) => {
    const option = STATUS_OPTIONS.find(opt => opt.value.toUpperCase() === status?.toUpperCase()) || STATUS_OPTIONS[0];
    const allowedDropdownStatuses = ["PENDING", "CONFIRMED", "CANCELED", "CANCELLED"];

    if (!canUpdate || !allowedDropdownStatuses.includes(status?.toUpperCase())) {
      return (
        <span className={`inline-flex items-center justify-center h-8 border-2 font-black text-[10px] uppercase tracking-wider px-3 rounded-lg shadow-sm ${option.bg} ${option.text} ${option.border}`}>
          {option.label}
        </span>
      );
    }

    return (
      <Select 
        defaultValue={status} 
        onValueChange={(val) => updateOrderStatus(orderId, val, status)}
      >
        <SelectTrigger className={`h-8 border-2 font-black text-[10px] uppercase tracking-wider px-3 rounded-lg transition-all hover:scale-105 shadow-sm ${option.bg} ${option.text} ${option.border}`}>
          <SelectValue placeholder={status} />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-primary/10 shadow-2xl z-[9999]">
          {STATUS_OPTIONS.filter(opt => allowedDropdownStatuses.includes(opt.value.toUpperCase())).map(opt => (
            <SelectItem key={opt.value} value={opt.value} className={`font-bold text-[10px] uppercase ${opt.text}`}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const handleExportExcel = async () => {
    if (!filteredOrders || filteredOrders.length === 0) return;
    try {
      const exportData = filteredOrders.map(order => {
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

        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
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
        }

        const totalPallets = caliber10 + caliber12 + caliber14 + caliber16 + caliber18 + caliber20 + caliber22 + caliber24 + caliber26 + caliber28 + caliber30 + caliber32;

        return {
          poNumber: order.poNumber || '',
          status: order.status || order.orderStatus || 'Pending',
          customerName: order.customerName || '',
          etaWeek: order.etaWeek || '',
          productionDate: order.plannedProductionDate || order.productionDate || '',
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
          totalPallets
        };
      });

      // Filename logic
      const customerFilterName = filterCustomer === 'all' ? 'All' : (customers?.find(c => c.id === filterCustomer)?.companyName || filterCustomer);
      const statusFilterName = filterStatus === 'all' ? 'All' : filterStatus;
      
      let fileName = 'Orders Listing';
      const parts = [];
      
      if (filterCustomer !== 'all') {
        parts.push(customerFilterName);
      }
      
      if (filterStatus !== 'all') {
        parts.push(statusFilterName);
      } else if (activeTab !== 'all') {
        const activeTabOption = STATUS_OPTIONS.find(opt => opt.value.toLowerCase() === activeTab);
        parts.push(activeTabOption ? activeTabOption.value : activeTab);
      }
      
      if (filterETAStart && filterETAEnd) {
        parts.push(`ETA ${filterETAStart}-${filterETAEnd}`);
      } else if (filterETAStart) {
        parts.push(`ETA ${filterETAStart}-Start`);
      } else if (filterETAEnd) {
        parts.push(`ETA-End-${filterETAEnd}`);
      }
      
      if (parts.length > 0) {
        fileName += ` - ${parts.join(' - ')}`;
      }
      
      fileName = fileName.replace(/[<>:"/\\|?*]+/g, '').trim() + '.xlsx';

      await exportSalesOrdersExcel(exportData, fileName);

      toast({
        title: 'Export Successful',
        description: 'Sales orders exported successfully.'
      });
    } catch (err) {
      console.error('Export Error:', err);
      toast({ title: 'Export Failed', description: 'Failed to generate Excel file.', variant: 'destructive' });
    }
  };

  return (
    <div className="w-full p-8 space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <span>Profile</span>
            <span className="opacity-40">/</span>
            <span className="text-primary uppercase">Orders</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Sales Orders</h1>
          <p className="text-muted-foreground font-medium">Manage customer purchase orders, production tracking, and fulfillment cycles.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleExportExcel} variant="outline" className="gap-2 border-primary/20 text-primary hover:bg-primary/5 h-12 px-6 rounded-xl font-bold transition-all">
            <Download size={18} /> EXPORT ORDERS
          </Button>
          {canAdd && (
            <Button asChild className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-12 px-8 rounded-xl font-bold uppercase tracking-widest transition-all hover:scale-[1.02]">
              <Link href="/sales/orders/add">
                <Plus size={18} /> ADD ORDER
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden ring-1 ring-primary/5">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4 border-b border-primary/5">
          <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest opacity-80">
            <Filter size={14} className="text-primary" /> Filter Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Customer</Label>
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-medium">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Order Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-medium">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {STATUS_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Production Loc.</Label>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-medium text-xs font-bold uppercase">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="italic opacity-50">All Locations</SelectItem>
                  {processingLines?.map(l => (
                    <SelectItem key={l.id} value={l.id} className="font-bold text-xs uppercase text-primary">
                      {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Start ETA Week</Label>
              <Input 
                type="number" 
                placeholder="Wk No." 
                className="h-11 rounded-xl bg-muted/30 border-none font-medium"
                value={filterETAStart}
                onChange={e => setFilterETAStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">End ETA Week</Label>
              <Input 
                type="number" 
                placeholder="Wk No." 
                className="h-11 rounded-xl bg-muted/30 border-none font-medium"
                value={filterETAEnd}
                onChange={e => setFilterETAEnd(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button className="flex-1 h-11 bg-primary hover:bg-primary/90 rounded-xl font-bold uppercase tracking-widest gap-2">
                <Search size={16} /> Filter
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-11 w-11 rounded-xl border-primary/10"
                onClick={() => {
                  setFilterCustomer('all');
                  setFilterStatus('all');
                  setFilterLocation('all');
                  setFilterETAStart('');
                  setFilterETAEnd('');
                }}
              >
                <X size={18} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs & Table */}
      <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="bg-primary/5 h-auto p-1.5 flex-wrap justify-start gap-2 mb-8 rounded-2xl border border-primary/5">
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 rounded-xl px-6 py-2.5 font-black uppercase text-[10px] tracking-widest transition-all">
            All Units ({statusCounts.all})
          </TabsTrigger>
          {STATUS_OPTIONS.map(opt => (
            <TabsTrigger key={opt.value} value={opt.value.toLowerCase()} className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 rounded-xl px-6 py-2.5 font-black uppercase text-[10px] tracking-widest transition-all">
              {opt.label} ({statusCounts[opt.value.toLowerCase()]})
            </TabsTrigger>
          ))}
        </TabsList>

        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden w-full">
          <div style={{ overflowX: 'auto' }}>
            <div className="min-w-[1200px]">
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
                        <TableCell colSpan={9} className="py-6 px-6"><Skeleton className="h-10 w-full rounded-xl" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredOrders.length === 0 ? (
                    <TableRow className="border-none">
                      <TableCell colSpan={9} className="h-64 text-center text-muted-foreground font-medium italic opacity-60">
                        <div className="flex flex-col items-center gap-3">
                          <ShoppingCart className="h-12 w-12 opacity-10" />
                          <p>No order records found matching the current criteria.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => {
                      const statusOpt = STATUS_OPTIONS.find(o => o.value === order.status) || STATUS_OPTIONS[0];
                      return (
                        <TableRow 
                          key={order.id} 
                          className="hover:bg-primary/[0.03] transition-all border-b border-muted/20 group relative"
                        >
                          <TableCell className="pl-8 relative">
                            {/* Left Accent Color */}
                            <div className={`absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full transition-all ${statusOpt.bg.replace('bg-', 'bg-').replace('-50', '-500')} opacity-0 group-hover:opacity-100`} />
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-2xl transition-all">
                                  <MoreVertical size={18} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-56 p-2 rounded-2xl shadow-2xl border-primary/10">
                                {(canUpdate || isProduction) && (
                                  <DropdownMenuItem className="gap-3 cursor-pointer font-black text-[11px] uppercase tracking-wider py-3 rounded-xl hover:bg-primary/5" onClick={() => router.push(`/sales/orders/${order.id}/edit`)}>
                                    <Edit2 size={16} className="text-primary" /> {isProduction ? 'Update Status' : 'Modify Data'}
                                  </DropdownMenuItem>
                                )}
                                {canDelete && (
                                  <DropdownMenuItem className="gap-3 text-rose-500 cursor-pointer font-black text-[11px] uppercase tracking-wider py-3 rounded-xl hover:bg-rose-50" onClick={() => handleDelete(order.id)}>
                                    <Trash2 size={16} /> Archive Order
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell>
                            <Link href={`/sales/orders/view/${order.id}`}>
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
                            <div className="font-black text-[11px] text-primary/80 bg-muted/30 px-3 py-2 rounded-xl inline-block">
                              {order.productionDate || 'Not Scheduled'}
                            </div>
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
                            {getStatusDisplay(order.status, order.id)}
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
