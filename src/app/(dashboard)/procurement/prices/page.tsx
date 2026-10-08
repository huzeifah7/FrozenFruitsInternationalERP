'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy,
  deleteDoc,
  doc
} from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Scale, 
  Filter, 
  Search, 
  X, 
  TrendingUp, 
  DollarSign, 
  MoreVertical, 
  Edit, 
  Trash2,
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
  Leaf,
  Layers,
  Building,
  User,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { exportRawMaterialPricingExcel } from '@/lib/export-pricing-excel';
import { cn } from '@/lib/utils';

export default function RawMaterialPricingPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // --- Core Data States ---
  const [materials, setMaterials] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Filtering States (applied on Filter click) ---
  const [tempSupplier, setTempSupplier] = useState('all');
  const [tempDateStart, setTempDateStart] = useState('');
  const [tempDateEnd, setTempDateEnd] = useState('');

  const [appliedSupplier, setAppliedSupplier] = useState('all');
  const [appliedDateStart, setAppliedDateStart] = useState('');
  const [appliedDateEnd, setAppliedDateEnd] = useState('');

  // --- Active Tab State ---
  const [activeTab, setActiveTab] = useState<'tab1' | 'tab2' | 'tab3'>('tab3');

  // --- Table Configuration States ---
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<any>(null);

  // Pagination states (separated for each table/tab to keep track)
  const [tab1Page, setTab1Page] = useState(1);
  const [tab2Page, setTab2Page] = useState(1);
  const [tab3Page, setTab3Page] = useState(1);
  const itemsPerPage = 8;

  // Search terms for each tab
  const [tab1Search, setTab1Search] = useState('');
  const [tab2Search, setTab2Search] = useState('');
  const [tab3Search, setTab3Search] = useState('');

  // Sorting states
  const [sortField, setSortField] = useState<string>('lotNumber');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Column Visibility States
  const [tab1Columns, setTab1Columns] = useState<Record<string, boolean>>({
    shiftDate: true,
    location: true,
    netWeight: true,
    avgPrice: true,
    receptions: true,
  });

  const [tab2Columns, setTab2Columns] = useState<Record<string, boolean>>({
    supplier: true,
    location: true,
    netWeight: true,
    avgPrice: true,
    receptions: true,
  });

  const [tab3Columns, setTab3Columns] = useState<Record<string, boolean>>({
    lotNumber: true,
    supplier: true,
    price: true,
    decayPrice: true,
    blGross: true,
    blNet: true,
    decayNet: true,
    rebate: true,
    amount: true,
    driverName: true,
    plateNumber: true,
    transportCost: true,
    workersCost: true,
    cabraneCost: true,
    shiftDate: true,
    createdBy: true,
    createdAt: true,
    updatedBy: true,
    updatedAt: true,
  });

  // --- Fetch Data ---
  const fetchData = async () => {
    if (!db) return;
    try {
      setLoading(true);
      const [matSnap, supSnap, locSnap] = await Promise.all([
        getDocs(collection(db, 'raw_materials')).catch(e => { console.error('rm fetch err', e); return { docs: [] }; }),
        getDocs(collection(db, 'suppliers')).catch(e => { console.error('sup fetch err', e); return { docs: [] }; }),
        getDocs(collection(db, 'processing_lines')).catch(e => { console.error('loc fetch err', e); return { docs: [] }; })
      ]);

      const rawList = matSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      rawList.sort((a: any, b: any) => (b.dateTime || '').localeCompare(a.dateTime || ''));

      const supList = supSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      supList.sort((a: any, b: any) => (a.name || a.supplierName || '').localeCompare(b.name || b.supplierName || ''));

      const locList = locSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      locList.sort((a: any, b: any) => (a.title || a.name || '').localeCompare(b.title || b.name || ''));

      setMaterials(rawList);
      setSuppliers(supList);
      setLocations(locList);
    } catch (err) {
      console.error("Error fetching pricing data:", err);
      toast({
        title: "Error",
        description: "Failed to load raw material lots.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [db]);

  // --- Helpers ---
  const getSupName = (id: string) => {
    const s = suppliers.find(s => s.id === id);
    if (!s) return id || '—';
    return s.name || s.supplierName || id || '—';
  };
  const getLocName = (id: string) => locations.find(l => l.id === id)?.title || id || '—';

  // --- Deletion Lot ---
  const handleDeleteLot = async () => {
    if (!db || !recordToDelete) return;
    try {
      await deleteDoc(doc(db, 'raw_materials', recordToDelete.id));
      toast({
        title: "Success",
        description: "Raw material lot deleted successfully.",
      });
      fetchData(); // Reload
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to delete raw material lot.",
        variant: "destructive"
      });
    } finally {
      setIsDeleteConfirmOpen(false);
      setRecordToDelete(null);
    }
  };

  // --- Master Filter Logic ---
  const filteredMaterials = useMemo(() => {
    return materials.filter(rm => {
      // 1. Supplier filter
      if (appliedSupplier !== 'all' && rm.supplierId !== appliedSupplier) return false;

      // 2. Date range filter
      if (rm.date || rm.dateTime) {
        const itemDate = rm.date || rm.dateTime.substring(0, 10); // YYYY-MM-DD
        if (appliedDateStart && itemDate < appliedDateStart) return false;
        if (appliedDateEnd && itemDate > appliedDateEnd) return false;
      } else {
        if (appliedDateStart || appliedDateEnd) return false;
      }

      return true;
    });
  }, [materials, appliedSupplier, appliedDateStart, appliedDateEnd]);

  const computeFinalAmount = (x: any): number | 'Pending' => {
    const blNetWeight = Number(x.blNetWeight != null ? x.blNetWeight : (x.totalNetWeight || 0));
    const decayNetWeight = Number(x.totalDecayNetWeight || x.decayNetWeight || 0);
    const price = x.price || x.unitPrice;
    const decayPrice = x.decayPrice;
    const workerCost = Number(x.workerCost || 0);
    const rebate = Number(x.rebate || 0);

    if (!price || price === '') return 'Pending';

    const pPrice = Number(price);
    const pDecayPrice = Number(decayPrice || 0);
    const rebateFactor = (100 - rebate) / 100;

    const goodWeight = blNetWeight - decayNetWeight;
    const goodAmount = goodWeight * pPrice * rebateFactor;
    const decayAmount = decayNetWeight > 0 ? (decayNetWeight * pDecayPrice * rebateFactor) : 0;

    const grossAmount = goodAmount + decayAmount;
    return Number((grossAmount - workerCost).toFixed(2));
  };

  // --- Stats / KPI Summary Computations ---
  const kpis = useMemo(() => {
    let totalWeight = 0;
    let totalPricedAmount = 0;
    let totalPricedWeight = 0;
    let totalReceptions = filteredMaterials.length;

    filteredMaterials.forEach(rm => {
      const netWeight = Number(rm.totalNetWeight || rm.blNetWeight || 0);
      totalWeight += netWeight;

      const amt = computeFinalAmount(rm);
      if (amt !== 'Pending') {
        totalPricedAmount += amt;
        totalPricedWeight += netWeight;
      }
    });

    const avgPrice = totalPricedWeight > 0 ? (totalPricedAmount / totalPricedWeight) : 0;

    return {
      totalWeight,
      avgPrice,
      totalReceptions
    };
  }, [filteredMaterials]);

  // --- Tab 1: Group by Shift Date and Location ---
  const groupedByShiftAndLocation = useMemo(() => {
    const groups: Record<string, { shiftDate: string; locationId: string; items: any[] }> = {};

    filteredMaterials.forEach(rm => {
      const shiftDate = rm.date || (rm.dateTime ? rm.dateTime.substring(0, 10) : '—');
      const locationId = rm.locationId || '—';
      const key = `${shiftDate}_${locationId}`;

      if (!groups[key]) {
        groups[key] = { shiftDate, locationId, items: [] };
      }
      groups[key].items.push(rm);
    });

    return Object.values(groups).map(g => {
      let netWeight = 0;
      let totalPricedWeight = 0;
      let totalPricedAmount = 0;

      g.items.forEach(item => {
        const w = Number(item.totalNetWeight || item.blNetWeight || 0);
        netWeight += w;

        const amt = computeFinalAmount(item);
        if (amt !== 'Pending') {
          totalPricedAmount += amt;
          totalPricedWeight += w;
        }
      });

      const avgPrice = totalPricedWeight > 0 ? (totalPricedAmount / totalPricedWeight) : 0;

      return {
        id: `${g.shiftDate}_${g.locationId}`,
        shiftDate: g.shiftDate,
        locationId: g.locationId,
        locationName: getLocName(g.locationId),
        netWeight,
        avgPrice,
        receptionsCount: g.items.length,
        items: g.items
      };
    });
  }, [filteredMaterials, locations]);

  // --- Tab 2: Group by Supplier and Location ---
  const groupedBySupplier = useMemo(() => {
    const groups: Record<string, { supplierId: string; locationId: string; items: any[] }> = {};

    filteredMaterials.forEach(rm => {
      const supplierId = rm.supplierId || '—';
      const locationId = rm.locationId || '—';
      const key = `${supplierId}_${locationId}`;

      if (!groups[key]) {
        groups[key] = { supplierId, locationId, items: [] };
      }
      groups[key].items.push(rm);
    });

    return Object.values(groups).map(g => {
      let netWeight = 0;
      let totalPricedWeight = 0;
      let totalPricedAmount = 0;

      g.items.forEach(item => {
        const w = Number(item.totalNetWeight || item.blNetWeight || 0);
        netWeight += w;

        const amt = computeFinalAmount(item);
        if (amt !== 'Pending') {
          totalPricedAmount += amt;
          totalPricedWeight += w;
        }
      });

      const avgPrice = totalPricedWeight > 0 ? (totalPricedAmount / totalPricedWeight) : 0;

      return {
        id: `${g.supplierId}_${g.locationId}`,
        supplierId: g.supplierId,
        supplierName: getSupName(g.supplierId),
        locationId: g.locationId,
        locationName: getLocName(g.locationId),
        netWeight,
        avgPrice,
        receptionsCount: g.items.length,
        items: g.items
      };
    });
  }, [filteredMaterials, suppliers, locations]);

  // --- Search and Sorting Computations for Tab 1 ---
  const processedTab1List = useMemo(() => {
    let list = [...groupedByShiftAndLocation];

    if (tab1Search.trim()) {
      const term = tab1Search.toLowerCase();
      list = list.filter(row => 
        row.shiftDate.toLowerCase().includes(term) ||
        row.locationName.toLowerCase().includes(term)
      );
    }

    if (sortField) {
      list.sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB, undefined, { numeric: true }) : valB.localeCompare(valA, undefined, { numeric: true });
        } else {
          return sortDirection === 'asc' ? (valA - valB) : (valB - valA);
        }
      });
    }

    return list;
  }, [groupedByShiftAndLocation, tab1Search, sortField, sortDirection]);

  // --- Search and Sorting Computations for Tab 2 ---
  const processedTab2List = useMemo(() => {
    let list = [...groupedBySupplier];

    if (tab2Search.trim()) {
      const term = tab2Search.toLowerCase();
      list = list.filter(row => 
        row.supplierName.toLowerCase().includes(term) ||
        row.locationName.toLowerCase().includes(term)
      );
    }

    if (sortField) {
      list.sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB, undefined, { numeric: true }) : valB.localeCompare(valA, undefined, { numeric: true });
        } else {
          return sortDirection === 'asc' ? (valA - valB) : (valB - valA);
        }
      });
    }

    return list;
  }, [groupedBySupplier, tab2Search, sortField, sortDirection]);

  // --- Search and Sorting Computations for Tab 3 ---
  const processedTab3List = useMemo(() => {
    let list = [...filteredMaterials];

    if (tab3Search.trim()) {
      const term = tab3Search.toLowerCase();
      list = list.filter(row => 
        (row.lotNumber || '').toLowerCase().includes(term) ||
        getSupName(row.supplierId).toLowerCase().includes(term) ||
        (row.driverName || '').toLowerCase().includes(term) ||
        (row.plateNumber || '').toLowerCase().includes(term)
      );
    }

    if (sortField) {
      list.sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'shiftDate') {
          valA = a.date || (a.dateTime ? a.dateTime.substring(0, 10) : '');
          valB = b.date || (b.dateTime ? b.dateTime.substring(0, 10) : '');
        } else if (sortField === 'decayNetWeight') {
          valA = Number(a.totalDecayNetWeight || a.decayNetWeight || 0);
          valB = Number(b.totalDecayNetWeight || b.decayNetWeight || 0);
        } else if (sortField === 'amount') {
          const valAPending = computeFinalAmount(a);
          const valBPending = computeFinalAmount(b);
          valA = valAPending === 'Pending' ? -1 : valAPending;
          valB = valBPending === 'Pending' ? -1 : valBPending;
        } else if (sortField === 'createdAt') {
          valA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          valB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        } else if (sortField === 'updatedAt') {
          valA = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
          valB = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
        }

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' ? valA.localeCompare(valB, undefined, { numeric: true }) : valB.localeCompare(valA, undefined, { numeric: true });
        } else {
          return sortDirection === 'asc' ? (valA - valB) : (valB - valA);
        }
      });
    }

    return list;
  }, [filteredMaterials, tab3Search, sortField, sortDirection]);

  // --- Slices for Pagination ---
  const tab1Paginated = useMemo(() => {
    const start = (tab1Page - 1) * itemsPerPage;
    return processedTab1List.slice(start, start + itemsPerPage);
  }, [processedTab1List, tab1Page]);

  const tab2Paginated = useMemo(() => {
    const start = (tab2Page - 1) * itemsPerPage;
    return processedTab2List.slice(start, start + itemsPerPage);
  }, [processedTab2List, tab2Page]);

  const tab3Paginated = useMemo(() => {
    const start = (tab3Page - 1) * itemsPerPage;
    return processedTab3List.slice(start, start + itemsPerPage);
  }, [processedTab3List, tab3Page]);

  const totalTab1Pages = Math.ceil(processedTab1List.length / itemsPerPage) || 1;
  const totalTab2Pages = Math.ceil(processedTab2List.length / itemsPerPage) || 1;
  const totalTab3Pages = Math.ceil(processedTab3List.length / itemsPerPage) || 1;

  // Reset pagination on search or active tab changes
  useEffect(() => {
    setTab1Page(1);
    setTab2Page(1);
    setTab3Page(1);
  }, [tab1Search, tab2Search, tab3Search, activeTab]);

  // --- Sorting Trigger ---
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const renderSortHeader = (label: string, field: string) => {
    const isActive = sortField === field;
    return (
      <TableHead 
        className={cn(
          "py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap cursor-pointer select-none transition-colors hover:text-primary",
          isActive && "text-[#7a9800] font-black"
        )}
        onClick={() => handleSort(field)}
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

  // --- XLSX Export Handler ---
  const handleExportExcel = async () => {
    let filename = 'raw_material_pricing';

    if (activeTab === 'tab1') {
      filename = 'pricing_by_shift_and_location';
      const exportData = processedTab1List.map(row => ({
        'Shift Date': row.shiftDate,
        'Location': row.locationName,
        'Net Weight (KG)': row.netWeight,
        'Avg Buying Price (MAD)': row.avgPrice > 0 ? row.avgPrice.toFixed(2) : 'Pending',
        'No of Receptions': row.receptionsCount,
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Pricing Summary');
      const maxLen = exportData.reduce((w, r) => Math.max(w, ...Object.keys(r).map(k => String((r as any)[k]).length)), 15);
      worksheet['!cols'] = Array(Object.keys(exportData[0] || {}).length).fill({ wch: maxLen + 2 });
      XLSX.writeFile(workbook, `${filename}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
      toast({
        title: "Export Successful",
        description: `Pricing data exported as ${filename}.xlsx`,
      });
    } else if (activeTab === 'tab2') {
      filename = 'pricing_by_supplier';
      const exportData = processedTab2List.map(row => ({
        'Supplier': row.supplierName,
        'Location': row.locationName,
        'Net Weight (KG)': row.netWeight,
        'Avg Buying Price (MAD)': row.avgPrice > 0 ? row.avgPrice.toFixed(2) : 'Pending',
        'Receptions': row.receptionsCount,
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Pricing Summary');
      const maxLen = exportData.reduce((w, r) => Math.max(w, ...Object.keys(r).map(k => String((r as any)[k]).length)), 15);
      worksheet['!cols'] = Array(Object.keys(exportData[0] || {}).length).fill({ wch: maxLen + 2 });
      XLSX.writeFile(workbook, `${filename}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
      toast({
        title: "Export Successful",
        description: `Pricing data exported as ${filename}.xlsx`,
      });
    } else {
      filename = 'raw_materials_pricing_detail';
      const exportData = processedTab3List.map(rm => {
        const blNetWeight = Number(rm.blNetWeight != null ? rm.blNetWeight : (rm.totalNetWeight || 0));
        const decayNetWeight = Number(rm.totalDecayNetWeight || rm.decayNetWeight || 0);
        const price = Number(rm.price || rm.unitPrice || 0);
        const decayPrice = Number(rm.decayPrice || 0);
        const transportCost = Number(rm.transportCost || 0);
        const workerCost = Number(rm.workerCost || 0);
        const finalTotalAmount = computeFinalAmount(rm);

        const formattedCreatedAt = rm.createdAt?.toDate 
          ? format(rm.createdAt.toDate(), 'yyyy-MM-dd HH:mm') 
          : rm.createdAt ? String(rm.createdAt) : '—';

        return {
          lotNumber: rm.lotNumber || '',
          supplierName: getSupName(rm.supplierId),
          price,
          decayPrice,
          driverName: rm.driverName || '',
          plateNumber: rm.plateNumber || '',
          transportCost,
          workerCost,
          shiftDate: rm.date || (rm.dateTime ? rm.dateTime.substring(0,10) : '—'),
          farmName: rm.farmName || rm.farmerName || '',
          totalNetWeight: Number(rm.totalNetWeight || rm.blNetWeight || 0),
          dateTime: rm.dateTime || formattedCreatedAt,
          locationName: getLocName(rm.locationId),
          blGrossWeight: Number(rm.blGrossWeight || 0),
          blNetWeight,
          decayNetWeight,
          rebate: Number(rm.rebate || 0),
          amount: (finalTotalAmount === 'Pending' ? 'Pending' : finalTotalAmount) as number | "Pending",
        };
      });

      await exportRawMaterialPricingExcel(exportData);
      
      toast({
        title: "Export Successful",
        description: `Pricing data exported using ExcelJS template.`,
      });
    }
  };

  // --- Dynamic Table Padding Classes ---
  const densityPaddingClass = {
    compact: 'py-2 px-4 h-12 text-xs',
    normal: 'py-4 px-6 h-16 text-xs',
    tall: 'py-6 px-8 h-20 text-sm'
  }[density];

  return (
    <div className={cn(
      "w-full bg-[#f3f3f3] min-h-screen transition-all duration-300",
      isFullscreen ? "fixed inset-0 z-50 p-6 overflow-y-auto bg-[#f3f3f3]" : "p-6 lg:p-8"
    )}>

      {/* 1. Header with Breadcrumbs & Download */}
      <div className="max-w-[1600px] mx-auto mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            <span className="hover:text-slate-600 cursor-pointer">Profile</span>
            <span className="opacity-40">/</span>
            <span className="text-[#7a9800] font-black uppercase">Raw Material Pricing Listing</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">
            Raw Material Pricing
          </h1>
        </div>

        <div>
          <Button 
            onClick={handleExportExcel}
            className="h-12 px-6 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 text-xs font-black uppercase tracking-wider"
          >
            <Download size={16} className="stroke-[2.5]" /> Export / Download
          </Button>
        </div>
      </div>

      {/* 2. Top Horizontal Filter Matrix Card */}
      <div className="max-w-[1600px] mx-auto mb-8">
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-100/50 border border-slate-100/80">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            
            {/* Input Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
              {/* Supplier Select */}
              <div className="space-y-2">
                <Label htmlFor="supplier" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Building size={12} className="text-[#7a9800]" /> Supplier
                </Label>
                <Select value={tempSupplier} onValueChange={setTempSupplier}>
                  <SelectTrigger id="supplier" className="h-11 rounded-xl bg-slate-50 border-none font-bold text-slate-700 focus:ring-[#7a9800]">
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 shadow-2xl bg-white max-h-60 overflow-y-auto">
                    <SelectItem value="all" className="font-bold text-xs uppercase text-slate-400">ALL SUPPLIERS</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id} className="font-bold text-xs">{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Calendar size={12} className="text-[#7a9800]" /> Start Date
                </Label>
                <Input
                  id="startDate"
                  type="date"
                  value={tempDateStart}
                  onChange={e => setTempDateStart(e.target.value)}
                  className="h-11 rounded-xl bg-slate-50 border-none font-bold text-slate-700 focus-visible:ring-[#7a9800]"
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                  <Calendar size={12} className="text-[#7a9800]" /> End Date
                </Label>
                <Input
                  id="endDate"
                  type="date"
                  value={tempDateEnd}
                  onChange={e => setTempDateEnd(e.target.value)}
                  className="h-11 rounded-xl bg-slate-50 border-none font-bold text-slate-700 focus-visible:ring-[#7a9800]"
                />
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-3 self-end lg:self-auto w-full lg:w-auto">
              <Button
                onClick={() => {
                  setAppliedSupplier(tempSupplier);
                  setAppliedDateStart(tempDateStart);
                  setAppliedDateEnd(tempDateEnd);
                  toast({
                    title: "Filters Applied",
                    description: "Reloaded metrics and dashboard pricing grids.",
                  });
                }}
                className="h-11 px-8 flex-1 lg:flex-none bg-[#7a9800] hover:bg-[#6c8500] text-white font-black rounded-xl shadow-lg shadow-[#7a9800]/20 uppercase tracking-widest text-xs transition-all active:scale-95"
              >
                <Filter size={14} className="mr-2" /> Filter
              </Button>
              
              <Button
                variant="outline"
                onClick={() => {
                  setTempSupplier('all');
                  setTempDateStart('');
                  setTempDateEnd('');
                  setAppliedSupplier('all');
                  setAppliedDateStart('');
                  setAppliedDateEnd('');
                  toast({
                    title: "Filters Reset",
                    description: "Cleared all pricing dashboard filters.",
                  });
                }}
                className="h-11 px-6 rounded-xl border-slate-200 bg-white font-bold uppercase tracking-widest text-[10px] text-slate-500 hover:bg-slate-50"
              >
                Reset
              </Button>
            </div>

          </div>
        </div>
      </div>

      {/* 3. Summary Statistics Cards */}
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Total Net Weight Card */}
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center justify-between group overflow-hidden relative">
          <div className="absolute right-0 top-0 p-6 opacity-[0.03] text-slate-500 group-hover:scale-110 transition-transform">
            <Scale size={90} />
          </div>
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] block">Total Net Weight</span>
            <div className="flex items-baseline gap-1.5">
              <h2 className="text-3xl font-black text-[#2e1d52]">{kpis.totalWeight.toLocaleString()}</h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">KG</span>
            </div>
          </div>
        </div>

        {/* Average Buying Card */}
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center justify-between group overflow-hidden relative">
          <div className="absolute right-0 top-0 p-6 opacity-[0.03] text-[#7a9800] group-hover:scale-110 transition-transform">
            <TrendingUp size={90} />
          </div>
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] block">Average Buying</span>
            <div className="flex items-baseline gap-1.5">
              <h2 className="text-3xl font-black text-[#7a9800]">
                {kpis.avgPrice > 0 ? kpis.avgPrice.toFixed(2) : '—'}
              </h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MAD / KG</span>
            </div>
          </div>
        </div>

        {/* Total Reception Card */}
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-100/50 border border-slate-100/80 flex items-center justify-between group overflow-hidden relative">
          <div className="absolute right-0 top-0 p-6 opacity-[0.03] text-slate-500 group-hover:scale-110 transition-transform">
            <Layers size={90} />
          </div>
          <div className="space-y-1.5">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] block">Total Reception</span>
            <div className="flex items-baseline gap-1.5">
              <h2 className="text-3xl font-black text-[#2e1d52]">{kpis.totalReceptions}</h2>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lots Loaded</span>
            </div>
          </div>
        </div>

      </div>

      {/* 4. Elegant Tabs Section */}
      <div className="max-w-[1600px] mx-auto mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => { setActiveTab('tab1'); setSortField('shiftDate'); }}
          className={cn(
            "px-6 py-3 rounded-t-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border-t border-x border-transparent",
            activeTab === 'tab1' 
              ? "bg-white text-[#7a9800] border-slate-200/80 shadow-sm relative -mb-[13px] z-10" 
              : "text-slate-500 hover:text-[#7a9800] hover:bg-slate-100/50"
          )}
        >
          Raw Material Group by Shift date and Location
        </button>
        <button
          onClick={() => { setActiveTab('tab2'); setSortField('supplierName'); }}
          className={cn(
            "px-6 py-3 rounded-t-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border-t border-x border-transparent",
            activeTab === 'tab2' 
              ? "bg-white text-[#7a9800] border-slate-200/80 shadow-sm relative -mb-[13px] z-10" 
              : "text-slate-500 hover:text-[#7a9800] hover:bg-slate-100/50"
          )}
        >
          Raw Material Group By Supplier
        </button>
        <button
          onClick={() => { setActiveTab('tab3'); setSortField('lotNumber'); }}
          className={cn(
            "px-6 py-3 rounded-t-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border-t border-x border-transparent",
            activeTab === 'tab3' 
              ? "bg-white text-[#7a9800] border-slate-200/80 shadow-sm relative -mb-[13px] z-10" 
              : "text-slate-500 hover:text-[#7a9800] hover:bg-slate-100/50"
          )}
        >
          Raw Materials
        </button>
      </div>

      {/* 5. Main Tab Grids Container */}
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        {/* ========================================================
            TAB 1 GRID: GROUP BY SHIFT DATE & LOCATION
            ======================================================== */}
        {activeTab === 'tab1' && (
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden flex flex-col animate-in fade-in duration-350">
            {/* Toolbar */}
            <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search shift date or location..."
                  className="h-10 pl-10 pr-4 rounded-xl border-slate-200 bg-white focus-visible:ring-[#7a9800] font-medium text-xs shadow-sm"
                  value={tab1Search}
                  onChange={e => setTab1Search(e.target.value)}
                />
              </div>

              {/* Toolbar Right Controls */}
              <div className="flex items-center gap-3 self-end md:self-auto">
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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 bg-white gap-2 font-bold text-slate-600 shadow-sm text-xs">Columns</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl p-2 bg-white w-48">
                    {Object.keys(tab1Columns).map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col}
                        checked={tab1Columns[col]}
                        onCheckedChange={(checked) => setTab1Columns(prev => ({ ...prev, [col]: checked }))}
                        className="font-bold text-xs rounded-lg py-2 cursor-pointer capitalize"
                      >
                        {col.replace(/([A-Z])/g, ' $1')}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-200 bg-white" onClick={() => setIsFullscreen(prev => !prev)}>
                  {isFullscreen ? <Minimize2 size={16} className="text-slate-600" /> : <Maximize2 size={16} className="text-slate-600" />}
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth">
              <Table className="w-full min-w-[1000px] border-collapse">
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                  <TableRow>
                    {tab1Columns.shiftDate && renderSortHeader('Shift Date', 'shiftDate')}
                    {tab1Columns.location && renderSortHeader('Location', 'locationName')}
                    {tab1Columns.netWeight && renderSortHeader('Net Weight', 'netWeight')}
                    {tab1Columns.avgPrice && renderSortHeader('Average Buying Price', 'avgPrice')}
                    {tab1Columns.receptions && renderSortHeader('No of Receptions', 'receptionsCount')}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="h-64 text-center"><Loader2 className="h-8 w-8 animate-spin text-[#7a9800] mx-auto" /></TableCell></TableRow>
                  ) : tab1Paginated.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-64 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No entries found</TableCell></TableRow>
                  ) : (
                    tab1Paginated.map(row => (
                      <TableRow key={row.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none">
                        {tab1Columns.shiftDate && (
                          <TableCell className={cn("font-bold text-slate-700 whitespace-nowrap", densityPaddingClass)}>
                            {row.shiftDate}
                          </TableCell>
                        )}
                        {tab1Columns.location && (
                          <TableCell className={cn("font-semibold text-slate-600 whitespace-nowrap", densityPaddingClass)}>
                            {row.locationName}
                          </TableCell>
                        )}
                        {tab1Columns.netWeight && (
                          <TableCell className={cn("font-black text-slate-700 text-right whitespace-nowrap", densityPaddingClass)}>
                            {row.netWeight.toLocaleString()} <span className="text-[9px] font-bold text-slate-400">KG</span>
                          </TableCell>
                        )}
                        {tab1Columns.avgPrice && (
                          <TableCell className={cn("font-black text-slate-800 text-right whitespace-nowrap", densityPaddingClass)}>
                            {row.avgPrice > 0 ? `${row.avgPrice.toFixed(2)} MAD/KG` : <span className="text-amber-500 font-bold italic text-xs">Pending</span>}
                          </TableCell>
                        )}
                        {tab1Columns.receptions && (
                          <TableCell className={cn("font-bold text-slate-600 text-center whitespace-nowrap", densityPaddingClass)}>
                            {row.receptionsCount} Lots
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="p-4 md:p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>Showing {tab1Paginated.length} of {processedTab1List.length} row(s)</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={tab1Page === 1} onClick={() => setTab1Page(p => Math.max(1, p - 1))} className="h-8 text-[10px] font-black uppercase"><ChevronLeft size={14} /> Prev</Button>
                {Array.from({ length: totalTab1Pages }).map((_, i) => (
                  <Button key={i} onClick={() => setTab1Page(i + 1)} className={cn("h-8 w-8 rounded-lg text-[10px] font-black", tab1Page === i + 1 ? "bg-[#7a9800] text-white hover:bg-[#6c8500] shadow-md shadow-[#7a9800]/20" : "bg-transparent text-slate-600 hover:bg-slate-100")}>{i + 1}</Button>
                ))}
                <Button variant="ghost" size="sm" disabled={tab1Page === totalTab1Pages} onClick={() => setTab1Page(p => Math.min(totalTab1Pages, p + 1))} className="h-8 text-[10px] font-black uppercase">Next <ChevronRight size={14} /></Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 2 GRID: GROUP BY SUPPLIER
            ======================================================== */}
        {activeTab === 'tab2' && (
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden flex flex-col animate-in fade-in duration-350">
            {/* Toolbar */}
            <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search supplier or location..."
                  className="h-10 pl-10 pr-4 rounded-xl border-slate-200 bg-white focus-visible:ring-[#7a9800] font-medium text-xs shadow-sm"
                  value={tab2Search}
                  onChange={e => setTab2Search(e.target.value)}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 self-end md:self-auto">
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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 bg-white gap-2 font-bold text-slate-600 shadow-sm text-xs">Columns</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl p-2 bg-white w-48">
                    {Object.keys(tab2Columns).map((col) => (
                      <DropdownMenuCheckboxItem
                        key={col}
                        checked={tab2Columns[col]}
                        onCheckedChange={(checked) => setTab2Columns(prev => ({ ...prev, [col]: checked }))}
                        className="font-bold text-xs rounded-lg py-2 cursor-pointer capitalize"
                      >
                        {col.replace(/([A-Z])/g, ' $1')}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-200 bg-white" onClick={() => setIsFullscreen(prev => !prev)}>
                  {isFullscreen ? <Minimize2 size={16} className="text-slate-600" /> : <Maximize2 size={16} className="text-slate-600" />}
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth">
              <Table className="w-full min-w-[1000px] border-collapse">
                <TableHeader className="bg-slate-50 border-b border-slate-100">
                  <TableRow>
                    {tab2Columns.supplier && renderSortHeader('Supplier', 'supplierName')}
                    {tab2Columns.location && renderSortHeader('Location', 'locationName')}
                    {tab2Columns.netWeight && renderSortHeader('Net Weight', 'netWeight')}
                    {tab2Columns.avgPrice && renderSortHeader('Average Buying Price', 'avgPrice')}
                    {tab2Columns.receptions && renderSortHeader('Receptions', 'receptionsCount')}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="h-64 text-center"><Loader2 className="h-8 w-8 animate-spin text-[#7a9800] mx-auto" /></TableCell></TableRow>
                  ) : tab2Paginated.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-64 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No entries found</TableCell></TableRow>
                  ) : (
                    tab2Paginated.map(row => (
                      <TableRow key={row.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none">
                        {tab2Columns.supplier && (
                          <TableCell className={cn("font-bold whitespace-nowrap", densityPaddingClass)}>
                            <span 
                              onClick={() => {
                                setTempSupplier(row.supplierId);
                                setAppliedSupplier(row.supplierId);
                                toast({ title: "Filtered", description: `Showing records for ${row.supplierName}` });
                              }}
                              className="text-[#7a9800] font-black cursor-pointer hover:underline"
                            >
                              {row.supplierName}
                            </span>
                          </TableCell>
                        )}
                        {tab2Columns.location && (
                          <TableCell className={cn("font-semibold text-slate-600 whitespace-nowrap", densityPaddingClass)}>
                            {row.locationName}
                          </TableCell>
                        )}
                        {tab2Columns.netWeight && (
                          <TableCell className={cn("font-black text-slate-700 text-right whitespace-nowrap", densityPaddingClass)}>
                            {row.netWeight.toLocaleString()} <span className="text-[9px] font-bold text-slate-400">KG</span>
                          </TableCell>
                        )}
                        {tab2Columns.avgPrice && (
                          <TableCell className={cn("font-black text-slate-800 text-right whitespace-nowrap", densityPaddingClass)}>
                            {row.avgPrice > 0 ? `${row.avgPrice.toFixed(2)} MAD/KG` : <span className="text-amber-500 font-bold italic text-xs">Pending</span>}
                          </TableCell>
                        )}
                        {tab2Columns.receptions && (
                          <TableCell className={cn("font-bold text-slate-600 text-center whitespace-nowrap", densityPaddingClass)}>
                            {row.receptionsCount} Reception(s)
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="p-4 md:p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <span>Showing {tab2Paginated.length} of {processedTab2List.length} supplier row(s)</span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" disabled={tab2Page === 1} onClick={() => setTab2Page(p => Math.max(1, p - 1))} className="h-8 text-[10px] font-black uppercase"><ChevronLeft size={14} /> Prev</Button>
                {Array.from({ length: totalTab2Pages }).map((_, i) => (
                  <Button key={i} onClick={() => setTab2Page(i + 1)} className={cn("h-8 w-8 rounded-lg text-[10px] font-black", tab2Page === i + 1 ? "bg-[#7a9800] text-white hover:bg-[#6c8500] shadow-md shadow-[#7a9800]/20" : "bg-transparent text-slate-600 hover:bg-slate-100")}>{i + 1}</Button>
                ))}
                <Button variant="ghost" size="sm" disabled={tab2Page === totalTab2Pages} onClick={() => setTab2Page(p => Math.min(totalTab2Pages, p + 1))} className="h-8 text-[10px] font-black uppercase">Next <ChevronRight size={14} /></Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3 GRID: RAW MATERIALS OVERVIEW (ALL INFO COMPREHENSIVE VIEW WITH SCROLL)
            ======================================================== */}
        {activeTab === 'tab3' && (
          <div className="space-y-8 animate-in fade-in duration-350">
            
            {/* Unified Comprehensive Table */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden flex flex-col">
              
              <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/40">
                <h3 className="text-xs font-black text-[#2e1d52] uppercase tracking-[0.2em]">Raw Materials Pricing & Audit Data</h3>
              </div>

              {/* Toolbar */}
              <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search by lot, supplier, driver, plate..."
                    className="h-10 pl-10 pr-4 rounded-xl border-slate-200 bg-white focus-visible:ring-[#7a9800] font-medium text-xs shadow-sm"
                    value={tab3Search}
                    onChange={e => setTab3Search(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
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

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-10 rounded-xl border-slate-200 bg-white gap-2 font-bold text-slate-600 shadow-sm text-xs">Columns</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-slate-100 shadow-xl p-2 bg-white w-48 max-h-80 overflow-y-auto">
                      {Object.keys(tab3Columns).map((col) => (
                        <DropdownMenuCheckboxItem
                          key={col}
                          checked={tab3Columns[col]}
                          onCheckedChange={(checked) => setTab3Columns(prev => ({ ...prev, [col]: checked }))}
                          className="font-bold text-xs rounded-lg py-2 cursor-pointer capitalize"
                        >
                          {col.replace(/([A-Z])/g, ' $1')}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-slate-200 bg-white" onClick={() => setIsFullscreen(prev => !prev)}>
                    {isFullscreen ? <Minimize2 size={16} className="text-slate-600" /> : <Maximize2 size={16} className="text-slate-600" />}
                  </Button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth">
                <Table className="w-full min-w-[2400px] border-collapse">
                  <TableHeader className="bg-slate-50 border-b border-slate-100">
                    <TableRow>
                      <TableHead className="pl-6 md:pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 w-[80px]">Actions</TableHead>
                      {tab3Columns.lotNumber && renderSortHeader('Lot Number', 'lotNumber')}
                      {tab3Columns.supplier && renderSortHeader('Supplier', 'supplierId')}
                      {tab3Columns.price && renderSortHeader('Price', 'price')}
                      {tab3Columns.decayPrice && renderSortHeader('Decay Price', 'decayPrice')}
                      {tab3Columns.blGross && renderSortHeader('BL Gross Weight', 'blGrossWeight')}
                      {tab3Columns.blNet && renderSortHeader('BL Net Weight', 'blNetWeight')}
                      {tab3Columns.decayNet && renderSortHeader('Decay Net Weight', 'decayNetWeight')}
                      {tab3Columns.rebate && renderSortHeader('Rebate', 'rebate')}
                      {tab3Columns.amount && renderSortHeader('Amount', 'amount')}
                      {tab3Columns.driverName && renderSortHeader('Driver Name', 'driverName')}
                      {tab3Columns.plateNumber && renderSortHeader('Plate Number', 'plateNumber')}
                      {tab3Columns.transportCost && renderSortHeader('Transport Cost', 'transportCost')}
                      {tab3Columns.workersCost && renderSortHeader('Workers Cost', 'workerCost')}
                      {tab3Columns.cabraneCost && renderSortHeader('Cabrane Cost', 'costPaidByFarmer')}
                      {tab3Columns.shiftDate && renderSortHeader('Shift Date', 'shiftDate')}
                      {tab3Columns.createdBy && renderSortHeader('Created By', 'createdBy')}
                      {tab3Columns.createdAt && renderSortHeader('Created At', 'createdAt')}
                      {tab3Columns.updatedBy && renderSortHeader('Updated By', 'updatedBy')}
                      {tab3Columns.updatedAt && renderSortHeader('Updated At', 'updatedAt')}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={20} className="h-64 text-center"><Loader2 className="h-8 w-8 animate-spin text-[#7a9800] mx-auto" /></TableCell></TableRow>
                    ) : tab3Paginated.length === 0 ? (
                      <TableRow><TableCell colSpan={20} className="h-64 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No raw material lots found</TableCell></TableRow>
                    ) : (
                      tab3Paginated.map(rm => {
                        const blNetWeight = Number(rm.blNetWeight != null ? rm.blNetWeight : (rm.totalNetWeight || 0));
                        const decayNetWeight = Number(rm.totalDecayNetWeight || rm.decayNetWeight || 0);
                        const price = Number(rm.price || rm.unitPrice || 0);
                        const decayPrice = Number(rm.decayPrice || 0);
                        const finalTotalAmount = computeFinalAmount(rm);
                        const amount = finalTotalAmount;
                        const currency = rm.currency || 'MAD';

                        const formattedCreatedAt = rm.createdAt?.toDate 
                          ? format(rm.createdAt.toDate(), 'yyyy-MM-dd HH:mm') 
                          : rm.createdAt ? String(rm.createdAt) : '—';
                        
                        const formattedUpdatedAt = rm.updatedAt?.toDate 
                          ? format(rm.updatedAt.toDate(), 'yyyy-MM-dd HH:mm') 
                          : rm.updatedAt ? String(rm.updatedAt) : '—';

                        return (
                          <TableRow key={rm.id} className="hover:bg-slate-50/50 transition-all border-b border-slate-100 last:border-none group">
                            
                            {/* Actions menu */}
                            <TableCell className={cn("pl-6 md:pl-8", densityPaddingClass)}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-lg">
                                    <MoreVertical className="h-4 w-4 text-slate-400 group-hover:text-slate-700" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="rounded-xl border-slate-100 shadow-xl p-1 bg-white w-32">
                                  <DropdownMenuItem 
                                    onClick={() => router.push(`/raw-material-pricing/${rm.id}/edit`)}
                                    className="font-bold gap-2 cursor-pointer py-2 px-3 text-xs text-slate-700 hover:bg-slate-50 rounded-lg"
                                  >
                                    <Edit size={13} className="text-[#7a9800]" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setRecordToDelete(rm);
                                      setIsDeleteConfirmOpen(true);
                                    }}
                                    className="font-bold gap-2 cursor-pointer py-2 px-3 text-xs text-rose-600 hover:bg-rose-50 rounded-lg"
                                  >
                                    <Trash2 size={13} className="text-rose-500" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>

                            {/* Lot Number - styled exactly as green link */}
                            {tab3Columns.lotNumber && (
                              <TableCell className={cn("font-black whitespace-nowrap", densityPaddingClass)}>
                                <Link href={`/raw-material-pricing/${rm.id}/edit`}>
                                  <span className="text-[#7a9800] hover:underline cursor-pointer flex items-center gap-1">
                                    {rm.lotNumber} <ExternalLink size={10} className="opacity-40" />
                                  </span>
                                </Link>
                              </TableCell>
                            )}

                            {/* Supplier */}
                            {tab3Columns.supplier && (
                              <TableCell className={cn("font-bold text-slate-700 whitespace-nowrap", densityPaddingClass)}>
                                {getSupName(rm.supplierId)}
                              </TableCell>
                            )}

                            {/* Price */}
                            {tab3Columns.price && (
                              <TableCell className={cn("font-black text-slate-800 text-right whitespace-nowrap", densityPaddingClass)}>
                                {rm.price || rm.unitPrice ? `${Number(rm.price || rm.unitPrice).toFixed(2)} ${currency}` : <span className="text-amber-500 font-bold italic text-xs">Pending</span>}
                              </TableCell>
                            )}

                            {/* Decay Price */}
                            {tab3Columns.decayPrice && (
                              <TableCell className={cn("font-semibold text-slate-600 text-right whitespace-nowrap", densityPaddingClass)}>
                                {rm.decayPrice ? `${Number(rm.decayPrice).toFixed(2)} ${currency}` : '—'}
                              </TableCell>
                            )}

                            {/* BL Gross Weight */}
                            {tab3Columns.blGross && (
                              <TableCell className={cn("font-semibold text-slate-600 text-right whitespace-nowrap", densityPaddingClass)}>
                                {rm.blGrossWeight ? `${Number(rm.blGrossWeight).toLocaleString()} kg` : '—'}
                              </TableCell>
                            )}

                            {/* BL Net Weight */}
                            {tab3Columns.blNet && (
                              <TableCell className={cn("font-semibold text-slate-600 text-right whitespace-nowrap", densityPaddingClass)}>
                                {rm.blNetWeight ? `${Number(rm.blNetWeight).toLocaleString()} kg` : '—'}
                              </TableCell>
                            )}

                            {/* Decay Net Weight */}
                            {tab3Columns.decayNet && (
                              <TableCell className={cn("font-medium text-slate-500 text-right whitespace-nowrap", densityPaddingClass)}>
                                {decayNetWeight ? `${decayNetWeight.toLocaleString()} kg` : '—'}
                              </TableCell>
                            )}

                            {/* Rebate */}
                            {tab3Columns.rebate && (
                              <TableCell className={cn("font-medium text-slate-500 text-right whitespace-nowrap", densityPaddingClass)}>
                                {rm.rebate ? `${Number(rm.rebate).toFixed(1)} %` : '—'}
                              </TableCell>
                            )}

                            {/* Amount */}
                            {tab3Columns.amount && (
                              <TableCell className={cn("font-black text-[#2e1d52] text-right whitespace-nowrap", densityPaddingClass)}>
                                {amount === 'Pending' ? <span className="text-amber-500 font-bold italic text-xs">Pending</span> : `${amount.toLocaleString(undefined, {minimumFractionDigits: 2})} ${currency}`}
                              </TableCell>
                            )}

                            {/* Driver */}
                            {tab3Columns.driverName && (
                              <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                                {rm.driverName || '—'}
                              </TableCell>
                            )}

                            {/* Plate */}
                            {tab3Columns.plateNumber && (
                              <TableCell className={cn("font-semibold text-slate-600 whitespace-nowrap uppercase", densityPaddingClass)}>
                                {rm.plateNumber || '—'}
                              </TableCell>
                            )}

                            {/* Transport Cost */}
                            {tab3Columns.transportCost && (
                              <TableCell className={cn("font-semibold text-slate-600 text-right whitespace-nowrap", densityPaddingClass)}>
                                {rm.transportCost ? `${Number(rm.transportCost).toFixed(2)} ${currency}` : '—'}
                              </TableCell>
                            )}

                            {/* Workers Cost */}
                            {tab3Columns.workersCost && (
                              <TableCell className={cn("font-semibold text-slate-600 text-right whitespace-nowrap", densityPaddingClass)}>
                                {rm.workerCost ? `${Number(rm.workerCost).toFixed(2)} ${currency}` : '—'}
                              </TableCell>
                            )}

                            {/* Cabrane Cost */}
                            {tab3Columns.cabraneCost && (
                              <TableCell className={cn("font-semibold text-slate-600 text-right whitespace-nowrap", densityPaddingClass)}>
                                {rm.costPaidByFarmer ? `${Number(rm.costPaidByFarmer).toFixed(2)} ${currency}` : '—'}
                              </TableCell>
                            )}

                            {/* Shift Date */}
                            {tab3Columns.shiftDate && (
                              <TableCell className={cn("font-bold text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                                {rm.date || (rm.dateTime ? rm.dateTime.substring(0, 10) : '—')}
                              </TableCell>
                            )}

                            {/* Created By */}
                            {tab3Columns.createdBy && (
                              <TableCell className={cn("font-bold text-slate-600 whitespace-nowrap", densityPaddingClass)}>
                                {rm.createdBy?.split('@')[0] || rm.createdBy || '—'}
                              </TableCell>
                            )}

                            {/* Created At */}
                            {tab3Columns.createdAt && (
                              <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                                {formattedCreatedAt}
                              </TableCell>
                            )}

                            {/* Updated By */}
                            {tab3Columns.updatedBy && (
                              <TableCell className={cn("font-bold text-slate-600 whitespace-nowrap", densityPaddingClass)}>
                                {rm.updatedBy?.split('@')[0] || rm.updatedBy || '—'}
                              </TableCell>
                            )}

                            {/* Updated At */}
                            {tab3Columns.updatedAt && (
                              <TableCell className={cn("font-medium text-slate-500 whitespace-nowrap", densityPaddingClass)}>
                                {formattedUpdatedAt}
                              </TableCell>
                            )}

                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="p-4 md:p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>Showing {tab3Paginated.length} of {processedTab3List.length} lots</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled={tab3Page === 1} onClick={() => setTab3Page(p => Math.max(1, p - 1))} className="h-8 text-[10px] font-black uppercase"><ChevronLeft size={14} /> Prev</Button>
                  {Array.from({ length: totalTab3Pages }).map((_, i) => (
                    <Button key={i} onClick={() => setTab3Page(i + 1)} className={cn("h-8 w-8 rounded-lg text-[10px] font-black", tab3Page === i + 1 ? "bg-[#7a9800] text-white hover:bg-[#6c8500] shadow-md shadow-[#7a9800]/20" : "bg-transparent text-slate-600 hover:bg-slate-100")}>{i + 1}</Button>
                  ))}
                  <Button variant="ghost" size="sm" disabled={tab3Page === totalTab3Pages} onClick={() => setTab3Page(p => Math.min(totalTab3Pages, p + 1))} className="h-8 text-[10px] font-black uppercase">Next <ChevronRight size={14} /></Button>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

      {/* --- DELETE CONFIRMATION ALERT DIALOG --- */}
      <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl p-6 max-w-[450px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-[#2e1d52] uppercase tracking-tight">Delete Lot?</AlertDialogTitle>
            <AlertDialogDescription className="font-semibold text-slate-500 mt-2 text-sm leading-relaxed">
              Are you sure you want to delete this raw material pricing lot? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-6 border-t border-slate-50 pt-4 flex items-center justify-end">
            <AlertDialogCancel className="h-10 px-5 rounded-xl font-bold uppercase tracking-widest text-[10px] text-slate-500 hover:bg-slate-50 border-slate-200">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteLot} 
              className="h-10 px-6 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl shadow-lg shadow-rose-200 uppercase tracking-widest text-[10px]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
