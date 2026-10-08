'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ChevronLeft, Loader2, Plus, Trash2, Check } from 'lucide-react';
import { collection, query, orderBy } from '@/firebase/firestore-override';

export default function EditDecaySalePage() {
  const router = useRouter();
  const params = useParams();
  const loadingId = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [date, setDate] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('PENDING');
  const [currency, setCurrency] = useState('MAD');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<any[]>([]);

  // Base record to preserve fields not shown
  const [baseRecord, setBaseRecord] = useState<any>(null);

  // Fetch Collections
  const { data: customers } = useCollection(query(collection(db, 'local_customers'), orderBy('name')));
  const { data: products } = useCollection(query(collection(db, 'products'), orderBy('name')));

  useEffect(() => {
    async function loadData() {
      if (!db || !loadingId) return;
      try {
        const docRef = doc(db, 'decay_loadings', loadingId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setBaseRecord(data);
          setDate(data.date || '');
          setCustomerId(data.customerId || '');
          setPaymentStatus(data.paymentStatus || 'PENDING');
          setCurrency(data.currency || 'MAD');
          setPaymentMethod(data.paymentMethod || '');
          setNote(data.note || '');
          setItems(data.items || []);
        } else {
          toast({ title: 'Error', description: 'Sale not found', variant: 'destructive' });
          router.push('/decay/sales');
        }
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to load sale data', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [db, loadingId, router, toast]);

  const handleAddItem = () => {
    setItems(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        productId: '',
        productName: '',
        netWeight: 0,
        originalNetWeight: 0,
        difference: 0,
        price: 0,
        totalAmount: 0
      }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleItemChange = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      
      // Auto-set product name
      if (field === 'productId') {
        const prod = products?.find(p => p.id === value);
        if (prod) updated.productName = prod.name;
      }

      // Calculations
      if (field === 'netWeight' || field === 'price' || field === 'productId') {
        const nw = Number(updated.netWeight || 0);
        const pr = Number(updated.price || 0);
        const onw = Number(updated.originalNetWeight || 0);
        updated.totalAmount = nw * pr;
        updated.difference = nw - onw; // Preserves difference logic for loadings
      }

      return updated;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;

    if (!date || !customerId || items.length === 0) {
      toast({ title: 'Validation Error', description: 'Date, Customer and at least one item are required.', variant: 'destructive' });
      return;
    }

    const hasInvalidRow = items.some(i => !i.productId || Number(i.netWeight) <= 0);
    if (hasInvalidRow) {
      toast({ title: 'Validation Error', description: 'Please fill out all product fields correctly.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const selectedCustomer = customers?.find(c => c.id === customerId);
      const customerName = selectedCustomer?.name || baseRecord?.customerName;
      
      const totalAmount = items.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);

      const payload = {
        date,
        customerId,
        customerName,
        paymentStatus,
        currency,
        paymentMethod,
        note,
        items,
        totalAmount,
        updated_at: new Date(),
        updated_by: user.email || 'unknown'
      };

      await updateDoc(doc(db, 'decay_loadings', loadingId), payload);
      toast({ title: 'Success', description: 'Decay sale updated successfully!' });
      router.push('/decay/sales');
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to update decay sale', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f3f3f3] flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-[#7a9800]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f3f3] p-6 lg:p-8">
      <div className="max-w-[1200px] mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
            <span>Profile</span>
            <span className="opacity-40">/</span>
            <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/decay/sales')}>Decay Sale</span>
            <span className="opacity-40">/</span>
            <span className="text-[#7a9800] font-black">Edit</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/decay/sales')} className="rounded-full h-10 w-10 hover:bg-slate-200">
              <ChevronLeft size={20} className="text-slate-600" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-black text-[#2e1d52] tracking-tight uppercase leading-none">
              Decay Sale
            </h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-slate-100/50 border border-slate-100/80">
            <h2 className="text-lg font-black text-[#2e1d52] uppercase tracking-[0.1em] mb-6">Decay Sale Info</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Side */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date And Time</Label>
                  <Input 
                    type="date"
                    required
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="h-12 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus-visible:ring-[#7a9800]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Decay Customer</Label>
                  <select
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#7a9800] outline-none transition-all"
                    required
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                  >
                    <option value="" disabled>Select</option>
                    {customers?.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Payment Status</Label>
                  <select
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#7a9800] outline-none transition-all"
                    value={paymentStatus}
                    onChange={e => setPaymentStatus(e.target.value)}
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PAID">PAID</option>
                  </select>
                </div>
              </div>

              {/* Right Side */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Currency</Label>
                  <select
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#7a9800] outline-none transition-all"
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                  >
                    <option value="MAD">MAD</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Payment Method</Label>
                  <select
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border-none font-bold text-slate-800 focus:ring-2 focus:ring-[#7a9800] outline-none transition-all"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="Bank transfer">Bank transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Note</Label>
                  <Input 
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="h-12 rounded-xl bg-slate-50 border-none font-semibold text-slate-800 focus-visible:ring-[#7a9800]"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Items Array */}
            <div className="mt-8 space-y-4">
              <Button type="button" onClick={handleAddItem} className="h-10 w-10 bg-[#7a9800] hover:bg-[#6c8500] text-white p-0 rounded-xl shadow-lg shadow-[#7a9800]/20">
                <Plus size={20} className="stroke-[3]" />
              </Button>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={item.id} className="flex flex-col sm:flex-row items-center gap-3">
                    <div className="flex-1 w-full relative">
                      <select
                        className="w-full h-12 pl-4 pr-10 rounded-xl bg-slate-50 border border-slate-100 font-bold text-slate-800 focus:ring-2 focus:ring-[#7a9800] outline-none transition-all appearance-none"
                        value={item.productId}
                        onChange={e => handleItemChange(item.id, 'productId', e.target.value)}
                        required
                      >
                        <option value="" disabled>Select Product...</option>
                        {products?.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none border-l border-slate-200 pl-2">
                        <ChevronLeft size={14} className="text-slate-400 -rotate-90" />
                      </div>
                    </div>

                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Qty"
                      className="h-12 w-full sm:w-24 rounded-xl bg-slate-50 border border-slate-100 font-bold text-slate-800 focus-visible:ring-[#7a9800]"
                      value={item.netWeight || ''}
                      onChange={e => handleItemChange(item.id, 'netWeight', e.target.value)}
                      required
                    />

                    <div className="relative w-full sm:w-40 flex items-center h-12 rounded-xl bg-slate-50 border border-slate-100 focus-within:ring-2 focus-within:ring-[#7a9800] overflow-hidden">
                      <div className="h-full px-3 flex items-center bg-slate-100 border-r border-slate-200">
                        <span className="text-[10px] font-black uppercase text-slate-500">dh</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Price"
                        className="w-full h-full bg-transparent px-3 font-bold text-slate-800 outline-none"
                        value={item.price || ''}
                        onChange={e => handleItemChange(item.id, 'price', e.target.value)}
                        required
                      />
                    </div>

                    <Button type="button" variant="ghost" onClick={() => handleRemoveItem(item.id)} className="h-12 w-12 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-xl p-0 shrink-0">
                      <Trash2 size={18} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button type="submit" disabled={isSaving} className="h-12 px-8 bg-[#7a9800] hover:bg-[#6c8500] text-white font-black rounded-xl shadow-lg shadow-[#7a9800]/20 uppercase tracking-widest text-[10px]">
                {isSaving ? <><Loader2 size={16} className="animate-spin mr-2" /> Saving...</> : 'Update Decay Sale'}
              </Button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
