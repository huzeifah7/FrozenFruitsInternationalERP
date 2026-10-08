'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  collection,
  addDoc,
  serverTimestamp,
  runTransaction,
  doc,
  getDoc,
  query,
  where,
  getDocs,
} from '@/firebase/firestore-override';
import { generateProductionOutputPDF } from '@/lib/export-production-output-pdf';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
  useUser,
} from '@/firebase';
import { useAuthContext } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Loader2,
  Search,
  Check,
  ChevronsUpDown,
  AlertCircle,
  Package,
} from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, sortProducts, normalizePackagingName, getProductionPackagingOptions } from '@/lib/utils';
import { validateProductionOutputItems, getBoxValidationRule } from '@/lib/production-validation';
import { FieldError } from '@/components/ui/field-error';

// Helper to get local date & time strings
const getLocalShiftDate = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  const localISOTime = (new Date(Date.now() - tzoffset)).toISOString();
  return localISOTime.split('T')[0];
};

const getLocalDateTime = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  const localISOTime = (new Date(Date.now() - tzoffset)).toISOString();
  return localISOTime.slice(0, 16);
};

// Validation Schema
const outputSchema = z.object({
  dateTime: z.string().min(1, "Date Time is required"),
  orderPoId: z.string().optional(),
  locationId: z.string().min(1, "Location is required"),
  shiftDate: z.string().min(1, "Shift Date is required"),
  remark: z.string().optional(),
  palletisationType: z.string().min(1, "Palletisation Type is required"),
  transportType: z.string().min(1, "Transport Type is required"),
  ggnNumber: z.string().optional(),
  shift: z.string().min(1, "Shift is required"),
  packagingTypeId: z.string().min(1, "Packaging Type is required"),
  tare: z.preprocess(
    val => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number({ invalid_type_error: "Tare must be a number" }).optional()
  ),
  items: z.array(z.object({
    caliber: z.string().optional(),
    productId: z.string().min(1, "Product is required"),
    lotNumber: z.string().optional(),
    rawMaterialLotNumber: z.string().optional(),
    numberOfBoxes: z.coerce.number().min(1, "Required"),
    grossWeight: z.coerce.number().min(0, "Required"),
    netWeight: z.coerce.number().min(0.01, "Required"),
  })).min(1, "At least one item is required")
}).superRefine((data, ctx) => {
  if (data.palletisationType === 'Final product') {
    if (!data.orderPoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Order PO is required for Final Product",
        path: ["orderPoId"]
      });
    }
    if (!data.ggnNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "GGN Number is required for Final Product",
        path: ["ggnNumber"]
      });
    }
  }

  const isFinalOrOutOfProgram = 
    data.palletisationType === 'Final product' || 
    data.palletisationType === 'Finalised pallet' || 
    data.palletisationType?.toLowerCase().includes('out of program');

  if (isFinalOrOutOfProgram) {
    data.items.forEach((item, index) => {
      if (!item.caliber || item.caliber.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Caliber is required",
          path: ["items", index, "caliber"]
        });
      }
    });

    if (!!data.packagingTypeId) {
      if (data.tare === undefined || data.tare === null || isNaN(Number(data.tare)) || Number(data.tare) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Tare is required and must be greater than 0",
          path: ["tare"]
        });
      }
    }
  }

  // Lot number validation: required only in Final Product
  if (data.palletisationType === 'Final product' || data.palletisationType === 'Finalised pallet') {
    data.items.forEach((item, index) => {
      if (!item.lotNumber || item.lotNumber.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Lot Number is required",
          path: ["items", index, "lotNumber"]
        });
      }
    });
  }
});

type OutputFormValues = z.infer<typeof outputSchema>;

