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
  deleteDoc,
  doc,
  where,
  getDocs,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Search, 
  Filter, 
  X, 
  MoreVertical, 
  Edit2, 
  Trash2,
  Calendar,
  MapPin,
  FileText,
  Loader2,
  ChevronRight,
  TrendingUp,
  Activity,
  ArrowRight,
  BarChart3,
  Calculator,
  LayoutGrid
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ProductionDailyReportsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  // Filters State
  const [activeTab, setActiveTab] = useState('calculated');
  const [caliberStartDate, setCaliberStartDate] = useState('');
  const [caliberEndDate, setCaliberEndDate] = useState('');

  // Queries
  const reportsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'production_daily_reports'), orderBy('date', 'desc'));
  }, [db]);

  const outputQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'production_output');
  }, [db]);

  const { data: manualReports, isLoading: isLoadingManual } = useCollection(reportsQuery);
  const { data: outputs, isLoading: isLoadingOutputs } = useCollection(outputQuery);

  const isLoading = isLoadingManual || isLoadingOutputs;

  // TAB 1: Calculated Daily Reports Logic
  const calculatedReports = useMemo(() => {
    const groups: Record<string, any> = {};
    
    const getOrInitGroup = (date: string, locationName: string, shift: string) => {
      const key = `${date}_${locationName}_${shift}`;
      if (!groups[key]) {
        groups[key] = {
          shiftDate: date,
          locationName: locationName || 'Unknown',
          shift: shift || '1',
          finalProducts: 0,
          outOfProgram: 0,
          returnTotal: 0,
          decayTotal: 0,
          finishedNetWeight: 0,
          pendingResteWeight: 0,
        };
      }
      return groups[key];
    };

    outputs?.forEach(output => {
      const g = getOrInitGroup(output.shiftDate, output.locationName, output.shift);
      const palletNetWeight = output.items?.reduce((sum: number, item: any) => sum + (Number(item.netWeight) || 0), 0) || 0;
      


      if (output.palletisationType === 'Final product') {
        g.finalProducts += palletNetWeight;
      } else if (output.palletisationType === 'Out Of Program') {
        g.outOfProgram += palletNetWeight;
      } else if (output.palletisationType === 'Return') {
        g.returnTotal += palletNetWeight;
      } else if (output.palletisationType === 'decay') {
        g.decayTotal += palletNetWeight;
      } else if (output.palletisationType === 'Pending' || output.palletisationType === 'Reste') {
        g.pendingResteWeight += palletNetWeight;
      }
      
      // Finished Net Weight Formula: Final Products + Out Of Program
      g.finishedNetWeight = g.finalProducts + g.outOfProgram;
    });

    return Object.values(groups).sort((a, b) => b.shiftDate.localeCompare(a.shiftDate));
  }, [outputs]);

  // TAB 3: Group By Caliber Logic
  const caliberAggregations = useMemo(() => {
    if (!outputs) return [];
    
    const caliberMap: Record<string, { caliber: string; numPallets: number; quantity: number }> = {};
    let totalQuantity = 0;

    outputs.forEach(output => {
      // Apply filters if set
      if (caliberStartDate && output.shiftDate < caliberStartDate) return;
      if (caliberEndDate && output.shiftDate > caliberEndDate) return;

      output.items?.forEach((item: any) => {
        const caliber = item.caliber || 'No Caliber';
        if (!caliberMap[caliber]) {
          caliberMap[caliber] = { caliber, numPallets: 0, quantity: 0 };
        }
        caliberMap[caliber].numPallets += 1; // Assuming 1 row in items = 1 entry, but wait... 
        // Actually, in our model, 1 production_output = 1 pallet.
        // If there are multiple items in a pallet, they share the pallet. 
        // I'll count each item as a contribution to the caliber.
        caliberMap[caliber].quantity += Number(item.netWeight) || 0;
        totalQuantity += Number(item.netWeight) || 0;
      });
    });

    return Object.values(caliberMap).map(c => ({
      ...c,
      percentage: totalQuantity > 0 ? (c.quantity / totalQuantity) * 100 : 0
    })).sort((a, b) => b.quantity - a.quantity);
  }, [outputs, caliberStartDate, caliberEndDate]);

  const handleDelete = async (id: string) => {
    if (!db || !confirm('Are you sure you want to delete this report?')) return;
    try {
      await deleteDoc(doc(db, 'production_daily_reports', id));
      toast({ title: "Success", description: "Report deleted successfully" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete report" });
    }
  };

  const resetCaliberFilters = () => {
    setCaliberStartDate('');
    setCaliberEndDate('');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FBFBFF] w-full overflow-x-hidden">
      {/* Header */}
      <div className="px-4 md:px-8 lg:px-10 py-6 bg-white border-b border-primary/5 shadow-sm sticky top-0 z-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 max-w-[1600px] mx-auto w-full">
          <div className="space-y-1.5">
            <nav className="flex text-[10px] md:text-xs font-black uppercase tracking-[0.25em] text-muted-foreground/40 mb-1" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-2">
                <li>Profile</li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  Production Daily Reports
                </li>
              </ol>
            </nav>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-primary tracking-tight uppercase leading-none flex items-center gap-3">
              Daily Reports
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <Button asChild className="w-full sm:w-auto h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-xl shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.15em] text-[10px] gap-2">
              <Link href="/production/daily-reports/add">
                <Plus className="h-4 w-4" /> Add Report
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8 lg:p-10 max-w-[1600px] mx-auto w-full space-y-8 animate-in fade-in duration-700">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8 w-full">
          <div className="flex items-center justify-start overflow-x-auto custom-scrollbar w-full pb-2 md:pb-0">
            <TabsList className="bg-white/50 border border-primary/5 p-1.5 rounded-[1.5rem] h-auto shadow-sm flex flex-nowrap w-max md:w-auto">
              <TabsTrigger value="calculated" className="whitespace-nowrap rounded-xl px-4 md:px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
                <TrendingUp className="h-3.5 w-3.5" /> Calculated Reports
              </TabsTrigger>
              <TabsTrigger value="manual" className="whitespace-nowrap rounded-xl px-4 md:px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
                <FileText className="h-3.5 w-3.5" /> Manual Reports
              </TabsTrigger>
              <TabsTrigger value="caliber" className="whitespace-nowrap rounded-xl px-4 md:px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
                <Activity className="h-3.5 w-3.5" /> Group By Caliber
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: Calculated Reports */}
          <TabsContent value="calculated" className="m-0 border-none outline-none w-full">
            <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden w-full flex flex-col">
              <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth">
                <Table className="min-w-[1200px] w-full">
                  <TableHeader className="sticky top-0 z-10 backdrop-blur-md shadow-sm bg-[#F8F7FF]">
                    <TableRow className="bg-[#F8F7FF] border-b border-primary/5 hover:bg-transparent">
                      <TableHead className="pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Shift Date</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Location</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-center">Shift</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right">Final Products</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right">Out Of Program</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right text-blue-600">Return</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right text-rose-500">Decay</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right text-emerald-600">Finished Net Weight</TableHead>
                      <TableHead className="pr-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right text-amber-500">Pending / Reste Pallet Net Weight</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingOutputs ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-b border-primary/5">
                          <TableCell colSpan={9} className="py-8 px-8"><div className="h-8 bg-muted/20 animate-pulse rounded-xl" /></TableCell>
                        </TableRow>
                      ))
                    ) : calculatedReports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="h-64 text-center">
                          <div className="flex flex-col items-center gap-3 opacity-20">
                            <FileText size={48} />
                            <p className="font-black uppercase tracking-widest text-[11px]">No records to display</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      calculatedReports.map((report: any, idx) => (
                        <TableRow 
                          key={idx} 
                          className="hover:bg-primary/[0.02] transition-all border-b border-primary/5 last:border-0 group cursor-pointer"
                          onClick={() => router.push(`/production/daily-reports/details/${report.shiftDate}/${encodeURIComponent(report.locationName)}/${report.shift}`)}
                        >
                          <TableCell className="pl-8 font-black text-primary text-xs tracking-tight group-hover:text-emerald-600 group-hover:underline transition-all">{report.shiftDate}</TableCell>
                          <TableCell className="font-bold text-primary/70 text-xs group-hover:text-emerald-600 transition-all">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 opacity-30" />
                              {report.locationName}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="px-2 py-1 bg-primary/5 rounded-lg font-black text-[10px] text-primary">SHIFT {report.shift}</span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-primary/60 text-xs">{report.finalProducts.toLocaleString()} KG</TableCell>
                          <TableCell className="text-right font-bold text-primary/60 text-xs">{report.outOfProgram.toLocaleString()} KG</TableCell>
                          <TableCell className="text-right font-bold text-blue-600 text-xs">{report.returnTotal.toLocaleString()} KG</TableCell>
                          <TableCell className="text-right font-bold text-rose-500 text-xs">{report.decayTotal.toLocaleString()} KG</TableCell>
                          <TableCell className="text-right font-black text-emerald-600 text-sm">
                            {report.finishedNetWeight.toLocaleString()} KG
                          </TableCell>
                          <TableCell className="pr-8 text-right font-black text-amber-500 text-xs">
                            {report.pendingResteWeight.toLocaleString()} KG
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: Manual Daily Reports */}
          <TabsContent value="manual" className="m-0 border-none outline-none w-full">
            <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden w-full flex flex-col">
              <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth">
                <Table className="min-w-[1400px] w-full">
                  <TableHeader className="sticky top-0 z-10 backdrop-blur-md shadow-sm bg-[#F8F7FF]">
                    <TableRow className="bg-[#F8F7FF] border-b border-primary/5 hover:bg-transparent">
                      <TableHead className="pl-6 md:pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 w-[100px] whitespace-nowrap">Actions</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap">Date</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap">Location</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-center whitespace-nowrap">Shift</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right text-rose-500 whitespace-nowrap">Decay</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right text-blue-600 whitespace-nowrap">Return</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right text-emerald-600 whitespace-nowrap">Finished Products Net Weight</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-center whitespace-nowrap">Pending Pallets</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right text-amber-600 whitespace-nowrap">Small Calibers</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-center whitespace-nowrap">Report Status</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap">Created By</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 pr-6 md:pr-8 whitespace-nowrap">Updated By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingManual ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-b border-primary/5">
                          <TableCell colSpan={13} className="py-8 px-8"><div className="h-8 bg-muted/20 animate-pulse rounded-xl" /></TableCell>
                        </TableRow>
                      ))
                    ) : manualReports?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={13} className="h-48 md:h-64 text-center">
                          <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                            <FileText size={40} className="md:h-12 md:w-12" />
                            <p className="font-black uppercase tracking-widest text-[10px] md:text-[11px]">No manual records found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      manualReports?.map((report) => (
                        <TableRow 
                          key={report.id} 
                          className="hover:bg-primary/[0.02] transition-all border-b border-primary/5 last:border-0 group cursor-pointer"
                          onClick={() => router.push(`/production/daily-reports/details/${report.date}/${encodeURIComponent(report.locationName)}/${report.shift}`)}
                        >
                          <TableCell className="pl-6 md:pl-8">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all">
                                  <MoreVertical size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-56 p-2 rounded-2xl shadow-2xl border-primary/10">
                                <DropdownMenuItem asChild className="gap-3 cursor-pointer font-black text-[10px] uppercase tracking-wider py-3 rounded-xl hover:bg-primary/5">
                                  <Link href={`/production/daily-reports/${report.id}/edit`}>
                                    <Edit2 size={14} className="text-primary" /> Edit Report
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="gap-3 text-rose-500 cursor-pointer font-black text-[10px] uppercase tracking-wider py-3 rounded-xl hover:bg-rose-50" onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}>
                                  <Trash2 size={14} /> Delete Report
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell 
                            className="cursor-pointer whitespace-nowrap"
                            onClick={() => router.push(`/production/daily-reports/details/${report.date}/${encodeURIComponent(report.locationName)}/${report.shift}`)}
                          >
                            <span className="font-black text-primary text-xs hover:text-emerald-600 hover:underline transition-all">{report.date}</span>
                          </TableCell>
                          <TableCell 
                            className="cursor-pointer whitespace-nowrap"
                            onClick={() => router.push(`/production/daily-reports/details/${report.date}/${encodeURIComponent(report.locationName)}/${report.shift}`)}
                          >
                            <span className="font-bold text-primary/70 text-xs hover:text-emerald-600 transition-all">{report.locationName}</span>
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <span className="px-2 py-1 bg-primary/5 rounded-lg font-black text-[10px] text-primary">{report.shift}</span>
                          </TableCell>
                          <TableCell className="text-right font-bold text-rose-500 text-xs whitespace-nowrap">{report.decay.toLocaleString()} KG</TableCell>
                          <TableCell className="text-right font-bold text-blue-600 text-xs whitespace-nowrap">{report.returnWeight.toLocaleString()} KG</TableCell>
                          <TableCell className="text-right font-black text-emerald-600 text-xs whitespace-nowrap">{report.finishedProductsNetWeight.toLocaleString()} KG</TableCell>
                          <TableCell className="text-center font-bold text-primary/60 text-xs whitespace-nowrap">{report.pendingPallets}</TableCell>
                          <TableCell className="text-right font-bold text-amber-600 text-xs whitespace-nowrap">{report.smallCalibers.toLocaleString()} KG</TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                              report.reportStatus === 'Released' ? "bg-emerald-100 text-emerald-700" :
                              report.reportStatus === 'Published' ? "bg-blue-100 text-blue-700" :
                              "bg-amber-100 text-amber-700"
                            )}>
                              {report.reportStatus}
                            </span>
                          </TableCell>
                          <TableCell className="text-[10px] font-bold text-primary/40 truncate max-w-[120px] whitespace-nowrap">{report.createdByDisplayName || report.createdBy}</TableCell>
                          <TableCell className="text-[10px] font-bold text-primary/40 pr-6 md:pr-8 truncate max-w-[120px] whitespace-nowrap">{report.updatedBy}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: Group By Caliber */}
          <TabsContent value="caliber" className="m-0 border-none outline-none space-y-8 w-full">
            {/* Filters Row */}
            <div className="bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 flex flex-col md:flex-row items-stretch md:items-end gap-4 md:gap-6 w-full">
              <div className="space-y-2 w-full md:w-auto flex-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Start Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/20" />
                  <Input 
                    type="date" 
                    value={caliberStartDate}
                    onChange={(e) => setCaliberStartDate(e.target.value)}
                    className="h-11 rounded-xl bg-muted/30 border-none font-bold text-primary pl-12 pr-4 w-full" 
                  />
                </div>
              </div>
              <div className="space-y-2 w-full md:w-auto flex-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">End Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/20" />
                  <Input 
                    type="date" 
                    value={caliberEndDate}
                    onChange={(e) => setCaliberEndDate(e.target.value)}
                    className="h-11 rounded-xl bg-muted/30 border-none font-bold text-primary pl-12 pr-4 w-full" 
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                <Button className="h-11 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl uppercase tracking-widest text-[10px] gap-2 shadow-lg shadow-emerald-600/10 flex-1 md:flex-none">
                  <Filter size={14} /> Filter
                </Button>
                <Button onClick={resetCaliberFilters} variant="ghost" className="h-11 w-11 p-0 rounded-xl bg-muted/30 text-muted-foreground hover:bg-rose-50 hover:text-rose-500 transition-all shrink-0">
                  <X size={18} />
                </Button>
              </div>
            </div>

            <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden w-full flex flex-col">
              <div className="overflow-x-auto custom-scrollbar w-full scroll-smooth">
                <Table className="min-w-[800px] w-full">
                  <TableHeader className="sticky top-0 z-10 backdrop-blur-md shadow-sm bg-[#F8F7FF]">
                    <TableRow className="bg-[#F8F7FF] border-b border-primary/5 hover:bg-transparent">
                      <TableHead className="pl-6 md:pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap">Caliber</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-center whitespace-nowrap">Number Of Pallets</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right whitespace-nowrap">Quantity (KG)</TableHead>
                      <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right pr-6 md:pr-8 whitespace-nowrap">Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingOutputs ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-b border-primary/5">
                          <TableCell colSpan={4} className="py-8 px-8"><div className="h-8 bg-muted/20 animate-pulse rounded-xl" /></TableCell>
                        </TableRow>
                      ))
                    ) : caliberAggregations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-64 text-center">
                          <div className="flex flex-col items-center gap-3 opacity-20">
                            <Activity size={48} />
                            <p className="font-black uppercase tracking-widest text-[11px]">No caliber data found</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      caliberAggregations.map((row, idx) => (
                        <TableRow key={idx} className="hover:bg-primary/[0.02] transition-all border-b border-primary/5 last:border-0 group">
                          <TableCell className="pl-8">
                            <span className="px-3 py-1.5 bg-primary/5 rounded-xl font-black text-xs text-primary uppercase tracking-tight">{row.caliber}</span>
                          </TableCell>
                          <TableCell className="text-center font-bold text-primary/70 text-sm">{row.numPallets}</TableCell>
                          <TableCell className="text-right font-black text-primary text-sm">{row.quantity.toLocaleString()} KG</TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex items-center justify-end gap-4">
                              <div className="w-32 h-2 bg-primary/5 rounded-full overflow-hidden hidden sm:block">
                                <div 
                                  className="h-full bg-primary rounded-full transition-all duration-1000" 
                                  style={{ width: `${row.percentage}%` }}
                                />
                              </div>
                              <span className="font-black text-primary text-sm min-w-[50px]">{row.percentage.toFixed(1)}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
