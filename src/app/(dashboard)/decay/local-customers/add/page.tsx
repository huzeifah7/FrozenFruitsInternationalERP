'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  addDoc
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useUser
} from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  ChevronLeft, 
  Save, 
  Loader2,
  UserPlus
} from 'lucide-react';
import Link from 'next/link';

export default function AddLocalCustomerPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  // --- Form States ---
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Validation ---
  const validateForm = () => {
    const newErrors: { name?: string; phone?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required.';
    }
    if (phone.trim()) {
      // Basic phone format validation: digits, spaces, hyphens, plus sign
      const phoneRegex = /^\+?[0-9\s\-()]+$/;
      if (!phoneRegex.test(phone)) {
        newErrors.phone = 'Invalid phone number format.';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'local_customers'), {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        created_at: new Date(),
        created_by: user.email || 'unknown',
        updated_at: new Date(),
        updated_by: user.email || 'unknown'
      });

      toast({ title: 'Success', description: 'Customer added successfully.' });
      router.push('/decay/local-customers');
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to add customer.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full p-6 lg:p-8 max-w-[1000px] mx-auto animate-in fade-in duration-500 bg-[#F8F9FB] min-h-screen">
      
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
            <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/decay/local-customers')}>Local Customers</span><span className="opacity-40">/</span>
            <span className="text-[#7a9800]">Add Customer</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#2e1d52] uppercase">Local Customers</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Card: Customer Information */}
        <div className="bg-white p-6 md:p-8 rounded-[1.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#7a9800]/5 rounded-bl-full -z-10" />
          
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="h-10 w-10 rounded-xl bg-[#7a9800]/10 flex items-center justify-center">
              <UserPlus className="h-5 w-5 text-[#7a9800]" />
            </div>
            <h2 className="text-sm font-black text-[#2e1d52] uppercase tracking-[0.1em]">Customer Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Name <span className="text-rose-500">*</span></Label>
              <Input 
                type="text" 
                value={name} 
                onChange={e => {
                  setName(e.target.value);
                  if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
                }}
                placeholder="Enter customer name"
                className={cn(
                  "h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold text-slate-700 focus-visible:ring-[#7a9800]",
                  errors.name && "border-rose-400 focus-visible:ring-rose-200 bg-rose-50/10"
                )} 
              />
              {errors.name && <p className="text-[9px] text-rose-500 font-bold uppercase ml-1 mt-1">{errors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Phone Number</Label>
              <Input 
                type="text" 
                value={phone} 
                onChange={e => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors(prev => ({ ...prev, phone: undefined }));
                }}
                placeholder="e.g. +1 555-0199"
                className={cn(
                  "h-12 rounded-xl bg-slate-50/50 border-slate-200 font-bold text-slate-700 focus-visible:ring-[#7a9800]",
                  errors.phone && "border-rose-400 focus-visible:ring-rose-200 bg-rose-50/10"
                )} 
              />
              {errors.phone && <p className="text-[9px] text-rose-500 font-bold uppercase ml-1 mt-1">{errors.phone}</p>}
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">Address</Label>
              <Input 
                type="text" 
                value={address} 
                onChange={e => setAddress(e.target.value)}
                placeholder="Enter customer address"
                className="h-12 rounded-xl bg-slate-50/50 border-slate-200 font-medium text-slate-600 focus-visible:ring-[#7a9800]" 
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end pt-4">
          <Button 
            type="submit" 
            disabled={isSubmitting} 
            className="h-14 px-10 rounded-2xl bg-[#7a9800] hover:bg-[#6c8500] text-white font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-[#7a9800]/20 gap-3 transition-transform hover:scale-105 active:scale-95"
          >
            {isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</> : <><Save size={18} /> Add Customer</>}
          </Button>
        </div>

      </form>
    </div>
  );
}
