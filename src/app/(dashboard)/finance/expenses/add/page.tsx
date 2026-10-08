'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp, query } from '@/firebase/firestore-override';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useFirestore, useCollection, useMemoFirebase, useStorage } from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { useSeason } from '@/contexts/SeasonContext';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/components/auth-provider';
import { canAdd } from '@/lib/permissions';

const CURRENCIES = [
  { id: '1', symbol: '€', label: 'EUR' },
  { id: '2', symbol: '$', label: 'USD' },
  { id: '3', symbol: '£', label: 'GBP' },
  { id: '4', symbol: 'dh', label: 'MAD' },
];

const TVA_RATES = ['0', '7', '10', '12', '14', '15', '18', '20'];

export default function AddExpensePage() {
  const router = useRouter();
  const db = useFirestore();
  const storage = useStorage();
  const { profile } = useAuthContext();
  const { currentSeason } = useSeason();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    type: '1',
    invoice_number: '',
    invoice_date: today,
    invoice_due_date: today,
    supplier: '',
    supplier_if: '',
    supplier_ice: '',
    expense_type: '',
    nature: '',
    expense_type_extention: '',
    currency: '4',
    amount_ht: '',
    invoice_attachment: '',
    total_amount_ttc: 0,
    contents: [{ tva_rate: '', tva_amount: '' }]
  });

  const [errors, setErrors] = useState<any>({});

  // Fetch Suppliers
  const qSuppliers = useMemoFirebase(() => db ? query(collection(db, 'finance_suppliers')) : null, [db]);
  const { data: suppliers } = useCollection(qSuppliers);

  // Auth check
  if (!canAdd(profile, 'finance.expenses')) {
    if (typeof window !== 'undefined') {
      router.push('/unauthorized');
    }
    return null;
  }

  const updateForm = (field: string, value: any) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      return calculateTotals(next);
    });
    setErrors((prev: any) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSupplierChange = (val: string) => {
    const sup = suppliers?.find(s => s.id === val);
    setForm(prev => {
      const next = {
        ...prev,
        supplier: val,
        supplier_if: sup?.if || '',
        supplier_ice: sup?.ice || '',
        expense_type: sup?.expense_type || sup?.expenseType || ''
      };
      return calculateTotals(next);
    });
    setErrors((prev: any) => {
      const next = { ...prev };
      delete next.supplier;
      return next;
    });
  };

  const handleContentChange = (index: number, field: string, value: string) => {
    setForm(prev => {
      const nextContents = [...prev.contents];
      nextContents[index] = { ...nextContents[index], [field]: value };
      const next = { ...prev, contents: nextContents };
      return calculateTotals(next);
    });
  };

  const addRow = () => {
    setForm(prev => ({
      ...prev,
      contents: [...prev.contents, { tva_rate: '', tva_amount: '' }]
    }));
  };

  const removeRow = (index: number) => {
    setForm(prev => {
      const nextContents = [...prev.contents];
      nextContents.splice(index, 1);
      const next = { ...prev, contents: nextContents };
      return calculateTotals(next);
    });
  };

  const calculateTotals = (currentState: any) => {
    const ht = parseFloat(currentState.amount_ht) || 0;
    const tvaTotal = currentState.contents.reduce((sum: number, c: any) => sum + (parseFloat(c.tva_amount) || 0), 0);
    return { ...currentState, total_amount_ttc: ht + tvaTotal };
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateForm('invoice_attachment', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validate = () => {
    const newErrors: any = {};
    if (!form.type) newErrors.type = 'Type is required';
    if (!form.invoice_number) newErrors.invoice_number = 'Required';
    if (!form.invoice_date) newErrors.invoice_date = 'Required';
    if (!form.supplier) newErrors.supplier = 'Required';
    if (!form.invoice_due_date) newErrors.invoice_due_date = 'Required';
    if (!form.expense_type) newErrors.expense_type = 'Required';
    if (!form.currency) newErrors.currency = 'Required';
    if (!form.amount_ht || isNaN(Number(form.amount_ht))) newErrors.amount_ht = 'Required numeric';
    if (form.contents.length === 0) newErrors.contents = 'At least one TVA row required';
    
    if (form.expense_type === '5' && !form.nature) newErrors.nature = 'Required';
    if ((form.expense_type === '16' || form.expense_type.toLowerCase() === 'autres' || form.expense_type.toLowerCase() === 'autre') && !form.expense_type_extention) {
      newErrors.expense_type_extention = 'Required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !db) return;
    setLoading(true);

    try {
      let attachmentUrl = form.invoice_attachment;
      if (attachmentUrl && attachmentUrl.startsWith('data:')) {
        const fileExt = attachmentUrl.split(';')[0].split('/')[1] || 'bin';
        const filename = `expenses/${Date.now()}_${form.invoice_number}.${fileExt}`;
        const storageRef = ref(storage, filename);
        await uploadString(storageRef, attachmentUrl, 'data_url');
        attachmentUrl = await getDownloadURL(storageRef);
      }

      const supplierObj = suppliers?.find(s => s.id === form.supplier);
      
      const payload = {
        season_id: currentSeason?.id || null,
        type: form.type,
        invoice_number: form.invoice_number,
        invoice_date: form.invoice_date,
        invoice_due_date: form.invoice_due_date,
        supplier: form.supplier,
        supplier_detail: supplierObj ? { id: supplierObj.id, name: supplierObj.name || supplierObj.supplier_name } : null,
        if: form.supplier_if,
        ice: form.supplier_ice,
        expense_type: form.expense_type,
        nature: form.nature,
        expense_type_extention: form.expense_type_extention,
        currency: form.currency,
        amount_ht: Number(form.amount_ht),
        total_amount_ttc: form.total_amount_ttc,
        invoice_attachment: attachmentUrl,
        payment_status: 'UNPAID',
        contents: form.contents.map(c => ({
          tva_rate: c.tva_rate,
          tva_amount: Number(c.tva_amount) || 0
        })),
        createdAt: serverTimestamp(),
        createdBy: profile?.email || 'System',
        updatedAt: serverTimestamp(),
        updatedBy: profile?.email || 'System'
      };

      await addDoc(collection(db, 'expenses'), payload);

      toast({ title: 'Success', description: 'Expense added successfully.' });
      router.push('/finance/expenses');
    } catch (err) {
      console.error('Error saving:', err);
      toast({ title: 'Error', description: 'Failed to save expense.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const supplierObj = suppliers?.find(s => s.id === form.supplier);
  
  let expenseTypeOptions: any[] = [];
  if (supplierObj) {
    const supType = supplierObj.expense_type || supplierObj.expenseType;
    if (supType) {
      expenseTypeOptions.push({ title: supType, label: supType });
    }
    expenseTypeOptions.push({ title: 'Autres', label: 'Autres (Needs Extention)' });
  }

  const currentCurrencySymbol = CURRENCIES.find(c => c.id === form.currency)?.symbol || 'dh';

  const showNature = form.expense_type === '5';
  const showExtention = form.expense_type === '16' || form.expense_type.toLowerCase() === 'autres' || form.expense_type.toLowerCase() === 'autre';

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      <ERPPageHeader
        title="Expense"
        subtitle="Add a new financial expense"
        breadcrumbItems={[{ label: 'Profile' }, { label: 'Expenses', href: '/finance/expenses' }, { label: 'Add Expense', active: true }]}
        actions={
          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-8 font-bold tracking-wide transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save size={18} className="mr-2" />}
            {loading ? 'Adding...' : 'Add Expense'}
          </Button>
        }
      />

      <div className="max-w-[1200px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <h2 className="text-lg font-black text-[#2e1d52] uppercase tracking-wider mb-8">EXPENSE INFORMATION</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          
          {/* Row 1 */}
          <div>
            <label className="text-xs font-black uppercase text-slate-400">Type <span className="text-rose-500">*</span></label>
            <select value={form.type} onChange={e => updateForm('type', e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 outline-none">
              <option value="1">Invoice</option>
              <option value="2">Credit Note</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-black uppercase text-slate-400">{form.type === '2' ? 'Credit Note Number' : 'Invoice Number'} <span className="text-rose-500">*</span></label>
            <Input value={form.invoice_number} onChange={e => updateForm('invoice_number', e.target.value)} className="h-11 rounded-xl bg-slate-50 border-slate-200" />
            {errors.invoice_number && <p className="text-xs text-rose-500 font-bold">{errors.invoice_number}</p>}
          </div>

          {/* Row 2 */}
          <div>
            <label className="text-xs font-black uppercase text-slate-400">Invoice Date <span className="text-rose-500">*</span></label>
            <Input type="date" value={form.invoice_date} onChange={e => updateForm('invoice_date', e.target.value)} className="h-11 rounded-xl bg-slate-50 border-slate-200" />
          </div>
          <div>
            <label className="text-xs font-black uppercase text-slate-400">Supplier's Name <span className="text-rose-500">*</span></label>
            <select value={form.supplier} onChange={e => handleSupplierChange(e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 outline-none">
              <option value="">Select Supplier</option>
              {suppliers?.map(s => <option key={s.id} value={s.id}>{s.name || s.supplier_name}</option>)}
            </select>
            {errors.supplier && <p className="text-xs text-rose-500 font-bold">{errors.supplier}</p>}
          </div>

          {/* Row 3 */}
          <div>
            <label className="text-xs font-black uppercase text-slate-400">IF</label>
            <Input value={form.supplier_if} readOnly className="h-11 rounded-xl bg-slate-100 border-slate-200 text-slate-500" />
          </div>
          <div>
            <label className="text-xs font-black uppercase text-slate-400">ICE</label>
            <Input value={form.supplier_ice} readOnly className="h-11 rounded-xl bg-slate-100 border-slate-200 text-slate-500" />
          </div>

          {/* Row 4 */}
          <div>
            <label className="text-xs font-black uppercase text-slate-400">Invoice Due Date <span className="text-rose-500">*</span></label>
            <Input type="date" value={form.invoice_due_date} onChange={e => updateForm('invoice_due_date', e.target.value)} className="h-11 rounded-xl bg-slate-50 border-slate-200" />
          </div>
          <div>
            <label className="text-xs font-black uppercase text-slate-400">Expense Type <span className="text-rose-500">*</span></label>
            <select value={form.expense_type} onChange={e => updateForm('expense_type', e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 outline-none">
              <option value="">Select Expense Type</option>
              {expenseTypeOptions.map((t: any, i: number) => (
                <option key={i} value={t.title || t}>{t.label || t.title || t}</option>
              ))}
            </select>
            {errors.expense_type && <p className="text-xs text-rose-500 font-bold">{errors.expense_type}</p>}
          </div>

          {/* Row 5 */}
          <div className="flex flex-col gap-4">
            {showNature && (
              <div>
                <label className="text-xs font-black uppercase text-slate-400">Nature <span className="text-rose-500">*</span></label>
                <select value={form.nature} onChange={e => updateForm('nature', e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                  <option value="">Select Nature</option>
                  <option value="Export">Export</option>
                  <option value="Import">Import</option>
                  <option value="Autre">Autre</option>
                </select>
                {errors.nature && <p className="text-xs text-rose-500 font-bold">{errors.nature}</p>}
              </div>
            )}
            {showExtention && (
              <div>
                <label className="text-xs font-black uppercase text-slate-400">Expense Type Extention <span className="text-rose-500">*</span></label>
                <Input value={form.expense_type_extention} onChange={e => updateForm('expense_type_extention', e.target.value)} className="h-11 rounded-xl bg-slate-50 border-slate-200" />
                {errors.expense_type_extention && <p className="text-xs text-rose-500 font-bold">{errors.expense_type_extention}</p>}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-black uppercase text-slate-400">Select Currency <span className="text-rose-500">*</span></label>
            <select value={form.currency} onChange={e => updateForm('currency', e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 outline-none">
              {CURRENCIES.map(c => <option key={c.id} value={c.id}>{c.label} - {c.symbol}</option>)}
            </select>
          </div>

          {/* Row 6 */}
          <div className="md:col-span-2">
            <label className="text-xs font-black uppercase text-slate-400">Amount HT <span className="text-rose-500">*</span></label>
            <div className="relative">
              <Input 
                type="number" 
                value={form.amount_ht} 
                onChange={e => updateForm('amount_ht', e.target.value)} 
                onWheel={e => e.currentTarget.blur()}
                className="h-11 rounded-xl bg-slate-50 border-slate-200 pr-10" 
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">{currentCurrencySymbol}</span>
            </div>
            {errors.amount_ht && <p className="text-xs text-rose-500 font-bold">{errors.amount_ht}</p>}
          </div>

          {/* Row 7 */}
          <div className="md:col-span-2 space-y-3">
            {form.contents.map((row, idx) => (
              <div key={idx} className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-xs font-black uppercase text-slate-400 block mb-1">TVA Rate</label>
                  <select value={row.tva_rate} onChange={e => handleContentChange(idx, 'tva_rate', e.target.value)} className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 outline-none">
                    <option value="">TVA Rate</option>
                    {TVA_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div className="flex-1 relative">
                  <label className="text-xs font-black uppercase text-slate-400 block mb-1">TVA Amount</label>
                  <Input 
                    type="number" 
                    placeholder="Enter TVA Amount"
                    value={row.tva_amount} 
                    onChange={e => handleContentChange(idx, 'tva_amount', e.target.value)} 
                    onWheel={e => e.currentTarget.blur()}
                    className="h-11 rounded-xl bg-slate-50 border-slate-200" 
                  />
                </div>
                {idx > 0 && (
                  <Button variant="ghost" size="icon" onClick={() => removeRow(idx)} className="h-11 w-11 bg-rose-500 hover:bg-rose-600 text-white rounded-xl shrink-0">
                    <Trash2 size={16} />
                  </Button>
                )}
                {idx === form.contents.length - 1 && (
                  <Button variant="ghost" size="icon" onClick={addRow} className="h-11 w-11 bg-[#1e293b] hover:bg-[#0f172a] text-white rounded-xl shrink-0">
                    <Plus size={16} />
                  </Button>
                )}
              </div>
            ))}
            {errors.contents && <p className="text-xs text-rose-500 font-bold">{errors.contents}</p>}
          </div>

          {/* Row 8 */}
          <div>
            <label className="text-xs font-black uppercase text-slate-400 block mb-1">Total Amount TTC</label>
            <div className="h-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center px-4 justify-start">
              <span className="font-bold text-slate-700">{form.total_amount_ttc.toFixed(2)}</span>
            </div>
          </div>
          <div>
            <label className="text-xs font-black uppercase text-slate-400 block mb-1">Invoice Attachment</label>
            <Input type="file" onChange={handleFile} className="h-11 rounded-xl bg-slate-50 border-slate-200" />
          </div>

        </div>
      </div>
    </div>
  );
}
