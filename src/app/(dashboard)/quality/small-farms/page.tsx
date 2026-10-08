'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy 
} from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  User,
  Map,
  Fingerprint,
  MoreHorizontal,
  ChevronRight,
  Filter,
  Sprout,
  LocateFixed
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { UserDisplayName } from '@/components/dashboard/user-display-name';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/use-permissions';

interface SmallFarm {
  id: string;
  name: string;
  farmerName: string;
  region: string;
  ggnNumber: string;
  createdBy: string;
  createdByDisplayName?: string;
  createdAt: any;
}

export default function SmallFarmsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { canList, canAdd } = usePermissions('quality.small-farms');
  const [farms, setFarms] = useState<SmallFarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!db) return;

    const q = query(collection(db, 'small_farms'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const farmData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SmallFarm[];
      setFarms(farmData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching small farms:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const filteredFarms = farms.filter(farm => 
    farm.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    farm.farmerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    farm.region?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    farm.ggnNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!canList && !loading) {
    return <div className="p-8 text-center text-slate-500 font-bold">You do not have permission to view this module.</div>;
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <nav className="flex text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 mb-2" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-2">
              <li>Quality</li>
              <li className="flex items-center">
                <span className="mx-2">/</span>
                <span className="text-primary font-black">Small Farms</span>
              </li>
            </ol>
          </nav>
          <h1 className="text-4xl font-black text-primary tracking-tight">Small Producer Network</h1>
          <p className="text-sm font-medium text-primary/50 max-w-md">
            Consolidate and monitor individual producer compliance, regional logistics, and small-hold collections.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
           <Button variant="outline" className="h-12 px-6 rounded-2xl border-primary/10 text-primary font-bold group hover:bg-primary/5 transition-all">
              <Filter className="mr-2 h-4 w-4 opacity-50 transition-transform group-hover:rotate-180" /> FILTERS
           </Button>
           {canAdd && (
             <Button 
              onClick={() => router.push('/quality/small-farms/add')}
              className="h-12 px-8 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
             >
              <Plus className="h-5 w-5 stroke-[3px]" /> REGISTER PRODUCER
             </Button>
           )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard 
          title="Total Producers" 
          value={farms.length} 
          subtitle="Registered members" 
          icon={<Sprout className="text-primary" />} 
          color="primary"
        />
        <SummaryCard 
          title="Regions Covered" 
          value={new Set(farms.map(f => f.region)).size} 
          subtitle="Operating areas" 
          icon={<Map className="text-emerald-500" />} 
          color="emerald"
        />
        <SummaryCard 
          title="GGN Compliance" 
          value={farms.filter(f => f.ggnNumber).length} 
          subtitle="Certified IDs" 
          icon={<Fingerprint className="text-amber-500" />} 
          color="amber"
        />
        <SummaryCard 
          title="Recent Signups" 
          value={farms.filter(f => {
            const date = f.createdAt?.toDate?.() || new Date();
            return (new Date().getTime() - date.getTime()) < (30 * 24 * 60 * 60 * 1000);
          }).length} 
          subtitle="Last 30 days" 
          icon={<LocateFixed className="text-blue-500" />} 
          color="blue"
        />
      </div>

      {/* Main Content Area */}
      <Card className="border-none shadow-2xl shadow-primary/5 rounded-[2rem] overflow-hidden bg-white/80 backdrop-blur-xl">
        <div className="p-8 border-b border-primary/5 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30" />
            <Input 
              placeholder="Search by name, farmer, region or GGN..." 
              className="h-12 pl-12 pr-4 rounded-2xl border-none bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary/10 transition-all font-medium text-primary placeholder:text-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-primary/30 uppercase tracking-[0.2em] mr-2">Producers:</span>
            <span className="text-sm font-black text-primary px-3 py-1 bg-primary/5 rounded-lg">{filteredFarms.length}</span>
          </div>
        </div>
        
        <div className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="px-8 py-5 font-black text-[11px] uppercase tracking-widest text-primary/40">Producer Identity</TableHead>
                <TableHead className="px-6 py-5 font-black text-[11px] uppercase tracking-widest text-primary/40">Primary Contact</TableHead>
                <TableHead className="px-6 py-5 font-black text-[11px] uppercase tracking-widest text-primary/40">Region</TableHead>
                <TableHead className="px-6 py-5 font-black text-[11px] uppercase tracking-widest text-primary/40">GGN ID</TableHead>
                <TableHead className="px-6 py-5 font-black text-[11px] uppercase tracking-widest text-primary/40">Captured By</TableHead>
                <TableHead className="px-8 py-5 text-right font-black text-[11px] uppercase tracking-widest text-primary/40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-primary/5">
                    <TableCell className="px-8 py-6"><Skeleton className="h-12 w-48 rounded-xl" /></TableCell>
                    <TableCell className="px-6 py-6"><Skeleton className="h-8 w-32 rounded-xl" /></TableCell>
                    <TableCell className="px-6 py-6"><Skeleton className="h-8 w-24 rounded-xl" /></TableCell>
                    <TableCell className="px-6 py-6"><Skeleton className="h-8 w-24 rounded-xl" /></TableCell>
                    <TableCell className="px-6 py-6"><Skeleton className="h-8 w-24 rounded-xl" /></TableCell>
                    <TableCell className="px-8 py-6 text-right"><Skeleton className="h-10 w-24 ml-auto rounded-xl" /></TableCell>
                  </TableRow>
                ))
              ) : filteredFarms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4 opacity-20 grayscale">
                      <Sprout size={64} strokeWidth={1} />
                      <p className="font-bold text-xl uppercase tracking-tighter">No producer profiles found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredFarms.map((farm) => (
                  <TableRow key={farm.id} className="group hover:bg-primary/[0.01] transition-all border-b border-primary/5 last:border-0 pointer-events-none">
                    <TableCell className="px-8 py-6 pointer-events-auto">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/5 rounded-2xl group-hover:bg-primary/10 transition-colors shadow-sm">
                          <LocateFixed className="h-5 w-5 text-primary/60" />
                        </div>
                        <div className="flex flex-col">
                          <span 
                            onClick={() => router.push(`/quality/small-farms/${farm.id}`)}
                            className="font-black text-primary text-lg tracking-tight hover:underline cursor-pointer transition-all"
                          >
                            {farm.name}
                          </span>
                          <span className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">
                            {farm.region || 'Unspecified Region'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-6">
                      <div className="flex items-center gap-2 font-bold text-primary/70">
                        <User className="h-4 w-4 opacity-30" />
                        {farm.farmerName}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-6 text-sm font-bold text-primary/60">
                      {farm.region}
                    </TableCell>
                    <TableCell className="px-6 py-6">
                      {farm.ggnNumber ? (
                        <code className="text-[12px] font-black text-primary bg-muted/50 px-2 py-1 rounded-md">
                          {farm.ggnNumber}
                        </code>
                      ) : (
                        <span className="text-[10px] font-bold text-primary/20 uppercase tracking-widest italic">NOT ASSIGNED</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-6">
                      <UserDisplayName uid={farm.createdBy} fallbackName={farm.createdByDisplayName} />
                    </TableCell>
                    <TableCell className="px-8 py-6 text-right pointer-events-auto">
                      <Button 
                        onClick={() => router.push(`/quality/small-farms/${farm.id}`)}
                        variant="ghost" 
                        size="icon" 
                        className="h-11 w-11 rounded-2xl text-primary/20 hover:text-primary hover:bg-primary/5 transition-all group/btn"
                      >
                         <ChevronRight className="h-6 w-6 transition-transform group-hover/btn:translate-x-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value, subtitle, icon, color }: { 
  title: string, 
  value: string | number, 
  subtitle: string, 
  icon: React.ReactNode,
  color: 'primary' | 'emerald' | 'amber' | 'blue'
}) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary border-primary/10',
    emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/10',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-500/10',
    blue: 'bg-blue-500/10 text-blue-600 border-blue-500/10'
  };

  return (
    <Card className="border-none shadow-xl shadow-primary/5 rounded-[2rem] overflow-hidden group hover:scale-[1.02] transition-all duration-500">
      <CardContent className="p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div className={`p-3 rounded-2xl ${colorMap[color]} transition-transform duration-500 group-hover:rotate-12`}>
            {React.cloneElement(icon as React.ReactElement<any>, { size: 24, strokeWidth: 2.5 })}
          </div>
          <div className="p-1.5 bg-muted/20 rounded-full">
            <MoreHorizontal size={14} className="text-primary/20" />
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/30">{title}</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-primary tracking-tighter">{value}</span>
            <span className="text-[10px] font-black text-primary/40 uppercase tracking-widest">{subtitle}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
