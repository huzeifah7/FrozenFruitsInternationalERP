'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  useUser
} from '@/firebase';
import { useSeason } from '@/contexts/SeasonContext';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc
} from '@/firebase/firestore-override';
import { Card, CardContent } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/components/auth-provider';
import { canAdd } from '@/lib/permissions';
import {
  Download,
  Layers,
  Plus,
  Search,
  ChevronRight,
  ArrowUpDown,
  MoreVertical,
  Equal
} from 'lucide-react';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { exportMasterTableExcel } from '@/lib/export-master-table';

function getPrevShiftDateAndShift(date: string, shift: string): { prevDate: string; prevShift: string } {
  if (shift === '1') {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return { prevDate: `${y}-${m}-${day}`, prevShift: '2' };
  } else {
    return { prevDate: date, prevShift: '1' };
  }
}

function getPrevShiftKey(date: string, shift: string, locationName: string): string {
  const { prevDate, prevShift } = getPrevShiftDateAndShift(date, shift);
  return `${prevDate}_${prevShift}_${locationName}`;
}

export function getShiftDateAndShift(dateTimeStr: string): { shiftDate: string; shift: string } {
  if (!dateTimeStr) return { shiftDate: '', shift: '' };
  const dt = new Date(dateTimeStr);
  if (isNaN(dt.getTime())) return { shiftDate: '', shift: '' };
  
  const hours = dt.getHours();
  const minutes = dt.getMinutes();
  const time = hours + minutes / 60;

  let shift = '';
  let shiftDateObj = new Date(dt);

  if (time >= 8 && time <= 19) {
    shift = '1';
  } else if (time >= 21 && time < 24) {
    shift = '2';
  } else if (time >= 0 && time <= 7) {
    shift = '2';
    shiftDateObj.setDate(shiftDateObj.getDate() - 1);
  }
  
  if (!shift) {
    if (time > 19 && time < 21) {
      shift = '1';
    }
  }

  const y = shiftDateObj.getFullYear();
  const m = String(shiftDateObj.getMonth() + 1).padStart(2, '0');
  const d = String(shiftDateObj.getDate()).padStart(2, '0');
  
  return { shiftDate: `${y}-${m}-${d}`, shift };
}

function getVarietyAbbreviation(v: string): string {
  if (!v) return '';
  const lower = v.toLowerCase();
  if (lower.includes('cherry')) return 'C';
  if (lower.includes('round')) return 'R';
  if (lower.includes('san marzano') || lower.includes('elongated')) return 'SM';
  if (lower.includes('beef')) return 'B';
  if (lower.includes('cocktail')) return 'CK';
  if (lower.includes('grape')) return 'G';
  if (lower.includes('medley')) return 'M';
  if (lower.includes('cluster')) return 'CL';
  if (lower.includes('roma')) return 'RO';
  return v.charAt(0).toUpperCase();
}

