'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, deleteDoc, doc } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPStatisticCard } from '@/components/erp/ERPStatisticCard';
import { ERPTable } from '@/components/erp/ERPTable';
import { ERPToolbar } from '@/components/erp/ERPToolbar';
import { ERPExportButtons } from '@/components/erp/ERPExportButtons';
import { Loader2, Plus, Landmark, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSeason } from '@/contexts/SeasonContext';

export default function BankAccountTransactionsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { currentSeason } = useSeason();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'DEBIT' | 'CREDIT'>('DEBIT');

  // 1. Fetch Data
  const q = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'bankAccountTransactions'));
  }, [db]);

  const { data: allRecords, isLoading } = useCollection(q);

  // 2. Filter by season
  const records = useMemo(() => {
    if (!allRecords) return [];
    return allRecords.filter(r => !currentSeason?.id || !r.seasonId || r.seasonId === currentSeason.id);
  }, [allRecords, currentSeason]);

  // 3. Compute Totals for Banks
  const bankBalances = useMemo(() => {
    const balances: Record<string, number> = {
      'BMCE EO': 0,
      'Credit Agricole EO': 0,
      'Caixa Bank': 0
    };

    records.forEach(r => {
      const bank = r.bank;
      if (!bank) return;
      
      if (!balances[bank] && balances[bank] !== 0) {
        balances[bank] = 0;
      }

      const amt = Number(r.transactionAmount || 0);
      const type = (r.transactionType || '').toUpperCase();

      if (type === 'CREDIT') {
        balances[bank] += amt;
      } else if (type === 'DEBIT') {
        balances[bank] -= amt;
      }
    });

    return balances;
  }, [records]);

  // 4. Tab Filtering & Search
  const filteredRecords = useMemo(() => {
    const list = records.filter(r => (r.transactionType || '').toUpperCase() === activeTab);
    
    if (!searchTerm) return list;
    const lower = searchTerm.toLowerCase();
    return list.filter(r => 
      (r.bank || '').toLowerCase().includes(lower) ||
      (r.paidTo || '').toLowerCase().includes(lower) ||
      (r.expenseType || '').toLowerCase().includes(lower) ||
      (r.note || '').toLowerCase().includes(lower)
    );
  }, [records, activeTab, searchTerm]);

  // 5. Excel Export Data
  const excelExportData = useMemo(() => {
    return filteredRecords.map(r => ({
      'Bank': r.bank || '',
      'Transaction Date': r.transactionDate || '',
      'Transaction Amount': r.transactionAmount,
      'Currency': r.currency || 'MAD',
      'Paid To': r.paidTo || '',
      'Transaction Type': r.transactionType || '',
      'Expense Type': r.expenseType || '',
      'Note': r.note || '',
      'Created By': r.createdBy || '',
      'Updated By': r.updatedBy || ''
    }));
  }, [filteredRecords]);

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (confirm('Are you sure you want to delete this record?')) {
      try {
        await deleteDoc(doc(db, 'bankAccountTransactions', id));
      } catch (err) {
        console.error('Error deleting record:', err);
        alert('Failed to delete record.');
      }
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/finance/bank-transactions/${id}`);
  };

  // 6. Define Table Columns
  const columns = useMemo(() => {
    return [
      { header: 'Bank', accessorKey: 'bank', render: (row: any) => <span className="font-bold text-[#2e1d52]">{row.bank}</span> },
      { header: 'Transaction Date', accessorKey: 'transactionDate' },
      { 
        header: 'Transaction Amount', 
        accessorKey: 'transactionAmount',
        render: (row: any) => <span className="font-black text-[#7a9800]">{Number(row.transactionAmount).toLocaleString()} {row.currency || 'MAD'}</span>
      },
      { header: 'Paid To', accessorKey: 'paidTo' },
      { 
        header: 'Transaction Type', 
        accessorKey: 'transactionType',
        render: (row: any) => <span className="text-[10px] bg-slate-100 text-slate-500 font-black uppercase tracking-widest px-2 py-1 rounded-md">{row.transactionType}</span>
      },
      { header: 'Expense Type', accessorKey: 'expenseType' },
      { header: 'Note', accessorKey: 'note' },
      { header: 'Created By', accessorKey: 'createdBy' },
      { header: 'Updated By', accessorKey: 'updatedBy' },
      {
        header: 'Actions',
        accessorKey: 'id',
        render: (row: any) => (
          <div className="flex items-center justify-end gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-xs font-bold"
              onClick={() => handleEdit(row.id)}
            >
              Edit
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              className="h-8 text-xs font-bold"
              onClick={() => handleDelete(row.id)}
            >
              Delete
            </Button>
          </div>
        )
      }
    ];
  }, []);

  const breadcrumbItems = [
    { label: 'Profile', href: '/finance/bank-transactions' },
    { label: 'Bank Account Transaction', active: true }
  ];

  return (
    <div className={`p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 overflow-auto bg-white' : ''}`}>
      {/* Top Page Header */}
      <ERPPageHeader
        title="Bank Account Transaction"
        subtitle="Manage bank transfers, debit cards, and corporate account transactions."
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex items-center gap-3">
            <Button 
              className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-4 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
              onClick={() => router.push('/finance/bank-transactions/add')}
            >
              <Plus size={20} className="stroke-[2.5]" />
              <span className="font-bold tracking-wide">Add Transaction</span>
            </Button>
            <ERPExportButtons 
              excelData={excelExportData} 
              excelFileName={`Bank-Transactions-${activeTab}`}
            />
          </div>
        }
      />

      {/* Top Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1600px] mx-auto">
        <ERPStatisticCard
          title="BMCE EO"
          value={`${(bankBalances['BMCE EO'] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`}
          icon={<Landmark className="text-[#2e1d52]" size={18} />}
          description="Available balance"
        />
        <ERPStatisticCard
          title="Credit Agricole EO"
          value={`${(bankBalances['Credit Agricole EO'] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`}
          icon={<Landmark className="text-[#7a9800]" size={18} />}
          description="Available balance"
        />
        <ERPStatisticCard
          title="Caixa Bank"
          value={`${(bankBalances['Caixa Bank'] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`}
          icon={<Landmark className="text-amber-500" size={18} />}
          description="Available balance"
        />
      </div>

      {/* Main Container */}
      <div className="max-w-[1600px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 pt-6 border-b border-slate-100 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('DEBIT')}
            className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'DEBIT'
                ? 'border-[#7a9800] text-[#7a9800]'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
            }`}
          >
            DEBIT
          </button>
          <button
            onClick={() => setActiveTab('CREDIT')}
            className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'CREDIT'
                ? 'border-[#7a9800] text-[#7a9800]'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
            }`}
          >
            CREDIT
          </button>
        </div>

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
