'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useSeason } from '@/contexts/SeasonContext';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPStatisticCard } from '@/components/erp/ERPStatisticCard';
import { ERPTable } from '@/components/erp/ERPTable';
import { ERPToolbar } from '@/components/erp/ERPToolbar';
import { ERPExportButtons } from '@/components/erp/ERPExportButtons';
import { Loader2, TrendingUp, CreditCard, AlertCircle } from 'lucide-react';
import { useAuthContext } from '@/components/auth-provider';
import { canList } from '@/lib/permissions';
import Swal from 'sweetalert2';

const safeText = (value: any) => value ?? "-";
const safeNumber = (value: any) => Number(value || 0);
const money = (value: any, symbol: string = '') => {
  const formatted = safeNumber(value).toFixed(2);
  return symbol ? `${formatted} ${symbol}` : formatted;
};

export default function CustomersBalancePage() {
  const router = useRouter();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { profile } = useAuthContext();
  const hasListAccess = canList(profile, 'finance.customer-balances');

  const db = useFirestore();
  const { currentSeason } = useSeason();

  const customersQ = useMemoFirebase(() => db && hasListAccess ? query(collection(db, 'customers')) : null, [db, hasListAccess]);
  const invoicesQ = useMemoFirebase(() => db && hasListAccess ? query(collection(db, 'invoices')) : null, [db, hasListAccess]);
  const loadingsQ = useMemoFirebase(() => db && hasListAccess ? query(collection(db, 'supply_chain_loadings')) : null, [db, hasListAccess]);
  const packingListsQ = useMemoFirebase(() => db && hasListAccess ? query(collection(db, 'packingLists')) : null, [db, hasListAccess]);
  const paymentsQ = useMemoFirebase(() => db && hasListAccess ? query(collection(db, 'payments')) : null, [db, hasListAccess]);
  const ssPaymentsQ = useMemoFirebase(() => db && hasListAccess ? query(collection(db, 'suppliers_situation_payments')) : null, [db, hasListAccess]);
  const creditNotesQ = useMemoFirebase(() => db && hasListAccess ? query(collection(db, 'credit_notes')) : null, [db, hasListAccess]);

  const { data: allCustomers, isLoading: cLoad } = useCollection(customersQ);
  const { data: rawInvoices, isLoading: iLoad } = useCollection(invoicesQ);
  const { data: rawLoadings } = useCollection(loadingsQ);
  const { data: rawPackingLists } = useCollection(packingListsQ);
  const { data: allPayments, isLoading: pLoad } = useCollection(paymentsQ);
  const { data: allSSPayments, isLoading: sspLoad } = useCollection(ssPaymentsQ);
  const { data: allCreditNotes, isLoading: cnLoad } = useCollection(creditNotesQ);

  const isLoading = cLoad || iLoad || pLoad || cnLoad || sspLoad;

  const customerData = useMemo(() => {
    if (!allCustomers) return [];
    
    const seasonId = currentSeason?.id;

    const mergedInvoicesMap = new Map<string, any>();
    [...(rawInvoices || []), ...(rawLoadings || []), ...(rawPackingLists || [])].forEach(item => {
      if (item.id && !mergedInvoicesMap.has(item.id)) {
        mergedInvoicesMap.set(item.id, item);
      }
    });
    const combinedInvoices = Array.from(mergedInvoicesMap.values());

    const seasonInvoices = seasonId ? combinedInvoices.filter(i => !i.season_id || i.season_id === seasonId) : combinedInvoices;
    const seasonPayments = seasonId ? (allPayments || []).filter(p => !p.season_id || p.season_id === seasonId) : (allPayments || []);
    const seasonSSPayments = seasonId ? (allSSPayments || []).filter(p => !p.season_id || p.season_id === seasonId) : (allSSPayments || []);
    const seasonCreditNotes = seasonId ? (allCreditNotes || []).filter(c => !c.season_id || c.season_id === seasonId) : (allCreditNotes || []);

    return allCustomers
      .map(c => {
        const cId = c.id;
        const cName = String(c.company_name || c.companyName || c.name || (c.firstName ? `${c.firstName} ${c.lastName || ''}`.trim() : '')).trim();

        const cInvoices = seasonInvoices.filter(i => {
          if (i.customer_id === cId || i.customer === cId || (i.customer_detail && i.customer_detail.id === cId)) return true;
          const invCustName = String(i.customer_detail?.companyName || i.customer_detail?.company_name || i.customerName || i.customer || '').trim();
          return cName && invCustName && invCustName.toLowerCase() === cName.toLowerCase();
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
          if (p.customer_id === cId || p.customerId === cId || p.customer === cId) return true;
          if (p.invoiceId && cInvoiceIds.has(p.invoiceId)) return true;
          if (p.invoiceNumber && cInvoiceNumbers.has(String(p.invoiceNumber).trim())) return true;
          if (p.invoice_number && cInvoiceNumbers.has(String(p.invoice_number).trim())) return true;
          const pCustName = String(p.customerName || p.customer_name || p.customer || '').trim();
          return cName && pCustName && pCustName.toLowerCase() === cName.toLowerCase();
        });

        const cSSPayments = seasonSSPayments.filter(p => {
          if (p.customer_id === cId || p.customerId === cId || p.customer === cId) return true;
          if (p.invoiceId && cInvoiceIds.has(p.invoiceId)) return true;
          if (p.invoiceNumber && cInvoiceNumbers.has(String(p.invoiceNumber).trim())) return true;
          if (p.invoice_number && cInvoiceNumbers.has(String(p.invoice_number).trim())) return true;
          const pCustName = String(p.customerName || p.customer_name || p.customer || '').trim();
          return cName && pCustName && pCustName.toLowerCase() === cName.toLowerCase();
        });

        const cCreditNotes = seasonCreditNotes.filter(cn => {
          if (cn.customer_id === cId || cn.customer === cId) return true;
          const cnCustName = String(cn.customer_detail?.companyName || cn.customer_detail?.company_name || cn.customerName || cn.customer || '').trim();
          return cName && cnCustName && cnCustName.toLowerCase() === cName.toLowerCase();
        });

        const total_sale = cInvoices.reduce((sum, inv) => sum + safeNumber(inv.total_amount || inv.invoice_amount), 0);
        const credit_note_amount = cCreditNotes.reduce((sum, cn) => sum + safeNumber(cn.amount || cn.total_amount), 0);
        const paid_amount = cPayments.reduce((sum, p) => sum + safeNumber(p.amount || p.payment_amount), 0) + cSSPayments.reduce((sum, p) => sum + safeNumber(p.amount || p.payment_amount), 0);
        const open_amount = total_sale - credit_note_amount - paid_amount;

        return {
          ...c,
          companyName: cName || '-',
          total_sale,
          credit_note_amount,
          paid_amount,
          open_amount
        };
      })
      .filter(c => Math.abs(c.total_sale) > 0.001 || Math.abs(c.credit_note_amount) > 0.001 || Math.abs(c.paid_amount) > 0.001 || Math.abs(c.open_amount) > 0.001)
      .sort((a, b) => b.total_sale - a.total_sale || b.open_amount - a.open_amount);
  }, [allCustomers, rawInvoices, rawLoadings, rawPackingLists, allPayments, allSSPayments, allCreditNotes, currentSeason]);

  const totals = useMemo(() => {
    return customerData.reduce((acc, curr) => {
      acc.total_sale += curr.total_sale;
      acc.total_credit_note += curr.credit_note_amount;
      acc.paid_amount += curr.paid_amount;
      acc.open_amount += curr.open_amount;
      return acc;
    }, { total_sale: 0, total_credit_note: 0, open_amount: 0, paid_amount: 0 });
  }, [customerData]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customerData;
    const lower = searchTerm.toLowerCase();
    return customerData.filter(c => 
      safeText(c.companyName || c.company_name || c.customer_name).toLowerCase().includes(lower)
    );
  }, [customerData, searchTerm]);

  const excelExportData = useMemo(() => {
    return filteredCustomers.map(c => ({
      'Customer Name': safeText(c.companyName || c.company_name || c.customer_name),
      'Total Sales': safeNumber(c.total_sale),
      'Paid Amount': safeNumber(c.paid_amount),
      'Credit Notes': safeNumber(c.credit_note_amount),
      'Open Amount': safeNumber(c.open_amount)
    }));
  }, [filteredCustomers]);

  const columns = useMemo(() => [
    {
      header: 'Customer Name',
      accessorKey: 'companyName',
      render: (row: any) => {
        const dataObj = row.original || row;
        const name = safeText(dataObj.companyName || dataObj.company_name || dataObj.customer_name);
        const customerId = row.id || row.original?.id || '';
        return (
          <span 
            onClick={() => router.push(`/finance/customer-balances/${encodeURIComponent(customerId)}`)}
            className="font-bold text-[#2e1d52] hover:text-[#7a9800] transition-colors cursor-pointer underline decoration-[#7a9800]/30 underline-offset-4"
          >
            {name}
          </span>
        );
      }
    },
    {
      header: 'Total Sales',
      accessorKey: 'total_sale',
      render: (row: any) => {
        const dataObj = row.original || row;
        const symbol = dataObj.currency?.symbol || '';
        return <span className="font-black text-[#2e1d52]">{money(dataObj.total_sale, symbol)}</span>;
      }
    },
    {
      header: 'Credit note',
      accessorKey: 'credit_note_amount',
      render: (row: any) => {
        const dataObj = row.original || row;
        const symbol = dataObj.currency?.symbol || '';
        return <span className="font-bold text-slate-500">{money(dataObj.credit_note_amount, symbol)}</span>;
      }
    },
    {
      header: 'Paid Amount',
      accessorKey: 'paid_amount',
      render: (row: any) => {
        const dataObj = row.original || row;
        const symbol = dataObj.currency?.symbol || '';
        return <span className="font-bold text-[#7a9800]">{money(dataObj.paid_amount, symbol)}</span>;
      }
    },
    {
      header: 'Open Amount',
      accessorKey: 'open_amount',
      render: (row: any) => {
        const dataObj = row.original || row;
        const symbol = dataObj.currency?.symbol || '';
        const amt = safeNumber(dataObj.open_amount);
        return (
          <span className={`font-black ${amt > 0 ? 'text-amber-600' : amt < 0 ? 'text-rose-500' : 'text-slate-400'}`}>
            {money(amt, symbol)}
          </span>
        );
      }
    }
  ], [router]);

  if (!hasListAccess) {
    return <div className="p-8 text-center text-rose-500 font-bold">Unauthorized. You do not have permission to access this page.</div>;
  }

  return (
    <div className={`p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 overflow-auto bg-white' : ''}`}>
      <ERPPageHeader
        title="Customers Balance"
        subtitle="Overview of financial balances, paid invoices, and outstanding credit notes for customers."
        breadcrumbItems={[{ label: 'Profile', href: '/finance/customer-balances' }, { label: 'Customers Balance', active: true }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1600px] mx-auto">
        <ERPStatisticCard
          title="Total Sale"
          value={money(totals.total_sale)}
          icon={<TrendingUp className="text-[#2e1d52]" size={18} />}
          description="Gross invoiced amount"
        />
        <ERPStatisticCard
          title="Total Credit Note"
          value={money(totals.total_credit_note)}
          icon={<CreditCard className="text-[#7a9800]" size={18} />}
          description="Value of returned items & credits"
        />
        <ERPStatisticCard
          title="Paid Amounts"
          value={money(totals.paid_amount)}
          icon={<CreditCard className="text-[#7a9800]" size={18} />}
          description="Total received payments"
        />
        <ERPStatisticCard
          title="Open Amounts"
          value={money(totals.open_amount)}
          icon={<AlertCircle className={safeNumber(totals.open_amount) > 0 ? 'text-amber-500' : 'text-slate-400'} size={18} />}
          description="Outstanding balances"
        />
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

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-[#7a9800] animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Balances...</p>
          </div>
        ) : (
          <ERPTable
            columns={columns}
            data={filteredCustomers}
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
