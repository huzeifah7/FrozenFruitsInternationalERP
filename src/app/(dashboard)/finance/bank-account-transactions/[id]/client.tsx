'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, X } from 'lucide-react';
import { useSeason } from '@/contexts/SeasonContext';
import { useToast } from '@/hooks/use-toast';

export default function BankAccountTransactionFormPage() {
  const router = useRouter();
  const params = useParams();
  const db = useFirestore();
  const { user } = useUser();
  const { currentSeason } = useSeason();
  const { toast } = useToast();
  
  const isAdd = params.id === 'add';
  const id = isAdd ? null : (params.id as string);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!isAdd);
  
  // Left Column
  const [bank, setBank] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [expenseType, setExpenseType] = useState('');
  const [note, setNote] = useState('');
  
  // Right Column
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [currency, setCurrency] = useState('MAD');
  const [transactionType, setTransactionType] = useState('');
  
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (isAdd || !db || !id) {
      setFetching(false);
      return;
    }
    const fetchDoc = async () => {
      try {
        const snap = await getDoc(doc(db, 'bankAccountTransactions', id));
        if (snap.exists()) {
          const data = snap.data();
          setBank(data.bank || '');
          setPaidTo(data.paidTo || '');
          setTransactionAmount(data.transactionAmount?.toString() || '');
          setExpenseType(data.expenseType || '');
          setNote(data.note || '');
          
          setTransactionDate(data.transactionDate || new Date().toISOString().split('T')[0]);
          setCurrency(data.currency || 'MAD');
          setTransactionType(data.transactionType || '');
        }
      } catch (err) {
        console.error('Error fetching record:', err);
      } finally {
        setFetching(false);
      }
    };
    fetchDoc();
  }, [db, id, isAdd]);

  const validate = () => {
    const newErrors: any = {};
    if (!bank) newErrors.bank = 'Bank is required';
    if (!transactionAmount) newErrors.transactionAmount = 'Transaction Amount is required';
    if (!transactionDate) newErrors.transactionDate = 'Transaction Date is required';
    if (!currency) newErrors.currency = 'Currency is required';
    if (!transactionType) newErrors.transactionType = 'Transaction Type is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !db) return;
    setLoading(true);

    try {
      const payload = {
        bank,
        paidTo,
        transactionAmount: Number(transactionAmount),
        expenseType,
        note,
        transactionDate,
        currency,
        transactionType,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'System'
      };

      if (isAdd) {
        await addDoc(collection(db, 'bankAccountTransactions'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user?.email || 'System',
          seasonId: currentSeason?.id || null
        });
      } else {
        await setDoc(doc(db, 'bankAccountTransactions', id as string), payload, { merge: true });
      }

      toast({ title: 'Success', description: 'Bank Account Transaction saved successfully.' });
      router.push('/finance/bank-account-transactions');
    } catch (err) {
      console.error('Error saving:', err);
      toast({ title: 'Error', description: 'Failed to save record.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const breadcrumbItems = [
    { label: 'Profile', href: '/finance/bank-account-transactions' },
    { label: 'Expenses', href: '/finance/bank-account-transactions' },
    { label: isAdd ? 'Add Bank Account Transaction' : 'Edit Bank Account Transaction', active: true }
  ];

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f3f3f3] gap-4">
        <Loader2 className="h-10 w-10 text-[#7a9800] animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      <ERPPageHeader
        title="Bank Account Transaction"
        subtitle={isAdd ? "Add new transaction" : "Edit transaction"}
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => router.push('/finance/bank-account-transactions')}
              className="h-12 rounded-xl px-6 font-bold text-slate-600"
            >
              <X size={18} className="mr-2" /> Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={loading}
              className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-8 font-bold tracking-wide transition-all"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save size={18} className="mr-2" />}
              {isAdd ? 'Add Transaction' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      <div className="max-w-[1200px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <h2 className="text-lg font-black text-[#2e1d52] uppercase tracking-wider mb-8">Add Bank Account Transaction</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
          {/* Left Column */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Bank <span className="text-rose-500">*</span></label>
              <select
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className={`w-full h-12 px-4 rounded-xl border ${errors.bank ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#7a9800]/20`}
              >
                <option value="">Select...</option>
                <option value="BMCE EO">BMCE EO</option>
                <option value="Credit Agricole EO">Credit Agricole EO</option>
                <option value="Caixa Bank">Caixa Bank</option>
              </select>
              {errors.bank && <p className="text-xs text-rose-500 font-bold">{errors.bank}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Paid To</label>
              <Input
                type="text"
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700"
                placeholder="Payee name..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Transaction Amount <span className="text-rose-500">*</span></label>
              <div className="relative">
                <Input
                  type="number"
                  value={transactionAmount}
                  onChange={(e) => setTransactionAmount(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  className={`h-12 rounded-xl pr-12 ${errors.transactionAmount ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
                  placeholder="0.00"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase">dh</span>
              </div>
              {errors.transactionAmount && <p className="text-xs text-rose-500 font-bold">{errors.transactionAmount}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Expense Type</label>
              <select
                value={expenseType}
                onChange={(e) => setExpenseType(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#7a9800]/20"
              >
                <option value="">Select...</option>
                <option value="Transport">Transport</option>
                <option value="Fuel">Fuel</option>
                <option value="Salary">Salary</option>
                <option value="Supplier Payment">Supplier Payment</option>
                <option value="Bank Fees">Bank Fees</option>
                <option value="Office Expense">Office Expense</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Note</label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="min-h-[100px] rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700"
                placeholder="Enter optional notes..."
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Transaction Date <span className="text-rose-500">*</span></label>
              <Input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className={`h-12 rounded-xl ${errors.transactionDate ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
              />
              {errors.transactionDate && <p className="text-xs text-rose-500 font-bold">{errors.transactionDate}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Select Currency <span className="text-rose-500">*</span></label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={`w-full h-12 px-4 rounded-xl border ${errors.currency ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#7a9800]/20`}
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="MAD">MAD</option>
              </select>
              {errors.currency && <p className="text-xs text-rose-500 font-bold">{errors.currency}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Transaction Type <span className="text-rose-500">*</span></label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
                className={`w-full h-12 px-4 rounded-xl border ${errors.transactionType ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#7a9800]/20`}
              >
                <option value="">Select...</option>
                <option value="DEBIT">DEBIT</option>
                <option value="CREDIT">CREDIT</option>
              </select>
              {errors.transactionType && <p className="text-xs text-rose-500 font-bold">{errors.transactionType}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
