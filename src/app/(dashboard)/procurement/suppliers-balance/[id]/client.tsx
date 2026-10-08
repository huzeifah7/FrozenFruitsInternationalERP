'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { collection, query, where, orderBy, doc, addDoc, updateDoc, deleteDoc } from '@/firebase/firestore-override';
import { useFirestore, useDoc, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

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
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  CalendarDays,
  Filter,
  RotateCcw,
  Loader2,
  Calendar,
  DollarSign,
  Notebook,
  Building2,
  Hash,
  Scale,
  Receipt,
  BadgeDollarSign,
  CircleDollarSign
} from 'lucide-react';
import Link from 'next/link';

export default function SupplierBalanceDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  // --- UI States ---
  const [activeTab, setActiveTab] = useState<'solde' | 'payments' | 'situation'>('solde');
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

  // --- Payment Form States ---
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentOperation, setPaymentOperation] = useState('Payment');
  const [paymentNote, setPaymentNote] = useState('');

  // --- Table Configuration States ---
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 8;

  // --- Data Fetching ---
  const supplierId = params.id as string;
  const db = useFirestore();
  const { user } = useUser();

  const supplierDoc = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'procurement_suppliers', supplierId);
  }, [db, supplierId]);
  
  const { data: supplierData, isLoading: loadingSupplier } = useDoc(supplierDoc);

  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'raw_materials'), where('supplierId', '==', supplierId));
  }, [db, supplierId]);

  const { data: rawMaterials, isLoading: loadingRM } = useCollection(rawMaterialsQuery);

  const paymentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'supplier_payments'), where('supplierId', '==', supplierId));
  }, [db, supplierId]);

  const { data: payments, isLoading: loadingPayments } = useCollection(paymentsQuery);

  const isLoading = loadingSupplier || loadingRM || loadingPayments;

  // --- Helper ---
  const computeFinalAmount = (rm: any): number | 'Pending' => {
    const blNetWeight = Number(rm.blNetWeight != null ? rm.blNetWeight : (rm.totalNetWeight || 0));
    const decayNetWeight = Number(rm.totalDecayNetWeight || rm.decayNetWeight || 0);
    const price = rm.price || rm.unitPrice;
    const decayPrice = rm.decayPrice;
    const workerCost = Number(rm.workerCost || 0);
    const rebate = Number(rm.rebate || 0);

    if (!price || price === '') return 'Pending';

    const pPrice = Number(price);
    const pDecayPrice = Number(decayPrice || 0);
    const rebateFactor = (100 - rebate) / 100;
    const goodWeight = blNetWeight - decayNetWeight;
    const baseAmount = goodWeight * pPrice * rebateFactor;
    const decayAmount = decayNetWeight > 0 ? (decayNetWeight * pDecayPrice * rebateFactor) : 0;

    const grossAmount = baseAmount + decayAmount;
    return Number((grossAmount - workerCost).toFixed(2));
  };

  // --- Compute Data ---
  const calculatedInfo = useMemo(() => {
    let solde = 0;
    let totalPaid = 0;
    let totalBLNetWeight = 0;

    if (rawMaterials) {
      rawMaterials.forEach(rm => {
        const blNetWeight = Number(rm.blNetWeight != null ? rm.blNetWeight : (rm.totalNetWeight || 0));
        const amt = computeFinalAmount(rm);

        totalBLNetWeight += blNetWeight;
        if (amt !== 'Pending') {
          solde += amt;
        }
      });
    }

    if (payments) {
      payments.forEach(pay => {
        const opType = (pay.operationType || 'Payment').trim().toUpperCase();
        if (opType === 'SOLDE') {
          solde += Number(pay.amount || 0);
        } else {
          totalPaid += Number(pay.amount || 0);
        }
      });
    }

    return {
      supplier: supplierData?.name || 'Unknown',
      noOfReception: rawMaterials?.length || 0,
      solde,
      totalPaid,
      openAmount: solde - totalPaid,
      totalBLNetWeight
    };
  }, [supplierData, rawMaterials, payments]);

  const allSoldes = useMemo(() => {
    const list: any[] = [];
    if (rawMaterials) {
      rawMaterials.forEach(rm => {
        const blNetWeight = Number(rm.blNetWeight != null ? rm.blNetWeight : (rm.totalNetWeight || 0));
        const decayNetWeight = Number(rm.totalDecayNetWeight || rm.decayNetWeight || 0);
        const price = rm.price || rm.unitPrice;
        const decayPrice = rm.decayPrice;
        const workerCost = Number(rm.workerCost || 0);
        const rebate = Number(rm.rebate || 0);

        const finalAmount = computeFinalAmount(rm);

        list.push({
          id: `rm-${rm.id}`,
          originalId: rm.id,
          isRawMaterial: true,
          lotNumber: rm.lotNumber || '—',
          date: rm.date || (rm.created_at ? new Date(rm.created_at.toMillis()).toISOString().split('T')[0] : '—'),
          blNetWeight,
          decayNetWeight,
          rawMaterialPrice: price || 0,
          decayPrice: decayPrice || 0,
          workerCost: rm.workerCost || 0,
          rebate,
          finalAmount
        });
      });
    }

    if (payments) {
      payments.forEach(pay => {
        const opType = (pay.operationType || 'Payment').trim().toUpperCase();
        if (opType !== 'SOLDE') return;

        list.push({
          id: `pay-${pay.id}`,
          originalId: pay.id,
          isRawMaterial: false,
          lotNumber: pay.note || '—',
          date: pay.date || (pay.created_at ? new Date(pay.created_at.toMillis()).toISOString().split('T')[0] : '—'),
          blNetWeight: 0,
          decayNetWeight: 0,
          rawMaterialPrice: 0,
          decayPrice: 0,
          workerCost: 0,
          rebate: 0,
          finalAmount: Number(pay.amount || 0),
          record: pay
        });
      });
    }

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [rawMaterials, payments]);

  const allPayments = useMemo(() => {
    if (!payments) return [];
    return payments
      .filter(pay => {
        const opType = (pay.operationType || 'Payment').trim().toUpperCase();
        return opType !== 'SOLDE';
      })
      .map(pay => ({
        id: pay.id,
        date: pay.date || (pay.created_at ? new Date(pay.created_at.toMillis()).toISOString().split('T')[0] : '—'),
        amount: Number(pay.amount || 0),
        operationType: pay.operationType || 'Payment',
        paymentType: pay.paymentType || '—',
        note: pay.note || '—',
        created_at: pay.created_at ? new Date(pay.created_at.toMillis()).toLocaleString() : '—',
        created_by: pay.created_by || '—'
      }));
  }, [payments]);

  const situations = useMemo(() => {
    const list: any[] = [];
    if (rawMaterials) {
      rawMaterials.forEach(rm => {
        const amt = computeFinalAmount(rm);
        const finalTotalAmount = amt === 'Pending' ? 0 : amt;

        list.push({
          id: `rm-${rm.id}`,
          date: rm.date || (rm.created_at ? new Date(rm.created_at.toMillis()).toISOString().split('T')[0] : '1970-01-01'),
          description: `Reception ${rm.lotNumber || '—'}`,
          debit: finalTotalAmount,
          credit: 0
        });
      });
    }
    if (payments) {
      payments.forEach(pay => {
        const opType = (pay.operationType || 'Payment').trim().toUpperCase();
        if (opType === 'SOLDE') {
          list.push({
            id: `pay-${pay.id}`,
            date: pay.date || (pay.created_at ? new Date(pay.created_at.toMillis()).toISOString().split('T')[0] : '1970-01-01'),
            description: `Manual Solde - ${pay.note || '—'}`,
            debit: Number(pay.amount || 0),
            credit: 0
          });
        } else {
          list.push({
            id: `pay-${pay.id}`,
            date: pay.date || (pay.created_at ? new Date(pay.created_at.toMillis()).toISOString().split('T')[0] : '1970-01-01'),
            description: `${pay.operationType || 'Payment'} - ${pay.paymentType || '—'}`,
            debit: 0,
            credit: Number(pay.amount || 0)
          });
        }
      });
    }

    list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let balance = 0;
    return list.map(item => {
      balance += (item.debit - item.credit);
      return { ...item, balance };
    });
  }, [rawMaterials, payments]);

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
    // Important: check if we're passing `record` from allPayments or `row.record` from allSoldes
    // Provide a normalized structure
    const payRec = record.record || record;
    setRecordToDelete({ id: payRec.id });
    setPaymentDate(payRec.date);
    setPaymentAmount(payRec.amount.toString());
    setPaymentOperation(payRec.operationType);
    setPaymentNote(payRec.note);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    setIsSubmitting(true);
    try {
      if (paymentFormMode === 'add') {
        await addDoc(collection(db, 'supplier_payments'), {
          supplierId,
          supplierName: supplierData?.name || '',
          date: paymentDate,
          amount: Number(paymentAmount),
          operationType: paymentOperation,
          paymentType: paymentOperation === 'Payment' ? 'Bank Transfer' : '—',
          note: paymentNote,
          created_at: new Date(),
          created_by: user?.email || 'unknown',
          updated_at: new Date(),
          updated_by: user?.email || 'unknown'
        });
        toast({ title: 'Success', description: 'Payment added successfully' });
      } else if (recordToDelete && paymentFormMode === 'edit') {
        const docRef = doc(db, 'supplier_payments', recordToDelete.id);
        await updateDoc(docRef, {
          date: paymentDate,
          amount: Number(paymentAmount),
          operationType: paymentOperation,
          note: paymentNote,
          updated_at: new Date(),
          updated_by: user?.email || 'unknown'
        });
        toast({ title: 'Success', description: 'Payment updated successfully' });
      }
      setIsPaymentModalOpen(false);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save payment', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!db || !recordToDelete) return;
    try {
      await deleteDoc(doc(db, 'supplier_payments', recordToDelete.id));
      toast({ title: 'Success', description: 'Payment deleted successfully' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to delete payment', variant: 'destructive' });
    } finally {
      setIsDeleteConfirmOpen(false);
      setRecordToDelete(null);
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
            <span className="hover:text-slate-600 cursor-pointer" onClick={() => router.push('/procurement/suppliers-balance')}>Profile</span>
            <span className="opacity-40">/</span>
            <span className="hover:text-slate-600 cursor-pointer" onClick={() => router.push('/procurement/suppliers-balance')}>Supplier's Balance</span>
            <span className="opacity-40">/</span>
            <span className="text-[#7a9800] font-black uppercase">Details</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">
            Supplier's Balance
          </h1>
        </div>

        {/* Top-right Buttons */}
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleOpenAddModal}
            className="h-12 w-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 p-0"
            title="Add Payment"
          >
            <Plus size={20} className="stroke-[3]" />
          </Button>
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
          <Button className="h-12 px-6 bg-[#7a9800] hover:bg-[#6c8500] text-white font-black rounded-xl shadow-lg shadow-[#7a9800]/20 uppercase tracking-widest text-xs flex-1 md:flex-none">
            <Filter size={16} className="mr-2" /> Filter
          </Button>
          <Button 
            variant="outline" 
            className="h-12 px-6 border-slate-200 text-slate-600 font-black rounded-xl hover:bg-slate-50 uppercase tracking-widest text-xs flex-1 md:flex-none"
            onClick={() => { setStartDate(''); setEndDate(''); }}
          >
            <RotateCcw size={16} className="mr-2" /> Reset
          </Button>
        </div>
      </div>

      {/* Supplier Info Card */}
      <div className="max-w-[1600px] mx-auto bg-white p-8 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Supplier */}
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Supplier</p>
              <p className="text-sm font-black text-[#2e1d52]">{calculatedInfo.supplier}</p>
            </div>
          </div>
          
          {/* Number Of Reception */}
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
              <Hash className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Number Of Reception</p>
              <p className="text-sm font-black text-slate-700">{calculatedInfo.noOfReception}</p>
            </div>
          </div>

          {/* Start Date */}
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
              <CalendarDays className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Start Date</p>
              <p className="text-sm font-black text-slate-700">—</p>
            </div>
          </div>

          {/* End Date */}
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
              <CalendarDays className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">End Date</p>
              <p className="text-sm font-black text-slate-700">—</p>
            </div>
          </div>

          {/* Solde */}
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-[#7a9800]/10 flex items-center justify-center shrink-0">
              <BadgeDollarSign className="h-5 w-5 text-[#7a9800]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Solde</p>
              <p className="text-sm font-black text-[#2e1d52]">{calculatedInfo.solde.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD</p>
            </div>
          </div>

          {/* Total Paid */}
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Receipt className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Paid</p>
              <p className="text-sm font-black text-emerald-600">{calculatedInfo.totalPaid.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD</p>
            </div>
          </div>

          {/* Open Amount */}
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
              <CircleDollarSign className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Open Amount</p>
              <p className="text-sm font-black text-rose-600">{calculatedInfo.openAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} MAD</p>
            </div>
          </div>

          {/* Total BL Net Weight */}
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Scale className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total BL Net Weight</p>
              <p className="text-sm font-black text-blue-600">{calculatedInfo.totalBLNetWeight.toLocaleString()} kg</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Tabs & Area */}
      <div className="max-w-[1600px] mx-auto">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden flex flex-col">
          
          {/* Tabs */}
          <div className="flex items-center gap-2 px-6 pt-6 border-b border-slate-100 overflow-x-auto custom-scrollbar">
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
            <button
              onClick={() => setActiveTab('situation')}
              className={cn(
                "px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2",
                activeTab === 'situation'
                  ? "border-[#7a9800] text-[#7a9800]"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
              )}
            >
              Situation
            </button>
          </div>

          {/* Toolbar */}
          <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex justify-end">
            <div className="flex items-center gap-3">
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

          {/* Tables */}
          <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth">
            
            {/* SOLDE TAB */}
            {activeTab === 'solde' && (
              <Table className="w-full min-w-[1400px] border-collapse">
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 md:pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 w-[80px]">Actions</TableHead>
                    {renderSortHeader('Lot Number', 'lotNumber')}
                    {renderSortHeader('Date', 'date')}
                    {renderSortHeader('BL Net Weight', 'blNetWeight')}
                    {renderSortHeader('Decay Net Weight', 'decayNetWeight')}
                    {renderSortHeader('Raw Material Price', 'rawMaterialPrice')}
                    {renderSortHeader('Worker Cost', 'workerCost')}
                    {renderSortHeader('Rebate', 'rebate')}
                    {renderSortHeader('Final Amount', 'finalAmount')}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-8 h-8 rounded-full border-2 border-[#7a9800] border-t-transparent animate-spin mx-auto" />
                          <p className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Loading Soldes...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : allSoldes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                          <Search size={40} className="text-slate-400" />
                          <p className="font-black uppercase tracking-widest text-[10px]">No records found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : allSoldes.map((record) => (
                    <TableRow key={record.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none group">
                      <TableCell className={cn(densityPaddingClass, "pl-6 md:pl-8 align-middle")}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 data-[state=open]:bg-slate-100">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-100 shadow-xl p-1 bg-white">
                            {record.isRawMaterial ? (
                              <DropdownMenuItem className="gap-2 font-bold text-xs py-2 px-3 rounded-lg cursor-pointer text-slate-600">
                                <FileText size={14} /> View Details
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => handleOpenEditModal(record.record)}
                                  className="gap-2 font-bold text-xs py-2 px-3 rounded-lg cursor-pointer text-[#7a9800] hover:bg-slate-50 transition-colors"
                                >
                                  <Edit2 size={14} /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-slate-100 my-1" />
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setRecordToDelete({ id: record.originalId });
                                    setIsDeleteConfirmOpen(true);
                                  }}
                                  className="gap-2 font-bold text-xs py-2 px-3 rounded-lg cursor-pointer text-rose-600 hover:bg-rose-50 transition-colors"
                                >
                                  <Trash2 size={14} /> Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-bold text-[#2e1d52] align-middle")}>
                        {record.isRawMaterial ? (
                          <Link href={`/production/raw-materials/${record.originalId}`} className="hover:text-[#7a9800] hover:underline underline-offset-4 transition-colors">
                            {record.lotNumber}
                          </Link>
                        ) : (
                          <span className="text-[#7a9800]">{record.lotNumber}</span>
                        )}
                      </TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-semibold text-slate-600 align-middle")}>{record.date}</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-semibold text-slate-600 align-middle")}>{record.blNetWeight.toLocaleString()} kg</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-semibold text-rose-500 align-middle")}>{record.decayNetWeight.toLocaleString()} kg</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-bold text-[#7a9800] align-middle")}>{record.rawMaterialPrice > 0 ? `${record.rawMaterialPrice.toLocaleString()} MAD` : <span className="text-amber-500 font-bold italic text-[10px]">Pending</span>}</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-semibold text-slate-600 align-middle")}>{record.workerCost.toLocaleString()} MAD</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-semibold text-amber-500 align-middle")}>{record.rebate.toLocaleString()} %</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-black text-[#2e1d52] align-middle")}>
                        {record.finalAmount === 'Pending' ? <span className="text-amber-500 font-bold italic text-[10px]">Pending</span> : `${record.finalAmount.toLocaleString()} MAD`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* PAYMENTS TAB */}
            {activeTab === 'payments' && (
              <Table className="w-full min-w-[1400px] border-collapse">
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6 md:pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 w-[80px]">Actions</TableHead>
                    {renderSortHeader('Date', 'date')}
                    {renderSortHeader('Amount', 'amount')}
                    {renderSortHeader('Operation Type', 'operationType')}
                    {renderSortHeader('Payment Type', 'paymentType')}
                    {renderSortHeader('Note', 'note')}
                    {renderSortHeader('Created At', 'created_at')}
                    {renderSortHeader('Created By', 'created_by')}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-8 h-8 rounded-full border-2 border-[#7a9800] border-t-transparent animate-spin mx-auto" />
                          <p className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Loading Payments...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : allPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                          <Search size={40} className="text-slate-400" />
                          <p className="font-black uppercase tracking-widest text-[10px]">No records found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : allPayments.map((record) => (
                    <TableRow key={record.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none group">
                      <TableCell className={cn(densityPaddingClass, "pl-6 md:pl-8 align-middle")}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 data-[state=open]:bg-slate-100">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-100 shadow-xl p-1 bg-white">
                            <DropdownMenuItem 
                              onClick={() => handleOpenEditModal(record)}
                              className="gap-2 font-bold text-xs py-2 px-3 rounded-lg cursor-pointer text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                            >
                              <Edit2 size={14} className="text-[#7a9800]" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-100 my-1" />
                            <DropdownMenuItem 
                              onClick={() => {
                                setRecordToDelete(record);
                                setIsDeleteConfirmOpen(true);
                              }}
                              className="gap-2 font-bold text-xs py-2 px-3 rounded-lg cursor-pointer text-rose-600 hover:bg-rose-50 transition-colors focus:text-rose-600 focus:bg-rose-50"
                            >
                              <Trash2 size={14} /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-semibold text-slate-600 align-middle")}>{record.date}</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-black text-[#7a9800] align-middle")}>{record.amount.toLocaleString()} MAD</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-bold text-slate-600 align-middle")}>
                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{record.operationType}</span>
                      </TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-bold text-slate-600 align-middle")}>
                        <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{record.paymentType}</span>
                      </TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-semibold text-slate-600 align-middle")}>{record.note || '-'}</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-semibold text-slate-600 align-middle")}>{record.created_at}</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-semibold text-slate-600 align-middle")}>{record.created_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* SITUATION TAB */}
            {activeTab === 'situation' && (
              <Table className="w-full min-w-[1000px] border-collapse">
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent">
                    {renderSortHeader('Date', 'date')}
                    {renderSortHeader('Description', 'description')}
                    {renderSortHeader('Debit', 'debit')}
                    {renderSortHeader('Credit', 'credit')}
                    {renderSortHeader('Balance', 'balance')}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-8 h-8 rounded-full border-2 border-[#7a9800] border-t-transparent animate-spin mx-auto" />
                          <p className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Loading Situations...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : situations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                          <Search size={40} className="text-slate-400" />
                          <p className="font-black uppercase tracking-widest text-[10px]">No records found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : situations.map((record) => (
                    <TableRow key={record.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none group">
                      <TableCell className={cn(densityPaddingClass, "font-semibold text-slate-600 align-middle")}>{record.date}</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-bold text-[#2e1d52] align-middle")}>{record.description}</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-black text-[#7a9800] align-middle")}>{record.debit > 0 ? `${record.debit.toLocaleString()} MAD` : '-'}</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-black text-rose-500 align-middle")}>{record.credit > 0 ? `${record.credit.toLocaleString()} MAD` : '-'}</TableCell>
                      <TableCell className={cn(densityPaddingClass, "font-black text-[#2e1d52] align-middle")}>{record.balance.toLocaleString()} MAD</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

          </div>

          {/* Pagination */}
          <div className="p-4 md:p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <span>Showing 1 to 8 of 10 Record(s)</span>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg hover:bg-slate-100 font-black uppercase text-[10px]">
                <ChevronLeft size={14} className="mr-1" /> Previous
              </Button>
              <Button className="h-8 w-8 rounded-lg font-black text-[10px] p-0 bg-[#7a9800] text-white hover:bg-[#6c8500]">
                1
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg hover:bg-slate-100 font-black uppercase text-[10px]">
                Next <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* --- ADD/EDIT PAYMENT MODAL --- */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-3xl border-none shadow-2xl p-0 overflow-hidden ring-1 ring-black/5 animate-in fade-in duration-300">
          <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
            <DialogTitle className="text-xl font-black text-[#2e1d52] uppercase tracking-tight">
              {paymentFormMode === 'add' ? 'Add Supplier Payment' : 'Edit Supplier Payment'}
            </DialogTitle>
          </div>
          <form onSubmit={handlePaymentSubmit} className="p-8 space-y-6">
            
            {/* Date */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date *</Label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="date"
                  className="h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] pl-10"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount *</Label>
              <div className="relative">
                <DollarSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  type="number"
                  placeholder="Enter amount..."
                  className="h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800] pl-10"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Select Operation */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Operation *</Label>
              <select
                className="w-full h-12 px-4 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#7a9800] outline-none transition-all"
                value={paymentOperation}
                onChange={e => setPaymentOperation(e.target.value)}
                required
              >
                <option value="Solde">Solde</option>
                <option value="Avance">Avance</option>
                <option value="Payment">Payment</option>
              </select>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Note</Label>
              <div className="relative">
                <Notebook size={16} className="absolute left-3.5 top-5 text-slate-400" />
                <Textarea
                  placeholder="Enter note..."
                  className="rounded-xl bg-slate-50 border-none font-semibold text-slate-800 focus-visible:ring-[#7a9800] pl-10 min-h-[100px] resize-none"
                  value={paymentNote}
                  onChange={e => setPaymentNote(e.target.value)}
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

      {/* --- DELETE CONFIRMATION ALERT DIALOG --- */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white rounded-3xl border-none shadow-2xl p-6 ring-1 ring-black/5">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-lg font-black text-[#2e1d52] uppercase tracking-tight">
              Are you sure you want to delete this payment?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-semibold text-xs leading-normal">
              This action cannot be undone. This will permanently delete the payment.
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
