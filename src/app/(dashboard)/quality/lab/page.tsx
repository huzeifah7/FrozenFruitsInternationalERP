'use client';

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  deleteDoc,
  doc
} from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  Plus, 
  Search, 
  FileText, 
  Download,
  Trash2,
  Beaker,
  TrendingUp,
  FlaskConical,
  Eye
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function LabAnalysisPage() {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!db) return;

    const q = query(collection(db, 'lab_analysis'), orderBy('date', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAnalyses(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const handleDelete = async (id: string) => {
    if (!db || !window.confirm('Are you sure you want to delete this analysis?')) return;
    try {
      await deleteDoc(doc(db, 'lab_analysis', id));
      toast({ title: "Success", description: "Analysis deleted successfully" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete analysis" });
    }
  };

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  const filteredAnalyses = analyses.filter(item => 
    item.analysisName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.labName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.farmName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full p-8 space-y-10 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <nav className="flex text-[10px] font-bold uppercase tracking-[0.2em] text-black/40 mb-3" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-2">
              <li>Profile</li>
              <li className="flex items-center">
                <span className="mx-2 text-black/20">/</span>
                <span className="text-black/60">Quality</span>
              </li>
              <li className="flex items-center">
                <span className="mx-2 text-black/20">/</span>
                <span className="text-black font-black">Lab Analysis</span>
              </li>
            </ol>
          </nav>
          <h1 className="text-5xl font-black text-black tracking-tighter">Lab Analysis</h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-black/20 group-focus-within:text-black transition-colors" />
            <input 
              placeholder="Search analysis, product or lab..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-14 pl-12 pr-6 w-full md:w-[400px] bg-white border-none rounded-2xl shadow-xl shadow-black/5 font-bold text-black focus-visible:ring-2 focus-visible:ring-black/20 transition-all outline-none"
            />
          </div>
          <Button 
            onClick={() => router.push('/quality/lab/add')}
            className="h-14 px-8 bg-black hover:bg-black/90 text-white rounded-2xl font-black flex items-center gap-3 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] transition-all hover:scale-105 active:scale-95 text-[11px] uppercase tracking-widest"
          >
            <Plus className="h-5 w-5 stroke-[3]" />
            ADD ANALYSIS
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard 
          title="Total Analyses" 
          value={analyses.length} 
          icon={<FlaskConical className="h-6 w-6" />}
          color="blue"
        />
        <SummaryCard 
          title="This Month" 
          value={analyses.filter(a => a.date?.startsWith(new Date().toISOString().slice(0, 7))).length} 
          icon={<TrendingUp className="h-6 w-6" />}
          color="emerald"
        />
        <SummaryCard 
          title="Lab Partners" 
          value={new Set(analyses.map(a => a.labName)).size} 
          icon={<Beaker className="h-6 w-6" />}
          color="purple"
        />
        <SummaryCard 
          title="Files Uploaded" 
          value={analyses.filter(a => a.fileUrl).length} 
          icon={<FileText className="h-6 w-6" />}
          color="amber"
        />
      </div>

      {/* Table Section */}
      <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-xl">
        <CardContent className="p-0">
          <div style={{ overflowX: 'auto' }}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-black/5 h-20">
                  <TableHead className="w-[80px] text-center text-[10px] font-black uppercase tracking-widest text-black/60">Action</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-black/60 whitespace-nowrap">Analysis Name</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-black/60 whitespace-nowrap">Lab Name</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-black/60 whitespace-nowrap">RM Lot or Farm</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-black/60 whitespace-nowrap">Product</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-black/60 whitespace-nowrap">Farm</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-black/60 whitespace-nowrap">Processing Lines</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-black/60 whitespace-nowrap">Date</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-black/60 text-center whitespace-nowrap">File</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-black/60 text-center whitespace-nowrap">Price</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-black/60 whitespace-nowrap">Created By</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest text-black/60 text-right pr-10 whitespace-nowrap">Updated By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse h-20">
                      <TableCell colSpan={12} className="bg-black/5 h-20" />
                    </TableRow>
                  ))
                ) : filteredAnalyses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-60 text-center">
                      <div className="flex flex-col items-center justify-center space-y-4 opacity-20 text-black">
                        <FlaskConical size={64} />
                        <p className="text-xl font-black uppercase tracking-widest">No matching analyses found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAnalyses.map((analysis) => (
                    <TableRow 
                      key={analysis.id} 
                      className="group border-b border-black/5 hover:bg-black/[0.02] transition-all h-20"
                    >
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-black/10 text-black/40 group-hover:text-black transition-colors focus:ring-0">
                              <MoreHorizontal className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56 rounded-2xl border-black/10 shadow-2xl font-bold p-2 bg-white">
                             {analysis.fileUrl && (
                               <DropdownMenuItem 
                                 className="py-3 px-4 focus:bg-black/5 cursor-pointer text-black rounded-xl hover:bg-black/5 transition-colors"
                                 onClick={() => handleDownload(analysis.fileUrl)}
                               >
                                 <Download className="mr-3 h-4 w-4" /> Download Result
                               </DropdownMenuItem>
                             )}
                            <DropdownMenuItem 
                              className="py-3 px-4 focus:bg-black/5 cursor-pointer text-black rounded-xl hover:bg-black/5 transition-colors"
                              onClick={() => router.push(`/quality/lab/${analysis.id}`)}
                            >
                              <Eye className="mr-3 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-black/5 my-1" />
                            <DropdownMenuItem 
                              className="py-3 px-4 focus:bg-destructive/5 text-destructive cursor-pointer rounded-xl hover:bg-destructive/5 transition-colors"
                               onClick={() => handleDelete(analysis.id)}
                            >
                              <Trash2 className="mr-3 h-4 w-4" /> Delete Record
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span 
                          className="text-base font-black text-black leading-tight hover:underline cursor-pointer"
                          onClick={() => router.push(`/quality/lab/${analysis.id}`)}
                        >
                          {analysis.analysisName}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm font-bold text-black whitespace-nowrap">{analysis.labName}</TableCell>
                      <TableCell className="text-sm font-bold text-black whitespace-nowrap">{analysis.rmLotOrFarm}</TableCell>
                      <TableCell className="text-sm font-bold text-black whitespace-nowrap">{analysis.productName}</TableCell>
                      <TableCell className="text-sm font-bold text-black whitespace-nowrap">{analysis.farmName}</TableCell>
                      <TableCell className="text-sm font-bold text-black whitespace-nowrap">{analysis.processingLineName}</TableCell>
                      <TableCell className="text-sm font-black text-black italic whitespace-nowrap">
                        {analysis.date}
                      </TableCell>
                      <TableCell className="text-center">
                        {analysis.fileUrl ? (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDownload(analysis.fileUrl)}
                            className="h-10 w-10 text-emerald-600 hover:bg-emerald-500/10 rounded-xl transition-all"
                          >
                            <Download className="h-5 w-5" />
                          </Button>
                        ) : (
                          <span className="text-black/20">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap">
                        <span className="px-3 py-1 bg-black text-white text-xs font-black rounded-lg">
                          {analysis.price} <span className="text-[10px] opacity-60 uppercase">{analysis.currency || 'MAD'}</span>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-black uppercase truncate max-w-[120px]">
                            {analysis.createdByEmail?.split('@')[0] || analysis.createdBy?.slice(0, 8) || 'System'}
                          </span>
                          <span className="text-[8px] font-bold text-black/40 uppercase">
                            {analysis.createdAt ? new Date(analysis.createdAt.seconds * 1000).toLocaleDateString() : '—'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-10 whitespace-nowrap">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-black uppercase truncate max-w-[120px]">
                            {analysis.updatedByEmail?.split('@')[0] || analysis.createdByEmail?.split('@')[0] || 'System'}
                          </span>
                          <span className="text-[8px] font-bold text-black/40 uppercase">
                            {analysis.updatedAt ? new Date(analysis.updatedAt.seconds * 1000).toLocaleDateString() : '—'}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value, icon, color }: { title: string, value: any, icon: any, color: string }) {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-600 border-blue-200/50',
    emerald: 'bg-emerald-500/10 text-emerald-600 border-emerald-200/50',
    purple: 'bg-purple-500/10 text-purple-600 border-purple-200/50',
    amber: 'bg-amber-500/10 text-amber-600 border-amber-200/50',
  };

  return (
    <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden group hover:scale-[1.02] transition-all duration-500">
      <CardContent className="p-8">
        <div className="flex items-center justify-between">
          <div className={`p-4 rounded-2xl ${colors[color as keyof typeof colors]} group-hover:scale-110 transition-transform shadow-sm`}>
            {icon}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-1">{title}</p>
            <p className="text-3xl font-black text-black">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
