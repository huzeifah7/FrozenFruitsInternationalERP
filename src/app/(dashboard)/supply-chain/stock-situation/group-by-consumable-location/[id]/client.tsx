'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, doc, getDoc, getDocs, query, where, orderBy, addDoc, serverTimestamp } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { canList, canAdd, canUpdate, canDelete } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select as SelectUI, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Package, MapPin, Inbox, AlertTriangle, Layers, Calendar, Plus
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { isCorner, isChapeau, isPallet, isFeuillard, isChappes, is4KG, recalculateAffectedStockGroups } from '@/lib/stock-situation-utils';
import { useSeason } from '@/contexts/SeasonContext';

interface PaginationProps {
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  rowsPerPage: number;
  setRowsPerPage: React.Dispatch<React.SetStateAction<number>>;
  totalItems: number;
}

const TablePagination: React.FC<PaginationProps> = ({
  page,
  setPage,
  rowsPerPage,
  setRowsPerPage,
  totalItems,
}) => {
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  
  return (
    <div className="flex justify-end items-center px-6 py-3 border-t border-slate-100 text-xs text-slate-600 gap-6 bg-slate-50/50">
      <div className="flex items-center gap-2">
        <span className="font-bold">Rows per page</span>
        <select 
          className="bg-transparent border-none focus:ring-0 cursor-pointer text-gray-700 outline-none font-bold"
          value={rowsPerPage}
          onChange={(e) => {
            setRowsPerPage(Number(e.target.value));
            setPage(1);
          }}
        >
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
        </select>
      </div>
      
      <div className="flex items-center gap-4">
        <span className="font-bold">
          {totalItems === 0 ? 0 : ((page - 1) * rowsPerPage) + 1}-{Math.min(page * rowsPerPage, totalItems)} of {totalItems}
        </span>
        <div className="flex items-center gap-1 text-slate-400">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full hover:text-gray-700 hover:bg-gray-100"
            onClick={() => setPage(1)}
            disabled={page === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full hover:text-gray-700 hover:bg-gray-100"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full hover:text-gray-700 hover:bg-gray-100"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || totalPages === 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-full hover:text-gray-700 hover:bg-gray-100"
            onClick={() => setPage(totalPages)}
            disabled={page === totalPages || totalPages === 0}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function ConsumableDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const { user, profile } = useUser();
  const { toast } = useToast();

  const [consumableId, locationId] = useMemo(() => {
    return (id || '').split('__');
  }, [id]);

  const [consumable, setConsumable] = useState<any | null>(null);
  
  const { currentSeason, previousSeason } = useSeason();
  const [resolvedSeasonId, setResolvedSeasonId] = useState<string | null>(
    currentSeason?.id || (typeof window !== 'undefined' ? localStorage.getItem('season_id') : null)
  );
  
  const prevSeasonId = previousSeason?.id || (typeof window !== 'undefined' ? localStorage.getItem('prev_season_id') : null);

  useEffect(() => {
    if (resolvedSeasonId || !db) return;
    const fetchSeason = async () => {
      try {
        const q = query(collection(db, 'seasons'), where('status', '==', 'Active'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setResolvedSeasonId(snap.docs[0].id);
        } else {
          setResolvedSeasonId('DEFAULT_SEASON');
        }
      } catch (err) {
        setResolvedSeasonId('DEFAULT_SEASON');
      }
    };
    fetchSeason();
  }, [db, resolvedSeasonId]);

  const seasonId = resolvedSeasonId;
  const permission = {
    list: canList(profile, 'supply-chain.stock-situation') ? 1 : 0,
    add: canAdd(profile, 'supply-chain.stock-situation') ? 1 : 0,
    update: canUpdate(profile, 'supply-chain.stock-situation') ? 1 : 0,
    delete: canDelete(profile, 'supply-chain.stock-situation') ? 1 : 0
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalQty, setModalQty] = useState('');
  const [modalOp, setModalOp] = useState<'IN' | 'OUT' | 'INVENTORY' | ''>('');
  const [modalNote, setModalNote] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const handleFollowUpSubmit = async () => {
    if (!db || !user || !seasonId) return;
    if (!modalQty || Number(modalQty) <= 0) {
      toast({ title: 'Validation Error', description: 'Quantity must be greater than 0', variant: 'destructive' });
      return;
    }
    if (!modalOp) {
      toast({ title: 'Validation Error', description: 'Select an Operation Type', variant: 'destructive' });
      return;
    }

    setModalSubmitting(true);
    try {
      if (modalOp === 'INVENTORY') {
         // Save as manual adjustment OUT
         await addDoc(collection(db, 'manual_stock_adjustments'), {
           seasonId,
           locationId,
           locationName,
           date: new Date().toISOString().split('T')[0],
           consumableId,
           consumableName: consumable?.name || '',
           quantity: Number(modalQty),
           operationType: 'OUT',
           source_type: 'manual_adjustment',
           note: modalNote,
           created_at: new Date(),
           created_by: user.email || 'unknown',
           updated_at: new Date(),
           updated_by: user.email || 'unknown'
         });
      } else {
        await addDoc(collection(db, 'manual_stock_adjustments'), {
           seasonId,
           locationId,
           locationName,
           date: new Date().toISOString().split('T')[0],
           consumableId,
           consumableName: consumable?.name || '',
           quantity: Number(modalQty),
           operationType: modalOp,
           source_type: 'manual_adjustment',
           note: modalNote,
           created_at: new Date(),
           created_by: user.email || 'unknown',
           updated_at: new Date(),
           updated_by: user.email || 'unknown'
         });
      }
      
      await recalculateAffectedStockGroups(db, seasonId, [`${consumableId}_${locationId}`], []);
      
      toast({ title: 'Success', description: 'Stock Follow Up added successfully.' });
      setIsModalOpen(false);
      setModalQty('');
      setModalOp('');
      setModalNote('');
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to add follow up', variant: 'destructive' });
    } finally {
      setModalSubmitting(false);
    }
  };
  const [locationName, setLocationName] = useState('Unknown Location');
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // Pagination States for 4 Tabs
  const [pageIn, setPageIn] = useState(1);
  const [rowsPerPageIn, setRowsPerPageIn] = useState(10);

  const [pageOut, setPageOut] = useState(1);
  const [rowsPerPageOut, setRowsPerPageOut] = useState(10);

  const [pageProd, setPageProd] = useState(1);
  const [rowsPerPageProd, setRowsPerPageProd] = useState(10);

  const [pageInv, setPageInv] = useState(1);
  const [rowsPerPageInv, setRowsPerPageInv] = useState(10);

  // Fetch Consumable & Location Info
  useEffect(() => {
    async function fetchMetadata() {
      if (!db || !consumableId || !locationId) return;
      try {
        const cSnap = await getDoc(doc(db, 'consumables', consumableId));
        if (cSnap.exists()) {
          setConsumable({ id: cSnap.id, ...cSnap.data() });
        }

        const linesSnap = await getDocs(collection(db, 'processing_lines'));
        const lineDoc = linesSnap.docs.find(d => d.id === locationId);
        if (lineDoc) {
          setLocationName(lineDoc.data().title || lineDoc.id);
        } else {
          const locsSnap = await getDocs(collection(db, 'locations'));
          const locDoc = locsSnap.docs.find(d => d.id === locationId);
          if (locDoc) {
            setLocationName(locDoc.data().name || locDoc.data().title || locationId);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMetadata(false);
      }
    }
    fetchMetadata();
  }, [db, consumableId, locationId]);

  // Query 1: Fetch manual entries for this location
  const manualQuery = useMemoFirebase(() => {
    if (!db || !locationId) return null;
    return query(
      collection(db, 'stock_situations'),
      where('locationId', '==', locationId)
    );
  }, [db, locationId]);
  const { data: manualStock, isLoading: loadingManual } = useCollection(manualQuery);

  // Query 2: Fetch production outputs for auto-consumption
  const outputsQuery = useMemoFirebase(() => {
    if (!db || !locationId) return null;
    return query(
      collection(db, 'production_output'),
      where('locationId', '==', locationId),
      where('palletisationType', 'in', ['Final product', 'Final Product', 'final product'])
    );
  }, [db, locationId]);
  const { data: productionOutputs, isLoading: loadingOutputs } = useCollection(outputsQuery);

  // Query 3: Fetch inventory adjustments
  const inventoriesQuery = useMemoFirebase(() => {
    if (!db || !locationId) return null;
    return query(
      collection(db, 'manual_stock_adjustments'),
      where('locationId', '==', locationId),
      where('consumableId', '==', consumableId)
    );
  }, [db, locationId, consumableId]);
  const { data: rawInventories, isLoading: loadingInventories } = useCollection(inventoriesQuery);

  // Fetch Consumables (to lookup caliber and packaging weights)
  const consumablesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'consumables');
  }, [db]);
  const { data: allConsumables } = useCollection(consumablesQuery);

  // ──── CALCULATIONS ────

  // 1. IN Transactions list
  const inMovements = useMemo(() => {
    if (!manualStock || !consumable) return [];
    const list: any[] = [];
    manualStock.forEach(data => {
      if (data.seasonId && data.seasonId !== seasonId) return;
      const items = data.items || [];
      items.forEach((item: any) => {
        if (item.consumableId === consumableId && item.operation === 'IN') {
          const isChappe = isChappes(consumable.name);
          const qty = isChappe ? Number(item.quantity || 0) / 2000 : Number(item.quantity || 0);
          list.push({
            id: `${data.id}_${item.consumableId}`,
            locationName: data.locationName || locationName,
            date: data.date,
            operation: 'IN',
            deliveryNoteNumber: item.deliveryNoteNumber || '—',
            supplierName: item.supplierName || '—',
            consumableName: item.consumableName,
            quantity: qty,
            quantityUnit: isChappe ? 'Boxes' : 'Units',
            unitPrice: item.unitPrice || 0,
            totalAmount: item.totalAmount || (qty * (item.unitPrice || 0)),
            currency: item.currency || 'MAD',
          });
        }
      });
    });
    return list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [manualStock, consumable, consumableId, locationName]);

  // 2. OUT Transactions list
  const outMovements = useMemo(() => {
    if (!manualStock || !consumable) return [];
    const list: any[] = [];
    manualStock.forEach(data => {
      if (data.seasonId && data.seasonId !== seasonId) return;
      const items = data.items || [];
      items.forEach((item: any) => {
        if (item.consumableId === consumableId && item.operation === 'OUT') {
          const isChappe = isChappes(consumable.name);
          const qty = isChappe ? Number(item.quantity || 0) / 2000 : Number(item.quantity || 0);
          list.push({
            id: `${data.id}_${item.consumableId}`,
            locationName: data.locationName || locationName,
            date: data.date,
            operation: 'OUT',
            deliveryNoteNumber: item.deliveryNoteNumber || '—',
            supplierName: item.supplierName || '—',
            consumableName: item.consumableName,
            quantity: qty,
            quantityUnit: isChappe ? 'Boxes' : 'Units',
            unitPrice: item.unitPrice || 0,
            totalAmount: item.totalAmount || (qty * (item.unitPrice || 0)),
            currency: item.currency || 'MAD',
          });
        }
      });
    });
    return list.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [manualStock, consumable, consumableId, locationName]);

  // 3. Final Products list (auto-consumption calculations)
  const finalProductConsumptions = useMemo(() => {
    if (!productionOutputs || !consumable || !allConsumables) return [];
    
    // Sort outputs chronologically and optionally filter by seasonId if it exists
    const sortedOutputs = [...productionOutputs]
      .filter((p: any) => !p.seasonId || p.seasonId === seasonId)
      .sort((a, b) => (a.shiftDate || '').localeCompare(b.shiftDate || ''));

    const list: any[] = [];
    let chappesUnitsAccumulated = 0;

    sortedOutputs.forEach(pallet => {
      const pkgId = pallet.packagingTypeId;
      const pkgName = pallet.packagingTypeName || '';
      const consumableObj = allConsumables.find(c => c.id === pkgId);
      const isPkg4 = is4KG(pkgName, consumableObj?.weight_per_unit || consumableObj?.weightPerUnit);

      const firstItem = pallet.items?.[0] || {};
      const displayCaliber = pallet.caliber || firstItem.caliber || '—';
      const displayNetWeight = pallet.netWeight || (pallet.items || []).reduce((sum: number, it: any) => sum + Number(it.netWeight || 0), 0);
      const displayNumberOfBoxes = (pallet.items || []).reduce((sum: number, it: any) => sum + Number(it.numberOfBoxes || 0), 0);

      // Calculations per consumable type
      if (isCorner(consumable.name)) {
        list.push({
          id: `auto_${pallet.id}`,
          barcodeNumber: pallet.barcode || '—',
          caliber: displayCaliber,
          orderNumber: pallet.orderPoNumber || pallet.orderNumber || '—',
          palletType: pallet.palletisationType || 'Final Product',
          packageType: pkgName || '—',
          netWeight: displayNetWeight,
          numberOfBoxes: displayNumberOfBoxes,
          quantity: 4,
          quantityUnit: 'Units',
        });
      }
      else if (isChapeau(consumable.name)) {
        list.push({
          id: `auto_${pallet.id}`,
          barcodeNumber: pallet.barcode || '—',
          caliber: displayCaliber,
          orderNumber: pallet.orderPoNumber || pallet.orderNumber || '—',
          palletType: pallet.palletisationType || 'Final Product',
          packageType: pkgName || '—',
          netWeight: displayNetWeight,
          numberOfBoxes: displayNumberOfBoxes,
          quantity: 1,
          quantityUnit: 'Units',
        });
      }
      else if (isPallet(consumable.name)) {
        list.push({
          id: `auto_${pallet.id}`,
          barcodeNumber: pallet.barcode || '—',
          caliber: displayCaliber,
          orderNumber: pallet.orderPoNumber || pallet.orderNumber || '—',
          palletType: pallet.palletisationType || 'Final Product',
          packageType: pkgName || '—',
          netWeight: displayNetWeight,
          numberOfBoxes: displayNumberOfBoxes,
          quantity: 1,
          quantityUnit: 'Units',
        });
      }
      else if (isFeuillard(consumable.name)) {
        const consumptionKg = Number(consumable.feuillardConsumptionPerPallet || (isPkg4 ? 0.207 : 0.161));
        const rolls = consumptionKg / 14.5;
        list.push({
          id: `auto_${pallet.id}`,
          barcodeNumber: pallet.barcode || '—',
          caliber: displayCaliber,
          orderNumber: pallet.orderPoNumber || pallet.orderNumber || '—',
          palletType: pallet.palletisationType || 'Final Product',
          packageType: pkgName || '—',
          netWeight: displayNetWeight,
          numberOfBoxes: displayNumberOfBoxes,
          quantity: Number(rolls.toFixed(4)),
          quantityUnit: 'Rolls',
        });
      }
      else if (isChappes(consumable.name)) {
        const addedUnits = isPkg4 ? 9 : 7;
        const boxes = addedUnits / 2000;
        list.push({
          id: `auto_${pallet.id}`,
          barcodeNumber: pallet.barcode || '—',
          caliber: displayCaliber,
          orderNumber: pallet.orderPoNumber || pallet.orderNumber || '—',
          palletType: pallet.palletisationType || 'Final Product',
          packageType: pkgName || '—',
          netWeight: displayNetWeight,
          numberOfBoxes: displayNumberOfBoxes,
          quantity: Number(boxes.toFixed(4)),
          quantityUnit: 'Boxes',
        });
      }
      else if (pkgId === consumableId) {
        const boxCount = (pallet.items || []).reduce((sum: number, it: any) => sum + Number(it.numberOfBoxes || 0), 0);
        if (boxCount > 0) {
          list.push({
            id: `auto_${pallet.id}`,
            barcodeNumber: pallet.barcode || '—',
            caliber: displayCaliber,
            orderNumber: pallet.orderPoNumber || pallet.orderNumber || '—',
            palletType: pallet.palletisationType || 'Final Product',
            packageType: pkgName || '—',
            netWeight: displayNetWeight,
            numberOfBoxes: displayNumberOfBoxes,
            quantity: boxCount,
            quantityUnit: 'Boxes',
          });
        }
      }
    });

    // Return reversed array to show newest first
    return list.reverse();
  }, [productionOutputs, consumable, consumableId, allConsumables]);

  // 4. Inventories adjustments
  const inventories = useMemo(() => {
    if (!rawInventories || !consumable) return [];
    const list: any[] = [];
    rawInventories.forEach(data => {
      if (data.seasonId && data.seasonId !== seasonId) return;
      const locMatch = (data.locationName || '').toLowerCase().includes(locationName.toLowerCase()) || 
                       (locationName || '').toLowerCase().includes((data.locationName || '').toLowerCase());
      
      if (locMatch) {
        const items = data.items || [];
        items.forEach((item: any) => {
          if (item.consumableId === consumableId) {
            list.push({
              id: `${data.id}_${item.consumableId}`,
              locationName: data.locationName,
              date: data.date,
              consumableName: item.consumableName,
              quantity: item.quantity,
              note: data.remarks || item.note || '—',
              createdBy: data.createdBy || '—',
              updatedBy: data.updatedBy || '—',
            });
          }
        });
      }
    });
    return list;
  }, [rawInventories, consumable, consumableId, locationName]);

  // Fetch previous season opening balance
  const [openingBalance, setOpeningBalance] = useState(0);
  useEffect(() => {
    async function fetchOpeningBalance() {
      if (!db || !consumableId || !locationId || !prevSeasonId) return;
      try {
        const docRef = doc(db, 'stock_situation_counters', `${prevSeasonId}_${locationId}_${consumableId}`);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setOpeningBalance(Number(snap.data().available || 0));
        } else {
          setOpeningBalance(0);
        }
      } catch (err) {
        console.error("Failed to fetch opening balance", err);
      }
    }
    fetchOpeningBalance();
  }, [db, prevSeasonId, consumableId, locationId]);

  // Stats calculations
  const stats = useMemo(() => {
    const totalIn = inMovements.reduce((sum, m) => sum + Number(m.quantity || 0), 0);
    const totalManualOut = outMovements.reduce((sum, m) => sum + Number(m.quantity || 0), 0);
    
    // For FEUILLARD, auto out is 0 because we rely on the explicit OUT movements in totalManualOut
    const totalAutoOut = isFeuillard(consumable?.name || '') 
      ? 0 
      : finalProductConsumptions.reduce((sum, m) => sum + Number(m.quantity || 0), 0);
    
    const totalOut = totalManualOut + totalAutoOut;
    const available = openingBalance + totalIn - totalOut;
    
    return {
      openingBalance,
      totalIn,
      totalOut,
      available,
    };
  }, [inMovements, outMovements, finalProductConsumptions, openingBalance]);

  // Paginations slices
  const paginatedIn = useMemo(() => {
    const start = (pageIn - 1) * rowsPerPageIn;
    return inMovements.slice(start, start + rowsPerPageIn);
  }, [inMovements, pageIn, rowsPerPageIn]);

  const paginatedOut = useMemo(() => {
    const start = (pageOut - 1) * rowsPerPageOut;
    return outMovements.slice(start, start + rowsPerPageOut);
  }, [outMovements, pageOut, rowsPerPageOut]);

  const paginatedProd = useMemo(() => {
    const start = (pageProd - 1) * rowsPerPageProd;
    return finalProductConsumptions.slice(start, start + rowsPerPageProd);
  }, [finalProductConsumptions, pageProd, rowsPerPageProd]);

  const paginatedInv = useMemo(() => {
    const start = (pageInv - 1) * rowsPerPageInv;
    return inventories.slice(start, start + rowsPerPageInv);
  }, [inventories, pageInv, rowsPerPageInv]);

  if (loadingMetadata || loadingManual || loadingOutputs || loadingInventories) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#7a9800] opacity-20" />
      </div>
    );
  }

  return (
    <div className="w-full p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 bg-[#F8F9FB] min-h-screen">
      {/* Back navigation & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/supply-chain/stock-situation')} className="rounded-full h-10 w-10 hover:bg-slate-200">
            <ChevronLeft size={20} className="text-slate-600" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
              <span>Profile</span><span className="opacity-40">/</span>
              <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/supply-chain/stock-situation')}>Stock Situation</span><span className="opacity-40">/</span>
              <span className="text-[#7a9800]">Consumable Detail</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[#2e1d52] uppercase leading-none">
              Stock Situation Detail
            </h1>
          </div>
        </div>
        <Button onClick={() => setIsModalOpen(true)} size="icon" className="h-12 w-12 rounded-full bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-xl shadow-[#7a9800]/20 transition-transform hover:scale-105 active:scale-95">
          <Plus size={24} className="stroke-[3]" />
        </Button>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-white">
          <DialogHeader className="bg-slate-50 p-6 border-b border-slate-100">
            <DialogTitle className="text-[#2e1d52] text-xl font-black uppercase tracking-tight">Add Stock Follow Up</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Quantity</Label>
              <Input
                type="number"
                placeholder="Enter Quantity"
                value={modalQty}
                onChange={(e) => setModalQty(e.target.value)}
                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Operation Type</Label>
              <SelectUI value={modalOp} onValueChange={(val: any) => setModalOp(val)}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                  <SelectItem value="IN" className="font-bold text-teal-700">IN</SelectItem>
                  <SelectItem value="OUT" className="font-bold text-amber-700">OUT</SelectItem>
                  <SelectItem value="INVENTORY" className="font-bold text-indigo-700">INVENTORY</SelectItem>
                </SelectContent>
              </SelectUI>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Note</Label>
              <Textarea
                placeholder="Enter Note"
                value={modalNote}
                onChange={(e) => setModalNote(e.target.value)}
                className="min-h-[100px] rounded-xl bg-slate-50/50 border-slate-200 font-medium resize-none"
              />
            </div>
            <Button
              onClick={handleFollowUpSubmit}
              disabled={modalSubmitting}
              className="w-full h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white font-black uppercase tracking-widest rounded-xl shadow-lg shadow-[#7a9800]/20"
            >
              {modalSubmitting ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Submitting...</> : 'SUBMIT'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden border border-slate-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Opening Balance</p>
              <h3 className="text-2xl font-black text-slate-700 mt-1">{stats.openingBalance.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl"><Layers className="size-6" /></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden border border-slate-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity IN</p>
              <h3 className="text-2xl font-black text-slate-700 mt-1">{stats.totalIn.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl"><Inbox className="size-6" /></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden border border-slate-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity OUT</p>
              <h3 className="text-2xl font-black text-slate-700 mt-1">{stats.totalOut.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Package className="size-6" /></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden border border-slate-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity Available</p>
              <h3 className="text-2xl font-black text-[#7a9800] mt-1">{stats.available.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Package className="size-6" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Consumable and Location Labels */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center px-4">
        <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
          <Layers className="size-3.5 text-[#7a9800]" />
          Consumable: <span className="font-black text-slate-700 ml-0.5 bg-slate-100 rounded-md px-2 py-0.5">{consumable?.name || '—'}</span>
        </div>
        <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
          <MapPin className="size-3.5 text-[#7a9800]" />
          Location: <span className="font-black text-slate-700 ml-0.5 bg-slate-100 rounded-md px-2 py-0.5">{locationName}</span>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="in" className="w-full">
        <TabsList className="bg-slate-100 rounded-xl h-12 p-1.5 mb-6 border border-slate-200/50 w-fit">
          <TabsTrigger value="in" className="rounded-lg font-black text-[10px] uppercase tracking-widest px-6 h-full transition-all">IN</TabsTrigger>
          <TabsTrigger value="out" className="rounded-lg font-black text-[10px] uppercase tracking-widest px-6 h-full transition-all">OUT</TabsTrigger>
          <TabsTrigger value="final" className="rounded-lg font-black text-[10px] uppercase tracking-widest px-6 h-full transition-all">Final Products</TabsTrigger>
          <TabsTrigger value="inventories" className="rounded-lg font-black text-[10px] uppercase tracking-widest px-6 h-full transition-all">Inventories</TabsTrigger>
        </TabsList>

        {/* ── TABS CONTENTS ── */}

        {/* IN Tab */}
        <TabsContent value="in" className="m-0 focus-visible:outline-none">
          <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden border border-slate-100">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-slate-50">
                  <TableRow className="hover:bg-transparent border-b border-slate-100">
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 pl-8">Location</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Operation</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Delivery Note Number</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Supplier</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Consumable</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right">Quantity</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right">Unit Price</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right pr-8">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedIn.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-48 text-center text-slate-400 font-medium italic">No IN transactions found.</TableCell>
                    </TableRow>
                  ) : (
                    paginatedIn.map((r, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <TableCell className="pl-8 py-4 font-bold text-slate-600">{r.locationName}</TableCell>
                        <TableCell className="font-bold text-slate-600">{r.date}</TableCell>
                        <TableCell><Badge className="bg-teal-50 text-teal-700 border-teal-100 text-[9px] font-black">{r.operation}</Badge></TableCell>
                        <TableCell className="font-bold text-slate-600">{r.deliveryNoteNumber}</TableCell>
                        <TableCell className="font-medium text-slate-500">{r.supplierName}</TableCell>
                        <TableCell className="font-black text-slate-700">{r.consumableName}</TableCell>
                        <TableCell className="text-right font-black text-slate-700">{r.quantity.toLocaleString()} <span className="text-[9px] text-slate-400">{r.quantityUnit}</span></TableCell>
                        <TableCell className="text-right font-bold text-slate-500">{r.unitPrice ? `${Number(r.unitPrice).toFixed(2)} ${r.currency}` : '—'}</TableCell>
                        <TableCell className="text-right font-black text-slate-700 pr-8">{r.totalAmount ? `${Number(r.totalAmount).toFixed(2)} ${r.currency}` : '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination page={pageIn} setPage={setPageIn} rowsPerPage={rowsPerPageIn} setRowsPerPage={setRowsPerPageIn} totalItems={inMovements.length} />
          </Card>
        </TabsContent>

        {/* OUT Tab */}
        <TabsContent value="out" className="m-0 focus-visible:outline-none">
          <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden border border-slate-100">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-slate-50">
                  <TableRow className="hover:bg-transparent border-b border-slate-100">
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 pl-8">Location</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Operation</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Delivery Note Number</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Supplier</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Consumable</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right">Quantity</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right">Unit Price</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right pr-8">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOut.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-48 text-center text-slate-400 font-medium italic">No OUT transactions found.</TableCell>
                    </TableRow>
                  ) : (
                    paginatedOut.map((r, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <TableCell className="pl-8 py-4 font-bold text-slate-600">{r.locationName}</TableCell>
                        <TableCell className="font-bold text-slate-600">{r.date}</TableCell>
                        <TableCell><Badge className="bg-amber-50 text-amber-700 border-amber-100 text-[9px] font-black">{r.operation}</Badge></TableCell>
                        <TableCell className="font-bold text-slate-600">{r.deliveryNoteNumber}</TableCell>
                        <TableCell className="font-medium text-slate-500">{r.supplierName}</TableCell>
                        <TableCell className="font-black text-slate-700">{r.consumableName}</TableCell>
                        <TableCell className="text-right font-black text-slate-700">{r.quantity.toLocaleString()} <span className="text-[9px] text-slate-400">{r.quantityUnit}</span></TableCell>
                        <TableCell className="text-right font-bold text-slate-500">{r.unitPrice ? `${Number(r.unitPrice).toFixed(2)} ${r.currency}` : '—'}</TableCell>
                        <TableCell className="text-right font-black text-slate-700 pr-8">{r.totalAmount ? `${Number(r.totalAmount).toFixed(2)} ${r.currency}` : '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination page={pageOut} setPage={setPageOut} rowsPerPage={rowsPerPageOut} setRowsPerPage={setRowsPerPageOut} totalItems={outMovements.length} />
          </Card>
        </TabsContent>

        {/* Final Products Tab */}
        <TabsContent value="final" className="m-0 focus-visible:outline-none">
          <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden border border-slate-100">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-slate-50">
                  <TableRow className="hover:bg-transparent border-b border-slate-100">
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 pl-8">Barcode Number</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Caliber</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Order Number</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Pallet Type</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Package Type</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right">Net Weight (KG)</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right">Number Of Boxes</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right pr-8">Quantity Consumed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProd.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-48 text-center text-slate-400 font-medium italic">No final products auto-consumptions found.</TableCell>
                    </TableRow>
                  ) : (
                    paginatedProd.map((r, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <TableCell className="pl-8 py-4 font-black text-slate-700">{r.barcodeNumber}</TableCell>
                        <TableCell className="font-bold text-slate-600">{r.caliber}</TableCell>
                        <TableCell className="font-bold text-slate-500">{r.orderNumber}</TableCell>
                        <TableCell className="font-medium text-slate-400">{r.palletType}</TableCell>
                        <TableCell className="font-bold text-slate-600">{r.packageType}</TableCell>
                        <TableCell className="text-right font-bold text-slate-600">{Number(r.netWeight || 0).toLocaleString()} KG</TableCell>
                        <TableCell className="text-right font-bold text-slate-600">{r.numberOfBoxes}</TableCell>
                        <TableCell className="text-right font-black text-[#7a9800] pr-8">{r.quantity.toLocaleString()} <span className="text-[9px] text-slate-400">{r.quantityUnit}</span></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination page={pageProd} setPage={setPageProd} rowsPerPage={rowsPerPageProd} setRowsPerPage={setRowsPerPageProd} totalItems={finalProductConsumptions.length} />
          </Card>
        </TabsContent>

        {/* Inventories Tab */}
        <TabsContent value="inventories" className="m-0 focus-visible:outline-none">
          <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden border border-slate-100">
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader className="bg-slate-50">
                  <TableRow className="hover:bg-transparent border-b border-slate-100">
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 pl-8">Location</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Consumable</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right">Quantity</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Note</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Created By</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 pr-8">Updated By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInv.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-48 text-center text-slate-400 font-medium italic">No inventory adjustments found.</TableCell>
                    </TableRow>
                  ) : (
                    paginatedInv.map((r, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <TableCell className="pl-8 py-4 font-bold text-slate-600">{r.locationName}</TableCell>
                        <TableCell className="font-bold text-slate-600">{r.date}</TableCell>
                        <TableCell className="font-black text-slate-700">{r.consumableName}</TableCell>
                        <TableCell className="text-right font-black text-rose-600">{Number(r.quantity || 0).toLocaleString()} Units</TableCell>
                        <TableCell className="max-w-[200px] truncate text-slate-500" title={r.note}>{r.note}</TableCell>
                        <TableCell className="font-bold text-slate-400 text-xs">{r.createdBy?.split('@')[0]}</TableCell>
                        <TableCell className="font-bold text-slate-400 text-xs pr-8">{r.updatedBy?.split('@')[0]}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination page={pageInv} setPage={setPageInv} rowsPerPage={rowsPerPageInv} setRowsPerPage={setRowsPerPageInv} totalItems={inventories.length} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
