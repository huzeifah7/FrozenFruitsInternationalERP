'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  useUser,
} from '@/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from '@/firebase/firestore-override';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, 
  Download, 
  Calendar, 
  MapPin, 
  Clock, 
  Scale, 
  Package, 
  BarChart3,
  FileText,
  Loader2,
  TrendingUp,
  Activity
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { exportDailyProductionReport, getShiftDateAndShift } from '@/lib/export-daily-production-report';

export default function ProductionDailyReportDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const date = params.date as string;
  const location = decodeURIComponent(params.location as string);
  const shift = params.shift as string;

  // Previous shift calculation
  const { prevDate, prevShift } = useMemo(() => {
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
  }, [date, shift]);

  // Query production output for this specific shift
  const outputQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'production_output'),
      where('shiftDate', '==', date),
      where('locationName', '==', location),
      where('shift', '==', shift)
    );
  }, [db, date, location, shift]);

  const { data: outputs, isLoading } = useCollection(outputQuery);

  // Fetch production feeds for this location & shift
  const feedsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'production_feeds');
  }, [db]);

  const { data: feeds } = useCollection(feedsQuery);

  // Filter feeds locally according to Shift Date Rules and Location
  const filteredFeeds = useMemo(() => {
    if (!feeds) return [];
    const decodedLoc = decodeURIComponent(location || '').toLowerCase();

    return feeds.filter((f: any) => {
      // 1. Location matching
      if (decodedLoc) {
        const feedLocName = (f.locationName || '').toLowerCase();
        const feedLocId = (f.locationId || '').toLowerCase();
        const matchesLoc = feedLocName === decodedLoc || feedLocId === decodedLoc || feedLocName.includes(decodedLoc) || decodedLoc.includes(feedLocName);
        if (!matchesLoc) return false;
      }

      // 2. Shift & Date matching
      if (f.dateTime) {
        const { shiftDate: calculatedShiftDate, shift: calculatedShift } = getShiftDateAndShift(f.dateTime);
        if (calculatedShiftDate === date && String(calculatedShift) === String(shift)) return true;
      }

      const feedDate = f.date || f.shiftDate || f.createdAt?.substring?.(0, 10);
      return feedDate === date && String(f.shift) === String(shift);
    });
  }, [feeds, date, location, shift]);

  // Query previous shift Reste pallets
  const prevResteQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'production_output'),
      where('shiftDate', '==', prevDate),
      where('locationName', '==', location),
      where('shift', '==', shift),
      where('palletisationType', 'in', ['Reste', 'Pending'])
    );
  }, [db, prevDate, location, prevShift]);

  const { data: prevRestePallets } = useCollection(prevResteQuery);

  // Query catalogs
  const ordersQuery = useMemoFirebase(() => db ? collection(db, 'orders') : null, [db]);
  const productsQuery = useMemoFirebase(() => db ? collection(db, 'products') : null, [db]);
  const consumablesQuery = useMemoFirebase(() => db ? collection(db, 'consumables') : null, [db]);
  const rawMaterialsQuery = useMemoFirebase(() => db ? collection(db, 'raw_materials') : null, [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: products } = useCollection(productsQuery);
  const { data: consumables } = useCollection(consumablesQuery);
  const { data: rawMaterials } = useCollection(rawMaterialsQuery);

  // Aggregations
  const stats = useMemo(() => {
    const s = {
      finalProducts: 0,
      outOfProgram: 0,
      returnWeight: 0,
      decayWeight: 0,
      pendingWeight: 0,
      smallCaliberWeight: 0,
      totalPallets: 0,
      totalWeight: 0,
      finishedNetWeight: 0,
      counts: {
        'Final product': 0,
        'Out Of Program': 0,
        'decay': 0,
        'Return': 0,
        'Reste': 0,
        'Small caliber': 0,
      }
    };

    if (!outputs) return s;

    outputs.forEach(output => {
      const palletWeight = output.items?.reduce((sum: number, item: any) => sum + (Number(item.netWeight) || 0), 0) || 0;
      const type = output.palletisationType;

      s.totalPallets += 1;
      s.totalWeight += palletWeight;

      if (type === 'Final product') {
        s.finalProducts += palletWeight;
        s.counts['Final product'] += 1;
      } else if (type === 'Out Of Program') {
        s.outOfProgram += palletWeight;
        s.counts['Out Of Program'] += 1;
      } else if (type === 'decay') {
        s.decayWeight += palletWeight;
        s.counts['decay'] += 1;
      } else if (type === 'Return') {
        s.returnWeight += palletWeight;
        s.counts['Return'] += 1;
      } else if (type === 'Reste') {
        s.pendingWeight += palletWeight;
        s.counts['Reste'] += 1;
      } else if (type === 'Small caliber') {
        s.smallCaliberWeight += palletWeight;
        s.counts['Small caliber'] += 1;
      }
    });

    s.finishedNetWeight = s.finalProducts + s.outOfProgram;
    return s;
  }, [outputs]);

  const caliberSummary = useMemo(() => {
    const map: Record<string, { caliber: string; weight: number }> = {};
    let total = 0;

    outputs?.forEach(output => {
      output.items?.forEach((item: any) => {
        const caliber = item.caliber || 'Unknown';
        if (!map[caliber]) map[caliber] = { caliber, weight: 0 };
        map[caliber].weight += Number(item.netWeight) || 0;
        total += Number(item.netWeight) || 0;
      });
    });

    return Object.values(map)
      .map(c => ({ ...c, percentage: total > 0 ? (c.weight / total) * 100 : 0 }))
      .sort((a, b) => b.weight - a.weight);
  }, [outputs]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40 animate-pulse">Loading Detailed Report...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FBFBFF]">
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b border-primary/5 shadow-sm sticky top-0 z-30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-[1600px] mx-auto">
          <div className="space-y-1.5">
            <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 mb-1">
              <ol className="inline-flex items-center space-x-2">
                <li>Profile</li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  <Link href="/production/daily-reports" className="hover:text-primary transition-colors">Production Daily Reports</Link>
                </li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  <span className="text-primary/60">Report Group By {date}, {location}, SHIFT {shift}</span>
                </li>
              </ol>
            </nav>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all">
                <ChevronLeft size={20} />
              </Button>
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">
                Production Daily Report Group By {date}, {location}, SHIFT {shift}
              </h1>
            </div>
          </div>
          <Button 
            onClick={async () => {
              if (!user) return;
              setIsExporting(true);
              try {
                await exportDailyProductionReport({
                  date,
                  shift,
                  locationName: location,
                  currentUser: { email: user.email || '', displayName: user.displayName || undefined },
                  productionFeeds: filteredFeeds,
                  productionOutputs: outputs || [],
                  orders: orders || [],
                  products: products || [],
                  consumables: consumables || [],
                  previousShiftRestePallets: prevRestePallets || [],
                  rawMaterials: rawMaterials || [],
                });
                toast({ title: 'Success', description: 'Daily Production Report exported successfully!' });
              } catch (err) {
                console.error(err);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to export report' });
              } finally {
                setIsExporting(false);
              }
            }}
            disabled={isExporting}
            className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-xl shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.15em] text-[10px] gap-2"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isExporting ? 'Exporting...' : 'Download Report'}
          </Button>
        </div>
      </div>

      <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full">
        {/* SECTION 1: Report Info Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 flex items-center gap-5 transition-all hover:scale-[1.02]">
            <div className="h-14 w-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
              <Calendar size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-primary/30 uppercase tracking-widest mb-1">Shift Date</p>
              <p className="text-xl font-black text-primary">{date}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 flex items-center gap-5 transition-all hover:scale-[1.02]">
            <div className="h-14 w-14 rounded-2xl bg-blue-500/5 flex items-center justify-center text-blue-500">
              <MapPin size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-blue-500/30 uppercase tracking-widest mb-1">Location</p>
              <p className="text-xl font-black text-blue-500 truncate max-w-[150px]">{location}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 flex items-center gap-5 transition-all hover:scale-[1.02]">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/5 flex items-center justify-center text-emerald-500">
              <Scale size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-emerald-500/30 uppercase tracking-widest mb-1">Finished Net Weight</p>
              <p className="text-xl font-black text-emerald-500">{stats.finishedNetWeight.toLocaleString()} KG</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 flex items-center gap-5 transition-all hover:scale-[1.02]">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/5 flex items-center justify-center text-amber-500">
              <Package size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-amber-500/30 uppercase tracking-widest mb-1">Total Pallets</p>
              <p className="text-xl font-black text-amber-500">{stats.totalPallets}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 flex items-center gap-5 transition-all hover:scale-[1.02]">
            <div className="h-14 w-14 rounded-2xl bg-rose-500/5 flex items-center justify-center text-rose-500">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-rose-500/30 uppercase tracking-widest mb-1">Shift</p>
              <p className="text-xl font-black text-rose-500">SHIFT {shift}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* SECTION 2: Pallets Details Summary Table */}
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-primary/5 overflow-hidden">
            <div className="bg-primary/[0.02] px-10 py-6 border-b border-primary/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <BarChart3 size={20} />
                </div>
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Pallet Breakdown Summary</h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F7FF] border-b border-primary/5 hover:bg-transparent">
                    <TableHead className="pl-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Pallet Type</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-center">Num Pallets</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right">Net Weight</TableHead>
                    <TableHead className="pr-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { label: 'Finished Pallets', type: 'Final product', color: 'text-emerald-600', weight: stats.finalProducts },
                    { label: 'Out Of Program', type: 'Out Of Program', color: 'text-blue-600', weight: stats.outOfProgram },
                    { label: 'Decay', type: 'decay', color: 'text-rose-500', weight: stats.decayWeight },
                    { label: 'Return', type: 'Return', color: 'text-orange-500', weight: stats.returnWeight },
                    { label: 'Pending', type: 'Reste', color: 'text-amber-500', weight: stats.pendingWeight },
                    { label: 'Small Caliber', type: 'Small caliber', color: 'text-purple-500', weight: stats.smallCaliberWeight },
                  ].map((row, idx) => (
                    <TableRow key={idx} className="hover:bg-primary/[0.01] border-b border-primary/5 last:border-0 transition-all">
                      <TableCell className="pl-10 py-5 font-black text-primary text-[11px] uppercase tracking-wider">{row.label}</TableCell>
                      <TableCell className="text-center font-bold text-primary/60 text-xs">{stats.counts[row.type as keyof typeof stats.counts] || 0}</TableCell>
                      <TableCell className={cn("text-right font-black text-xs", row.color)}>{row.weight.toLocaleString()} KG</TableCell>
                      <TableCell className="pr-10 text-right">
                        <span className="px-3 py-1 bg-primary/5 rounded-full font-black text-[9px] text-primary/40 tracking-widest">
                          {stats.totalWeight > 0 ? ((row.weight / stats.totalWeight) * 100).toFixed(1) : 0}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* SECTION 3: Caliber Details Table */}
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-primary/5 overflow-hidden">
            <div className="bg-primary/[0.02] px-10 py-6 border-b border-primary/5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
                  <Activity size={20} />
                </div>
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Caliber Distribution</h2>
              </div>
            </div>
            <div className="overflow-x-auto h-[350px] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-[#F8F7FF]">
                  <TableRow className="border-b border-primary/5 hover:bg-transparent">
                    <TableHead className="pl-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">S#</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Caliber</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right">Net Weight</TableHead>
                    <TableHead className="pr-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {caliberSummary.map((c, idx) => (
                    <TableRow key={idx} className="hover:bg-primary/[0.01] border-b border-primary/5 last:border-0 transition-all">
                      <TableCell className="pl-10 py-5 text-[10px] font-bold text-primary/20">{(idx + 1).toString().padStart(2, '0')}</TableCell>
                      <TableCell className="font-black text-primary text-[11px] uppercase tracking-wider">{c.caliber}</TableCell>
                      <TableCell className="text-right font-black text-xs text-primary/70">{c.weight.toLocaleString()} KG</TableCell>
                      <TableCell className="pr-10 text-right">
                        <span className="px-3 py-1 bg-purple-500/5 rounded-full font-black text-[9px] text-purple-600/60 tracking-widest">
                          {c.percentage.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* SECTION 4: Tabs with Pallet Lists */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-primary/5 overflow-hidden">
          <Tabs defaultValue="Final product" className="w-full">
            <div className="bg-primary/[0.02] border-b border-primary/5 px-10 pt-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <LayoutGrid size={20} />
                </div>
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary">Detailed Pallet Logs</h2>
              </div>
              <TabsList className="h-auto p-0 bg-transparent gap-10 flex-wrap justify-start">
                {[
                  { value: 'Final product', label: 'Finished Pallets', color: 'data-[state=active]:text-emerald-600 data-[state=active]:after:bg-emerald-600' },
                  { value: 'Out Of Program', label: 'Out Of Program', color: 'data-[state=active]:text-blue-600 data-[state=active]:after:bg-blue-600' },
                  { value: 'decay', label: 'Decay', color: 'data-[state=active]:text-rose-500 data-[state=active]:after:bg-rose-500' },
                  { value: 'Return', label: 'Return', color: 'data-[state=active]:text-orange-500 data-[state=active]:after:bg-orange-500' },
                  { value: 'Reste', label: 'Pending', color: 'data-[state=active]:text-amber-500 data-[state=active]:after:bg-amber-500' },
                ].map((tab) => (
                  <TabsTrigger 
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      "h-12 bg-transparent border-none rounded-none px-0 text-[10px] font-black uppercase tracking-[0.2em] text-primary/30 transition-all hover:text-primary relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:rounded-full after:opacity-0 data-[state=active]:after:opacity-100",
                      tab.color
                    )}
                  >
                    {tab.label}
                    <span className="ml-3 px-2 py-0.5 bg-primary/5 rounded-md text-[9px] opacity-40">{stats.counts[tab.value as keyof typeof stats.counts] || 0}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {[
              { value: 'Final product', label: 'Finished Pallets' },
              { value: 'Out Of Program', label: 'Out Of Program' },
              { value: 'decay', label: 'Decay' },
              { value: 'Return', label: 'Return' },
              { value: 'Reste', label: 'Pending' },
            ].map((tab) => (
              <TabsContent key={tab.value} value={tab.value} className="m-0 p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[1000px]">
                    <TableHeader>
                      <TableRow className="bg-[#F8F7FF] border-b border-primary/5 hover:bg-transparent">
                        <TableHead className="pl-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">S#</TableHead>
                        <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Barcode</TableHead>
                        <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Order / Reference</TableHead>
                        <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-center">Caliber</TableHead>
                        <TableHead className="pr-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right">Net Weight</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outputs?.filter(o => o.palletisationType === tab.value).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-64 text-center">
                            <div className="flex flex-col items-center gap-3 opacity-20">
                              <Package size={48} />
                              <p className="font-black uppercase tracking-widest text-[11px]">No {tab.label.toLowerCase()} in this shift</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        outputs?.filter(o => o.palletisationType === tab.value).map((pallet, pIdx) => {
                          const palletWeight = pallet.items?.reduce((sum: number, item: any) => sum + (Number(item.netWeight) || 0), 0) || 0;
                          return (
                            <TableRow key={pallet.id} className="hover:bg-primary/[0.01] border-b border-primary/5 last:border-0 transition-all group">
                              <TableCell className="pl-10 py-5 text-[10px] font-bold text-primary/20">{(pIdx + 1).toString().padStart(2, '0')}</TableCell>
                              <TableCell>
                                <span className="px-3 py-1 bg-primary/5 border border-primary/5 rounded-lg font-black text-[10px] text-primary tracking-widest group-hover:bg-primary group-hover:text-white transition-all">
                                  {pallet.barcode || 'NO-BARCODE'}
                                </span>
                              </TableCell>
                              <TableCell className="font-bold text-primary/70 text-xs">
                                {pallet.orderId || pallet.orderNumber || pallet.reference || 'N/A'}
                              </TableCell>
                              <TableCell className="text-center font-black text-primary text-[10px] uppercase tracking-wider">
                                {pallet.items?.[0]?.caliber || 'N/A'}
                              </TableCell>
                              <TableCell className="pr-10 text-right font-black text-primary text-xs">
                                {palletWeight.toLocaleString()} KG
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </div>
  );
}

const LayoutGrid = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);
