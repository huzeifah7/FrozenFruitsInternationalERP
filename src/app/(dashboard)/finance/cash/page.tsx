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
import { Loader2, Plus, ArrowUpCircle, ArrowDownCircle, Wallet, Download, CheckCircle2, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useSeason } from '@/contexts/SeasonContext';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';

export default function CaisseEspecePage() {
  const router = useRouter();
  const db = useFirestore();
  const { currentSeason } = useSeason();
  const { toast } = useToast();
  const { canAdd, canUpdate, canDelete } = usePermissions('finance.cash');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'OUT' | 'IN'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('caisse_espece_tab');
      if (saved === 'IN' || saved === 'OUT') return saved;
    }
    return 'OUT';
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('caisse_espece_tab', activeTab);
    }
  }, [activeTab]);

  // 1. Fetch Data
  const q = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'cashTransactions'));
  }, [db]);

  const { data: allRecords, isLoading } = useCollection(q);

  const getCreatedMs = (r: any): number => {
    if (!r) return 0;
    const val = r.createdAt || r.updatedAt;
    if (!val) return 0;
    if (typeof val.toDate === 'function') {
      return val.toDate().getTime();
    }
    if (val.seconds) {
      return val.seconds * 1000;
    }
    if (typeof val === 'string') {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.getTime();
      }
    }
    return 0;
  };

  const getDateMs = (r: any): number => {
    if (!r) return 0;
    const val = r.date;
    if (!val) return getCreatedMs(r);
    
    if (typeof val.toDate === 'function') {
      return val.toDate().getTime();
    }
    if (val.seconds) {
      return val.seconds * 1000;
    }
    if (typeof val === 'string') {
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
        const [day, month, year] = val.split('/');
        return new Date(`${year}-${month}-${day}`).getTime() || 0;
      }
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.getTime();
      }
    }
    return getCreatedMs(r);
  };

  // 2. Filter and sort by date from newest to oldest
  const records = useMemo(() => {
    if (!allRecords) return [];
    return [...allRecords].sort((a, b) => {
      const dateA = getDateMs(a);
      const dateB = getDateMs(b);
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      const createdA = getCreatedMs(a);
      const createdB = getCreatedMs(b);
      return createdB - createdA;
    });
  }, [allRecords]);

  // 3. Compute Totals
  const { totalIn, totalOut, totalVenteDechets } = useMemo(() => {
    let tIn = 0;
    let tOut = 0;
    let tVente = 0;

    records.forEach(r => {
      const amt = Number(r.amount || 0);
      const op = (r.operation || '').toUpperCase();
      const opType = (r.operationType || '').trim();

      if (op === 'IN') {
        tIn += amt;
        if (opType.toLowerCase() === 'vente déchets' || opType.toLowerCase() === 'vente dechets') {
          tVente += amt;
        }
      } else if (op === 'OUT') {
        tOut += amt;
      }
    });

    return { totalIn: tIn, totalOut: tOut, totalVenteDechets: tVente };
  }, [records]);

  // 4. Tab Filtering & Search
  const filteredRecords = useMemo(() => {
    const list = records.filter(r => (r.operation || '').toUpperCase() === activeTab);
    
    if (!searchTerm) return list;
    const lower = searchTerm.toLowerCase();
    return list.filter(r => 
      (r.paidTo || '').toLowerCase().includes(lower) ||
      (r.paidBy || '').toLowerCase().includes(lower) ||
      (r.expenseType || '').toLowerCase().includes(lower) ||
      (r.operationType || '').toLowerCase().includes(lower) ||
      (r.note || '').toLowerCase().includes(lower)
    );
  }, [records, activeTab, searchTerm]);

  // 5. Excel Export Data
  const handleExportExcelCustom = async () => {
    if (records.length === 0) {
      toast({ title: 'No Data', description: 'No records to export.', variant: 'destructive' });
      return;
    }

    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const inRecords = records.filter(r => (r.operation || '').toUpperCase() === 'IN');
    const outRecords = records.filter(r => (r.operation || '').toUpperCase() === 'OUT');

    const headerFont = { bold: true };
    const borderAll = {
      top: { style: 'thin' as any }, left: { style: 'thin' as any },
      bottom: { style: 'thin' as any }, right: { style: 'thin' as any },
      color: { argb: 'FFD3D3D3' } // light gray borders
    };

    // Sheet 1: IN
    const wsIn = wb.addWorksheet('IN');
    const inHeaders = ["Operation", "Paid By", "Operation Type", "Payment Type", "Cheque Status", "Amount", "Date", "Note"];
    inHeaders.forEach((h, i) => {
      const cell = wsIn.getCell(1, i + 1);
      cell.value = h;
      cell.font = headerFont;
      cell.border = borderAll;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    inRecords.forEach((r, idx) => {
      const rowIdx = idx + 2;
      const values = [
        'IN',
        r.paidBy || r.paid_by || r.paidByName || '',
        r.operationType || '',
        r.paymentType || 'Espece',
        r.chequeStatus || '',
        Number(r.amount || 0),
        r.date || '',
        r.note || ''
      ];
      values.forEach((val, i) => {
        const cell = wsIn.getCell(rowIdx, i + 1);
        cell.value = val;
        cell.border = borderAll;
        cell.alignment = { horizontal: typeof val === 'number' ? 'right' : 'left' };
      });
    });
    wsIn.columns = [
      { width: 12 }, { width: 30 }, { width: 25 }, { width: 20 }, 
      { width: 15 }, { width: 15 }, { width: 15 }, { width: 40 }
    ];

    // Sheet 2: OUT
    const wsOut = wb.addWorksheet('OUT');
    const outHeaders = ["Operation", "Pay To", "Expense Type", "Amount", "Date", "Note"];
    outHeaders.forEach((h, i) => {
      const cell = wsOut.getCell(1, i + 1);
      cell.value = h;
      cell.font = headerFont;
      cell.border = borderAll;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    outRecords.forEach((r, idx) => {
      const rowIdx = idx + 2;
      const values = [
        'OUT',
        r.payedTo || r.paidTo || r.payed_to || r.paidToName || '',
        r.expenseType || r.typeOfExpense || '',
        Number(r.amount || 0),
        r.date || '',
        r.note || ''
      ];
      values.forEach((val, i) => {
        const cell = wsOut.getCell(rowIdx, i + 1);
        cell.value = val;
        cell.border = borderAll;
        cell.alignment = { horizontal: typeof val === 'number' ? 'right' : 'left' };
      });
    });
    wsOut.columns = [
      { width: 12 }, { width: 30 }, { width: 30 }, { width: 15 }, 
      { width: 15 }, { width: 40 }
    ];

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Caisse_Espece.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (confirm('Are you sure you want to delete this record?')) {
      try {
        await deleteDoc(doc(db, 'cashTransactions', id));
      } catch (err) {
        console.error('Error deleting record:', err);
        alert('Failed to delete record.');
      }
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/finance/cash/${id}`);
  };

  // 6. Define Table Columns
  const columns = useMemo(() => {
    const baseCols: any[] = [];
    
    if (activeTab === 'OUT') {
      baseCols.push(
        { 
          header: 'Payed To', 
          accessorKey: 'payedTo',
          render: (row: any) => row.payedTo || row.paidTo || row.payed_to || '—'
        },
        { 
          header: 'Expense Type', 
          accessorKey: 'expenseType',
          render: (row: any) => row.expenseType || row.typeOfExpense || '—'
        },
        { 
          header: 'Amount', 
          accessorKey: 'amount',
          render: (row: any) => <span className="font-black text-[#2e1d52]">{Number(row.amount).toLocaleString()} {row.currency || 'MAD'}</span>
        },
        { header: 'Date', accessorKey: 'date' },
        { header: 'Note', accessorKey: 'note' },
        { header: 'Created By', accessorKey: 'createdBy' },
        { header: 'Updated By', accessorKey: 'updatedBy' }
      );
    } else {
      baseCols.push(
        { 
          header: 'Paid BY', 
          accessorKey: 'paidBy',
          render: (row: any) => row.paidBy || row.paid_by || '—'
        },
        { header: 'Operation Type', accessorKey: 'operationType' },
        { 
          header: 'Payment Type', 
          accessorKey: 'paymentType',
          render: (row: any) => row.paymentType || 'Espece'
        },
        { 
          header: 'Amount', 
          accessorKey: 'amount',
          render: (row: any) => <span className="font-black text-[#2e1d52]">{Number(row.amount).toLocaleString()} {row.currency || 'MAD'}</span>
        },
        { header: 'Date', accessorKey: 'date' },
        { header: 'Note', accessorKey: 'note' },
        { header: 'Created By', accessorKey: 'createdBy' },
        { header: 'Updated By', accessorKey: 'updatedBy' }
      );
    }

    if (canUpdate || canDelete) {
      baseCols.push({
        header: '',
        accessorKey: 'actions',
        align: 'right',
        render: (row: any) => (
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                  <MoreHorizontal className="h-4 w-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 rounded-xl shadow-lg border-slate-100">
                {canUpdate && (
                  <DropdownMenuItem onClick={() => handleEdit(row.id)} className="gap-2 cursor-pointer text-sm font-semibold text-slate-600">
                    <Edit className="h-4 w-4" /> Edit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem onClick={() => handleDelete(row.id)} className="gap-2 cursor-pointer text-sm font-semibold text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      });
    }

    return baseCols;
  }, [activeTab, canUpdate, canDelete]);

  const breadcrumbItems = [
    { label: 'Profile', href: '/finance/cash' },
    { label: 'Caisse Espece', active: true }
  ];

  return (
    <div className={`p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 overflow-auto bg-white' : ''}`}>
      {/* Top Page Header */}
      <ERPPageHeader
        title="Caisse Espece"
        subtitle="Manage cash operations, expenses, and track petty cash."
        breadcrumbItems={breadcrumbItems}
        actions={
          <div className="flex items-center gap-3">
            {canAdd && (
              <Button 
                className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-4 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                onClick={() => router.push('/finance/cash/add')}
              >
                <Plus size={20} className="stroke-[2.5]" />
                <span className="font-bold tracking-wide">Add Caisse Espece</span>
              </Button>
            )}
            <ERPExportButtons 
              onExportExcel={handleExportExcelCustom}
              excelFileName="Caisse-Espece"
              hidePDF={true}
            />
          </div>
        }
      />

      {/* Top Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1600px] mx-auto">
        <ERPStatisticCard
          title="TOTAL IN"
          value={`${totalIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<ArrowDownCircle className="text-[#7a9800]" size={18} />}
          description="Sum of all IN operations"
        />
        <ERPStatisticCard
          title="TOTAL OUT"
          value={`${totalOut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<ArrowUpCircle className="text-rose-500" size={18} />}
          description="Sum of all OUT operations"
        />
        <ERPStatisticCard
          title="AVAILABLE"
          value={`${(totalIn - totalOut).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<Wallet className="text-[#2e1d52]" size={18} />}
          description="Current cash balance"
        />
        <ERPStatisticCard
          title="Total Vente déchets"
          value={`${totalVenteDechets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<CheckCircle2 className="text-amber-500" size={18} />}
          description="Cash from waste sales"
        />
      </div>

      {/* Main Container */}
      <div className="max-w-[1600px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 pt-6 border-b border-slate-100 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('OUT')}
            className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'OUT'
                ? 'border-[#7a9800] text-[#7a9800]'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
            }`}
          >
            OUT Operations
          </button>
          <button
            onClick={() => setActiveTab('IN')}
            className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'IN'
                ? 'border-[#7a9800] text-[#7a9800]'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
            }`}
          >
            IN Operations
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
