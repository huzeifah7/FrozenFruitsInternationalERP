'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useFirestore,
  useMemoFirebase,
  useUser,
  useCollection,
} from '@/firebase';
import {
  collection,
  query,
  orderBy,
  deleteDoc,
  doc,
  where,
  getDocs,
  serverTimestamp,
  setDoc,
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
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2,
  MapPin,
  FileText,
  ChevronRight,
  ScanBarcode,
  Layers,
  LeafyGreen,
  RotateCcw,
  X
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthContext } from '@/components/auth-provider';
import { cn } from '@/lib/utils';
import { ScannerModal } from '@/components/scanner-modal';
import { usePermissions } from '@/hooks/use-permissions';

export default function ProductionFeedsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { profile } = useAuthContext();
  const router = useRouter();
  const { toast } = useToast();
  const { canAdd } = usePermissions('production.feeds');

  const [activeTab, setActiveTab] = useState('group');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [showAllForAdmin, setShowAllForAdmin] = useState(false);

  // Queries
  const feedsQuery = useMemoFirebase(() => {
    if (!db || !profile) {
      return null;
    }
    return collection(db, 'production_feeds');
  }, [db, profile]);

  const { data: rawFeedsData, isLoading: collectionLoading, error } = useCollection(feedsQuery);
  const isLoading = collectionLoading || !profile;

  const userLocId = profile?.locationId || profile?.location;
  const userRole = profile?.role;

  const feeds = useMemo(() => {
    if (!rawFeedsData) return [];
    let list = rawFeedsData;
    if (userRole !== 'admin' && userLocId) {
      list = list.filter(f => f.locationId === userLocId || f.locationId === profile?.location);
    }
    return [...list].sort((a: any, b: any) => (b.dateTime || b.createdAt || '').localeCompare(a.dateTime || a.createdAt || ''));
  }, [rawFeedsData, userRole, userLocId, profile]);

  // Grouped feeds for the "Group By" view (if needed, but user asked for 2 specific tabs)
  // Actually, the request said:
  // TAB 1 — Raw Materials Feeds
  // TAB 2 — Return Feeds
  // And a separate Grouped view page.
  
  const rawFeeds = useMemo(() => {
    if (!feeds) return [];
    let filtered = feeds.filter(f => {
      const type = (f.palletizationType || f.palletisationType || f.type || '').toLowerCase();
      const sType = (f.sourceType || '').toUpperCase();
      return type.includes('raw') || sType === 'RAW_MATERIAL' || sType === 'RETURN' || (!type && !sType);
    });
    if (searchQuery) {
      filtered = filtered.filter(f => f.barcode?.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return filtered;
  }, [feeds, searchQuery]);

  const returnFeeds = useMemo(() => {
    if (!feeds) return [];
    let filtered = feeds.filter(f => {
      const type = (f.palletizationType || f.palletisationType || f.type || '').toLowerCase();
      return type.includes('return');
    });
    if (searchQuery) {
      filtered = filtered.filter(f => f.barcode?.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return filtered;
  }, [feeds, searchQuery]);

  const handleDelete = async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'production_feeds', id));
      toast({ title: "Success", description: "Record deleted successfully" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete record" });
    }
  };

  const handleScan = async (decodedText: string): Promise<{ success: boolean; message?: string }> => {
    if (!db || !user || !profile) return { success: false, message: "Initialization error" };
    try {
      // 1. Check if it's already in production_feeds
      const feedsQ = query(collection(db, 'production_feeds'), where('barcode', '==', decodedText));
      const feedsSnap = await getDocs(feedsQ);
      if (!feedsSnap.empty) {
        return { success: false, message: "This Palletization has already been added." };
      }

      // 2. Query palletizations for Raw Material
      let palletDoc = null;
      let sourceType = 'RAW_MATERIAL';

      let palQ = query(collection(db, 'palletizations'), where('barcodeNumber', '==', decodedText));
      let palSnap = await getDocs(palQ);
      if (palSnap.empty) {
        palQ = query(collection(db, 'palletizations'), where('palletizationBarcode', '==', decodedText));
        palSnap = await getDocs(palQ);
      }
      if (palSnap.empty) {
        palQ = query(collection(db, 'palletizations'), where('barcode', '==', decodedText));
        palSnap = await getDocs(palQ);
      }

      if (!palSnap.empty) {
        palletDoc = palSnap.docs[0];
      } else {
        // Query production_output for Return
        const outQ = query(collection(db, 'production_output'), where('barcode', '==', decodedText));
        const outSnap = await getDocs(outQ);
        if (!outSnap.empty) {
          palletDoc = outSnap.docs[0];
          sourceType = 'RETURN';
        }
      }

      if (!palletDoc) {
        return { success: false, message: "This is not a Raw materials Barcode." };
      }

      const pData = palletDoc.data();
      const newFeedRef = doc(collection(db, 'production_feeds'));
      
      const feedData: any = {
        sourceType,
        dateTime: new Date().toISOString().slice(0, 16),
        date: new Date().toISOString().split('T')[0],
        shift: profile.shift || '1',
        locationId: profile.locationId || profile.location || '',
        locationName: profile.locationName || '',
        netWeight: Number(pData.netWeight || pData.net_weight || 0),
        createdAt: serverTimestamp(),
        createdBy: user.email,
        updatedAt: serverTimestamp(),
        updatedBy: user.email,
        barcode: decodedText,
        lotNumber: pData.lotNumber || pData.rawMaterialLotNumber || null,
      };

      if (sourceType === 'RAW_MATERIAL') {
        feedData.palletizationId = palletDoc.id;
        feedData.palletizationBarcode = decodedText;
        feedData.rawMaterialLotNumber = feedData.lotNumber;
        feedData.sourceRawMaterialId = pData.rawMaterialId || pData.sourceRawMaterialId || null;
      } else {
        feedData.sourceProductionOutputId = palletDoc.id;
        feedData.sourceProductionOutputNumber = decodedText;
      }

      await setDoc(newFeedRef, feedData);
      toast({ title: "Success", description: "Production feed added successfully via scanner!" });
      return { success: true };
    } catch (err) {
      console.error(err);
      return { success: false, message: "Failed to process scan." };
    }
  };

  const GroupedFeedsView = () => {
    const grouped = useMemo(() => {
      if (!feeds) return [];
      const groups: Record<string, any> = {};
      feeds.forEach(feed => {
        const date = feed.dateTime ? feed.dateTime.split('T')[0] : 'No Date';
        const key = `${date}_${feed.locationName}_${feed.shift}`;
        if (!groups[key]) {
          groups[key] = {
            shiftDate: date,
            locationName: feed.locationName || 'Unknown',
            shift: feed.shift || '1',
            numPallets: 0,
            totalConsumption: 0,
          };
        }
        groups[key].numPallets += 1;
        groups[key].totalConsumption += Number(feed.netWeight) || 0;
      });
      return Object.values(groups).sort((a, b) => b.shiftDate.localeCompare(a.shiftDate));
    }, [feeds]);

    return (
      <div className="bg-white rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F8F7FF] border-b border-primary/5 hover:bg-transparent">
              <TableHead className="pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Shift Date</TableHead>
              <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Location</TableHead>
              <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-center">Shift</TableHead>
              <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-center">Number Of Pallets</TableHead>
              <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right pr-8">Total Consumption (KG)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.map((group: any, idx) => (
              <TableRow 
                key={idx} 
                onClick={() => router.push(`/production/feeds/group?date=${group.shiftDate}&location=${group.locationName}&shift=${group.shift}`)}
                className="hover:bg-primary/[0.02] transition-all border-b border-primary/5 last:border-0 group cursor-pointer"
              >
                <TableCell className="pl-8 font-black text-primary text-xs tracking-tight">{group.shiftDate}</TableCell>
                <TableCell className="font-bold text-primary/70 text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3 w-3 opacity-30" />
                    {group.locationName}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="px-2 py-1 bg-primary/5 rounded-lg font-black text-[10px] text-primary">SHIFT {group.shift}</span>
                </TableCell>
                <TableCell className="text-center font-black text-primary text-xs">{group.numPallets}</TableCell>
                <TableCell className="text-right pr-8 font-black text-emerald-600 text-sm flex items-center justify-end gap-2">
                  {group.totalConsumption.toLocaleString()} <span className="text-[10px] opacity-40">KG</span>
                  <ChevronRight className="h-4 w-4 opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FBFBFF]">
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b border-primary/5 shadow-sm sticky top-0 z-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 max-w-[1600px] mx-auto">
          <div className="space-y-1.5">
            <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 mb-1" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-2">
                <li>Profile</li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  Production Feeds
                </li>
              </ol>
            </nav>
            <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">
              Production Feeds
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-primary/20 group-focus-within:text-primary transition-all">
                <ScanBarcode className="h-4 w-4" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search Barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 w-[300px] pl-11 pr-6 bg-muted/20 border-none rounded-xl font-bold text-primary text-xs placeholder:text-primary/20 focus:ring-2 focus:ring-primary/10 transition-all outline-none"
              />
            </div>
            <Button 
              variant="outline" 
              onClick={() => setIsScannerOpen(true)}
              className="h-12 px-8 border-emerald-600/20 text-emerald-600 hover:bg-emerald-50 font-black rounded-xl transition-all uppercase tracking-[0.15em] text-[10px] gap-2"
            >
              Open Scanner
            </Button>
            {profile?.role === 'admin' && profile?.locationId && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowAllForAdmin(!showAllForAdmin)}
                className={cn(
                  "h-12 px-6 rounded-xl font-bold uppercase tracking-widest transition-all",
                  showAllForAdmin ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100" : "text-muted-foreground border-muted-foreground/20"
                )}
              >
                {showAllForAdmin ? "Showing All Sites" : "Show All Sites"}
              </Button>
            )}
            {canAdd && (
              <Button asChild className="h-12 px-8 bg-primary hover:bg-primary/90 text-white font-black rounded-xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.15em] text-[10px] gap-2">
                <Link href="/production/feeds/add">
                  <Plus className="h-4 w-4" /> Add Production Feed
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 max-w-[1600px] mx-auto w-full space-y-8 animate-in fade-in duration-700">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-white/50 border border-primary/5 p-1.5 rounded-[1.5rem] h-auto shadow-sm">
            <TabsTrigger value="raw" className="rounded-xl px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
              <LeafyGreen className="h-3.5 w-3.5" /> Raw Materials Feeds
            </TabsTrigger>
            <TabsTrigger value="return" className="rounded-xl px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
              <RotateCcw className="h-3.5 w-3.5" /> Return Feeds
            </TabsTrigger>
            <TabsTrigger value="group" className="rounded-xl px-8 py-3 font-black text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2">
              <Layers className="h-3.5 w-3.5" /> Group By Feed
            </TabsTrigger>
          </TabsList>

          {/* TAB: Raw Materials Feeds */}
          <TabsContent value="raw" className="m-0 border-none outline-none">
            {error && (
              <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl mb-6">
                <p className="text-rose-600 font-bold text-xs uppercase tracking-widest">
                  Error loading feeds: {error.message}
                </p>
                {error.message.includes('index') && (
                  <p className="text-rose-500 text-[10px] mt-2 font-medium">
                    This query requires a Firestore index. Please wait a moment or click the link in the console to create it.
                  </p>
                )}
              </div>
            )}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F7FF] border-b border-primary/5 hover:bg-transparent">
                    <TableHead className="pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Actions</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Date and Time</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-center">Shift</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Palletization</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right">Net Weight</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Raw Material Lot Number</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Source Production Output</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Created By</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 pr-8">Updated By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawFeeds.map(feed => (
                    <TableRow key={feed.id} className="hover:bg-primary/[0.02] transition-all border-b border-primary/5 last:border-0 group">
                      <TableCell className="pl-8">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56 p-2 rounded-2xl shadow-2xl border-primary/10">
                            <DropdownMenuItem className="gap-3 text-rose-500 cursor-pointer font-black text-[10px] uppercase tracking-wider py-3 rounded-xl hover:bg-rose-50" onSelect={() => handleDelete(feed.id)}>
                              <Trash2 size={14} /> Delete Feed
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="font-black text-primary text-xs">{feed.dateTime?.replace('T', ' ')}</TableCell>
                      <TableCell className="text-center">
                        <span className="px-2 py-1 bg-primary/5 rounded-lg font-black text-[10px] text-primary">{feed.shift}</span>
                      </TableCell>
                      <TableCell className="font-bold text-primary/70 text-xs tracking-tight">
                        {feed.sourceType === 'RETURN' ? feed.sourceProductionOutputNumber || feed.barcode : feed.barcode || feed.palletizationId || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-600 text-xs">{feed.netWeight?.toLocaleString()} KG</TableCell>
                      <TableCell className="font-black text-primary/40 text-[10px] tracking-widest">{feed.lotNumber || feed.rawMaterialLotNumber || '-'}</TableCell>
                      <TableCell className="font-black text-primary/40 text-[10px] tracking-widest">
                        {feed.sourceType === 'RETURN' ? feed.sourceProductionOutputNumber || feed.barcode || feed.sourceProductionOutputId || '-' : '-'}
                      </TableCell>
                      <TableCell className="text-[10px] font-bold text-primary/40">{feed.createdBy?.split('@')[0]}</TableCell>
                      <TableCell className="text-[10px] font-bold text-primary/40 pr-8">{feed.updatedBy?.split('@')[0]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB: Return Feeds */}
          <TabsContent value="return" className="m-0 border-none outline-none">
            <div className="bg-white rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F7FF] border-b border-primary/5 hover:bg-transparent">
                    <TableHead className="pl-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Actions</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Date and Time</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-center">Shift</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Palletization</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right">Net Weight</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Source Production Output</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Created By</TableHead>
                    <TableHead className="py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 pr-8">Updated By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnFeeds.map(feed => (
                    <TableRow key={feed.id} className="hover:bg-primary/[0.02] transition-all border-b border-primary/5 last:border-0 group">
                      <TableCell className="pl-8">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all">
                              <MoreVertical size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56 p-2 rounded-2xl shadow-2xl border-primary/10">
                            <DropdownMenuItem className="gap-3 text-rose-500 cursor-pointer font-black text-[10px] uppercase tracking-wider py-3 rounded-xl hover:bg-rose-50" onSelect={() => handleDelete(feed.id)}>
                              <Trash2 size={14} /> Delete Feed
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="font-black text-primary text-xs">{feed.dateTime?.replace('T', ' ')}</TableCell>
                      <TableCell className="text-center">
                        <span className="px-2 py-1 bg-primary/5 rounded-lg font-black text-[10px] text-primary">{feed.shift}</span>
                      </TableCell>
                      <TableCell className="font-bold text-primary/70 text-xs tracking-tight">{feed.barcode || feed.palletizationId || 'Unknown'}</TableCell>
                      <TableCell className="text-right font-black text-emerald-600 text-xs">{feed.netWeight?.toLocaleString()} KG</TableCell>
                      <TableCell className="font-black text-primary/40 text-[10px] tracking-widest">{feed.barcode} (Return)</TableCell>
                      <TableCell className="text-[10px] font-bold text-primary/40">{feed.createdBy?.split('@')[0]}</TableCell>
                      <TableCell className="text-[10px] font-bold text-primary/40 pr-8">{feed.updatedBy?.split('@')[0]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* TAB: Group By Feed */}
          <TabsContent value="group" className="m-0 border-none outline-none">
            <GroupedFeedsView />
          </TabsContent>
        </Tabs>
      </div>

      <ScannerModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScan={handleScan} 
      />
    </div>
  );
}
