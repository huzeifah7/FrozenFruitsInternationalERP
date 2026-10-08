'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addDoc, collection, serverTimestamp, getDocs, query, where } from '@/firebase/firestore-override';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirestore, useStorage, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { canList, canAdd, canUpdate, canDelete } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft, Plus, Trash2, Loader2, CheckCircle2,
  Package, MapPin, Calendar, FileText, Upload, X, ArrowUpCircle, ArrowDownCircle, DollarSign
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { recalculateAffectedStockGroups, isChappes } from '@/lib/stock-situation-utils';
import { useSeason } from '@/contexts/SeasonContext';

interface ItemRow {
  id: string;
  operation: 'IN' | 'OUT' | '';
  supplierId: string;
  supplierName: string;
  consumableId: string;
  consumableName: string;
  deliveryNoteNumber: string;
  quantity: string;
  currency: string;
  unitPrice: string;
  totalAmount: number;
  file: File | null;
  filePreview: string;
  note: string;
}

const emptyItem = (): ItemRow => ({
  id: `item-${Date.now()}-${Math.random()}`,
  operation: '',
  supplierId: '',
  supplierName: '',
  consumableId: '',
  consumableName: '',
  deliveryNoteNumber: '',
  quantity: '',
  currency: 'MAD',
  unitPrice: '',
  totalAmount: 0,
  file: null,
  filePreview: '',
  note: '',
});

