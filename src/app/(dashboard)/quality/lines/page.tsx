'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  doc,
  deleteDoc
} from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  MapPin, 
  Hash, 
  Activity,
  FileText,
  ChevronRight,
  Filter,
  MoreVertical,
  Eye,
  Edit,
  Trash2
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

interface ProcessingLine {
  id: string;
  title: string;
  stationNumber: number;
  locationTag?: string;
  gpsLocation: string;
  description?: string;
  createdBy: string;
  createdByDisplayName?: string;
  createdAt: any;
}

export default function ProcessingLinesPage() {
  const router = useRouter();
  const db = useFirestore();
  const [lines, setLines] = useState<ProcessingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    if (!db || !window.confirm('Are you sure you want to delete this processing line?')) return;

    try {
      await deleteDoc(doc(db, 'processing_lines', id));
      toast({
        title: "Success",
        description: "Processing line deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting line:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete processing line",
      });
    }
  };

  useEffect(() => {
    if (!db) return;

    const q = query(collection(db, 'processing_lines'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lineData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ProcessingLine[];
      setLines(lineData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching lines:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const filteredLines = lines.filter(line => 
    line.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    line.gpsLocation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                <span className="text-primary font-black">Processing Lines</span>
              </li>
            </ol>
          </nav>
          <h1 className="text-4xl font-black text-primary tracking-tight">Processing Lines</h1>
          <p className="text-sm font-medium text-primary/50 max-w-md">
            Monitor and manage technical configurations for all production lines and stations.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
           <Button variant="outline" className="h-12 px-6 rounded-2xl border-primary/10 text-primary font-bold group hover:bg-primary/5 transition-all">
              <Filter className="mr-2 h-4 w-4 opacity-50 transition-transform group-hover:rotate-180" /> FILTERS
           </Button>
           <Button 
            onClick={() => router.push('/quality/lines/add')}
            className="h-12 px-8 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
           >
            <Plus className="h-5 w-5 stroke-[3px]" /> ADD NEW LINE
           </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard 
          title="Total Lines" 
          value={lines.length} 
          subtitle="Registered tracks" 
          icon={<Activity className="text-primary" />} 
          color="primary"
        />
        <SummaryCard 
          title="Active Locations" 
          value={new Set(lines.map(l => l.gpsLocation)).size} 
          subtitle="Across regions" 
          icon={<MapPin className="text-emerald-500" />} 
          color="emerald"
        />
        <SummaryCard 
          title="Avg Stations" 
          value={lines.length ? (lines.reduce((acc, curr) => acc + (curr.stationNumber || 0), 0) / lines.length).toFixed(1) : 0} 
          subtitle="Per line capacity" 
          icon={<Hash className="text-amber-500" />} 
          color="amber"
        />
        <SummaryCard 
          title="Recent Additions" 
          value={lines.filter(l => {
            const date = l.createdAt?.toDate?.() || new Date();
            return (new Date().getTime() - date.getTime()) < (7 * 24 * 60 * 60 * 1000);
          }).length} 
          subtitle="Last 7 days" 
          icon={<Plus className="text-blue-500" />} 
          color="blue"
        />
      </div>

      {/* Main Content Area */}
      <Card className="border-none shadow-2xl shadow-primary/5 rounded-[2rem] overflow-hidden bg-white/80 backdrop-blur-xl">
        <div className="p-8 border-b border-primary/5 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30" />
            <Input 
              placeholder="Search by name or location..." 
              className="h-12 pl-12 pr-4 rounded-2xl border-none bg-muted/30 focus-visible:ring-2 focus-visible:ring-primary/10 transition-all font-medium text-primary placeholder:text-primary/20"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-primary/30 uppercase tracking-[0.2em] mr-2">Displaying:</span>
            <span className="text-sm font-black text-primary px-3 py-1 bg-primary/5 rounded-lg">{filteredLines.length} LINES</span>
          </div>
        </div>
        
        <div className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="px-8 py-5 text-left font-black text-[11px] uppercase tracking-widest text-primary/40">Actions</TableHead>
                <TableHead className="px-8 py-5 font-black text-[11px] uppercase tracking-widest text-primary/40">Line Information</TableHead>
                <TableHead className="px-6 py-5 font-black text-[11px] uppercase tracking-widest text-primary/40">Station No.</TableHead>
                <TableHead className="px-6 py-5 font-black text-[11px] uppercase tracking-widest text-primary/40">GPS Location</TableHead>
                <TableHead className="px-6 py-5 font-black text-[11px] uppercase tracking-widest text-primary/40">Registered By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-primary/5">
                    <TableCell className="px-8 py-6 text-left"><Skeleton className="h-10 w-24 rounded-xl" /></TableCell>
                    <TableCell className="px-8 py-6"><Skeleton className="h-12 w-48 rounded-xl" /></TableCell>
                    <TableCell className="px-6 py-6"><Skeleton className="h-8 w-16 rounded-xl" /></TableCell>
                    <TableCell className="px-6 py-6"><Skeleton className="h-8 w-32 rounded-xl" /></TableCell>
                    <TableCell className="px-6 py-6"><Skeleton className="h-8 w-24 rounded-xl" /></TableCell>
                  </TableRow>
                ))
              ) : filteredLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4 opacity-20 grayscale">
                      <FileText size={64} strokeWidth={1} />
                      <p className="font-bold text-xl uppercase tracking-tighter">No lines found matching your search</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredLines.map((line) => (
                  <TableRow key={line.id} className="group hover:bg-primary/[0.01] transition-all border-b border-primary/5 last:border-0 pointer-events-none">
                    <TableCell className="px-8 py-6 text-left pointer-events-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-primary/20 hover:text-primary hover:bg-primary/5 transition-all">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="rounded-xl border-primary/5 shadow-2xl">
                          <DropdownMenuItem onClick={() => router.push(`/quality/lines/${line.id}`)} className="rounded-lg font-bold py-2.5 flex items-center gap-2 cursor-pointer">
                            <Eye className="size-4 text-emerald-500" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/quality/lines/${line.id}/edit`)} className="rounded-lg font-bold py-2.5 flex items-center gap-2 cursor-pointer">
                            <Edit className="size-4 text-blue-500" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(line.id)} className="rounded-lg font-bold py-2.5 flex items-center gap-2 text-rose-500 cursor-pointer">
                            <Trash2 className="size-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="px-8 py-6 pointer-events-auto">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/5 rounded-2xl group-hover:bg-primary/10 transition-colors shadow-sm">
                          <Activity className="h-5 w-5 text-primary/60" />
                        </div>
                        <div className="flex flex-col">
                          <span 
                            onClick={() => router.push(`/quality/lines/${line.id}`)}
                            className="font-black text-primary text-lg tracking-tight hover:underline cursor-pointer transition-all"
                          >
                            {line.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-primary/30 uppercase tracking-widest">
                              {line.description ? line.description.substring(0, 40) + '...' : 'Technical Unit'}
                            </span>
                            {line.locationTag && (
                              <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 rounded text-[9px] font-black uppercase">
                                {line.locationTag}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-6">
                      <div className="flex items-center gap-2">
                         <div className="h-8 w-12 bg-muted/50 rounded-lg flex items-center justify-center font-black text-primary text-sm shadow-inner border border-primary/5">
                           {line.stationNumber}
                         </div>
                         <span className="text-[10px] font-bold text-primary/30 uppercase tracking-tighter">STATIONS</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-6">
                      <div className="flex items-center gap-2 text-primary/70 font-bold text-sm">
                        <MapPin className="h-4 w-4 opacity-30" />
                        {line.gpsLocation}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-6">
                      <UserDisplayName uid={line.createdBy} fallbackName={line.createdByDisplayName} />
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
