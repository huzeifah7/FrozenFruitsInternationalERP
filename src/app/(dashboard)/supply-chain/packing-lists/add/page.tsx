'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  collection, 
  doc, 
  query, 
  where, 
  getDocs, 
  getDoc,
  writeBatch, 
  serverTimestamp,
  orderBy,
  limit
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
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { generateNextInvoiceNumber } from '@/lib/invoice-generator';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { sortProducts, getPackagingWeight } from '@/lib/utils';
import { FieldError } from '@/components/ui/field-error';
import {
  ChevronLeft,
  Loader2,
  Info,
  Scale,
  PackageCheck,
  FileCheck2,
  Truck,
  Plus,
  Trash2
} from 'lucide-react';

const itemSchema = z.object({
  pallet: z.string().min(1, "Required"),
  productId: z.string().min(1, "Required"),
  productName: z.string(),
  lotNumber: z.string().min(1, "Required"),
  caliber: z.string().min(1, "Required"),
  ggnNumber: z.string().min(1, "Required"),
  packagingTypeId: z.string().min(1, "Required"),
  packagingTypeName: z.string(),
  numberOfBoxes: z.coerce.number().min(1, "Required"),
  price: z.coerce.number().min(0).optional(),
  netWeight: z.coerce.number().min(0.01, "Required"),
  grossWeight: z.coerce.number().min(0.01, "Required"),
});

const formSchema = z.object({
  productionType: z.string().min(1, "Required"),
  orderId: z.string().min(1, "Required"),
  ggnNumber: z.string().optional(),
  sealNumber: z.string().optional(),
  etd: z.string().min(1, "Required"),
  expeditionDate: z.string().min(1, "Required"),
  dateOfLoading: z.string().optional(),
  truckNumber: z.string().min(1, "Required"),
  transportCompanyId: z.string().min(1, "Required"),
  remarks: z.string().optional(),
  customerAddress: z.string().optional(),
  deliveryAddress: z.string().optional(),
  cocNumber: z.string().optional(),
  items: z.array(itemSchema).optional()
});

type FormValues = z.infer<typeof formSchema>;

