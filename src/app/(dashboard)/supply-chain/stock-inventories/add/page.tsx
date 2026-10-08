'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  orderBy, 
  writeBatch,
  doc
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
  Plus, 
  Trash2, 
  Save, 
  Loader2,
  Package,
  MapPin,
  CalendarDays
} from 'lucide-react';
import Link from 'next/link';

interface InventoryItemRow {
  id: string;
  consumableId: string;
  quantity: string;
  note: string;
}

export default function AddStockInventoryPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // --- Form States ---
  const [locationId, setLocationId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<InventoryItemRow[]>([
    { id: crypto.randomUUID(), consumableId: '', quantity: '', note: '' }
  ]);
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

  // --- Row Management ---
  const handleAddItem = () => {
    setItems(prev => [...prev, { id: crypto.randomUUID(), consumableId: '', quantity: '', note: '' }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof InventoryItemRow, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;

    if (!locationId) {
      toast({ title: 'Validation Error', description: 'Please select a location.', variant: 'destructive' });
      return;
    }
    if (!date) {
      toast({ title: 'Validation Error', description: 'Please select a date.', variant: 'destructive' });
      return;
    }
    if (items.length === 0) {
      toast({ title: 'Validation Error', description: 'Please add at least one item.', variant: 'destructive' });
      return;
    }

    // Validate rows
    const validItems = items.filter(i => i.consumableId && i.quantity && Number(i.quantity) > 0);
    if (validItems.length === 0) {
      toast({ title: 'Validation Error', description: 'Please fill out consumable and quantity for at least one item.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const selectedLocation = locations?.find(l => l.id === locationId);

      validItems.forEach(item => {
        const docRef = doc(collection(db, 'stock_inventories'));
        const selectedConsumable = consumables?.find(c => c.id === item.consumableId);
        
        batch.set(docRef, {
          locationId,
          locationName: selectedLocation?.title || 'Unknown',
          date,
          consumableId: item.consumableId,
          consumableName: selectedConsumable?.name || 'Unknown',
          quantity: Number(item.quantity),
          note: item.note || '',
          created_at: new Date(),
          created_by: user.email || 'unknown',
          updated_at: new Date(),
          updated_by: user.email || 'unknown'
        });
      });

      await batch.commit();
      toast({ title: 'Success', description: 'Stock inventory added successfully.' });
      router.push('/supply-chain/stock-inventories');
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to add stock inventory.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <span className="text-[#7a9800]">Add Stock Inventory</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#2e1d52] uppercase">Add Stock Inventory</h1>
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

        {/* Card 2: Items */}
        <div className="bg-white p-6 md:p-8 rounded-[1.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#7a9800]/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-[#7a9800]" />
              </div>
              <h2 className="text-sm font-black text-[#2e1d52] uppercase tracking-[0.1em]">Items</h2>
            </div>
            <Button 
              type="button" 
              onClick={handleAddItem} 
              className="h-10 w-10 bg-[#7a9800] hover:bg-[#6c8500] text-white rounded-xl shadow-md shadow-[#7a9800]/20 flex items-center justify-center transition-transform hover:scale-105 p-0"
              title="Add Row"
            >
              <Plus size={18} className="stroke-[3]" />
            </Button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_2fr_auto] gap-4 items-end bg-slate-50/50 p-4 rounded-2xl border border-slate-100 group">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Consumable <span className="text-rose-500">*</span></Label>
                  <Select value={item.consumableId} onValueChange={(v) => handleItemChange(item.id, 'consumableId', v)} disabled={loadingConsumables}>
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
                    value={item.quantity} 
                    onChange={e => handleItemChange(item.id, 'quantity', e.target.value)} 
                    placeholder="0"
                    className="h-11 rounded-xl bg-white border-slate-200 font-black text-slate-700" 
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Note</Label>
                  <Input 
                    type="text" 
                    value={item.note} 
                    onChange={e => handleItemChange(item.id, 'note', e.target.value)} 
                    placeholder="Optional details..."
                    className="h-11 rounded-xl bg-white border-slate-200 font-medium text-slate-600" 
                  />
                </div>

                <Button 
                  type="button" 
                  variant="ghost"
                  onClick={() => handleRemoveItem(item.id)} 
                  className="h-11 w-11 rounded-xl bg-white border border-rose-100 text-rose-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 shadow-sm"
                  title="Remove Row"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}

            {items.length === 0 && (
              <div className="text-center py-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No items added yet.</p>
                <Button type="button" variant="link" onClick={handleAddItem} className="text-[#7a9800] text-xs font-bold mt-2 hover:no-underline">
                  + Add your first item
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            disabled={isSubmitting || items.length === 0} 
            className="h-14 px-10 rounded-2xl bg-[#7a9800] hover:bg-[#6c8500] text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[#7a9800]/20 gap-3 transition-transform hover:scale-105 active:scale-95"
          >
            {isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : <><Save size={18} /> Add Stock Inventory</>}
          </Button>
        </div>

      </form>
    </div>
  );
}
