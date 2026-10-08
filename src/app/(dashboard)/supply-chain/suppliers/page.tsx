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
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Search, 
  SlidersHorizontal, 
  Maximize2, 
  Minimize2, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpDown,
  Loader2,
  Eye,
  X,
  Filter,
  FilterX,
  ChevronsLeft,
  ChevronsRight,
  Coins,
  Euro,
  DollarSign,
  PoundSterling
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';

export default function SuppliersListingPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { canList, canAdd, canUpdate, canDelete } = usePermissions('supplyChain.suppliers');

  // --- Modals State ---
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<any>(null);

  // --- Table Configuration States ---
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    supplierType: true,
    currency: true,
    contactPerson: true,
    phoneNumber: true,
    bankNumber: true,
    bankName: true,
    IF: true,
    ICE: true,
    address: true,
    createdBy: true,
    updatedBy: true,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterSupplierType, setFilterSupplierType] = useState('');
  const [filterContactPerson, setFilterContactPerson] = useState('');
  const [filterPhoneNumber, setFilterPhoneNumber] = useState('');
  const [filterBankNumber, setFilterBankNumber] = useState('');
  const [filterBankName, setFilterBankName] = useState('');
  const [filterIF, setFilterIF] = useState('');
  const [filterICE, setFilterICE] = useState('');
  const [filterAddress, setFilterAddress] = useState('');

  const [itemsPerPage, setItemsPerPage] = useState(10);

  // --- Database Fetch ---
  const rawSuppliersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'suppliers'));
  }, [db]);

  const procSuppliersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'procurement_suppliers'));
  }, [db]);

  const scSuppliersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'supply_chain_suppliers'));
  }, [db]);

  const { data: rawSuppliersList, isLoading: loading1 } = useCollection(rawSuppliersQuery);
  const { data: procSuppliersList, isLoading: loading2 } = useCollection(procSuppliersQuery);
  const { data: scSuppliersList, isLoading: loading3 } = useCollection(scSuppliersQuery);

  const isLoading = loading1 || loading2 || loading3;

  const suppliersList = useMemo(() => {
    const map = new Map<string, any>();

    (rawSuppliersList || []).forEach((item: any) => {
      if (!map.has(item.id)) {
        const name = item.name || item.supplierName || item.title || '';
        map.set(item.id, {
          ...item,
          id: item.id,
          name: name,
          supplier_type: item.supplier_type || item.supplierType || item.type || 'Supply Chain',
          currency: item.currency || 'MAD',
          contact_person: item.contact_person || item.contactPerson || item.contact || '—',
          phone_number: item.phone_number || item.phoneNumber || item.phone || '—',
          bank_number: item.bank_number || item.bankNumber || item.rib || '—',
          bank_name: item.bank_name || item.bankName || '—',
          IF: item.IF || item.if || '—',
          ICE: item.ICE || item.ice || '—',
          address: item.address || '—',
          created_at: item.created_at || item.createdAt,
          updated_at: item.updated_at || item.updatedAt,
          created_by: item.created_by || item.createdBy || '—',
          updated_by: item.updated_by || item.updatedBy || '—',
          _sourceCollection: 'suppliers',
        });
      }
    });

    (procSuppliersList || []).forEach((item: any) => {
      if (!map.has(item.id)) {
        const name = item.name || item.supplierName || item.title || '';
        map.set(item.id, {
          ...item,
          id: item.id,
          name: name,
          supplier_type: item.supplier_type || item.supplierType || item.type || 'Procurement',
          currency: item.currency || 'MAD',
          contact_person: item.contact_person || item.contactPerson || item.contact || '—',
          phone_number: item.phone_number || item.phoneNumber || item.phone || '—',
          bank_number: item.bank_number || item.bankNumber || item.rib || '—',
          bank_name: item.bank_name || item.bankName || '—',
          IF: item.IF || item.if || '—',
          ICE: item.ICE || item.ice || '—',
          address: item.address || '—',
          created_at: item.created_at || item.createdAt,
          updated_at: item.updated_at || item.updatedAt,
          created_by: item.created_by || item.createdBy || '—',
          updated_by: item.updated_by || item.updatedBy || '—',
          _sourceCollection: 'procurement_suppliers',
        });
      }
    });

    (scSuppliersList || []).forEach((item: any) => {
      if (!map.has(item.id)) {
        const name = item.name || item.supplierName || item.title || '';
        map.set(item.id, {
          ...item,
          id: item.id,
          name: name,
          supplier_type: item.supplier_type || item.supplierType || item.type || 'Supply Chain',
          currency: item.currency || 'MAD',
          contact_person: item.contact_person || item.contactPerson || item.contact || '—',
          phone_number: item.phone_number || item.phoneNumber || item.phone || '—',
          bank_number: item.bank_number || item.bankNumber || item.rib || '—',
          bank_name: item.bank_name || item.bankName || '—',
          IF: item.IF || item.if || '—',
          ICE: item.ICE || item.ice || '—',
          address: item.address || '—',
          created_at: item.created_at || item.createdAt,
          updated_at: item.updated_at || item.updatedAt,
          created_by: item.created_by || item.createdBy || '—',
          updated_by: item.updated_by || item.updatedBy || '—',
          _sourceCollection: 'supply_chain_suppliers',
        });
      }
    });

    return Array.from(map.values());
  }, [rawSuppliersList, procSuppliersList, scSuppliersList]);

  // --- Form Actions ---
  const handleDelete = async () => {
    if (!db || !recordToDelete) return;
    try {
      const colName = recordToDelete._sourceCollection || 'suppliers';
      await deleteDoc(doc(db, colName, recordToDelete.id));
      toast({
        title: "Success",
        description: "Supplier deleted successfully.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to delete supplier.",
        variant: "destructive"
      });
    } finally {
      setIsDeleteConfirmOpen(false);
      setRecordToDelete(null);
    }
  };

  // --- Filtering & Sorting & Pagination ---
  const filteredList = useMemo(() => {
    if (!suppliersList) return [];
    let list = [...suppliersList];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(item => 
        (item.name || '').toLowerCase().includes(term) ||
        (item.supplier_type || '').toLowerCase().includes(term) ||
        (item.contact_person || '').toLowerCase().includes(term) ||
        (item.phone_number || '').toLowerCase().includes(term) ||
        (item.address || '').toLowerCase().includes(term) ||
        (item.bank_name || '').toLowerCase().includes(term)
      );
    }

    // Column Filters
    if (filterName.trim()) {
      const val = filterName.toLowerCase();
      list = list.filter(item => (item.name || '').toLowerCase().includes(val));
    }
    if (filterSupplierType.trim()) {
      const val = filterSupplierType.toLowerCase();
      list = list.filter(item => (item.supplier_type || '').toLowerCase().includes(val));
    }
    if (filterContactPerson.trim()) {
      const val = filterContactPerson.toLowerCase();
      list = list.filter(item => (item.contact_person || '').toLowerCase().includes(val));
    }
    if (filterPhoneNumber.trim()) {
      const val = filterPhoneNumber.toLowerCase();
      list = list.filter(item => (item.phone_number || '').toLowerCase().includes(val));
    }
    if (filterBankNumber.trim()) {
      const val = filterBankNumber.toLowerCase();
      list = list.filter(item => (item.bank_number || '').toLowerCase().includes(val));
    }
    if (filterBankName.trim()) {
      const val = filterBankName.toLowerCase();
      list = list.filter(item => (item.bank_name || '').toLowerCase().includes(val));
    }
    if (filterIF.trim()) {
      const val = filterIF.toLowerCase();
      list = list.filter(item => (item.IF || '').toLowerCase().includes(val));
    }
    if (filterICE.trim()) {
      const val = filterICE.toLowerCase();
      list = list.filter(item => (item.ICE || '').toLowerCase().includes(val));
    }
    if (filterAddress.trim()) {
      const val = filterAddress.toLowerCase();
      list = list.filter(item => (item.address || '').toLowerCase().includes(val));
    }

    // Sort
    if (sortField) {
      list.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        // Format dates if sorting by timestamps
        if (sortField === 'created_at' || sortField === 'updated_at') {
          valA = a[sortField]?.toMillis?.() || 0;
          valB = b[sortField]?.toMillis?.() || 0;
        }

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA);
        } else {
          return sortDirection === 'asc'
            ? (valA > valB ? 1 : -1)
            : (valB > valA ? 1 : -1);
        }
      });
    }

    return list;
  }, [
    suppliersList, 
    searchTerm, 
    sortField, 
    sortDirection,
    filterName,
    filterSupplierType,
    filterContactPerson,
    filterPhoneNumber,
    filterBankNumber,
    filterBankName,
    filterIF,
    filterICE,
    filterAddress
  ]);

  // Reset page when filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    filterName,
    filterSupplierType,
    filterContactPerson,
    filterPhoneNumber,
    filterBankNumber,
    filterBankName,
    filterIF,
    filterICE,
    filterAddress
  ]);

  const paginatedList = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredList, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;

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

  // --- Dynamic Table Padding Classes ---
  const densityPaddingClass = {
    compact: 'py-2 px-4 h-12 text-xs',
    normal: 'py-4 px-6 h-16 text-xs',
    tall: 'py-6 px-8 h-20 text-sm'
  }[density];

  if (!canList && !isLoading) {
    return <div className="p-8 text-center text-slate-500 font-bold">You do not have permission to view this module.</div>;
  }

  return (
    <div className={cn(
      "w-full bg-[#f3f3f3] min-h-screen transition-all duration-300",
      isFullscreen ? "fixed inset-0 z-50 p-6 overflow-y-auto bg-[#f3f3f3]" : "p-6 lg:p-8"
    )}>
      
      {/* 1. Header & Breadcrumbs */}
      <div className="max-w-[1600px] mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            <span className="hover:text-slate-600 cursor-pointer">Profile</span>
            <span className="opacity-40">/</span>
            <span className="text-[#7a9800] font-black uppercase">Suppliers</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">
            Suppliers List
          </h1>
        </div>

        {canAdd && (
          <div>
            <Button 
              asChild
              className="h-12 w-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 p-0"
            >
              <Link href="/supply-chain/suppliers/add">
                <Plus size={20} className="stroke-[3]" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* 2. Main High-Density Table Card */}
      <div className="max-w-[1600px] mx-auto">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden flex flex-col">
          
          {/* Table Control Bar */}
          <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            {/* Live Client Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search suppliers..."
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

            {/* Quick Actions Panel */}
            <div className="flex items-center gap-3 self-end md:self-auto">
              
              {/* Density Toggle */}
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

              {/* Column Selection Toggle */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 bg-white gap-2 font-bold text-slate-600 shadow-sm text-xs">
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl p-2 bg-white w-48">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-2 py-1 mb-1">Toggle Columns</p>
                  <DropdownMenuSeparator className="bg-slate-100 my-1" />
                  {Object.keys(visibleColumns).map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col}
                      checked={visibleColumns[col]}
                      onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, [col]: checked }))}
                      className="font-bold text-xs rounded-lg py-2 cursor-pointer capitalize"
                    >
                      {col.replace(/([A-Z])/g, ' $1')}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Filter Row Toggle */}
              <Button 
                variant="outline" 
                size="icon" 
                className={cn(
                  "h-10 w-10 rounded-xl border-slate-200 bg-white shadow-sm transition-all",
                  showFilters && "bg-slate-100 text-[#7a9800] border-[#7a9800]/30"
                )}
                onClick={() => {
                  if (showFilters) {
                    setFilterName('');
                    setFilterSupplierType('');
                    setFilterContactPerson('');
                    setFilterPhoneNumber('');
                    setFilterBankNumber('');
                    setFilterBankName('');
                    setFilterIF('');
                    setFilterICE('');
                    setFilterAddress('');
                  }
                  setShowFilters(prev => !prev);
                }}
              >
                {showFilters ? <FilterX size={16} /> : <Filter size={16} />}
              </Button>

              {/* Fullscreen Toggle */}
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
            <Table className="w-full min-w-[1200px] border-collapse">
              <TableHeader className="bg-slate-50 border-b border-slate-100">
                <TableRow className="hover:bg-transparent">
                  {/* Action Column on the LEFT side */}
                  <TableHead className="pl-6 md:pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 w-[80px]">
                    Actions
                  </TableHead>
                  {visibleColumns.name && renderSortHeader('Supplier Name', 'name')}
                  {visibleColumns.supplierType && renderSortHeader('Supplier Type', 'supplier_type')}
                  {visibleColumns.currency && renderSortHeader('Currency', 'currency')}
                  {visibleColumns.contactPerson && renderSortHeader('Contact Person', 'contact_person')}
                  {visibleColumns.phoneNumber && renderSortHeader('Phone Number', 'phone_number')}
                  {visibleColumns.bankNumber && renderSortHeader('Bank Number (RIB)', 'bank_number')}
                  {visibleColumns.bankName && renderSortHeader('Bank Name', 'bank_name')}
                  {visibleColumns.IF && renderSortHeader('IF', 'IF')}
                  {visibleColumns.ICE && renderSortHeader('ICE', 'ICE')}
                  {visibleColumns.address && renderSortHeader('Address', 'address')}
                  {visibleColumns.createdBy && renderSortHeader('Created By', 'created_by')}
                  {visibleColumns.updatedBy && renderSortHeader('Updated By', 'updated_by')}
                </TableRow>
                {showFilters && (
                  <TableRow className="bg-slate-50/50 hover:bg-transparent border-b border-slate-100">
                    <TableHead className="pl-6 md:pl-8 py-2 w-[80px]" />
                    {visibleColumns.name && (
                      <TableHead className="py-2 px-3">
                        <Input 
                          placeholder="Filter by Name" 
                          value={filterName}
                          onChange={e => setFilterName(e.target.value)}
                          className="h-8 rounded-lg text-[11px] font-medium border-slate-200 focus-visible:ring-[#7a9800] bg-white w-full"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.supplierType && (
                      <TableHead className="py-2 px-3">
                        <Input 
                          placeholder="Filter by Suppli..." 
                          value={filterSupplierType}
                          onChange={e => setFilterSupplierType(e.target.value)}
                          className="h-8 rounded-lg text-[11px] font-medium border-slate-200 focus-visible:ring-[#7a9800] bg-white w-full"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.contactPerson && (
                      <TableHead className="py-2 px-3">
                        <Input 
                          placeholder="Filter by Contact..." 
                          value={filterContactPerson}
                          onChange={e => setFilterContactPerson(e.target.value)}
                          className="h-8 rounded-lg text-[11px] font-medium border-slate-200 focus-visible:ring-[#7a9800] bg-white w-full"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.phoneNumber && (
                      <TableHead className="py-2 px-3">
                        <Input 
                          placeholder="Filter by Phone..." 
                          value={filterPhoneNumber}
                          onChange={e => setFilterPhoneNumber(e.target.value)}
                          className="h-8 rounded-lg text-[11px] font-medium border-slate-200 focus-visible:ring-[#7a9800] bg-white w-full"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.bankNumber && (
                      <TableHead className="py-2 px-3">
                        <Input 
                          placeholder="Filter by Bank Nu..." 
                          value={filterBankNumber}
                          onChange={e => setFilterBankNumber(e.target.value)}
                          className="h-8 rounded-lg text-[11px] font-medium border-slate-200 focus-visible:ring-[#7a9800] bg-white w-full"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.bankName && (
                      <TableHead className="py-2 px-3">
                        <Input 
                          placeholder="Filter by Ban..." 
                          value={filterBankName}
                          onChange={e => setFilterBankName(e.target.value)}
                          className="h-8 rounded-lg text-[11px] font-medium border-slate-200 focus-visible:ring-[#7a9800] bg-white w-full"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.IF && (
                      <TableHead className="py-2 px-3">
                        <Input 
                          placeholder="Filter by IF" 
                          value={filterIF}
                          onChange={e => setFilterIF(e.target.value)}
                          className="h-8 rounded-lg text-[11px] font-medium border-slate-200 focus-visible:ring-[#7a9800] bg-white w-full"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.ICE && (
                      <TableHead className="py-2 px-3">
                        <Input 
                          placeholder="Filter by ICE" 
                          value={filterICE}
                          onChange={e => setFilterICE(e.target.value)}
                          className="h-8 rounded-lg text-[11px] font-medium border-slate-200 focus-visible:ring-[#7a9800] bg-white w-full"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.address && (
                      <TableHead className="py-2 px-3">
                        <Input 
                          placeholder="Filter by Add..." 
                          value={filterAddress}
                          onChange={e => setFilterAddress(e.target.value)}
                          className="h-8 rounded-lg text-[11px] font-medium border-slate-200 focus-visible:ring-[#7a9800] bg-white w-full"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.createdBy && <TableHead className="py-2 px-3" />}
                    {visibleColumns.updatedBy && <TableHead className="py-2 px-3" />}
                  </TableRow>
                )}
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-[#7a9800]" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Suppliers...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                        <Search size={40} className="text-slate-400" />
                        <p className="font-black uppercase tracking-widest text-[10px]">No records found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedList.map((record) => (
                    <TableRow key={record.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none group">
                      
                      {/* Actions */}
                      <TableCell className={cn("pl-6 md:pl-8", densityPaddingClass)}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-lg transition-all">
                              <MoreVertical className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="rounded-xl border-slate-100 shadow-xl p-1 bg-white w-32">
                            <DropdownMenuItem 
                              onClick={() => router.push(`/supply-chain/suppliers/${record.id}`)}
                              className="font-bold gap-2 cursor-pointer py-2 px-3 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg"
                            >
                              <Eye size={13} className="text-slate-500" /> View
                            </DropdownMenuItem>
                            {canUpdate && (
                              <DropdownMenuItem 
                                onClick={() => router.push(`/supply-chain/suppliers/${record.id}/edit`)}
                                className="font-bold gap-2 cursor-pointer py-2 px-3 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg"
                              >
                                <Edit2 size={13} className="text-slate-500" /> Edit
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem 
                                onClick={() => {
                                  setRecordToDelete(record);
                                  setIsDeleteConfirmOpen(true);
                                }}
                                className="font-bold gap-2 cursor-pointer py-2 px-3 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                              >
                                <Trash2 size={13} className="text-rose-500" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>

                      {/* Name */}
                      {visibleColumns.name && (
                        <TableCell className={cn("font-bold text-slate-700 whitespace-nowrap", densityPaddingClass)}>
                          <Link href={`/supply-chain/suppliers/${record.id}`} className="font-black text-[#7a9800] hover:text-[#6c8500] transition-colors uppercase tracking-tight hover:underline underline-offset-4">
                            {record.name}
                          </Link>
                        </TableCell>
                      )}

                      {/* Supplier Type */}
                      {visibleColumns.supplierType && (
                        <TableCell className={cn(densityPaddingClass)}>
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#7a9800] bg-[#7a9800]/5 px-2.5 py-1.5 rounded-lg border border-[#7a9800]/10">
                            {record.supplier_type || 'Others'}
                          </span>
                        </TableCell>
                      )}

                      {/* Currency */}
                      {visibleColumns.currency && (
                        <TableCell className={cn(densityPaddingClass)}>
                          {(() => {
                            const curr = (record.currency || 'MAD').toUpperCase();
                            let CurrencyIcon = Coins;
                            if (curr.includes('EURO') || curr.includes('EUR')) CurrencyIcon = Euro;
                            else if (curr.includes('DOLLAR') || curr.includes('USD')) CurrencyIcon = DollarSign;
                            else if (curr.includes('POUND') || curr.includes('GBP')) CurrencyIcon = PoundSterling;

                            return (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-700 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200">
                                <CurrencyIcon className="h-3 w-3 text-slate-500" />
                                {record.currency || 'MAD'}
                              </span>
                            );
                          })()}
                        </TableCell>
                      )}

                      {/* Contact Person */}
                      {visibleColumns.contactPerson && (
                        <TableCell className={cn("font-bold text-slate-700 whitespace-nowrap", densityPaddingClass)}>
                          {record.contact_person}
                        </TableCell>
                      )}

                      {/* Phone Number */}
                      {visibleColumns.phoneNumber && (
                        <TableCell className={cn("font-semibold text-slate-600 whitespace-nowrap", densityPaddingClass)}>
                          {record.phone_number || <span className="text-slate-300 font-bold">-</span>}
                        </TableCell>
                      )}

                      {/* Bank Number */}
                      {visibleColumns.bankNumber && (
                        <TableCell className={cn("font-mono text-[11px] text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                          {record.bank_number || <span className="text-slate-300 font-bold">-</span>}
                        </TableCell>
                      )}

                      {/* Bank Name */}
                      {visibleColumns.bankName && (
                        <TableCell className={cn("font-bold text-slate-600 whitespace-nowrap", densityPaddingClass)}>
                          {record.bank_name || <span className="text-slate-300 font-bold">-</span>}
                        </TableCell>
                      )}

                      {/* IF */}
                      {visibleColumns.IF && (
                        <TableCell className={cn("font-bold text-slate-600 whitespace-nowrap", densityPaddingClass)}>
                          {record.IF || <span className="text-slate-300 font-bold">-</span>}
                        </TableCell>
                      )}

                      {/* ICE */}
                      {visibleColumns.ICE && (
                        <TableCell className={cn("font-bold text-slate-600 whitespace-nowrap", densityPaddingClass)}>
                          {record.ICE || <span className="text-slate-300 font-bold">-</span>}
                        </TableCell>
                      )}

                      {/* Address */}
                      {visibleColumns.address && (
                        <TableCell className={cn("font-medium text-slate-500 max-w-[250px] truncate", densityPaddingClass)} title={record.address}>
                          {record.address || <span className="text-slate-300 font-bold">-</span>}
                        </TableCell>
                      )}

                      {/* Created By */}
                      {visibleColumns.createdBy && (
                        <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700">{record.created_by?.split('@')[0] || record.created_by}</span>
                            <span className="text-[9px] text-slate-400 font-bold">
                              {record.created_at?.toDate ? format(record.created_at.toDate(), 'yyyy-MM-dd HH:mm') : '-'}
                            </span>
                          </div>
                        </TableCell>
                      )}

                      {/* Updated By */}
                      {visibleColumns.updatedBy && (
                        <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700">{record.updated_by?.split('@')[0] || record.updated_by}</span>
                            <span className="text-[9px] text-slate-400 font-bold">
                              {record.updated_at?.toDate ? format(record.updated_at.toDate(), 'yyyy-MM-dd HH:mm') : '-'}
                            </span>
                          </div>
                        </TableCell>
                      )}

                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 3. Pagination Controls */}
          <div className="p-4 md:p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Rows per page:</span>
              <Select value={String(itemsPerPage)} onValueChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}>
                <SelectTrigger className="h-8 w-20 border-slate-200 bg-white font-black text-slate-600 rounded-lg text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-lg border-slate-100 shadow-xl">
                  {[5, 10, 20, 50, 100].map(size => (
                    <SelectItem key={size} value={String(size)} className="font-bold text-[10px] cursor-pointer rounded-md">
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <span className="text-slate-500 font-bold">
              {filteredList.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}-
              {Math.min(filteredList.length, currentPage * itemsPerPage)} of {filteredList.length}
            </span>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                <ChevronsLeft size={16} className="text-slate-600" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                <ChevronLeft size={16} className="text-slate-600" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                <ChevronRight size={16} className="text-slate-600" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-100" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
                <ChevronsRight size={16} className="text-slate-600" />
              </Button>
            </div>
          </div>

        </div>
      </div>

      {/* --- DELETE CONFIRMATION ALERT DIALOG --- */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white rounded-3xl border-none shadow-2xl p-6 ring-1 ring-black/5">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-lg font-black text-[#2e1d52] uppercase tracking-tight">
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-semibold text-xs leading-normal">
              This action cannot be undone. This will permanently delete the supplier **{recordToDelete?.name}** and remove their information from the ERP.
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
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
