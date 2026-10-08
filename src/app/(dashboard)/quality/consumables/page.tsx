'use client';

import React, { useState, useMemo } from 'react';
import { collection, query, orderBy, deleteDoc, doc } from '@/firebase/firestore-override';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MoreHorizontal, Plus, Trash2, FileText, ArrowUpDown,
  ChevronLeft, ChevronRight, AlertTriangle, BarChart2,
  Layers, User, Edit2, Package2, Filter, FilterX, X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/use-permissions';

const PAGE_SIZE = 10;

type SortKey = 'name' | 'criticalLevel' | 'averageLevel' | 'section' | 'createdBy';
type SortDir = 'asc' | 'desc';

const SECTION_COLORS: Record<string, string> = {
  'EPI': 'bg-blue-50 text-blue-700 border-blue-100',
  'Matériel et outils': 'bg-amber-50 text-amber-700 border-amber-100',
  'Médicaments': 'bg-rose-50 text-rose-700 border-rose-100',
  'Hygiène et produits d\'hygiène': 'bg-teal-50 text-teal-700 border-teal-100',
};

export default function QualityConsumablesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const { canAdd, canUpdate, canDelete } = usePermissions('quality.consumables');

  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);

  // Column Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterCriticalLevel, setFilterCriticalLevel] = useState('');
  const [filterAverageLevel, setFilterAverageLevel] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [filterCreatedBy, setFilterCreatedBy] = useState('');
  const [filterUpdatedBy, setFilterUpdatedBy] = useState('');

  const consumablesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'quality_consumables'), orderBy('createdAt', 'desc'));
  }, [db, user]);

  const { data: consumables, isLoading } = useCollection(consumablesQuery);

  const resetFilters = () => {
    setFilterName('');
    setFilterCriticalLevel('');
    setFilterAverageLevel('');
    setFilterSection('');
    setFilterDescription('');
    setFilterCreatedBy('');
    setFilterUpdatedBy('');
    setPage(0);
  };

  const hasActiveFilters = Boolean(
    filterName || filterCriticalLevel || filterAverageLevel || 
    filterSection || filterDescription || filterCreatedBy || filterUpdatedBy
  );

  const filteredConsumables = useMemo(() => {
    if (!consumables) return [];
    return consumables.filter(item => {
      if (filterName && !(item.name || '').toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterCriticalLevel && !String(item.criticalLevel ?? '').toLowerCase().includes(filterCriticalLevel.toLowerCase())) return false;
      if (filterAverageLevel && !String(item.averageLevel ?? '').toLowerCase().includes(filterAverageLevel.toLowerCase())) return false;
      if (filterSection && !(item.section || '').toLowerCase().includes(filterSection.toLowerCase())) return false;
      if (filterDescription && !(item.description || '').toLowerCase().includes(filterDescription.toLowerCase())) return false;
      if (filterCreatedBy && !(item.createdBy || '').toLowerCase().includes(filterCreatedBy.toLowerCase())) return false;
      if (filterUpdatedBy && !(item.updatedBy || '').toLowerCase().includes(filterUpdatedBy.toLowerCase())) return false;
      return true;
    });
  }, [consumables, filterName, filterCriticalLevel, filterAverageLevel, filterSection, filterDescription, filterCreatedBy, filterUpdatedBy]);

  const sorted = useMemo(() => {
    return [...filteredConsumables].sort((a, b) => {
      const aVal = String(a[sortKey] ?? '').toLowerCase();
      const bVal = String(b[sortKey] ?? '').toLowerCase();
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  }, [filteredConsumables, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(0);
  };

  const handleDelete = async (id: string) => {
    if (!db || !confirm('Delete this consumable?')) return;
    try {
      await deleteDoc(doc(db, 'quality_consumables', id));
      toast({ title: 'Deleted', description: 'Consumable removed successfully.' });
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete.' });
    }
  };

  const SortHead = ({ col, label, className }: { col: SortKey; label: string; className?: string }) => (
    <TableHead
      className={`text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5 cursor-pointer select-none hover:text-primary transition-colors ${className}`}
      onClick={() => toggleSort(col)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <ArrowUpDown size={11} className={sortKey === col ? 'text-primary opacity-100' : 'opacity-30'} />
      </div>
    </TableHead>
  );

  return (
    <div className="w-full p-8 space-y-10 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <nav className="flex text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 mb-2">
            <span>Profile</span>
            <span className="mx-2 opacity-30">/</span>
            <span className="text-primary">Quality Consumables</span>
          </nav>
          <h1 className="text-4xl font-black text-primary tracking-tighter uppercase flex items-center gap-3">
            <span className="inline-block h-10 w-2 bg-primary rounded-full" />
            Quality Consumables
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Manage consumables, critical thresholds, and stock levels across quality sections.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (showFilters) {
                resetFilters();
              }
              setShowFilters(prev => !prev);
            }}
            className={`h-12 px-6 rounded-2xl font-black gap-2 text-[11px] uppercase tracking-wider border-primary/15 transition-all ${showFilters ? 'bg-primary/10 text-primary border-primary/30 shadow-md' : 'bg-white text-primary/70 hover:bg-primary/5'}`}
          >
            {showFilters ? <FilterX className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
            {showFilters ? 'Hide Filters' : 'Filter Columns'}
          </Button>

          {canAdd && (
            <Button
              onClick={() => router.push('/quality/consumables/add')}
              className="h-12 px-8 bg-primary hover:bg-primary/90 text-white rounded-2xl font-black gap-3 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 text-[11px] uppercase tracking-widest"
            >
              <Plus className="h-5 w-5 stroke-[3]" /> ADD CONSUMABLE
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[
          { label: 'Total Consumables', value: consumables?.length || 0, icon: <Package2 className="h-5 w-5" />, color: 'bg-primary/10 text-primary border-primary/10' },
          { label: 'Critical Items', value: consumables?.filter(c => Number(c.criticalLevel) > 0).length || 0, icon: <AlertTriangle className="h-5 w-5" />, color: 'bg-rose-50 text-rose-600 border-rose-100' },
          { label: 'Sections', value: new Set(consumables?.map(c => c.section)).size || 0, icon: <Layers className="h-5 w-5" />, color: 'bg-amber-50 text-amber-600 border-amber-100' },
          { label: 'Avg Stock Level', value: consumables?.length ? Math.round(consumables.reduce((s, c) => s + (Number(c.averageLevel) || 0), 0) / consumables.length) : 0, icon: <BarChart2 className="h-5 w-5" />, color: 'bg-teal-50 text-teal-600 border-teal-100' },
        ].map(({ label, value, icon, color }) => (
          <Card key={label} className="border-none shadow-xl rounded-3xl bg-white overflow-hidden hover:scale-[1.02] transition-all duration-300">
            <CardContent className="p-6 flex items-center justify-between">
              <div className={`p-3 rounded-2xl border ${color}`}>{icon}</div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/40 mb-1">{label}</p>
                <p className="text-3xl font-black text-primary">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="border-none shadow-2xl rounded-3xl bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <Table>
              <TableHeader className="bg-primary/5">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="w-[60px] py-5 pl-6" />
                  <SortHead col="name" label="Consumable Name" className="pl-2" />
                  <SortHead col="criticalLevel" label="Critical Level" />
                  <SortHead col="averageLevel" label="Average Level" />
                  <SortHead col="section" label="Section" />
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5">Description</TableHead>
                  <SortHead col="createdBy" label="Created By" />
                  <TableHead className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/50 py-5 pr-6">Updated By</TableHead>
                </TableRow>
                {showFilters && (
                  <TableRow className="bg-primary/[0.02] border-t border-primary/10 hover:bg-transparent">
                    <TableHead className="py-2.5 pl-6 w-[60px]">
                      {hasActiveFilters && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Clear All Filters"
                          onClick={resetFilters}
                          className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-50"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </TableHead>
                    <TableHead className="py-2.5 px-2">
                      <Input
                        placeholder="Filter name..."
                        value={filterName}
                        onChange={e => { setFilterName(e.target.value); setPage(0); }}
                        className="h-8 rounded-xl text-xs bg-white font-semibold border-primary/15 focus-visible:ring-1 focus-visible:ring-primary/20"
                      />
                    </TableHead>
                    <TableHead className="py-2.5 px-2">
                      <Input
                        placeholder="Filter level..."
                        value={filterCriticalLevel}
                        onChange={e => { setFilterCriticalLevel(e.target.value); setPage(0); }}
                        className="h-8 rounded-xl text-xs bg-white font-semibold border-primary/15 focus-visible:ring-1 focus-visible:ring-primary/20"
                      />
                    </TableHead>
                    <TableHead className="py-2.5 px-2">
                      <Input
                        placeholder="Filter avg..."
                        value={filterAverageLevel}
                        onChange={e => { setFilterAverageLevel(e.target.value); setPage(0); }}
                        className="h-8 rounded-xl text-xs bg-white font-semibold border-primary/15 focus-visible:ring-1 focus-visible:ring-primary/20"
                      />
                    </TableHead>
                    <TableHead className="py-2.5 px-2">
                      <Input
                        placeholder="Filter section..."
                        value={filterSection}
                        onChange={e => { setFilterSection(e.target.value); setPage(0); }}
                        className="h-8 rounded-xl text-xs bg-white font-semibold border-primary/15 focus-visible:ring-1 focus-visible:ring-primary/20"
                      />
                    </TableHead>
                    <TableHead className="py-2.5 px-2">
                      <Input
                        placeholder="Filter description..."
                        value={filterDescription}
                        onChange={e => { setFilterDescription(e.target.value); setPage(0); }}
                        className="h-8 rounded-xl text-xs bg-white font-semibold border-primary/15 focus-visible:ring-1 focus-visible:ring-primary/20"
                      />
                    </TableHead>
                    <TableHead className="py-2.5 px-2">
                      <Input
                        placeholder="Filter created by..."
                        value={filterCreatedBy}
                        onChange={e => { setFilterCreatedBy(e.target.value); setPage(0); }}
                        className="h-8 rounded-xl text-xs bg-white font-semibold border-primary/15 focus-visible:ring-1 focus-visible:ring-primary/20"
                      />
                    </TableHead>
                    <TableHead className="py-2.5 px-2 pr-6">
                      <Input
                        placeholder="Filter updated by..."
                        value={filterUpdatedBy}
                        onChange={e => { setFilterUpdatedBy(e.target.value); setPage(0); }}
                        className="h-8 rounded-xl text-xs bg-white font-semibold border-primary/15 focus-visible:ring-1 focus-visible:ring-primary/20"
                      />
                    </TableHead>
                  </TableRow>
                )}
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="border-none">
                      <TableCell colSpan={8} className="py-3 px-6">
                        <Skeleton className="h-10 w-full rounded-xl" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-64 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-20">
                        <Package2 size={64} />
                        <p className="text-xl font-black uppercase tracking-widest">No consumables found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map(item => (
                    <TableRow
                      key={item.id}
                      className="group hover:bg-primary/[0.02] transition-all border-b border-muted/15"
                    >
                      <TableCell className="pl-6">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all">
                              <MoreHorizontal size={18} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-52 p-2 rounded-2xl shadow-2xl border-primary/10">
                            {canUpdate && (
                              <DropdownMenuItem
                                className="gap-3 cursor-pointer font-black text-[11px] uppercase tracking-wider py-3 rounded-xl hover:bg-primary/5 text-primary"
                                onClick={() => router.push(`/quality/consumables/${item.id}/edit`)}
                              >
                                <Edit2 size={14} /> Edit
                              </DropdownMenuItem>
                            )}
                            {canUpdate && canDelete && <DropdownMenuSeparator />}
                            {canDelete && (
                              <DropdownMenuItem
                                className="gap-3 text-rose-500 cursor-pointer font-black text-[11px] uppercase tracking-wider py-3 rounded-xl hover:bg-rose-50"
                                onClick={() => handleDelete(item.id)}
                              >
                                <Trash2 size={14} /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>

                      {/* Name */}
                      <TableCell>
                        <span className="font-black text-sm text-primary underline-offset-2 hover:underline cursor-pointer group-hover:text-primary/80 transition-colors">
                          {item.name}
                        </span>
                      </TableCell>

                      {/* Critical Level */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${Number(item.criticalLevel) > 0 ? 'bg-rose-500' : 'bg-muted/40'}`} />
                          <span className="font-black text-sm text-rose-600">{item.criticalLevel ?? '—'}</span>
                        </div>
                      </TableCell>

                      {/* Average Level */}
                      <TableCell>
                        <span className="font-bold text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-0.5 inline-block">
                          {item.averageLevel ?? '—'}
                        </span>
                      </TableCell>

                      {/* Section */}
                      <TableCell>
                        <Badge className={`border font-black text-[10px] uppercase tracking-tight rounded-xl px-3 py-1 ${SECTION_COLORS[item.section] || 'bg-muted/10 text-primary/60 border-muted/30'}`}>
                          {item.section || '—'}
                        </Badge>
                      </TableCell>

                      {/* Description */}
                      <TableCell>
                        <span className="text-xs font-medium text-muted-foreground line-clamp-1 max-w-[220px]">
                          {item.description || '—'}
                        </span>
                      </TableCell>

                      {/* Created By */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <User size={11} className="text-primary/30" />
                          <span className="text-xs font-bold text-primary/60">{item.createdBy || '—'}</span>
                        </div>
                      </TableCell>

                      {/* Updated By */}
                      <TableCell className="pr-6">
                        <div className="flex items-center gap-1.5">
                          <User size={11} className="text-primary/30" />
                          <span className="text-xs font-bold text-primary/60">{item.updatedBy || '—'}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-muted/10">
            <p className="text-[11px] font-black uppercase tracking-widest text-primary/40">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="h-9 w-9 rounded-xl border-primary/15 hover:bg-primary/5"
              >
                <ChevronLeft size={16} />
              </Button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={i === page ? 'default' : 'ghost'}
                  onClick={() => setPage(i)}
                  className={`h-9 w-9 rounded-xl font-black text-[11px] ${i === page ? 'bg-primary text-white shadow-md shadow-primary/20' : 'text-primary/60 hover:bg-primary/5'}`}
                >
                  {i + 1}
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="h-9 w-9 rounded-xl border-primary/15 hover:bg-primary/5"
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
