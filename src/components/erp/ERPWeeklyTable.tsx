import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { ERPActionButton } from './ERPActionButton';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeeklyRowData {
  date: string;
  farmDecay: number;
  productionDecay: number;
  decaySale: number;
  losses: number;
}

interface ERPWeeklyTableProps {
  data: WeeklyRowData[];
  density?: 'compact' | 'normal' | 'tall';
  onRefreshRow: (dateStr: string) => void;
  isRefreshingRow?: string | null;
}

export function ERPWeeklyTable({
  data,
  density = 'normal',
  onRefreshRow,
  isRefreshingRow
}: ERPWeeklyTableProps) {
  const topScrollRef = React.useRef<HTMLDivElement>(null);
  const tableScrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = React.useState(0);

  // Synchronize scrolls
  React.useEffect(() => {
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
  React.useEffect(() => {
    const tableScroll = tableScrollRef.current;
    if (!tableScroll) return;

    const updateWidth = () => {
      setScrollWidth(tableScroll.scrollWidth);
    };

    updateWidth();

    // Setup multiple timers to update width as layout settles
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
  }, [data]);
  
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
    <div className="w-full flex flex-col bg-white">
      {/* Top horizontal scrollbar */}
      <div 
        ref={topScrollRef} 
        className="overflow-x-auto w-full scroll-smooth custom-scrollbar select-none bg-slate-50/50 border-b border-slate-100 shrink-0"
        style={{ height: '16px', minHeight: '16px' }}
      >
        <div style={{ width: `${scrollWidth}px`, height: '1px' }} />
      </div>

      {/* Table horizontal scroll wrapper */}
      <div ref={tableScrollRef} className="w-full overflow-x-auto scroll-smooth custom-scrollbar bg-white">
      <Table className="w-full border-collapse">
        <TableHeader className="bg-slate-50 border-b border-slate-100">
          <TableRow className="hover:bg-transparent border-none">
            <TableHead className={cn("font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap border-b border-slate-100 pl-6 md:pl-8", getHeaderPaddingClass())}>
              Option
            </TableHead>
            <TableHead className={cn("font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap border-b border-slate-100", getHeaderPaddingClass())}>
              Date
            </TableHead>
            <TableHead className={cn("font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap border-b border-slate-100 text-right", getHeaderPaddingClass())}>
              Farm Decay Wet Weight
            </TableHead>
            <TableHead className={cn("font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap border-b border-slate-100 text-right", getHeaderPaddingClass())}>
              Production Decay Net Weight
            </TableHead>
            <TableHead className={cn("font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap border-b border-slate-100 text-right", getHeaderPaddingClass())}>
              Decay Sale Net Weight
            </TableHead>
            <TableHead className={cn("font-black uppercase tracking-[0.2em] text-primary/40 whitespace-nowrap border-b border-slate-100 text-right", getHeaderPaddingClass())}>
              Remaining Stock
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow className="border-none">
              <TableCell colSpan={6} className="h-48 text-center text-slate-400 font-medium italic opacity-60 text-xs">
                No daily records found.
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => {
              const isRefreshing = isRefreshingRow === row.date;
              return (
                <TableRow 
                  key={row.date}
                  className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-none"
                >
                  {/* Option - Refresh button */}
                  <TableCell className={cn("pl-6 md:pl-8 py-3", getPaddingClass())}>
                    <ERPActionButton
                      onClick={() => onRefreshRow(row.date)}
                      disabled={isRefreshing}
                      className="bg-[#193A7B] hover:bg-[#0F2552] flex items-center gap-1.5"
                    >
                      <RefreshCw size={10} className={cn("transition-transform", isRefreshing && "animate-spin")} />
                      Refresh
                    </ERPActionButton>
                  </TableCell>

                  {/* Date */}
                  <TableCell className={cn("font-bold text-slate-600", getPaddingClass())}>
                    {row.date}
                  </TableCell>

                  {/* Farm Decay */}
                  <TableCell className={cn("text-right font-bold text-slate-700", getPaddingClass())}>
                    {row.farmDecay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
                  </TableCell>

                  {/* Production Decay */}
                  <TableCell className={cn("text-right font-bold text-slate-700", getPaddingClass())}>
                    {row.productionDecay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
                  </TableCell>

                  {/* Decay Sale */}
                  <TableCell className={cn("text-right font-bold text-[#0284C7]", getPaddingClass())}>
                    {row.decaySale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
                  </TableCell>

                  {/* Remaining Stock */}
                  <TableCell className={cn("text-right font-black text-slate-700", getPaddingClass())}>
                    {row.losses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      </div>
    </div>
  );
}
