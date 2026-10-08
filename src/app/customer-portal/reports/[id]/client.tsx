'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, onSnapshot } from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';
import { useCustomerAuth } from '@/components/customer-auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { generateQualityReportPDF } from '@/lib/export-quality-report-pdf';
import {
  ChevronLeft,
  Download,
  Printer,
  Eye,
  X,
  Truck,
  Package,
  FileText,
  Hash,
  User,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Thermometer,
  Weight,
  Layers,
  Globe,
  Barcode,
  Building2,
  Sparkles
} from 'lucide-react';

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
  ref?: string;
  status?: string;
}

const PHOTO_LABELS = [
  '1. Label Image',
  '2. Logo Image',
  '3. Front Pallet',
  '4. Back Pallet',
  '5. Side Pallet',
  '6. Additional Evidence'
];

export default function CustomerViewQualityReportPage() {
  const router = useRouter();
  const params = useParams();
  const db = useFirestore();
  const { customer, loading: authLoading } = useCustomerAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QualityReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  // Lightbox Modal state
  const [activeImage, setActiveImage] = useState<{ url: string; label: string; palletIndex: number } | null>(null);

  const reportId = params?.id as string | undefined;

  useEffect(() => {
    if (!db || !reportId) return;

    const docRef = doc(db, 'quality_reports', reportId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const reportData = { id: docSnap.id, ...docSnap.data() } as QualityReport;
        const statusLower = (reportData.status || '').toLowerCase();
        const isApproved = statusLower === 'approved' || (reportData as any).isApproved === true;
        if (!isApproved) {
          setError('This Quality Report has not been approved yet.');
          setData(null);
        } else {
          setData(reportData);
        }
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
  }, [db, reportId]);

  const handleDownloadPDF = async () => {
    if (!data) return;
    try {
      setDownloadingPDF(true);
      await generateQualityReportPDF(data);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (authLoading || loading) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-pulse">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-12 max-w-md mx-auto text-center space-y-6">
        <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">Report Unavailable</h2>
          <p className="text-sm text-slate-500">{error || 'Unable to locate the requested quality report.'}</p>
        </div>
        <Button onClick={() => router.push('/customer-portal/reports')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl px-8 h-12 shadow-lg shadow-emerald-600/20">
          Back to Quality Reports
        </Button>
      </div>
    );
  }

  const reportRefCode = data.ref || data.id?.substring(0, 8).toUpperCase() || '—';
  const totalPalletsCount = data.pallets?.length || data.totalPallets || 0;

  return (
    <div className="p-4 sm:p-6 md:p-10 max-w-6xl mx-auto space-y-8 pb-28 animate-in fade-in duration-500">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div className="flex items-start sm:items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/customer-portal/reports')}
            className="rounded-full bg-white shadow-sm border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all shrink-0 mt-0.5 sm:mt-0"
          >
            <ChevronLeft className="h-5 w-5 text-slate-700" />
          </Button>
          <div>
            <nav className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 flex items-center gap-2">
              <span>Portal</span>
              <span className="text-slate-300">/</span>
              <span>Quality Reports</span>
              <span className="text-slate-300">/</span>
              <span className="text-emerald-700 font-extrabold">{reportRefCode}</span>
            </nav>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
              Quality Inspection
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200/60 uppercase tracking-wider">
                {data.status || 'FINALISED'}
              </span>
            </h1>
          </div>
        </div>

        {/* Export / Print Actions */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="h-11 px-4 rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs gap-2 shadow-sm"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Print</span>
          </Button>
          <Button
            onClick={handleDownloadPDF}
            disabled={downloadingPDF}
            className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] gap-2"
          >
            <Download className="h-4 w-4" />
            {downloadingPDF ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* Main Farm & Brand Banner Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl border border-emerald-900/30">
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Logo container */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/95 rounded-2xl p-3 shadow-lg flex items-center justify-center shrink-0 border border-white/20">
              <img
                src="/FFI_main.png"
                alt="Export Optimum"
                className="w-full h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest mb-1">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Export Optimum Outbound Audit</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-wide text-white uppercase">
                OUTBOUND QUALITY REPORT
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm font-medium mt-1">
                Comprehensive quality audit report for outbound shipment PO #{data.poNumber || '—'}
              </p>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap sm:flex-nowrap gap-3 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-xs shrink-0 w-full md:w-auto justify-around sm:justify-start">
            <div className="text-center px-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">Total Pallets</span>
              <span className="text-lg font-black text-emerald-400">{totalPalletsCount}</span>
            </div>
            <div className="w-px bg-white/15 h-8 self-center" />
            <div className="text-center px-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">Report Date</span>
              <span className="text-sm font-bold text-white mt-1 block">{data.date || '—'}</span>
            </div>
            <div className="w-px bg-white/15 h-8 self-center" />
            <div className="text-center px-3">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">REF Code</span>
              <span className="text-sm font-mono font-bold text-emerald-300 mt-1 block">{reportRefCode}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Shipment & Order Metadata Section */}
      <div className="space-y-4">
        <h3 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <FileText className="h-5 w-5 text-emerald-600" />
          Shipment & Order Details
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Customer & PO Info */}
          <Card className="border border-slate-200/80 shadow-sm rounded-3xl bg-white overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-100">
              <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" />
                Customer & Order Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 divide-y divide-slate-100">
              <div className="pb-4 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500">Customer Name</span>
                <span className="font-bold text-sm text-slate-900 uppercase">{data.customerName || customer?.companyName || '—'}</span>
              </div>
              <div className="py-4 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500">Order PO Number</span>
                <span className="font-bold text-sm text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                  {data.poNumber || '—'}
                </span>
              </div>
              <div className="py-4 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500">Report Reference</span>
                <span className="font-mono font-bold text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                  {reportRefCode}
                </span>
              </div>
              <div className="pt-4 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500">Auditor / Creator</span>
                <span className="font-medium text-xs text-slate-600">{data.createdBy || 'Quality Control Team'}</span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Logistics & Transport Info */}
          <Card className="border border-slate-200/80 shadow-sm rounded-3xl bg-white overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="bg-slate-50/80 px-6 py-4 border-b border-slate-100">
              <CardTitle className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Truck className="h-4 w-4 text-emerald-600" />
                Logistics & Transport Parameters
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 divide-y divide-slate-100">
              <div className="pb-4 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500">Product Line</span>
                <span className="font-bold text-sm text-slate-900 uppercase">{data.product || 'Avocado Hass'}</span>
              </div>
              <div className="py-4 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500">Sender / Packing Facility</span>
                <span className="font-bold text-sm text-slate-900">{data.sender || 'Export Optimum Station'}</span>
              </div>
              <div className="py-4 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500">Transport Method</span>
                <span className="font-bold text-xs text-slate-800 uppercase bg-slate-100 px-3 py-1 rounded-lg">
                  {data.transport || 'Reefer Truck'}
                </span>
              </div>
              <div className="pt-4 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500">Transport Registration #</span>
                <span className="font-mono font-bold text-sm text-emerald-800">
                  {data.transportNumber || '—'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pallets Detailed Inspection Checklist */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Package className="h-5 w-5 text-emerald-600" />
              Pallets Audit Checklist
            </h3>
            <p className="text-xs text-slate-500">
              Detailed inspection data, measurement parameters, and photo evidence per pallet.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full self-start sm:self-auto">
            {totalPalletsCount} Pallet{totalPalletsCount !== 1 ? 's' : ''} Inspected
          </span>
        </div>

        {data.pallets && data.pallets.length > 0 ? (
          <div className="space-y-8">
            {data.pallets.map((pallet, idx) => {
              const isConform = pallet.labelConformity?.toUpperCase() === 'CONFORM';
              const palletImages = pallet.images || [];

              return (
                <Card
                  key={idx}
                  className="border border-slate-200/90 shadow-md rounded-3xl overflow-hidden bg-white hover:shadow-lg transition-all duration-300"
                >
                  {/* Pallet Header Bar */}
                  <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                        #{pallet.palletNumber || idx + 1}
                      </div>
                      <div>
                        <span className="font-black uppercase tracking-widest text-sm text-white">
                          Pallet #{pallet.palletNumber || idx + 1}
                        </span>
                        {pallet.palletBarcode && (
                          <span className="font-mono text-[11px] text-emerald-400 block font-semibold">
                            {pallet.palletBarcode}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Conformity Badge */}
                      <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${
                        isConform
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {isConform ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
                        <span>{pallet.labelConformity || 'CONFORM'}</span>
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-6 sm:p-8 space-y-8">
                    {/* Quality & Specifications Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {[
                        { label: 'Variety', value: pallet.productVariety, icon: Layers },
                        { label: 'Caliber / Size', value: pallet.size, icon: Package },
                        { label: 'Class', value: pallet.class, icon: ShieldCheck },
                        { label: 'Packaging', value: pallet.packaging, icon: Package },
                        { label: 'No. of Boxes', value: pallet.numberOfBoxes, icon: Hash },
                        { label: 'Lot Number', value: pallet.lotNumber, icon: Barcode },
                        { label: 'Temperature', value: pallet.temperature ? `${pallet.temperature}°C` : '—', icon: Thermometer },
                        { label: 'Sample Weight', value: pallet.sampleWeight ? `${pallet.sampleWeight}g` : '—', icon: Weight },
                        { label: 'Box Net Weight', value: pallet.boxNetWeight ? `${pallet.boxNetWeight}g` : '—', icon: Weight },
                        { label: 'Palletisation', value: pallet.palletisation, icon: Layers },
                        { label: 'Country of Origin', value: pallet.countryOfOrigin, icon: Globe },
                        { label: 'Label Conformity', value: pallet.labelConformity, icon: CheckCircle2 }
                      ].map((item, i) => {
                        const IconComponent = item.icon;
                        return (
                          <div key={i} className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100 space-y-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <IconComponent className="h-3 w-3 text-slate-400" />
                              {item.label}
                            </span>
                            <span className="font-bold text-xs sm:text-sm text-slate-900 uppercase block truncate">
                              {item.value || '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Inspection Photo Gallery */}
                    <div className="space-y-4 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                          <Eye className="h-4 w-4 text-emerald-600" />
                          Inspection Evidence Photos ({palletImages.filter(Boolean).length}/6)
                        </span>
                        <span className="text-[11px] text-slate-400 italic">Click any image to expand</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                        {PHOTO_LABELS.map((label, photoIdx) => {
                          const imageSrc = palletImages[photoIdx] || null;

                          if (imageSrc) {
                            return (
                              <div
                                key={photoIdx}
                                onClick={() => setActiveImage({ url: imageSrc, label, palletIndex: idx + 1 })}
                                className="group relative aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 cursor-pointer shadow-sm hover:shadow-md transition-all hover:scale-[1.03]"
                              >
                                <img
                                  src={imageSrc}
                                  alt={label}
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-95 group-hover:opacity-100"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-lg">
                                    <Eye className="h-4 w-4" />
                                  </div>
                                </div>
                                <div className="absolute bottom-2 inset-x-2 text-[9px] font-black text-white truncate text-center uppercase tracking-wider bg-black/40 backdrop-blur-md py-1 px-1.5 rounded-lg border border-white/10">
                                  {label}
                                </div>
                              </div>
                            );
                          } else {
                            return (
                              <div
                                key={photoIdx}
                                className="aspect-square rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-3 text-center"
                              >
                                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-300 flex items-center justify-center mb-1.5">
                                  <Package className="h-4 w-4" />
                                </div>
                                <span className="text-[9px] font-bold uppercase text-slate-400 leading-tight">
                                  {label}
                                </span>
                                <span className="text-[8px] text-slate-300 mt-0.5">Not attached</span>
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-8 space-y-3">
            <Package className="h-10 w-10 text-slate-300 mx-auto" />
            <h4 className="font-bold text-slate-700 text-sm">No Pallet Inspection Data</h4>
            <p className="text-xs text-slate-400">There are no pallet details recorded for this quality report yet.</p>
          </div>
        )}
      </div>

      {/* High-Resolution Photo Lightbox Modal */}
      {activeImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setActiveImage(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950 flex items-center justify-between border-b border-slate-800 text-white">
              <div>
                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest block">
                  Pallet #{activeImage.palletIndex}
                </span>
                <h4 className="text-sm font-bold text-slate-200">{activeImage.label}</h4>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveImage(null)}
                className="rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Modal Image Display */}
            <div className="p-4 sm:p-6 flex items-center justify-center max-h-[75vh]">
              <img
                src={activeImage.url}
                alt={activeImage.label}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-2xl shadow-xl border border-slate-800"
              />
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Quality Inspection Photo Evidence</span>
              <Button
                size="sm"
                onClick={() => window.open(activeImage.url, '_blank')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs gap-1.5"
              >
                <Eye className="h-3.5 w-3.5" />
                Open Full Resolution
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
