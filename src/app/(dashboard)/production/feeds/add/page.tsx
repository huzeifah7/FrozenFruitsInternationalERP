'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  writeBatch,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  onSnapshot,
} from '@/firebase/firestore-override';
import {
  useFirestore,
  useUser,
} from '@/firebase';
import { useAuthContext } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { 
  MapPin,
  ChevronLeft, 
  Save, 
  Loader2,
  Package,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronDown,
  X
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const feedSchema = z.object({
  palletizationIds: z.array(z.string()).min(1, "Please select at least one palletization."),
  dateTime: z.string().min(1, "Date and Time is required"),
  shift: z.string().min(1, "Shift is required"),
  locationId: z.string().min(1, "Location is required"),
});

type FeedFormValues = z.infer<typeof feedSchema>;

interface AvailablePallet {
  uniqueKey: string;
  sourceType: 'RAW_MATERIAL' | 'RETURN';
  id: string;
  palletizationId: string;
  barcode: string;
  lotNumber: string;
  groupLabel: string;
  netWeight: number;
  locationId: string | null;
  locationName: string | null;
  shift: string;
  sourceRawMaterialId: string;
  sourceProductionOutputId: string;
  original: any;
}

export default function AddProductionFeedPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { profile } = useAuthContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetchingPallets, setFetchingPallets] = useState(false);
  const [open, setOpen] = useState(false);
  const [locationsList, setLocationsList] = useState<any[]>([]);

  const form = useForm<FeedFormValues>({
    resolver: zodResolver(feedSchema),
    defaultValues: {
      palletizationIds: [],
      dateTime: new Date().toISOString().slice(0, 16),
      shift: '1',
      locationId: '',
    },
  });

  useEffect(() => {
    if (locationsList.length > 0 && profile) {
      const userLoc = profile.locationId || profile.location;
      if (userLoc) {
        const matched = locationsList.find(l => 
          l.id === userLoc || 
          (l.title && l.title.toLowerCase() === userLoc.toLowerCase()) || 
          (l.name && l.name.toLowerCase() === userLoc.toLowerCase())
        );
        if (matched && !form.getValues('locationId')) {
          form.setValue('locationId', matched.id);
        }
      }
    }
  }, [locationsList, profile, form]);

  // All pallets loaded once
  const [allPallets, setAllPallets] = useState<AvailablePallet[]>([]);
  // Used pallet IDs tracked reactively
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());

  // Step 1: Fetch all pallets (RM only) once when profile is ready
  useEffect(() => {
    if (!db || !profile) return;
    let cancelled = false;
    setFetchingPallets(true);

    (async () => {
      try {
        const userLocId = profile?.locationId || profile?.location;
        const userRole = profile?.role;

        // Step 0: Fetch seasons to determine allowed season IDs
        const seasonsSnap = await getDocs(collection(db, 'seasons')).catch(e => { console.error("Seasons fetch error", e); return { docs: [] }; });
        if (cancelled) return;

        const seasonsList = seasonsSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
        seasonsList.sort((a, b) => {
          const aStart = a.start_date || a.start || '';
          const bStart = b.start_date || b.start || '';
          return aStart.localeCompare(bStart);
        });

        const currentSeasonId = localStorage.getItem('season_id');
        const currentIndex = seasonsList.findIndex(s => s.id === currentSeasonId);
        const allowedSeasonIds = currentIndex === -1 
          ? [currentSeasonId].filter(Boolean) as string[]
          : seasonsList.slice(0, currentIndex + 1).map(s => s.id);

        if (allowedSeasonIds.length === 0) {
          setFetchingPallets(false);
          return;
        }

        // Step 1: Fetch raw materials and locations safely
        const [rmSnap, locSnap] = await Promise.all([
          getDocs(query(collection(db, 'raw_materials'), where('season_id', 'in', allowedSeasonIds))).catch(e => { console.error("RM fetch error", e); return { docs: [] }; }),
          getDocs(query(collection(db, 'processing_lines'))).catch(e => { console.error("Loc fetch error", e); return { docs: [] }; })
        ]);

        if (cancelled) return;

        const locs = locSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setLocationsList(locs);

        const rmMap = new Map();
        rmSnap.docs.forEach(doc => {
          rmMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        // Load palletizations and production_output
        const [palletizationsSnap, prodSnap] = await Promise.all([
          getDocs(query(collection(db, 'palletizations'), where('season_id', 'in', allowedSeasonIds))).catch(e => { console.error("Palletizations fetch error", e); return { docs: [] }; }),
          getDocs(query(collection(db, 'production_output'), where('season_id', 'in', allowedSeasonIds))).catch(e => { console.error("ProdOut fetch error", e); return { docs: [] }; })
        ]);

        const palletizationsDocs = palletizationsSnap.docs.filter(d => {
          const data = d.data();
          const pType = (data.type || data.palletizationType || data.palletisationType || '').toLowerCase();
          return pType === 'raw material' || pType === 'raw_material' || pType === 'palletization' || !data.type || Boolean(data.rawMaterialId || data.raw_material_id || data.lotNumber || data.lot_number);
        });

        const pallets: AvailablePallet[] = [];
        
        prodSnap.docs.forEach(pDoc => {
          const pData = pDoc.data();
          const pType = (pData.palletisationType || pData.palletizationType || pData.palletisation_type || pData.palletization_type || pData.type || '').toLowerCase();
          
          if (pType !== 'return') return;

          const barcd = pData.barcode || pData.barcodeNumber || pData.productionOutputNumber || pData.outputNumber || pDoc.id;
          let lotNum = 'Return';
          let resolvedRawMatId = '';
          if (pData.rawMaterialLotNumber) {
            lotNum = pData.rawMaterialLotNumber;
          } else if (Array.isArray(pData.items)) {
            for (const item of pData.items) {
              if (item.lotNumber) {
                lotNum = item.lotNumber;
                resolvedRawMatId = item.productId || '';
                break;
              }
            }
          }
          
          let netWt = Number(pData.netWeight !== undefined ? pData.netWeight : pData.net_weight) || 0;
          if (netWt === 0 && Array.isArray(pData.items)) {
            netWt = pData.items.reduce((sum: number, item: any) => sum + (Number(item.netWeight) || 0), 0);
          }
          const locId = pData.locationId || null;
          const locName = pData.locationName || null;
          const shift = pData.shift || '1';
          const sourceNumber = pData.sourceProductionOutputNumber || barcd;

          pallets.push({
            uniqueKey: `RETURN:${pDoc.id}`,
            sourceType: 'RETURN',
            id: pDoc.id,
            palletizationId: '',
            barcode: barcd,
            lotNumber: lotNum,
            groupLabel: `Source Production Output: ${sourceNumber}`,
            netWeight: netWt,
            locationId: locId,
            locationName: locName,
            shift: shift,
            sourceRawMaterialId: resolvedRawMatId,
            sourceProductionOutputId: pDoc.id,
            original: pData
          });
        });

        palletizationsDocs.forEach(pDoc => {
          const pData = pDoc.data();

          const rawMatId = pData.rawMaterialId || pData.raw_material_id || pData.sourceRawMaterialId || pData.document_id || pData.id;
          const rmData = rawMatId ? rmMap.get(rawMatId) : null;
          
          const lotNum = pData.lotNumber || pData.lot_number || pData.rawMaterialLotNumber || pData.raw_material_lot_number || pData['rawMaterial.lotNumber'] || rmData?.lotNumber || rmData?.lot_number || rmData?.rawMaterialLotNumber || rmData?.raw_material_lot_number || 'Unknown Lot';
          const barcd = pData.barcode || pData.barcodeNumber || pData.palletizationBarcode || pData.palletisationBarcode || pData.palletizationNumber || pData.palletisationNumber || pDoc.id;
          const netWt = Number(pData.netWeight !== undefined ? pData.netWeight : (pData.net_weight !== undefined ? pData.net_weight : (pData.blNetWeight !== undefined ? pData.blNetWeight : pData.weight))) || 0;
          const resolvedRawMatId = rawMatId || rmData?.id || '';
          const locId = pData.locationId || pData.location_id || pData.location || pData.locationName || pData['rawMaterial.location'] || rmData?.locationId || rmData?.location || null;
          const locName = pData.locationName || null;
          const shift = pData.shift || '1';

          pallets.push({
            uniqueKey: `RAW_MATERIAL:${pDoc.id}`,
            sourceType: 'RAW_MATERIAL',
            id: pDoc.id,
            palletizationId: pDoc.id,
            barcode: barcd,
            lotNumber: lotNum,
            groupLabel: `Lot: ${lotNum}`,
            netWeight: netWt,
            locationId: locId,
            locationName: locName,
            shift: shift,
            sourceRawMaterialId: resolvedRawMatId,
            sourceProductionOutputId: '',
            original: pData
          });
        });

        if (!cancelled) {
          setAllPallets(pallets);
          setFetchingPallets(false);
        }
      } catch (err) {
        console.error('Error loading pallets in AddProductionFeedPage:', err);
        if (!cancelled) setFetchingPallets(false);
      }
    })();

    return () => { cancelled = true; };
  }, [db, profile?.locationId, profile?.role]);

  // Step 2: Reactive listener — fires instantly when any feed is added or deleted
  useEffect(() => {
    if (!db) return;
    try {
      return onSnapshot(collection(db, 'production_feeds'), snap => {
        const ids = new Set<string>();
        snap.docs.forEach(d => {
          const data = d.data();
          const sType = data.sourceType || 'RAW_MATERIAL'; // Default legacy
          
          if (data.palletizationId) ids.add(`${sType}:${data.palletizationId}`);
          if (data.palletizationBarcode) ids.add(`${sType}:${data.palletizationBarcode}`);
          if (data.sourceProductionOutputId) ids.add(`${sType}:${data.sourceProductionOutputId}`);
          if (data.barcode) ids.add(`${sType}:${data.barcode}`);
          if (data.palletizationNumber) ids.add(`${sType}:${data.palletizationNumber}`);
          if (data.sourceProductionOutputNumber) ids.add(`${sType}:${data.sourceProductionOutputNumber}`);
        });
        setUsedIds(ids);
      }, (error) => {
        console.warn("Failed to load used palletizations", error);
      });
    } catch (e) {
      console.warn("Exception loading used palletizations", e);
    }
  }, [db]);

  // Step 3: Filter — recomputes instantly when usedIds changes (e.g. a feed is deleted)
  const availablePallets = useMemo(() => {
    return allPallets.filter(p => !usedIds.has(p.uniqueKey) && !usedIds.has(`${p.sourceType}:${p.barcode}`) && !usedIds.has(`${p.sourceType}:${p.id}`));
  }, [allPallets, usedIds]);

  const selectedIds = form.watch('palletizationIds');
  const selectedPallets = useMemo(() => 
    availablePallets.filter(p => selectedIds.includes(p.id)), 
  [availablePallets, selectedIds]);

  const selectedLots = useMemo(() => {
    const lots = new Set(selectedPallets.map(p => p.lotNumber));
    return Array.from(lots).filter(Boolean);
  }, [selectedPallets]);

  // Selected pallets' location detection
  const detectedLocation = useMemo(() => {
    if (selectedPallets.length === 0) return null;
    const locs = Array.from(new Set(selectedPallets.map(p => p.locationId).filter(Boolean)));
    if (locs.length === 1) {
      const locId = locs[0];
      const matched = locationsList.find(l => l.id === locId);
      return {
        id: locId,
        name: matched?.title || matched?.name || 'Unknown Location'
      };
    }
    return null;
  }, [selectedPallets, locationsList]);

  const hasMultipleLocations = useMemo(() => {
    const locs = Array.from(new Set(selectedPallets.map(p => p.locationId).filter(Boolean)));
    return locs.length > 1;
  }, [selectedPallets]);

  const displayedLocationName = useMemo(() => {
    if (hasMultipleLocations) {
      return 'Multiple Locations';
    }
    if (detectedLocation) {
      return detectedLocation.name;
    }
    return profile?.locationName || 'Identifying Site...';
  }, [detectedLocation, hasMultipleLocations, profile]);

  const groupedPallets = useMemo(() => {
    const groups: Record<string, AvailablePallet[]> = {};
    availablePallets.forEach(p => {
      const label = p.groupLabel;
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(p);
    });
    return groups;
  }, [availablePallets]);

  const getLotState = (lot: string) => {
    const palletsInLot = groupedPallets[lot] || [];
    if (palletsInLot.length === 0) return 'unchecked';
    
    const selectedInLot = palletsInLot.filter(p => selectedIds.includes(p.id));
    if (selectedInLot.length === 0) return 'unchecked';
    if (selectedInLot.length === palletsInLot.length) return 'checked';
    return 'indeterminate';
  };

  const toggleLot = (lot: string) => {
    const palletsInLot = groupedPallets[lot] || [];
    if (palletsInLot.length === 0) return;
    
    const lotState = getLotState(lot);
    const currentSelected = form.getValues('palletizationIds');
    let nextSelected: string[];
    
    if (lotState === 'checked') {
      const idsToRemove = new Set(palletsInLot.map(p => p.id));
      nextSelected = currentSelected.filter(id => !idsToRemove.has(id));
    } else {
      const idsToAdd = palletsInLot.map(p => p.id);
      const uniqueCurrent = currentSelected.filter(id => !idsToAdd.includes(id));
      nextSelected = [...uniqueCurrent, ...idsToAdd];
    }
    
    form.setValue('palletizationIds', nextSelected, { shouldValidate: true });
  };

  const togglePallet = (id: string) => {
    const current = form.getValues('palletizationIds');
    if (current.includes(id)) {
      form.setValue('palletizationIds', current.filter(i => i !== id), { shouldValidate: true });
    } else {
      form.setValue('palletizationIds', [...current, id], { shouldValidate: true });
    }
  };

  const getTriggerLabel = () => {
    if (selectedPallets.length === 0) return 'Choose pallets...';
    if (selectedPallets.length === 1) return selectedPallets[0].barcode;
    
    const selectedByLot: Record<string, AvailablePallet[]> = {};
    selectedPallets.forEach(p => {
      const lot = p.lotNumber || 'No Lot';
      if (!selectedByLot[lot]) selectedByLot[lot] = [];
      selectedByLot[lot].push(p);
    });
    
    const selectedLotsList = Object.keys(selectedByLot);
    if (selectedLotsList.length === 1) {
      const lot = selectedLotsList[0];
      const allAvailableInLot = availablePallets.filter(p => (p.lotNumber || 'No Lot') === lot);
      const allSelectedInLot = selectedByLot[lot];
      if (allAvailableInLot.length > 0 && allSelectedInLot.length === allAvailableInLot.length) {
        return `${lot} — ${allSelectedInLot.length} palletizations selected`;
      }
    }
    
    return `${selectedPallets.length} palletizations selected`;
  };

  const onSubmit = async (values: FeedFormValues) => {
    if (!db || !user || selectedPallets.length === 0) return;
    setLoading(true);

    try {
      const batch = writeBatch(db);
      
      const formLocId = values.locationId;
      const formLocObj = locationsList.find(l => l.id === formLocId);
      const actualLocationName = formLocObj?.title || formLocObj?.name || 'Unknown';
      
      const activeSeasonId = typeof window !== 'undefined' ? localStorage.getItem('season_id') || '' : '';
      
      selectedPallets.forEach(pallet => {
        const feedRef = doc(collection(db, 'production_feeds'));
        const feedData: any = {
          season_id: activeSeasonId,
          sourceType: pallet.sourceType,
          dateTime: values.dateTime,
          date: values.dateTime.split('T')[0],
          shift: values.shift,
          locationId: formLocId,
          locationName: actualLocationName,
          netWeight: pallet.netWeight,
          createdAt: serverTimestamp(),
          createdBy: user.email,
          updatedAt: serverTimestamp(),
          updatedBy: user.email,
        };

        if (pallet.sourceType === 'RAW_MATERIAL') {
          feedData.palletizationId = pallet.id;
          feedData.palletizationBarcode = pallet.barcode;
          feedData.barcode = pallet.barcode;
          feedData.rawMaterialLotNumber = pallet.lotNumber || null;
          feedData.lotNumber = pallet.lotNumber || null;
          feedData.sourceRawMaterialId = pallet.sourceRawMaterialId || null;
          feedData.rawMaterialId = pallet.sourceRawMaterialId || null;
        } else {
          feedData.sourceProductionOutputId = pallet.id;
          feedData.sourceProductionOutputNumber = pallet.barcode;
          feedData.barcode = pallet.barcode;
          feedData.rawMaterialLotNumber = pallet.lotNumber || null;
        }

        batch.set(feedRef, feedData);
      });

      await batch.commit();

      toast({ title: "Success", description: `${selectedPallets.length} production feeds added successfully.` });
      router.push('/production/feeds');
    } catch (error) {
      console.error("Error adding feeds:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to save records." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-8 max-w-[1200px] mx-auto animate-in fade-in duration-500 bg-[#F8F9FB] min-h-screen">
      
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild className="rounded-full h-10 w-10 hover:bg-slate-200">
          <Link href="/production/feeds">
            <ChevronLeft size={20} className="text-slate-600" />
          </Link>
        </Button>
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
            <span>Production</span><span className="opacity-40">/</span>
            <span className="text-primary/60 font-black uppercase">Feeds</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase">Add Batch Feed</h1>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* ── MAIN FEED CONFIGURATION ── */}
        <div className="bg-slate-100/50 p-6 rounded-[1.5rem] space-y-6 border border-slate-200">
          <div className="grid grid-cols-2 gap-6">
            
            {/* Row 1 */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Date Time <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input 
                  type="datetime-local" 
                  {...form.register('dateTime')} 
                  required 
                  className="h-11 pl-10 rounded-xl bg-white border-slate-200 font-bold text-slate-700 focus:ring-primary/20" 
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Shift <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select 
                  {...form.register('shift')}
                  className="w-full h-11 pl-10 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 transition-all appearance-none outline-none"
                >
                  <option value="1">SHIFT 1</option>
                  <option value="2">SHIFT 2</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Location <span className="text-rose-500">*</span></Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select 
                  {...form.register('locationId')}
                  className="w-full h-11 pl-10 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 focus:ring-2 focus:ring-primary/20 transition-all appearance-none outline-none"
                >
                  <option value="" disabled>Select Location</option>
                  {locationsList.map(l => (
                    <option key={l.id} value={l.id}>{l.title || l.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Row 2 */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Select Palletizations <span className="text-rose-500">*</span></Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full h-11 rounded-xl bg-white border-slate-200 justify-between px-4 font-bold text-slate-700 hover:bg-white hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center gap-2 overflow-hidden truncate">
                      <Package size={16} className="text-slate-400 shrink-0" />
                      <span className={cn(selectedIds.length > 0 ? "text-primary font-black" : "text-slate-400 font-medium")}>
                        {getTriggerLabel()}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-40" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-4 rounded-2xl border-slate-200 shadow-2xl overflow-hidden" align="start">
                  <div className="max-h-[350px] overflow-y-auto space-y-4 pr-1">
                    {(() => {
                      const rmGroupLabels = Object.keys(groupedPallets).filter(label => groupedPallets[label][0].sourceType === 'RAW_MATERIAL');
                      const returnGroupLabels = Object.keys(groupedPallets).filter(label => groupedPallets[label][0].sourceType === 'RETURN');

                      return (
                        <>
                          {rmGroupLabels.length > 0 && (
                            <div className="space-y-2 mb-4">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">RAW MATERIALS</div>
                              {rmGroupLabels.map((lot) => {
                                const pallets = groupedPallets[lot];
                                const lotState = getLotState(lot);
                                return (
                                  <div key={lot} className="space-y-1.5">
                                    <div 
                                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-all bg-slate-50/50 border border-slate-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleLot(lot);
                                      }}
                                    >
                                      <Checkbox 
                                        checked={lotState === 'checked' ? true : lotState === 'indeterminate' ? 'indeterminate' : false}
                                        className="rounded-md border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                        onClick={(e) => e.stopPropagation()}
                                        onCheckedChange={() => toggleLot(lot)}
                                      />
                                      <span className="text-xs font-black text-slate-800 tracking-tight uppercase">
                                        {lot}
                                      </span>
                                    </div>
                                    <div className="pl-6 space-y-1">
                                      {pallets.map(p => (
                                        <div 
                                          key={p.id}
                                          className={cn(
                                            "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all hover:bg-slate-50 border border-transparent",
                                            selectedIds.includes(p.id) && "bg-primary/[0.02] border-primary/5"
                                          )}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            togglePallet(p.id);
                                          }}
                                        >
                                          <Checkbox 
                                            checked={selectedIds.includes(p.id)}
                                            className="rounded border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                            onClick={(e) => e.stopPropagation()}
                                            onCheckedChange={() => togglePallet(p.id)}
                                          />
                                          <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700 tracking-tight">
                                              {p.barcode} — {p.netWeight} KG
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {returnGroupLabels.length > 0 && (
                            <div className="space-y-2 mt-4">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">RETURNS</div>
                              {returnGroupLabels.map((lot) => {
                                const pallets = groupedPallets[lot];
                                const lotState = getLotState(lot);
                                return (
                                  <div key={lot} className="space-y-1.5">
                                    <div 
                                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-slate-100/80 transition-all bg-slate-50/50 border border-slate-100"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleLot(lot);
                                      }}
                                    >
                                      <Checkbox 
                                        checked={lotState === 'checked' ? true : lotState === 'indeterminate' ? 'indeterminate' : false}
                                        className="rounded-md border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                        onClick={(e) => e.stopPropagation()}
                                        onCheckedChange={() => toggleLot(lot)}
                                      />
                                      <span className="text-xs font-black text-slate-800 tracking-tight uppercase">
                                        {lot}
                                      </span>
                                    </div>
                                    <div className="pl-6 space-y-1">
                                      {pallets.map(p => (
                                        <div 
                                          key={p.id}
                                          className={cn(
                                            "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all hover:bg-slate-50 border border-transparent",
                                            selectedIds.includes(p.id) && "bg-primary/[0.02] border-primary/5"
                                          )}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            togglePallet(p.id);
                                          }}
                                        >
                                          <Checkbox 
                                            checked={selectedIds.includes(p.id)}
                                            className="rounded border-slate-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                            onClick={(e) => e.stopPropagation()}
                                            onCheckedChange={() => togglePallet(p.id)}
                                          />
                                          <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700 tracking-tight">
                                              {p.barcode} — {p.netWeight} KG
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {fetchingPallets && (
                      <div className="p-10 text-center space-y-2">
                        <Loader2 className="h-8 w-8 text-slate-300 animate-spin mx-auto" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading palletizations...</p>
                      </div>
                    )}

                    {availablePallets.length === 0 && !fetchingPallets && (
                      <div className="p-10 text-center space-y-2">
                        <Package className="h-8 w-8 text-slate-200 mx-auto" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No pallets available.</p>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {form.formState.errors.palletizationIds && <p className="text-[9px] text-rose-500 font-bold uppercase ml-1 mt-1">{form.formState.errors.palletizationIds.message}</p>}
            </div>
            

          </div>

          {/* Selected Pallets Quick View */}
          {selectedPallets.length > 0 && (
            <div className="pt-4 border-t border-slate-200 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex flex-wrap gap-2">
                {selectedPallets.map(p => (
                  <Badge 
                    key={p.id} 
                    variant="secondary" 
                    className="bg-white border border-slate-200 text-slate-700 font-bold text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-2 hover:border-rose-200 hover:text-rose-600 group transition-all"
                  >
                    <span className="opacity-40 font-mono text-[9px]">{p.barcode}</span>
                    <span className="w-[1px] h-3 bg-slate-200 group-hover:bg-rose-100" />
                    <span>{p.netWeight} KG</span>
                    <X 
                      size={12} 
                      className="cursor-pointer opacity-40 group-hover:opacity-100" 
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePallet(p.id);
                      }}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── ACTIVE LOTS SUMMARY ── */}
        {selectedLots.length > 0 && (
          <div className="bg-emerald-50/50 p-6 rounded-[1.5rem] space-y-4 border border-emerald-100 animate-in fade-in duration-500">
            <h3 className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em] flex items-center gap-2">
              <CheckCircle2 size={14} /> Active Raw Material Lots
            </h3>
            <div className="flex flex-wrap gap-2">
              {selectedLots.map(lot => (
                <Badge key={lot} className="bg-emerald-600 text-white border-none font-black text-[9px] uppercase tracking-widest px-4 py-1.5 rounded-xl shadow-sm">
                  {lot}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* ── FINAL SUBMISSION ── */}
        <div className="flex justify-end pt-6">
          <Button 
            type="submit" 
            disabled={loading || fetchingPallets || selectedIds.length === 0 || !profile} 
            className="h-14 px-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] gap-3"
          >
            {loading ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Saving Feeds...</>
            ) : (
              <><Save size={20} /> Save {selectedIds.length} Production Feeds</>
            )}
          </Button>
        </div>

      </form>
    </div>
  );
}
