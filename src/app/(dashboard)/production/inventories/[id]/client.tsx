'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { doc, getDoc } from '@/firebase/firestore-override';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ERPPageHeader } from '@/components/erp/ERPPageHeader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Download, ArrowUpDown, Equal, MoreVertical } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ViewProductionInventoryPage() {
  const params = useParams();
  const router = useRouter();
  const db = useFirestore();

  const id = params?.id as string;
  const [inv, setInv] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDoc() {
      if (!db || !id) return;
      try {
        const docRef = doc(db, 'production_inventories', id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          setInv({ id: snapshot.id, ...snapshot.data() });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDoc();
  }, [db, id]);

  const handleDownload = () => {
    // In the future, this can export just this detailed table to Excel
    alert("Individual download coming soon!");
  };

  const breadcrumbItems = [
    { label: 'Profile', href: '/production/inventories' },
    { label: 'Production Inventories', href: '/production/inventories' },
    { label: 'Production Inventories Weekly', active: true }
  ];

  if (isLoading) {
    return (
      <div className="w-full p-4 md:p-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!inv) {
    return (
      <div className="w-full p-4 md:p-8 space-y-6 text-center text-slate-500">
        Inventory not found.
      </div>
    );
  }

  const r = inv.totals || inv || {};
  const rows = inv.rows || [];

  return (
    <div className="w-full p-4 md:p-8 lg:p-10 space-y-8 animate-in fade-in duration-700 max-w-[100vw] overflow-x-hidden bg-[#f3f3f3] min-h-screen">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.push('/production/inventories')} className="hover:bg-slate-200">
          <ArrowLeft size={16} className="mr-2" /> Back
        </Button>
        <ERPPageHeader title="Production Inventories Weekly" breadcrumbItems={breadcrumbItems} />
      </div>

      {/* Top Totals List (Matching Screenshot 1) */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden">
        <CardContent className="p-8 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-sm font-bold text-slate-700">Raw material Net Weight</span>
            <span className="text-sm font-medium text-slate-600">{(r.mpPesee || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-sm font-bold text-slate-700">BL Net Weight</span>
            <span className="text-sm font-medium text-slate-600">{(r.mpBonCamion || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-sm font-bold text-slate-700">Farm Decay Net Weight</span>
            <span className="text-sm font-medium text-slate-600">{(r.dechetMp || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-sm font-bold text-slate-700">Difference</span>
            <span className="text-sm font-medium text-slate-600">{(r.difference || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-sm font-bold text-slate-700">Total Consumption</span>
            <span className="text-sm font-medium text-slate-600">{(r.totalConsumption || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-sm font-bold text-slate-700">Raw material in stock</span>
            <span className="text-sm font-medium text-slate-600">{(r.mpEnStock || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-sm font-bold text-slate-700">Out of program</span>
            <span className="text-sm font-medium text-slate-600">{(r.outOfProgram || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-sm font-bold text-slate-700">Finished Product Shipped</span>
            <span className="text-sm font-medium text-slate-600">{(r.produitCharge || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-sm font-bold text-slate-700">Finished product in stock</span>
            <span className="text-sm font-medium text-slate-600">{(r.pfEnStock || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-sm font-bold text-slate-700">Local Market</span>
            <span className="text-sm font-medium text-slate-600">{(r.localMarket || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-sm font-bold text-slate-700">Production Decay</span>
            <span className="text-sm font-medium text-slate-600">{(r.dechetProduction || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <span className="text-sm font-bold text-slate-700">Return</span>
            <span className="text-sm font-medium text-slate-600">{(r.retour || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-slate-700">Reste</span>
            <span className="text-sm font-medium text-slate-600">{(r.restes || 0).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Table (Matching Screenshot 2 & 3) */}
      <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 flex justify-end">
            <Button onClick={handleDownload} className="bg-[#7a9800] hover:bg-[#688200] text-white">
              <Download size={16} className="mr-2" /> Download
            </Button>
          </div>
          
          <div className="overflow-x-auto w-full custom-scrollbar pb-6">
            <Table className="w-full min-w-[2200px]">
              <TableHeader className="bg-white border-b border-slate-200">
                <TableRow>
                  <TableHead className="py-4 w-[120px]">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Date</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 w-[80px]">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Shift</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 w-[160px]">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Location</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 w-[120px]">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Week</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Raw material Net Weight</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>BL Net Weight</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Farm Decay Net Weight</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Difference</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Total Consumption</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Raw material in stock</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Out of program</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Finished Product Shipped</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Finished product in stock</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Local Market</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Production Decay</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Return</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                      <span>Reste</span>
                      <div className="flex items-center gap-1 text-slate-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                  <TableHead className="py-4 text-red-600">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold">
                      <span>Losses</span>
                      <div className="flex items-center gap-1 text-red-300"><ArrowUpDown size={14}/><Equal size={14}/><MoreVertical size={14}/></div>
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={18} className="text-center py-8 text-slate-400">
                      No daily records found. You may need to generate a new inventory report to see detailed rows.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row: any, i: number) => (
                    <TableRow key={i} className="border-b border-slate-100 hover:bg-slate-50">
                      <TableCell className="py-4 text-sm font-medium text-slate-700">{row.date}</TableCell>
                      <TableCell className="py-4 text-sm font-medium text-slate-600">{row.shift}</TableCell>
                      <TableCell className="py-4 text-sm font-medium text-slate-600">{row.locationName}</TableCell>
                      <TableCell className="py-4 text-sm font-medium text-slate-600">{inv.period}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">{(row.mpPesee || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">{(row.mpBonCamion || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">{(row.dechetMp || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">{(row.difference || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">{(row.totalConsumption || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">{(row.mpEnStock || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">{(row.outOfProgram || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">{(row.produitCharge || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">{(row.pfEnStock || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">{(row.localMarket || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">{(row.dechetProduction || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">{(row.retour || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 text-sm text-slate-600">{(row.restes || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 text-sm font-bold text-red-600 bg-red-50/20">{(row.perteReelle || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
