'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp, writeBatch, doc } from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Plus, Minus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ContactRow = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  position: string;
};

export default function AddContactsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);

  const [businessRows, setBusinessRows] = useState<ContactRow[]>([{ id: 'b1', name: '', email: '', phoneNumber: '', position: '' }]);
  const [logisticsRows, setLogisticsRows] = useState<ContactRow[]>([{ id: 'l1', name: '', email: '', phoneNumber: '', position: '' }]);
  const [qualityRows, setQualityRows] = useState<ContactRow[]>([{ id: 'q1', name: '', email: '', phoneNumber: '', position: '' }]);

  const addRow = (type: 'business' | 'logistics' | 'quality') => {
    const newRow = { id: Math.random().toString(36).substr(2, 9), name: '', email: '', phoneNumber: '', position: '' };
    if (type === 'business') setBusinessRows([...businessRows, newRow]);
    if (type === 'logistics') setLogisticsRows([...logisticsRows, newRow]);
    if (type === 'quality') setQualityRows([...qualityRows, newRow]);
  };

  const removeRow = (type: 'business' | 'logistics' | 'quality', id: string) => {
    if (type === 'business') setBusinessRows(businessRows.filter(r => r.id !== id));
    if (type === 'logistics') setLogisticsRows(logisticsRows.filter(r => r.id !== id));
    if (type === 'quality') setQualityRows(qualityRows.filter(r => r.id !== id));
  };

  const updateRow = (type: 'business' | 'logistics' | 'quality', id: string, field: keyof ContactRow, value: string) => {
    const updateFn = (rows: ContactRow[]) => rows.map(r => r.id === id ? { ...r, [field]: value } : r);
    if (type === 'business') setBusinessRows(updateFn(businessRows));
    if (type === 'logistics') setLogisticsRows(updateFn(logisticsRows));
    if (type === 'quality') setQualityRows(updateFn(qualityRows));
  };

  const handleSave = async () => {
    if (!db) return;
    
    // Check validation: if a row has any field filled but no name, it's invalid.
    const allRows = [
      ...businessRows.map(r => ({ ...r, type: 'Business' })),
      ...logisticsRows.map(r => ({ ...r, type: 'Logistics' })),
      ...qualityRows.map(r => ({ ...r, type: 'Quality' }))
    ];

    const filledRows = allRows.filter(r => r.name || r.email || r.phoneNumber || r.position);
    
    const invalidRows = filledRows.filter(r => !r.name);
    if (invalidRows.length > 0) {
      toast({ title: 'Validation Error', description: 'Name is required for all filled rows.', variant: 'destructive' });
      return;
    }

    if (filledRows.length === 0) {
      toast({ title: 'Validation Error', description: 'Please fill at least one contact row.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const batch = writeBatch(db);
      
      filledRows.forEach(row => {
        const docRef = doc(collection(db, 'contacts'));
        batch.set(docRef, {
          name: row.name,
          email: row.email,
          phoneNumber: row.phoneNumber,
          position: row.position,
          type: row.type,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: user?.email || 'System',
          updatedBy: user?.email || 'System'
        });
      });

      await batch.commit();

      toast({ title: 'Success', description: 'Contacts added successfully.' });
      router.push('/settings/contact');
    } catch (err) {
      console.error('Error saving:', err);
      toast({ title: 'Error', description: 'Failed to add contacts.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const breadcrumbItems = [
    { label: 'Profile', href: '/settings/contact' },
    { label: 'Contacts', href: '/settings/contact' },
    { label: 'Add Contacts', active: true }
  ];

  const renderSection = (title: string, type: 'business' | 'logistics' | 'quality', rows: ContactRow[]) => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-md font-bold text-[#2e1d52]">{title}</h3>
        <Button 
          variant="outline" 
          size="sm"
          className="h-8 border-[#7a9800] text-[#7a9800] hover:bg-[#7a9800] hover:text-white"
          onClick={() => addRow(type)}
        >
          <Plus size={16} />
        </Button>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-12 gap-4 px-2">
          <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Name</div>
          <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Email</div>
          <div className="col-span-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number</div>
          <div className="col-span-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Position</div>
          <div className="col-span-1"></div>
        </div>

        {rows.map((row, index) => (
          <div key={row.id} className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-3">
              <Input
                placeholder="Full Name"
                value={row.name}
                onChange={(e) => updateRow(type, row.id, 'name', e.target.value)}
                className={`h-10 text-sm ${(row.email || row.phoneNumber || row.position) && !row.name ? 'border-rose-500' : ''}`}
              />
              {(row.email || row.phoneNumber || row.position) && !row.name && (
                <p className="text-[10px] text-rose-500 mt-1 font-bold">Name is required</p>
              )}
            </div>
            <div className="col-span-3">
              <Input
                placeholder="Email"
                type="email"
                value={row.email}
                onChange={(e) => updateRow(type, row.id, 'email', e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div className="col-span-3">
              <Input
                placeholder="Phone Number"
                value={row.phoneNumber}
                onChange={(e) => updateRow(type, row.id, 'phoneNumber', e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div className="col-span-2">
              <Input
                placeholder="Position"
                value={row.position}
                onChange={(e) => updateRow(type, row.id, 'position', e.target.value)}
                className="h-10 text-sm"
              />
            </div>
            <div className="col-span-1 flex justify-center">
              <Button 
                variant="destructive" 
                size="icon" 
                className="h-8 w-8 rounded-full"
                onClick={() => removeRow(type, row.id)}
                disabled={rows.length === 1 && index === 0}
              >
                <Minus size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      <ERPPageHeader
        title="Contacts"
        subtitle="Add new contacts to your organization."
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
              Add Contact
            </Button>
          </div>
        }
      />

      <div className="max-w-[1200px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 p-8">
        <h2 className="text-xl font-black text-[#2e1d52] uppercase tracking-wider mb-8 pb-4 border-b">Contacts</h2>
        
        {renderSection('Add Business', 'business', businessRows)}
        {renderSection('Add Logistics', 'logistics', logisticsRows)}
        {renderSection('Add Quality', 'quality', qualityRows)}

        <div className="flex justify-end pt-6 border-t mt-8">
          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-10 font-bold tracking-wide transition-all"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Add Contact'}
          </Button>
        </div>
      </div>
    </div>
  );
}
