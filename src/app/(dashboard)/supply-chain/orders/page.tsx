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
  Layers,
  Lock
} from 'lucide-react';
import Link from 'next/link';
import { useAuthContext } from '@/components/auth-provider';
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

/** Orders with these statuses can have their status changed in Supply Chain view */
const EDITABLE_STATUSES = ['Produced', 'Shipped', 'Delivered'];
const EDITABLE_STATUSES_UPPER = EDITABLE_STATUSES.map(s => s.toUpperCase());

export default function OrdersListingPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { role: userRole } = useAuthContext();
  const { canList, canAdd, canUpdate, canDelete } = usePermissions('supplyChain.orders');

  const isSales = userRole === 'sales';
  const isProduction = userRole === 'production';
  const canEdit = canUpdate;

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

    const getDateMs = (order: any): number => {
      const raw = order.createdAt || order.date;
      if (!raw) return 0;
      if (typeof raw?.toDate === 'function') return raw.toDate().getTime();
      if (raw?.seconds !== undefined) return raw.seconds * 1000;
      const parsed = new Date(raw).getTime();
      return isNaN(parsed) ? 0 : parsed;
    };

    return orders
      .filter(order => {
        const matchesTab = activeTab === 'all' || order.status?.toLowerCase() === activeTab;
        const matchesCustomer = filterCustomer === 'all' || order.customerId === filterCustomer;
        const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
        const eta = Number(order.etaWeek);
        const start = filterETAStart ? Number(filterETAStart) : -Infinity;
        const end = filterETAEnd ? Number(filterETAEnd) : Infinity;
        const matchesETA = eta >= start && eta <= end;
        const matchesLocation = filterLocation === 'all' || order.productionLocationId === filterLocation;
        return matchesTab && matchesCustomer && matchesStatus && matchesETA && matchesLocation;
      })
      .sort((a, b) => getDateMs(b) - getDateMs(a));
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
    const currUpper = currentStatus?.toUpperCase();
    const newUpper = newStatus?.toUpperCase();

    if (!EDITABLE_STATUSES_UPPER.includes(currUpper)) {
      toast({ 
        title: "Action Blocked", 
        description: "Only Produced, Shipped, or Delivered orders can be updated here.",
        variant: "destructive"
      });
      return;
    }

    if (!EDITABLE_STATUSES_UPPER.includes(newUpper)) {
      toast({ 
        title: "Action Blocked", 
        description: "Target status must be one of: Produced, Shipped, or Delivered.",
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
        description: `Order status changed to ${newStatus}.` 
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
    const isEditable = canUpdate && EDITABLE_STATUSES_UPPER.includes(status?.toUpperCase());

    if (!isEditable) {
      return (
        <span 
          title={!canUpdate ? "You do not have permission to update orders." : "This order's status can only be changed from the Sales module."}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${option.bg} ${option.text} ${option.border} border cursor-default`}
        >
          <Lock size={9} className="opacity-50" />
          {status}
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
          {STATUS_OPTIONS.filter(opt => EDITABLE_STATUSES_UPPER.includes(opt.value.toUpperCase())).map(opt => (
            <SelectItem key={opt.value} value={opt.value} className={`font-bold text-[10px] uppercase ${opt.text}`}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  /** True when the order's status allows editing via this Supply Chain view */
  const isOrderEditable = (status: string) => canUpdate && EDITABLE_STATUSES_UPPER.includes(status?.toUpperCase());

  if (!canList && !isLoading) {
    return <div className="p-8 text-center text-slate-500 font-bold">You do not have permission to view this module.</div>;
  }

  return (
    <div className="w-full p-8 space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <span>Profile</span>
            <span className="opacity-40">/</span>
            <span className="text-primary uppercase">Supply Chain Orders</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase">Supply Chain Orders</h1>
          <p className="text-muted-foreground font-medium">Manage customer purchase orders, production tracking, and fulfillment cycles.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2 border-primary/20 text-primary hover:bg-primary/5 h-12 px-6 rounded-xl font-bold transition-all">
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
                                {/* Edit action only for editable-status orders */}
                                {(canEdit || isProduction) && isOrderEditable(order.status) && (
                                  <DropdownMenuItem className="gap-3 cursor-pointer font-black text-[11px] uppercase tracking-wider py-3 rounded-xl hover:bg-primary/5" onClick={() => router.push(`/sales/orders/${order.id}/edit`)}>
                                    <Edit2 size={16} className="text-primary" /> {isProduction ? 'Update Status' : 'Modify Data'}
                                  </DropdownMenuItem>
                                )}
                                {/* View is always available */}
                                {!(canEdit || isProduction) || !isOrderEditable(order.status) ? (
                                  <DropdownMenuItem className="gap-3 cursor-pointer font-black text-[11px] uppercase tracking-wider py-3 rounded-xl hover:bg-primary/5" onClick={() => router.push(`/sales/orders/view/${order.id}`)}>
                                    <CheckCircle2 size={16} className="text-muted-foreground" /> View Order
                                  </DropdownMenuItem>
                                ) : null}
                                {canDelete && isOrderEditable(order.status) && (
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
