'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Package, MapPin, Inbox, User, Download
} from 'lucide-react';
import { format } from 'date-fns';
import { isChappes } from '@/lib/stock-situation-utils';
import { useToast } from '@/hooks/use-toast';
import { useSeason } from '@/contexts/SeasonContext';
import * as XLSX from 'xlsx';

interface PaginationProps {
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  rowsPerPage: number;
  setRowsPerPage: React.Dispatch<React.SetStateAction<number>>;
  totalItems: number;
}

const TablePagination: React.FC<PaginationProps> = ({
  page,
  setPage,
  rowsPerPage,
  setRowsPerPage,
  totalItems,
}) => {
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  
  return (
    <div className="flex justify-end items-center px-6 py-3 border-t border-slate-100 text-xs text-slate-600 gap-6 bg-slate-50/50">
      <div className="flex items-center gap-2">
        <span className="font-bold">Rows per page</span>
        <select 
          className="bg-transparent border-none focus:ring-0 cursor-pointer text-gray-700 outline-none font-bold"
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
        <span className="font-bold">
          {totalItems === 0 ? 0 : ((page - 1) * rowsPerPage) + 1}-{Math.min(page * rowsPerPage, totalItems)} of {totalItems}
        </span>
        <div className="flex items-center gap-1 text-slate-400">
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
  );
};

