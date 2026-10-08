'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  collection, 
  query, 
  where,
  doc, 
  deleteDoc, 
  getDocs,
  writeBatch,
  updateDoc
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
  useUser
} from '@/firebase';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import { generateNextInvoiceNumber } from '@/lib/invoice-generator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Loader2, 
  Eye, 
  Edit, 
  FileText, 
  Download, 
  Trash2,
  Receipt,
  MoreHorizontal,
  RefreshCw,
  Search,
  Filter,
  Columns,
  ListFilter,
  Maximize,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import * as XLSX from 'xlsx';

import { useSeason } from '@/contexts/SeasonContext';

const usePrintOnQuery = () => {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('print') === 'true') {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);
};

interface PackingList {
  id: string;
  packingListNumber: string;
  poNumber: string;
  customer: string;
  productionType: string;
  expeditionDate?: string;
  dateOfLoading?: string;
  transportCompany?: string;
  transportCompanyId?: string;
  truckNumber?: string;
  sealNumber?: string;
  totalNetWeight?: number;
  totalGrossWeight?: number;
  totalBoxes?: number;
  status: string;
  orderId?: string;
  items?: any[];
  contents?: any[];
  invoiceNumber?: string;
  invoiceGenerated?: boolean;
  season_id?: string;
  seasonId?: string;
}

