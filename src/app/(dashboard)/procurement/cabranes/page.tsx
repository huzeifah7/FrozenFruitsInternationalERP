'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Phone,
  User,
  Notebook,
  X,
  Filter,
  FilterX,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-permissions';

export default function CabranesPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { canAdd, canUpdate, canDelete } = usePermissions('procurement.cabranes');

  // --- Modals State ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any>(null);
  const [recordToDelete, setRecordToDelete] = useState<any>(null);

  // --- Form Input States ---
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<any>({});

  // --- Table Configuration States ---
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    phone: true,
    note: true,
    createdBy: true,
    updatedBy: true,
  });

  const [showFilters, setShowFilters] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterNote, setFilterNote] = useState('');

  const [itemsPerPage, setItemsPerPage] = useState(10);

  // --- Database Fetch ---
  const cabranesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'cabranes'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: cabranesList, isLoading } = useCollection(cabranesQuery);

  // --- Validation ---
  const validateForm = () => {
    const newErrors: any = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (phone.trim()) {
      const phoneRegex = /^[+0-9\s\-()]+$/;
      if (!phoneRegex.test(phone)) {
        newErrors.phone = 'Phone number must contain only numeric digits and valid characters (+, -, spaces, parentheses)';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Form Actions ---
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'cabranes'), {
        name: name.trim(),
        phone: phone.trim(),
        note: note.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.email || 'system',
        updatedBy: user.email || 'system'
      });

      toast({
        title: "Success",
        description: "Cabrane created successfully.",
      });

      resetForm();
      setIsAddModalOpen(false);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to create cabrane.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !recordToEdit) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const docRef = doc(db, 'cabranes', recordToEdit.id);
      await updateDoc(docRef, {
        name: name.trim(),
        phone: phone.trim(),
        note: note.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: user.email || 'system'
      });

      toast({
        title: "Success",
        description: "Cabrane updated successfully.",
      });

      resetForm();
      setIsEditModalOpen(false);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to update cabrane.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!db || !recordToDelete) return;
    try {
      await deleteDoc(doc(db, 'cabranes', recordToDelete.id));
      toast({
        title: "Success",
        description: "Cabrane deleted successfully.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to delete cabrane.",
        variant: "destructive"
      });
    } finally {
      setIsDeleteConfirmOpen(false);
      setRecordToDelete(null);
    }
  };

  const openEditModal = (record: any) => {
    setRecordToEdit(record);
    setName(record.name || '');
    setPhone(record.phone || '');
    setNote(record.note || '');
    setErrors({});
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setNote('');
    setErrors({});
    setRecordToEdit(null);
  };

  // --- Filtering & Sorting & Pagination ---
  const filteredList = useMemo(() => {
    if (!cabranesList) return [];
    let list = [...cabranesList];

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(item => 
        (item.name || '').toLowerCase().includes(term) ||
        (item.phone || '').toLowerCase().includes(term) ||
        (item.note || '').toLowerCase().includes(term)
      );
    }

    // Column Filters
    if (filterName.trim()) {
      const val = filterName.toLowerCase();
      list = list.filter(item => (item.name || '').toLowerCase().includes(val));
    }
    if (filterPhone.trim()) {
      const val = filterPhone.toLowerCase();
      list = list.filter(item => (item.phone || '').toLowerCase().includes(val));
    }
    if (filterNote.trim()) {
      const val = filterNote.toLowerCase();
      list = list.filter(item => (item.note || '').toLowerCase().includes(val));
    }

    // Sort
    if (sortField) {
      list.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        // Format dates if sorting by timestamps
        if (sortField === 'createdAt' || sortField === 'updatedAt') {
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
    cabranesList, 
    searchTerm, 
    sortField, 
    sortDirection, 
    filterName, 
    filterPhone, 
    filterNote
  ]);

  // Reset page when filtering
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterName, filterPhone, filterNote]);

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
            <span className="text-[#7a9800] font-black uppercase">Raw Materials Cabranes</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">
            Raw Materials Cabranes
          </h1>
        </div>

        {canAdd && (
          <div>
            <Button 
              onClick={() => {
                resetForm();
                setIsAddModalOpen(true);
              }}
              className="h-12 w-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            >
              <Plus size={20} className="stroke-[3]" />
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
                placeholder="Search by name, phone, note..."
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
                    setFilterPhone('');
                    setFilterNote('');
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
            <Table className="w-full min-w-[1000px] border-collapse">
              <TableHeader className="bg-slate-50 border-b border-slate-100">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6 md:pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 w-[80px]">
                    Actions
                  </TableHead>
                  {visibleColumns.name && renderSortHeader('Name', 'name')}
                  {visibleColumns.phone && renderSortHeader('Phone Number', 'phone')}
                  {visibleColumns.note && renderSortHeader('Note', 'note')}
                  {visibleColumns.createdBy && renderSortHeader('Created By', 'createdBy')}
                  {visibleColumns.updatedBy && renderSortHeader('Updated By', 'updatedBy')}
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
                    {visibleColumns.phone && (
                      <TableHead className="py-2 px-3">
                        <Input 
                          placeholder="Filter by Phone..." 
                          value={filterPhone}
                          onChange={e => setFilterPhone(e.target.value)}
                          className="h-8 rounded-lg text-[11px] font-medium border-slate-200 focus-visible:ring-[#7a9800] bg-white w-full"
                        />
                      </TableHead>
                    )}
                    {visibleColumns.note && (
                      <TableHead className="py-2 px-3">
                        <Input 
                          placeholder="Filter by Note..." 
                          value={filterNote}
                          onChange={e => setFilterNote(e.target.value)}
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
                    <TableCell colSpan={6} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-[#7a9800]" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Cabranes...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginatedList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center">
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
                            {canUpdate && (
                              <DropdownMenuItem 
                                onClick={() => openEditModal(record)}
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
                          {record.name}
                        </TableCell>
                      )}

                      {/* Phone Number */}
                      {visibleColumns.phone && (
                        <TableCell className={cn("font-semibold text-slate-600 whitespace-nowrap", densityPaddingClass)}>
                          {record.phone || <span className="text-slate-300 font-bold">-</span>}
                        </TableCell>
                      )}

                      {/* Note */}
                      {visibleColumns.note && (
                        <TableCell className={cn("font-medium text-slate-500 max-w-[250px] truncate", densityPaddingClass)} title={record.note}>
                          {record.note || <span className="text-slate-300 font-bold">-</span>}
                        </TableCell>
                      )}

                      {/* Created By */}
                      {visibleColumns.createdBy && (
                        <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700">{record.createdBy?.split('@')[0] || record.createdBy}</span>
                            <span className="text-[9px] text-slate-400 font-bold">
                              {record.createdAt ? format(record.createdAt.toDate(), 'yyyy-MM-dd HH:mm') : '-'}
                            </span>
                          </div>
                        </TableCell>
                      )}

                      {/* Updated By */}
                      {visibleColumns.updatedBy && (
                        <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-700">{record.updatedBy?.split('@')[0] || record.updatedBy}</span>
                            <span className="text-[9px] text-slate-400 font-bold">
                              {record.updatedAt ? format(record.updatedAt.toDate(), 'yyyy-MM-dd HH:mm') : '-'}
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

      {/* --- ADD CABRANE MODAL --- */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[550px] bg-white rounded-3xl border-none shadow-2xl p-0 overflow-hidden ring-1 ring-black/5 animate-in fade-in duration-300">
          <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <DialogTitle className="text-xl font-black text-[#2e1d52] uppercase tracking-tight">
              Add Cabrane
            </DialogTitle>
          </div>
          <form onSubmit={handleAddSubmit} className="p-8 space-y-6">
            
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name *</Label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="name"
                  placeholder="Enter full name..."
                  className={cn(
                    "h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] pl-10",
                    errors.name && "ring-2 ring-rose-500"
                  )}
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              {errors.name && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider">{errors.name}</p>}
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</Label>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="phone"
                  placeholder="e.g. +212 600 000 000"
                  className={cn(
                    "h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] pl-10",
                    errors.phone && "ring-2 ring-rose-500"
                  )}
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
              {errors.phone && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider">{errors.phone}</p>}
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="note" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Note</Label>
              <div className="relative">
                <Notebook size={16} className="absolute left-3.5 top-5 text-slate-400" />
                <Textarea
                  id="note"
                  placeholder="Enter remarks or notes..."
                  className="rounded-xl bg-slate-50 border-none font-semibold text-slate-800 focus-visible:ring-[#7a9800] pl-10 min-h-[100px] resize-none"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
            </div>

            {/* Submit Bar */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 px-12 bg-[#7a9800] hover:bg-[#6c8500] text-white font-black rounded-xl shadow-lg shadow-[#7a9800]/20 uppercase tracking-widest text-xs min-w-[160px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" /> SUBMITTING...
                  </>
                ) : (
                  'SUBMIT'
                )}
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>

      {/* --- EDIT CABRANE MODAL --- */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[550px] bg-white rounded-3xl border-none shadow-2xl p-0 overflow-hidden ring-1 ring-black/5 animate-in fade-in duration-300">
          <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between">
            <DialogTitle className="text-xl font-black text-[#2e1d52] uppercase tracking-tight">
              Edit Cabrane
            </DialogTitle>
          </div>
          <form onSubmit={handleEditSubmit} className="p-8 space-y-6">
            
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="editName" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name *</Label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="editName"
                  placeholder="Enter full name..."
                  className={cn(
                    "h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] pl-10",
                    errors.name && "ring-2 ring-rose-500"
                  )}
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              {errors.name && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider">{errors.name}</p>}
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="editPhone" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</Label>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  id="editPhone"
                  placeholder="e.g. +212 600 000 000"
                  className={cn(
                    "h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] pl-10",
                    errors.phone && "ring-2 ring-rose-500"
                  )}
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
              {errors.phone && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider">{errors.phone}</p>}
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="editNote" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Note</Label>
              <div className="relative">
                <Notebook size={16} className="absolute left-3.5 top-5 text-slate-400" />
                <Textarea
                  id="editNote"
                  placeholder="Enter remarks or notes..."
                  className="rounded-xl bg-slate-50 border-none font-semibold text-slate-800 focus-visible:ring-[#7a9800] pl-10 min-h-[100px] resize-none"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
            </div>

            {/* Submit Bar */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 px-12 bg-[#7a9800] hover:bg-[#6c8500] text-white font-black rounded-xl shadow-lg shadow-[#7a9800]/20 uppercase tracking-widest text-xs min-w-[160px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" /> UPDATING...
                  </>
                ) : (
                  'UPDATE'
                )}
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>

      {/* --- DELETE CONFIRMATION ALERT DIALOG --- */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-6 max-w-[450px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-[#2e1d52] uppercase tracking-tight">Delete Cabrane?</AlertDialogTitle>
            <AlertDialogDescription className="font-semibold text-slate-500 mt-2 text-sm leading-relaxed">
              Are you sure you want to delete this cabrane?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6 border-t border-slate-50 pt-4 flex items-center justify-end">
            <AlertDialogCancel className="h-10 px-5 rounded-xl font-bold uppercase tracking-widest text-[10px] text-slate-500 hover:bg-slate-50 border-slate-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              className="h-10 px-6 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-lg shadow-rose-200 uppercase tracking-widest text-[10px]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
