'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useSeason } from '@/contexts/SeasonContext';
import { useToast } from '@/hooks/use-toast';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { canList } from '@/lib/permissions';
import { useAuthContext } from '@/components/auth-provider';

// Components
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { KpiCard, DualKpiCard, SingleSummaryCard } from '@/components/dashboard/kpi-card';
import { ModernTableCard } from '@/components/dashboard/modern-table-card';
import { CustomersInvoicesChart } from '@/components/dashboard/charts/customers-invoices-chart';
import { TopSaleDonutChart } from '@/components/dashboard/charts/top-sale-donut-chart';
import { CalibersAnalyticsChart } from '@/components/dashboard/charts/calibers-analytics-chart';
import { WeeklyAveragePriceChart } from '@/components/dashboard/charts/weekly-average-price-chart';

// Icons
import { Scale, Truck, CircleDollarSign, CreditCard, Banknote, Package, TrendingUp, Users, ShieldAlert, BarChart3, ReceiptPercent, Database, AlignLeft, Euro, FileText, ShoppingBag, Hash } from 'lucide-react';

const money = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
const weight = (val: number) => val.toLocaleString() + ' KG';

export default function OverviewPage() {
  const router = useRouter();
  const { currentSeason } = useSeason();
  const { profile } = useAuthContext();
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState<string>('season-2025-2026');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const { activeStartDate, activeEndDate } = useMemo(() => {
    if (dateRange === 'custom') {
      return { activeStartDate: customStartDate, activeEndDate: customEndDate };
    }
    const now = new Date();
    let start = '';
    let end = '';
    switch (dateRange) {
      case 'this-week':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now.setDate(diff));
        start = monday.toISOString().split('T')[0];
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        end = sunday.toISOString().split('T')[0];
        break;
      case 'this-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case 'this-year':
        start = `${now.getFullYear()}-01-01`;
        end = `${now.getFullYear()}-12-31`;
        break;
      case 'last-year':
        start = `${now.getFullYear() - 1}-01-01`;
        end = `${now.getFullYear() - 1}-12-31`;
        break;
      case 'season-2025-2026':
        start = '2025-10-01';
        end = '2026-09-30';
        break;
      case 'all-time':
      default:
        start = '';
        end = '';
        break;
    }
    return { activeStartDate: start, activeEndDate: end };
  }, [dateRange, customStartDate, customEndDate]);

  const {
    loading,
    error,
    overview,
    invoiceStats,
    saleAnalytics,
    receptions,
    finalProduct,
    decay,
    customerInvoices,
    topSaleStatistics,
    customerBalances,
    calibersAnalytics,
    weeklyAveragePrice,
    topSuppliersOpenAmount,
    topDecayCustomersOpenAmount,
  } = useDashboardData(currentSeason?.id, activeStartDate, activeEndDate);

  const handleExportPDF = () => {
    window.print();
    toast({
      title: "Export Success",
      description: "Successfully prepared dashboard layout for PDF printing.",
    });
  };

  if (!canList(profile, 'dashboard')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-rose-500 font-bold gap-3">
        <div className="p-4 bg-rose-50 rounded-2xl">
          <ShieldAlert size={48} className="text-rose-500 animate-bounce" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black uppercase tracking-wider">Unauthorized Access</h2>
          <p className="text-xs text-muted-foreground mt-1">You do not have permission to view the main enterprise dashboard.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-8 text-rose-500 font-bold gap-3">
        <div className="p-4 bg-rose-50 rounded-2xl">
          <ShieldAlert size={48} className="text-rose-500 animate-pulse" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black uppercase tracking-wider">Error Loading Dashboard</h2>
          <p className="text-xs text-muted-foreground mt-1">Failed to fetch dynamic dashboard aggregations. Please check database logs.</p>
        </div>
      </div>
    );
  }

  const balancesColumns = [
    { header: 'Customer', accessorKey: 'name', render: (r: any) => <span className="font-bold text-[#2e1d52]">{r.name}</span> },
    { header: 'Total Sale', accessorKey: 'totalSale', align: 'right' as const, render: (r: any) => money(r.totalSale) },
    { header: 'Paid Amount', accessorKey: 'paid', align: 'right' as const, render: (r: any) => <span className="text-emerald-600 font-bold">{money(r.paid)}</span> },
    { header: 'Credit Note', accessorKey: 'creditNote', align: 'right' as const, render: (r: any) => <span className="text-slate-500">{money(r.creditNote)}</span> },
    { header: 'Open Amount', accessorKey: 'open', align: 'right' as const, render: (r: any) => <span className={r.open > 0 ? "text-rose-500 font-bold" : "text-slate-400 font-bold"}>{money(r.open)}</span> },
  ];

  const suppliersColumns = [
    { header: 'Supplier', accessorKey: 'name', render: (r: any) => <span className="font-bold text-[#2e1d52]">{r.name}</span> },
    { header: 'Total Amount', accessorKey: 'totalAmount', align: 'right' as const, render: (r: any) => money(r.totalAmount) },
    { header: 'Paid Amount', accessorKey: 'paidAmount', align: 'right' as const, render: (r: any) => <span className="text-emerald-600 font-bold">{money(r.paidAmount)}</span> },
    { header: 'Open Amount', accessorKey: 'openAmount', align: 'right' as const, render: (r: any) => <span className="text-rose-500 font-bold">{money(r.openAmount)}</span> },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-tr from-[#f8faf5] via-[#ffffff] to-[#f5f8f2] w-full text-foreground relative overflow-x-hidden font-body print-container pb-12">
      <style jsx global>{`
        @media print {
          body, html { background: #ffffff !important; color: #000000 !important; }
          nav, header, button, .no-print, .dropdown-portal, [role="menu"] { display: none !important; }
          .print-container { padding: 0 !important; margin: 0 !important; background: white !important; width: 100% !important; max-width: 100% !important; }
          .print-card { border: 1px solid #e5e7eb !important; box-shadow: none !important; break-inside: avoid !important; }
        }
      `}</style>

      <DashboardHeader 
        dateRange={dateRange}
        onRangeSelect={setDateRange}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        onExportPDF={handleExportPDF}
      />

      <div className="px-6 md:px-10 py-8 max-w-[1600px] mx-auto w-full space-y-10">
        
        {/* Top Row: 3 Two-in-One Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Overview */}
          <DualKpiCard 
            cardTitle="Overview" 
            cardIcon={Database}
            leftStat={{
              label: "Total Net Weight",
              value: overview.netWeight,
              formatter: weight,
              icon: Scale,
              iconBgClass: "bg-indigo-600",
            }}
            rightStat={{
              label: "Number Of Loads",
              value: overview.numberOfLoads,
              formatter: (val) => val.toFixed(2),
              icon: FileText,
              iconBgClass: "bg-[#7a9800]",
            }}
            loading={loading}
          />

          {/* Card 2: Invoice Statistics */}
          <DualKpiCard 
            cardTitle="Invoice Statistics" 
            cardIcon={AlignLeft}
            leftStat={{
              label: "Total Sales",
              value: invoiceStats.totalSales,
              formatter: money,
              icon: Euro,
              iconBgClass: "bg-rose-500",
            }}
            rightStat={{
              label: "Total Credit Note",
              value: invoiceStats.totalCreditNote,
              formatter: money,
              icon: Euro,
              iconBgClass: "bg-indigo-600",
            }}
            loading={loading}
          />

          {/* Card 3: Sale Analytics */}
          <DualKpiCard 
            cardTitle="Sale Analytics" 
            cardIcon={AlignLeft}
            leftStat={{
              label: "Total Received",
              value: saleAnalytics.totalReceived,
              formatter: (val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              icon: FileText,
              iconBgClass: "bg-[#7a9800]",
            }}
            rightStat={{
              label: "Total Pending",
              value: saleAnalytics.totalPending,
              formatter: (val) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              icon: FileText,
              iconBgClass: "bg-rose-500",
            }}
            loading={loading}
          />
        </div>

        {/* Bottom Row: 3 Single Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 4: Total Receptions */}
          <SingleSummaryCard 
            cardTitle="Total Receptions"
            cardIcon={Database}
            statIcon={ShoppingBag}
            statIconBgClass="bg-rose-500"
            value={receptions}
            formatter={weight}
            actionHref="/production/raw-materials"
            actionText="View Receptions"
            loading={loading}
          />

          {/* Card 5: Total Final Product */}
          <SingleSummaryCard 
            cardTitle="Total Final Product"
            cardIcon={Database}
            statIcon={Hash}
            statIconBgClass="bg-indigo-600"
            value={finalProduct}
            formatter={weight}
            actionHref="/production/output"
            actionText="View Finished Products"
            loading={loading}
          />

          {/* Card 6: Total Decay */}
          <SingleSummaryCard 
            cardTitle="Total Decay"
            cardIcon={Database}
            statIcon={Database}
            statIconBgClass="bg-[#7a9800]"
            value={decay}
            formatter={weight}
            actionHref="/decay/stock-follow-up"
            actionText="View Decay Products"
            loading={loading}
          />
        </div>

        {/* Charts Grid */}
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 border-l-4 border-[#7a9800] pl-3">
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-[#2e1d52]">Analytics Charts</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CustomersInvoicesChart data={customerInvoices} loading={loading} />
            <TopSaleDonutChart data={topSaleStatistics} loading={loading} />
            <CalibersAnalyticsChart data={calibersAnalytics} loading={loading} />
            <WeeklyAveragePriceChart data={weeklyAveragePrice} loading={loading} />
          </div>
        </div>

        {/* Tables Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 border-l-4 border-[#7a9800] pl-3">
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-[#2e1d52]">Detailed Balances & Standings</h2>
          </div>
          
          <ModernTableCard 
            title="Customer Balances" 
            icon={Users} 
            columns={balancesColumns} 
            data={customerBalances.slice(0, 10)} 
            loading={loading} 
            emptyMessage="No customer balances found for this period."
            viewAllHref="/finance/customer-balances"
          />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ModernTableCard 
              title="Top 10 Suppliers By Open Amount" 
              icon={CircleDollarSign} 
              columns={suppliersColumns} 
              data={topSuppliersOpenAmount} 
              loading={loading} 
              emptyMessage="No suppliers with open amounts."
              viewAllHref="/supply-chain/suppliers-situation"
            />
            <ModernTableCard 
              title="Top 10 Decay Customer by Open Amount" 
              icon={TrendingUp} 
              columns={suppliersColumns} 
              data={topDecayCustomersOpenAmount} 
              loading={loading} 
              emptyMessage="No decay customers with open amounts."
              viewAllHref="/decay"
            />
          </div>
        </div>
      </div>
    </div>
  );
}