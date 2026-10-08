'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, doc, deleteDoc } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuthContext } from '@/components/auth-provider';
import { canAdd, canUpdate, canDelete } from '@/lib/permissions';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPTable } from '@/components/erp/ERPTable';
import { ERPToolbar } from '@/components/erp/ERPToolbar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Swal from 'sweetalert2';

export default function SuppliersPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { profile } = useAuthContext();

  const hasAddAccess = canAdd(profile, 'finance.suppliers');
  const hasUpdateAccess = canUpdate(profile, 'finance.suppliers');
  const hasDeleteAccess = canDelete(profile, 'finance.suppliers');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const q = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'finance_suppliers'));
  }, [db]);

  const { data: records, isLoading } = useCollection(q);

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    if (!searchTerm) return records;
    const lower = searchTerm.toLowerCase().trim();
    return records.filter(r => {
      const name = String(r.name || r.companyName || r.company_name || r.supplier_name || r.title || '').toLowerCase();
      const ifVal = String(r.if || r.if_value || r.ifNumber || '').toLowerCase();
      const iceVal = String(r.ice || r.iceNumber || '').toLowerCase();
      const expType = String(r.expense_type || r.expenseType || r.category || '').toLowerCase();
      const email = String(r.email || '').toLowerCase();
      const phone = String(r.phone || r.phoneNumber || '').toLowerCase();
      const createdBy = String(r.createdByName || r.createdBy || r.createdby?.first_name || '').toLowerCase();
      const updatedBy = String(r.updatedByName || r.updatedBy || r.updatedby?.first_name || '').toLowerCase();

      return (
        name.includes(lower) || 
        ifVal.includes(lower) || 
        iceVal.includes(lower) || 
        expType.includes(lower) || 
        email.includes(lower) || 
        phone.includes(lower) ||
        createdBy.includes(lower) ||
        updatedBy.includes(lower)
      );
    });
  }, [records, searchTerm]);

  const handleDelete = async (id: string) => {
    if (!db) return;
    
    const result = await Swal.fire({
      title: 'Do you really want to delete this record?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'DELETE',
      confirmButtonColor: '#d33'
    });

    if (result.isConfirmed) {
      try {
        await deleteDoc(doc(db, 'finance_suppliers', id));
        Swal.fire('Deleted!', 'Your Record has been deleted.', 'success');
      } catch (err) {
        console.error('Error deleting supplier:', err);
        toast({ title: 'Error', description: 'Failed to delete supplier.', variant: 'destructive' });
      }
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/finance/suppliers/${id}/edit`);
  };

  const columns = useMemo(() => [
    { 
      header: 'Name', 
      accessorKey: 'name', 
      render: (row: any) => <span className="font-bold text-[#2e1d52]">{row.name || row.companyName || row.company_name || row.supplier_name || '-'}</span> 
    },
    { header: 'IF', accessorKey: 'if', render: (row: any) => row.if || row.if_value || row.ifNumber || '-' },
    { header: 'ICE', accessorKey: 'ice', render: (row: any) => row.ice || row.iceNumber || '-' },
    { header: 'Expense Type', accessorKey: 'expense_type', render: (row: any) => row.expense_type || row.expenseType || '-' },
    { 
      header: 'Created By', 
      accessorKey: 'createdBy',
      render: (row: any) => {
        if (row.createdByName) return row.createdByName;
        if (row.createdby?.first_name || row.createdby?.last_name) return `${row.createdby.first_name || ''} ${row.createdby.last_name || ''}`.trim();
        return row.createdBy || '-';
      }
    },
    { 
      header: 'Updated By', 
      accessorKey: 'updatedBy',
      render: (row: any) => {
        if (row.updatedByName) return row.updatedByName;
        if (row.updatedby?.first_name || row.updatedby?.last_name) return `${row.updatedby.first_name || ''} ${row.updatedby.last_name || ''}`.trim();
        return row.updatedBy || '-';
      }
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      align: 'right' as const,
      render: (row: any) => {
        if (!hasUpdateAccess && !hasDeleteAccess) return null;
        
        return (
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                  <MoreHorizontal className="h-4 w-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-lg border-slate-100">
                {hasUpdateAccess && (
                  <DropdownMenuItem onClick={() => handleEdit(row.id)} className="gap-2 cursor-pointer text-sm font-semibold text-slate-600">
                    <Edit className="h-4 w-4" /> Edit
                  </DropdownMenuItem>
                )}
                {hasDeleteAccess && (
                  <DropdownMenuItem onClick={() => handleDelete(row.id)} className="gap-2 cursor-pointer text-sm font-semibold text-red-700 focus:text-red-700 focus:bg-red-50">
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      }
    }
  ], [hasUpdateAccess, hasDeleteAccess]);

  const breadcrumbItems = [
    { label: 'Profile', href: '/finance/suppliers' },
    { label: 'Suppliers', active: true }
  ];

  return (
    <div className={`p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 overflow-auto bg-white' : ''}`}>
      <ERPPageHeader
        title="Suppliers"
        subtitle="Manage Finance Suppliers"
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex items-center gap-3">
            {hasAddAccess && (
              <Button 
                className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-4 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                onClick={() => router.push('/finance/suppliers/add')}
              >
                <Plus size={20} className="stroke-[2.5]" />
                <span className="font-bold tracking-wide">Add Supplier</span>
              </Button>
            )}
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
    </div>
  );
}
