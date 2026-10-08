'use client';

import React, { useState, useMemo } from 'react';
import { useCustomerAuth } from '@/components/customer-auth-provider';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from '@/firebase/firestore-override';
import { Package, Search, FileDown, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

export default function CustomerProductsPage() {
  const { customer } = useCustomerAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortField, setSortField] = useState('productName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const ordersQuery = useMemoFirebase(() => {
    if (!customer?.id) return null;
    return query(collection(customer.firestore || anyDb(), 'orders'), where('customerId', '==', customer.id));
  }, [customer?.id]);

  const productsQuery = useMemoFirebase(() => {
    if (!customer?.id) return null;
    return collection(customer.firestore || anyDb(), 'products');
  }, [customer?.id]);

  const { data: orders, isLoading: ordersLoading } = useCollection<any>(ordersQuery);
  const { data: products, isLoading: productsLoading } = useCollection<any>(productsQuery);

  const orderedProductIds = useMemo(() => {
    if (!orders) return new Set<string>();
    const ids = new Set<string>();
    orders.forEach((o: any) => {
      o.items?.forEach((item: any) => {
        if (item.productId) ids.add(item.productId);
      });
    });
    return ids;
  }, [orders]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    // Filter only products ordered by this customer
    let list = products.filter(p => orderedProductIds.has(p.id));

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p => 
        (p.productName || '').toLowerCase().includes(term) ||
        (p.category || '').toLowerCase().includes(term) ||
        (p.type || '').toLowerCase().includes(term)
      );
    }

    // Sort list
    list.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [products, orderedProductIds, searchTerm, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const exportToExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('My Products');

      sheet.columns = [
        { header: 'Product Name', key: 'productName', width: 25 },
        { header: 'Category / Variety', key: 'category', width: 20 },
        { header: 'Type / Description', key: 'type', width: 25 }
      ];

      filteredProducts.forEach((p) => {
        sheet.addRow({
          productName: p.productName || '',
          category: p.category || '',
          type: p.type || ''
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Products_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({ title: 'Export Successful', description: 'Excel spreadsheet has been generated.' });
    } catch (e) {
      toast({ title: 'Export Failed', description: 'Could not generate Excel spreadsheet.', variant: 'destructive' });
    }
  };

  const exportToPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text('Customer Ordered Products Catalog', 14, 20);
      doc.setFontSize(10);
      doc.text(`Customer: ${customer?.companyName || 'N/A'}`, 14, 28);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 34);

      const tableData = filteredProducts.map(p => [
        p.productName || '',
        p.category || '',
        p.type || ''
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['Product Name', 'Category / Variety', 'Type / Description']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [46, 29, 82] }
      });

      doc.save(`Products_Catalog_${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: 'Export Successful', description: 'PDF catalog has been generated.' });
    } catch (e) {
      toast({ title: 'Export Failed', description: 'Could not generate PDF catalog.', variant: 'destructive' });
    }
  };

  function anyDb() {
    return (window as any).firestoreDb || null;
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#2e1d52] uppercase tracking-tight">My Products</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Browse the varieties and catalog configurations registered under your purchases.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={exportToExcel} variant="outline" className="h-11 rounded-xl font-bold uppercase tracking-wider text-xs gap-2">
            <FileDown size={14} /> Export Excel
          </Button>
          <Button onClick={exportToPDF} variant="outline" className="h-11 rounded-xl font-bold uppercase tracking-wider text-xs gap-2">
            <FileDown size={14} /> Export PDF
          </Button>
        </div>
      </div>

      {/* Search Filter */}
      <Card className="border-none shadow-sm rounded-2xl bg-white">
        <CardContent className="p-4">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4.5 w-4.5" />
            <Input 
              placeholder="Search products by name, category or variety type..." 
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-10 h-11 bg-slate-50 border-slate-100 rounded-xl text-sm font-semibold focus-visible:ring-primary"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className="border-none shadow-sm rounded-3xl bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#2e1d52]/5">
                <TableRow className="hover:bg-transparent border-b border-slate-100">
                  <TableHead onClick={() => toggleSort('productName')} className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-[#2e1d52]/80 py-5 px-6 select-none">
                    <span className="flex items-center gap-1">Product Name <ArrowUpDown size={12} /></span>
                  </TableHead>
                  <TableHead onClick={() => toggleSort('category')} className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-[#2e1d52]/80 py-5 px-6 select-none">
                    <span className="flex items-center gap-1">Category / Variety <ArrowUpDown size={12} /></span>
                  </TableHead>
                  <TableHead onClick={() => toggleSort('type')} className="cursor-pointer text-[10px] font-black uppercase tracking-widest text-[#2e1d52]/80 py-5 px-6 select-none">
                    <span className="flex items-center gap-1">Type / Description <ArrowUpDown size={12} /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsLoading || ordersLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="border-b border-slate-50">
                      <TableCell colSpan={3} className="py-6 px-6">
                        <div className="h-10 w-full animate-pulse bg-slate-100 rounded-xl" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginatedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-20 text-center text-slate-400 italic">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="h-10 w-10 opacity-20" />
                        <p>No products purchased or linked to your account.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedProducts.map((p, index) => (
                    <TableRow key={index} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                      <TableCell className="px-6 py-4.5 text-sm font-bold text-[#2e1d52]">{p.productName}</TableCell>
                      <TableCell className="px-6 py-4.5 text-sm text-slate-500 font-semibold">{p.category || '—'}</TableCell>
                      <TableCell className="px-6 py-4.5 text-sm text-slate-500 font-semibold">{p.type || '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-400">Page {currentPage} of {totalPages}</span>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                  disabled={currentPage === 1}
                  variant="outline" 
                  size="sm"
                  className="h-9 rounded-lg font-bold"
                >
                  <ChevronLeft size={16} /> Prev
                </Button>
                <Button 
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                  disabled={currentPage === totalPages}
                  variant="outline" 
                  size="sm"
                  className="h-9 rounded-lg font-bold"
                >
                  Next <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
