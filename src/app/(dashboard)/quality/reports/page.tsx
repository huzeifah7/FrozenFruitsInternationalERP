'use client';

import React, { useState, useMemo } from 'react';
import { collection, query, orderBy, deleteDoc, doc, updateDoc, serverTimestamp } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  MoreHorizontal, Plus, Trash2, FileText, Eye, Calendar, CheckCircle2, Edit,
  Filter, X, Package, Layers, Truck, User, Hash, BarChart3, ChevronDown, Download
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { generateQualityReportPDF, getPalletImages } from '@/lib/export-quality-report-pdf';
import { usePermissions } from '@/hooks/use-permissions';

export default function QualityReportsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { canAdd, canUpdate, canDelete } = usePermissions('quality.reports');

  const [filterCustomer, setFilterCustomer] = useState('all');
  const [filterOrder, setFilterOrder] = useState('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const reportsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'quality_reports'));
  }, [db, user]);

  const customersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'customers');
  }, [db, user]);

  const ordersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'orders'));
  }, [db, user]);

  const { data: reports, isLoading } = useCollection(reportsQuery);
  const { data: customers } = useCollection(customersQuery);
  const { data: orders } = useCollection(ordersQuery);

  const filteredReports = useMemo(() => {
    if (!reports) return [];
    return reports.filter(r => {
      const matchesCustomer = filterCustomer === 'all' || r.customerName === filterCustomer;
      const matchesOrder = filterOrder === 'all' || r.orderId === filterOrder;
      return matchesCustomer && matchesOrder;
    });
  }, [reports, filterCustomer, filterOrder]);

  const handleDelete = async (id: string) => {
    if (!db || !confirm('Delete this quality report?')) return;
    try {
      await deleteDoc(doc(db, 'quality_reports', id));
      toast({ title: "Report Deleted", description: "Quality report removed successfully." });
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete report." });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'quality_reports', id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'Unknown'
      });
      toast({ title: 'Status Updated', description: `Report status changed to ${newStatus}` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update status.' });
    }
  };

  const handleDownloadPDF = async (report: any) => {
    if (report.pallets) {
      for (let i = 0; i < report.pallets.length; i++) {
        const images = getPalletImages(report.pallets[i]);
        if (images.length !== 6) {
          toast({ 
            variant: 'destructive', 
            title: 'Validation Error', 
            description: 'Each pallet must contain exactly 6 saved images before downloading the Quality Report.' 
          });
          return;
        }
      }
    }

    setDownloadingId(report.id);
    try {
      await generateQualityReportPDF(report);
      toast({ title: 'Success', description: 'PDF generated successfully.' });
    } catch (error: any) {
      console.error('PDF Generation Error:', error);
      if (error.message === 'MISSING_IMAGES') {
        toast({ variant: 'destructive', title: 'Validation Error', description: 'Each pallet must contain exactly 6 saved images before downloading the Quality Report.' });
      } else if (error.message === 'LOAD_ERROR') {
        toast({ variant: 'destructive', title: 'Error', description: 'Unable to load pallet images from Firebase Storage. Please check saved image URLs.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate PDF.' });
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'FINALISED': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'APPROVED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'DRAFT':
      default:
        return 'bg-rose-100 text-rose-800 border-rose-200';
    }
  };

  return (
    <div className="w-full p-8 space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <nav className="flex text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600/50 mb-2">
            <span>Profile</span>
            <span className="mx-2 opacity-30">/</span>
            <span className="text-emerald-700">Quality Reports</span>
          </nav>
          <h1 className="text-4xl font-black text-primary tracking-tighter uppercase flex items-center gap-3">
            <span className="inline-block h-10 w-2 bg-emerald-500 rounded-full" />
            Quality Reports
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Track and manage outbound quality control reports per shipment.</p>
        </div>
        {canAdd && (
          <Button
            onClick={() => router.push('/quality/reports/add')}
            className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black gap-3 shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 text-[11px] uppercase tracking-widest"
          >
            <Plus className="h-5 w-5 stroke-[3]" /> NEW REPORT
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: 'Total Reports', value: reports?.length || 0, icon: <FileText className="h-5 w-5" />, color: 'emerald' },
          { label: 'Unique Customers', value: new Set(reports?.map(r => r.customerName)).size || 0, icon: <User className="h-5 w-5" />, color: 'blue' },
          { label: 'Total Pallets', value: reports?.reduce((s, r) => s + (r.totalPallets || 0), 0) || 0, icon: <Package className="h-5 w-5" />, color: 'amber' },
          { label: 'This Month', value: reports?.filter(r => { const d = r.createdAt?.toDate?.(); return d && d.getMonth() === new Date().getMonth(); }).length || 0, icon: <Calendar className="h-5 w-5" />, color: 'rose' },
        ].map((card) => (
          <Card key={card.label} className="border-none shadow-xl rounded-3xl bg-white overflow-hidden group hover:scale-[1.02] transition-all duration-300">
            <CardContent className="p-6 flex items-center justify-between">
              <div className={`p-3 rounded-2xl bg-${card.color}-50 text-${card.color}-600 border border-${card.color}-100`}>
                {card.icon}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 mb-1">{card.label}</p>
                <p className="text-3xl font-black text-primary">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden ring-1 ring-emerald-500/5">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-transparent pb-4 border-b border-emerald-50">
          <CardTitle className="text-[11px] font-black text-emerald-700 flex items-center gap-2 uppercase tracking-widest">
            <Filter size={14} /> Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5 items-end">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Customer</Label>
              <Select value={filterCustomer} onValueChange={setFilterCustomer}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-bold">
                  <SelectValue placeholder="All Customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers?.map(c => <SelectItem key={c.id} value={c.companyName}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Order</Label>
              <Select value={filterOrder} onValueChange={setFilterOrder}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-bold">
                  <SelectValue placeholder="All Orders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  {orders?.map(o => <SelectItem key={o.id} value={o.id}>{o.poNumber} — {o.customerName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                onClick={() => { setFilterCustomer('all'); setFilterOrder('all'); }}
              >
                <X size={18} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
        <div style={{ overflowX: 'auto' }}>
          <div className="min-w-[1400px]">
            <Table>
              <TableHeader className="bg-emerald-50/60">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="w-[80px] py-5 pl-6 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800/70">Actions</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800/70 py-5">Order PO Number</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800/70 py-5 text-center">Total Pallets</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800/70 py-5">Customer</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800/70 py-5">Sender</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800/70 py-5">Transport</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800/70 py-5">Transport No.</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800/70 py-5">Product</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800/70 py-5">REF</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800/70 py-5">Report Status</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800/70 py-5">Date</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800/70 py-5">Created By</TableHead>
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-800/70 py-5 pr-6">Updated By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-none">
                      <TableCell colSpan={13} className="py-4 px-6">
                        <Skeleton className="h-10 w-full rounded-xl" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="h-64 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-20">
                        <FileText size={64} />
                        <p className="text-xl font-black uppercase tracking-widest">No quality reports found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReports.map((report) => (
                    <TableRow key={report.id} className="group hover:bg-emerald-500/[0.02] transition-all border-b border-muted/15">
                      <TableCell className="pl-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-muted-foreground hover:text-emerald-700 hover:bg-emerald-50 transition-all">
                              <MoreHorizontal size={18} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-52 p-2 rounded-2xl shadow-2xl border-emerald-100 z-50">
                            <DropdownMenuItem 
                              className="gap-3 cursor-pointer font-black text-[11px] uppercase tracking-wider py-3 rounded-xl hover:bg-emerald-50 text-emerald-700" 
                              onClick={() => handleDownloadPDF(report)}
                              disabled={downloadingId === report.id}
                            >
                              <Download size={14} className={downloadingId === report.id ? "animate-pulse" : ""} /> 
                              {downloadingId === report.id ? 'Generating...' : 'Download'}
                            </DropdownMenuItem>
                            {canUpdate && (
                              <DropdownMenuItem className="gap-3 cursor-pointer font-black text-[11px] uppercase tracking-wider py-3 rounded-xl hover:bg-emerald-50 text-emerald-700" onClick={() => router.push(`/quality/reports/${report.id}/edit`)}>
                                <Edit size={14} /> Edit Report
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-3 text-rose-500 cursor-pointer font-black text-[11px] uppercase tracking-wider py-3 rounded-xl hover:bg-rose-50" onClick={() => handleDelete(report.id)}>
                                  <Trash2 size={14} /> Delete Report
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <div 
                          className="bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1 inline-block cursor-pointer hover:bg-emerald-100 transition-colors group-hover:border-emerald-300"
                          onClick={() => router.push(`/quality/reports/${report.id}`)}
                          title="View Report"
                        >
                          <span className="font-black text-[10px] text-emerald-800 tracking-[0.1em] uppercase group-hover:text-emerald-900">{report.poNumber || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="bg-sky-50 border-2 border-sky-100 rounded-2xl px-3 py-1.5 inline-flex items-center gap-1.5">
                          <Package size={12} className="text-sky-600" />
                          <span className="font-black text-[11px] text-sky-700">{report.totalPallets || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-black text-sm text-primary uppercase tracking-tight">{report.customerName || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-xs text-muted-foreground">{report.sender || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Truck size={12} className="text-amber-600" />
                          <span className="font-bold text-xs text-primary/80 uppercase">{report.transport || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Hash size={12} className="text-primary/30" />
                          <span className="font-mono text-xs font-bold text-primary/70">{report.transportNumber || '—'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-xs text-primary/80 uppercase">{report.product || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-bold text-muted-foreground uppercase">{report.id ? report.id.substring(0, 6) : '—'}</span>
                      </TableCell>
                      <TableCell>
                        {canUpdate ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${getStatusColor(report.status || 'DRAFT')}`}>
                                {report.status || 'DRAFT'} <ChevronDown size={12} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="w-40 p-2 rounded-2xl shadow-xl z-50">
                              <DropdownMenuItem className="text-[10px] font-black uppercase text-rose-700 hover:bg-rose-50 cursor-pointer py-2 rounded-xl" onClick={() => handleUpdateStatus(report.id, 'DRAFT')}>
                                DRAFT
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[10px] font-black uppercase text-emerald-700 hover:bg-emerald-50 cursor-pointer py-2 rounded-xl" onClick={() => handleUpdateStatus(report.id, 'FINALISED')}>
                                FINALISED
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[10px] font-black uppercase text-blue-700 hover:bg-blue-50 cursor-pointer py-2 rounded-xl" onClick={() => handleUpdateStatus(report.id, 'APPROVED')}>
                                APPROVED
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border inline-flex items-center gap-2 ${getStatusColor(report.status || 'DRAFT')}`}>
                            {report.status || 'DRAFT'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-xs text-muted-foreground">{report.date || (report.createdAt?.toDate ? report.createdAt.toDate().toLocaleDateString() : '—')}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-[11px] text-muted-foreground break-all">{report.createdBy || '—'}</span>
                      </TableCell>
                      <TableCell className="pr-6">
                        <span className="font-medium text-[11px] text-muted-foreground break-all">{report.updatedBy || '—'}</span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
    </div>
  );
}

