'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuthContext } from '@/components/auth-provider';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPStatisticCard } from '@/components/erp/ERPStatisticCard';
import { ERPTable } from '@/components/erp/ERPTable';
import { ERPToolbar } from '@/components/erp/ERPToolbar';
import { ERPExportButtons } from '@/components/erp/ERPExportButtons';
import { Loader2, TrendingUp, CreditCard, AlertCircle, FileText } from 'lucide-react';
import { useSeason } from '@/contexts/SeasonContext';
import { canList } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';

const formatAmount = (value: any) => {
  return Number(value || 0).toFixed(2);
};

export default function FinanceSuppliersSituationPage() {
  const router = useRouter();
  const db = useFirestore();
  const { profile } = useAuthContext();
  const { currentSeason } = useSeason();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const hasAccess = canList(profile, 'finance.suppliersSituation');

  // Fetch Suppliers and Expenses
  const suppliersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'finance_suppliers'));
  }, [db]);

  const expensesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'expenses'));
  }, [db]);

  const { data: suppliers, isLoading: loadingSuppliers } = useCollection(suppliersQuery);
  const { data: expenses, isLoading: loadingExpenses } = useCollection(expensesQuery);

  const { supplierData, totals } = useMemo(() => {
    if (!suppliers || !expenses) {
      return { supplierData: [], totals: { total: 0, paid: 0, open: 0, creditNotes: 0 } };
    }

    let globalTotal = 0;
    let globalPaid = 0;
    let globalOpen = 0;
    let globalCreditNotes = 0;

    const data = suppliers.map(sup => {
      let totalAmount = 0;
      let paidAmount = 0;
      let creditNoteAmount = 0;

      expenses.forEach(exp => {
        // Match supplier
        const expSupplierId = exp.supplier || exp.supplier_detail?.id;
        if (expSupplierId !== sup.id) return;

        // Filter by season
        if (currentSeason?.id && exp.season_id && exp.season_id !== currentSeason.id) return;
        if (currentSeason?.id && exp.seasonId && exp.seasonId !== currentSeason.id) return;

        const amount = Number(exp.total_amount_ttc || exp.total_amount || 0);

        if (String(exp.type) === '2') {
          // Credit Note
          creditNoteAmount += amount;
        } else {
          // Invoice (type 1 or default)
          totalAmount += amount;
          
          const isPaid = (exp.payment_status || 'UNPAID').toLowerCase() === 'paid';
          if (isPaid) {
            paidAmount += amount;
          }
        }
      });

      const openAmount = totalAmount - paidAmount - creditNoteAmount;

      if (totalAmount > 0 || paidAmount > 0 || creditNoteAmount > 0) {
        globalTotal += totalAmount;
        globalPaid += paidAmount;
        globalCreditNotes += creditNoteAmount;
        globalOpen += openAmount;
      }

      return {
        id: sup.id,
        supplier_name: sup.name || sup.supplier_name,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        open_amount: openAmount,
        credit_note: creditNoteAmount
      };
    }).filter(s => s.total_amount > 0 || s.paid_amount > 0 || s.credit_note > 0);

    return {
      supplierData: data,
      totals: {
        total: globalTotal,
        paid: globalPaid,
        open: globalOpen,
        creditNotes: globalCreditNotes
      }
    };
  }, [suppliers, expenses, currentSeason]);

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm) return supplierData;
    return supplierData.filter(s => 
      s.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [supplierData, searchTerm]);

  const excelExportData = useMemo(() => {
    return filteredSuppliers.map(s => ({
      'Supplier': s.supplier_name,
      'Total Amount': formatAmount(s.total_amount),
      'Paid Amount': formatAmount(s.paid_amount),
      'Open Amount': formatAmount(s.open_amount),
      'Credit Note Amount': formatAmount(s.credit_note)
    }));
  }, [filteredSuppliers]);

  const columns = useMemo(() => [
    {
      header: 'Supplier',
      accessorKey: 'supplier_name',
      render: (row: any) => (
        <span 
          onClick={() => router.push(`/finance/suppliers-situation/${row.id}`)}
          className="font-bold text-[#2e1d52] hover:text-[#7a9800] transition-colors uppercase cursor-pointer"
        >
          {row.supplier_name || '-'}
        </span>
      )
    },
    {
      header: 'Total Amount',
      accessorKey: 'total_amount',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-black text-slate-800">
          {formatAmount(row.total_amount)}
        </span>
      )
    },
    {
      header: 'Paid Amount',
      accessorKey: 'paid_amount',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-black text-slate-800">
          {formatAmount(row.paid_amount)}
        </span>
      )
    },
    {
      header: 'Open Amount',
      accessorKey: 'open_amount',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-black text-[#7a9800]">
          {formatAmount(row.open_amount)}
        </span>
      )
    },
    {
      header: 'Credit Note Amount',
      accessorKey: 'credit_note',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-black text-blue-500">
          {formatAmount(row.credit_note)}
        </span>
      )
    }
  ], [router]);

  useEffect(() => {
    if (!hasAccess && typeof window !== 'undefined') {
      router.push('/unauthorized');
    }
  }, [hasAccess, router]);

  if (!hasAccess) {
    return null;
  }

  const pageLoading = loadingSuppliers || loadingExpenses;

  const handleExportExcelCustom = async () => {
    try {
      toast({ title: 'Exporting Excel...', description: 'Please wait while we generate your file.' });
      
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Suppliers Situation');

      try {
        const res = await fetch('/FFI_main.png');
        if (res.ok) {
            const blob = await res.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            const imageId = workbook.addImage({ base64, extension: 'png' });
            ws.addImage(imageId, { tl: { col: 0, row: 0 }, ext: { width: 140, height: 70 } });
        }
      } catch(e) {}

      ws.mergeCells('A4:S4');
      const titleCell = ws.getCell('A4');
      titleCell.value = 'SUPPLIERS SITUATION';
      titleCell.font = { bold: true, size: 16, color: { argb: 'FF000000' } };
      titleCell.alignment = { horizontal: 'center' };

      const headers = [
        "Factures N°", "Date de Facture", "Date D'échéance", "Désignation", "Mont HT",
        "TVA 20%", "TVA 18%", "TVA 12%", "TVA 15%", "TVA 14%", "TVA 7%", "TVA 10%", "TVA 0%",
        "Total Amount TTC", "Fournisseur", "IF", "ICE", "Mode de paiement", "Date de paiement"
      ];

      const headerRowIdx = 6;
      const headerRow = ws.getRow(headerRowIdx);
      headerRow.values = headers;
      
      const borderThin = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };

      headerRow.eachCell((c) => {
        c.font = { bold: true, color: { argb: 'FF000000' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } } as any;
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        c.border = borderThin as any;
      });
      headerRow.height = 30;
      
      ws.views = [{ state: 'frozen', ySplit: 6 }];

      let rowIdx = 7;
      const today = new Date();
      today.setHours(0,0,0,0);

      const filteredSupplierIds = new Set(filteredSuppliers.map((s:any) => s.id));
      
      (expenses || []).forEach((exp:any) => {
          const expSupplierId = exp.supplier || exp.supplier_detail?.id;
          if (!filteredSupplierIds.has(expSupplierId)) return;
          if (currentSeason?.id && exp.season_id && exp.season_id !== currentSeason.id) return;
          if (currentSeason?.id && exp.seasonId && exp.seasonId !== currentSeason.id) return;
          
          const sup = (suppliers || []).find((s:any) => s.id === expSupplierId);

          const r = ws.getRow(rowIdx);

          let desig = '-';
          if (exp.expense_type && exp.expense_type_extention) desig = `${exp.expense_type} / ${exp.expense_type_extention}`;
          else if (exp.expense_type) desig = exp.expense_type;
          else if (exp.expense_type_extention) desig = exp.expense_type_extention;

          const ht = Number(exp.amount_ht || 0);
          const ttc = Number(exp.total_amount_ttc || exp.total_amount || 0);
          
          let tvaMap: Record<string, number> = {};
          if(exp.items && exp.items.length > 0) {
              exp.items.forEach((item: any) => {
                  const rate = Number(item.taxRate || exp.taxRate || 0);
                  const amt = ((item.quantity||1)*(item.price||0) * rate)/100;
                  tvaMap[String(rate)] = (tvaMap[String(rate)] || 0) + amt;
              });
          } else {
              const rate = Number(exp.taxRate || 0);
              const amountHT = Number(exp.amountHT || exp.totalAmount || 0) / (1 + rate/100);
              const tva = (amountHT * rate) / 100;
              tvaMap[String(rate)] = tva;
          }

          const getTva = (rate: number) => {
              const v = tvaMap[String(rate)];
              return v ? v : '';
          };

          const isOverdueOrUrgent = () => {
             if (!exp.invoice_due_date || exp.invoice_due_date === '-') return false;
             try {
                const due = new Date(exp.invoice_due_date);
                if (isNaN(due.getTime())) return false;
                const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 3600 * 24));
                return diffDays <= 7;
             } catch(e) { return false; }
          };

          const values = [
              exp.invoice_number || '-',
              exp.invoice_date || '-',
              exp.invoice_due_date || '-',
              desig,
              ht,
              getTva(20), getTva(18), getTva(12), getTva(15), getTva(14), getTva(7), getTva(10), getTva(0),
              ttc,
              sup?.name || sup?.supplier_name || '-',
              sup?.if || '-',
              sup?.ice || '-',
              exp.payment_method || '-',
              exp.payment_date || '-'
          ];

          r.values = values;
          
          const isRowPaleGreen = (rowIdx % 2 === 0);
          
          r.eachCell((c, colNumber) => {
             c.border = borderThin as any;
             if (isRowPaleGreen) {
                 c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } } as any;
             }
             
             if (colNumber === 3 && isOverdueOrUrgent()) {
                 c.font = { bold: true, color: { argb: 'FFFF0000' } };
             }

             if ((colNumber >= 5 && colNumber <= 14)) {
                 if (c.value !== '' && c.value !== '-') {
                     c.value = Number(c.value);
                     c.numFmt = '#,##0.00';
                 }
             }
          });

          rowIdx++;
      });
      
      ws.columns = [
          { width: 16 }, { width: 16 }, { width: 18 }, { width: 28 }, { width: 14 },
          { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
          { width: 18 }, { width: 24 }, { width: 16 }, { width: 22 }, { width: 18 }, { width: 18 }
      ];
      ws.getColumn(4).alignment = { wrapText: true, vertical: 'middle' };
      ws.getColumn(15).alignment = { wrapText: true, vertical: 'middle' };
      ws.getColumn(17).alignment = { wrapText: true, vertical: 'middle' };

      ws.autoFilter = `A6:S${Math.max(rowIdx-1, 6)}`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      let filename = `Suppliers Situation`;
      if (searchTerm) {
          filename += ` - ${searchTerm}`;
      }
      filename += `.xlsx`;
      
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: 'Success', description: 'Excel generated successfully!' });
    } catch(err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate Excel', variant: 'destructive' });
    }
  };

  if (!hasAccess && !pageLoading) {
    return <div className="p-8 text-center text-slate-500 font-bold">You do not have permission to view this module.</div>;
  }

  return (
    <div className={`p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 overflow-auto bg-white' : ''}`}>
      <ERPPageHeader
        title="Suppliers Situation"
        subtitle="Overview of financial balances, paid invoices, and outstanding credit note credits."
        breadcrumbItems={[
          { label: 'Profile' },
          { label: 'Suppliers Situation', active: true }
        ]}
        actions={
          <ERPExportButtons 
            excelData={excelExportData} 
            excelFileName={`Suppliers-Situation-${currentSeason?.name || 'All'}`}
            onExportExcel={handleExportExcelCustom}
          />
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1600px] mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
           <span className="text-sm text-slate-400 font-semibold mb-3">Total Amount</span>
           <span className="text-xl font-black text-slate-800">{formatAmount(totals.total)}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
           <span className="text-sm text-slate-400 font-semibold mb-3">Paid Amount</span>
           <span className="text-xl font-black text-slate-800">{formatAmount(totals.paid)}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
           <span className="text-sm text-slate-400 font-semibold mb-3">Open amount</span>
           <span className="text-xl font-black text-slate-800">{formatAmount(totals.open)}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
           <span className="text-sm text-slate-400 font-semibold mb-3">Total Credit Notes</span>
           <span className="text-xl font-black text-slate-800">{formatAmount(totals.creditNotes)}</span>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <ERPToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          density={density}
          onDensityChange={setDensity}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(prev => !prev)}
        />

        {pageLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-[#7a9800] animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Balances...</p>
          </div>
        ) : (
          <ERPTable
            columns={columns}
            data={filteredSuppliers}
            density={density}
            getRowId={(row) => row.id}
            pageSize={10}
            emptyMessage="No records to display"
          />
        )}
      </div>
    </div>
  );
}
