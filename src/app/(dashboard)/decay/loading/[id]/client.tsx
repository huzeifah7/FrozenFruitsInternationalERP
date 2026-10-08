'use client';

import React, { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  ChevronLeft, 
  Save, 
  Loader2,
  Info,
  Banknote,
  CalendarDays,
  User,
  Truck,
  FileText
} from 'lucide-react';

export default function DecayLoadingDetailsPage() {
  const router = useRouter();
  const { id } = useParams();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // --- Parent Data (Read-only) ---
  const [date, setDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [driverPlateNumber, setDriverPlateNumber] = useState('');
  const [note, setNote] = useState('');
  
  // --- Update Fields ---
  const [currency, setCurrency] = useState('MAD');
  const [paymentMethod, setPaymentMethod] = useState('Bank transfer');
  const [paymentStatus, setPaymentStatus] = useState('PENDING');
  
  // Items array
  const [items, setItems] = useState<any[]>([]);

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Fetch Data ---
  useEffect(() => {
    if (!db || !id) return;
    const fetchRecord = async () => {
      try {
        const docRef = doc(db, 'decay_loadings', id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDate(data.date || '');
          setCustomerName(data.customerName || '');
          setDriverPlateNumber(data.driverPlateNumber || '');
          setNote(data.note || '');
          
          setCurrency(data.currency || 'MAD');
          setPaymentMethod(data.paymentMethod || 'Bank transfer');
          setPaymentStatus(data.paymentStatus || 'PENDING');
          setItems(data.items || []);
        } else {
          toast({ title: 'Error', description: 'Decay loading not found.', variant: 'destructive' });
          router.push('/decay/loading');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchRecord();
  }, [db, id, router, toast]);

  // --- Item Handlers ---
  const handlePriceChange = (itemId: string, value: string) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, price: value === '' ? '' : Number(value) } : item
    ));
  };

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !id) return;

    setIsSubmitting(true);
    try {
      let documentTotal = 0;
      const updatedItems = items.map(item => {
        const price = Number(item.price || 0);
        const nw = Number(item.netWeight || 0);
        const lineTotal = nw * price;
        documentTotal += lineTotal;
        return {
          ...item,
          price,
          totalAmount: lineTotal
        };
      });

      const docRef = doc(db, 'decay_loadings', id as string);
      await updateDoc(docRef, {
        currency,
        paymentMethod,
        paymentStatus,
        items: updatedItems,
        totalAmount: documentTotal,
        updated_at: new Date(),
        updated_by: user.email || 'unknown'
      });

      toast({ title: 'Success', description: 'Decay loading price and billing updated successfully.' });
      router.push('/decay/loading');
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to update decay loading.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8F9FB]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#7a9800]" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 lg:p-8 max-w-[1200px] mx-auto animate-in fade-in duration-500 bg-[#F8F9FB] min-h-screen">
      
      {/* Header & Breadcrumb */}
      <div className="flex items-center gap-4 mb-8">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()} 
          className="rounded-full h-10 w-10 hover:bg-slate-200"
        >
          <ChevronLeft size={20} className="text-slate-600" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
            <span>Profile</span><span className="opacity-40">/</span>
            <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/decay/loading')}>Decay Loading</span><span className="opacity-40">/</span>
            <span className="text-[#7a9800]">Update Billing & Price</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#2e1d52] uppercase">Decay Loading</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Read Only Information */}
        <div className="bg-white p-6 md:p-8 rounded-[1.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100/50 rounded-bl-full -z-10" />
          
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Info className="h-5 w-5 text-slate-500" />
            </div>
            <h2 className="text-sm font-black text-[#2e1d52] uppercase tracking-[0.1em]">View Loading Sale Info</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><CalendarDays size={14} /> Date</Label>
              <div className="font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm">
                {date || '—'}
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><User size={14} /> Customer</Label>
              <div className="font-black text-[#2e1d52] bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm">
                {customerName || '—'}
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Truck size={14} /> Driver Plate Number</Label>
              <div className="font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm uppercase">
                {driverPlateNumber || '—'}
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={14} /> Note</Label>
              <div className="font-medium text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm truncate" title={note}>
                {note || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Update Price */}
        <div className="bg-white p-6 md:p-8 rounded-[1.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6 relative overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="h-10 w-10 rounded-xl bg-[#7a9800]/10 flex items-center justify-center">
              <Banknote className="h-5 w-5 text-[#7a9800]" />
            </div>
            <h2 className="text-sm font-black text-[#2e1d52] uppercase tracking-[0.1em]">Decay Loading Update Price</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Select Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-12 rounded-xl bg-white border-slate-200 font-bold text-slate-700 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white">
                  <SelectItem value="EUR" className="font-bold cursor-pointer">EUR</SelectItem>
                  <SelectItem value="USD" className="font-bold cursor-pointer">USD</SelectItem>
                  <SelectItem value="GBP" className="font-bold cursor-pointer">GBP</SelectItem>
                  <SelectItem value="MAD" className="font-bold cursor-pointer">MAD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Select Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-12 rounded-xl bg-white border-slate-200 font-bold text-slate-700 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white">
                  <SelectItem value="Bank transfer" className="font-bold cursor-pointer">Bank transfer</SelectItem>
                  <SelectItem value="Cash" className="font-bold cursor-pointer">Cash</SelectItem>
                  <SelectItem value="Cheque" className="font-bold cursor-pointer">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Select Payment Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="h-12 rounded-xl bg-white border-slate-200 font-bold text-slate-700 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl bg-white">
                  <SelectItem value="PENDING" className="font-bold text-amber-600 cursor-pointer">PENDING</SelectItem>
                  <SelectItem value="PAID" className="font-bold text-emerald-600 cursor-pointer">PAID</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Product Unit Prices</h3>
            <div className="space-y-4">
              {items.map(item => (
                <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <div className="md:col-span-2">
                    <span className="text-xs font-black text-[#2e1d52]">{item.productName}</span>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                      Net: {item.netWeight || 0} kg | Orig: {item.originalNetWeight || 0} kg
                    </div>
                  </div>
                  <div>
                    <Label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1 md:hidden">Unit Price</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.price}
                        onChange={e => handlePriceChange(item.id, e.target.value)}
                        className="h-11 rounded-xl border-slate-200 bg-white font-bold text-slate-700 pr-12 focus-visible:ring-[#7a9800]"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#7a9800]">{currency}/KG</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase mr-1">Total:</span>
                    <span className="text-xs font-black text-[#7a9800]">
                      {(Number(item.netWeight || 0) * Number(item.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })} {currency}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            disabled={isSubmitting || items.length === 0} 
            className="h-14 px-10 rounded-2xl bg-[#7a9800] hover:bg-[#6c8500] text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[#7a9800]/20 gap-3 transition-transform hover:scale-105 active:scale-95"
          >
            {isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : <><Save size={18} /> Save Prices & Billing</>}
          </Button>
        </div>

      </form>
    </div>
  );
}
