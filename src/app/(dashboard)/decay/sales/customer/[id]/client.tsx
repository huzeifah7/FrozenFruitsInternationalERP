'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  collection, 
  query, 
  where,
  deleteDoc, 
  doc,
  addDoc,
  updateDoc,
  getDoc
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useCollection, 
  useDoc,
  useMemoFirebase,
  useUser 
} from '@/firebase';
import { getBase64ImageFromUrl } from '@/lib/utils';
import { useSeason } from '@/contexts/SeasonContext';
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Plus,
  Download,
  Notebook,
  Building,
  Edit2
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { generateDecayCustomerSituationPDF } from '@/lib/export-decay-customer-situation-pdf';

export default function DecaySaleByCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { currentSeason } = useSeason();

  // --- UI States ---
  const [activeTab, setActiveTab] = useState<'solde' | 'payments'>('solde');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // --- Modals States ---
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentFormMode, setPaymentFormMode] = useState<'add' | 'edit'>('add');
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<'invoice' | 'payment' | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  // --- Payment Form States ---
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Virement' | 'Espece' | 'Cheque'>('Virement');
  const [paymentNote, setPaymentNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Fetch Data ---
  const customerDocRef = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    return doc(db, 'local_customers', customerId);
  }, [db, customerId]);
  const { data: customerData, isLoading: loadingCustomer } = useDoc(customerDocRef);

  const invoicesQuery = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    let q = query(collection(db, 'decay_loadings'), where('customerId', '==', customerId));
    if (currentSeason?.id) {
      q = query(q, where('season_id', '==', currentSeason.id));
    }
    return q;
  }, [db, customerId, currentSeason]);
  const { data: rawInvoices, isLoading: loadingInvoices } = useCollection(invoicesQuery);

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    let q = query(collection(db, 'decay_payments'), where('customerId', '==', customerId));
    if (currentSeason?.id) {
      q = query(q, where('season_id', '==', currentSeason.id));
    }
    return q;
  }, [db, customerId, currentSeason]);
  const { data: rawPayments, isLoading: loadingPayments } = useCollection(paymentsQuery);

  const isLoading = loadingCustomer || loadingInvoices || loadingPayments;

  // Helper: Deterministic Invoice Number
  const getInvoiceNumber = (record: any) => {
    if (record.invoiceNumber) return record.invoiceNumber;
    const dateStr = record.date ? record.date.split('-').reverse().join('') : '00000000';
    const idHash = record.id ? record.id.slice(-8) : '00000000';
    return `PP${dateStr}-${idHash}`;
  };

  // --- Filtered Listings ---
  const filteredInvoices = useMemo(() => {
    if (!rawInvoices) return [];
    let list = rawInvoices.map(invoice => {
      const totalQty = invoice.items?.reduce((sum: number, i: any) => sum + Number(i.netWeight || 0), 0) || Number(invoice.quantity || 0);
      const price = Number(invoice.price || 0);
      const calcTotal = Number(invoice.total_amount || invoice.totalAmount || (totalQty * price) || 0);
      const averagePrice = price || (totalQty > 0 ? calcTotal / totalQty : 0);
      return {
        ...invoice,
        invoiceNumber: getInvoiceNumber(invoice),
        totalQuantity: totalQty,
        price: averagePrice,
        totalAmount: calcTotal,
      };
    });

    if (startDate) list = list.filter(item => item.date >= startDate);
    if (endDate) list = list.filter(item => item.date <= endDate);

    return list;
  }, [rawInvoices, startDate, endDate]);

  const filteredPayments = useMemo(() => {
    if (!rawPayments) return [];
    let list = [...rawPayments];
    if (startDate) list = list.filter(item => item.date >= startDate);
    if (endDate) list = list.filter(item => item.date <= endDate);
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [rawPayments, startDate, endDate]);

  // --- Compute Ledger Stats ---
  const stats = useMemo(() => {
    const totalSales = filteredInvoices.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
    const totalPayments = filteredPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const openAmount = totalSales - totalPayments;
    const totalQty = filteredInvoices.reduce((sum, item) => sum + Number(item.totalQuantity || 0), 0);

    return {
      totalSales,
      totalPayments,
      openAmount,
      totalQty
    };
  }, [filteredInvoices, filteredPayments]);

  // --- Open Add Payment ---
  const handleOpenAddModal = () => {
    setPaymentFormMode('add');
    setEditingPaymentId(null);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentAmount('');
    setPaymentMethod('Virement');
    setPaymentNote('');
    setIsPaymentModalOpen(true);
  };

  // --- Open Edit Payment ---
  const handleOpenEditModal = (payment: any) => {
    setPaymentFormMode('edit');
    setEditingPaymentId(payment.id);
    setPaymentDate(payment.date || new Date().toISOString().split('T')[0]);
    setPaymentAmount(payment.amount?.toString() || '');
    setPaymentMethod(payment.paymentMethod || 'Virement');
    setPaymentNote(payment.note || '');
    setIsPaymentModalOpen(true);
  };

  // --- Submit Payment ---
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !customerId) return;

    if (!paymentDate || !paymentAmount) {
      toast({ title: 'Validation Error', description: 'Please fill out all required fields.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const amountNum = Number(paymentAmount);
      const payload = {
        season_id: currentSeason?.id || null,
        customerId,
        customerName: customerData?.name || 'Unknown',
        date: paymentDate,
        amount: amountNum,
        paymentMethod,
        note: paymentNote,
        updated_at: new Date(),
        updated_by: user.email || 'unknown'
      };

      if (paymentFormMode === 'add') {
        await addDoc(collection(db, 'decay_payments'), {
          ...payload,
          created_at: new Date(),
          created_by: user.email || 'unknown'
        });
        toast({ title: 'Success', description: 'Payment recorded successfully.' });
      } else if (editingPaymentId) {
        await updateDoc(doc(db, 'decay_payments', editingPaymentId), payload);
        toast({ title: 'Success', description: 'Payment updated successfully.' });
      }

      setIsPaymentModalOpen(false);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save payment.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Delete Handler ---
  const handleDeleteConfirm = async () => {
    if (!db || !recordToDelete || !deleteType) return;
    try {
      const coll = deleteType === 'invoice' ? 'decay_loadings' : 'decay_payments';
      await deleteDoc(doc(db, coll, recordToDelete));
      toast({ title: 'Success', description: `${deleteType === 'invoice' ? 'Invoice' : 'Payment'} deleted successfully.` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Deletion failed.', variant: 'destructive' });
    } finally {
      setIsDeleteConfirmOpen(false);
      setRecordToDelete(null);
      setDeleteType(null);
    }
  };

  const densityPaddingClass = {
    compact: 'py-2 px-4 h-12 text-xs',
    normal: 'py-4 px-6 h-16 text-xs',
    tall: 'py-6 px-8 h-20 text-sm'
  }[density];

  const allDates = useMemo(() => {
    return [...filteredInvoices.map(i => i.date), ...filteredPayments.map(p => p.date)].filter(Boolean).sort();
  }, [filteredInvoices, filteredPayments]);

  const displayStartDate = startDate || (allDates.length > 0 ? allDates[0] : '—');
  const displayEndDate = endDate || new Date().toISOString().split('T')[0];

  // Excel Export
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Situation Client');

      // Base64 Logo
      let logoId: number | null = null;
      try {
        const logoData = await getBase64ImageFromUrl('/FFI_main.png');
        if (logoData) {
          logoId = workbook.addImage({
            base64: logoData,
            extension: 'png',
          });
        }
      } catch (err) {
        console.warn('Could not load logo for Excel', err);
      }

      // Constants
      const THEME_GREEN = 'FFf2f7e6';
      const THEME_BLACK = 'FF000000';
      const THEME_WHITE = 'FFFFFFFF';
      const BORDER_STYLE = { style: 'thin', color: { argb: THEME_BLACK } };
      
      const borderAll = { top: BORDER_STYLE, left: BORDER_STYLE, bottom: BORDER_STYLE, right: BORDER_STYLE };

      // Base format
      sheet.properties.defaultRowHeight = 20;

      // 1. Logo Space
      sheet.mergeCells('A1:C4');
      const logoCell = sheet.getCell('A1');
      if (logoId !== null) {
        sheet.addImage(logoId, {
          tl: { col: 0, row: 0 },
          ext: { width: 180, height: 70 }
        });
      } else {
        logoCell.value = 'LOGO: Export Optimum';
        logoCell.alignment = { vertical: 'middle', horizontal: 'center' };
        logoCell.font = { bold: true, color: { argb: 'FF999999' } };
      }

      // 2. Title
      sheet.mergeCells('D2:G3');
      const titleCell = sheet.getCell('D2');
      titleCell.value = 'SITUATION CLIENT';
      titleCell.font = { name: 'Arial', size: 20, bold: true, color: { argb: THEME_BLACK } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      // Header Block
      let headerStart = 6;
      sheet.getCell(`G${headerStart}`).value = 'De';
      sheet.getCell(`H${headerStart}`).value = displayStartDate;
      sheet.getCell(`G${headerStart}`).font = { bold: true };
      sheet.getCell(`H${headerStart}`).alignment = { horizontal: 'right' };

      sheet.getCell(`G${headerStart+1}`).value = 'Au';
      sheet.getCell(`H${headerStart+1}`).value = displayEndDate;
      sheet.getCell(`G${headerStart+1}`).font = { bold: true };
      sheet.getCell(`H${headerStart+1}`).alignment = { horizontal: 'right' };

      sheet.getCell(`A${headerStart+2}`).value = 'Station';
      sheet.getCell(`B${headerStart+2}`).value = 'Export Optimum Laouamra';
      sheet.getCell(`A${headerStart+2}`).font = { bold: true };
      
      sheet.getCell(`A${headerStart+3}`).value = 'Client';
      sheet.getCell(`B${headerStart+3}`).value = customerData?.name || '—';
      sheet.getCell(`A${headerStart+3}`).font = { bold: true };

      let currentY = headerStart + 5;

      // --- SOLDE BLOCK ---
      sheet.mergeCells(`A${currentY}:H${currentY}`);
      const soldeTitleCell = sheet.getCell(`A${currentY}`);
      soldeTitleCell.value = `Solde: ${stats.totalSales.toFixed(2)}dh`;
      soldeTitleCell.font = { bold: true, color: { argb: THEME_BLACK } };
      soldeTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME_GREEN } };
      soldeTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      
      currentY++;

      // Solde Headers
      const soldeCols = [
        'Numéro de Facture', 'Heure et Date', 'Client', 'Quantité', 'Prix', 
        'Montant Totale', 'Statut de paiement', 'Mode de paiement'
      ];
      
      soldeCols.forEach((col, idx) => {
        const cell = sheet.getCell(currentY, idx + 1);
        cell.value = col;
        cell.font = { bold: true };
        cell.border = borderAll;
      });

      // Solde Column Widths
      sheet.getColumn(1).width = 25;
      sheet.getColumn(2).width = 20;
      sheet.getColumn(3).width = 25;
      sheet.getColumn(4).width = 15;
      sheet.getColumn(5).width = 15;
      sheet.getColumn(6).width = 20;
      sheet.getColumn(7).width = 15;
      sheet.getColumn(8).width = 20;

      currentY++;

      // Solde Rows
      filteredInvoices.forEach(inv => {
        const rowData = [
          inv.invoiceNumber,
          inv.date,
          inv.customerName,
          inv.totalQuantity,
          inv.price,
          inv.totalAmount, // numeric for excel
          inv.paymentStatus || 'PENDING',
          inv.paymentMethod || '—'
        ];
        const row = sheet.getRow(currentY);
        row.values = rowData;
        
        row.eachCell((cell, colNum) => {
          cell.border = borderAll;
          if (colNum >= 4 && colNum <= 6) cell.numFmt = '#,##0.00';
        });
        currentY++;
      });

      currentY += 2; // Spacer

      // --- PAYMENTS BLOCK ---
      sheet.mergeCells(`A${currentY}:E${currentY}`);
      const payTitleCell = sheet.getCell(`A${currentY}`);
      payTitleCell.value = `Total des Paiements: ${stats.totalPayments.toFixed(2)}dh`;
      payTitleCell.font = { bold: true, color: { argb: THEME_BLACK } };
      payTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME_GREEN } };
      payTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      currentY++;

      // Payments Headers
      const payCols = ['Heure et Date', 'Client', 'Montant Totale', 'Mode de paiement', 'Note'];
      payCols.forEach((col, idx) => {
        const cell = sheet.getCell(currentY, idx + 1);
        cell.value = col;
        cell.font = { bold: true };
        cell.border = borderAll;
      });

      currentY++;

      // Payments Rows
      filteredPayments.forEach(pay => {
        const rowData = [
          pay.date,
          pay.customerName || customerData?.name,
          Number(pay.amount || 0),
          pay.paymentMethod,
          pay.note || '—'
        ];
        const row = sheet.getRow(currentY);
        row.values = rowData;
        
        row.eachCell((cell, colNum) => {
          cell.border = borderAll;
          if (colNum === 3) cell.numFmt = '#,##0.00';
        });
        currentY++;
      });

      currentY += 2; // Spacer

      // --- FINAL SITUATION BLOCK ---
      sheet.mergeCells(`A${currentY}:H${currentY}`);
      const situationCell = sheet.getCell(`A${currentY}`);
      situationCell.value = `Situation: ${stats.openAmount < 0 ? stats.openAmount.toFixed(2) : stats.openAmount.toFixed(2)}dh`;
      situationCell.font = { bold: true, size: 14, color: { argb: THEME_BLACK } };
      situationCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME_GREEN } };
      situationCell.alignment = { horizontal: 'center', vertical: 'middle' };
      situationCell.border = borderAll;
      sheet.getRow(currentY).height = 30;

      // Save Output
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Customer Situation - ${customerData?.name || 'Customer'} - ${displayStartDate} - ${displayEndDate}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast({ title: 'Export Failed', description: 'Failed to generate Excel file.', variant: 'destructive' });
    }
  };

  // PDF Export
  const handleExportPDF = async () => {
    try {
      await generateDecayCustomerSituationPDF({
        customerName: customerData?.name || 'Customer',
        startDate: displayStartDate,
        endDate: displayEndDate,
        station: 'Export Optimum',
        totalSales: stats.totalSales,
        totalPayments: stats.totalPayments,
        openAmount: stats.openAmount,
        soldeRows: filteredInvoices,
        paymentRows: filteredPayments
      });
      toast({ title: 'Success', description: 'PDF downloaded.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Export Failed', description: 'Failed to generate PDF file.', variant: 'destructive' });
    }
  };

  return (
    <div className={cn(
      "w-full bg-[#f3f3f3] min-h-screen transition-all duration-300 print:bg-white print:p-0",
      isFullscreen ? "fixed inset-0 z-50 p-6 overflow-y-auto bg-[#f3f3f3]" : "p-6 lg:p-8"
    )}>
      
      {/* ----------------- VISIBLE INTERFACE ----------------- */}
      <div className="print:hidden">
        
        {/* Header */}
        <div className="max-w-[1600px] mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
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
                <span className="text-[#7a9800] font-black">Decay Sale by Customer</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">
                Decay Sale by Customer
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              onClick={handleOpenAddModal}
              className="h-12 w-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 p-0"
              title="Add Payment"
            >
              <Plus size={20} className="stroke-[3]" />
            </Button>
            <Button 
              onClick={handleExportPDF}
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

        {/* Filters */}
        <div className="max-w-[1600px] mx-auto mb-8 bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 items-end">
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
          <Button
            variant="outline"
            className="h-11 border-slate-200 text-[#7a9800] font-black uppercase text-[10px] tracking-wider rounded-xl hover:bg-slate-50 gap-2"
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
          >
            Reset Filters
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="max-w-[1600px] mx-auto mb-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-[#7a9800]/5 rounded-bl-full -z-10" />
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Sales</span>
              <div className="text-xl font-black text-[#2e1d52]">{isLoading ? '—' : stats.totalSales.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs text-slate-400 font-bold">dh</span></div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-[#7a9800]/10 flex items-center justify-center text-[#7a9800]"><DollarSign size={20} /></div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-50 rounded-bl-full -z-10" />
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paid Amounts</span>
              <div className="text-xl font-black text-emerald-600">{isLoading ? '—' : stats.totalPayments.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs text-emerald-400 font-bold">dh</span></div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500"><TrendingUp size={20} /></div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-rose-50 rounded-bl-full -z-10" />
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Open Amount</span>
              <div className="text-xl font-black text-rose-600">{isLoading ? '—' : stats.openAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className="text-xs text-rose-400 font-bold">dh</span></div>
            </div>
            <div className="h-11 w-11 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500"><TrendingDown size={20} /></div>
          </div>
        </div>

        {/* Customer Info Card */}
        <div className="max-w-[1600px] mx-auto mb-8 bg-white p-6 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6 relative overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Building className="h-5 w-5 text-slate-500" />
            </div>
            <h2 className="text-sm font-black text-[#2e1d52] uppercase tracking-[0.1em]">Customer Information Card</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer</Label>
              <div className="font-black text-[#2e1d52] text-sm mt-1">{customerData?.name || '—'}</div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Solde Operations</Label>
              <div className="font-bold text-slate-700 text-sm mt-1">{filteredInvoices.length} Invoices</div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Operations</Label>
              <div className="font-bold text-slate-700 text-sm mt-1">{filteredPayments.length} Payments</div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Start Date</Label>
              <div className="font-bold text-slate-700 text-sm mt-1">{startDate || 'First Record'}</div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">End Date</Label>
              <div className="font-bold text-slate-700 text-sm mt-1">{endDate || 'Latest Record'}</div>
            </div>
          </div>
        </div>

        {/* Tab Controls and Tables */}
        <div className="max-w-[1600px] mx-auto">
          <Tabs defaultValue="solde" onValueChange={val => setActiveTab(val as any)} className="space-y-6">
            
            <TabsList className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex gap-1 max-w-[300px]">
              <TabsTrigger value="solde" className="flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl data-[state=active]:bg-white data-[state=active]:text-[#7a9800] data-[state=active]:shadow-md">
                Solde
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl data-[state=active]:bg-white data-[state=active]:text-[#7a9800] data-[state=active]:shadow-md">
                Payments
              </TabsTrigger>
            </TabsList>

            <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden flex flex-col">
              <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth min-h-[300px]">
                <Table className="w-full border-collapse">
                  
                  {activeTab === 'solde' && (
                    <>
                      <TableHeader className="bg-slate-50 border-b border-slate-100">
                        <TableRow>
                          <TableHead className="pl-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 w-[80px]">Actions</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Invoice Number</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Date</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Customer</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Quantity</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Price</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Total Amount</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Payment Method</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Created By</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Updated By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow><TableCell colSpan={10} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin text-[#7a9800] mx-auto" /></TableCell></TableRow>
                        ) : filteredInvoices.length === 0 ? (
                          <TableRow><TableCell colSpan={10} className="h-48 text-center text-slate-400 font-bold uppercase tracking-wider text-[10px]">No invoices recorded</TableCell></TableRow>
                        ) : (
                          filteredInvoices.map((row: any) => (
                            <TableRow key={row.id} className="hover:bg-slate-50/50 border-b border-slate-100 group">
                              <TableCell className={cn("pl-6", densityPaddingClass)}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100">
                                      <MoreVertical className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="rounded-xl border-slate-100 shadow-xl p-1 bg-white w-36">
                                    <DropdownMenuItem 
                                      onClick={() => router.push(`/decay/sales/${row.id}`)}
                                      className="font-bold gap-2 cursor-pointer py-2 px-3 text-xs text-slate-700 rounded-lg hover:bg-slate-50"
                                    >
                                      <FileText size={13} className="text-slate-500" /> View Invoice
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
                                        setDeleteType('invoice');
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
                              <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>{row.created_by?.split('@')[0] || row.created_by}</TableCell>
                              <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>{row.updated_by?.split('@')[0] || row.updated_by}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </>
                  )}

                  {activeTab === 'payments' && (
                    <>
                      <TableHeader className="bg-slate-50 border-b border-slate-100">
                        <TableRow>
                          <TableHead className="pl-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 w-[80px]">Actions</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Date</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Amount</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Payment Method</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Note</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Created By</TableHead>
                          <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Updated By</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoading ? (
                          <TableRow><TableCell colSpan={7} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin text-[#7a9800] mx-auto" /></TableCell></TableRow>
                        ) : filteredPayments.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="h-48 text-center text-slate-400 font-bold uppercase tracking-wider text-[10px]">No payments recorded</TableCell></TableRow>
                        ) : (
                          filteredPayments.map((row: any) => (
                            <TableRow key={row.id} className="hover:bg-slate-50/50 border-b border-slate-100 group">
                              <TableCell className={cn("pl-6", densityPaddingClass)}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-slate-100">
                                      <MoreVertical className="h-4 w-4 text-slate-400 group-hover:text-slate-600" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="rounded-xl border-slate-100 shadow-xl p-1 bg-white w-32">
                                    <DropdownMenuItem 
                                      onClick={() => handleOpenEditModal(row)}
                                      className="font-bold gap-2 cursor-pointer py-2 px-3 text-xs text-slate-700 rounded-lg"
                                    >
                                      <Edit2 size={13} className="text-slate-500" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        setRecordToDelete(row.id);
                                        setDeleteType('payment');
                                        setIsDeleteConfirmOpen(true);
                                      }}
                                      className="font-bold gap-2 cursor-pointer py-2 px-3 text-xs text-rose-600 rounded-lg"
                                    >
                                      <Trash2 size={13} className="text-rose-500" /> Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                              <TableCell className={cn("font-bold text-slate-600 whitespace-nowrap", densityPaddingClass)}>{row.date}</TableCell>
                              <TableCell className={cn("font-black text-emerald-600 whitespace-nowrap", densityPaddingClass)}>{row.amount.toLocaleString()} <span className="text-[9px] text-emerald-400 font-bold uppercase">dh</span></TableCell>
                              <TableCell className={cn("font-bold text-slate-700 whitespace-nowrap", densityPaddingClass)}>{row.paymentMethod}</TableCell>
                              <TableCell className={cn("font-semibold text-slate-500 whitespace-nowrap truncate max-w-xs", densityPaddingClass)} title={row.note}>{row.note || '—'}</TableCell>
                              <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>{row.created_by?.split('@')[0] || row.created_by}</TableCell>
                              <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>{row.updated_by?.split('@')[0] || row.updated_by}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </>
                  )}

                </Table>
              </div>
            </div>

          </Tabs>
        </div>

      </div>

      {/* ----------------- PRINT LAYOUT (CLIENT SITUATION STATEMENT) ----------------- */}
      <div className="hidden print:block w-full max-w-[800px] mx-auto p-4 text-black bg-white select-none">
        
        {/* Print Header */}
        <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wider text-[#7a9800]">Export Optimum</h2>
            <p className="text-[10px] text-gray-500">Route de Marrakech, BP 4000, Agadir, Maroc</p>
            <p className="text-[10px] text-gray-500">Tél: +212 528 123456 | Fax: +212 528 654321</p>
          </div>
          <div className="text-right">
            <h1 className="text-2xl font-black uppercase text-gray-800 tracking-tight">Client Situation</h1>
            <p className="text-xs font-bold text-gray-500 uppercase mt-1">Vente Déchets / Decay Sale</p>
          </div>
        </div>

        {/* Print Metadata */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-xs border border-gray-200 p-4 rounded-xl">
          <div>
            <p className="mb-1"><span className="font-bold uppercase text-gray-400">Client:</span> <span className="font-black text-gray-800">{customerData?.name || '—'}</span></p>
            <p className="mb-1"><span className="font-bold uppercase text-gray-400">Station:</span> <span className="font-bold">Export Optimum</span></p>
          </div>
          <div>
            <p className="mb-1"><span className="font-bold uppercase text-gray-400">Du (Start Date):</span> <span className="font-bold">{startDate || 'First Transaction'}</span></p>
            <p className="mb-1"><span className="font-bold uppercase text-gray-400">Au (End Date):</span> <span className="font-bold">{endDate || 'Latest Transaction'}</span></p>
          </div>
        </div>

        {/* Print Table 1: Invoices */}
        <div className="mb-6">
          <h3 className="text-sm font-black uppercase tracking-wider text-gray-700 mb-2 border-l-4 border-[#7a9800] pl-2">Factures Vente Déchets</h3>
          <table className="w-full border-collapse text-[10px] border border-gray-200">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="border border-gray-200 p-2 text-left">Numéro de Facture</th>
                <th className="border border-gray-200 p-2 text-left">Heure et Date</th>
                <th className="border border-gray-200 p-2 text-left">Client</th>
                <th className="border border-gray-200 p-2 text-right">Quantité (kg)</th>
                <th className="border border-gray-200 p-2 text-right">Prix (dh)</th>
                <th className="border border-gray-200 p-2 text-right">Montant Totale</th>
                <th className="border border-gray-200 p-2 text-left">Statut de paiement</th>
                <th className="border border-gray-200 p-2 text-left">Mode de paiement</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv: any) => (
                <tr key={inv.id} className="border-b border-gray-200">
                  <td className="border border-gray-200 p-2 font-bold">{inv.invoiceNumber}</td>
                  <td className="border border-gray-200 p-2">{inv.date}</td>
                  <td className="border border-gray-200 p-2 font-semibold">{inv.customerName}</td>
                  <td className="border border-gray-200 p-2 text-right">{inv.totalQuantity.toLocaleString()}</td>
                  <td className="border border-gray-200 p-2 text-right">{inv.price.toFixed(2)}</td>
                  <td className="border border-gray-200 p-2 text-right font-black">{inv.totalAmount.toLocaleString()} dh</td>
                  <td className="border border-gray-200 p-2 font-bold">{inv.paymentStatus || 'PENDING'}</td>
                  <td className="border border-gray-200 p-2">{inv.paymentMethod}</td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr><td colSpan={8} className="p-4 text-center text-gray-400">Aucune facture enregistrée</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Print Table 2: Payments */}
        <div className="mb-6">
          <h3 className="text-sm font-black uppercase tracking-wider text-gray-700 mb-2 border-l-4 border-emerald-500 pl-2">Total des Paiements</h3>
          <table className="w-full border-collapse text-[10px] border border-gray-200">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="border border-gray-200 p-2 text-left">Heure et Date</th>
                <th className="border border-gray-200 p-2 text-left">Client</th>
                <th className="border border-gray-200 p-2 text-right">Montant Totale</th>
                <th className="border border-gray-200 p-2 text-left">Mode de paiement</th>
                <th className="border border-gray-200 p-2 text-left">Note</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((pay: any) => (
                <tr key={pay.id} className="border-b border-gray-200">
                  <td className="border border-gray-200 p-2">{pay.date}</td>
                  <td className="border border-gray-200 p-2 font-semibold">{pay.customerName}</td>
                  <td className="border border-gray-200 p-2 text-right font-black text-emerald-600">{pay.amount.toLocaleString()} dh</td>
                  <td className="border border-gray-200 p-2">{pay.paymentMethod}</td>
                  <td className="border border-gray-200 p-2 text-gray-500 font-medium">{pay.note || '—'}</td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-gray-400">Aucun paiement enregistré</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Print Footer Summary */}
        <div className="mt-8 border-t-2 border-black pt-4 flex justify-end">
          <div className="w-[300px] border border-gray-200 p-4 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between font-semibold">
              <span className="text-gray-400">Total Ventes:</span>
              <span>{stats.totalSales.toLocaleString()} dh</span>
            </div>
            <div className="flex justify-between font-semibold text-emerald-600">
              <span>Total Payé:</span>
              <span>{stats.totalPayments.toLocaleString()} dh</span>
            </div>
            <div className="flex justify-between font-black text-rose-600 text-sm border-t border-gray-100 pt-2">
              <span>Reste à Payer:</span>
              <span>{stats.openAmount.toLocaleString()} dh</span>
            </div>
          </div>
        </div>

      </div>

      {/* --- ADD/EDIT PAYMENT MODAL --- */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-3xl border-none shadow-2xl p-0 overflow-hidden ring-1 ring-black/5">
          <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10">
            <DialogTitle className="text-xl font-black text-[#2e1d52] uppercase tracking-tight">
              {paymentFormMode === 'add' ? 'Add Customer Payment' : 'Edit Customer Payment'}
            </DialogTitle>
          </div>
          <form onSubmit={handlePaymentSubmit} className="p-8 space-y-6">
            
            {/* Date */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date *</Label>
              <Input
                type="date"
                className="h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800]"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                required
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amount *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Enter amount..."
                className="h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800]"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                required
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select Payment Type *</Label>
              <select
                className="w-full h-12 px-4 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#7a9800] outline-none transition-all"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as any)}
                required
              >
                <option value="Virement">Virement</option>
                <option value="Espece">Espece</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Note</Label>
              <Textarea
                placeholder="Enter note..."
                className="rounded-xl bg-slate-50 border-none font-semibold text-slate-800 focus-visible:ring-[#7a9800] min-h-[100px] resize-none"
                value={paymentNote}
                onChange={e => setPaymentNote(e.target.value)}
              />
            </div>

            {/* Submit Bar */}
            <div className="pt-4 border-t border-slate-100 flex justify-center">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 px-12 bg-[#7a9800] hover:bg-[#6c8500] text-white font-black rounded-xl shadow-lg shadow-[#7a9800]/20 uppercase tracking-widest text-xs min-w-[160px]"
              >
                {isSubmitting ? <><Loader2 size={16} className="animate-spin mr-2" /> SUBMITTING...</> : 'SUBMIT'}
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="bg-white rounded-3xl border-none shadow-2xl p-6 ring-1 ring-black/5">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-lg font-black text-[#2e1d52] uppercase tracking-tight">
              Delete {deleteType === 'invoice' ? 'Decay Sale' : 'Payment'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-semibold text-xs leading-normal">
              Are you sure you want to delete this {deleteType === 'invoice' ? 'decay sale invoice' : 'payment record'}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="h-10 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-600 hover:bg-slate-50 border-slate-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
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
