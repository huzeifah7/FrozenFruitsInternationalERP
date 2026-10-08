'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function EditContactPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [position, setPosition] = useState('');
  const [type, setType] = useState('Business');
  
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (!db || !id) return;
    const fetchDoc = async () => {
      try {
        const snap = await getDoc(doc(db, 'contacts', id));
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name || data.fullName || '');
          setEmail(data.email || '');
          setPhoneNumber(data.phoneNumber || data.phone || '');
          setPosition(data.position || '');
          setType(data.type || data.contactType || 'Business');
        }
      } catch (err) {
        console.error('Error fetching contact:', err);
      } finally {
        setFetching(false);
      }
    };
    fetchDoc();
  }, [db, id]);

  const validate = () => {
    const newErrors: any = {};
    if (!name) newErrors.name = 'Name is required';
    if (!type) newErrors.type = 'Type is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !db) return;
    setLoading(true);

    try {
      await updateDoc(doc(db, 'contacts', id), {
        name,
        email,
        phoneNumber,
        position,
        type,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'System'
      });

      toast({ title: 'Success', description: 'Contact updated successfully.' });
      router.push('/settings/contact');
    } catch (err) {
      console.error('Error saving:', err);
      toast({ title: 'Error', description: 'Failed to update contact.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const breadcrumbItems = [
    { label: 'Profile', href: '/settings/contact' },
    { label: 'Contacts', href: '/settings/contact' },
    { label: 'Edit Contact', active: true }
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
        title="Edit Contact"
        subtitle="Update contact details."
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => router.push('/settings/contact')}
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
              Update Contact
            </Button>
          </div>
        }
      />

      <div className="max-w-[800px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <h2 className="text-lg font-black text-[#2e1d52] uppercase tracking-wider mb-8">Contact Details</h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Name <span className="text-rose-500">*</span></label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`h-12 rounded-xl ${errors.name ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
                placeholder="Full Name"
              />
              {errors.name && <p className="text-xs text-rose-500 font-bold">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Type <span className="text-rose-500">*</span></label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={`w-full h-12 px-4 rounded-xl border ${errors.type ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#7a9800]/20`}
              >
                <option value="Business">Business</option>
                <option value="Logistics">Logistics</option>
                <option value="Quality">Quality</option>
                <option value="Other">Other</option>
              </select>
              {errors.type && <p className="text-xs text-rose-500 font-bold">{errors.type}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Phone Number</label>
              <Input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Position</label>
              <Input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
