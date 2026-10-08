'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, onSnapshot } from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  ChevronLeft, FileText, Truck, Package, Calendar, Hash, User, Thermometer, Weight, Layers, ShieldCheck, MapPin
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Pallet {
  palletNumber: number;
  productionOutputId: string;
  productVariety: string;
  size: string;
  class: string;
  packaging: string;
  numberOfBoxes: string;
  palletBarcode: string;
  labelConformity: string;
  temperature: string;
  sampleWeight: string;
  boxNetWeight: string;
  lotNumber: string;
  palletisation: string;
  countryOfOrigin: string;
  images: string[];
}

interface QualityReport {
  id: string;
  orderId: string;
  poNumber: string;
  customerName: string;
  sender: string;
  transport: string;
  transportNumber: string;
  product: string;
  date: string;
  pallets: Pallet[];
  totalPallets: number;
  createdAt: any;
  createdBy: string;
}

export default function ViewQualityReportPage() {
  const router = useRouter();
  const params = useParams();
  const db = useFirestore();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QualityReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !params.id) return;

    const docRef = doc(db, 'quality_reports', params.id as string);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setData({ id: docSnap.id, ...docSnap.data() } as QualityReport);
      } else {
        setError('Quality report not found.');
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('Failed to fetch quality report details.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, params.id]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-12 w-96 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-4">
        <h2 className="text-xl font-bold text-rose-600">Error</h2>
        <p className="text-muted-foreground">{error || 'Something went wrong.'}</p>
        <Button onClick={() => router.push('/quality/reports')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-6 h-11">
          Back to Reports
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/quality/reports')} className="rounded-full hover:bg-primary/5">
            <ChevronLeft className="h-5 w-5 text-emerald-700" />
          </Button>
          <div>
            <nav className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 mb-1">
              Quality / Quality Reports / <span className="text-primary">View Report</span>
            </nav>
            <h1 className="text-2xl font-black text-primary uppercase tracking-tight flex items-center gap-2">
              Report: {data.poNumber || '—'}
            </h1>
          </div>
        </div>

        <Button
          onClick={() => router.push(`/quality/reports/${data.id}/edit`)}
          className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105"
        >
          Edit Report
        </Button>
      </div>

      {/* Header Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Card: Order info */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-primary/5 pb-4 border-b border-primary/5">
            <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest">
              <FileText size={14} /> Order Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Order PO Number</span>
                <span className="font-bold text-sm text-primary">{data.poNumber || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Customer</span>
                <span className="font-bold text-sm text-primary uppercase">{data.customerName || '—'}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Transport Number</span>
              <span className="font-bold text-sm text-primary">{data.transportNumber || '—'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Right Card: Logistics */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-primary/5 pb-4 border-b border-primary/5">
            <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest">
              <Truck size={14} /> Logistics details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Sender</span>
                <span className="font-bold text-sm text-primary">{data.sender || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Transport Method</span>
                <span className="font-bold text-sm text-primary uppercase">{data.transport || '—'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Product</span>
                <span className="font-bold text-sm text-primary uppercase">{data.product || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Report Date</span>
                <span className="font-bold text-sm text-primary">{data.date || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pallets List */}
      <div className="space-y-6">
        <h3 className="text-lg font-black text-primary uppercase tracking-tight">Pallets Checklist ({data.pallets?.length || 0})</h3>
        
        {data.pallets?.map((pallet, idx) => (
          <Card key={idx} className="border-none shadow-md rounded-3xl overflow-hidden bg-white">
            <div className="bg-primary px-6 py-4 flex items-center gap-3">
              <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center">
                <span className="font-black text-white text-xs">{idx + 1}</span>
              </div>
              <span className="font-black text-white uppercase tracking-widest text-xs">Pallet #{pallet.palletNumber || idx + 1}</span>
            </div>
            
            <CardContent className="p-6 space-y-6">
              {/* Fields grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Product / Variety</span>
                  <span className="font-bold text-sm text-primary uppercase">{pallet.productVariety || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Size</span>
                  <span className="font-bold text-sm text-primary uppercase">{pallet.size || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Class</span>
                  <span className="font-bold text-sm text-primary uppercase">{pallet.class || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Packaging</span>
                  <span className="font-bold text-sm text-primary uppercase">{pallet.packaging || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Number of Boxes</span>
                  <span className="font-bold text-sm text-primary">{pallet.numberOfBoxes || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Pallet Barcode</span>
                  <span className="font-mono text-xs font-bold text-primary">{pallet.palletBarcode || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Label Conformity</span>
                  <span className={`inline-block text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${pallet.labelConformity === 'CONFORM' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {pallet.labelConformity || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Temperature</span>
                  <span className="font-bold text-sm text-primary">{pallet.temperature ? `${pallet.temperature}°C` : '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Sample Weight</span>
                  <span className="font-bold text-sm text-primary">{pallet.sampleWeight ? `${pallet.sampleWeight}g` : '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Box Net Weight</span>
                  <span className="font-bold text-sm text-primary">{pallet.boxNetWeight ? `${pallet.boxNetWeight}g` : '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Lot Number</span>
                  <span className="font-mono text-xs font-bold text-primary">{pallet.lotNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Palletisation</span>
                  <span className="font-bold text-sm text-primary uppercase">{pallet.palletisation || '—'}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Country of Origin</span>
                  <span className="font-bold text-sm text-primary uppercase">{pallet.countryOfOrigin || '—'}</span>
                </div>
              </div>

              {/* Images grid */}
              <div className="space-y-3">
                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-wider block">Photos / Evidence ({pallet.images?.length || 0}/6)</span>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => {
                    const visualGuidance = [
                      "1. Label image",
                      "2. Logo image",
                      "3. Front pallet",
                      "4. Back pallet",
                      "5. Side pallet",
                      "6. Additional image"
                    ];
                    
                    const hasImage = pallet.images && i < pallet.images.length;
                    const src = hasImage ? pallet.images[i] : null;

                    if (hasImage && src) {
                      return (
                        <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-primary/10 flex flex-col justify-end bg-muted/5 group/img cursor-pointer" onClick={() => window.open(src, '_blank')}>
                          <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                          <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[8px] font-black text-white/90 truncate text-center uppercase tracking-wider">
                            {visualGuidance[i]}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div key={i} className="aspect-square rounded-2xl border border-dashed border-primary/10 bg-muted/5 flex flex-col items-center justify-center p-3 text-center">
                          <span className="text-[9px] font-black uppercase text-primary/20 leading-tight">
                            {visualGuidance[i]}
                          </span>
                          <span className="text-[8px] text-muted-foreground/30 font-bold mt-1 uppercase">MISSING</span>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
