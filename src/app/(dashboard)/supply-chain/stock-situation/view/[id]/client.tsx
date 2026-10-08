'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doc, getDoc } from '@/firebase/firestore-override';
import { useFirestore, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  ChevronLeft, Loader2, Package, MapPin, Calendar, FileText, ArrowUpCircle, ArrowDownCircle, Download
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { isChappes } from '@/lib/stock-situation-utils';

interface ItemRow {
  operation: 'IN' | 'OUT';
  supplierName: string;
  consumableName: string;
  deliveryNoteNumber: string;
  quantity: number;
  currency: string;
  unitPrice: number;
  totalAmount: number;
  fileUrl?: string;
  note: string;
}

export default function ViewStockSituationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const db = useFirestore();
  const { user } = useUser();

  const [locationName, setLocationName] = useState('');
  const [date, setDate] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [fetching, setFetching] = useState(true);

  // Fetch Existing Data
  useEffect(() => {
    async function loadData() {
      if (!db || !id) return;
      try {
        const docRef = doc(db, 'stock_situations', id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setLocationName(data.locationName || 'Unknown');
          setDate(data.date || '');
          setCreatedBy(data.createdBy || 'Unknown');
          setItems(data.items || []);
        } else {
          router.push('/supply-chain/stock-situation');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    }
    loadData();
  }, [db, id, router]);

  if (fetching) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-[#7a9800] opacity-20" />
      </div>
    );
  }

  return (
    <div className="w-full p-6 lg:p-8 max-w-[1200px] mx-auto animate-in fade-in duration-500 bg-[#F8F9FB] min-h-screen">
      {/* Back button & Breadcrumbs */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10 hover:bg-slate-200">
          <ChevronLeft size={20} className="text-slate-600" />
        </Button>
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
            <span>Profile</span><span className="opacity-40">/</span>
            <span className="cursor-pointer hover:text-slate-600" onClick={() => router.push('/supply-chain/stock-situation')}>Stock Situation</span><span className="opacity-40">/</span>
            <span className="text-[#7a9800]">View Stock Situation</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#2e1d52] uppercase">Stock Situation Details</h1>
        </div>
      </div>

      <div className="space-y-6">
        {/* Information Section */}
        <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden border border-slate-100">
          <CardHeader className="bg-primary/5 pb-4 border-b border-slate-100">
            <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest">
              <MapPin size={14} /> Stock Situation Header Info
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 pb-6 px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Location</p>
              <p className="text-sm font-black text-slate-700">{locationName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</p>
              <p className="text-sm font-bold text-slate-700">{date}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Created By</p>
              <p className="text-sm font-medium text-slate-600">{createdBy.split('@')[0]} ({createdBy})</p>
            </div>
          </CardContent>
        </Card>

        {/* Items Table Section */}
        <Card className="border-none shadow-lg rounded-3xl bg-white overflow-hidden border border-slate-100">
          <CardHeader className="bg-primary/5 pb-4 border-b border-slate-100">
            <CardTitle className="text-[11px] font-black text-primary flex items-center gap-2 uppercase tracking-widest">
              <Package size={14} /> Items List
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F8F9FB] hover:bg-transparent border-b border-slate-100">
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-8 py-5">Operation</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-5">Delivery Note Number</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-5">Supplier</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-5">Consumable</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-5 text-right">Qty</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-5 text-right">Unit Price</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-5 text-right">Total Amount</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-5">Note</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 py-5 pr-8 text-center">Delivery Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => {
                    const isChappe = isChappes(item.consumableName);
                    // Convert units back to boxes for display
                    const displayQty = isChappe ? item.quantity / 2000 : item.quantity;
                    const displayUnit = isChappe ? 'Boxes' : 'Units';

                    return (
                      <TableRow key={idx} className="hover:bg-slate-50/50 border-b border-slate-100 last:border-0 group">
                        <TableCell className="pl-8 py-4">
                          <Badge className={`text-[9px] font-black rounded-lg px-2 border ${item.operation === 'IN' ? 'bg-teal-50 text-teal-700 border-teal-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                            {item.operation === 'IN' ? <ArrowUpCircle size={10} className="mr-1 inline" /> : <ArrowDownCircle size={10} className="mr-1 inline" />}
                            {item.operation}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold text-slate-600">{item.deliveryNoteNumber || '—'}</TableCell>
                        <TableCell className="font-bold text-slate-500">{item.supplierName || '—'}</TableCell>
                        <TableCell className="font-black text-slate-700">{item.consumableName}</TableCell>
                        <TableCell className="text-right font-black text-slate-700">
                          {displayQty.toLocaleString()} <span className="text-[9px] text-slate-400 font-bold ml-0.5">{displayUnit}</span>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-500">
                          {item.unitPrice ? `${Number(item.unitPrice).toFixed(2)} ${item.currency}` : '—'}
                        </TableCell>
                        <TableCell className="text-right font-black text-slate-700">
                          {item.totalAmount ? `${Number(item.totalAmount).toFixed(2)} ${item.currency}` : '—'}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-slate-500 text-xs" title={item.note}>
                          {item.note || '—'}
                        </TableCell>
                        <TableCell className="pr-8 text-center">
                          {item.fileUrl ? (
                            <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg text-primary hover:bg-primary/5 text-xs font-bold gap-1.5">
                              <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">
                                <Download size={12} /> View File
                              </a>
                            </Button>
                          ) : (
                            <span className="text-slate-400 text-xs">No File</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-slate-400 font-medium italic">
                        No items found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
