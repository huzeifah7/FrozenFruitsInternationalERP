'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, updateDoc, serverTimestamp, query, where, getDocs, doc, writeBatch, getDoc } from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function EditSeasonPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [status, setStatus] = useState('Active');
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (!db || !id) return;
    const fetchDoc = async () => {
      try {
        const snap = await getDoc(doc(db, 'seasons', id));
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name || '');
          setStart(data.start || '');
          setEnd(data.end || '');
          setStatus(data.status || 'Active');
        }
      } catch (err) {
        console.error('Error fetching season:', err);
      } finally {
        setFetching(false);
      }
    };
    fetchDoc();
  }, [db, id]);

  const validate = () => {
    const newErrors: any = {};
    if (!name) newErrors.name = 'Name is required';
    if (!start) newErrors.start = 'Start date is required';
    if (!end) newErrors.end = 'End date is required';
    if (!status) newErrors.status = 'Status is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !db) return;
    setLoading(true);

    try {
      // OVERLAP VALIDATION
      const allSeasonsQ = query(collection(db, 'seasons'));
      const allSeasonsSnap = await getDocs(allSeasonsQ);
      
      const newStart = new Date(start);
      const newEnd = new Date(end);
      
      let hasOverlap = false;
      allSeasonsSnap.forEach(d => {
        if (d.id === id) return; // Ignore self
        const data = d.data();
        if (data.start && data.end) {
          const existStart = new Date(data.start);
          const existEnd = new Date(data.end);
          
          if (newStart <= existEnd && newEnd >= existStart) {
            hasOverlap = true;
          }
        }
      });
      
      if (hasOverlap) {
        toast({ title: 'Validation Error', description: 'Season dates cannot overlap with existing seasons.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Default Status Logic
      const isDefault = status === 'Active'; // If they set it to active, it becomes default

      if (isDefault) {
        const defaultQ = query(collection(db, 'seasons'), where('isDefault', '==', true));
        const defaultSnap = await getDocs(defaultQ);
        if (!defaultSnap.empty) {
          const batch = writeBatch(db);
          defaultSnap.forEach(d => {
            if (d.id !== id) {
              batch.update(doc(db, 'seasons', d.id), { isDefault: false, status: 'Inactive', updatedAt: serverTimestamp() });
            }
          });
          await batch.commit();
        }
      }

      await updateDoc(doc(db, 'seasons', id), {
        name,
        start,
        end,
        status,
        isDefault,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'System'
      });

      toast({ title: 'Success', description: 'Season updated successfully.' });
      router.push('/settings/seasons');
    } catch (err) {
      console.error('Error saving:', err);
      toast({ title: 'Error', description: 'Failed to update season.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const breadcrumbItems = [
    { label: 'Profile', href: '/settings/seasons' },
    { label: 'Seasons', href: '/settings/seasons' },
    { label: 'Edit Season', active: true }
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
        title="Edit Season"
        subtitle="Update billing/operational period details."
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => router.push('/settings/seasons')}
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
              Update Season
            </Button>
          </div>
        }
      />

      <div className="max-w-[800px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <h2 className="text-lg font-black text-[#2e1d52] uppercase tracking-wider mb-8">Season Details</h2>
        
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Name <span className="text-rose-500">*</span></label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`h-12 rounded-xl ${errors.name ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
              placeholder="e.g. Season 2025 to 2026"
            />
            {errors.name && <p className="text-xs text-rose-500 font-bold">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">Start <span className="text-rose-500">*</span></label>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={`h-12 rounded-xl ${errors.start ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
              />
              {errors.start && <p className="text-xs text-rose-500 font-bold">{errors.start}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400">End <span className="text-rose-500">*</span></label>
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={`h-12 rounded-xl ${errors.end ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700`}
              />
              {errors.end && <p className="text-xs text-rose-500 font-bold">{errors.end}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400">Status <span className="text-rose-500">*</span></label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={`w-full h-12 px-4 rounded-xl border ${errors.status ? 'border-rose-500' : 'border-slate-200'} bg-slate-50 focus:bg-white transition-all text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#7a9800]/20`}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            {errors.status && <p className="text-xs text-rose-500 font-bold">{errors.status}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
