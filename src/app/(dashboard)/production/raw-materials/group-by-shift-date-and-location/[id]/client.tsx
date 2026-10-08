'use client';

import React, { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  collection, query, where, getDocs, deleteDoc, doc
} from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2,
  MapPin, Scale, Search, MoreVertical, Edit, Trash2, Printer, FileText, ArrowLeft, Calendar, Building2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── Pagination Component ─────────────────────────────
interface PaginationProps {
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  rowsPerPage: number;
  setRowsPerPage: React.Dispatch<React.SetStateAction<number>>;
  totalItems: number;
}
const TablePagination: React.FC<PaginationProps> = ({ page, setPage, rowsPerPage, setRowsPerPage, totalItems }) => {
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  return (
    <div className="flex flex-col sm:flex-row justify-between sm:items-center px-6 py-4 border-t border-slate-100 text-xs text-slate-500 gap-4 bg-slate-50/50">
      <div className="flex items-center gap-2 font-bold">
        <span>Rows per page:</span>
        <select 
          className="bg-white border border-slate-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-primary/20 cursor-pointer text-slate-700 outline-none font-bold"
          value={rowsPerPage}
          onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-bold text-slate-600">
          {totalItems === 0 ? '0-0 of 0' : `${((page - 1) * rowsPerPage) + 1}-${Math.min(page * rowsPerPage, totalItems)} of ${totalItems}`}
        </span>
        <div className="flex items-center gap-1 text-slate-400">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setPage(1)} disabled={page === 1}><ChevronsLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setPage(totalPages)} disabled={page === totalPages || totalPages === 0}><ChevronsRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
};

