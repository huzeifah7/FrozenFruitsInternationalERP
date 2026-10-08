'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  collection, 
  query, 
  orderBy, 
  doc,
  getDoc,
  updateDoc
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
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
  Package,
  MapPin,
  CalendarDays
} from 'lucide-react';

export default function EditStockInventoryPage() {
  const router = useRouter();
  const { id } = useParams();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // --- Form States ---
  const [locationId, setLocationId] = useState('');
  const [date, setDate] = useState('');
  const [consumableId, setConsumableId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Data Fetching ---
  const locationsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'processing_lines'), orderBy('title'));
  }, [db]);
  const { data: locations, isLoading: loadingLocations } = useCollection(locationsQuery);

  const consumablesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'consumables'), orderBy('name'));
  }, [db]);
  const { data: consumables, isLoading: loadingConsumables } = useCollection(consumablesQuery);

  useEffect(() => {
    if (!db || !id) return;
    const fetchRecord = async () => {
      try {
        const docRef = doc(db, 'stock_inventories', id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setLocationId(data.locationId || '');
          setDate(data.date || '');
          setConsumableId(data.consumableId || '');
          setQuantity(String(data.quantity || ''));
          setNote(data.note || '');
        } else {
          toast({ title: 'Error', description: 'Record not found.', variant: 'destructive' });
          router.push('/supply-chain/stock-inventories');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchRecord();
  }, [db, id, router, toast]);

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || !id) return;

    if (!locationId || !date || !consumableId || !quantity) {
      toast({ title: 'Validation Error', description: 'Please fill out all required fields.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedLocation = locations?.find(l => l.id === locationId);
      const selectedConsumable = consumables?.find(c => c.id === consumableId);
      
      const docRef = doc(db, 'stock_inventories', id as string);
      await updateDoc(docRef, {
        locationId,
        locationName: selectedLocation?.title || 'Unknown',
        date,
        consumableId,
        consumableName: selectedConsumable?.name || 'Unknown',
        quantity: Number(quantity),
        note: note || '',
        updated_at: new Date(),
        updated_by: user.email || 'unknown'
      });

      toast({ title: 'Success', description: 'Stock inventory updated successfully.' });
      router.push('/supply-chain/stock-inventories');
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to update stock inventory.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#7a9800]" />
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
            <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/supply-chain/stock-inventories')}>Stock Inventories</span><span className="opacity-40">/</span>
            <span className="text-[#7a9800]">Edit Stock Inventory</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#2e1d52] uppercase">Edit Stock Inventory</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Card 1: Information */}
        <div className="bg-white p-6 md:p-8 rounded-[1.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#7a9800]/5 rounded-bl-full -z-10" />
          
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="h-10 w-10 rounded-xl bg-[#7a9800]/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-[#7a9800]" />
            </div>
            <h2 className="text-sm font-black text-[#2e1d52] uppercase tracking-[0.1em]">Stock Inventory Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Location <span className="text-rose-500">*</span></Label>
              <Select value={locationId} onValueChange={setLocationId} required disabled={loadingLocations}>
                <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold text-slate-700">
                  <SelectValue placeholder={loadingLocations ? "Loading locations..." : "Select Location"} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                  {locations?.map(l => (
                    <SelectItem key={l.id} value={l.id} className="font-bold cursor-pointer">{l.title || l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Date <span className="text-rose-500">*</span></Label>
              <Input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                required 
                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold text-slate-700" 
              />
            </div>
          </div>
        </div>

        {/* Card 2: Items (Single for Edit) */}
        <div className="bg-white p-6 md:p-8 rounded-[1.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6 relative overflow-hidden">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="h-10 w-10 rounded-xl bg-[#7a9800]/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-[#7a9800]" />
            </div>
            <h2 className="text-sm font-black text-[#2e1d52] uppercase tracking-[0.1em]">Consumable Details</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_2fr] gap-4 items-end bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Consumable <span className="text-rose-500">*</span></Label>
                <Select value={consumableId} onValueChange={setConsumableId} disabled={loadingConsumables}>
                  <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200 font-bold text-slate-700">
                    <SelectValue placeholder="Select Consumable" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 shadow-xl max-h-60">
                    {consumables?.map(c => (
                      <SelectItem key={c.id} value={c.id} className="font-bold cursor-pointer">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Quantity <span className="text-rose-500">*</span></Label>
                <Input 
                  type="number" 
                  min="0"
                  step="0.01"
                  value={quantity} 
                  onChange={e => setQuantity(e.target.value)} 
                  placeholder="0"
                  className="h-11 rounded-xl bg-white border-slate-200 font-black text-slate-700" 
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Note</Label>
                <Input 
                  type="text" 
                  value={note} 
                  onChange={e => setNote(e.target.value)} 
                  placeholder="Optional details..."
                  className="h-11 rounded-xl bg-white border-slate-200 font-medium text-slate-600" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className="h-14 px-10 rounded-2xl bg-[#7a9800] hover:bg-[#6c8500] text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[#7a9800]/20 gap-3 transition-transform hover:scale-105 active:scale-95"
          >
            {isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : <><Save size={18} /> Update Stock Inventory</>}
          </Button>
        </div>

      </form>
    </div>
  );
}
