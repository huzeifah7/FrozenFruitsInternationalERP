'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, query, doc } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { useSeason } from '@/contexts/SeasonContext';
import { useAuthContext } from '@/components/auth-provider';
import { canList } from '@/lib/permissions';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPStatisticCard } from '@/components/erp/ERPStatisticCard';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Download, FileText, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';
import dynamic from 'next/dynamic';
import { money, safeNumber, safeText } from '../../utils';
import Swal from 'sweetalert2';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function CustomerDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.customerId as string;
  const customerId = decodeURIComponent(rawId);
  const { profile } = useAuthContext();

  const hasListAccess = canList(profile, 'finance.customer-balances');
  const dashboardRef = useRef<HTMLDivElement>(null);

  const [pdfExporting, setPdfExporting] = useState(false);
  const db = useFirestore();
  const { currentSeason } = useSeason();

  // Firestore Queries
  const customerRef = useMemoFirebase(() => db && customerId ? doc(db, 'customers', customerId) : null, [db, customerId]);
  const invoicesQ = useMemoFirebase(() => db && customerId ? query(collection(db, 'invoices')) : null, [db, customerId]);
  const paymentsQ = useMemoFirebase(() => db && customerId ? query(collection(db, 'payments')) : null, [db, customerId]);
  const creditNotesQ = useMemoFirebase(() => db && customerId ? query(collection(db, 'credit_notes')) : null, [db, customerId]);
  const loadingsQ = useMemoFirebase(() => db && customerId ? query(collection(db, 'loadings')) : null, [db, customerId]);

  const { data: customerDoc, isLoading: cLoad } = useDoc(customerRef);
  const { data: allInvoices, isLoading: iLoad } = useCollection(invoicesQ);
  const { data: allPayments, isLoading: pLoad } = useCollection(paymentsQ);
  const { data: allCreditNotes, isLoading: cnLoad } = useCollection(creditNotesQ);
  const { data: allLoadings, isLoading: lLoad } = useCollection(loadingsQ);

  const isLoading = cLoad || iLoad || pLoad || cnLoad || lLoad;

  const [customer, setCustomer] = useState<any>({});
  const [stats, setStats] = useState({ total_invoice: 0, outstanding: 0, overdue: 0 });
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadings, setLoadings] = useState<any[]>([]);
  const [caliberData, setCaliberData] = useState<{ categories: string[], data: number[] }>({ categories: [], data: [] });

  const fetchDashboardData = useCallback(() => {
    if (isLoading) return;

    setCustomer(customerDoc || {});

    const seasonId = currentSeason?.id;
    const seasonInvoices = seasonId ? (allInvoices || []).filter(i => i.season_id === seasonId) : (allInvoices || []);
    const seasonPayments = seasonId ? (allPayments || []).filter(p => p.season_id === seasonId) : (allPayments || []);
    const seasonCreditNotes = seasonId ? (allCreditNotes || []).filter(c => c.season_id === seasonId) : (allCreditNotes || []);
    const seasonLoadings = seasonId ? (allLoadings || []).filter(l => l.season_id === seasonId) : (allLoadings || []);

    const cInvoices = seasonInvoices.filter(i => i.customer_id === customerId || i.customer === customerId || (i.customer_detail && i.customer_detail.id === customerId));
    const cPayments = seasonPayments.filter(p => p.customer_id === customerId || p.customer === customerId);
    const cCreditNotes = seasonCreditNotes.filter(cn => cn.customer_id === customerId || cn.customer === customerId);
    const cLoadings = seasonLoadings.filter(l => l.customer_id === customerId || l.customer === customerId || (l.customer_detail && l.customer_detail.id === customerId));

    // Stats
    const total_invoice = cInvoices.reduce((sum, inv) => sum + safeNumber(inv.total_amount || inv.invoice_amount), 0);
    const credit_note_amount = cCreditNotes.reduce((sum, cn) => sum + safeNumber(cn.amount || cn.total_amount), 0);
    const paid_amount = cPayments.reduce((sum, p) => sum + safeNumber(p.amount || p.payment_amount), 0);
    const open_amount = total_invoice - credit_note_amount - paid_amount;

    setStats({
      total_invoice,
      outstanding: open_amount,
      overdue: Math.max(0, open_amount) // Assuming overdue is just open amount for now
    });

    // Invoices and Loadings
    setInvoices(cInvoices);
    setLoadings(cLoadings);

    // Basic Caliber mapping from loadings (since we don't have a direct query for it)
    const calibers: Record<string, number> = {};
    cLoadings.forEach(l => {
      const pId = l.product_id || l.product || 'Unknown';
      calibers[pId] = (calibers[pId] || 0) + safeNumber(l.total_amount || l.amount || 1);
    });
    setCaliberData({
      categories: Object.keys(calibers),
      data: Object.values(calibers)
    });
  }, [isLoading, customerDoc, allInvoices, allPayments, allCreditNotes, allLoadings, currentSeason, customerId]);

  useEffect(() => {
    if (hasListAccess) {
      fetchDashboardData();
    }
  }, [hasListAccess, fetchDashboardData]);

  const exportPdf = async () => {
    const el = document.getElementById('downloadpdf');
    if (!el) return;
    setPdfExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      const dateStr = new Date().toISOString().split('T')[0];
      pdf.save(`Customer Dashboard ${dateStr}.pdf`);
      Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: 'PDF Exported successfully.' });
    } catch (err) {
      console.error('PDF generation error:', err);
      Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'error', title: 'Failed to generate PDF.' });
    } finally {
      setPdfExporting(false);
    }
  };

  if (!hasListAccess) {
    return <div className="p-8 text-center text-rose-500 font-bold">Unauthorized. You do not have permission to access this page.</div>;
  }

  const websiteContent = () => {
    const web = customer?.company_website || customer?.companyWebsite;
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
        title="Customer Dashboard"
        subtitle={`Analytics and metrics for ${safeText(customer?.company_name || customer?.companyName)}.`}
        breadcrumbItems={[
          { label: 'Profile', href: '/finance/customer-balances' },
          { label: 'Customers Balance', href: '/finance/customer-balances' },
          { label: 'Dashboard', active: true }
        ]}
        actions={
          <div className="flex items-center gap-3">
            <Button
              onClick={() => router.push(`/finance/customer-balances/${encodeURIComponent(customerId)}`)}
              variant="outline"
              className="h-12 border-slate-200 text-slate-600 bg-white font-bold gap-2 uppercase text-[10px] tracking-widest px-4 rounded-xl shadow-sm hover:bg-slate-50 transition-all"
            >
              <ArrowLeft size={14} className="stroke-[3]" /> Back
            </Button>
            <Button
              onClick={exportPdf}
              disabled={pdfExporting || isLoading}
              className="h-12 bg-red-600 hover:bg-red-700 text-white font-bold gap-2 uppercase text-[10px] tracking-widest px-6 rounded-xl shadow-lg shadow-red-600/20 transition-all hover:scale-105 active:scale-95"
            >
              {pdfExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download size={14} className="stroke-[3]" />} 
              Export PDF
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="h-12 w-12 text-[#7a9800] animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Dashboard...</p>
        </div>
      ) : (
        <div id="downloadpdf" ref={dashboardRef} className="space-y-6 max-w-[1600px] mx-auto pb-12 bg-[#f3f3f3]">
          {/* Customer Info */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Company Name</p>
              <p className="font-bold text-[#2e1d52]">{safeText(customer?.company_name || customer?.companyName)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Phone Number</p>
              <p className="font-bold text-[#2e1d52]">{safeText(customer?.company_phone || customer?.companyPhone)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Email Address</p>
              <p className="font-bold text-[#2e1d52]">{safeText(customer?.company_email || customer?.companyEmail)}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Website</p>
              <p className="font-bold text-blue-600">
                {websiteContent()}
              </p>
            </div>
          </div>

          {/* Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <ERPStatisticCard
              title="Total invoices"
              value={money(stats.total_invoice, 'MAD')}
              icon={<FileText className="text-[#2e1d52]" size={18} />}
              description="Gross invoiced amount"
            />
            <ERPStatisticCard
              title="Outstanding"
              value={money(stats.outstanding, 'MAD')}
              icon={<AlertCircle className={stats.outstanding > 0 ? 'text-amber-500' : 'text-slate-400'} size={18} />}
              description="Open balance"
            />
            <ERPStatisticCard
              title="Overdue"
              value={money(stats.overdue, 'MAD')}
              icon={<AlertCircle className={stats.overdue > 0 ? 'text-rose-500' : 'text-slate-400'} size={18} />}
              description="Past due balance"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Invoices Table */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-[#2e1d52] text-lg">Invoices</h3>
              </div>
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto p-4">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice Number</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Total Sales</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Paid</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">CN Amount</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Open Amount</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.length > 0 ? invoices.map((inv: any) => {
                      const cn = safeNumber(inv.total_credit_note || inv.credit_note_amount);
                      const openAmt = safeNumber(inv.total_amount || inv.invoice_amount) - safeNumber(inv.paid_amount || inv.paid) - cn;
                      const statId = inv.status_id ?? inv.invoicing_status?.id ?? (inv.status === 'PAID' ? 1 : inv.status === 'OPEN' ? 2 : 0);
                      
                      return (
                        <tr key={inv.id || inv.invoice_number} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="p-3 font-bold text-blue-600 underline cursor-pointer" onClick={() => router.push(`/finance/invoices/payment/${inv.id}`)}>
                            {safeText(inv.invoice_number || inv.invoiceNumber)}
                          </td>
                          <td className="p-3 text-slate-600 font-medium">{safeText(inv.date)}</td>
                          <td className="p-3 font-black text-[#2e1d52] text-right">{money(inv.total_amount || inv.invoice_amount)}</td>
                          <td className="p-3 font-bold text-[#7a9800] text-right">{money(inv.paid_amount || inv.paid)}</td>
                          <td className="p-3 font-medium text-slate-500 text-right">{money(cn)}</td>
                          <td className="p-3 font-bold text-amber-500 text-right">{money(openAmt)}</td>
                          <td className="p-3 text-center">
                            {statId === 1 ? (
                              <span className="inline-flex items-center justify-center bg-[#0080006b] text-white px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest">
                                <CheckCircle size={10} className="mr-1" /> PAID
                              </span>
                            ) : statId === 2 ? (
                              <span className="inline-flex items-center justify-center bg-[#0000ff78] text-white px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest">
                                <Clock size={10} className="mr-1" /> OPEN
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center bg-[#ff00005e] text-white px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest">
                                <XCircle size={10} className="mr-1" /> DUE
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan={7} className="p-4 text-center text-slate-400 font-bold">No records to display</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Loads Table */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-[#2e1d52] text-lg">Recent loads</h3>
              </div>
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto p-4">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Invoice Number</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400">ETA Date</th>
                      <th className="p-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadings.length > 0 ? loadings.map((ld: any, idx: number) => (
                      <tr key={ld.id || idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="p-3 font-medium text-slate-600">{safeText(ld.loading_date || ld.date)}</td>
                        <td className="p-3 font-bold text-[#2e1d52]">{safeText(ld.invoice_number || ld.invoiceNumber)}</td>
                        <td className="p-3 font-medium text-slate-600">{safeText(ld.eta_date || ld.etaDate)}</td>
                        <td className="p-3 text-center">
                          <Button 
                            onClick={() => router.push(`/supply-chain/loadings/${ld.id}`)}
                            variant="outline"
                            className="h-7 text-[9px] font-bold uppercase tracking-widest rounded-lg"
                          >
                            Access Loading
                          </Button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-400 font-bold">No records to display</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Calibers Analytics */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden p-6">
            <h3 className="font-black text-[#2e1d52] text-lg mb-4">Calibers Analytics</h3>
            <div className="overflow-x-auto min-w-full">
              <div style={{ minWidth: '1000px', height: '350px' }}>
                <Chart 
                  options={{
                    chart: { type: 'bar', stacked: true, toolbar: { show: false } },
                    xaxis: { 
                      categories: caliberData.categories.length ? caliberData.categories : ['No Data'], 
                      labels: { rotate: -45, style: { fontWeight: 600 } }
                    },
                    yaxis: { 
                      labels: { formatter: (val: number) => `${val} %`, style: { fontWeight: 600 } }
                    },
                    colors: ['#709506', '#ededc8'],
                    plotOptions: { bar: { borderRadius: 4, columnWidth: '40%' } },
                    dataLabels: { enabled: false },
                    tooltip: { y: { formatter: (val: number) => `${val}%` } }
                  }}
                  series={[{ name: 'Percentage', data: caliberData.data.length ? caliberData.data : [0] }]}
                  type="bar"
                  height={350}
                />
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