export default function RawMaterialGroupByShiftDateAndLocationPage() {
  const router = useRouter();
  const params = useParams();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const rawParam = decodeURIComponent((params.id as string) || '');
  const [paramDate, paramLocation] = rawParam.includes('__') ? rawParam.split('__') : [rawParam, ''];

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Fetch processing lines & suppliers for name resolution
  const locationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'processing_lines');
  }, [db, user]);
  const suppliersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'suppliers');
  }, [db, user]);
  const rawQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'raw_materials');
  }, [db, user]);
  const productsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'products');
  }, [db, user]);

  const { data: locations } = useCollection(locationsQuery);
  const { data: suppliers } = useCollection(suppliersQuery);
  const { data: rawMaterials, isLoading } = useCollection(rawQuery);
  const { data: products } = useCollection(productsQuery);

  const getLocName = (id: string) => locations?.find(l => l.id === id)?.title || id || 'Unknown';
  const getSupplierName = (id: string) => suppliers?.find(s => s.id === id)?.name || suppliers?.find(s => s.id === id)?.supplierName || id || 'Unknown';

  const targetLocationName = useMemo(() => {
    if (!paramLocation) return '';
    const found = locations?.find(l => l.id === paramLocation || (l.title || '').toLowerCase() === paramLocation.toLowerCase());
    return found ? (found.title || found.id) : paramLocation;
  }, [locations, paramLocation]);

  const filteredData = useMemo(() => {
    if (!rawMaterials) return [];
    return rawMaterials.filter(rm => {
      const shiftDate = rm.shiftDate || rm.date || (rm.dateTime ? rm.dateTime.substring(0, 10) : '');
      const locName = getLocName(rm.locationId);

      const matchesDate = !paramDate || shiftDate === paramDate;
      const matchesLoc = !paramLocation || rm.locationId === paramLocation || locName.toLowerCase() === paramLocation.toLowerCase() || locName === targetLocationName;

      if (!matchesDate || !matchesLoc) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const lot = (rm.lotNumber || '').toLowerCase();
      const supp = getSupplierName(rm.supplierId).toLowerCase();
      const plate = (rm.plateNumber || '').toLowerCase();
      return lot.includes(term) || supp.includes(term) || plate.includes(term);
    }).sort((a: any, b: any) => (b.dateTime || '').localeCompare(a.dateTime || ''));
  }, [rawMaterials, paramDate, paramLocation, targetLocationName, searchTerm, locations, suppliers]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, page, rowsPerPage]);

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (!confirm('Are you sure you want to delete this raw material record?')) return;
    try {
      await deleteDoc(doc(db, 'raw_materials', id));
      toast({ title: 'Deleted', description: 'Raw material intake deleted successfully.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: err.message });
    }
  };

  const handlePrintSingleRow = async (rm: any) => {
    try {
      toast({ title: 'Generating PDF', description: 'Please wait...' });
      const { generateRawMaterialDetailPDF } = await import('@/lib/export-raw-material-detail-pdf');
      const palletQuery = query(collection(db!, 'palletizations'), where('rawMaterialId', '==', rm.id));
      const palletSnap = await getDocs(palletQuery);
      const pallets = palletSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const supplierName = getSupplierName(rm.supplierId);
      const locationName = getLocName(rm.locationId);
      const totalBoxes = pallets.reduce((sum: number, p: any) => sum + (Number(p.boxes) || 0), 0);
      const emptyBoxes = (rm.emptyBoxes !== undefined) ? rm.emptyBoxes : (Number(rm.boxesIn || 0) - totalBoxes);

      await generateRawMaterialDetailPDF({
        ...rm,
        supplierName,
        locationName,
        emptyBoxes,
        totalNetWeight: rm.totalNetWeight || 0,
        blNetWeight: rm.blNetWeight || 0,
        blGrossWeight: rm.blGrossWeight || 0,
        boxesIn: rm.boxesIn || 0,
        boxesOut: rm.boxesOut || 0,
        products: products || [],
        pallets,
        weightDifference: Number(rm.blNetWeight || 0) - Number(rm.totalNetWeight || 0)
      });
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  return (
    <div className="w-full p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 bg-[#F8F9FB] min-h-screen">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/production/raw-materials')} className="rounded-full h-10 w-10 hover:bg-slate-200">
            <ArrowLeft size={20} className="text-slate-600" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
              <span>Profile</span>
              <span className="opacity-40">/</span>
              <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/production/raw-materials')}>Raw Materials</span>
              <span className="opacity-40">/</span>
              <span className="text-primary font-black">Raw Material Group By Shift date and Location</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-primary uppercase leading-none">
              Raw Material Group By Shift date and Location
            </h1>
          </div>
        </div>
      </div>

      {/* Group Info Spec Card */}
      <Card className="border-none shadow-lg rounded-2xl bg-white overflow-hidden p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Calendar size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift Date</p>
              <h2 className="text-base font-black text-slate-800 uppercase">{paramDate || '—'}</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl text-primary">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</p>
              <h2 className="text-base font-black text-slate-800 uppercase">{targetLocationName || paramLocation || '—'}</h2>
            </div>
          </div>
        </div>
      </Card>

      {/* Listing Raw Materials Section */}
      <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Listing Raw Materials</h3>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search lot, supplier, plate..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent border-b border-slate-100">
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4 pl-6">Actions</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4">Lot Number</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4">Shift Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4">Date Time</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4">Supplier</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4">Plate Number</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4 text-right">BL. Net Weight</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4 text-right">Decay Net Weight</TableHead>
                <TableHead className="text-[10px] font-black uppercase text-slate-400 py-4 text-right pr-6">Weight Difference</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  </TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center text-slate-400 font-medium italic">
                    No raw materials found for this shift date & location.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((rm) => {
                  const bl = Number(rm.blNetWeight || 0);
                  const net = Number(rm.totalNetWeight || 0);
                  const decay = Number(rm.totalDecayNetWeight || 0);
                  const diff = bl - net;
                  const shiftDateStr = rm.shiftDate || rm.date || (rm.dateTime ? rm.dateTime.substring(0, 10) : '-');

                  return (
                    <TableRow key={rm.id} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-slate-200">
                              <MoreVertical size={16} className="text-slate-500" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-48 rounded-xl shadow-xl border-slate-100">
                            <DropdownMenuItem onClick={() => handlePrintSingleRow(rm)} className="font-bold text-xs py-2 gap-2 text-indigo-600 cursor-pointer">
                              <Printer size={14} /> Print PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/production/raw-materials/${rm.id}/edit`)} className="font-bold text-xs py-2 gap-2 text-amber-600 cursor-pointer">
                              <Edit size={14} /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDelete(rm.id)} className="font-bold text-xs py-2 gap-2 text-rose-600 focus:bg-rose-50 cursor-pointer">
                              <Trash2 size={14} /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <Link href={`/production/raw-materials/${rm.id}`}>
                          <span className="font-black text-xs text-[#708238] hover:underline bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200/60 cursor-pointer">
                            {rm.lotNumber}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-700">
                        {shiftDateStr}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-600">
                        {rm.dateTime ? format(new Date(rm.dateTime), 'yyyy-MM-dd HH:mm:ss') : '-'}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-slate-700">
                        {getSupplierName(rm.supplierId)}
                      </TableCell>
                      <TableCell className="text-xs font-black text-slate-500 uppercase">
                        {rm.plateNumber || '-'}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-right text-slate-700">
                        {bl.toFixed(2)} <span className="text-[10px] text-slate-400 uppercase">(KG)</span>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-right text-rose-600">
                        {decay.toFixed(2)} <span className="text-[10px] text-rose-400 uppercase">(KG)</span>
                      </TableCell>
                      <TableCell className="text-xs font-black text-right pr-6 text-slate-800">
                        {diff.toFixed(2)} <span className="text-[10px] text-slate-400 uppercase">(KG)</span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          page={page}
          setPage={setPage}
          rowsPerPage={rowsPerPage}
          setRowsPerPage={setRowsPerPage}
          totalItems={filteredData.length}
        />
      </Card>
    </div>
  );
}
