'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Plus,
  Trash2,
  ChevronLeft,
  Truck,
  Package,
  Layers,
  CheckCircle2,
  Loader2,
  FileText,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/components/auth-provider';

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

export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { role: userRole } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [originalPoNumber, setOriginalPoNumber] = useState('');

  const isProduction = userRole === 'production';
  const canEditAll = userRole === 'sales' || userRole === 'admin';

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

  const selectedCustomerId = form.watch('customerId');
  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);

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

  // Fetch existing order and populate form
  useEffect(() => {
    if (!db || !orderId) return;
    const fetchOrder = async () => {
      setFetching(true);
      try {
        const docRef = doc(db, 'orders', orderId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          setFetchError(true);
          return;
        }
        const data = snap.data();
        setOriginalPoNumber(data.poNumber || '');

        form.reset({
          customerId: data.customerId || '',
          productionLocationId: data.productionLocationId || '',
          etaWeek: data.etaWeek || 1,
          status: data.status || 'Pending',
          exportatorNumber: data.exportatorNumber || '',
          remarks: data.remarks || '',
          shippingAddressIndex: data.shippingAddressIndex?.toString() || '0',
          shippingMethod: data.shippingMethod || 'Truck',
          brokerIndex: data.brokerIndex?.toString() || '',
          items: data.items?.map((item: any) => ({
            pallets: item.pallets || 1,
            productId: item.productId || '',
            caliber: item.caliber || '',
            packagingType: item.packagingType || '',
            palletType: item.palletType || 'International',
            price: item.price || 0,
          })) || [{ pallets: 1, productId: '', caliber: '', packagingType: '', palletType: 'International', price: 0 }]
        });
      } catch (error) {
        console.error('Error fetching order:', error);
        setFetchError(true);
      } finally {
        setFetching(false);
      }
    };
    fetchOrder();
  }, [db, orderId]);

  const onSubmit = async (values: OrderFormValues) => {
    if (!db || !user) return;
    setLoading(true);

    try {
      let updateData: any = {};

      if (isProduction) {
        updateData = {
          status: values.status,
          updatedAt: serverTimestamp(),
          updatedBy: user.email,
          updatedByName: user.displayName || user.email?.split('@')[0],
        };
      } else {
        const shippingAddr = selectedCustomer?.addresses?.[Number(values.shippingAddressIndex)];
        const brokerObj = values.brokerIndex ? selectedCustomer?.brokers?.[Number(values.brokerIndex)] : null;

        const processedItems = values.items.map(item => {
          const product = products?.find(p => p.id === item.productId);
          return {
            ...item,
            productName: product?.productName || 'Unknown',
            variety: product?.variety || ''
          };
        });

        updateData = {
          ...values,
          customerName: selectedCustomer?.companyName || 'Unknown',
          productionLocationName: processingLines?.find(l => l.id === values.productionLocationId)?.title || 'Unknown',
          shippingAddress: shippingAddr || {},
          broker: brokerObj || null,
          currency: selectedCustomer?.currency || 'DH',
          currencySymbol,
          items: processedItems,
          updatedAt: serverTimestamp(),
          updatedBy: user.email,
          updatedByName: user.displayName || user.email?.split('@')[0],
        };
      }

      const docRef = doc(db, 'orders', orderId);
      await updateDoc(docRef, updateData).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
        }));
        throw err;
      });

      toast({
        title: "Order Updated",
        description: `${originalPoNumber} has been successfully updated.`,
      });
      router.push('/sales/orders');
    } catch (error) {
      console.error("Error updating order:", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "An error occurred while saving the changes.",
      });
    } finally {
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

  if (fetchError) {
    return (
      <div className="p-12 flex flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="h-16 w-16 text-rose-400" />
        <h2 className="text-xl font-bold text-primary">Order Not Found</h2>
        <p className="text-muted-foreground">The order you are trying to edit does not exist or has been deleted.</p>
        <Button onClick={() => router.push('/sales/orders')} className="mt-4">Back to Orders</Button>
      </div>
    );
  }

  if (fetching) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
        </div>
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.push('/sales/orders')} className="rounded-full hover:bg-primary/10">
          <ChevronLeft className="h-5 w-5 text-primary" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-primary uppercase tracking-tight">
            {isProduction ? 'Production Status' : 'Modify Order'} <span className="text-primary/50">— {originalPoNumber}</span>
          </h1>
          <p className="text-sm text-muted-foreground font-medium">Update fulfillment parameters, items, and logistics details.</p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column: Core Details */}
          <div className="space-y-6">
            <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
              <CardTitle className="text-xs font-bold text-primary flex items-center gap-2 uppercase tracking-widest">
                <FileText size={14} /> {isProduction ? 'Production Status' : 'Basic Order Details'}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 pt-6">
              {canEditAll && (
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
              )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Status</Label>
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
                  <FileText size={14} /> Add Processing Lines
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-6 pt-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-tight text-muted-foreground">Select Location</Label>
                  <Select
                    value={form.watch('productionLocationId')}
                    onValueChange={(val) => form.setValue('productionLocationId', val, { shouldValidate: true })}
                  >
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
                <Select
                  value={form.watch('shippingAddressIndex')}
                  onValueChange={(val) => form.setValue('shippingAddressIndex', val, { shouldValidate: true })}
                >
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
                <Select
                  value={form.watch('shippingMethod')}
                  onValueChange={(val) => form.setValue('shippingMethod', val)}
                >
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
                <Select
                  value={form.watch('brokerIndex')}
                  onValueChange={(val) => form.setValue('brokerIndex', val)}
                >
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

        {/* Items Table Section - Only for sales/admin */}
        {canEditAll && (
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
                        <Select
                          value={form.watch(`items.${index}.productId`)}
                          onValueChange={(val) => form.setValue(`items.${index}.productId`, val, { shouldValidate: true })}
                        >
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
                        <Select
                          value={form.watch(`items.${index}.palletType`)}
                          onValueChange={(val) => form.setValue(`items.${index}.palletType`, val)}
                        >
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
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-between p-6 bg-blue-50 rounded-3xl border border-blue-100 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-blue-500 h-5 w-5" />
            <p className="text-sm font-bold text-blue-800 uppercase tracking-tight">
              {isProduction ? 'Updating production status' : 'Reviewing changes'} - {originalPoNumber}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <Button type="button" variant="ghost" onClick={() => router.push('/sales/orders')} className="font-bold text-muted-foreground uppercase tracking-widest hover:bg-blue-100">
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
                  Saving Changes...
                </>
              ) : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