export default function SupplierDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const { toast } = useToast();

  const [supplierId, locationId] = useMemo(() => {
    return decodeURIComponent(id || '').split('__');
  }, [id]);

  const [supplierName, setSupplierName] = useState('General');
  
  const { currentSeason } = useSeason();
  const [resolvedSeasonId, setResolvedSeasonId] = useState<string | null>(
    currentSeason?.id || (typeof window !== 'undefined' ? localStorage.getItem('season_id') : null)
  );

  useEffect(() => {
    if (resolvedSeasonId || !db) return;
    const fetchSeason = async () => {
      try {
        const q = query(collection(db, 'seasons'), where('status', '==', 'Active'));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setResolvedSeasonId(snap.docs[0].id);
        } else {
          setResolvedSeasonId('DEFAULT_SEASON');
        }
      } catch (err) {
        setResolvedSeasonId('DEFAULT_SEASON');
      }
    };
    fetchSeason();
  }, [db, resolvedSeasonId]);

  const seasonId = resolvedSeasonId;

  const [locationName, setLocationName] = useState('Unknown Location');
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // Pagination states
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Fetch Supplier & Location Info
  useEffect(() => {
    async function fetchMetadata() {
      if (!db || !supplierId || !locationId) return;
      try {
        if (supplierId !== 'General') {
          const sSnap = await getDoc(doc(db, 'suppliers', supplierId));
          if (sSnap.exists()) {
            setSupplierName(sSnap.data().name || supplierId);
          }
        } else {
          setSupplierName('General');
        }

        const linesSnap = await getDocs(collection(db, 'processing_lines'));
        const lineDoc = linesSnap.docs.find(d => d.id === locationId);
        if (lineDoc) {
          setLocationName(lineDoc.data().title || lineDoc.id);
        } else {
          const locsSnap = await getDocs(collection(db, 'locations'));
          const locDoc = locsSnap.docs.find(d => d.id === locationId);
          if (locDoc) {
            setLocationName(locDoc.data().name || locDoc.data().title || locationId);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMetadata(false);
      }
    }
    fetchMetadata();
  }, [db, supplierId, locationId]);

  // Query manual entries for this location
  const manualQuery = useMemoFirebase(() => {
    if (!db || !locationId || !seasonId) return null;
    return query(collection(db, 'stock_situations'), where('locationId', '==', locationId), where('seasonId', '==', seasonId), orderBy('date', 'desc'));
  }, [db, locationId, seasonId]);
  const { data: manualStock, isLoading: loadingManual } = useCollection(manualQuery);

  // Process movements for the specified supplier
  const movements = useMemo(() => {
    if (!manualStock || !supplierId || !locationId) return [];
    const list: any[] = [];
    manualStock.forEach(docSnap => {
      const items = docSnap.items || [];
      items.forEach((item: any) => {
        const itemSupplierId = item.supplierId || 'General';
        if (itemSupplierId === supplierId) {
          const isChappe = isChappes(item.consumableName);
          const qty = isChappe ? Number(item.quantity || 0) / 2000 : Number(item.quantity || 0);
          
          let createdVal = '—';
          if (docSnap.createdAt) {
            createdVal = docSnap.createdAt.toDate 
              ? format(docSnap.createdAt.toDate(), 'yyyy-MM-dd HH:mm') 
              : format(new Date(docSnap.createdAt), 'yyyy-MM-dd HH:mm');
          }

          list.push({
            id: `${docSnap.id}_${item.consumableId}_${list.length}`,
            docId: docSnap.id,
            locationName: docSnap.locationName || locationName,
            date: docSnap.date,
            operation: item.operation,
            deliveryNoteNumber: item.deliveryNoteNumber || '—',
            supplierName: item.supplierName || 'General',
            consumableName: item.consumableName,
            quantity: qty,
            quantityUnit: isChappe ? 'Boxes' : 'Units',
            unitPrice: item.unitPrice || 0,
            totalAmount: item.totalAmount || (qty * (item.unitPrice || 0)),
            currency: item.currency || 'MAD',
            note: item.note || '—',
            fileUrl: item.fileUrl || '',
            created: createdVal,
          });
        }
      });
    });
    return list;
  }, [manualStock, supplierId, locationId, locationName]);

  // Stats Card Calculations
  const stats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    movements.forEach(m => {
      if (m.operation === 'IN') {
        totalIn += m.quantity;
      } else if (m.operation === 'OUT') {
        totalOut += m.quantity;
      }
    });
    const available = totalIn - totalOut;
    return { totalIn, totalOut, available };
  }, [movements]);

  // Pagination Slice
  const paginatedMovements = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return movements.slice(start, start + rowsPerPage);
  }, [movements, page, rowsPerPage]);

  // Excel Export Handler
  const handleExportExcel = () => {
    try {
      const sheetData = movements.map(m => ({
        Date: m.date || '—',
        'Delivery Note Number': m.deliveryNoteNumber || '—',
        Supplier: m.supplierName || '—',
        Operation: m.operation || '—',
        Quantity: m.quantity,
        Unit: m.quantityUnit,
        Consumable: m.consumableName || '—',
      }));

      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Situation');

      const sanitizedSupplier = supplierName.replace(/[^a-zA-Z0-9]/g, '_');
      const sanitizedLocation = locationName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${sanitizedSupplier}_${sanitizedLocation}_Stock.xlsx`;
      
      XLSX.writeFile(workbook, filename);

      toast({
        title: 'Export Success',
        description: `Stock movements exported as ${filename}`,
      });
    } catch (err) {
      console.error('Export failed:', err);
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'Failed to generate Excel file.',
      });
    }
  };

  if (loadingMetadata || loadingManual) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#7a9800] opacity-20" />
      </div>
    );
  }

  return (
    <div className="w-full p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 bg-[#F8F9FB] min-h-screen">
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/supply-chain/stock-situation')} className="rounded-full h-10 w-10 hover:bg-slate-200">
            <ChevronLeft size={20} className="text-slate-600" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
              <span>Profile</span><span className="opacity-40">/</span>
              <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/supply-chain/stock-situation')}>Stock Situation</span><span className="opacity-40">/</span>
              <span className="text-[#7a9800]">Supplier Detail</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-[#2e1d52] uppercase leading-none">
              Stock Situation Detail
            </h1>
          </div>
        </div>

        <Button 
          onClick={handleExportExcel}
          className="h-12 px-6 bg-[#7a9800] hover:bg-[#6c8500] text-white shadow-lg shadow-[#7a9800]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 gap-2"
        >
          <Download size={16} />
          <span className="uppercase tracking-widest text-[10px] font-black">Export Excel</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden border border-slate-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity IN</p>
              <h3 className="text-2xl font-black text-slate-700 mt-1">{stats.totalIn.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl"><Inbox className="size-6" /></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden border border-slate-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity OUT</p>
              <h3 className="text-2xl font-black text-slate-700 mt-1">{stats.totalOut.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Package className="size-6" /></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden border border-slate-100">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity Available</p>
              <h3 className="text-2xl font-black text-[#7a9800] mt-1">{stats.available.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Package className="size-6" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Subtitles: Supplier and Location */}
      <div className="flex flex-col sm:flex-row gap-4 sm:items-center px-4">
        <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
          <User className="size-3.5 text-[#7a9800]" />
          Supplier: <span className="font-black text-slate-700 ml-0.5 bg-slate-100 rounded-md px-2 py-0.5">{supplierName}</span>
        </div>
        <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
          <MapPin className="size-3.5 text-[#7a9800]" />
          Location: <span className="font-black text-slate-700 ml-0.5 bg-slate-100 rounded-md px-2 py-0.5">{locationName}</span>
        </div>
      </div>

      {/* Movements Table Card */}
      <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden border border-slate-100">
        <div className="overflow-x-auto">
          <Table className="min-w-[1200px]">
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-transparent border-b border-slate-100">
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 pl-8">Location</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Delivery Note Number</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Operation</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Validation</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Supplier</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Consumable</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right">Quantity</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right">Unit Price</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right">Total Amount</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Note</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Created</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-center pr-8">Delivery Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="h-48 text-center text-slate-400 font-medium italic">
                    No movements found for this supplier-location.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMovements.map((r) => (
                  <TableRow key={r.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                    <TableCell className="pl-8 py-4 font-bold text-slate-600">{r.locationName}</TableCell>
                    <TableCell className="font-bold text-slate-600">{r.date}</TableCell>
                    <TableCell className="font-bold text-slate-600">{r.deliveryNoteNumber}</TableCell>
                    <TableCell>
                      <Badge className={`text-[9px] font-black rounded-lg px-2 border ${r.operation === 'IN' ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                        {r.operation}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[9px] font-black uppercase tracking-wider rounded-lg px-2 py-0.5">
                        Validated
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-slate-500">{r.supplierName}</TableCell>
                    <TableCell className="font-black text-slate-700">{r.consumableName}</TableCell>
                    <TableCell className="text-right font-black text-slate-700">
                      {r.quantity.toLocaleString()} <span className="text-[9px] text-slate-400">{r.quantityUnit}</span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-slate-500">
                      {r.unitPrice ? `${Number(r.unitPrice).toFixed(2)} ${r.currency}` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-700">
                      {r.totalAmount ? `${Number(r.totalAmount).toFixed(2)} ${r.currency}` : '—'}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-slate-500 text-xs" title={r.note}>{r.note}</TableCell>
                    <TableCell className="font-bold text-slate-400 text-xs">{r.created}</TableCell>
                    <TableCell className="text-center pr-8">
                      {r.fileUrl ? (
                        <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg text-primary hover:bg-primary/5 text-xs font-bold gap-1.5">
                          <a href={r.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Download size={12} /> View File
                          </a>
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-xs">No File</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <TablePagination 
          page={page} 
          setPage={setPage} 
          rowsPerPage={rowsPerPage} 
          setRowsPerPage={setRowsPerPage} 
          totalItems={movements.length} 
        />
      </Card>
    </div>
  );
}
