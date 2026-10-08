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
  doc,
} from '@/firebase/firestore-override';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  useUser,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Truck,
  Users,
  List,
  Download,
  Loader2,
  Package,
  Archive,
  ArrowDownToLine,
  ArrowUpFromLine,
  MoreVertical,
  Edit2,
  Trash2 as TrashIcon,
  Eye,
  ArrowUpDown,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { usePermissions } from '@/hooks/use-permissions';

export default function CratesFollowUpPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { canAdd, canUpdate, canDelete } = usePermissions('production.crates');

  const [mainTab, setMainTab] = useState('EXPORT_OPTIMUM');
  const [activeTab, setActiveTab] = useState('group-plate');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any>(null);
  const [recordToView, setRecordToView] = useState<any>(null);
  const [recordToDelete, setRecordToDelete] = useState<any>(null);

  // Sorting and Pagination State for Listing
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form State
  const [boxType, setBoxType] = useState('EXPORT_OPTIMUM');
  const [supplierId, setSupplierId] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [boxes, setBoxes] = useState('');
  const [operationType, setOperationType] = useState('OUT');
  const [note, setNote] = useState('');
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().split('T')[0]);

  // Reset pagination when boxType/mainTab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [mainTab]);

  // Queries
  const cratesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'crates_follow_up'), orderBy('createdAt', 'desc'));
  }, [db]);

  const suppliersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'procurement_suppliers'), orderBy('name', 'asc'));
  }, [db]);

  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'raw_materials'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: cratesList, isLoading: isLoadingCrates } = useCollection(cratesQuery);
  const { data: suppliersList } = useCollection(suppliersQuery);
  const { data: rawMaterialsList, isLoading: isLoadingRm } = useCollection(rawMaterialsQuery);

  // Procurement Suppliers are now fetched directly from the procurement_suppliers collection
  const procurementSuppliers = useMemo(() => {
    if (!suppliersList) return [];
    return suppliersList;
  }, [suppliersList]);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    if (!supplierId || !plateNumber || !driverName || !boxes || !operationType) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    const selectedSupplier = suppliersList?.find((s) => s.id === supplierId);
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'crates_follow_up'), {
        boxType,
        supplierId,
        supplierName: selectedSupplier?.name || 'Unknown',
        plateNumber: plateNumber.toUpperCase(),
        driverName,
        boxes: Number(boxes),
        operationType,
        note,
        shiftDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.email,
        updatedBy: user.email,
      });

      toast({
        title: 'Success',
        description: 'Crate follow up added successfully.',
      });

      // Reset form
      setSupplierId('');
      setPlateNumber('');
      setDriverName('');
      setBoxes('');
      setOperationType('');
      setNote('');
      setIsAddModalOpen(false);
      setBoxType(mainTab);
    } catch (error) {
      console.error('Error adding crate follow up:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add record.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!db || !recordToDelete) return;
    try {
      await deleteDoc(doc(db, 'crates_follow_up', recordToDelete.id));
      toast({ title: 'Success', description: 'Record deleted successfully.' });
    } catch (error) {
      console.error('Error deleting record:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete record.' });
    } finally {
      setIsDeleteConfirmOpen(false);
      setRecordToDelete(null);
    }
  };

  const openEditModal = (record: any) => {
    setRecordToEdit(record);
    setBoxType(record.boxType || 'EXPORT_OPTIMUM');
    setSupplierId(record.supplierId || '');
    setPlateNumber(record.plateNumber || '');
    setDriverName(record.driverName || '');
    setBoxes(String(record.boxes || ''));
    setOperationType(record.operationType || 'OUT');
    setNote(record.note || '');
    setShiftDate(record.shiftDate || '');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !recordToEdit) return;
    
    setIsSubmitting(true);
    try {
      const selectedSupplier = suppliersList?.find((s) => s.id === supplierId);
      await updateDoc(doc(db, 'crates_follow_up', recordToEdit.id), {
        boxType,
        supplierId,
        supplierName: selectedSupplier?.name || 'Unknown',
        plateNumber: plateNumber.toUpperCase(),
        driverName,
        boxes: Number(boxes),
        operationType,
        note,
        shiftDate,
        updatedAt: serverTimestamp(),
        updatedBy: user.email,
      });

      toast({ title: 'Success', description: 'Record updated successfully.' });
      setIsEditModalOpen(false);
      setRecordToEdit(null);
    } catch (error) {
      console.error('Error updating record:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update record.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Data Filtering by Box Type
  const filteredCrates = useMemo(() => {
    if (!cratesList) return [];
    // If a record doesn't have boxType, default to EXPORT_OPTIMUM for legacy reasons? 
    // Or check if supplier/plate matches something. 
    // For now, if no boxType, we'll try to guess or just put it in EXPORT_OPTIMUM.
    return cratesList.filter(c => {
      const type = c.boxType || 'EXPORT_OPTIMUM';
      return type === mainTab;
    });
  }, [cratesList, mainTab]);

  const filteredRawMaterials = useMemo(() => {
    if (!rawMaterialsList) return [];
    return rawMaterialsList.filter(rm => {
      // Prioritize explicit boxType if available
      if (rm.boxType) {
        return rm.boxType === mainTab;
      }

      // Fallback for older records
      const isEOF = rm.farmCodification?.toUpperCase() === 'EOF' || 
                    rm.farmName?.toLowerCase()?.includes('export optimum');
      
      if (mainTab === 'EXPORT_OPTIMUM') return isEOF;
      return !isEOF; // Everything else is Agricenter
    });
  }, [rawMaterialsList, mainTab]);

  // Summary Calculations
  const { totalBoxes, totalIn, totalOut, initialStock } = useMemo(() => {
    let outCount = 0;
    let inCount = 0;

    filteredCrates.forEach(curr => {
      const amt = Number(curr.boxes || 0);
      if (curr.operationType === 'IN') inCount += amt;
      else outCount += amt;
    });

    filteredRawMaterials.forEach(rm => {
      inCount += Number(rm.boxesIn || 0);
      outCount += Number(rm.boxesOut || 0);
    });

    const baseline = mainTab === 'AGRICENTER' ? 0 : 13220;
    const calculatedTotalBoxes = baseline + inCount - outCount;

    return { totalBoxes: calculatedTotalBoxes, totalIn: inCount, totalOut: outCount, initialStock: baseline };
  }, [filteredCrates, filteredRawMaterials, mainTab]);

  // Calculations
  const plateAggregations = useMemo(() => {
    const acc: Record<string, any> = {};
    
    filteredCrates.forEach(curr => {
      const plate = curr.plateNumber || 'Unknown';
      if (!acc[plate]) acc[plate] = { plateNumber: plate, driverName: curr.driverName || 'Multiple', boxesOut: 0, boxesIn: 0, entries: 0 };
      
      const amt = Number(curr.boxes || 0);
      if (curr.operationType === 'IN') acc[plate].boxesIn += amt;
      else acc[plate].boxesOut += amt;
      
      acc[plate].entries += 1;
    });

    filteredRawMaterials.forEach(rm => {
      const inAmt = Number(rm.boxesIn || 0);
      const outAmt = Number(rm.boxesOut || 0);
      if (inAmt > 0 || outAmt > 0) {
        const plate = rm.plateNumber || 'Unknown';
        if (!acc[plate]) acc[plate] = { plateNumber: plate, driverName: rm.driverName || 'Multiple', boxesOut: 0, boxesIn: 0, entries: 0 };
        acc[plate].boxesIn += inAmt;
        acc[plate].boxesOut += outAmt;
        acc[plate].entries += 1;
      }
    });

    return Object.values(acc).map((item: any) => ({
      ...item,
      difference: item.boxesOut - item.boxesIn
    }));
  }, [filteredCrates, filteredRawMaterials]);

  const supplierAggregations = useMemo(() => {
    const acc: Record<string, any> = {};
    
    filteredCrates.forEach(curr => {
      const supp = curr.supplierName || 'Unknown';
      if (!acc[supp]) acc[supp] = { supplierName: supp, boxesOut: 0, boxesIn: 0, entries: 0 };
      
      const amt = Number(curr.boxes || 0);
      if (curr.operationType === 'IN') acc[supp].boxesIn += amt;
      else acc[supp].boxesOut += amt;
      
      acc[supp].entries += 1;
    });

    filteredRawMaterials.forEach(rm => {
      const inAmt = Number(rm.boxesIn || 0);
      const outAmt = Number(rm.boxesOut || 0);
      if (inAmt > 0 || outAmt > 0) {
        const supp = suppliersList?.find(s => s.id === rm.supplierId)?.name || rm.farmName || 'Unknown';
        if (!acc[supp]) acc[supp] = { supplierName: supp, boxesOut: 0, boxesIn: 0, entries: 0 };
        acc[supp].boxesIn += inAmt;
        acc[supp].boxesOut += outAmt;
        acc[supp].entries += 1;
      }
    });

    return Object.values(acc).map((item: any) => ({
      ...item,
      difference: item.boxesOut - item.boxesIn
    }));
  }, [filteredCrates, filteredRawMaterials, suppliersList]);

  // Combined Listing
  const combinedListing = useMemo(() => {
    const combined: any[] = [];
    filteredCrates.forEach(c => {
      combined.push({
        id: c.id,
        boxType: c.boxType || 'EXPORT_OPTIMUM',
        shiftDate: c.shiftDate || c.createdAt?.toDate?.()?.toISOString()?.split('T')[0] || '-',
        supplierId: c.supplierId,
        supplierName: c.supplierName || 'Unknown',
        plateNumber: c.plateNumber || '-',
        driverName: c.driverName || '-',
        operationType: c.operationType || 'OUT',
        boxes: Number(c.boxes || 0),
        note: c.note || '',
        createdBy: c.createdBy || '-',
        createdAt: c.createdAt?.toMillis?.() || 0,
        source: 'manual'
      });
    });
    filteredRawMaterials.forEach(rm => {
      if (Number(rm.boxesIn || 0) > 0) {
        combined.push({
          id: rm.id + '_IN',
          shiftDate: rm.date || rm.dateTime?.split('T')[0] || '-',
          supplierId: rm.supplierId,
          supplierName: suppliersList?.find(s => s.id === rm.supplierId)?.name || rm.farmName || 'Unknown',
          plateNumber: rm.plateNumber || '-',
          driverName: rm.driverName || '-',
          lotNumber: rm.lotNumber || '-',
          operationType: 'IN',
          boxes: Number(rm.boxesIn || 0),
          note: rm.remarks || 'From Raw Materials (IN)',
          createdBy: rm.createdBy || '-',
          createdAt: rm.createdAt?.toMillis?.() || 0,
          source: 'raw_materials'
        });
      }
      if (Number(rm.boxesOut || 0) > 0) {
        combined.push({
          id: rm.id + '_OUT',
          shiftDate: rm.date || rm.dateTime?.split('T')[0] || '-',
          supplierId: rm.supplierId,
          supplierName: suppliersList?.find(s => s.id === rm.supplierId)?.name || rm.farmName || 'Unknown',
          plateNumber: rm.plateNumber || '-',
          driverName: rm.driverName || '-',
          lotNumber: rm.lotNumber || '-',
          operationType: 'OUT',
          boxes: Number(rm.boxesOut || 0),
          note: rm.remarks || 'From Raw Materials (OUT)',
          createdBy: rm.createdBy || '-',
          createdAt: rm.createdAt?.toMillis?.() || 0,
          source: 'raw_materials'
        });
      }
    });
    return combined.sort((a, b) => b.createdAt - a.createdAt);
  }, [filteredCrates, filteredRawMaterials, suppliersList]);

  // Client-side Sorting & Pagination for Listing tab
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const sortedCombinedListing = useMemo(() => {
    let sorted = [...combinedListing];
    if (sortField) {
      sorted.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        // Custom getters for virtual fields
        if (sortField === 'boxesOut') {
          valA = a.operationType === 'OUT' ? a.boxes : 0;
          valB = b.operationType === 'OUT' ? b.boxes : 0;
        } else if (sortField === 'boxesIn') {
          valA = a.operationType === 'IN' ? a.boxes : 0;
          valB = b.operationType === 'IN' ? b.boxes : 0;
        } else if (sortField === 'difference') {
          const outA = a.operationType === 'OUT' ? a.boxes : 0;
          const inA = a.operationType === 'IN' ? a.boxes : 0;
          valA = outA - inA;

          const outB = b.operationType === 'OUT' ? b.boxes : 0;
          const inB = b.operationType === 'IN' ? b.boxes : 0;
          valB = outB - inB;
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
    return sorted;
  }, [combinedListing, sortField, sortDirection]);

  const paginatedCombinedListing = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedCombinedListing.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedCombinedListing, currentPage]);

  const totalPages = Math.ceil(sortedCombinedListing.length / itemsPerPage) || 1;

  const renderSortHeader = (label: string, field: string, align: 'left' | 'center' = 'left') => {
    const isActive = sortField === field;
    return (
      <TableHead 
        className={cn(
          "py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap cursor-pointer select-none transition-colors hover:text-primary",
          align === 'center' ? 'text-center' : 'text-left',
          isActive && "text-primary/70"
        )}
        onClick={() => handleSort(field)}
      >
        <div className={cn("flex items-center gap-1.5", align === 'center' ? 'justify-center' : 'justify-start')}>
          {label}
          <ArrowUpDown className={cn(
            "h-3 w-3 transition-opacity", 
            isActive ? "opacity-100 text-primary" : "opacity-30 group-hover:opacity-60"
          )} />
        </div>
      </TableHead>
    );
  };

  // Exports
  const exportPlateData = () => {
    const ws = XLSX.utils.json_to_sheet(plateAggregations.map(row => ({
      'Plate Number': row.plateNumber,
      'Driver Name': row.driverName,
      'Total Boxes OUT': row.boxesOut,
      'Total Boxes IN': row.boxesIn,
      'Difference (OUT - IN)': row.difference,
      'Total Entries': row.entries
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plate Analytics');
    XLSX.writeFile(wb, `crates_plate_analytics_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportSupplierData = () => {
    const ws = XLSX.utils.json_to_sheet(supplierAggregations.map(row => ({
      'Supplier Name': row.supplierName,
      'Total Boxes OUT': row.boxesOut,
      'Total Boxes IN': row.boxesIn,
      'Difference (OUT - IN)': row.difference,
      'Total Entries': row.entries
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Supplier Analytics');
    XLSX.writeFile(wb, `crates_supplier_analytics_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportListingData = () => {
    if (combinedListing.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(combinedListing.map(row => ({
      'Date': row.shiftDate,
      'Supplier': row.supplierName,
      'Plate Number': row.plateNumber,
      'Driver': row.driverName,
      'Operation Type': row.operationType,
      'Boxes OUT': row.operationType === 'OUT' ? row.boxes : 0,
      'Boxes IN': row.operationType === 'IN' ? row.boxes : 0,
      'Difference': (row.operationType === 'OUT' ? row.boxes : 0) - (row.operationType === 'IN' ? row.boxes : 0),
      'Note': row.note || '',
      'Created By': row.createdBy
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Crates Listing');
    XLSX.writeFile(wb, `crates_listing_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FBFBFF] w-full overflow-x-hidden">
      {/* Header */}
      <div className="px-4 md:px-8 lg:px-10 py-6 bg-white border-b border-primary/5 shadow-sm sticky top-0 z-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 max-w-[1600px] mx-auto w-full">
          <div className="space-y-1.5">
            <nav className="flex text-[10px] md:text-xs font-black uppercase tracking-[0.25em] text-muted-foreground/40 mb-1" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-2">
                <li>Profile</li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  Crates Follow Up
                </li>
              </ol>
            </nav>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-purple-900 tracking-tight uppercase leading-none flex items-center gap-3">
              Crates Follow Up
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {activeTab === 'group-plate' && (
              <Button onClick={exportPlateData} className="h-12 px-6 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-xl shadow-primary/20 transition-all uppercase tracking-widest text-[10px] gap-2">
                <Download size={16} /> Export Plate Data
              </Button>
            )}
            {activeTab === 'group-supplier' && (
              <Button onClick={exportSupplierData} className="h-12 px-6 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-xl shadow-primary/20 transition-all uppercase tracking-widest text-[10px] gap-2">
                <Download size={16} /> Export Supplier Data
              </Button>
            )}
            {activeTab === 'listing' && (
              <Button onClick={exportListingData} className="h-12 px-6 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-xl shadow-primary/20 transition-all uppercase tracking-widest text-[10px] gap-2">
                <Download size={16} /> Export Listing
              </Button>
            )}
            {canAdd && (
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => setBoxType(mainTab)}
                    className="w-full sm:w-auto h-12 px-8 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.15em] text-[10px] gap-2"
                  >
                    <Plus className="h-4 w-4" /> Add Crate Follow Up
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] bg-white rounded-[2rem] border-primary/5 shadow-2xl p-0 overflow-hidden">
                  <div className="bg-primary/5 p-6 border-b border-primary/5">
                    <DialogTitle className="text-xl font-black text-purple-900 uppercase tracking-tight flex items-center gap-2">
                      <Package className="h-6 w-6 text-primary" />
                      Add Crate Follow Up
                    </DialogTitle>
                  </div>
                  <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Supplier</Label>
                        <Select value={supplierId} onValueChange={setSupplierId} required>
                          <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary">
                            <SelectValue placeholder="Select supplier..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-primary/10 shadow-2xl max-h-60">
                            {procurementSuppliers.map((s) => (
                              <SelectItem key={s.id} value={s.id || ''} className="font-bold py-3 cursor-pointer">
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Shift Date</Label>
                        <Input 
                          type="date" 
                          value={shiftDate}
                          onChange={(e) => setShiftDate(e.target.value)}
                          className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary" 
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Plate Number</Label>
                        <Input 
                          value={plateNumber}
                          onChange={(e) => setPlateNumber(e.target.value)}
                          placeholder="e.g. 12345-A-6"
                          className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary uppercase" 
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Driver Name</Label>
                        <Input 
                          value={driverName}
                          onChange={(e) => setDriverName(e.target.value)}
                          placeholder="Enter driver name"
                          className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary" 
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Box Type</Label>
                        <Select value={boxType} onValueChange={setBoxType} required>
                          <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-primary/10 shadow-2xl">
                            <SelectItem value="EXPORT_OPTIMUM" className="font-bold py-3 cursor-pointer">Export Optimum Boxes</SelectItem>
                            <SelectItem value="AGRICENTER" className="font-bold py-3 cursor-pointer">Agricenter Boxes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Operation Type</Label>
                        <Select value={operationType} onValueChange={setOperationType} required>
                          <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-primary/10 shadow-2xl">
                            <SelectItem value="OUT" className="font-black py-3 cursor-pointer text-amber-600">OUT (Leaving with Crates)</SelectItem>
                            <SelectItem value="IN" className="font-black py-3 cursor-pointer text-emerald-600">IN (Returning Crates)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Number of Boxes</Label>
                        <Input 
                          type="number"
                          min="1"
                          value={boxes}
                          onChange={(e) => setBoxes(e.target.value)}
                          placeholder="0"
                          className="h-12 rounded-xl bg-muted/30 border-none font-black text-primary" 
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Notes (Optional)</Label>
                      <Textarea 
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add any additional details here..."
                        className="min-h-[100px] rounded-xl bg-muted/30 border-none font-medium text-primary resize-none" 
                      />
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-primary/5">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={() => setIsAddModalOpen(false)}
                        className="h-12 px-6 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-rose-50 hover:text-rose-500"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        disabled={isSubmitting}
                        className="h-12 px-8 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-xl shadow-primary/20 uppercase tracking-[0.15em] text-[10px]"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Submit Record'
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 lg:p-10 max-w-[1600px] mx-auto w-full space-y-8 animate-in fade-in duration-700">
        {/* Summary Statistics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {/* Card 1: Total Boxes */}
          <div className="bg-white rounded-[1.5rem] p-6 shadow-xl shadow-primary/5 border border-primary/5 flex flex-col justify-between hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary/5 p-3 rounded-xl">
                <Archive className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-purple-900">Total Boxes</h3>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Initial Stock: {initialStock.toLocaleString()}</p>
              </div>
            </div>
            <div>
              <p className="text-4xl font-black text-primary">{totalBoxes.toLocaleString()}</p>
            </div>
          </div>

          {/* Card 2: Boxes IN */}
          <div className="bg-white rounded-[1.5rem] p-6 shadow-xl shadow-primary/5 border border-primary/5 flex flex-col justify-between hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-50 p-3 rounded-xl">
                <ArrowDownToLine className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-purple-900">Boxes IN</h3>
            </div>
            <div>
              <p className="text-4xl font-black text-emerald-600">{totalIn.toLocaleString()}</p>
            </div>
          </div>

          {/* Card 3: Boxes OUT */}
          <div className="bg-white rounded-[1.5rem] p-6 shadow-xl shadow-primary/5 border border-primary/5 flex flex-col justify-between hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-amber-50 p-3 rounded-xl">
                <ArrowUpFromLine className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-purple-900">Boxes OUT</h3>
            </div>
            <div>
              <p className="text-4xl font-black text-amber-600">{totalOut.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full space-y-6">
          <div className="flex items-center justify-start overflow-x-auto custom-scrollbar w-full pb-2 md:pb-0">
            <TabsList className="bg-primary/5 border border-primary/10 p-1.5 rounded-[1.5rem] h-auto shadow-sm flex flex-nowrap w-max md:w-auto">
              <TabsTrigger value="EXPORT_OPTIMUM" className="whitespace-nowrap rounded-xl px-6 md:px-10 py-3.5 font-black text-[11px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 shadow-sm">
                Export Optimum Boxes
              </TabsTrigger>
              <TabsTrigger value="AGRICENTER" className="whitespace-nowrap rounded-xl px-6 md:px-10 py-3.5 font-black text-[11px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 shadow-sm">
                Agricenter Boxes
              </TabsTrigger>
            </TabsList>
          </div>
        </Tabs>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8 w-full">
          <div className="flex items-center justify-start overflow-x-auto custom-scrollbar w-full pb-2 md:pb-0">
            <TabsList className="bg-white/50 border border-primary/5 p-1.5 rounded-[1.5rem] h-auto shadow-sm flex flex-nowrap w-max md:w-auto">
              <TabsTrigger value="group-plate" className="whitespace-nowrap rounded-xl px-4 md:px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
                <Truck className="h-3.5 w-3.5" /> Group By Plate Number
              </TabsTrigger>
              <TabsTrigger value="group-supplier" className="whitespace-nowrap rounded-xl px-4 md:px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
                <Users className="h-3.5 w-3.5" /> Group By Supplier
              </TabsTrigger>
              <TabsTrigger value="listing" className="whitespace-nowrap rounded-xl px-4 md:px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
                <List className="h-3.5 w-3.5" /> Listing
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: Group By Plate */}
          <TabsContent value="group-plate" className="m-0 border-none outline-none w-full">
            <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden w-full flex flex-col">
              <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth">
                <Table className="min-w-[1000px] w-full">
                  <TableHeader className="sticky top-0 z-10 backdrop-blur-md shadow-sm bg-[#F8F7FF]">
                    <TableRow className="bg-[#F8F7FF] border-b border-primary/5 hover:bg-transparent">
                      <TableHead className="pl-6 md:pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap">Plate Number</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap">Driver Name</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right whitespace-nowrap text-amber-600">Total Boxes OUT</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right whitespace-nowrap text-emerald-600">Total Boxes IN</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right whitespace-nowrap">Difference</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-center pr-6 md:pr-8 whitespace-nowrap">Total Entries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingCrates || isLoadingRm ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-64 text-center">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" />
                        </TableCell>
                      </TableRow>
                    ) : plateAggregations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-64 text-center">
                          <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                            <Truck size={40} className="md:h-12 md:w-12" />
                            <p className="font-black uppercase tracking-widest text-[10px] md:text-[11px]">No crate records found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      plateAggregations.map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-primary/[0.02] transition-all border-b border-primary/5 last:border-0 group">
                          <TableCell className="pl-6 md:pl-8">
                            <span className="font-black text-primary text-sm bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10 tracking-widest">{row.plateNumber}</span>
                          </TableCell>
                          <TableCell className="font-bold text-muted-foreground whitespace-nowrap">{row.driverName}</TableCell>
                          <TableCell className="text-right font-black text-amber-600 text-sm whitespace-nowrap">{row.boxesOut.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-black text-emerald-600 text-sm whitespace-nowrap">{row.boxesIn.toLocaleString()}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <span className={cn(
                              "font-black text-sm px-3 py-1.5 rounded-lg",
                              row.difference === 0 ? "bg-emerald-50 text-emerald-600" :
                              row.difference > 0 ? "bg-rose-50 text-rose-600" :
                              "bg-blue-50 text-blue-600"
                            )}>
                              {row.difference > 0 ? `+${row.difference.toLocaleString()} Missing` : row.difference === 0 ? 'Balanced' : `${Math.abs(row.difference).toLocaleString()} Extra`}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-bold text-primary/40 pr-6 md:pr-8 whitespace-nowrap">{row.entries}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Group By Supplier */}
          <TabsContent value="group-supplier" className="m-0 border-none outline-none w-full">
            <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden w-full flex flex-col">
              <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth">
                <Table className="min-w-[1000px] w-full">
                  <TableHeader className="sticky top-0 z-10 backdrop-blur-md shadow-sm bg-[#F8F7FF]">
                    <TableRow className="bg-[#F8F7FF] border-b border-primary/5 hover:bg-transparent">
                      <TableHead className="pl-6 md:pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap">Supplier Name</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right whitespace-nowrap text-amber-600">Total Boxes OUT</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right whitespace-nowrap text-emerald-600">Total Boxes IN</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right whitespace-nowrap">Difference</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-center pr-6 md:pr-8 whitespace-nowrap">Total Entries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingCrates || isLoadingRm ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-64 text-center">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" />
                        </TableCell>
                      </TableRow>
                    ) : supplierAggregations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-64 text-center">
                          <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                            <Users size={40} className="md:h-12 md:w-12" />
                            <p className="font-black uppercase tracking-widest text-[10px] md:text-[11px]">No crate records found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      supplierAggregations.map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-primary/[0.02] transition-all border-b border-primary/5 last:border-0 group">
                          <TableCell className="pl-6 md:pl-8">
                            <span className="font-black text-primary text-sm">{row.supplierName}</span>
                          </TableCell>
                          <TableCell className="text-right font-black text-amber-600 text-sm whitespace-nowrap">{row.boxesOut.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-black text-emerald-600 text-sm whitespace-nowrap">{row.boxesIn.toLocaleString()}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <span className={cn(
                              "font-black text-sm px-3 py-1.5 rounded-lg",
                              row.difference === 0 ? "bg-emerald-50 text-emerald-600" :
                              row.difference > 0 ? "bg-rose-50 text-rose-600" :
                              "bg-blue-50 text-blue-600"
                            )}>
                              {row.difference > 0 ? `+${row.difference.toLocaleString()} Missing` : row.difference === 0 ? 'Balanced' : `${Math.abs(row.difference).toLocaleString()} Extra`}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-bold text-primary/40 pr-6 md:pr-8 whitespace-nowrap">{row.entries}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: Listing */}
          <TabsContent value="listing" className="m-0 border-none outline-none w-full">
            <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden w-full flex flex-col">
              <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth">
                <Table className="min-w-[1200px] w-full">
                  <TableHeader className="sticky top-0 z-10 backdrop-blur-md shadow-sm bg-[#F8F7FF]">
                    <TableRow className="bg-[#F8F7FF] border-b border-primary/10 hover:bg-transparent">
                      <TableHead className="pl-6 md:pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap w-[80px]">
                        Actions
                      </TableHead>
                      {renderSortHeader('Plate Number', 'plateNumber')}
                      {renderSortHeader('Driver Name', 'driverName')}
                      {renderSortHeader('Shift Date', 'shiftDate')}
                      {renderSortHeader('Supplier', 'supplierName')}
                      {renderSortHeader('Lot Number', 'lotNumber')}
                      {renderSortHeader('Boxes OUT', 'boxesOut', 'center')}
                      {renderSortHeader('Boxes IN', 'boxesIn', 'center')}
                      {renderSortHeader('Difference', 'difference', 'center')}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingCrates || isLoadingRm ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-64 text-center">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary/20" />
                        </TableCell>
                      </TableRow>
                    ) : paginatedCombinedListing.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-64 text-center">
                          <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                            <List size={40} className="md:h-12 md:w-12" />
                            <p className="font-black uppercase tracking-widest text-[10px] md:text-[11px]">No crate records found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedCombinedListing.map((record, index) => {
                        const outBoxes = record.operationType === 'OUT' ? record.boxes : 0;
                        const inBoxes = record.operationType === 'IN' ? record.boxes : 0;
                        const difference = outBoxes - inBoxes;
                        
                        return (
                          <TableRow key={`${record.id}-${index}`} className="hover:bg-primary/[0.02] bg-white transition-all border-b border-primary/5 last:border-0 group h-16">
                            <TableCell className="pl-6 md:pl-8">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-primary/5 rounded-lg transition-all">
                                    <MoreVertical className="h-4 w-4 text-primary/60 group-hover:text-primary" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="rounded-xl border-primary/10 shadow-xl p-1 bg-white">
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setRecordToView(record);
                                      setIsViewModalOpen(true);
                                    }} 
                                    className="font-bold gap-2 cursor-pointer py-2.5 text-xs text-primary/80 hover:text-primary hover:bg-primary/5 rounded-lg"
                                  >
                                    <Eye size={14} className="text-primary/60" /> View Record
                                  </DropdownMenuItem>
                                  {record.source === 'manual' && (
                                    <>
                                      {canUpdate && (
                                        <DropdownMenuItem 
                                          onClick={() => openEditModal(record)} 
                                          className="font-bold gap-2 cursor-pointer py-2.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                                        >
                                          <Edit2 size={14} /> Edit Record
                                        </DropdownMenuItem>
                                      )}
                                      {canDelete && (
                                        <DropdownMenuItem 
                                          onClick={() => {
                                            setRecordToDelete(record);
                                            setIsDeleteConfirmOpen(true);
                                          }} 
                                          className="font-bold gap-2 cursor-pointer py-2.5 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                        >
                                          <TrashIcon size={14} /> Delete Record
                                        </DropdownMenuItem>
                                      )}
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <span className="font-black text-primary text-xs bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10 tracking-widest uppercase">
                                {record.plateNumber}
                              </span>
                            </TableCell>
                            <TableCell className="font-bold text-primary/80 text-xs whitespace-nowrap">
                              {record.driverName}
                            </TableCell>
                            <TableCell className="font-bold text-primary/70 text-xs whitespace-nowrap">
                              {record.shiftDate}
                            </TableCell>
                            <TableCell className="font-black text-primary text-xs whitespace-nowrap max-w-[200px] truncate" title={record.supplierName}>
                              {record.supplierName}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {record.lotNumber && record.lotNumber !== '-' ? (
                                <span 
                                  onClick={() => {
                                    const targetRm = rawMaterialsList?.find(rm => rm.lotNumber === record.lotNumber);
                                    const targetId = record.source === 'raw_materials' ? record.id : targetRm?.id;
                                    if (targetId) {
                                      router.push(`/production/raw-materials/${targetId}`);
                                    } else {
                                      toast({
                                        variant: 'destructive',
                                        title: 'Record Not Found',
                                        description: `Could not find a raw material intake record for lot ${record.lotNumber}.`,
                                      });
                                    }
                                  }}
                                  className="font-black text-xs text-[#708238] hover:text-[#556B2F] underline hover:no-underline cursor-pointer tracking-wider"
                                >
                                  {record.lotNumber}
                                </span>
                              ) : (
                                <span className="text-primary/30 font-bold text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-black text-amber-600 text-xs whitespace-nowrap">
                              {outBoxes > 0 ? outBoxes.toLocaleString() : '-'}
                            </TableCell>
                            <TableCell className="text-center font-black text-emerald-600 text-xs whitespace-nowrap">
                              {inBoxes > 0 ? inBoxes.toLocaleString() : '-'}
                            </TableCell>
                            <TableCell className="text-center whitespace-nowrap">
                              <span className={cn(
                                "font-black text-xs px-2.5 py-1 rounded-lg border",
                                difference === 0 ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                difference > 0 ? "bg-rose-50 text-rose-600 border-rose-100" :
                                "bg-blue-50 text-blue-600 border-blue-100"
                              )}>
                                {difference > 0 ? `+${difference.toLocaleString()}` : difference === 0 ? '0' : difference.toLocaleString()}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination bar */}
              <div className="p-4 border-t bg-[#F8F7FF] flex items-center justify-between text-[10px] font-black text-primary/40 uppercase tracking-widest border-t border-primary/5">
                <span>Showing {Math.min(sortedCombinedListing.length, currentPage * itemsPerPage)} of {sortedCombinedListing.length} Record(s)</span>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="h-8 px-3 rounded-lg hover:bg-primary/5 font-black uppercase text-[10px]"
                  >
                    Previous
                  </Button>
                  
                  {totalPages <= 5 ? (
                    Array.from({ length: totalPages }).map((_, i) => {
                      const pageNum = i + 1;
                      const isActive = pageNum === currentPage;
                      return (
                        <Button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={cn(
                            "h-8 w-8 rounded-lg font-black text-[10px] p-0 flex items-center justify-center transition-all duration-200",
                            isActive 
                              ? "bg-primary text-white hover:bg-primary/95 shadow-md shadow-primary/20 scale-[1.05]" 
                              : "bg-transparent text-primary/60 hover:bg-primary/5 hover:text-primary"
                          )}
                        >
                          {pageNum}
                        </Button>
                      );
                    })
                  ) : (
                    <>
                      <Button
                        onClick={() => setCurrentPage(1)}
                        className={cn(
                          "h-8 w-8 rounded-lg font-black text-[10px] p-0 flex items-center justify-center transition-all duration-200",
                          currentPage === 1 
                            ? "bg-primary text-white hover:bg-primary/95 shadow-md shadow-primary/20 scale-[1.05]" 
                            : "bg-transparent text-primary/60 hover:bg-primary/5 hover:text-primary"
                        )}
                      >
                        1
                      </Button>
                      {currentPage > 3 && <span className="text-primary/30 px-1 font-bold text-xs select-none">...</span>}
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const pageNum = i + 1;
                        if (pageNum === 1 || pageNum === totalPages) return null;
                        if (Math.abs(pageNum - currentPage) > 1) return null;
                        const isActive = pageNum === currentPage;
                        return (
                          <Button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={cn(
                              "h-8 w-8 rounded-lg font-black text-[10px] p-0 flex items-center justify-center transition-all duration-200",
                              isActive 
                                ? "bg-primary text-white hover:bg-primary/95 shadow-md shadow-primary/20 scale-[1.05]" 
                                : "bg-transparent text-primary/60 hover:bg-primary/5 hover:text-primary"
                            )}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                      {currentPage < totalPages - 2 && <span className="text-primary/30 px-1 font-bold text-xs select-none">...</span>}
                      <Button
                        onClick={() => setCurrentPage(totalPages)}
                        className={cn(
                          "h-8 w-8 rounded-lg font-black text-[10px] p-0 flex items-center justify-center transition-all duration-200",
                          currentPage === totalPages 
                            ? "bg-primary text-white hover:bg-primary/95 shadow-md shadow-primary/20 scale-[1.05]" 
                            : "bg-transparent text-primary/60 hover:bg-primary/5 hover:text-primary"
                        )}
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}

                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={currentPage === totalPages} 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="h-8 px-3 rounded-lg hover:bg-primary/5 font-black uppercase text-[10px]"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-[2rem] border-primary/5 shadow-2xl p-0 overflow-hidden">
          <div className="bg-primary/5 p-6 border-b border-primary/10">
            <DialogTitle className="text-xl font-black text-primary uppercase tracking-tight flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" />
              Crate Record Details
            </DialogTitle>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Source</Label>
                <div className="mt-1 font-bold text-sm text-primary flex items-center gap-1.5">
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                    recordToView?.source === 'manual' 
                      ? "bg-purple-100 text-purple-700" 
                      : "bg-emerald-100 text-emerald-700"
                  )}>
                    {recordToView?.source === 'manual' ? 'Manual Entry' : 'Raw Materials'}
                  </span>
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Box Type</Label>
                <div className="mt-1 font-bold text-sm text-primary">
                  {recordToView?.boxType === 'AGRICENTER' ? 'Agricenter' : 'Export Optimum'}
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Shift Date</Label>
                <div className="mt-1 font-bold text-sm text-primary">{recordToView?.shiftDate}</div>
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Supplier</Label>
                <div className="mt-1 font-bold text-sm text-primary truncate" title={recordToView?.supplierName}>
                  {recordToView?.supplierName}
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Plate Number</Label>
                <div className="mt-1 font-black text-sm text-primary tracking-widest bg-primary/5 px-2.5 py-1 rounded-md w-fit border border-primary/10">
                  {recordToView?.plateNumber}
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Driver Name</Label>
                <div className="mt-1 font-bold text-sm text-primary">{recordToView?.driverName}</div>
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Lot Number</Label>
                <div className="mt-1 font-bold text-sm text-primary">
                  {recordToView?.lotNumber || '-'}
                </div>
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Quantity</Label>
                <div className="mt-1 font-black text-sm flex items-center gap-1.5">
                  <span className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                    recordToView?.operationType === 'IN' 
                      ? "bg-emerald-100 text-emerald-700" 
                      : "bg-amber-100 text-amber-700"
                  )}>
                    {recordToView?.operationType}: {recordToView?.boxes?.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            
            {recordToView?.note && (
              <div className="bg-muted/30 p-4 rounded-xl space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/40">Notes / Remarks</Label>
                <p className="text-xs font-medium text-muted-foreground whitespace-pre-wrap">{recordToView?.note}</p>
              </div>
            )}

            <div className="border-t border-primary/5 pt-4 flex justify-between text-[10px] font-bold text-primary/40">
              <div>Created By: {recordToView?.createdBy}</div>
              <div>Date: {recordToView?.createdAt ? format(new Date(recordToView.createdAt), 'yyyy-MM-dd HH:mm') : '-'}</div>
            </div>
            
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-primary/5">
              <Button 
                type="button" 
                onClick={() => setIsViewModalOpen(false)}
                className="h-12 px-8 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-xl shadow-primary/20 uppercase tracking-[0.15em] text-[10px]"
              >
                Close Details
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal (Reusing form logic) */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-white rounded-[2rem] border-primary/5 shadow-2xl p-0 overflow-hidden">
          <div className="bg-blue-50 p-6 border-b border-blue-100">
            <DialogTitle className="text-xl font-black text-blue-900 uppercase tracking-tight flex items-center gap-2">
              <Edit2 className="h-6 w-6 text-blue-600" />
              Edit Crate Follow Up
            </DialogTitle>
          </div>
          <form onSubmit={handleEditSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId} required>
                  <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary">
                    <SelectValue placeholder="Select supplier..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/10 shadow-2xl max-h-60">
                    {procurementSuppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id || ''} className="font-bold py-3 cursor-pointer">
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Shift Date</Label>
                <Input 
                  type="date" 
                  value={shiftDate}
                  onChange={(e) => setShiftDate(e.target.value)}
                  className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary" 
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Plate Number</Label>
                <Input 
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  placeholder="e.g. 12345-A-6"
                  className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary uppercase" 
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Driver Name</Label>
                <Input 
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Enter driver name"
                  className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary" 
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Box Type</Label>
                <Select value={boxType} onValueChange={setBoxType} required>
                  <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/10 shadow-2xl">
                    <SelectItem value="EXPORT_OPTIMUM" className="font-bold py-3 cursor-pointer">Export Optimum Boxes</SelectItem>
                    <SelectItem value="AGRICENTER" className="font-bold py-3 cursor-pointer">Agricenter Boxes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Operation Type</Label>
                <Select value={operationType} onValueChange={setOperationType} required>
                  <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-primary/10 shadow-2xl">
                    <SelectItem value="OUT" className="font-black py-3 cursor-pointer text-amber-600">OUT (Leaving with Crates)</SelectItem>
                    <SelectItem value="IN" className="font-black py-3 cursor-pointer text-emerald-600">IN (Returning Crates)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Number of Boxes</Label>
                <Input 
                  type="number"
                  min="1"
                  value={boxes}
                  onChange={(e) => setBoxes(e.target.value)}
                  placeholder="0"
                  className="h-12 rounded-xl bg-muted/30 border-none font-black text-primary" 
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Notes (Optional)</Label>
              <Textarea 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any additional details here..."
                className="min-h-[100px] rounded-xl bg-muted/30 border-none font-medium text-primary resize-none" 
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-primary/5">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setIsEditModalOpen(false)}
                className="h-12 px-6 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-rose-50 hover:text-rose-500"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isSubmitting}
                className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-xl shadow-blue-200 uppercase tracking-[0.15em] text-[10px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Record'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="rounded-[2rem] border-primary/5 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-purple-900 uppercase tracking-tight">Delete Record?</AlertDialogTitle>
            <AlertDialogDescription className="font-bold text-muted-foreground">
              Are you sure you want to delete this crate record? This action cannot be undone and will affect the current inventory balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="h-12 px-6 rounded-xl font-bold uppercase tracking-widest text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="h-12 px-8 bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl shadow-xl shadow-rose-200 uppercase tracking-[0.15em] text-[10px]">
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
