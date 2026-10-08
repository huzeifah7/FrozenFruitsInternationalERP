'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  doc, 
  onSnapshot 
} from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  ChevronLeft, 
  Download, 
  FileText, 
  Beaker,
  Calendar,
  ShieldCheck,
  MoreHorizontal,
  MapPin,
  Clock,
  Info
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface LabAnalysis {
  id: string;
  analysisName: string;
  labName: string;
  rmLotOrFarm: string;
  productName: string;
  farmName: string;
  processingLineName: string;
  date: string;
  price: string | number;
  currency?: string;
  note?: string;
  fileUrl?: string;
  fileName?: string;
  createdAt: any;
  createdByEmail?: string;
  updatedByEmail?: string;
}

export default function ViewLabAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const db = useFirestore();
  const [data, setData] = useState<LabAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !params.id) return;

    const docRef = doc(db, 'lab_analysis', params.id as string);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setData({ id: docSnap.id, ...docSnap.data() } as LabAnalysis);
      } else {
        setError("Analysis record not found.");
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Failed to fetch analysis data.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, params.id]);

  if (loading) {
    return (
      <div className="p-8 space-y-8 max-w-6xl mx-auto text-primary">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <Skeleton className="h-[300px] w-full rounded-3xl" />
        <Skeleton className="h-[200px] w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-6 bg-destructive/10 rounded-full text-destructive">
          <Info size={40} />
        </div>
        <h2 className="text-2xl font-bold text-black">{error || "Something went wrong"}</h2>
        <Button onClick={() => router.push('/quality/lab')} variant="outline" className="rounded-xl border-primary/20 shadow-lg">
          Back to Listing
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/quality/lab')} className="rounded-full hover:bg-black/5 text-black">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div>
            <nav className="flex text-[10px] font-bold uppercase tracking-widest text-black/40 mb-1" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-2">
                <li>Profile</li>
                <li className="flex items-center">
                  <span className="mx-2">/</span>
                  <span className="hover:text-black cursor-pointer" onClick={() => router.push('/quality/lab')}>Lab Analysis</span>
                </li>
                <li className="flex items-center">
                  <span className="mx-2">/</span>
                  <span className="text-black font-black">VIEW DETAILS</span>
                </li>
              </ol>
            </nav>
            <h1 className="text-4xl font-black text-black tracking-tighter">{data.analysisName}</h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-xl border border-black/5">
            <CardHeader className="bg-emerald-500/5 border-b border-emerald-500/10 p-8">
              <div className="flex items-center gap-3 text-emerald-600">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <Beaker size={20} className="font-bold" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black uppercase tracking-wider">Analysis Overview</CardTitle>
                  <CardDescription className="text-xs font-bold text-emerald-600/60 uppercase tracking-widest">Laboratory Specifications</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-y-10 gap-x-12">
              <DataField label="Analysis Name" value={data.analysisName} icon={<Info size={14} />} isHighlight />
              <DataField label="Laboratory" value={data.labName} icon={<Beaker size={14} />} />
              <DataField label="RM Lot or Farm" value={data.rmLotOrFarm} icon={<MapPin size={14} />} />
              <DataField label="Product" value={data.productName} icon={<ShieldCheck size={14} />} />
              <DataField label="Farm" value={data.farmName} icon={<MapPin size={14} />} />
              <DataField label="Processing Line" value={data.processingLineName} icon={<Info size={14} />} />
              <DataField label="Analysis Date" value={data.date} icon={<Calendar size={14} />} />
              <DataField label="Cost (Price)" value={`${data.price} ${data.currency || 'MAD'}`} icon={<Info size={14} />} />
              
              {data.note && (
                <div className="md:col-span-2 pt-6 border-t border-black/5">
                  <div className="flex items-center gap-2 text-[10px] font-black text-black/30 uppercase tracking-widest mb-3">
                     <Clock size={14} /> Remarks & Notes
                  </div>
                  <p className="text-sm font-bold text-black/80 leading-relaxed bg-black/5 p-6 rounded-[2rem] italic">
                     "{data.note}"
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-black/5">
            <CardContent className="p-6 flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center text-black/20 shadow-sm border border-black/5">
                     <Clock size={20} />
                  </div>
                  <div className="flex flex-col">
                     <p className="text-[10px] font-black text-black/30 uppercase tracking-widest">Tracking Info</p>
                     <p className="text-[11px] font-bold text-black/60">
                       By <span className="text-black">{data.createdByEmail?.split('@')[0] || 'System'}</span> 
                       {data.createdAt && ` • ${new Date(data.createdAt.seconds * 1000).toLocaleString()}`}
                     </p>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/80 backdrop-blur-xl h-full min-h-[400px] flex flex-col border border-black/5">
            <CardHeader className="bg-emerald-500/5 border-b border-emerald-500/10 p-8">
              <div className="flex items-center gap-3 text-emerald-600">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <FileText size={20} className="font-bold" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black uppercase tracking-wider text-emerald-600">Report File</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 flex-1 flex flex-col items-center justify-center text-center space-y-6">
              {data.fileUrl ? (
                <>
                  <div className="p-10 bg-emerald-500/10 rounded-[3rem] text-emerald-600 border border-emerald-500/10 shadow-inner">
                    <FileText size={72} strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="font-black text-black text-lg tracking-tight">{data.fileName || 'analysis_report.pdf'}</h3>
                    <p className="text-[10px] font-bold text-black/30 uppercase tracking-widest mt-1">Official Lab Documentation</p>
                  </div>
                  <Button 
                    onClick={() => window.open(data.fileUrl, '_blank')}
                    className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl gap-3 shadow-[0_20px_40px_-15px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] active:scale-95 text-xs tracking-widest uppercase"
                  >
                    <Download size={18} strokeWidth={3} /> DOWNLOAD FILE
                  </Button>
                </>
              ) : (
                <>
                  <div className="p-10 bg-black/5 rounded-[3rem] text-black/10 border border-black/5">
                    <FileText size={72} strokeWidth={1} />
                  </div>
                  <div>
                    <h3 className="font-black text-black/20 text-lg italic tracking-tight uppercase">No File Attached</h3>
                    <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest mt-1">Report missing or not uploaded</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DataField({ label, value, icon, isHighlight }: { label: string, value: string | number | undefined, icon: React.ReactNode, isHighlight?: boolean }) {
  return (
    <div className="space-y-1.5 flex flex-col">
      <div className="flex items-center gap-2 text-[10px] font-black text-black/40 uppercase tracking-widest mb-1">
        {icon} {label}
      </div>
      <p className={`font-black tracking-tight ${isHighlight ? 'text-2xl text-black' : 'text-base text-black font-bold'}`}>
        {value || 'N/A'}
      </p>
    </div>
  );
}
