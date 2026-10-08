'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, addDoc, serverTimestamp, deleteDoc
} from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2,
  Package, MapPin, Inbox, Layers, ArrowUpCircle, ArrowDownCircle, Trash2, Edit, Download, Plus, AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

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
    <div className="flex justify-end items-center px-6 py-3 border-t border-slate-100 text-xs text-slate-600 gap-6 bg-slate-50/50">
      <div className="flex items-center gap-2">
        <span className="font-bold">Rows per page</span>
        <select 
          className="bg-transparent border-none focus:ring-0 cursor-pointer text-gray-700 outline-none font-bold"
          value={rowsPerPage}
          onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
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
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-gray-700 hover:bg-gray-100" onClick={() => setPage(1)} disabled={page === 1}><ChevronsLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-gray-700 hover:bg-gray-100" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-gray-700 hover:bg-gray-100" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-gray-700 hover:bg-gray-100" onClick={() => setPage(totalPages)} disabled={page === totalPages || totalPages === 0}><ChevronsRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
};

export default function QualityStockDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const consumableId = params.consumableId as string;
  const locationId = searchParams.get('locationId') || '';
  const locationName = searchParams.get('locationName') || 'All Locations';
  const queryConsumableName = searchParams.get('consumableName') || '';

  const [consumable, setConsumable] = useState<any | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [operation, setOperation] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Pagination State
  const [pageIn, setPageIn] = useState(1);
  const [rowsPerPageIn, setRowsPerPageIn] = useState(10);
  const [pageOut, setPageOut] = useState(1);
  const [rowsPerPageOut, setRowsPerPageOut] = useState(10);

  // Query Data
  useEffect(() => {
    async function fetchMetadata() {
      if (!db || !consumableId) return;
      try {
        const cSnap = await getDoc(doc(db, 'quality_consumables', consumableId));
        if (cSnap.exists()) {
          setConsumable({ id: cSnap.id, ...cSnap.data() });
        } else if (queryConsumableName) {
          // Fallback if deleted but name in URL
          setConsumable({ id: consumableId, name: queryConsumableName });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingMetadata(false);
      }
    }
    fetchMetadata();
  }, [db, consumableId, queryConsumableName]);

  const stockQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'quality_stock');
  }, [db]);

  const { data: rawStockRecords, isLoading: loadingStock } = useCollection(stockQuery);
  const stockRecords = useMemo(() => {
    if (!rawStockRecords) return null;
    return [...rawStockRecords].sort((a: any, b: any) => {
      const timeA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
  }, [rawStockRecords]);

  // Calculate lists and stats
  const { inMovements, outMovements, stats } = useMemo(() => {
    if (!stockRecords) return { inMovements: [], outMovements: [], stats: { totalIn: 0, totalOut: 0, available: 0 } };

    const ins: any[] = [];
    const outs: any[] = [];
    let totalIn = 0;
    let totalOut = 0;

    stockRecords.forEach(record => {
      if (locationId && record.locationId !== locationId) return;
      
      const items = record.items || [];
      items.forEach((item: any, idx: number) => {
        if (item.consumableId === consumableId) {
          const qty = Number(item.quantity) || 0;
          const movement = {
            id: `${record.id}_${idx}`,
            docId: record.id,
            itemIndex: idx,
            date: record.date || '—',
            operation: item.operation,
            quantity: qty,
            note: item.note || '—',
            createdBy: record.createdBy || '—',
            updatedBy: record.updatedBy || '—',
            locationName: record.locationName || '—'
          };
          if (item.operation === 'IN') {
            ins.push(movement);
            totalIn += qty;
          } else if (item.operation === 'OUT') {
            outs.push(movement);
            totalOut += qty;
          }
        }
      });
    });

    return {
      inMovements: ins,
      outMovements: outs,
      stats: { totalIn, totalOut, available: totalIn - totalOut }
    };
  }, [stockRecords, consumableId, locationId]);

  // Handle Save (Add Movement)
  const handleSave = async () => {
    if (!db || !user) return;
    const qty = Number(quantity);
    if (!operation) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select an operation.' });
      return;
    }
    if (!qty || qty <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Quantity must be greater than zero.' });
      return;
    }

    // Optional: Warn or Block Negative Stock if required. 
    // "If project currently allows negative stock: allow it." Main page currently allows it, so no blocking.

    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const newItem = {
        consumableId,
        consumableName: consumable?.name || queryConsumableName,
        operation,
        quantity: qty.toString(),
        note,
        section: consumable?.section || '',
        deliveryNoteNumber: '',
        fileUrl: '',
      };

      await addDoc(collection(db, 'quality_stock'), {
        locationId: locationId || 'default', // If no location provided, use a default placeholder or empty.
        locationName: locationName || 'Unknown',
        date: today,
        items: [newItem],
        createdAt: serverTimestamp(),
        createdBy: user.email,
        updatedAt: serverTimestamp(),
        updatedBy: user.email,
      });

      toast({ title: 'Success', description: 'Stock movement added successfully.' });
      setIsAddModalOpen(false);
      setQuantity('');
      setNote('');
      setOperation('IN');
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add movement.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (docId: string, itemIndex: number) => {
    if (!db || !confirm('Are you sure you want to delete this movement?')) return;
    try {
      // In a real scenario, we should arrayRemove or update the array if there are multiple items.
      // But if there's only 1 item, we can delete the whole doc to keep it clean.
      const docSnap = await getDoc(doc(db, 'quality_stock', docId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.items && data.items.length === 1) {
          await deleteDoc(doc(db, 'quality_stock', docId));
        } else {
          toast({ variant: 'destructive', title: 'Error', description: 'Cannot delete individual item from a multi-item batch yet.' });
          return;
        }
      }
      toast({ title: 'Deleted', description: 'Movement removed successfully.' });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete movement.' });
    }
  };

  const exportToExcel = () => {
    const wsIn = XLSX.utils.json_to_sheet(inMovements.map(m => ({
      Date: m.date,
      Quantity: m.quantity,
      Note: m.note,
      'Created By': m.createdBy,
      'Updated By': m.updatedBy
    })));

    const wsOut = XLSX.utils.json_to_sheet(outMovements.map(m => ({
      Date: m.date,
      Quantity: m.quantity,
      Note: m.note,
      'Created By': m.createdBy,
      'Updated By': m.updatedBy
    })));

    // Create a summary worksheet
    const wsSummary = XLSX.utils.json_to_sheet([
      { Metric: 'Quantity IN', Value: stats.totalIn },
      { Metric: 'Quantity OUT', Value: stats.totalOut },
      { Metric: 'Stock Available', Value: stats.available }
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
    XLSX.utils.book_append_sheet(wb, wsIn, "IN Movements");
    XLSX.utils.book_append_sheet(wb, wsOut, "OUT Movements");

    const fileName = locationId 
      ? `Quality_Stock_${consumable?.name || queryConsumableName}_${locationName}.xlsx` 
      : `Quality_Stock_${consumable?.name || queryConsumableName}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  // Pagination
  const paginatedIn = inMovements.slice((pageIn - 1) * rowsPerPageIn, pageIn * rowsPerPageIn);
  const paginatedOut = outMovements.slice((pageOut - 1) * rowsPerPageOut, pageOut * rowsPerPageOut);

  if (loadingMetadata || loadingStock) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="w-full p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-500 bg-[#F8F9FB] min-h-screen">
      {/* Back & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/quality/stock')} className="rounded-full h-10 w-10 hover:bg-slate-200">
            <ChevronLeft size={20} className="text-slate-600" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
              <span>Profile</span><span className="opacity-40">/</span>
              <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/quality/stock')}>Quality Stock Situation</span><span className="opacity-40">/</span>
              <span className="text-primary">{consumable?.name || queryConsumableName}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-primary uppercase leading-none">
              QUALITY STOCK SITUATION - {consumable?.name || queryConsumableName}
            </h1>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={exportToExcel} className="h-12 px-6 rounded-2xl border-primary/20 text-primary font-black text-[11px] uppercase tracking-widest hover:bg-primary/5 gap-2">
            <Download size={16} /> EXPORT
          </Button>
          <Button onClick={() => setIsAddModalOpen(true)} className="h-12 px-8 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black gap-3 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 text-[11px] uppercase tracking-widest">
            <Plus className="h-5 w-5 stroke-[3]" /> ADD STOCK
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:items-center px-4">
        <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
          <Layers className="size-3.5 text-primary" />
          Consumable: <span className="font-black text-slate-700 ml-0.5 bg-slate-100 rounded-md px-2 py-0.5">{consumable?.name || queryConsumableName}</span>
        </div>
        {locationId && (
          <div className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5">
            <MapPin className="size-3.5 text-primary" />
            Location: <span className="font-black text-slate-700 ml-0.5 bg-slate-100 rounded-md px-2 py-0.5">{locationName}</span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden hover:scale-[1.02] transition-all duration-300">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 mb-1">Quantity IN</p>
              <h3 className="text-3xl font-black text-slate-700">{stats.totalIn.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl border border-teal-100"><ArrowUpCircle className="h-6 w-6" /></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden hover:scale-[1.02] transition-all duration-300">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 mb-1">Quantity OUT</p>
              <h3 className="text-3xl font-black text-slate-700">{stats.totalOut.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100"><ArrowDownCircle className="h-6 w-6" /></div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden hover:scale-[1.02] transition-all duration-300">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 mb-1">Stock Available</p>
              <h3 className={`text-3xl font-black ${stats.available < 0 ? 'text-rose-500' : 'text-primary'}`}>{stats.available.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-primary/10 text-primary rounded-2xl border border-primary/10"><Package className="h-6 w-6" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="in" className="w-full">
        <TabsList className="bg-slate-100 rounded-xl h-12 p-1.5 mb-6 border border-slate-200/50 w-fit">
          <TabsTrigger value="in" className="rounded-lg font-black text-[10px] uppercase tracking-widest px-6 h-full transition-all">IN</TabsTrigger>
          <TabsTrigger value="out" className="rounded-lg font-black text-[10px] uppercase tracking-widest px-6 h-full transition-all">OUT</TabsTrigger>
        </TabsList>

        {/* IN Tab */}
        <TabsContent value="in" className="m-0 focus-visible:outline-none">
          <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader className="bg-slate-50">
                  <TableRow className="hover:bg-transparent border-b border-slate-100">
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 pl-8">Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right">Quantity</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Note</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Created By</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Updated By</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 pr-8 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedIn.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-400 font-medium italic">No IN transactions found.</TableCell></TableRow>
                  ) : (
                    paginatedIn.map((r, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 group">
                        <TableCell className="pl-8 py-4 font-bold text-slate-600">{r.date}</TableCell>
                        <TableCell className="text-right font-black text-slate-700">{r.quantity.toLocaleString()}</TableCell>
                        <TableCell className="font-medium text-slate-500 max-w-[200px] truncate" title={r.note}>{r.note}</TableCell>
                        <TableCell className="text-xs font-bold text-slate-400">{r.createdBy?.split('@')[0]}</TableCell>
                        <TableCell className="text-xs font-bold text-slate-400">{r.updatedBy?.split('@')[0]}</TableCell>
                        <TableCell className="pr-8 text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(r.docId, r.itemIndex)} className="h-8 w-8 text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination page={pageIn} setPage={setPageIn} rowsPerPage={rowsPerPageIn} setRowsPerPage={setRowsPerPageIn} totalItems={inMovements.length} />
          </Card>
        </TabsContent>

        {/* OUT Tab */}
        <TabsContent value="out" className="m-0 focus-visible:outline-none">
          <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader className="bg-slate-50">
                  <TableRow className="hover:bg-transparent border-b border-slate-100">
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 pl-8">Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 text-right">Quantity</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Note</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Created By</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5">Updated By</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-5 pr-8 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedOut.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-48 text-center text-slate-400 font-medium italic">No OUT transactions found.</TableCell></TableRow>
                  ) : (
                    paginatedOut.map((r, i) => (
                      <TableRow key={i} className="hover:bg-slate-50 border-b border-slate-100 last:border-0 group">
                        <TableCell className="pl-8 py-4 font-bold text-slate-600">{r.date}</TableCell>
                        <TableCell className="text-right font-black text-slate-700">{r.quantity.toLocaleString()}</TableCell>
                        <TableCell className="font-medium text-slate-500 max-w-[200px] truncate" title={r.note}>{r.note}</TableCell>
                        <TableCell className="text-xs font-bold text-slate-400">{r.createdBy?.split('@')[0]}</TableCell>
                        <TableCell className="text-xs font-bold text-slate-400">{r.updatedBy?.split('@')[0]}</TableCell>
                        <TableCell className="pr-8 text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(r.docId, r.itemIndex)} className="h-8 w-8 text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <TablePagination page={pageOut} setPage={setPageOut} rowsPerPage={rowsPerPageOut} setRowsPerPage={setRowsPerPageOut} totalItems={outMovements.length} />
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-primary uppercase">Add Quality Stock Movement</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Operation *</Label>
              <Select value={operation} onValueChange={(v: 'IN' | 'OUT') => setOperation(v)}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold">
                  <SelectValue placeholder="Select Operation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN" className="font-bold text-teal-700">IN</SelectItem>
                  <SelectItem value="OUT" className="font-bold text-amber-700">OUT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantity *</Label>
              <Input 
                type="number" 
                min="1" 
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="h-11 rounded-xl bg-muted/20 border-none font-bold"
                placeholder="Enter quantity"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Note</Label>
              <Textarea 
                value={note} 
                onChange={(e) => setNote(e.target.value)}
                className="rounded-xl bg-muted/20 border-none font-medium min-h-[100px]"
                placeholder="Optional notes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)} className="rounded-xl font-bold">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-primary text-white font-bold hover:bg-primary/90">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              SAVE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
