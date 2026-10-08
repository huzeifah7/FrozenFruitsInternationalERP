'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  orderBy, 
  setDoc,
  doc 
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
  useUser 
} from '@/firebase';
import { ERPCard } from '@/components/erp/ERPCard';
import { ERPTable } from '@/components/erp/ERPTable';
import { ERPToolbar } from '@/components/erp/ERPToolbar';
import { ERPModal } from '@/components/erp/ERPModal';
import { ERPButton } from '@/components/erp/ERPButton';
import { ERPStatisticCard } from '@/components/erp/ERPStatisticCard';
import { ERPActionButton } from '@/components/erp/ERPActionButton';
import { ERPInput } from '@/components/erp/ERPInput';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  Loader2,
  Database
} from 'lucide-react';
import { format, startOfWeek, addDays, parseISO, addWeeks } from 'date-fns';
import { usePermissions } from '@/hooks/use-permissions';

interface WeekData {
  weekKey: string; // e.g. "2025-11-30_2025-12-05"
  label: string;   // e.g. "2025-11-30 to 2025-12-05"
  farmDecay: number;
  productionDecay: number;
  decaySale: number;
  remainingStock: number;
  stock: number;
  losses: number;
}

export default function DecayStockFollowUpPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { canUpdate } = usePermissions('decay.stock-follow-up');

  // --- UI States ---
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalWeekKey, setModalWeekKey] = useState('');
  const [modalWeekLabel, setModalWeekLabel] = useState('');
  const [stockInput, setStockInput] = useState('');
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);

  // --- Firestore Collections ---
  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'raw_materials');
  }, [db]);
  const { data: rawMaterials, isLoading: loadingRMs } = useCollection(rawMaterialsQuery);

  const productionOutputQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'production_output');
  }, [db]);
  const { data: productionOutputs, isLoading: loadingOutputs } = useCollection(productionOutputQuery);

  const decayLoadingsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'decay_loadings');
  }, [db]);
  const { data: loadingsList, isLoading: loadingSales } = useCollection(decayLoadingsQuery);

  const decayStocksQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'decay_stocks');
  }, [db]);
  const { data: stocksList, isLoading: loadingStocks } = useCollection(decayStocksQuery);

  // --- Group Data by Week ---
  const weeksData = useMemo<WeekData[]>(() => {
    if (loadingRMs || loadingOutputs || loadingSales || loadingStocks) return [];

    const weeksMap: Record<string, WeekData> = {};
    
    // Helper to get 6-day (Sunday-to-Friday) week boundaries
    const getWeekBoundaries = (d: Date) => {
      const start = startOfWeek(d, { weekStartsOn: 0 }); // Sunday
      const end = addDays(start, 5);                     // Friday (6 days: Sun to Fri)
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      return {
        key: `${startStr}_${endStr}`,
        label: `${startStr} to ${endStr}`,
        start,
        end
      };
    };

    // Generate last 12 weeks
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const d = addWeeks(today, -i);
      const { key, label } = getWeekBoundaries(d);
      weeksMap[key] = {
        weekKey: key,
        label,
        farmDecay: 0,
        productionDecay: 0,
        decaySale: 0,
        remainingStock: 0,
        stock: 0,
        losses: 0
      };
    }

    // Process Raw Materials for Farm Decay
    (rawMaterials || []).forEach(rm => {
      const dateStr = rm.date || (rm.dateTime ? rm.dateTime.split('T')[0] : null);
      if (!dateStr) return;
      try {
        const d = parseISO(dateStr);
        const { key, label } = getWeekBoundaries(d);
        const farmDecayWeight = Number(rm.totalDecayNetWeight || rm.decay_weight || rm.decayWeight || 0);

        if (!weeksMap[key]) {
          weeksMap[key] = { weekKey: key, label, farmDecay: 0, productionDecay: 0, decaySale: 0, remainingStock: 0, stock: 0, losses: 0 };
        }
        weeksMap[key].farmDecay += farmDecayWeight;
      } catch (e) {
        console.error(e);
      }
    });

    // Process Production Output for Production Decay
    (productionOutputs || []).forEach(out => {
      const dateStr = out.shiftDate;
      if (!dateStr) return;
      try {
        const d = parseISO(dateStr);
        const { key, label } = getWeekBoundaries(d);
        const palletNetWeight = out.items?.reduce((sum: number, item: any) => sum + (Number(item.netWeight) || 0), 0) || 0;

        if (out.palletisationType === 'Decay' || out.palletisationType === 'decay') {
          if (!weeksMap[key]) {
            weeksMap[key] = { weekKey: key, label, farmDecay: 0, productionDecay: 0, decaySale: 0, remainingStock: 0, stock: 0, losses: 0 };
          }
          weeksMap[key].productionDecay += palletNetWeight;
        }
      } catch (e) {
        console.error(e);
      }
    });

    // Process Decay Loadings for Decay Sales
    (loadingsList || []).forEach(sale => {
      const dateStr = sale.date;
      if (!dateStr) return;
      try {
        const d = parseISO(dateStr);
        const { key, label } = getWeekBoundaries(d);
        const saleWeight = sale.items?.reduce((sum: number, item: any) => sum + (Number(item.netWeight) || 0), 0) || 0;

        if (!weeksMap[key]) {
          weeksMap[key] = { weekKey: key, label, farmDecay: 0, productionDecay: 0, decaySale: 0, remainingStock: 0, stock: 0, losses: 0 };
        }
        weeksMap[key].decaySale += saleWeight;
      } catch (e) {
        console.error(e);
      }
    });

    // Process Manual Stock Settings
    (stocksList || []).forEach(st => {
      const key = st.id; // Doc ID is the weekKey
      if (weeksMap[key]) {
        weeksMap[key].stock = Number(st.stock || 0);
      } else {
        // If there's recorded stock for an older week, keep it
        weeksMap[key] = {
          weekKey: key,
          label: key.replace('_', ' to '),
          farmDecay: 0,
          productionDecay: 0,
          decaySale: 0,
          stock: Number(st.stock || 0),
          remainingStock: 0,
          losses: 0
        };
      }
    });

    // Calculate Remaining Stock & Losses:
    // Remaining Stock = (Farm Decay + Production Decay) - Decay Sales
    // Losses = Remaining Stock - Stock
    return Object.values(weeksMap).map(w => {
      const remainingStock = (w.farmDecay + w.productionDecay) - w.decaySale;
      const losses = remainingStock - w.stock;
      return {
        ...w,
        remainingStock,
        losses
      };
    }).sort((a, b) => b.weekKey.localeCompare(a.weekKey));

  }, [rawMaterials, productionOutputs, loadingsList, stocksList, loadingRMs, loadingOutputs, loadingSales, loadingStocks]);

  // --- Filtering ---
  const filteredWeeks = useMemo(() => {
    return weeksData.filter(w => 
      w.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [weeksData, searchTerm]);

  // Stock Situation KPI (Stock Situation = ∑(Farm Decay + Production Decay - Decay Sales))
  const stockSituationValue = useMemo(() => {
    const total = weeksData.reduce((sum, w) => sum + (w.farmDecay + w.productionDecay - w.decaySale), 0);
    return `${total.toFixed(2)} KG`;
  }, [weeksData]);

  // --- Open Stock Modal ---
  const handleOpenStockModal = (e: React.MouseEvent, weekKey: string, label: string, currentStock: number) => {
    e.stopPropagation(); // Stop click-through row selection
    setModalWeekKey(weekKey);
    setModalWeekLabel(label);
    setStockInput(currentStock !== 0 ? currentStock.toString() : '');
    setIsModalOpen(true);
  };

  // --- Submit Stock Update ---
  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !modalWeekKey) return;

    const val = Number(stockInput);
    if (isNaN(val)) {
      toast({ title: 'Validation Error', description: 'Stock must be a valid number.', variant: 'destructive' });
      return;
    }

    setIsSubmittingStock(true);
    try {
      const stockRef = doc(db, 'decay_stocks', modalWeekKey);
      await setDoc(stockRef, {
        stock: val,
        updatedAt: new Date(),
        updatedBy: user.email || 'unknown'
      });
      toast({ title: 'Success', description: `Stock updated for week ${modalWeekLabel.split(' to ')[0]}.` });
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save stock situation.', variant: 'destructive' });
    } finally {
      setIsSubmittingStock(false);
    }
  };

  // --- Table Columns ---
  const columns = [
    {
      header: 'Week',
      accessorKey: 'label',
      render: (row: WeekData) => (
        <span 
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/decay/stock-follow-up/weekly/${row.weekKey}`);
          }}
          className="text-[#7a9800] font-black cursor-pointer hover:underline decoration-2 whitespace-nowrap"
        >
          {row.label}
        </span>
      )
    },
    {
      header: 'Farm decay Net Weight',
      accessorKey: 'farmDecay',
      align: 'right' as const,
      render: (row: WeekData) => (
        <span className="font-black text-[#2e1d52]">
          {row.farmDecay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
        </span>
      )
    },
    {
      header: 'Production Decay Net Weight',
      accessorKey: 'productionDecay',
      align: 'right' as const,
      render: (row: WeekData) => (
        <span className="font-black text-[#2e1d52]">
          {row.productionDecay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
        </span>
      )
    },
    {
      header: 'Decay sales Net Weight',
      accessorKey: 'decaySale',
      align: 'right' as const,
      render: (row: WeekData) => (
        <span className="font-black text-[#7a9800]">
          {row.decaySale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
        </span>
      )
    },
    {
      header: 'Stock',
      accessorKey: 'stock',
      align: 'center' as const,
      render: (row: WeekData) => (
        <div className="flex items-center justify-center gap-3">
          <span className="font-black text-slate-800">
            {row.stock.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
          </span>
          {canUpdate && (
            <ERPActionButton
              onClick={(e) => handleOpenStockModal(e, row.weekKey, row.label, row.stock)}
              variantType="green"
              className="h-7 px-2.5 text-[9px]"
            >
              Update
            </ERPActionButton>
          )}
        </div>
      )
    },
    {
      header: 'Losses',
      accessorKey: 'losses',
      align: 'right' as const,
      render: (row: WeekData) => (
        <span className="font-black text-rose-500">
          {row.losses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
        </span>
      )
    }
  ];

  const isLoading = loadingRMs || loadingOutputs || loadingSales || loadingStocks;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FB]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#7a9800]" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading stock follow ups...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full bg-[#f3f3f3] min-h-screen transition-all duration-300",
      isFullscreen ? "fixed inset-0 z-50 p-6 overflow-y-auto bg-[#f3f3f3]" : "p-6 lg:p-8"
    )}>
      <div className="max-w-[1600px] mx-auto flex flex-col gap-6 w-full h-full flex-1">
        
        {/* 1. Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              <span className="hover:text-slate-600 cursor-pointer">Profile</span>
              <span className="opacity-40">/</span>
              <span className="text-[#7a9800] font-black">Decay Stock Follow Ups</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">
              Decay Stock Follow Ups
            </h1>
          </div>
        </div>

        {/* 2. Top Summary KPI Card */}
        <div className="w-full flex">
          <ERPStatisticCard 
            label="Stock situation" 
            value={stockSituationValue} 
            icon={<Database size={20} />}
            className="w-full sm:w-[280px]"
          />
        </div>

        {/* 3. Main Data Table Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden flex flex-col flex-1 min-h-0">
          <ERPToolbar 
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            density={density}
            onDensityChange={setDensity}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen(prev => !prev)}
          />

          <div className="flex-1 min-h-0 flex flex-col bg-white">
            <ERPTable 
              columns={columns}
              data={filteredWeeks}
              density={density}
              selectedRowId={selectedRowId}
              onRowClick={(row) => setSelectedRowId(row.weekKey)}
              getRowId={(row) => row.weekKey}
              pageSize={10}
            />
          </div>
        </div>
      </div>

      {/* 4. Update Stock Modal */}
      <ERPModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Add Decay Quantity"
        description={`Set inventory stock situation for week: ${modalWeekLabel}`}
        footer={
          <>
            <Button 
              variant="ghost" 
              type="button" 
              onClick={() => setIsModalOpen(false)}
              className="font-bold uppercase tracking-widest text-[10px] h-10 px-5 rounded-xl border border-slate-200"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveStock}
              disabled={isSubmittingStock || !stockInput}
              className="bg-[#2e1d52] hover:bg-[#1a0e36] text-white font-black uppercase tracking-widest text-[10px] h-10 px-6 rounded-xl shadow-lg shadow-[#2e1d52]/10 transition-transform active:scale-95 disabled:opacity-50"
            >
              {isSubmittingStock ? 'Submitting...' : 'Submit'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveStock} className="space-y-4">
          <ERPInput
            label="Enter Stock (KG)"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={stockInput}
            onChange={e => setStockInput(e.target.value)}
            required
            autoFocus
          />
        </form>
      </ERPModal>
    </div>
  );
}
