'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { collection, query, orderBy, deleteDoc, doc } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import {
  Search,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Download,
  FileText,
  X,
  CreditCard,
  BadgeDollarSign,
  CircleDollarSign
} from 'lucide-react';

export default function SuppliersBalanceListingPage() {
  const router = useRouter();

  // --- UI States ---
  const [activeTab, setActiveTab] = useState<'groupBySupplier' | 'payments'>('groupBySupplier');
  
  // --- Table Configuration States ---
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const itemsPerPage = 8;

  const db = useFirestore();
  const { user } = useUser();

  // --- Fetch Data ---
  const suppliersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'procurement_suppliers'));
  }, [db]);

  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'raw_materials'));
  }, [db]);

  const paymentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'supplier_payments'));
  }, [db]);

  const { data: procurementSuppliers, isLoading: loadingSuppliers } = useCollection(suppliersQuery);
  const { data: rawMaterials, isLoading: loadingRM } = useCollection(rawMaterialsQuery);
  const { data: supplierPayments, isLoading: loadingPayments } = useCollection(paymentsQuery);

  const isLoading = loadingSuppliers || loadingRM || loadingPayments;

  // --- Compute Data ---
  const calculatedSuppliers = useMemo(() => {
    if (!procurementSuppliers) return [];
    
    return procurementSuppliers.map(supplier => {
      let noOfReception = 0;
      let totalNetWeight = 0;
      let totalAmount = 0;
      let paidAmount = 0;

      // Calculate from raw materials
      if (rawMaterials) {
        rawMaterials.forEach(rm => {
          if (rm.supplierId === supplier.id) {
            noOfReception++;
            const blNetWeight = Number(rm.blNetWeight != null ? rm.blNetWeight : (rm.totalNetWeight || 0));
            const decayNetWeight = Number(rm.totalDecayNetWeight || rm.decayNetWeight || 0);
            const price = rm.price || rm.unitPrice;
            const decayPrice = rm.decayPrice;
            const costPaidByFarmer = Number(rm.costPaidByFarmer || 0);
            const rebate = Number(rm.rebate || 0);

            let finalTotalAmount = 0;
            if (price && price !== '') {
              const pPrice = Number(price);
              const pDecayPrice = Number(decayPrice || 0);
              const workerCost = Number(rm.workerCost || 0);
              const rebateFactor = (100 - rebate) / 100;
              const goodWeight = blNetWeight - decayNetWeight;
              const baseAmount = goodWeight * pPrice * rebateFactor;
              const decayAmount = decayNetWeight > 0 ? (decayNetWeight * pDecayPrice * rebateFactor) : 0;
              finalTotalAmount = Number((baseAmount + decayAmount - workerCost).toFixed(2));
            }

            totalNetWeight += blNetWeight;
            totalAmount += finalTotalAmount;
          }
        });
      }

      // Calculate from payments
      if (supplierPayments) {
        supplierPayments.forEach(pay => {
          if (pay.supplierId === supplier.id) {
            paidAmount += Number(pay.amount || 0);
          }
        });
      }

      const openAmount = totalAmount - paidAmount;

      return {
        id: supplier.id,
        supplier: supplier.name || 'Unknown',
        noOfReception,
        totalNetWeight,
        totalAmount,
        paidAmount,
        openAmount
      };
    }).filter(s => s.noOfReception >= 1);
  }, [procurementSuppliers, rawMaterials, supplierPayments]);

  const allPayments = useMemo(() => {
    if (!supplierPayments) return [];
    return supplierPayments.map(pay => {
      const supplier = procurementSuppliers?.find(s => s.id === pay.supplierId);
      return {
        id: pay.id,
        supplierId: pay.supplierId,
        supplier: supplier?.name || pay.supplierName || 'Unknown',
        date: pay.date || (pay.created_at ? new Date(pay.created_at.toMillis()).toISOString().split('T')[0] : '—'),
        amount: Number(pay.amount || 0),
        paymentType: pay.paymentType || '—',
        operationType: pay.operationType || '—',
        note: pay.note || '—'
      };
    });
  }, [supplierPayments, procurementSuppliers]);

  // --- Filter & Sort Logic for Group By Supplier ---
  const filteredSuppliers = useMemo(() => {
    let list = [...calculatedSuppliers];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(item => item.supplier.toLowerCase().includes(term));
    }
    
    if (sortField) {
      list.sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          return sortDirection === 'asc' ? (valA - valB) : (valB - valA);
        }
      });
    }
    return list;
  }, [calculatedSuppliers, searchTerm, sortField, sortDirection]);

  const paginatedSuppliers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSuppliers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSuppliers, currentPage]);
  const totalSupplierPages = Math.ceil(filteredSuppliers.length / itemsPerPage) || 1;

  // --- Filter & Sort Logic for Payments ---
  const filteredPayments = useMemo(() => {
    let list = [...allPayments];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(item => item.supplier.toLowerCase().includes(term) || item.paymentType.toLowerCase().includes(term));
    }

    if (sortField) {
      list.sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          return sortDirection === 'asc' ? (valA - valB) : (valB - valA);
        }
      });
    }
    return list;
  }, [allPayments, searchTerm, sortField, sortDirection]);

  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPayments, currentPage]);
  const totalPaymentPages = Math.ceil(filteredPayments.length / itemsPerPage) || 1;

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
          "py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap cursor-pointer select-none transition-colors hover:text-primary",
          isActive && "text-[#7a9800] font-black"
        )}
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1.5 justify-start">
          {label}
          <ArrowUpDown className={cn(
            "h-3 w-3 transition-opacity", 
            isActive ? "opacity-100 text-[#7a9800]" : "opacity-35"
          )} />
        </div>
      </TableHead>
    );
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
      <div className="max-w-[1600px] mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            <span className="hover:text-slate-600 cursor-pointer">Profile</span>
            <span className="opacity-40">/</span>
            <span className="text-[#7a9800] font-black uppercase">Supplier's Balance Listing</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">
            Supplier's Balance
          </h1>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-3">
          <Button 
            className="h-12 w-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 p-0"
            title="Export PDF"
          >
            <FileText size={20} className="stroke-[2.5]" />
          </Button>
          <Button 
            className="h-12 w-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 p-0"
            title="Export Excel"
          >
            <Download size={20} className="stroke-[2.5]" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center gap-6 group hover:border-[#7a9800]/30 transition-all duration-300">
          <div className="h-14 w-14 rounded-2xl bg-[#7a9800]/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <BadgeDollarSign className="h-6 w-6 text-[#7a9800]" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Amount</p>
            <p className="text-2xl font-black text-[#2e1d52] tracking-tight">
              {calculatedSuppliers.reduce((sum, s) => sum + s.totalAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm text-slate-400 font-bold ml-1">MAD</span>
            </p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center gap-6 group hover:border-[#7a9800]/30 transition-all duration-300">
          <div className="h-14 w-14 rounded-2xl bg-[#7a9800]/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <CreditCard className="h-6 w-6 text-[#7a9800]" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Paid Amount</p>
            <p className="text-2xl font-black text-[#2e1d52] tracking-tight">
              {calculatedSuppliers.reduce((sum, s) => sum + s.paidAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm text-slate-400 font-bold ml-1">MAD</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center gap-6 group hover:border-[#7a9800]/30 transition-all duration-300">
          <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <CircleDollarSign className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Open</p>
            <p className="text-2xl font-black text-[#2e1d52] tracking-tight">
              {calculatedSuppliers.reduce((sum, s) => sum + s.openAmount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-sm text-slate-400 font-bold ml-1">MAD</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-[1600px] mx-auto">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden flex flex-col">
          
          {/* Tabs */}
          <div className="flex items-center gap-2 px-6 pt-6 border-b border-slate-100 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('groupBySupplier')}
              className={cn(
                "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2",
                activeTab === 'groupBySupplier'
                  ? "border-[#7a9800] text-[#7a9800]"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
              )}
            >
              Group By Supplier
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={cn(
                "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2",
                activeTab === 'payments'
                  ? "border-[#7a9800] text-[#7a9800]"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
              )}
            >
              Payments
            </button>
          </div>

          {/* Table Control Bar */}
          <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search..."
                className="h-10 pl-10 pr-4 rounded-xl border-slate-200 bg-white focus-visible:ring-[#7a9800] font-medium placeholder-slate-400 text-slate-700 text-xs w-full shadow-sm"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
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

              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 rounded-xl border-slate-200 bg-white shadow-sm"
                onClick={() => setIsFullscreen(prev => !prev)}
              >
                {isFullscreen ? <Minimize2 size={16} className="text-slate-600" /> : <Maximize2 size={16} className="text-slate-600" />}
              </Button>
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth">
            {activeTab === 'groupBySupplier' && (
              <Table className="w-full min-w-[1000px] border-collapse">
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent">
                    {renderSortHeader('Supplier', 'supplier')}
                    {renderSortHeader('No of Reception', 'noOfReception')}
                    {renderSortHeader('Total Net Weight', 'totalNetWeight')}
                    {renderSortHeader('Total Amount', 'totalAmount')}
                    {renderSortHeader('Paid Amount', 'paidAmount')}
                    {renderSortHeader('Open Amount', 'openAmount')}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-8 h-8 rounded-full border-2 border-[#7a9800] border-t-transparent animate-spin mx-auto" />
                          <p className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Loading Suppliers...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedSuppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                          <Search size={40} className="text-slate-400" />
                          <p className="font-black uppercase tracking-widest text-[10px]">No records found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedSuppliers.map((record) => (
                      <TableRow key={record.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none group">
                        <TableCell className={cn(densityPaddingClass, "font-bold text-[#2e1d52] align-middle")}>
                          <Link href={`/procurement/suppliers-balance/${record.id}`} className="hover:text-[#7a9800] hover:underline underline-offset-4 transition-colors">
                            {record.supplier}
                          </Link>
                        </TableCell>
                        <TableCell className={cn(densityPaddingClass, "font-semibold text-slate-600 align-middle")}>{record.noOfReception}</TableCell>
                        <TableCell className={cn(densityPaddingClass, "font-semibold text-slate-600 align-middle")}>{record.totalNetWeight.toLocaleString()} kg</TableCell>
                        <TableCell className={cn(densityPaddingClass, "font-black text-[#2e1d52] align-middle")}>{record.totalAmount.toLocaleString()} MAD</TableCell>
                        <TableCell className={cn(densityPaddingClass, "font-black text-[#7a9800] align-middle")}>{record.paidAmount.toLocaleString()} MAD</TableCell>
                        <TableCell className={cn(densityPaddingClass, "font-black text-rose-500 align-middle")}>{record.openAmount.toLocaleString()} MAD</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {activeTab === 'payments' && (
              <Table className="w-full min-w-[1000px] border-collapse">
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent">
                    {renderSortHeader('Supplier', 'supplier')}
                    {renderSortHeader('Date', 'date')}
                    {renderSortHeader('Amount', 'amount')}
                    {renderSortHeader('Payment Type', 'paymentType')}
                    {renderSortHeader('Note', 'note')}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-8 h-8 rounded-full border-2 border-[#7a9800] border-t-transparent animate-spin mx-auto" />
                          <p className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Loading Payments...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                          <Search size={40} className="text-slate-400" />
                          <p className="font-black uppercase tracking-widest text-[10px]">No records found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedPayments.map((record) => (
                      <TableRow key={record.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none group">
                        <TableCell className={cn(densityPaddingClass, "font-bold text-[#2e1d52] align-middle")}>{record.supplier}</TableCell>
                        <TableCell className={cn(densityPaddingClass, "font-semibold text-slate-600 align-middle")}>{record.date}</TableCell>
                        <TableCell className={cn(densityPaddingClass, "font-black text-[#7a9800] align-middle")}>{record.amount.toLocaleString()} MAD</TableCell>
                        <TableCell className={cn(densityPaddingClass, "font-bold text-slate-600 align-middle")}>
                          <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                            {record.paymentType}
                          </span>
                        </TableCell>
                        <TableCell className={cn(densityPaddingClass, "font-semibold text-slate-600 align-middle")}>{record.note || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          <div className="p-4 md:p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {activeTab === 'groupBySupplier' && (
              <>
                <span>Showing {Math.min(filteredSuppliers.length, currentPage * itemsPerPage)} of {filteredSuppliers.length} Record(s)</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="h-8 px-3 rounded-lg hover:bg-slate-100 font-black uppercase text-[10px]">
                    <ChevronLeft size={14} className="mr-1" /> Previous
                  </Button>
                  {Array.from({ length: totalSupplierPages }).map((_, i) => (
                    <Button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={cn("h-8 w-8 rounded-lg font-black text-[10px] p-0", i + 1 === currentPage ? "bg-[#7a9800] text-white" : "bg-transparent text-slate-600 hover:bg-slate-100")}>
                      {i + 1}
                    </Button>
                  ))}
                  <Button variant="ghost" size="sm" disabled={currentPage === totalSupplierPages} onClick={() => setCurrentPage(prev => Math.min(totalSupplierPages, prev + 1))} className="h-8 px-3 rounded-lg hover:bg-slate-100 font-black uppercase text-[10px]">
                    Next <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              </>
            )}
            {activeTab === 'payments' && (
              <>
                <span>Showing {Math.min(filteredPayments.length, currentPage * itemsPerPage)} of {filteredPayments.length} Record(s)</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} className="h-8 px-3 rounded-lg hover:bg-slate-100 font-black uppercase text-[10px]">
                    <ChevronLeft size={14} className="mr-1" /> Previous
                  </Button>
                  {Array.from({ length: totalPaymentPages }).map((_, i) => (
                    <Button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={cn("h-8 w-8 rounded-lg font-black text-[10px] p-0", i + 1 === currentPage ? "bg-[#7a9800] text-white" : "bg-transparent text-slate-600 hover:bg-slate-100")}>
                      {i + 1}
                    </Button>
                  ))}
                  <Button variant="ghost" size="sm" disabled={currentPage === totalPaymentPages} onClick={() => setCurrentPage(prev => Math.min(totalPaymentPages, prev + 1))} className="h-8 px-3 rounded-lg hover:bg-slate-100 font-black uppercase text-[10px]">
                    Next <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
