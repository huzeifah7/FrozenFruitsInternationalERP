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
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  ChevronLeft, 
  Download, 
  FileText, 
  MapPin, 
  Hash, 
  Info,
  Calendar,
  ShieldCheck,
  MoreHorizontal,
  Activity
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface Certificate {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileExtension?: string;
  expiryDate: string;
  note?: string;
}

interface ProcessingLine {
  id: string;
  title: string;
  gpsLocation: string;
  stationNumber: number;
  exportatorNumber?: string;
  locationTag?: string;
  description?: string;
  certificates: Certificate[];
  createdAt: any;
  createdBy: string;
  createdByDisplayName?: string;
}

export default function ViewProcessingLinePage() {
  const params = useParams();
  const router = useRouter();
  const db = useFirestore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProcessingLine | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !params.id) return;

    const docRef = doc(db, 'processing_lines', params.id as string);
    
    const unsubscribe = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const lineData = { id: docSnap.id, ...docSnap.data() } as ProcessingLine;
        setData(lineData);
        
        // Resolve creator name
        if (lineData.createdByDisplayName) {
          setCreatorName(lineData.createdByDisplayName);
        } else if (lineData.createdBy) {
          // Fallback lookup
          try {
            const userRef = doc(db, 'appUsers', lineData.createdBy);
            const userSnap = await (await import('firebase/firestore')).getDoc(userRef);
            if (userSnap.exists()) {
              setCreatorName(userSnap.data()?.displayName || userSnap.data()?.email || lineData.createdBy);
            } else {
              setCreatorName(lineData.createdBy);
            }
          } catch (e) {
            setCreatorName(lineData.createdBy);
          }
        }
      } else {
        setError("Processing line not found.");
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Failed to fetch data.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, params.id]);

  const handleDownload = (url: string, fileName: string) => {
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="p-8 space-y-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <Skeleton className="h-[200px] w-full rounded-3xl" />
        <Skeleton className="h-[400px] w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="p-6 bg-destructive/10 rounded-full text-destructive">
          <Info size={40} />
        </div>
        <h2 className="text-2xl font-bold text-primary">{error || "Something went wrong"}</h2>
        <Button onClick={() => router.push('/quality/lines')} variant="outline">
          Back to Listing
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/quality/lines')} className="rounded-full hover:bg-primary/5 text-primary">
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div>
            <nav className="flex text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-1" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-2">
                <li>Quality</li>
                <li className="flex items-center">
                  <span className="mx-2">/</span>
                  <span className="hover:text-primary cursor-pointer" onClick={() => router.push('/quality/lines')}>Processing Lines</span>
                </li>
                <li className="flex items-center">
                  <span className="mx-2">/</span>
                  <span className="text-primary truncate max-w-[150px]">{data.title}</span>
                </li>
              </ol>
            </nav>
            <h1 className="text-3xl font-extrabold text-primary tracking-tight">View Processing Line</h1>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push(`/quality/lines/${data.id}/edit`)}
          className="rounded-xl border-primary/20 text-primary font-bold px-6 gap-2"
        >
          <MoreHorizontal size={18} /> EDIT DETAILS
        </Button>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-primary/5 border-b border-primary/10 p-8">
          <div className="flex items-center gap-3 text-primary">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Info size={20} className="font-bold" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold uppercase tracking-wider">Line Details</CardTitle>
              <CardDescription className="text-xs font-medium text-primary/60">Core technical information and location data.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 grid grid-cols-1 md:grid-cols-3 gap-12">
          <div className="space-y-1">
            <Label value="Title" icon={<FileText size={14} />} />
            <p className="text-xl font-bold text-primary">{data.title}</p>
          </div>
          <div className="space-y-1">
            <Label value="Numero De Station" icon={<Hash size={14} />} />
            <p className="text-xl font-extrabold text-primary">{data.stationNumber}</p>
          </div>
          <div className="space-y-1">
            <Label value="GPS Location" icon={<MapPin size={14} />} />
            <p className="text-xl font-bold text-primary">{data.gpsLocation}</p>
          </div>
          <div className="space-y-1">
            <Label value="Location Tag" icon={<Activity size={14} />} />
            <p className="text-xl font-black text-emerald-600">{data.locationTag || 'N/A'}</p>
          </div>
          <div className="space-y-1">
            <Label value="Exportator Number" icon={<Hash size={14} />} />
            <p className="text-xl font-black text-primary">{data.exportatorNumber || 'N/A'}</p>
          </div>
          <div className="space-y-1">
            <Label value="Created By" icon={<Info size={14} />} />
            <p className="text-xl font-bold text-primary">{creatorName || data.createdBy || 'N/A'}</p>
          </div>
          <div className="md:col-span-3 space-y-1 pt-4 border-t border-primary/5">
            <Label value="Description" />
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap italic">
              {data.description || "No description provided for this line."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-primary/5 border-b border-primary/10 p-8 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3 text-primary">
            <div className="p-2 bg-primary/10 rounded-xl">
              <ShieldCheck size={20} className="font-bold" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold uppercase tracking-wider">Location Certificates</CardTitle>
              <CardDescription className="text-xs font-medium text-primary/60">Compliance and quality verification documents.</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-white border-primary/20 text-primary font-bold px-3 py-1">
            {data.certificates?.length || 0} DOCUMENTS
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-primary/5 hover:bg-primary/5">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-8 font-bold text-[10px] uppercase tracking-widest text-primary/50">File Name</TableHead>
                <TableHead className="px-6 font-bold text-[10px] uppercase tracking-widest text-primary/50">Type</TableHead>
                <TableHead className="px-6 font-bold text-[10px] uppercase tracking-widest text-primary/50">Extension</TableHead>
                <TableHead className="px-6 font-bold text-[10px] uppercase tracking-widest text-primary/50">Expiry Date</TableHead>
                <TableHead className="px-6 font-bold text-[10px] uppercase tracking-widest text-primary/50">Note</TableHead>
                <TableHead className="px-8 font-bold text-[10px] uppercase tracking-widest text-primary/50 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data.certificates || data.certificates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2 opacity-30 grayscale italic">
                      <FileText size={48} />
                      <p>No certificates attached to this line.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.certificates.map((cert, index) => (
                  <TableRow key={index} className="group hover:bg-emerald-50/30 transition-colors">
                    <TableCell className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted rounded-lg group-hover:bg-white transition-colors">
                          <FileText size={18} className="text-muted-foreground" />
                        </div>
                        <span className="font-bold text-primary/80 group-hover:text-primary transition-colors">{cert.fileName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <Badge variant="secondary" className="font-bold text-[10px] uppercase tracking-tighter bg-primary/10 text-primary hover:bg-primary/20 border-none px-3">
                        {cert.fileType}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <span className="font-mono text-xs text-muted-foreground uppercase">
                        .{cert.fileExtension || 'file'}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Calendar size={14} className="opacity-50" />
                        {cert.expiryDate}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <p className="text-sm text-muted-foreground italic truncate max-w-[200px]">
                        {cert.note || "-"}
                      </p>
                    </TableCell>
                    <TableCell className="px-8 py-5 text-right">
                      <Button 
                        onClick={() => handleDownload(cert.fileUrl, cert.fileName)}
                        className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-6 rounded-xl gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                      >
                        <Download size={16} /> DOWNLOAD
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Label({ value, icon }: { value: string, icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-2">
      {icon} {value}
    </div>
  );
}
