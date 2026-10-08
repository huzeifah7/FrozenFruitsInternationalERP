'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  collection, 
  query, 
  where,
  deleteDoc, 
  doc 
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
  useUser 
} from '@/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown,
  Loader2,
  X,
  Calendar,
  MoreVertical,
  Trash2,
  FileText,
  TrendingUp,
  Weight,
  DollarSign,
  TrendingDown,
  Info,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  Search,
  Edit2
} from 'lucide-react';

export default function DecaySaleGroupByDatePage() {
  const router = useRouter();
  const params = useParams();
  const dateString = params.date as string; // YYYY-MM-DD
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // --- UI States ---
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // --- Sorting & Pagination ---
  const [sortField, setSortField] = useState<string>('invoiceNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // --- Modals ---
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  // --- Fetch Invoices & Payments for this date ---
  const invoicesQuery = useMemoFirebase(() => {
    if (!db || !dateString) return null;
    return query(collection(db, 'decay_loadings'), where('date', '==', dateString));
  }, [db, dateString]);
  const { data: rawInvoices, isLoading: loadingInvoices } = useCollection(invoicesQuery);

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !dateString) return null;
    return query(collection(db, 'decay_payments'), where('date', '==', dateString));
  }, [db, dateString]);
  const { data: rawPayments, isLoading: loadingPayments } = useCollection(paymentsQuery);

  const isLoading = loadingInvoices || loadingPayments;

  // Reset page on search
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Helper: Deterministic Invoice Number if missing
  const getInvoiceNumber = (record: any) => {
    if (record.invoiceNumber) return record.invoiceNumber;
    const dateStr = record.date ? record.date.split('-').reverse().join('') : '00000000';
    const idHash = record.id ? record.id.slice(-8) : '00000000';
    return `PP${dateStr}-${idHash}`;
  };

  // --- Process & Filter Sales ---
  const filteredSales = useMemo(() => {
    if (!rawInvoices) return [];
    let list = rawInvoices.map(invoice => {
      const totalQty = invoice.items?.reduce((sum: number, i: any) => sum + Number(i.netWeight || 0), 0) || 0;
      return {
        ...invoice,
        invoiceNumber: getInvoiceNumber(invoice),
        totalQuantity: totalQty,
      };
    });

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(item => 
        (item.customerName || '').toLowerCase().includes(term) ||
        (item.invoiceNumber || '').toLowerCase().includes(term) ||
        (item.paymentMethod || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [rawInvoices, searchTerm]);

  // --- KPIs Calculations ---
  const kpis = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const totalQuantity = filteredSales.reduce((sum, item) => sum + Number(item.totalQuantity || 0), 0);
    const totalPayments = rawPayments?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0;
    const openAmount = totalSales - totalPayments;

    return {
      totalSales,
      totalQuantity,
      totalPayments,
      openAmount,
    };
  }, [filteredSales, rawPayments]);

  // --- Sort & Paginate ---
  const sortedSales = useMemo(() => {
    const list = [...filteredSales];
    const field = sortField;
    list.sort((a: any, b: any) => {
      let valA = a[field];
      let valB = b[field];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? (Number(valA) > Number(valB) ? 1 : -1) : (Number(valB) > Number(valA) ? 1 : -1);
    });
    return list;
  }, [filteredSales, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedSales.length / itemsPerPage) || 1;
  const paginatedSales = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedSales.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedSales, currentPage]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const renderSortHeader = (label: string, field: string) => {
    const isActive = sortField === field;
    return (
      <TableHead 
        className={cn(
          "py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 cursor-pointer select-none transition-colors hover:text-primary whitespace-nowrap",
          isActive && "text-[#7a9800] font-black"
        )}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1.5">
          {label}
          <ArrowUpDown className={cn("h-3 w-3 transition-opacity", isActive ? "opacity-100 text-[#7a9800]" : "opacity-35")} />
        </div>
      </TableHead>
    );
  };

  const handleDelete = async () => {
    if (!db || !recordToDelete) return;
    try {
      await deleteDoc(doc(db, 'decay_loadings', recordToDelete));
      toast({ title: "Success", description: "Decay sale deleted successfully." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to delete decay sale.", variant: "destructive" });
    } finally {
      setIsDeleteConfirmOpen(false);
      setRecordToDelete(null);
    }
  };

  const densityPaddingClass = {
    compact: 'py-2 px-4 h-12 text-xs',
    normal: 'py-4 px-6 h-16 text-xs',
    tall: 'py-6 px-8 h-20 text-sm'
  }[density];

  return (
    <div className={cn(
      "w-full bg-[#f3f3f3] min-h-screen transition-all duration-300",
      isFullscreen ? "fixed inset-0 z-50 p-6 overflow-y-auto bg-[#f3f3f3]" : "p-6 lg:p-8"
    )}>
      
      {/* Header & Breadcrumbs */}
      <div className="max-w-[1600px] mx-auto mb-8 flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push('/decay/sales')} 
          className="rounded-full h-10 w-10 hover:bg-slate-200"
        >
          <ChevronLeft size={20} className="text-slate-600" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            <span>Profile</span>
            <span className="opacity-40">/</span>
            <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/decay/sales')}>Decay Sales</span>
            <span className="opacity-40">/</span>
            <span className="text-[#7a9800] font-black">Decay Sale Group By Date</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">
            Decay Sale Group By Date
          </h1>
        </div>
      </div>

      {/* KPI stats */}
      <div className="max-w-[1600px] mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Sales */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#7a9800]/5 rounded-bl-full -z-10" />
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Sales</span>
            <div className="text-xl font-black text-[#2e1d52]">{isLoading ? '—' : kpis.totalSales.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-bold">dh</span></div>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-[#7a9800]/10 flex items-center justify-center text-[#7a9800]"><DollarSign size={20} /></div>
        </div>

        {/* Total Quantity */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-slate-100 rounded-bl-full -z-10" />
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Quantity</span>
            <div className="text-xl font-black text-[#2e1d52]">{isLoading ? '—' : kpis.totalQuantity.toLocaleString()} <span className="text-xs text-slate-400 font-bold">KG</span></div>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500"><Weight size={20} /></div>
        </div>

        {/* Total Payments */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-full -z-10" />
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Payments</span>
            <div className="text-xl font-black text-emerald-600">{isLoading ? '—' : kpis.totalPayments.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs text-emerald-400 font-bold">dh</span></div>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500"><TrendingUp size={20} /></div>
        </div>

        {/* Open Amount */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-rose-50 rounded-bl-full -z-10" />
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Open Amount</span>
            <div className="text-xl font-black text-rose-600">{isLoading ? '—' : kpis.openAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs text-rose-400 font-bold">dh</span></div>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500"><TrendingDown size={20} /></div>
        </div>
      </div>

      {/* Information Card */}
      <div className="max-w-[1600px] mx-auto mb-8 bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-bl-full -z-10" />
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <Info className="h-5 w-5 text-slate-500" />
          </div>
          <h2 className="text-sm font-black text-[#2e1d52] uppercase tracking-[0.1em]">Decay Sales Group By Date</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Calendar size={14} /> Date</Label>
            <div className="font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm">
              {dateString}
            </div>
          </div>
          <div>
            <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><TrendingUp size={14} /> Operations Count</Label>
            <div className="font-black text-[#2e1d52] bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm">
              {filteredSales.length} Invoice(s)
            </div>
          </div>
        </div>
      </div>

      {/* Main Datatable */}
      <div className="max-w-[1600px] mx-auto">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden flex flex-col">
          
          {/* Table Control Bar */}
          <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search..."
                className="h-10 pl-10 pr-4 rounded-xl border-slate-200 bg-white focus-visible:ring-[#7a9800] font-medium text-xs w-full shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 bg-white gap-2 font-bold text-slate-600 shadow-sm text-xs">
                    <SlidersHorizontal size={14} /> Density: <span className="capitalize text-[#7a9800]">{density}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl p-1 bg-white">
                  <DropdownMenuItem onClick={() => setDensity('compact')} className="font-bold py-2 px-3 text-xs rounded-lg cursor-pointer">Compact</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDensity('normal')} className="font-bold py-2 px-3 text-xs rounded-lg cursor-pointer">Normal</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDensity('tall')} className="font-bold py-2 px-3 text-xs rounded-lg cursor-pointer">Tall</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-200 bg-white shadow-sm" onClick={() => setIsFullscreen(prev => !prev)}>
                {isFullscreen ? <Minimize2 size={16} className="text-slate-600" /> : <Maximize2 size={16} className="text-slate-600" />}
              </Button>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth min-h-[400px]">
            <Table className="w-full min-w-[1300px] border-collapse">
              <TableHeader className="bg-slate-50 border-b border-slate-100">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 w-[80px]">Actions</TableHead>
                  {renderSortHeader('Invoice Number', 'invoiceNumber')}
                  {renderSortHeader('Date', 'date')}
                  {renderSortHeader('Customer', 'customerName')}
                  {renderSortHeader('Total Quantity', 'totalQuantity')}
                  {renderSortHeader('Total Amount', 'totalAmount')}
                  {renderSortHeader('Payment Method', 'paymentMethod')}
                  {renderSortHeader('Created By', 'created_by')}
                  {renderSortHeader('Updated By', 'updated_by')}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="h-64 text-center"><Loader2 className="h-8 w-8 animate-spin text-[#7a9800] mx-auto" /></TableCell></TableRow>
                ) : paginatedSales.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="h-64 text-center text-slate-400 font-bold uppercase tracking-wider text-[10px]">No records found</TableCell></TableRow>
                ) : (
                  paginatedSales.map((row: any) => (
                    <TableRow key={row.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none group">
                      <TableCell className={cn("pl-6", densityPaddingClass)}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100">
                              <MoreVertical className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="rounded-xl border-slate-100 shadow-xl p-1 bg-white w-32">
                            <DropdownMenuItem 
                              onClick={() => router.push(`/decay/sales/${row.id}`)}
                              className="font-bold gap-2 cursor-pointer py-2 px-3 text-xs text-slate-700 rounded-lg hover:bg-slate-50"
                            >
                              <FileText size={13} className="text-slate-500" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => router.push(`/decay/sales/${row.id}/edit`)}
                              className="font-bold gap-2 cursor-pointer py-2 px-3 text-xs text-slate-700 rounded-lg hover:bg-slate-50"
                            >
                              <Edit2 size={13} className="text-slate-500" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setRecordToDelete(row.id);
                                setIsDeleteConfirmOpen(true);
                              }}
                              className="font-bold gap-2 cursor-pointer py-2 px-3 text-xs text-rose-600 rounded-lg"
                            >
                              <Trash2 size={13} className="text-rose-500" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell 
                        className={cn("font-bold text-slate-700 whitespace-nowrap cursor-pointer hover:text-[#7a9800] hover:underline decoration-2", densityPaddingClass)}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/decay/sales/${row.id}`);
                        }}
                      >
                        {row.invoiceNumber}
                      </TableCell>
                      <TableCell 
                        className={cn("font-bold text-slate-600 whitespace-nowrap cursor-pointer hover:text-[#7a9800] hover:underline decoration-2", densityPaddingClass)}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/decay/loading/${row.id}/edit`);
                        }}
                      >
                        {row.date}
                      </TableCell>
                      <TableCell className={cn("font-black text-[#2e1d52] whitespace-nowrap", densityPaddingClass)}>{row.customerName}</TableCell>
                      <TableCell className={cn("font-black text-slate-700 whitespace-nowrap", densityPaddingClass)}>{row.totalQuantity.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">KG</span></TableCell>
                      <TableCell className={cn("font-black text-[#7a9800] whitespace-nowrap", densityPaddingClass)}>{row.totalAmount.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">dh</span></TableCell>
                      <TableCell className={cn("font-bold text-slate-500 whitespace-nowrap", densityPaddingClass)}>{row.paymentMethod}</TableCell>
                      <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                        {row.created_by?.split('@')[0] || row.created_by}
                      </TableCell>
                      <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                        {row.updated_by?.split('@')[0] || row.updated_by}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="p-4 md:p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <span>Showing {Math.min(sortedSales.length, currentPage * itemsPerPage)} of {sortedSales.length} Record(s)</span>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="h-8 px-3 rounded-lg hover:bg-slate-100 font-black uppercase text-[10px]"
              >
                <ChevronLeft size={14} className="mr-1" /> Previous
              </Button>
              
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isActive = pageNum === currentPage;
                return (
                  <Button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={cn(
                      "h-8 w-8 rounded-lg font-black text-[10px] p-0 flex items-center justify-center transition-all duration-200",
                      isActive 
                        ? "bg-[#7a9800] text-white hover:bg-[#6c8500] shadow-md shadow-[#7a9800]/20 scale-105" 
                        : "bg-transparent text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {pageNum}
                  </Button>
                );
              })}

              <Button 
                variant="ghost" 
                size="sm" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="h-8 px-3 rounded-lg hover:bg-slate-100 font-black uppercase text-[10px]"
              >
                Next <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>

        </div>
      </div>

      {/* Delete confirmation modal */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white rounded-3xl border-none shadow-2xl p-6 ring-1 ring-black/5">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-lg font-black text-[#2e1d52] uppercase tracking-tight">
              Delete Decay Sale
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-semibold text-xs leading-normal">
              Are you sure you want to delete this decay sale?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="h-10 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-600 hover:bg-slate-50 border-slate-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="h-10 rounded-xl font-black text-xs uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
