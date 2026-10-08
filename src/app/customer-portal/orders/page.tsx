'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCustomerAuth } from '@/components/customer-auth-provider';
import { useSeason } from '@/contexts/SeasonContext';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, where, orderBy } from '@/firebase/firestore-override';
import { ShoppingCart, Search, FileDown, Eye, ArrowUpDown, ChevronLeft, ChevronRight, Calendar, Truck, CheckCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import Swal from 'sweetalert2';

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

export default function CustomerOrdersPage() {
  const { customer, loading: authLoading } = useCustomerAuth();
  const { currentSeason } = useSeason();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isExporting, setIsExporting] = useState(false);

  const db = useFirestore();

  const ordersQuery = useMemoFirebase(() => {
    if (!db || !customer?.id) return null;
    return query(collection(db, 'orders'));
  }, [db, customer?.id]);

  const { data: ordersList, isLoading, error } = useCollection<any>(ordersQuery);

  const filteredOrders = useMemo(() => {
    if (!ordersList) return [];
    
    // Filter by customer and season
    const seasonId = currentSeason?.id;

    let list = ordersList.filter(o => {
      const matchCustomer = o.customerId === customer?.id || o.customer_id === customer?.id;
      // customer is already filtered by the DB query, but we can leave the season filter or remove it.
      // Usually season_id is also injected by firestore-override, so we don't strictly need local filtering,
      // but let's keep it safe.
      const matchSeason = seasonId ? (o.seasonId === seasonId || o.season_id === seasonId) : true;
      return matchCustomer && matchSeason;
    });

    // Sort by createdAt descending
    list.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    console.log('Filtered Orders Count: ', list.length);

    // Status Filter
    if (statusFilter !== 'all') {
      list = list.filter(o => (o.status || '').toLowerCase() === statusFilter.toLowerCase());
    }

    // Search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(o => 
        (o.poNumber || '').toLowerCase().includes(term) ||
        (o.remarks || '').toLowerCase().includes(term) ||
        (o.shippingAddress || '').toLowerCase().includes(term)
      );
    }

    // Sorting
    list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'createdAt') {
        const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
        const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
        return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
      }

      if (sortField === 'etaWeek') {
        aVal = Number(aVal || 0);
        bVal = Number(bVal || 0);
      }

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [ordersList, currentSeason, searchTerm, statusFilter, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getStatusDisplay = (status: string) => {
    const option = STATUS_OPTIONS.find(opt => opt.value.toUpperCase() === status?.toUpperCase()) || STATUS_OPTIONS[0];
    return (
      <span className={`inline-flex items-center justify-center h-7 border-2 font-black text-[10px] uppercase tracking-wider px-2 rounded-md shadow-sm ${option.bg} ${option.text} ${option.border}`}>
        {option.label}
      </span>
    );
  };

  const exportToExcel = async () => {
    if (filteredOrders.length === 0) return;
    setIsExporting(true);
    try {
      const { exportSalesOrdersExcel } = await import('@/lib/export-orders-excel');

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
            const cal = String(item.caliber || item.calibre || '').replace(/[^0-9]/g, '');
            const pallets = Number(item.pallets || item.boxes || item.quantity || 0) || 0;
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
          poNumber: order.poNumber || order.po_number || '',
          status: (order.status || 'Pending').toUpperCase(),
          customerName: customer?.companyName || order.customerName || '',
          etaWeek: order.etaWeek ? String(order.etaWeek) : '',
          productionDate: order.plannedProductionDate || order.productionDate || '',
          productionLocationName: order.productionLocationName || order.locationName || '',
          note: order.remarks || order.description || order.note || '',
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

      const custName = (customer?.companyName || 'Customer').replace(/[^a-z0-9_]/gi, '_');
      await exportSalesOrdersExcel(exportData, `Orders_${custName}_${new Date().toISOString().split('T')[0]}.xlsx`);

      Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: 'Export Successful' });
    } catch (e) {
      console.error('Excel Export Error:', e);
      Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'error', title: 'Export Failed' });
    } finally {
      setIsExporting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <span>Customer Portal</span>
            <span className="opacity-40">/</span>
            <span className="text-primary uppercase">My Orders</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase flex items-center gap-3">
            <ShoppingCart className="h-8 w-8" /> Purchase Orders
          </h1>
        </div>
        <Button 
          onClick={exportToExcel} 
          disabled={isExporting}
          className="gap-2 h-10 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shadow-lg"
        >
          <FileDown size={16} /> {isExporting ? 'Exporting...' : 'Export to Excel'}
        </Button>
      </div>





      <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-primary/5 border-b p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary">Orders Registry</CardTitle>
          
          <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search orders..." 
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9 h-10 rounded-xl border-primary/20 bg-white"
              />
            </div>
            
            <Select 
              value={statusFilter} 
              onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}
            >
              <SelectTrigger className="w-full md:w-48 h-10 rounded-xl border-primary/20 bg-white font-bold text-xs uppercase tracking-wider">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="text-xs font-bold uppercase">All Statuses</SelectItem>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value.toLowerCase()} className={`text-xs font-bold uppercase ${opt.text}`}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleSort('poNumber')}>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      PO Number <ArrowUpDown size={12} className="opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead className="px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleSort('createdAt')}>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Creation Date <ArrowUpDown size={12} className="opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead className="px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleSort('etaWeek')}>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      ETA <ArrowUpDown size={12} className="opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead className="px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleSort('shippingMethod')}>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Shipping <ArrowUpDown size={12} className="opacity-50" />
                    </div>
                  </TableHead>
                  <TableHead className="px-6 py-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Destination
                    </div>
                  </TableHead>
                  <TableHead className="px-6 py-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleSort('status')}>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Status <ArrowUpDown size={12} className="opacity-50" />
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrders.length > 0 ? paginatedOrders.map((order) => (
                  <TableRow key={order.id} className="hover:bg-primary/[0.02]">
                    <TableCell className="px-6 py-4">
                      <Link href={`/customer-portal/orders/${order.id}`}>
                        <span className="font-bold text-primary hover:underline cursor-pointer transition-all">{order.poNumber || 'N/A'}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <Calendar size={12} />
                        {order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : (order.createdAt || order.date || 'N/A')}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge variant="outline" className="bg-white border-primary/20 text-primary font-bold text-[10px] px-2 py-0.5">
                        WK {order.etaWeek || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase">
                        <Truck size={12} />
                        {order.shippingMethod || 'TBD'}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <span className="text-xs font-medium text-muted-foreground truncate max-w-[150px] inline-block" title={typeof order.shippingAddress === 'object' ? `${order.shippingAddress?.street}, ${order.shippingAddress?.city}` : order.shippingAddress}>
                        {typeof order.shippingAddress === 'object' 
                          ? (order.shippingAddress?.street ? `${order.shippingAddress.street}, ${order.shippingAddress.city}` : 'No address')
                          : (order.shippingAddress || '-')}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {getStatusDisplay(order.status || 'Pending')}
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic text-sm">
                      No orders found for the selected season and filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/5">
              <span className="text-xs font-medium text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="h-8 rounded-lg"
                >
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-xs font-bold px-2">{currentPage} / {totalPages}</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="h-8 rounded-lg"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
