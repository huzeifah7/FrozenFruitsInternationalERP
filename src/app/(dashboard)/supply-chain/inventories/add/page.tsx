'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  addDoc,
  serverTimestamp,
} from '@/firebase/firestore-override';
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  Loader2,
  Plus,
  Trash2,
  Package2,
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const inventoryMovementSchema = z.object({
  date: z.string().min(1, "Date is required"),
  locationName: z.string().min(1, "Location is required"),
  items: z.array(z.object({
    consumableId: z.string().min(1, "Required"),
    operation: z.enum(['IN', 'OUT']),
    quantity: z.coerce.number().min(1, "Must be at least 1"),
  })).min(1, "At least one item is required"),
});

type InventoryFormValues = z.infer<typeof inventoryMovementSchema>;

export default function AddInventoryMovementPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Fetch Consumables for selection
  const consumablesQuery = useMemoFirebase(() => db ? collection(db, 'consumables') : null, [db]);
  const { data: consumables } = useCollection(consumablesQuery);

  const form = useForm<InventoryFormValues>({
    resolver: zodResolver(inventoryMovementSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      locationName: 'Main Store',
      items: [{ consumableId: '', operation: 'IN', quantity: 0 }],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const onSubmit = async (values: InventoryFormValues) => {
    if (!db || !user) return;
    setLoading(true);

    try {
      const movementData = {
        ...values,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.email,
        updatedBy: user.email,
        // Include consumable names for easy display
        items: values.items.map(item => ({
          ...item,
          consumableName: consumables?.find(c => c.id === item.consumableId)?.name || 'Unknown',
        }))
      };

      await addDoc(collection(db, 'supply_chain_stock'), movementData);

      toast({
        title: "Success",
        description: "Stock adjustment recorded successfully.",
      });
      router.push('/supply-chain/inventories');
    } catch (error) {
      console.error("Error adding stock movement:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to record stock movement.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push('/supply-chain/inventories')}
          className="rounded-full hover:bg-primary/5 text-primary/40 hover:text-primary transition-all"
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="space-y-1">
          <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-2">
              <li>Inventories</li>
              <li className="flex items-center">
                <span className="mx-2 opacity-20">/</span>
                <span className="text-primary/60 font-black uppercase">Adjust Stock</span>
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Record Movements</h1>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-20">
        {/* Header Section */}
        <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden border border-primary/5">
           <div className="bg-primary/[0.02] px-10 py-6 border-b border-primary/5">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">General Information</h2>
          </div>
          <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 flex items-center gap-2">
                <Calendar className="size-3" /> Operation Date
              </Label>
              <Input 
                type="date"
                {...form.register('date')}
                className="h-14 rounded-2xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-6"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 flex items-center gap-2">
                <MapPin className="size-3" /> Storage Location
              </Label>
              <Select 
                defaultValue="Main Store"
                onValueChange={(val) => form.setValue('locationName', val)}
              >
                <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-none font-bold text-primary px-6">
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                  <SelectItem value="Main Store" className="font-bold py-3 rounded-xl">Main Store (Agadir)</SelectItem>
                  <SelectItem value="Packaging Unit" className="font-bold py-3 rounded-xl">Packaging Unit</SelectItem>
                  <SelectItem value="Cold Store" className="font-bold py-3 rounded-xl">Cold Store</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Items Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Movement Items</h3>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => append({ consumableId: '', operation: 'IN', quantity: 0 })}
              className="rounded-xl border-primary/10 text-primary font-bold gap-2 hover:bg-primary/5"
            >
              <Plus size={14} /> Add Line
            </Button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <Card key={field.id} className="border-none shadow-lg rounded-[2rem] bg-white overflow-hidden border border-primary/5 animate-in slide-in-from-bottom-2 duration-300">
                <div className="p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                  <div className="md:col-span-5 space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Consumable Item</Label>
                    <Select 
                      onValueChange={(val) => form.setValue(`items.${index}.consumableId`, val)}
                    >
                      <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-none font-bold text-primary px-6">
                        <SelectValue placeholder="Choose consumable..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                        {consumables?.map(c => (
                          <SelectItem key={c.id} value={c.id} className="font-bold py-3 rounded-xl">
                            {c.name} {c.is_packaging ? '(PKG)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Operation</Label>
                    <div className="flex bg-muted/30 p-1 rounded-2xl h-14">
                      <button
                        type="button"
                        onClick={() => form.setValue(`items.${index}.operation`, 'IN')}
                        className={cn(
                          "flex-1 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all",
                          form.watch(`items.${index}.operation`) === 'IN' 
                            ? "bg-emerald-500 text-white shadow-lg" 
                            : "text-muted-foreground/40 hover:text-primary/60"
                        )}
                      >
                        <ArrowUpCircle size={14} /> Stock IN
                      </button>
                      <button
                        type="button"
                        onClick={() => form.setValue(`items.${index}.operation`, 'OUT')}
                        className={cn(
                          "flex-1 rounded-xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all",
                          form.watch(`items.${index}.operation`) === 'OUT' 
                            ? "bg-rose-500 text-white shadow-lg" 
                            : "text-muted-foreground/40 hover:text-primary/60"
                        )}
                      >
                        <ArrowDownCircle size={14} /> Stock OUT
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Quantity</Label>
                    <Input 
                      type="number"
                      {...form.register(`items.${index}.quantity`)}
                      className="h-14 rounded-2xl bg-muted/30 border-none font-black text-xl tracking-tighter text-primary px-6"
                    />
                  </div>

                  <div className="md:col-span-1 flex justify-center pb-2">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      disabled={fields.length === 1}
                      onClick={() => remove(index)}
                      className="h-12 w-12 rounded-2xl text-rose-500/40 hover:text-rose-500 hover:bg-rose-50 transition-all"
                    >
                      <Trash2 size={20} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-8 border-t border-primary/5">
          <div className="flex items-center gap-4 text-muted-foreground/40 italic text-sm">
            <Package2 size={24} />
            <p>Ensure quantities reflect physical warehouse counts.</p>
          </div>
          <div className="flex gap-4">
             <Button 
              type="button" 
              variant="ghost"
              onClick={() => router.back()}
              className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] text-primary/40"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="h-14 px-12 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.2em] text-[10px] gap-3"
            >
              {loading ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Processing...</>
              ) : (
                <>Validate Movements</>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
