'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  useCollection, 
  useFirestore, 
  useMemoFirebase,
  useUser,
  errorEmitter,
  FirestorePermissionError
} from '@/firebase';
import { 
  collection, 
  query, 
  deleteDoc, 
  doc 
} from '@/firebase/firestore-override';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Search, 
  Filter, 
  X, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Download, 
  Building2, 
  History,
  FileText,
  SlidersHorizontal,
  Menu,
  Maximize2,
  Columns
} from 'lucide-react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/use-permissions';

export default function CustomersListingPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { canAdd, canUpdate, canDelete } = usePermissions('sales.customers');

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterPhone, setFilterPhone] = useState('');
  const [filterWebsite, setFilterWebsite] = useState('');
  const [filterIncoterm, setFilterIncoterm] = useState('all');
  const [filterCurrency, setFilterCurrency] = useState('all');
  const [filterVat, setFilterVat] = useState('');
  const [filterPaymentTerms, setFilterPaymentTerms] = useState('');
  const [filterCreatedBy, setFilterCreatedBy] = useState('');
  const [filterUpdatedBy, setFilterUpdatedBy] = useState('');

  const customersQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'customers'));
  }, [db, user]);

  const termsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'payment_terms');
  }, [db, user]);

  const { data: customers, isLoading } = useCollection(customersQuery);
  const { data: terms } = useCollection(termsQuery);

  const termsMap = useMemo(() => {
    const map: Record<string, string> = {};
    terms?.forEach(t => { map[t.id] = t.name || t.label || 'N/A'; });
    return map;
  }, [terms]);

  const isAnyFilterActive = useMemo(() => {
    return !!(
      filterName || filterEmail || filterPhone || filterWebsite ||
      (filterIncoterm !== 'all' && filterIncoterm !== '') ||
      (filterCurrency !== 'all' && filterCurrency !== '') ||
      filterVat || filterPaymentTerms || filterCreatedBy || filterUpdatedBy
    );
  }, [
    filterName, filterEmail, filterPhone, filterWebsite,
    filterIncoterm, filterCurrency, filterVat,
    filterPaymentTerms, filterCreatedBy, filterUpdatedBy
  ]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const list = customers.filter(c => {
      const nameMatch = !filterName || (c.companyName || '').toLowerCase().includes(filterName.toLowerCase());
      const emailMatch = !filterEmail || (c.email || '').toLowerCase().includes(filterEmail.toLowerCase());
      const phoneMatch = !filterPhone || (c.phone || '').toLowerCase().includes(filterPhone.toLowerCase());
      const websiteMatch = !filterWebsite || (c.website || '').toLowerCase().includes(filterWebsite.toLowerCase());
      const incotermMatch = filterIncoterm === 'all' || !filterIncoterm || (c.incoterm || 'DAP') === filterIncoterm;
      const currencyMatch = filterCurrency === 'all' || !filterCurrency || (c.currency || 'EUR') === filterCurrency;
      const vatMatch = !filterVat || (c.vat || '').toLowerCase().includes(filterVat.toLowerCase());
      const termName = termsMap[c.payment_term_id || c.paymentTermsId] || c.paymentTerms || '';
      const termsMatch = !filterPaymentTerms || termName.toLowerCase().includes(filterPaymentTerms.toLowerCase());
      const createdByMatch = !filterCreatedBy || (c.createdBy || '').toLowerCase().includes(filterCreatedBy.toLowerCase());
      const updatedByMatch = !filterUpdatedBy || (c.updatedBy || '').toLowerCase().includes(filterUpdatedBy.toLowerCase());

      return nameMatch && emailMatch && phoneMatch && websiteMatch && incotermMatch && currencyMatch && vatMatch && termsMatch && createdByMatch && updatedByMatch;
    });
    return list.sort((a, b) => {
      const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [customers, filterName, filterEmail, filterPhone, filterWebsite, filterIncoterm, filterCurrency, filterVat, filterPaymentTerms, filterCreatedBy, filterUpdatedBy, termsMap]);

  const resetFilters = () => {
    setFilterName('');
    setFilterEmail('');
    setFilterPhone('');
    setFilterWebsite('');
    setFilterIncoterm('all');
    setFilterCurrency('all');
    setFilterVat('');
    setFilterPaymentTerms('');
    setFilterCreatedBy('');
    setFilterUpdatedBy('');
  };

  const handleDelete = async (id: string) => {
    if (!db || !confirm('Are you sure you want to delete this customer?')) return;
    const docRef = doc(db, 'customers', id);
    try {
      await deleteDoc(docRef);
      toast({ title: "Customer Removed", description: "The partner record has been deleted." });
    } catch (error: any) {
      console.error("Error deleting customer:", error);
      if (error?.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete'
        }));
      } else {
        toast({
          variant: "destructive",
          title: "Delete Failed",
          description: error?.message || "Failed to delete customer.",
        });
      }
    }
  };

  const handleExportExcel = async () => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Sales Customers', {
        pageSetup: {
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: {
            left: 0.7, right: 0.7, top: 0.7, bottom: 0.7, header: 0.3, footer: 0.3
          },
          printTitlesRow: '6:6'
        }
      });

      // --- 1. ADD LOGO ---
      try {
        const response = await fetch('/FFI_main.png');
        if (response.ok) {
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const imageId = workbook.addImage({
            buffer: arrayBuffer,
            extension: 'png',
          });
          sheet.addImage(imageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 140, height: 70 }
          });
        }
      } catch (e) {
        console.warn('Could not load logo', e);
      }

      for (let i = 0; i < 5; i++) {
        sheet.addRow([]);
      }

      sheet.getRow(1).height = 15;
      sheet.getRow(2).height = 20;
      sheet.getRow(3).height = 20;
      sheet.getRow(4).height = 15;
      sheet.getRow(5).height = 15;

      sheet.mergeCells('B2:P3');
      const titleCell = sheet.getCell('B2');
      titleCell.value = 'SALES CUSTOMERS REPORT';
      titleCell.font = { size: 18, bold: true, color: { argb: 'FF333333' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

      sheet.columns = [
        { key: 'companyId', width: 20 },
        { key: 'companyName', width: 35 },
        { key: 'email', width: 30 },
        { key: 'phone', width: 20 },
        { key: 'website', width: 25 },
        { key: 'incoterm', width: 15 },
        { key: 'currency', width: 12 },
        { key: 'vat', width: 20 },
        { key: 'paymentTerms', width: 25 },
        
        { key: 'address', width: 45 },
        { key: 'addressType', width: 15 },
        { key: 'addressEmail', width: 30 },
        { key: 'addressPhone', width: 20 },
        { key: 'addressStreet', width: 35 },
        
        { key: 'brokerName', width: 25 },
        { key: 'brokerPhone', width: 20 },
        { key: 'brokerEmail', width: 30 },
        { key: 'brokerCoCode', width: 15 },
        { key: 'brokerPhytoType', width: 15 },
        { key: 'brokerAddress', width: 45 },
        
        { key: 'contactName', width: 25 },
        { key: 'contactPhone', width: 20 },
        { key: 'contactEmail', width: 30 },
        { key: 'contactFunction', width: 20 },
        
        { key: 'contractDocName', width: 30 },
        { key: 'contractDocType', width: 20 },
        { key: 'contractDocFile', width: 50 },
        
        { key: 'farmName', width: 25 },
        { key: 'farmGgn', width: 20 },
        { key: 'farmSize', width: 15 },
        { key: 'farmCrops', width: 25 },
        
        { key: 'locationName', width: 25 },
        { key: 'locationGps', width: 20 },
        { key: 'locationDesc', width: 50 },
        
        { key: 'userName', width: 25 },
        { key: 'userEmail', width: 35 },
        { key: 'userFunction', width: 20 },
        { key: 'userType', width: 15 }
      ];

      const headerRow = sheet.getRow(6);
      headerRow.values = [
        'Company ID', 'Company Name', 'Email', 'Phone Number', 'Website', 'Incoterm', 'Currency', 'VAT', 'Payment Terms',
        'Address', 'Address Type', 'Address Email', 'Address Phone Number', 'Address Street',
        'Broker Name', 'Broker Phone Number', 'Broker Email', 'Broker CO Code', 'Broker Phyto Type', 'Broker Address',
        'Contact Name', 'Contact Phone Number', 'Contact Email', 'Contact Function',
        'Contract Document Name', 'Contract Document Type', 'Contract Document File',
        'Farm Name', 'Farm GGN Number', 'Farm Size', 'Farm Estimated Crops',
        'Location Name', 'Location GPS', 'Location Description',
        'User Name', 'User Email', 'User Function', 'User Type'
      ];
      headerRow.height = 30;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FF333333' }, size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF333333' } },
          bottom: { style: 'medium', color: { argb: 'FF333333' } },
          left: { style: 'thin', color: { argb: 'FF333333' } },
          right: { style: 'thin', color: { argb: 'FF333333' } }
        };
      });

      sheet.views = [ { state: 'frozen', ySplit: 6 } ];
      sheet.autoFilter = {
        from: { row: 6, column: 1 },
        to: { row: 6, column: 38 }
      };

      const formatValue = (val: any) => {
        if (val === undefined || val === null || val === '') return '*';
        if (typeof val === 'string' && val.trim() === '') return '*';
        return val;
      };

      let currentRowIdx = 7;
      filteredCustomers.forEach((c, index) => {
        const addresses = [...(c.registeredAddresses || []), ...(c.addresses || [])];
        const brokers = c.brokers || [];
        const contacts = c.contacts || [];
        const contracts = c.contracts || [];
        const farms = c.farms || [];
        const locations = c.locations || [];
        const users = c.users || [];

        const maxRows = Math.max(
          addresses.length,
          brokers.length,
          contacts.length,
          contracts.length,
          farms.length,
          locations.length,
          users.length,
          1
        );

        const startRow = currentRowIdx;

        for (let i = 0; i < maxRows; i++) {
          const adr = addresses[i] || {};
          const brk = brokers[i] || {};
          const cnt = contacts[i] || {};
          const ctr = contracts[i] || {};
          const frm = farms[i] || {};
          const loc = locations[i] || {};
          const usr = users[i] || {};

          sheet.addRow({
            companyId: i === 0 ? formatValue(index + 1) : undefined,
            companyName: i === 0 ? formatValue(c.companyName) : undefined,
            email: i === 0 ? formatValue(c.email) : undefined,
            phone: i === 0 ? formatValue(c.phone) : undefined,
            website: i === 0 ? formatValue(c.website) : undefined,
            incoterm: i === 0 ? formatValue(c.incoterm) : undefined,
            currency: i === 0 ? formatValue(c.currency) : undefined,
            vat: i === 0 ? formatValue(c.vat) : undefined,
            paymentTerms: i === 0 ? formatValue(termsMap[c.payment_term_id || c.paymentTermsId] || c.paymentTerms) : undefined,
            
            address: formatValue(adr.name || adr.label),
            addressType: formatValue(adr.type),
            addressEmail: formatValue(adr.email),
            addressPhone: formatValue(adr.phone),
            addressStreet: formatValue(adr.street || adr.address),
            
            brokerName: formatValue(brk.name),
            brokerPhone: formatValue(brk.phone),
            brokerEmail: formatValue(brk.email),
            brokerCoCode: formatValue(brk.coCode),
            brokerPhytoType: formatValue(brk.phytoType),
            brokerAddress: formatValue(brk.address),
            
            contactName: formatValue(cnt.name),
            contactPhone: formatValue(cnt.phone),
            contactEmail: formatValue(cnt.email),
            contactFunction: formatValue(cnt.function || cnt.role),
            
            contractDocName: formatValue(ctr.documentName || ctr.name),
            contractDocType: formatValue(ctr.documentType || ctr.type),
            contractDocFile: formatValue(ctr.fileUrl || ctr.fileName || ctr.file),
            
            farmName: formatValue(frm.name),
            farmGgn: formatValue(frm.ggnNumber || frm.ggn),
            farmSize: formatValue(frm.size),
            farmCrops: formatValue(frm.estimatedCrops || frm.crops),
            
            locationName: formatValue(loc.name),
            locationGps: formatValue(loc.gps),
            locationDesc: formatValue(loc.description),
            
            userName: formatValue(usr.name),
            userEmail: formatValue(usr.email),
            userFunction: formatValue(usr.function || usr.role),
            userType: formatValue(usr.type)
          });

          currentRowIdx++;
        }

        const endRow = currentRowIdx - 1;

        if (maxRows > 1) {
          for (let col = 1; col <= 9; col++) {
            sheet.mergeCells(startRow, col, endRow, col);
          }
        }

        for (let r = startRow; r <= endRow; r++) {
          const row = sheet.getRow(r);
          row.height = 22;

          const isGreen = (r - startRow) % 2 === 1;
          const zebraFillColor = isGreen ? 'FFE2EFDA' : 'FFFFFFFF';

          for (let col = 1; col <= 38; col++) {
            const cell = row.getCell(col);

            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: zebraFillColor }
            };

            cell.border = {
              top: { style: r === startRow ? 'medium' : 'thin', color: { argb: 'FF808080' } },
              bottom: { style: r === endRow ? 'medium' : 'thin', color: { argb: 'FF808080' } },
              left: { style: col === 1 ? 'medium' : 'thin', color: { argb: 'FF808080' } },
              right: { style: col === 38 ? 'medium' : 'thin', color: { argb: 'FF808080' } }
            };

            if (col <= 9) {
              cell.alignment = {
                vertical: 'middle',
                horizontal: 'left',
                wrapText: true
              };
            } else {
              const shouldWrap = [10, 20, 27, 34].includes(col);
              const isCenterAlign = [11, 13, 16, 18, 19, 22, 29, 30, 33, 38].includes(col);

              cell.alignment = {
                vertical: 'middle',
                horizontal: isCenterAlign ? 'center' : 'left',
                wrapText: shouldWrap
              };
            }

            cell.font = {
              name: 'Segoe UI',
              size: 9,
              color: { argb: 'FF333333' }
            };
          }
        }

        sheet.addRow([]);
        const emptyRow = sheet.getRow(currentRowIdx);
        emptyRow.height = 15;
        for (let col = 1; col <= 38; col++) {
          const cell = emptyRow.getCell(col);
          cell.fill = { type: 'pattern', pattern: 'none' };
          cell.border = {};
        }
        currentRowIdx++;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Sales Customers.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Export Error:', err);
      toast({ title: 'Export Failed', description: 'Failed to generate Excel file.', variant: 'destructive' });
    }
  };

  return (
    <div className="w-full p-8 space-y-6 animate-in fade-in duration-500">

      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Customers</h1>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">Profile / Customers</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button 
            onClick={handleExportExcel} 
            title="Export Excel"
            className="bg-[#709506] hover:bg-[#5c7a05] text-white h-10 w-10 p-0 rounded-lg shadow-sm transition-all flex items-center justify-center"
          >
            <Download size={18} />
          </Button>

          {canAdd && (
            <Button 
              asChild
              title="Add Customer"
              className="bg-[#709506] hover:bg-[#5c7a05] text-white h-10 w-10 p-0 rounded-lg shadow-sm transition-all flex items-center justify-center"
            >
              <Link href="/sales/customers/add">
                <Plus size={20} />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Card (Matching exact user screenshot) */}
      <Card className="border border-gray-100 shadow-sm rounded-xl bg-white p-6 overflow-hidden">
        <div className="space-y-4">
          {/* Row 1: Customer Name, Email, Phone Number */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 block">Customer Name:</label>
              <Input
                placeholder="Customer Name"
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                className="h-10 rounded-lg border-gray-200 bg-white text-sm font-normal focus-visible:ring-1 focus-visible:ring-[#709506]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 block">Email:</label>
              <Input
                placeholder="Email Address"
                value={filterEmail}
                onChange={e => setFilterEmail(e.target.value)}
                className="h-10 rounded-lg border-gray-200 bg-white text-sm font-normal focus-visible:ring-1 focus-visible:ring-[#709506]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-400 block">Phone Number:</label>
              <Input
                placeholder="Phone Number"
                value={filterPhone}
                onChange={e => setFilterPhone(e.target.value)}
                className="h-10 rounded-lg border-gray-200 bg-white text-sm font-normal focus-visible:ring-1 focus-visible:ring-[#709506]"
              />
            </div>
          </div>

          {/* Row 2: Select Incoterms & Filter / Clear buttons */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-1">
            <div className="w-full sm:w-1/3 space-y-1.5">
              <label className="text-xs font-medium text-gray-400 block">Select Incoterms:</label>
              <Select value={filterIncoterm} onValueChange={setFilterIncoterm}>
                <SelectTrigger className="h-10 rounded-lg border-gray-200 bg-white text-sm font-normal focus:ring-1 focus:ring-[#709506]">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Select</SelectItem>
                  {['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'].map(term => (
                    <SelectItem key={term} value={term}>{term}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 pb-0.5">
              <Button 
                onClick={() => {}} 
                className="bg-[#709506] hover:bg-[#5c7a05] text-white font-bold text-xs h-10 px-6 rounded-lg shadow-sm transition-all"
              >
                Filter
              </Button>
              <Button 
                onClick={resetFilters} 
                className="bg-[#709506] hover:bg-[#5c7a05] text-white font-bold h-10 w-10 p-0 rounded-lg shadow-sm transition-all flex items-center justify-center"
                title="Clear Filters"
              >
                <X size={18} />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Toolbar & Table Section */}
      <div className="space-y-3">
        {/* Right-aligned Table Control Icons Toolbar */}
        <div className="flex items-center justify-end gap-4 text-gray-400 px-1">
          <button 
            title="Search" 
            className="hover:text-gray-700 transition-colors p-1"
          >
            <Search size={18} />
          </button>
          <button 
            title="Toggle Inline Column Filters" 
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`hover:text-gray-700 transition-colors p-1 ${showAdvancedFilters ? 'text-[#709506] font-bold' : ''}`}
          >
            <Filter size={18} />
          </button>
          <button 
            title="Columns" 
            className="hover:text-gray-700 transition-colors p-1"
          >
            <Columns size={18} />
          </button>
          <button 
            title="Density" 
            className="hover:text-gray-700 transition-colors p-1"
          >
            <Menu size={18} />
          </button>
          <button 
            title="Fullscreen" 
            className="hover:text-gray-700 transition-colors p-1"
          >
            <Maximize2 size={18} />
          </button>
        </div>

        {/* Table Card */}
        <Card className="border border-gray-100 shadow-xl rounded-2xl bg-white overflow-hidden w-full">
          <Table>
            <TableHeader className="bg-primary/5">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-[60px] py-4 pl-6"></TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 whitespace-nowrap">Full Name & Logo</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 whitespace-nowrap">Email Address</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 whitespace-nowrap">Phone Number</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 whitespace-nowrap">Corporate Website</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-center whitespace-nowrap">Incoterm</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-center whitespace-nowrap">Currency</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 whitespace-nowrap">VAT / Tax ID</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 whitespace-nowrap">Payment Terms</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 whitespace-nowrap">Created By</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-primary/70 py-4 text-right pr-6 whitespace-nowrap">Updated By</TableHead>
              </TableRow>

              {/* Advanced Field Filters Row (Toggled via Filter icon) */}
              {showAdvancedFilters && (
                <TableRow className="bg-emerald-50/40 border-b border-primary/10 transition-all">
                  <TableCell className="pl-6 py-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={resetFilters} 
                      title="Reset All Filters"
                      className="h-8 w-8 text-rose-500 hover:bg-rose-100/60 rounded-lg"
                    >
                      <X size={14} />
                    </Button>
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      placeholder="Filter name..."
                      value={filterName}
                      onChange={e => setFilterName(e.target.value)}
                      className="h-8 text-xs bg-white rounded-lg border-muted/60 focus-visible:ring-1 focus-visible:ring-[#709506] font-medium"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      placeholder="Filter email..."
                      value={filterEmail}
                      onChange={e => setFilterEmail(e.target.value)}
                      className="h-8 text-xs bg-white rounded-lg border-muted/60 focus-visible:ring-1 focus-visible:ring-[#709506] font-medium"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      placeholder="Filter phone..."
                      value={filterPhone}
                      onChange={e => setFilterPhone(e.target.value)}
                      className="h-8 text-xs bg-white rounded-lg border-muted/60 focus-visible:ring-1 focus-visible:ring-[#709506] font-medium"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      placeholder="Filter website..."
                      value={filterWebsite}
                      onChange={e => setFilterWebsite(e.target.value)}
                      className="h-8 text-xs bg-white rounded-lg border-muted/60 focus-visible:ring-1 focus-visible:ring-[#709506] font-medium"
                    />
                  </TableCell>
                  <TableCell className="py-2 min-w-[100px]">
                    <Select value={filterIncoterm} onValueChange={setFilterIncoterm}>
                      <SelectTrigger className="h-8 text-xs bg-white rounded-lg border-muted/60 focus:ring-1 focus:ring-[#709506] font-medium">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'].map(term => (
                          <SelectItem key={term} value={term}>{term}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2 min-w-[90px]">
                    <Select value={filterCurrency} onValueChange={setFilterCurrency}>
                      <SelectTrigger className="h-8 text-xs bg-white rounded-lg border-muted/60 focus:ring-1 focus:ring-[#709506] font-medium">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {['EUR', 'USD', 'DH', 'GBP'].map(curr => (
                          <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      placeholder="Filter VAT..."
                      value={filterVat}
                      onChange={e => setFilterVat(e.target.value)}
                      className="h-8 text-xs bg-white rounded-lg border-muted/60 focus-visible:ring-1 focus-visible:ring-[#709506] font-medium"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      placeholder="Filter terms..."
                      value={filterPaymentTerms}
                      onChange={e => setFilterPaymentTerms(e.target.value)}
                      className="h-8 text-xs bg-white rounded-lg border-muted/60 focus-visible:ring-1 focus-visible:ring-[#709506] font-medium"
                    />
                  </TableCell>
                  <TableCell className="py-2">
                    <Input
                      placeholder="Filter creator..."
                      value={filterCreatedBy}
                      onChange={e => setFilterCreatedBy(e.target.value)}
                      className="h-8 text-xs bg-white rounded-lg border-muted/60 focus-visible:ring-1 focus-visible:ring-[#709506] font-medium"
                    />
                  </TableCell>
                  <TableCell className="py-2 pr-6">
                    <Input
                      placeholder="Filter editor..."
                      value={filterUpdatedBy}
                      onChange={e => setFilterUpdatedBy(e.target.value)}
                      className="h-8 text-xs bg-white rounded-lg border-muted/60 focus-visible:ring-1 focus-visible:ring-[#709506] font-medium"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-none">
                    <TableCell colSpan={11} className="py-6">
                      <Skeleton className="h-10 w-full rounded-lg" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredCustomers.length === 0 ? (
                <TableRow className="border-none">
                  <TableCell colSpan={11} className="h-64 text-center text-muted-foreground font-medium italic opacity-60">
                    <div className="flex flex-col items-center gap-3">
                      <History className="h-12 w-12 opacity-10" />
                      <p>No customer records found matching your criteria.</p>
                      <Button variant="link" onClick={resetFilters} className="text-primary font-bold">
                        Clear All Filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-primary/[0.02] transition-colors border-b border-muted/20 group">
                    <TableCell className="pl-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-all">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48 p-1 rounded-xl shadow-2xl border-primary/10">
                          {canUpdate && (
                            <DropdownMenuItem className="gap-2 cursor-pointer font-bold text-xs uppercase py-2.5" asChild>
                              <Link href={`/sales/customers/edit/${customer.id}`}>
                                <Edit2 size={14} className="text-primary" /> Edit Profile
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="gap-2 cursor-pointer font-bold text-xs uppercase py-2.5" asChild>
                            <Link href={`/sales/customers/view/${customer.id}`}>
                              <FileText size={14} className="text-primary" /> View Details
                            </Link>
                          </DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem
                              className="gap-2 text-rose-500 cursor-pointer font-bold text-xs uppercase py-2.5"
                              onClick={() => handleDelete(customer.id)}
                            >
                              <Trash2 size={14} /> Archive Partner
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Link href={`/sales/customers/view/${customer.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <Avatar className="h-10 w-10 border-2 border-primary/10 group-hover:border-primary/40 transition-all shadow-sm flex-shrink-0">
                          <AvatarImage src={customer.logoUrl || ''} />
                          <AvatarFallback className="bg-primary/5 text-primary font-bold">
                            {customer.companyName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-bold text-sm text-primary hover:underline">{customer.companyName}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium text-xs text-muted-foreground whitespace-nowrap">{customer.email || '-'}</TableCell>
                    <TableCell className="font-bold text-xs text-muted-foreground whitespace-nowrap">{customer.phone || '-'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {customer.website ? (
                        <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-bold hover:underline truncate max-w-[200px] block">
                          {customer.website}
                        </a>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center whitespace-nowrap">
                      <Badge variant="outline" className="text-[10px] font-black tracking-widest border-primary/20 text-primary bg-primary/5">
                        {customer.incoterm || 'DAP'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-black text-xs text-primary/70 whitespace-nowrap">{customer.currency || 'EUR'}</TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground tracking-tighter whitespace-nowrap">{customer.vat || 'N/A'}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="text-[11px] font-bold text-muted-foreground">
                        {termsMap[customer.payment_term_id || customer.paymentTermsId] || customer.paymentTerms || 'Custom Terms'}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">{customer.createdBy?.split('@')[0] || 'System'}</span>
                        <span className="text-[9px] opacity-40 font-medium">
                          {customer.createdAt ? new Date(customer.createdAt.seconds * 1000).toLocaleDateString() : 'Initial'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6 whitespace-nowrap">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{customer.updatedBy?.split('@')[0] || 'System'}</span>
                        <span className="text-[9px] opacity-40 font-medium">
                          {customer.updatedAt ? new Date(customer.updatedAt.seconds * 1000).toLocaleDateString() : 'Initial'}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Bottom Pagination Bar */}
          <div className="p-4 border-t bg-muted/10 flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <span>Showing {filteredCustomers.length} Partner(s)</span>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" disabled className="h-8 px-4 rounded-lg opacity-50">Previous</Button>
              <div className="h-8 w-8 bg-[#709506] text-white rounded-lg flex items-center justify-center">1</div>
              <Button variant="ghost" size="sm" disabled className="h-8 px-4 rounded-lg opacity-50">Next</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
