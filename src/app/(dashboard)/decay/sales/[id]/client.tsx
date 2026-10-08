'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  doc,
  getDoc,
  updateDoc
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useUser 
} from '@/firebase';
import { generateDecaySalePDF } from '@/lib/export-decay-sale-pdf';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  ChevronLeft, 
  Loader2,
  CalendarDays,
  User,
  FileText,
  DollarSign,
  Download,
  Info,
  Layers,
  CheckCircle,
  Clock
} from 'lucide-react';

export default function ViewDecaySalePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // --- Document States ---
  const [record, setRecord] = useState<any>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // --- Fetch Data ---
  useEffect(() => {
    if (!db || !id) return;
    const fetchRecord = async () => {
      try {
        const docRef = doc(db, 'decay_loadings', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setRecord({
            id: docSnap.id,
            ...docSnap.data()
          });
        } else {
          toast({ title: 'Error', description: 'Decay sale not found.', variant: 'destructive' });
          router.push('/decay/sales');
        }
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to fetch invoice details.', variant: 'destructive' });
      } finally {
        setIsFetching(false);
      }
    };
    fetchRecord();
  }, [db, id, router, toast]);

  // Helper: Deterministic Invoice Number
  const invoiceNumber = useMemo(() => {
    if (!record) return '';
    if (record.invoiceNumber) return record.invoiceNumber;
    const dateStr = record.date ? record.date.split('-').reverse().join('') : '00000000';
    const idHash = record.id ? record.id.slice(-8) : '00000000';
    return `PP${dateStr}-${idHash}`;
  }, [record]);

  // Calculate sum quantity
  const totalQuantity = useMemo(() => {
    if (!record || !record.items) return 0;
    return record.items.reduce((sum: number, i: any) => sum + Number(i.netWeight || 0), 0);
  }, [record]);

  // Toggle Payment Status
  const handleTogglePaymentStatus = async () => {
    if (!db || !record || !id || !user) return;
    setIsUpdatingStatus(true);
    try {
      const nextStatus = record.paymentStatus === 'PAID' ? 'PENDING' : 'PAID';
      await updateDoc(doc(db, 'decay_loadings', id), {
        paymentStatus: nextStatus,
        updated_at: new Date(),
        updated_by: user.email || 'unknown'
      });
      setRecord((prev: any) => ({ ...prev, paymentStatus: nextStatus }));
      toast({ title: 'Success', description: `Invoice payment marked as ${nextStatus}.` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to update payment status.', variant: 'destructive' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isFetching) {
    return (
      <div className="w-full h-screen flex flex-col items-center justify-center gap-3 bg-[#F8F9FB]">
        <Loader2 className="h-8 w-8 animate-spin text-[#7a9800]" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading invoice details...</p>
      </div>
    );
  }

  if (!record) return null;

  return (
    <div className={cn(
      "w-full bg-[#f3f3f3] min-h-screen transition-all duration-300 print:bg-white print:p-0 p-6 lg:p-8"
    )}>
      
      {/* ----------------- INTERFACE ----------------- */}
      <div className="print:hidden max-w-[1000px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.push('/decay/sales')} 
              className="rounded-full h-10 w-10 hover:bg-slate-200"
            >
              <ChevronLeft size={20} className="text-slate-600" />
            </Button>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                <span>Profile</span><span className="opacity-40">/</span>
                <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/decay/sales')}>Decay Sale</span><span className="opacity-40">/</span>
                <span className="text-[#7a9800]">View Decay Sale</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-[#2e1d52] uppercase">Decay Sale</h1>
            </div>
          </div>

          <Button 
            onClick={() => generateDecaySalePDF(record, invoiceNumber)}
            className="h-12 px-6 bg-[#7a9800] hover:bg-[#6c8500] text-white font-black uppercase text-xs tracking-widest rounded-xl shadow-lg shadow-[#7a9800]/20 flex items-center gap-2"
          >
            <Download size={16} /> Download Invoice
          </Button>
        </div>

        {/* Info Card */}
        <div className="bg-white p-6 md:p-8 rounded-[1.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 rounded-bl-full -z-10" />
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <Info className="h-5 w-5 text-slate-500" />
              </div>
              <h2 className="text-sm font-black text-[#2e1d52] uppercase tracking-[0.1em]">View Decay Sale Info</h2>
            </div>
            
            <Button
              variant="outline"
              disabled={isUpdatingStatus}
              onClick={handleTogglePaymentStatus}
              className={cn(
                "h-9 px-4 rounded-lg font-black text-[10px] uppercase tracking-wider gap-2",
                record.paymentStatus === 'PAID' 
                  ? "border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100" 
                  : "border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100"
              )}
            >
              {isUpdatingStatus ? (
                <Loader2 size={12} className="animate-spin" />
              ) : record.paymentStatus === 'PAID' ? (
                <CheckCircle size={12} />
              ) : (
                <Clock size={12} />
              )}
              {record.paymentStatus || 'PENDING'}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Layers size={14} /> Invoice Number</Label>
              <div className="font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs">
                {invoiceNumber}
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><CalendarDays size={14} /> Date</Label>
              <div className="font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs">
                {record.date || '—'}
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><User size={14} /> Customer</Label>
              <div className="font-black text-[#2e1d52] bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs">
                {record.customerName || '—'}
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><DollarSign size={14} /> Total Amount</Label>
              <div className="font-black text-[#7a9800] bg-[#7a9800]/5 border border-[#7a9800]/10 rounded-xl px-4 py-2.5 text-xs">
                {Number(record.totalAmount || 0).toLocaleString()} <span className="text-[9px] uppercase">dh</span>
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">Payment Method</Label>
              <div className="font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs">
                {record.paymentMethod || '—'}
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">Payment Status</Label>
              <div className={cn(
                "font-black rounded-xl px-4 py-2.5 text-xs border",
                record.paymentStatus === 'PAID' 
                  ? "bg-emerald-50 border-emerald-100 text-emerald-600" 
                  : "bg-amber-50 border-amber-100 text-amber-600"
              )}>
                {record.paymentStatus || 'PENDING'}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><FileText size={14} /> Note</Label>
              <div className="font-medium text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs truncate" title={record.note}>
                {record.note || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden">
          <div className="p-4 md:p-6 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#7a9800]/10 flex items-center justify-center">
              <Layers className="h-4 w-4 text-[#7a9800]" />
            </div>
            <h2 className="text-xs font-black text-[#2e1d52] uppercase tracking-[0.1em]">Items Detail</h2>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/30 border-b border-slate-100">
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Product</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Price</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Quantity</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {record.items?.map((item: any) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-none">
                    <td className="py-4 px-6 font-bold text-slate-700">{item.productName}</td>
                    <td className="py-4 px-6 text-right font-black text-slate-600">{Number(item.price || 0).toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">dh/kg</span></td>
                    <td className="py-4 px-6 text-right font-black text-slate-700">{Number(item.netWeight || 0).toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">kg</span></td>
                    <td className="py-4 px-6 text-right font-black text-[#7a9800]">{(Number(item.netWeight || 0) * Number(item.price || 0)).toLocaleString()} <span className="text-[9px] text-slate-400 font-bold uppercase">dh</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ----------------- PRINT LAYOUT (INVOICE TEMPLATE) ----------------- */}
      <div className="hidden print:block w-full max-w-[800px] mx-auto p-6 text-black bg-white select-none">
        
        {/* Invoice Logo & Header */}
        <div className="flex justify-between items-start border-b border-gray-300 pb-6 mb-8">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-widest text-[#7a9800]">Export Optimum</h1>
            <p className="text-[10px] text-gray-500 mt-1">Export de Fruits et Légumes</p>
            <p className="text-[10px] text-gray-500">Route de Marrakech, Agadir, Maroc</p>
            <p className="text-[10px] text-gray-500">ICE: 001524389000054</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-black uppercase text-gray-700 tracking-tight">Facture vente dechet</h2>
            <p className="text-xs font-bold text-gray-500 uppercase mt-1">FACTURE DE VENDE DÉCHETS</p>
          </div>
        </div>

        {/* Invoice Metadata */}
        <div className="grid grid-cols-2 gap-8 mb-8 text-xs">
          <div>
            <h3 className="font-bold text-gray-400 uppercase tracking-wider mb-2">Informations Facture</h3>
            <p className="mb-1"><span className="font-semibold text-gray-500">N° Facture:</span> <span className="font-black text-gray-800">{invoiceNumber}</span></p>
            <p className="mb-1"><span className="font-semibold text-gray-500">Date:</span> <span className="font-bold text-gray-800">{record.date || '—'}</span></p>
            <p className="mb-1"><span className="font-semibold text-gray-500">Mode Paiement:</span> <span className="font-bold text-gray-800">{record.paymentMethod || '—'}</span></p>
          </div>
          <div>
            <h3 className="font-bold text-gray-400 uppercase tracking-wider mb-2">Client</h3>
            <p className="font-black text-sm text-[#2e1d52]">{record.customerName || '—'}</p>
            <p className="text-gray-500 mt-1">Client Local Déchets</p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse text-[10px] mb-8 border border-gray-200">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="border border-gray-200 p-2.5 text-center w-12">Code</th>
              <th className="border border-gray-200 p-2.5 text-left">Produit</th>
              <th className="border border-gray-200 p-2.5 text-right w-28">Prix dh/kg</th>
              <th className="border border-gray-200 p-2.5 text-right w-28">Quantité (kg)</th>
              <th className="border border-gray-200 p-2.5 text-right w-32">Montant</th>
            </tr>
          </thead>
          <tbody>
            {record.items?.map((item: any, idx: number) => {
              const itemTotal = Number(item.netWeight || 0) * Number(item.price || 0);
              return (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="border border-gray-200 p-2.5 text-center text-gray-500">{idx + 1}</td>
                  <td className="border border-gray-200 p-2.5 font-bold">{item.productName}</td>
                  <td className="border border-gray-200 p-2.5 text-right font-semibold">{Number(item.price || 0).toFixed(2)}</td>
                  <td className="border border-gray-200 p-2.5 text-right font-semibold">{Number(item.netWeight || 0).toLocaleString()}</td>
                  <td className="border border-gray-200 p-2.5 text-right font-black">{itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} dh</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals & Signature */}
        <div className="grid grid-cols-2 gap-8 items-start mt-6">
          <div className="border border-gray-200 p-4 rounded-xl text-[10px] space-y-1 text-gray-600">
            <span className="font-bold uppercase tracking-wider text-gray-400 block mb-1">Note de Facture</span>
            <p className="leading-relaxed">{record.note || 'Aucune note pour cette facture.'}</p>
          </div>
          <div className="border border-gray-200 p-4 rounded-xl space-y-2.5 text-xs w-full max-w-[320px] ml-auto">
            <div className="flex justify-between font-semibold">
              <span className="text-gray-400">Total Quantité:</span>
              <span className="text-gray-800">{totalQuantity.toLocaleString()} kg</span>
            </div>
            <div className="flex justify-between font-black text-sm border-t border-gray-100 pt-2 text-[#7a9800]">
              <span>Montant Totale:</span>
              <span>{Number(record.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} dh</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-[9px] text-gray-400 border-t border-gray-100 pt-4">
          <p>Export Optimum - Agadir, Souss-Massa, Maroc</p>
          <p className="mt-0.5">Merci de votre confiance.</p>
        </div>

      </div>

    </div>
  );
}
