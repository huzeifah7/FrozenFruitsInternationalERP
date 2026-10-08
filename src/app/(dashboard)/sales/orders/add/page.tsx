'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
  useUser,
  errorEmitter,
  FirestorePermissionError
} from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn, sortProducts } from '@/lib/utils';
import { FieldError } from '@/components/ui/field-error';

const STATUS_OPTIONS = [
  { label: 'PENDING', value: 'Pending' },
  { label: 'IN-PRODUCTION', value: 'In-Production' },
  { label: 'CONFIRMED', value: 'Confirmed' },
  { label: 'SHIPPED', value: 'Shipped' },
  { label: 'CANCELLED', value: 'Canceled' },
  { label: 'PRODUCED', value: 'Produced' },
  { label: 'DELIVERED', value: 'Delivered' }
];

const STATIC_PACKAGING_OPTIONS = [
  { label: 'Carton 4kg Mavocado', value: 'Carton 4kg Mavocado' },
  { label: 'carton 10kg black', value: 'carton 10kg black' },
  { label: 'carton 4kg customized', value: 'carton 4kg customized' },
  { label: 'Plastic 10kg', value: 'Plastic 10kg' },
  { label: 'Plastic 14kg', value: 'Plastic 14kg' },
  { label: 'Plastic 16kg', value: 'Plastic 16kg' },
  { label: 'Carton 10kg Lidl', value: 'Carton 10kg Lidl' },
  { label: 'Wooden Boxes', value: 'Wooden Boxes' }
];
import { 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ShoppingCart, 
  Truck, 
  MapPin, 
  Package, 
  Layers, 
  CheckCircle2,
  Loader2,
  FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const orderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  productionLocationId: z.string().min(1, "Production location is required"),
  gpsLocation: z.string().optional(),
  description: z.string().optional(),
  etaWeek: z.coerce.number().min(1).max(53),
  status: z.string().min(1, "Status is required"),
  exportatorNumber: z.string().optional(),
  remarks: z.string().optional(),
  shippingAddressIndex: z.string().min(1, "Shipping address is required"),
  shippingMethod: z.string().min(1, "Shipping method is required"),
  brokerIndex: z.string().optional(),
  items: z.array(z.object({
    pallets: z.coerce.number().min(1),
    productId: z.string().min(1, "Product is required"),
    caliber: z.string().min(1, "Caliber is required"),
    packagingType: z.string().min(1, "Packaging is required"),
    palletType: z.string().min(1, "Pallet type is required"),
    price: z.coerce.number().min(0)
  })).min(1, "At least one item is required")
});

type OrderFormValues = z.infer<typeof orderSchema>;

