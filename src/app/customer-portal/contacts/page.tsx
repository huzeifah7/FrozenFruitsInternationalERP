'use client';

import React, { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from '@/firebase/firestore-override';
import { Briefcase, Truck, ShieldCheck } from 'lucide-react';

export default function CustomerContactsPage() {
  const db = useFirestore();

  const contactsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'contacts'));
  }, [db]);

  const { data: records, isLoading } = useCollection<any>(contactsQuery);

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

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-[#709506] border-t-transparent rounded-full" />
      </div>
    );
  }

  const renderTable = (contactsList: any[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-slate-800 font-semibold border-b border-slate-100 bg-slate-50/50">
          <tr>
            <th className="py-3 px-4">Name</th>
            <th className="py-3 px-4">Email</th>
            <th className="py-3 px-4">Phone Number</th>
            <th className="py-3 px-4">Position</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-600">
          {contactsList.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-6 text-center text-slate-500">No records to display</td>
            </tr>
          ) : (
            contactsList.map((contact, idx) => (
              <tr key={contact.id || idx} className="hover:bg-slate-50">
                <td className="py-3.5 px-4 font-semibold text-[#709506]">{contact.name || contact.fullName || 'N/A'}</td>
                <td className="py-3.5 px-4">{contact.email || '-'}</td>
                <td className="py-3.5 px-4">{contact.phoneNumber || contact.phone || '-'}</td>
                <td className="py-3.5 px-4">{contact.position || '-'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-2 md:p-4 space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-0.5">
        <h1 className="text-2xl font-bold text-[#709506]">Contacts</h1>
        <div className="text-sm text-slate-500">
          Profile / <span className="text-slate-400">Contacts</span>
        </div>
      </div>

      {/* Business Contacts Section */}
      <div className="bg-white rounded-md shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
            <Briefcase size={20} />
          </div>
          <h2 className="text-[#3b2164] font-semibold text-lg uppercase tracking-wider">Business</h2>
        </div>
        {renderTable(businessContacts)}
      </div>

      {/* Logistics Contacts Section */}
      <div className="bg-white rounded-md shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
            <Truck size={20} />
          </div>
          <h2 className="text-[#3b2164] font-semibold text-lg uppercase tracking-wider">Logistics</h2>
        </div>
        {renderTable(logisticsContacts)}
      </div>

      {/* Quality Contacts Section */}
      <div className="bg-white rounded-md shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
            <ShieldCheck size={20} />
          </div>
          <h2 className="text-[#3b2164] font-semibold text-lg uppercase tracking-wider">Quality</h2>
        </div>
        {renderTable(qualityContacts)}
      </div>
    </div>
  );
}
