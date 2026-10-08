'use client';

import React, { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  doc, 
  getDocs,
  deleteDoc,
  updateDoc
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
  useDoc
} from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPStatisticCard } from '@/components/erp/ERPStatisticCard';
import { ERPTable } from '@/components/erp/ERPTable';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Plus, 
  ArrowLeft, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  FileText, 
  User, 
  Euro, 
  Scale 
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function InvoicePaymentPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.invoiceId as string;
  const db = useFirestore();
  const { toast } = useToast();

  const invoiceDocRef = useMemoFirebase(() => {
    if (!db || !invoiceId) return null;
    return doc(db, 'invoices', invoiceId);
  }, [db, invoiceId]);
  
  const loadingDocRef = useMemoFirebase(() => {
    if (!db || !invoiceId) return null;
    return doc(db, 'supply_chain_loadings', invoiceId);
  }, [db, invoiceId]);

  const { data: invoiceData, isLoading: loadingInvoice1 } = useDoc(invoiceDocRef);
  const { data: loadingData, isLoading: loadingInvoice2 } = useDoc(loadingDocRef);

  const invoice = invoiceData || loadingData;
  const loadingInvoice = loadingInvoice1 || loadingInvoice2;
  const collectionName = invoiceData ? 'invoices' : 'supply_chain_loadings';

  // 2. Fetch payments for this invoice
  const paymentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'suppliers_situation_payments'));
  }, [db]);
  const { data: allPayments, isLoading: loadingPayments } = useCollection(paymentsQuery);

  const invoicePayments = useMemo(() => {
    if (!allPayments || !invoiceId) return [];
    return allPayments.filter(p => p.invoiceId === invoiceId);
  }, [allPayments, invoiceId]);

  const computedRemainingBalance = useMemo(() => {
    if (!invoice) return 0;
    const total = Number(invoice.totalAmount || invoice.total_amount || 0);
    const paid = invoicePayments.reduce((sum, p: any) => sum + Number(p.amount || 0), 0);
    return Math.max(0, total - paid);
  }, [invoice, invoicePayments]);

  // 3. Delete Payment action with Invoice Sync
  const handleDeletePayment = async (paymentId: string, paymentAmt: number) => {
    if (!db || !invoice) return;
    if (confirm(`Are you sure you want to delete this payment of ${paymentAmt} €?`)) {
      try {
        // Delete payment doc
        await deleteDoc(doc(db, 'suppliers_situation_payments', paymentId));

        // Get fresh payments list to calculate correct remaining
        const paymentsRef = collection(db, 'suppliers_situation_payments');
        const snap = await getDocs(paymentsRef);
        const remainingPayments = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter(p => p.invoiceId === invoiceId);

        const newPaidAmount = remainingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const newOpenAmount = Math.max(0, Number(invoice.totalAmount || 0) - newPaidAmount);
        
        let newStatus = 'unpaid';
        if (newPaidAmount === 0) {
          newStatus = 'unpaid';
        } else if (newPaidAmount >= Number(invoice.totalAmount || 0)) {
          newStatus = 'paid';
        } else {
          newStatus = 'partially_paid';
        }

        // Adjust if overdue
        const dueDate = new Date(invoice.dueDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        if (newStatus !== 'paid' && dueDate < today) {
          newStatus = 'overdue';
        }

        // Update Invoice status
        await updateDoc(doc(db, collectionName, invoiceId), {
          paidAmount: newPaidAmount,
          openAmount: newOpenAmount,
          status: newStatus
        });

        toast({
          title: 'Payment Deleted',
          description: 'The payment transaction was removed and invoice totals updated.'
        });
      } catch (err) {
        console.error('Delete payment failed:', err);
        toast({
          title: 'Error',
          description: 'Failed to delete payment.',
          variant: 'destructive'
        });
      }
    }
  };

  const columns = useMemo(() => [
    {
      header: 'Actions',
      accessorKey: 'actions',
      render: (row: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-[#2e1d52] hover:bg-slate-100 rounded-lg transition-transform active:scale-90"
            >
              <MoreVertical size={16} className="stroke-[2.5]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40 rounded-xl shadow-lg border-slate-100 bg-white p-1.5 space-y-0.5">
            <DropdownMenuItem 
              onClick={() => router.push(`/finance/invoices/payment/${invoiceId}/edit/${row.id}`)}
              className="font-bold text-slate-600 text-xs cursor-pointer hover:bg-slate-50 hover:text-[#2e1d52] rounded-lg h-9"
            >
              <Edit2 size={14} className="mr-2 stroke-[2.5]" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleDeletePayment(row.id, row.amount)}
              className="font-bold text-rose-500 text-xs cursor-pointer hover:bg-rose-50 hover:text-rose-600 rounded-lg h-9"
            >
              <Trash2 size={14} className="mr-2 stroke-[2.5]" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
    {
      header: 'Operation Type',
      accessorKey: 'operationType',
      render: (row: any) => (
        <span className="bg-[#7a9800]/10 text-[#7a9800] text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
          {row.operationType}
        </span>
      )
    },
    {
      header: 'Payment Date',
      accessorKey: 'date'
    },
    {
      header: 'Payment Amount (€)',
      accessorKey: 'amount',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-bold text-slate-700">
          {row.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </span>
      )
    },
    {
      header: 'Exchange Rate',
      accessorKey: 'exchangeRate',
      align: 'right' as const,
      render: (row: any) => <span className="font-bold text-slate-400">{row.exchangeRate}</span>
    },
    {
      header: 'Amount (MAD)',
      accessorKey: 'amountMAD',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-bold text-emerald-600">
          {row.amountMAD?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
        </span>
      )
    },
    {
      header: 'Created By',
      accessorKey: 'createdBy'
    },
    {
      header: 'Payment Note',
      accessorKey: 'note',
      render: (row: any) => <span className="font-medium text-slate-500 italic">{row.note || '—'}</span>
    }
  ], [invoice, db]);

  const breadcrumbItems = [
    { label: 'Finance', href: '/finance/suppliers-situation' },
    { label: 'Invoice', href: '/finance/invoices' },
    { label: 'Invoice Payment', active: true }
  ];

  const isLoading = loadingInvoice || loadingPayments;

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      {/* Top Header */}
      <ERPPageHeader
        title="Invoice Payment"
        subtitle={`Track payments history and register transactions for invoice #${invoice?.invoiceNumber || invoice?.invoice_number || '...'}.`}
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex items-center gap-3">
            <Button
              onClick={() => router.push('/finance/invoices')}
              variant="outline"
              className="h-12 border-slate-200 text-slate-600 bg-white font-bold gap-2 uppercase text-[10px] tracking-widest px-4 rounded-xl shadow-sm hover:bg-slate-50 transition-all"
            >
              <ArrowLeft size={14} className="stroke-[3]" /> Back
            </Button>
            <Button
              onClick={() => router.push(`/finance/invoices/payment/${invoiceId}/add`)}
              disabled={isLoading || !invoice}
              className="bg-[#7a9800] hover:bg-[#637c00] text-white font-black uppercase tracking-widest text-[10px] h-12 px-6 rounded-xl shadow-lg shadow-[#7a9800]/10 transition-transform active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              <Plus size={14} className="stroke-[3]" /> Add Invoice Payment
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="h-12 w-12 text-[#7a9800] animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Payment Profile...</p>
        </div>
      ) : !invoice ? (
        <div className="text-center py-20 text-rose-500 font-bold uppercase text-xs">Invoice not found.</div>
      ) : (
        <>
          {/* Summary KPI Cards with circular icons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1600px] mx-auto">
            <ERPStatisticCard
              title="Invoice Number"
              value={invoice.invoiceNumber || invoice.invoice_number || '-'}
              icon={<FileText className="text-[#2e1d52]" size={18} />}
              description="Target invoice identifier"
            />
            <ERPStatisticCard
              title="Customer Name"
              value={invoice.customerName || invoice.customer_detail?.companyName || invoice.customer_detail?.company_name || invoice.customer || invoice.supplierName || invoice.customer_name || '—'}
              icon={<User className="text-[#2e1d52]" size={18} />}
              description="Beneficiary account identity"
            />
            <ERPStatisticCard
              title="Total Amount"
              value={`${(invoice.totalAmount || invoice.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
              icon={<Euro className="text-[#7a9800]" size={18} />}
              description="Standard gross billing payable"
            />
            <ERPStatisticCard
              title="Remaining Balance"
              value={`${computedRemainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`}
              icon={<Scale className="text-amber-500" size={18} />}
              description="Outstanding open net amount"
            />
          </div>

          {/* Payment List Grid */}
          <div className="max-w-[1600px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="text-xs font-black uppercase tracking-widest text-[#2e1d52]">Registered Payments List</h3>
            </div>
            
            <ERPTable
              columns={columns}
              data={invoicePayments}
              pageSize={10}
            />
          </div>
        </>
      )}
    </div>
  );
}
