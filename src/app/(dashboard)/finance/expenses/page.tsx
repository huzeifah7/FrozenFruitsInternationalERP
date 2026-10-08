'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, doc, deleteDoc, updateDoc } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuthContext } from '@/components/auth-provider';
import { canList, canAdd as checkCanAdd, canUpdate, canDelete } from '@/lib/permissions';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPTable } from '@/components/erp/ERPTable';
import { ERPToolbar } from '@/components/erp/ERPToolbar';
import { ERPExportButtons } from '@/components/erp/ERPExportButtons';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Plus, MoreHorizontal, Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useSeason } from '@/contexts/SeasonContext';
import Swal from 'sweetalert2';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const formatAmount = (value: any, symbol = 'MAD') => `${Number(value || 0).toFixed(2)} ${symbol}`.trim();
export default function ExpensesPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { profile } = useAuthContext();
  const { currentSeason } = useSeason();

  const hasListAccess = canList(profile, 'finance.expenses');
  const hasAddAccess = checkCanAdd(profile, 'finance.expenses');
  const hasUpdateAccess = canUpdate(profile, 'finance.expenses');
  const hasDeleteAccess = canDelete(profile, 'finance.expenses');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [paymentDate, setPaymentDate] = useState('');
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [bank, setBank] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const q = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'expenses'));
  }, [db]);

  const { data: allRecords, isLoading } = useCollection(q);

  const filteredRecords = useMemo(() => {
    const list = allRecords || [];
    const seasonFiltered = list.filter(r => !currentSeason?.id || !r.season_id || r.season_id === currentSeason.id);
    
    if (!searchTerm) return seasonFiltered;
    const lower = searchTerm.toLowerCase();
    return seasonFiltered.filter(r => 
      (r.invoice_number || '').toLowerCase().includes(lower) ||
      (r.supplier_detail?.name || r.supplier || '').toLowerCase().includes(lower) ||
      (r.expense_type || '').toLowerCase().includes(lower)
    );
  }, [allRecords, searchTerm, currentSeason]);

  const handleDelete = async (id: string) => {
    if (!db) return;
    const result = await Swal.fire({
      title: 'Do you really want to delete this record?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      confirmButtonColor: '#d33'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
        toast({ title: 'Success', description: 'Your Record has been deleted.' });
      } catch (err) {
        console.error('Error deleting expense:', err);
        toast({ title: 'Error', description: 'Failed to delete expense.', variant: 'destructive' });
      }
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/finance/expenses/${id}/edit`);
  };

  const handleView = (id: string) => {
    router.push(`/finance/expenses/${id}`);
  };

  const openPaymentModal = (row: any) => {
    if (!hasUpdateAccess) {
      toast({ title: 'Unauthorized', description: 'You do not have permission to update payments.', variant: 'destructive' });
      return;
    }
    setSelectedExpense(row);
    setPaymentDate(row.payment_date || new Date().toISOString().split('T')[0]);
    setPaymentMethod(row.payment_method || '');
    setBank(row.bank_detail?.title || row.bank || '');
    setPaymentNote(row.payment_note || '');
    setPaymentModalOpen(true);
  };

  const updatePayment = async () => {
    if (!db || !selectedExpense) return;
    if (!paymentDate) {
      toast({ title: 'Error', description: 'Payment Date is required.', variant: 'destructive' });
      return;
    }
    if (!paymentMethod) {
      toast({ title: 'Error', description: 'Payment Method is required.', variant: 'destructive' });
      return;
    }
    if (paymentMethod === 'Bank Transfer' && !bank) {
      toast({ title: 'Error', description: 'Bank is required for Bank Transfer.', variant: 'destructive' });
      return;
    }

    setIsUpdatingPayment(true);
    try {
      await updateDoc(doc(db, 'expenses', selectedExpense.id), {
        payment_date: paymentDate,
        payment_method: paymentMethod,
        bank: paymentMethod === 'Bank Transfer' ? bank : '',
        payment_note: paymentNote,
        payment_status: 'PAID'
      });
      toast({ title: 'Success', description: 'Payment Added Successfully.' });
      setPaymentModalOpen(false);
    } catch (err) {
      console.error('Error updating payment', err);
      toast({ title: 'Error', description: 'Failed to update payment.', variant: 'destructive' });
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const confirmResetPayment = async () => {
    if (!db || !selectedExpense) return;
    
    setIsUpdatingPayment(true);
    try {
      await updateDoc(doc(db, 'expenses', selectedExpense.id), {
        payment_date: '',
        payment_method: '',
        bank: '',
        payment_note: '',
        payment_status: 'UNPAID'
      });
      toast({ title: 'Success', description: 'Payment Reset Successfully.' });
      setPaymentModalOpen(false);
      setShowResetConfirm(false);
    } catch (err) {
      console.error('Error resetting payment', err);
      toast({ title: 'Error', description: 'Failed to reset payment.', variant: 'destructive' });
    } finally {
      setIsUpdatingPayment(false);
    }
  };

  const columns = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);

    const baseCols: any[] = [
      {
        header: 'Actions',
        accessorKey: 'actions',
        align: 'center',
        render: (row: any) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                <MoreHorizontal className="h-4 w-4 text-slate-500" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40 rounded-xl shadow-lg border-slate-100">
              {hasListAccess && (
                <DropdownMenuItem onClick={() => handleView(row.id)} className="gap-2 cursor-pointer text-sm font-semibold text-slate-600">
                  <Eye className="h-4 w-4" /> View
                </DropdownMenuItem>
              )}
              {hasUpdateAccess && (
                <DropdownMenuItem onClick={() => handleEdit(row.id)} className="gap-2 cursor-pointer text-sm font-semibold text-blue-600 focus:text-blue-600 focus:bg-blue-50">
                  <Edit className="h-4 w-4" /> Edit
                </DropdownMenuItem>
              )}
              {hasDeleteAccess && (
                <DropdownMenuItem onClick={() => handleDelete(row.id)} className="gap-2 cursor-pointer text-sm font-semibold text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                  <Trash2 className="h-4 w-4" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      { 
        header: 'Type', 
        accessorKey: 'type',
        render: (row: any) => String(row.type) === '2' ? 'Credit Note' : 'Invoice'
      },
      { 
        header: 'Invoice Number', 
        accessorKey: 'invoice_number',
        render: (row: any) => (
          <span 
            onClick={() => hasUpdateAccess && openPaymentModal(row)}
            className={`font-bold ${hasUpdateAccess ? 'text-blue-600 cursor-pointer underline' : 'text-[#2e1d52]'}`}
          >
            {row.invoice_number || '-'}
          </span>
        )
      },
      { header: 'Invoice Date', accessorKey: 'invoice_date', render: (row: any) => row.invoice_date || '-' },
      { header: "Supplier's Name", accessorKey: 'supplier_name', render: (row: any) => row.supplier_detail?.name || row.supplier || '-' },
      { 
        header: 'Total Amount TTC', 
        accessorKey: 'total_amount_ttc',
        render: (row: any) => {
           let amtStr = formatAmount(row.total_amount_ttc || row.total_amount);
           if (String(row.type) === '2') {
             amtStr = `-${amtStr}`;
           }
           return <span className="font-black text-[#2e1d52]">{amtStr}</span>;
        }
      },
      { header: 'Expense Type', accessorKey: 'expense_type', render: (row: any) => row.expense_type || '-' },
      { header: 'Expense Type Extention', accessorKey: 'expense_type_extention', render: (row: any) => row.expense_type_extention || '-' },
      { 
        header: 'Due Date', 
        accessorKey: 'invoice_due_date',
        render: (row: any) => {
          if (!row.invoice_due_date) return '-';
          try {
            const isPaid = row.payment_status?.toLowerCase() === 'paid';
            const dueDate = new Date(row.invoice_due_date);
            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const isUrgent = !isPaid && diffDays <= 7;
            return <span className={isUrgent ? 'text-red-500 font-bold' : ''}>{row.invoice_due_date}</span>;
          } catch {
            return row.invoice_due_date;
          }
        }
      },
      { 
        header: 'Payment Status', 
        accessorKey: 'payment_status',
        render: (row: any) => {
          const status = row.payment_status || 'UNPAID';
          const isPaid = status.toLowerCase() === 'paid';
          return <span className={isPaid ? 'text-green-600 font-bold' : ''}>{status}</span>;
        }
      },
      { header: 'Payment Date', accessorKey: 'payment_date', render: (row: any) => row.payment_date || '-' },
      { header: 'Payment Method', accessorKey: 'payment_method', render: (row: any) => row.payment_method || '-' },
      { header: 'Bank', accessorKey: 'bank', render: (row: any) => row.bank_detail?.title || row.bank || '-' },
      { header: 'IF', accessorKey: 'if', render: (row: any) => row.if || '-' },
      { header: 'ICE', accessorKey: 'ice', render: (row: any) => row.ice || '-' },
      { 
        header: 'Created By', 
        accessorKey: 'createdBy',
        render: (row: any) => {
          if (row.createdby?.first_name || row.createdby?.last_name) return `${row.createdby.first_name || ''} ${row.createdby.last_name || ''}`.trim();
          return row.createdBy || row.createdByName || '-';
        }
      },
      { 
        header: 'Updated By', 
        accessorKey: 'updatedBy',
        render: (row: any) => {
          if (row.updatedby?.first_name || row.updatedby?.last_name) return `${row.updatedby.first_name || ''} ${row.updatedby.last_name || ''}`.trim();
          return row.updatedBy || row.updatedByName || '-';
        }
      }
    ];

    return baseCols;
  }, [hasUpdateAccess, hasDeleteAccess, hasListAccess]);

  const handleExportExcelCustom = async () => {
    if (filteredRecords.length === 0) {
      toast({ title: 'No Data', description: 'No records to export.', variant: 'destructive' });
      return;
    }
    
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Expenses');
    
    const greenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } } as ExcelJS.FillPattern;
    const borderAll = {
      top: { style: 'thin' as any }, left: { style: 'thin' as any },
      bottom: { style: 'thin' as any }, right: { style: 'thin' as any }
    };
    const headerFont = { bold: true, size: 9 };
    const rowFont = { size: 9 };

    // Fetch the logo image as base64
    let logoBase64 = '';
    try {
      const response = await fetch('/FFI_main.png');
      const blob = await response.blob();
      const reader = new FileReader();
      logoBase64 = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Could not load logo", e);
    }

    if (logoBase64) {
      const imageId = wb.addImage({ base64: logoBase64, extension: 'png' });
      ws.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 120, height: 60 }
      });
    }

    // Move to row 5 to make space for the logo
    let rowIdx = 5;

    const headers = [
      "FACTURES N°", "Date de Facture", "Date D'écheance", "Designation", "Designation Entente",
      "MT HT", "TVA 20%", "TVA 18%", "TVA 12%", "TVA 15%", "TVA 14%", "TVA 7%", "TVA 10%", "TVA 0%",
      "Total Amount TTC", "Fournisseur", "IF", "ICE", "Mode de paiement", "Date de paiement"
    ];

    headers.forEach((h, i) => {
      const cell = ws.getCell(rowIdx, i + 1);
      cell.value = h;
      cell.font = headerFont;
      cell.fill = greenFill;
      cell.border = borderAll;
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    rowIdx++;

    const getTva = (r: any, rateStr: string) => {
      if (!r.contents || !Array.isArray(r.contents)) return '';
      const t = r.contents.find((c: any) => String(c.tva_rate) === rateStr);
      return t ? (Number(t.tva_amount) || 0) : '';
    };

    filteredRecords.forEach((r, idx) => {
      const isAlt = idx % 2 === 0;
      
      const values = [
        r.invoice_number || '',
        r.invoice_date || '',
        r.invoice_due_date || '',
        r.expense_type || '',
        r.expense_type_extention || '',
        Number(r.amount_ht || 0),
        getTva(r, '20'),
        getTva(r, '18'),
        getTva(r, '12'),
        getTva(r, '15'),
        getTva(r, '14'),
        getTva(r, '7'),
        getTva(r, '10'),
        getTva(r, '0'),
        Number(r.total_amount_ttc || r.total_amount || 0),
        r.supplier_detail?.name || r.supplier || '',
        r.if || '',
        r.ice || '',
        r.payment_method || '',
        r.payment_date || ''
      ];

      values.forEach((val, i) => {
        const cell = ws.getCell(rowIdx, i + 1);
        if (typeof val === 'number' && val === 0) {
           cell.value = 0; // The screenshot shows 0 for empty TVAs
        } else {
           cell.value = val;
        }
        cell.font = rowFont;
        if (i === 2 && val) {
          // Date D'écheance is red
          cell.font = { ...rowFont, color: { argb: 'FFFF0000' }, bold: true };
        }
        if (isAlt) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6E9' } };
        }
        cell.border = borderAll;
        cell.alignment = { vertical: 'middle', horizontal: typeof val === 'number' ? 'right' : 'left', wrapText: true };
      });
      rowIdx++;
    });

    // Column widths
    ws.columns = [
      { width: 15 }, { width: 12 }, { width: 12 }, { width: 15 }, { width: 15 },
      { width: 10 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 }, { width: 8 },
      { width: 15 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 15 }
    ];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Expenses.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!hasListAccess) {
    return <div className="p-8 text-center text-rose-500 font-bold">Unauthorized. You do not have permission to access this page.</div>;
  }

  const breadcrumbItems = [
    { label: 'Profile', href: '/finance/expenses' },
    { label: 'Expenses', active: true }
  ];

  return (
    <div className={`p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 overflow-auto bg-white' : ''}`}>
      <ERPPageHeader
        title="Expenses"
        subtitle="Manage your financial expenses."
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex items-center gap-3">
            <ERPExportButtons 
              onExportExcel={handleExportExcelCustom}
              excelFileName="Expenses"
              hidePDF={true}
            />
            {hasAddAccess && (
              <Button 
                className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-4 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                onClick={() => router.push('/finance/expenses/add')}
              >
                <Plus size={20} className="stroke-[2.5]" />
                <span className="font-bold tracking-wide">Add Expense</span>
              </Button>
            )}
          </div>
        }
      />

      <div className="max-w-[1600px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <ERPToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          density={density}
          onDensityChange={setDensity}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(prev => !prev)}
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-[#7a9800] animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Records...</p>
          </div>
        ) : (
          <ERPTable
            columns={columns}
            data={filteredRecords}
            density={density}
            getRowId={(row) => row.id}
            pageSize={10}
            emptyMessage="No records to display"
          />
        )}
      </div>

      <Dialog open={paymentModalOpen} onOpenChange={(open) => {
        setPaymentModalOpen(open);
        if (!open) setShowResetConfirm(false);
      }}>
        <DialogContent className="sm:max-w-md bg-white rounded-2xl shadow-2xl border-0 overflow-hidden p-0">
          <DialogHeader className="bg-slate-50 border-b border-slate-100 p-6 pb-4">
            <DialogTitle className="text-lg font-black text-[#2e1d52] uppercase tracking-wider">Payment Situation</DialogTitle>
          </DialogHeader>

          {showResetConfirm ? (
            <div className="p-8 text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="h-8 w-8 text-rose-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Are you sure?</h3>
              <p className="text-sm font-medium text-slate-500">
                This will instantly clear out all payment details and set the status back to OPEN.
              </p>
              <div className="pt-4 flex items-center justify-center gap-3">
                <Button onClick={() => setShowResetConfirm(false)} variant="outline" className="h-11 rounded-xl font-bold px-6">
                  No, Keep it
                </Button>
                <Button onClick={confirmResetPayment} disabled={isUpdatingPayment} className="h-11 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold px-6 shadow-lg shadow-rose-500/20 transition-all">
                  {isUpdatingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, Reset Payment'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Payment Date <span className="text-rose-500">*</span></label>
                  <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="h-11 rounded-xl bg-slate-50 border-slate-200" />
                </div>
                
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Payment Method <span className="text-rose-500">*</span></label>
                  <select 
                    value={paymentMethod} 
                    onChange={e => {
                      setPaymentMethod(e.target.value);
                      if (e.target.value !== 'Bank Transfer') setBank('');
                    }}
                    className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm font-medium focus:ring-2 focus:ring-[#7a9800]/20 focus:border-[#7a9800] transition-all outline-none"
                  >
                    <option value="">Select Method</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Lettre De Change">Lettre De Change</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>

                {paymentMethod === 'Bank Transfer' && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Select Bank <span className="text-rose-500">*</span></label>
                    <select 
                      value={bank} 
                      onChange={e => setBank(e.target.value)}
                      className="w-full h-11 rounded-xl bg-slate-50 border border-slate-200 px-3 text-sm font-medium focus:ring-2 focus:ring-[#7a9800]/20 focus:border-[#7a9800] transition-all outline-none"
                    >
                      <option value="">Select Bank</option>
                      <option value="BMCE EO">BMCE EO</option>
                      <option value="Credit Agricole EO">Credit Agricole EO</option>
                      <option value="Caixha Bank">Caixha Bank</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Payment Note</label>
                  <Input value={paymentNote} onChange={e => setPaymentNote(e.target.value)} placeholder="Notes..." className="h-11 rounded-xl bg-slate-50 border-slate-200" />
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                <Button onClick={() => setShowResetConfirm(true)} disabled={isUpdatingPayment} variant="outline" className="h-11 rounded-xl font-bold text-rose-600 border-rose-200 hover:bg-rose-50 px-6">
                  Reset
                </Button>
                <div className="flex items-center gap-3">
                  <Button onClick={() => setPaymentModalOpen(false)} variant="outline" className="h-11 rounded-xl font-bold px-6">
                    Cancel
                  </Button>
                  <Button onClick={updatePayment} disabled={isUpdatingPayment} className="h-11 bg-[#7a9800] hover:bg-[#6c8500] text-white rounded-xl font-bold px-8 shadow-lg shadow-[#7a9800]/20 transition-all">
                    {isUpdatingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
