'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from '@/firebase/firestore-override';
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  Loader2,
  Package2,
  AlertTriangle,
  BarChart2,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FieldError } from '@/components/ui/field-error';
import { MultiSelect } from '@/components/ui/multi-select';

const consumableSchema = z.object({
  name: z.string().min(1, "Name is required"),
  critical_level: z.coerce.number().min(0, "Must be positive"),
  average_level: z.coerce.number().min(0, "Must be positive"),
  description: z.string().optional(),
  is_packaging: z.boolean().default(false),
  weight_per_unit: z.coerce.number().min(0, "Must be positive").optional(),
  feuillardConsumptionPerPallet: z.coerce.number().min(0, "Must be positive").optional(),
  suppliers: z.array(z.string()).optional(),
});

type ConsumableFormValues = z.infer<typeof consumableSchema>;

export default function AddConsumablePage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Fetch Suppliers for the multi-select
  const rawSuppliersQuery = useMemoFirebase(() => db ? collection(db, 'suppliers') : null, [db]);
  const procSuppliersQuery = useMemoFirebase(() => db ? collection(db, 'procurement_suppliers') : null, [db]);
  const scSuppliersQuery = useMemoFirebase(() => db ? collection(db, 'supply_chain_suppliers') : null, [db]);

  const { data: rawSuppliers } = useCollection(rawSuppliersQuery);
  const { data: procSuppliers } = useCollection(procSuppliersQuery);
  const { data: scSuppliers } = useCollection(scSuppliersQuery);

  const suppliersOptions = React.useMemo(() => {
    const map = new Map<string, any>();
    (rawSuppliers || []).forEach(s => {
      const name = s.name || s.supplierName || '';
      if (name) map.set(name, { label: name, value: name });
    });
    (procSuppliers || []).forEach(s => {
      const name = s.name || s.supplierName || '';
      if (name) map.set(name, { label: name, value: name });
    });
    (scSuppliers || []).forEach(s => {
      const name = s.name || s.supplierName || '';
      if (name) map.set(name, { label: name, value: name });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [rawSuppliers, procSuppliers, scSuppliers]);

  const form = useForm<ConsumableFormValues>({
    resolver: zodResolver(consumableSchema),
    defaultValues: {
      name: '',
      critical_level: 0,
      average_level: 0,
      description: '',
      is_packaging: false,
      weight_per_unit: 0,
      feuillardConsumptionPerPallet: 0,
      suppliers: [],
    }
  });

  const onSubmit = async (values: ConsumableFormValues) => {
    if (!db || !user) return;
    setLoading(true);

    try {
      const normalizedName = values.name.trim().toLowerCase().replace(/\s+/g, ' ');

      // Duplicate check
      const q = query(collection(db, 'consumables'), where('normalizedName', '==', normalizedName));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Consumable name already exists.",
        });
        setLoading(false);
        return;
      }

      const consumableData = {
        ...values,
        normalizedName,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by: user.email,
        updated_by: user.email,
      };

      await addDoc(collection(db, 'consumables'), consumableData);

      toast({
        title: "Success",
        description: "Consumable has been added successfully.",
      });
      router.push('/supply-chain/consumables');
    } catch (error) {
      console.error("Error adding consumable:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add consumable. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6 animate-in fade-in duration-700">
      {/* Header & Breadcrumb */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/supply-chain/consumables')}
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
                Consumables
              </li>
              <li className="flex items-center">
                <span className="mx-2 opacity-20">/</span>
                <span className="text-primary/60 font-black">Add Consumable</span>
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Add Consumable</h1>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-20">
        <div className="bg-white rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden">
          <div className="bg-primary/[0.02] px-8 py-4 border-b border-primary/5 flex items-center justify-between">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">Consumable Specifications</h2>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-primary/5 shadow-sm">
              <Checkbox
                id="is_packaging"
                checked={form.watch('is_packaging')}
                onCheckedChange={(checked) => form.setValue('is_packaging', !!checked)}
                className="rounded-md border-primary/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <Label htmlFor="is_packaging" className="text-[10px] font-black uppercase tracking-widest text-primary cursor-pointer">Packaging Material</Label>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Consumable Name */}
              <div className="md:col-span-2 space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Consumable Name</Label>
                <div className="relative group">
                  <Package2 className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-primary/20 group-focus-within:text-primary transition-colors" />
                  <Input
                    {...form.register('name')}
                    error={!!form.formState.errors.name}
                    placeholder="e.g. Carton 4Kg Mavocado, Plastic Boxes 10kg..."
                    className="pl-12 h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all"
                  />
                </div>
                <FieldError message={form.formState.errors.name?.message} />
              </div>

              {/* Levels */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 flex items-center gap-2">
                  <AlertTriangle className="size-3 text-rose-500" /> Critical Level
                </Label>
                <Input
                  type="number"
                  {...form.register('critical_level')}
                  error={!!form.formState.errors.critical_level}
                  className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-4"
                />
                <FieldError message={form.formState.errors.critical_level?.message} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 flex items-center gap-2">
                  <BarChart2 className="size-3 text-amber-500" /> Average Level
                </Label>
                <Input
                  type="number"
                  {...form.register('average_level')}
                  error={!!form.formState.errors.average_level}
                  className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-4"
                />
                <FieldError message={form.formState.errors.average_level?.message} />
              </div>

              {form.watch('is_packaging') && (
                <div className="md:col-span-2 space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1 flex items-center gap-2">
                    <Package2 className="size-3" /> Standard Weight per Unit (kg)
                  </Label>
                  <Input
                    type="number"
                    step="0.001"
                    {...form.register('weight_per_unit')}
                    error={!!form.formState.errors.weight_per_unit}
                    placeholder="e.g. 0.450"
                    className="h-12 rounded-xl bg-primary/5 border-primary/10 font-black text-primary focus-visible:ring-2 focus-visible:ring-primary/20 transition-all px-4"
                  />
                  <FieldError message={form.formState.errors.weight_per_unit?.message} />
                  <p className="text-[9px] font-bold text-muted-foreground/40 ml-1 uppercase tracking-wider italic">This weight will be used to calculate theoretical yields in production.</p>
                </div>
              )}

              {form.watch('name')?.toLowerCase().includes('feuillard') && (
                <div className="md:col-span-2 space-y-2 animate-in slide-in-from-top-2 duration-300">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-emerald-600 ml-1 flex items-center gap-2">
                    <Package2 className="size-3" /> Feuillard Consumption Per Pallet (kg)
                  </Label>
                  <Input
                    type="number"
                    step="0.001"
                    {...form.register('feuillardConsumptionPerPallet')}
                    error={!!form.formState.errors.feuillardConsumptionPerPallet}
                    placeholder="e.g. 0.207"
                    className="h-12 rounded-xl bg-emerald-50 border-emerald-100 font-black text-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-200 transition-all px-4"
                  />
                  <FieldError message={form.formState.errors.feuillardConsumptionPerPallet?.message} />
                  <p className="text-[9px] font-bold text-emerald-600/60 ml-1 uppercase tracking-wider italic">This weight will be used to automatically calculate Feuillard consumption during Production Output.</p>
                </div>
              )}

              {/* Suppliers - MultiSelect Dropdown */}
              <div className="md:col-span-2 space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1 flex items-center gap-2">
                  <Users className="size-3" /> Associated Suppliers
                </Label>
                <MultiSelect
                  selected={form.watch('suppliers') || []}
                  onChange={(val) => form.setValue('suppliers', val, { shouldValidate: true })}
                  options={suppliersOptions}
                  placeholder="Select associated suppliers..."
                  searchPlaceholder="Search suppliers..."
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2 space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Technical Description</Label>
                <Textarea
                  {...form.register('description')}
                  className="min-h-[120px] rounded-[2rem] bg-muted/30 border-none font-bold text-primary p-6 focus-visible:ring-2 focus-visible:ring-primary/10 transition-all"
                  placeholder="Enter specifications, dimensions, or usage requirements..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={loading}
            className="h-14 px-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-xl shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-[0.2em] text-[10px]"
          >
            {loading ? (
              <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> REGISTERING...</>
            ) : 'Register Consumable'}
          </Button>
        </div>
      </form>
    </div>
  );
}
