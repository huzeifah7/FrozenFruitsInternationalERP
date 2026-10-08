'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCustomerAuth } from '@/components/customer-auth-provider';
import { useSeason } from '@/contexts/SeasonContext';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, where, orderBy } from '@/firebase/firestore-override';
import { Search, Truck, FileDown, Eye, ChevronLeft, ChevronRight, Activity, Calendar, Anchor, Filter, Columns, Menu, Maximize, ArrowUpDown, MoreVertical, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function CustomerLoadingsPage() {
  const router = useRouter();
  const { customer, loading: authLoading } = useCustomerAuth();
  const { currentSeason } = useSeason();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isExporting, setIsExporting] = useState(false);

  const db = useFirestore();

  const loadingsQuery = useMemoFirebase(() => {
    if (!db || !customer?.id) return null;
    return query(collection(db, 'supply_chain_loadings'));
  }, [db, customer?.id]);

  const ordersQuery = useMemoFirebase(() => {
    if (!db || !customer?.id) return null;
    return query(collection(db, 'orders'));
  }, [db, customer?.id]);

  const { data: loadingsList, isLoading: loadingsLoading } = useCollection<any>(loadingsQuery);
  const { data: ordersList, isLoading: ordersLoading } = useCollection<any>(ordersQuery);

  const isLoading = authLoading || loadingsLoading || ordersLoading;

  const filteredLoadings = useMemo(() => {
    if (!loadingsList) return [];
    
    // Get all order IDs for this customer
    const customerOrderIds = new Set(
      (ordersList || [])
        .filter(o => 
          o.customerId === customer?.id || 
          o.customer_id === customer?.id ||
          (o.customerName && customer?.companyName && o.customerName.trim().toLowerCase() === customer.companyName.trim().toLowerCase())
        )
        .map(o => o.id)
    );

    // Season filtering
    const seasonId = currentSeason?.id;
    let list = loadingsList.filter(l => {
      const matchCustomer = 
        l.customerId === customer?.id || 
        l.customer_id === customer?.id ||
        (l.orderId && customerOrderIds.has(l.orderId)) ||
        (l.customerName && customer?.companyName && l.customerName.trim().toLowerCase() === customer.companyName.trim().toLowerCase());
      
      const matchSeason = seasonId 
        ? (!l.season_id && !l.seasonId ? true : (l.season_id === seasonId || l.seasonId === seasonId)) 
        : true;

      return matchCustomer && matchSeason;
    });

    // Search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(l => 
        (l.loading_number || l.dum || l.invoice_number || l.poNumber || l.po_number || '').toLowerCase().includes(term) ||
        (l.truck_number || l.container_number || l.numeroChauffeur || l.transitSupplierName || '').toLowerCase().includes(term) ||
        (l.locationName || l.port_of_loading || '').toLowerCase().includes(term) ||
        (l.port_of_discharge || '').toLowerCase().includes(term) ||
        (l.loadingStatus || l.status || '').toLowerCase().includes(term)
      );
    }

    list.sort((a, b) => {
      const aTime = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.loading_date ? new Date(a.loading_date).getTime() : 0);
      const bTime = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.loading_date ? new Date(b.loading_date).getTime() : 0);
      return bTime - aTime;
    });

    return list;
  }, [loadingsList, ordersList, currentSeason, searchTerm, customer?.id, customer?.companyName]);

  const totalPages = Math.ceil(filteredLoadings.length / itemsPerPage) || 1;
  const paginatedLoadings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLoadings.slice(start, start + itemsPerPage);
  }, [filteredLoadings, currentPage, itemsPerPage]);

  const exportToExcel = async () => {
    if (filteredLoadings.length === 0) return;
    setIsExporting(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Loadings');

      sheet.columns = [
        { header: 'Loading Number', key: 'loadingNum', width: 20 },
        { header: 'PO Number', key: 'poNum', width: 20 },
        { header: 'Loading Date', key: 'date', width: 15 },
        { header: 'Container/Truck', key: 'transport', width: 20 },
        { header: 'Port of Loading', key: 'pol', width: 25 },
        { header: 'Port of Discharge', key: 'pod', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Season', key: 'season', width: 15 }
      ];

      filteredLoadings.forEach((l) => {
        sheet.addRow({
          loadingNum: l.loading_number || l.id,
          poNum: l.po_number || 'N/A',
          date: l.loading_date || 'N/A',
          transport: l.container_number || l.truck_number || 'N/A',
          pol: l.port_of_loading || 'N/A',
          pod: l.port_of_discharge || 'N/A',
          status: l.status || 'Pending',
          season: l.season_id || ''
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Loadings_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: 'Export Successful' });
    } catch (e) {
      Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'error', title: 'Export Failed' });
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'in transit':
      case 'in-transit': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'shipped': return 'bg-sky-500/10 text-sky-600 border-sky-200';
      case 'loading': return 'bg-amber-500/10 text-amber-600 border-amber-200';
      case 'draft': return 'bg-rose-500/10 text-rose-600 border-rose-200';
      default: return 'bg-muted text-muted-foreground';
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
    <div className="p-2 md:p-4 space-y-4 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-0.5 mb-4">
        <h1 className="text-2xl font-bold text-[#709506]">Supply Chain Loadings</h1>
        <div className="text-sm text-slate-500">
          Profile / <span className="text-slate-400">Supply Chain Loading</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-md shadow-sm border border-slate-200">
        <div className="flex justify-between items-center p-3 border-b border-slate-100 text-slate-400 gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search loadings..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8"><Filter size={16} /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Columns size={16} /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Menu size={16} /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Maximize size={16} /></Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 hover:bg-transparent">
              <TableHead className="font-semibold text-slate-800 text-xs h-12">
                <div className="flex items-center gap-1">Order <ArrowUpDown size={12} className="text-slate-300"/> <MoreVertical size={12} className="text-slate-300"/></div>
              </TableHead>
              <TableHead className="font-semibold text-slate-800 text-xs h-12">
                <div className="flex items-center gap-1">Location <ArrowUpDown size={12} className="text-slate-300"/> <MoreVertical size={12} className="text-slate-300"/></div>
              </TableHead>
              <TableHead className="font-semibold text-slate-800 text-xs h-12">
                <div className="flex items-center gap-1">Transit Supplier <ArrowUpDown size={12} className="text-slate-300"/> <MoreVertical size={12} className="text-slate-300"/></div>
              </TableHead>
              <TableHead className="font-semibold text-slate-800 text-xs h-12">
                <div className="flex items-center gap-1">Sous Dum <ArrowUpDown size={12} className="text-slate-300"/> <MoreVertical size={12} className="text-slate-300"/></div>
              </TableHead>
              <TableHead className="font-semibold text-slate-800 text-xs h-12">
                <div className="flex items-center gap-1">Temp Tale <ArrowUpDown size={12} className="text-slate-300"/> <MoreVertical size={12} className="text-slate-300"/></div>
              </TableHead>
              <TableHead className="font-semibold text-slate-800 text-xs h-12">
                <div className="flex items-center gap-1">Loading Status <ArrowUpDown size={12} className="text-slate-300"/> <MoreVertical size={12} className="text-slate-300"/></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLoadings.length > 0 ? paginatedLoadings.map((loading) => (
              <TableRow 
                key={loading.id} 
                className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer"
                onClick={() => router.push(`/customer-portal/loadings/${loading.id}`)}
              >
                <TableCell className="text-[#709506] font-medium text-xs py-4 hover:underline">
                  {loading.poNumber || loading.po_number || loading.dum || 'N/A'}
                </TableCell>
                <TableCell className="text-slate-600 text-xs py-4">
                  {loading.locationName || loading.location || loading.port_of_loading || '-'}
                </TableCell>
                <TableCell className="text-slate-600 text-xs py-4">
                  {loading.transitSupplierName || loading.supplierName || loading.transporter || '-'}
                </TableCell>
                <TableCell className="text-slate-600 text-xs py-4">
                  {loading.sousDum || loading.sous_dum || '1'}
                </TableCell>
                <TableCell className="text-slate-600 text-xs py-4 max-w-[280px]">
                  {loading.tempTale || loading.temp_tale ? (
                    <a 
                      href={loading.tempTale || loading.temp_tale} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-slate-600 hover:underline truncate block"
                      title={loading.tempTale || loading.temp_tale}
                    >
                      {loading.tempTale || loading.temp_tale}
                    </a>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="text-slate-600 text-xs py-4 font-medium">
                  {loading.loadingStatus || loading.status || 'In Transit'}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                  No loadings found for the selected season.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        
        <div className="p-3 flex items-center justify-end text-xs text-slate-500 border-t border-slate-100 gap-4">
          <span className="flex items-center gap-1">Rows per page 10 <ChevronDown size={14} /></span>
          <span>1-{paginatedLoadings.length} of {filteredLoadings.length}</span>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6 p-0" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} className={currentPage === 1 ? "text-slate-300" : "text-slate-600"} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-6 w-6 p-0"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={16} className={currentPage === totalPages ? "text-slate-300" : "text-slate-600"} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
