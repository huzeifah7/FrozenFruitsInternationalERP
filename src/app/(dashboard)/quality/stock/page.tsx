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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';

export default function QualityStockPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { canAdd } = usePermissions('quality.stock');

  // Fetch stock entries
  const stockQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'quality_stock');
  }, [db, user]);

  // Fetch consumables for lookups (critical level, section)
  const consumablesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'quality_consumables');
  }, [db, user]);

  const { data: rawStock, isLoading: stockLoading } = useCollection(stockQuery);
  const { data: consumables } = useCollection(consumablesQuery);

  // Sort stock in memory by createdAt desc
  const stock = useMemo(() => {
    if (!rawStock) return null;
    return [...rawStock].sort((a: any, b: any) => {
      const timeA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
  }, [rawStock]);

  // Build consumable lookup map
  const consumableMap = useMemo(() => {
    const map: Record<string, any> = {};
    consumables?.forEach(c => { map[c.id] = c; });
    return map;
  }, [consumables]);

  // Flatten all items across all stock documents
  const allItems = useMemo(() => {
    if (!stock) return [];
    return stock.flatMap(doc =>
      (doc.items || []).map((item: any) => ({
        ...item,
        locationId: doc.locationId,
        locationName: doc.locationName,
        docId: doc.id,
        date: doc.date,
      }))
    );
  }, [stock]);

  // ── Tab 1: Group by Consumable + Location ──────────────────
  const groupedByConsumable = useMemo(() => {
    const map: Record<string, { consumableId: string; consumableName: string; locationId: string; locationName: string; qty: number; section: string }> = {};
    allItems.forEach(item => {
      const key = `${item.consumableId}__${item.locationName}`;
      if (!map[key]) {
        map[key] = {
          consumableId: item.consumableId,
          consumableName: item.consumableName || item.consumableId,
          locationId: item.locationId || '',
          locationName: item.locationName || '—',
          qty: 0,
          section: consumableMap[item.consumableId]?.section || '',
        };
      }
      map[key].qty += item.operation === 'IN' ? Number(item.quantity) : -Number(item.quantity);
    });
    return Object.values(map);
  }, [allItems, consumableMap]);

  // ── Tab 2: Group by Section + Location ────────────────────
  const groupedBySection = useMemo(() => {
    const map: Record<string, { section: string; locationName: string; qty: number }> = {};
    allItems.forEach(item => {
      const section = consumableMap[item.consumableId]?.section || item.section || 'Unknown';
      const key = `${section}__${item.locationName}`;
      if (!map[key]) map[key] = { section, locationName: item.locationName || '—', qty: 0 };
      map[key].qty += item.operation === 'IN' ? Number(item.quantity) : -Number(item.quantity);
    });
    return Object.values(map);
  }, [allItems, consumableMap]);

  const handleDelete = async (id: string) => {
    if (!db || !confirm('Delete this stock entry?')) return;
    try {
      await deleteDoc(doc(db, 'quality_stock', id));
      toast({ title: 'Deleted', description: 'Stock entry removed.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete.' });
    }
  };

  const isLoading = stockLoading;
  const totalIn = allItems.filter(i => i.operation === 'IN').reduce((s, i) => s + Number(i.quantity), 0);
  const totalOut = allItems.filter(i => i.operation === 'OUT').reduce((s, i) => s + Number(i.quantity), 0);
  const criticalCount = groupedByConsumable.filter(g => {
    const c = consumableMap[g.consumableId];
    return c?.criticalLevel != null && g.qty <= Number(c.criticalLevel);
  }).length;

  return (
    <div className="w-full p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <nav className="flex text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 mb-2">
            <span>Profile</span>
            <span className="mx-2 opacity-30">/</span>
            <span className="text-primary">Quality Stock Situation</span>
          </nav>
          <h1 className="text-4xl font-black text-primary tracking-tighter uppercase flex items-center gap-3">
            <span className="inline-block h-10 w-2 bg-primary rounded-full" />
            Quality Stock Situation
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Track IN / OUT movements and monitor critical consumable levels.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-12 px-6 rounded-2xl border-primary/20 text-primary font-black text-[11px] uppercase tracking-widest hover:bg-primary/5 gap-2">
            <Download size={16} /> Export
          </Button>
          {canAdd && (
            <Button
              onClick={() => router.push('/quality/stock/add')}
              className="h-12 px-8 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black gap-3 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 text-[11px] uppercase tracking-widest"
            >
              <Plus className="h-5 w-5 stroke-[3]" /> ADD STOCK
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: 'Total Entries', value: stock?.length || 0, icon: <Package2 className="h-5 w-5" />, color: 'bg-primary/10 text-primary border-primary/10' },
          { label: 'Total IN', value: totalIn, icon: <ArrowUpCircle className="h-5 w-5" />, color: 'bg-teal-50 text-teal-600 border-teal-100' },
          { label: 'Total OUT', value: totalOut, icon: <ArrowDownCircle className="h-5 w-5" />, color: 'bg-amber-50 text-amber-600 border-amber-100' },
          { label: 'Critical Alerts', value: criticalCount, icon: <AlertTriangle className="h-5 w-5" />, color: 'bg-rose-50 text-rose-600 border-rose-100' },
        ].map(({ label, value, icon, color }) => (
          <Card key={label} className="border-none shadow-xl rounded-3xl bg-white overflow-hidden hover:scale-[1.02] transition-all duration-300">
            <CardContent className="p-6 flex items-center justify-between">
              <div className={`p-3 rounded-2xl border ${color}`}>{icon}</div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 mb-1">{label}</p>
                <p className="text-3xl font-black text-primary">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="consumable" className="w-full">
        <TabsList className="bg-muted/30 rounded-2xl h-12 p-1 mb-6">
          <TabsTrigger value="consumable" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary px-5">
            By Consumable & Location
          </TabsTrigger>
          <TabsTrigger value="section" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary px-5">
            By Section & Location
          </TabsTrigger>
          <TabsTrigger value="listing" className="rounded-xl font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-primary px-5">
            Stock Listing
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: By Consumable + Location ── */}
        <TabsContent value="consumable">
          <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                <Table>
                  <TableHeader className="bg-primary/5">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5 pl-6">Consumable</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5">Location</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5 text-center">Available Qty</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5 pr-6">Alert</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? <SkeletonRows cols={4} /> : groupedByConsumable.length === 0 ? (
                      <EmptyRow cols={4} label="No stock data available" />
                    ) : groupedByConsumable.map((row, i) => {
                      const c = consumableMap[row.consumableId];
                      const isCritical = c?.criticalLevel != null && row.qty <= Number(c.criticalLevel);
                      return (
                        <TableRow key={i} className="hover:bg-primary/[0.02] border-b border-muted/15 transition-all">
                          <TableCell className="pl-6">
                            <Link href={`/quality/stock/${row.consumableId}?locationId=${row.locationId}&locationName=${encodeURIComponent(row.locationName)}&consumableName=${encodeURIComponent(row.consumableName)}`}>
                              <span className="font-black text-sm text-primary hover:underline cursor-pointer">{row.consumableName}</span>
                            </Link>
                            {row.section && <span className="ml-2 text-[10px] font-bold text-muted-foreground opacity-60 uppercase">{row.section}</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <MapPin size={12} className="text-primary/30" />
                              <span className="font-bold text-sm text-primary/70">{row.locationName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-black text-lg ${row.qty < 0 ? 'text-rose-500' : 'text-primary'}`}>{row.qty}</span>
                          </TableCell>
                          <TableCell className="pr-6">
                            {isCritical ? (
                              <Badge className="bg-rose-500 text-white border-none font-black text-[10px] uppercase tracking-wider rounded-xl px-3 py-1 gap-1.5 flex items-center w-fit">
                                <AlertTriangle size={10} /> Critical Level
                              </Badge>
                            ) : (
                              <Badge className="bg-teal-50 text-teal-700 border border-teal-100 font-black text-[10px] uppercase tracking-wider rounded-xl px-3 py-1 w-fit">
                                OK
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ── Tab 2: By Section + Location ── */}
        <TabsContent value="section">
          <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                <Table>
                  <TableHeader className="bg-primary/5">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5 pl-6">Section</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5">Location</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5 pr-6 text-center">Available Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? <SkeletonRows cols={3} /> : groupedBySection.length === 0 ? (
                      <EmptyRow cols={3} label="No section data available" />
                    ) : groupedBySection.map((row, i) => (
                      <TableRow key={i} className="hover:bg-primary/[0.02] border-b border-muted/15 transition-all">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-2">
                            <Layers size={14} className="text-primary/40" />
                            <span className="font-black text-sm text-primary uppercase tracking-tight">{row.section}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-primary/30" />
                            <span className="font-bold text-sm text-primary/70">{row.locationName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="pr-6 text-center">
                          <span className={`font-black text-lg ${row.qty < 0 ? 'text-rose-500' : 'text-primary'}`}>{row.qty}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ── Tab 3: Listing ── */}
        <TabsContent value="listing">
          <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <Table>
                  <TableHeader className="bg-primary/5">
                    <TableRow className="hover:bg-transparent border-none">
                      <TableHead className="w-[60px] py-5 pl-6" />
                      <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5">Location</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5">Date</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5">Items</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5">Created By</TableHead>
                      <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5 pr-6">Updated By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? <SkeletonRows cols={6} /> : !stock?.length ? (
                      <EmptyRow cols={6} label="No stock entries found" />
                    ) : stock.map(entry => (
                      <TableRow key={entry.id} className="hover:bg-primary/[0.02] border-b border-muted/15 group transition-all">
                        <TableCell className="pl-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all">
                                <MoreHorizontal size={18} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-52 p-2 rounded-2xl shadow-2xl border-primary/10">
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="gap-3 text-rose-500 cursor-pointer font-black text-[11px] uppercase tracking-wider py-3 rounded-xl hover:bg-rose-50"
                                onClick={() => handleDelete(entry.id)}
                              >
                                <Trash2 size={14} /> Delete Entry
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-primary/30" />
                            <span className="font-black text-sm text-primary">{entry.locationName || entry.locationId || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-primary/30" />
                            <span className="font-bold text-sm text-primary/70">{entry.date || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(entry.items || []).slice(0, 3).map((item: any, i: number) => (
                              <Badge key={i} className={`text-[10px] font-black border rounded-lg px-2 py-0.5 ${item.operation === 'IN' ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                {item.operation} {item.quantity}
                              </Badge>
                            ))}
                            {(entry.items?.length || 0) > 3 && (
                              <span className="text-[10px] font-bold text-primary/40">+{entry.items.length - 3} more</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <User size={11} className="text-primary/30" />
                            <span className="text-xs font-bold text-primary/60">{entry.createdBy || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="pr-6">
                          <div className="flex items-center gap-1.5">
                            <User size={11} className="text-primary/30" />
                            <span className="text-xs font-bold text-primary/60">{entry.updatedBy || '—'}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i} className="border-none">
          <TableCell colSpan={cols} className="py-3 px-6">
            <Skeleton className="h-10 w-full rounded-xl" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

function EmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="h-52 text-center">
        <div className="flex flex-col items-center gap-3 opacity-20">
          <Package2 size={56} />
          <p className="text-lg font-black uppercase tracking-widest">{label}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}
