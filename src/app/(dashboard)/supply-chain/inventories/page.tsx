'use client';

import React, { useMemo, useState } from 'react';
import { collection, query, orderBy, deleteDoc, doc } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  MoreHorizontal, Plus, Trash2, Download, Package2,
  AlertTriangle, Layers, MapPin, Calendar, User,
  BarChart2, ArrowDownCircle, ArrowUpCircle,
  Search,
  Filter,
  History as HistoryIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

export default function SupplyChainInventoryPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch stock entries (movements)
  const stockQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'supply_chain_stock'), orderBy('createdAt', 'desc'));
  }, [db, user]);

  // Fetch consumables for lookups (critical level, etc.)
  const consumablesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'consumables');
  }, [db, user]);

  const { data: stock, isLoading: stockLoading } = useCollection(stockQuery);
  const { data: consumables } = useCollection(consumablesQuery);

  // Build consumable lookup map
  const consumableMap = useMemo(() => {
    const map: Record<string, any> = {};
    consumables?.forEach(c => { map[c.id] = c; });
    return map;
  }, [consumables]);

  // Flatten all items across all stock documents
  const allMovements = useMemo(() => {
    if (!stock) return [];
    return stock.flatMap(doc =>
      (doc.items || []).map((item: any) => ({
        ...item,
        docId: doc.id,
        date: doc.date,
        locationName: doc.locationName || 'Main Store',
        createdBy: doc.createdBy,
        updatedBy: doc.updatedBy,
      }))
    );
  }, [stock]);

  // ── Tab 1: Current Inventory Status (Aggregated) ──
  const inventoryStatus = useMemo(() => {
    const status: Record<string, { 
      consumableId: string; 
      name: string; 
      qty: number; 
      criticalLevel: number; 
      averageLevel: number;
      isPackaging: boolean;
    }> = {};

    // Initialize with all consumables at 0
    consumables?.forEach(c => {
      status[c.id] = {
        consumableId: c.id,
        name: c.name,
        qty: 0,
        criticalLevel: Number(c.critical_level || 0),
        averageLevel: Number(c.average_level || 0),
        isPackaging: !!c.is_packaging,
      };
    });

    // Apply movements
    allMovements.forEach(m => {
      if (status[m.consumableId]) {
        const change = m.operation === 'IN' ? Number(m.quantity) : -Number(m.quantity);
        status[m.consumableId].qty += change;
      }
    });

    return Object.values(status).filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [consumables, allMovements, searchTerm]);

  const handleDeleteMovement = async (id: string) => {
    if (!db || !confirm('Are you sure you want to delete this stock entry?')) return;
    try {
      await deleteDoc(doc(db, 'supply_chain_stock', id));
      toast({ title: 'Deleted', description: 'Stock movement removed.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete.' });
    }
  };

  const totalIn = allMovements.filter(i => i.operation === 'IN').reduce((s, i) => s + Number(i.quantity), 0);
  const totalOut = allMovements.filter(i => i.operation === 'OUT').reduce((s, i) => s + Number(i.quantity), 0);
  const criticalAlerts = inventoryStatus.filter(s => s.qty <= s.criticalLevel).length;

  return (
    <div className="w-full p-8 space-y-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-2">
              <li>Supply Chain</li>
              <li className="flex items-center">
                <span className="mx-2 opacity-20">/</span>
                <span className="text-primary/60 font-black uppercase">Inventories</span>
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none flex items-center gap-3">
            <span className="h-8 w-2 bg-primary rounded-full" />
            Inventory Status
          </h1>
          <p className="text-muted-foreground font-medium text-sm">Real-time stock monitoring for all consumables and packaging materials.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-12 px-6 rounded-xl border-primary/10 text-primary font-black text-[10px] uppercase tracking-widest hover:bg-primary/5 gap-2">
            <Download size={16} /> Export Data
          </Button>
          <Button
            onClick={() => router.push('/supply-chain/inventories/add')}
            className="h-12 px-8 bg-primary hover:bg-primary/90 text-white rounded-xl font-black gap-3 shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] text-[10px] uppercase tracking-widest"
          >
            <Plus className="h-5 w-5 stroke-[3]" /> Adjust Stock
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Items', value: consumables?.length || 0, icon: <Package2 className="size-5" />, color: 'bg-primary/5 text-primary border-primary/10' },
          { label: 'Stock IN (All Time)', value: totalIn, icon: <ArrowUpCircle className="size-5" />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
          { label: 'Stock OUT (All Time)', value: totalOut, icon: <ArrowDownCircle className="size-5" />, color: 'bg-amber-50 text-amber-600 border-amber-100' },
          { label: 'Critical Alerts', value: criticalAlerts, icon: <AlertTriangle className="size-5" />, color: 'bg-rose-50 text-rose-600 border-rose-100' },
        ].map(({ label, value, icon, color }) => (
          <Card key={label} className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden hover:scale-[1.02] transition-all duration-300">
            <CardContent className="p-6 flex items-center justify-between">
              <div className={`p-4 rounded-2xl border ${color}`}>{icon}</div>
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-1">{label}</p>
                <p className="text-3xl font-black text-primary tracking-tighter">{value.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
          <Input 
            placeholder="Search consumable inventory..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-11 rounded-2xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="ghost" className="h-11 rounded-2xl gap-2 font-bold text-primary/60 hover:text-primary hover:bg-primary/5">
            <Filter className="size-4" />
            <span className="text-[10px] uppercase tracking-widest">Filters</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="status" className="w-full">
        <TabsList className="bg-muted/30 rounded-2xl h-14 p-1.5 mb-8 border border-primary/5 w-fit">
          <TabsTrigger value="status" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-xl data-[state=active]:text-primary px-8 h-full transition-all">
            Stock Status
          </TabsTrigger>
          <TabsTrigger value="movements" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-xl data-[state=active]:text-primary px-8 h-full transition-all">
            Movement History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="m-0 focus-visible:outline-none">
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden border border-primary/5">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-primary/[0.02]">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 py-6 pl-10">Consumable Name</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 py-6">Type</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 py-6 text-center">Avg. Level</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 py-6 text-center">Critical Level</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 py-6 text-center">Current Stock</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 py-6 pr-10">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-none">
                        <TableCell colSpan={6} className="py-4 px-10"><Skeleton className="h-12 w-full rounded-2xl" /></TableCell>
                      </TableRow>
                    ))
                  ) : inventoryStatus.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                          <Package2 size={64} />
                          <p className="text-lg font-black uppercase tracking-widest">No Inventory Records</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : inventoryStatus.map((row) => {
                    const isCritical = row.qty <= row.criticalLevel;
                    const isLow = row.qty <= row.averageLevel && !isCritical;
                    
                    return (
                      <TableRow key={row.consumableId} className="hover:bg-primary/[0.01] border-b border-primary/5 last:border-0 group transition-all">
                        <TableCell className="pl-10">
                          <span className="font-black text-primary text-base uppercase tracking-tight">{row.name}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border",
                            row.isPackaging ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-muted text-muted-foreground border-muted-foreground/10"
                          )}>
                            {row.isPackaging ? 'Packaging' : 'Other'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary/40">{row.averageLevel}</TableCell>
                        <TableCell className="text-center font-bold text-rose-500/50">{row.criticalLevel}</TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "text-2xl font-black tracking-tighter",
                            isCritical ? "text-rose-600 animate-pulse" : isLow ? "text-amber-600" : "text-emerald-600"
                          )}>
                            {row.qty.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="pr-10">
                          {isCritical ? (
                            <div className="flex items-center gap-2 text-rose-600 font-black text-[10px] uppercase tracking-widest bg-rose-50 px-4 py-2 rounded-xl border border-rose-100 shadow-sm w-fit">
                              <AlertTriangle size={14} className="stroke-[3]" /> CRITICAL
                            </div>
                          ) : isLow ? (
                            <div className="flex items-center gap-2 text-amber-600 font-black text-[10px] uppercase tracking-widest bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 shadow-sm w-fit">
                              <BarChart2 size={14} className="stroke-[3]" /> LOW STOCK
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 shadow-sm w-fit">
                              <Layers size={14} className="stroke-[3]" /> IN STOCK
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="m-0 focus-visible:outline-none">
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden border border-primary/5">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-primary/[0.02]">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="w-[80px] py-6 pl-10 text-[10px] font-black uppercase tracking-widest text-primary/40">Action</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 py-6">Consumable</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 py-6">Operation</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 py-6 text-center">Quantity</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 py-6">Location</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 py-6">Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 py-6 pr-10">Processed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-none">
                        <TableCell colSpan={7} className="py-4 px-10"><Skeleton className="h-12 w-full rounded-2xl" /></TableCell>
                      </TableRow>
                    ))
                  ) : stock?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                          <HistoryIcon size={64} />
                          <p className="text-lg font-black uppercase tracking-widest">No movement history</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : stock?.map(entry => (
                    <React.Fragment key={entry.id}>
                      {entry.items?.map((item: any, idx: number) => (
                        <TableRow key={`${entry.id}-${idx}`} className="hover:bg-primary/[0.01] border-b border-primary/5 last:border-0 group transition-all">
                          <TableCell className="pl-10">
                            {idx === 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-muted-foreground hover:text-primary transition-all">
                                    <MoreHorizontal size={18} />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-52 p-2 rounded-2xl shadow-2xl border-primary/10">
                                  <DropdownMenuItem
                                    className="gap-3 text-rose-500 cursor-pointer font-black text-[11px] uppercase tracking-wider py-3 rounded-xl hover:bg-rose-50"
                                    onClick={() => handleDeleteMovement(entry.id)}
                                  >
                                    <Trash2 size={14} /> Delete Batch
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-primary/80 uppercase tracking-tight">{item.consumableName || consumableMap[item.consumableId]?.name || 'Unknown'}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(
                              "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg flex items-center gap-2 w-fit",
                              item.operation === 'IN' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"
                            )}>
                              {item.operation === 'IN' ? <ArrowUpCircle size={10} /> : <ArrowDownCircle size={10} />}
                              {item.operation}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-black text-lg tracking-tighter">
                            {item.quantity.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-bold text-primary/60 text-sm">
                              <MapPin size={12} className="opacity-30" />
                              {entry.locationName || 'Main Store'}
                            </div>
                          </TableCell>
                          <TableCell>
                             <div className="flex items-center gap-1.5 font-bold text-primary/60 text-[11px] uppercase tracking-tighter">
                              <Calendar size={12} className="opacity-30" />
                              {entry.date}
                            </div>
                          </TableCell>
                          <TableCell className="pr-10">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary/40 font-black text-[10px]">
                                {entry.createdBy?.[0].toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-primary/70 uppercase truncate max-w-[120px]">{entry.createdBy?.split('@')[0]}</span>
                                <span className="text-[8px] font-bold text-muted-foreground opacity-50 uppercase tracking-widest">Operator</span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
