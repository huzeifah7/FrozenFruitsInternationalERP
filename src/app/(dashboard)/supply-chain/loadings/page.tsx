'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  query, 
  doc, 
  deleteDoc, 
  writeBatch
} from '@/firebase/firestore-override';
import { 
  useFirestore, 
  useCollection, 
  useMemoFirebase,
  useUser
} from '@/firebase';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { 
  Plus, 
  Loader2, 
  Eye, 
  Edit, 
  Trash2,
  MoreHorizontal,
  RefreshCw,
  Search,
  ListFilter,
  Columns,
  Filter,
  Maximize,
  ArrowUpDown,
  MoreVertical,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  ChevronDown,
  Download,
  Truck,
  CheckCircle2,
  Clock,
  FileText,
  X,
  MapPin
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { exportLoadingsExcel } from '@/lib/export-loadings-excel';
import { format } from 'date-fns';

interface Loading {
  id: string;
  orderId: string;
  poNumber: string;
  dum: string;
  createdAt: any;
  factureTrans: string;
  invoice_number?: string;
  locationName: string;
  transitSupplierName: string;
  loadingStatus: string;
  numeroChauffeur: string;
  valueInMad: string;
  produit: string;
  sousDum: string;
  transportCost: string;
  createdByDisplayName: string;
  updatedByDisplayName: string;
}

// Season helper: Sept 1st of Y to Aug 31st of Y+1
function getSeason(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed, 8 is September
  if (month >= 8) {
    return `${year} to ${year + 1}`;
  } else {
    return `${year - 1} to ${year}`;
  }
}

export default function LoadingsIndexPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { canList, canAdd, canUpdate, canDelete } = usePermissions('supplyChain.loading');

  const [searchTerm, setSearchTerm] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // Filter States
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [activeSeasonFilter, setActiveSeasonFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const loadingsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'supply_chain_loadings'));
  }, [db]);

  const ordersQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'orders'));
  }, [db]);

  const { data: loadings, isLoading: loadingsLoading } = useCollection<Loading>(loadingsQuery);
  const { data: orders, isLoading: ordersLoading } = useCollection<any>(ordersQuery);

  const isLoading = loadingsLoading || ordersLoading;

  // Extract season options dynamically from loadings data
  const seasonOptions = React.useMemo(() => {
    const seasons = new Set<string>();
    seasons.add('2024 to 2025');
    seasons.add('2025 to 2026');
    seasons.add('2026 to 2027');
    
    loadings?.forEach(ld => {
      const dt = ld.createdAt?.toDate ? ld.createdAt.toDate() : (ld.createdAt ? new Date(ld.createdAt) : null);
      if (dt) {
        seasons.add(getSeason(dt));
      }
    });
    return Array.from(seasons).sort().reverse();
  }, [loadings]);

  const filteredLoadings = useMemo(() => {
    if (!loadings) return [];
    let list = loadings;

    // Apply Quick Status Filter Tab
    if (statusFilter !== 'ALL') {
      list = list.filter(ld => {
        const st = (ld.loadingStatus || 'Draft').toLowerCase();
        if (statusFilter === 'DRAFT') return st === 'draft';
        if (statusFilter === 'IN_TRANSIT') return st.includes('transit');
        if (statusFilter === 'DELIVERED') return st.includes('deliver');
        return true;
      });
    }

    // Apply Search Term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(ld => 
        ld.poNumber?.toLowerCase().includes(term) ||
        ld.locationName?.toLowerCase().includes(term) ||
        ld.transitSupplierName?.toLowerCase().includes(term) ||
        ld.loadingStatus?.toLowerCase().includes(term) ||
        ld.dum?.toLowerCase().includes(term) ||
        ld.numeroChauffeur?.toLowerCase().includes(term)
      );
    }

    // Apply Season Filter
    if (activeSeasonFilter) {
      list = list.filter(ld => {
        const dt = ld.createdAt?.toDate ? ld.createdAt.toDate() : (ld.createdAt ? new Date(ld.createdAt) : null);
        if (!dt) return false;
        return getSeason(dt) === activeSeasonFilter;
      });
    }

    return list;
  }, [loadings, searchTerm, activeSeasonFilter, statusFilter]);

  const totalPages = Math.ceil(filteredLoadings.length / rowsPerPage);
  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredLoadings.slice(start, start + rowsPerPage);
  }, [filteredLoadings, page, rowsPerPage]);

  const handleDelete = async (ld: Loading) => {
    if (!confirm(`Are you sure you want to delete loading for PO ${ld.poNumber}?`)) return;
    if (!db) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'supply_chain_loadings', ld.id));
      await batch.commit();
      toast({ title: 'Deleted', description: `Loading deleted successfully.` });
    } catch (err) {
      console.error('Error deleting loading:', err);
      toast({ title: 'Error', description: 'Failed to delete loading.', variant: 'destructive' });
    }
  };

  const handleStatusChange = async (ld: Loading, newStatus: string) => {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'supply_chain_loadings', ld.id), { loadingStatus: newStatus });
      await batch.commit();
      toast({ title: 'Status Updated', description: `Loading status changed to ${newStatus}` });
    } catch (err) {
      console.error('Error updating status:', err);
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    const s = (status || 'Draft').toLowerCase();
    if (s.includes('deliver')) {
      return 'bg-emerald-600 text-white';
    }
    if (s.includes('transit')) {
      return 'bg-blue-600 text-white';
    }
    return 'bg-red-600 text-white';
  };

  const handleFilter = () => {
    setActiveSeasonFilter(selectedSeason);
    setPage(1);
  };

  const handleClearFilter = () => {
    setSelectedSeason('');
    setActiveSeasonFilter('');
    setStatusFilter('ALL');
    setSearchTerm('');
    setPage(1);
  };

  const handleDownloadExcel = async () => {
    try {
      const dataToExport = filteredLoadings.map(row => {
        const order = orders?.find((o: any) => o.id === row.orderId);
        const createdAtDate = row.createdAt?.toDate ? row.createdAt.toDate() : (row.createdAt ? new Date(row.createdAt) : null);
        
        let quantity = '';
        if (order && Array.isArray(order.items)) {
          const total = order.items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || Number(item.numberOfBoxes) || 0), 0);
          quantity = total > 0 ? String(total) : (order.totalWeight ? String(order.totalWeight) : '');
        }

        const productsStr = order?.items?.map((it: any) => it.productName || it.product_name).filter(Boolean).join(', ') || row.produit || '';

        return {
          date: createdAtDate ? format(createdAtDate, 'yyyy-MM-dd') : '',
          poNumber: row.poNumber || '',
          invoiceNumber: row.invoice_number || '',
          etaDate: order?.etaDate || order?.eta_date || (order?.etaWeek ? `Wk ${order.etaWeek}` : ''),
          station: row.locationName || '',
          customer: order?.customerName || '',
          containerNumber: row.numeroChauffeur || '',
          quantity: quantity,
          valueInCurrency: order?.totalAmount || order?.amount || '',
          valueInMad: row.valueInMad || '',
          packaging: row.produit || '',
          exchangeRate: row.exchangeRate || '',
          sousDum: row.sousDum || '',
          dum: row.dum || '',
          montantTransport: row.transportCost || '',
          factureTrans: row.factureTrans || '',
          factureTransitaire: row.factureTransitaire || '',
          numExpeditionDhl: row.numExpeditionDhl || '',
          factureDhl: row.factureDhl || '',
          produit: productsStr,
          t1Phyto: row.t1AndPhyto || '',
          numeroChauffeur: row.numeroChauffeur || ''
        };
      });

      const seasonLabel = activeSeasonFilter || selectedSeason || 'All';
      await exportLoadingsExcel(dataToExport, seasonLabel);
      toast({ title: 'Export Success', description: 'Loadings report downloaded successfully.' });
    } catch (err) {
      console.error('Error exporting loadings excel:', err);
      toast({ title: 'Export Failed', description: 'Failed to download Excel file.', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-sm font-medium text-gray-500 animate-pulse">Loading Supply Chain Records...</p>
      </div>
    );
  }

  if (!canList && !isLoading) {
    return <div className="p-8 text-center text-slate-500 font-bold">You do not have permission to view this module.</div>;
  }

  return (
    <div className="p-4 sm:p-6 bg-[#fafafa] min-h-screen font-sans animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="mb-6 max-w-[1700px] mx-auto">
        <h1 className="text-2xl font-bold text-[#333]">Supply Chain Loading</h1>
        <div className="text-[13px] text-gray-500 font-medium">Profile / Supply Chain Loading</div>
      </div>

      {/* Filter and Control Bar */}
      <div className="bg-white rounded border border-gray-200 p-4 mb-6 max-w-[1700px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div className="flex flex-col gap-1.5 w-full md:w-auto">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Year:</label>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedSeason} onValueChange={setSelectedSeason}>
              <SelectTrigger className="w-[200px] h-9 bg-white border-gray-300 rounded focus:ring-0 focus:ring-offset-0 text-xs">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {seasonOptions.map(opt => (
                  <SelectItem key={opt} value={opt} className="text-xs">
                    {`Season ${opt}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              onClick={handleFilter}
              className="bg-[#729A1A] hover:bg-[#5D7E14] text-white px-4 h-9 rounded text-sm font-semibold shadow-sm"
            >
              Filter
            </Button>
            <Button 
              onClick={handleClearFilter}
              className="bg-[#729A1A] hover:bg-[#5D7E14] text-white w-9 h-9 p-0 rounded text-sm font-semibold shadow-sm flex items-center justify-center"
            >
              X
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <Button 
            onClick={handleDownloadExcel}
            className="bg-[#729A1A] hover:bg-[#5D7E14] text-white w-9 h-9 p-0 rounded shadow-sm flex items-center justify-center"
            title="Download Excel"
          >
            <Download className="h-4 w-4" />
          </Button>
          {canAdd && (
            <Button 
              onClick={() => router.push('/supply-chain/loadings/add')}
              className="bg-[#729A1A] hover:bg-[#5D7E14] text-white w-9 h-9 p-0 rounded shadow-sm flex items-center justify-center"
              title="Add Loading"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden max-w-[1700px] mx-auto">
        
        {/* Table Top Toolbar */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
          <div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-8 pr-3 h-8 w-[200px] border border-gray-200 rounded text-xs focus:outline-none focus:border-primary/50"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full">
              <ListFilter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full">
              <Columns className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full">
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Fluid Table Wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 bg-gray-50/50 font-semibold">
                <th className="py-4 px-4 font-semibold w-16 text-center">Actions</th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Lot Number <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Date <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">PO Order <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Invoice Number <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">ETA Date <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Location <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Customer <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Transit Supplier <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Loading Status <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Truck Number <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Weight <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Invoice Amount <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Packaging <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Sous Dum <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Transport Cost <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Created By <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
                <th className="py-4 px-4 font-semibold cursor-pointer hover:bg-gray-50"><div className="flex items-center gap-2">Updated By <ArrowUpDown className="h-3 w-3 text-gray-400" /><MoreVertical className="h-3 w-3 text-gray-300 ml-auto" /></div></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {paginatedData.map((row) => {
                const order = orders?.find((o: any) => o.id === row.orderId);
                const createdAtDate = row.createdAt?.toDate ? row.createdAt.toDate() : (row.createdAt ? new Date(row.createdAt) : null);
                
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
                          {canUpdate ? (
                            <DropdownMenuItem onClick={() => router.push(`/supply-chain/loadings/${row.id}/edit`)} className="cursor-pointer py-2 px-3 rounded-lg hover:bg-slate-50">
                              <Edit className="mr-2 h-4 w-4 text-amber-500" /> Edit / View
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => router.push(`/supply-chain/loadings/${row.id}`)} className="cursor-pointer py-2 px-3 rounded-lg hover:bg-slate-50">
                              <Eye className="mr-2 h-4 w-4 text-[#7a9800]" /> View
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem onClick={() => handleDelete(row)} className="cursor-pointer py-2 px-3 rounded-lg hover:bg-rose-50 text-rose-600">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td 
                      className="py-3 px-4 font-semibold text-[#729A1A] cursor-pointer hover:underline"
                      onClick={() => router.push(`/supply-chain/loadings/${row.id}`)}
                    >
                      {row.dum || '—'}
                    </td>
                    <td className="py-3 px-4">{createdAtDate ? createdAtDate.toLocaleDateString() : '—'}</td>
                    <td 
                      className="py-3 px-4 font-semibold text-[#729A1A] cursor-pointer hover:underline"
                      onClick={() => router.push(canUpdate ? `/supply-chain/loadings/${row.id}/edit` : `/supply-chain/loadings/${row.id}`)}
                    >
                      {row.poNumber || '—'}
                    </td>
                    <td className="py-3 px-4">{row.invoice_number || '—'}</td>
                    <td className="py-3 px-4">
                      {order?.etaDate || order?.eta_date || (order?.etaWeek ? `Wk ${order.etaWeek}` : '—')}
                    </td>
                    <td className="py-3 px-4">{row.locationName || '—'}</td>
                    <td className="py-3 px-4">{order?.customerName || '—'}</td>
                    <td className="py-3 px-4">{row.transitSupplierName || '—'}</td>
                    <td className="py-3 px-4">
                      {canUpdate ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger className={`px-3 py-1.5 rounded flex items-center justify-between min-w-[100px] text-xs font-bold ${getStatusBadgeStyle(row.loadingStatus)}`}>
                            {row.loadingStatus || 'Draft'}
                            <ChevronDown className="h-3 w-3 opacity-70 ml-2" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-32 p-0 overflow-hidden rounded-md border-gray-200 shadow-lg">
                            <DropdownMenuItem onClick={() => handleStatusChange(row, 'Draft')} className="cursor-pointer font-bold text-white bg-red-600 hover:bg-red-700 focus:bg-red-700 rounded-none justify-center py-2 text-xs">Draft</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(row, 'In Transit')} className="cursor-pointer font-bold text-white bg-blue-600 hover:bg-blue-700 focus:bg-blue-700 rounded-none justify-center py-2 text-xs">In Transit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(row, 'Delivered')} className="cursor-pointer font-bold text-white bg-green-600 hover:bg-green-700 focus:bg-green-700 rounded-none justify-center py-2 text-xs">Delivered</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <div className={`px-3 py-1.5 rounded flex items-center justify-center min-w-[100px] text-xs font-bold ${getStatusBadgeStyle(row.loadingStatus)}`}>
                          {row.loadingStatus || 'Draft'}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">{row.numeroChauffeur || '—'}</td>
                    <td className="py-3 px-4">{order?.totalWeight ? `${order.totalWeight} kg` : '—'}</td>
                    <td className="py-3 px-4">{row.valueInMad ? Number(row.valueInMad).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}</td>
                    <td className="py-3 px-4">{row.produit || '—'}</td>
                    <td className="py-3 px-4">{row.sousDum || '—'}</td>
                    <td className="py-3 px-4">{row.transportCost ? Number(row.transportCost).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}</td>
                    <td className="py-3 px-4">{row.createdByDisplayName || '—'}</td>
                    <td className="py-3 px-4">{row.updatedByDisplayName || '—'}</td>
                  </tr>
                );
              })}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={18} className="py-12 text-center text-gray-400">
                    No loadings found.
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
            <span>{((page - 1) * rowsPerPage) + 1}-{Math.min(page * rowsPerPage, filteredLoadings.length)} of {filteredLoadings.length}</span>
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

