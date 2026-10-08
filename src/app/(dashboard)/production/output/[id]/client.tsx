'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { doc, getDoc, collection, getDocs } from '@/firebase/firestore-override';
import { generateProductionOutputPDF } from '@/lib/export-production-output-pdf';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ChevronLeft, Package, Edit2, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ViewProductionOutputPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [outputData, setOutputData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      if (!db || !id) return;
      try {
        const docRef = doc(db, 'production_output', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setOutputData({ id: snap.id, ...snap.data() });
        } else {
          toast({ variant: "destructive", title: "Error", description: "Record not found" });
          router.push('/production/output');
        }

        const productsSnap = await getDocs(collection(db, 'products'));
        setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Failed to load record" });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [db, id, router, toast]);

  const handleDownloadPDF = async () => {
    if (!outputData) return;
    try {
      const processedItems = outputData.items?.map((item: any) => {
        const p = products.find(prod => prod.id === item.productId);
        return {
          ...item,
          productName: item.productName || p?.productName || 'Unknown',
          variety: item.variety || p?.variety || p?.category || 'Unknown',
          category: p?.category || '',
          type: p?.type || ''
        };
      }) || [];

      const pdfData = {
        ...outputData,
        items: processedItems
      };
      
      await generateProductionOutputPDF(pdfData);
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate PDF.",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (!outputData) return null;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/production/output')}
            className="rounded-full hover:bg-primary/5 text-primary/40 hover:text-primary transition-all"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="space-y-1">
            <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40" aria-label="Breadcrumb">
              <ol className="inline-flex items-center space-x-2">
                <li>Profile</li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  Production Output
                </li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  <span className="text-primary/60 font-black uppercase">View Pallet</span>
                </li>
              </ol>
            </nav>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Pallet Details</h1>
              <div className="px-3 py-1 bg-muted/30 rounded-lg text-sm font-bold flex items-center gap-2">
                <Package className="h-4 w-4 text-indigo-500" />
                {outputData.barcode || outputData.id?.slice(-6).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Card className="max-w-3xl rounded-[2rem] border-none shadow-xl bg-white overflow-hidden">
        <div className="bg-primary/[0.02] px-8 py-6 border-b border-primary/5">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">Information</h2>
        </div>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Location</p>
              <p className="font-bold text-primary text-lg">{outputData.locationName || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Date Time</p>
              <p className="font-bold text-primary text-lg">{outputData.dateTime || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Palletisation Type</p>
              <p className="font-bold text-primary text-lg">{outputData.palletisationType || '—'}</p>
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Shift</p>
              <p className="font-bold text-primary text-lg">{outputData.shift || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Shift Date</p>
              <p className="font-bold text-primary text-lg">{outputData.shiftDate || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Packaging Type</p>
              <p className="font-bold text-primary text-lg">{outputData.packagingTypeName || '—'}</p>
            </div>
            {outputData.tare !== undefined && outputData.tare !== null && (
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Tare (Kg)</p>
                <p className="font-bold text-primary text-lg">{outputData.tare} KG</p>
              </div>
            )}

            {outputData.palletisationType === 'Final product' && (
              <>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Order PO Number</p>
                  <p className="font-bold text-primary text-lg">{outputData.orderPoNumber || '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">GGN Number</p>
                  <p className="font-bold text-primary text-lg">{outputData.ggnNumber || '—'}</p>
                </div>
              </>
            )}

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Created By</p>
              <p className="font-bold text-primary text-lg">{outputData.createdByDisplayName || outputData.createdBy || '—'}</p>
            </div>

            {outputData.updatedBy && (
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Updated By</p>
                <p className="font-bold text-primary text-lg">{outputData.updatedByDisplayName || outputData.updatedBy || '—'}</p>
              </div>
            )}
            
            <div className="space-y-1 md:col-span-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Remark</p>
              <p className="font-bold text-primary text-lg">{outputData.remark || '—'}</p>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-primary/5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40 mb-6">Production Items</h3>
            <div className="overflow-x-auto rounded-xl border border-primary/5 bg-primary/[0.01]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-primary/5 bg-[#F8F7FF]">
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Product</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Lot Number</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Gross (KG)</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Net (KG)</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Boxes</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Caliber</th>
                  </tr>
                </thead>
                <tbody>
                  {outputData.items?.map((item: any, idx: number) => {
                    const productInfo = products.find(p => p.id === item.productId);
                    const prodName = item.productName || productInfo?.productName || 'Unknown';
                    const variety = item.variety || productInfo?.variety || productInfo?.category || 'Unknown';
                    return (
                      <tr key={idx} className="border-b border-primary/5 last:border-0 hover:bg-white transition-all">
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-primary text-sm">{prodName}</span>
                            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">{variety}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-sm text-primary/80">{item.lotNumber || outputData.lotNumber || '—'}</td>
                        <td className="px-4 py-3 font-bold text-sm text-primary/80">{item.grossWeight || 0}</td>
                        <td className="px-4 py-3 font-bold text-sm text-primary">{item.netWeight || 0}</td>
                        <td className="px-4 py-3 font-bold text-sm text-primary/80">{item.numberOfBoxes || 0}</td>
                        <td className="px-4 py-3 font-bold text-sm text-primary/80">{item.caliber || '—'}</td>
                      </tr>
                    );
                  })}
                  {!outputData.items?.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm font-bold text-muted-foreground">No items found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-12 pt-8 border-t border-primary/5">
            <Button 
              variant="outline" 
              onClick={() => router.push(`/production/output/${outputData.id}/edit`)}
              className="h-12 px-6 rounded-xl border-primary/10 font-bold hover:bg-primary/5 transition-all gap-2"
            >
              <Edit2 className="h-4 w-4" /> EDIT PALLET
            </Button>
            <Button 
              onClick={handleDownloadPDF}
              className="h-12 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all gap-2 shadow-lg shadow-indigo-600/20"
            >
              <Download className="h-4 w-4" /> DOWNLOAD PDF
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
