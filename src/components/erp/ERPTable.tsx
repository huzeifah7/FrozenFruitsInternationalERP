import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronLeft, ChevronRight, Search, X, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T | string;
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  enableFiltering?: boolean;
  enableSorting?: boolean;
  filterValueGetter?: (row: T) => string;
}

interface ERPTableProps<T> {
  columns: Column<T>[];
  data?: T[];
  density?: 'compact' | 'normal' | 'tall';
  selectedRowId?: string;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  pageSize?: number;
  emptyMessage?: string;
}

function getCellValue<T>(row: T, col: Column<T>): string {
  if (col.filterValueGetter) {
    const val = col.filterValueGetter(row);
    return val !== undefined && val !== null ? String(val) : '';
  }
  const key = col.accessorKey as string;
  if (!key) return '';

  const raw = (row as any)[key];
  if (raw !== undefined && raw !== null && raw !== '') {
    return String(raw);
  }

  // Common property fallbacks
  if (key === 'payedTo' || key === 'paidTo') {
    const p = (row as any).payedTo || (row as any).paidTo || (row as any).payed_to || (row as any).paidToName;
    return p ? String(p) : '';
  }
  if (key === 'paidBy') {
    const p = (row as any).paidBy || (row as any).paid_by || (row as any).paidByName;
    return p ? String(p) : '';
  }
  if (key === 'expenseType') {
    const e = (row as any).expenseType || (row as any).typeOfExpense || (row as any).expense_type;
    return e ? String(e) : '';
  }
  if (key === 'operationType') {
    const o = (row as any).operationType || (row as any).operation_type;
    return o ? String(o) : '';
  }

  return '';
}