export default function AddStockSituationPage() {
  const router = useRouter();
  const db = useFirestore();
  const storage = useStorage();
  const { user, profile } = useUser();
  const { toast } = useToast();

  const [locationId, setLocationId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // Default to today
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableStock, setAvailableStock] = useState<Record<string, number>>({});
  const { currentSeason } = useSeason();
  const [resolvedSeasonId, setResolvedSeasonId] = useState<string | null>(
    currentSeason?.id || (typeof window !== 'undefined' ? localStorage.getItem('season_id') : null)
  );

  useEffect(() => {
    if (resolvedSeasonId || !db) return;
    const fetchSeason = async () => {
      try {
        const q = query(collection(db, 'seasons'), where('status', '==', 'Active'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setResolvedSeasonId(snap.docs[0].id);
        } else {
          // fallback to a dummy season if no active season exists yet to avoid blocking the user
          setResolvedSeasonId('DEFAULT_SEASON');
        }
      } catch (err) {
        console.error('Error fetching season', err);
        setResolvedSeasonId('DEFAULT_SEASON');
      }
    };
    fetchSeason();
  }, [db, resolvedSeasonId]);

  const seasonId = resolvedSeasonId;

  const permission = {
    list: canList(profile, 'supply-chain.stock-situation') ? 1 : 0,
    add: canAdd(profile, 'supply-chain.stock-situation') ? 1 : 0,
    update: canUpdate(profile, 'supply-chain.stock-situation') ? 1 : 0,
    delete: canDelete(profile, 'supply-chain.stock-situation') ? 1 : 0
  };

  // Fetch Locations (Processing Lines)
  const locationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'processing_lines');
  }, [db, user]);
  const { data: processingLines } = useCollection(locationsQuery);
  const locations = processingLines?.map(l => ({ id: l.id, name: l.title || l.id })) || [];

  // Fetch Consumables
  const consumablesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'consumables');
  }, [db, user]);
  const { data: consumables } = useCollection(consumablesQuery);

  // Fetch Suppliers
  const suppliersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'suppliers');
  }, [db, user]);
  const { data: suppliers } = useCollection(suppliersQuery);

  // Load stock counters whenever locationId changes
  useEffect(() => {
    async function loadCounters() {
      if (!db || !locationId) {
        setAvailableStock({});
        return;
      }
      try {
        if (!seasonId) return;
        const countersQuery = query(
          collection(db, 'stock_situation_counters'),
          where('locationId', '==', locationId),
          where('seasonId', '==', seasonId)
        );
        const snap = await getDocs(countersQuery);
        const stockMap: Record<string, number> = {};
        snap.docs.forEach(docSnap => {
          const data = docSnap.data();
          stockMap[data.consumableId] = Number(data.available || 0);
        });
        setAvailableStock(stockMap);
      } catch (err) {
        console.error('Error loading stock counters:', err);
      }
    }
    loadCounters();
  }, [db, locationId]);

  // Row Management
  const addItem = () => setItems(prev => [...prev, emptyItem()]);

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof ItemRow, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;

      let updated = { ...item, [field]: value };

      if (field === 'consumableId') {
        const c = consumables?.find(cons => cons.id === value);
        updated.consumableName = c?.name || '';

        // Auto-clear supplier if it's no longer valid for the new consumable
        const allowedSupplierNames = c?.suppliers || [];
        const currentSupplier = suppliers?.find(sup => sup.id === updated.supplierId);
        if (currentSupplier) {
           if (currentSupplier.supplier_type !== 'Packaging' || !allowedSupplierNames.includes(currentSupplier.name)) {
             updated.supplierId = '';
             updated.supplierName = '';
           }
        }
      }

      if (field === 'supplierId') {
        const s = suppliers?.find(sup => sup.id === value);
        updated.supplierName = s?.name || '';
      }

      // Re-calculate total amount
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = Number(field === 'quantity' ? value : item.quantity) || 0;
        const price = Number(field === 'unitPrice' ? value : item.unitPrice) || 0;
        updated.totalAmount = Number((qty * price).toFixed(2));
      }

      return updated;
    }));
  };

  const setItemFile = (id: string, file: File | null) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { ...item, file, filePreview: file ? file.name : '' };
    }));
  };

  // Validation
  const validate = () => {
    const e: Record<string, string> = {};
    if (!seasonId) e.global = 'No season selected';
    if (!locationId) e.location = 'Location is required';
    if (!date) e.date = 'Date is required';

    items.forEach((item, i) => {
      if (!item.operation) {
        e[`op-${i}`] = 'Required';
      }
      if (!item.consumableId) {
        e[`cons-${i}`] = 'Required';
      }
      if (!item.quantity || isNaN(Number(item.quantity)) || Number(item.quantity) <= 0) {
        e[`qty-${i}`] = 'Must be greater than 0';
      }
      if (item.operation === 'IN' && !item.supplierId) {
        e[`sup-${i}`] = 'Supplier required for IN operations';
      }
      if (!item.deliveryNoteNumber || item.deliveryNoteNumber.trim() === '') {
        e[`dn-${i}`] = 'Delivery Note required';
      }

      // Check stock limits on OUT operations
      if (item.operation === 'OUT' && item.consumableId) {
        let qtyToVal = Number(item.quantity) || 0;
        
        // Convert to units internally if Chappes
        const isChappeConsumable = isChappes(item.consumableName);
        if (isChappeConsumable) {
          qtyToVal = qtyToVal * 2000;
        }

        const currentAvailable = availableStock[item.consumableId] || 0;
        if (qtyToVal > currentAvailable) {
          const showAvailable = isChappeConsumable ? currentAvailable / 2000 : currentAvailable;
          const showUnit = isChappeConsumable ? 'Boxes' : 'Units';
          e[`qty-${i}`] = `Exceeds stock: ${showAvailable} ${showUnit} available`;
        }
      }
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // Submit
  const handleSubmit = async () => {
    if (!db || !user) return;
    const isValid = validate();
    
    // We can evaluate the validation logic here again to get the exact errors object immediately
    const e: Record<string, string> = {};
    if (!seasonId) e.global = 'No season selected';
    if (!locationId) e.location = 'Location is required';
    if (!date) e.date = 'Date is required';
    items.forEach((item, i) => {
      if (!item.operation) e[`op-${i}`] = 'Required';
      if (!item.consumableId) e[`cons-${i}`] = 'Required';
      if (!item.quantity || isNaN(Number(item.quantity)) || Number(item.quantity) <= 0) e[`qty-${i}`] = 'Must be greater than 0';
      if (item.operation === 'IN' && !item.supplierId) e[`sup-${i}`] = 'Supplier required for IN operations';
      if (!item.deliveryNoteNumber || item.deliveryNoteNumber.trim() === '') e[`dn-${i}`] = 'Delivery Note required';
    });

    if (Object.keys(e).length > 0) {
      toast({ 
        variant: 'destructive', 
        title: 'Validation Error', 
        description: e.global || `Missing fields: ${Object.keys(e).join(', ')}. Please resolve errors.` 
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Upload attachments to Storage
      const processedItems = await Promise.all(items.map(async item => {
        let fileUrl = '';
        if (item.file && storage) {
          const storageRef = ref(storage, `stock_situations/${locationId}/${Date.now()}-${item.file.name}`);
          const snap = await uploadBytes(storageRef, item.file);
          fileUrl = await getDownloadURL(snap.ref);
        }

        // Store quantity internally as units if Chappes
        let qtyToStore = Number(item.quantity);
        if (isChappes(item.consumableName)) {
          qtyToStore = qtyToStore * 2000;
        }

        const { file, filePreview, id, quantity, ...rest } = item;
        return { 
          ...rest, 
          quantity: qtyToStore,
          unitPrice: Number(item.unitPrice || 0),
          fileUrl 
        };
      }));

      // 2. Save parent document in 'stock_situations'
      await addDoc(collection(db, 'stock_situations'), {
        seasonId,
        locationId,
        locationName,
        date,
        items: processedItems,
        createdAt: serverTimestamp(),
        createdBy: user.email,
        updatedAt: serverTimestamp(),
        updatedBy: user.email,
      });

      // 3. Trigger targeted counter recalculation
      const affectedConsumables = items.map(i => `${i.consumableId}_${locationId}`);
      const affectedSuppliers = items.filter(i => i.supplierId).map(i => `${i.supplierId}_${locationId}`);
      if (seasonId) {
        await recalculateAffectedStockGroups(db, seasonId, affectedConsumables, affectedSuppliers);
      }

      toast({ title: 'Stock Situation Recorded', description: `Stock situation for ${locationName} has been recorded.` });
      router.push('/supply-chain/stock-situation');
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Save Failed', description: 'An error occurred while saving.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full p-6 lg:p-8 max-w-[1400px] mx-auto animate-in fade-in duration-500 bg-[#F8F9FB] min-h-screen">
      {/* Back button & Breadcrumbs */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10 hover:bg-slate-200">
          <ChevronLeft size={20} className="text-slate-600" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
            <span>Profile</span><span className="opacity-40">/</span>
            <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/supply-chain/stock-situation')}>Stock Situation</span><span className="opacity-40">/</span>
            <span className="text-[#7a9800]">Add Stock Situation</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#2e1d52] uppercase">Add Stock Situation</h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* Information Section */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-primary/5 pb-4 border-b border-primary/5">
            <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest">
              <MapPin size={14} /> Stock Situation Information
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 pb-6 px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Location */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 ml-1">
                  Location <span className="text-rose-500">*</span>
                </Label>
                <Select onValueChange={val => {
                  const loc = locations.find(l => l.id === val);
                  setLocationId(val);
                  setLocationName(loc?.name || val);
                  setErrors(p => ({ ...p, location: '' }));
                }}>
                  <SelectTrigger className={`h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold text-slate-700 ${errors.location ? 'ring-2 ring-rose-500' : ''}`}>
                    <SelectValue placeholder="Select a location..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                    {locations.map(l => <SelectItem key={l.id} value={l.id} className="font-bold cursor-pointer">{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.location && <p className="text-[10px] font-bold text-rose-500 uppercase ml-1">{errors.location}</p>}
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 ml-1">
                  Date <span className="text-rose-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={date}
                  onChange={e => { setDate(e.target.value); setErrors(p => ({ ...p, date: '' })); }}
                  className={`h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold text-slate-700 ${errors.date ? 'ring-2 ring-rose-500' : ''}`}
                />
                {errors.date && <p className="text-[10px] font-bold text-rose-500 uppercase ml-1">{errors.date}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items Section */}
        <Card className="border-none shadow-lg rounded-3xl bg-white overflow-hidden">
          <CardHeader className="bg-primary/5 pb-4 border-b border-primary/5 flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest">
              <Package size={14} /> Items ({items.length})
            </CardTitle>
            <Button type="button" size="sm" variant="outline" onClick={addItem}
              className="h-9 px-5 rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-black text-[10px] uppercase gap-1.5">
              <Plus size={14} /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="pt-6 pb-6 space-y-4">
            {items.map((item, idx) => {
              const isChappe = isChappes(item.consumableName);
              
              // Get filtered suppliers for this specific item's consumable
              const selectedConsumable = consumables?.find(c => c.id === item.consumableId);
              const allowedSupplierNames = selectedConsumable?.suppliers || [];
              const filteredSuppliers = suppliers?.filter(s => 
                s.supplier_type === 'Packaging' && 
                allowedSupplierNames.includes(s.name)
              ) || [];

              return (
                <div key={item.id} className="border border-primary/10 rounded-2xl overflow-hidden hover:border-primary/25 transition-all">
                  {/* Item Row Header */}
                  <div className="flex items-center justify-between bg-primary/[0.03] px-5 py-3 border-b border-primary/5">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center font-black text-xs text-primary">{idx + 1}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Item #{idx + 1}</span>
                      {item.operation && (
                        <Badge className={`text-[9px] font-black rounded-lg px-2 border ${item.operation === 'IN' ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                          {item.operation}
                        </Badge>
                      )}
                    </div>
                    {items.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeItem(item.id)}
                        className="h-7 w-7 rounded-full text-rose-400 hover:bg-rose-50 hover:text-rose-600">
                        <X size={14} />
                      </Button>
                    )}
                  </div>

                  {/* Fields Grid */}
                  <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Operation */}
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Operation *</Label>
                      <Select value={item.operation} onValueChange={val => updateItem(item.id, 'operation', val)}>
                        <SelectTrigger className={`h-11 rounded-xl bg-slate-50 border-slate-200 font-bold ${errors[`op-${idx}`] ? 'ring-2 ring-rose-500' : ''}`}>
                          <SelectValue placeholder="Select Operation" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                          <SelectItem value="IN" className="font-bold text-teal-700">IN</SelectItem>
                          <SelectItem value="OUT" className="font-bold text-amber-700">OUT</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors[`op-${idx}`] && <p className="text-[9px] font-bold text-rose-500 uppercase">{errors[`op-${idx}`]}</p>}
                    </div>

                    {/* Consumable */}
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Consumable *</Label>
                      <Select value={item.consumableId} onValueChange={val => updateItem(item.id, 'consumableId', val)}>
                        <SelectTrigger className={`h-11 rounded-xl bg-slate-50 border-slate-200 font-medium ${errors[`cons-${idx}`] ? 'ring-2 ring-rose-500' : ''}`}>
                          <SelectValue placeholder="Select Consumable" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-100 shadow-xl max-h-60">
                          {consumables?.map(c => (
                            <SelectItem key={c.id} value={c.id} className="font-bold">{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors[`cons-${idx}`] && <p className="text-[9px] font-bold text-rose-500 uppercase">{errors[`cons-${idx}`]}</p>}
                    </div>

                    {/* Supplier */}
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                        Supplier {item.operation === 'IN' && <span className="text-rose-500">*</span>}
                      </Label>
                      <Select value={item.supplierId} onValueChange={val => updateItem(item.id, 'supplierId', val)} disabled={item.operation === 'OUT'}>
                        <SelectTrigger className={`h-11 rounded-xl bg-slate-50 border-slate-200 font-medium ${errors[`sup-${idx}`] ? 'ring-2 ring-rose-500' : ''}`}>
                          <SelectValue placeholder="Select Supplier" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-100 shadow-xl max-h-60">
                          {filteredSuppliers.map(s => (
                            <SelectItem key={s.id} value={s.id} className="font-bold">{s.name}</SelectItem>
                          ))}
                          {filteredSuppliers.length === 0 && item.consumableId && (
                            <p className="text-[10px] font-bold text-rose-500 italic px-2 py-3">
                              No packaging suppliers affected to this consumable.
                            </p>
                          )}
                        </SelectContent>
                      </Select>
                      {errors[`sup-${idx}`] && <p className="text-[9px] font-bold text-rose-500 uppercase">{errors[`sup-${idx}`]}</p>}
                    </div>

                    {/* Delivery Note Number */}
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Delivery Note No. *</Label>
                      <Input
                        type="text"
                        value={item.deliveryNoteNumber}
                        onChange={e => updateItem(item.id, 'deliveryNoteNumber', e.target.value)}
                        placeholder="e.g. DN-2026-001"
                        className={`h-11 rounded-xl bg-slate-50 border-slate-200 font-medium ${errors[`dn-${idx}`] ? 'ring-2 ring-rose-500' : ''}`}
                      />
                      {errors[`dn-${idx}`] && <p className="text-[9px] font-bold text-rose-500 uppercase">{errors[`dn-${idx}`]}</p>}
                    </div>

                    {/* Quantity */}
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                        Quantity ({isChappe ? 'Boxes' : 'Units'}) *
                      </Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                        placeholder="0"
                        className={`h-11 rounded-xl bg-slate-50 border-slate-200 font-black ${errors[`qty-${idx}`] ? 'ring-2 ring-rose-500' : ''}`}
                      />
                      {errors[`qty-${idx}`] && <p className="text-[9px] font-bold text-rose-500 uppercase">{errors[`qty-${idx}`]}</p>}
                    </div>

                    {/* Currency */}
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Currency</Label>
                      <Select value={item.currency} onValueChange={val => updateItem(item.id, 'currency', val)}>
                        <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-100 shadow-xl">
                          <SelectItem value="MAD" className="font-bold">MAD</SelectItem>
                          <SelectItem value="EUR" className="font-bold">EUR</SelectItem>
                          <SelectItem value="USD" className="font-bold">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Unit Price */}
                    <div className="space-y-1.5">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Unit Price</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={item.unitPrice}
                          onChange={e => updateItem(item.id, 'unitPrice', e.target.value)}
                          placeholder="0.00"
                          className="h-11 rounded-xl bg-slate-50 border-slate-200 font-black pr-8"
                        />
                        <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      </div>
                    </div>

                    {/* Total Amount */}
                    <div className="space-y-1.5 font-bold">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total Amount</Label>
                      <div className="h-11 rounded-xl bg-slate-100 flex items-center px-4 font-black text-slate-700 text-sm">
                        {item.totalAmount.toLocaleString()} {item.currency}
                      </div>
                    </div>

                    {/* File Upload */}
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Delivery Note File</Label>
                      <label className="flex items-center gap-2 h-11 rounded-xl bg-slate-50 border border-slate-200 px-4 cursor-pointer hover:bg-slate-100 transition-all group">
                        <input
                          type="file"
                          className="hidden"
                          onChange={e => setItemFile(item.id, e.target.files?.[0] || null)}
                        />
                        <Upload size={14} className="text-slate-400 group-hover:text-primary transition-colors flex-shrink-0" />
                        <span className="text-[11px] font-bold text-slate-600 truncate group-hover:text-primary transition-colors">
                          {item.filePreview || 'Upload File (PDF/Image)...'}
                        </span>
                        {item.file && (
                          <button
                            type="button"
                            onClick={e => { e.preventDefault(); setItemFile(item.id, null); }}
                            className="ml-auto h-5 w-5 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center flex-shrink-0 hover:bg-rose-200"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </label>
                    </div>

                    {/* Note */}
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Note</Label>
                      <Input
                        type="text"
                        value={item.note}
                        onChange={e => updateItem(item.id, 'note', e.target.value)}
                        placeholder="Optional remarks..."
                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-medium"
                      />
                    </div>
                  </div>

                  {/* Consumable Info Strip */}
                  {item.consumableName && (
                    <div className="px-5 pb-4 flex items-center gap-2 text-xs">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Calculated:</span>
                      <span className="font-bold text-slate-700 bg-slate-100 rounded-lg px-2 py-0.5">
                        {item.consumableName}
                      </span>
                      {isChappe && (
                        <span className="text-[10px] text-[#7a9800] font-black uppercase">
                          ({item.quantity || 0} Boxes = {(Number(item.quantity || 0) * 2000).toLocaleString()} Units Internally)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Action Bar */}
        <div className="flex items-center justify-between p-6 bg-slate-100 rounded-3xl border border-slate-200">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-[#7a9800] h-5 w-5" />
            <div>
              <p className="text-sm font-black text-slate-700 uppercase tracking-tight">Ready to Submit</p>
              <p className="text-[10px] text-slate-400 font-bold">
                {items.length} Item(s) — {items.filter(i => i.operation === 'IN').length} IN / {items.filter(i => i.operation === 'OUT').length} OUT
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button type="button" variant="ghost" onClick={() => router.push('/supply-chain/stock-situation')}
              className="font-black text-slate-500 uppercase tracking-widest hover:bg-slate-200 h-12 rounded-xl">
              Discard
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || items.length === 0}
              className="h-14 px-12 bg-[#7a9800] hover:bg-[#6c8500] text-white font-black shadow-lg shadow-[#7a9800]/20 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest min-w-[260px] gap-2"
            >
              {loading ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</>
              ) : <><Plus size={16} /> Record Stock Situation</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
