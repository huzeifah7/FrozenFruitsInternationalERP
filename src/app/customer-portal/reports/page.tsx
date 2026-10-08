'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCustomerAuth } from '@/components/customer-auth-provider';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query } from '@/firebase/firestore-override';
import { Search, ShieldCheck, ChevronLeft, ChevronRight, Package, Truck, Hash, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function CustomerQualityReportsPage() {
  const { customer, loading: authLoading } = useCustomerAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const db = useFirestore();

  const reportsQuery = useMemoFirebase(() => {
    if (!db || !customer?.id) return null;
    return query(collection(db, 'quality_reports'));
  }, [db, customer?.id]);

  const { data: rawReportsList, isLoading } = useCollection<any>(reportsQuery);

  const filteredReports = useMemo(() => {
    if (!rawReportsList || !customer) return [];

    // Match by customer name (primary) or by customer id fields AND MUST BE APPROVED
    let list = rawReportsList.filter(r => {
      // Unless a quality report is approved, it won't show on customers portal
      const statusLower = (r.status || '').toLowerCase();
      const isApproved = statusLower === 'approved' || r.isApproved === true || r.approved === true;
      if (!isApproved) return false;

      // Match by customer name (most common in quality_reports)
      if (r.customerName && customer.companyName) {
        const rName = r.customerName.trim().toLowerCase();
        const cName = customer.companyName.trim().toLowerCase();
        if (rName === cName || rName.includes(cName) || cName.includes(rName)) return true;
      }
      // Fallback: match by id fields
      if (r.customerId && r.customerId === customer.id) return true;
      if (r.customer_id && r.customer_id === customer.id) return true;
      if (r.customer && r.customer === customer.id) return true;
      return false;
    });

    // Note: season filtering is already handled by firestore-override query injection
    // We do NOT apply a local season filter to avoid double-filtering

    // Search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(r =>
        (r.poNumber || '').toLowerCase().includes(term) ||
        (r.customerName || '').toLowerCase().includes(term) ||
        (r.sender || '').toLowerCase().includes(term) ||
        (r.transport || '').toLowerCase().includes(term) ||
        (r.transportNumber || '').toLowerCase().includes(term) ||
        (r.product || '').toLowerCase().includes(term)
      );
    }

    // Sort newest first
    list.sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bTime - aTime;
    });

    return list;
  }, [rawReportsList, customer, searchTerm]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage) || 1;
  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredReports.slice(start, start + itemsPerPage);
  }, [filteredReports, currentPage, itemsPerPage]);

  if (authLoading || isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <span>Profile</span>
            <span className="opacity-40">/</span>
            <span className="text-primary uppercase">Customer Quality Reports</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase flex items-center gap-3">
            <ShieldCheck className="h-8 w-8" /> Customer Quality Reports
          </h1>
        </div>
      </div>

      {/* Table Card */}
      <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-primary/5 border-b p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <ShieldCheck size={16} /> Quality Reports Archive
          </CardTitle>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by PO, transport, product..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-9 h-10 rounded-xl border-primary/20 bg-white"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Order PO Number</div>
                  </TableHead>
                  <TableHead className="px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <User size={10} /> Customer
                    </div>
                  </TableHead>
                  <TableHead className="px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sender</div>
                  </TableHead>
                  <TableHead className="px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <Truck size={10} /> Transport
                    </div>
                  </TableHead>
                  <TableHead className="px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <Hash size={10} /> Transport Number
                    </div>
                  </TableHead>
                  <TableHead className="px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                      <Package size={10} /> Product
                    </div>
                  </TableHead>
                  <TableHead className="px-4 py-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">REF</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedReports.length > 0 ? paginatedReports.map((report) => (
                  <TableRow key={report.id} className="hover:bg-primary/[0.02] group">
                    {/* Clickable PO Number */}
                    <TableCell className="px-6 py-4">
                      <Link
                        href={`/customer-portal/reports/${report.id}`}
                        className="inline-block bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                      >
                        <span className="font-black text-[11px] text-emerald-800 tracking-[0.08em] uppercase group-hover:text-emerald-900">
                          {report.poNumber || '—'}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <span className="font-bold text-sm text-primary uppercase tracking-tight">
                        {report.customerName || customer?.companyName || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <span className="font-medium text-xs text-muted-foreground">
                        {report.sender || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <Truck size={12} className="text-amber-600 shrink-0" />
                        <span className="font-bold text-xs text-primary/80 uppercase">
                          {report.transport || '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <Hash size={11} className="text-primary/30 shrink-0" />
                        <span className="font-mono text-xs font-bold text-primary/70">
                          {report.transportNumber || '—'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <span className="font-bold text-xs text-primary/80 uppercase">
                        {report.product || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <span className="font-mono text-[11px] font-bold text-muted-foreground uppercase">
                        {report.ref || report.id?.substring(0, 8) || '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic text-sm">
                      No quality reports found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {filteredReports.length > itemsPerPage && (
            <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/5">
              <span className="text-xs font-medium text-muted-foreground">
                {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, filteredReports.length)} of {filteredReports.length} reports
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="h-8 rounded-lg"
                >
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-xs font-bold px-2">{currentPage} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="h-8 rounded-lg"
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
