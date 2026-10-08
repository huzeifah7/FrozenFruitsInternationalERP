'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  updateDoc,
  serverTimestamp 
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

export default function EditPackingListPage() {
  const router = useRouter();
  const { id } = useParams();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialData, setInitialData] = useState<any>(null);
  const [currentOrder, setCurrentOrder] = useState<any>(null);

  const ordersQuery = useMemoFirebase(() => query(collection(db, 'orders'), where('status', '==', 'Produced')), [db]);
  const { data: ordersData } = useCollection<any>(ordersQuery);

  const combinedOrders = useMemo(() => {
    const list = ordersData ? [...ordersData] : [];
    if (currentOrder && !list.some(o => o.id === currentOrder.id)) {
      list.push(currentOrder);
    }
    return list;
  }, [ordersData, currentOrder]);

  const transportQuery = useMemoFirebase(() => query(collection(db, 'suppliers'), where('supplier_type', '==', 'Transport')), [db]);
  const { data: transportData } = useCollection<any>(transportQuery);

  const productsQuery = useMemoFirebase(() => query(collection(db, 'products')), [db]);
  const { data: productsData } = useCollection<any>(productsQuery);

  const packagingQuery = useMemoFirebase(() => query(collection(db, 'consumables'), where('is_packaging', '==', true)), [db]);
  const { data: packagingData } = useCollection<any>(packagingQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      productionType: '',
      orderId: '',
      ggnNumber: '',
      sealNumber: '',
      etd: '',
      expeditionDate: '',
      dateOfLoading: '',
      truckNumber: '',
      transportCompanyId: '',
      remarks: '',
      customerAddress: '',
      deliveryAddress: '',
      cocNumber: '',
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

  useEffect(() => {
    if (!db || !id) return;
    const fetchPL = async () => {
      try {
        const snap = await getDoc(doc(db, 'packingLists', id as string));
        if (snap.exists()) {
          const data = snap.data();
          setInitialData(data);
          form.reset({
            productionType: data.productionType || '',
            orderId: data.orderId || '',
            ggnNumber: data.ggnNumber || '',
            sealNumber: data.sealNumber || '',
            etd: data.etd || '',
            expeditionDate: data.expeditionDate || '',
            dateOfLoading: data.dateOfLoading || '',
            truckNumber: data.truckNumber || '',
            transportCompanyId: data.transportCompanyId || '',
            remarks: data.remarks || '',
            customerAddress: data.customerAddress || '',
            deliveryAddress: data.deliveryAddress || '',
            cocNumber: data.cocNumber || '',
            items: data.items || []
          });
          if (data.productionType === 'Internal Production') {
            setInternalItems(data.contents || []);
          }

          if (data.orderId) {
            const orderSnap = await getDoc(doc(db, 'orders', data.orderId));
            if (orderSnap.exists()) {
              setCurrentOrder({ id: orderSnap.id, ...orderSnap.data() });
            }
          }
        } else {
          toast({ title: 'Not found', description: 'Packing list not found.', variant: 'destructive' });
          router.push('/supply-chain/packing-lists');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPL();
  }, [db, id, form]);

  // Recalculate and update internalItems on load and once packagingData is available
  useEffect(() => {
    if (!initialData || initialData.productionType !== 'Internal Production' || !db) return;
    
    const recalculateInternal = async () => {
      try {
        const q = query(collection(db, 'production_output'), where('orderPoId', '==', initialData.orderId));
        const snap = await getDocs(q);
        const poMap: Record<string, { weight: number, typeId: string, typeName: string, items?: any[] }> = {};
        
        snap.forEach(poDoc => {
          const poData = poDoc.data();
          const consumable = packagingData?.find((p: any) => p.id === poData.packagingTypeId);
          const weight = getPackagingWeight(consumable) ?? getPackagingWeight(poData.packagingTypeName) ?? 0;
          poMap[poData.barcode] = {
            weight,
            typeId: poData.packagingTypeId || '',
            typeName: poData.packagingTypeName || '',
            items: poData.items || []
          };
        });
        
        const updatedContents = (initialData.contents || []).map((item: any) => {
          const barcode = item.productionOutput || item.barcode;
          const poInfo = poMap[barcode];
          
          let unitWeight = 0;
          if (item.packagingTypeId) {
            const consumable = packagingData?.find((p: any) => p.id === item.packagingTypeId);
            unitWeight = getPackagingWeight(consumable) ?? getPackagingWeight(item.packagingTypeName) ?? 0;
          } else if (poInfo) {
            unitWeight = poInfo.weight;
          }
          
          if (unitWeight === 0 && (item.packagingTypeName || poInfo?.typeName)) {
            console.warn(`Packaging weight not found for ${item.packagingTypeName || poInfo?.typeName}`);
          }
          
          const boxes = Number(item.numberOfBoxes || item.boxes || 0);

          let productId = item.productId;
          if (!productId && poInfo?.items) {
             const poItem = poInfo.items.find((pi: any) => (pi.caliber === item.caliber || (!pi.caliber && !item.caliber)) && (pi.lotNumber === item.lotNumber || pi.rawMaterialLotNumber === item.lotNumber)) || poInfo.items[0];
             productId = poItem?.productId;
          }
          const prod = productsData?.find((p: any) => (productId && p.id === productId) || p.productName === (item.productName || item.product || item.variety));
          const fullProdName = prod ? [prod.productName, prod.category, prod.type].filter(Boolean).join(' - ') : (item.productName || item.product || item.variety || '—');

          return {
            ...item,
            productName: fullProdName,
            packagingTypeId: item.packagingTypeId || poInfo?.typeId || '',
            packagingTypeName: item.packagingTypeName || poInfo?.typeName || '',
            netWeight: unitWeight * boxes,
          };
        });
        
        setInternalItems(updatedContents);
      } catch (err) {
        console.error('Error recalculating internal items:', err);
      }
    };
    
    recalculateInternal();
  }, [initialData, packagingData, db]);

  // Recalculate Prestation items on load once packagingData is available
  useEffect(() => {
    if (!initialData || initialData.productionType !== 'Prestation' || !packagingData || packagingData.length === 0) return;
    
    const items = form.getValues('items') || [];
    let changed = false;
    const recalculatedItems = items.map((item: any) => {
      const consumable = packagingData?.find((p: any) => p.id === item.packagingTypeId);
      const unitWeight = getPackagingWeight(consumable) ?? getPackagingWeight(item.packagingTypeName) ?? 0;
      const boxes = Number(item.numberOfBoxes || item.boxes || 0);
      const calculatedNet = unitWeight * boxes;
      if (item.netWeight !== calculatedNet) {
        changed = true;
        return {
          ...item,
          netWeight: calculatedNet
        };
      }
      return item;
    });
    
    if (changed) {
      form.setValue('items', recalculatedItems, { shouldValidate: true });
    }
  }, [initialData, packagingData]);

  useEffect(() => {
    if (!watchOrderId || !combinedOrders || !db) return;
    const order = combinedOrders.find(o => o.id === watchOrderId);
    if (!order) return;
    setOrderDetails(order);

    const fetchCustomerDetails = async () => {
      try {
        let ggnList: string[] = [];
        let addressStr = '';
        let deliveryStr = '';
        let cocStr = '';

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
        }
        
        setOrderGgns(ggnList);
        form.setValue('ggnNumber', ggnList.length > 0 ? ggnList[0] : 'N/A');
        
        // Only override if the user hasn't explicitly saved them before, or if order changed
        if (!form.getValues('customerAddress')) form.setValue('customerAddress', addressStr);
        if (!form.getValues('deliveryAddress')) form.setValue('deliveryAddress', deliveryStr);
        if (!form.getValues('cocNumber')) form.setValue('cocNumber', cocStr);

      } catch (e) {
        console.error('Error fetching customer details:', e);
      }
    };
    fetchCustomerDetails();
  }, [watchOrderId, combinedOrders, db, form]);

  const totals = useMemo(() => {
    let net = 0, gross = 0, boxes = 0;
    if (watchProductionType === 'Internal Production') {
      internalItems.forEach(i => {
        net += i.netWeight;
        gross += i.grossWeight;
        boxes += i.numberOfBoxes || i.boxes || 0;
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
    if (!db || !user || !orderDetails || !initialData) return;
    
    if (watchProductionType === 'Prestation' && (!values.items || values.items.length === 0)) {
      toast({ title: 'Validation Error', description: 'Prestation packing lists require at least one item.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const selectedCompany = transportData?.find((tc: any) => tc.id === values.transportCompanyId);
      const transportCompanyName = selectedCompany ? selectedCompany.name : 'Unknown';

      const plRef = doc(db, 'packingLists', id as string);

      const packingListData = {
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
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'System'
      };

      if (values.productionType === 'Internal Production') {
        Object.assign(packingListData, {
          contents: internalItems,
          items: []
        });
      } else {
        const hydratedItems = (values.items || []).map(item => {
          const prod = productsData?.find((p: any) => p.id === item.productId);
          const pack = packagingData?.find((p: any) => p.id === item.packagingTypeId);
          return {
            ...item,
            productName: prod ? [prod.productName, prod.category, prod.type].filter(Boolean).join(' - ') : '',
            packagingTypeName: pack ? pack.displayName : ''
          };
        });
        Object.assign(packingListData, {
          contents: [],
          items: hydratedItems
        });
      }

      await updateDoc(plRef, packingListData);

      toast({
        title: 'Success',
        description: `Packing list updated successfully.`
      });

      router.push('/supply-chain/packing-lists');
    } catch (err) {
      console.error('Error updating packing list:', err);
      toast({
        title: 'Error',
        description: 'Failed to update packing list.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-[#7a9800]" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-4">Loading Packing List...</p>
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
              <li className="flex items-center"><span className="mx-2 opacity-20">/</span><span className="text-primary/60 font-black">Edit Packing List</span></li>
            </ol>
          </nav>
          <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Edit Packing List: {initialData?.packingListNumber}</h1>
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
              <Select onValueChange={v => form.setValue('productionType', v, { shouldValidate: true })} value={watchProductionType}>
                <SelectTrigger error={!!form.formState.errors.productionType} className="h-10 rounded-md border-gray-200" disabled><SelectValue placeholder="Select Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Internal Production">Internal Production</SelectItem>
                  <SelectItem value="Prestation">Prestation</SelectItem>
                </SelectContent>
              </Select>
              <FieldError message={form.formState.errors.productionType?.message} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">Order PO Number</Label>
              <Select onValueChange={v => form.setValue('orderId', v, { shouldValidate: true })} value={watchOrderId}>
                <SelectTrigger error={!!form.formState.errors.orderId} className="h-10 rounded-md border-gray-200" disabled><SelectValue placeholder="Select Order" /></SelectTrigger>
                <SelectContent>
                  {combinedOrders?.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.poNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={form.formState.errors.orderId?.message} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-700">GGN Number</Label>
              <Select onValueChange={v => form.setValue('ggnNumber', v)} value={form.watch('ggnNumber') || ''}>
                <SelectTrigger error={!!form.formState.errors.ggnNumber} className="h-10 rounded-md border-gray-200"><SelectValue placeholder="GGN Number" /></SelectTrigger>
                <SelectContent>
                  {orderGgns.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
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
              <Select onValueChange={v => form.setValue('transportCompanyId', v, { shouldValidate: true })} value={form.watch('transportCompanyId')}>
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
                        <Select onValueChange={v => form.setValue(`items.${idx}.productId`, v)} value={form.watch(`items.${idx}.productId`)}>
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
                        <Select onValueChange={v => form.setValue(`items.${idx}.ggnNumber`, v)} value={form.watch(`items.${idx}.ggnNumber`) || orderGgns[0]}>
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
                        }} value={form.watch(`items.${idx}.packagingTypeId`)}>
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

        <div className="flex justify-end pt-4 gap-4">
          <Button type="button" variant="outline" onClick={() => router.push('/supply-chain/packing-lists')} className="h-10 px-6 border-slate-200 bg-white font-bold text-slate-500 rounded-sm hover:bg-slate-50 shadow-sm">Cancel</Button>
          <Button type="submit" disabled={saving} className="h-10 px-6 rounded-sm bg-[#7a9800] hover:bg-[#6c8500] text-white font-bold gap-2">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
