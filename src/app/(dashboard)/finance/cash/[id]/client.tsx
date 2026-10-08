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

export default function CaisseEspeceFormPage() {
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
  
  // Shared Fields
  const [operation, setOperation] = useState('');
  const [currency, setCurrency] = useState('MAD');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  
  // IN Fields
  const [paidBy, setPaidBy] = useState('');
  const [operationType, setOperationType] = useState('');
  const [paymentType, setPaymentType] = useState('Espece'); // Always Espece for IN
  
  // OUT Fields
  const [payedTo, setPayedTo] = useState('');
  const [expenseType, setExpenseType] = useState('');

  // Autre Fields
  const [customOperationType, setCustomOperationType] = useState('');
  const [customExpenseType, setCustomExpenseType] = useState('');
  
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (isAdd || !db || !id) {
      setFetching(false);
      return;
    }
    const fetchDoc = async () => {
      try {
        const snap = await getDoc(doc(db, 'cashTransactions', id));
        if (snap.exists()) {
          const data = snap.data();
          setOperation(data.operation || '');
          setCurrency(data.currency || 'MAD');
          setAmount(data.amount?.toString() || '');
          setDate(data.date || new Date().toISOString().split('T')[0]);
          setNote(data.note || '');
          
          if (data.operation === 'IN') {
            setPaidBy(data.paidBy || data.paid_by || '');
            if (data.originalOperationType === 'Autre') {
              setOperationType('Autre');
              setCustomOperationType(data.operationType || '');
            } else {
              setOperationType(data.operationType || data.operation_type || '');
            }
            setPaymentType(data.paymentType || data.payment_type || 'Espece');
          } else if (data.operation === 'OUT') {
            setPayedTo(data.payedTo || data.paidTo || data.payed_to || '');
            if (data.originalExpenseType === 'Autre') {
              setExpenseType('Autre');
              setCustomExpenseType(data.expenseType || '');
            } else {
              setExpenseType(data.expenseType || data.typeOfExpense || data.expense_type || '');
            }
          }
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
    if (!operation) newErrors.operation = 'Operation is required';
    if (!currency) newErrors.currency = 'Currency is required';
    if (!amount || Number(amount) <= 0) newErrors.amount = 'Amount is required and must be greater than 0';
    if (!date) newErrors.date = 'Date is required';

    if (operation === 'IN') {
      if (!paidBy) newErrors.paidBy = 'Paid By is required';
      if (!operationType) newErrors.operationType = 'Operation Type is required';
      if (operationType === 'Autre' && !customOperationType) newErrors.customOperationType = 'Custom Operation Type is required';
      if (!paymentType) newErrors.paymentType = 'Payment Type is required';
    } else if (operation === 'OUT') {
      if (!payedTo) newErrors.payedTo = 'Payed To is required';
      if (!expenseType) newErrors.expenseType = 'Type of Expense is required';
      if (expenseType === 'Autre' && !customExpenseType) newErrors.customExpenseType = 'Custom Expense Type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !db) return;
    setLoading(true);

    try {
      const payload: any = {
        operation,
        currency,
        amount: Number(amount),
        date,
        note,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'System'
      };

      if (operation === 'IN') {
        payload.paidBy = paidBy;
        payload.paymentType = paymentType;
        if (operationType === 'Autre') {
          payload.operationType = customOperationType;
          payload.originalOperationType = 'Autre';
        } else {
          payload.operationType = operationType;
        }
      } else if (operation === 'OUT') {
        payload.payedTo = payedTo;
        if (expenseType === 'Autre') {
          payload.expenseType = customExpenseType;
          payload.originalExpenseType = 'Autre';
        } else {
          payload.expenseType = expenseType;
        }
      }

      if (isAdd) {
        await addDoc(collection(db, 'cashTransactions'), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user?.email || 'System',
          seasonId: currentSeason?.id || null
        });
      } else {
        await setDoc(doc(db, 'cashTransactions', id as string), payload, { merge: true });
      }

      if (typeof window !== 'undefined') {
        localStorage.setItem('caisse_espece_tab', payload.operation);
      }
      toast({ title: 'Success', description: 'Record saved successfully.' });
      router.push('/finance/cash');
    } catch (err) {
      console.error('Error saving:', err);
      toast({ title: 'Error', description: 'Failed to save record.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const breadcrumbItems = [
    { label: 'Profile', href: '/finance/cash' },
    { label: 'Caisse Espece', href: '/finance/cash' },
    { label: isAdd ? 'Add Caisse Espece' : 'Edit Caisse Espece', active: true }
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
        title="Caisse Espece"
        subtitle={isAdd ? "Add new cash operation" : "Edit cash operation"}
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => router.push('/finance/cash')}
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
              {isAdd ? 'Add Caisse Espece' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      <div className="max-w-[1200px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <h2 className="text-lg font-black text-[#2e1d52] uppercase tracking-wider mb-8">Caisse Espece Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Select Operation <span className="text-rose-500">*</span></label>
              <select
                value={operation}
                onChange={(e) => {
                  setOperation(e.target.value);
                  setOperationType('');
                  setExpenseType('');
                  setPaidBy('');
                  setPayedTo('');
                  setPaymentType('Espece');
                  setErrors({});
                }}
                className={`w-full h-12 px-4 rounded-xl border ${errors.operation ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#7a9800]/20`}
              >
                <option value="">Select...</option>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
              </select>
              {errors.operation && <p className="text-xs text-rose-500 font-bold">{errors.operation}</p>}
            </div>

            {operation === 'IN' && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Operation Type <span className="text-rose-500">*</span></label>
                <select
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  className={`w-full h-12 px-4 rounded-xl border ${errors.operationType ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#7a9800]/20`}
                >
                  <option value="">Select...</option>
                  <option value="Vente déchets">Vente déchets</option>
                  <option value="MAD">MAD</option>
                  <option value="Avance">Avance</option>
                  <option value="Alimentation Caisse">Alimentation Caisse</option>
                  <option value="Divers">Divers</option>
                  <option value="Autre">Autre</option>
                </select>
                {errors.operationType && <p className="text-xs text-rose-500 font-bold">{errors.operationType}</p>}
              </div>
            )}

            {operation === 'IN' && operationType === 'Autre' && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Operation Type <span className="text-rose-500">*</span></label>
                <Input
                  type="text"
                  value={customOperationType}
                  onChange={(e) => setCustomOperationType(e.target.value)}
                  className={`h-12 rounded-xl border ${errors.customOperationType ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
                  placeholder="Enter Autre Operation Type"
                />
                {errors.customOperationType && <p className="text-xs text-rose-500 font-bold">{errors.customOperationType}</p>}
              </div>
            )}

            {operation === 'OUT' && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Type of Expense <span className="text-rose-500">*</span></label>
                <select
                  value={expenseType}
                  onChange={(e) => setExpenseType(e.target.value)}
                  className={`w-full h-12 px-4 rounded-xl border ${errors.expenseType ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#7a9800]/20`}
                >
                  <option value="">Select...</option>
                  <option value="Vignette">Vignette</option>
                  <option value="Reparation Auto">Reparation Auto</option>
                  <option value="Assurance Auto">Assurance Auto</option>
                  <option value="Gasoil">Gasoil</option>
                  <option value="Frais de deplacement - Reunion">Frais de deplacement - Reunion</option>
                  <option value="Transport MP">Transport MP</option>
                  <option value="Transport matiere divers">Transport matiere divers</option>
                  <option value="Salaire(s) Espece">Salaire(s) Espece</option>
                  <option value="Frais Telephone et Internet">Frais Telephone et Internet</option>
                  <option value="Primes de fin de saison">Primes de fin de saison</option>
                  <option value="Reparation PC et accessoires">Reparation PC et accessoires</option>
                  <option value="Frais divers">Frais divers</option>
                  <option value="Don">Don</option>
                  <option value="Achat Matiere premiere">Achat Matiere premiere</option>
                  <option value="Autre">Autre</option>
                </select>
                {errors.expenseType && <p className="text-xs text-rose-500 font-bold">{errors.expenseType}</p>}
              </div>
            )}

            {operation === 'OUT' && expenseType === 'Autre' && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Expense Type <span className="text-rose-500">*</span></label>
                <Input
                  type="text"
                  value={customExpenseType}
                  onChange={(e) => setCustomExpenseType(e.target.value)}
                  className={`h-12 rounded-xl border ${errors.customExpenseType ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
                  placeholder="Enter Autre Expense Type"
                />
                {errors.customExpenseType && <p className="text-xs text-rose-500 font-bold">{errors.customExpenseType}</p>}
              </div>
            )}

            {operation === 'IN' && (
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
            )}

            {operation === 'IN' && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Date <span className="text-rose-500">*</span></label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`h-12 rounded-xl ${errors.date ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
                />
                {errors.date && <p className="text-xs text-rose-500 font-bold">{errors.date}</p>}
              </div>
            )}

            {/* OUT mode puts Amount on Left */}
            {operation === 'OUT' && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Amount <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className={`h-12 rounded-xl pr-12 ${errors.amount ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
                    placeholder="Amount"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase">dh</span>
                </div>
                {errors.amount && <p className="text-xs text-rose-500 font-bold">{errors.amount}</p>}
              </div>
            )}

            {operation === 'IN' && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Note</label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-[100px] rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700"
                  placeholder="Note"
                />
              </div>
            )}
            
            {/* Default layout when no operation selected */}
            {!operation && (
              <>
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
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Date <span className="text-rose-500">*</span></label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 rounded-xl bg-slate-50" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Note</label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[100px] rounded-xl bg-slate-50" placeholder="Note" />
                </div>
              </>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {(!operation || operation === 'OUT') && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {operation === 'OUT' ? 'Payed To' : 'Payed To'}
                </label>
                {operation === 'OUT' && (
                  <>
                    <Input
                      type="text"
                      value={payedTo}
                      onChange={(e) => setPayedTo(e.target.value)}
                      className={`h-12 rounded-xl border ${errors.payedTo ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
                      placeholder="Payed To"
                    />
                    {errors.payedTo && <p className="text-xs text-rose-500 font-bold">{errors.payedTo}</p>}
                  </>
                )}
                {!operation && (
                  <Input type="text" disabled className="h-12 rounded-xl bg-slate-50 opacity-50" placeholder="Payed To" />
                )}
              </div>
            )}

            {operation === 'OUT' && (
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
            )}

            {operation === 'OUT' && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Date <span className="text-rose-500">*</span></label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`h-12 rounded-xl ${errors.date ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
                />
                {errors.date && <p className="text-xs text-rose-500 font-bold">{errors.date}</p>}
              </div>
            )}

            {operation === 'OUT' && (
              <div className="space-y-2">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-[100px] rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700"
                  placeholder="Observation / Note"
                />
              </div>
            )}

            {operation === 'IN' && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Paid By <span className="text-rose-500">*</span></label>
                <Input
                  type="text"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className={`h-12 rounded-xl border ${errors.paidBy ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
                  placeholder="Paid By"
                />
                {errors.paidBy && <p className="text-xs text-rose-500 font-bold">{errors.paidBy}</p>}
              </div>
            )}

            {operation === 'IN' && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Select Payment Type <span className="text-rose-500">*</span></label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className={`w-full h-12 px-4 rounded-xl border ${errors.paymentType ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#7a9800]/20`}
                >
                  <option value="Espece">Espece</option>
                </select>
                {errors.paymentType && <p className="text-xs text-rose-500 font-bold">{errors.paymentType}</p>}
              </div>
            )}

            {(!operation || operation === 'IN') && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Amount <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className={`h-12 rounded-xl pr-12 ${errors.amount ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
                    placeholder="Amount"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase">dh</span>
                </div>
                {errors.amount && <p className="text-xs text-rose-500 font-bold">{errors.amount}</p>}
              </div>
            )}

            {operation === 'OUT' && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Date <span className="text-rose-500">*</span></label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`h-12 rounded-xl ${errors.date ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
                />
                {errors.date && <p className="text-xs text-rose-500 font-bold">{errors.date}</p>}
              </div>
            )}

          </div>
        </div>
        
        {/* IN mode puts Note at the bottom full width */}
        {operation === 'IN' && (
          <div className="space-y-2 mt-6">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Note</label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-[100px] rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700"
              placeholder="Note"
            />
          </div>
        )}
      </div>
    </div>
  );
}