function getNextDay(dateStr: string) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function getWeekNumber(d: string | Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

// Searchable Checklist Component
function SearchableMultiSelect({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = "Search POs..."
}: {
  label: string;
  options: { id: string; label: string; subLabel?: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    return options.filter(opt => 
      opt.label.toLowerCase().includes(search.toLowerCase()) || 
      (opt.subLabel && opt.subLabel.toLowerCase().includes(search.toLowerCase()))
    );
  }, [options, search]);

  const toggleValue = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter(v => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const selectAll = () => {
    onChange(options.map(o => o.id));
  };

  const selectNone = () => {
    onChange([]);
  };

  return (
    <div className="space-y-2 relative border border-slate-200 rounded-xl p-3 bg-slate-50/30">
      <div className="flex justify-between items-center mb-1">
        <Label className="text-[10px] uppercase font-black text-[#2e1d52]">{label}</Label>
        <span className="text-[10px] font-bold text-slate-400">{selectedValues.length} selected</span>
      </div>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="h-9 pl-9 rounded-lg bg-white border-slate-200 text-xs w-full focus:ring-1 focus:ring-emerald-500"
        />
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button type="button" onClick={selectAll} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">All</button>
        <button type="button" onClick={selectNone} className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 px-2 py-0.5 rounded">None</button>
      </div>
      <div className="mt-2 max-h-40 overflow-y-auto space-y-1 custom-scrollbar pr-1 bg-white border border-slate-100 rounded-lg p-1">
        {filtered.length === 0 && (
          <div className="text-center py-4 text-xs text-slate-400">No POs found</div>
        )}
        {filtered.map(opt => (
          <label key={opt.id} className="flex items-center gap-2.5 p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors group">
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                checked={selectedValues.includes(opt.id)}
                onChange={() => toggleValue(opt.id)}
                className="peer h-4 w-4 shrink-0 rounded-[4px] border-2 border-slate-300 bg-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 appearance-none transition-all checked:border-emerald-600 checked:bg-emerald-600 cursor-pointer"
              />
              <svg className="absolute w-2.5 h-2.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex flex-col flex-1">
              <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700 transition-colors">{opt.label}</span>
              {opt.subLabel && <span className="text-[10px] font-medium text-slate-400">{opt.subLabel}</span>}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function ProductionInventoriesPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { profile } = useAuthContext();
  const { toast } = useToast();
  const { previousSeason } = useSeason();

  const canGenerate = canAdd(profile, 'production.inventories');

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [modalStartDate, setModalStartDate] = useState('');
  const [modalEndDate, setModalEndDate] = useState('');
  const [modalLocationId, setModalLocationId] = useState('');
  const [modalLoadedPOs, setModalLoadedPOs] = useState<string[]>([]);
  const [modalPOonStock, setModalPOonStock] = useState<string[]>([]);

  const inventoriesQuery = useMemoFirebase(() => db ? query(collection(db, 'production_inventories'), orderBy('createdAt', 'desc')) : null, [db]);
  const { data: savedInventories, isLoading: loadingInventories } = useCollection(inventoriesQuery);

  const seasonsQuery = useMemoFirebase(() => db ? collection(db, 'seasons') : null, [db]);
  const { data: seasons } = useCollection(seasonsQuery);

  useEffect(() => {
    if (seasons !== undefined && !modalStartDate && !modalEndDate) {
      if (seasons && seasons.length > 0) {
        const active = seasons.find((s: any) => s.status === 'Active');
        if (active) {
          setModalStartDate(active.start);
          setModalEndDate(active.end);
          return;
        }
      }
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      setModalStartDate(start.toISOString().split('T')[0]);
      setModalEndDate(end.toISOString().split('T')[0]);
    }
  }, [seasons, modalStartDate, modalEndDate]);

  const locationsQuery = useMemoFirebase(() => db ? collection(db, 'processing_lines') : null, [db]);
  const { data: locations, isLoading: loadingLocations } = useCollection(locationsQuery);

  useEffect(() => {
    if (locations && locations.length > 0 && !modalLocationId) {
      setModalLocationId(locations[0].id);
    }
  }, [locations, modalLocationId]);

  const ordersQuery = useMemoFirebase(() => db ? collection(db, 'orders') : null, [db]);
  const { data: orders, isLoading: loadingOrders } = useCollection(ordersQuery);

  const pfStockPOsOptions = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o: any) => 
      ['confirmed', 'in-production', 'produced'].includes(o.status?.toLowerCase())
    );
  }, [orders]);

  const pfcPOsOptions = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o: any) => 
      ['shipped', 'produced', 'delivered'].includes(o.status?.toLowerCase())
    );
  }, [orders]);

  useEffect(() => {
    if (orders && orders.length > 0 && modalLoadedPOs.length === 0 && modalPOonStock.length === 0) {
      const loaded = orders.filter((o: any) => 
        ['produced', 'shipped', 'delivered'].includes(o.status?.toLowerCase())
      ).map((o: any) => o.poNumber || o.id);
      setModalLoadedPOs(loaded);

      const stock = orders.filter((o: any) => 
        ['confirmed', 'in-production', 'produced'].includes(o.status?.toLowerCase())
      ).map((o: any) => o.poNumber || o.id);
      setModalPOonStock(stock);
    }
  }, [orders, modalLoadedPOs.length, modalPOonStock.length]);

  const pageLoading = loadingInventories || loadingLocations || loadingOrders;

  const handleGenerateInventory = async () => {
    if (!modalStartDate || !modalEndDate || !modalLocationId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (dates and location).",
        variant: "destructive"
      });
      return;
    }
    if (!db) return;

    setIsGenerating(true);
    
    try {
      let fetchStart = modalStartDate;
      try {
        const d = new Date(modalStartDate);
        d.setDate(d.getDate() - 2);
        fetchStart = d.toISOString().split('T')[0];
      } catch (e) {}

      const rmSnap = await getDocs(query(collection(db, 'raw_materials'), where('date', '>=', fetchStart), where('date', '<=', modalEndDate)));
      const rawMaterials = rmSnap.docs.map(d => d.data());

      const pfSnap = await getDocs(query(collection(db, 'production_feeds'), where('date', '>=', fetchStart), where('date', '<=', modalEndDate)));
      const productionFeeds = pfSnap.docs.map(d => d.data());

      const poSnap = await getDocs(query(collection(db, 'production_output'), where('shiftDate', '>=', fetchStart), where('shiftDate', '<=', modalEndDate)));
      const productionOutputs = poSnap.docs.map(d => d.data());

      const locationMap: Record<string, string> = {};
      locations?.forEach((l: any) => {
        locationMap[l.id] = l.title || l.name || 'Unknown';
      });

      const groups: Record<string, any> = {};

      const getGroup = (date: string, shift: string, locationName: string) => {
        const key = `${date}_${shift}_${locationName}`;
        if (!groups[key]) {
          groups[key] = {
            key, date, shift, locationName,
            mpBonCamion: 0, mpPesee: 0, difference: 0, dechetMp: 0,
            mpProduct: 0, retour: 0, produitsFinis: 0, outOfProgram: 0,
            reste: 0, dechetProduction: 0, localMarket: 0
          };
        }
        return groups[key];
      };

      rawMaterials.forEach((rm: any) => {
        const { shiftDate, shift } = getShiftDateAndShift(rm.dateTime || rm.createdAt);
        if (!shiftDate) return;
        const locationName = locationMap[rm.locationId] || rm.locationName || 'Unknown';
        const g = getGroup(shiftDate, shift, locationName);
        g.mpBonCamion += Number(rm.blNetWeight || 0);
        g.mpPesee += Number(rm.totalNetWeight || rm.net_weight || 0);
        g.dechetMp += Number(rm.totalDecayNetWeight || rm.decay_weight || rm.decayWeight || 0);
      });

      productionFeeds.forEach((f: any) => {
        if (!f.dateTime) return;
        const { shiftDate, shift } = getShiftDateAndShift(f.dateTime);
        if (!shiftDate) return;
        const locationName = f.locationName || locationMap[f.locationId] || 'Unknown';
        const g = getGroup(shiftDate, shift, locationName);
        if (f.sourceType === 'RAW_MATERIAL') g.mpProduct += Number(f.netWeight || 0);
      });

      productionOutputs.forEach((out: any) => {
        const shiftDate = out.shiftDate;
        const shift = out.shift;
        if (!shiftDate || !shift) return;
        const locationName = out.locationName || locationMap[out.locationId] || 'Unknown';
        const g = getGroup(shiftDate, shift, locationName);

        const palletWeight = out.items?.reduce((sum: number, item: any) => sum + (Number(item.netWeight) || 0), 0) || 0;

        if (out.palletisationType === 'Final product') g.produitsFinis += palletWeight;
        else if (out.palletisationType === 'Out Of Program') g.outOfProgram += palletWeight;
        else if (out.palletisationType === 'Reste' || out.palletisationType === 'Pending') g.reste += palletWeight;
        else if (out.palletisationType === 'decay') g.dechetProduction += palletWeight;
        else if (out.palletisationType === 'Return') g.retour += palletWeight;
        else if (out.palletisationType === 'Local Market') g.localMarket += palletWeight;
      });

      const sortedChronological = Object.values(groups).sort((a: any, b: any) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.shift !== b.shift) return a.shift.localeCompare(b.shift);
        return a.locationName.localeCompare(b.locationName);
      });

      // Fetch previous season closing balances to serve as opening balances for the current season
      let openingMpEnStock = 0;
      let openingRetour = 0;
      let openingPfEnStock = 0;
      let openingHp = 0;
      let openingRestes = 0;
      if (previousSeason?.id) {
        try {
          const prevInvSnap = await getDocs(
            query(
              collection(db, 'production_inventories'), 
              where('season_id', '==', previousSeason.id), 
              orderBy('createdAt', 'desc')
            )
          );
          if (!prevInvSnap.empty) {
             const lastPrevInv = prevInvSnap.docs[0].data();
             const lastTotals = lastPrevInv.totals;
             if (lastTotals) {
               openingMpEnStock = lastTotals.mpEnStock || 0;
               openingRetour = lastTotals.retour || 0;
               openingPfEnStock = lastTotals.pfEnStock || 0;
               openingHp = lastTotals.outOfProgram || 0;
               openingRestes = lastTotals.restes || 0;
             }
          }
        } catch (e) {
          console.error("Error fetching previous season inventory for opening balances:", e);
        }
      }

      const computedMetrics: Record<string, { mpEnStock: number }> = {};
      sortedChronological.forEach((g: any, index: number) => {
        const prevKey = getPrevShiftKey(g.date, g.shift, g.locationName);
        let prevMetrics = computedMetrics[prevKey];
        if (!prevMetrics) {
           if (index === 0) {
             prevMetrics = { mpEnStock: openingMpEnStock };
           } else {
             prevMetrics = { mpEnStock: 0 };
           }
        }
        computedMetrics[g.key] = { mpEnStock: Math.max(0, prevMetrics.mpEnStock + g.mpPesee - g.mpProduct) };
      });

      const targetLocationName = locations?.find((l: any) => l.id === modalLocationId)?.title || 'Unknown';
      
      const filteredGroups = sortedChronological.filter((g: any) => 
        g.date >= modalStartDate && g.date <= modalEndDate && g.locationName === targetLocationName
      );

      const finalRows = filteredGroups.map((g: any, index: number) => {
        const prevKey = getPrevShiftKey(g.date, g.shift, g.locationName);
        const prevGroup = groups[prevKey];
        const prevMetrics = computedMetrics[prevKey] || { mpEnStock: 0 };
        const currentMetrics = computedMetrics[g.key] || { mpEnStock: 0 };
        
        let previousRetour = prevGroup ? prevGroup.retour : 0;
        let previousMPEnStock = prevMetrics.mpEnStock;
        let restes = prevGroup ? prevGroup.reste : 0;
        let previousHP = prevGroup ? prevGroup.outOfProgram : 0;

        // Apply opening balances for the very first shift if no previous history exists
        if (index === 0 && !prevGroup) {
            previousRetour = openingRetour;
            restes = openingRestes;
            previousHP = openingHp;
        }

        const currentPFOutputs = productionOutputs.filter((out: any) => 
          out.shiftDate === g.date && out.shift === g.shift && 
          (out.locationName === g.locationName || locationMap[out.locationId] === g.locationName) &&
          out.palletisationType === 'Final product' && modalPOonStock.includes(out.orderPoNumber || out.orderPoId)
        );
        const pfEnStock = currentPFOutputs.reduce((sum: number, out: any) => sum + (out.items?.reduce((s: number, i: any) => s + (Number(i.netWeight) || 0), 0) || 0), 0);

        const prevCalculated = getPrevShiftDateAndShift(g.date, g.shift);
        const prevPFOutputs = productionOutputs.filter((out: any) => 
          out.shiftDate === prevCalculated.prevDate && out.shift === prevCalculated.prevShift && 
          (out.locationName === g.locationName || locationMap[out.locationId] === g.locationName) &&
          out.palletisationType === 'Final product' && modalPOonStock.includes(out.orderPoNumber || out.orderPoId)
        );
        let previousPFEnStock = prevPFOutputs.reduce((sum: number, out: any) => sum + (out.items?.reduce((s: number, i: any) => s + (Number(i.netWeight) || 0), 0) || 0), 0);

        // Apply opening balances for the very first shift if no previous history exists
        if (index === 0 && !prevGroup && previousPFEnStock === 0) {
            previousPFEnStock = openingPfEnStock;
        }

        const currentChargedOutputs = productionOutputs.filter((out: any) => 
          out.shiftDate === g.date && out.shift === g.shift && 
          (out.locationName === g.locationName || locationMap[out.locationId] === g.locationName) &&
          out.palletisationType === 'Final product' && modalLoadedPOs.includes(out.orderPoNumber || out.orderPoId)
        );
        const produitCharge = currentChargedOutputs.reduce((sum: number, out: any) => sum + (out.items?.reduce((s: number, i: any) => s + (Number(i.netWeight) || 0), 0) || 0), 0);

        const pfInventaire = (previousPFEnStock + previousHP + restes) - pfEnStock - g.outOfProgram - g.reste;
        const diffPfcPf = pfInventaire - produitCharge;
        const perteReelle = g.mpPesee + previousRetour + previousMPEnStock - g.dechetMp - g.retour - pfInventaire - g.dechetProduction - currentMetrics.mpEnStock;
        const perteGlobale = g.mpBonCamion + previousRetour + previousMPEnStock + previousPFEnStock + previousHP + restes - pfEnStock - g.outOfProgram - g.reste - g.dechetMp - g.retour - produitCharge - g.dechetProduction - currentMetrics.mpEnStock;

        return {
          ...g,
          difference: g.mpBonCamion - g.mpPesee,
          mpEnStock: currentMetrics.mpEnStock,
          retour: previousRetour,
          pfEnStock, restes, pfInventaire, produitCharge, diffPfcPf,
          perteReelle, perteGlobale, resteACharger: pfEnStock
        };
      });

      const totals = {
        mpBonCamion: finalRows.reduce((sum, r) => sum + r.mpBonCamion, 0),
        mpPesee: finalRows.reduce((sum, r) => sum + r.mpPesee, 0),
        difference: finalRows.reduce((sum, r) => sum + r.difference, 0),
        dechetMp: finalRows.reduce((sum, r) => sum + r.dechetMp, 0),
        mpEnStock: finalRows.reduce((sum, r) => sum + r.mpEnStock, 0),
        mpProduct: finalRows.reduce((sum, r) => sum + r.mpProduct, 0),
        retour: finalRows.reduce((sum, r) => sum + r.retour, 0),
        produitsFinis: finalRows.reduce((sum, r) => sum + r.produitsFinis, 0),
        outOfProgram: finalRows.reduce((sum, r) => sum + r.outOfProgram, 0),
        pfEnStock: finalRows.reduce((sum, r) => sum + r.pfEnStock, 0),
        restes: finalRows.reduce((sum, r) => sum + r.restes, 0),
        pfInventaire: finalRows.reduce((sum, r) => sum + r.pfInventaire, 0),
        produitCharge: finalRows.reduce((sum, r) => sum + r.produitCharge, 0),
        diffPfcPf: finalRows.reduce((sum, r) => sum + r.diffPfcPf, 0),
        dechetProduction: finalRows.reduce((sum, r) => sum + r.dechetProduction, 0),
        perteReelle: finalRows.reduce((sum, r) => sum + r.perteReelle, 0),
        perteGlobale: finalRows.reduce((sum, r) => sum + r.perteGlobale, 0),
        localMarket: finalRows.reduce((sum, r) => sum + r.localMarket, 0),
        resteACharger: finalRows.reduce((sum, r) => sum + r.resteACharger, 0),
        totalConsumption: finalRows.reduce((sum, r) => sum + r.mpBonCamion, 0) - finalRows.reduce((sum, r) => sum + r.dechetMp, 0)
      };

      const newDoc = {
        period: `${modalStartDate} to ${modalEndDate}`,
        startDate: modalStartDate,
        endDate: modalEndDate,
        locationId: modalLocationId,
        locationName: targetLocationName,
        loadedPOs: modalLoadedPOs,
        poOnStock: modalPOonStock,
        totals,
        rows: finalRows,
        createdAt: new Date().toISOString(),
        createdBy: profile?.id || 'System'
      };

      await addDoc(collection(db, 'production_inventories'), newDoc);

      toast({
        title: "Success",
        description: "Inventory generated and saved successfully."
      });
      setShowGenerateModal(false);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error Generating Inventory",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!savedInventories || savedInventories.length === 0) {
      toast({ title: "No Data", description: "There is no data to export.", variant: "destructive" });
      return;
    }
    try {
      await exportMasterTableExcel(savedInventories);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Export Failed", description: err.message, variant: "destructive" });
    }
  };

  const breadcrumbItems = [
    { label: 'Profile', href: '/production/inventories' },
    { label: 'Production Inventories', active: true }
  ];

  return (
    <div className="w-full p-4 md:p-8 lg:p-10 space-y-8 animate-in fade-in duration-700 max-w-[100vw] overflow-x-hidden bg-[#f3f3f3] min-h-screen">
      <ERPPageHeader
        title="Production Inventories"
        subtitle="View and manage daily production inventories and shift-based movements."
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {canGenerate !== false && (
              <Button
                onClick={() => setShowGenerateModal(true)}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 h-12 px-8 rounded-xl font-bold uppercase tracking-widest transition-all text-white flex items-center justify-center"
              >
                <Plus size={18} /> Generate Inventory
              </Button>
            )}
            <Button
              onClick={handleExport}
              disabled={pageLoading}
              className="gap-2 bg-[#7a9800] hover:bg-[#6c8500] shadow-lg shadow-[#7a9800]/20 h-12 px-8 rounded-xl font-bold uppercase tracking-widest transition-all text-white flex items-center justify-center"
            >
              <Download size={18} /> Export Excel
            </Button>
          </div>
        }
      />

      <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden w-full flex flex-col border border-slate-100">
        <div className="overflow-x-auto w-full scroll-smooth custom-scrollbar">
          <div className="min-w-[1500px] w-full p-1">
            <Table className="w-full border-collapse">
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm border-b border-slate-200">
                <TableRow className="hover:bg-transparent border-b border-slate-200">
                  <TableHead className="py-4 border-r border-slate-200 min-w-[200px]">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <span>Week</span>
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <ArrowUpDown size={12} className="cursor-pointer hover:text-slate-500" />
                        <Equal size={12} className="cursor-pointer hover:text-slate-500" />
                        <MoreVertical size={12} className="cursor-pointer hover:text-slate-500" />
                      </div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 border-r border-slate-100">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-[#7a9800]">
                      <span>Raw material<br/>Net Weight</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 border-r border-slate-100">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-[#7a9800]">
                      <span>BL Net Weight</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 border-r border-slate-100">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-[#7a9800]">
                      <span>Farm Decay<br/>Net Weight</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 border-r border-slate-100">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-[#7a9800]">
                      <span>Difference</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 border-r border-slate-100">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-[#7a9800]">
                      <span>Total Consumption</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 border-r border-slate-200">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-[#7a9800]">
                      <span>Raw material<br/>in stock</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 border-r border-slate-100">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                      <span>Out of program</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 border-r border-slate-100">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                      <span>Finished Product<br/>Shipped</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 border-r border-slate-100">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                      <span>Finished product<br/>in stock</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 border-r border-slate-100">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                      <span>Local Market</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 border-r border-slate-100">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                      <span>Production Decay</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 border-r border-slate-100">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                      <span>Return</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 border-r border-slate-200">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-indigo-600">
                      <span>Reste</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-red-600">
                      <span>Losses</span>
                      <div className="flex items-center gap-1.5 text-slate-300"><ArrowUpDown size={12}/><Equal size={12}/><MoreVertical size={12}/></div>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {pageLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-none">
                      <TableCell colSpan={15} className="py-6 px-6"><Skeleton className="h-10 w-full rounded-xl" /></TableCell>
                    </TableRow>
                  ))
                ) : !savedInventories || savedInventories.length === 0 ? (
                  <TableRow className="border-none">
                    <TableCell colSpan={15} className="h-64 text-center text-slate-400 font-bold uppercase text-xs">
                      No saved inventories. Click "+ Generate Inventory" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  savedInventories.map((inv: any, idx: number) => {
                    const r = inv.totals || inv || {};
                    const hasAbnormalDifference = Math.abs(r.difference) > (r.mpBonCamion * 0.05) && r.mpBonCamion > 0;

                    return (
                      <TableRow 
                        key={inv.id || idx}
                        onClick={() => router.push(`/production/inventories/${inv.id}`)}
                        className="hover:bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-xs transition-colors cursor-pointer group"
                      >
                        <TableCell className="py-4 border-r border-slate-100 font-black text-[#7a9800] flex items-center gap-2">
                          <ChevronRight size={14} className="text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
                          {inv.period}
                        </TableCell>

                        <TableCell className="py-4 border-r border-slate-100 bg-emerald-50/10">{(r.mpPesee || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-4 border-r border-slate-100 bg-emerald-50/10">{(r.mpBonCamion || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-4 border-r border-slate-100 bg-emerald-50/10 text-rose-500">{(r.dechetMp || 0).toLocaleString()}</TableCell>
                        <TableCell className={`py-4 border-r border-slate-100 bg-emerald-50/10 ${hasAbnormalDifference ? 'text-red-500' : 'text-slate-500'}`}>
                          {(r.difference || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="py-4 border-r border-slate-100 bg-emerald-50/10 font-black text-[#7a9800]">{(r.totalConsumption || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-4 border-r border-slate-200 bg-emerald-50/10 text-emerald-600">{(r.mpEnStock || 0).toLocaleString()}</TableCell>

                        <TableCell className="py-4 border-r border-slate-100 bg-indigo-50/10 text-purple-600">{(r.outOfProgram || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-4 border-r border-slate-100 bg-indigo-50/10 text-indigo-700">{(r.produitCharge || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-4 border-r border-slate-100 bg-indigo-50/10 text-indigo-800">{(r.pfEnStock || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-4 border-r border-slate-100 bg-indigo-50/10 text-sky-700">{(r.localMarket || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-4 border-r border-slate-100 bg-indigo-50/10 text-rose-500">{(r.dechetProduction || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-4 border-r border-slate-100 bg-indigo-50/10 text-amber-600">{(r.retour || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-4 border-r border-slate-200 bg-indigo-50/10 text-blue-600">{(r.restes || 0).toLocaleString()}</TableCell>

                        <TableCell className="py-4 text-red-600 bg-rose-50/5">{(r.perteReelle || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>

      <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
        <DialogContent className="max-w-2xl bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 overflow-y-auto max-h-[90vh] custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="text-emerald-600" size={20} /> Generate Inventory Report
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 my-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-[#2e1d52]">From Date</Label>
                <Input
                  type="date"
                  value={modalStartDate}
                  onChange={(e) => setModalStartDate(e.target.value)}
                  className="h-11 rounded-xl bg-slate-50/50 border border-slate-200 font-medium w-full focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black text-[#2e1d52]">To Date</Label>
                <Input
                  type="date"
                  value={modalEndDate}
                  onChange={(e) => setModalEndDate(e.target.value)}
                  className="h-11 rounded-xl bg-slate-50/50 border border-slate-200 font-medium w-full focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-[#2e1d52]">Location</Label>
              <Select value={modalLocationId} onValueChange={setModalLocationId}>
                <SelectTrigger className="h-11 rounded-xl bg-slate-50/50 border border-slate-200 font-medium w-full focus:ring-2 focus:ring-emerald-600">
                  <SelectValue placeholder="Select Location" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl border border-slate-100 shadow-xl">
                  {locations?.map((l: any) => (
                    <SelectItem key={l.id} value={l.id}>{l.title || l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <SearchableMultiSelect
                label="Loaded POs (Shipped/Delivered)"
                options={pfcPOsOptions.map((o: any) => ({
                  id: o.poNumber || o.id,
                  label: o.poNumber,
                  subLabel: o.customerName || 'N/A'
                }))}
                selectedValues={modalLoadedPOs}
                onChange={setModalLoadedPOs}
                placeholder="Search Shipped POs..."
              />

              <SearchableMultiSelect
                label="PO on Stock (Produced/In Prod)"
                options={pfStockPOsOptions.map((o: any) => ({
                  id: o.poNumber || o.id,
                  label: o.poNumber,
                  subLabel: o.customerName || 'N/A'
                }))}
                selectedValues={modalPOonStock}
                onChange={setModalPOonStock}
                placeholder="Search Stock POs..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowGenerateModal(false)}
              className="h-11 rounded-xl font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-50 border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerateInventory}
              disabled={isGenerating || !modalStartDate || !modalEndDate || !modalLocationId}
              className="h-11 rounded-xl font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/10 flex items-center justify-center min-w-[120px]"
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
