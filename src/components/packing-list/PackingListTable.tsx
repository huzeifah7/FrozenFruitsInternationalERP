"use client";
import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface PackingListRow {
  palletNumber: string | number;
  productionOutput?: string;
  ggnNumber: string;
  product: string;
  lotNumber: string | number;
  caliber: string;
  boxes: number;
  netWeight: number; // kg
  grossWeight: number; // kg
}

interface PackingListTableProps {
  rows: PackingListRow[];
  onExportExcel?: () => void;
  onExportPDF?: () => void;
}

export const PackingListTable: React.FC<PackingListTableProps> = ({ rows, onExportExcel, onExportPDF }) => {
  const [search, setSearch] = useState('');

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const lower = search.toLowerCase();
    return rows.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(lower))
    );
  }, [search, rows]);

  return (
    <div className="rounded-xl border border-primary/5 shadow-sm bg-white overflow-hidden mb-6">
      <div className="flex justify-between items-center p-4 bg-[#F8F7FF] border-b border-primary/5">
        <h3 className="text-xs font-black uppercase tracking-widest text-primary/40">Packing List Contents</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full table-auto text-xs whitespace-nowrap">
          <thead className="bg-[#F8F7FF] sticky top-0 border-b border-primary/5">
            <tr>
              <th className="px-6 py-4 font-black text-left text-[9px] uppercase tracking-[0.15em] text-primary/40">PALLET</th>
              <th className="px-6 py-4 font-black text-left text-[9px] uppercase tracking-[0.15em] text-primary/40">PRODUCTION OUTPUT</th>
              <th className="px-6 py-4 font-black text-left text-[9px] uppercase tracking-[0.15em] text-primary/40">GGN NUMBER</th>
              <th className="px-6 py-4 font-black text-left text-[9px] uppercase tracking-[0.15em] text-primary/40">PRODUCT</th>
              <th className="px-6 py-4 font-black text-left text-[9px] uppercase tracking-[0.15em] text-primary/40">LOT NUMBER</th>
              <th className="px-6 py-4 font-black text-left text-[9px] uppercase tracking-[0.15em] text-primary/40">CALIBER</th>
              <th className="px-6 py-4 font-black text-right text-[9px] uppercase tracking-[0.15em] text-primary/40">BOXES</th>
              <th className="px-6 py-4 font-black text-right text-[9px] uppercase tracking-[0.15em] text-primary/40">NET WT</th>
              <th className="px-6 py-4 font-black text-right text-[9px] uppercase tracking-[0.15em] text-primary/40">GROSS WT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary/5">
            {filteredRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-primary/[0.01] transition-all">
                <td className="px-6 py-4 font-bold text-primary/80">{row.palletNumber}</td>
                <td className="px-6 py-4 font-bold text-primary/80">{row.productionOutput || '—'}</td>
                <td className="px-6 py-4 font-medium text-primary/60">{row.ggnNumber || '—'}</td>
                <td className="px-6 py-4 font-bold text-indigo-900">{row.product || '—'}</td>
                <td className="px-6 py-4 font-bold text-primary/80">{row.lotNumber || '—'}</td>
                <td className="px-6 py-4 font-bold text-primary/80">{row.caliber || '—'}</td>
                <td className="px-6 py-4 text-right font-black text-primary/80">{row.boxes?.toLocaleString() || '0'}</td>
                <td className="px-6 py-4 text-right font-black text-primary/80">{row.netWeight?.toLocaleString() || '0'}</td>
                <td className="px-6 py-4 text-right font-black text-emerald-600">{row.grossWeight?.toLocaleString() || '0'}</td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-primary/40 font-bold italic">No items available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