export default function AddPackingListPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // 1. Fetch Orders
  const ordersQuery = useMemoFirebase(() => query(collection(db, 'orders')), [db]);
  const { data: ordersData, isLoading: ordersLoading } = useCollection<any>(ordersQuery);

  // 1b. Fetch Existing Packing Lists to exclude orders that already have a packing list
  const packingListsQuery = useMemoFirebase(() => query(collection(db, 'packingLists')), [db]);
  const { data: existingPackingLists } = useCollection<any>(packingListsQuery);

  const availableOrders = useMemo(() => {
    if (!ordersData) return [];
    
    const usedPoSet = new Set<string>();
    existingPackingLists?.forEach((pl: any) => {
      if (pl.poNumber) usedPoSet.add(String(pl.poNumber).trim().toLowerCase());
      if (pl.orderId) usedPoSet.add(String(pl.orderId).trim().toLowerCase());
    });

    return ordersData.filter((order: any) => {
      const st = String(order.status || '').trim().toLowerCase();

      // 1. MUST have status "Produced" (e.g. 'produced', 'Produced', 'PRODUCED', or containing 'produce')
      const isProduced = st.includes('produce');
      if (!isProduced) return false;

      // 2. MUST NOT already have a packing list generated
      if (order.packingListGenerated === true) return false;

      // 3. MUST NOT match an existing packing list
      const po = String(order.poNumber || order.po_number || '').trim().toLowerCase();
      const id = String(order.id || '').trim().toLowerCase();
      if (po && usedPoSet.has(po)) return false;
      if (id && usedPoSet.has(id)) return false;

      return true;
    });
  }, [ordersData, existingPackingLists]);

  // 2. Fetch Transport Companies (suppliers where supplier_type = Transport)
  const transportQuery = useMemoFirebase(() => query(collection(db, 'suppliers'), where('supplier_type', '==', 'Transport')), [db]);
  const { data: transportData, isLoading: transportLoading } = useCollection<any>(transportQuery);

  // 3. Fetch Products
  const productsQuery = useMemoFirebase(() => query(collection(db, 'products')), [db]);
  const { data: productsData } = useCollection<any>(productsQuery);

  // 4. Fetch Packaging Types
  const packagingQuery = useMemoFirebase(() => query(collection(db, 'consumables'), where('is_packaging', '==', true)), [db]);
  const { data: packagingData } = useCollection<any>(packagingQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productionType: '',
      orderId: '',
      ggnNumber: '',
      sealNumber: '',
      etd: new Date().toISOString().split('T')[0],
      expeditionDate: new Date().toISOString().split('T')[0],
      dateOfLoading: new Date().toISOString().split('T')[0],
      truckNumber: '',
      transportCompanyId: '',
      remarks: '',
      items: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items'
  });

  const watchProductionType = form.watch('productionType');
  const watchOrderId = form.watch('orderId');
  const watchItems = form.watch('items') || [];

  const [internalItems, setInternalItems] = useState<any[]>([]);
  const [orderGgns, setOrderGgns] = useState<string[]>([]);
  const [orderDetails, setOrderDetails] = useState<any>(null);

  // Load Order Details & GGNs
  useEffect(() => {
    if (!watchOrderId || !ordersData || !db) {
      setOrderDetails(null);
      setOrderGgns([]);
      form.setValue('ggnNumber', '');
      return;
    }
    const order = ordersData.find(o => o.id === watchOrderId);
    if (!order) return;
    setOrderDetails(order);

    const fetchCustomerDetails = async () => {
      try {
        let ggnList: string[] = [];
        let addressStr = '';
        let deliveryStr = '';
        let cocStr = '';
        let resolvedGgn = order.ggnNumber || '—';

        let custData: any = null;
        if (order.customerId) {
          const custSnap = await getDoc(doc(db, 'customers', order.customerId));
          if (custSnap.exists()) {
            custData = custSnap.data();
          }
        }
        if (!custData && (order.customerName || order.customer)) {
          const custSnap = await getDocs(query(collection(db, 'customers'), where('companyName', '==', order.customerName || order.customer)));
          if (!custSnap.empty) {
            custData = custSnap.docs[0].data();
          }
        }

        if (custData) {
          if (custData.farms && Array.isArray(custData.farms)) {
            ggnList = custData.farms.map((f: any) => f.ggnNumber).filter(Boolean);
          }

          if (custData.addresses && Array.isArray(custData.addresses)) {
            const billing = custData.addresses.find((a: any) => a.type === 'Billing');
            const delivery = custData.addresses.find((a: any) => a.type === 'Delivery');
            const fallback = custData.addresses[0];
            
            const formatAddr = (a: any) => a ? `${a.street || ''}, ${a.city || ''} ${a.zipCode || ''}, ${a.country || ''}`.replace(/^[,\s]+|[,\s]+$/g, '').replace(/, ,/g, ',') : '';
            
            addressStr = formatAddr(billing || fallback);
            deliveryStr = formatAddr(delivery || fallback);
          }

          if (custData.brokers && Array.isArray(custData.brokers)) {
            const brokerWithCoc = custData.brokers.find((b: any) => b.coCode);
            if (brokerWithCoc) cocStr = brokerWithCoc.coCode;
          }

          // Resolve GGN from order farmId or customer farms
          if (resolvedGgn === '—') {
            const farmId = order.farmId;
            const targetFarm = custData.farms?.find((f: any) => f.farmId === farmId) || custData.farms?.[0];
            if (targetFarm?.ggnNumber) {
              resolvedGgn = targetFarm.ggnNumber;
            }
          }
        }
        
        if (resolvedGgn === '—' && ggnList.length > 0) {
          resolvedGgn = ggnList[0];
        }

        setOrderGgns(ggnList);
        form.setValue('ggnNumber', resolvedGgn);
        form.setValue('customerAddress', addressStr);
        form.setValue('deliveryAddress', deliveryStr);
        form.setValue('cocNumber', cocStr);
      } catch (e) {
        console.error('Error fetching customer details:', e);
      }
    };
    fetchCustomerDetails();
  }, [watchOrderId, ordersData, db, form]);

  // Load Internal Production Items
  useEffect(() => {
    if (watchProductionType !== 'Internal Production' || !watchOrderId || !db) {
      setInternalItems([]);
      return;
    }
    const fetchOutputs = async () => {
      try {
        const q = query(collection(db, 'production_output'), where('orderPoId', '==', watchOrderId));
        const snap = await getDocs(q);
        const outputs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        let items: any[] = [];
        outputs.forEach((out: any) => {
          (out.items || []).forEach((item: any) => {
            const consumable = packagingData?.find((p: any) => p.id === out.packagingTypeId);
            const packagingWeight = getPackagingWeight(consumable) ?? getPackagingWeight(out.packagingTypeName) ?? 0;
            if (packagingWeight === 0) {
              console.warn(`Packaging weight not found for ${out.packagingTypeName || out.packagingTypeId || 'unknown'}`);
            }
            const boxes = Number(item.numberOfBoxes) || Number(item.boxes) || 0;
            const calculatedNet = packagingWeight * boxes;

            const prod = productsData?.find((p: any) => p.id === item.productId) || productsData?.find((p: any) => p.productName === (item.productName || item.variety));
            const fullProdName = prod ? [prod.productName, prod.category, prod.type].filter(Boolean).join(' - ') : (item.productName || item.variety || '—');

            items.push({
              pallet: out.palletId || item.pallet || '—',
              productionOutput: out.barcode || out.id || '—',
              ggnNumber: out.ggnNumber || form.watch('ggnNumber') || '—',
              productName: fullProdName,
              lotNumber: item.lotNumber || item.rawMaterialLotNumber || out.lotNumber || out.globalLotNumber || '—',
              caliber: item.caliber || item.calibre || '—',
              numberOfBoxes: boxes,
              netWeight: calculatedNet,
              grossWeight: Number(item.grossWeight) || 0,
              packagingTypeId: out.packagingTypeId || '',
              packagingTypeName: out.packagingTypeName || '',
            });
          });
        });
        setInternalItems(items);
      } catch (e) {
        console.error('Error fetching internal items:', e);
      }
    };
    fetchOutputs();
  }, [watchProductionType, watchOrderId, db, form.watch('ggnNumber'), packagingData]);

  // Calculate Totals
  const totals = useMemo(() => {
    let net = 0, gross = 0, boxes = 0;
    if (watchProductionType === 'Internal Production') {
      internalItems.forEach(i => {
        net += i.netWeight;
        gross += i.grossWeight;
        boxes += i.numberOfBoxes;
      });
    } else {
      watchItems.forEach(i => {
        net += Number(i.netWeight) || 0;
        gross += Number(i.grossWeight) || 0;
        boxes += Number(i.numberOfBoxes) || 0;
      });
    }
    return { net, gross, boxes };
  }, [watchProductionType, internalItems, watchItems]);

  const onSubmit = async (values: FormValues) => {
    if (!db || !user) return;

    if (!values.orderId) {
      toast({ title: 'Validation Error', description: 'Please select an Order.', variant: 'destructive' });
      return;
    }

    if (values.productionType === 'Internal Production') {
      if (!orderDetails || !['Produced', 'PRODUCED', 'produced'].includes(orderDetails.status)) {
        toast({ title: 'Validation Error', description: 'Selected Order must be in "Produced" status.', variant: 'destructive' });
        return;
      }
      if (internalItems.length === 0) {
        toast({ title: 'Validation Error', description: 'Selected Order has no linked Production Outputs. Packing list cannot be created.', variant: 'destructive' });
        return;
      }
    }
    
    if (watchProductionType === 'Prestation' && (!values.items || values.items.length === 0)) {
      toast({ title: 'Validation Error', description: 'Prestation packing lists require at least one item.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const selectedCompany = transportData?.find((tc: any) => tc.id === values.transportCompanyId);
      const transportCompanyName = selectedCompany ? selectedCompany.name : 'Unknown';

      // Generate global sequential packing list number
      const seqQuery = query(collection(db, 'packingLists'), orderBy('sequence', 'desc'), limit(1));
      const seqSnap = await getDocs(seqQuery);
      let nextSequence = 1;
      if (!seqSnap.empty) {
        const lastDoc = seqSnap.docs[0].data();
        if (lastDoc.sequence && typeof lastDoc.sequence === 'number') {
          nextSequence = lastDoc.sequence + 1;
        }
      }

      // Format date from expeditionDate
      const plDate = new Date(values.expeditionDate);
      const dd = String(plDate.getDate()).padStart(2, '0');
      const mm = String(plDate.getMonth() + 1).padStart(2, '0');
      const yyyy = plDate.getFullYear() || new Date().getFullYear();
      const sequenceStr = String(nextSequence).padStart(5, '0');
      const generatedPLNumber = `SC${dd}${mm}${yyyy}-${sequenceStr}`;

      // Automatically generate Produce Invoice Number upon creation
      const generatedInvoiceNumber = await generateNextInvoiceNumber(db, {
        invoiceType: 'Produce Invoice',
        source: 'sales_invoice',
        year: yyyy
      });

      const batch = writeBatch(db);
      const plRef = doc(collection(db, 'packingLists'));
      const activeSeasonId = (typeof window !== 'undefined' ? localStorage.getItem('season_id') : null) || 'DEFAULT_SEASON';

      const packingListData: any = {
        sequence: nextSequence,
        packingListNumber: generatedPLNumber,
        invoiceNumber: generatedInvoiceNumber,
        invoice_number: generatedInvoiceNumber,
        invoiceGenerated: true,
        season_id: activeSeasonId,
        seasonId: activeSeasonId,
        productionType: values.productionType,
        orderId: values.orderId,
        poNumber: orderDetails.poNumber,
        customer: orderDetails.customerName || orderDetails.customer || '—',
        expeditionDate: values.expeditionDate,
        dateOfLoading: values.dateOfLoading || '',
        etd: values.etd,
        truckNumber: values.truckNumber,
        transportCompanyId: values.transportCompanyId,
        transportCompany: transportCompanyName,
        ggnNumber: values.ggnNumber || '',
        sealNumber: values.sealNumber || '',
        remarks: values.remarks || '',
        totalNetWeight: totals.net,
        totalGrossWeight: totals.gross,
        totalBoxes: totals.boxes,
        countryOfOrigin: orderDetails.countryOfOrigin || '—',
        status: 'generated',
        createdAt: serverTimestamp(),
        createdBy: user?.email || 'System'
      };

      let finalContents: any[] = [];
      let finalItems: any[] = [];

      if (values.productionType === 'Internal Production') {
        finalContents = internalItems;
        Object.assign(packingListData, {
          contents: internalItems,
          items: [] // Empty items for internal
        });
      } else {
        // Hydrate names for presentation items
        finalItems = (values.items || []).map(item => {
          const prod = productsData?.find((p: any) => p.id === item.productId);
          const pack = packagingData?.find((p: any) => p.id === item.packagingTypeId);
          return {
            ...item,
            productName: prod ? [prod.productName, prod.category, prod.type].filter(Boolean).join(' - ') : '',
            packagingTypeName: pack ? pack.displayName : ''
          };
        });
        Object.assign(packingListData, {
          contents: [], // Empty contents for prestation
          items: finalItems
        });
      }

      batch.set(plRef, packingListData);

      // Create corresponding record in 'invoices' collection
      const invoiceRef = doc(collection(db, 'invoices'));
      const rawItemList = values.productionType === 'Internal Production' ? finalContents : finalItems;
      const formattedItems = (rawItemList || []).map((r: any) => {
        const qty = Number(r.netWeight || r.boxes || r.quantity || 0);
        const price = Number(r.unitPrice || orderDetails?.price || 3.5);
        return {
          item_code: r.itemCode || 'A2',
          itemCode: r.itemCode || 'A2',
          description: r.productName || r.product || '—',
          product: r.productName || r.product || '—',
          calibre: r.caliber || r.calibre || '—',
          quantity: qty,
          price: price,
          amount: qty * price
        };
      });
      const calculatedTotal = formattedItems.reduce((sum: number, i: any) => sum + i.amount, 0);

      batch.set(invoiceRef, {
        invoiceNumber: generatedInvoiceNumber,
        invoice_number: generatedInvoiceNumber,
        invoice_type: 'produce',
        invoice_type_display: 'Invoice Generated from the packing list',
        packingListId: plRef.id,
        orderId: values.orderId || null,
        po_order_id: values.orderId || null,
        po_order_number: orderDetails.poNumber || null,
        poNumber: orderDetails.poNumber || null,
        customer_id: orderDetails.customerId || orderDetails.customer_id || null,
        customer_detail: {
          id: orderDetails.customerId || null,
          companyName: orderDetails.customerName || orderDetails.customer || '—',
          invoicing_address: form.getValues('customerAddress') || orderDetails.customerAddress || orderDetails.address || '—',
          shipping_address: form.getValues('deliveryAddress') || orderDetails.deliveryAddress || form.getValues('customerAddress') || orderDetails.address || '—',
          city: orderDetails.city || '—',
          country: orderDetails.countryOfOrigin || 'Morocco',
          vat_number: orderDetails.vatNumber || '-',
          incoterms: orderDetails.incoterm || orderDetails.incoterms || 'DAP',
          payment_terms: orderDetails.paymentTerms || orderDetails.payment_terms || '—'
        },
        customer: orderDetails.customerName || orderDetails.customer || '—',
        invoicing_address: form.getValues('customerAddress') || orderDetails.customerAddress || orderDetails.address || '—',
        shipping_address: form.getValues('deliveryAddress') || orderDetails.deliveryAddress || form.getValues('customerAddress') || orderDetails.address || '—',
        vat_number: orderDetails.vatNumber || '-',
        incoterm: orderDetails.incoterm || orderDetails.incoterms || 'DAP',
        incoterms: orderDetails.incoterm || orderDetails.incoterms || 'DAP',
        payment_terms: orderDetails.paymentTerms || orderDetails.payment_terms || '—',
        truck_number: values.truckNumber || '—',
        total_gross_weight: totals.gross,
        total_number_of_boxes: totals.boxes,
        date: values.expeditionDate || new Date().toISOString().split('T')[0],
        season_id: activeSeasonId,
        total_amount: calculatedTotal,
        items: formattedItems,
        sourceType: 'supply_chain_packing_list',
        createdAt: serverTimestamp(),
        createdBy: user?.email || 'System'
      });

      // Update associated order
      const orderRef = doc(db, 'orders', values.orderId);
      batch.update(orderRef, {
        packingListGenerated: true,
        status: 'Produced'
      });

      await batch.commit();

      toast({
        title: 'Success',
        description: `Packing list ${generatedPLNumber} generated successfully.`
      });

      router.push('/supply-chain/packing-lists');
    } catch (err) {
      console.error('Error creating packing list:', err);
      toast({
        title: 'Error',
        description: 'Failed to generate packing list.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (ordersLoading || transportLoading) {
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
        <Button variant="ghost" size="icon" onClick={() => router.push('/supply-chain/packing-lists')} className="rounded-full hover:bg-primary/5 text-primary/40 hover:text-primary transition-all">
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <div className="space-y-1">
          <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40">
            <ol className="inline-flex items-center space-x-2">
              <li>Profile</li>
              <li className="flex items-center"><span className="mx-2 opacity-20">/</span>Supply Chain</li>
              <li className="flex items-center"><span className="mx-2 opacity-20">/</span><span className="text-primary/60 font-black">Add Packing List</span></li>
            </ol>
          </nav>
          <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Add Packing List</h1>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-[1400px] mx-auto space-y-6 pb-20">
        <input type="hidden" {...form.register('customerAddress')} />
        <input type="hidden" {...form.register('deliveryAddress')} />
        <input type="hidden" {...form.register('cocNumber')} />

        <div className="bg-white rounded-xl shadow-sm border border-primary/5 p-8">
          <h2 className="text-[#2e1d52] font-bold text-xl mb-6">Packing List Header</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Production Type</Label>
              <Select onValueChange={v => form.setValue('productionType', v, { shouldValidate: true })}>
                <SelectTrigger error={!!form.formState.errors.productionType} className="h-10 rounded-md border-gray-200"><SelectValue placeholder="Select Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Internal Production">Internal Production</SelectItem>
                  <SelectItem value="Prestation">Prestation</SelectItem>
                </SelectContent>
              </Select>
              <FieldError message={form.formState.errors.productionType?.message} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Order PO Number</Label>
              <Select onValueChange={v => form.setValue('orderId', v, { shouldValidate: true })}>
                <SelectTrigger error={!!form.formState.errors.orderId} className="h-10 rounded-md border-gray-200"><SelectValue placeholder="Select Order" /></SelectTrigger>
                <SelectContent>
                  {availableOrders?.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.poNumber || o.po_number || o.id}</SelectItem>
                  ))}
                  {(!availableOrders || availableOrders.length === 0) && (
                    <SelectItem value="none" disabled>No available orders</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FieldError message={form.formState.errors.orderId?.message} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">GGN Number</Label>
              <Input
                readOnly
                {...form.register('ggnNumber')}
                error={!!form.formState.errors.ggnNumber}
                className="h-10 rounded-md border-gray-200 bg-gray-50 cursor-not-allowed font-medium"
                placeholder="GGN Number"
              />
              <FieldError message={form.formState.errors.ggnNumber?.message} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Seal Number</Label>
              <Input {...form.register('sealNumber')} error={!!form.formState.errors.sealNumber} className="h-10 rounded-md border-gray-200" />
              <FieldError message={form.formState.errors.sealNumber?.message} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">ETD</Label>
              <Input type="date" {...form.register('etd')} error={!!form.formState.errors.etd} className="h-10 rounded-md border-gray-200" />
              <FieldError message={form.formState.errors.etd?.message} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Expedition Date</Label>
              <Input type="date" {...form.register('expeditionDate')} error={!!form.formState.errors.expeditionDate} className="h-10 rounded-md border-gray-200" />
              <FieldError message={form.formState.errors.expeditionDate?.message} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Truck Number</Label>
              <Input {...form.register('truckNumber')} error={!!form.formState.errors.truckNumber} className="h-10 rounded-md border-gray-200" />
              <FieldError message={form.formState.errors.truckNumber?.message} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Transport Company</Label>
              <Select onValueChange={v => form.setValue('transportCompanyId', v, { shouldValidate: true })}>
                <SelectTrigger error={!!form.formState.errors.transportCompanyId} className="h-10 rounded-md border-gray-200"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {transportData?.map((tc: any) => (
                    <SelectItem key={tc.id} value={tc.id}>{tc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={form.formState.errors.transportCompanyId?.message} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Total Net Weight (KG)</Label>
              <Input readOnly value={totals.net.toLocaleString()} className="h-10 rounded-md border-gray-200 bg-gray-50" />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="text-xs font-medium text-gray-700">Remarks</Label>
              <Textarea {...form.register('remarks')} className="min-h-[80px] rounded-md border-gray-200" />
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-4 px-2">
            <h2 className="text-[#2e1d52] font-bold text-xl">
              {watchProductionType === 'Prestation' ? 'Items' : 'Packing List Contents'}
            </h2>
          </div>

          {watchProductionType === 'Prestation' && (
            <div className="mb-4 px-2">
              <Button type="button" onClick={() => append({ pallet: '', productId: '', productName: '', lotNumber: '', caliber: '', ggnNumber: orderGgns[0] || '', packagingTypeId: '', packagingTypeName: '', numberOfBoxes: 0, netWeight: 0, grossWeight: 0 })} size="icon" className="h-8 w-8 rounded-sm bg-[#7a9800] hover:bg-[#6c8500]">
                <Plus className="h-5 w-5 text-white" />
              </Button>
            </div>
          )}
          
          <div className="overflow-x-auto w-full pb-8">
            {watchProductionType === 'Internal Production' ? (
              <table className="w-full text-left text-xs border-b border-gray-100">
                <thead>
                  <tr className="text-muted-foreground border-b border-gray-200">
                    <th className="py-3 px-4 font-normal">Pallet</th>
                    <th className="py-3 px-4 font-normal">Production Output</th>
                    <th className="py-3 px-4 font-normal">GGN Number</th>
                    <th className="py-3 px-4 font-normal">Product</th>
                    <th className="py-3 px-4 font-normal">Lot Number</th>
                    <th className="py-3 px-4 font-normal">Caliber</th>
                    <th className="py-3 px-4 font-normal text-right">No of Boxes</th>
                    <th className="py-3 px-4 font-normal text-right">Net Weight</th>
                    <th className="py-3 px-4 font-normal text-right">Gross Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {internalItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
                      <td className="py-3 px-4">{idx + 1}</td>
                      <td className="py-3 px-4">{item.productionOutput}</td>
                      <td className="py-3 px-4">{item.ggnNumber}</td>
                      <td className="py-3 px-4">{item.productName}</td>
                      <td className="py-3 px-4">{item.lotNumber}</td>
                      <td className="py-3 px-4">{item.caliber}</td>
                      <td className="py-3 px-4 text-right">{item.numberOfBoxes}</td>
                      <td className="py-3 px-4 text-right">{item.netWeight}</td>
                      <td className="py-3 px-4 text-right">{item.grossWeight}</td>
                    </tr>
                  ))}
                  {internalItems.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-slate-400">No production outputs found for this order.</td></tr>
                  )}
                </tbody>
              </table>
            ) : watchProductionType === 'Prestation' ? (
              <table className="w-full text-left text-xs border-b border-gray-100">
                <thead>
                  <tr className="text-muted-foreground border-b border-gray-200">
                    <th className="py-3 px-2 font-normal">Pallet</th>
                    <th className="py-3 px-2 font-normal">Product</th>
                    <th className="py-3 px-2 font-normal">Lot Number</th>
                    <th className="py-3 px-2 font-normal">Caliber</th>
                    <th className="py-3 px-2 font-normal">GGN Number</th>
                    <th className="py-3 px-2 font-normal">Packaging</th>
                    <th className="py-3 px-2 font-normal">Boxes</th>
                    <th className="py-3 px-2 font-normal">Net Wt</th>
                    <th className="py-3 px-2 font-normal">Gross Wt</th>
                    <th className="py-3 px-2 font-normal w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, idx) => (
                    <tr key={field.id} className="border-b border-gray-100 last:border-0">
                      <td className="py-2 px-2">
                        <Input {...form.register(`items.${idx}.pallet`)} error={!!form.formState.errors.items?.[idx]?.pallet} className="h-9 text-xs" />
                        <FieldError message={form.formState.errors.items?.[idx]?.pallet?.message} />
                      </td>
                      <td className="py-2 px-2">
                        <Select onValueChange={v => form.setValue(`items.${idx}.productId`, v, { shouldValidate: true })}>
                          <SelectTrigger error={!!form.formState.errors.items?.[idx]?.productId} className="h-9 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {sortProducts(productsData || [])?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.productName} - {p.category} - {p.type}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FieldError message={form.formState.errors.items?.[idx]?.productId?.message} />
                      </td>
                      <td className="py-2 px-2">
                        <Input {...form.register(`items.${idx}.lotNumber`)} error={!!form.formState.errors.items?.[idx]?.lotNumber} className="h-9 text-xs" />
                        <FieldError message={form.formState.errors.items?.[idx]?.lotNumber?.message} />
                      </td>
                      <td className="py-2 px-2">
                        <Input {...form.register(`items.${idx}.caliber`)} error={!!form.formState.errors.items?.[idx]?.caliber} className="h-9 text-xs" />
                        <FieldError message={form.formState.errors.items?.[idx]?.caliber?.message} />
                      </td>
                      <td className="py-2 px-2">
                        <Select onValueChange={v => form.setValue(`items.${idx}.ggnNumber`, v, { shouldValidate: true })} defaultValue={orderGgns[0]}>
                          <SelectTrigger error={!!form.formState.errors.items?.[idx]?.ggnNumber} className="h-9 text-xs"><SelectValue placeholder="GGN" /></SelectTrigger>
                          <SelectContent>
                            {orderGgns.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                            {!orderGgns.length && <SelectItem value="N/A">N/A</SelectItem>}
                          </SelectContent>
                        </Select>
                        <FieldError message={form.formState.errors.items?.[idx]?.ggnNumber?.message} />
                      </td>
                      <td className="py-2 px-2">
                        <Select onValueChange={v => {
                          form.setValue(`items.${idx}.packagingTypeId`, v, { shouldValidate: true });
                          const boxes = Number(form.getValues(`items.${idx}.numberOfBoxes`)) || 0;
                          const consumable = packagingData?.find((p: any) => p.id === v);
                          const pkgWeight = getPackagingWeight(consumable) || 0;
                          if (pkgWeight === 0) {
                            console.warn(`Packaging weight not found for ${consumable?.displayName || v}`);
                          }
                          form.setValue(`items.${idx}.netWeight`, pkgWeight * boxes, { shouldValidate: true });
                        }}>
                          <SelectTrigger error={!!form.formState.errors.items?.[idx]?.packagingTypeId} className="h-9 text-xs"><SelectValue placeholder="Packaging" /></SelectTrigger>
                          <SelectContent>
                            {packagingData?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.displayName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FieldError message={form.formState.errors.items?.[idx]?.packagingTypeId?.message} />
                      </td>
                      <td className="py-2 px-2">
                        <Input type="number" {...form.register(`items.${idx}.numberOfBoxes`, {
                          onChange: (e) => {
                            const boxes = Number(e.target.value) || 0;
                            const pkgId = form.getValues(`items.${idx}.packagingTypeId`);
                            const consumable = packagingData?.find((p: any) => p.id === pkgId);
                            const pkgWeight = getPackagingWeight(consumable) || 0;
                            form.setValue(`items.${idx}.netWeight`, pkgWeight * boxes, { shouldValidate: true });
                          }
                        })} error={!!form.formState.errors.items?.[idx]?.numberOfBoxes} className="h-9 text-xs" />
                        <FieldError message={form.formState.errors.items?.[idx]?.numberOfBoxes?.message} />
                      </td>
                      <td className="py-2 px-2">
                        <Input type="number" step="0.01" readOnly {...form.register(`items.${idx}.netWeight`)} error={!!form.formState.errors.items?.[idx]?.netWeight} className="h-9 text-xs bg-gray-50 cursor-not-allowed" />
                        <FieldError message={form.formState.errors.items?.[idx]?.netWeight?.message} />
                      </td>
                      <td className="py-2 px-2">
                        <Input type="number" step="0.01" {...form.register(`items.${idx}.grossWeight`)} error={!!form.formState.errors.items?.[idx]?.grossWeight} className="h-9 text-xs" />
                        <FieldError message={form.formState.errors.items?.[idx]?.grossWeight?.message} />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(idx)} className="h-8 w-8 text-rose-500"><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  ))}
                  {fields.length === 0 && (
                    <tr><td colSpan={10} className="py-8 text-center text-slate-400">No items added.</td></tr>
                  )}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-slate-400 font-bold uppercase text-xs tracking-wider">Please select a Production Type to view contents</div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={() => router.push('/supply-chain/packing-lists')} className="h-14 px-8 border-slate-200 bg-white font-black text-[10px] text-slate-500 uppercase tracking-[0.2em] rounded-xl hover:bg-slate-50 shadow-sm">Cancel</Button>
          <Button type="submit" disabled={loading} className="h-14 px-12 bg-[#7a9800] hover:bg-[#6c8500] text-white font-black rounded-xl shadow-xl shadow-[#7a9800]/20 uppercase tracking-[0.2em] text-[10px]">
            {loading ? <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> SAVING...</> : 'Save Packing List'}
          </Button>
        </div>
      </form>
    </div>
  );
}
