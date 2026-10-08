'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, query, doc } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { useAuthContext } from '@/components/auth-provider';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPStatisticCard } from '@/components/erp/ERPStatisticCard';
import { ERPTable } from '@/components/erp/ERPTable';
import { ERPToolbar } from '@/components/erp/ERPToolbar';
import { ERPExportButtons } from '@/components/erp/ERPExportButtons';
import { Loader2, TrendingUp, CreditCard, AlertCircle, FileText } from 'lucide-react';
import { useSeason } from '@/contexts/SeasonContext';
import { canList } from '@/lib/permissions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const formatAmount = (value: any) => {
  return Number(value || 0).toFixed(2);
};

export default function FinanceSupplierSituationDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const supplierId = params?.supplierId as string;
  const db = useFirestore();
  const { profile } = useAuthContext();
  const { currentSeason } = useSeason();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const hasAccess = canList(profile, 'finance.suppliersSituation');

  // Fetch Supplier
  const supplierDocRef = useMemoFirebase(() => {
    if (!db || !supplierId) return null;
    return doc(db, 'finance_suppliers', supplierId);
  }, [db, supplierId]);
  const { data: supplier, isLoading: loadingSupplier } = useDoc(supplierDocRef);

  // Fetch Expenses
  const expensesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'expenses'));
  }, [db]);
  const { data: allExpenses, isLoading: loadingExpenses } = useCollection(expensesQuery);

  const { invoices, payments, creditNotes, overview } = useMemo(() => {
    if (!allExpenses || !supplierId) {
      return { invoices: [], payments: [], creditNotes: [], overview: { total: 0, paid: 0, open: 0, creditNotes: 0 } };
    }

    const sInvoices: any[] = [];
    const sPayments: any[] = [];
    const sCreditNotes: any[] = [];

    let totalAmount = 0;
    let paidAmount = 0;
    let creditNoteAmount = 0;

    allExpenses.forEach(exp => {
      const expSupplierId = exp.supplier || exp.supplier_detail?.id;
      if (expSupplierId !== supplierId) return;

      if (currentSeason?.id && exp.season_id && exp.season_id !== currentSeason.id) return;
      if (currentSeason?.id && exp.seasonId && exp.seasonId !== currentSeason.id) return;

      // Apply Date Filter
      if (filterStartDate || filterEndDate) {
        const expDateStr = exp.invoice_date || exp.payment_date || exp.date;
        if (expDateStr) {
          const expDate = new Date(expDateStr).getTime();
          if (filterStartDate && expDate < new Date(filterStartDate).getTime()) return;
          if (filterEndDate && expDate > new Date(filterEndDate).getTime()) return;
        }
      }

      const amount = Number(exp.total_amount_ttc || exp.total_amount || 0);

      if (String(exp.type) === '2') {
        sCreditNotes.push(exp);
        creditNoteAmount += amount;
      } else {
        sInvoices.push(exp);
        totalAmount += amount;
        
        const isPaid = (exp.payment_status || 'UNPAID').toLowerCase() === 'paid';
        if (isPaid) {
          sPayments.push(exp);
          paidAmount += amount;
        }
      }
    });

    return {
      invoices: sInvoices,
      payments: sPayments,
      creditNotes: sCreditNotes,
      overview: {
        total: totalAmount,
        paid: paidAmount,
        open: totalAmount - paidAmount - creditNoteAmount,
        creditNotes: creditNoteAmount
      }
    };
  }, [allExpenses, supplierId, currentSeason, filterStartDate, filterEndDate]);

  const handleFilter = () => {
    setFilterStartDate(startDate);
    setFilterEndDate(endDate);
  };

  const invoiceColumns = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);

    return [
      {
        header: 'Invoice Number',
        accessorKey: 'invoice_number',
        render: (row: any) => (
          <span 
            onClick={() => router.push(`/finance/expenses/${row.id}`)}
            className="font-bold text-[#2e1d52] hover:text-[#7a9800] transition-colors cursor-pointer underline"
          >
            {row.invoice_number || '-'}
          </span>
        )
      },
      { header: 'Invoice Date', accessorKey: 'invoice_date', render: (row: any) => row.invoice_date || '-' },
      { 
        header: 'Due Date', 
        accessorKey: 'invoice_due_date',
        render: (row: any) => {
          if (!row.invoice_due_date) return '-';
          try {
            const isPaid = (row.payment_status || 'UNPAID').toLowerCase() === 'paid';
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
        header: 'Amount HT', 
        accessorKey: 'amount_ht',
        align: 'right' as const,
        render: (row: any) => formatAmount(row.amount_ht) 
      },
      {
        header: 'TVA Rate',
        accessorKey: 'taxRate',
        align: 'right' as const,
        render: (row: any) => {
          if (!row.items || row.items.length === 0) return <span>{row.taxRate ? `${row.taxRate}%` : '*'}</span>;
          const rates = row.items.map((i: any) => i.taxRate || row.taxRate || 0);
          const uniqueRates = Array.from(new Set(rates)).sort((a: any, b: any) => a - b);
          return <span>{uniqueRates.length > 0 ? uniqueRates.join(' | ') : '*'}</span>;
        }
      },
      {
        header: 'TVA Amount',
        accessorKey: 'tvaAmount',
        align: 'right' as const,
        render: (row: any) => {
          if (!row.items || row.items.length === 0) {
            const amountHT = Number(row.amountHT || row.totalAmount || 0) / (1 + (row.taxRate || 0)/100);
            const tva = (amountHT * (row.taxRate || 0)) / 100;
            return <span>{tva > 0 ? tva.toFixed(2) : '*'}</span>;
          }
          const amounts = row.items.map((item: any) => {
            const amountHT = (item.quantity || 1) * (item.price || 0);
            return (amountHT * (item.taxRate || row.taxRate || 0)) / 100;
          });
          const uniqueAmounts = Array.from(new Set(amounts)).sort((a: any, b: any) => a - b);
          return <span>{uniqueAmounts.length > 0 ? uniqueAmounts.map((v: any) => Number(v).toFixed(2)).join(' | ') : '*'}</span>;
        }
      },
      { 
        header: 'Total Amount TTC', 
        accessorKey: 'total_amount_ttc',
        align: 'right' as const,
        render: (row: any) => <span className="font-black text-[#2e1d52]">{formatAmount(row.total_amount_ttc || row.total_amount)}</span>
      }
    ];
  }, [router]);

  const paymentColumns = useMemo(() => [
    { header: 'Payment Date', accessorKey: 'payment_date', render: (row: any) => row.payment_date || '-' },
    { header: 'Payment Method', accessorKey: 'payment_method', render: (row: any) => row.payment_method || '-' },
    { 
      header: 'Amount Of Invoice', 
      accessorKey: 'total_amount_ttc',
      align: 'right' as const,
      render: (row: any) => <span className="font-black text-slate-800">{formatAmount(row.total_amount_ttc || row.total_amount)}</span>
    },
    { header: 'Payment Note', accessorKey: 'payment_note', render: (row: any) => row.payment_note || '-' },
  ], []);

  const excelExportData = useMemo(() => {
    return invoices.map(i => ({
      'Invoice Number': i.invoice_number,
      'Invoice Date': i.invoice_date,
      'Due Date': i.invoice_due_date,
      'Amount HT': formatAmount(i.amount_ht),
      'Total Amount TTC': formatAmount(i.total_amount_ttc || i.total_amount)
    }));
  }, [invoices]);

  useEffect(() => {
    if (!hasAccess && typeof window !== 'undefined') {
      router.push('/unauthorized');
    }
  }, [hasAccess, router]);

  if (!hasAccess) {
    return null;
  }

  const getExportData = () => {
      const sumInvoices = invoices.reduce((sum, inv) => sum + Number(inv.total_amount_ttc || inv.total_amount || 0), 0);
      const sumCreditNotes = creditNotes.reduce((sum, cn) => sum + Number(cn.total_amount_ttc || cn.total_amount || 0), 0);
      const sumPayments = payments.reduce((sum, p) => sum + Number(p.total_amount_ttc || p.total_amount || 0), 0);
      const finalSituation = sumInvoices - sumCreditNotes - sumPayments;

      const formatDateStr = (d: Date) => {
          const pad = (n: number) => n < 10 ? '0'+n : n;
          return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      };
      const todayDateStr = formatDateStr(new Date());

      const firstInvoiceDate = invoices?.length
        ? invoices
            .map(inv => inv.invoice_date)
            .filter(Boolean)
            .sort()[0]
        : null;

      const filterStart = startDate || filterStartDate;
      const filterEnd = endDate || filterEndDate;

      const exportFromDate = filterStart || firstInvoiceDate || "-";
      const exportToDate = filterEnd || todayDateStr;

      let maxTvaInvoices = 1;
      invoices.forEach(inv => {
          if (inv.items && inv.items.length > 0) {
              const rates = Array.from(new Set(inv.items.map((i:any) => i.taxRate || inv.taxRate || 0)));
              if (rates.length > maxTvaInvoices) maxTvaInvoices = rates.length;
          }
      });
      let invCols = 5 + (maxTvaInvoices * 2) + 1;
      const invHeaders = ['Numero de Facture', 'Date de facture', 'Designation', "date d'echeance", 'Montant HT'];
      for(let i=0; i<maxTvaInvoices; i++) {
          invHeaders.push('TVA %', 'Montant TVA');
      }
      invHeaders.push('Montant TTC');

      const invRows = invoices.length === 0 ? [Array(invCols).fill('-')] : invoices.map(inv => {
         const ht = Number(inv.amount_ht || 0);
         const ttc = Number(inv.total_amount_ttc || inv.total_amount || 0);
         let desig = '-';
         if (inv.expense_type && inv.expense_type_extention) desig = `${inv.expense_type} / ${inv.expense_type_extention}`;
         else if (inv.expense_type) desig = inv.expense_type;
         else if (inv.expense_type_extention) desig = inv.expense_type_extention;

         let rowVals: any[] = [inv.invoice_number || '-', inv.invoice_date || '-', desig, inv.invoice_due_date || '-', ht];
         
         let tvaPairs: {rate: any, amt: any}[] = [];
         if(inv.items && inv.items.length > 0) {
             const tvaMap = new Map();
             inv.items.forEach((item: any) => {
                 const rate = Number(item.taxRate || inv.taxRate || 0);
                 const amt = ((item.quantity||1)*(item.price||0) * rate)/100;
                 if(tvaMap.has(rate)) tvaMap.set(rate, tvaMap.get(rate) + amt);
                 else tvaMap.set(rate, amt);
             });
             Array.from(tvaMap.keys()).sort((a:any,b:any)=>a-b).forEach(k => tvaPairs.push({rate: k, amt: tvaMap.get(k)}));
         } else {
             const rate = Number(inv.taxRate || 0);
             const amountHT = Number(inv.amountHT || inv.totalAmount || 0) / (1 + rate/100);
             const tva = (amountHT * rate) / 100;
             tvaPairs.push({rate: rate, amt: tva});
         }
         
         for(let i=0; i<maxTvaInvoices; i++) {
             if (i < tvaPairs.length) {
                 rowVals.push(tvaPairs[i].rate, tvaPairs[i].amt);
             } else {
                 rowVals.push('-', '-');
             }
         }
         rowVals.push(ttc);
         return rowVals;
      });

      let maxTvaCreditNotes = 1;
      creditNotes.forEach(cn => {
          if (cn.items && cn.items.length > 0) {
              const rates = Array.from(new Set(cn.items.map((i:any) => i.taxRate || cn.taxRate || 0)));
              if (rates.length > maxTvaCreditNotes) maxTvaCreditNotes = rates.length;
          }
      });
      let cnCols = 4 + (maxTvaCreditNotes * 2) + 1;
      const cnHeaders = ["Numero d'avoir", "Date d'avoir", 'Designation', 'Montant HT'];
      for(let i=0; i<maxTvaCreditNotes; i++) {
          cnHeaders.push('TVA %', 'Montant TVA');
      }
      cnHeaders.push('Montant TTC');

      const cnRows = creditNotes.length === 0 ? [Array(cnCols).fill('-')] : creditNotes.map(cn => {
         const ht = Number(cn.amount_ht || 0);
         const ttc = Number(cn.total_amount_ttc || cn.total_amount || 0);
         let desig = '-';
         if (cn.expense_type && cn.expense_type_extention) desig = `${cn.expense_type} / ${cn.expense_type_extention}`;
         else if (cn.expense_type) desig = cn.expense_type;
         else if (cn.expense_type_extention) desig = cn.expense_type_extention;

         let rowVals: any[] = [cn.invoice_number || '-', cn.invoice_date || '-', desig, ht];
         
         let tvaPairs: {rate: any, amt: any}[] = [];
         if(cn.items && cn.items.length > 0) {
             const tvaMap = new Map();
             cn.items.forEach((item: any) => {
                 const rate = Number(item.taxRate || cn.taxRate || 0);
                 const amt = ((item.quantity||1)*(item.price||0) * rate)/100;
                 if(tvaMap.has(rate)) tvaMap.set(rate, tvaMap.get(rate) + amt);
                 else tvaMap.set(rate, amt);
             });
             Array.from(tvaMap.keys()).sort((a:any,b:any)=>a-b).forEach(k => tvaPairs.push({rate: k, amt: tvaMap.get(k)}));
         } else {
             const rate = Number(cn.taxRate || 0);
             const amountHT = Number(cn.amountHT || cn.totalAmount || 0) / (1 + rate/100);
             const tva = (amountHT * rate) / 100;
             tvaPairs.push({rate: rate, amt: tva});
         }
         
         for(let i=0; i<maxTvaCreditNotes; i++) {
             if (i < tvaPairs.length) {
                 rowVals.push(tvaPairs[i].rate, tvaPairs[i].amt);
             } else {
                 rowVals.push('-', '-');
             }
         }
         rowVals.push(ttc);
         return rowVals;
      });

      const payHeaders = ["Date de paiement", "Methode de paiement", 'Montant', 'Remarque'];
      const payRows = payments.length === 0 ? [['-', '-', '-', '-']] : payments.map(pay => [
          pay.payment_date || '-', pay.payment_method || '-', Number(pay.total_amount_ttc || pay.total_amount || 0), pay.payment_note || '-'
      ]);

      return {
          sumInvoices, sumCreditNotes, sumPayments, finalSituation,
          maxTvaInvoices, invCols, invHeaders, invRows,
          maxTvaCreditNotes, cnCols, cnHeaders, cnRows,
          payHeaders, payRows,
          exportFromDate, exportToDate
      };
  };

  const handleExportPDFCustom = async () => {
    try {
      toast({ title: 'Exporting PDF...', description: 'Please wait while we generate your file.' });
      
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      
      const data = getExportData();
      
      const maxCols = Math.max(data.invCols, data.cnCols, 4);
      const orientation = maxCols > 8 ? 'landscape' : 'portrait';
      
      const doc = new jsPDF({ orientation, format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      try {
        const res = await fetch('/FFI_main.png');
        if (res.ok) {
            const blob = await res.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            doc.addImage(base64, 'PNG', 14, 10, 30, 15);
        }
      } catch(e) {}

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Situation Fournisseur", pageWidth / 2, 18, { align: 'center' });
      doc.text((supplier?.name || supplier?.supplier_name || '-').toUpperCase(), pageWidth / 2, 25, { align: 'center' });

      let startY = 35;
      const greenFill = [226, 240, 217];
      const expenseTypeStr = (supplier?.expense_type || supplier?.expenseType || 'Total des Factures').toUpperCase();

      autoTable(doc, {
          startY,
          body: [
              ['Du', data.exportFromDate, 'Au', data.exportToDate],
              ['Nom de fournisseur', { content: (supplier?.name || supplier?.supplier_name || '-').toUpperCase(), colSpan: 3 }],
              ['IF', supplier?.if || '-', 'ICE', supplier?.ice || '-']
          ],
          theme: 'grid',
          styles: { fontStyle: 'bold', lineWidth: 0.1, lineColor: [0,0,0], textColor: [0,0,0], halign: 'left' }
      });
      startY = (doc as any).lastAutoTable.finalY + 10;

      const formatRow = (row: any[]) => row.map((c) => {
          if (c !== '-' && typeof c === 'number') return c.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          return c;
      });

      // Invoices
      autoTable(doc, {
          startY,
          head: [
              [{ content: `${expenseTypeStr}: ${data.sumInvoices.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}MAD`, colSpan: data.invCols, styles: { fillColor: greenFill as any, textColor: [0,0,0], halign: 'center', fontStyle: 'bold' } }],
              data.invHeaders
          ],
          body: data.invRows.map(formatRow),
          theme: 'grid',
          headStyles: { fillColor: [255, 255, 255], textColor: [0,0,0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0,0,0], halign: 'center' },
          styles: { textColor: [0,0,0], lineWidth: 0.1, lineColor: [0,0,0] }
      });
      startY = (doc as any).lastAutoTable.finalY + 10;

      // Credit Notes
      autoTable(doc, {
          startY,
          head: [
              [{ content: `Total des avoirs: ${data.sumCreditNotes.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}MAD`, colSpan: data.cnCols, styles: { fillColor: greenFill as any, textColor: [0,0,0], halign: 'center', fontStyle: 'bold' } }],
              data.cnHeaders
          ],
          body: data.cnRows.map(formatRow),
          theme: 'grid',
          headStyles: { fillColor: [255, 255, 255], textColor: [0,0,0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0,0,0], halign: 'center' },
          styles: { textColor: [0,0,0], lineWidth: 0.1, lineColor: [0,0,0] }
      });
      startY = (doc as any).lastAutoTable.finalY + 10;

      // Payments
      autoTable(doc, {
          startY,
          head: [
              [{ content: `Paiements: ${data.sumPayments.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}DH`, colSpan: 4, styles: { fillColor: greenFill as any, textColor: [0,0,0], halign: 'center', fontStyle: 'bold' } }],
              data.payHeaders
          ],
          body: data.payRows.map(formatRow),
          theme: 'grid',
          headStyles: { fillColor: [255, 255, 255], textColor: [0,0,0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0,0,0], halign: 'center' },
          styles: { textColor: [0,0,0], lineWidth: 0.1, lineColor: [0,0,0] }
      });
      startY = (doc as any).lastAutoTable.finalY + 10;

      // Situation
      autoTable(doc, {
          startY,
          head: [
              [{ content: `Situation: ${data.finalSituation.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}DH`, colSpan: Math.max(data.invCols, data.cnCols, 4), styles: { fillColor: greenFill as any, textColor: [0,0,0], halign: 'center', fontStyle: 'bold', fontSize: 18, minCellHeight: 20, valign: 'middle' } }]
          ],
          theme: 'grid',
          headStyles: { lineWidth: 0.1, lineColor: [0,0,0] }
      });

      let filename = `Supplier Situation`;
      const sName = supplier?.name || supplier?.supplier_name;
      if (sName && (filterStartDate || filterEndDate)) {
          filename += ` - ${sName} - ${filterStartDate||'All'} - ${filterEndDate||'All'}`;
      } else if (sName) {
          filename += ` - ${sName}`;
      }
      filename += `.pdf`;

      doc.save(filename);
      toast({ title: 'Success', description: 'PDF generated successfully!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  const handleExportExcelCustom = async () => {
    try {
      toast({ title: 'Exporting Excel...', description: 'Please wait while we generate your file.' });
      
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Situation');

      const greenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } };
      const borderThin = {
        top: { style: 'thin' as const }, left: { style: 'thin' as const },
        bottom: { style: 'thin' as const }, right: { style: 'thin' as const }
      };

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

      ws.mergeCells('E2:H2');
      const titleCell = ws.getCell('E2');
      titleCell.value = 'Situation Fournisseur';
      titleCell.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
      titleCell.alignment = { horizontal: 'center' };

      ws.mergeCells('E3:H3');
      const nameCell = ws.getCell('E3');
      nameCell.value = (supplier?.name || supplier?.supplier_name || '-').toUpperCase();
      nameCell.font = { bold: true, color: { argb: 'FF000000' } };
      nameCell.alignment = { horizontal: 'center' };

      ws.getCell('A5').value = 'DE';
      const data = getExportData();
      ws.getCell('B5').value = data.exportFromDate;
      ws.getCell('E5').value = 'AU';
      ws.getCell('F5').value = data.exportToDate;
      ['A5','B5','E5','F5'].forEach(c => {
         const cell = ws.getCell(c);
         cell.border = borderThin;
         cell.font = { bold: true };
         if (c === 'A5' || c === 'E5') cell.alignment = { horizontal: 'left' };
      });

      ws.getCell('A6').value = 'Nom de fournisseur';
      ws.getCell('E6').value = (supplier?.name || supplier?.supplier_name || '-').toUpperCase();
      ws.mergeCells('A6:D6');
      ws.mergeCells('E6:H6');
      ['A6','B6','C6','D6','E6','F6','G6','H6'].forEach(c => ws.getCell(c).border = borderThin);

      ws.getCell('A7').value = 'IF';
      ws.getCell('B7').value = supplier?.if || '-';
      ws.getCell('E7').value = 'ICE';
      ws.getCell('F7').value = supplier?.ice || '-';
      ws.mergeCells('B7:D7');
      ws.mergeCells('F7:H7');
      ['A7','B7','C7','D7','E7','F7','G7','H7'].forEach(c => ws.getCell(c).border = borderThin);

      let rowIdx = 9;

      const addSectionHeader = (title: string, cols: number) => {
         ws.mergeCells(rowIdx, 1, rowIdx, cols);
         const cell = ws.getCell(rowIdx, 1);
         cell.value = title;
         cell.fill = greenFill as any;
         cell.font = { bold: true, size: 14 };
         cell.alignment = { horizontal: 'center', vertical: 'middle' };
         for(let i=1; i<=cols; i++) ws.getCell(rowIdx, i).border = borderThin;
         rowIdx++;
      }

      const addTableHeaders = (headers: string[]) => {
         headers.forEach((h, i) => {
           const cell = ws.getCell(rowIdx, i+1);
           cell.value = h;
           cell.font = { bold: true };
           cell.border = borderThin;
           cell.alignment = { horizontal: 'center' };
         });
         rowIdx++;
      }
      
      const expenseTypeStr = (supplier?.expense_type || supplier?.expenseType || 'Total des Factures').toUpperCase();

      // Invoices
      rowIdx++; // Empty row
      addSectionHeader(`${expenseTypeStr}: ${data.sumInvoices.toFixed(2)}MAD`, data.invCols);
      addTableHeaders(data.invHeaders);
      
      data.invRows.forEach(rowVals => {
         const r = ws.getRow(rowIdx);
         r.values = rowVals;
         r.eachCell((c, colNumber) => {
            c.border = borderThin;
            if (colNumber === 5 || colNumber === rowVals.length || (colNumber > 5 && colNumber < rowVals.length && colNumber % 2 !== 0)) {
                if (c.value !== '-') { c.value = Number(c.value) || 0; c.numFmt = '#,##0.00'; }
            }
         });
         rowIdx++;
      });

      // Credit Notes
      rowIdx++; // Empty row
      addSectionHeader(`Total des avoirs: ${data.sumCreditNotes.toFixed(2)}MAD`, data.cnCols);
      addTableHeaders(data.cnHeaders);

      data.cnRows.forEach(rowVals => {
         const r = ws.getRow(rowIdx);
         r.values = rowVals;
         r.eachCell((c, colNumber) => {
            c.border = borderThin;
            if (colNumber === 4 || colNumber === rowVals.length || (colNumber > 4 && colNumber < rowVals.length && colNumber % 2 === 0)) {
                if (c.value !== '-') { c.value = Number(c.value) || 0; c.numFmt = '#,##0.00'; }
            }
         });
         rowIdx++;
      });

      // Payments
      rowIdx++; // Empty row
      addSectionHeader(`Paiements: ${data.sumPayments.toFixed(2)}DH`, 4);
      addTableHeaders(data.payHeaders);
      data.payRows.forEach(rowVals => {
          const r = ws.getRow(rowIdx);
          r.values = rowVals;
          if (r.getCell(3).value !== '-') {
              r.getCell(3).value = Number(r.getCell(3).value) || 0;
              r.getCell(3).numFmt = '#,##0.00';
          }
          r.eachCell(c => c.border = borderThin);
          rowIdx++;
      });

      // Situation
      rowIdx++; // Empty row
      addSectionHeader(`Situation: ${data.finalSituation.toFixed(2)}DH`, Math.max(data.invCols, data.cnCols, 4));

      const maxCols = Math.max(data.invCols, data.cnCols, 4);
      for(let i=1; i<=maxCols; i++) {
          let w = 14;
          if (i === 1) w = 18;
          else if (i === 2) w = 22;
          else if (i === 3) w = 28;
          else if (i === 4) w = 28;
          ws.getColumn(i).width = w;
      }
      ws.getColumn(3).alignment = { wrapText: true, vertical: 'middle' };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      let filename = `Supplier Situation`;
      const sName = supplier?.name || supplier?.supplier_name;
      if (sName && (filterStartDate || filterEndDate)) {
          filename += ` - ${sName} - ${filterStartDate||'All'} - ${filterEndDate||'All'}`;
      } else if (sName) {
          filename += ` - ${sName}`;
      }
      filename += `.xlsx`;
      
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: 'Success', description: 'Excel generated successfully!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate Excel', variant: 'destructive' });
    }
  };

  const pageLoading = loadingSupplier || loadingExpenses;

  return (
    <div className={`p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 overflow-auto bg-white' : ''}`}>
      <ERPPageHeader
        title="Suppliers Situation Details"
        subtitle="Detailed breakdown of invoices, payments, and credit notes."
        breadcrumbItems={[
          { label: 'Profile' },
          { label: 'Suppliers Situation', href: '/finance/suppliers-situation' },
          { label: 'Details', active: true }
        ]}
      />

      <div className="flex flex-col gap-6 max-w-[1600px] mx-auto">
        {/* Supplier Details Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 flex flex-col justify-center">
          <div className="space-y-6">
            <div className="flex items-center">
              <span className="text-[#2e1d52] font-black text-sm w-48">Supplier Name</span>
              <span className="text-slate-600 font-medium text-sm">{supplier?.name || supplier?.supplier_name || '-'}</span>
            </div>
            <div className="flex items-center">
              <span className="text-[#2e1d52] font-black text-sm w-48">IF</span>
              <span className="text-slate-600 font-medium text-sm">{supplier?.if || '-'}</span>
            </div>
            <div className="flex items-center">
              <span className="text-[#2e1d52] font-black text-sm w-48">ICE</span>
              <span className="text-slate-600 font-medium text-sm">{supplier?.ice || '-'}</span>
            </div>
            <div className="flex items-center">
              <span className="text-[#2e1d52] font-black text-sm w-48">Expense Type</span>
              <span className="text-slate-600 font-medium text-sm">{supplier?.expense_type || supplier?.expenseType || '-'}</span>
            </div>
          </div>
        </div>

        {/* Date Filter & Export */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col sm:flex-row justify-between items-center gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-400">Start Date:</label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="h-10 w-[150px] rounded-lg border-slate-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-400">End Date:</label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="h-10 w-[150px] rounded-lg border-slate-200"
              />
            </div>
            <Button 
              onClick={handleFilter}
              className="h-10 bg-[#7a9800] hover:bg-[#688200] text-white px-6 rounded-lg font-bold"
            >
              Filter
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleExportExcelCustom}
              className="h-10 w-10 p-0 bg-[#7a9800] hover:bg-[#688200] text-white rounded-lg flex items-center justify-center"
              title="Export Excel"
            >
               <span className="font-bold text-lg">x</span>
            </Button>
            <Button 
              onClick={handleExportPDFCustom}
              className="h-10 w-10 p-0 bg-[#7a9800] hover:bg-[#688200] text-white rounded-lg flex items-center justify-center"
              title="Export PDF"
            >
               <span className="font-bold text-xs">PDF</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1600px] mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
           <span className="text-sm text-slate-400 font-semibold mb-3">Total Amount</span>
           <span className="text-xl font-black text-slate-800">{formatAmount(overview.total)}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
           <span className="text-sm text-slate-400 font-semibold mb-3">Paid Amount</span>
           <span className="text-xl font-black text-slate-800">{formatAmount(overview.paid)}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
           <span className="text-sm text-slate-400 font-semibold mb-3">Open amount</span>
           <span className="text-xl font-black text-slate-800">{formatAmount(overview.open)}</span>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex flex-col justify-center">
           <span className="text-sm text-slate-400 font-semibold mb-3">Total Credit Notes</span>
           <span className="text-xl font-black text-slate-800">{formatAmount(overview.creditNotes)}</span>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <Tabs defaultValue="invoices" className="w-full">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <TabsList className="bg-slate-100 rounded-xl p-1">
              <TabsTrigger value="invoices" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-[#2e1d52] px-6">Invoices</TabsTrigger>
              <TabsTrigger value="payments" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-[#7a9800] px-6">Payments</TabsTrigger>
              <TabsTrigger value="credit-notes" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-blue-500 px-6">Credit Note</TabsTrigger>
            </TabsList>
            
            <ERPToolbar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              density={density}
              onDensityChange={setDensity}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(prev => !prev)}
            />
          </div>

          <TabsContent value="invoices" className="m-0 border-none p-0 outline-none">
            {pageLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#2e1d52]" /></div>
            ) : (
              <ERPTable
                columns={invoiceColumns}
                data={invoices.filter(i => (i.invoice_number||'').toLowerCase().includes(searchTerm.toLowerCase()))}
                density={density}
                getRowId={(row) => row.id}
                pageSize={10}
                emptyMessage="No invoices to display"
              />
            )}
          </TabsContent>

          <TabsContent value="payments" className="m-0 border-none p-0 outline-none">
            {pageLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#7a9800]" /></div>
            ) : (
              <ERPTable
                columns={paymentColumns}
                data={payments.filter(p => (p.payment_method||'').toLowerCase().includes(searchTerm.toLowerCase()))}
                density={density}
                getRowId={(row) => row.id}
                pageSize={10}
                emptyMessage="No payments to display"
              />
            )}
          </TabsContent>

          <TabsContent value="credit-notes" className="m-0 border-none p-0 outline-none">
            {pageLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>
            ) : (
              <ERPTable
                columns={invoiceColumns}
                data={creditNotes.filter(c => (c.invoice_number||'').toLowerCase().includes(searchTerm.toLowerCase()))}
                density={density}
                getRowId={(row) => row.id}
                pageSize={10}
                emptyMessage="No credit notes to display"
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
