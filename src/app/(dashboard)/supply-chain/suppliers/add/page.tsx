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
import { useToast } from '@/hooks/use-toast';
import {
  ChevronLeft,
  Loader2,
  Package,
  Plus,
  Trash2,
  Coins,
  Euro,
  DollarSign,
  PoundSterling,
} from 'lucide-react';
import { FieldError } from '@/components/ui/field-error';

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  supplier_type: z.string().optional(),
  currency: z.string().optional(),
  address: z.string().optional(),
  phone_number: z.string().optional(),
  contact_person: z.string().optional(),
  bank_number: z.string().optional(),
  bank_name: z.string().optional(),
  IF: z.string().optional(),
  ICE: z.string().optional(),
  note: z.string().optional(),
  transport_items: z.array(z.object({
    designation: z.string().min(1, "Designation is required"),
    price: z.coerce.number({ invalid_type_error: "Must be a number" }).min(0.01, "Price must be > 0"),
    currency: z.string().min(1, "Currency is required"),
  })).optional(),
}).superRefine((data, ctx) => {
  const isTransport = data.supplier_type === 'Transport' || data.supplier_type?.toLowerCase().includes('transport');
  if (isTransport) {
    if (!data.transport_items || data.transport_items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least 1 transport destination is required for Transport suppliers",
        path: ["transport_items"],
      });
    }
  }
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

