"use client";
import React from 'react';

interface InfoCardProps {
  title?: string;
  rows: { label: string; value: React.ReactNode }[];
}

export const ShipmentInfoCard: React.FC<InfoCardProps> = ({ title, rows }) => {
  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
      {title && (
        <div className="bg-[#2e1d52] px-4 py-3 border-b">
          <h2 className="text-white font-bold text-sm tracking-wide">{title}</h2>
        </div>
      )}
      <table className="w-full table-auto text-sm">
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50/50 transition-colors">
              <td className="px-4 py-3 font-medium text-slate-500 bg-slate-50/50 w-1/3">{row.label}</td>
              <td className="px-4 py-3 text-slate-700 w-2/3">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
