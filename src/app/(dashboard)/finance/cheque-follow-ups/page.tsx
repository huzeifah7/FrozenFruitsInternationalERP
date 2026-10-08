'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, doc, deleteDoc, updateDoc } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useSeason } from '@/contexts/SeasonContext';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { ERPStatisticCard } from '@/components/erp/ERPStatisticCard';
import { ERPTable } from '@/components/erp/ERPTable';
import { ERPToolbar } from '@/components/erp/ERPToolbar';
import { Loader2, Plus, Download, Edit, Trash2, Calendar, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/components/auth-provider';
import { canList, canAdd, canUpdate, canDelete } from '@/lib/permissions';
import Swal from 'sweetalert2';
import { useToast } from '@/hooks/use-toast';

export default function ChequeFollowUpsPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState<'compact' | 'normal' | 'tall'>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'BMCE' | 'CREDIT_AGRICOLE'>('BMCE');

  const { profile } = useAuthContext();
  const hasListAccess = canList(profile, 'finance.chequeFollowUp');
  const hasAddAccess = canAdd(profile, 'finance.chequeFollowUp');
  const hasUpdateAccess = canUpdate(profile, 'finance.chequeFollowUp');
  const hasDeleteAccess = canDelete(profile, 'finance.chequeFollowUp');

  const db = useFirestore();
  const { currentSeason } = useSeason();

  const q = useMemoFirebase(() => {
    if (!db || !hasListAccess) return null;
    return query(collection(db, 'cheque_follow_ups'));
  }, [db, hasListAccess]);

  const { data: allCheques, isLoading } = useCollection(q);

  const [overview, setOverview] = useState({ total: 0, completed: 0, not_completed: 0 });

  const activeData = useMemo(() => {
    const list = allCheques || [];
    
    // Calculate overview
    let t = 0, c = 0, nc = 0;
    list.forEach(r => {
      const amt = Number(r.amount) || 0;
      t += amt;
      if (r.cheque_status === 1) c += amt;
      else nc += amt;
    });
    setOverview({ total: t, completed: c, not_completed: nc });

    if (activeTab === 'BMCE') {
      return list.filter(r => r.bank_name === 1);
    } else {
      return list.filter(r => r.bank_name === 2);
    }
  }, [allCheques, activeTab]);

  const handleDelete = async (id: string) => {
    if (!hasDeleteAccess || !db) return;
    
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'Do you really want to delete this record?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'DELETE',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
    });

    if (result.isConfirmed) {
      try {
        const docRef = doc(db, 'cheque_follow_ups', id);
        await deleteDoc(docRef);
        Swal.fire('Deleted!', 'Your Record has been deleted.', 'success');
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Failed to delete record.', 'error');
      }
    }
  };

  const handleChangeStatus = async (id: string, statusId: number) => {
    if (!hasUpdateAccess || !db) return;
    
    const result = await Swal.fire({
      title: 'Do you want change Status?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'CONFIRM',
      confirmButtonColor: 'green',
      cancelButtonColor: '#d33',
    });

    if (result.isConfirmed) {
      try {
        const docRef = doc(db, 'cheque_follow_ups', id);
        await updateDoc(docRef, { 
          cheque_status: statusId, 
          cheque_collection_date: statusId === 1 ? new Date().toISOString().split('T')[0] : '' 
        });
        Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: 'Cheque Status has been changed Successfully.' });
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Failed to change status.', 'error');
      }
    }
  };

  const handleUpdateDate = async (id: string, currentDate: string) => {
    if (!hasUpdateAccess || !db) return;

    const { value: formValues } = await Swal.fire({
      title: 'Cheque Collection Date',
      html: `<input type="date" id="swal-input-date" class="swal2-input" value="${currentDate || ''}">`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Update',
      preConfirm: () => {
        return (document.getElementById('swal-input-date') as HTMLInputElement).value;
      }
    });

    if (formValues) {
      try {
        const docRef = doc(db, 'cheque_follow_ups', id);
        await updateDoc(docRef, { cheque_collection_date: formValues });
        Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: 'Date Updated Successfully.' });
      } catch (err) {
        console.error(err);
        Swal.fire('Error', 'Failed to update date.', 'error');
      }
    }
  };

  const handleExcelExport = async () => {
    if (activeData.length === 0) {
      toast({ title: 'No Data', description: 'No records to export.', variant: 'destructive' });
      return;
    }

    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const allChequesList = allCheques || [];
    const bmceData = allChequesList.filter(r => r.bank_name === 1);
    const creditAgricoleData = allChequesList.filter(r => r.bank_name === 2);

    const borderAll = {
      top: { style: 'thin' as any }, left: { style: 'thin' as any },
      bottom: { style: 'thin' as any }, right: { style: 'thin' as any }
    };
    const headerFont = { bold: true, size: 9 };
    const rowFont = { size: 9 };

    const sheets = [
      { name: 'BMCE EO', data: bmceData },
      { name: 'Credit Agricole EO', data: creditAgricoleData }
    ];

    let logoBase64 = '';
    try {
      const { getBase64ImageFromUrl } = await import('@/lib/utils');
      logoBase64 = await getBase64ImageFromUrl('/FFI_main.png');
    } catch (e) {
      console.warn("Could not load logo", e);
    }

    for (const sheet of sheets) {
      const ws = wb.addWorksheet(sheet.name);

      if (logoBase64) {
        const imageId = wb.addImage({ base64: logoBase64, extension: 'png' });
        ws.addImage(imageId, {
          tl: { col: 0, row: 0 },
          ext: { width: 120, height: 60 }
        });
      }

      ws.mergeCells('A2:H2');
      const titleCell = ws.getCell('A2');
      titleCell.value = 'Cheque Follow Up';
      titleCell.font = { size: 16, bold: true };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      let rowIdx = 5;

      const headers = [
        "Bank", "Cheque Designation", "Amount", "Date", "Cheque Number", 
        "Expense Type", "Cheque Status", "Cheque Collection Date"
      ];

      headers.forEach((h, i) => {
        const cell = ws.getCell(rowIdx, i + 1);
        cell.value = h;
        cell.font = headerFont;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
        cell.border = borderAll;
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      rowIdx++;

      sheet.data.forEach((r: any, idx: number) => {
        const isAlt = idx % 2 === 0;

        const bank = r.bank_name === 1 ? 'BMCE EO' : r.bank_name === 2 ? 'Credit Agricole EO' : '-';
        const expenseType = r.expense_type === 1 ? 'Frais Divers' : r.expense_type === 2 ? 'Don' : r.expense_type === 3 ? 'Matiere premiere' : '-';
        const status = r.cheque_status === 1 ? 'Collected' : 'Not Collected';
        
        const values = [
          bank,
          r.cheque_designation || '',
          Number(r.amount || 0),
          r.date || '',
          r.cheque_number || '',
          expenseType,
          status,
          r.cheque_collection_date || ''
        ];

        values.forEach((val, i) => {
          const cell = ws.getCell(rowIdx, i + 1);
          cell.value = val;
          cell.font = rowFont;
          
          if (!isAlt) {
             cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6E9' } };
          }
          cell.border = borderAll;
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        });
        rowIdx++;
      });

      ws.columns = [
        { width: 20 }, { width: 30 }, { width: 15 }, { width: 15 }, 
        { width: 20 }, { width: 20 }, { width: 15 }, { width: 25 }
      ];
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cheque_FollowUp.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredData = useMemo(() => {
    if (!searchTerm) return activeData;
    const lower = searchTerm.toLowerCase();
    return activeData.filter((r: any) => 
      (r.cheque_designation || '').toLowerCase().includes(lower) ||
      (r.cheque_number || '').toLowerCase().includes(lower)
    );
  }, [activeData, searchTerm]);

  const columns = useMemo(() => {
    const baseCols: any[] = [
      {
        header: 'Actions',
        accessorKey: 'actions',
        render: (row: any) => {
          if (!hasUpdateAccess && !hasDeleteAccess) return <span>-</span>;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100">
                  <MoreHorizontal className="h-4 w-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-40 rounded-xl shadow-lg border-slate-100">
                {hasUpdateAccess && (
                  <DropdownMenuItem onClick={() => router.push(`/finance/cheque-follow-ups/${row.id}/edit`)} className="gap-2 cursor-pointer text-sm font-semibold text-slate-600">
                    <Edit className="h-4 w-4" /> Edit
                  </DropdownMenuItem>
                )}
                {hasDeleteAccess && (
                  <DropdownMenuItem onClick={() => handleDelete(row.id)} className="gap-2 cursor-pointer text-sm font-semibold text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
      },
      { 
        header: 'Bank Name', 
        accessorKey: 'bank_name',
        render: (row: any) => row.bank_name === 1 ? 'BMCE EO' : row.bank_name === 2 ? 'Credit Agricole EO' : '-'
      },
      { 
        header: 'Cheque Designation', 
        accessorKey: 'cheque_designation',
        render: (row: any) => row.cheque_designation || '-'
      },
      { 
        header: 'Amount', 
        accessorKey: 'amount',
        render: (row: any) => <span className="font-black text-[#2e1d52]">{Number(row.amount || 0).toFixed(2)} MAD</span>
      },
      { 
        header: 'Date', 
        accessorKey: 'date',
        render: (row: any) => row.date || '-'
      },
      { 
        header: 'Cheque Number', 
        accessorKey: 'cheque_number',
        render: (row: any) => row.cheque_number || '-'
      },
      { 
        header: 'Expense Type', 
        accessorKey: 'expense_type',
        render: (row: any) => row.expense_type === 1 ? 'Frais Divers' : row.expense_type === 2 ? 'Don' : row.expense_type === 3 ? 'Matiere premiere' : '-'
      },
      { 
        header: 'Cheque Status', 
        accessorKey: 'cheque_status',
        render: (row: any) => {
          const status = row.cheque_status;
          const isCollected = status === 1;
          const statusText = isCollected ? 'Collected' : 'Not Collected';
          const btnClass = `px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-colors text-white ${isCollected ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`;
          
          if (!hasUpdateAccess) {
            return <span className={btnClass}>{statusText}</span>;
          }

          return (
            <DropdownMenu>
              <DropdownMenuTrigger className={`cursor-pointer outline-none ${btnClass}`}>
                {statusText}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="min-w-[120px] rounded-xl shadow-lg border-slate-100">
                <DropdownMenuItem 
                  onClick={() => handleChangeStatus(row.id, 1)}
                  className="text-xs font-bold cursor-pointer hover:bg-slate-50"
                >
                  Collected
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleChangeStatus(row.id, 0)}
                  className="text-xs font-bold cursor-pointer hover:bg-slate-50"
                >
                  Not Collected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
      },
      { 
        header: 'Cheque Collection Date', 
        accessorKey: 'cheque_collection_date',
        render: (row: any) => {
          const dateText = row.cheque_collection_date || 'Update Date';
          if (!hasUpdateAccess) {
            return <span>{row.cheque_collection_date || 'N/A'}</span>;
          }
          return (
            <button 
              onClick={() => handleUpdateDate(row.id, row.cheque_collection_date || '')}
              className="px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors flex items-center gap-1"
            >
              <Calendar className="h-3 w-3" />
              {dateText}
            </button>
          );
        }
      },
      { 
        header: 'Created By', 
        accessorKey: 'createdBy',
        render: (row: any) => {
          if (row.createdby?.first_name || row.createdby?.last_name) return `${row.createdby.first_name || ''} ${row.createdby.last_name || ''}`.trim();
          return row.createdBy || row.createdByName || '-';
        }
      },
      { 
        header: 'Updated By', 
        accessorKey: 'updatedBy',
        render: (row: any) => {
          if (row.updatedby?.first_name || row.updatedby?.last_name) return `${row.updatedby.first_name || ''} ${row.updatedby.last_name || ''}`.trim();
          return row.updatedBy || row.updatedByName || '-';
        }
      }
    ];

    return baseCols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUpdateAccess, hasDeleteAccess]);

  if (!hasListAccess) {
    return <div className="p-8 text-center text-rose-500 font-bold">Unauthorized. You do not have permission to access this page.</div>;
  }

  const formatAmount = (value: any) => Number(value || 0).toFixed(2) + " MAD";

  return (
    <div className={`p-4 sm:p-6 md:p-8 bg-[#f3f3f3] min-h-screen space-y-6 ${isFullscreen ? 'fixed inset-0 z-50 overflow-auto bg-white' : ''}`}>
      <ERPPageHeader
        title="Cheque FollowUp"
        subtitle="Manage and track your cheques, statuses, and collections."
        breadcrumbItems={[
          { label: 'Profile', href: '/finance/cheque-follow-ups' },
          { label: 'Cheque FollowUp', active: true }
        ]}
        actions={
          <div className="flex items-center gap-3">
            {hasAddAccess && (
              <Button 
                className="h-12 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl px-4 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                onClick={() => router.push('/finance/cheque-follow-ups/add')}
              >
                <Plus size={20} className="stroke-[2.5]" />
                <span className="font-bold tracking-wide">Add</span>
              </Button>
            )}
            <Button 
              onClick={handleExcelExport}
              className="h-12 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm rounded-xl px-4 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
            >
              <Download size={20} />
              <span className="font-bold tracking-wide">Excel</span>
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1600px] mx-auto">
        <ERPStatisticCard
          title="Total"
          value={formatAmount(overview.total)}
          description="Total Amount"
        />
        <ERPStatisticCard
          title="Total collected"
          value={formatAmount(overview.completed)}
          description="Collected Amount"
        />
        <ERPStatisticCard
          title="Total Not collected"
          value={formatAmount(overview.not_completed)}
          description="Not Collected Amount"
        />
      </div>

      <div className="max-w-[1600px] mx-auto bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 pt-6 border-b border-slate-100 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('BMCE')}
            className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'BMCE'
                ? 'border-[#7a9800] text-[#7a9800]'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
            }`}
          >
            BMCE EO
          </button>
          <button
            onClick={() => setActiveTab('CREDIT_AGRICOLE')}
            className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 ${
              activeTab === 'CREDIT_AGRICOLE'
                ? 'border-[#7a9800] text-[#7a9800]'
                : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200'
            }`}
          >
            Credit Agricole EO
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
            data={Array.isArray(filteredData) ? filteredData : []}
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
