'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { collection, query, where, doc, addDoc, updateDoc, deleteDoc } from '@/firebase/firestore-override';
import { useFirestore, useDoc, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

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
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  CalendarDays,
  Filter,
  RotateCcw,
  Loader2,
  Building2,
  Hash,
  BadgeDollarSign,
  Receipt,
  CircleDollarSign
} from 'lucide-react';
import Link from 'next/link';

import { generateCabraneSituationPDF } from '@/lib/export-cabrane-situation-pdf';
import { generateCabraneSituationExcel } from '@/lib/export-cabrane-situation-excel';

export default function CabraneSituationDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const cabraneId = params.id as string;
  const db = useFirestore();
  const { user } = useUser();                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 

  // --- UI States ---
  const [activeTab, setActiveTab] = useState<'solde' | 'payments'>('solde');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // --- Modal States ---
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [paymentFormMode, setPaymentFormMode] = useState<'add' | 'edit'>('add');
  const [recordToDelete, setRecordToDelete] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Filter States ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');

  // --- Payment Form States ---
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentOperation, setPaymentOperation] = useState('Payment'); // 'Payment', 'Avance', 'Solde'
  const [paymentNote, setPaymentNote] = useState('');

  // --- Table Configuration States ---
  const [soldePage, setSoldePage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const itemsPerPage = 8;

  // --- Data Fetching ---
  const cabraneDoc = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'cabranes', cabraneId);
  }, [db, cabraneId]);
  
  const { data: cabraneData, isLoading: loadingCabrane } = useDoc(cabraneDoc);

  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'raw_materials'), where('cabraneId', '==', cabraneId));
  }, [db, cabraneId]);

  const { data: rawMaterials, isLoading: loadingRM } = useCollection(rawMaterialsQuery);

  const paymentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'cabrane_payments'), where('cabraneId', '==', cabraneId));
  }, [db, cabraneId]);

  const { data: payments, isLoading: loadingPayments } = useCollection(paymentsQuery);

  // Additional requirement: fetch suppliers to map supplierName properly if not directly stored in RM
  const suppliersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'procurement_suppliers'));
  }, [db]);
  const { data: suppliers } = useCollection(suppliersQuery);

  const isLoading = loadingCabrane || loadingRM || loadingPayments;

  // --- Handlers ---
  const handleFilter = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
    setSoldePage(1);
    setPaymentsPage(1);
    toast({ title: 'Filters Applied', description: 'Date range updated.' });
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setSoldePage(1);
    setPaymentsPage(1);
    toast({ title: 'Filters Reset', description: 'Showing all records.' });
  };

  // --- Filter Helpers ---
  const isDateInRange = (dateStr: string) => {
    if (!dateStr) return true; // If no date on record, include it
    const dateOnly = dateStr.substring(0, 10);
    if (appliedStartDate && dateOnly < appliedStartDate) return false;
    if (appliedEndDate && dateOnly > appliedEndDate) return false;
    return true;
  };

  // --- Compute Solde Tab Rows ---
  const allSoldes = useMemo(() => {
    const list: any[] = [];
    if (rawMaterials) {
      rawMaterials.forEach(rm => {
        const itemDate = rm.shiftDate || rm.date || (rm.dateTime ? rm.dateTime.substring(0, 10) : '');
        if (!isDateInRange(itemDate)) return;

        let sName = rm.supplierName || rm.supplierId || '—';
        if (suppliers) {
          const sup = suppliers.find(s => s.id === rm.supplierId);
          if (sup) sName = sup.name || sup.supplierName || sName;
        }

        list.push({
          id: `rm-${rm.id}`,
          isRawMaterial: true,
          lotNumber: rm.lotNumber || '—',
          date: itemDate,
          cabraneName: cabraneData?.name || '—',
          workerCost: Number(rm.workersCost || rm.workerCost || 0),
          origin: rm.origin || '—',
          supplierName: sName,
          dbId: rm.id
        });
      });
    }

    if (payments) {
      payments.forEach(pay => {
        if (pay.operationType !== 'Solde') return;
        if (!isDateInRange(pay.date)) return;

        list.push({
          id: `pay-${pay.id}`,
          isRawMaterial: false,
          lotNumber: (pay.operationType?.trim().toUpperCase() === 'SOLDE' && pay.note) ? pay.note : '—',
          date: pay.date,
          cabraneName: cabraneData?.name || '—',
          workerCost: Number(pay.amount || 0),
          origin: 'Manual Entry',
          supplierName: '—',
          dbId: pay.id,
          record: pay
        });
      });
    }

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [rawMaterials, payments, cabraneData, appliedStartDate, appliedEndDate, suppliers]);

  // --- Compute Payments Tab Rows ---
  const allPayments = useMemo(() => {
    const list: any[] = [];
    if (payments) {
      payments.forEach(pay => {
        if (pay.operationType !== 'Payment' && pay.operationType !== 'Avance') return;
        if (!isDateInRange(pay.date)) return;

        list.push({
          id: pay.id,
          date: pay.date,
          amount: Number(pay.amount || 0),
          paymentType: pay.operationType,
          note: pay.note || '—',
          created_at: pay.created_at ? new Date(pay.created_at.toMillis()).toLocaleString() : '—',
          created_by: pay.created_by || '—',
          updated_at: pay.updated_at ? new Date(pay.updated_at.toMillis()).toLocaleString() : '—',
          updated_by: pay.updated_by || '—',
          record: pay
        });
      });
    }

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [payments, appliedStartDate, appliedEndDate]);

  // --- Compute KPI Summaries based on filtered lists ---
  const calculatedInfo = useMemo(() => {
    let totalTransportCost = 0;
    let totalPayment = 0;

    allSoldes.forEach(s => {
      totalTransportCost += s.workerCost;
    });

    allPayments.forEach(p => {
      totalPayment += p.amount;
    });

    return {
      cabraneName: cabraneData?.name || 'Unknown',
      noOfReception: allSoldes.filter(s => s.isRawMaterial).length,
      totalTransportCost,
      totalPayment,
      openAmount: totalTransportCost - totalPayment
    };
  }, [allSoldes, allPayments, cabraneData]);

  // --- Pagination ---
  const paginatedSoldes = useMemo(() => {
    const start = (soldePage - 1) * itemsPerPage;
    return allSoldes.slice(start, start + itemsPerPage);
  }, [allSoldes, soldePage]);
  const totalSoldePages = Math.max(1, Math.ceil(allSoldes.length / itemsPerPage));

  const paginatedPayments = useMemo(() => {
    const start = (paymentsPage - 1) * itemsPerPage;
    return allPayments.slice(start, start + itemsPerPage);
  }, [allPayments, paymentsPage]);
  const totalPaymentsPages = Math.max(1, Math.ceil(allPayments.length / itemsPerPage));

  const densityPaddingClass = {
    compact: 'py-2 px-4 h-12 text-xs',
    normal: 'py-4 px-6 h-16 text-xs',
    tall: 'py-6 px-8 h-20 text-sm'
  }[density];

  // --- Modal Logic ---
  const handleOpenAddModal = () => {
    setPaymentFormMode('add');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentAmount('');
    setPaymentOperation('Payment');
    setPaymentNote('');
    setIsPaymentModalOpen(true);
  };

  const handleOpenEditModal = (record: any) => {
    setPaymentFormMode('edit');
    setRecordToDelete(record);
    setPaymentDate(record.date);
    setPaymentAmount(record.amount?.toString() || '');
    setPaymentOperation(record.operationType || record.paymentType);
    setPaymentNote(record.note || '');
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !cabraneId) return;
    setIsSubmitting(true);
    try {
      if (paymentFormMode === 'add') {
        await addDoc(collection(db, 'cabrane_payments'), {
          cabraneId,
          date: paymentDate,
          amount: Number(paymentAmount),
          operationType: paymentOperation,
          note: paymentNote,
          created_at: new Date(),
          created_by: user?.email || 'unknown',
          updated_at: new Date(),
          updated_by: user?.email || 'unknown'
        });
        toast({ title: 'Success', description: 'Operation added successfully' });
      } else if (recordToDelete && paymentFormMode === 'edit') {
        const docRef = doc(db, 'cabrane_payments', recordToDelete.dbId || recordToDelete.id);
        await updateDoc(docRef, {
          date: paymentDate,
          amount: Number(paymentAmount),
          operationType: paymentOperation,
          note: paymentNote,
          updated_at: new Date(),
          updated_by: user?.email || 'unknown'
        });
        toast({ title: 'Success', description: 'Operation updated successfully' });
      }
      setIsPaymentModalOpen(false);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save operation', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!db || !recordToDelete) return;
    try {
      const docId = recordToDelete.dbId || recordToDelete.id;
      await deleteDoc(doc(db, 'cabrane_payments', docId));
      toast({ title: 'Success', description: 'Operation deleted successfully' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to delete operation', variant: 'destructive' });
    } finally {
      setIsDeleteConfirmOpen(false);
      setRecordToDelete(null);
    }
  };

  // --- Export Excel ---
  const handleExportExcel = async () => {
    try {
      await generateCabraneSituationExcel({
        cabraneName: calculatedInfo.cabraneName,
        startDate: appliedStartDate,
        endDate: appliedEndDate,
        station: 'Station Export Optimum',
        totalTransportCost: calculatedInfo.totalTransportCost,
        totalPayment: calculatedInfo.totalPayment,
        openAmount: calculatedInfo.openAmount,
        soldeRows: allSoldes,
        paymentRows: allPayments
      });
      toast({ title: "Export Successful", description: "Excel file downloaded successfully." });
    } catch (err) {
      console.error(err);
      toast({ title: "Export Error", description: "Could not generate Excel file.", variant: "destructive" });
    }
  };

  return (
    <div className={cn(
      "w-full bg-[#f3f3f3] min-h-screen transition-all duration-300",
      isFullscreen ? "fixed inset-0 z-50 p-6 overflow-y-auto bg-[#f3f3f3]" : "p-6 lg:p-8"
    )}>
      
      {/* Header & Breadcrumbs */}
      <div className="max-w-[1600px] mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            <span className="hover:text-slate-600 cursor-pointer" onClick={() => router.push('/procurement/cabrane-situation')}>Profile</span>
            <span className="opacity-40">/</span>
            <span className="hover:text-slate-600 cursor-pointer" onClick={() => router.push('/procurement/cabrane-situation')}>Cabrane Situation</span>
            <span className="opacity-40">/</span>
            <span className="text-[#7a9800] font-black uppercase">Raw Material Group By Cabrane</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">
            Raw Material Group By Cabrane
          </h1>
        </div>

        {/* Top-right Buttons */}
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleOpenAddModal}
            className="h-12 px-5 bg-[#2e1d52] hover:bg-[#20143a] text-white shadow-lg shadow-[#2e1d52]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          >
            <Plus size={18} className="mr-2" />
            <span className="font-bold text-xs">Add Payment</span>
          </Button>
          <Button 
            onClick={() => generateCabraneSituationPDF({
              cabraneName: calculatedInfo.cabraneName,
              startDate: appliedStartDate,
              endDate: appliedEndDate,
              station: 'Station Export Optimum',
              totalTransportCost: calculatedInfo.totalTransportCost,
              totalPayment: calculatedInfo.totalPayment,
              openAmount: calculatedInfo.openAmount,
              soldeRows: allSoldes,
              paymentRows: allPayments
            })}
            className="h-12 w-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 p-0"
            title="Export PDF"
          >
            <FileText size={20} className="stroke-[2.5]" />
          </Button>
          <Button 
            onClick={handleExportExcel}
            className="h-12 w-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 p-0"
            title="Export Excel"
          >
            <Download size={20} className="stroke-[2.5]" />
          </Button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="max-w-[1600px] mx-auto bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 mb-6 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</Label>
          <div className="relative">
            <CalendarDays size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              type="date"
              className="h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 pl-10 focus-visible:ring-[#7a9800]"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 w-full space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date</Label>
          <div className="relative">
            <CalendarDays size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              type="date"
              className="h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 pl-10 focus-visible:ring-[#7a9800]"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={handleFilter} className="h-12 px-6 bg-[#7a9800] hover:bg-[#6c8500] text-white font-black rounded-xl shadow-lg shadow-[#7a9800]/20 uppercase tracking-widest text-xs flex-1 md:flex-none">
            <Filter size={16} className="mr-2" /> Filter
          </Button>
          <Button 
            variant="outline" 
            className="h-12 px-6 border-slate-200 text-slate-600 font-black rounded-xl hover:bg-slate-50 uppercase tracking-widest text-xs flex-1 md:flex-none"
            onClick={handleReset}
          >
            <RotateCcw size={16} className="mr-2" /> Clear
          </Button>
        </div>
      </div>

      {/* Cabrane Summary Card */}
      <div className="max-w-[1600px] mx-auto bg-white p-8 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 mb-8">
        <h2 className="text-xl font-black text-[#2e1d52] uppercase tracking-tight mb-6">Raw Material Group By Cabrane</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
          
          <div className="col-span-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cabrane Name</p>
            <p className="text-sm font-black text-[#2e1d52]">{calculatedInfo.cabraneName}</p>
          </div>
          
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Receptions</p>
            <p className="text-sm font-black text-slate-700">{calculatedInfo.noOfReception}</p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Start Date</p>
            <p className="text-sm font-black text-slate-700">{appliedStartDate || '—'}</p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">End Date</p>
            <p className="text-sm font-black text-slate-700">{appliedEndDate || '—'}</p>
          </div>

          <div className="col-span-2 md:col-span-4 lg:col-span-3 grid grid-cols-3 gap-4 bg-slate-50 rounded-2xl p-4 mt-4 lg:mt-[-1rem]">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Transport Cost</p>
              <p className="text-sm font-black text-[#2e1d52]">{calculatedInfo.totalTransportCost.toLocaleString(undefined, {minimumFractionDigits: 2})} DH</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Payment</p>
              <p className="text-sm font-black text-[#7a9800]">{calculatedInfo.totalPayment.toLocaleString(undefined, {minimumFractionDigits: 2})} DH</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Open Amount</p>
              <p className="text-sm font-black text-rose-600">{calculatedInfo.openAmount.toLocaleString(undefined, {minimumFractionDigits: 2})} DH</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Table */}
      <div className="max-w-[1600px] mx-auto">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden flex flex-col">
          
          <div className="flex items-center gap-2 px-6 pt-6 border-b border-slate-100">
            <button
              onClick={() => setActiveTab('solde')}
              className={cn(
                "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2",
                activeTab === 'solde'
                  ? "border-[#7a9800] text-[#7a9800]"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
              )}
            >
              Solde
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

          {/* SOLDE TAB */}
          {activeTab === 'solde' && (
            <div className="overflow-x-auto w-full">
              <Table className="w-full min-w-[1000px]">
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                  <TableRow>
                    <TableHead className="pl-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[80px]">Actions</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Lot Number</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Cabrane Name</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right pr-8">Worker Cost</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Origin</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Supplier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="h-48 text-center text-xs text-slate-400">Loading...</TableCell></TableRow>
                  ) : paginatedSoldes.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="h-48 text-center text-xs text-slate-400">No solde records found</TableCell></TableRow>
                  ) : paginatedSoldes.map(row => (
                    <TableRow key={row.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <TableCell className="pl-6">
                        {!row.isRawMaterial ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><MoreVertical size={16} /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-32 rounded-xl">
                              <DropdownMenuItem onClick={() => handleOpenEditModal(row.record)} className="text-xs font-bold text-[#7a9800]"><Edit2 size={14} className="mr-2"/> Edit</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setRecordToDelete(row.record); setIsDeleteConfirmOpen(true); }} className="text-xs font-bold text-rose-600"><Trash2 size={14} className="mr-2"/> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-slate-300 pl-3">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-[#7a9800]">{row.lotNumber}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-600">{row.date}</TableCell>
                      <TableCell className="text-xs font-bold text-[#2e1d52]">{row.cabraneName}</TableCell>
                      <TableCell className="text-xs font-black text-slate-700 text-right pr-8">{row.workerCost.toLocaleString(undefined, {minimumFractionDigits: 2})} DH</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-600">{row.origin}</TableCell>
                      <TableCell className="text-xs font-bold text-slate-700">{row.supplierName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <div className="overflow-x-auto w-full">
              <Table className="w-full min-w-[1000px]">
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                  <TableRow>
                    <TableHead className="pl-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-[80px]">Actions</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Payment Type</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Note</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Created By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="h-48 text-center text-xs text-slate-400">Loading...</TableCell></TableRow>
                  ) : paginatedPayments.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-48 text-center text-xs text-slate-400">No payment records found</TableCell></TableRow>
                  ) : paginatedPayments.map(row => (
                    <TableRow key={row.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <TableCell className="pl-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><MoreVertical size={16} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32 rounded-xl">
                            <DropdownMenuItem onClick={() => handleOpenEditModal(row.record)} className="text-xs font-bold text-[#7a9800]"><Edit2 size={14} className="mr-2"/> Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setRecordToDelete(row.record); setIsDeleteConfirmOpen(true); }} className="text-xs font-bold text-rose-600"><Trash2 size={14} className="mr-2"/> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-slate-600">{row.date}</TableCell>
                      <TableCell className="text-xs font-black text-[#7a9800]">{row.amount.toLocaleString(undefined, {minimumFractionDigits: 2})} DH</TableCell>
                      <TableCell className="text-xs font-bold text-[#2e1d52]">{row.paymentType}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-600">{row.note}</TableCell>
                      <TableCell className="text-xs font-semibold text-slate-500">{row.created_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Simple Pagination */}
          <div className="p-4 bg-slate-50 flex justify-between items-center text-xs font-bold text-slate-400">
            <span>Page {activeTab === 'solde' ? soldePage : paymentsPage}</span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={activeTab === 'solde' ? soldePage === 1 : paymentsPage === 1}
                onClick={() => activeTab === 'solde' ? setSoldePage(p => p - 1) : setPaymentsPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={activeTab === 'solde' ? soldePage >= totalSoldePages : paymentsPage >= totalPaymentsPages}
                onClick={() => activeTab === 'solde' ? setSoldePage(p => p + 1) : setPaymentsPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>

        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-[#2e1d52] p-6 text-white relative overflow-hidden">
            <h2 className="text-xl font-black uppercase tracking-wider relative z-10">{paymentFormMode === 'add' ? 'Add Cabrane Payment' : 'Edit Cabrane Payment'}</h2>
            <div className="absolute right-0 top-0 opacity-10 scale-150 transform translate-x-4 -translate-y-4">
              <CircleDollarSign size={100} />
            </div>
          </div>
          
          <form onSubmit={handlePaymentSubmit} className="p-6 space-y-5 bg-white">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</Label>
              <Input type="date" required value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold" />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount (DH)</Label>
              <Input type="number" required step="0.01" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold" />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Operation</Label>
              <Select value={paymentOperation} onValueChange={setPaymentOperation}>
                <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold text-[#2e1d52]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white">
                  <SelectItem value="Solde" className="font-bold cursor-pointer">Solde</SelectItem>
                  <SelectItem value="Avance" className="font-bold cursor-pointer">Avance</SelectItem>
                  <SelectItem value="Payment" className="font-bold cursor-pointer">Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Note</Label>
              <Textarea value={paymentNote} onChange={e => setPaymentNote(e.target.value)} className="resize-none h-24 rounded-xl bg-slate-50 border-slate-200 font-bold text-sm" placeholder="Optional notes..." />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="h-12 flex-1 rounded-xl font-bold border-slate-200 hover:bg-slate-50 text-slate-600 uppercase text-xs tracking-widest" onClick={() => setIsPaymentModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="h-12 flex-1 rounded-xl font-bold bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 uppercase text-xs tracking-widest transition-all hover:scale-105 active:scale-95">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 border-none shadow-2xl bg-white text-center">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={24} className="text-rose-500" />
          </div>
          <DialogTitle className="text-xl font-black text-[#2e1d52] mb-2 uppercase tracking-wide">Delete Record</DialogTitle>
          <p className="text-sm font-semibold text-slate-500 mb-8">Are you sure you want to delete this {recordToDelete?.operationType}? This action cannot be undone and will recalculate totals.</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold text-slate-600 hover:bg-slate-50 uppercase text-xs tracking-wider" onClick={() => setIsDeleteConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleDelete} className="flex-1 h-12 rounded-xl font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 uppercase text-xs tracking-wider transition-all hover:scale-105 active:scale-95">
              Yes, Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
