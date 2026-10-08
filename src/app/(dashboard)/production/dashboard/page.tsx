'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  useUser,
} from '@/firebase';
import {
  collection,
  query,
  orderBy,
} from '@/firebase/firestore-override';
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { 
  Download, 
  Calendar, 
  Scale, 
  Package, 
  TrendingUp, 
  Activity, 
  Filter, 
  X, 
  MapPin, 
  ChevronRight, 
  Loader2,
  ChevronDown,
  Check,
  AlertTriangle,
  RefreshCw,
  Search,
  LayoutDashboard
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Helper to determine start and end dates based on range selection
const getDateRangeDates = (range: string) => {
  const now = new Date();
  let start = '';
  let end = '';

  switch (range) {
    case 'this-week': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(now.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      start = monday.toISOString().split('T')[0];
      end = sunday.toISOString().split('T')[0];
      break;
    }
    case 'this-month': {
      const y = now.getFullYear();
      const m = now.getMonth();
      const firstDay = new Date(y, m, 1);
      const lastDay = new Date(y, m + 1, 0);
      start = firstDay.toISOString().split('T')[0];
      end = lastDay.toISOString().split('T')[0];
      break;
    }
    case 'this-year': {
      const y = now.getFullYear();
      start = `${y}-01-01`;
      end = `${y}-12-31`;
      break;
    }
    case 'last-year': {
      const y = now.getFullYear() - 1;
      start = `${y}-01-01`;
      end = `${y}-12-31`;
      break;
    }
    case 'season-2025-2026': {
      start = '2025-10-01';
      end = '2026-09-30';
      break;
    }
    default:
      start = '2025-10-01';
      end = '2026-09-30';
      break;
  }
  return { start, end };
};

const RANGE_LABELS: Record<string, string> = {
  'this-week': 'This Week',
  'this-month': 'This Month',
  'this-year': 'This Year',
  'last-year': 'Last Year',
  'season-2025-2026': 'Season 2025 to 2026',
};

export default function ProductionDashboardPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  // --- Filtering & UI States ---
  const [dateRange, setDateRange] = useState<string>('season-2025-2026');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [selectedCaliber, setSelectedCaliber] = useState<string | null>(null);

  // Parse active start and end dates based on range selection
  const { activeStartDate, activeEndDate } = useMemo(() => {
    if (customStartDate || customEndDate) {
      return { activeStartDate: customStartDate, activeEndDate: customEndDate };
    }
    const { start, end } = getDateRangeDates(dateRange);
    return { activeStartDate: start, activeEndDate: end };
  }, [dateRange, customStartDate, customEndDate]);

  // --- Firestore Queries ---
  const outputQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'production_output'), orderBy('shiftDate', 'desc'));
  }, [db, user]);

  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'raw_materials'), orderBy('dateTime', 'desc'));
  }, [db, user]);

  const locationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'processing_lines');
  }, [db, user]);

  const { data: outputs, isLoading: isLoadingOutputs } = useCollection(outputQuery);
  const { data: rawMaterials, isLoading: isLoadingRaw } = useCollection(rawMaterialsQuery);
  const { data: locations, isLoading: isLoadingLocs } = useCollection(locationsQuery);

  const isLoading = isLoadingOutputs || isLoadingRaw || isLoadingLocs;

  // --- Helpers ---
  const getLocName = (id: string) => locations?.find(l => l.id === id)?.title || id || 'Unknown';

  // --- Filtered Data Computations ---
  const filteredOutputs = useMemo(() => {
    if (!outputs) return [];
    return outputs.filter(item => {
      // Date range filter
      if (activeStartDate && item.shiftDate < activeStartDate) return false;
      if (activeEndDate && item.shiftDate > activeEndDate) return false;

      // Location filter
      if (selectedLocation !== 'all' && item.locationName !== selectedLocation) return false;

      // Caliber filter (if interactive click is active)
      if (selectedCaliber) {
        if (selectedCaliber === 'Decay') {
          return item.palletisationType === 'decay';
        }
        const hasCaliber = item.items?.some((i: any) => {
          const cal = (i.caliber || '').trim();
          if (selectedCaliber === 'Usage Industriel') {
            return cal.toLowerCase().includes('indust') || cal.toLowerCase().includes('indus');
          }
          return cal === selectedCaliber;
        });
        if (!hasCaliber) return false;
      }

      return true;
    });
  }, [outputs, activeStartDate, activeEndDate, selectedLocation, selectedCaliber]);

  const filteredRawMaterials = useMemo(() => {
    if (!rawMaterials) return [];
    return rawMaterials.filter(rm => {
      const itemDate = rm.date || (rm.dateTime ? rm.dateTime.substring(0, 10) : '');
      if (activeStartDate && itemDate < activeStartDate) return false;
      if (activeEndDate && itemDate > activeEndDate) return false;

      // Location filter
      if (selectedLocation !== 'all') {
        const rmLocName = getLocName(rm.locationId);
        if (rmLocName !== selectedLocation) return false;
      }

      return true;
    });
  }, [rawMaterials, activeStartDate, activeEndDate, selectedLocation, locations]);

  // --- 1. Summary Card Statistics ---
  const kpis = useMemo(() => {
    let receptions = 0;
    let blReceptions = 0;
    let finishedProducts = 0;
    let decay = 0;
    let returns = 0;
    let pendingReste = 0;

    // A. Receptions from Raw Materials Intakes
    filteredRawMaterials.forEach(rm => {
      receptions += Number(rm.totalNetWeight || rm.netWeight || 0);
      blReceptions += Number(rm.blNetWeight || 0);
    });

    // B. Pallets outputs breakdown
    filteredOutputs.forEach(output => {
      const palletWeight = output.items?.reduce((sum: number, item: any) => sum + (Number(item.netWeight) || 0), 0) || 0;
      const type = output.palletisationType;

      if (type === 'Final product' || type === 'Out Of Program') {
        finishedProducts += palletWeight;
      } else if (type === 'decay') {
        decay += palletWeight;
      } else if (type === 'Return') {
        returns += palletWeight;
      } else if (type === 'Pending' || type === 'Reste') {
        pendingReste += palletWeight;
      }
    });

    // C. Losses Formula: Receptions - (Finished + Decay + Return + Pending/Reste)
    const losses = Math.max(0, receptions - (finishedProducts + decay + returns + pendingReste));

    const weightDiff = blReceptions - receptions;

    return {
      receptions,
      finishedProducts,
      decay,
      losses,
      weightDiff,
    };
  }, [filteredOutputs, filteredRawMaterials]);

  // --- 2. Caliber Analytics Chart Data ---
  const calibersData = useMemo(() => {
    const caliberMap: Record<string, number> = {
      '10': 0, '12': 0, '14': 0, '16': 0, '18': 0, '20': 0, '22': 0, '24': 0, '26': 0, '28': 0, '30': 0, '32': 0,
      'Usage Industriel': 0,
      'Decay': 0
    };

    filteredOutputs.forEach(output => {
      const palletWeight = output.items?.reduce((sum: number, item: any) => sum + (Number(item.netWeight) || 0), 0) || 0;

      if (output.palletisationType === 'decay') {
        caliberMap['Decay'] += palletWeight;
      } else {
        output.items?.forEach((item: any) => {
          const cal = (item.caliber || '').trim();
          const itemWeight = Number(item.netWeight) || 0;

          if (cal in caliberMap) {
            caliberMap[cal] += itemWeight;
          } else if (cal.toLowerCase().includes('indust') || cal.toLowerCase().includes('indus')) {
            caliberMap['Usage Industriel'] += itemWeight;
          } else {
            // General fallback to industrial usage if it's undefined or unrecognized
            caliberMap['Usage Industriel'] += itemWeight;
          }
        });
      }
    });

    const totalWeight = Object.values(caliberMap).reduce((sum, w) => sum + w, 0);

    return Object.entries(caliberMap).map(([name, value]) => {
      const percentage = totalWeight > 0 ? (value / totalWeight) * 100 : 0;
      return {
        name,
        weight: value,
        percentage: parseFloat(percentage.toFixed(2)),
      };
    });
  }, [filteredOutputs]);

  // --- 3. Calculated Shift Daily Reports Section ---
  const shiftDailyReports = useMemo(() => {
    const groups: Record<string, any> = {};

    filteredOutputs.forEach(output => {
      const key = `${output.shiftDate}_${output.locationName}_${output.shift}`;
      if (!groups[key]) {
        groups[key] = {
          shiftDate: output.shiftDate,
          locationName: output.locationName || 'Unknown',
          shift: output.shift || '1',
          finishedProductsNetWeight: 0,
          smallCalibers: 0,
          returnTotal: 0,
          decayTotal: 0,
          pendingResteWeight: 0,
          totalConsumption: 0,
        };
      }

      const palletWeight = output.items?.reduce((sum: number, item: any) => sum + (Number(item.netWeight) || 0), 0) || 0;
      const type = output.palletisationType;

      if (type === 'Final product' || type === 'Out Of Program') {
        groups[key].finishedProductsNetWeight += palletWeight;
      } else if (type === 'Small caliber') {
        groups[key].smallCalibers += palletWeight;
      } else if (type === 'Return') {
        groups[key].returnTotal += palletWeight;
      } else if (type === 'decay') {
        groups[key].decayTotal += palletWeight;
      } else if (type === 'Pending' || type === 'Reste') {
        groups[key].pendingResteWeight += palletWeight;
      }
    });

    // Integrate Total Consumption by matching raw materials date and location
    Object.keys(groups).forEach(key => {
      const g = groups[key];
      let intakeSum = 0;
      
      filteredRawMaterials.forEach(rm => {
        const itemDate = rm.date || (rm.dateTime ? rm.dateTime.substring(0, 10) : '');
        const rmLocName = getLocName(rm.locationId);
        if (itemDate === g.shiftDate && rmLocName === g.locationName) {
          intakeSum += Number(rm.totalNetWeight || rm.blNetWeight || 0);
        }
      });

      // Fallback calculation: Total Out + Decay + Returns + Pending
      g.totalConsumption = intakeSum || (g.finishedProductsNetWeight + g.decayTotal + g.returnTotal + g.pendingResteWeight + g.smallCalibers);
    });

    // Limit to Top 10 sorted descending by Shift Date
    return Object.values(groups)
      .sort((a, b) => b.shiftDate.localeCompare(a.shiftDate))
      .slice(0, 10);
  }, [filteredOutputs, filteredRawMaterials, locations]);

  // --- Action Handlers ---
  const handleRangeSelect = (range: string) => {
    setDateRange(range);
    setCustomStartDate('');
    setCustomEndDate('');
    setIsRangeOpen(false);
  };

  const handleExportPDF = () => {
    window.print();
    toast({
      title: "Export Success",
      description: "Successfully prepared dashboard layout for PDF printing.",
    });
  };

  const clearLocationFilter = () => {
    setSelectedLocation('all');
  };

  const clearCaliberFilter = () => {
    setSelectedCaliber(null);
  };

  const handleCaliberClick = (data: any) => {
    if (data && data.activeLabel) {
      const caliberName = data.activeLabel;
      setSelectedCaliber(prev => prev === caliberName ? null : caliberName);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#f3f3f3] w-full text-foreground relative overflow-x-hidden font-body print-container">
      {/* Styles for High-End PDF printing output without sidebar or interactive components */}
      <style jsx global>{`
        @media print {
          body, html {
            background: #ffffff !important;
            color: #000000 !important;
          }
          nav, header, button, .no-print, .dropdown-portal, [role="menu"] {
            display: none !important;
          }
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .print-card {
            border: 1px solid #e5e7eb !important;
            box-shadow: none !important;
            break-inside: avoid !important;
            background: white !important;
          }
          .print-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>

      {/* --- PAGE HEADER --- */}
      <div className="px-6 md:px-10 py-6 bg-white border-b border-primary/5 shadow-sm sticky top-0 z-20 no-print">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 w-full">
          <div>
            <div className="flex items-center gap-2 text-[10px] md:text-xs font-black text-muted-foreground/60 uppercase tracking-[0.2em] mb-1.5">
              <span>Profile</span>
              <span className="opacity-30">/</span>
              <span className="text-[#7a9800] font-black">Production Dashboard</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] uppercase tracking-tight flex items-center gap-3">
              <LayoutDashboard className="h-7 w-7 text-[#7a9800]" />
              Production Dashboard
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Dynamic Date Range Selector Dropdown */}
            <div className="relative">
              <Button
                onClick={() => setIsRangeOpen(!isRangeOpen)}
                className="h-12 px-5 bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 rounded-xl font-bold flex items-center gap-3 shadow-sm text-xs transition-all duration-300"
              >
                <Calendar className="h-4.5 w-4.5 text-[#7a9800]" />
                <span className="uppercase tracking-wider">{RANGE_LABELS[dateRange] || 'Custom Range'}</span>
                <ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform duration-300", isRangeOpen && "transform rotate-180")} />
              </Button>

              {isRangeOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsRangeOpen(false)} />
                  <div className="absolute right-0 mt-2.5 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2.5 z-40 animate-in fade-in slide-in-from-top-3 duration-300">
                    <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-3 py-1.5 mb-1.5">
                      Select Period
                    </div>
                    {Object.entries(RANGE_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => handleRangeSelect(key)}
                        className={cn(
                          "w-full text-left px-4 py-3 text-xs font-bold rounded-xl flex items-center justify-between transition-all duration-200 hover:bg-[#7a9800]/5 hover:text-[#7a9800]",
                          dateRange === key ? "bg-[#7a9800]/10 text-[#7a9800]" : "text-gray-700"
                        )}
                      >
                        <span>{label}</span>
                        {dateRange === key && <Check className="h-4 w-4 text-[#7a9800] stroke-[3]" />}
                      </button>
                    ))}

                    <div className="border-t border-gray-100 my-2 pt-2.5">
                      <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest px-3 py-1.5 mb-1.5">
                        Custom Range
                      </div>
                      <div className="grid grid-cols-2 gap-2 px-2.5 pb-1.5">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-bold text-gray-400 uppercase">From</Label>
                          <Input
                            type="date"
                            value={customStartDate}
                            onChange={(e) => {
                              setCustomStartDate(e.target.value);
                              setDateRange('custom');
                            }}
                            className="h-9 rounded-lg text-xs font-bold bg-gray-50 border-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-bold text-gray-400 uppercase">To</Label>
                          <Input
                            type="date"
                            value={customEndDate}
                            onChange={(e) => {
                              setCustomEndDate(e.target.value);
                              setDateRange('custom');
                            }}
                            className="h-9 rounded-lg text-xs font-bold bg-gray-50 border-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Export PDF Button */}
            <Button
              onClick={handleExportPDF}
              className="h-12 px-6 bg-[#7a9800] hover:bg-[#6c8500] text-white font-black rounded-xl shadow-xl shadow-[#7a9800]/20 tracking-[0.15em] text-[10px] uppercase gap-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] duration-300"
            >
              <Download className="h-4.5 w-4.5" />
              Export PDF
            </Button>
          </div>
        </div>
      </div>

      {/* --- DASHBOARD WRAPPER --- */}
      <div className="p-6 md:p-10 max-w-[1600px] mx-auto w-full space-y-8 print-container">
        
        {/* Active Filters Display */}
        {(selectedLocation !== 'all' || selectedCaliber) && (
          <div className="flex flex-wrap items-center gap-3.5 bg-white p-3 px-5 rounded-2xl border border-primary/5 shadow-sm no-print">
            <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-[#7a9800]" /> Active Filters:
            </div>
            
            {selectedLocation !== 'all' && (
              <span className="inline-flex items-center gap-2 bg-[#7a9800]/10 text-[#7a9800] px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
                <MapPin className="h-3 w-3" /> Location: {selectedLocation}
                <button onClick={clearLocationFilter} className="hover:text-rose-500 transition-colors ml-1">
                  <X className="h-3.5 w-3.5 stroke-[3]" />
                </button>
              </span>
            )}

            {selectedCaliber && (
              <span className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
                <Activity className="h-3 w-3" /> Caliber: {selectedCaliber}
                <button onClick={clearCaliberFilter} className="hover:text-rose-500 transition-colors ml-1">
                  <X className="h-3.5 w-3.5 stroke-[3]" />
                </button>
              </span>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearLocationFilter();
                clearCaliberFilter();
              }}
              className="text-xs font-black text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl px-3 h-8 ml-auto uppercase tracking-widest"
            >
              Clear All
            </Button>
          </div>
        )}

        {/* --- SUMMARY ANALYTICS CARDS --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 print-grid">
          
          {/* Card 1: Receptions */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between transition-all hover:scale-[1.02] hover:shadow-md duration-300 print-card">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-[#2e1d52]/40 uppercase tracking-widest">Total Receptions</p>
              <h3 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight">
                {isLoading ? (
                  <div className="h-8 w-28 bg-gray-100 animate-pulse rounded-lg" />
                ) : (
                  `${kpis.receptions.toLocaleString()} KG`
                )}
              </h3>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-[#7a9800]/10 flex items-center justify-center text-[#7a9800]">
              <Scale size={24} className="stroke-[2.5]" />
            </div>
          </div>

          {/* Card 2: Finished Products */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between transition-all hover:scale-[1.02] hover:shadow-md duration-300 print-card">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-[#2e1d52]/40 uppercase tracking-widest">Finished Products</p>
              <h3 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight">
                {isLoading ? (
                  <div className="h-8 w-28 bg-gray-100 animate-pulse rounded-lg" />
                ) : (
                  `${kpis.finishedProducts.toLocaleString()} KG`
                )}
              </h3>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-[#7a9800]/10 flex items-center justify-center text-[#7a9800]">
              <Package size={24} className="stroke-[2.5]" />
            </div>
          </div>

          {/* Card 3: Decay */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between transition-all hover:scale-[1.02] hover:shadow-md duration-300 print-card">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-[#2e1d52]/40 uppercase tracking-widest">Total Decay</p>
              <h3 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight">
                {isLoading ? (
                  <div className="h-8 w-28 bg-gray-100 animate-pulse rounded-lg" />
                ) : (
                  `${kpis.decay.toLocaleString()} KG`
                )}
              </h3>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
              <TrendingUp size={24} className="stroke-[2.5]" />
            </div>
          </div>

          {/* Card 4: Losses */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between transition-all hover:scale-[1.02] hover:shadow-md duration-300 print-card">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-[#2e1d52]/40 uppercase tracking-widest">Production Losses</p>
              <h3 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight">
                {isLoading ? (
                  <div className="h-8 w-28 bg-gray-100 animate-pulse rounded-lg" />
                ) : (
                  `${kpis.losses.toLocaleString()} KG`
                )}
              </h3>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
              <Activity size={24} className="stroke-[2.5]" />
            </div>
          </div>

          {/* Card 5: Weight Difference */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between transition-all hover:scale-[1.02] hover:shadow-md duration-300 print-card">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-[#2e1d52]/40 uppercase tracking-widest">Weight Difference</p>
              <h3 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight">
                {isLoading ? (
                  <div className="h-8 w-28 bg-gray-100 animate-pulse rounded-lg" />
                ) : (
                  `${kpis.weightDiff.toLocaleString()} KG`
                )}
              </h3>
            </div>
            <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
              <Scale size={24} className="stroke-[2.5]" />
            </div>
          </div>

        </div>

        {/* --- CALIBERS ANALYTICS CHART --- */}
        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-gray-100 shadow-sm space-y-6 print-card">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-[#2e1d52] mb-1">
                Calibers Yield Distribution %
              </h2>
              <p className="text-xs text-muted-foreground">
                Percentage representation based on total raw material output weights YTD. Click any caliber bar to filter details below.
              </p>
            </div>
            {selectedCaliber && (
              <Button
                onClick={clearCaliberFilter}
                variant="outline"
                className="h-9 px-3 rounded-lg border-[#7a9800]/20 hover:bg-[#7a9800]/5 text-[#7a9800] text-[10px] font-black uppercase tracking-wider no-print ml-auto gap-1.5"
              >
                Reset Selection
              </Button>
            )}
          </div>

          <div className="w-full h-[400px]">
            {isLoading ? (
              <div className="w-full h-full bg-gray-50 animate-pulse rounded-3xl flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-[#7a9800]" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={calibersData}
                  onClick={handleCaliberClick}
                  margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
                  className="cursor-pointer"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false}
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }}
                    unit="%"
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(122, 152, 0, 0.04)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-4.5 rounded-2xl shadow-2xl border border-gray-100 space-y-1.5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#7a9800]">
                              Caliber {data.name}
                            </p>
                            <p className="text-sm font-black text-[#2e1d52]">
                              {data.weight.toLocaleString()} KG
                            </p>
                            <p className="text-[10px] font-bold text-gray-400">
                              Yield Share: {data.percentage}%
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar 
                    dataKey="percentage" 
                    radius={[6, 6, 0, 0]}
                  >
                    {calibersData.map((entry, index) => {
                      const isSelected = selectedCaliber === entry.name;
                      let fill = '#7a9800'; // Default olive green
                      if (entry.name === 'Decay') {
                        fill = '#ef4444'; // decay in soft red
                      } else if (entry.name === 'Usage Industriel') {
                        fill = '#f59e0b'; // industrial in amber
                      }
                      
                      // Dim unselected bars if filter is active
                      if (selectedCaliber && !isSelected) {
                        fill = `${fill}33`; // 20% opacity
                      }

                      return <Cell key={`cell-${index}`} fill={fill} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* --- TOP 10 CALCULATED DAILY REPORTS SECTION --- */}
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden print-card">
          <div className="bg-gray-50/50 px-8 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-[#2e1d52] mb-1">
                Top 10 Calculated Daily Reports
              </h2>
              <p className="text-xs text-muted-foreground">
                Dynamic aggregation of production output and receptions mapped by Shift Date, Location, and Shift.
              </p>
            </div>
            
            {/* Quick Status Info */}
            <span className="px-3.5 py-1.5 bg-[#7a9800]/5 text-[#7a9800] rounded-xl text-[10px] font-black uppercase tracking-widest ml-auto sm:ml-0 no-print">
              Live Aggregated Data
            </span>
          </div>

          <div className="overflow-x-auto w-full custom-scrollbar">
            <Table className="min-w-[1200px] w-full">
              <TableHeader className="bg-gray-50/50 border-b border-gray-100">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2e1d52]/40">Shift Date</TableHead>
                  <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2e1d52]/40">Location</TableHead>
                  <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2e1d52]/40 text-center">Shift</TableHead>
                  <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2e1d52]/40 text-right">Total Consumption</TableHead>
                  <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2e1d52]/40 text-right">Small Calibers</TableHead>
                  <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2e1d52]/40 text-right text-[#7a9800]">Return Total</TableHead>
                  <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2e1d52]/40 text-right text-rose-500">Decay Total</TableHead>
                  <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2e1d52]/40 text-right text-emerald-600">Finished Products Weight</TableHead>
                  <TableHead className="pr-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#2e1d52]/40 text-right text-amber-500">Pending / Reste Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-gray-100">
                      <TableCell colSpan={9} className="py-8 px-8">
                        <div className="h-8 bg-gray-50 animate-pulse rounded-xl" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : shiftDailyReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 opacity-20 py-10">
                        <AlertTriangle size={48} className="text-[#2e1d52]" />
                        <p className="font-black uppercase tracking-widest text-[11px]">No production data found for the selected period.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  shiftDailyReports.map((report: any, idx) => (
                    <TableRow 
                      key={idx} 
                      className="hover:bg-[#7a9800]/[0.02] border-b border-gray-100 last:border-0 group transition-all duration-200"
                    >
                      {/* Clickable Shift Date: Routes to detail page */}
                      <TableCell className="pl-8 py-4.5">
                        <Link 
                          href={`/production/daily-reports/details/${report.shiftDate}/${encodeURIComponent(report.locationName)}/${report.shift}`}
                          className="font-black text-xs text-[#2e1d52] hover:text-[#7a9800] hover:underline transition-colors flex items-center gap-1"
                        >
                          {report.shiftDate}
                          <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-[#7a9800]" />
                        </Link>
                      </TableCell>

                      {/* Clickable Location: Filters table and dashboard by Location */}
                      <TableCell className="py-4.5 font-bold text-gray-700 text-xs">
                        <button
                          onClick={() => setSelectedLocation(report.locationName)}
                          className="flex items-center gap-1.5 hover:text-[#7a9800] hover:underline text-left font-black transition-colors"
                        >
                          <MapPin className="h-3.5 w-3.5 text-[#7a9800]/40 group-hover:text-[#7a9800]" />
                          {report.locationName}
                        </button>
                      </TableCell>

                      {/* Shift Badge */}
                      <TableCell className="text-center py-4.5">
                        <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 font-black text-[10px] rounded-lg tracking-wider">
                          SHIFT {report.shift}
                        </span>
                      </TableCell>

                      {/* Total Consumption */}
                      <TableCell className="text-right py-4.5 font-black text-gray-800 text-xs">
                        {report.totalConsumption.toLocaleString()} KG
                      </TableCell>

                      {/* Small Calibers */}
                      <TableCell className="text-right py-4.5 font-bold text-gray-600 text-xs">
                        {report.smallCalibers.toLocaleString()} KG
                      </TableCell>

                      {/* Return Total */}
                      <TableCell className="text-right py-4.5 font-black text-[#7a9800] text-xs">
                        {report.returnTotal.toLocaleString()} KG
                      </TableCell>

                      {/* Decay Total */}
                      <TableCell className="text-right py-4.5 font-black text-rose-500 text-xs">
                        {report.decayTotal.toLocaleString()} KG
                      </TableCell>

                      {/* Finished Products weight */}
                      <TableCell className="text-right py-4.5 font-black text-emerald-600 text-sm">
                        {report.finishedProductsNetWeight.toLocaleString()} KG
                      </TableCell>

                      {/* Pending / Reste Pallet Net Weight */}
                      <TableCell className="pr-8 text-right py-4.5 font-black text-amber-500 text-xs">
                        {report.pendingResteWeight.toLocaleString()} KG
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

      </div>
    </div>
  );
}
