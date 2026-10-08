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
  X,
  Package,
  CalendarDays,
  MapPin,
  ClipboardList
} from 'lucide-react';
import Link from 'next/link';

export default function StockInventoriesListingPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // --- UI States ---
  const [activeTab, setActiveTab] = useState<'groupByLocation' | 'listing'>('groupByLocation');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // --- Modals State ---
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<any>(null);

  // --- Table Configuration States ---
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filters from Tab 1 to Tab 2
  const [filterLocation, setFilterLocation] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // --- Database Fetch ---
  const inventoriesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'stock_inventories'), orderBy('created_at', 'desc'));
  }, [db]);

  const { data: inventoriesList, isLoading } = useCollection(inventoriesQuery);

  // --- Grouped Data ---
  const groupedInventories = useMemo(() => {
    if (!inventoriesList) return [];
    const map = new Map<string, any>();
    
    inventoriesList.forEach(inv => {
      const loc = inv.locationName || 'Unknown Location';
      const dt = inv.date || 'Unknown Date';
      const key = `${loc}_${dt}`;
      
      if (!map.has(key)) {
        map.set(key, { 
          id: key,
          locationName: loc, 
          date: dt, 
          itemsCount: 1, 
          totalQuantity: Number(inv.quantity || 0) 
        });
      } else {
        const g = map.get(key);
        g.itemsCount += 1;
        g.totalQuantity += Number(inv.quantity || 0);
      }
    });
    
    let list = Array.from(map.values());
    
    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(g => 
        g.locationName.toLowerCase().includes(term) ||
        g.date.toLowerCase().includes(term)
      );
    }
    
    // Sort logic
    if (sortField) {
      list.sort((a, b) => {
        let valA = a[sortField] || '';
        let valB = b[sortField] || '';
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
      });
    }
    
    return list;
  }, [inventoriesList, searchTerm, sortField, sortDirection]);

  // --- Listing Data ---
  const filteredListing = useMemo(() => {
    if (!inventoriesList) return [];
    let list = [...inventoriesList];

    // Apply explicit filters if navigating from Group tab
    if (filterLocation) {
      list = list.filter(item => (item.locationName || 'Unknown Location') === filterLocation);
    }
    if (filterDate) {
      list = list.filter(item => (item.date || 'Unknown Date') === filterDate);
    }

    // Apply text search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(item => 
        (item.locationName || '').toLowerCase().includes(term) ||
        (item.date || '').toLowerCase().includes(term) ||
        (item.consumableName || '').toLowerCase().includes(term) ||
        (item.note || '').toLowerCase().includes(term)
      );
    }

    // Sort logic
    if (sortField) {
      list.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'created_at' || sortField === 'updated_at') {
          valA = a[sortField]?.toMillis?.() || 0;
          valB = b[sortField]?.toMillis?.() || 0;
        }

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortDirection === 'asc' ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
      });
    }

    return list;
  }, [inventoriesList, searchTerm, sortField, sortDirection, filterLocation, filterDate]);

  // Pagination logic
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab, filterLocation, filterDate]);

  const currentList = activeTab === 'groupByLocation' ? groupedInventories : filteredListing;
  const totalPages = Math.ceil(currentList.length / itemsPerPage) || 1;
  const paginatedList = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return currentList.slice(startIndex, startIndex + itemsPerPage);
  }, [currentList, currentPage]);

  // --- Handlers ---
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const handleGroupRowClick = (location: string, date: string) => {
    router.push(`/supply-chain/stock-inventories/group-details?location=${encodeURIComponent(location)}&date=${encodeURIComponent(date)}`);
  };

  const clearFilters = () => {
    setFilterLocation('');
    setFilterDate('');
  };

  const handleDelete = async () => {
    if (!db || !recordToDelete) return;
    try {
      await deleteDoc(doc(db, 'stock_inventories', recordToDelete.id));
      toast({ title: "Success", description: "Stock inventory deleted successfully." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to delete stock inventory.", variant: "destructive" });
    } finally {
      setIsDeleteConfirmOpen(false);
      setRecordToDelete(null);
    }
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
          <ArrowUpDown className={cn("h-3 w-3 transition-opacity", isActive ? "opacity-100 text-[#7a9800]" : "opacity-35")} />
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
      
      {/* 1. Header & Breadcrumbs */}
      <div className="max-w-[1600px] mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            <span className="hover:text-slate-600 cursor-pointer">Profile</span>
            <span className="opacity-40">/</span>
            <span className="text-[#7a9800] font-black uppercase">Stock Inventories</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">
            Stock Inventories
          </h1>
        </div>

        <div>
          <Button 
            asChild
            className="h-12 w-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 p-0"
          >
            <Link href="/supply-chain/stock-inventories/add">
              <Plus size={20} className="stroke-[3]" />
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Main High-Density Table Card */}
      <div className="max-w-[1600px] mx-auto">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden flex flex-col">
          
          {/* Tabs */}
          <div className="flex items-center gap-2 px-6 pt-6 border-b border-slate-100 overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setActiveTab('groupByLocation')}
              className={cn(
                "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 flex items-center gap-2",
                activeTab === 'groupByLocation'
                  ? "border-[#7a9800] text-[#7a9800]"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
              )}
            >
              <MapPin size={16} /> Group By Location & Date
            </button>
            <button
              onClick={() => setActiveTab('listing')}
              className={cn(
                "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 flex items-center gap-2",
                activeTab === 'listing'
                  ? "border-[#7a9800] text-[#7a9800]"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
              )}
            >
              <ClipboardList size={16} /> Listing
            </button>
          </div>

          {/* Table Control Bar */}
          <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search..."
                  className="h-10 pl-10 pr-4 rounded-xl border-slate-200 bg-white focus-visible:ring-[#7a9800] font-medium placeholder-slate-400 text-slate-700 text-xs w-full shadow-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              
              {/* Active Filter Indicators */}
              {(filterLocation || filterDate) && activeTab === 'listing' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Filtered by:</span>
                  {filterLocation && (
                    <span className="bg-[#7a9800]/10 text-[#7a9800] px-3 py-1.5 rounded-lg text-xs font-bold border border-[#7a9800]/20 flex items-center gap-2">
                      {filterLocation}
                      <X size={12} className="cursor-pointer hover:text-rose-500" onClick={() => setFilterLocation('')} />
                    </span>
                  )}
                  {filterDate && (
                    <span className="bg-[#7a9800]/10 text-[#7a9800] px-3 py-1.5 rounded-lg text-xs font-bold border border-[#7a9800]/20 flex items-center gap-2">
                      {filterDate}
                      <X size={12} className="cursor-pointer hover:text-rose-500" onClick={() => setFilterDate('')} />
                    </span>
                  )}
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-rose-500 text-xs font-bold hover:bg-rose-50 hover:text-rose-600 rounded-lg">
                    Clear All
                  </Button>
                </div>
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
            {activeTab === 'groupByLocation' && (
              <Table className="w-full min-w-[800px] border-collapse">
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent">
                    {renderSortHeader('Location', 'locationName')}
                    {renderSortHeader('Date', 'date')}
                    {renderSortHeader('Items Count', 'itemsCount')}
                    {renderSortHeader('Total Quantity', 'totalQuantity')}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-[#7a9800]" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Groups...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                          <Search size={40} className="text-slate-400" />
                          <p className="font-black uppercase tracking-widest text-[10px]">No records found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedList.map((group) => (
                      <TableRow 
                        key={group.id} 
                        className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none group cursor-pointer"
                        onClick={() => handleGroupRowClick(group.locationName, group.date)}
                        title="Click to view details"
                      >
                        <TableCell className={cn("font-bold text-[#7a9800] whitespace-nowrap", densityPaddingClass)}>
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="opacity-50" />
                            {group.locationName}
                          </div>
                        </TableCell>
                        <TableCell className={cn("font-bold text-slate-600 whitespace-nowrap", densityPaddingClass)}>
                          <div className="flex items-center gap-2">
                            <CalendarDays size={16} className="opacity-50" />
                            {group.date}
                          </div>
                        </TableCell>
                        <TableCell className={cn("font-black text-slate-700 whitespace-nowrap", densityPaddingClass)}>
                          <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs">
                            {group.itemsCount} Items
                          </span>
                        </TableCell>
                        <TableCell className={cn("font-black text-slate-700 whitespace-nowrap", densityPaddingClass)}>
                          <span className="bg-[#7a9800]/10 text-[#7a9800] px-3 py-1.5 rounded-lg text-xs border border-[#7a9800]/20">
                            {group.totalQuantity.toLocaleString()} Total
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {activeTab === 'listing' && (
              <Table className="w-full min-w-[1200px] border-collapse">
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 md:pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 w-[80px]">
                      Actions
                    </TableHead>
                    {renderSortHeader('Location', 'locationName')}
                    {renderSortHeader('Date', 'date')}
                    {renderSortHeader('Consumable', 'consumableName')}
                    {renderSortHeader('Quantity', 'quantity')}
                    {renderSortHeader('Note', 'note')}
                    {renderSortHeader('Created By', 'created_by')}
                    {renderSortHeader('Updated By', 'updated_by')}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-[#7a9800]" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Inventories...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-64 text-center">
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
                                onClick={() => router.push(`/supply-chain/stock-inventories/${record.id}/edit`)}
                                className="font-bold gap-2 cursor-pointer py-2 px-3 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-lg"
                              >
                                <Edit2 size={13} className="text-slate-500" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setRecordToDelete(record);
                                  setIsDeleteConfirmOpen(true);
                                }}
                                className="font-bold gap-2 cursor-pointer py-2 px-3 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                              >
                                <Trash2 size={13} className="text-rose-500" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>

                        {/* Location */}
                        <TableCell className={cn("font-bold text-slate-700 whitespace-nowrap", densityPaddingClass)}>
                          {record.locationName || '—'}
                        </TableCell>

                        {/* Date */}
                        <TableCell className={cn("font-bold text-slate-600 whitespace-nowrap", densityPaddingClass)}>
                          {record.date || '—'}
                        </TableCell>

                        {/* Consumable */}
                        <TableCell className={cn("font-black text-[#7a9800] whitespace-nowrap", densityPaddingClass)}>
                          {record.consumableName || '—'}
                        </TableCell>

                        {/* Quantity */}
                        <TableCell className={cn("font-black text-slate-700 whitespace-nowrap", densityPaddingClass)}>
                          {Number(record.quantity || 0).toLocaleString()}
                        </TableCell>

                        {/* Note */}
                        <TableCell className={cn("font-medium text-slate-500 max-w-[200px] truncate", densityPaddingClass)} title={record.note}>
                          {record.note || '—'}
                        </TableCell>

                        {/* Created By */}
                        <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700">{record.created_by?.split('@')[0] || record.created_by || '—'}</span>
                            <span className="text-[9px] text-slate-400 font-bold">
                              {record.created_at ? format(record.created_at.toDate(), 'yyyy-MM-dd HH:mm') : '—'}
                            </span>
                          </div>
                        </TableCell>

                        {/* Updated By */}
                        <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700">{record.updated_by?.split('@')[0] || record.updated_by || '—'}</span>
                            <span className="text-[9px] text-slate-400 font-bold">
                              {record.updated_at ? format(record.updated_at.toDate(), 'yyyy-MM-dd HH:mm') : '—'}
                            </span>
                          </div>
                        </TableCell>

                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* 3. Pagination Controls */}
          <div className="p-4 md:p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <span>Showing {Math.min(currentList.length, currentPage * itemsPerPage)} of {currentList.length} Record(s)</span>
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

      {/* --- DELETE CONFIRMATION ALERT DIALOG --- */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white rounded-3xl border-none shadow-2xl p-6 ring-1 ring-black/5">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-lg font-black text-[#2e1d52] uppercase tracking-tight">
              Delete Stock Inventory
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-semibold text-xs leading-normal">
              Are you sure you want to delete this stock inventory?
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
