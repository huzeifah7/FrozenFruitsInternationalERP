'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, doc, updateDoc } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuthContext } from '@/components/auth-provider';
import { canAdd, canUpdate, canDelete } from '@/lib/permissions';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPTable } from '@/components/erp/ERPTable';
import { ERPToolbar } from '@/components/erp/ERPToolbar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, Plus, MoreHorizontal, Edit, PowerOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function UsersPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { profile } = useAuthContext();

  const hasAddAccess = canAdd(profile, 'settings.users');
  const hasUpdateAccess = canUpdate(profile, 'settings.users');
  const hasDeleteAccess = canDelete(profile, 'settings.users');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const q = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'appUsers'));
  }, [db]);

  const { data: records, isLoading, error: collectionError } = useCollection(q);

  if (collectionError) {
    console.error("Firestore collection error:", collectionError);
  }

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    if (!searchTerm) return records;
    const lower = searchTerm.toLowerCase();
    return records.filter(r => 
      (r.fullName || r.firstName || '').toLowerCase().includes(lower) ||
      (r.email || '').toLowerCase().includes(lower) ||
      (r.role || '').toLowerCase().includes(lower)
    );
  }, [records, searchTerm]);

  const handleDeactivate = async (id: string) => {
    if (!db) return;
    if (confirm('Are you sure you want to deactivate this user?')) {
      try {
        await updateDoc(doc(db, 'appUsers', id), { status: 'Inactive' });
        toast({ title: 'Success', description: 'User deactivated successfully.' });
      } catch (err) {
        console.error('Error deactivating user:', err);
        toast({ title: 'Error', description: 'Failed to deactivate user.', variant: 'destructive' });
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (confirm('Are you sure you want to permanently delete this user account?')) {
      import('firebase/firestore').then(async ({ deleteDoc }) => {
        try {
          await deleteDoc(doc(db, 'appUsers', id));
          toast({ title: 'Success', description: 'User deleted successfully.' });
        } catch (err) {
          console.error('Error deleting user:', err);
          toast({ title: 'Error', description: 'Failed to delete user.', variant: 'destructive' });
        }
      });
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/settings/users/${id}/edit`);
  };

  const columns = useMemo(() => [
    { header: 'Full Name', accessorKey: 'fullName', render: (row: any) => <span className="font-bold text-[#2e1d52]">{row.fullName || `${row.firstName || ''} ${row.lastName || ''}`}</span> },
    { header: 'User Position', accessorKey: 'position' },
    { header: 'Role', accessorKey: 'role' },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Phone Number', accessorKey: 'phone' },
    { header: 'User Location', accessorKey: 'locationName' },
    { 
      header: 'User Status', 
      accessorKey: 'status',
      render: (row: any) => (
        <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest ${
          row.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
        }`}>
          {row.status || 'Active'}
        </span>
      )
    },
    {
      header: '',
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
                {hasDeleteAccess && row.status !== 'Inactive' && (
                  <DropdownMenuItem onClick={() => handleDeactivate(row.id)} className="gap-2 cursor-pointer text-sm font-semibold text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                    <PowerOff className="h-4 w-4" /> Deactivate
                  </DropdownMenuItem>
                )}
                {hasDeleteAccess && (
                  <DropdownMenuItem onClick={() => handleDelete(row.id)} className="gap-2 cursor-pointer text-sm font-semibold text-red-700 focus:text-red-700 focus:bg-red-50">
                    <Trash2 className="h-4 w-4" /> Delete Account
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
    { label: 'Profile', href: '/settings/users' },
    { label: 'Users', active: true }
  ];

  return (
    <div className={`p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 overflow-auto bg-white' : ''}`}>
      <ERPPageHeader
        title="Users"
        subtitle="Manage system access, roles, and permissions."
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex items-center gap-3">
            {hasAddAccess && (
              <Button 
                className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-4 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                onClick={() => router.push('/settings/users/add')}
              >
                <Plus size={20} className="stroke-[2.5]" />
                <span className="font-bold tracking-wide">Add User</span>
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