export default function AddOrderPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Data Collections
  const customersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'customers');
  }, [db, user]);

  const processingLinesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'processing_lines');
  }, [db, user]);

  const productsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'products');
  }, [db, user]);

  const consumablesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'consumables');
  }, [db, user]);

  const { data: customers } = useCollection(customersQuery);
  const { data: processingLines } = useCollection(processingLinesQuery);
  const { data: products } = useCollection(productsQuery);
  const { data: consumables } = useCollection(consumablesQuery);

  const customerOptions = React.useMemo(() => {
    if (!customers) return [];
    return customers.map(c => ({
      label: c.companyName || 'Unknown Partner',
      value: c.id
    }));
  }, [customers]);

  const packagingOptions = consumables?.filter(c => c.is_packaging === true) || [];

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      status: 'Pending',
      shippingMethod: 'Truck',
      gpsLocation: '',
      description: '',
      items: [{ pallets: 1, productId: '', caliber: '', packagingType: '', palletType: 'International', price: 0 }]
    }
  });

  // Watch for processing line changes to auto-populate GPS and Description
  const selectedLineId = form.watch('productionLocationId');
  useEffect(() => {
    if (selectedLineId && processingLines) {
      const line = processingLines.find(l => l.id === selectedLineId);
      if (line) {
        form.setValue('gpsLocation', line.gpsLocation || '');
        form.setValue('description', line.description || '');
        form.setValue('exportatorNumber', line.exportatorNumber || '');
      }
    }
  }, [selectedLineId, processingLines, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items'
  });

  // Watch for customer changes to load addresses, brokers and currency
  const selectedCustomerId = form.watch('customerId');
  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);

  // Currency logic
  const getCurrencySymbol = (currency?: string) => {
    if (!currency) return '';
    const code = currency.toUpperCase();
    switch (code) {
      case 'EUR': return '€';
      case 'USD': return '$';
      case 'MAD':
      case 'DH': return 'DH';
      case 'GBP': return '£';
      default: return code;
    }
  };

  const currencySymbol = getCurrencySymbol(selectedCustomer?.currency);

  const onSubmit = async (values: OrderFormValues) => {
    if (!db || !user) return;
    setLoading(true);

    try {
      // Dynamic PO Generation Logic
      const now = new Date();
      const seasonYear = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
      const yearCode = seasonYear.toString().slice(-2);
      const nextYearCode = (seasonYear + 1).toString().slice(-2);
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('poNumber', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      
      let maxSeq = 0;
      snapshot.docs.forEach(doc => {
        const po = doc.data().poNumber;
        if (po && po.startsWith(`PO${yearCode}`)) {
          const seq = parseInt(po.substring(4));
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      });
      
      const nextSeq = (maxSeq + 1).toString().padStart(6, '0');
      const poNumber = `PO${yearCode}${nextSeq}`;

      const shippingAddr = selectedCustomer?.addresses?.[Number(values.shippingAddressIndex)];
      const brokerObj = selectedCustomer?.brokers?.[Number(values.brokerIndex)];

      const orderData = {
        ...values,
        poNumber,
        customerName: selectedCustomer?.companyName || 'Unknown',
        productionLocationName: processingLines?.find(l => l.id === values.productionLocationId)?.title || 'Unknown',
      shippingAddress: shippingAddr || {},
      broker: brokerObj || null,
      currency: selectedCustomer?.currency || 'DH',
      currencySymbol,
      progress: 0,
      createdAt: serverTimestamp(),
      createdBy: user.email,
      updatedAt: serverTimestamp()
    };

    // Replace indices with actual data for items
    const processedItems = values.items.map(item => {
      const product = products?.find(p => p.id === item.productId);
      return {
        ...item,
        productName: product?.productName || 'Unknown',
        variety: product?.variety || ''
      };
    });

    const finalOrder = {
      ...orderData,
      items: processedItems
    };

    const colRef = collection(db, 'orders');
    
      addDoc(colRef, finalOrder)
        .then(() => {
          toast({
            title: "Order Confirmed",
            description: `PO ${poNumber} has been successfully registered.`,
          });
          router.push('/sales/orders');
        })
        .catch(async (error: any) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: finalOrder
          }));
        })
        .finally(() => {
          setLoading(false);
        });
    } catch (error) {
      console.error("Error generating PO number:", error);
      toast({
        variant: "destructive",
        title: "Registration Error",
        description: "An error occurred while generating the PO number.",
      });
      setLoading(false);
    }
  };

  const onInvalid = (errors: any) => {
    console.warn("Form Validation Warnings:", errors);
    toast({
      variant: "destructive",
      title: "Validation Error",
      description: "Please check the required fields and try again.",
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/sales/orders')} className="rounded-full hover:bg-primary/10">
          <ChevronLeft className="h-5 w-5 text-primary" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-primary uppercase tracking-tight">Add New Sales Order</h1>
          <p className="text-sm text-muted-foreground font-medium">Configure fulfillment parameters, items, and logistics details.</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column: Core Details */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
              <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                <FileText size={14} /> Basic Order Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 pt-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Select Customer</Label>
                <SearchableSelect
                  value={form.watch('customerId') || ''}
                  onValueChange={(val) => form.setValue('customerId', val, { shouldValidate: true })}
                  options={customerOptions}
                  placeholder="Choose a partner..."
                  triggerClassName={cn(
                    "h-11 rounded-xl bg-muted/30 border-none font-medium text-primary focus:ring-2 focus:ring-primary/10",
                    form.formState.errors.customerId && "ring-2 ring-rose-500"
                  )}
                />
                <FieldError message={form.formState.errors.customerId?.message} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">ETA Week</Label>
                <Input type="number" {...form.register('etaWeek')} error={!!form.formState.errors.etaWeek} placeholder="e.g. 42" className={`h-11 rounded-xl bg-muted/30 border-none font-medium ${form.formState.errors.etaWeek ? 'ring-2 ring-rose-500' : ''}`} />
                <FieldError message={form.formState.errors.etaWeek?.message || (form.formState.errors.etaWeek ? 'Must be 1-53' : '')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Initial Status</Label>
                    <SearchableSelect
                      value={form.watch('status') || 'Pending'}
                      onValueChange={(val) => form.setValue('status', val)}
                      options={STATUS_OPTIONS}
                      placeholder="Select"
                      triggerClassName="h-11 rounded-xl bg-muted/30 border-none font-medium text-primary focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Exportator Number</Label>
                    <Input {...form.register('exportatorNumber')} placeholder="ID-9922..." className="h-11 rounded-xl bg-muted/30 border-none font-medium" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Internal Remarks</Label>
                  <Textarea {...form.register('remarks')} placeholder="Logistics notes or production specifics..." className="min-h-[100px] rounded-2xl bg-muted/30 border-none font-medium" />
                </div>
              </CardContent>
            </Card>

            {/* Processing Lines Section */}
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
              <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                  <MapPin size={14} /> Add Processing Lines
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 pt-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Select Location</Label>
                  <Select onValueChange={(val) => form.setValue('productionLocationId', val, { shouldValidate: true })} value={form.watch('productionLocationId')}>
                    <SelectTrigger error={!!form.formState.errors.productionLocationId} className={`h-11 rounded-xl bg-muted/30 border-none font-medium ${form.formState.errors.productionLocationId ? 'ring-2 ring-rose-500' : ''}`}>
                      <SelectValue placeholder="Select facility" />
                    </SelectTrigger>
                    <SelectContent>
                      {processingLines?.map(l => <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FieldError message={form.formState.errors.productionLocationId?.message} />
                </div>


              </CardContent>
            </Card>
          </div>

          {/* Right Column: Logistics */}
          <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-accent/5 pb-4">
              <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                <Truck size={14} /> Shipping & Logistics
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 pt-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Shipping Address</Label>
                <Select onValueChange={(val) => form.setValue('shippingAddressIndex', val, { shouldValidate: true })}>
                  <SelectTrigger error={!!form.formState.errors.shippingAddressIndex} className={`h-11 rounded-xl bg-muted/30 border-none font-medium ${form.formState.errors.shippingAddressIndex ? 'ring-2 ring-rose-500' : ''}`}>
                    <SelectValue placeholder={selectedCustomerId ? "Select from customer addresses" : "Select a customer first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCustomer?.addresses?.map((addr: any, idx: number) => (
                      addr.type === 'Shipping' ? (
                        <SelectItem key={idx} value={idx.toString()}>
                          {addr.name || 'Site'} - {addr.street}, {addr.city}, {addr.country}
                        </SelectItem>
                      ) : null
                    ))}
                    {!selectedCustomer?.addresses?.length && <SelectItem value="none" disabled>No addresses available</SelectItem>}
                  </SelectContent>
                </Select>
                <FieldError message={form.formState.errors.shippingAddressIndex?.message || (form.formState.errors.shippingAddressIndex ? 'Address is required' : '')} />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Shipping Method</Label>
                <Select onValueChange={(val) => form.setValue('shippingMethod', val)} defaultValue="Truck">
                  <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Truck', 'Container', 'Freight'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Authorized Broker</Label>
                <Select onValueChange={(val) => form.setValue('brokerIndex', val)}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-medium">
                    <SelectValue placeholder={selectedCustomerId ? "Select from customer brokers" : "Select a customer first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCustomer?.brokers?.map((broker: any, idx: number) => (
                      <SelectItem key={idx} value={idx.toString()}>{broker.name}</SelectItem>
                    ))}
                    {!selectedCustomer?.brokers?.length && <SelectItem value="none" disabled>No brokers available</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items Table Section */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between bg-primary/5 pb-4">
            <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
              <Package size={14} /> Order Items
            </CardTitle>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => {
                const currentItems = form.getValues('items') || [];
                const lastItem = currentItems[currentItems.length - 1] || { pallets: 1, productId: '', caliber: '', packagingType: '', palletType: 'International', price: 0 };
                append({
                  pallets: '' as any,
                  productId: lastItem.productId,
                  caliber: lastItem.caliber,
                  packagingType: lastItem.packagingType,
                  palletType: lastItem.palletType,
                  price: lastItem.price
                });
              }}
              className="gap-2 border-primary/20 text-primary hover:bg-primary/5 rounded-full px-4 h-9 font-bold"
            >
              <Plus size={14} /> ADD ITEM
            </Button>
          </CardHeader>
          <CardContent className="pt-6 px-0">
            <div className="overflow-x-auto px-6">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="border-b border-muted/50">
                    <th className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest p-3">Count Pallet</th>
                    <th className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest p-3">Product Variety</th>
                    <th className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest p-3">Caliber</th>
                    <th className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest p-3">Packaging</th>
                    <th className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest p-3">Pallet Type</th>
                    <th className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest p-3">Unit Price</th>
                    <th className="w-[50px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/30">
                  {fields.map((field, index) => (
                    <tr key={field.id} className="group hover:bg-muted/5 transition-colors">
                      <td className="p-2 w-[120px]">
                        <Input type="number" {...form.register(`items.${index}.pallets`)} error={!!form.formState.errors.items?.[index]?.pallets} className="h-10 rounded-xl bg-muted/20 border-none font-bold" />
                        <FieldError message={form.formState.errors.items?.[index]?.pallets?.message} />
                      </td>
                      <td className="p-2 min-w-[200px]">
                        <Select onValueChange={(val) => form.setValue(`items.${index}.productId`, val, { shouldValidate: true })} value={form.watch(`items.${index}.productId`) || ''}>
                          <SelectTrigger error={!!form.formState.errors.items?.[index]?.productId} className={`h-10 rounded-xl bg-muted/20 border-none shadow-none font-medium ${form.formState.errors.items?.[index]?.productId ? 'ring-2 ring-rose-500' : ''}`}>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            {sortProducts(products || [])?.map(p => <SelectItem key={p.id} value={p.id}>{p.productName} - {p.category} - {p.type}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FieldError message={form.formState.errors.items?.[index]?.productId?.message || (form.formState.errors.items?.[index]?.productId ? 'Required' : '')} />
                      </td>
                      <td className="p-2 w-[120px]">
                        <Input {...form.register(`items.${index}.caliber`)} error={!!form.formState.errors.items?.[index]?.caliber} placeholder="e.g. 12" className={`h-10 rounded-xl bg-muted/20 border-none ${form.formState.errors.items?.[index]?.caliber ? 'ring-2 ring-rose-500' : ''}`} />
                        <FieldError message={form.formState.errors.items?.[index]?.caliber?.message} />
                      </td>
                      <td className="p-2 min-w-[180px]">
                        <SearchableSelect
                          value={form.watch(`items.${index}.packagingType`)}
                          onValueChange={(val) => form.setValue(`items.${index}.packagingType`, val, { shouldValidate: true })}
                          options={STATIC_PACKAGING_OPTIONS}
                          placeholder="Select"
                          triggerClassName={cn(
                            "h-10 rounded-xl bg-muted/20 border-none shadow-none font-medium text-primary w-full focus:ring-2 focus:ring-primary/10",
                            form.formState.errors.items?.[index]?.packagingType ? 'ring-2 ring-rose-500' : ''
                          )}
                        />
                        <FieldError message={form.formState.errors.items?.[index]?.packagingType?.message || (form.formState.errors.items?.[index]?.packagingType ? 'Required' : '')} />
                      </td>
                      <td className="p-2 w-[150px]">
                        <Select onValueChange={(val) => form.setValue(`items.${index}.palletType`, val)} value={form.watch(`items.${index}.palletType`) || ''}>
                          <SelectTrigger className="h-10 rounded-xl bg-muted/20 border-none shadow-none"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {['International', 'Euro', 'Standards'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2 w-[150px]">
                        <div className="relative">
                          <Input type="number" step="0.01" {...form.register(`items.${index}.price`)} error={!!form.formState.errors.items?.[index]?.price} className="h-10 rounded-xl bg-muted/20 border-none font-bold pr-10" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground opacity-60 uppercase">
                            {currencySymbol || 'DH'}
                          </span>
                        </div>
                        <FieldError message={form.formState.errors.items?.[index]?.price?.message} />
                      </td>
                      <td className="p-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => remove(index)} 
                          className="h-9 w-9 text-rose-500 hover:bg-rose-50 rounded-full"
                          disabled={fields.length === 1}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Action Bar */}
        <div className="flex items-center justify-between p-6 bg-emerald-50 rounded-3xl border border-emerald-100 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-500 h-5 w-5" />
            <p className="text-sm font-bold text-emerald-800 uppercase tracking-tight">Order Configuration Finalized</p>
          </div>
          <div className="flex items-center gap-6">
            <Button type="button" variant="ghost" onClick={() => router.push('/sales/orders')} className="font-bold text-muted-foreground uppercase tracking-widest hover:bg-emerald-100">
              Discard Changes
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="h-14 px-12 bg-primary hover:bg-primary/90 text-white font-bold shadow-2xl shadow-primary/30 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest min-w-[240px]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating PO...
                </>
              ) : 'Confirm & Register Order'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}