export function ERPTable<T>({
  columns,
  data = [],
  density = 'normal',
  selectedRowId,
  onRowClick,
  getRowId,
  pageSize = 10,
  emptyMessage = "No data available."
}: ERPTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);

  // Sorting & Filtering state
  const [sortColumnKey, setSortColumnKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [columnSearchTerms, setColumnSearchTerms] = useState<Record<string, string>>({});

  // Reset pagination when data, search terms, or sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [data, columnSearchTerms, sortColumnKey, sortDirection]);

  // Synchronize scrolls
  useEffect(() => {
    const topScroll = topScrollRef.current;
    const tableScroll = tableScrollRef.current;
    if (!topScroll || !tableScroll) return;

    let isSyncingTop = false;
    let isSyncingTable = false;

    const handleTopScroll = () => {
      if (isSyncingTable) {
        isSyncingTable = false;
        return;
      }
      isSyncingTop = true;
      tableScroll.scrollLeft = topScroll.scrollLeft;
    };

    const handleTableScroll = () => {
      if (isSyncingTop) {
        isSyncingTop = false;
        return;
      }
      isSyncingTable = true;
      topScroll.scrollLeft = tableScroll.scrollLeft;
    };

    topScroll.addEventListener('scroll', handleTopScroll);
    tableScroll.addEventListener('scroll', handleTableScroll);

    return () => {
      topScroll.removeEventListener('scroll', handleTopScroll);
      tableScroll.removeEventListener('scroll', handleTableScroll);
    };
  }, []);

  // Sync scrollWidth with observed table scrollWidth
  useEffect(() => {
    const tableScroll = tableScrollRef.current;
    if (!tableScroll) return;

    const updateWidth = () => {
      setScrollWidth(tableScroll.scrollWidth);
    };

    updateWidth();

    const timers = [
      setTimeout(updateWidth, 50),
      setTimeout(updateWidth, 150),
      setTimeout(updateWidth, 400),
      setTimeout(updateWidth, 750),
    ];

    const observer = new ResizeObserver(updateWidth);
    observer.observe(tableScroll);

    const tableElement = tableScroll.querySelector('table');
    if (tableElement) {
      observer.observe(tableElement);
    }

    window.addEventListener('resize', updateWidth);

    return () => {
      timers.forEach(clearTimeout);
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [data, currentPage, columnSearchTerms, sortColumnKey, sortDirection]);

  // Handle column header click for ordering/sorting
  const handleColumnSort = (colKey: string) => {
    if (sortColumnKey !== colKey) {
      setSortColumnKey(colKey);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortColumnKey(null);
      setSortDirection(null);
    }
  };

  // Filter & Sort Data
  const processedData = useMemo(() => {
    let result = [...(data || [])];

    // 1. Filter by column search terms
    columns.forEach(col => {
      const colKey = (col.accessorKey as string) || col.header;
      if (!colKey || col.enableFiltering === false) return;

      const searchTerm = (columnSearchTerms[colKey] || '').toLowerCase().trim();
      if (searchTerm) {
        result = result.filter(row => {
          const val = getCellValue(row, col).toLowerCase();
          return val.includes(searchTerm);
        });
      }
    });

    // 2. Sort by clicked column
    if (sortColumnKey && sortDirection) {
      const targetCol = columns.find(c => ((c.accessorKey as string) || c.header) === sortColumnKey);
      if (targetCol && targetCol.enableSorting !== false) {
        result.sort((a, b) => {
          const valA = getCellValue(a, targetCol).trim();
          const valB = getCellValue(b, targetCol).trim();

          // Try numeric sorting
          const cleanA = valA.replace(/[^0-9.-]/g, '');
          const cleanB = valB.replace(/[^0-9.-]/g, '');
          const numA = cleanA !== '' ? Number(cleanA) : NaN;
          const numB = cleanB !== '' ? Number(cleanB) : NaN;

          if (!isNaN(numA) && !isNaN(numB)) {
            return sortDirection === 'asc' ? numA - numB : numB - numA;
          }

          // Try date sorting
          const dateA = new Date(valA).getTime();
          const dateB = new Date(valB).getTime();
          if (!isNaN(dateA) && !isNaN(dateB) && (valA.includes('-') || valA.includes('/'))) {
            return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
          }

          // String compare fallback
          const comp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
          return sortDirection === 'asc' ? comp : -comp;
        });
      }
    }

    return result;
  }, [data, columns, columnSearchTerms, sortColumnKey, sortDirection]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(processedData.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = processedData.slice(startIndex, endIndex);

  const getPaddingClass = () => {
    switch (density) {
      case 'compact': return 'py-2 px-3 text-[11px]';
      case 'tall': return 'py-5 px-6 text-sm';
      default: return 'py-3.5 px-4 text-xs';
    }
  };

  const getHeaderPaddingClass = () => {
    switch (density) {
      case 'compact': return 'py-3 px-3 text-[9px]';
      case 'tall': return 'py-5 px-6 text-xs';
      default: return 'py-4 px-4 text-[10px]';
    }
  };

  return (
    <div className="w-full flex flex-col flex-1 min-h-0 bg-white">
      {/* Top horizontal scrollbar */}
      <div 
        ref={topScrollRef} 
        className="overflow-x-auto w-full scroll-smooth custom-scrollbar select-none bg-slate-50/50 border-b border-slate-100 shrink-0"
        style={{ height: '16px', minHeight: '16px' }}
      >
        <div style={{ width: `${scrollWidth}px`, height: '1px' }} />
      </div>

      {/* Table horizontal scroll wrapper */}
      <div ref={tableScrollRef} className="overflow-x-auto w-full flex-1 min-h-0 scroll-smooth custom-scrollbar">
        <Table className="w-full border-collapse">
          <TableHeader className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
            <TableRow className="hover:bg-transparent border-none">
              {columns.map((col, idx) => {
                const colKey = (col.accessorKey as string) || col.header;
                const isFilterable = col.header !== '' && col.enableFiltering !== false;
                const isSortable = col.header !== '' && col.enableSorting !== false;
                
                const searchTerm = columnSearchTerms[colKey] || '';
                const isFiltered = searchTerm !== '';
                const isSorted = sortColumnKey === colKey && sortDirection !== null;

                return (
                  <TableHead 
                    key={idx}
                    className={cn(
                      "font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap border-b border-slate-100 select-none",
                      col.align === 'right' ? "text-right" : col.align === 'center' ? "text-center" : "text-left",
                      getHeaderPaddingClass()
                    )}
                  >
                    {col.header === '' ? null : (
                      <div className={cn(
                        "inline-flex items-center gap-1.5",
                        col.align === 'right' && "ml-auto flex-row-reverse",
                        col.align === 'center' && "mx-auto"
                      )}>
                        {/* Clickable Column Name -> Orders/Sorts table on click */}
                        {isSortable ? (
                          <button
                            type="button"
                            onClick={() => handleColumnSort(colKey)}
                            className={cn(
                              "inline-flex items-center gap-1 hover:text-slate-900 transition-colors cursor-pointer py-1 px-1 rounded-md",
                              isSorted && "text-[#0284C7] font-black"
                            )}
                            title="Click to sort by this column"
                          >
                            <span>{col.header}</span>
                            {sortColumnKey === colKey && sortDirection === 'asc' && (
                              <ArrowUp size={12} className="text-[#0284C7] stroke-[3]" />
                            )}
                            {sortColumnKey === colKey && sortDirection === 'desc' && (
                              <ArrowDown size={12} className="text-[#0284C7] stroke-[3]" />
                            )}
                          </button>
                        ) : (
                          <span>{col.header}</span>
                        )}

                        {/* Search Icon -> Opens simple input popover */}
                        {isFilterable && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button 
                                type="button"
                                className={cn(
                                  "p-1 rounded-md transition-all hover:bg-slate-200/60 text-slate-300 hover:text-slate-600",
                                  isFiltered && "bg-[#0284C7]/10 text-[#0284C7]"
                                )}
                                title={`Filter ${col.header}`}
                              >
                                <Search 
                                  size={11} 
                                  className={cn(
                                    "transition-colors stroke-[2.5]",
                                    isFiltered ? "text-[#0284C7]" : "text-slate-300 hover:text-slate-600"
                                  )} 
                                />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent 
                              className="w-60 p-2.5 shadow-lg rounded-xl border border-slate-100 bg-white" 
                              align={col.align === 'right' ? "end" : "start"}
                            >
                              <div className="relative flex items-center">
                                <Search size={14} className="absolute left-3 text-slate-400" />
                                <Input
                                  type="text"
                                  autoFocus
                                  value={searchTerm}
                                  onChange={(e) => setColumnSearchTerms(prev => ({ ...prev, [colKey]: e.target.value }))}
                                  placeholder={`Filter ${col.header}...`}
                                  className="h-9 pl-9 pr-7 rounded-lg text-xs border-slate-200 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-[#0284C7]"
                                />
                                {searchTerm && (
                                  <button 
                                    type="button"
                                    onClick={() => setColumnSearchTerms(prev => ({ ...prev, [colKey]: '' }))}
                                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                                  >
                                    <X size={13} />
                                  </button>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow className="border-none">
                <TableCell 
                  colSpan={columns.length} 
                  className="h-48 text-center text-slate-400 font-medium italic opacity-60 text-xs"
                >
                  {Object.values(columnSearchTerms).some(t => t.trim()) ? "No records match the filter." : emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, rowIdx) => {
                const rowId = getRowId ? getRowId(row) : String(rowIdx);
                const isSelected = selectedRowId === rowId;
                
                return (
                  <TableRow 
                    key={rowId}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={cn(
                      "hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-none cursor-pointer",
                      isSelected && "bg-slate-100/80 hover:bg-slate-100"
                    )}
                  >
                    {columns.map((col, colIdx) => {
                      const value = col.accessorKey ? (row as any)[col.accessorKey] : undefined;
                      return (
                        <TableCell
                          key={colIdx}
                          className={cn(
                            "font-bold text-slate-600 whitespace-nowrap",
                            col.align === 'right' ? "text-right" : col.align === 'center' ? "text-center" : "text-left",
                            getPaddingClass()
                          )}
                        >
                          {col.render ? col.render(row) : String(value ?? '—')}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 md:p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between shrink-0 select-none">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Page {currentPage} of {totalPages} ({processedData.length} items)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="h-9 w-9 rounded-xl border-slate-200 bg-white shadow-sm disabled:opacity-40"
            >
              <ChevronLeft size={16} className="text-[#193A7B]" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="h-9 w-9 rounded-xl border-slate-200 bg-white shadow-sm disabled:opacity-40"
            >
              <ChevronRight size={16} className="text-[#193A7B]" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
