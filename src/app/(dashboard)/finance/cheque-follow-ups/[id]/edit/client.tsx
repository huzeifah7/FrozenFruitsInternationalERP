'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';
import { useSeason } from '@/contexts/SeasonContext';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthContext } from '@/components/auth-provider';
import { canUpdate } from '@/lib/permissions';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';

// React Select Rule Wrapper
const ReactSelect = ({ options, value: formValue, onChange, id }: any) => {
  const valueObj = options.find((option: any) => option.value == formValue) || null;
  
  return (
    <select
      id={id}
      value={valueObj ? valueObj.value : ""}
      onChange={(e) => {
        const selectedOption = options.find((opt: any) => opt.value == e.target.value);
        if (selectedOption) {
          onChange(selectedOption.value);
        } else {
          onChange("");
        }
      }}
      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <option value="" disabled>Select an option</option>
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
};

const BANK_OPTIONS = [
  { value: 1, label: 'BMCE EO' },
  { value: 2, label: 'Credit Agricole EO' }
];

const STATUS_OPTIONS = [
  { value: 1, label: 'Collected' },
  { value: 0, label: 'Not Collected' }
];

const EXPENSE_TYPE_OPTIONS = [
  { value: 1, label: 'Frais Divers' },
  { value: 2, label: 'Don' },
  { value: 3, label: 'Matiere premiere' }
];

export default function EditChequeFollowUpPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const { profile } = useAuthContext();
  const { currentSeason } = useSeason();
  const hasUpdateAccess = canUpdate(profile, 'finance.chequeFollowUp');

  const [formData, setFormData] = useState({
    bank_name: "",
    amount: "",
    date: "",
    cheque_status: "",
    cheque_number: "",
    cheque_collection_date: "",
    cheque_designation: "",
    expense_type: ""
  });

  const [backendErrors, setBackendErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!hasUpdateAccess || !db || !id) return;

    const fetchCheque = async () => {
      try {
        setIsLoading(true);
        const docRef = doc(db, 'cheque_follow_ups', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const cheque = docSnap.data();
          setFormData({
            bank_name: cheque.bank_name !== undefined && cheque.bank_name !== null ? String(cheque.bank_name) : "",
            amount: cheque.amount !== undefined && cheque.amount !== null ? String(cheque.amount) : "",
            date: cheque.date || "",
            cheque_status: cheque.cheque_status !== undefined && cheque.cheque_status !== null ? String(cheque.cheque_status) : "",
            cheque_number: cheque.cheque_number || "",
            cheque_collection_date: cheque.cheque_collection_date || "",
            cheque_designation: cheque.cheque_designation || "",
            expense_type: cheque.expense_type !== undefined && cheque.expense_type !== null ? String(cheque.expense_type) : ""
          });
        } else {
          Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'error', title: 'Cheque FollowUp not found' });
          router.push('/finance/cheque-follow-ups');
        }
      } catch (err) {
        console.error(err);
        Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'error', title: 'Failed to load cheque data' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCheque();
  }, [id, hasUpdateAccess, router, db]);

  if (!hasUpdateAccess) {
    return <div className="p-8 text-center text-rose-500 font-bold">Unauthorized. You do not have permission to access this page.</div>;
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (backendErrors[field]) {
      setBackendErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    val = val.replace(/[^0-9.]/g, ''); // Keep only numbers and dot
    const parts = val.split('.');
    if (parts.length > 2) {
      val = parts[0] + '.' + parts.slice(1).join('');
    }
    handleInputChange('amount', val);
  };

  const validateForm = () => {
    const errors: Record<string, string[]> = {};
    if (!formData.bank_name) errors.bank_name = ['Bank Name is required'];
    if (!formData.cheque_number) errors.cheque_number = ['Check Number is required'];
    if (!formData.date) errors.date = ['Date is required'];
    if (!formData.amount || Number(formData.amount) <= 0) errors.amount = ['Valid amount is required'];
    if (formData.cheque_status === "") errors.cheque_status = ['Cheque Status is required'];
    if (!formData.expense_type) errors.expense_type = ['Expense Type is required'];
    if (!formData.cheque_designation) errors.cheque_designation = ['Cheque Designation is required'];
    
    if (formData.cheque_status == "1" && !formData.cheque_collection_date) {
      errors.cheque_collection_date = ['Cheque Collection Date is required when Status is Collected'];
    }

    if (Object.keys(errors).length > 0) {
      setBackendErrors(errors);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !db || !id) return;

    try {
      setIsSubmitting(true);
      
      const payload = {
        bank_name: Number(formData.bank_name),
        amount: Number(formData.amount),
        date: formData.date,
        cheque_status: Number(formData.cheque_status),
        cheque_number: formData.cheque_number,
        cheque_collection_date: formData.cheque_status == "1" ? formData.cheque_collection_date : "",
        cheque_designation: formData.cheque_designation,
        expense_type: Number(formData.expense_type),
        updatedAt: serverTimestamp(),
        updatedBy: profile?.email || 'System'
      };

      await updateDoc(doc(db, 'cheque_follow_ups', id), payload);

      Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: 'Cheque FollowUp updated successfully' });
      router.push('/finance/cheque-follow-ups');
    } catch (err) {
      console.error(err);
      Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'error', title: 'An error occurred while updating Firestore' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const showChequeCollectionDate = formData.cheque_status == "1";

  const renderError = (field: string) => {
    if (!backendErrors[field]) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1.5 text-rose-500 text-[11px] font-bold tracking-wide uppercase">
        <AlertCircle size={12} />
        <span>{backendErrors[field][0]}</span>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      <ERPPageHeader
        title="Cheque FollowUp"
        subtitle="Edit an existing cheque follow-up record."
        breadcrumbItems={[
          { label: 'Profile', href: '/finance/cheque-follow-ups' },
          { label: 'Cheque FollowUp', href: '/finance/cheque-follow-ups' },
          { label: 'Edit', active: true }
        ]}
      />

      <div className="max-w-[1600px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-black text-[#2e1d52] uppercase tracking-widest">Cheque FollowUp Info</h2>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-[#7a9800] animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Record...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Left Column */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="bank_name" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bank Name <span className="text-rose-500">*</span></Label>
                  <ReactSelect
                    id="bank_name"
                    options={BANK_OPTIONS}
                    value={formData.bank_name}
                    onChange={(val: string) => handleInputChange('bank_name', val)}
                  />
                  {renderError('bank_name')}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cheque_number" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Check Number <span className="text-rose-500">*</span></Label>
                  <Input
                    id="cheque_number"
                    value={formData.cheque_number}
                    onChange={(e) => handleInputChange('cheque_number', e.target.value)}
                    className="h-11 rounded-xl"
                    placeholder="Enter check number"
                  />
                  {renderError('cheque_number')}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Date <span className="text-rose-500">*</span></Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  {renderError('date')}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Amount <span className="text-rose-500">*</span></Label>
                  <div className="relative">
                    <Input
                      id="amount"
                      value={formData.amount}
                      onChange={handleAmountChange}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="h-11 rounded-xl pr-12"
                      placeholder="0.00"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">dh</span>
                  </div>
                  {renderError('amount')}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="cheque_status" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Cheque Status <span className="text-rose-500">*</span></Label>
                  <ReactSelect
                    id="cheque_status"
                    options={STATUS_OPTIONS}
                    value={formData.cheque_status}
                    onChange={(val: string) => handleInputChange('cheque_status', val)}
                  />
                  {renderError('cheque_status')}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expense_type" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Expense Type <span className="text-rose-500">*</span></Label>
                  <ReactSelect
                    id="expense_type"
                    options={EXPENSE_TYPE_OPTIONS}
                    value={formData.expense_type}
                    onChange={(val: string) => handleInputChange('expense_type', val)}
                  />
                  {renderError('expense_type')}
                </div>

                {showChequeCollectionDate && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <Label htmlFor="cheque_collection_date" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cheque Collection Date <span className="text-rose-500">*</span></Label>
                    <Input
                      id="cheque_collection_date"
                      type="date"
                      value={formData.cheque_collection_date}
                      onChange={(e) => handleInputChange('cheque_collection_date', e.target.value)}
                      className="h-11 rounded-xl border-green-500 focus-visible:ring-green-500"
                    />
                    {renderError('cheque_collection_date')}
                  </div>
                )}
              </div>
              
              {/* Full Width */}
              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label htmlFor="cheque_designation" className="text-xs font-bold text-slate-500 uppercase tracking-widest">Cheque Designation <span className="text-rose-500">*</span></Label>
                <Input
                  id="cheque_designation"
                  value={formData.cheque_designation}
                  onChange={(e) => handleInputChange('cheque_designation', e.target.value)}
                  className="h-11 rounded-xl"
                  placeholder="Enter cheque designation"
                />
                {renderError('cheque_designation')}
              </div>

            </div>

            <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/finance/cheque-follow-ups')}
                className="h-12 rounded-xl px-6 font-bold uppercase tracking-widest text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white rounded-xl px-8 font-bold uppercase tracking-widest text-xs shadow-lg shadow-[#7a9800]/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Update Cheque FollowUp
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
