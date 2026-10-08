'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCustomerAuth } from '@/components/customer-auth-provider';
import { useSeason } from '@/contexts/SeasonContext';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, where, orderBy } from '@/firebase/firestore-override';
import { Search, FileText, CreditCard, ArrowUpDown, ChevronLeft, ChevronRight, FileDown, Receipt, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { money, safeNumber } from '@/app/(dashboard)/finance/customer-balances/utils';
import Swal from 'sweetalert2';

export default function CustomerInvoicesPage() {
  const { customer, loading: authLoading } = useCustomerAuth();
  const { currentSeason } = useSeason();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isExporting, setIsExporting] = useState(false);

  const db = useFirestore();

  // Queries
  const customerId = customer?.id;
  
  const invoicesQ = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    return query(collection(db, 'invoices'));
  }, [customerId, db]);

  const paymentsQ = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    return query(collection(db, 'payments'));
  }, [customerId, db]);

  const creditNotesQ = useMemoFirebase(() => {
    if (!db || !customerId) return null;
    return query(collection(db, 'credit_notes'));
  }, [customerId, db]);

  const { data: invoicesList, isLoading: invLoading } = useCollection<any>(invoicesQ);
  const { data: paymentsList, isLoading: payLoading } = useCollection<any>(paymentsQ);
  const { data: creditNotesList, isLoading: cnLoading } = useCollection<any>(creditNotesQ);

  const isLoading = authLoading || invLoading || payLoading || cnLoading;

  // Filter Data
  const seasonId = currentSeason?.id;

  const filteredInvoices = useMemo(() => {
    if (!invoicesList) return [];
    let list = invoicesList.filter(i => {
      const matchCustomer = i.customer_id === customerId || i.customerId === customerId;
      const matchSeason = seasonId ? (i.season_id === seasonId || i.seasonId === seasonId) : true;
      return matchCustomer && matchSeason;
    });

    if (activeTab === 'paid') list = list.filter(i => i.status === 'Paid');
    if (activeTab === 'unpaid') list = list.filter(i => i.status !== 'Paid');
    
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(i => 
        i.invoice_number?.toLowerCase().includes(q) ||
        i.container_number?.toLowerCase().includes(q) ||
        i.po_number?.toLowerCase().includes(q)
      );
    }
    
    list.sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
    return list;
  }, [invoicesList, seasonId, activeTab, searchTerm, customerId]);

  const filteredPayments = useMemo(() => {
    if (!paymentsList) return [];
    let list = paymentsList.filter(p => {
      const matchCustomer = p.customer_id === customerId || p.customerId === customerId;
      const matchSeason = seasonId ? (p.season_id === seasonId || p.seasonId === seasonId) : true;
      return matchCustomer && matchSeason;
    });
    
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p => p.reference?.toLowerCase().includes(q) || p.invoice_number?.toLowerCase().includes(q));
    }

    list.sort((a, b) => new Date(b.payment_date || b.created_at || 0).getTime() - new Date(a.payment_date || a.created_at || 0).getTime());
    return list;
  }, [paymentsList, seasonId, searchTerm, customerId]);

  const filteredCreditNotes = useMemo(() => {
    if (!creditNotesList) return [];
    let list = creditNotesList.filter(c => {
      const matchCustomer = c.customer_id === customerId || c.customerId === customerId;
      const matchSeason = seasonId ? (c.season_id === seasonId || c.seasonId === seasonId) : true;
      return matchCustomer && matchSeason;
    });
    
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(c => c.cn_number?.toLowerCase().includes(q) || c.invoice_number?.toLowerCase().includes(q));
    }

    list.sort((a, b) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime());
    return list;
  }, [creditNotesList, seasonId, searchTerm, customerId]);

  // Pagination Helper
  const getPaginated = (list: any[]) => {
    const totalPages = Math.ceil(list.length / itemsPerPage) || 1;
    const start = (currentPage - 1) * itemsPerPage;
    return {
      paginated: list.slice(start, start + itemsPerPage),
      totalPages
    };
  };

  const currentList = activeTab === 'invoices' ? filteredInvoices : activeTab === 'payments' ? filteredPayments : filteredCreditNotes;
  const { paginated: activeData, totalPages } = getPaginated(currentList);

  const exportToExcel = async () => {
    if (currentList.length === 0) return;
    setIsExporting(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(activeTab);

      if (activeTab === 'invoices') {
        sheet.columns = [
          { header: 'Invoice Number', key: 'invNum', width: 20 },
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Status', key: 'status', width: 15 },
          { header: 'Amount', key: 'amount', width: 15 },
          { header: 'Currency', key: 'currency', width: 10 },
          { header: 'Season', key: 'season', width: 15 }
        ];
        currentList.forEach(i => {
          sheet.addRow({
            invNum: i.invoice_number,
            date: i.date || i.invoice_date,
            status: i.status || 'Issued',
            amount: safeNumber(i.total_amount || i.invoice_amount),
            currency: customer?.currency || 'DH',
            season: i.season_id || ''
          });
        });
      } else if (activeTab === 'payments') {
        sheet.columns = [
          { header: 'Reference', key: 'ref', width: 25 },
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Method', key: 'method', width: 15 },
          { header: 'Amount', key: 'amount', width: 15 },
          { header: 'Currency', key: 'currency', width: 10 },
          { header: 'Season', key: 'season', width: 15 }
        ];
        currentList.forEach(p => {
          sheet.addRow({
            ref: p.reference || p.transaction_id,
            date: p.date || p.payment_date,
            method: p.payment_method || 'Bank Transfer',
            amount: safeNumber(p.amount || p.payment_amount),
            currency: customer?.currency || 'DH',
            season: p.season_id || ''
          });
        });
      } else {
        sheet.columns = [
          { header: 'Credit Note Number', key: 'cnNum', width: 25 },
          { header: 'Date', key: 'date', width: 15 },
          { header: 'Reason', key: 'reason', width: 30 },
          { header: 'Amount', key: 'amount', width: 15 },
          { header: 'Currency', key: 'currency', width: 10 },
          { header: 'Season', key: 'season', width: 15 }
        ];
        currentList.forEach(c => {
          sheet.addRow({
            cnNum: c.credit_note_number || c.reference,
            date: c.date || c.created_at,
            reason: c.reason || 'Discount/Refund',
            amount: safeNumber(c.amount || c.total_amount),
            currency: customer?.currency || 'DH',
            season: c.season_id || ''
          });
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeTab}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: 'Export Successful' });
    } catch (e) {
      Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'error', title: 'Export Failed' });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
            <span>Customer Portal</span>
            <span className="opacity-40">/</span>
            <span className="text-primary uppercase">Financials</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary uppercase flex items-center gap-3">
            <Receipt className="h-8 w-8" /> Invoices & Payments
          </h1>
        </div>
        <Button 
          onClick={exportToExcel} 
          disabled={isExporting}
          className="gap-2 h-10 rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shadow-lg"
        >
          <FileDown size={16} /> {isExporting ? 'Exporting...' : 'Export to Excel'}
        </Button>
      </div>

      <Tabs defaultValue="invoices" onValueChange={(val) => { setActiveTab(val); setCurrentPage(1); setSearchTerm(''); }} className="space-y-6">
        <TabsList className="bg-primary/5 p-1 h-auto rounded-2xl w-full max-w-md">
          <TabsTrigger value="invoices" className="flex-1 rounded-xl h-10 font-bold uppercase tracking-wider text-[10px] data-[state=active]:bg-primary data-[state=active]:text-white">
            <FileText size={14} className="mr-2" /> Invoices ({filteredInvoices.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex-1 rounded-xl h-10 font-bold uppercase tracking-wider text-[10px] data-[state=active]:bg-primary data-[state=active]:text-white">
            <CreditCard size={14} className="mr-2" /> Payments ({filteredPayments.length})
          </TabsTrigger>
          <TabsTrigger value="credit_notes" className="flex-1 rounded-xl h-10 font-bold uppercase tracking-wider text-[10px] data-[state=active]:bg-primary data-[state=active]:text-white">
            <ShieldAlert size={14} className="mr-2" /> Credit Notes ({filteredCreditNotes.length})
          </TabsTrigger>
        </TabsList>

        <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-white">
          <CardHeader className="bg-primary/5 border-b p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              Records List
            </CardTitle>
            
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={`Search ${activeTab.replace('_', ' ')}...`} 
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
                    {activeTab === 'invoices' && (
                      <>
                        <TableHead className="px-6 py-4"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Invoice #</span></TableHead>
                        <TableHead className="px-6 py-4"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</span></TableHead>
                        <TableHead className="px-6 py-4"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount</span></TableHead>
                        <TableHead className="px-6 py-4"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</span></TableHead>
                      </>
                    )}
                    {activeTab === 'payments' && (
                      <>
                        <TableHead className="px-6 py-4"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reference</span></TableHead>
                        <TableHead className="px-6 py-4"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</span></TableHead>
                        <TableHead className="px-6 py-4"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Method</span></TableHead>
                        <TableHead className="px-6 py-4"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount</span></TableHead>
                      </>
                    )}
                    {activeTab === 'credit_notes' && (
                      <>
                        <TableHead className="px-6 py-4"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">CN Number</span></TableHead>
                        <TableHead className="px-6 py-4"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</span></TableHead>
                        <TableHead className="px-6 py-4"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reason</span></TableHead>
                        <TableHead className="px-6 py-4"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount</span></TableHead>
                      </>
                    )}
                    <TableHead className="px-6 py-4 text-right"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Season</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeData.length > 0 ? activeData.map((item) => (
                    <TableRow 
                      key={item.id} 
                      onClick={() => {
                        if (activeTab === 'invoices') {
                          Swal.fire({
                            title: `Invoice #${item.invoice_number || item.id}`,
                            html: `
                              <div style="text-align: left; font-size: 13px; line-height: 1.8; margin-top: 10px;">
                                <p><strong>Date:</strong> ${item.date || item.invoice_date || '-'}</p>
                                <p><strong>PO Number:</strong> ${item.po_number || item.poNumber || '-'}</p>
                                <p><strong>Container Number:</strong> ${item.container_number || item.containerNumber || '-'}</p>
                                <p><strong>Total Amount:</strong> ${money(safeNumber(item.total_amount || item.invoice_amount), customer?.currency || 'DH')}</p>
                                <p><strong>Status:</strong> ${item.status || 'Issued'}</p>
                              </div>
                            `,
                            icon: 'info',
                            confirmButtonColor: '#709506',
                            confirmButtonText: 'Close'
                          });
                        }
                      }}
                      className="hover:bg-slate-100/80 cursor-pointer transition-colors"
                    >
                      {activeTab === 'invoices' && (
                        <>
                          <TableCell className="px-6 py-4 font-bold text-[#709506] hover:underline flex items-center gap-1.5">
                            <FileText size={15} className="text-[#709506]" />
                            {item.invoice_number}
                          </TableCell>
                          <TableCell className="px-6 py-4 text-xs font-medium text-muted-foreground">{item.date || item.invoice_date}</TableCell>
                          <TableCell className="px-6 py-4 font-black text-primary">{money(safeNumber(item.total_amount || item.invoice_amount), customer?.currency || 'DH')}</TableCell>
                          <TableCell className="px-6 py-4">
                            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] uppercase tracking-widest">{item.status || 'Issued'}</Badge>
                          </TableCell>
                        </>
                      )}
                      {activeTab === 'payments' && (
                        <>
                          <TableCell className="px-6 py-4 font-bold text-primary">{item.reference || item.transaction_id || 'N/A'}</TableCell>
                          <TableCell className="px-6 py-4 text-xs font-medium text-muted-foreground">{item.date || item.payment_date}</TableCell>
                          <TableCell className="px-6 py-4 text-xs font-bold text-primary/70 uppercase">{item.payment_method || 'Bank Transfer'}</TableCell>
                          <TableCell className="px-6 py-4 font-black text-emerald-600">+{money(safeNumber(item.amount || item.payment_amount), customer?.currency || 'DH')}</TableCell>
                        </>
                      )}
                      {activeTab === 'credit_notes' && (
                        <>
                          <TableCell className="px-6 py-4 font-bold text-primary">{item.credit_note_number || item.reference || 'N/A'}</TableCell>
                          <TableCell className="px-6 py-4 text-xs font-medium text-muted-foreground">{item.date || item.created_at}</TableCell>
                          <TableCell className="px-6 py-4 text-xs text-muted-foreground max-w-[200px] truncate">{item.reason || 'Discount/Refund'}</TableCell>
                          <TableCell className="px-6 py-4 font-black text-rose-600">-{money(safeNumber(item.amount || item.total_amount), customer?.currency || 'DH')}</TableCell>
                        </>
                      )}
                      <TableCell className="px-6 py-4 text-right">
                        <Badge variant="outline" className="text-[9px] uppercase font-bold text-muted-foreground">
                           {item.season_id === currentSeason?.id ? currentSeason?.name : (item.season_id ? 'Previous Season' : 'All Seasons')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center text-muted-foreground italic text-sm">
                        No {activeTab.replace('_', ' ')} found for the selected season.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/5">
                <span className="text-xs font-medium text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, currentList.length)} of {currentList.length} records
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
      </Tabs>
    </div>
  );
}
