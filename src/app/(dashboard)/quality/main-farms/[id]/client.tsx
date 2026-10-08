'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, onSnapshot } from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Edit, 
  ChevronLeft, 
  Building2, 
  MapPin, 
  Wheat, 
  Scale, 
  Hash, 
  Tag, 
  ShieldCheck, 
  Download, 
  FileText, 
  ExternalLink,
  Copy,
  Check,
  Calendar,
  UserCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Certificate {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileExtension?: string;
  expiryDate: string;
  note?: string;
}

interface MainFarm {
  id: string;
  name: string;
  ggnNumber: string;
  gpsLocation: string;
  farmSize: number;
  estimatedCrops: number;
  farmCodification: string;
  certificates: Certificate[];
  createdAt: any;
  createdBy: string;
  createdByDisplayName?: string;
}

export default function ViewMainFarmPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [data, setData] = useState<MainFarm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const farmId = params?.id;

  useEffect(() => {
    if (!db || !farmId) return;

    const docRef = doc(db, 'main_farms', farmId);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const farmData = { id: docSnap.id, ...docSnap.data() } as MainFarm;
        setData(farmData);
      } else {
        setError("Main farm not found.");
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Failed to fetch farm data.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, farmId]);

  const handleDownload = (url: string, fileName: string) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'certificate.pdf';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyGGN = (val: string) => {
    if (!val || val === '-') return;
    navigator.clipboard.writeText(val);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied", description: "GGN Number copied to clipboard." });
  };

  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto font-sans">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-12 max-w-md mx-auto font-sans text-center space-y-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs mt-12">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">{error || "Farm not found."}</h2>
        <Button onClick={() => router.push('/quality/main-farms')} variant="outline" className="rounded-xl">
          Back to Main Farms
        </Button>
      </div>
    );
  }

  const hasCoordinates = data.gpsLocation && data.gpsLocation !== '-' && data.gpsLocation.includes(',');

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto font-sans">
      {/* Header section with Breadcrumbs & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
            <Link href="/profile" className="hover:text-slate-600 transition-colors">Profile</Link>
            <span>/</span>
            <Link href="/quality/main-farms" className="hover:text-slate-600 transition-colors">Main Farms</Link>
            <span>/</span>
            <span className="text-slate-700 font-semibold">View Main Farms</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
            Main Farms View
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => router.push('/quality/main-farms')}
            className="h-10 px-4 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold gap-2 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Back</span>
          </Button>

          <Button
            onClick={() => router.push(`/quality/main-farms/${farmId}/edit`)}
            className="h-10 px-5 rounded-xl bg-[#193A7B] hover:bg-[#132d61] text-white text-xs font-semibold gap-2 shadow-sm shadow-[#193A7B]/20 transition-all hover:shadow-md cursor-pointer"
          >
            <Edit className="w-4 h-4" />
            <span>Edit Farm</span>
          </Button>
        </div>
      </div>

      {/* Hero Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#193A7B] to-[#0284C7] text-white flex items-center justify-center font-bold text-xl shadow-md shadow-[#193A7B]/15">
              {data.name.charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{data.name}</h2>
                {data.farmCodification && data.farmCodification !== '-' && (
                  <Badge variant="outline" className="font-bold text-xs bg-slate-100 border-slate-200 text-slate-700 uppercase">
                    {data.farmCodification}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                {hasCoordinates ? (
                  <a
                    href={`https://www.google.com/maps?q=${encodeURIComponent(data.gpsLocation)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:underline font-medium"
                  >
                    <MapPin className="w-3.5 h-3.5 text-rose-500" />
                    <span>{data.gpsLocation}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="flex items-center gap-1 text-slate-400">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{data.gpsLocation || 'No GPS coordinates'}</span>
                  </span>
                )}
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-500">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Managed by {data.createdByDisplayName || data.createdBy || 'Zakariaa El Yamlahi'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick GGN Badge */}
          {data.ggnNumber && data.ggnNumber !== '-' && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 self-start md:self-auto">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">GlobalG.A.P. GGN</span>
                <span className="font-mono font-bold text-sm text-slate-800">{data.ggnNumber}</span>
              </div>
              <button
                onClick={() => copyGGN(data.ggnNumber)}
                className="w-8 h-8 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                title="Copy GGN"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>

        {/* Detailed Metrics Grid */}
        <div className="pt-6">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Main Farms Details</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Farm Size</span>
                <Wheat className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                {data.farmSize ? data.farmSize.toLocaleString() : '-'}
              </div>
              <span className="text-[11px] font-medium text-slate-500">Hectares total area</span>
            </div>

            <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Estimated Crops</span>
                <Scale className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                {data.estimatedCrops ? data.estimatedCrops.toLocaleString() : '-'}
              </div>
              <span className="text-[11px] font-medium text-slate-500">Tonnes expected yield</span>
            </div>

            <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Codification</span>
                <Tag className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xl font-bold text-slate-900 font-mono">
                {data.farmCodification || '-'}
              </div>
              <span className="text-[11px] font-medium text-slate-500">Internal farm code</span>
            </div>

            <div className="bg-slate-50/60 rounded-xl p-4 border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500">Certificates</span>
                <ShieldCheck className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                {data.certificates?.length || 0}
              </div>
              <span className="text-[11px] font-medium text-slate-500">Registered documents</span>
            </div>
          </div>
        </div>
      </div>

      {/* Farm Certificates Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Farm Certificates</h3>
              <p className="text-xs text-slate-400">Compliance accreditations and valid certification audits</p>
            </div>
          </div>

          <Badge variant="outline" className="bg-white border-slate-200 text-slate-700 font-semibold px-3 py-1">
            {data.certificates?.length || 0} Documents
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50 border-b border-slate-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="py-3.5 pl-6 text-xs font-semibold text-slate-600">File Name</TableHead>
                <TableHead className="py-3.5 text-xs font-semibold text-slate-600">File Type</TableHead>
                <TableHead className="py-3.5 text-xs font-semibold text-slate-600">File Extension</TableHead>
                <TableHead className="py-3.5 text-xs font-semibold text-slate-600">Expire Date</TableHead>
                <TableHead className="py-3.5 text-xs font-semibold text-slate-600">Note</TableHead>
                <TableHead className="py-3.5 pr-6 text-right text-xs font-semibold text-slate-600">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {!data.certificates || data.certificates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-xs text-slate-400 italic">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <FileText className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-600">No certificates attached</p>
                      <p className="text-slate-400">Use Edit Farm to upload Global GAP, BRC, or other documentation.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.certificates.map((cert, index) => (
                  <TableRow key={index} className="border-b border-slate-100 text-xs text-slate-700 hover:bg-slate-50/60">
                    {/* File Name */}
                    <TableCell className="py-4 pl-6 font-semibold text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>{cert.fileName || '-'}</span>
                      </div>
                    </TableCell>

                    {/* File Type */}
                    <TableCell className="py-4">
                      <Badge variant="outline" className="font-bold text-[10px] bg-blue-50/60 border-blue-200/60 text-blue-700">
                        {cert.fileType || 'Document'}
                      </Badge>
                    </TableCell>

                    {/* File Extension */}
                    <TableCell className="py-4 font-mono text-[11px] text-slate-500 uppercase">
                      {cert.fileExtension || 'PDF'}
                    </TableCell>

                    {/* Expire Date */}
                    <TableCell className="py-4 font-medium text-slate-700">
                      {cert.expiryDate ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cert.expiryDate}</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>

                    {/* Note */}
                    <TableCell className="py-4 text-slate-600">
                      {cert.note ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-medium">
                          {cert.note}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>

                    {/* Download Action */}
                    <TableCell className="py-4 pr-6 text-right">
                      {cert.fileUrl ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(cert.fileUrl, `${cert.fileName}.${cert.fileExtension || 'pdf'}`)}
                          className="h-8 px-3 rounded-lg border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                          <span>Download</span>
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
