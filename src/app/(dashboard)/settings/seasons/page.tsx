'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, deleteDoc, doc, updateDoc, writeBatch, where, getDocs, serverTimestamp } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPTable } from '@/components/erp/ERPTable';
import { ERPToolbar } from '@/components/erp/ERPToolbar';
import { Loader2, Plus, Check, X, MoreHorizontal, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function SeasonsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState<{ isOpen: boolean; id: string; targetStatus: string } | null>(null);

  const q = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'seasons'));
  }, [db]);

  const { data: records, isLoading } = useCollection(q);

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    if (!searchTerm) return records;
    const lower = searchTerm.toLowerCase();
    return records.filter(r => 
      (r.name || '').toLowerCase().includes(lower) ||
      (r.status || '').toLowerCase().includes(lower)
    );
  }, [records, searchTerm]);

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (confirm('Are you sure you want to delete this season?')) {
      try {
        await deleteDoc(doc(db, 'seasons', id));
        toast({ title: 'Success', description: 'Season deleted successfully.' });
      } catch (err) {
        console.error('Error deleting record:', err);
        toast({ title: 'Error', description: 'Failed to delete record.', variant: 'destructive' });
      }
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/settings/seasons/${id}/edit`);
  };

  const handleUpdateStatus = async () => {
    if (!db || !statusUpdate) return;
    try {
      const { id, targetStatus } = statusUpdate;
      const isDefault = targetStatus === 'Active';

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
        status: targetStatus,
        isDefault,
        updatedAt: serverTimestamp()
      });

      toast({ title: 'Success', description: 'Season status updated successfully.' });
      setStatusUpdate(null);
    } catch (err) {
      console.error('Error updating status:', err);
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    }
  };

  const columns = useMemo(() => [
    {
      header: 'Actions',
      accessorKey: 'id',
      render: (row: any) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="text-slate-400 cursor-pointer hover:text-slate-600 font-bold px-2 py-1 flex justify-center w-max">
              <MoreHorizontal className="h-5 w-5" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(row.id); }}>
              <Edit className="mr-2 h-4 w-4" />
              <span>Edit</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
    { header: 'Name', accessorKey: 'name', render: (row: any) => <span className="font-bold text-[#2e1d52]">{row.name}</span> },
    { header: 'Start', accessorKey: 'start' },
    { header: 'End', accessorKey: 'end' },
    { 
      header: 'Status', 
      accessorKey: 'status',
      render: (row: any) => {
        const isActive = row.status === 'Active';
        return (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setStatusUpdate({
                isOpen: true,
                id: row.id,
                targetStatus: isActive ? 'Inactive' : 'Active'
              });
            }}
            className={`text-[11px] font-bold px-4 py-1.5 rounded-sm cursor-pointer transition-transform hover:scale-105 active:scale-95 border-none shadow-sm ${
              isActive ? 'bg-[#3b8755] text-white' : 'bg-[#dc3545] text-white'
            }`}
          >
            {isActive ? 'Default Season' : 'Inactive Season'}
          </button>
        );
      }
    },
    { header: 'Created By', accessorKey: 'createdBy' }
  ], []);

  const breadcrumbItems = [
    { label: 'Profile', href: '/settings/seasons' },
    { label: 'Seasons', active: true }
  ];

  return (
    <div className={`p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 overflow-auto bg-white' : ''}`}>
      <ERPPageHeader
        title="Seasons"
        subtitle="Manage billing and operational periods."
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex items-center gap-3">
            <Button 
              className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-4 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              onClick={() => router.push('/settings/seasons/add')}
            >
              <Plus size={20} className="stroke-[2.5]" />
              <span className="font-bold tracking-wide">Add Season</span>
            </Button>
          </div>
        }
      />

      <div className="max-w-[1600px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <ERPToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          density={density}
          onDensityChange={setDensity}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(prev => !prev)}
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 text-[#7a9800] animate-spin" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Records...</p>
          </div>
        ) : (
          <ERPTable
            columns={columns}
            data={filteredRecords}
            density={density}
            getRowId={(row) => row.id}
            pageSize={10}
            emptyMessage="No records to display"
          />
        )}
      </div>

      {statusUpdate?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center text-center relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setStatusUpdate(null)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} strokeWidth={3} />
            </button>
            <div className="w-16 h-16 rounded-full border-[3px] border-emerald-100 flex items-center justify-center mb-5">
              <Check className="h-8 w-8 text-emerald-500" strokeWidth={3.5} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-8">
              Do you really want to update the season?
            </h3>
            <div className="flex gap-4 w-full justify-center">
              <Button 
                onClick={handleUpdateStatus}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 h-10 rounded shadow-md"
              >
                Update
              </Button>
              <Button 
                onClick={() => setStatusUpdate(null)}
                className="bg-[#dc3545] hover:bg-red-600 text-white font-bold px-8 h-10 rounded shadow-md"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
