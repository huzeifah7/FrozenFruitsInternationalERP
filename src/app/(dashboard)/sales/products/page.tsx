'use client';

import React, { useState, useMemo } from 'react';
import useRouter from 'next/navigation';
import { useRouter as useNextRouter } from 'next/navigation';
import Link from 'next/link';
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
  orderBy, 
  deleteDoc, 
  doc 
} from '@/firebase/firestore-override';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  MoreHorizontal, 
  Search, 
  Filter, 
  Columns, 
  List, 
  Maximize2,
  ArrowUpDown,
  Equal,
  FileDown,
  Download,
  Edit,
  Trash2,
  Package
} from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { generateProductPDF } from '@/lib/export-product-pdf';

export default function SalesProductsListPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useNextRouter();
  const { toast } = useToast();
  const { canAdd, canDelete } = usePermissions('sales.products');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'name' | 'type' | 'createdBy' | 'updatedBy'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const productsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'products'), orderBy('createdAt', 'desc'));
  }, [db, user]);

  const { data: rawProducts, isLoading } = useCollection(productsQuery);

  const products = useMemo(() => {
    if (!rawProducts) return [];

    let result = rawProducts.map((p: any) => ({
      id: p.id,
      name: p.name || p.productName || '',
      type: p.type || p.productType || '',
      createdBy: p.createdBy || p.createdByName || 'Zakariaa El Yamlahi',
      updatedBy: p.updatedBy || p.updatedByName || '',
      description: p.description || '',
      specsFile: p.specsFile || null,
      images: p.images || [],
      createdAt: p.createdAt,
      rawDoc: p
    }));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.type.toLowerCase().includes(q) ||
          p.createdBy.toLowerCase().includes(q) ||
          p.updatedBy.toLowerCase().includes(q)
      );
    }

    if (filterType) {
      result = result.filter(p => p.type.toLowerCase() === filterType.toLowerCase());
    }

    result.sort((a, b) => {
      const valA = (a[sortField] || '').toString().toLowerCase();
      const valB = (b[sortField] || '').toString().toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [rawProducts, searchQuery, filterType, sortField, sortOrder]);

  const handleSort = (field: 'name' | 'type' | 'createdBy' | 'updatedBy') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!db) return;
    if (!confirm(`Are you sure you want to delete the product "${name}"?`)) return;

    const docRef = doc(db, 'products', id);
    try {
      await deleteDoc(docRef).catch(err => {
        errorEmitter.emit(
          'permission-error',
          new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          })
        );
        throw err;
      });
      toast({
        title: 'Product Deleted',
        description: `Product "${name}" was successfully removed.`,
      });
    } catch (error) {
      // Handled
    }
  };

  const handleDownloadSpecs = (product: any) => {
    if (product.specsFile && product.specsFile.dataUrl) {
      const a = document.createElement('a');
      a.href = product.specsFile.dataUrl;
      a.download = product.specsFile.fileName || `${product.name}_specs.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: 'Downloading Specifications', description: product.specsFile.fileName });
    } else {
      toast({
        variant: 'destructive',
        title: 'No File Attached',
        description: 'No specification file was attached for this product.',
      });
    }
  };

  const handleDownloadPDF = async (product: any) => {
    toast({ title: 'Generating PDF...', description: 'Preparing product datasheet.' });
    await generateProductPDF(product);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div className={`p-6 md:p-8 space-y-6 animate-in fade-in duration-300 ${isFullscreen ? 'bg-white fixed inset-0 z-50 overflow-auto' : ''}`}>
      {/* Header section with Breadcrumb & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Products</h1>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mt-1">
            <span>Profile</span>
            <span>/</span>
            <span className="text-slate-500 font-semibold">Products</span>
          </div>
        </div>

        {canAdd && (
          <Button
            asChild
            className="h-10 w-10 p-0 rounded-lg bg-[#1a233a] hover:bg-[#111827] text-white shadow-sm flex items-center justify-center self-start sm:self-auto"
            title="Add Product"
          >
            <Link href="/sales/products/add">
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </Link>
          </Button>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Table Top Controls Bar */}
        <div className="p-3 border-b border-slate-100 flex items-center justify-end gap-2 bg-white">
          {showSearchInput ? (
            <div className="relative flex items-center">
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 w-60 text-xs pl-8 pr-3 rounded-md border-slate-200 focus:border-slate-400 focus:ring-0"
                autoFocus
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
            </div>
          ) : (
            <button
              onClick={() => setShowSearchInput(true)}
              className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => setFilterType(prev => (prev ? null : 'Grade A'))}
            className={`p-1.5 rounded-md transition-colors ${filterType ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
            title="Filter"
          >
            <Filter className="w-4 h-4" />
          </button>

          <button
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title="Columns"
          >
            <Columns className="w-4 h-4" />
          </button>

          <button
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title="Density View"
          >
            <List className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/70">
              <TableRow className="border-b border-slate-200/80 hover:bg-transparent">
                <TableHead className="w-[100px] text-xs font-semibold text-slate-700 py-3.5 pl-6">
                  Actions
                </TableHead>

                <TableHead className="text-xs font-semibold text-slate-700 py-3.5">
                  <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={() => handleSort('name')}>
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    <Equal className="w-3 h-3 text-slate-300" />
                  </div>
                </TableHead>

                <TableHead className="text-xs font-semibold text-slate-700 py-3.5">
                  <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={() => handleSort('type')}>
                    <span>Product Type</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    <Equal className="w-3 h-3 text-slate-300" />
                  </div>
                </TableHead>

                <TableHead className="text-xs font-semibold text-slate-700 py-3.5">
                  <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={() => handleSort('createdBy')}>
                    <span>Created By</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    <Equal className="w-3 h-3 text-slate-300" />
                  </div>
                </TableHead>

                <TableHead className="text-xs font-semibold text-slate-700 py-3.5">
                  <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={() => handleSort('updatedBy')}>
                    <span>Updated By</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    <Equal className="w-3 h-3 text-slate-300" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-none">
                    <TableCell colSpan={5} className="py-4 px-6">
                      <Skeleton className="h-6 w-full rounded-md" />
                    </TableCell>
                  </TableRow>
                ))
              ) : products.length === 0 ? (
                <TableRow className="hover:bg-transparent border-none">
                  <TableCell colSpan={5} className="h-60 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package className="w-10 h-10 text-slate-200 stroke-[1.5]" />
                      <p className="text-sm">No products found.</p>
                      {canAdd && (
                        <Link href="/sales/products/add" className="text-xs text-blue-600 font-semibold hover:underline">
                          Add a product now
                        </Link>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                products.map(product => (
                  <TableRow
                    key={product.id}
                    className="hover:bg-slate-50/60 transition-colors border-b border-slate-100 group"
                  >
                    {/* Actions Column */}
                    <TableCell className="py-3.5 pl-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors focus:outline-hidden">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-36 p-1 rounded-lg shadow-lg border-slate-200 bg-white">
                          <DropdownMenuItem
                            onClick={() => router.push(`/sales/products/${product.id}/edit`)}
                            className="gap-2.5 text-xs text-slate-700 cursor-pointer font-medium py-1.5 px-2.5 focus:bg-slate-100"
                          >
                            <Edit className="w-3.5 h-3.5 text-slate-500" />
                            Edit
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleDownloadSpecs(product)}
                            className="gap-2.5 text-xs text-slate-700 cursor-pointer font-medium py-1.5 px-2.5 focus:bg-slate-100"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            Download
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => handleDownloadPDF(product)}
                            className="gap-2.5 text-xs text-slate-700 cursor-pointer font-medium py-1.5 px-2.5 focus:bg-slate-100"
                          >
                            <FileDown className="w-3.5 h-3.5 text-slate-500" />
                            Download PDF
                          </DropdownMenuItem>

                          {canDelete && (
                            <DropdownMenuItem
                              onClick={() => handleDelete(product.id, product.name)}
                              className="gap-2.5 text-xs text-rose-600 cursor-pointer font-medium py-1.5 px-2.5 focus:bg-rose-50 focus:text-rose-700"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>

                    {/* Name Column */}
                    <TableCell
                      className="py-3.5 font-medium text-sm text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
                      onClick={() => router.push(`/sales/products/${product.id}`)}
                    >
                      {product.name}
                    </TableCell>

                    {/* Product Type Column */}
                    <TableCell className="py-3.5 text-sm text-slate-700 font-normal">
                      {product.type}
                    </TableCell>

                    {/* Created By Column */}
                    <TableCell className="py-3.5 text-sm text-slate-700 font-normal">
                      {product.createdBy}
                    </TableCell>

                    {/* Updated By Column */}
                    <TableCell className="py-3.5 text-sm text-slate-500 font-normal">
                      {product.updatedBy || ''}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
