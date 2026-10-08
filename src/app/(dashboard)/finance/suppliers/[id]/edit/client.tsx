'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';
import { useAuthContext } from '@/components/auth-provider';
import { canUpdate } from '@/lib/permissions';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function EditSupplierPage() {
  const router = useRouter();
  const params = useParams();
  const db = useFirestore();
  const { user } = useUser();
  const { profile } = useAuthContext();
  const { toast } = useToast();

  const id = params?.id as string;
  const hasUpdateAccess = canUpdate(profile, 'finance.suppliers');

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  
  const [name, setName] = useState('');
  const [taxIf, setTaxIf] = useState('');
  const [ice, setIce] = useState('');
  const [expenseType, setExpenseType] = useState('');
  
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (!db || !id) return;
    const fetchSupplier = async () => {
      try {
        const docRef = doc(db, 'finance_suppliers', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || '');
          setTaxIf(data.if || '');
          setIce(data.ice || '');
          setExpenseType(data.expense_type || data.expenseType || '');
        } else {
          toast({ title: 'Error', description: 'Supplier not found.', variant: 'destructive' });
          router.push('/finance/suppliers');
        }
      } catch (err: any) {
        toast({ title: 'Error', description: 'Failed to fetch supplier details.', variant: 'destructive' });
      } finally {
        setDataLoading(false);
      }
    };
    fetchSupplier();
  }, [db, id, router, toast]);

  const handleNumberInput = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d*$/.test(val)) {
      setter(val);
    }
  };

  const validate = () => {
    const newErrors: any = {};
    if (!name) newErrors.name = 'Name is required';
    if (taxIf && !/^\d+$/.test(taxIf)) newErrors.taxIf = 'IF must contain numbers only';
    if (ice && !/^\d+$/.test(ice)) newErrors.ice = 'ICE must contain numbers only';
    if (!expenseType) newErrors.expenseType = 'Expense Type is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!hasUpdateAccess) {
      toast({ title: 'Unauthorized', description: 'You do not have permission to update suppliers.', variant: 'destructive' });
      return;
    }
    
    if (!validate() || !db || !id) return;
    setLoading(true);

    try {
      await updateDoc(doc(db, 'finance_suppliers', id), {
        name,
        if: taxIf,
        ice,
        expense_type: expenseType,
        expenseType, // save both for compatibility
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'System',
        updatedByUid: user?.uid || '',
        updatedByName: user?.displayName || user?.email || ''
      });

      toast({ title: 'Success', description: 'Supplier updated successfully.' });
      router.push('/finance/suppliers');
    } catch (err: any) {
      console.error('Error updating supplier:', err);
      toast({ title: 'Error', description: err.message || 'Failed to update supplier.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!hasUpdateAccess) {
    return <div className="p-8 text-center text-rose-500 font-bold">Unauthorized. You do not have permission to access this page.</div>;
  }

  const breadcrumbItems = [
    { label: 'Profile', href: '/finance/suppliers' },
    { label: 'Suppliers', href: '/finance/suppliers' },
    { label: 'Edit', active: true }
  ];

  if (dataLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <Loader2 className="h-10 w-10 text-[#7a9800] animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Supplier...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      <ERPPageHeader
        title="Suppliers"
        subtitle="Edit Finance Supplier"
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/finance/suppliers')} className="h-12 rounded-xl px-6 font-bold text-slate-600">
              <X size={18} className="mr-2" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading} className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-8 font-bold tracking-wide transition-all">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save size={18} className="mr-2" />}
              Update Supplier
            </Button>
          </div>
        }
      />

      <div className="max-w-[1000px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-8 space-y-8">
        <h2 className="text-xl font-black text-[#2e1d52] uppercase tracking-wider border-b pb-4 mb-8">Supplier</h2>

        <div className="grid grid-cols-2 gap-8">
          {/* Left Col */}
          <div className="space-y-6">
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Name <span className="text-rose-500">*</span></label>
              <Input 
                value={name} 
                onChange={e => { setName(e.target.value); setErrors((prev: any) => ({ ...prev, name: '' })); }} 
                className={`h-12 mt-2 rounded-xl ${errors.name ? 'border-rose-500' : 'border-slate-200'} bg-slate-50`} 
              />
              {errors.name && <p className="text-xs text-rose-500 font-bold mt-1">{errors.name}</p>}
            </div>
            
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">ICE</label>
              <Input 
                type="text"
                value={ice} 
                onChange={handleNumberInput(setIce)} 
                className={`h-12 mt-2 rounded-xl ${errors.ice ? 'border-rose-500' : 'border-slate-200'} bg-slate-50`} 
              />
              {errors.ice && <p className="text-xs text-rose-500 font-bold mt-1">{errors.ice}</p>}
            </div>
          </div>

          {/* Right Col */}
          <div className="space-y-6">
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">IF</label>
              <Input 
                type="text"
                value={taxIf} 
                onChange={handleNumberInput(setTaxIf)} 
                className={`h-12 mt-2 rounded-xl ${errors.taxIf ? 'border-rose-500' : 'border-slate-200'} bg-slate-50`} 
              />
              {errors.taxIf && <p className="text-xs text-rose-500 font-bold mt-1">{errors.taxIf}</p>}
            </div>
            
            <div>
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Expense Type <span className="text-rose-500">*</span></label>
              <Input 
                value={expenseType} 
                onChange={e => { setExpenseType(e.target.value); setErrors((prev: any) => ({ ...prev, expenseType: '' })); }} 
                className={`h-12 mt-2 rounded-xl ${errors.expenseType ? 'border-rose-500' : 'border-slate-200'} bg-slate-50`} 
              />
              {errors.expenseType && <p className="text-xs text-rose-500 font-bold mt-1">{errors.expenseType}</p>}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-8 mt-8 border-t">
          <Button onClick={handleSave} disabled={loading} className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-10 font-bold tracking-wide transition-all">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Update Supplier'}
          </Button>
        </div>
      </div>
    </div>
  );
}
