'use client';

import React, { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from '@/firebase/firestore-override';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface FinalisedPalletsProps {
  poNumber: string;
}

export function FinalisedPallets({ poNumber }: FinalisedPalletsProps) {
  const db = useFirestore();

  // Queries
  const outputQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'production_output'), orderBy('createdAt', 'asc'));
  }, [db]);

  const productsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'products');
  }, [db]);

  const { data: outputs, isLoading: isOutputsLoading } = useCollection(outputQuery);
  const { data: products } = useCollection(productsQuery);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Sorting State
  const [sortField, setSortField] = useState<string>('Production Date Time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc'); // Default to latest first

  // Flatten and Filter
  const tableData = useMemo(() => {
    if (!outputs || !poNumber) return [];

    // Filter by PO Number exactly as requested
    const orderOutputs = outputs.filter(o => o.orderPoNumber === poNumber || o.poNumber === poNumber);
    
    let rows: any[] = [];
    orderOutputs.forEach(output => {
      if (output.items && Array.isArray(output.items)) {
        output.items.forEach((item: any, idx: number) => {
          const product = products?.find(p => p.id === item.productId);
          
          rows.push({
            id: `${output.id}_${idx}`,
            barcodeNumber: item.barcode || output.barcode || output.id?.slice(-6).toUpperCase(),
            productName: item.productName || product?.productName || 'Unknown',
            variety: item.variety || product?.variety || product?.category || '',
            category: item.category || product?.category || '',
            type: item.type || product?.type || '',
            lotNumber: item.lotNumber || output.finishedProductLotNumber || output.lotNumber || '',
            rawMaterialLotNumber: item.rawMaterialLotNumber || output.rawMaterialLotNumber || '',
            productionDateTime: output.createdAt || output.shiftDate || '',
            shift: output.shift || '',
            caliber: item.caliber || output.caliber || '',
            numberOfBoxes: item.numberOfBoxes || output.numberOfBoxes || 0,
            packagingType: item.packagingTypeName || item.packagingType || output.packagingTypeName || output.packagingType || '',
            netWeight: item.netWeight || output.netWeight || 0,
            grossWeight: item.grossWeight || output.grossWeight || 0,
          });
        });
      } else {
        // Fallback if production_output is flat
        rows.push({
          id: output.id,
          barcodeNumber: output.barcode || output.id?.slice(-6).toUpperCase(),
          productName: output.productName || 'Unknown',
          variety: output.variety || '',
          category: output.category || '',
          type: output.type || '',
          lotNumber: output.finishedProductLotNumber || output.lotNumber || '',
          rawMaterialLotNumber: output.rawMaterialLotNumber || '',
          productionDateTime: output.createdAt || output.shiftDate || '',
          shift: output.shift || '',
          caliber: output.caliber || '',
          numberOfBoxes: output.numberOfBoxes || 0,
          packagingType: output.packagingTypeName || output.packagingType || '',
          netWeight: output.netWeight || 0,
          grossWeight: output.grossWeight || 0,
        });
      }
    });

    // Apply Search
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      rows = rows.filter(row => 
        (row.barcodeNumber?.toLowerCase().includes(lowerSearch)) ||
        (row.productName?.toLowerCase().includes(lowerSearch)) ||
        (row.lotNumber?.toLowerCase().includes(lowerSearch)) ||
        (row.rawMaterialLotNumber?.toLowerCase().includes(lowerSearch)) ||
        (row.packagingType?.toLowerCase().includes(lowerSearch))
      );
    }

    // Apply Sorting
    rows.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'Barcode Number':
          valA = a.barcodeNumber;
          valB = b.barcodeNumber;
          break;
        case 'Product':
          valA = a.productName;
          valB = b.productName;
          break;
        case 'Lot Number':
          valA = a.lotNumber;
          valB = b.lotNumber;
          break;
        case 'Production Date Time':
          valA = a.productionDateTime?.toMillis ? a.productionDateTime.toMillis() : new Date(a.productionDateTime || 0).getTime();
          valB = b.productionDateTime?.toMillis ? b.productionDateTime.toMillis() : new Date(b.productionDateTime || 0).getTime();
          break;
        case 'Caliber':
          valA = a.caliber;
          valB = b.caliber;
          break;
        case 'Net Weight':
          valA = Number(a.netWeight) || 0;
          valB = Number(b.netWeight) || 0;
          break;
        case 'Gross Weight':
          valA = Number(a.grossWeight) || 0;
          valB = Number(b.grossWeight) || 0;
          break;
        default:
          valA = a.productionDateTime?.toMillis ? a.productionDateTime.toMillis() : new Date(a.productionDateTime || 0).getTime();
          valB = b.productionDateTime?.toMillis ? b.productionDateTime.toMillis() : new Date(b.productionDateTime || 0).getTime();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [outputs, products, poNumber, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalItems = tableData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  // Ensure current page is within bounds after filtering
  const safeCurrentPage = Math.min(currentPage, totalPages);
  
  const paginatedData = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return tableData.slice(startIndex, startIndex + pageSize);
  }, [tableData, safeCurrentPage, pageSize]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortableHeader = (label: string, field: string) => {
    return (
      <TableHead 
        className="px-4 py-3 text-sm font-bold text-[#3B2D59] cursor-pointer hover:bg-muted/50 select-none"
        onClick={() => handleSort(field)}
      >
        <div className="flex items-center gap-1">
          {label}
          {sortField === field && (
            <span className="text-[10px] opacity-50">
              {sortDirection === 'asc' ? '▲' : '▼'}
            </span>
          )}
        </div>
      </TableHead>
    );
  };

  if (isOutputsLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-6 mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h4 className="text-xl font-bold text-[#3B2D59] flex items-center gap-2">
          Finalised Pallets: {totalItems}
        </h4>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search pallets..." 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 h-10 rounded-xl"
          />
        </div>
      </div>

      <div className="rounded-xl border border-muted/20 overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table className="w-full text-left">
            <thead>
              <tr className="bg-muted/10">
                {renderSortableHeader('Barcode Number', 'Barcode Number')}
                {renderSortableHeader('Product', 'Product')}
                {renderSortableHeader('Lot Number', 'Lot Number')}
                <TableHead className="px-4 py-3 text-sm font-bold text-[#3B2D59]">Raw Material Lot Number</TableHead>
                {renderSortableHeader('Production Date Time', 'Production Date Time')}
                <TableHead className="px-4 py-3 text-sm font-bold text-[#3B2D59]">Shift</TableHead>
                {renderSortableHeader('Caliber', 'Caliber')}
                <TableHead className="px-4 py-3 text-sm font-bold text-[#3B2D59]">Number of Boxes</TableHead>
                <TableHead className="px-4 py-3 text-sm font-bold text-[#3B2D59]">Packaging Type</TableHead>
                {renderSortableHeader('Net Weight', 'Net Weight')}
                {renderSortableHeader('Gross Weight', 'Gross Weight')}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row) => (
                  <TableRow key={row.id} className="hover:bg-primary/[0.02]">
                    <TableCell className="px-4 py-4 text-sm font-medium text-[#3B2D59]">{row.barcodeNumber || '*'}</TableCell>
                    <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                      <span className="font-medium text-[#3B2D59]">
                        {[row.productName, row.category, row.type].filter(Boolean).join(' - ')}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-muted-foreground">{row.lotNumber || '*'}</TableCell>
                    <TableCell className="px-4 py-4 text-sm text-muted-foreground">{row.rawMaterialLotNumber || '*'}</TableCell>
                    <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                      {row.productionDateTime ? (row.productionDateTime?.toDate ? row.productionDateTime.toDate().toLocaleString() : new Date(row.productionDateTime).toLocaleString()) : '*'}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-muted-foreground">{row.shift || '*'}</TableCell>
                    <TableCell className="px-4 py-4 text-sm text-[#3B2D59]">{row.caliber || '*'}</TableCell>
                    <TableCell className="px-4 py-4 text-sm text-muted-foreground">{row.numberOfBoxes || '*'}</TableCell>
                    <TableCell className="px-4 py-4 text-sm text-muted-foreground">{row.packagingType || '*'}</TableCell>
                    <TableCell className="px-4 py-4 text-sm font-medium text-[#3B2D59]">{row.netWeight ? `${row.netWeight} KG` : '*'}</TableCell>
                    <TableCell className="px-4 py-4 text-sm font-medium text-[#3B2D59]">{row.grossWeight ? `${row.grossWeight} KG` : '*'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center text-muted-foreground italic">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="h-8 w-8 opacity-20" />
                      <p>No finalised pallets found for this order.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </tbody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-muted/20 bg-muted/5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page:</span>
            <Select 
              value={pageSize.toString()} 
              onValueChange={(val) => {
                setPageSize(Number(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pageSize.toString()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Page {safeCurrentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
