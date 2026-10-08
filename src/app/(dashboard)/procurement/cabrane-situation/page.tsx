'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy 
} from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { 
  Filter, 
  Search, 
  X, 
  DollarSign, 
  MoreVertical, 
  Download,
  Calendar,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Loader2,
  Truck,
  CreditCard,
  FileText,
  Building
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

export default function CabraneSituationPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // --- Core Data States ---
  const [cabranes, setCabranes] = useState<any[]>([]);
  const [rawMaterials, setRawMaterials] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [cabranePayments, setCabranePayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Filtering States (applied on Filter click) ---
  const [tempCabrane, setTempCabrane] = useState('all');
  const [tempDateStart, setTempDateStart] = useState('');
  const [tempDateEnd, setTempDateEnd] = useState('');

  const [appliedCabrane, setAppliedCabrane] = useState('all');
  const [appliedDateStart, setAppliedDateStart] = useState('');
  const [appliedDateEnd, setAppliedDateEnd] = useState('');

  // --- Active Tab State ---
  const [activeTab, setActiveTab] = useState<'tab1' | 'tab2'>('tab1');

  // --- Table Configuration States ---
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Pagination states
  const [tab1Page, setTab1Page] = useState(1);
  const [tab2Page, setTab2Page] = useState(1);
  const itemsPerPage = 8;

  // Search terms
  const [tab1Search, setTab1Search] = useState('');
  const [tab2Search, setTab2Search] = useState('');

  // Sorting states
  const [tab1SortField, setTab1SortField] = useState<string>('name');
  const [tab1SortDirection, setTab1SortDirection] = useState<'asc' | 'desc'>('asc');

  const [tab2SortField, setTab2SortField] = useState<string>('shiftDate');
  const [tab2SortDirection, setTab2SortDirection] = useState<'asc' | 'desc'>('desc');

  // Column Visibility States
  const [tab1Columns, setTab1Columns] = useState<Record<string, boolean>>({
    name: true,
    receptionsCount: true,
    totalAmount: true,
    paidAmount: true,
    openAmount: true,
  });

  const [tab2Columns, setTab2Columns] = useState<Record<string, boolean>>({
    cabraneName: true,
    lotNumber: true,
    shiftDate: true,
    workersCost: true,
    origin: true,
    supplierName: true,
  });

  // --- Fetch Data ---
  const fetchData = async () => {
    if (!db) return;
    try {
      setLoading(true);
      const [matSnap, supSnap, cabSnap, paySnap] = await Promise.all([
        getDocs(query(collection(db, 'raw_materials'), orderBy('dateTime', 'desc'))),
        getDocs(query(collection(db, 'procurement_suppliers'), orderBy('name'))),
        getDocs(query(collection(db, 'cabranes'), orderBy('name'))),
        getDocs(query(collection(db, 'cabrane_payments')))
      ]);

      setRawMaterials(matSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSuppliers(supSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCabranes(cabSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setCabranePayments(paySnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error fetching cabrane situation data:", err);
      toast({
        title: "Error",
        description: "Failed to load database collections.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [db]);

  // --- Helper to Format Currency ---
  const formatCurrency = (val: number) => {
    const formattedVal = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
    return `${formattedVal} DH`;
  };

  // --- Filter Actions ---
  const handleFilter = () => {
    setAppliedCabrane(tempCabrane);
    setAppliedDateStart(tempDateStart);
    setAppliedDateEnd(tempDateEnd);
    setTab1Page(1);
    setTab2Page(1);
    toast({
      title: "Filters Applied",
      description: "Statistics and tables have been refreshed.",
    });
  };

  const handleReset = () => {
    setTempCabrane('all');
    setTempDateStart('');
    setTempDateEnd('');
    setAppliedCabrane('all');
    setAppliedDateStart('');
    setAppliedDateEnd('');
    setTab1Page(1);
    setTab2Page(1);
    toast({
      title: "Filters Reset",
      description: "Showing all records.",
    });
  };

  const summaryKpis = useMemo(() => {
    let totalTransportCost = 0;
    let totalPayment = 0;
    let openAmount = 0;

    const matchingRM = rawMaterials.filter(rm => {
      if (appliedCabrane !== 'all' && rm.cabraneId !== appliedCabrane) return false;
      if (appliedDateStart || appliedDateEnd) {
        const itemDate = rm.date || (rm.dateTime ? rm.dateTime.substring(0, 10) : '');
        if (appliedDateStart && itemDate < appliedDateStart) return false;
        if (appliedDateEnd && itemDate > appliedDateEnd) return false;
      }
      return true;
    });

    const matchingPay = cabranePayments.filter(pay => {
      if (appliedCabrane !== 'all' && pay.cabraneId !== appliedCabrane) return false;
      if (appliedDateStart || appliedDateEnd) {
        const itemDate = pay.date;
        if (appliedDateStart && itemDate < appliedDateStart) return false;
        if (appliedDateEnd && itemDate > appliedDateEnd) return false;
      }
      return true;
    });

    matchingRM.forEach(rm => {
      totalTransportCost += Number(rm.workersCost || rm.workerCost || 0);
    });

    matchingPay.forEach(pay => {
      const amt = Number(pay.amount || 0);
      if (pay.operationType === 'Solde') {
        totalTransportCost += amt;
      } else if (pay.operationType === 'Avance' || pay.operationType === 'Payment') {
        totalPayment += amt;
      }
    });

    openAmount = totalTransportCost - totalPayment;

    return {
      totalTransportCost,
      totalPayment,
      openAmount
    };
  }, [rawMaterials, cabranePayments, appliedCabrane, appliedDateStart, appliedDateEnd]);

  // --- Tab 1 Computations (Grouped by Cabrane) ---
  const cabraneAggregates = useMemo(() => {
    return cabranes.map(cab => {
      const matchingRM = rawMaterials.filter(rm => {
        if (rm.cabraneId !== cab.id) return false;
        if (appliedDateStart || appliedDateEnd) {
          const itemDate = rm.date || (rm.dateTime ? rm.dateTime.substring(0, 10) : '');
          if (appliedDateStart && itemDate < appliedDateStart) return false;
          if (appliedDateEnd && itemDate > appliedDateEnd) return false;
        }
        return true;
      });

      const matchingPay = cabranePayments.filter(pay => {
        if (pay.cabraneId !== cab.id) return false;
        if (appliedDateStart || appliedDateEnd) {
          const itemDate = pay.date;
          if (appliedDateStart && itemDate < appliedDateStart) return false;
          if (appliedDateEnd && itemDate > appliedDateEnd) return false;
        }
        return true;
      });

      let receptionsCount = matchingRM.length;
      let totalAmount = 0;
      let paidAmount = 0;

      matchingRM.forEach(rm => {
        totalAmount += Number(rm.workersCost || rm.workerCost || 0);
      });

      matchingPay.forEach(pay => {
        const amt = Number(pay.amount || 0);
        if (pay.operationType === 'Solde') {
          totalAmount += amt;
        } else if (pay.operationType === 'Avance' || pay.operationType === 'Payment') {
          paidAmount += amt;
        }
      });

      const openAmount = totalAmount - paidAmount;

      return {
        id: cab.id,
        name: cab.name,
        receptionsCount,
        totalAmount,
        paidAmount,
        openAmount
      };
    });
  }, [cabranes, rawMaterials, cabranePayments, appliedDateStart, appliedDateEnd]);

  const filteredTab1List = useMemo(() => {
    let list = cabraneAggregates;

    if (appliedCabrane !== 'all') {
      list = list.filter(item => item.id === appliedCabrane);
    }

    if (tab1Search.trim()) {
      const term = tab1Search.toLowerCase();
      list = list.filter(item => item.name.toLowerCase().includes(term));
    }

    // Sorting
    if (tab1SortField) {
      list = [...list].sort((a: any, b: any) => {
        const valA = a[tab1SortField];
        const valB = b[tab1SortField];
        if (typeof valA === 'string' && typeof valB === 'string') {
          return tab1SortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          return tab1SortDirection === 'asc' ? (valA - valB) : (valB - valA);
        }
      });
    }

    return list;
  }, [cabraneAggregates, appliedCabrane, tab1Search, tab1SortField, tab1SortDirection]);

  // Tab 1 Pagination
  const paginatedTab1List = useMemo(() => {
    const startIndex = (tab1Page - 1) * itemsPerPage;
    return filteredTab1List.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTab1List, tab1Page]);

  const totalTab1Pages = Math.ceil(filteredTab1List.length / itemsPerPage) || 1;

  // --- Tab 2 Computations (Raw Material Cabrane details) ---
  const rawMaterialCabraneList = useMemo(() => {
    return rawMaterials.map(rm => {
      const cab = cabranes.find(c => c.id === rm.cabraneId);
      const sup = suppliers.find(s => s.id === rm.supplierId);
      
      return {
        id: rm.id,
        cabraneId: rm.cabraneId || '',
        cabraneName: cab ? cab.name : '—',
        lotNumber: rm.lotNumber || '—',
        shiftDate: rm.date || (rm.dateTime ? rm.dateTime.substring(0, 10) : '—'),
        workersCost: Number(rm.workersCost || rm.workerCost || 0),
        origin: rm.origin || '—',
        supplierName: sup ? (sup.name || sup.supplierName) : rm.supplierId || '—'
      };
    });
  }, [rawMaterials, cabranes, suppliers]);

  const filteredTab2List = useMemo(() => {
    let list = rawMaterialCabraneList;

    if (appliedCabrane !== 'all') {
      list = list.filter(item => item.cabraneId === appliedCabrane);
    }

    if (appliedDateStart || appliedDateEnd) {
      list = list.filter(item => {
        const itemDate = item.shiftDate;
        if (appliedDateStart && itemDate < appliedDateStart) return false;
        if (appliedDateEnd && itemDate > appliedDateEnd) return false;
        return true;
      });
    }

    if (tab2Search.trim()) {
      const term = tab2Search.toLowerCase();
      list = list.filter(item => 
        item.cabraneName.toLowerCase().includes(term) ||
        item.lotNumber.toLowerCase().includes(term) ||
        item.origin.toLowerCase().includes(term) ||
        item.supplierName.toLowerCase().includes(term)
      );
    }

    // Sorting
    if (tab2SortField) {
      list = [...list].sort((a: any, b: any) => {
        const valA = a[tab2SortField];
        const valB = b[tab2SortField];
        if (typeof valA === 'string' && typeof valB === 'string') {
          return tab2SortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          return tab2SortDirection === 'asc' ? (valA - valB) : (valB - valA);
        }
      });
    }

    return list;
  }, [rawMaterialCabraneList, appliedCabrane, appliedDateStart, appliedDateEnd, tab2Search, tab2SortField, tab2SortDirection]);

  // Tab 2 Pagination
  const paginatedTab2List = useMemo(() => {
    const startIndex = (tab2Page - 1) * itemsPerPage;
    return filteredTab2List.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTab2List, tab2Page]);

  const totalTab2Pages = Math.ceil(filteredTab2List.length / itemsPerPage) || 1;

  // Reset pagination on search
  useEffect(() => {
    setTab1Page(1);
  }, [tab1Search]);

  useEffect(() => {
    setTab2Page(1);
  }, [tab2Search]);

  // --- Dynamic Table Padding Classes ---
  const densityPaddingClass = {
    compact: 'py-2 px-4 h-12 text-xs',
    normal: 'py-4 px-6 h-16 text-xs',
    tall: 'py-6 px-8 h-20 text-sm'
  }[density];

  // --- Header Sorting Helpers ---
  const handleSortTab1 = (field: string) => {
    if (tab1SortField === field) {
      setTab1SortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTab1SortField(field);
      setTab1SortDirection('desc');
    }
    setTab1Page(1);
  };

  const handleSortTab2 = (field: string) => {
    if (tab2SortField === field) {
      setTab2SortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setTab2SortField(field);
      setTab2SortDirection('desc');
    }
    setTab2Page(1);
  };

  const renderTab1SortHeader = (label: string, field: string) => {
    const isActive = tab1SortField === field;
    return (
      <TableHead 
        className={cn(
          "py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap cursor-pointer select-none transition-colors hover:text-primary",
          isActive && "text-[#7a9800] font-black"
        )}
        onClick={() => handleSortTab1(field)}
      >
        <div className="flex items-center gap-1.5 justify-start">
          {label}
          <ArrowUpDown className={cn(
            "h-3 w-3 transition-opacity", 
            isActive ? "opacity-100 text-[#7a9800]" : "opacity-35"
          )} />
        </div>
      </TableHead>
    );
  };

  const renderTab2SortHeader = (label: string, field: string) => {
    const isActive = tab2SortField === field;
    return (
      <TableHead 
        className={cn(
          "py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap cursor-pointer select-none transition-colors hover:text-primary",
          isActive && "text-[#7a9800] font-black"
        )}
        onClick={() => handleSortTab2(field)}
      >
        <div className="flex items-center gap-1.5 justify-start">
          {label}
          <ArrowUpDown className={cn(
            "h-3 w-3 transition-opacity", 
            isActive ? "opacity-100 text-[#7a9800]" : "opacity-35"
          )} />
        </div>
      </TableHead>
    );
  };

  // --- PDF Export (Print friendly Layout) ---
  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd HH:mm');
    const tabName = activeTab === 'tab1' ? 'Cabrane Situation - Grouped by Cabrane' : 'Cabrane Situation - Raw Material Detailed View';
    const activeData = activeTab === 'tab1' ? filteredTab1List : filteredTab2List;

    let tableRowsHtml = '';
    if (activeTab === 'tab1') {
      tableRowsHtml = activeData.map((row: any) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #2e1d52;">${row.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center; font-weight: bold;">${row.receptionsCount}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(row.totalAmount)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #7a9800; font-weight: bold;">${formatCurrency(row.paidAmount)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #e11d48; font-weight: bold;">${formatCurrency(row.openAmount)}</td>
        </tr>
      `).join('');
    } else {
      tableRowsHtml = activeData.map((row: any) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #2e1d52;">${row.cabraneName}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; color: #7a9800; font-weight: bold;">${row.lotNumber}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${row.shiftDate}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${formatCurrency(row.workersCost)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${row.origin}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: 500;">${row.supplierName}</td>
        </tr>
      `).join('');
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${tabName}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #334155; margin: 40px; }
            h1 { color: #2e1d52; margin-bottom: 5px; text-transform: uppercase; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; }
            .meta { font-size: 10px; color: #64748b; margin-bottom: 30px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.15em; }
            .kpis { display: flex; gap: 20px; margin-bottom: 35px; }
            .kpi { flex: 1; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; background: #f8fafc; }
            .kpi-title { font-size: 9px; text-transform: uppercase; color: #94a3b8; font-weight: 900; letter-spacing: 0.12em; margin-bottom: 6px; }
            .kpi-value { font-size: 20px; font-weight: 900; color: #2e1d52; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th { background: #f1f5f9; text-transform: uppercase; font-size: 9px; font-weight: 900; letter-spacing: 0.12em; padding: 14px 10px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; }
            tr:hover { background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>${tabName}</h1>
          <div class="meta">Exported: ${todayStr} • Filter: Cabrane: ${appliedCabrane !== 'all' ? cabranes.find(c => c.id === appliedCabrane)?.name || 'Selected' : 'All'}</div>
          
          <div class="kpis">
            <div class="kpi">
              <div class="kpi-title">Total Transport Cost</div>
              <div class="kpi-value">${formatCurrency(summaryKpis.totalTransportCost)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Total Payment</div>
              <div class="kpi-value" style="color: #7a9800;">${formatCurrency(summaryKpis.totalPayment)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-title">Open Amount</div>
              <div class="kpi-value" style="color: #e11d48;">${formatCurrency(summaryKpis.openAmount)}</div>
            </div>
          </div>

          <table>
            <thead>
              ${activeTab === 'tab1' ? `
                <tr>
                  <th>Cabrane</th>
                  <th style="text-align: center;">No of Reception</th>
                  <th style="text-align: right;">Total Amount</th>
                  <th style="text-align: right;">Paid Amount</th>
                  <th style="text-align: right;">Open Amount</th>
                </tr>
              ` : `
                <tr>
                  <th>Cabrane</th>
                  <th>Lot Number</th>
                  <th>Shift Date</th>
                  <th style="text-align: right;">Worker Cost</th>
                  <th>Origin</th>
                  <th>Supplier</th>
                </tr>
              `}
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>

          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // --- Excel Export ---
  const handleExportExcel = () => {
    let sheetData: any[] = [];
    
    if (activeTab === 'tab1') {
      sheetData = filteredTab1List.map(row => ({
        'Cabrane': row.name,
        'No of Reception': row.receptionsCount,
        'Total Amount (DH)': row.totalAmount,
        'Paid Amount (DH)': row.paidAmount,
        'Open Amount (DH)': row.openAmount
      }));
    } else {
      sheetData = filteredTab2List.map(row => ({
        'Cabrane': row.cabraneName,
        'Lot Number': row.lotNumber,
        'Shift Date': row.shiftDate,
        'Worker Cost (DH)': row.workersCost,
        'Origin': row.origin,
        'Supplier': row.supplierName
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab === 'tab1' ? 'Cabrane Overview' : 'Detailed Lots');
    
    // Auto-adjust column width
    const maxKeys = Object.keys(sheetData[0] || {});
    worksheet['!cols'] = maxKeys.map(key => ({
      wch: Math.max(key.length + 5, 15)
    }));

    XLSX.writeFile(workbook, `Cabrane_Situation_${activeTab === 'tab1' ? 'Overview' : 'Detailed'}_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`);
    
    toast({
      title: "Export Successful",
      description: "Excel file downloaded successfully.",
    });
  };

  // Quick helper to filter detailed view when Cabrane link is clicked
  const handleCabraneClick = (cabId: string) => {
    router.push(`/procurement/cabrane-situation/${cabId}`);
  };

  return (
    <div className={cn(
      "w-full bg-[#f3f3f3] min-h-screen transition-all duration-300",
      isFullscreen ? "fixed inset-0 z-50 p-6 overflow-y-auto bg-[#f3f3f3]" : "p-6 lg:p-8"
    )}>
      
      {/* 1. Header & Breadcrumbs & Export Buttons */}
      <div className="max-w-[1600px] mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            <span className="hover:text-slate-600 cursor-pointer" onClick={() => router.push('/procurement/cabranes')}>Profile</span>
            <span className="opacity-40">/</span>
            <span className="text-[#7a9800] font-black uppercase">Cabrane Situation Listing</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">
            Cabrane Situation
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={handleExportPDF}
            className="h-12 w-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            title="Export to PDF"
          >
            <FileText size={20} className="stroke-[2.5]" />
          </Button>
          <Button 
            onClick={handleExportExcel}
            className="h-12 w-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
            title="Export to Excel"
          >
            <Download size={20} className="stroke-[2.5]" />
          </Button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 mb-8 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row items-stretch md:items-end justify-between gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 flex-1">
            
            {/* Select Cabrane */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cabrane-filter" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                Select Cabrane
              </Label>
              <Select value={tempCabrane} onValueChange={setTempCabrane}>
                <SelectTrigger id="cabrane-filter" className="h-10 rounded-xl border-slate-200 bg-[#F5F7FA] font-bold text-slate-700 text-xs focus:ring-[#7a9800] transition-all">
                  <SelectValue placeholder="All Cabranes" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl border-slate-100 shadow-xl max-h-60 overflow-y-auto">
                  <SelectItem value="all" className="font-bold text-xs cursor-pointer rounded-lg">All Cabranes</SelectItem>
                  {cabranes.map(c => (
                    <SelectItem key={c.id} value={c.id} className="font-bold text-xs cursor-pointer rounded-lg">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start-date" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                Start Date
              </Label>
              <div className="relative">
                <Input
                  id="start-date"
                  type="date"
                  className="h-10 rounded-xl border-slate-200 bg-[#F5F7FA] font-bold text-slate-700 text-xs focus-visible:ring-[#7a9800] transition-all pl-10"
                  value={tempDateStart}
                  onChange={e => setTempDateStart(e.target.value)}
                />
                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* End Date */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end-date" className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                End Date
              </Label>
              <div className="relative">
                <Input
                  id="end-date"
                  type="date"
                  className="h-10 rounded-xl border-slate-200 bg-[#F5F7FA] font-bold text-slate-700 text-xs focus-visible:ring-[#7a9800] transition-all pl-10"
                  value={tempDateEnd}
                  onChange={e => setTempDateEnd(e.target.value)}
                />
                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 sm:w-auto w-full">
            <Button 
              onClick={handleFilter}
              className="h-10 px-6 bg-[#7a9800] hover:bg-[#6c8500] text-white font-bold text-xs rounded-xl shadow-md shadow-[#7a9800]/25 transition-all hover:scale-105 active:scale-95 flex-1 md:flex-initial"
            >
              <Filter size={14} className="mr-2" /> Filter
            </Button>
            <Button 
              variant="outline"
              onClick={handleReset}
              className="h-10 px-6 border-slate-200 bg-white font-bold text-slate-500 text-xs rounded-xl shadow-sm hover:bg-slate-50 hover:text-slate-700 transition-all flex-1 md:flex-initial"
            >
              Reset
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Summary Statistics Cards */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Total Transport Cost Card */}
        <Card className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 p-6 flex items-center justify-between transition-all hover:scale-[1.02] duration-300">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Transport Cost</span>
            <span className="text-2xl md:text-3xl font-black text-[#2e1d52]">
              {loading ? '—' : formatCurrency(summaryKpis.totalTransportCost)}
            </span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-[#7a9800]/10 flex items-center justify-center text-[#7a9800]">
            <Truck size={22} className="stroke-[2.5]" />
          </div>
        </Card>

        {/* Total Payment Card */}
        <Card className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 p-6 flex items-center justify-between transition-all hover:scale-[1.02] duration-300">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Payment</span>
            <span className="text-2xl md:text-3xl font-black text-[#7a9800]">
              {loading ? '—' : formatCurrency(summaryKpis.totalPayment)}
            </span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-[#7a9800]/10 flex items-center justify-center text-[#7a9800]">
            <DollarSign size={22} className="stroke-[2.5]" />
          </div>
        </Card>

        {/* Open Amount Card */}
        <Card className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/50 p-6 flex items-center justify-between transition-all hover:scale-[1.02] duration-300">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Open Amount</span>
            <span className="text-2xl md:text-3xl font-black text-rose-600">
              {loading ? '—' : formatCurrency(summaryKpis.openAmount)}
            </span>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600">
            <CreditCard size={22} className="stroke-[2.5]" />
          </div>
        </Card>

      </div>

      {/* 4. Tab Selector */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/50 rounded-2xl self-start w-full md:w-auto shadow-inner mb-6 max-w-[1600px] mx-auto border border-slate-200">
        <button
          onClick={() => setActiveTab('tab1')}
          className={cn(
            "flex-1 md:flex-initial py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 select-none",
            activeTab === 'tab1' 
              ? "bg-white text-[#2e1d52] shadow-md shadow-[#2e1d52]/5 scale-[1.02] font-black" 
              : "text-slate-400 hover:text-slate-700 bg-transparent"
          )}
        >
          Group By Cabrane
        </button>
        <button
          onClick={() => setActiveTab('tab2')}
          className={cn(
            "flex-1 md:flex-initial py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-200 select-none",
            activeTab === 'tab2' 
              ? "bg-white text-[#2e1d52] shadow-md shadow-[#2e1d52]/5 scale-[1.02] font-black" 
              : "text-slate-400 hover:text-slate-700 bg-transparent"
          )}
        >
          Raw Material Cabrane
        </button>
      </div>

      {/* 5. Main Card with High-Density Grid */}
      <div className="max-w-[1600px] mx-auto">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden flex flex-col">
          
          {/* Table Control Bar */}
          <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              {activeTab === 'tab1' ? (
                <Input
                  type="text"
                  placeholder="Search by cabrane name..."
                  className="h-10 pl-10 pr-4 rounded-xl border-slate-200 bg-white focus-visible:ring-[#7a9800] font-semibold placeholder-slate-400 text-slate-700 text-xs w-full shadow-sm"
                  value={tab1Search}
                  onChange={e => setTab1Search(e.target.value)}
                />
              ) : (
                <Input
                  type="text"
                  placeholder="Search by cabrane, lot, origin, supplier..."
                  className="h-10 pl-10 pr-4 rounded-xl border-slate-200 bg-white focus-visible:ring-[#7a9800] font-semibold placeholder-slate-400 text-slate-700 text-xs w-full shadow-sm"
                  value={tab2Search}
                  onChange={e => setTab2Search(e.target.value)}
                />
              )}
              {((activeTab === 'tab1' && tab1Search) || (activeTab === 'tab2' && tab2Search)) && (
                <button 
                  onClick={() => activeTab === 'tab1' ? setTab1Search('') : setTab2Search('')} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Actions Panel */}
            <div className="flex items-center gap-3 self-end md:self-auto">
              
              {/* Density Toggle */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 bg-white gap-2 font-bold text-slate-600 shadow-sm text-xs">
                    <SlidersHorizontal size={14} /> Density: <span className="capitalize text-[#7a9800]">{density}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl p-1 bg-white">
                  <DropdownMenuItem onClick={() => setDensity('compact')} className="font-bold py-2 px-3 text-xs rounded-lg cursor-pointer">Compact</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDensity('normal')} className="font-bold py-2 px-3 text-xs rounded-lg cursor-pointer">Normal</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDensity('tall')} className="font-bold py-2 px-3 text-xs rounded-lg cursor-pointer">Tall</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Column Selection Toggle */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 bg-white gap-2 font-bold text-slate-600 shadow-sm text-xs">
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl p-2 bg-white w-48">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider px-2 py-1 mb-1">Toggle Columns</p>
                  <DropdownMenuSeparator className="bg-slate-100 my-1" />
                  
                  {activeTab === 'tab1' ? (
                    Object.keys(tab1Columns).map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col}
                        checked={tab1Columns[col]}
                        onCheckedChange={(checked) => setTab1Columns(prev => ({ ...prev, [col]: checked }))}
                        className="font-bold text-xs rounded-lg py-2 cursor-pointer capitalize"
                      >
                        {col.replace(/([A-Z])/g, ' $1')}
                      </DropdownMenuCheckboxItem>
                    ))
                  ) : (
                    Object.keys(tab2Columns).map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col}
                        checked={tab2Columns[col]}
                        onCheckedChange={(checked) => setTab2Columns(prev => ({ ...prev, [col]: checked }))}
                        className="font-bold text-xs rounded-lg py-2 cursor-pointer capitalize"
                      >
                        {col.replace(/([A-Z])/g, ' $1')}
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Fullscreen Toggle */}
              <Button 
                variant="outline" 
                size="icon" 
                className="h-10 w-10 rounded-xl border-slate-200 bg-white shadow-sm"
                onClick={() => setIsFullscreen(prev => !prev)}
              >
                {isFullscreen ? <Minimize2 size={16} className="text-slate-600" /> : <Maximize2 size={16} className="text-slate-600" />}
              </Button>

            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth">
            {activeTab === 'tab1' ? (
              // TAB 1 TABLE
              <Table className="w-full min-w-[1000px] border-collapse">
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent">
                    {tab1Columns.name && renderTab1SortHeader('Cabrane Name', 'name')}
                    {tab1Columns.receptionsCount && renderTab1SortHeader('No of Reception', 'receptionsCount')}
                    {tab1Columns.totalAmount && renderTab1SortHeader('Total Amount', 'totalAmount')}
                    {tab1Columns.paidAmount && renderTab1SortHeader('Paid Amount', 'paidAmount')}
                    {tab1Columns.openAmount && renderTab1SortHeader('Open Amount', 'openAmount')}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-[#7a9800]" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading aggregates...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedTab1List.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                          <Search size={40} className="text-slate-400" />
                          <p className="font-black uppercase tracking-widest text-[10px]">No cabrane aggregates found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTab1List.map((row) => (
                      <TableRow key={row.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none group">
                        
                        {/* Cabrane Name */}
                        {tab1Columns.name && (
                          <TableCell className={cn(densityPaddingClass)}>
                            <button
                              onClick={() => handleCabraneClick(row.id)}
                              className="font-bold text-[#7a9800] hover:text-[#6c8500] text-left hover:underline focus:outline-none"
                            >
                              {row.name}
                            </button>
                          </TableCell>
                        )}

                        {/* Receptions Count */}
                        {tab1Columns.receptionsCount && (
                          <TableCell className={cn("font-bold text-slate-600", densityPaddingClass)}>
                            {row.receptionsCount}
                          </TableCell>
                        )}

                        {/* Total Amount */}
                        {tab1Columns.totalAmount && (
                          <TableCell className={cn("font-bold text-slate-700", densityPaddingClass)}>
                            {formatCurrency(row.totalAmount)}
                          </TableCell>
                        )}

                        {/* Paid Amount */}
                        {tab1Columns.paidAmount && (
                          <TableCell className={cn("font-black text-[#7a9800]", densityPaddingClass)}>
                            {formatCurrency(row.paidAmount)}
                          </TableCell>
                        )}

                        {/* Open Amount */}
                        {tab1Columns.openAmount && (
                          <TableCell className={cn("font-black text-rose-600", densityPaddingClass)}>
                            {formatCurrency(row.openAmount)}
                          </TableCell>
                        )}

                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            ) : (
              // TAB 2 TABLE
              <Table className="w-full min-w-[1200px] border-collapse">
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                  <TableRow className="hover:bg-transparent">
                    {tab2Columns.cabraneName && renderTab2SortHeader('Cabrane', 'cabraneName')}
                    {tab2Columns.lotNumber && renderTab2SortHeader('Lot Number', 'lotNumber')}
                    {tab2Columns.shiftDate && renderTab2SortHeader('Shift Date', 'shiftDate')}
                    {tab2Columns.workersCost && renderTab2SortHeader('Worker Cost', 'workersCost')}
                    {tab2Columns.origin && renderTab2SortHeader('Origin', 'origin')}
                    {tab2Columns.supplierName && renderTab2SortHeader('Supplier', 'supplierName')}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="h-8 w-8 animate-spin text-[#7a9800]" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading lot details...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedTab2List.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                          <Search size={40} className="text-slate-400" />
                          <p className="font-black uppercase tracking-widest text-[10px]">No lot records found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTab2List.map((row) => (
                      <TableRow key={row.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none group">
                        
                        {/* Cabrane Name */}
                        {tab2Columns.cabraneName && (
                          <TableCell className={cn("font-bold text-slate-700", densityPaddingClass)}>
                            {row.cabraneName}
                          </TableCell>
                        )}

                        {/* Lot Number */}
                        {tab2Columns.lotNumber && (
                          <TableCell className={cn(densityPaddingClass)}>
                            <Link 
                              href={`/raw-material-pricing/${row.id}/edit`}
                              className="font-black text-[#7a9800] hover:text-[#6c8500] hover:underline"
                            >
                              {row.lotNumber}
                            </Link>
                          </TableCell>
                        )}

                        {/* Shift Date */}
                        {tab2Columns.shiftDate && (
                          <TableCell className={cn("font-semibold text-slate-500", densityPaddingClass)}>
                            {row.shiftDate}
                          </TableCell>
                        )}

                        {/* Workers Cost */}
                        {tab2Columns.workersCost && (
                          <TableCell className={cn("font-bold text-slate-700", densityPaddingClass)}>
                            {formatCurrency(row.workersCost)}
                          </TableCell>
                        )}

                        {/* Origin */}
                        {tab2Columns.origin && (
                          <TableCell className={cn("font-semibold text-slate-600", densityPaddingClass)}>
                            {row.origin}
                          </TableCell>
                        )}

                        {/* Supplier */}
                        {tab2Columns.supplierName && (
                          <TableCell className={cn("font-bold text-slate-700", densityPaddingClass)}>
                            {row.supplierName}
                          </TableCell>
                        )}

                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </div>

          {/* 6. Pagination Controls */}
          <div className="p-4 md:p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {activeTab === 'tab1' ? (
              <>
                <span>Showing {Math.min(filteredTab1List.length, tab1Page * itemsPerPage)} of {filteredTab1List.length} Record(s)</span>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    disabled={tab1Page === 1} 
                    onClick={() => setTab1Page(prev => Math.max(1, prev - 1))}
                    className="h-8 px-3 rounded-lg hover:bg-slate-100 font-black uppercase text-[10px]"
                  >
                    <ChevronLeft size={14} className="mr-1" /> Previous
                  </Button>
                  
                  {Array.from({ length: totalTab1Pages }).map((_, i) => {
                    const pageNum = i + 1;
                    const isActive = pageNum === tab1Page;
                    return (
                      <Button
                        key={pageNum}
                        onClick={() => setTab1Page(pageNum)}
                        className={cn(
                          "h-8 w-8 rounded-lg font-black text-[10px] p-0 flex items-center justify-center transition-all duration-200",
                          isActive 
                            ? "bg-[#7a9800] text-white hover:bg-[#6c8500] shadow-md shadow-[#7a9800]/20 scale-105" 
                            : "bg-transparent text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  <Button 
                    variant="ghost" 
                    disabled={tab1Page === totalTab1Pages} 
                    onClick={() => setTab1Page(prev => Math.min(totalTab1Pages, prev + 1))}
                    className="h-8 px-3 rounded-lg hover:bg-slate-100 font-black uppercase text-[10px]"
                  >
                    Next <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <span>Showing {Math.min(filteredTab2List.length, tab2Page * itemsPerPage)} of {filteredTab2List.length} Record(s)</span>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    disabled={tab2Page === 1} 
                    onClick={() => setTab2Page(prev => Math.max(1, prev - 1))}
                    className="h-8 px-3 rounded-lg hover:bg-slate-100 font-black uppercase text-[10px]"
                  >
                    <ChevronLeft size={14} className="mr-1" /> Previous
                  </Button>
                  
                  {Array.from({ length: totalTab2Pages }).map((_, i) => {
                    const pageNum = i + 1;
                    const isActive = pageNum === tab2Page;
                    return (
                      <Button
                        key={pageNum}
                        onClick={() => setTab2Page(pageNum)}
                        className={cn(
                          "h-8 w-8 rounded-lg font-black text-[10px] p-0 flex items-center justify-center transition-all duration-200",
                          isActive 
                            ? "bg-[#7a9800] text-white hover:bg-[#6c8500] shadow-md shadow-[#7a9800]/20 scale-105" 
                            : "bg-transparent text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}

                  <Button 
                    variant="ghost" 
                    disabled={tab2Page === totalTab2Pages} 
                    onClick={() => setTab2Page(prev => Math.min(totalTab2Pages, prev + 1))}
                    className="h-8 px-3 rounded-lg hover:bg-slate-100 font-black uppercase text-[10px]"
                  >
                    Next <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