export default function AddProductionOutputPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { profile } = useAuthContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [packagingSearch, setPackagingSearch] = useState('');
  const [isPackagingOpen, setIsPackagingOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const [pendingValues, setPendingValues] = useState<OutputFormValues | null>(null);

  // Queries
  const ordersQuery = useMemoFirebase(() => db ? query(collection(db, 'orders')) : null, [db]);
  const locationsQuery = useMemoFirebase(() => db ? collection(db, 'processing_lines') : null, [db]); 
  const productsQuery = useMemoFirebase(() => db ? collection(db, 'products') : null, [db]);
  const consumablesQuery = useMemoFirebase(() => db ? collection(db, 'consumables') : null, [db]);
  const farmsQuery = useMemoFirebase(() => db ? collection(db, 'main_farms') : null, [db]);
  const customersQuery = useMemoFirebase(() => db ? collection(db, 'customers') : null, [db]);
  const suppliersQuery = useMemoFirebase(() => db ? collection(db, 'suppliers') : null, [db]);
  const procSuppliersQuery = useMemoFirebase(() => db ? collection(db, 'procurement_suppliers') : null, [db]);
  const scSuppliersQuery = useMemoFirebase(() => db ? collection(db, 'supply_chain_suppliers') : null, [db]);

  const { data: orders } = useCollection(ordersQuery);
  const { data: locations } = useCollection(locationsQuery);
  const { data: products } = useCollection(productsQuery);
  const { data: consumables } = useCollection(consumablesQuery);
  const { data: farms } = useCollection(farmsQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: rawSuppliers } = useCollection(suppliersQuery);
  const { data: procSuppliers } = useCollection(procSuppliersQuery);
  const { data: scSuppliers } = useCollection(scSuppliersQuery);

  const suppliers = React.useMemo(() => {
    const map = new Map<string, any>();
    (rawSuppliers || []).forEach(s => map.set(s.id, s));
    (procSuppliers || []).forEach(s => map.set(s.id, s));
    (scSuppliers || []).forEach(s => map.set(s.id, s));
    return Array.from(map.values());
  }, [rawSuppliers, procSuppliers, scSuppliers]);

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter(o => o.status === 'Confirmed' || o.status === 'In-Production');
  }, [orders]);

  const form = useForm<OutputFormValues>({
    resolver: zodResolver(outputSchema),
    defaultValues: {
      dateTime: getLocalDateTime(),
      shiftDate: getLocalShiftDate(),
      shift: '1',
      transportType: 'container',
      palletisationType: 'Final product',
      items: [{ productId: '', lotNumber: '', numberOfBoxes: 0, grossWeight: 0, netWeight: 0 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items'
  });

  const packagingOptions = React.useMemo(() => {
    return consumables?.filter(c => c.is_packaging === true).map(c => {
      const weightVal = c.weight_per_unit !== undefined ? c.weight_per_unit :
                        c.weightPerUnit !== undefined ? c.weightPerUnit :
                        c.standardWeightPerUnitKg !== undefined ? c.standardWeightPerUnitKg :
                        c.weight !== undefined ? c.weight : 0;
      
      let supplierNames = '';
      if (Array.isArray(c.suppliers) && c.suppliers.length > 0) {
        supplierNames = c.suppliers
          .map(supVal => {
            if (suppliers) {
              const foundById = suppliers.find(s => s.id === supVal);
              if (foundById) return (foundById.name || foundById.supplierName || '');
              const foundByName = suppliers.find(s => (s.name || s.supplierName || '').toLowerCase() === supVal.toLowerCase());
              if (foundByName) return (foundByName.name || foundByName.supplierName || '');
            }
            return supVal;
          })
          .filter(Boolean)
          .join(', ');
      }
      if (!supplierNames) {
        supplierNames = c.supplierName || c.supplier_name || c.supplier || '';
      }
      if (!supplierNames) {
        supplierNames = 'Unknown Supplier';
      }

      return {
        id: c.id,
        name: c.name || c.consumableName || '',
        displayName: `${c.name || c.consumableName || ''} - ${supplierNames}`,
        standardWeight: Number(weightVal) || 0
      };
    }) || [];
  }, [consumables, suppliers]);

  const orderVarieties = React.useMemo(() => {
    return sortProducts(products || [])?.map(p => ({
      id: p.id,
      displayName: `${p.productName || ''} - ${p.category || ''} - ${p.type || ''}`
    })) || [];
  }, [products]);

  // Auto calculate shift and shift date from dateTime
  const dateTimeVal = form.watch('dateTime');
  React.useEffect(() => {
    if (!dateTimeVal) {
      form.setValue('shift', '');
      form.setValue('shiftDate', '');
      return;
    }
    
    try {
      const dt = new Date(dateTimeVal);
      if (isNaN(dt.getTime())) {
        form.setValue('shift', '');
        form.setValue('shiftDate', '');
        return;
      }

      const hours = dt.getHours();
      const minutes = dt.getMinutes();
      const time = hours + minutes / 60;

      let newShift = '';
      let shiftDateObj = new Date(dt);

      if (time >= 8.5 && time <= 19) {
        newShift = '1';
      } else if (time >= 20.5 && time < 24) {
        newShift = '2';
      } else if (time >= 0 && time <= 7) {
        newShift = '2';
        shiftDateObj.setDate(shiftDateObj.getDate() - 1);
      } else {
        newShift = '';
      }

      const y = shiftDateObj.getFullYear();
      const m = String(shiftDateObj.getMonth() + 1).padStart(2, '0');
      const d = String(shiftDateObj.getDate()).padStart(2, '0');
      const shiftDateStr = `${y}-${m}-${d}`;
      
      if (newShift) {
        form.setValue('shift', newShift, { shouldValidate: true });
        form.setValue('shiftDate', shiftDateStr, { shouldValidate: true });
      } else {
        form.setValue('shift', '', { shouldValidate: true });
        form.setValue('shiftDate', '', { shouldValidate: true });
      }
    } catch (e) {
      form.setValue('shift', '');
      form.setValue('shiftDate', '');
    }
  }, [dateTimeVal, form]);

  // Watch for order selection to auto-fill
  const selectedOrderId = form.watch('orderPoId');
  const selectedOrder = React.useMemo(() => orders?.find(o => o.id === selectedOrderId), [orders, selectedOrderId]);

  const palletType = form.watch('palletisationType');
  const showCaliber = palletType === 'Return' || palletType === 'Reste' || palletType === 'Final product' || palletType === 'Out Of Program' || palletType === 'Out of program';

  const customerFarms = React.useMemo(() => {
    if (!selectedOrder?.customerId || !customers) return [];
    const customer = customers.find(c => c.id === selectedOrder.customerId);
    return customer?.farms?.filter((f: any) => f.ggnNumber) || [];
  }, [selectedOrder, customers]);



  const filteredPackagingOptions = React.useMemo(() => {
    // When no order is selected or pallet type is not Final product, show all packaging options
    if (palletType !== 'Final product' || !selectedOrder) {
      return packagingOptions;
    }

    if (!selectedOrder.items || selectedOrder.items.length === 0) {
      return [];
    }

    // Collect ALL unique packaging types from every order item
    const uniquePackagingTypes = Array.from(
      new Set(
        selectedOrder.items
          .map((i: any) => i.packagingType)
          .filter(Boolean)
      )
    ) as string[];

    if (uniquePackagingTypes.length === 0) return [];

    // Get matching consumables for each packaging type and merge, deduplicating by ID
    const seen = new Set<string>();
    const merged: any[] = [];
    for (const pkgType of uniquePackagingTypes) {
      const matches = getProductionPackagingOptions(pkgType, packagingOptions);
      for (const opt of matches) {
        if (!seen.has(opt.id)) {
          seen.add(opt.id);
          merged.push(opt);
        }
      }
    }
    return merged;
  }, [packagingOptions, selectedOrder, palletType]);


  React.useEffect(() => {
    const currentVal = form.getValues('packagingTypeId');
    if (currentVal) {
      const exists = filteredPackagingOptions.some(opt => opt.id === currentVal);
      if (!exists) {
        form.setValue('packagingTypeId', '', { shouldValidate: true });
      }
    }

    if (filteredPackagingOptions.length === 1) {
      const singleOption = filteredPackagingOptions[0];
      if (form.getValues('packagingTypeId') !== singleOption.id) {
        form.setValue('packagingTypeId', singleOption.id, { shouldValidate: true });
      }
    }
  }, [filteredPackagingOptions, form]);







  React.useEffect(() => {
    if (!selectedOrder) return;

    // 1. Auto-select GGN from the order's customer farms
    if (selectedOrder.customerId && customers) {
      const customer = customers.find(c => c.id === selectedOrder.customerId);
      if (customer?.farms?.length > 0) {
        // Find the farm that might have been "selected" or just default to the first one
        // If the order has a farmId (even if hidden), use that. Otherwise use first customer farm.
        const targetFarm = customer.farms.find((f: any) => f.farmId === (selectedOrder as any).farmId) || customer.farms[0];
        if (targetFarm?.ggnNumber) {
          form.setValue('ggnNumber', targetFarm.ggnNumber);
        }
      }
    }

    // Auto-select packaging logic is now handled in the filteredPackagingOptions effect
  }, [selectedOrder, customers, packagingOptions, form]);

  // 3. Auto-select Location from user profile (matching by title if necessary)
  React.useEffect(() => {
    const userLocValue = profile?.locationId || profile?.location;
    if (userLocValue && locations) {
      const matchedLocation = locations.find(l => l.id === userLocValue || l.title === userLocValue);
      if (matchedLocation && !form.getValues('locationId')) {
        form.setValue('locationId', matchedLocation.id, { shouldValidate: true });
      }
    }
  }, [profile, locations, form]);

  const generateDefaultLotNumber = (shiftDateStr?: string) => {
    try {
      const dateObj = shiftDateStr ? new Date(shiftDateStr) : new Date();
      if (isNaN(dateObj.getTime())) {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yy = String(now.getFullYear()).slice(-2);
        return `01-${dd}${mm}EOF${yy}`;
      }
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yy = String(dateObj.getFullYear()).slice(-2);
      return `01-${dd}${mm}EOF${yy}`;
    } catch {
      return '01-2707EOF26';
    }
  };

  const handleProductChange = async (index: number, productId: string, targetPoId?: string) => {
    if (!productId) {
      form.setValue(`items.${index}.lotNumber`, '', { shouldValidate: true });
      return;
    }
    const orderPoId = targetPoId || form.getValues('orderPoId');

    if (!orderPoId || !db) {
      form.setValue(`items.${index}.lotNumber`, '', { shouldValidate: true });
      return;
    }

    try {
      const targetProd = products?.find(p => p.id === productId);
      const targetCategory = (targetProd?.category || targetProd?.variety || '').trim().toLowerCase();
      const targetType = (targetProd?.type || '').trim().toLowerCase();

      const q = query(
        collection(db, 'production_output'),
        where('orderPoId', '==', orderPoId)
      );
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(d => {
        const data = d.data() as any;
        let createdMs = 0;
        if (data.createdAt) {
          if (typeof data.createdAt.toMillis === 'function') {
            createdMs = data.createdAt.toMillis();
          } else if (data.createdAt instanceof Date) {
            createdMs = data.createdAt.getTime();
          } else if (typeof data.createdAt === 'number') {
            createdMs = data.createdAt;
          } else if (data.createdAt.seconds !== undefined) {
            createdMs = data.createdAt.seconds * 1000;
          }
        }
        return { ...data, id: d.id, createdMs } as any;
      });

      // Sort ascending to find from earliest palletization to newest
      docs.sort((a, b) => a.createdMs - b.createdMs);

      // Search existing palletizations in DB for the earliest matching product (Category & Type or direct productId)
      let matchedLotNumber = '';

      for (const d of docs) {
        if (Array.isArray(d.items) && d.items.length > 0) {
          for (const item of d.items) {
            const itemLot = (item.lotNumber || d.lotNumber || '').trim();
            if (!itemLot) continue;

            const isSameProductId = Boolean(item.productId && item.productId === productId);
            const itemProd = products?.find(p => p.id === item.productId);
            const itemCategory = (itemProd?.category || itemProd?.variety || item.category || item.variety || '').trim().toLowerCase();
            const itemType = (itemProd?.type || item.type || '').trim().toLowerCase();

            const isSameCategoryAndType = Boolean(
              targetCategory &&
              targetType &&
              itemCategory === targetCategory &&
              itemType === targetType
            );

            if (isSameProductId || isSameCategoryAndType) {
              matchedLotNumber = itemLot;
              break;
            }
          }
        } else if (d.lotNumber) {
          const dLot = (d.lotNumber || '').trim();
          if (dLot) {
            const isSameProductId = Boolean(d.productId && d.productId === productId);
            const dProd = products?.find(p => p.id === d.productId);
            const dCategory = (dProd?.category || dProd?.variety || d.category || d.variety || '').trim().toLowerCase();
            const dType = (dProd?.type || d.type || '').trim().toLowerCase();

            const isSameCategoryAndType = Boolean(
              targetCategory &&
              targetType &&
              dCategory === targetCategory &&
              dType === targetType
            );

            if (isSameProductId || isSameCategoryAndType) {
              matchedLotNumber = dLot;
              break;
            }
          }
        }
        if (matchedLotNumber) break;
      }

      if (matchedLotNumber) {
        form.setValue(`items.${index}.lotNumber`, matchedLotNumber, { shouldValidate: true });
        return;
      }

      // If no match in DB yet, check other rows in the current form
      const formItems = form.getValues('items') || [];
      let formMatchedLot = '';
      for (let i = 0; i < formItems.length; i++) {
        if (i === index) continue;
        const fItem = formItems[i];
        if (!fItem || !fItem.productId) continue;
        const fLot = (fItem.lotNumber || '').trim();
        if (!fLot) continue;

        const isSameProd = fItem.productId === productId;
        const fProd = products?.find(p => p.id === fItem.productId);
        const fCategory = (fProd?.category || fProd?.variety || '').trim().toLowerCase();
        const fType = (fProd?.type || '').trim().toLowerCase();

        if (isSameProd || (targetCategory && targetType && fCategory === targetCategory && fType === targetType)) {
          formMatchedLot = fLot;
          break;
        }
      }

      if (formMatchedLot) {
        form.setValue(`items.${index}.lotNumber`, formMatchedLot, { shouldValidate: true });
      } else {
        // First time this product/category/type is being palletized in this order -> EMPTY (user must enter)
        form.setValue(`items.${index}.lotNumber`, '', { shouldValidate: true });
      }
    } catch (error) {
      console.error("Error fetching lot number:", error);
      form.setValue(`items.${index}.lotNumber`, '', { shouldValidate: true });
    }
  };

  // Sync subsequent rows in current form when user types/changes Lot Number or Product on row 0
  const firstRowLot = form.watch('items.0.lotNumber');
  const firstRowProdId = form.watch('items.0.productId');
  React.useEffect(() => {
    const items = form.getValues('items');
    if (!items || items.length <= 1 || !firstRowProdId) return;

    const firstProd = products?.find(p => p.id === firstRowProdId);
    if (!firstProd) return;
    const firstCategory = (firstProd.category || firstProd.variety || '').trim().toLowerCase();
    const firstType = (firstProd.type || '').trim().toLowerCase();

    for (let i = 1; i < items.length; i++) {
      const rowItem = items[i];
      if (rowItem.productId) {
        const rowProd = products?.find(p => p.id === rowItem.productId);
        const rowCategory = (rowProd?.category || rowProd?.variety || '').trim().toLowerCase();
        const rowType = (rowProd?.type || '').trim().toLowerCase();

        if (rowCategory === firstCategory && rowType === firstType) {
          if (rowItem.lotNumber !== (firstRowLot || '')) {
            form.setValue(`items.${i}.lotNumber`, firstRowLot || '', { shouldValidate: true });
          }
        }
      }
    }
  }, [firstRowLot, firstRowProdId, products, form]);

  // Auto-populate 1 single line when selected PO (Order) changes
  React.useEffect(() => {
    if (!selectedOrder?.items?.length) return;

    const firstProductId = selectedOrder.items[0].productId || '';

    const singleItem = {
      productId: firstProductId,
      caliber: '',
      lotNumber: '',
      rawMaterialLotNumber: '',
      numberOfBoxes: 0,
      grossWeight: 0,
      netWeight: 0,
    };

    form.setValue('items', [singleItem], { shouldValidate: true });

    if (firstProductId) {
      handleProductChange(0, firstProductId, selectedOrder.id);
    }
  }, [selectedOrder, form]);

  // Inherit Tare from first palletization of the order (or empty if no pallet in this PO yet)
  React.useEffect(() => {
    const fetchFirstPalletTare = async () => {
      if (!selectedOrderId || !db) {
        form.setValue('tare', '' as any, { shouldValidate: false });
        return;
      }

      try {
        const q = query(
          collection(db, 'production_output'),
          where('orderPoId', '==', selectedOrderId)
        );
        const snapshot = await getDocs(q);
        const docs = snapshot.docs.map(d => {
          const data = d.data() as any;
          let createdMs = 0;
          if (data.createdAt) {
            if (typeof data.createdAt.toMillis === 'function') {
              createdMs = data.createdAt.toMillis();
            } else if (data.createdAt instanceof Date) {
              createdMs = data.createdAt.getTime();
            } else if (typeof data.createdAt === 'number') {
              createdMs = data.createdAt;
            } else if (data.createdAt.seconds !== undefined) {
              createdMs = data.createdAt.seconds * 1000;
            }
          }
          return { ...data, createdMs };
        });

        // Sort ascending to get the very first pallet of this PO
        docs.sort((a, b) => a.createdMs - b.createdMs);

        if (docs.length > 0) {
          const firstPallet = docs[0];
          if (firstPallet.tare !== undefined && firstPallet.tare !== null && String(firstPallet.tare).trim() !== '') {
            form.setValue('tare', Number(firstPallet.tare), { shouldValidate: true });
          } else {
            form.setValue('tare', '' as any, { shouldValidate: false });
          }
        } else {
          // No pallet in this PO yet -> Tare must be empty and required
          form.setValue('tare', '' as any, { shouldValidate: false });
        }
      } catch (err) {
        console.error("Error fetching first pallet tare:", err);
        form.setValue('tare', '' as any, { shouldValidate: false });
      }
    };

    fetchFirstPalletTare();
  }, [selectedOrderId, db, form]);

  // 5. Auto-default packaging type to Montosa 20 KG if palletisationType is decay or return
  const prevPalletTypeRef = React.useRef(palletType);
  React.useEffect(() => {
    if (palletType !== prevPalletTypeRef.current) {
      if (palletType?.toLowerCase() === 'decay' || palletType === 'Return') {
        const matched = packagingOptions.find(opt => 
          (opt.name.toLowerCase().includes('montosa') || opt.name.toLowerCase().includes('montossa')) && 
          (opt.displayName.toLowerCase().includes('20') || String(opt.standardWeight) === '20')
        ) || packagingOptions.find(opt => 
          opt.name.toLowerCase().includes('montosa') || opt.name.toLowerCase().includes('montossa')
        );
        if (matched) {
          form.setValue('packagingTypeId', matched.id, { shouldValidate: true });
        }
      }

      prevPalletTypeRef.current = palletType;
    }
  }, [palletType, packagingOptions, form]);

  // 6. Auto-calculate Net Weight & Sync Tare on PalletType, PackagingType, or Tare change
  const currentPkgId = form.watch('packagingTypeId');
  const tareVal = form.watch('tare');

  const activeValidationRule = React.useMemo(() => {
    if (!currentPkgId || !packagingOptions) return null;
    const pkg = packagingOptions.find(p => p.id === currentPkgId);
    if (!pkg) return null;
    const firstItem = form.watch('items.0');
    const matchedOrderItem = selectedOrder?.items?.find((oi: any) => {
      if (oi.productId && firstItem?.productId && oi.productId === firstItem.productId) return true;
      return false;
    }) || selectedOrder?.items?.[0];
    return getBoxValidationRule(
      selectedOrder?.shippingMethod,
      matchedOrderItem?.palletType || selectedOrder?.palletType,
      pkg
    );
  }, [currentPkgId, form.watch('items.0.productId'), selectedOrder, packagingOptions]);

  React.useEffect(() => {
    const items = form.getValues('items');
    if (!items || items.length === 0) return;

    const numTare = (tareVal !== undefined && tareVal !== null && !isNaN(Number(tareVal)) && Number(tareVal) > 0)
      ? Number(tareVal)
      : 0;

    items.forEach((item, idx) => {
      const gross = Number(item.grossWeight) || 0;
      if (gross > 0) {
        const calculatedNet = Math.max(0, Math.round(gross - numTare));
        form.setValue(`items.${idx}.netWeight`, calculatedNet, { shouldValidate: true });
      }
    });
  }, [palletType, currentPkgId, tareVal, form]);

  // Helper for inline input changes
  const handleBoxOrGrossChange = (index: number, boxes: number, gross: number) => {
    const formTare = form.getValues('tare');
    const numTare = (formTare !== undefined && formTare !== null && !isNaN(Number(formTare)) && Number(formTare) > 0)
      ? Number(formTare)
      : 0;

    if (gross > 0) {
      const calculatedNet = Math.max(0, Math.round(gross - numTare));
      form.setValue(`items.${index}.netWeight`, calculatedNet, { shouldValidate: true });
    }
  };

  const checkDiscrepancies = (values: OutputFormValues) => {
    const selectedPackaging = packagingOptions.find(c => c.id === values.packagingTypeId);
    return validateProductionOutputItems({
      palletisationType: values.palletisationType,
      selectedOrder,
      packaging: selectedPackaging,
      tare: values.tare,
      items: values.items,
    });
  };
  const performSubmit = async (values: OutputFormValues) => {
    if (!db || !user) return;
    setLoading(true);

    try {
      const selectedOrder = orders?.find(o => o.id === values.orderPoId);
      const selectedLocation = locations?.find(l => l.id === values.locationId);
      const selectedPackaging = packagingOptions?.find(c => c.id === values.packagingTypeId);

      // Save validation guard: do not save packaging not in filtered list
      if (values.palletisationType === 'Final product' && values.orderPoId) {
        const isPackagingValid = filteredPackagingOptions.some(opt => opt.id === values.packagingTypeId);
        if (!isPackagingValid) {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: "The selected packaging is not valid for this Sales Order."
          });
          setLoading(false);
          return;
        }
      }

      // Generate Barcode using transaction and selected date
      const selectedDate = new Date(values.shiftDate || values.dateTime);
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const year = selectedDate.getFullYear();
      const dateStr = `${day}${month}${year}`;

      const barcode = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, 'metadata', 'production_output_counter');
        const counterSnap = await transaction.get(counterRef);
        let nextNum = 1;
        if (counterSnap.exists()) {
          nextNum = (counterSnap.data().lastValue || 0) + 1;
        }
        transaction.set(counterRef, { lastValue: nextNum }, { merge: true });
        return `PP${dateStr}-${String(nextNum).padStart(5, '0')}`;
      });

      const processedItems = values.items.map(item => {
        const p = products?.find(prod => prod.id === item.productId);
        return {
          ...item,
          productName: p?.productName || 'Unknown',
          variety: p?.variety || p?.category || 'Unknown',
          category: p?.category || '',
          type: p?.type || ''
        };
      });

      const seasonId = typeof window !== 'undefined' ? localStorage.getItem('season_id') : null;

      const outputData = {
        ...values,
        seasonId,
        orderPoId: values.palletisationType === 'Final product' ? (values.orderPoId || '') : '',
        ggnNumber: values.palletisationType === 'Final product' ? (values.ggnNumber || '') : '',
        items: processedItems,
        barcode,
        orderPoNumber: values.palletisationType === 'Final product' ? (selectedOrder?.poNumber || '') : '',
        locationName: selectedLocation?.title || '',
        packagingTypeName: selectedPackaging?.displayName || '',
        createdAt: serverTimestamp(),
        createdBy: user.email,
        createdByDisplayName: user.displayName || user.email?.split('@')[0],
      };

      const outputDocRef = await addDoc(collection(db, 'production_output'), outputData);

      // --- FEUILLARD Auto-Consumption ---
      const { isFeuillard } = await import('@/lib/stock-situation-utils');
      const feuillardConsumable = consumables?.find(c => isFeuillard(c.name || ''));
      const consumptionPerPallet = Number(feuillardConsumable?.feuillardConsumptionPerPallet || 0);
      
      if (feuillardConsumable && consumptionPerPallet > 0) {
        await addDoc(collection(db, 'stock_situations'), {
          seasonId,
          locationId: values.locationId,
          locationName: selectedLocation?.title || '',
          date: values.dateTime,
          sourceType: 'production_consumption',
          sourceId: outputDocRef.id,
          items: [{
            consumableId: feuillardConsumable.id,
            consumableName: feuillardConsumable.name,
            operation: 'OUT',
            quantity: consumptionPerPallet,
            note: 'Auto FEUILLARD consumption from production output'
          }],
          createdAt: serverTimestamp(),
          createdBy: user.email,
          updatedAt: serverTimestamp(),
          updatedBy: user.email,
        });
      }
      // ----------------------------------

      // Recalculate stock situation counters for this location
      if (values.locationId) {
        const { recalculateStockCounters } = await import('@/lib/stock-situation-utils');
        await recalculateStockCounters(db, values.locationId);
      }

      toast({
        title: "Success",
        description: "Production output has been recorded successfully.",
      });
      
      // Generate and download PDF
      try {
        await generateProductionOutputPDF({
          ...outputData,
          dateTime: values.dateTime,
        });
      } catch (pdfError) {
        console.error("PDF generation error:", pdfError);
      }

      router.push('/production/output');
    } catch (error) {
      console.error("Error creating output:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save record. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: OutputFormValues) => {
    const foundDiscrepancies = checkDiscrepancies(values);
    if (foundDiscrepancies.length > 0) {
      setDiscrepancies(foundDiscrepancies);
      setPendingValues(values);
      setIsConfirmOpen(true);
      return;
    }
    await performSubmit(values);
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-700">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.push('/production/output')}
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
                  Production Output
                </li>
                <li className="flex items-center">
                  <span className="mx-2 opacity-20">/</span>
                  <span className="text-primary/60 font-black">Add Production Output</span>
                </li>
              </ol>
            </nav>
            <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">Production Output</h1>
          </div>
        </div>
      </div>

  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-20">
    {/* Section: Production Output */}
    <div className="bg-white rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden">
      <div className="bg-primary/[0.02] px-6 py-3 border-b border-primary/5">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">Production Output Information</h2>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {/* Left Column */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Date Time</Label>
                <Input 
                  type="datetime-local" 
                  {...form.register('dateTime')} 
                  error={!!form.formState.errors.dateTime}
                  className="h-11 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-4" 
                />
                <FieldError message={form.formState.errors.dateTime?.message} />
              </div>

              {palletType === 'Final product' && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Order PO Number</Label>
                  <Select onValueChange={(v) => form.setValue('orderPoId', v, { shouldValidate: true })} value={form.watch('orderPoId')}>
                    <SelectTrigger error={!!form.formState.errors.orderPoId} className="h-11 rounded-xl bg-muted/30 border-none font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 text-left">
                      <SelectValue placeholder="Select Order" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                      {filteredOrders?.map(o => <SelectItem key={o.id} value={o.id} className="rounded-xl font-bold py-3">{o.poNumber}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FieldError message={form.formState.errors.orderPoId?.message} />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Location</Label>
                <Select onValueChange={(v) => form.setValue('locationId', v, { shouldValidate: true })} value={form.watch('locationId')}>
                  <SelectTrigger error={!!form.formState.errors.locationId} className="h-11 rounded-xl bg-muted/30 border-none font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 text-left">
                    <SelectValue placeholder="Select Location" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                    {locations?.map(l => <SelectItem key={l.id} value={l.id} className="rounded-xl font-bold py-3">{l.title}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError message={form.formState.errors.locationId?.message} />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Shift Date</Label>
                <Input 
                  type="date" 
                  {...form.register('shiftDate')} 
                  error={!!form.formState.errors.shiftDate}
                  className="h-11 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-4" 
                />
                <FieldError message={form.formState.errors.shiftDate?.message} />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Palletisation Type</Label>
                <Select onValueChange={(v) => form.setValue('palletisationType', v)} defaultValue="Final product" value={form.watch('palletisationType')}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 text-left">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                    <SelectItem value="Final product" className="rounded-xl font-bold py-3">Final Product</SelectItem>
                    <SelectItem value="Reste" className="rounded-xl font-bold py-3">Reste</SelectItem>
                    <SelectItem value="Out Of Program" className="rounded-xl font-bold py-3">Out Of Program</SelectItem>
                    <SelectItem value="decay" className="rounded-xl font-bold py-3">decay</SelectItem>
                    <SelectItem value="Return" className="rounded-xl font-bold py-3">Return</SelectItem>
                    <SelectItem value="Small caliber" className="rounded-xl font-bold py-3">Small caliber</SelectItem>
                    <SelectItem value="Local Market" className="rounded-xl font-bold py-3">Local Market</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {palletType === 'Final product' && (
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">GGN Number</Label>
                  <Select onValueChange={(v) => form.setValue('ggnNumber', v, { shouldValidate: true })} value={form.watch('ggnNumber')}>
                    <SelectTrigger error={!!form.formState.errors.ggnNumber} className="h-11 rounded-xl bg-muted/30 border-none font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 text-left">
                      <SelectValue placeholder="Select GGN" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                      {customerFarms.length > 0 ? (
                        customerFarms.map((f: any, idx: number) => (
                          <SelectItem key={`${f.farmId}-${idx}`} value={f.ggnNumber} className="rounded-xl font-bold py-3">
                            {f.ggnNumber}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>No released farms found</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FieldError message={form.formState.errors.ggnNumber?.message} />
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Shift</Label>
                <Select onValueChange={(v) => form.setValue('shift', v)} defaultValue="1" value={form.watch('shift')}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 text-left">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-primary/5 shadow-2xl">
                    <SelectItem value="1" className="rounded-xl font-bold py-3">1</SelectItem>
                    <SelectItem value="2" className="rounded-xl font-bold py-3">2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Packaging Type</Label>
                        <SearchableSelect 
                          onValueChange={(v) => form.setValue('packagingTypeId', v, { shouldValidate: true })} 
                          value={form.watch('packagingTypeId')}
                          options={filteredPackagingOptions.map(pkg => ({ value: pkg.id, label: pkg.displayName }))}
                          placeholder="Select Packaging"
                          triggerClassName={cn(
                            "h-11 rounded-xl bg-muted/30 border-none font-bold text-primary focus:ring-2 focus:ring-primary/10 transition-all px-4 text-left",
                            !!form.formState.errors.packagingTypeId && "border border-red-500"
                          )}
                        />
                        {selectedOrder && filteredPackagingOptions.length === 0 && (
                          <p className="text-rose-500 text-[10px] font-bold mt-1">
                            No matching packaging found in Supply Chain Consumables.
                          </p>
                        )}
                        <FieldError message={form.formState.errors.packagingTypeId?.message} />
                </div>

                {(palletType === 'Final product' || palletType?.toLowerCase()?.includes('out of program')) && !!form.watch('packagingTypeId') && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">
                      Tare (Kg) <span className="text-rose-500">*</span>
                    </Label>
                    <Input 
                      type="number"
                      step="0.01"
                      {...form.register('tare')}
                      placeholder="e.g. 85"
                      className="h-11 rounded-xl bg-muted/30 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/10 transition-all px-4"
                    />
                    <FieldError message={form.formState.errors.tare?.message} />
                  </div>
                )}
            </div>

            {/* Remark - Full Width */}
            <div className="md:col-span-2 space-y-2 pt-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Remark</Label>
              <Textarea 
                {...form.register('remark')} 
                className="min-h-[120px] rounded-[2rem] bg-muted/30 border-none font-bold text-primary p-6 focus-visible:ring-2 focus-visible:ring-primary/10 transition-all" 
                placeholder="Enter production remarks or special instructions..." 
              />
            </div>
          </div>
        </div>

    {/* Section: Items */}
    <div className="bg-white rounded-[2rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden">
      <div className="bg-primary/[0.02] px-6 py-3 border-b border-primary/5 flex items-center justify-between">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">Production Items</h2>
        <Button 
          type="button" 
          onClick={() => {
            const currentLotNumber = form.getValues('items.0.lotNumber') || '';
            append({ productId: '', lotNumber: currentLotNumber, numberOfBoxes: 0, grossWeight: 0, netWeight: 0 });
          }} 
          className="h-9 w-9 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 p-0 transition-transform hover:scale-110 active:scale-90"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
              <tr className="bg-[#F8F7FF] border-b border-primary/5">
                {showCaliber && <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Caliber</th>}
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40 min-w-[320px]">Product (Category - Type)</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Lot Number</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">RM Lot Number</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Boxes {activeValidationRule?.expectedBoxes ? `(${activeValidationRule.expectedBoxes})` : ''}</th>
                {palletType !== 'Reste' && <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Gross (KG)</th>}
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40">Net (KG)</th>
                <th className="px-6 py-4 text-[9px] font-black uppercase tracking-[0.2em] text-primary/40 text-center">Action</th>
              </tr>
              </thead>
              <tbody>
                {fields.map((field, index) => (
                  <tr key={field.id} className="border-b border-primary/5 last:border-0 hover:bg-primary/[0.01] transition-all group">
                    {showCaliber && (
                      <td className="px-3 py-3">
                        <Input 
                          {...form.register(`items.${index}.caliber`)} 
                          placeholder="e.g. 12"
                          className="h-10 rounded-lg bg-muted/20 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/5 px-3" 
                        />
                      </td>
                    )}
                    <td className="px-3 py-3 min-w-[320px]">
                      <SearchableSelect 
                        onValueChange={(v) => {
                          form.setValue(`items.${index}.productId`, v, { shouldValidate: true });
                          handleProductChange(index, v);
                        }}
                        value={form.watch(`items.${index}.productId`)}
                        options={orderVarieties.map(p => ({ value: p.id, label: p.displayName }))}
                        placeholder="Product Variety"
                        triggerClassName={cn(
                          "h-10 rounded-lg bg-muted/20 border-none font-bold text-primary focus:ring-2 focus:ring-primary/5 px-3 text-left w-full",
                          !!form.formState.errors.items?.[index]?.productId && "border border-red-500"
                        )}
                      />
                      <FieldError message={form.formState.errors.items?.[index]?.productId?.message} />
                    </td>
                    <td className="px-3 py-3">
                      <Input 
                        {...form.register(`items.${index}.lotNumber`)} 
                        error={!!form.formState.errors.items?.[index]?.lotNumber}
                        placeholder="Lot #"
                        className="h-10 rounded-lg bg-muted/20 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/5 px-3" 
                      />
                      <FieldError message={form.formState.errors.items?.[index]?.lotNumber?.message} />
                    </td>
                    <td className="px-3 py-3">
                      <Input 
                        {...form.register(`items.${index}.rawMaterialLotNumber`)} 
                        error={!!form.formState.errors.items?.[index]?.rawMaterialLotNumber}
                        placeholder="RM Lot"
                        className="h-10 rounded-lg bg-muted/20 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/5 px-3" 
                      />
                      <FieldError message={form.formState.errors.items?.[index]?.rawMaterialLotNumber?.message} />
                    </td>
                    <td className="px-3 py-3">
                      <Input 
                        type="number" 
                        {...form.register(`items.${index}.numberOfBoxes`)} 
                        onChange={(e) => {
                          form.register(`items.${index}.numberOfBoxes`).onChange(e);
                          handleBoxOrGrossChange(index, Number(e.target.value), form.getValues(`items.${index}.grossWeight`));
                        }}
                        error={!!form.formState.errors.items?.[index]?.numberOfBoxes}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        className="h-10 rounded-lg bg-muted/20 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/5 px-3 text-center" 
                      />
                      <FieldError message={form.formState.errors.items?.[index]?.numberOfBoxes?.message} />
                    </td>
                    {palletType !== 'Reste' && (
                      <td className="px-3 py-3 relative">
                        <Input 
                          type="number" 
                          step="0.01"
                          {...form.register(`items.${index}.grossWeight`)} 
                          onChange={(e) => {
                            form.register(`items.${index}.grossWeight`).onChange(e);
                            handleBoxOrGrossChange(index, form.getValues(`items.${index}.numberOfBoxes`), Number(e.target.value));
                          }}
                          error={!!form.formState.errors.items?.[index]?.grossWeight}
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          className="h-10 rounded-lg bg-muted/20 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/5 px-3 pr-8 text-right" 
                        />
                        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[8px] font-black text-primary/20 pointer-events-none">KG</span>
                        <FieldError message={form.formState.errors.items?.[index]?.grossWeight?.message} />
                      </td>
                    )}
                    <td className="px-3 py-3 relative">
                      <Input 
                        type="number" 
                        step="0.01"
                        {...form.register(`items.${index}.netWeight`)} 
                        error={!!form.formState.errors.items?.[index]?.netWeight}
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        className="h-10 rounded-lg bg-muted/20 border-none font-bold text-primary focus-visible:ring-2 focus-visible:ring-primary/5 px-3 pr-8 text-right" 
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[8px] font-black text-primary/20 pointer-events-none">KG</span>
                      <FieldError message={form.formState.errors.items?.[index]?.netWeight?.message} />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={() => remove(index)} 
                        className="h-10 w-10 rounded-xl text-rose-500/30 hover:text-rose-500 hover:bg-rose-50 p-0 transition-all opacity-0 group-hover:opacity-100" 
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> PROCESSING...</>
            ) : 'Add Production Output'}
          </Button>
        </div>
      </form>

      {/* Confirmation Modal */}
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent className="rounded-[2rem] border-primary/5 shadow-2xl max-w-lg">
          <AlertDialogHeader>
            <div className="flex items-center gap-4 mb-2">
              <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                <AlertCircle className="size-6 text-rose-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-xl font-black text-primary uppercase tracking-tight">Validation Discrepancy</AlertDialogTitle>
                <AlertDialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Potential pallet specification errors detected
                </AlertDialogDescription>
              </div>
            </div>
            
            <div className="py-4 space-y-4">
              <p className="text-sm font-medium text-primary/60">
                The following items have discrepancies compared to the expected packaging & pallet configuration. Do you want to continue anyway?
              </p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {discrepancies.map((d) => (
                  <div key={`${d.index}-${d.type}`} className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100 space-y-1">
                    <p className="text-sm font-black text-rose-600">{d.message}</p>
                  </div>
                ))}
              </div>
            </div>

          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel 
              onClick={() => {
                setIsConfirmOpen(false);
                setPendingValues(null);
              }}
              className="h-12 rounded-xl font-black uppercase text-[10px] tracking-widest border-primary/5 hover:bg-primary/5 transition-all"
            >
              Cancel & Correct
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={async () => {
                setIsConfirmOpen(false);
                if (pendingValues) {
                  await performSubmit(pendingValues);
                  setPendingValues(null);
                } else {
                  await performSubmit(form.getValues());
                }
              }}
              className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-600/20 transition-all px-8"
            >
              Continue Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}