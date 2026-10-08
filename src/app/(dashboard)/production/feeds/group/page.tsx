'use client';

import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
} from '@/firebase';
import {
  collection,
  query,
  where,
  orderBy,
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
import { 
  ChevronLeft,
  Calendar,
  MapPin,
  Clock,
  Package,
  ArrowUpRight,
  LeafyGreen,
  RotateCcw,
  X
} from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProductionFeedGroupDetailsPage() {
  const db = useFirestore();
  const searchParams = useSearchParams();

  const date = searchParams.get('date');
  const location = searchParams.get('location');
  const shift = searchParams.get('shift');

  const [activeTab, setActiveTab] = useState('raw');

  const feedsQuery = useMemoFirebase(() => {
    if (!db || !location || !shift) return null;
    if (location === 'Unknown') {
      return query(
        collection(db, 'production_feeds'),
        where('shift', '==', shift),
        where('locationName', 'in', ['', 'Unknown'])
      );
    }
    return query(
      collection(db, 'production_feeds'),
      where('shift', '==', shift),
      where('locationName', '==', location)
    );
  }, [db, shift, location]);

  const { data: allFeeds, isLoading, error } = useCollection(feedsQuery);

  const filteredFeeds = useMemo(() => {
    if (!allFeeds || !date) return [];
    return allFeeds.filter((f: any) => 
      (f.date === date) || (f.dateTime && f.dateTime.startsWith(date))
    );
  }, [allFeeds, date]);

  const rawMaterialsFeeds = useMemo(() => filteredFeeds.filter((f: any) => {
    const type = (f.sourceType || f.palletizationType || f.palletisationType || f.type || '').toLowerCase();
    return type.includes('raw');
  }), [filteredFeeds]);

  const returnFeeds = useMemo(() => filteredFeeds.filter((f: any) => {
    const type = (f.sourceType || f.palletizationType || f.palletisationType || f.type || '').toLowerCase();
    return type.includes('return');
  }), [filteredFeeds]);

  const stats = useMemo(() => {
    return {
      count: filteredFeeds.length,
      weight: filteredFeeds.reduce((acc, f) => acc + (Number(f.netWeight) || 0), 0)
    };
  }, [filteredFeeds]);

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            asChild
            className="rounded-full hover:bg-primary/5 text-primary/40 hover:text-primary transition-all"
          >
            <Link href="/production/feeds">
              <ChevronLeft className="h-6 w-6" />
            </Link>
          </Button>
          <div className="space-y-1">
            <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-2">
                <li>Production</li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  Feeds
                </li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  <span className="text-primary/60 font-black uppercase tracking-[0.1em]">Group Details</span>
                </li>
              </ol>
            </nav>
            <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Feed Group Details</h1>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 flex items-center gap-5">
            <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/30">Shift Date</p>
              <p className="font-black text-primary text-sm">{date}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 flex items-center gap-5">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
              <MapPin size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-600/30">Location</p>
              <p className="font-black text-amber-600 text-sm uppercase">{location}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 flex items-center gap-5">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600/30">Shift</p>
              <p className="font-black text-blue-600 text-sm uppercase">Shift {shift}</p>
            </div>
          </div>
          <div className="bg-emerald-600 p-6 rounded-[2rem] shadow-xl shadow-emerald-600/20 flex items-center justify-between group">
            <div className="flex items-center gap-5">
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                <Package size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Total Consumption</p>
                <p className="font-black text-white text-xl">{stats.weight.toLocaleString()} <span className="text-xs opacity-60">KG</span></p>
              </div>
            </div>
            <div className="text-white/20 group-hover:text-white/100 transition-all">
              <ArrowUpRight size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <TabsList className="bg-white/50 border border-primary/5 p-1.5 rounded-[1.5rem] h-auto shadow-sm inline-flex">
          <TabsTrigger value="raw" className="rounded-xl px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
            <LeafyGreen className="h-3.5 w-3.5" /> Raw Materials ({rawMaterialsFeeds.length})
          </TabsTrigger>
          <TabsTrigger value="return" className="rounded-xl px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
            <RotateCcw className="h-3.5 w-3.5" /> Returns ({returnFeeds.length})
          </TabsTrigger>
        </TabsList>
        
        {error && (
          <div className="bg-rose-50 border border-rose-200 p-8 rounded-[2rem] text-center max-w-2xl mx-auto shadow-sm">
            <X className="h-8 w-8 text-rose-500 mx-auto mb-4" />
            <p className="text-rose-600 font-black uppercase tracking-widest text-sm mb-2">Error loading group details</p>
            <p className="text-muted-foreground text-xs font-medium">{error.message}</p>
            {error.message.includes('index') && (
              <p className="mt-4 text-amber-600 text-[10px] font-bold">
                A Firestore index is required. Please check the browser console for the link to create it.
              </p>
            )}
          </div>
        )}

        <TabsContent value="raw" className="m-0 outline-none">
          <FeedTable data={rawMaterialsFeeds} type="Raw Material" isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="return" className="m-0 outline-none">
          <FeedTable data={returnFeeds} type="Return" isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FeedTable({ data, type, isLoading }: { data: any[], type: string, isLoading: boolean }) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-primary/5 overflow-hidden">
      <div className="bg-primary/[0.02] px-10 py-5 border-b border-primary/5 flex items-center justify-between">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">
          {type === 'Raw Material' ? 'Raw Material' : 'Return'} Feed Records ({data.length})
        </h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-[#F8F7FF] border-b border-primary/5 hover:bg-transparent">
            <TableHead className="pl-10 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Palletization</TableHead>
            <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Lot Number / Source</TableHead>
            <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right pr-10">Net Weight (KG)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="animate-pulse">
                <TableCell className="pl-10"><div className="h-8 w-32 bg-primary/5 rounded-lg" /></TableCell>
                <TableCell><div className="h-6 w-24 bg-primary/5 rounded-lg" /></TableCell>
                <TableCell className="pr-10"><div className="h-6 w-20 ml-auto bg-primary/5 rounded-lg" /></TableCell>
              </TableRow>
            ))
          ) : (
            data.map((feed) => (
              <TableRow key={feed.id} className="hover:bg-primary/[0.01] transition-all border-b border-primary/5 last:border-0">
                <TableCell className="pl-10">
                  <div className="flex flex-col gap-1">
                    <span className="font-black text-primary text-sm tracking-tight">{feed.barcode || feed.palletizationId || 'Unknown Pallet'}</span>
                    <span className="text-[9px] font-bold text-primary/30 uppercase tracking-widest">ID: {feed.palletizationId || 'No ID'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-bold text-primary/60 text-xs tracking-widest uppercase">
                    {feed.lotNumber || 'Return Feed'}
                  </span>
                </TableCell>
                <TableCell className="text-right pr-10">
                  <span className="font-black text-emerald-600 text-sm">
                    {Number(feed.netWeight || 0).toLocaleString()} KG
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
          {data.length === 0 && !isLoading && (
            <TableRow>
              <TableCell colSpan={3} className="h-40 text-center">
                <div className="flex flex-col items-center gap-2 opacity-20">
                  <Package size={40} />
                  <p className="font-black text-xs uppercase tracking-widest">No records found for this category</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
