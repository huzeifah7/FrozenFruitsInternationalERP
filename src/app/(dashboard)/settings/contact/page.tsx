'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, deleteDoc, doc } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPTable } from '@/components/erp/ERPTable';
import { Loader2, Plus, Briefcase, Truck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function ContactsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  
  const q = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'contacts'));
  }, [db]);

  const { data: records, isLoading } = useCollection(q);

  const normalizeType = (type?: string) => {
    if (!type) return 'Other';
    const t = type.toLowerCase();
    if (t === 'business') return 'Business';
    if (t === 'logistics') return 'Logistics';
    if (t === 'quality') return 'Quality';
    return 'Other';
  };

  const businessContacts = useMemo(() => records?.filter(r => normalizeType(r.type || r.contactType) === 'Business') || [], [records]);
  const logisticsContacts = useMemo(() => records?.filter(r => normalizeType(r.type || r.contactType) === 'Logistics') || [], [records]);
  const qualityContacts = useMemo(() => records?.filter(r => normalizeType(r.type || r.contactType) === 'Quality') || [], [records]);

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        await deleteDoc(doc(db, 'contacts', id));
        toast({ title: 'Success', description: 'Contact deleted successfully.' });
      } catch (err) {
        console.error('Error deleting record:', err);
        toast({ title: 'Error', description: 'Failed to delete record.', variant: 'destructive' });
      }
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/settings/contact/${id}/edit`);
  };

  const columns = useMemo(() => [
    { header: 'Name', accessorKey: 'name', render: (row: any) => <span className="font-bold text-[#2e1d52]">{row.name || row.fullName}</span> },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Phone Number', accessorKey: 'phoneNumber', render: (row: any) => row.phoneNumber || row.phone },
    { header: 'Position', accessorKey: 'position' },
    { 
      header: 'Actions', 
      accessorKey: 'id', 
      align: 'right' as const, 
      render: (row: any) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs font-bold" onClick={(e) => { e.stopPropagation(); handleEdit(row.id); }}>Edit</Button>
          <Button variant="destructive" size="sm" className="h-8 text-xs font-bold" onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}>Delete</Button>
        </div>
      )
    }
  ], []);

  const breadcrumbItems = [
    { label: 'Profile', href: '/settings/contact' },
    { label: 'Contacts', active: true }
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6">
      <ERPPageHeader
        title="Contacts"
        subtitle="Manage business, logistics, and quality contacts."
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex items-center gap-3">
            <Button 
              className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-4 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              onClick={() => router.push('/settings/contact/add')}
            >
              <Plus size={20} className="stroke-[2.5]" />
              <span className="font-bold tracking-wide">Add Contact</span>
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white rounded-3xl shadow-xl border border-slate-100">
          <Loader2 className="h-10 w-10 text-[#7a9800] animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Records...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Business Section */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 overflow-hidden">
            <div className="flex items-center gap-3 mb-6 px-2">
              <div className="bg-blue-50 p-2.5 rounded-xl text-blue-600">
                <Briefcase size={24} />
              </div>
              <h2 className="text-xl font-black text-[#2e1d52] uppercase tracking-wider">Business</h2>
            </div>
            <ERPTable
              columns={columns}
              data={businessContacts}
              density="normal"
              getRowId={(row) => row.id}
              pageSize={10}
              emptyMessage="No records to display"
            />
          </div>

          {/* Logistics Section */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 overflow-hidden">
            <div className="flex items-center gap-3 mb-6 px-2">
              <div className="bg-amber-50 p-2.5 rounded-xl text-amber-600">
                <Truck size={24} />
              </div>
              <h2 className="text-xl font-black text-[#2e1d52] uppercase tracking-wider">Logistics</h2>
            </div>
            <ERPTable
              columns={columns}
              data={logisticsContacts}
              density="normal"
              getRowId={(row) => row.id}
              pageSize={10}
              emptyMessage="No records to display"
            />
          </div>

          {/* Quality Section */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-6 overflow-hidden">
            <div className="flex items-center gap-3 mb-6 px-2">
              <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
                <ShieldCheck size={24} />
              </div>
              <h2 className="text-xl font-black text-[#2e1d52] uppercase tracking-wider">Quality</h2>
            </div>
            <ERPTable
              columns={columns}
              data={qualityContacts}
              density="normal"
              getRowId={(row) => row.id}
              pageSize={10}
              emptyMessage="No records to display"
            />
          </div>
        </div>
      )}
    </div>
  );
}
