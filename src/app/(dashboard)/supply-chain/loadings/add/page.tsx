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
  where,
  orderBy
} from '@/firebase/firestore-override';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  useFirestore, 
  useStorage, 
  useCollection,
  useMemoFirebase,
  useUser 
} from '@/firebase';
import { generateNextInvoiceNumber } from '@/lib/invoice-generator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/field-error';
import { 
  Plus, 
  Trash2, 
  Upload, 
  ChevronLeft, 
  CheckCircle2,
  Loader2,
  Info,
  Package,
  Truck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const fileSchema = z.object({
  fileName: z.string().min(1, "File name is required"),
  fileUrl: z.string().min(1, "File upload is required"),
  fileType: z.enum([
    'Bill Of Lading',
    'Phyto',
    'Eur1',
    'Invoice',
    'Certificate of Conformity',
    'Other document'
  ]),
  fileExtension: z.string().optional(),
  expiryDate: z.string().optional(),
  note: z.string().optional(),
});

const formSchema = z.object({
  orderId: z.string().min(1, "Required"),
  locationId: z.string().min(1, "Required"),
  transitSupplierId: z.string().optional(),
  destinationId: z.string().optional(),
  loadingStatus: z.enum(['Draft', 'In Transit', 'Delivered']).default('Draft'),
  transportCost: z.string().optional(),
  sousDum: z.string().optional(),
  tempTale: z.string().optional(),
  exchangeRate: z.string().optional(),
  factureTrans: z.string().optional(),
  numExpeditionDhl: z.string().optional(),
  produit: z.string().optional(),
  numeroChauffeur: z.string().optional(),
  valueInMad: z.string().optional(),
  dum: z.string().optional(),
  factureTransitaire: z.string().optional(),
  factureDhl: z.string().optional(),
  t1AndPhyto: z.string().optional(),
  files: z.array(fileSchema).default([]),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddSupplyChainLoadingPage() {
  const router = useRouter();
  const db = useFirestore();
  const storage = useStorage();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  // 1. Fetch Orders (PRODUCED only)
  const ordersQuery = useMemoFirebase(() => query(collection(db, 'orders'), where('status', 'in', ['Produced', 'PRODUCED', 'produced'])), [db]);
  const { data: ordersData, isLoading: ordersLoading } = useCollection<any>(ordersQuery);

  // 2. Fetch Locations (Processing Lines)
  const linesQuery = useMemoFirebase(() => query(collection(db, 'processing_lines')), [db]);
  const { data: linesData, isLoading: linesLoading } = useCollection<any>(linesQuery);

  // 3. Fetch Transit Suppliers (Transport only)
  const transportQuery = useMemoFirebase(() => query(collection(db, 'suppliers'), where('supplier_type', '==', 'Transport')), [db]);
  const { data: transportData, isLoading: transportLoading } = useCollection<any>(transportQuery);

  // 6. Fetch Customers
  const customersQuery = useMemoFirebase(() => query(collection(db, 'customers')), [db]);
  const { data: customersData, isLoading: customersLoading } = useCollection<any>(customersQuery);

  // 4. Fetch Loadings to check used orders and get next dum (Lot Number)
  const loadingsQuery = useMemoFirebase(() => query(collection(db, 'supply_chain_loadings')), [db]);
  const { data: loadingsData, isLoading: loadingsLoading } = useCollection<any>(loadingsQuery);

  // 5. Fetch Packing Lists to get Truck Number
  const packingListsQuery = useMemoFirebase(() => query(collection(db, 'packingLists')), [db]);
  const { data: packingListsData } = useCollection<any>(packingListsQuery);

  const availableOrders = React.useMemo(() => {
    if (!ordersData || !loadingsData) return [];
    const usedOrderIds = new Set(loadingsData.map((l: any) => l.orderId));
    return ordersData.filter((o: any) => !usedOrderIds.has(o.id));
  }, [ordersData, loadingsData]);


  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderId: '',
      locationId: '',
      destinationId: '',
      transitSupplierId: '',
      loadingStatus: 'Draft',
      transportCost: '',
      sousDum: '',
      tempTale: '',
      exchangeRate: '',
      factureTrans: '',
      numExpeditionDhl: '',
      produit: '',
      numeroChauffeur: '',
      valueInMad: '',
      dum: '',
      factureTransitaire: '',
      factureDhl: '',
      t1AndPhyto: '',
      files: [{ fileName: '', fileUrl: '', fileType: 'Other document' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'files'
  });

  React.useEffect(() => {
    if (loadingsData && loadingsData.length >= 0) {
      const currentDum = form.getValues('dum');
      if (!currentDum) {
        const maxDum = loadingsData.reduce((max: number, l: any) => {
          const num = parseInt(l.dum || '0', 10);
          return isNaN(num) ? max : Math.max(max, num);
        }, 0);
        const nextDum = String(maxDum + 1).padStart(2, '0');
        form.setValue('dum', nextDum);
      }
    }
  }, [loadingsData, form]);

  const selectedOrderId = form.watch('orderId');
  const selectedOrder = React.useMemo(() => ordersData?.find((o: any) => o.id === selectedOrderId), [ordersData, selectedOrderId]);
  const selectedCustomerId = selectedOrder?.customerId;
  const selectedCustomer = React.useMemo(() => customersData?.find((c: any) => c.id === selectedCustomerId), [customersData, selectedCustomerId]);

  const shippingAddresses = React.useMemo(() => {
    if (!selectedCustomer) return [];
    const allAddresses = [...(selectedCustomer.registeredAddresses || []), ...(selectedCustomer.addresses || [])];
    return allAddresses.map((adr, idx) => ({
      ...adr,
      _id: adr.id || `idx-${idx}`,
      displayText: `${adr.name || adr.label || 'Address'} - ${adr.street || adr.address || ''}`,
      rawType: (adr.type || adr.address_type || adr.addressType || adr.type_label || '').toLowerCase()
    })).filter(adr => adr.rawType === 'shipping');
  }, [selectedCustomer]);

  React.useEffect(() => {
    if (selectedOrderId) {
      if (shippingAddresses.length > 0) {
        const orderShippingId = selectedOrder?.shipping_address_id || selectedOrder?.shippingAddressId;
        const matchingAddress = shippingAddresses.find(a => a._id === orderShippingId);
        if (matchingAddress) {
          form.setValue('destinationId', matchingAddress._id, { shouldValidate: true });
        } else if (shippingAddresses.length === 1) {
          form.setValue('destinationId', shippingAddresses[0]._id, { shouldValidate: true });
        } else {
          form.setValue('destinationId', '');
        }
      } else {
        form.setValue('destinationId', '');
      }

      if (packingListsData) {
        const packingList = packingListsData.find((pl: any) => pl.orderId === selectedOrderId);
        if (packingList && packingList.truckNumber) {
          form.setValue('numeroChauffeur', packingList.truckNumber, { shouldValidate: true });
        }
      }
    } else {
      form.setValue('destinationId', '');
      form.setValue('transportCost', '');
    }
  }, [selectedOrderId, selectedOrder, shippingAddresses.length, packingListsData, form]);

  const selectedDestinationId = form.watch('destinationId');
  const selectedTransitSupplierId = form.watch('transitSupplierId');

  React.useEffect(() => {
    if (selectedOrderId && selectedDestinationId && selectedTransitSupplierId) {
      const supplier = transportData?.find((s: any) => s.id === selectedTransitSupplierId);
      const destination = shippingAddresses.find(a => a._id === selectedDestinationId);
      
      if (supplier && supplier.transport_items && supplier.transport_items.length > 0 && destination) {
        const destText = (destination.displayText || '').toLowerCase().trim();
        
        let match = supplier.transport_items.find((item: any) => (item.designation || '').toLowerCase().trim() === destText);
        
        if (!match) {
          match = supplier.transport_items.find((item: any) => {
            const designation = (item.designation || '').toLowerCase().trim();
            return destText.includes(designation) || designation.includes(destText);
          });
        }
        
        if (!match && supplier.transport_items.length === 1) {
          match = supplier.transport_items[0];
        }
        
        if (match) {
          form.setValue('transportCost', String(match.price), { shouldValidate: true });
          toast({ title: "Transport Cost Auto-filled", description: `Matched: ${match.designation}` });
        } else {
          form.setValue('transportCost', '');
          toast({ variant: 'destructive', title: "No Match", description: "No transport price found for this destination" });
        }
      } else {
        form.setValue('transportCost', '');
      }
    }
  }, [selectedOrderId, selectedDestinationId, selectedTransitSupplierId, shippingAddresses, transportData, form, toast]);

  const uploadFile = async (file: File, index: number) => {
    setUploadingIndex(index);
    try {
      const fileExtension = file.name.split('.').pop();
      const path = `processing_lines/loadings/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, path);
      
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      
      form.setValue(`files.${index}.fileUrl`, url);
      form.setValue(`files.${index}.fileExtension`, fileExtension);
      
      if (!form.getValues(`files.${index}.fileName`)) {
        form.setValue(`files.${index}.fileName`, file.name.split('.')[0]);
      }

      toast({
        title: "File Uploaded",
        description: `Successfully uploaded ${file.name}`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Error",
        description: error.message || "Failed to upload file.",
      });
    } finally {
      setUploadingIndex(null);
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (!db || !user) return;
    setLoading(true);
    try {
      const orderDoc = ordersData?.find((o: any) => o.id === values.orderId);
      const locationDoc = linesData?.find((l: any) => l.id === values.locationId);
      const supplierDoc = transportData?.find((s: any) => s.id === values.transitSupplierId);

      const year = new Date().getFullYear();
      const generatedNumber = await generateNextInvoiceNumber(db, {
        invoiceType: 'Produce Invoice',
        source: 'supply_chain_loading',
        year
      });

      const data = {
        ...values,
        invoice_number: generatedNumber,
        poNumber: orderDoc?.poNumber || 'Unknown',
        destinationId: values.destinationId || '',
        locationName: locationDoc?.title || 'Unknown',
        transitSupplierName: supplierDoc?.name || 'Unknown',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        createdByDisplayName: user.displayName || user.email || 'Unknown User',
      };

      await addDoc(collection(db, 'supply_chain_loadings'), data);

      toast({
        title: "Success",
        description: "Supply Chain Loading has been created successfully.",
      });
      router.push('/supply-chain/loadings'); // Note: index page doesn't exist yet, but assuming it will
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save loading.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (ordersLoading || transportLoading || linesLoading || customersLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-[#7a9800]" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4">Loading Master Data...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      <div className="flex items-center gap-4 max-w-[1400px] mx-auto">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-primary/5 text-primary/40 hover:text-primary transition-all">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="space-y-1">
          <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40">
            <ol className="inline-flex items-center space-x-2">
              <li>Profile</li>
              <li className="flex items-center"><span className="mx-2 opacity-20">/</span>Supply Chain</li>
              <li className="flex items-center"><span className="mx-2 opacity-20">/</span><span className="text-primary/60 font-black">Add Loading</span></li>
            </ol>
          </nav>
          <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Add Supply Chain Loading</h1>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-[1400px] mx-auto space-y-6 pb-20">
        <div className="bg-white rounded-xl shadow-sm border border-primary/5 p-8">
          <h2 className="text-[#2e1d52] font-bold text-xl mb-6 flex items-center gap-2">
            <Package className="h-5 w-5 text-[#7a9800]" />
            Loading Header
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div className="space-y-6">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Order</Label>
                <Select onValueChange={v => form.setValue('orderId', v, { shouldValidate: true })}>
                  <SelectTrigger error={!!form.formState.errors.orderId} className="h-10 rounded-md border-gray-200">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOrders?.map((o: any) => (
                      <SelectItem key={o.id} value={o.id}>{o.poNumber}</SelectItem>
                    ))}
                    {(!availableOrders || availableOrders.length === 0) && (
                      <SelectItem value="none" disabled>No available orders</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FieldError message={form.formState.errors.orderId?.message} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Transport Cost</Label>
                <div className="relative">
                  <Input {...form.register('transportCost')} placeholder="Transport Cost" className="h-10 rounded-md border-gray-200 pr-10" />
                  <span className="absolute right-3 top-2.5 text-xs text-gray-400">dh</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Sous Dum</Label>
                <Input {...form.register('sousDum')} className="h-10 rounded-md border-gray-200" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Temp Tale</Label>
                <Input {...form.register('tempTale')} className="h-10 rounded-md border-gray-200" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Exchange Rate</Label>
                <Input {...form.register('exchangeRate')} className="h-10 rounded-md border-gray-200" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Facture Trans</Label>
                <Input {...form.register('factureTrans')} className="h-10 rounded-md border-gray-200" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Num Expédition DHL</Label>
                <Input {...form.register('numExpeditionDhl')} className="h-10 rounded-md border-gray-200" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Produit</Label>
                <Input {...form.register('produit')} className="h-10 rounded-md border-gray-200" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Numero du Chauffeur</Label>
                <Input {...form.register('numeroChauffeur')} className="h-10 rounded-md border-gray-200" />
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Location</Label>
                <Select onValueChange={v => form.setValue('locationId', v, { shouldValidate: true })}>
                  <SelectTrigger error={!!form.formState.errors.locationId} className="h-10 rounded-md border-gray-200">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {linesData?.map((l: any) => (
                      <SelectItem key={l.id} value={l.id}>{l.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={form.formState.errors.locationId?.message} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Transit Supplier</Label>
                <Select onValueChange={v => form.setValue('transitSupplierId', v, { shouldValidate: true })}>
                  <SelectTrigger error={!!form.formState.errors.transitSupplierId} className="h-10 rounded-md border-gray-200">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {transportData?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                    {(!transportData || transportData.length === 0) && (
                      <SelectItem value="none" disabled>No Transport suppliers found</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FieldError message={form.formState.errors.transitSupplierId?.message} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Loading Status</Label>
                <Select defaultValue="Draft" onValueChange={(v: any) => form.setValue('loadingStatus', v, { shouldValidate: true })}>
                  <SelectTrigger error={!!form.formState.errors.loadingStatus} className="h-10 rounded-md border-gray-200">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="In Transit">In Transit</SelectItem>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError message={form.formState.errors.loadingStatus?.message} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Value in MAD</Label>
                <Input {...form.register('valueInMad')} className="h-10 rounded-md border-gray-200" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Dum</Label>
                <Input {...form.register('dum')} className="h-10 rounded-md border-gray-200" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Facture Transitaire</Label>
                <Input {...form.register('factureTransitaire')} className="h-10 rounded-md border-gray-200" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">Facture DHL</Label>
                <Input {...form.register('factureDhl')} className="h-10 rounded-md border-gray-200" />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-700">T1 and Phyto</Label>
                <Input {...form.register('t1AndPhyto')} className="h-10 rounded-md border-gray-200" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-primary/5 p-8">
          <div className="flex flex-col mb-6">
            <h2 className="text-[#2e1d52] font-semibold text-lg mb-2">
              Add Files
            </h2>
            <Button 
                type="button" 
                onClick={() => append({ fileName: '', fileUrl: '', fileType: 'Other document' })}
                className="w-8 h-8 p-0 bg-[#7a9800] hover:bg-[#6c8500] text-white rounded text-xl"
              >
                +
            </Button>
          </div>
          <div className="w-full">
            <div className="grid grid-cols-12 gap-4 mb-2 text-xs text-gray-600 font-medium px-2">
              <div className="col-span-3">Upload File</div>
              <div className="col-span-5">File Name</div>
              <div className="col-span-3">File Type</div>
              <div className="col-span-1"></div>
            </div>
            
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-3">
                    <input 
                      type="file" 
                      className="hidden" 
                      id={`file-${index}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadFile(file, index);
                      }}
                    />
                    <label 
                      htmlFor={`file-${index}`}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-[#7a9800] hover:bg-[#6c8500] text-white text-sm rounded cursor-pointer whitespace-nowrap"
                    >
                      {uploadingIndex === index ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : form.watch(`files.${index}.fileUrl`) ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : null}
                      Choose File
                    </label>
                    <span className="ml-2 text-xs text-gray-500">
                      {form.watch(`files.${index}.fileUrl`) ? 'Uploaded' : 'No file chosen'}
                    </span>
                  </div>
                  
                  <div className="col-span-5">
                    <Input 
                      {...form.register(`files.${index}.fileName`)} 
                      className="h-10 rounded-md border-gray-200 focus:bg-white"
                    />
                  </div>
                  
                  <div className="col-span-3">
                    <Select 
                      onValueChange={(val) => form.setValue(`files.${index}.fileType`, val as any)}
                      defaultValue={field.fileType}
                    >
                      <SelectTrigger className="h-10 rounded-md border-gray-200 focus:bg-white bg-white">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bill Of Lading">Bill Of Lading</SelectItem>
                        <SelectItem value="Phyto">Phyto</SelectItem>
                        <SelectItem value="Eur1">Eur1</SelectItem>
                        <SelectItem value="Invoice">Invoice</SelectItem>
                        <SelectItem value="Certificate of Conformity">Certificate of conformity</SelectItem>
                        <SelectItem value="Other document">Other documents</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="col-span-1 flex justify-end">
                    <Button 
                      type="button"
                      onClick={() => remove(index)}
                      className="w-8 h-8 p-0 bg-red-500 hover:bg-red-600 text-white rounded text-lg flex items-center justify-center"
                    >
                      -
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.back()} 
            className="h-14 px-8 border-slate-200 bg-white font-black text-[10px] text-slate-500 uppercase tracking-[0.2em] rounded-xl hover:bg-slate-50 shadow-sm"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={loading} 
            className="h-14 px-12 bg-[#7a9800] hover:bg-[#6c8500] text-white font-black rounded-xl shadow-xl shadow-[#7a9800]/20 uppercase tracking-[0.2em] text-[10px]"
          >
            {loading ? <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> SAVING...</> : 'Save Loading'}
          </Button>
        </div>
      </form>
    </div>
  );
}
