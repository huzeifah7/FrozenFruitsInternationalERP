'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { collection, query, updateDoc, doc, getDoc, serverTimestamp } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useAuthContext } from '@/components/auth-provider';
import { useSeason } from '@/contexts/SeasonContext';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPCard } from '@/components/erp/ERPCard';
import { ERPInput } from '@/components/erp/ERPInput';
import { ERPSelect } from '@/components/erp/ERPSelect';
import { ERPDatePicker } from '@/components/erp/ERPDatePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

type InvoiceType = 'invoice' | 'produce' | 'proforma' | 'credit_note' | '';

interface ItemRow {
  product_id?: string;
  calibre?: string;
  description?: string;
  quantity: number | string;
  price: number | string;
}

interface FormValues {
  invoice_number: string;
  invoice_type: InvoiceType;
  date: string;
  customer_id?: string;
  po_order_id?: string;
  currency?: string;
  invoicing_address_id?: string;
  shipping_address_id?: string;
  country_of_origin?: string;
  total_gross_weight?: number | string;
  total_number_of_boxes?: number | string;
  if_value?: string;
  ice?: string;
  tax?: number | string;
  discount?: number | string;
  remarks?: string;
  items: ItemRow[];
}

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.id as string;
  const db = useFirestore();
  const { currentSeason } = useSeason();
  const { toast } = useToast();
  const { profile } = useAuthContext();
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Fetch Existing Invoice with Multi-Collection Fallback
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [isInvoiceLoading, setIsInvoiceLoading] = useState(true);

  useEffect(() => {
    if (!db || !invoiceId) return;
    let active = true;
    setIsInvoiceLoading(true);

    const fetchMainDoc = async () => {
      try {
        const collectionsToTry = ['invoices', 'packingLists', 'supply_chain_loadings'];
        for (const colName of collectionsToTry) {
          const snap = await getDoc(doc(db, colName, invoiceId));
          if (snap.exists()) {
            if (active) setInvoiceData({ id: snap.id, collectionName: colName, ...snap.data() });
            return;
          }
        }
        if (active) setInvoiceData(null);
      } catch (e) {
        console.error('Error fetching invoice for edit:', e);
      } finally {
        if (active) setIsInvoiceLoading(false);
      }
    };

    fetchMainDoc();
    return () => { active = false; };
  }, [db, invoiceId]);

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      invoice_number: '',
      invoice_type: '',
      date: new Date().toISOString().split('T')[0],
      country_of_origin: 'Morocco',
      items: [],
      discount: 0,
      tax: 0
    }
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Load Invoice Data into Form
  useEffect(() => {
    if (invoiceData && !isDataLoaded) {
      reset({
        invoice_number: invoiceData.invoice_number || '',
        invoice_type: invoiceData.invoice_type || '',
        date: invoiceData.date || new Date().toISOString().split('T')[0],
        customer_id: invoiceData.customer_id || '',
        po_order_id: invoiceData.po_order_id || '',
        currency: invoiceData.currency || 'MAD',
        invoicing_address_id: invoiceData.invoicing_address_id || '',
        shipping_address_id: invoiceData.shipping_address_id || '',
        country_of_origin: invoiceData.country_of_origin || 'Morocco',
        total_gross_weight: invoiceData.total_gross_weight || '',
        total_number_of_boxes: invoiceData.total_number_of_boxes || '',
        if_value: invoiceData.if_value || '',
        ice: invoiceData.ice || '',
        tax: invoiceData.tax || 0,
        discount: invoiceData.discount || 0,
        remarks: invoiceData.remarks || '',
        items: invoiceData.items || []
      });
      setIsDataLoaded(true);
    }
  }, [invoiceData, isDataLoaded, reset]);

  const invoiceType = watch('invoice_type');
  const watchCustomerId = watch('customer_id');
  const watchPoId = watch('po_order_id');
  const watchCurrency = watch('currency');
  
  const watchItems = useWatch({ control, name: 'items' }) || [];
  const watchDiscount = watch('discount') || 0;
  const watchTax = watch('tax') || 0;

  const formatAmount = (val: number) => {
    const numStr = val.toFixed(2);
    const c = String(watchCurrency || invoiceData?.currency || '').trim().toUpperCase();
    if (c.includes('EURO') || c.includes('EUR')) return `€${numStr}`;
    if (c.includes('DOLLAR') || c.includes('USD')) return `$${numStr}`;
    if (c.includes('POUND') || c.includes('GBP')) return `£${numStr}`;
    if (c.includes('MAD')) return `${numStr} MAD`;
    return c ? `${numStr} ${c}` : `${numStr} MAD`;
  };

  const totals = useMemo(() => {
    let taxableAmount = 0;
    watchItems.forEach(item => {
      taxableAmount += ((Number(item.quantity) || 0) * (Number(item.price) || 0));
    });
    
    const discount = invoiceType === 'invoice' ? (Number(watchDiscount) || 0) : 0;
    const taxPercent = invoiceType === 'invoice' ? (Number(watchTax) || 0) : 0;
    
    const vatAmount = (taxableAmount - discount) * (taxPercent / 100);
    const totalAmount = taxableAmount - discount + vatAmount;

    return { taxableAmount, discount, vatAmount, totalAmount };
  }, [watchItems, invoiceType, watchDiscount, watchTax]);

  // Load Data
  const customersQuery = useMemoFirebase(() => db ? query(collection(db, 'customers')) : null, [db]);
  const { data: customersList } = useCollection(customersQuery);

  const suppliersQuery = useMemoFirebase(() => db ? query(collection(db, 'suppliers')) : null, [db]);
  const { data: suppliersList } = useCollection(suppliersQuery);

  const poQuery = useMemoFirebase(() => db ? query(collection(db, 'orders')) : null, [db]);
  const { data: poList } = useCollection(poQuery);

  const productsQuery = useMemoFirebase(() => db ? query(collection(db, 'products')) : null, [db]);
  const { data: productsList } = useCollection(productsQuery);

  // Address logic based on customer or PO
  const availableAddresses = useMemo(() => {
    let addresses: any[] = [];
    if (invoiceType === 'invoice' && watchCustomerId) {
      const s = suppliersList?.find(x => x.id === watchCustomerId);
      if (s) {
        if (s.addresses && s.addresses.length > 0) {
          addresses = s.addresses;
        } else if (s.address) {
          addresses = [{ id: 'default', title: 'Main Address', address: s.address }];
        }
      }
    } else if ((invoiceType === 'produce' || invoiceType === 'proforma') && watchCustomerId) {
      const c = customersList?.find(x => x.id === watchCustomerId);
      if (c) {
        if (c.addresses && c.addresses.length > 0) {
          addresses = c.addresses;
        } else if (c.address) {
          addresses = [{ id: 'default', title: 'Main Address', address: c.address }];
        }
      }
    } else if (invoiceType === 'credit_note' && watchPoId) {
      const po = poList?.find(x => x.id === watchPoId);
      const custId = po?.customerId || po?.customer_id;
      if (po && custId) {
        const c = customersList?.find(x => x.id === custId);
        if (c) {
          if (c.addresses && c.addresses.length > 0) {
            addresses = c.addresses;
          } else if (c.address) {
            addresses = [{ id: 'default', title: 'Main Address', address: c.address }];
          }
        }
      }
    }
    return addresses;
  }, [invoiceType, watchCustomerId, watchPoId, customersList, suppliersList, poList]);

  const invoicingAddressOptions = useMemo(() => {
    let filtered = availableAddresses.filter(a => a.type?.toLowerCase() === 'billing' || a.type?.toLowerCase() === 'invoicing');
    if (filtered.length === 0) filtered = availableAddresses; // Fallback if no specific billing address
    return filtered.map((a, idx) => {
      const street = a.street || a.address || a.name || a.title || `Address ${idx + 1}`;
      return { 
        label: street, 
        value: a.id || a.name || a.title || `address-${idx}` 
      };
    });
  }, [availableAddresses]);

  const shippingAddressOptions = useMemo(() => {
    let filtered = availableAddresses.filter(a => a.type?.toLowerCase() === 'shipping');
    if (filtered.length === 0) filtered = availableAddresses; // Fallback if no specific shipping address
    return filtered.map((a, idx) => {
      const street = a.street || a.address || a.name || a.title || `Address ${idx + 1}`;
      return { 
        label: street, 
        value: a.id || a.name || a.title || `address-${idx}` 
      };
    });
  }, [availableAddresses]);

  // Auto-fill logic (only when user interacts, not on initial load)
  useEffect(() => {
    if (!isDataLoaded) return; // Wait until initial data is populated
    
    // Check if the current form customer matches the DB customer to avoid overwriting on first load
    if (invoiceData && watchCustomerId === invoiceData.customer_id && invoiceType === invoiceData.invoice_type) {
      return; 
    }

    if (watchCustomerId) {
      const cust = customersList?.find(x => x.id === watchCustomerId);
      const supp = suppliersList?.find(x => x.id === watchCustomerId);
      const target = cust || supp;
      if (target?.currency) {
        setValue('currency', target.currency);
      }
    }

    if (invoiceType === 'invoice' && watchCustomerId) {
      const s = suppliersList?.find(x => x.id === watchCustomerId);
      if (s) {
        if (s.if) setValue('if_value', s.if);
        if (s.ice) setValue('ice', s.ice);
        if (s.tax) setValue('tax', s.tax);
      }
    } else if ((invoiceType === 'produce' || invoiceType === 'proforma') && watchCustomerId) {
      const c = customersList?.find(x => x.id === watchCustomerId);
      if (c) {
        if (c.if) setValue('if_value', c.if);
        if (c.ice) setValue('ice', c.ice);
        if (c.tax) setValue('tax', c.tax);
      }
    }
    
    // Address auto-select if only 1 option available and none selected
    const currentInvoicing = watch('invoicing_address_id');
    const currentShipping = watch('shipping_address_id');
    if (invoicingAddressOptions.length === 1 && !currentInvoicing) {
      setValue('invoicing_address_id', invoicingAddressOptions[0].value);
    }
    if (shippingAddressOptions.length === 1 && !currentShipping) {
      setValue('shipping_address_id', shippingAddressOptions[0].value);
    }
  }, [watchCustomerId, invoiceType, customersList, suppliersList, invoicingAddressOptions, shippingAddressOptions, setValue, isDataLoaded, invoiceData, watch]);

  // Invoice Type change -> reset items (only if user changed it manually)
  useEffect(() => {
    if (!isDataLoaded || (invoiceData && invoiceType === invoiceData.invoice_type)) return;
    
    if (invoiceType === 'invoice') {
      setValue('items', [{ description: '', quantity: '', price: '' }]);
    } else if (invoiceType === 'produce' || invoiceType === 'proforma') {
      setValue('items', [{ product_id: '', calibre: '', quantity: '', price: '' }]);
    } else if (invoiceType === 'credit_note') {
      setValue('items', [{ product_id: '', description: '', quantity: '', price: '' }]);
    } else {
      setValue('items', []);
    }
  }, [invoiceType, setValue, isDataLoaded, invoiceData]);

  const customerOptions = useMemo(() => {
    if (invoiceType === 'invoice') {
      return suppliersList?.map((s, idx) => ({ label: s.name || s.companyName || s.firstName || 'Unknown', value: s.id || `supp-${idx}` })) || [];
    }
    return customersList?.map((c, idx) => ({ label: c.companyName || c.firstName || c.name || 'Unknown', value: c.id || `cust-${idx}` })) || [];
  }, [invoiceType, customersList, suppliersList]);
  
  const poOptions = useMemo(() => {
    if (!poList) return [];
    const allowedStatuses = new Set(['produced', 'delivered', 'shipped']);
    return poList
      .filter((p: any) => {
        const stat = String(p.status || p.order_status || p.status_id || '').trim().toLowerCase();
        return allowedStatuses.has(stat);
      })
      .map((p: any, idx: number) => ({
        label: p.poNumber || p.po_number || p.id,
        value: p.id || `po-${idx}`
      }));
  }, [poList]);
  
  const productOptions = useMemo(() => productsList?.map((p, idx) => {
    let label = p.productName || p.name || p.title || 'Unknown';
    if (p.productName) {
      const parts = [p.productName, p.category, p.type].filter(Boolean);
      label = `(${parts.join(' - ')})`;
    }
    return { label, value: p.id || `prod-${idx}` };
  }) || [], [productsList]);

  const onSubmit = async (data: FormValues) => {
    if (!db || !invoiceDocRef) {
      toast({ title: 'Error', description: 'Database connection missing.', variant: 'destructive' });
      return;
    }

    try {
      let customer_detail = null;
      if (data.invoice_type === 'invoice' && data.customer_id) {
        const c = suppliersList?.find(s => s.id === data.customer_id);
        if (c) customer_detail = { id: c.id, companyName: c.companyName || c.name || c.firstName || 'Unknown' };
      } else if (data.customer_id) {
        const c = customersList?.find(c => c.id === data.customer_id);
        if (c) customer_detail = { id: c.id, companyName: c.companyName || c.name || c.firstName || 'Unknown' };
      }

      const payload: any = {
        invoice_type: data.invoice_type,
        date: data.date,
        currency: data.currency || invoiceData?.currency || 'MAD',
        invoicing_address_id: data.invoicing_address_id || null,
        shipping_address_id: data.shipping_address_id || null,
        remarks: data.remarks || '',
        items: JSON.parse(JSON.stringify(data.items)),
        total_amount: totals.totalAmount, // Use live calculated total
        updatedby: { first_name: profile?.firstName || 'User', last_name: profile?.lastName || '' },
        updatedAt: serverTimestamp()
      };

      if (data.invoice_type === 'invoice') {
        payload.customer_id = data.customer_id;
        payload.customer_detail = customer_detail;
        payload.if_value = data.if_value;
        payload.ice = data.ice;
        payload.tax = data.tax;
        payload.discount = data.discount;
      } else if (data.invoice_type === 'produce' || data.invoice_type === 'proforma') {
        payload.customer_id = data.customer_id;
        payload.customer_detail = customer_detail;
        payload.country_of_origin = data.country_of_origin;
        payload.total_gross_weight = data.total_gross_weight;
        payload.total_number_of_boxes = data.total_number_of_boxes;
      } else if (data.invoice_type === 'credit_note') {
        payload.po_order_id = data.po_order_id || null;
        payload.country_of_origin = data.country_of_origin || 'Morocco';
        const p = poList?.find(x => x.id === data.po_order_id);
        if (p) {
          payload.po_order_number = p.poNumber || p.po_number || p.id || '';
          payload.customer_id = p.customerId || p.customer_id || null;
          
          const custId = p.customerId || p.customer_id;
          if (custId) {
            const c = customersList?.find(x => x.id === custId);
            if (c) {
              payload.customer_detail = { id: c.id, companyName: c.companyName || c.name || c.firstName || 'Unknown' };
            }
          }
        }
      }

      const targetCol = invoiceData?.collectionName || 'invoices';
      await updateDoc(doc(db, targetCol, invoiceId), payload);

      // Cleanly update shadow docs in 'invoices', 'packingLists', or 'supply_chain_loadings'
      const shadowCols = ['invoices', 'packingLists', 'supply_chain_loadings'].filter(c => c !== targetCol);
      for (const colName of shadowCols) {
        try {
          const shadowSnap = await getDoc(doc(db, colName, invoiceId));
          if (shadowSnap.exists()) {
            await updateDoc(doc(db, colName, invoiceId), payload);
          }
        } catch (_) {}
      }

      toast({ title: 'Success', description: 'Invoice updated successfully.' });
      router.push('/finance/invoices');
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update invoice.', variant: 'destructive' });
    }
  };

  const handleAddRow = () => {
    if (invoiceType === 'invoice') append({ description: '', quantity: '', price: '' });
    else if (invoiceType === 'produce' || invoiceType === 'proforma') append({ product_id: '', calibre: '', quantity: '', price: '' });
    else if (invoiceType === 'credit_note') append({ product_id: '', description: '', quantity: '', price: '' });
  };

  if (isInvoiceLoading || !isDataLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4 bg-[#f3f3f3] min-h-screen">
        <Loader2 className="h-12 w-12 text-[#7a9800] animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Invoice Details...</p>
      </div>
    );
  }

  if (!invoiceData) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4 bg-[#f3f3f3] min-h-screen">
        <p className="text-sm font-bold text-rose-500 uppercase tracking-widest">Invoice Not Found</p>
        <Button onClick={() => router.push('/finance/invoices')} variant="outline">
          Back to Invoices
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      <ERPPageHeader
        title="Edit Invoice"
        subtitle={`Update invoice #${invoiceData.invoice_number}`}
        breadcrumbItems={[{ label: 'Profile', href: '#' }, { label: 'Invoice', href: '/finance/invoices' }, { label: 'Edit Invoice', active: true }]}
        actions={
          <Button type="button" onClick={() => router.push('/finance/invoices')} variant="outline" className="h-12 bg-white font-bold uppercase text-[10px] rounded-xl px-6">
            <ArrowLeft size={14} className="mr-2" /> Back
          </Button>
        }
      />

      <div className="max-w-6xl mx-auto space-y-6">
        <ERPCard title="Invoice Header">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* LEFT COLUMN */}
            <div className="space-y-4">
              <Controller control={control} name="invoice_type" rules={{ required: 'Required' }} render={({ field }) => (
                <ERPSelect label="Invoice Type" options={[{ label: 'Invoice', value: 'invoice' }, { label: 'Produce Invoice', value: 'produce' }, { label: 'Credit Note', value: 'credit_note' }, { label: 'Proforma', value: 'proforma' }]} value={field.value} onValueChange={field.onChange} error={errors.invoice_type?.message} />
              )} />

              {(invoiceType === 'invoice' || invoiceType === 'produce' || invoiceType === 'proforma') && (
                <Controller control={control} name="customer_id" rules={{ required: 'Required' }} render={({ field }) => (
                  <ERPSelect label={invoiceType === 'invoice' ? "Supplier" : "Customer"} options={customerOptions} value={field.value} onValueChange={field.onChange} error={errors.customer_id?.message} />
                )} />
              )}

              {invoiceType === 'credit_note' && (
                <Controller control={control} name="po_order_id" rules={{ required: 'Required' }} render={({ field }) => (
                  <ERPSelect label="Order PO Number" options={poOptions} value={field.value} onValueChange={field.onChange} error={errors.po_order_id?.message} />
                )} />
              )}

              <Controller control={control} name="invoicing_address_id" rules={{ required: 'Required' }} render={({ field }) => (
                <ERPSelect label="Invoicing Address" options={invoicingAddressOptions} value={field.value} onValueChange={field.onChange} error={errors.invoicing_address_id?.message} />
              )} />

              {invoiceType === 'invoice' && (
                <>
                  <ERPInput label="IF" {...register('if_value')} />
                  <ERPInput label="Discount" type="number" step="any" onWheel={(e) => e.currentTarget.blur()} {...register('discount')} />
                </>
              )}

              {(invoiceType === '' || invoiceType === 'produce' || invoiceType === 'proforma') && (
                <ERPInput label="Total Gross Weight" type="number" step="any" onWheel={(e) => e.currentTarget.blur()} {...register('total_gross_weight')} />
              )}

              <ERPInput label="Remarks" {...register('remarks')} />
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-4">
              <ERPDatePicker label="Date" error={errors.date?.message} {...register('date', { required: 'Required' })} />
              
              <Controller control={control} name="shipping_address_id" rules={{ required: 'Required' }} render={({ field }) => (
                <ERPSelect label="Shipping Address" options={shippingAddressOptions} value={field.value} onValueChange={field.onChange} error={errors.shipping_address_id?.message} />
              )} />

              {invoiceType === 'invoice' && (
                <>
                  <ERPInput label="ICE" {...register('ice')} />
                  <ERPInput label="TAX" type="number" step="any" onWheel={(e) => e.currentTarget.blur()} {...register('tax')} />
                </>
              )}

              {(invoiceType === '' || invoiceType === 'produce' || invoiceType === 'proforma' || invoiceType === 'credit_note') && (
                <ERPInput label="Country of Origin" {...register('country_of_origin', { required: invoiceType ? 'Required' : false })} error={errors.country_of_origin?.message} />
              )}

              {(invoiceType === '' || invoiceType === 'produce' || invoiceType === 'proforma') && (
                <ERPInput label="Total Number Of Boxes" type="number" step="any" onWheel={(e) => e.currentTarget.blur()} {...register('total_number_of_boxes')} />
              )}
            </div>
          </div>
        </ERPCard>

        <ERPCard title="Invoice Items">
          {invoiceType === '' ? (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 font-bold text-xs">
              Please select an Invoice Type to add items.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {(invoiceType === 'produce' || invoiceType === 'proforma' || invoiceType === 'credit_note') && <th className="p-3 text-[10px] font-black uppercase text-slate-400">Product</th>}
                      {(invoiceType === 'produce' || invoiceType === 'proforma') && <th className="p-3 text-[10px] font-black uppercase text-slate-400">Calibre</th>}
                      {(invoiceType === 'invoice' || invoiceType === 'credit_note') && <th className="p-3 text-[10px] font-black uppercase text-slate-400">Description</th>}
                      <th className="p-3 text-[10px] font-black uppercase text-slate-400 w-32">Quantity</th>
                      <th className="p-3 text-[10px] font-black uppercase text-slate-400 w-32">Price</th>
                      <th className="p-3 text-[10px] font-black uppercase text-slate-400 text-center w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {fields.map((field, index) => (
                      <tr key={field.id}>
                        {(invoiceType === 'produce' || invoiceType === 'proforma' || invoiceType === 'credit_note') && (
                          <td className="p-2">
                            <Controller control={control} name={`items.${index}.product_id`} rules={{ required: 'Required' }} render={({ field }) => (
                              <ERPSelect options={productOptions} value={field.value} onValueChange={field.onChange} error={errors.items?.[index]?.product_id?.message} />
                            )} />
                          </td>
                        )}
                        {(invoiceType === 'produce' || invoiceType === 'proforma') && (
                          <td className="p-2"><Input className={cn("h-10 text-xs", errors.items?.[index]?.calibre && "border-rose-500")} {...register(`items.${index}.calibre`, { required: 'Required' })} /></td>
                        )}
                        {(invoiceType === 'invoice' || invoiceType === 'credit_note') && (
                          <td className="p-2"><Input className={cn("h-10 text-xs", errors.items?.[index]?.description && "border-rose-500")} {...register(`items.${index}.description`, { required: 'Required' })} /></td>
                        )}
                        <td className="p-2">
                          <Input type="number" step="any" onWheel={(e) => e.currentTarget.blur()} className={cn("h-10 text-xs", errors.items?.[index]?.quantity && "border-rose-500")} {...register(`items.${index}.quantity`, { required: 'Required' })} />
                        </td>
                        <td className="p-2">
                          <Input type="number" step="any" onWheel={(e) => e.currentTarget.blur()} className={cn("h-10 text-xs", errors.items?.[index]?.price && "border-rose-500")} {...register(`items.${index}.price`, { required: 'Required' })} />
                        </td>
                        <td className="p-2 text-center">
                          <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-8 w-8 text-rose-500"><Trash2 size={14} /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-start">
                  <Button type="button" onClick={handleAddRow} className="h-8 px-3 bg-[#7a9800] hover:bg-[#6c8500] text-white text-[10px] font-black uppercase tracking-widest rounded-lg">
                    <Plus size={12} className="mr-1 stroke-[3]" /> Add Row
                  </Button>
                </div>
              </div>

              {/* Invoice Total Box */}
              <div className="flex justify-end">
                <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-4 space-y-3 bg-slate-50 border-b border-slate-100">
                    <div className="flex justify-between items-center text-sm font-bold text-slate-600">
                      <span>Taxable Amount</span>
                      <span>{formatAmount(totals.taxableAmount)}</span>
                    </div>
                    {invoiceType === 'invoice' && (
                      <>
                        <div className="flex justify-between items-center text-sm font-bold text-rose-500">
                          <span>Discount</span>
                          <span>- {formatAmount(totals.discount)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold text-slate-600">
                          <span>VAT ({watchTax}%)</span>
                          <span>+ {formatAmount(totals.vatAmount)}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="p-4 bg-white flex justify-between items-center text-lg font-black text-primary">
                    <span className="uppercase tracking-widest text-sm">Total Amount</span>
                    <span>{formatAmount(totals.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </ERPCard>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting || invoiceType === ''} className="bg-[#7a9800] hover:bg-[#6c8500] text-white font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2">
            {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Update Invoice
          </Button>
        </div>
      </div>
    </form>
  );
}
