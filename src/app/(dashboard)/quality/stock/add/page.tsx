'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { addDoc, collection, serverTimestamp } from '@/firebase/firestore-override';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useFirestore, useStorage, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft, Plus, Minus, Trash2, Loader2, CheckCircle2,
  Package2, MapPin, Calendar, FileText, Upload, X, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';

// ─────────────────────────────
// Types
// ─────────────────────────────
interface ItemRow {
  id: string;
  operation: 'IN' | 'OUT' | '';
  quantity: string;
  consumableId: string;
  consumableName: string;
  section: string;
  deliveryNoteNumber: string;
  note: string;
  file: File | null;
  filePreview: string;
}

const emptyItem = (): ItemRow => ({
  id: `item-${Date.now()}-${Math.random()}`,
  operation: '',
  quantity: '',
  consumableId: '',
  consumableName: '',
  section: '',
  deliveryNoteNumber: '',
  note: '',
  file: null,
  filePreview: '',
});

// ─────────────────────────────
// Main Component
// ─────────────────────────────
export default function AddQualityStockPage() {
  const router = useRouter();
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();

  const [locationId, setLocationId] = useState('');
  const [locationName, setLocationName] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<ItemRow[]>([emptyItem()]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Data
  const locationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'processing_lines');
  }, [db, user]);

  const consumablesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'quality_consumables');
  }, [db, user]);

  const { data: processingLines } = useCollection(locationsQuery);
  const { data: consumables } = useCollection(consumablesQuery);
  const locations = processingLines?.map(l => ({ id: l.id, name: l.title || l.id })) || [];

  // ── Item management ─────────────────────
  const addItem = () => setItems(prev => [...prev, emptyItem()]);

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof ItemRow, value: any) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (field === 'consumableId') {
        const c = consumables?.find(c => c.id === value);
        return { ...item, consumableId: value, consumableName: c?.name || '', section: c?.section || '' };
      }
      return { ...item, [field]: value };
    }));
  };

  const setItemFile = (id: string, file: File | null) => {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      return { ...item, file, filePreview: file ? file.name : '' };
    }));
  };

  // ── Validation ─────────────────────────
  const validate = () => {
    const e: Record<string, string> = {};
    if (!locationId) e.location = 'Location is required';
    if (!date) e.date = 'Date is required';
    items.forEach((item, i) => {
      if (!item.operation) e[`op-${i}`] = 'Required';
      if (!item.quantity || isNaN(Number(item.quantity)) || Number(item.quantity) <= 0) e[`qty-${i}`] = 'Required';
      if (!item.consumableId) e[`cons-${i}`] = 'Required';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ──────────────────────────────
  const handleSubmit = async () => {
    if (!db || !user) return;
    if (!validate()) {
      toast({ variant: 'destructive', title: 'Validation Error', description: 'Please fill all required fields.' });
      return;
    }
    setLoading(true);
    try {
      // Upload files
      const processedItems = await Promise.all(items.map(async item => {
        let fileUrl = '';
        if (item.file && storage) {
          try {
            const sanitizedFileName = item.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const storageRef = ref(storage, `quality_stock/${Date.now()}_${sanitizedFileName}`);
            const snap = await uploadBytes(storageRef, item.file);
            fileUrl = await getDownloadURL(snap.ref);
          } catch (uploadErr: any) {
            console.error('Storage Upload Error:', uploadErr);
            toast({
              variant: 'destructive',
              title: 'File Upload Warning',
              description: `Could not upload ${item.file.name}: ${uploadErr.message || 'Permission denied'}`
            });
          }
        }
        const { file, filePreview, id, ...rest } = item;
        return { ...rest, fileUrl };
      }));

      await addDoc(collection(db, 'quality_stock'), {
        locationId,
        locationName,
        date,
        items: processedItems,
        createdAt: serverTimestamp(),
        createdBy: user.email,
        updatedAt: serverTimestamp(),
        updatedBy: user.email,
      });

      toast({ title: 'Stock Entry Saved', description: `Stock situation for ${locationName} has been recorded.` });
      router.push('/quality/stock');
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Save Failed', description: 'An error occurred while saving.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Back + Title */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/quality/stock')} className="rounded-full hover:bg-primary/10">
          <ChevronLeft className="h-5 w-5 text-primary" />
        </Button>
        <div>
          <nav className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 mb-1">
            Quality Stock Situation / <span className="text-primary">Add Quality Stock Situation</span>
          </nav>
          <h1 className="text-2xl font-black text-primary uppercase tracking-tight">Add Quality Stock Situation</h1>
        </div>
      </div>

      {/* Header Fields */}
      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/5">
          <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest">
            <Package2 size={14} /> Stock Situation Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Location */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <MapPin size={10} className="text-primary/60" /> Location <span className="text-rose-500">*</span>
              </Label>
              <Select onValueChange={val => {
                const loc = locations.find(l => l.id === val);
                setLocationId(val);
                setLocationName(loc?.name || val);
                setErrors(p => ({ ...p, location: '' }));
              }}>
                <SelectTrigger className={`h-11 rounded-xl bg-muted/30 border-none font-bold ${errors.location ? 'ring-2 ring-rose-500' : ''}`}>
                  <SelectValue placeholder="Select a processing line..." />
                </SelectTrigger>
                <SelectContent>
                  {locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  {locations.length === 0 && <SelectItem value="none" disabled>No processing lines found</SelectItem>}
                </SelectContent>
              </Select>
              {errors.location && <p className="text-[10px] font-bold text-rose-500 uppercase">{errors.location}</p>}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Calendar size={10} className="text-primary/60" /> Date <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="date"
                value={date}
                onChange={e => { setDate(e.target.value); setErrors(p => ({ ...p, date: '' })); }}
                className={`h-11 rounded-xl bg-muted/30 border-none font-bold ${errors.date ? 'ring-2 ring-rose-500' : ''}`}
              />
              {errors.date && <p className="text-[10px] font-bold text-rose-500 uppercase">{errors.date}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items Section */}
      <Card className="border-none shadow-lg rounded-3xl bg-white overflow-hidden">
        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/5 flex flex-row items-center justify-between">
          <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest">
            <FileText size={14} /> Items ({items.length})
          </CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={addItem}
            className="h-9 px-5 rounded-xl border-primary/20 text-primary hover:bg-primary/5 font-black text-[10px] uppercase gap-1.5">
            <Plus size={14} /> Add Item
          </Button>
        </CardHeader>
        <CardContent className="pt-6 pb-6 space-y-4">
          {items.map((item, idx) => (
            <ItemRowCard
              key={item.id}
              item={item}
              idx={idx}
              consumables={consumables || []}
              errors={errors}
              onUpdate={updateItem}
              onRemove={removeItem}
              onFile={setItemFile}
              canRemove={items.length > 1}
            />
          ))}
        </CardContent>
      </Card>

      {/* Action Bar */}
      <div className="flex items-center justify-between p-6 bg-primary/5 rounded-3xl border border-primary/10">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-primary h-5 w-5" />
          <div>
            <p className="text-sm font-black text-primary uppercase tracking-tight">Ready to Submit</p>
            <p className="text-[10px] text-primary/50 font-bold">{items.length} item(s) — {items.filter(i => i.operation === 'IN').length} IN / {items.filter(i => i.operation === 'OUT').length} OUT</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button type="button" variant="ghost" onClick={() => router.push('/quality/stock')}
            className="font-black text-muted-foreground uppercase tracking-widest hover:bg-primary/5">
            Discard
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="h-14 px-12 bg-primary hover:bg-primary/90 text-white font-black shadow-2xl shadow-primary/30 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest min-w-[260px]"
          >
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Saving...</>
            ) : 'Add Quality Stock Situation'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────
// Item Row Card
// ─────────────────────────────
function ItemRowCard({
  item, idx, consumables, errors, onUpdate, onRemove, onFile, canRemove,
}: {
  item: ItemRow;
  idx: number;
  consumables: any[];
  errors: Record<string, string>;
  onUpdate: (id: string, field: keyof ItemRow, value: any) => void;
  onRemove: (id: string) => void;
  onFile: (id: string, file: File | null) => void;
  canRemove: boolean;
}) {
  const f = (key: keyof ItemRow) => ({
    value: (item[key] as string) || '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onUpdate(item.id, key, e.target.value),
  });

  const consumableOptions = React.useMemo(() => {
    return (consumables || []).map(c => ({
      label: c.section ? `${c.name} (${c.section})` : c.name,
      value: c.id,
    }));
  }, [consumables]);

  return (
    <div className="border border-primary/10 rounded-2xl overflow-hidden hover:border-primary/20 transition-all">
      {/* Row Header */}
      <div className="flex items-center justify-between bg-primary/[0.03] px-5 py-3 border-b border-primary/5">
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center font-black text-xs text-primary">{idx + 1}</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Item #{idx + 1}</span>
          {item.operation && (
            <Badge className={`text-[9px] font-black rounded-lg px-2 border ${item.operation === 'IN' ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
              {item.operation === 'IN'
                ? <><ArrowUpCircle size={9} className="mr-1 inline" />IN</>
                : <><ArrowDownCircle size={9} className="mr-1 inline" />OUT</>
              }
            </Badge>
          )}
        </div>
        {canRemove && (
          <Button type="button" size="icon" variant="ghost" onClick={() => onRemove(item.id)}
            className="h-7 w-7 rounded-full text-rose-400 hover:bg-rose-50 hover:text-rose-600">
            <X size={14} />
          </Button>
        )}
      </div>

      {/* Fields Grid */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Operation */}
        <div className="space-y-1.5">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Operation *</Label>
          <Select value={item.operation} onValueChange={val => onUpdate(item.id, 'operation', val)}>
            <SelectTrigger className={`h-10 rounded-xl bg-muted/20 border-none font-bold text-sm ${errors[`op-${idx}`] ? 'ring-2 ring-rose-500' : ''}`}>
              <SelectValue placeholder="IN / OUT" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IN">
                <span className="flex items-center gap-2 font-black text-teal-700"><ArrowUpCircle size={14} /> IN</span>
              </SelectItem>
              <SelectItem value="OUT">
                <span className="flex items-center gap-2 font-black text-amber-700"><ArrowDownCircle size={14} /> OUT</span>
              </SelectItem>
            </SelectContent>
          </Select>
          {errors[`op-${idx}`] && <p className="text-[9px] font-bold text-rose-500 uppercase">{errors[`op-${idx}`]}</p>}
        </div>

        {/* Quantity */}
        <div className="space-y-1.5">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Quantity *</Label>
          <Input type="number" min="1" {...f('quantity')} placeholder="0" className={`h-10 rounded-xl bg-muted/20 border-none font-bold ${errors[`qty-${idx}`] ? 'ring-2 ring-rose-500' : ''}`} />
          {errors[`qty-${idx}`] && <p className="text-[9px] font-bold text-rose-500 uppercase">{errors[`qty-${idx}`]}</p>}
        </div>

        {/* Consumable */}
        <div className="space-y-1.5">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Consumable *</Label>
          <SearchableSelect
            value={item.consumableId}
            onValueChange={val => onUpdate(item.id, 'consumableId', val)}
            options={consumableOptions}
            placeholder="Select consumable..."
            searchPlaceholder="Search consumable..."
            triggerClassName={`h-10 rounded-xl bg-muted/20 border-none font-medium text-sm ${errors[`cons-${idx}`] ? 'ring-2 ring-rose-500' : ''}`}
          />
          {errors[`cons-${idx}`] && <p className="text-[9px] font-bold text-rose-500 uppercase">{errors[`cons-${idx}`]}</p>}
        </div>

        {/* Delivery Note Number */}
        <div className="space-y-1.5">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Delivery Note No.</Label>
          <Input {...f('deliveryNoteNumber')} placeholder="DN-2026-001" className="h-10 rounded-xl bg-muted/20 border-none font-medium" />
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Note</Label>
          <Input {...f('note')} placeholder="Optional note..." className="h-10 rounded-xl bg-muted/20 border-none font-medium" />
        </div>

        {/* File Upload */}
        <div className="space-y-1.5">
          <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Delivery Note File</Label>
          <label className="flex items-center gap-2 h-10 rounded-xl bg-muted/20 px-3 cursor-pointer hover:bg-primary/5 transition-all border border-transparent hover:border-primary/15 group">
            <input
              type="file"
              className="hidden"
              onChange={e => onFile(item.id, e.target.files?.[0] || null)}
            />
            <Upload size={14} className="text-primary/40 group-hover:text-primary transition-colors flex-shrink-0" />
            <span className="text-[11px] font-bold text-muted-foreground truncate group-hover:text-primary transition-colors">
              {item.filePreview || 'Upload file...'}
            </span>
            {item.file && (
              <button
                type="button"
                onClick={e => { e.preventDefault(); onFile(item.id, null); }}
                className="ml-auto h-5 w-5 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center flex-shrink-0 hover:bg-rose-200"
              >
                <X size={10} />
              </button>
            )}
          </label>
        </div>
      </div>

      {/* Consumable info strip */}
      {item.consumableName && (
        <div className="px-5 pb-4 flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-primary/40">Selected:</span>
          <span className="text-[11px] font-black text-primary bg-primary/5 rounded-lg px-2 py-0.5">{item.consumableName}</span>
          {item.section && <span className="text-[10px] text-muted-foreground/60 font-bold uppercase">— {item.section}</span>}
        </div>
      )}
    </div>
  );
}
