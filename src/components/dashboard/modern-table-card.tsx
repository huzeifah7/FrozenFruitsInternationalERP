'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { LucideIcon, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Column {
  header: string;
  accessorKey: string;
  render?: (row: any) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface ModernTableCardProps {
  title: string;
  icon: LucideIcon;
  columns: Column[];
  data: any[];
  loading?: boolean;
  emptyMessage?: string;
  viewAllHref?: string;
  onViewAll?: () => void;
}

export function ModernTableCard({
  title,
  icon: Icon,
  columns,
  data,
  loading = false,
  emptyMessage = "No data available.",
  viewAllHref,
  onViewAll,
}: ModernTableCardProps) {
  return (
    <Card className="rounded-2xl border border-slate-200/80 shadow-sm bg-white overflow-hidden print-card transition-all duration-300 hover:shadow-md flex flex-col justify-between">
      <CardHeader className="bg-slate-50/60 px-6 py-4 border-b border-slate-200/80 flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-[#0F172A] flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#193A7B]/10 text-[#193A7B] flex items-center justify-center">
            <Icon size={16} className="stroke-[2.5]" />
          </div>
          <span>{title}</span>
        </CardTitle>

        {(viewAllHref || onViewAll) && (
          viewAllHref ? (
            <Link
              href={viewAllHref}
              className="rounded-full border border-[#193A7B]/40 text-[#193A7B] hover:bg-[#193A7B] hover:text-white transition-all text-[11px] font-bold px-4 py-1.5 flex items-center gap-1.5 shadow-2xs group shrink-0"
            >
              <span>View All</span>
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ) : (
            <button
              onClick={onViewAll}
              className="rounded-full border border-[#193A7B]/40 text-[#193A7B] hover:bg-[#193A7B] hover:text-white transition-all text-[11px] font-bold px-4 py-1.5 flex items-center gap-1.5 shadow-2xs group shrink-0"
            >
              <span>View All</span>
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </button>
          )
        )}
      </CardHeader>

      <CardContent className="p-0 flex-1">
        <div className="overflow-x-auto w-full custom-scrollbar">
          <Table className="min-w-full">
            <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
              <TableRow className="hover:bg-transparent border-b border-slate-200/80">
                {columns.map((col, i) => (
                  <TableHead 
                    key={i} 
                    className={cn(
                      "py-3.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] whitespace-nowrap",
                      i === 0 ? "pl-6" : "",
                      i === columns.length - 1 ? "pr-6" : "",
                      col.align === 'right' ? "text-right" : col.align === 'center' ? "text-center" : "text-left"
                    )}
                  >
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-slate-100">
                    {columns.map((_, j) => (
                      <TableCell key={j} className={cn("py-3.5", j === 0 ? "pl-6" : "", j === columns.length - 1 ? "pr-6" : "")}>
                        <Skeleton className="h-5 w-full rounded-md" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{emptyMessage}</p>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, rowIndex) => (
                  <TableRow key={rowIndex} className="border-b border-slate-100 hover:bg-slate-50/70 transition-colors">
                    {columns.map((col, colIndex) => (
                      <TableCell 
                        key={colIndex} 
                        className={cn(
                          "py-3.5 whitespace-nowrap text-xs font-semibold text-slate-700",
                          colIndex === 0 ? "pl-6 font-bold text-[#0F172A]" : "",
                          colIndex === columns.length - 1 ? "pr-6" : "",
                          col.align === 'right' ? "text-right" : col.align === 'center' ? "text-center" : "text-left"
                        )}
                      >
                        {col.render ? col.render(row) : row[col.accessorKey]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
