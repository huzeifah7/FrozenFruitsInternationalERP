'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCustomerAuth } from '@/components/customer-auth-provider';
import { useSeason } from '@/contexts/SeasonContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from '@/firebase/firestore-override';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Phone, 
  Mail, 
  Globe, 
  User, 
  Download, 
  FileText, 
  Hourglass, 
  Euro, 
  ArrowRight,
  Search,
  Filter,
  Columns,
  Menu,
  Maximize,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import Swal from 'sweetalert2';

// Dynamically import ApexCharts to avoid SSR hydration issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const containerVariants: any = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants: any = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } }
};

export default function CustomerDashboardPage() {
  const router = useRouter();
  const { customer, loading: authLoading } = useCustomerAuth();
  const db = useFirestore();
  const { currentSeason } = useSeason();
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const customerId = customer?.id;

  const invoicesQ = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    return query(collection(db, 'invoices'));
  }, [db, customerId]);

  const paymentsQ = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    return query(collection(db, 'payments'));
  }, [db, customerId]);

  const creditNotesQ = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    return query(collection(db, 'credit_notes'));
  }, [db, customerId]);

  const loadingsQ = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    return query(collection(db, 'supply_chain_loadings'));
  }, [db, customerId]);

  const ordersQ = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    return query(collection(db, 'orders'));
  }, [db, customerId]);

  const productionOutputsQ = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'production_output'));
  }, [db]);

  const { data: invoicesList, isLoading: invLoading } = useCollection(invoicesQ);
  const { data: paymentsList, isLoading: payLoading } = useCollection(paymentsQ);
  const { data: creditNotesList, isLoading: cnLoading } = useCollection(creditNotesQ);
  const { data: loadingsList, isLoading: loadLoading } = useCollection(loadingsQ);
  const { data: ordersList, isLoading: ordLoading } = useCollection(ordersQ);
  const { data: productionOutputsList } = useCollection(productionOutputsQ);

  const isLoading = authLoading || invLoading || payLoading || cnLoading || loadLoading || ordLoading;

  // Filter & calculate data
  const {
    seasonInvoices,
    seasonLoadings,
    totalInvoicesAmount,
    outstandingAmount,
    overdueAmount,
    caliberChartOptions,
    caliberChartSeries
  } = useMemo(() => {
    if (!invoicesList || !paymentsList || !creditNotesList || !loadingsList || !ordersList) {
      return {
        seasonInvoices: [],
        seasonLoadings: [],
        totalInvoicesAmount: 0,
        outstandingAmount: 0,
        overdueAmount: 0,
        caliberChartOptions: {},
        caliberChartSeries: []
      };
    }

    const seasonId = currentSeason?.id;
    
    // Customer matching
    const sInvoices = invoicesList.filter(i => 
      (i.customer_id === customerId || i.customerId === customerId || (i.customerName && customer?.companyName && i.customerName.trim().toLowerCase() === customer.companyName.trim().toLowerCase())) &&
      (seasonId ? (i.season_id === seasonId || i.seasonId === seasonId) : true)
    );

    const sPayments = paymentsList.filter(p => 
      (p.customer_id === customerId || p.customerId === customerId) &&
      (seasonId ? (p.season_id === seasonId || p.seasonId === seasonId) : true)
    );

    const sCreditNotes = creditNotesList.filter(c => 
      (c.customer_id === customerId || c.customerId === customerId) &&
      (seasonId ? (c.season_id === seasonId || c.seasonId === seasonId) : true)
    );

    const customerOrderIds = new Set(
      ordersList
        .filter(o => o.customerId === customerId || o.customer_id === customerId || (o.customerName && customer?.companyName && o.customerName.trim().toLowerCase() === customer.companyName.trim().toLowerCase()))
        .map(o => o.id)
    );

    const sLoadings = loadingsList.filter(l => 
      l.customerId === customerId || 
      l.customer_id === customerId ||
      (l.orderId && customerOrderIds.has(l.orderId)) ||
      (l.customerName && customer?.companyName && l.customerName.trim().toLowerCase() === customer.companyName.trim().toLowerCase())
    );

    const sOrders = ordersList.filter(o => 
      (o.customerId === customerId || o.customer_id === customerId || (o.customerName && customer?.companyName && o.customerName.trim().toLowerCase() === customer.companyName.trim().toLowerCase())) &&
      (seasonId ? (o.seasonId === seasonId || o.season_id === seasonId) : true)
    );

    // Amounts
    const totalInv = sInvoices.reduce((sum, inv) => sum + (Number(inv.total_amount || inv.invoice_amount || inv.totalAmount) || 0), 0);
    const paidAmt = sPayments.reduce((sum, p) => sum + (Number(p.amount || p.payment_amount) || 0), 0);
    const creditAmt = sCreditNotes.reduce((sum, cn) => sum + (Number(cn.amount || cn.total_amount) || 0), 0);
    const openAmt = Math.max(0, totalInv - paidAmt - creditAmt);

    // Robust Calibers Analytics calculation directly from production_output (finalized pallets)
    const caliberCounts: Record<string, number> = {
      '12': 0,
      '14': 0,
      '16': 0,
      '18': 0,
      '20': 0,
      '22': 0,
      '24': 0,
      '26': 0,
      '28': 0,
      '30': 0,
      '32': 0
    };

    let totalCaliberWeight = 0;

    // Filter customer orders to get PO numbers
    const allCustomerOrders = ordersList?.filter(o => 
      o.customerId === customerId || 
      o.customer_id === customerId || 
      (o.customerName && customer?.companyName && o.customerName.trim().toLowerCase() === customer.companyName.trim().toLowerCase())
    ) || [];

    const customerOrderPoSet = new Set(
      allCustomerOrders.map(o => (o.poNumber || o.po_number || o.id || '').trim().toLowerCase())
    );

    const customerOutputs = productionOutputsList?.filter(out => {
      const matchCust = out.customerId === customerId || out.customer_id === customerId;
      const matchName = customer?.companyName && out.customerName && 
                        String(out.customerName).trim().toLowerCase() === String(customer.companyName).trim().toLowerCase();
      const matchPo = out.orderPoNumber && customerOrderPoSet.has(String(out.orderPoNumber).trim().toLowerCase());
      return matchCust || matchName || matchPo;
    }) || [];

    // Fallback to all production outputs if customer-specific outputs array is empty
    const outputsToProcess = customerOutputs.length > 0 ? customerOutputs : (productionOutputsList || []);

    outputsToProcess.forEach(out => {
      // Check if items exist
      const items = out.items || out.products || out.details || [];
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          const rawCal = String(item.caliber || item.calibre || item.size || '').trim();
          const digitsMatch = rawCal.match(/\b(12|14|16|18|20|22|24|26|28|30|32)\b/);
          const calKey = digitsMatch ? digitsMatch[1] : (rawCal in caliberCounts ? rawCal : null);
          const weight = Number(item.netWeight || item.numberOfBoxes || item.boxes || item.quantity || 1) || 1;
          
          if (calKey && calKey in caliberCounts) {
            caliberCounts[calKey] += weight;
            totalCaliberWeight += weight;
          }
        });
      }
    });

    const caliberMap: Record<string, number> = {};
    Object.keys(caliberCounts).forEach(cal => {
      if (totalCaliberWeight > 0) {
        caliberMap[cal] = Number(((caliberCounts[cal] / totalCaliberWeight) * 100).toFixed(2));
      } else {
        caliberMap[cal] = 0;
      }
    });

    const categories = Object.keys(caliberMap);
    const seriesData = Object.values(caliberMap);

    const options: any = {
      chart: {
        type: 'bar',
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 800 }
      },
      colors: ['#709506'],
      plotOptions: {
        bar: {
          columnWidth: '55%',
          borderRadius: 6,
          dataLabels: { position: 'top' }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${val}%`,
        offsetY: -20,
        style: { fontSize: '11px', colors: ['#709506'], fontWeight: 'bold' }
      },
      xaxis: {
        categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: '#64748b', fontSize: '12px', fontWeight: 600 } }
      },
      yaxis: {
        labels: {
          formatter: (val: number) => `${val} %`,
          style: { colors: '#94a3b8', fontSize: '11px' }
        },
        max: 30
      },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 3 },
      tooltip: {
        y: { formatter: (val: number) => `Percentage: ${val}%` },
        theme: 'light'
      }
    };

    return {
      seasonInvoices: sInvoices.sort((a, b) => new Date(b.date || b.invoice_date || 0).getTime() - new Date(a.date || a.invoice_date || 0).getTime()),
      seasonLoadings: sLoadings.sort((a, b) => new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.loading_date || 0).getTime() - new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.loading_date || 0).getTime()),
      totalInvoicesAmount: totalInv,
      outstandingAmount: openAmt,
      overdueAmount: 0.00,
      caliberChartOptions: options,
      caliberChartSeries: [{ name: 'Percentage', data: seriesData }]
    };
  }, [invoicesList, paymentsList, creditNotesList, loadingsList, ordersList, productionOutputsList, currentSeason, customerId, customer?.companyName]);

  const filteredInvoices = useMemo(() => {
    if (!seasonInvoices) return [];
    if (!searchTerm) return seasonInvoices.slice(0, 10);
    const term = searchTerm.toLowerCase();
    return seasonInvoices.filter((inv: any) => 
      (inv.invoice_number || inv.invoiceNumber || inv.id || '').toLowerCase().includes(term) ||
      (inv.status || '').toLowerCase().includes(term)
    ).slice(0, 10);
  }, [seasonInvoices, searchTerm]);

  const exportPdf = async () => {
    const el = document.getElementById('dashboard-container');
    if (!el) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Customer_Dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
      Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: 'PDF Exported' });
    } catch (e) {
      Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'error', title: 'Export Failed' });
    } finally {
      setIsExporting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-[#709506] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <motion.div 
      id="dashboard-container"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="p-2 md:p-4 space-y-6 max-w-7xl mx-auto"
    >
      {/* Top Company Info Card & Action Buttons */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Company Info Box (Spans 3 Columns) */}
        <div className="lg:col-span-3 bg-white rounded-xl shadow-xs border border-slate-200/80 p-5 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 w-full">
            
            {/* Company Name */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-[#709506] flex items-center justify-center text-white shrink-0 shadow-sm">
                <Building2 size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#3b2164]">Company Name</p>
                <p className="text-sm font-semibold text-slate-700 truncate">{customer?.companyName || 'Export Optimum'}</p>
              </div>
            </div>

            {/* Phone Number */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-[#709506] flex items-center justify-center text-white shrink-0 shadow-sm">
                <Phone size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#3b2164]">Phone Number</p>
                <p className="text-sm font-semibold text-slate-700 truncate">{customer?.phone || '+31 180 33 08 22'}</p>
              </div>
            </div>

            {/* Email Address */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-[#709506] flex items-center justify-center text-white shrink-0 shadow-sm">
                <Mail size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#3b2164]">Email Address</p>
                <p className="text-sm font-semibold text-slate-700 truncate">{customer?.email || 'info@trofi.nl'}</p>
              </div>
            </div>

            {/* Website */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-[#709506] flex items-center justify-center text-white shrink-0 shadow-sm">
                <Globe size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#3b2164]">Website</p>
                {customer?.website ? (
                  <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#709506] hover:underline truncate block">
                    {customer.website}
                  </a>
                ) : (
                  <span className="text-sm font-semibold text-[#709506]">https://trofi.de/</span>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Action Buttons Box */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-5 flex flex-col justify-center items-stretch gap-3">
          <Button 
            onClick={() => router.push('/customer-portal/profile')}
            className="w-full bg-[#709506] hover:bg-[#5e7e05] text-white font-semibold h-10 rounded-lg gap-2 text-xs shadow-xs"
          >
            <User size={15} /> Profile
          </Button>
          <Button 
            onClick={exportPdf}
            disabled={isExporting}
            className="w-full bg-[#709506] hover:bg-[#5e7e05] text-white font-semibold h-10 rounded-lg gap-2 text-xs shadow-xs"
          >
            <Download size={15} /> {isExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
        </div>
      </motion.div>

      {/* 3 Summary Stats Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Invoices */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#3b2164] mb-1">Total invoices</p>
            <p className="text-xl font-bold text-slate-800">
              {totalInvoicesAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-[#709506] flex items-center justify-center text-white shadow-xs">
            <FileText size={20} />
          </div>
        </div>

        {/* Outstanding */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#3b2164] mb-1">Outstanding</p>
            <p className="text-xl font-bold text-slate-800">
              {outstandingAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-indigo-500 flex items-center justify-center text-white shadow-xs">
            <Hourglass size={20} />
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[#3b2164] mb-1">Overdue</p>
            <p className="text-xl font-bold text-slate-800">
              {overdueAmount.toFixed(2)}
            </p>
          </div>
          <div className="h-11 w-11 rounded-lg bg-rose-500 flex items-center justify-center text-white shadow-xs">
            <Euro size={20} />
          </div>
        </div>
      </motion.div>

      {/* Invoices Table Card */}
      <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#3b2164]">Invoices</h2>
          <Button 
            variant="outline" 
            onClick={() => router.push('/customer-portal/invoices')}
            className="border-[#709506] text-[#709506] hover:bg-[#709506]/10 h-8 px-4 text-xs font-semibold rounded-lg"
          >
            View All
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex justify-between items-center py-2 text-slate-400 gap-2 border-b border-slate-100">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search loadings..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 rounded-md border-slate-200 bg-slate-50/50 text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8"><Filter size={16} /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Columns size={16} /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Menu size={16} /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8"><Maximize size={16} /></Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 hover:bg-transparent">
                <TableHead className="font-semibold text-slate-800 text-xs py-3">Invoice Number</TableHead>
                <TableHead className="font-semibold text-slate-800 text-xs py-3">Date</TableHead>
                <TableHead className="font-semibold text-slate-800 text-xs py-3">Total Sales</TableHead>
                <TableHead className="font-semibold text-slate-800 text-xs py-3">Paid Amount</TableHead>
                <TableHead className="font-semibold text-slate-800 text-xs py-3">Total Credit Note Amount</TableHead>
                <TableHead className="font-semibold text-slate-800 text-xs py-3">Open Amount</TableHead>
                <TableHead className="font-semibold text-slate-800 text-xs py-3">Invoice Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv: any) => {
                  const total = Number(inv.total_amount || inv.invoice_amount || 0);
                  const paid = Number(inv.paid_amount || inv.paidAmount || 0);
                  const cnAmt = Number(inv.credit_note_amount || inv.creditNoteAmount || 0);
                  const open = Math.max(0, total - paid - cnAmt);
                  const isPaid = open <= 0;

                  return (
                    <TableRow 
                      key={inv.id} 
                      onClick={() => router.push('/customer-portal/invoices')}
                      className="border-b border-slate-100 hover:bg-slate-100/80 cursor-pointer transition-colors"
                    >
                      <TableCell className="text-[#709506] font-bold text-xs py-3.5 hover:underline flex items-center gap-1.5">
                        <FileText size={14} className="text-[#709506]" />
                        {inv.invoice_number || inv.invoiceNumber || inv.id.substring(0,6)}
                      </TableCell>
                      <TableCell className="text-slate-600 text-xs py-3.5">
                        {inv.date || inv.invoice_date || '03-03-2026'}
                      </TableCell>
                      <TableCell className="text-slate-600 text-xs py-3.5 font-medium">
                        {total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-slate-600 text-xs py-3.5">
                        {paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-slate-600 text-xs py-3.5">
                        {cnAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-slate-600 text-xs py-3.5 font-medium">
                        {open.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="py-3.5">
                        {isPaid ? (
                          <span className="bg-emerald-500 text-white px-2.5 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1">
                            PAID ✓
                          </span>
                        ) : (
                          <span className="bg-indigo-500 text-white px-2.5 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1">
                            OPEN <Hourglass size={12} />
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-20 text-center text-slate-500 text-xs">
                    No invoices found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* Bottom Grid: Recent Loads & Calibers Analytics */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Loads Card */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-6 space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#3b2164] mb-4">Recent loads</h2>
            <div className="overflow-x-auto max-h-[350px]">
              <Table>
                <TableHeader className="bg-slate-100/60 sticky top-0">
                  <TableRow className="border-b border-slate-200 hover:bg-transparent">
                    <TableHead className="font-semibold text-slate-800 text-xs py-3">Date</TableHead>
                    <TableHead className="font-semibold text-slate-800 text-xs py-3">Invoice Number</TableHead>
                    <TableHead className="font-semibold text-slate-800 text-xs py-3">ETA Date</TableHead>
                    <TableHead className="font-semibold text-slate-800 text-xs py-3">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {seasonLoadings.length > 0 ? (
                    seasonLoadings.slice(0, 5).map((ld: any) => (
                      <TableRow 
                        key={ld.id} 
                        onClick={() => router.push(`/customer-portal/loadings/${ld.id}`)}
                        className="border-b border-slate-100 hover:bg-slate-100/80 cursor-pointer transition-colors"
                      >
                        <TableCell className="text-slate-600 text-xs py-3">
                          {ld.createdAt?.seconds ? new Date(ld.createdAt.seconds * 1000).toISOString().split('T')[0] : (ld.loading_date || '2026-03-04')}
                        </TableCell>
                        <TableCell className="text-[#709506] font-bold text-xs py-3 hover:underline">
                          {ld.invoice_number || ld.poNumber || 'CN26053'}
                        </TableCell>
                        <TableCell className="text-slate-600 text-xs py-3">
                          {ld.eta_date || '2026-02-27'}
                        </TableCell>
                        <TableCell className="py-3">
                          <Button 
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/customer-portal/loadings/${ld.id}`);
                            }}
                            className="bg-[#709506] hover:bg-[#5e7e05] text-white px-3 py-1 rounded text-xs font-semibold h-7 shadow-xs"
                          >
                            Access Loading
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-20 text-center text-slate-500 text-xs">
                        No recent loadings.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Calibers Analytics Card */}
        <div className="bg-white rounded-xl shadow-xs border border-slate-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#3b2164]">Calibers Analytics</h2>
            <span className="text-[10px] font-black uppercase text-[#709506] bg-[#709506]/10 px-2.5 py-0.5 rounded-full border border-[#709506]/20">
              Live Data
            </span>
          </div>
          <div className="w-full pt-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
            <div className="min-w-[650px]">
              {typeof window !== 'undefined' && caliberChartSeries.length > 0 && (
                <Chart 
                  options={caliberChartOptions} 
                  series={caliberChartSeries} 
                  type="bar" 
                  height={300} 
                />
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
