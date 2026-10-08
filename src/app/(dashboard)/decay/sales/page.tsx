'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  orderBy, 
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Search, 
  SlidersHorizontal, 
  Maximize2, 
  Minimize2, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown,
  Loader2,
  X,
  Calendar,
  Filter,
  MoreVertical,
  Edit2,
  Trash2,
  FileText,
  TrendingUp,
  Download,
  Users,
  Weight,
  DollarSign,
  TrendingDown
} from 'lucide-react';
import Link from 'next/link';
import ExcelJS from 'exceljs';

export default function DecaySalesPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // --- UI States ---
  const [activeTab, setActiveTab] = useState<'by-date' | 'by-customer' | 'all-sales'>('by-date');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // --- Filters ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // --- Sorting & Pagination ---
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // --- Modals ---
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  // --- Fetch Invoices & Payments ---
  const invoicesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'decay_loadings'), orderBy('date', 'desc'));
  }, [db]);
  const { data: rawInvoices, isLoading: loadingInvoices } = useCollection(invoicesQuery);

  const paymentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'decay_payments'), orderBy('date', 'desc'));
  }, [db]);
  const { data: rawPayments, isLoading: loadingPayments } = useCollection(paymentsQuery);

  const isLoading = loadingInvoices || loadingPayments;

  // Reset pagination on tab/filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, startDate, endDate]);

  // Helper: Deteministic Invoice Number if missing
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
      const averagePrice = totalQty > 0 ? (Number(invoice.totalAmount || 0) / totalQty) : 0;
      return {
        ...invoice,
        invoiceNumber: getInvoiceNumber(invoice),
        totalQuantity: totalQty,
        price: averagePrice,
      };
    });

    // Date Filters
    if (startDate) {
      list = list.filter(item => item.date >= startDate);
    }
    if (endDate) {
      list = list.filter(item => item.date <= endDate);
    }

    // Text Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(item => 
        (item.customerName || '').toLowerCase().includes(term) ||
        (item.invoiceNumber || '').toLowerCase().includes(term) ||
        (item.paymentMethod || '').toLowerCase().includes(term) ||
        (item.date || '').toLowerCase().includes(term)
      );
    }

    return list;
  }, [rawInvoices, startDate, endDate, searchTerm]);

  // --- Filtered Payments ---
  const filteredPayments = useMemo(() => {
    if (!rawPayments) return [];
    let list = [...rawPayments];
    if (startDate) {
      list = list.filter(item => item.date >= startDate);
    }
    if (endDate) {
      list = list.filter(item => item.date <= endDate);
    }
    return list;
  }, [rawPayments, startDate, endDate]);

  // --- KPIs Calculations ---
  const kpis = useMemo(() => {
    const totalSales = filteredSales.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const totalQuantity = filteredSales.reduce((sum, item) => sum + Number(item.totalQuantity || 0), 0);
    const averagePrice = totalQuantity > 0 ? totalSales / totalQuantity : 0;
    const totalPayments = filteredPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const openAmount = totalSales - totalPayments;

    return {
      averagePrice,
      totalSales,
      totalQuantity,
      totalPayments,
      openAmount,
    };
  }, [filteredSales, filteredPayments]);

  // --- Tab 1 Data: Decay Sales by Date ---
  const salesByDate = useMemo(() => {
    const groups: { [key: string]: { date: string; quantity: number; totalAmount: number } } = {};
    filteredSales.forEach(sale => {
      const d = sale.date || 'Unknown';
      if (!groups[d]) {
        groups[d] = { date: d, quantity: 0, totalAmount: 0 };
      }
      groups[d].quantity += sale.totalQuantity || 0;
      groups[d].totalAmount += Number(sale.totalAmount || 0);
    });
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredSales]);

  // --- Tab 2 Data: Decay Sales by Customer ---
  const salesByCustomer = useMemo(() => {
    const groups: { [key: string]: { customerId: string; name: string; quantity: number; totalAmount: number; totalPaid: number } } = {};
    
    // Aggregated invoices
    filteredSales.forEach(sale => {
      const cid = sale.customerId || 'Unknown';
      if (!groups[cid]) {
        groups[cid] = { customerId: cid, name: sale.customerName || 'Unknown', quantity: 0, totalAmount: 0, totalPaid: 0 };
      }
      groups[cid].quantity += sale.totalQuantity || 0;
      groups[cid].totalAmount += Number(sale.totalAmount || 0);
    });

    // Aggregated payments
    filteredPayments.forEach(pay => {
      const cid = pay.customerId || 'Unknown';
      if (groups[cid]) {
        groups[cid].totalPaid += Number(pay.amount || 0);
      } else {
        groups[cid] = { customerId: cid, name: pay.customerName || 'Unknown', quantity: 0, totalAmount: 0, totalPaid: Number(pay.amount || 0) };
      }
    });

    return Object.values(groups).map(g => ({
      ...g,
      openAmount: g.totalAmount - g.totalPaid
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredSales, filteredPayments]);

  // --- Active Tab Paginated List ---
  const currentTabList = useMemo(() => {
    let list: any[] = [];
    let field = sortField;

    if (activeTab === 'by-date') {
      list = [...salesByDate];
      if (!field) field = 'date';
    } else if (activeTab === 'by-customer') {
      list = [...salesByCustomer];
      if (!field) field = 'totalAmount';
    } else {
      list = [...filteredSales];
      if (!field) field = 'date';
    }

    // Sort logic
    list.sort((a, b) => {
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
  }, [activeTab, salesByDate, salesByCustomer, filteredSales, sortField, sortDirection]);

  const totalPages = Math.ceil(currentTabList.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return currentTabList.slice(startIndex, startIndex + itemsPerPage);
  }, [currentTabList, currentPage]);

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

  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      
      const salesSheet = workbook.addWorksheet('Decay Sales');
      salesSheet.columns = [
        { header: 'Invoice Number', key: 'invoiceNumber', width: 20 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Quantity Total', key: 'quantity', width: 15 },
        { header: 'Customer', key: 'customerName', width: 30 },
        { header: 'Total Amount', key: 'totalAmount', width: 15 },
        { header: 'Payment Status', key: 'paymentStatus', width: 15 },
        { header: 'Payment Method', key: 'paymentMethod', width: 15 },
        { header: 'Driver Plate Number', key: 'driverPlateNumber', width: 20 },
        { header: 'Note', key: 'note', width: 25 }
      ];

      salesSheet.getRow(1).font = { bold: true, color: { argb: 'FF000000' } };

      filteredSales.forEach(s => {
        let quantityTotal = 0;
        let totalAmt = 0;
        
        if (s.items && Array.isArray(s.items)) {
          s.items.forEach((i: any) => {
            const qty = Number(i.quantity || i.netWeight || 0);
            const prc = Number(i.price || 0);
            quantityTotal += qty;
            totalAmt += (qty * prc);
          });
        } else {
          quantityTotal = Number(s.totalQuantity || 0);
          totalAmt = Number(s.totalAmount || 0);
        }

        let formattedDate = '-';
        const rawDate = s.date || s.dateTime;
        if (rawDate) {
          if (typeof rawDate === 'string' && rawDate.includes('-') && rawDate.length === 10) {
            formattedDate = rawDate; // Already YYYY-MM-DD
          } else {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              formattedDate = d.toISOString().split('T')[0];
            } else {
              formattedDate = String(rawDate);
            }
          }
        }

        salesSheet.addRow({
          invoiceNumber: s.invoiceNumber || '-',
          date: formattedDate,
          quantity: quantityTotal,
          customerName: s.customerName || '-',
          totalAmount: totalAmt,
          paymentStatus: s.paymentStatus || '-',
          paymentMethod: s.paymentMethod || '-',
          driverPlateNumber: s.driverPlateNumber || '-',
          note: s.note || '-'
        });
      });

      salesSheet.eachRow(row => {
        row.eachCell(cell => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const fileName = startDate || endDate 
        ? `Decay Sales ${startDate || ''} ${endDate || ''}`.trim() + '.xlsx' 
        : 'Decay Sales.xlsx';
        
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast({ title: 'Export Failed', description: 'Failed to generate Excel file.', variant: 'destructive' });
    }
  };

  return (
    <div className={cn(
      "w-full bg-[#f3f3f3] min-h-screen transition-all duration-300",
      isFullscreen ? "fixed inset-0 z-50 p-6 overflow-y-auto bg-[#f3f3f3]" : "p-6 lg:p-8"
    )}>
      
      {/* Header */}
      <div className="max-w-[1600px] mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            <span className="hover:text-slate-600 cursor-pointer">Profile</span>
            <span className="opacity-40">/</span>
            <span className="text-[#7a9800] font-black">Decay Sale</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">
            Decay Sale
          </h1>
        </div>

        <div>
          <Button 
            variant="outline"
            className="h-12 px-6 bg-white border-slate-200 text-[#7a9800] hover:text-white hover:bg-[#7a9800] rounded-xl font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
            onClick={handleExportExcel}
          >
            <Download size={16} /> Export Report
          </Button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="max-w-[1600px] mx-auto mb-8 bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
          <div className="h-8 w-8 rounded-lg bg-[#7a9800]/10 flex items-center justify-center">
            <Filter className="h-4 w-4 text-[#7a9800]" />
          </div>
          <h2 className="text-xs font-black text-[#2e1d52] uppercase tracking-[0.1em]">Filter Section</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 items-end">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Start Date</Label>
            <Input 
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="h-11 rounded-xl bg-slate-50/50 border-slate-200 font-bold text-slate-700 focus-visible:ring-[#7a9800]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">End Date</Label>
            <Input 
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="h-11 rounded-xl bg-slate-50/50 border-slate-200 font-bold text-slate-700 focus-visible:ring-[#7a9800]"
            />
          </div>
          <div className="flex gap-3 md:col-span-2">
            <Button
              className="h-11 flex-1 bg-[#7a9800] hover:bg-[#6c8500] text-white rounded-xl font-bold uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-[#7a9800]/10"
              onClick={() => {}}
            >
              <Filter size={14} /> Filter
            </Button>
            <Button
              variant="outline"
              className="h-11 flex-1 border-[#7a9800] text-[#7a9800] hover:bg-slate-50 rounded-xl font-bold uppercase text-[10px] tracking-widest gap-2"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSearchTerm('');
              }}
            >
              <X size={14} /> Reset/Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="max-w-[1600px] mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        
        {/* Average Price */}
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#7a9800]/5 rounded-bl-full -z-10" />
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Average Price</span>
            <div className="text-xl font-black text-[#2e1d52]">{isLoading ? '—' : kpis.averagePrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-bold">dh/KG</span></div>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-[#7a9800]/10 flex items-center justify-center text-[#7a9800]"><TrendingUp size={20} /></div>
        </div>

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

      {/* Tabs list & Main Table Card */}
      <div className="max-w-[1600px] mx-auto">
        <Tabs defaultValue="by-date" onValueChange={val => {
          setActiveTab(val as any);
          setSortField(val === 'by-customer' ? 'totalAmount' : 'date');
          setSortDirection('desc');
        }} className="space-y-6">
          
          <TabsList className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex flex-wrap gap-1 max-w-lg">
            <TabsTrigger value="by-date" className="flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl data-[state=active]:bg-white data-[state=active]:text-[#7a9800] data-[state=active]:shadow-md">
              Sales by Date
            </TabsTrigger>
            <TabsTrigger value="by-customer" className="flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl data-[state=active]:bg-white data-[state=active]:text-[#7a9800] data-[state=active]:shadow-md">
              Sales by Customer
            </TabsTrigger>
            <TabsTrigger value="all-sales" className="flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl data-[state=active]:bg-white data-[state=active]:text-[#7a9800] data-[state=active]:shadow-md">
              Decay Sales
            </TabsTrigger>
          </TabsList>

          <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden flex flex-col">
            
            {/* Table Control Bar */}
            <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search in view..."
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
              <Table className="w-full border-collapse">
                
                {activeTab === 'by-date' && (
                  <>
                    <TableHeader className="bg-slate-50 border-b border-slate-100">
                      <TableRow className="hover:bg-transparent">
                        {renderSortHeader('Date', 'date')}
                        {renderSortHeader('Quantity', 'quantity')}
                        {renderSortHeader('Total Amount', 'totalAmount')}
                        <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 w-[120px]">Operations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={4} className="h-64 text-center"><Loader2 className="h-8 w-8 animate-spin text-[#7a9800] mx-auto" /></TableCell></TableRow>
                      ) : paginatedList.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="h-64 text-center text-slate-400 font-bold uppercase tracking-wider text-[10px]">No records found</TableCell></TableRow>
                      ) : (
                        paginatedList.map((row: any) => (
                          <TableRow key={row.date} onClick={() => router.push(`/decay/sales/date/${row.date}`)} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none cursor-pointer group">
                            <TableCell className={cn("font-bold text-slate-600", densityPaddingClass)}>{row.date}</TableCell>
                            <TableCell className={cn("font-black text-[#2e1d52]", densityPaddingClass)}>{row.quantity.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">KG</span></TableCell>
                            <TableCell className={cn("font-black text-[#7a9800]", densityPaddingClass)}>{row.totalAmount.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">dh</span></TableCell>
                            <TableCell className={cn(densityPaddingClass)}>
                              <Button variant="ghost" size="sm" className="h-8 text-[#7a9800] hover:bg-[#7a9800]/5 font-black text-[10px] uppercase rounded-lg">View Details</Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </>
                )}

                {activeTab === 'by-customer' && (
                  <>
                    <TableHeader className="bg-slate-50 border-b border-slate-100">
                      <TableRow className="hover:bg-transparent">
                        {renderSortHeader('Customer', 'name')}
                        {renderSortHeader('Total Amount', 'totalAmount')}
                        {renderSortHeader('Total Paid Amount', 'totalPaid')}
                        {renderSortHeader('Open Amount', 'openAmount')}
                        {renderSortHeader('Quantity', 'quantity')}
                        <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 w-[120px]">Operations</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={6} className="h-64 text-center"><Loader2 className="h-8 w-8 animate-spin text-[#7a9800] mx-auto" /></TableCell></TableRow>
                      ) : paginatedList.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="h-64 text-center text-slate-400 font-bold uppercase tracking-wider text-[10px]">No records found</TableCell></TableRow>
                      ) : (
                        paginatedList.map((row: any) => (
                          <TableRow key={row.customerId} onClick={() => router.push(`/decay/sales/customer/${row.customerId}`)} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none cursor-pointer group">
                            <TableCell className={cn("font-black text-[#2e1d52]", densityPaddingClass)}>{row.name}</TableCell>
                            <TableCell className={cn("font-black text-slate-700", densityPaddingClass)}>{row.totalAmount.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">dh</span></TableCell>
                            <TableCell className={cn("font-black text-emerald-600", densityPaddingClass)}>{row.totalPaid.toLocaleString()} <span className="text-[9px] text-emerald-400 font-bold uppercase">dh</span></TableCell>
                            <TableCell className={cn("font-black text-rose-600", densityPaddingClass)}>{row.openAmount.toLocaleString()} <span className="text-[9px] text-rose-400 font-bold uppercase">dh</span></TableCell>
                            <TableCell className={cn("font-black text-slate-600", densityPaddingClass)}>{row.quantity.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">KG</span></TableCell>
                            <TableCell className={cn(densityPaddingClass)}>
                              <Button variant="ghost" size="sm" className="h-8 text-[#7a9800] hover:bg-[#7a9800]/5 font-black text-[10px] uppercase rounded-lg">Situation</Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </>
                )}

                {activeTab === 'all-sales' && (
                  <>
                    <TableHeader className="bg-slate-50 border-b border-slate-100">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 w-[80px]">Actions</TableHead>
                        {renderSortHeader('Invoice Number', 'invoiceNumber')}
                        {renderSortHeader('Date', 'date')}
                        {renderSortHeader('Customer', 'customerName')}
                        {renderSortHeader('Total Quantity', 'totalQuantity')}
                        {renderSortHeader('Price', 'price')}
                        {renderSortHeader('Total Amount', 'totalAmount')}
                        {renderSortHeader('Payment Method', 'paymentMethod')}
                        {renderSortHeader('Created By', 'created_by')}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow><TableCell colSpan={9} className="h-64 text-center"><Loader2 className="h-8 w-8 animate-spin text-[#7a9800] mx-auto" /></TableCell></TableRow>
                      ) : paginatedList.length === 0 ? (
                        <TableRow><TableCell colSpan={9} className="h-64 text-center text-slate-400 font-bold uppercase tracking-wider text-[10px]">No records found</TableCell></TableRow>
                      ) : (
                        paginatedList.map((row: any) => (
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
                            <TableCell className={cn("font-black text-slate-600 whitespace-nowrap", densityPaddingClass)}>{row.price.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-[9px] text-slate-400 font-bold uppercase">dh/KG</span></TableCell>
                            <TableCell className={cn("font-black text-[#7a9800] whitespace-nowrap", densityPaddingClass)}>{row.totalAmount.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">dh</span></TableCell>
                            <TableCell className={cn("font-bold text-slate-500 whitespace-nowrap", densityPaddingClass)}>{row.paymentMethod}</TableCell>
                            <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                              {row.created_by?.split('@')[0] || row.created_by}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </>
                )}

              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 md:p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>Showing {Math.min(currentTabList.length, currentPage * itemsPerPage)} of {currentTabList.length} Record(s)</span>
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
        </Tabs>
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