export default function AddSupplierPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      supplier_type: '',
      currency: 'MAD',
      address: '',
      phone_number: '',
      contact_person: '',
      bank_number: '',
      bank_name: '',
      IF: '',
      ICE: '',
      note: '',
      transport_items: [],
    }
  });

  const { fields: transportItems, append: appendTransportItem, remove: removeTransportItem } = useFieldArray({
    control: form.control,
    name: "transport_items"
  });

  const selectedSupplierType = form.watch('supplier_type');

  // Handle supplier type change
  const handleSupplierTypeChange = (val: string) => {
    form.setValue('supplier_type', val, { shouldValidate: true });
    if (val === 'Transport' && transportItems.length === 0) {
      appendTransportItem({ designation: '', price: 0, currency: 'MAD' });
    } else if (val !== 'Transport') {
      form.setValue('transport_items', []);
    }
  };

  const onSubmit = async (values: SupplierFormValues) => {
    if (!db || !user) return;
    setLoading(true);

    try {
      const supplierData = {
        ...values,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by: user.email,
        updated_by: user.email,
      };

      if (values.supplier_type !== 'Transport') {
        delete supplierData.transport_items;
      }

      await addDoc(collection(db, 'suppliers'), supplierData);

      toast({
        title: "Success",
        description: "Supplier has been added successfully.",
      });
      router.push('/supply-chain/suppliers');
    } catch (error) {
      console.error("Error adding supplier:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add supplier. Please try again.",
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
          onClick={() => router.push('/supply-chain/suppliers')}
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
                Suppliers
              </li>
              <li className="flex items-center">
                <span className="mx-2 opacity-20">/</span>
                <span className="text-primary/60 font-black">Add Supplier</span>
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Add Supplier</h1>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-20">
        <div className="bg-white rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden">
          <div className="bg-primary/[0.02] px-8 py-4 border-b border-primary/5">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">Supplier Information</h2>
          </div>
          
          <div className="p-8 space-y-6">
            {/* Row 1: Name, Type & Currency */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Supplier Name</Label>
                <Input 
                  {...form.register('name')} 
                  error={!!form.formState.errors.name}
                  placeholder="Enter supplier name"
                  className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-4" 
                />
                <FieldError message={form.formState.errors.name?.message} />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Supplier Type</Label>
                <Select onValueChange={handleSupplierTypeChange} value={selectedSupplierType}>
                  <SelectTrigger error={!!form.formState.errors.supplier_type} className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 text-left">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                    <SelectItem value="Packaging" className="rounded-xl font-bold py-3">Packaging</SelectItem>
                    <SelectItem value="Transit" className="rounded-xl font-bold py-3">Transit</SelectItem>
                    <SelectItem value="Office" className="rounded-xl font-bold py-3">Office</SelectItem>
                    <SelectItem value="Transport" className="rounded-xl font-bold py-3">Transport</SelectItem>
                    <SelectItem value="Others" className="rounded-xl font-bold py-3">Others</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError message={form.formState.errors.supplier_type?.message} />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Currency</Label>
                <Select onValueChange={(val) => form.setValue('currency', val, { shouldValidate: true })} value={form.watch('currency')}>
                  <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 text-left">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                    <SelectItem value="MAD" className="rounded-xl font-bold py-3">
                      <div className="flex items-center gap-2">
                        <Coins className="h-4 w-4 text-primary/60" />
                        <span>MAD</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="EURO" className="rounded-xl font-bold py-3">
                      <div className="flex items-center gap-2">
                        <Euro className="h-4 w-4 text-primary/60" />
                        <span>EURO</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Dollar" className="rounded-xl font-bold py-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary/60" />
                        <span>Dollar</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="Pound" className="rounded-xl font-bold py-3">
                      <div className="flex items-center gap-2">
                        <PoundSterling className="h-4 w-4 text-primary/60" />
                        <span>Pound</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FieldError message={form.formState.errors.currency?.message} />
              </div>
            </div>

            {/* Row 2: Address */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Address</Label>
              <Input 
                {...form.register('address')} 
                error={!!form.formState.errors.address}
                placeholder="Full street address"
                className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-4" 
              />
              <FieldError message={form.formState.errors.address?.message} />
            </div>

            {/* Row 3: Phone & Contact */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Phone Number</Label>
                <Input 
                  {...form.register('phone_number')} 
                  error={!!form.formState.errors.phone_number}
                  placeholder="+212 ..."
                  className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-4" 
                />
                <FieldError message={form.formState.errors.phone_number?.message} />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Contact Person</Label>
                <Input 
                  {...form.register('contact_person')} 
                  error={!!form.formState.errors.contact_person}
                  placeholder="Full name"
                  className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-4" 
                />
                <FieldError message={form.formState.errors.contact_person?.message} />
              </div>
            </div>

            {/* Row 4: Bank Number & Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Bank Account Number (RIB)</Label>
                <Input 
                  {...form.register('bank_number')} 
                  placeholder="24 digits"
                  className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-4" 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Bank Name</Label>
                <Input 
                  {...form.register('bank_name')} 
                  placeholder="e.g. Attijariwafa"
                  className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-4" 
                />
              </div>
            </div>

            {/* Row 5: IF & ICE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">IF (Identifiant Fiscal)</Label>
                <Input 
                  {...form.register('IF')} 
                  className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-4" 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">ICE</Label>
                <Input 
                  {...form.register('ICE')} 
                  className="h-12 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-4" 
                />
              </div>
            </div>

            {selectedSupplierType === 'Transport' && (
              <div className="pt-6 border-t border-primary/5 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">Add Items</h3>
                  <Button 
                    type="button" 
                    onClick={() => appendTransportItem({ designation: '', price: 0, currency: 'MAD' })}
                    className="h-8 w-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary p-0 flex items-center justify-center transition-all"
                  >
                    <Plus className="h-4 w-4 stroke-[3]" />
                  </Button>
                </div>
                
                {form.formState.errors.transport_items?.root && (
                  <p className="text-[10px] font-bold text-destructive uppercase tracking-widest">{form.formState.errors.transport_items.root.message}</p>
                )}

                <div className="space-y-4">
                  {transportItems.map((item, index) => (
                    <div key={item.id} className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-muted/10 p-4 rounded-xl border border-primary/5">
                      <div className="space-y-1.5 flex-1 w-full">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Designation</Label>
                        <Input 
                          {...form.register(`transport_items.${index}.designation` as const)} 
                          placeholder="Route or service name"
                          error={!!form.formState.errors.transport_items?.[index]?.designation}
                          className="h-10 rounded-lg bg-white border-primary/10 font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-3" 
                        />
                        <FieldError message={form.formState.errors.transport_items?.[index]?.designation?.message} />
                      </div>
                      
                      <div className="space-y-1.5 w-full md:w-[150px]">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Price</Label>
                        <Input 
                          type="number"
                          step="0.01"
                          {...form.register(`transport_items.${index}.price` as const)} 
                          placeholder="0.00"
                          error={!!form.formState.errors.transport_items?.[index]?.price}
                          className="h-10 rounded-lg bg-white border-primary/10 font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-3" 
                        />
                        <FieldError message={form.formState.errors.transport_items?.[index]?.price?.message} />
                      </div>
                      
                      <div className="space-y-1.5 w-full md:w-[120px]">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Currency</Label>
                        <Select 
                          onValueChange={(val) => form.setValue(`transport_items.${index}.currency`, val, { shouldValidate: true })} 
                          value={form.watch(`transport_items.${index}.currency`)}
                        >
                          <SelectTrigger error={!!form.formState.errors.transport_items?.[index]?.currency} className="h-10 rounded-lg bg-white border-primary/10 font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all px-3 text-left">
                            <SelectValue placeholder="Currency" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-primary/5 shadow-xl">
                            <SelectItem value="MAD" className="font-bold">MAD</SelectItem>
                            <SelectItem value="EUR" className="font-bold">EUR</SelectItem>
                            <SelectItem value="USD" className="font-bold">USD</SelectItem>
                            <SelectItem value="GBP" className="font-bold">GBP</SelectItem>
                          </SelectContent>
                        </Select>
                        <FieldError message={form.formState.errors.transport_items?.[index]?.currency?.message} />
                      </div>
                      
                      <div className="pt-5 md:pt-6">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          onClick={() => removeTransportItem(index)}
                          className="h-10 w-10 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-0 flex items-center justify-center transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Row 6: Note */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Note</Label>
              <Textarea 
                {...form.register('note')} 
                placeholder="Internal notes about this supplier..."
                className="min-h-[120px] rounded-2xl bg-muted/30 border-none font-bold text-primary p-4 focus-visible:ring-2 focus-visible:ring-primary/10 transition-all" 
              />
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
              <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> SAVING...</>
            ) : 'Save Supplier'}
          </Button>
        </div>
      </form>
    </div>
  );
}
