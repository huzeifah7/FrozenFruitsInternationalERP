'use client';

import React, { useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { 
  collection, 
  query, 
  doc, 
  getDocs,
  addDoc, 
  updateDoc, 
  serverTimestamp 
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useMemoFirebase,
  useDoc,
  useUser
} from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPCard } from '@/components/erp/ERPCard';
import { ERPInput } from '@/components/erp/ERPInput';
import { ERPSelect } from '@/components/erp/ERPSelect';
import { ERPDatePicker } from '@/components/erp/ERPDatePicker';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Save } from 'lucide-react';

interface PaymentFormValues {
  operationType: 'payment' | 'credit_note';
  date: string;
  amount: number;
  exchangeDate: string;
  exchangeRate: number;
  amountMAD: number;
  note: string;
}

export default function EditInvoicePaymentPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params?.invoiceId as string;
  const paymentId = params?.paymentId as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const invoiceDocRef = useMemoFirebase(() => {
    if (!db || !invoiceId) return null;
    return doc(db, 'invoices', invoiceId);
  }, [db, invoiceId]);
  
  const loadingDocRef = useMemoFirebase(() => {
    if (!db || !invoiceId) return null;
    return doc(db, 'supply_chain_loadings', invoiceId);
  }, [db, invoiceId]);

  const paymentDocRef = useMemoFirebase(() => {
    if (!db || !paymentId) return null;
    return doc(db, 'suppliers_situation_payments', paymentId);
  }, [db, paymentId]);

  const { data: invoiceData, isLoading: loadingInvoice1 } = useDoc(invoiceDocRef);
  const { data: loadingData, isLoading: loadingInvoice2 } = useDoc(loadingDocRef);
  const { data: paymentData, isLoading: loadingPayment } = useDoc(paymentDocRef);

  const invoice = invoiceData || loadingData;
  const loadingInvoice = loadingInvoice1 || loadingInvoice2 || loadingPayment;
  const collectionName = invoiceData ? 'invoices' : 'supply_chain_loadings';

  // 2. React Hook Form Setup
  const { 
    register, 
    control, 
    handleSubmit, 
    watch, 
    setValue,
    reset,
    formState: { errors, isSubmitting } 
  } = useForm<PaymentFormValues>({
    defaultValues: {
      operationType: 'payment',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      exchangeDate: new Date().toISOString().split('T')[0],
      exchangeRate: 0,
      amountMAD: 0,
      note: ''
    }
  });

  useEffect(() => {
    if (paymentData) {
      reset({
        operationType: paymentData.operationType || 'payment',
        date: paymentData.date || new Date().toISOString().split('T')[0],
        amount: Number(paymentData.amount || 0),
        exchangeDate: paymentData.exchangeDate || new Date().toISOString().split('T')[0],
        exchangeRate: Number(paymentData.exchangeRate || 0),
        amountMAD: Number(paymentData.amountMAD || 0),
        note: paymentData.note || ''
      });
    }
  }, [paymentData, reset]);

  const watchAmount = watch('amount') || 0;
  const watchExchangeRate = watch('exchangeRate') || 0;

  // 3. Dynamic conversion calculations (EUR to MAD)
  useEffect(() => {
    const calculatedMAD = Number((watchAmount * watchExchangeRate).toFixed(2));
    setValue('amountMAD', calculatedMAD);
  }, [watchAmount, watchExchangeRate, setValue]);

  const operationTypeOptions = [
    { label: 'Payment', value: 'payment' },
    { label: 'Credit Note', value: 'credit_note' }
  ];

  // 4. Submit handler to register transaction and update invoice balances
  const onSubmit = async (data: PaymentFormValues) => {
    if (!db || !invoice) return;

    if (data.amount <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Payment Amount must be greater than 0.',
        variant: 'destructive'
      });
      return;
    }

    if (data.exchangeRate <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Exchange Rate must be greater than 0.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Update payment document
      const updatedPayment = {
        operationType: data.operationType,
        date: data.date,
        amount: Number(data.amount),
        exchangeDate: data.exchangeDate,
        exchangeRate: Number(data.exchangeRate),
        amountMAD: Number((data.amount * data.exchangeRate).toFixed(2)),
        note: data.note || '',
        updatedBy: user?.email || 'admin@optimum.com',
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'suppliers_situation_payments', paymentId), updatedPayment);

      // Fetch all payments for this invoice to calculate correct remaining
      const paymentsRef = collection(db, 'suppliers_situation_payments');
      const snap = await getDocs(paymentsRef);
      const invoicePayments = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(p => p.invoiceId === invoiceId);

      // Sum all payment amounts
      const newPaidAmount = invoicePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const newOpenAmount = Math.max(0, Number(invoice.totalAmount || invoice.total_amount || 0) - newPaidAmount);

      // Calculate status
      let newStatus = 'unpaid';
      if (newPaidAmount === 0) {
        newStatus = 'unpaid';
      } else if (newPaidAmount >= Number(invoice.totalAmount || invoice.total_amount || 0)) {
        newStatus = 'paid';
      } else {
        newStatus = 'partially_paid';
      }

      // Check for overdue adjustment
      const dueDate = new Date(invoice.dueDate || invoice.due_date || invoice.date || Date.now());
      const today = new Date();
      today.setHours(0,0,0,0);
      if (newStatus !== 'paid' && dueDate < today) {
        newStatus = 'overdue';
      }

      await updateDoc(doc(db, collectionName, invoiceId), {
        paidAmount: newPaidAmount,
        openAmount: newOpenAmount,
        status: newStatus
      });

      toast({
        title: 'Payment Updated',
        description: 'The payment transaction was updated and invoice totals recalculated successfully.'
      });

      router.push(`/finance/invoices/payment/${invoiceId}`);
    } catch (err) {
      console.error('Submit payment update failed:', err);
      toast({
        title: 'Error',
        description: 'Failed to update payment. Please check database logs.',
        variant: 'destructive'
      });
    }
  };

  const breadcrumbItems = [
    { label: 'Finance', href: '/finance/suppliers-situation' },
    { label: 'Invoice', href: '/finance/invoices' },
    { label: 'Invoice Payment', href: `/finance/invoices/payment/${invoiceId}` },
    { label: 'Edit Invoice Payment', active: true }
  ];

  if (loadingInvoice) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4 bg-[#f3f3f3] min-h-screen">
        <Loader2 className="h-12 w-12 text-[#7a9800] animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading invoice details...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-20 text-rose-500 font-bold uppercase text-xs bg-[#f3f3f3] min-h-screen">
        Invoice not found.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      {/* Top Header */}
      <ERPPageHeader
        title="Edit Invoice Payment"
        subtitle={`Update payment or credit note transaction for invoice #${invoice.invoiceNumber || invoice.invoice_number || '...'}.`}
        breadcrumbItems={breadcrumbItems}
        actions={
          <Button
            onClick={() => router.push(`/finance/invoices/payment/${invoiceId}`)}
            variant="outline"
            className="h-12 border-slate-200 text-slate-600 bg-white font-bold gap-2 uppercase text-[10px] tracking-widest px-4 rounded-xl shadow-sm hover:bg-slate-50 transition-all"
          >
            <ArrowLeft size={14} className="stroke-[3]" /> Back
          </Button>
        }
      />

      <div className="max-w-[800px] mx-auto space-y-6">
        {/* Info card on invoice state */}
        <ERPCard className="border border-slate-200">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Invoice Total</p>
              <p className="text-base font-black text-[#2e1d52]">{(invoice.totalAmount || invoice.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} €</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Paid Amount</p>
              <p className="text-base font-black text-emerald-600">{(invoice.paidAmount ?? invoice.paid_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} €</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Open Amount</p>
              <p className="text-base font-black text-amber-500">{(invoice.openAmount ?? invoice.open_amount ?? (invoice.totalAmount || invoice.total_amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })} €</p>
            </div>
          </div>
        </ERPCard>

        {(invoice.openAmount ?? invoice.open_amount ?? (invoice.totalAmount || invoice.total_amount || 0)) <= 0 ? (
          <ERPCard className="border border-emerald-200 bg-emerald-50/30 text-emerald-800 p-6 rounded-2xl">
            <p className="font-bold text-sm text-center">This invoice is already fully paid. No further payments are required.</p>
          </ERPCard>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <ERPCard>
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h2 className="text-sm font-black text-[#2e1d52] uppercase tracking-widest">Edit Invoice Payment Details</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Modify transaction details to update open balances.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Operation Type Select */}
                <Controller
                  control={control}
                  name="operationType"
                  rules={{ required: 'Operation Type is required' }}
                  render={({ field }) => (
                    <ERPSelect
                      label="Operation Type"
                      placeholder="Select Type"
                      options={operationTypeOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      error={errors.operationType?.message}
                    />
                  )}
                />

                {/* Payment Date */}
                <ERPDatePicker
                  label="Payment Date"
                  error={errors.date?.message}
                  {...register('date', { required: 'Payment date is required' })}
                />

                {/* Payment Amount (€) */}
                <ERPInput
                  label="Payment Amount (€)"
                  type="number"
                  step="any"
                  placeholder="0.00"
                  error={errors.amount?.message}
                  {...register('amount', { 
                    required: 'Payment amount is required',
                    valueAsNumber: true,
                    min: { value: 0.01, message: 'Amount must be greater than 0' }
                  })}
                />

                {/* Exchange Date */}
                <ERPDatePicker
                  label="Exchange Date"
                  error={errors.exchangeDate?.message}
                  {...register('exchangeDate', { required: 'Exchange date is required' })}
                />

                {/* Exchange Rate */}
                <ERPInput
                  label="Exchange Rate"
                  type="number"
                  step="any"
                  placeholder="10.90"
                  error={errors.exchangeRate?.message}
                  {...register('exchangeRate', { 
                    required: 'Exchange rate is required',
                    valueAsNumber: true,
                    min: { value: 0.001, message: 'Exchange rate must be greater than 0' }
                  })}
                />

                {/* Amount (MAD) - Editable but auto-calculated initially */}
                <ERPInput
                  label="Amount (MAD)"
                  type="number"
                  step="any"
                  className="font-black text-emerald-600 border-dashed border-emerald-200"
                  error={errors.amountMAD?.message}
                  {...register('amountMAD', { valueAsNumber: true })}
                />

                {/* Note */}
                <div className="md:col-span-2 space-y-1.5 w-full">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1 block">
                    Payment Note
                  </Label>
                  <textarea
                    rows={3}
                    placeholder="E.g. Bank transfer ref, transaction note..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 font-bold text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#7a9800] placeholder:text-slate-400 placeholder:font-normal"
                    {...register('note')}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
                <Button
                  onClick={() => router.push(`/finance/invoices/payment/${invoiceId}`)}
                  type="button"
                  variant="outline"
                  className="h-12 border-slate-200 text-slate-600 bg-white font-bold gap-2 uppercase text-[10px] tracking-widest px-6 rounded-xl shadow-sm hover:bg-slate-50 transition-all"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#7a9800] hover:bg-[#6c8500] text-white font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl shadow-lg shadow-[#7a9800]/20 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={14} /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={14} /> Save Payment
                    </>
                  )}
                </Button>
              </div>
            </ERPCard>
          </form>
        )}
      </div>
    </div>
  );
}