export default function PackingListsIndexPage() {
  const router = useRouter();
  const db = useFirestore();
  const { canList, canAdd, canUpdate, canDelete } = usePermissions('supplyChain.packingLists');
  const { user } = useUser();
  const { toast } = useToast();
  const { currentSeason } = useSeason();
  usePrintOnQuery();

  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  const seasonId = currentSeason?.id || (typeof window !== 'undefined' ? localStorage.getItem('season_id') : null);

  const packingListsQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (seasonId) {
      return query(
        collection(db, 'packingLists'),
        where('season_id', 'in', [seasonId, 'DEFAULT_SEASON'])
      );
    }
    return query(collection(db, 'packingLists'));
  }, [db, seasonId]);

  const { data: packingLists, isLoading } = useCollection<PackingList>(packingListsQuery);

  // Auto-generate invoice numbers for any existing packing list missing an invoice number
  const isRepairingRef = React.useRef(false);
  useEffect(() => {
    if (!db || !packingLists || packingLists.length === 0 || isRepairingRef.current) return;

    const missing = packingLists.filter(pl => !pl.invoiceNumber || pl.invoiceNumber === '—' || pl.invoiceNumber === '-');
    if (missing.length === 0) return;

    isRepairingRef.current = true;
    const autoGenerateMissingInvoices = async () => {
      for (const pl of missing) {
        try {
          const year = new Date(pl.expeditionDate || pl.dateOfLoading || Date.now()).getFullYear() || new Date().getFullYear();
          const invNum = await generateNextInvoiceNumber(db, {
            invoiceType: 'Produce Invoice',
            source: 'sales_invoice',
            year
          });

          const batch = writeBatch(db);
          batch.update(doc(db, 'packingLists', pl.id), {
            invoiceGenerated: true,
            invoiceNumber: invNum
          });

          const invoiceRef = doc(collection(db, 'invoices'));
          batch.set(invoiceRef, {
            invoiceNumber: invNum,
            invoice_number: invNum,
            invoice_type: 'produce',
            invoice_type_display: 'Produce Invoice',
            currency: pl.currency || 'EUR',
            packingListId: pl.id,
            orderId: pl.orderId || null,
            po_order_id: pl.orderId || null,
            po_order_number: pl.poNumber || null,
            poNumber: pl.poNumber || null,
            customer_id: pl.customerId || null,
            customer_detail: {
              companyName: pl.customer || '—'
            },
            customer: pl.customer || '—',
            date: pl.expeditionDate || pl.dateOfLoading || new Date().toISOString().split('T')[0],
            season_id: pl.season_id || null,
            total_amount: pl.totalGrossWeight ? (pl.totalGrossWeight * 2) : 0,
            items: pl.items || pl.contents || [],
            sourceType: 'supply_chain_packing_list',
            createdAt: new Date().toISOString(),
            createdBy: 'system-auto'
          });

          await batch.commit();
        } catch (e) {
          console.error('Failed to auto-generate missing invoice number for PL:', pl.id, e);
        }
      }
      isRepairingRef.current = false;
    };

    autoGenerateMissingInvoices();
  }, [db, packingLists]);

  const filteredPackingLists = useMemo(() => {
    if (!packingLists) return [];
    let list = [...packingLists];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(pl => 
        pl.packingListNumber?.toLowerCase().includes(term) ||
        pl.poNumber?.toLowerCase().includes(term) ||
        pl.customer?.toLowerCase().includes(term) ||
        pl.transportCompany?.toLowerCase().includes(term) ||
        pl.truckNumber?.toLowerCase().includes(term) ||
        pl.sealNumber?.toLowerCase().includes(term)
      );
    }

    return list.sort((a: any, b: any) => {
      const getTime = (item: any) => {
        if (item.createdAt?.seconds) return item.createdAt.seconds * 1000;
        if (item.createdAt?.toDate) return item.createdAt.toDate().getTime();
        if (item.expeditionDate) {
          const t = new Date(item.expeditionDate).getTime();
          if (!isNaN(t)) return t;
        }
        if (item.dateOfLoading) {
          const t = new Date(item.dateOfLoading).getTime();
          if (!isNaN(t)) return t;
        }
        if (item.packingListNumber) {
          // Extract numeric digits e.g. SC28072026-0003 -> 280720260003
          const match = item.packingListNumber.match(/\d+/g);
          if (match) return Number(match.join('')) || 0;
        }
        return 0;
      };
      return getTime(b) - getTime(a);
    });
  }, [packingLists, searchTerm]);

  const totalPages = Math.ceil(filteredPackingLists.length / rowsPerPage);
  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredPackingLists.slice(start, start + rowsPerPage);
  }, [filteredPackingLists, page, rowsPerPage]);

  const handleDelete = async (pl: PackingList) => {
    if (!confirm(`Are you sure you want to delete packing list ${pl.packingListNumber}?`)) return;
    if (!db) return;
    try {
      // 1. Fetch other packing lists with same poNumber (or orderId)
      let remainingCount = 0;
      if (pl.poNumber) {
        const q = query(collection(db, 'packingLists'), where('poNumber', '==', pl.poNumber));
        const snap = await getDocs(q);
        remainingCount = snap.docs.filter(d => d.id !== pl.id).length;
      } else if (pl.orderId) {
        const q = query(collection(db, 'packingLists'), where('orderId', '==', pl.orderId));
        const snap = await getDocs(q);
        remainingCount = snap.docs.filter(d => d.id !== pl.id).length;
      }

      // 2. Resolve order reference
      let targetOrderRef = null;
      if (pl.orderId) {
        targetOrderRef = doc(db, 'orders', pl.orderId);
      } else {
        const poVal = pl.poNumber || '';
        if (poVal) {
          const q = query(collection(db, 'orders'), where('poNumber', '==', poVal));
          const snap = await getDocs(q);
          if (!snap.empty) {
            targetOrderRef = doc(db, 'orders', snap.docs[0].id);
          }
        }
      }

      // 3. Perform batch write
      const batch = writeBatch(db);
      batch.delete(doc(db, 'packingLists', pl.id));

      if (targetOrderRef) {
        if (remainingCount === 0) {
          batch.update(targetOrderRef, {
            packingListGenerated: false,
            status: 'Produced'
          });
        } else {
          batch.update(targetOrderRef, {
            packingListGenerated: true,
            status: 'Produced'
          });
        }
      }

      await batch.commit();

      if (remainingCount === 0) {
        toast({ 
          title: 'Deleted', 
          description: 'Packing List deleted and order status restored to Confirmed.' 
        });
      } else {
        toast({ 
          title: 'Deleted', 
          description: 'Packing List deleted. Order remains Produced because another packing list exists for this PO.' 
        });
      }
    } catch (err) {
      console.error('Error deleting packing list:', err);
      toast({ title: 'Error', description: 'Failed to delete.', variant: 'destructive' });
    }
  };

  const handleGenerateInvoice = async (pl: PackingList) => {
    if (!db) return;
    try {
      const year = new Date().getFullYear();
      const generatedInvoiceNumber = await generateNextInvoiceNumber(db, {
        invoiceType: 'Produce Invoice',
        source: 'sales_invoice',
        year
      });

      const batch = writeBatch(db);
      batch.update(doc(db, 'packingLists', pl.id), {
        invoiceGenerated: true,
        invoiceNumber: generatedInvoiceNumber
      });

      const invoiceRef = doc(collection(db, 'invoices'));
      batch.set(invoiceRef, {
        invoiceNumber: generatedInvoiceNumber,
        invoice_number: generatedInvoiceNumber,
        invoice_type: 'produce',
        invoice_type_display: 'Produce Invoice',
        packingListId: pl.id,
        orderId: pl.orderId || null,
        po_order_id: pl.orderId || null,
        po_order_number: pl.poNumber || null,
        poNumber: pl.poNumber || null,
        date: pl.expeditionDate || pl.dateOfLoading || new Date().toISOString().split('T')[0],
        season_id: pl.season_id || null,
        total_amount: pl.totalGrossWeight ? (pl.totalGrossWeight * 2) : 0,
        items: pl.items || pl.contents || [],
        sourceType: 'supply_chain_packing_list',
        createdAt: new Date().toISOString(),
        createdBy: profile?.email || 'system'
      });

      await batch.commit();
      toast({ title: 'Invoice Generated', description: `Generated invoice: ${generatedInvoiceNumber}` });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Could not generate invoice', variant: 'destructive' });
    }
  };

  const downloadExcel = (pl: PackingList) => {
    const list = pl.productionType === 'Internal Production' ? pl.contents : pl.items;
    let itemsData = list && list.length > 0 ? list.map(item => ({
      'Packing List Number': pl.packingListNumber,
      'Order PO Number': pl.poNumber,
      'Production Type': pl.productionType,
      'Expedition Date': pl.expeditionDate,
      'Date of Loading': pl.dateOfLoading,
      'Truck Number': pl.truckNumber,
      'Transport Company': pl.transportCompany,
      'Seal Number': pl.sealNumber,
      'Lot Number': item.lotNumber,
      'Product': item.productName || item.product,
      'Caliber': item.caliber || item.calibre,
      'Boxes': item.numberOfBoxes || item.boxes,
      'Net Weight': item.netWeight || item.quantity,
      'Gross Weight': item.grossWeight,
    })) : [{
      'Packing List Number': pl.packingListNumber,
      'Order PO Number': pl.poNumber,
      'Production Type': pl.productionType,
      'Expedition Date': pl.expeditionDate,
      'Date of Loading': pl.dateOfLoading,
      'Truck Number': pl.truckNumber,
      'Transport Company': pl.transportCompany,
      'Seal Number': pl.sealNumber,
      'Lot Number': '—',
      'Product': '—',
      'Caliber': '—',
      'Boxes': pl.totalBoxes,
      'Net Weight': pl.totalNetWeight,
      'Gross Weight': pl.totalGrossWeight,
    }];

    const worksheet = XLSX.utils.json_to_sheet(itemsData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Packing List');
    XLSX.writeFile(workbook, `${pl.packingListNumber}.xlsx`);
    toast({ title: 'Excel Exported', description: `Exported ${pl.packingListNumber}` });
  };

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-[#7a9800]" />
      </div>
    );
  }

  if (!canList && !isLoading) {
    return <div className="p-8 text-center text-slate-500 font-bold">You do not have permission to view this module.</div>;
  }

  return (
    <div className="p-4 sm:p-6 bg-[#fafafa] min-h-screen font-sans animate-in fade-in duration-700">
      
      {/* Header Area */}
      <div className="flex justify-between items-start mb-6 max-w-[1600px] mx-auto">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#333]">Packing List</h1>
          <div className="text-[13px] text-gray-500 font-medium">Profile / Packing List</div>
        </div>
        {canAdd && (
          <Button 
            onClick={() => router.push('/supply-chain/packing-lists/add')}
            className="h-9 w-9 p-0 bg-[#74921E] hover:bg-[#627a18] rounded text-white shadow"
          >
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Table Card */}
      <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden max-w-[1600px] mx-auto">
        
        {/* Toolbar */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Button 
              variant="ghost" 
              size="icon" 
              title="Refresh Data"
              className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full" 
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {showSearch && (
              <div className="relative max-w-xs w-full animate-in fade-in duration-200">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input 
                  type="text"
                  placeholder="Search packing lists..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8 h-8 text-xs rounded border-gray-200 focus-visible:ring-1 focus-visible:ring-[#7a9800]"
                  autoFocus
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <Button 
              variant={showSearch ? "secondary" : "ghost"} 
              size="icon" 
              title="Search"
              className="h-8 w-8 hover:text-gray-700 hover:bg-gray-100 rounded-full"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              title="Filter"
              className="h-8 w-8 hover:text-gray-700 hover:bg-gray-100 rounded-full"
              onClick={() => setShowSearch(true)}
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              title="Toggle Fullscreen"
              className="h-8 w-8 hover:text-gray-700 hover:bg-gray-100 rounded-full"
              onClick={() => setIsFullscreen(!isFullscreen)}
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Table Wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600">
                <th className="py-4 px-4 font-semibold w-16 text-center">Actions</th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-2">Packing List Number <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div>
                </th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-2">Expedition Date <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div>
                </th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-2">Order <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div>
                </th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-2">Invoice Number <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div>
                </th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-2">Production Type <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div>
                </th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-2">Truck Number <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div>
                </th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-2">Seal Number <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div>
                </th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-2">Transport Company <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div>
                </th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-2">Date Of Loading <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {paginatedData.map((row, i) => {
                const plNum = row.packingListNumber || '—';
                return (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="py-3 px-4 text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-gray-400 hover:text-gray-700 focus-visible:ring-0 focus-visible:ring-offset-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 rounded-xl p-2 font-bold text-xs shadow-xl border-primary/5">
                          <DropdownMenuItem onClick={() => router.push(`/supply-chain/packing-lists/${row.id}`)} className="cursor-pointer py-2 px-3 rounded-lg hover:bg-slate-50">
                            <Eye className="mr-2 h-4 w-4 text-[#7a9800]" /> View
                          </DropdownMenuItem>
                          {canUpdate && (
                            <DropdownMenuItem onClick={() => router.push(`/supply-chain/packing-lists/${row.id}/edit`)} className="cursor-pointer py-2 px-3 rounded-lg hover:bg-slate-50">
                              <Edit className="mr-2 h-4 w-4 text-amber-500" /> Edit
                            </DropdownMenuItem>
                          )}
                          {canUpdate && !row.invoiceGenerated && (
                            <DropdownMenuItem onClick={() => handleGenerateInvoice(row)} className="cursor-pointer py-2 px-3 rounded-lg hover:bg-slate-50 text-[#7a9800]">
                              <Receipt className="mr-2 h-4 w-4" /> Generate Invoice
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => downloadExcel(row)} className="cursor-pointer py-2 px-3 rounded-lg hover:bg-slate-50 text-emerald-600">
                            <FileText className="mr-2 h-4 w-4" /> Download Excel
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast({ title: 'PDF Export', description: 'PDF Export logic running' })} className="cursor-pointer py-2 px-3 rounded-lg hover:bg-slate-50 text-purple-600">
                            <Download className="mr-2 h-4 w-4" /> Download PDF
                          </DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem onClick={() => handleDelete(row)} className="cursor-pointer py-2 px-3 rounded-lg hover:bg-rose-50 text-rose-600">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td 
                      className="py-3 px-4 font-semibold text-[#9FBC30] cursor-pointer hover:underline"
                      onClick={() => router.push(`/supply-chain/packing-lists/${row.id}`)}
                    >
                      {plNum}
                    </td>
                    <td className="py-3 px-4">{row.expeditionDate || '—'}</td>
                    <td className="py-3 px-4 text-gray-600 font-medium">{row.poNumber || '—'}</td>
                    <td className="py-3 px-4">
                      {row.invoiceGenerated ? row.invoiceNumber : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-500">{row.productionType}</td>
                    <td className="py-3 px-4 text-gray-500">{row.truckNumber || '—'}</td>
                    <td className="py-3 px-4 text-gray-500">{row.sealNumber || '-'}</td>
                    <td className="py-3 px-4 text-gray-500">{row.transportCompany || '—'}</td>
                    <td className="py-3 px-4 text-gray-500">{row.dateOfLoading || '—'}</td>
                  </tr>
                );
              })}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-gray-400">
                    No packing lists found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex justify-end items-center px-4 py-3 border-t border-gray-100 text-sm text-gray-600 gap-6">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select 
              className="bg-transparent border-none focus:ring-0 cursor-pointer text-gray-700 outline-none"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
          
          <div className="flex items-center gap-4">
            <span>{((page - 1) * rowsPerPage) + 1}-{Math.min(page * rowsPerPage, filteredPackingLists.length)} of {filteredPackingLists.length}</span>
            <div className="flex items-center gap-1 text-gray-400">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:text-gray-700 hover:bg-gray-100"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:text-gray-700 hover:bg-gray-100"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:text-gray-700 hover:bg-gray-100"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:text-gray-700 hover:bg-gray-100"
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages || totalPages === 0}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
