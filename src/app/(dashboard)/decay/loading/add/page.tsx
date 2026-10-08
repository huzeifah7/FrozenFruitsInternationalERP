'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  orderBy, 
  doc,
  setDoc
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  ChevronLeft, 
  Plus, 
  Trash2, 
  Save, 
  Loader2,
  Package,
  ClipboardList,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';

interface ProductRow {
  id: string;
  productId: string;
  netWeight: string;
  originalNetWeight: string;
}

export default function AddDecayLoadingPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // --- Form States ---
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [customerId, setCustomerId] = useState('');
  const [driverPlateNumber, setDriverPlateNumber] = useState('');
  const [note, setNote] = useState('');
  
  // Search & popover states
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerOpen, setCustomerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [openProductRowId, setOpenProductRowId] = useState<string | null>(null);
  
  const [items, setItems] = useState<ProductRow[]>([
    { id: crypto.randomUUID(), productId: '', netWeight: '', originalNetWeight: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Data Fetching ---
  const customersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'local_customers'), orderBy('name'));
  }, [db]);
  const { data: customers, isLoading: loadingCustomers } = useCollection(customersQuery);

  const productsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'products'), orderBy('productName'));
  }, [db]);
  const { data: products, isLoading: loadingProducts } = useCollection(productsQuery);

  // --- Row Management ---
  const handleAddItem = () => {
    setItems(prev => [...prev, { id: crypto.randomUUID(), productId: '', netWeight: '', originalNetWeight: '' }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof ProductRow, value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;

    if (!date || !customerId) {
      toast({ title: 'Validation Error', description: 'Please select a date and customer.', variant: 'destructive' });
      return;
    }

    if (items.length === 0) {
      toast({ title: 'Validation Error', description: 'Please add at least one product.', variant: 'destructive' });
      return;
    }

    // Validate rows
    const hasInvalidRow = items.some(i => !i.productId || !i.netWeight || !i.originalNetWeight);
    if (hasInvalidRow) {
      toast({ title: 'Validation Error', description: 'Please fill out all product fields (Product, Net Weight, Original Net Weight).', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedCustomer = customers?.find(c => c.id === customerId);
      
      const payloadItems = items.map(item => {
        const selectedProduct = products?.find(p => p.id === item.productId);
        const nw = Number(item.netWeight);
        const onw = Number(item.originalNetWeight);
        return {
          id: item.id,
          productId: item.productId,
          productName: selectedProduct ? `${selectedProduct.productName} - ${selectedProduct.category || ''} ${selectedProduct.type || ''}`.trim() : 'Unknown',
          netWeight: nw,
          originalNetWeight: onw,
          difference: nw - onw,
          price: 0 // Default, will be updated in Edit view
        };
      });

      const newDocRef = doc(collection(db, 'decay_loadings'));
      
      const dateParts = date.split('-'); // YYYY-MM-DD
      const ddmmyyyy = dateParts.length === 3 ? `${dateParts[2]}${dateParts[1]}${dateParts[0]}` : '00000000';
      const randomSeq = Math.floor(10000000 + Math.random() * 90000000);
      const invoiceNumber = `PP${ddmmyyyy}-${randomSeq}`;
      
      await setDoc(newDocRef, {
        invoiceNumber,
        date,
        customerId,
        customerName: selectedCustomer?.name || 'Unknown',
        driverPlateNumber,
        note,
        currency: 'MAD', // Default
        paymentMethod: 'Bank transfer', // Default
        paymentStatus: 'PENDING', // Default
        items: payloadItems,
        totalAmount: 0, // Computed later
        created_at: new Date(),
        created_by: user.email || 'unknown',
        updated_at: new Date(),
        updated_by: user.email || 'unknown'
      });

      toast({ title: 'Success', description: 'Decay loading added successfully.' });
      router.push('/decay/loading');
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to add decay loading.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full p-6 lg:p-8 max-w-[1200px] mx-auto animate-in fade-in duration-500 bg-[#F8F9FB] min-h-screen">
      
      {/* Header & Breadcrumb */}
      <div className="flex items-center gap-4 mb-8">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.back()} 
          className="rounded-full h-10 w-10 hover:bg-slate-200"
        >
          <ChevronLeft size={20} className="text-slate-600" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
            <span>Profile</span><span className="opacity-40">/</span>
            <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/decay/loading')}>Decay Loadings</span><span className="opacity-40">/</span>
            <span className="text-[#7a9800]">Add Decay Loading</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#2e1d52] uppercase">Decay Loading</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Card 1: Information */}
        <div className="bg-white p-6 md:p-8 rounded-[1.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#7a9800]/5 rounded-bl-full -z-10" />
          
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="h-10 w-10 rounded-xl bg-[#7a9800]/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-[#7a9800]" />
            </div>
            <h2 className="text-sm font-black text-[#2e1d52] uppercase tracking-[0.1em]">Decay Loading Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-1.5 lg:col-span-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Date <span className="text-rose-500">*</span></Label>
              <Input 
                type="date" 
                value={date} 
                onChange={e => setDate(e.target.value)} 
                required 
                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold text-slate-700" 
              />
            </div>
            
            <div className="space-y-1.5 lg:col-span-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Select Decay Customer <span className="text-rose-500">*</span></Label>
              <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full h-12 rounded-xl bg-slate-50/50 border-slate-200 justify-between px-4 font-bold text-slate-700 hover:bg-slate-50/50"
                  >
                    {customerId ? (
                      customers?.find(c => c.id === customerId)?.name || 'Unknown'
                    ) : (
                      "Select Customer"
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 bg-white border border-slate-100 shadow-xl rounded-xl">
                  <div className="p-2 border-b border-slate-100">
                    <Input
                      placeholder="Search supplier..."
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      className="h-9 focus-visible:ring-[#7a9800]"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
                    {customers?.filter(c => c.name?.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setCustomerId(c.id);
                          setCustomerOpen(false);
                          setCustomerSearch('');
                        }}
                        className={cn(
                          "p-2 rounded-lg cursor-pointer text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between",
                          customerId === c.id && "bg-[#7a9800]/5 text-[#7a9800]"
                        )}
                      >
                        {c.name}
                      </div>
                    ))}
                    {customers?.filter(c => c.name?.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                      <p className="p-4 text-center text-[10px] font-black text-slate-400 uppercase">No suppliers found</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5 lg:col-span-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Driver Plate Number</Label>
              <Input 
                type="text" 
                value={driverPlateNumber} 
                onChange={e => setDriverPlateNumber(e.target.value)} 
                placeholder="e.g. 1234-A-56"
                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold text-slate-700 uppercase" 
              />
            </div>

            <div className="space-y-1.5 lg:col-span-1">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Note</Label>
              <Input 
                type="text" 
                value={note} 
                onChange={e => setNote(e.target.value)} 
                placeholder="Optional notes..."
                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-medium text-slate-600" 
              />
            </div>
          </div>
        </div>

        {/* Card 2: Items */}
        <div className="bg-white p-6 md:p-8 rounded-[1.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6 relative overflow-hidden">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#7a9800]/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-[#7a9800]" />
              </div>
              <h2 className="text-sm font-black text-[#2e1d52] uppercase tracking-[0.1em]">Dynamic Product Rows</h2>
            </div>
            <Button 
              type="button" 
              onClick={handleAddItem} 
              className="h-10 px-4 bg-[#7a9800] hover:bg-[#6c8500] text-white rounded-xl shadow-md shadow-[#7a9800]/20 flex items-center gap-2 transition-transform hover:scale-105"
            >
              <Plus size={16} className="stroke-[3]" />
              <span className="text-[10px] font-black uppercase tracking-widest">Add new row</span>
            </Button>
          </div>

          <div className="hidden md:grid grid-cols-[3fr_2fr_2fr_auto] gap-4 px-4 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            <div>Product</div>
            <div>Net Weight</div>
            <div>Original Net Weight</div>
            <div className="w-11 text-center">#</div>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-[3fr_2fr_2fr_auto] gap-4 items-end bg-slate-50/50 md:bg-transparent p-4 md:p-0 rounded-2xl md:rounded-none border border-slate-100 md:border-none group relative">
                
                <div className="space-y-1.5 md:space-y-0">
                  <Label className="md:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Product <span className="text-rose-500">*</span></Label>
                  <Popover 
                    open={openProductRowId === item.id} 
                    onOpenChange={(open) => {
                      if (open) {
                        setOpenProductRowId(item.id);
                        setProductSearch('');
                      } else {
                        setOpenProductRowId(null);
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full h-11 rounded-xl bg-white border-slate-200 justify-between px-4 font-bold text-slate-700 hover:bg-white text-left shadow-sm"
                      >
                        <span className="truncate">
                          {item.productId ? (
                            products?.find(p => p.id === item.productId) ? (
                              `${products.find(p => p.id === item.productId).productName} - ${products.find(p => p.id === item.productId).category || ''} ${products.find(p => p.id === item.productId).type || ''}`.trim()
                            ) : 'Unknown Product'
                          ) : (
                            "Select Product"
                          )}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-0 bg-white border border-slate-100 shadow-xl rounded-xl">
                      <div className="p-2 border-b border-slate-100">
                        <Input
                          placeholder="Search product..."
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                          className="h-9 focus-visible:ring-[#7a9800]"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
                        {products?.filter(p => {
                          const display = `${p.productName} ${p.category || ''} ${p.type || ''}`.toLowerCase();
                          return display.includes(productSearch.toLowerCase());
                        }).map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              handleItemChange(item.id, 'productId', p.id);
                              setOpenProductRowId(null);
                              setProductSearch('');
                            }}
                            className={cn(
                              "p-2 rounded-lg cursor-pointer text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between",
                              item.productId === p.id && "bg-[#7a9800]/5 text-[#7a9800]"
                            )}
                          >
                            <span>{p.productName} - {p.category || ''} {p.type || ''}</span>
                          </div>
                        ))}
                        {products?.filter(p => {
                          const display = `${p.productName} ${p.category || ''} ${p.type || ''}`.toLowerCase();
                          return display.includes(productSearch.toLowerCase());
                        }).length === 0 && (
                          <p className="p-4 text-center text-[10px] font-black text-slate-400 uppercase">No products found</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-1.5 md:space-y-0 relative">
                  <Label className="md:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Net Weight <span className="text-rose-500">*</span></Label>
                  <Input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={item.netWeight} 
                    onChange={e => handleItemChange(item.id, 'netWeight', e.target.value)} 
                    placeholder="0.00"
                    className="h-11 rounded-xl bg-white border-slate-200 font-black text-slate-700 pr-8" 
                  />
                  <span className="absolute right-3 top-[34px] md:top-1/2 md:-translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">kg</span>
                </div>

                <div className="space-y-1.5 md:space-y-0 relative">
                  <Label className="md:hidden text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Original Net Weight <span className="text-rose-500">*</span></Label>
                  <Input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={item.originalNetWeight} 
                    onChange={e => handleItemChange(item.id, 'originalNetWeight', e.target.value)} 
                    placeholder="0.00"
                    className="h-11 rounded-xl bg-white border-slate-200 font-black text-slate-700 pr-8" 
                  />
                  <span className="absolute right-3 top-[34px] md:top-1/2 md:-translate-y-1/2 text-[10px] font-black text-slate-400 uppercase">kg</span>
                </div>

                <div className="flex justify-end md:block pt-2 md:pt-0">
                  <Button 
                    type="button" 
                    variant="ghost"
                    onClick={() => handleRemoveItem(item.id)} 
                    disabled={items.length === 1}
                    className="h-11 w-11 rounded-xl bg-white border border-rose-100 text-rose-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Remove Row"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>

              </div>
            ))}

          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            disabled={isSubmitting || items.length === 0} 
            className="h-14 px-10 rounded-2xl bg-[#7a9800] hover:bg-[#6c8500] text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[#7a9800]/20 gap-3 transition-transform hover:scale-105 active:scale-95"
          >
            {isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : <><Save size={18} /> Add Decay Loading</>}
          </Button>
        </div>

      </form>
    </div>
  );
}
