'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  useUser,
} from '@/firebase';
import {
  collection as nativeCollection,
  getDocs as nativeGetDocs,
  updateDoc as nativeUpdateDoc,
  doc as nativeDoc
} from 'firebase/firestore';
import { generateRawMaterialDetailPDF } from '@/lib/export-raw-material-detail-pdf';
import {
  collection,
  query,
  orderBy,
  runTransaction,
  getDocs,
  writeBatch,
  doc,
  where
} from '@/firebase/firestore-override';
import { useSeason } from '@/contexts/SeasonContext';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Filter,
  X,
  Download,
  Plus,
  Package,
  LeafyGreen,
  Calendar,
  MapPin,
  Eye,
  MoreVertical,
  Edit,
  Trash2,
  Scale,
  FileText,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  exportRawMaterialsExcel,
  printRawMaterialsPDF,
  type RawMaterialExportRow,
} from '@/lib/export-raw-materials';
import { usePermissions } from '@/hooks/use-permissions';

export default function RawMaterialsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { canAdd, canUpdate, canDelete } = usePermissions('production.raw-materials');

  const [activeTab, setActiveTab] = useState('raw'); // raw | location | date-location
  const [filterSupplier, setFilterSupplier] = useState('all');
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const { toast } = useToast();

  const { currentSeason } = useSeason();
  const seasonsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'seasons');
  }, [db]);
  const { data: seasons } = useCollection(seasonsQuery);

  const allowedSeasonIds = useMemo(() => {
    if (!seasons || !currentSeason) return [];
    
    // Sort seasons by start_date ascending
    const sorted = [...seasons].sort((a, b) => {
      const aStart = a.start_date || a.start || '';
      const bStart = b.start_date || b.start || '';
      return aStart.localeCompare(bStart);
    });

    const currentIndex = sorted.findIndex(s => s.id === currentSeason.id);
    if (currentIndex === -1) return [currentSeason.id];

    // Return the current season and all previous seasons
    return sorted.slice(0, currentIndex + 1).map(s => s.id);
  }, [seasons, currentSeason]);

  const defaultSeason = useMemo(() => {
    return seasons?.find(s => s.isDefault);
  }, [seasons]);

  // Data Fetching
  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!db || !user || allowedSeasonIds.length === 0) return null;
    return query(
      collection(db, 'raw_materials'),
      where('season_id', 'in', allowedSeasonIds),
      orderBy('createdAt', 'desc')
    );
  }, [db, user, allowedSeasonIds]);

  const suppliersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'procurement_suppliers');
  }, [db, user]);

  const processingLinesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'processing_lines'); // Using processing lines as location source
  }, [db, user]);

  const productsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'products');
  }, [db, user]);

  const { data: rawMaterials, isLoading } = useCollection(rawMaterialsQuery);
  const { data: suppliers } = useCollection(suppliersQuery);
  const { data: locations } = useCollection(processingLinesQuery);
  const { data: products } = useCollection(productsQuery);

  // Helper to map IDs to Names
  const getLocName = (id: string) => locations?.find(l => l.id === id)?.title || id || 'Unknown';
  const getSupplierName = (id: string) => {
    const s = suppliers?.find(sup => sup.id === id);
    if (!s) return id || 'Unknown';
    return s.name || s.supplierName || id || 'Unknown';
  };

  // Filtering Logic
  const filteredMaterials = useMemo(() => {
    if (!rawMaterials) return [];
    return rawMaterials.filter(rm => {
      let matchesSupplier = filterSupplier === 'all' || rm.supplierId === filterSupplier;
      
      let matchesDate = true;
      if (filterDateStart && filterDateEnd) {
        // Assuming rm.dateTime is YYYY-MM-DD or a comparable ISO date string
        matchesDate = rm.dateTime >= filterDateStart && rm.dateTime <= filterDateEnd;
      }

      return matchesSupplier && matchesDate;
    });
  }, [rawMaterials,
     filterSupplier, filterDateStart, filterDateEnd]);

  const deleteRawMaterial = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this intake record? This will also delete all associated pallets.')) return;
    try {
      // Delete pallets from flat collection
      const palletsQuery = query(
        collection(db!, 'palletizations'),
        where('rawMaterialId', '==', id)
      );
      const palletsSnap = await getDocs(palletsQuery);
      const batch = writeBatch(db!);
      palletsSnap.forEach((p: any) => batch.delete(p.ref));
      batch.delete(doc(db!, 'raw_materials', id));
      await batch.commit();
      toast({ title: 'Record Deleted', description: 'Intake and pallets removed successfully.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // KPI Calculations
  const kpis = useMemo(() => {
    let totalNetWeight = 0;
    let totalDecayNetWeight = 0;
    let totalBLNetWeight = 0;

    filteredMaterials.forEach(rm => {
      const isCurrent = rm.season_id === currentSeason?.id || 
                        (!rm.season_id && currentSeason?.id === defaultSeason?.id);
      if (isCurrent) {
        totalNetWeight += Number(rm.totalNetWeight || 0);
        totalDecayNetWeight += Number(rm.totalDecayNetWeight || 0);
        totalBLNetWeight += Number(rm.blNetWeight || 0);
      }
    });

    return {
      totalNetWeight,
      totalDecayNetWeight,
      totalBLNetWeight
    };
  }, [filteredMaterials, currentSeason, defaultSeason]);

  // Aggregations
  const groupByLocationData = useMemo(() => {
    const map: Record<string, { locationId: string; locationName: string; blNetWeight: number; netWeight: number; decayNetWeight: number; count: number }> = {};

    filteredMaterials.forEach(rm => {
      const locId = rm.locationId || 'unknown';
      const locName = getLocName(rm.locationId);
      const key = locId;

      if (!map[key]) {
        map[key] = {
          locationId: locId,
          locationName: locName,
          blNetWeight: 0,
          netWeight: 0,
          decayNetWeight: 0,
          count: 0
        };
      }

      map[key].blNetWeight += Number(rm.blNetWeight || 0);
      map[key].netWeight += Number(rm.totalNetWeight || 0);
      map[key].decayNetWeight += Number(rm.totalDecayNetWeight || 0);
      map[key].count += 1;
    });

    return Object.values(map).sort((a, b) => b.netWeight - a.netWeight);
  }, [filteredMaterials, locations]);

  const groupByShiftDateAndLocationData = useMemo(() => {
    const map: Record<string, { shiftDate: string; locationId: string; locationName: string; blNetWeight: number; netWeight: number; decayNetWeight: number; count: number }> = {};

    filteredMaterials.forEach(rm => {
      const shiftDate = rm.shiftDate || rm.date || (rm.dateTime ? rm.dateTime.substring(0, 10) : 'No Date');
      const locId = rm.locationId || 'unknown';
      const locName = getLocName(rm.locationId);
      const key = `${shiftDate}__${locId}`;

      if (!map[key]) {
        map[key] = {
          shiftDate,
          locationId: locId,
          locationName: locName,
          blNetWeight: 0,
          netWeight: 0,
          decayNetWeight: 0,
          count: 0
        };
      }

      map[key].blNetWeight += Number(rm.blNetWeight || 0);
      map[key].netWeight += Number(rm.totalNetWeight || 0);
      map[key].decayNetWeight += Number(rm.totalDecayNetWeight || 0);
      map[key].count += 1;
    });

    return Object.values(map).sort((a, b) => {
      if (b.shiftDate !== a.shiftDate) return b.shiftDate.localeCompare(a.shiftDate);
      return b.netWeight - a.netWeight;
    });
  }, [filteredMaterials, locations]);

  // ── Export helpers ────────────────────────────────────────────────────────
  const buildExportRows = (onlyCurrentSeason = false): RawMaterialExportRow[] => {
    let list = filteredMaterials;
    if (onlyCurrentSeason) {
      list = list.filter(rm => rm.season_id === currentSeason?.id || (!rm.season_id && currentSeason?.id === defaultSeason?.id));
    }
    return list.map((rm) => {
      const blNW  = Number(rm.blNetWeight       || 0);
      const netNW = Number(rm.totalNetWeight    || 0);
      const decNW = Number(rm.totalDecayNetWeight || 0);
      const dateStr = rm.dateTime
        ? format(new Date(rm.dateTime), 'yyyy-MM-dd HH:mm:ss')
        : '';
      return {
        lotNumber:        rm.lotNumber     || '',
        locationName:     getLocName(rm.locationId),
        dateTime:         dateStr,
        supplierName:     getSupplierName(rm.supplierId),
        plateNumber:      rm.plateNumber  || '',
        blNetWeight:      blNW,
        netWeight:        netNW,
        decayNetWeight:   decNW,
        weightDifference: Math.abs(blNW - netNW),
        boxesIn:          Number(rm.boxesIn || 0),
      };
    });
  };

  const handleExportExcel = () => exportRawMaterialsExcel(buildExportRows(true));
  const handleExportPDF   = () => printRawMaterialsPDF(buildExportRows(false), '/FFI_main.png');

  const handlePrintSingleRow = async (rm: any) => {
    try {
      toast({ title: 'Generating PDF', description: 'Please wait...' });
      
      const palletQuery = query(
        collection(db!, 'palletizations'),
        where('rawMaterialId', '==', rm.id)
      );
      const palletSnap = await getDocs(palletQuery);
      const pallets = palletSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const supplierName = getSupplierName(rm.supplierId);
      const locationName = getLocName(rm.locationId);
      const totalBoxes = pallets.reduce((sum: number, p: any) => sum + (Number(p.boxes) || 0), 0);
      const emptyBoxes = (rm.emptyBoxes !== undefined) ? rm.emptyBoxes : (Number(rm.boxesIn || 0) - totalBoxes);

      await generateRawMaterialDetailPDF({
        ...rm,
        supplierName,
        locationName,
        emptyBoxes,
        totalNetWeight: rm.totalNetWeight || 0,
        blNetWeight: rm.blNetWeight || 0,
        blGrossWeight: rm.blGrossWeight || 0,
        boxesIn: rm.boxesIn || 0,
        boxesOut: rm.boxesOut || 0,
        products: products || [],
        pallets: pallets,
        weightDifference: Math.abs(Number(rm.blNetWeight || 0) - Number(rm.totalNetWeight || 0))
      });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  const handlePrintLotInfo = async (rm: any) => {
    try {
      toast({ title: 'Generating Lot Info PDF', description: 'Please wait...' });
      const { generateLotInfoPDF } = await import('@/lib/export-lot-info-pdf');
      
      const palletQuery = query(
        collection(db!, 'palletizations'),
        where('rawMaterialId', '==', rm.id)
      );
      const palletSnap = await getDocs(palletQuery);
      const pallets = palletSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const supplierName = getSupplierName(rm.supplierId);
      const locationName = getLocName(rm.locationId);
      const totalBoxes = pallets.reduce((sum: number, p: any) => sum + (Number(p.boxes) || 0), 0);
      const emptyBoxes = (rm.emptyBoxes !== undefined) ? rm.emptyBoxes : (Number(rm.boxesIn || 0) - totalBoxes);

      await generateLotInfoPDF({
        ...rm,
        supplierName,
        locationName,
        emptyBoxes,
        totalNetWeight: rm.totalNetWeight || 0,
        blNetWeight: rm.blNetWeight || 0,
        blGrossWeight: rm.blGrossWeight || 0,
        boxesIn: rm.boxesIn || 0,
        products: products || [],
        pallets: pallets,
        weightDifference: Math.abs(Number(rm.blNetWeight || 0) - Number(rm.totalNetWeight || 0))
      });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate Lot Info PDF', variant: 'destructive' });
    }
  };

  const handlePrintRawMaterialQuality = async (rm: any) => {
    try {
      toast({ title: 'Generating RM Quality PDF', description: 'Please wait...' });
      const { generateRawMaterialQualityPDF } = await import('@/lib/export-raw-material-quality-pdf');
      
      const palletQuery = query(
        collection(db!, 'palletizations'),
        where('rawMaterialId', '==', rm.id)
      );
      const palletSnap = await getDocs(palletQuery);
      const pallets = palletSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Use farmName as fournisseur for RM Quality PDF
      const supplierName = rm.farmName || rm.farmCodification || getSupplierName(rm.supplierId);
      const locationName = getLocName(rm.locationId);
      const totalBoxes = pallets.reduce((sum: number, p: any) => sum + (Number(p.boxes) || 0), 0);
      const emptyBoxes = (rm.emptyBoxes !== undefined) ? rm.emptyBoxes : (Number(rm.boxesIn || 0) - totalBoxes);

      await generateRawMaterialQualityPDF({
        ...rm,
        supplierName,
        locationName,
        emptyBoxes,
        totalNetWeight: rm.totalNetWeight || 0,
        blNetWeight: rm.blNetWeight || 0,
        blGrossWeight: rm.blGrossWeight || 0,
        boxesIn: rm.boxesIn || 0,
        products: products || [],
        pallets: pallets,
        weightDifference: Math.abs(Number(rm.blNetWeight || 0) - Number(rm.totalNetWeight || 0))
      });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate RM Quality PDF', variant: 'destructive' });
    }
  };

  return (
    <div className="w-full p-8 space-y-10 animate-in fade-in duration-700 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <span>Profile</span>
            <span className="opacity-40">/</span>
            <span className="text-primary uppercase">Raw Materials Listing</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-primary uppercase">Raw Materials</h1>
          <p className="text-muted-foreground font-medium">Manage intake, track precise agricultural yields, and monitor stock.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* ── Export dropdown ─────────────────────────────────────────── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={filteredMaterials.length === 0}
                className="gap-2 border-primary/20 text-primary hover:bg-primary/5 h-12 px-6 rounded-xl font-bold transition-all uppercase tracking-widest disabled:opacity-50"
              >
                <Download size={18} />
                Export
                {filteredMaterials.length > 0 && (
                  <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-black">
                    {filteredMaterials.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-xl border-primary/10">
              <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                Export Options
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleExportExcel}
                className="gap-2 font-bold text-[12px] py-2.5 cursor-pointer"
              >
                <FileSpreadsheet size={16} className="text-emerald-600" />
                Download Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleExportPDF}
                className="gap-2 font-bold text-[12px] py-2.5 cursor-pointer"
              >
                <Printer size={16} className="text-rose-500" />
                Print / Save as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {canAdd && (
            <Button asChild className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 h-12 px-8 rounded-xl font-bold uppercase tracking-widest transition-all">
              <Link href="/production/raw-materials/add">
                <Plus size={18} /> Add Raw Material
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <LeafyGreen size={80} />
          </div>
          <CardContent className="p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-2">Total Net Weight</p>
            <div className="flex items-baseline gap-2">
              <h2 className="text-4xl font-black">{kpis.totalNetWeight.toLocaleString()}</h2>
              <span className="text-sm font-bold opacity-80 uppercase tracking-widest">KG</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-xl rounded-3xl bg-white ring-1 ring-primary/5 overflow-hidden">
          <CardContent className="p-8 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 flex items-center gap-1.5"><Package size={12}/> Total Decay Net Weight</p>
              <div className="flex items-baseline gap-2 text-rose-600">
                <h2 className="text-3xl font-black">{kpis.totalDecayNetWeight.toLocaleString()}</h2>
                <span className="text-xs font-bold uppercase tracking-widest">KG</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-3xl bg-white ring-1 ring-primary/5 overflow-hidden">
          <CardContent className="p-8 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 flex items-center gap-1.5"><Scale size={12}/> Total BL Net Weight</p>
              <div className="flex items-baseline gap-2 text-primary">
                <h2 className="text-3xl font-black">{kpis.totalBLNetWeight.toLocaleString()}</h2>
                <span className="text-xs font-bold uppercase tracking-widest">KG</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden ring-1 ring-primary/5">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4 border-b border-primary/5">
          <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest opacity-80">
            <Filter size={14} /> Filter Matrix
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-6">
            <div className="space-y-1.5 w-full sm:w-[240px]">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Supplier</Label>
              <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-bold">
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ALL SUPPLIERS</SelectItem>
                  {suppliers?.map(s => (
                    <SelectItem key={s.id} value={s.id} className="font-bold">{s.name || s.supplierName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 w-full sm:w-[180px]">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Start Date</Label>
              <Input
                type="date"
                className="h-11 rounded-xl bg-muted/30 border-none font-bold"
                value={filterDateStart}
                onChange={e => setFilterDateStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 w-full sm:w-[180px]">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">End Date</Label>
              <Input
                type="date"
                className="h-11 rounded-xl bg-muted/30 border-none font-bold"
                value={filterDateEnd}
                onChange={e => setFilterDateEnd(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2 flex-grow sm:flex-grow-0">
              <Button className="h-11 bg-primary hover:bg-primary/90 rounded-xl font-black uppercase tracking-widest gap-2 px-8">
                <Search size={16} /> Filter
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-xl border-primary/10 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors"
                onClick={() => {
                  setFilterSupplier('all');
                  setFilterDateStart('');
                  setFilterDateEnd('');
                }}
              >
                <X size={18} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs & Data Display */}
      <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
        <TabsList className="bg-primary/5 h-auto p-1.5 flex-wrap justify-start gap-2 mb-8 rounded-2xl border border-primary/5">
          <TabsTrigger value="date-location" className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl px-6 py-2.5 font-black uppercase text-[10px] tracking-widest transition-all">
            Group By Shift Date & Location
          </TabsTrigger>
          <TabsTrigger value="location" className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl px-6 py-2.5 font-black uppercase text-[10px] tracking-widest transition-all">
            Group By Location
          </TabsTrigger>
          <TabsTrigger value="raw" className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl px-6 py-2.5 font-black uppercase text-[10px] tracking-widest transition-all">
            Raw Materials (Default) {filteredMaterials.length > 0 && `(${filteredMaterials.length})`}
          </TabsTrigger>
        </TabsList>

        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden w-full">
          {activeTab === 'raw' && (
            <div style={{ overflowX: 'auto' }}>
              <div className="min-w-[1400px]">
                <Table>
                  <TableHeader className="bg-primary/5">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="w-[50px] py-6 pl-8"></TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 whitespace-nowrap">Lot Number</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 whitespace-nowrap">Location</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 whitespace-nowrap">Date Time</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 whitespace-nowrap">Supplier</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 whitespace-nowrap">Plate Number</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 whitespace-nowrap">BL Net</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 whitespace-nowrap">Decay Net</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 whitespace-nowrap">Weight Diff</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 whitespace-nowrap">Net Weight</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 whitespace-nowrap">Boxes IN</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 whitespace-nowrap">Created Info</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 pr-8 text-right whitespace-nowrap">Updated Info</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-none">
                          <TableCell colSpan={11} className="py-6 px-6"><Skeleton className="h-10 w-full rounded-xl" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredMaterials.length === 0 ? (
                      <TableRow className="border-none">
                        <TableCell colSpan={11} className="h-64 text-center text-muted-foreground font-medium italic opacity-60">
                          <div className="flex flex-col items-center gap-3">
                            <Scale className="h-12 w-12 opacity-10" />
                            <p>No raw materials found.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMaterials.map((rm) => (
                        <TableRow key={rm.id} className="hover:bg-primary/[0.03] transition-all border-b border-muted/20">
                          <TableCell className="pl-8">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-primary/10 rounded-lg">
                                  <MoreVertical size={16} className="text-slate-400" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-40 rounded-xl shadow-xl border-primary/5">
                                <DropdownMenuItem onClick={() => handlePrintSingleRow(rm)} className="font-bold text-[11px] uppercase tracking-wider gap-2 py-2 text-indigo-600">
                                  <Printer size={14} /> Print Raw Material
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handlePrintLotInfo(rm)} className="font-bold text-[11px] uppercase tracking-wider gap-2 py-2 text-indigo-600">
                                  <FileText size={14} /> Print LotInfo
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handlePrintRawMaterialQuality(rm)} className="font-bold text-[11px] uppercase tracking-wider gap-2 py-2 text-indigo-600">
                                  <FileText size={14} /> Print Raw Material Quality
                                </DropdownMenuItem>
                                {canUpdate && (
                                  <DropdownMenuItem onClick={() => router.push(`/production/raw-materials/${rm.id}/edit`)} className="font-bold text-[11px] uppercase tracking-wider gap-2 py-2 text-amber-500">
                                    <Edit size={14} /> Edit
                                  </DropdownMenuItem>
                                )}
                                {canDelete && (
                                  <DropdownMenuItem onClick={() => deleteRawMaterial(rm.id)} className="font-bold text-[11px] uppercase tracking-wider gap-2 py-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer">
                                    <Trash2 size={14} /> Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell>
                            <Link href={`/production/raw-materials/${rm.id}`}>
                              <span className="font-black text-xs text-[#708238] hover:text-[#556B2F] bg-primary/5 px-3 py-1.5 rounded-lg border border-primary/10 cursor-pointer underline hover:no-underline tracking-wider transition-all">
                                {rm.lotNumber}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span className="font-black text-[10px] text-primary/70 uppercase tracking-tight bg-primary/5 px-2 py-1 rounded-md">{getLocName(rm.locationId)}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 opacity-80">
                              <Calendar size={12} className="text-primary/60" />
                              <span className="font-black text-[10px] uppercase tracking-wider">{rm.dateTime ? format(new Date(rm.dateTime), 'MMM dd, yyyy HH:mm') : '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-[11px] uppercase">{getSupplierName(rm.supplierId)}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-black text-[10px] uppercase tracking-widest text-muted-foreground border border-muted-foreground/20 px-2 py-0.5 rounded shadow-sm">{rm.plateNumber}</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-xs">{rm.blNetWeight} <span className="text-[9px] opacity-60">KG</span></span>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-xs text-rose-600">{rm.totalDecayNetWeight || 0} <span className="text-[9px] opacity-60">KG</span></span>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-xs text-blue-600">
                              {Math.abs(Number(rm.blNetWeight || 0) - Number(rm.totalNetWeight || 0)).toFixed(2)} <span className="text-[9px] opacity-60">KG</span>
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md inline-block">
                              <span className="font-black text-xs">{rm.totalNetWeight} <span className="text-[9px] opacity-60">KG</span></span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-black text-xs text-sky-600">{rm.boxesIn}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black uppercase tracking-wider">{rm.createdBy?.split('@')[0]}</span>
                              <span className="text-[8px] opacity-50 font-bold uppercase">{rm.createdAt ? format(new Date(rm.createdAt.seconds ? rm.createdAt.toDate() : rm.createdAt), 'dd/MM/yyyy') : '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="pr-8 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{rm.updatedBy?.split('@')[0]}</span>
                              <span className="text-[8px] opacity-50 font-bold uppercase">{rm.updatedAt ? format(new Date(rm.updatedAt.seconds ? rm.updatedAt.toDate() : rm.updatedAt), 'dd/MM/yyyy') : '-'}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {activeTab === 'location' && (
            <div style={{ overflowX: 'auto' }}>
              <div className="min-w-[800px]">
                <Table>
                  <TableHeader className="bg-primary/5">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 pl-8">Location</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 text-right">Net Weight</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 text-right">Decay Net Weight</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 text-right pr-8">No of Receptions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupByLocationData.length === 0 ? (
                      <TableRow className="border-none">
                        <TableCell colSpan={4} className="h-48 text-center text-muted-foreground font-medium italic">
                          No location data available.
                        </TableCell>
                      </TableRow>
                    ) : (
                      groupByLocationData.map((item) => (
                        <TableRow key={item.locationId} className="hover:bg-primary/[0.03] transition-all border-b border-muted/20">
                          <TableCell className="pl-8 py-5">
                            <Link href={`/production/raw-materials/group-by-location/${encodeURIComponent(item.locationId)}`}>
                              <span className="font-black text-xs text-[#708238] hover:underline bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200/60 cursor-pointer">
                                {item.locationName}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-black text-xs text-slate-800">
                            {item.netWeight.toFixed(2)} <span className="text-[9px] text-slate-400 uppercase">(KG)</span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs text-rose-600">
                            {item.decayNetWeight.toFixed(2)} <span className="text-[9px] text-rose-400 uppercase">(KG)</span>
                          </TableCell>
                          <TableCell className="pr-8 text-right font-black text-xs text-slate-700">
                            {item.count}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {activeTab === 'date-location' && (
            <div style={{ overflowX: 'auto' }}>
              <div className="min-w-[1000px]">
                <Table>
                  <TableHeader className="bg-primary/5">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 pl-8">Shift Date</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6">Location</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 text-right">BL Net Weight</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 text-right">Net Weight</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 text-right">Decay Net Weight</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80 py-6 text-right pr-8">No of Receptions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupByShiftDateAndLocationData.length === 0 ? (
                      <TableRow className="border-none">
                        <TableCell colSpan={6} className="h-48 text-center text-muted-foreground font-medium italic">
                          No shift date & location data available.
                        </TableCell>
                      </TableRow>
                    ) : (
                      groupByShiftDateAndLocationData.map((item) => (
                        <TableRow key={`${item.shiftDate}__${item.locationId}`} className="hover:bg-primary/[0.03] transition-all border-b border-muted/20">
                          <TableCell className="pl-8 py-5 text-xs font-bold text-slate-700">
                            {item.shiftDate}
                          </TableCell>
                          <TableCell>
                            <Link href={`/production/raw-materials/group-by-shift-date-and-location/${encodeURIComponent(`${item.shiftDate}__${item.locationId}`)}`}>
                              <span className="font-black text-xs text-[#708238] hover:underline bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200/60 cursor-pointer">
                                {item.locationName}
                              </span>
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs text-slate-700">
                            {item.blNetWeight.toFixed(2)} <span className="text-[9px] text-slate-400 uppercase">(KG)</span>
                          </TableCell>
                          <TableCell className="text-right font-black text-xs text-slate-800">
                            {item.netWeight.toFixed(2)} <span className="text-[9px] text-slate-400 uppercase">(KG)</span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs text-rose-600">
                            {item.decayNetWeight.toFixed(2)} <span className="text-[9px] text-rose-400 uppercase">(KG)</span>
                          </TableCell>
                          <TableCell className="pr-8 text-right font-black text-xs text-slate-700">
                            {item.count}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </Card>
      </Tabs>
    </div>
  );
}
