'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, query, doc, updateDoc } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { useSeason } from '@/contexts/SeasonContext';
import { useAuthContext } from '@/components/auth-provider';
import { canList, canUpdate } from '@/lib/permissions';
import Swal from 'sweetalert2';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPStatisticCard } from '@/components/erp/ERPStatisticCard';
import { ERPTabs } from '@/components/erp/ERPTabs';
import { ERPTable } from '@/components/erp/ERPTable';
import { ERPExportButtons } from '@/components/erp/ERPExportButtons';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, CreditCard, AlertCircle, LayoutDashboard, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { money, safeNumber, safeText } from '../utils';

export default function CustomerDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.customerId as string;
  const customerId = decodeURIComponent(rawId);
  const { profile } = useAuthContext();

  const hasListAccess = canList(profile, 'finance.customer-balances');
  const hasUpdateAccess = canUpdate(profile, 'finance.customer-balances');

  const db = useFirestore();
  const { currentSeason } = useSeason();

  // Firestore Queries
  const customerRef = useMemoFirebase(() => db && customerId ? doc(db, 'customers', customerId) : null, [db, customerId]);
  const invoicesQ = useMemoFirebase(() => db && customerId ? query(collection(db, 'invoices')) : null, [db, customerId]);
  const loadingsQ = useMemoFirebase(() => db && customerId ? query(collection(db, 'supply_chain_loadings')) : null, [db, customerId]);
  const packingListsQ = useMemoFirebase(() => db && customerId ? query(collection(db, 'packingLists')) : null, [db, customerId]);
  const paymentsQ = useMemoFirebase(() => db && customerId ? query(collection(db, 'payments')) : null, [db, customerId]);
  const ssPaymentsQ = useMemoFirebase(() => db && customerId ? query(collection(db, 'suppliers_situation_payments')) : null, [db, customerId]);
  const creditNotesQ = useMemoFirebase(() => db && customerId ? query(collection(db, 'credit_notes')) : null, [db, customerId]);

  const { data: customerDoc, isLoading: cLoad } = useDoc(customerRef);
  const { data: rawInvoices, isLoading: iLoad } = useCollection(invoicesQ);
  const { data: rawLoadings } = useCollection(loadingsQ);
  const { data: rawPackingLists } = useCollection(packingListsQ);
  const { data: allPayments, isLoading: pLoad } = useCollection(paymentsQ);
  const { data: allSSPayments, isLoading: sspLoad } = useCollection(ssPaymentsQ);
  const { data: allCreditNotes, isLoading: cnLoad } = useCollection(creditNotesQ);

  const isLoading = cLoad || iLoad || pLoad || cnLoad || sspLoad;

  const [customer, setCustomer] = useState<any>({});
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>({});

  const fetchData = useCallback(() => {
    if (isLoading) return;
    
    setCustomer(customerDoc || {});
    
    const seasonId = currentSeason?.id;
    
    const mergedInvoicesMap = new Map<string, any>();
    [...(rawInvoices || []), ...(rawLoadings || []), ...(rawPackingLists || [])].forEach(item => {
      if (item.id && !mergedInvoicesMap.has(item.id)) {
        mergedInvoicesMap.set(item.id, item);
      }
    });
    const combinedInvoices = Array.from(mergedInvoicesMap.values());

    const seasonInvoices = seasonId ? combinedInvoices.filter(i => i.season_id === seasonId || !i.season_id) : combinedInvoices;
    const seasonPayments = seasonId ? (allPayments || []).filter(p => p.season_id === seasonId || !p.season_id) : (allPayments || []);
    const seasonSSPayments = seasonId ? (allSSPayments || []).filter(p => p.season_id === seasonId || !p.season_id) : (allSSPayments || []);
    const seasonCreditNotes = seasonId ? (allCreditNotes || []).filter(c => c.season_id === seasonId || !c.season_id) : (allCreditNotes || []);

    const cName = String(customerDoc?.company_name || customerDoc?.companyName || customerDoc?.name || (customerDoc?.firstName ? `${customerDoc.firstName} ${customerDoc.lastName || ''}`.trim() : '')).trim();

    const cInvoices = seasonInvoices
      .filter(i => {
        if (i.customer_id === customerId || i.customer === customerId || (i.customer_detail && i.customer_detail.id === customerId)) return true;
        const invCustName = String(i.customer_detail?.companyName || i.customer_detail?.company_name || i.customerName || i.customer || '').trim();
        return cName && invCustName && invCustName.toLowerCase() === cName.toLowerCase();
      })
      .map(inv => {
        const invNum = String(inv.invoice_number || inv.invoiceNumber || '').trim();
        const invId = inv.id;
        
        const linkedSSPayments = seasonSSPayments.filter(p => 
          (p.invoiceId && (p.invoiceId === invId || p.invoiceId === inv.sourceId || p.invoiceId === inv.loadingId || p.invoiceId === inv.packingListId)) ||
          (invNum && invNum !== '-' && (String(p.invoiceNumber).trim() === invNum || String(p.invoice_number).trim() === invNum))
        );
        const linkedPayments = seasonPayments.filter(p => p.invoiceId === invId || (invNum && invNum !== '-' && String(p.invoiceNumber).trim() === invNum));

        const paid = linkedSSPayments.reduce((sum, p) => sum + safeNumber(p.amount), 0) + linkedPayments.reduce((sum, p) => sum + safeNumber(p.amount || p.payment_amount), 0);

        return {
          ...inv,
          paidAmount: paid,
          paid_amount: paid,
          paid: paid
        };
      });

    const cInvoiceIds = new Set<string>();
    const cInvoiceNumbers = new Set<string>();

    cInvoices.forEach(i => {
      if (i.id) cInvoiceIds.add(i.id);
      if (i.sourceId) cInvoiceIds.add(i.sourceId);
      if (i.loadingId) cInvoiceIds.add(i.loadingId);
      if (i.packingListId) cInvoiceIds.add(i.packingListId);
      const num = i.invoice_number || i.invoiceNumber;
      if (num && num !== '-') cInvoiceNumbers.add(String(num).trim());
    });

    const cPayments = seasonPayments.filter(p => {
      if (p.customer_id === customerId || p.customerId === customerId || p.customer === customerId) return true;
      if (p.invoiceId && cInvoiceIds.has(p.invoiceId)) return true;
      if (p.invoiceNumber && cInvoiceNumbers.has(String(p.invoiceNumber).trim())) return true;
      if (p.invoice_number && cInvoiceNumbers.has(String(p.invoice_number).trim())) return true;
      const pCustName = String(p.customerName || p.customer_name || p.customer || '').trim();
      return cName && pCustName && pCustName.toLowerCase() === cName.toLowerCase();
    });

    const cSSPayments = seasonSSPayments.filter(p => {
      if (p.customer_id === customerId || p.customerId === customerId || p.customer === customerId) return true;
      if (p.invoiceId && cInvoiceIds.has(p.invoiceId)) return true;
      if (p.invoiceNumber && cInvoiceNumbers.has(String(p.invoiceNumber).trim())) return true;
      if (p.invoice_number && cInvoiceNumbers.has(String(p.invoice_number).trim())) return true;
      const pCustName = String(p.customerName || p.customer_name || p.customer || '').trim();
      return cName && pCustName && pCustName.toLowerCase() === cName.toLowerCase();
    });

    const cCreditNotes = seasonCreditNotes.filter(cn => {
      if (cn.customer_id === customerId || cn.customer === customerId) return true;
      const cnCustName = String(cn.customer_detail?.companyName || cn.customer_detail?.company_name || cn.customerName || cn.customer || '').trim();
      return cName && cnCustName && cnCustName.toLowerCase() === cName.toLowerCase();
    });

    setInvoices(cInvoices);
    setPayments([...cPayments, ...cSSPayments]);

    const total_sale = cInvoices.reduce((sum, inv) => sum + safeNumber(inv.total_amount || inv.invoice_amount), 0);
    const credit_note_amount = cCreditNotes.reduce((sum, cn) => sum + safeNumber(cn.amount || cn.total_amount), 0);
    const paid_amount = cPayments.reduce((sum, p) => sum + safeNumber(p.amount || p.payment_amount), 0) + cSSPayments.reduce((sum, p) => sum + safeNumber(p.amount || p.payment_amount), 0);
    const open_amount = total_sale - credit_note_amount - paid_amount;

    setOverview({
      total_sale,
      credit_note: credit_note_amount,
      total_paid: paid_amount,
      credit_balance: open_amount
    });
  }, [isLoading, customerDoc, rawInvoices, rawLoadings, rawPackingLists, allPayments, allSSPayments, allCreditNotes, currentSeason, customerId]);

  useEffect(() => {
    if (hasListAccess) {
      fetchData();
    }
  }, [hasListAccess, fetchData]);

  const [activeTab, setActiveTab] = useState('invoices');

  const handleStatusChange = async (invoiceId: string, newStatusId: number) => {
    const result = await Swal.fire({
      title: 'Do you want change Status?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'CONFIRM',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#d33'
    });

    if (result.isConfirmed) {
      try {
        if (!db) return;
        const docRef = doc(db, 'invoices', invoiceId);
        await updateDoc(docRef, { invoice_status: newStatusId });
        Swal.fire('Success', 'Invoice Status has been changed Successfully.', 'success');
      } catch (err) {
        console.error('Failed to change status', err);
        Swal.fire('Error', 'Failed to change status', 'error');
      }
    }
  };

  const excelExportData = useMemo(() => {
    if (activeTab === 'invoices') {
      return invoices.map(s => ({
        'Invoice Number': s.invoice_number || s.invoiceNumber,
        'Date': s.date,
        'Customer': customer?.company_name || customer?.companyName || customerId,
        'Total Sales': safeNumber(s.total_amount),
        'Total Paid': safeNumber(s.paidAmount || s.paid_amount || s.paid),
        'Credit Note': safeNumber(s.total_credit_note || s.totalCreditNote),
        'Credit Balance': safeNumber(s.total_amount || s.totalAmount) - safeNumber(s.paidAmount || s.paid_amount || s.paid) - safeNumber(s.total_credit_note || s.totalCreditNote)
      }));
    } else {
      return payments.map(p => ({
        'Operation Type': p.opearation_type || p.operationType || p.operation_type,
        'Payment Date': p.payment_date || p.date,
        'Payment Amount': safeNumber(p.payment_amount || (p.amountMAD ? p.amount : undefined) || p.amount),
        'Exchange Date': p.exchange_date || p.exchangeDate,
        'Exchange Rate': safeNumber(p.exchange_rate || p.exchangeRate),
        'Amount': safeNumber(p.amountMAD || p.amount_mad || p.amount)
      }));
    }
  }, [activeTab, invoices, payments, customerId, customer]);

  const salesColumns = [
    {
      header: 'Invoice Number',
      accessorKey: 'invoice_number',
      render: (row: any) => (
        <span 
          onClick={() => router.push(`/finance/invoices/payment/${row.id}`)}
          className="font-bold text-[#2e1d52] hover:text-[#7a9800] transition-colors cursor-pointer underline"
        >
          {safeText(row.invoice_number || row.invoiceNumber)}
        </span>
      )
    },
    { 
      header: 'Invoice Status', 
      accessorKey: 'status',
      render: (row: any) => {
        const rawStatus = row.invoice_status ?? row.status ?? row.status_id ?? row.invoicing_status?.id;
        let statId = 0;
        if (rawStatus === 1 || String(rawStatus).toLowerCase() === 'paid') statId = 1;
        else if (rawStatus === 2 || String(rawStatus).toLowerCase() === 'open' || String(rawStatus).toLowerCase() === 'partially_paid') statId = 2;
        
        let title = 'DUE';
        let bgColor = 'bg-red-500';
        if (statId === 1) { title = 'PAID'; bgColor = 'bg-emerald-500'; }
        else if (statId === 2) { title = 'OPEN'; bgColor = 'bg-blue-500'; }

        if (!hasUpdateAccess) {
          return <span className={`text-[10px] font-black px-2 py-1 rounded-md text-white uppercase ${bgColor}`}>{title}</span>;
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className={`h-6 text-[10px] font-black px-2 py-0 rounded-md text-white uppercase ${bgColor} hover:${bgColor}/90`}>
                {title} <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32 rounded-xl shadow-lg border-slate-100 bg-white">
              <DropdownMenuItem onClick={() => handleStatusChange(row.id, 1)} className="font-black text-emerald-600 text-[10px] cursor-pointer">PAID</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange(row.id, 2)} className="font-black text-blue-600 text-[10px] cursor-pointer">OPEN</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange(row.id, 0)} className="font-black text-red-600 text-[10px] cursor-pointer">DUE</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      }
    },
    { header: 'PO Order Number', accessorKey: 'po_order_number', render: (row: any) => safeText(row.po_order_number) },
    { header: 'Date', accessorKey: 'date', render: (row: any) => safeText(row.date) },
    { header: 'Customer', accessorKey: 'customerName', render: (row: any) => safeText(row.customer_detail?.company_name || row.customerName || customer?.company_name || customer?.companyName || customerId) },
    { 
      header: 'Total Sales', 
      accessorKey: 'total_amount',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-black text-[#2e1d52]">{money(row.total_amount || row.totalAmount, row.currency?.symbol || '')}</span>
      )
    },
    { 
      header: 'Total Paid', 
      accessorKey: 'paid',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-bold text-[#7a9800]">{money(row.paidAmount || row.paid_amount || row.paid, row.currency?.symbol || '')}</span>
      )
    },
    { 
      header: 'Credit Balance', 
      accessorKey: 'creditBalance',
      align: 'right' as const,
      render: (row: any) => {
        const bal = safeNumber(row.total_amount || row.totalAmount) - safeNumber(row.paidAmount || row.paid_amount || row.paid) - safeNumber(row.total_credit_note || row.totalCreditNote);
        return <span className="font-bold text-amber-500">{money(bal, row.currency?.symbol || '')}</span>;
      }
    },
    { 
      header: 'Credit Note', 
      accessorKey: 'total_credit_note',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-bold text-slate-500">{money(row.total_credit_note || row.totalCreditNote, row.currency?.symbol || '')}</span>
      )
    }
  ];

  const paymentColumns = [
    { header: 'Operation Type', accessorKey: 'opearation_type', render: (row: any) => safeText(row.opearation_type || row.operationType || row.operation_type) },
    { header: 'Payment Date', accessorKey: 'payment_date', render: (row: any) => safeText(row.payment_date || row.date) },
    { 
      header: 'Payment Amount', 
      accessorKey: 'payment_amount',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-bold text-[#7a9800]">{money(row.payment_amount || (row.amountMAD ? row.amount : undefined) || row.amount, row.currency?.symbol || '')}</span>
      )
    },
    { header: 'Exchange Date', accessorKey: 'exchange_date', render: (row: any) => safeText(row.exchange_date || row.exchangeDate) },
    { 
      header: 'Exchange Rate', 
      accessorKey: 'exchange_rate',
      align: 'right' as const,
      render: (row: any) => money(row.exchange_rate || row.exchangeRate)
    },
    { 
      header: 'Amount', 
      accessorKey: 'amount',
      align: 'right' as const,
      render: (row: any) => (
        <span className="font-bold text-[#2e1d52]">{money(row.amountMAD || row.amount_mad || row.amount, 'MAD')}</span>
      )
    }
  ];

  if (!hasListAccess) {
    return <div className="p-8 text-center text-rose-500 font-bold">Unauthorized. You do not have permission to access this page.</div>;
  }

  const creditBalance = safeNumber(overview?.credit_balance);

  const websiteContent = () => {
    const web = customer?.website || customer?.company_website || customer?.companyWebsite;
    if (!web || web === '-') return <span>-</span>;
    const isValidUrl = web.startsWith('http://') || web.startsWith('https://');
    if (isValidUrl) {
      return <a href={web} target="_blank" rel="noopener noreferrer" className="hover:underline">{web}</a>;
    }
    return <span>{web}</span>;
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      <ERPPageHeader
        title="Customer Balance Details"
        subtitle={`Financial details and transaction history for ${customer?.company_name || customer?.companyName || customerId}.`}
        breadcrumbItems={[
          { label: 'Profile', href: '/finance/customer-balances' },
          { label: 'Customers Balance', href: '/finance/customer-balances' },
          { label: 'Details', active: true }
        ]}
        actions={
          <div className="flex items-center gap-3">
            <Button
              onClick={() => router.push(`/finance/customer-balances/${encodeURIComponent(customerId)}/dashboard`)}
              className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 uppercase text-[10px] tracking-widest px-6 rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
            >
              <LayoutDashboard size={14} className="stroke-[3]" /> Customer Dashboard
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="h-12 w-12 text-[#7a9800] animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Customer Data...</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Email Address</p>
              <p className="font-bold text-[#2e1d52]">{safeText(customer?.email || customer?.company_email || customer?.companyEmail)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Phone Number</p>
              <p className="font-bold text-[#2e1d52]">{safeText(customer?.phone || customer?.company_phone || customer?.companyPhone)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Company Name</p>
              <p className="font-bold text-[#2e1d52]">{safeText(customer?.company_name || customer?.companyName)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Website</p>
              <p className="font-bold text-blue-600">
                {websiteContent()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 max-w-[1600px] mx-auto">
            <ERPStatisticCard
              title="Credit Balance"
              value={money(creditBalance)}
              icon={<AlertCircle className={creditBalance > 0 ? 'text-amber-500' : 'text-slate-400'} size={18} />}
              description="Outstanding balance"
            />
            <ERPStatisticCard
              title="Total Sales"
              value={money(overview?.total_sale)}
              icon={<TrendingUp className="text-[#2e1d52]" size={18} />}
              description="Total invoiced"
            />
            <ERPStatisticCard
              title="Total Paid"
              value={money(overview?.total_paid)}
              icon={<CreditCard className="text-[#7a9800]" size={18} />}
              description="Total payments received"
            />
            <ERPStatisticCard
              title="Total Credit Note"
              value={money(overview?.credit_note)}
              icon={<AlertCircle className="text-slate-400" size={18} />}
              description="Value of returned items & credits"
            />
          </div>

          <div className="max-w-[1600px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            <ERPTabs
              tabs={[
                { id: 'invoices', label: 'Invoices' },
                { id: 'payments', label: 'Payments' }
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
            />

            {activeTab === 'invoices' && (
              <ERPTable
                columns={salesColumns}
                data={invoices}
                pageSize={10}
                emptyMessage="No sales invoices found."
              />
            )}
            {activeTab === 'payments' && (
              <ERPTable
                columns={paymentColumns}
                data={payments}
                pageSize={10}
                emptyMessage="No payments found."
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
