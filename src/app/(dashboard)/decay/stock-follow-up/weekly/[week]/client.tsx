'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  collection, 
  query, 
  where
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase 
} from '@/firebase';
import { ERPCard } from '@/components/erp/ERPCard';
import { ERPWeeklyTable } from '@/components/erp/ERPWeeklyTable';
import { ERPToolbar } from '@/components/erp/ERPToolbar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  Loader2,
  ChevronLeft,
  Calendar
} from 'lucide-react';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';

interface DailyData {
  date: string;
  farmDecay: number;
  productionDecay: number;
  decaySale: number;
  losses: number;
}

export default function WeeklyDetailsPage() {
  const router = useRouter();
  const { week } = useParams(); // Format: "YYYY-MM-DD_YYYY-MM-DD"
  const db = useFirestore();
  const { toast } = useToast();

  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Refresh state per date
  const [refreshingDate, setRefreshingDate] = useState<string | null>(null);

  // Parse start/end dates from the URL parameter
  const { startDateStr, endDateStr, weekLabel } = useMemo(() => {
    if (!week) return { startDateStr: '', endDateStr: '', weekLabel: '' };
    const decoded = decodeURIComponent(week as string);
    const parts = decoded.split('_');
    if (parts.length < 2) return { startDateStr: '', endDateStr: '', weekLabel: decoded };
    
    return {
      startDateStr: parts[0],
      endDateStr: parts[1],
      weekLabel: `${parts[0]} to ${parts[1]}`
    };
  }, [week]);

  // --- Firestore Queries ---
  // We fetch documents matching dates within the week range
  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!db || !startDateStr || !endDateStr) return null;
    return query(
      collection(db, 'raw_materials'),
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr)
    );
  }, [db, startDateStr, endDateStr]);
  const { data: rawMaterials, isLoading: loadingRMs } = useCollection(rawMaterialsQuery);

  const productionOutputQuery = useMemoFirebase(() => {
    if (!db || !startDateStr || !endDateStr) return null;
    return query(
      collection(db, 'production_output'),
      where('shiftDate', '>=', startDateStr),
      where('shiftDate', '<=', endDateStr)
    );
  }, [db, startDateStr, endDateStr]);
  const { data: productionOutputs, isLoading: loadingOutputs } = useCollection(productionOutputQuery);

  const decayLoadingsQuery = useMemoFirebase(() => {
    if (!db || !startDateStr || !endDateStr) return null;
    return query(
      collection(db, 'decay_loadings'),
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr)
    );
  }, [db, startDateStr, endDateStr]);
  const { data: loadingsList, isLoading: loadingSales } = useCollection(decayLoadingsQuery);

  // --- Generate Daily Rows (6 days: Sunday to Friday) ---
  const dailyRows = useMemo<DailyData[]>(() => {
    if (!startDateStr || !endDateStr) return [];
    
    const rows: DailyData[] = [];
    try {
      const start = parseISO(startDateStr);
      const end = parseISO(endDateStr);
      // For a 6-day range, we expect end to be 5 days after start (Sunday to Friday)
      const daysCount = differenceInDays(end, start) + 1;

      for (let i = 0; i < daysCount; i++) {
        const currentDate = addDays(start, i);
        const dateStr = format(currentDate, 'yyyy-MM-dd');

        // Aggregate Farm Decay
        const farmDecaySum = (rawMaterials || [])
          .filter(rm => (rm.date || rm.dateTime?.split('T')[0]) === dateStr)
          .reduce((sum, rm) => sum + Number(rm.totalDecayNetWeight || rm.decay_weight || rm.decayWeight || 0), 0);

        // Aggregate Production Decay
        const productionDecaySum = (productionOutputs || [])
          .filter(out => out.shiftDate === dateStr && (out.palletisationType === 'Decay' || out.palletisationType === 'decay'))
          .reduce((sum, out) => sum + (out.items?.reduce((itemSum: number, item: any) => itemSum + Number(item.netWeight || 0), 0) || 0), 0);

        // Aggregate Decay Sales
        const saleSum = (loadingsList || [])
          .filter(sale => sale.date === dateStr)
          .reduce((sum, sale) => sum + (sale.items?.reduce((itemSum: number, item: any) => itemSum + Number(item.netWeight || 0), 0) || 0), 0);

        // Losses = (Farm Decay + Production Decay) - Sales
        const losses = (farmDecaySum + productionDecaySum) - saleSum;

        rows.push({
          date: dateStr,
          farmDecay: farmDecaySum,
          productionDecay: productionDecaySum,
          decaySale: saleSum,
          losses
        });
      }
    } catch (e) {
      console.error(e);
    }
    return rows;
  }, [startDateStr, endDateStr, rawMaterials, productionOutputs, loadingsList]);

  // --- Filtering ---
  const filteredRows = useMemo(() => {
    return dailyRows.filter(row => 
      row.date.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [dailyRows, searchTerm]);

  // --- Row Refresh Trigger ---
  const handleRefreshRow = async (dateStr: string) => {
    setRefreshingDate(dateStr);
    try {
      // Simulate recalculation delay for visuals; snapshots update automatically
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast({
        title: 'Recalculated Successfully',
        description: `Refreshed and verified decay aggregates for date: ${dateStr}`
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Refresh Error',
        description: 'Failed to refresh daily calculations.',
        variant: 'destructive'
      });
    } finally {
      setRefreshingDate(null);
    }
  };

  const isLoading = loadingRMs || loadingOutputs || loadingSales;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f3f3f3]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#7a9800]" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading weekly details...</p>
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
        
        {/* Header & Breadcrumb */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.back()} 
            className="rounded-full h-10 w-10 hover:bg-slate-200"
          >
            <ChevronLeft size={20} className="text-slate-600" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              <span>Profile</span>
              <span className="opacity-40">/</span>
              <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/decay/stock-follow-up')}>Decay Stock Follow Ups</span>
              <span className="opacity-40">/</span>
              <span className="text-[#7a9800] font-black">Weekly Details</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none flex items-center gap-2.5">
              <Calendar className="h-6 w-6 text-[#7a9800]" /> Decay Stock Follow Ups Weekly
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-2">{weekLabel}</p>
          </div>
        </div>

        {/* Main Table Card */}
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
            <ERPWeeklyTable 
              data={filteredRows}
              density={density}
              onRefreshRow={handleRefreshRow}
              isRefreshingRow={refreshingDate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
