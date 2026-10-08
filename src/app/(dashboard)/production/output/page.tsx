'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  useUser,
} from '@/firebase';
import {
  collection,
  query,
  orderBy,
  deleteDoc,
  doc,
  where,
} from '@/firebase/firestore-override';
import { generateProductionOutputPDF } from '@/lib/export-production-output-pdf';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Download, 
  Search, 
  Filter, 
  X, 
  MoreVertical, 
  Edit2, 
  Trash2,
  Calendar,
  Clock,
  MapPin,
  Package,
  Layers,
  User,
  History,
  FileText,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ExcelJS from 'exceljs';
import { usePermissions } from '@/hooks/use-permissions';

export default function ProductionOutputPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { canAdd, canUpdate, canDelete } = usePermissions('production.output');

  // Filters State
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Tab State
  const [activeTab, setActiveTab] = useState('detailed');

  // Queries
  const outputQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'production_output'));
  }, [db]);

  const productsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'products');
  }, [db]);

  const { data: outputs, isLoading, error: outputsError } = useCollection(outputQuery);
  const { data: products } = useCollection(productsQuery);

  if (outputsError) {
    console.error("Error loading production outputs:", outputsError);
  }

  // Filtering Logic
  const filteredOutputs = useMemo(() => {
    if (!outputs) return [];
    return outputs
      .slice()
      .sort((a, b) => {
        const getTimestamp = (item: any) => {
          if (item?.createdAt?.toMillis) return item.createdAt.toMillis();
          if (item?.createdAt?.seconds) return item.createdAt.seconds * 1000;
          if (item?.createdAt) {
            const d = new Date(item.createdAt).getTime();
            if (!isNaN(d)) return d;
          }
          if (item?.shiftDate) {
            const d = new Date(item.shiftDate).getTime();
            if (!isNaN(d)) return d;
          }
          return 0;
        };
        return getTimestamp(b) - getTimestamp(a);
      })
      .filter(item => {
        // Search
        const searchStr = `${item.orderPoNumber || ''} ${item.locationName || ''} ${item.palletisationType || ''} ${item.barcode || ''}`.toLowerCase();
        if (searchTerm && !searchStr.includes(searchTerm.toLowerCase())) return false;

        // Shift
        if (shiftFilter !== 'all' && item.shift !== shiftFilter) return false;

        // Dates
        if (startDate && item.shiftDate < startDate) return false;
        if (endDate && item.shiftDate > endDate) return false;

        return true;
      });
  }, [outputs, searchTerm, shiftFilter, startDate, endDate]);

  // Tab 1: Group By Shift Date And Location
  const groupedByShiftLocation = useMemo(() => {
    const groups: Record<string, { shiftDate: string; location: string; totalNetWeight: number; totalPallets: number }> = {};
    
    filteredOutputs.forEach(output => {
      const key = `${output.shiftDate}_${output.locationName}`;
      if (!groups[key]) {
        groups[key] = {
          shiftDate: output.shiftDate,
          location: output.locationName || 'Unknown',
          totalNetWeight: 0,
          totalPallets: 0,
        };
      }
      
      const palletNetWeight = output.items?.reduce((sum: number, item: any) => sum + (Number(item.netWeight) || 0), 0) || 0;
      groups[key].totalNetWeight += palletNetWeight;
      groups[key].totalPallets += 1;
    });

    return Object.values(groups).sort((a, b) => (b.shiftDate || '').localeCompare(a.shiftDate || ''));
  }, [filteredOutputs]);

  // Tab 2: Group By Pallet Type
  const groupedByPalletType = useMemo(() => {
    const types = ['Final product', 'decay', 'Return', 'Small caliber', 'Local Market', 'Reste', 'Out Of Program'];
    const groups: Record<string, { palletType: string; numPallets: number; totalNetWeight: number }> = {};
    
    // Initialize groups
    types.forEach(type => {
      groups[type] = { palletType: type, numPallets: 0, totalNetWeight: 0 };
    });

    filteredOutputs.forEach(output => {
      const type = output.palletisationType || 'Unknown';
      if (!groups[type]) {
        groups[type] = { palletType: type, numPallets: 0, totalNetWeight: 0 };
      }
      
      const palletNetWeight = output.items?.reduce((sum: number, item: any) => sum + (Number(item.netWeight) || 0), 0) || 0;
      groups[type].numPallets += 1;
      groups[type].totalNetWeight += palletNetWeight;
    });

    return Object.values(groups).filter(g => g.numPallets > 0 || types.includes(g.palletType));
  }, [filteredOutputs]);

  // Tab 3: Detailed Flat Rows
  const detailedRows = useMemo(() => {
    const rows: any[] = [];
    filteredOutputs.forEach(output => {
      if (output.items && output.items.length > 0) {
        output.items.forEach((item: any, idx: number) => {
          const product = products?.find(p => p.id === item.productId);
          rows.push({
            ...output,
            ...item,
            productName: item.productName || product?.productName || 'Unknown Product',
            variety: item.variety || product?.variety || product?.category || 'No Variety',
            productCategory: product?.category || '',
            productType: product?.type || '',
            rowId: `${output.id}_${idx}`,
            palletId: output.id,
          });
        });
      } else {
        rows.push({
          ...output,
          productName: 'No items',
          variety: '-',
          productCategory: '',
          productType: '',
          rowId: `${output.id}_0`,
          palletId: output.id,
        });
      }
    });
    return rows;
  }, [filteredOutputs, products]);

  const handleDelete = async (id: string) => {
    if (!db || !confirm('Are you sure you want to delete this record?')) return;
    try {
      const { getDoc, getDocs, collection, query, where } = await import('firebase/firestore');
      const docRef = doc(db, 'production_output', id);
      const snap = await getDoc(docRef);
      const locationId = snap.exists() ? snap.data().locationId : null;

      // Delete associated stock_situations for FEUILLARD
      const stockQ = query(
        collection(db, 'stock_situations'),
        where('sourceId', '==', id),
        where('sourceType', '==', 'production_consumption')
      );
      const stockDocs = await getDocs(stockQ);
      for (const d of stockDocs.docs) {
        await deleteDoc(doc(db, 'stock_situations', d.id));
      }

      await deleteDoc(docRef);

      if (locationId) {
        const { recalculateStockCounters } = await import('@/lib/stock-situation-utils');
        await recalculateStockCounters(db, locationId);
      }

      toast({ title: "Success", description: "Record deleted successfully" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete record" });
    }
  };

  const handleDownloadPDF = async (output: any) => {
    try {
      // Need to format the data for the PDF
      const locationName = output.locationName || '';
      const orderPoNumber = output.orderPoNumber || '';
      const packagingTypeName = output.packagingTypeName || '';
      
      const processedItems = output.items?.map((item: any) => {
        const p = products?.find((prod: any) => prod.id === item.productId);
        return {
          ...item,
          productName: item.productName || p?.productName || 'Unknown',
          variety: item.variety || p?.variety || p?.category || 'Unknown'
        };
      }) || [];

      await generateProductionOutputPDF({
        ...output,
        locationName,
        orderPoNumber,
        packagingTypeName,
        items: processedItems
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate PDF.",
      });
    }
  };

  const handleExportExcel = async () => {
    if (!detailedRows || detailedRows.length === 0) {
      toast({ title: "No Data", description: "There is no data to export.", variant: "default" });
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Production Output");

    // Define columns with widths
    worksheet.columns = [
      { header: 'Barcode Number', key: 'barcode', width: 25 },
      { header: 'Date Time', key: 'dateTime', width: 22 },
      { header: 'Product', key: 'product', width: 45 },
      { header: 'Caliber', key: 'caliber', width: 15 },
      { header: 'Lot Number', key: 'lotNumber', width: 20 },
      { header: 'Shift', key: 'shift', width: 10 },
      { header: 'Shift Date', key: 'shiftDate', width: 18 },
      { header: 'PO Number', key: 'poNumber', width: 20 },
      { header: 'GGN Number', key: 'ggnNumber', width: 20 },
      { header: 'Pallet Type', key: 'palletType', width: 20 },
      { header: 'Net Weight', key: 'netWeight', width: 15 },
      { header: 'Number Of Items', key: 'numberOfItems', width: 18 },
      { header: 'Package Type', key: 'packageType', width: 30 },
      { header: 'Location', key: 'location', width: 25 },
    ];

    // Add rows
    detailedRows.forEach(row => {
      const productParts = [row.productName, row.productCategory, row.productType].filter(Boolean);
      const productDisplay = productParts.join(' - ');

      worksheet.addRow({
        barcode: row.barcode || row.palletId?.slice(-6).toUpperCase() || '',
        dateTime: row.dateTime || '',
        product: productDisplay,
        caliber: row.caliber || '',
        lotNumber: row.lotNumber || '',
        shift: row.shift || '',
        shiftDate: row.shiftDate || '',
        poNumber: row.palletisationType === 'Final product' ? (row.orderPoNumber || '') : '',
        ggnNumber: row.ggn || row.ggnNumber || '',
        palletType: row.palletisationType || '',
        netWeight: row.netWeight ? Number(row.netWeight) : 0,
        numberOfItems: row.numberOfBoxes ? Number(row.numberOfBoxes) : 0,
        packageType: row.packagingTypeName || '',
        location: row.locationName || '',
      });
    });

    // Style the header row (Colorful: White text, Green background)
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF059669' }, // Emerald-600
      };
      cell.font = {
        color: { argb: 'FFFFFFFF' },
        bold: true,
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    headerRow.height = 30;

    // Optional: add border to all cells for better readability
    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Production_Output_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setShiftFilter('all');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FBFBFF]">
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b border-primary/5 shadow-sm sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] mb-1">
              <span>Profile</span>
              <span className="opacity-30">/</span>
              <span className="text-primary/80">Production Output</span>
            </div>
            <h1 className="text-2xl font-black text-primary uppercase tracking-tight">Production Output</h1>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleExportExcel} className="h-11 px-4 rounded-xl border-primary/10 font-bold hover:bg-primary/5 transition-all gap-2">
              <Download className="h-4 w-4" /> EXPORT
            </Button>
            {canAdd && (
              <Button asChild className="h-11 px-6 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] gap-2">
                <Link href="/production/output/add">
                  <Plus className="h-4 w-4" /> ADD PRODUCTION OUTPUT
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 max-w-[1600px] mx-auto w-full space-y-6">
        {/* Filter Section */}
        <div className="bg-white p-4 rounded-2xl border border-primary/5 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/30" />
                <Input 
                  placeholder="Order #, Location, Type..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 rounded-xl bg-muted/30 border-none font-bold pl-10 focus-visible:ring-2 focus-visible:ring-primary/10 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5 w-[140px]">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Shift</Label>
              <Select value={shiftFilter} onValueChange={setShiftFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-muted/30 border-none font-bold focus:ring-2 focus:ring-primary/10">
                  <SelectValue placeholder="All Shifts" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-primary/5 shadow-2xl">
                  <SelectItem value="all" className="rounded-lg font-bold">All Shifts</SelectItem>
                  <SelectItem value="1" className="rounded-lg font-bold">Shift 1</SelectItem>
                  <SelectItem value="2" className="rounded-lg font-bold">Shift 2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 w-[180px]">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Start Date</Label>
              <Input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11 rounded-xl bg-muted/30 border-none font-bold focus-visible:ring-2 focus-visible:ring-primary/10 transition-all"
              />
            </div>

            <div className="space-y-1.5 w-[180px]">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">End Date</Label>
              <Input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 rounded-xl bg-muted/30 border-none font-bold focus-visible:ring-2 focus-visible:ring-primary/10 transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 transition-all">
                <Filter className="h-4 w-4" /> FILTER
              </Button>
              <Button variant="ghost" onClick={resetFilters} className="h-11 w-11 rounded-xl hover:bg-rose-50 text-rose-500 transition-all p-0">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs System */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white p-1 rounded-2xl border border-primary/5 shadow-sm h-14 w-fit inline-flex">
            <TabsTrigger 
              value="shift-location" 
              className="rounded-xl font-bold px-6 h-12 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-[11px] uppercase tracking-wider"
            >
              Shift Date & Location
            </TabsTrigger>
            <TabsTrigger 
              value="pallet-type" 
              className="rounded-xl font-bold px-6 h-12 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-[11px] uppercase tracking-wider"
            >
              Pallet Type
            </TabsTrigger>
            <TabsTrigger 
              value="detailed" 
              className="rounded-xl font-bold px-6 h-12 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-[11px] uppercase tracking-wider"
            >
              Detailed Output
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: GROUP BY SHIFT DATE AND LOCATION */}
          <TabsContent value="shift-location" className="m-0">
            <div className="bg-white rounded-3xl border border-primary/5 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#F8F7FF] border-b border-primary/5">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Shift Date</TableHead>
                      <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Location</TableHead>
                      <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right">Total Pallets</TableHead>
                      <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right">Total Net Weight (KG)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedByShiftLocation.map((group, idx) => (
                      <TableRow key={idx} className="border-b border-primary/5 last:border-0 hover:bg-primary/[0.01] transition-all group">
                        <TableCell className="px-6 py-4 font-bold text-primary">{group.shiftDate}</TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                              <MapPin size={14} />
                            </div>
                            <span className="font-bold text-sm">{group.location}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right font-black text-primary/80">{group.totalPallets}</TableCell>
                        <TableCell className="px-6 py-4 text-right font-black text-primary">{group.totalNetWeight.toLocaleString()} KG</TableCell>
                      </TableRow>
                    ))}
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-60 text-center text-muted-foreground font-bold">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span>Loading production data...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : groupedByShiftLocation.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-60 text-center text-muted-foreground font-bold">No records found for the selected criteria.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: GROUP BY PALLET TYPE */}
          <TabsContent value="pallet-type" className="m-0">
            <div className="bg-white rounded-3xl border border-primary/5 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#F8F7FF] border-b border-primary/5">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40">Pallet Type</TableHead>
                      <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right">Number of Pallets</TableHead>
                      <TableHead className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary/40 text-right">Total Net Weight (KG)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedByPalletType.map((group, idx) => (
                      <TableRow key={idx} className="border-b border-primary/5 last:border-0 hover:bg-primary/[0.01] transition-all group">
                        <TableCell className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center",
                              group.palletType === 'Final product' ? "bg-emerald-50 text-emerald-600" :
                              group.palletType === 'decay' ? "bg-rose-50 text-rose-600" :
                              "bg-amber-50 text-amber-600"
                            )}>
                              <Layers size={14} />
                            </div>
                            <span className="font-bold text-sm uppercase tracking-tight">{group.palletType}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right font-black text-primary/80">{group.numPallets}</TableCell>
                        <TableCell className="px-6 py-4 text-right font-black text-primary">{group.totalNetWeight.toLocaleString()} KG</TableCell>
                      </TableRow>
                    ))}
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-60 text-center text-muted-foreground font-bold">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span>Loading production data...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : groupedByPalletType.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-60 text-center text-muted-foreground font-bold">No records found for the selected criteria.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: PRODUCTIONS OUTPUT (DETAILED) */}
          <TabsContent value="detailed" className="m-0">
            <div className="bg-white rounded-3xl border border-primary/5 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="min-w-[2000px]">
                  <TableHeader className="bg-[#F8F7FF] border-b border-primary/5 sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40 w-[80px]">Actions</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40">Barcode</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40">Calibre</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40">Product</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40">Lot Number</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40">Pallet Type</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40">Package Type</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40">Date Time</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40">Shift</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40">Shift Date</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40">Order #</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40 text-right">Gross (KG)</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40 text-right">Net (KG)</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40 text-right">Boxes</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40">Location</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40">Created By</TableHead>
                      <TableHead className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.15em] text-primary/40">Updated By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailedRows.map((row) => (
                      <TableRow key={row.rowId} className="border-b border-primary/5 last:border-0 hover:bg-primary/[0.01] transition-all group text-xs">
                        <TableCell className="px-4 py-2 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-40 group-hover:opacity-100 transition-all">
                                <MoreVertical size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="rounded-xl border-primary/5 shadow-2xl">
                              {canUpdate && (
                                <DropdownMenuItem className="gap-2 font-bold py-2" onClick={() => router.push(`/production/output/${row.palletId}/edit`)}>
                                  <Edit2 size={14} className="text-primary" /> EDIT
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="gap-2 font-bold py-2 text-indigo-600 hover:bg-indigo-50" onClick={() => handleDownloadPDF(row)}>
                                <Download size={14} /> DOWNLOAD PDF
                              </DropdownMenuItem>
                              {canDelete && (
                                <DropdownMenuItem className="gap-2 font-bold py-2 text-rose-500 hover:bg-rose-50" onClick={() => handleDelete(row.palletId)}>
                                  <Trash2 size={14} /> DELETE
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                        <TableCell className="px-4 py-2 font-black text-primary/70">
                          <button 
                            onClick={() => router.push(`/production/output/${row.palletId}`)}
                            className="hover:underline hover:text-indigo-600 transition-all focus:outline-none"
                          >
                            {row.barcode || row.palletId?.slice(-6).toUpperCase()}
                          </button>
                        </TableCell>
                        <TableCell className="px-4 py-2 font-bold">{row.caliber || '—'}</TableCell>
                        <TableCell className="px-4 py-2">
                           <div className="flex flex-col">
                             <span className="font-bold text-primary">{row.productName || 'Unknown Product'}</span>
                             <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tight">{row.variety || 'No Variety'}</span>
                           </div>
                        </TableCell>
                        <TableCell className="px-4 py-2 font-bold">{row.lotNumber || '—'}</TableCell>
                        <TableCell className="px-4 py-2">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-tight",
                            row.palletisationType === 'Final product' ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                          )}>
                            {row.palletisationType}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-2 font-medium">{row.packagingTypeName || '—'}</TableCell>
                        <TableCell className="px-4 py-2 font-medium">{row.dateTime}</TableCell>
                        <TableCell className="px-4 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px]">SHIFT {row.shift}</span>
                        </TableCell>
                        <TableCell className="px-4 py-2 font-bold">{row.shiftDate}</TableCell>
                        <TableCell className="px-4 py-2 font-black text-primary/70">
                          {row.palletisationType === 'Final product' ? (row.orderPoNumber || '—') : '—'}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right font-black text-primary/60">{row.grossWeight} KG</TableCell>
                        <TableCell className="px-4 py-2 text-right font-black text-primary">{row.netWeight} KG</TableCell>
                        <TableCell className="px-4 py-2 text-right font-bold text-primary/80">{row.numberOfBoxes}</TableCell>
                        <TableCell className="px-4 py-2 font-bold text-indigo-600 uppercase tracking-tighter">{row.locationName || '—'}</TableCell>
                        <TableCell className="px-4 py-2 text-muted-foreground font-medium">{row.createdByDisplayName || row.createdBy}</TableCell>
                        <TableCell className="px-4 py-2 text-muted-foreground font-medium">{row.updatedByDisplayName || row.updatedBy || '—'}</TableCell>
                      </TableRow>
                    ))}
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={17} className="h-60 text-center text-muted-foreground font-bold italic">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span>Loading production data...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : detailedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={17} className="h-60 text-center text-muted-foreground font-bold italic">No detailed production data available.</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}