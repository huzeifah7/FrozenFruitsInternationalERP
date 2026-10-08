'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  collection, 
  query, 
  orderBy, 
  doc,
  deleteDoc 
} from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Search, 
  Filter,
  Columns,
  List,
  Maximize2,
  Minimize2,
  ArrowUpDown,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Wheat,
  Scale,
  ShieldCheck,
  Building2,
  X,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useMasterData, MasterDataProvider } from '@/components/master-data-provider';

export default function MainFarmsPageWrapper() {
  return (
    <MasterDataProvider>
      <MainFarmsPage />
    </MasterDataProvider>
  );
}

function MainFarmsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { canList, canAdd, canUpdate, canDelete } = usePermissions('quality.main-farms');
  const { toast } = useToast();
  const { farms: masterFarms, isLoading: masterLoading } = useMasterData();

  const [searchTerm, setSearchTerm] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Firestore live collection
  const farmsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'main_farms'), orderBy('createdAt', 'desc'));
  }, [db, user]);

  const { data: rawFarms, isLoading: liveLoading } = useCollection(farmsQuery);

  const farms = useMemo(() => {
    const list = rawFarms && rawFarms.length > 0 ? rawFarms : masterFarms;
    return (list || []).map((f: any) => ({
      id: f.id,
      name: f.name || '',
      gpsLocation: f.gpsLocation || '-',
      ggnNumber: f.ggnNumber || '-',
      farmSize: Number(f.farmSize) || 0,
      estimatedCrops: Number(f.estimatedCrops) || 0,
      farmCodification: f.farmCodification || '-',
      certificates: Array.isArray(f.certificates) ? f.certificates : [],
      createdBy: f.createdByDisplayName || f.createdByName || f.createdBy || 'Zakariaa El Yamlahi',
      updatedBy: f.updatedByDisplayName || f.updatedByName || f.updatedBy || '',
      createdAt: f.createdAt,
      rawDoc: f
    }));
  }, [rawFarms, masterFarms]);

  const isLoading = (liveLoading && masterLoading) && farms.length === 0;

  // KPI Calculations
  const stats = useMemo(() => {
    const totalCount = farms.length;
    const totalHectares = farms.reduce((sum, f) => sum + (f.farmSize || 0), 0);
    const totalTonnes = farms.reduce((sum, f) => sum + (f.estimatedCrops || 0), 0);
    const totalCertificates = farms.reduce((sum, f) => sum + (f.certificates?.length || 0), 0);

    return {
      totalCount,
      totalHectares: totalHectares.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      totalTonnes: totalTonnes.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      totalCertificates
    };
  }, [farms]);

  const handleDelete = async (id: string, name: string) => {
    if (!db || !window.confirm(`Are you sure you want to delete the farm "${name}"?`)) return;

    try {
      await deleteDoc(doc(db, 'main_farms', id));
      toast({
        title: "Farm Deleted",
        description: `Farm "${name}" was successfully removed.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete farm.",
      });
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
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

  const copyToClipboard = (text: string, id: string) => {
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied", description: `${text} copied to clipboard.` });
  };

  const filteredFarms = useMemo(() => {
    let result = [...farms];
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(farm => 
        farm.name.toLowerCase().includes(q) ||
        farm.ggnNumber.toLowerCase().includes(q) ||
        farm.gpsLocation.toLowerCase().includes(q) ||
        farm.farmCodification.toLowerCase().includes(q) ||
        farm.createdBy.toLowerCase().includes(q) ||
        farm.updatedBy.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let valA = a[sortField as keyof typeof a];
      let valB = b[sortField as keyof typeof b];

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      valA = (valA || '').toString().toLowerCase();
      valB = (valB || '').toString().toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [farms, searchTerm, sortField, sortOrder]);

  const totalRows = filteredFarms.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
  const paginatedFarms = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredFarms.slice(start, start + rowsPerPage);
  }, [filteredFarms, currentPage, rowsPerPage]);

  const startIndex = totalRows === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
  const endIndex = Math.min(currentPage * rowsPerPage, totalRows);

  if (!canList && !isLoading) {
    return (
      <div className="p-12 text-center text-slate-500 font-semibold bg-white rounded-2xl border border-slate-200/80 m-6 shadow-sm">
        You do not have permission to view the Main Farms module.
      </div>
    );
  }

  return (
    <div className={`p-6 md:p-8 space-y-6 font-sans ${isFullscreen ? 'bg-slate-50 fixed inset-0 z-50 overflow-auto p-8' : ''}`}>
      {/* Modern Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
            <Link href="/profile" className="hover:text-slate-600 transition-colors">Profile</Link>
            <span>/</span>
            <span className="text-slate-400">Quality</span>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Main Farms</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            Main Farms
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
              {farms.length} registered
            </span>
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Track certified farm operations, harvest estimates, and compliance documentation.
          </p>
        </div>

        {canAdd && (
          <Link href="/quality/main-farms/add">
            <Button 
              className="h-10 px-4 rounded-xl bg-[#193A7B] hover:bg-[#132d61] text-white font-semibold text-xs gap-2 shadow-sm shadow-[#193A7B]/20 transition-all hover:shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add Main Farm</span>
            </Button>
          </Link>
        )}
      </div>

      {/* Modern KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Farms</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-[#193A7B]">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalCount}</div>
          <span className="text-[11px] font-medium text-slate-400">Production units</span>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Area</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Wheat className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalHectares}</div>
          <span className="text-[11px] font-medium text-emerald-600 font-semibold">Hectares mapped</span>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Estimated Crops</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalTonnes}</div>
          <span className="text-[11px] font-medium text-amber-600 font-semibold">Tonnes harvest</span>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Certificates</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalCertificates}</div>
          <span className="text-[11px] font-medium text-purple-600 font-semibold">Global compliance docs</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Modern Interactive Toolbar */}
        <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-slate-50/40">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search by farm name, GGN, codification, location..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 pl-10 pr-9 rounded-xl border-slate-200 bg-white focus-visible:ring-[#0284C7] text-xs font-medium text-slate-700 shadow-2xs"
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button 
              onClick={toggleFullscreen}
              className="h-9 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/60 border-b border-slate-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16 py-3.5 pl-6 text-xs font-semibold text-slate-600">Actions</TableHead>
                
                <TableHead className="py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                  <div 
                    className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 select-none"
                    onClick={() => handleSort('name')}
                  >
                    <span>Farm Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </TableHead>

                <TableHead className="py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                  <div 
                    className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 select-none"
                    onClick={() => handleSort('gpsLocation')}
                  >
                    <span>GPS Location</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </TableHead>

                <TableHead className="py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                  <div 
                    className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 select-none"
                    onClick={() => handleSort('ggnNumber')}
                  >
                    <span>GGN Number</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </TableHead>

                <TableHead className="py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                  <div 
                    className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 select-none"
                    onClick={() => handleSort('farmSize')}
                  >
                    <span>Farm Size</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </TableHead>

                <TableHead className="py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                  <div 
                    className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 select-none"
                    onClick={() => handleSort('estimatedCrops')}
                  >
                    <span>Estimated Crops</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </TableHead>

                <TableHead className="py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                  <div 
                    className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 select-none"
                    onClick={() => handleSort('farmCodification')}
                  >
                    <span>Codification</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </TableHead>

                <TableHead className="py-3.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
                  <div 
                    className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 select-none"
                    onClick={() => handleSort('createdBy')}
                  >
                    <span>Created By</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </TableHead>

                <TableHead className="py-3.5 pr-6 text-xs font-semibold text-slate-700 whitespace-nowrap">
                  <div 
                    className="flex items-center gap-1.5 cursor-pointer hover:text-blue-700 select-none"
                    onClick={() => handleSort('updatedBy')}
                  >
                    <span>Updated By</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-100">
                    <TableCell className="py-4 pl-6"><Skeleton className="h-5 w-8 rounded-md" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-36 rounded-md" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-32 rounded-md" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-28 rounded-md" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-md" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-24 rounded-md" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-md" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-32 rounded-md" /></TableCell>
                    <TableCell className="py-4 pr-6"><Skeleton className="h-5 w-28 rounded-md" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedFarms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-48 text-center text-slate-400 text-sm">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Building2 className="w-8 h-8 text-slate-300" />
                      <p className="font-semibold text-slate-600">No main farms found</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {searchTerm ? 'Try adjusting your search criteria.' : 'Get started by creating your first farm unit.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedFarms.map((farm) => {
                  const hasCoordinates = farm.gpsLocation && farm.gpsLocation !== '-' && farm.gpsLocation.includes(',');

                  return (
                    <TableRow
                      key={farm.id}
                      className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 group text-xs text-slate-700"
                    >
                      {/* Actions */}
                      <TableCell className="py-3.5 pl-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer">
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40 p-1.5 rounded-xl shadow-xl border-slate-200 bg-white">
                            <DropdownMenuItem
                              onClick={() => router.push(`/quality/main-farms/${farm.id}`)}
                              className="gap-2.5 text-xs text-slate-700 cursor-pointer font-medium py-2 px-2.5 rounded-lg focus:bg-slate-100"
                            >
                              <Eye className="w-4 h-4 text-slate-500" />
                              View Details
                            </DropdownMenuItem>
                            {canUpdate && (
                              <DropdownMenuItem
                                onClick={() => router.push(`/quality/main-farms/${farm.id}/edit`)}
                                className="gap-2.5 text-xs text-slate-700 cursor-pointer font-medium py-2 px-2.5 rounded-lg focus:bg-slate-100"
                              >
                                <Edit className="w-4 h-4 text-blue-600" />
                                Edit Farm
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(farm.id, farm.name)}
                                className="gap-2.5 text-xs text-rose-600 cursor-pointer font-medium py-2 px-2.5 rounded-lg focus:bg-rose-50 focus:text-rose-700"
                              >
                                <Trash2 className="w-4 h-4 text-rose-500" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>

                      {/* Farm Name */}
                      <TableCell className="py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#193A7B]/10 text-[#193A7B] font-bold text-xs flex items-center justify-center shrink-0">
                            {farm.name.charAt(0).toUpperCase()}
                          </div>
                          <span 
                            onClick={() => router.push(`/quality/main-farms/${farm.id}`)}
                            className="text-[#193A7B] font-semibold hover:underline cursor-pointer tracking-tight"
                          >
                            {farm.name}
                          </span>
                        </div>
                      </TableCell>

                      {/* GPS Location */}
                      <TableCell className="py-3.5 whitespace-nowrap">
                        {hasCoordinates ? (
                          <a
                            href={`https://www.google.com/maps?q=${encodeURIComponent(farm.gpsLocation)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors font-medium bg-slate-100/70 hover:bg-blue-50 px-2 py-1 rounded-md text-[11px]"
                            title="Open in Google Maps"
                          >
                            <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                            <span>{farm.gpsLocation}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        ) : (
                          <span className="text-slate-400">{farm.gpsLocation}</span>
                        )}
                      </TableCell>

                      {/* GGN Number */}
                      <TableCell className="py-3.5 whitespace-nowrap">
                        {farm.ggnNumber !== '-' ? (
                          <div className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-mono text-[11px] px-2 py-0.5 rounded-md">
                            <span>{farm.ggnNumber}</span>
                            <button
                              onClick={() => copyToClipboard(farm.ggnNumber, `ggn-${farm.id}`)}
                              className="text-slate-400 hover:text-slate-700 p-0.5 ml-0.5 cursor-pointer"
                              title="Copy GGN"
                            >
                              {copiedId === `ggn-${farm.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>

                      {/* Farm Size */}
                      <TableCell className="py-3.5 whitespace-nowrap font-medium text-slate-800">
                        {farm.farmSize ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="font-semibold">{farm.farmSize.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-500 font-normal">(Hectares)</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>

                      {/* Estimated Crops */}
                      <TableCell className="py-3.5 whitespace-nowrap font-medium text-slate-800">
                        {farm.estimatedCrops ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="font-semibold text-emerald-700">{farm.estimatedCrops.toLocaleString()}</span>
                            <span className="text-[10px] text-slate-500 font-normal">(Tonnes)</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>

                      {/* Farm Codification */}
                      <TableCell className="py-3.5 whitespace-nowrap">
                        {farm.farmCodification !== '-' ? (
                          <Badge variant="outline" className="font-bold text-[10px] tracking-wider bg-slate-50 border-slate-200 text-slate-700 uppercase">
                            {farm.farmCodification}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>

                      {/* Created By */}
                      <TableCell className="py-3.5 whitespace-nowrap text-slate-600">
                        {farm.createdBy}
                      </TableCell>

                      {/* Updated By */}
                      <TableCell className="py-3.5 pr-6 whitespace-nowrap text-slate-500">
                        {farm.updatedBy || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Modern Table Footer & Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/30 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-700 font-medium cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[#193A7B]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-6">
            <span className="font-medium text-slate-600">
              {totalRows === 0 ? '0 of 0' : `${startIndex}-${endIndex} of ${totalRows}`}
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="h-8 w-8 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="h-8 w-8 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
