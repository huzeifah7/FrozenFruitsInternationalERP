import React from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface PackingListItem {
  product: string;
  calibre: string;
  boxes: number;
  quantity: number;
  netWeight: number;
  grossWeight: number;
}

export interface PackingListPreviewData {
  packingListNumber: string;
  poNumber: string;
  productionType: string;
  customer: string;
  expeditionDate: string;
  etd: string;
  truckNumber: string;
  transportCompany: string;
  ggnNumber?: string;
  sealNumber?: string;
  remarks?: string;
  items: PackingListItem[];
  totalNetWeight: number;
  totalGrossWeight: number;
  totalBoxes: number;
  countryOfOrigin?: string;
  createdAt?: any;
}

interface ERPPackingListPreviewProps {
  data: PackingListPreviewData;
  className?: string;
}

export function ERPPackingListPreview({ data, className }: ERPPackingListPreviewProps) {
  return (
    <Card className={cn("bg-white border border-slate-100 shadow-xl rounded-3xl p-8 md:p-12 max-w-[1000px] mx-auto overflow-hidden printable-area text-slate-800", className)}>
      {/* Top Banner: Logo & Packing List Metadata */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-100 pb-8 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center p-2 shadow-inner">
            <Image 
              src="/FFI_main.png" 
              alt="Export Optimum Logo" 
              width={50}
              height={50}
              className="object-contain"
            />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#2e1d52] tracking-tight uppercase leading-none">Export Optimum</h2>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">Logistics & Trade ERP</span>
          </div>
        </div>

        <div className="text-left sm:text-right space-y-1">
          <span className="bg-[#7a9800]/10 text-[#7a9800] px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-block mb-1">
            Packing List
          </span>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Document Number</p>
          <p className="text-xl font-black text-[#2e1d52]">{data.packingListNumber || `PL-${data.poNumber}`}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
            Expedition Date: <span className="text-slate-600 ml-1">{data.expeditionDate || '—'}</span>
          </p>
          {data.etd && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              ETD: <span className="text-slate-600 ml-1">{data.etd}</span>
            </p>
          )}
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 text-xs">
        {/* Left Side: Order & Production Info */}
        <div className="space-y-3 bg-slate-50/50 border border-slate-100/50 rounded-2xl p-6">
          <h3 className="font-black text-[#2e1d52] text-[10px] uppercase tracking-widest border-b border-slate-100 pb-2 mb-2">Order & Origin</h3>
          <div className="grid grid-cols-3 gap-y-2 text-slate-600 font-medium">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Customer:</span>
            <span className="col-span-2 font-bold text-slate-800 uppercase">{data.customer}</span>

            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">PO Number:</span>
            <span className="col-span-2 font-black text-[#2e1d52]">{data.poNumber}</span>

            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Prod Type:</span>
            <span className="col-span-2">{data.productionType}</span>

            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">GGN Number:</span>
            <span className="col-span-2">{data.ggnNumber || '—'}</span>

            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Seal Number:</span>
            <span className="col-span-2">{data.sealNumber || '—'}</span>

            {data.countryOfOrigin && (
              <>
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Country:</span>
                <span className="col-span-2">{data.countryOfOrigin}</span>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Shipping & Logistics Info */}
        <div className="space-y-3 bg-slate-50/50 border border-slate-100/50 rounded-2xl p-6">
          <h3 className="font-black text-[#2e1d52] text-[10px] uppercase tracking-widest border-b border-slate-100 pb-2 mb-2">Shipping Details</h3>
          <div className="grid grid-cols-3 gap-y-2 text-slate-600 font-medium">
            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Carrier:</span>
            <span className="col-span-2 font-bold text-slate-800 uppercase">{data.transportCompany}</span>

            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Truck No:</span>
            <span className="col-span-2 font-bold text-slate-800">{data.truckNumber}</span>

            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Exp. Date:</span>
            <span className="col-span-2">{data.expeditionDate || '—'}</span>

            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">ETD:</span>
            <span className="col-span-2">{data.etd || '—'}</span>

            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Net Weight:</span>
            <span className="col-span-2 font-black text-[#7a9800]">{data.totalNetWeight?.toLocaleString()} kg</span>

            <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px]">Gross Weight:</span>
            <span className="col-span-2 font-black text-[#7a9800]">{data.totalGrossWeight?.toLocaleString()} kg</span>
          </div>
        </div>
      </div>

      {/* Packing List Items Table */}
      <div className="overflow-x-auto w-full border border-slate-100 rounded-2xl bg-white mb-8">
        <table className="w-full border-collapse text-left text-xs min-w-[600px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 font-black text-[9px] uppercase tracking-[0.2em] text-slate-400">
              <th className="py-4 px-6">Product</th>
              <th className="py-4 px-6 text-center w-28">Calibre</th>
              <th className="py-4 px-6 text-right w-36">Number of Boxes</th>
              <th className="py-4 px-6 text-right w-36">Quantity (Kg)</th>
              <th className="py-4 px-6 text-right w-36">Net Weight (Kg)</th>
              <th className="py-4 px-6 text-right w-36">Gross Weight (Kg)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
            {data.items && data.items.length > 0 ? (
              data.items.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/20">
                  <td className="py-4 px-6 font-bold text-[#2e1d52]">{item.product}</td>
                  <td className="py-4 px-6 text-center font-semibold">{item.calibre || '—'}</td>
                  <td className="py-4 px-6 text-right font-semibold">{item.boxes?.toLocaleString() || 0}</td>
                  <td className="py-4 px-6 text-right font-semibold">{item.quantity?.toLocaleString() || 0}</td>
                  <td className="py-4 px-6 text-right font-semibold">{item.netWeight?.toLocaleString() || 0}</td>
                  <td className="py-4 px-6 text-right font-black text-[#2e1d52]">{item.grossWeight?.toLocaleString() || 0}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 italic">No items generated for this packing list.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals Summary Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-8 pt-4">
        {/* Remarks */}
        <div className="flex-1 space-y-2 text-xs">
          {data.remarks && (
            <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl w-full">
              <h4 className="font-black text-[#2e1d52] text-[9px] uppercase tracking-widest mb-1.5">Remarks / Logistics Instructions</h4>
              <p className="font-semibold text-slate-500 leading-relaxed whitespace-pre-line">{data.remarks}</p>
            </div>
          )}
        </div>

        {/* Weight Totals Card */}
        <div className="w-full sm:w-80 bg-slate-50/50 border border-slate-100 p-6 rounded-3xl space-y-3 text-xs">
          <div className="flex justify-between font-semibold text-slate-500">
            <span>Total Boxes:</span>
            <span className="font-bold text-slate-700">{data.totalBoxes?.toLocaleString() || 0}</span>
          </div>
          <div className="flex justify-between font-semibold text-slate-500">
            <span>Total Net Weight:</span>
            <span className="font-bold text-slate-700">{data.totalNetWeight?.toLocaleString() || 0} kg</span>
          </div>
          <div className="border-t border-slate-200/80 pt-3 flex justify-between items-center text-[#2e1d52]">
            <span className="font-black uppercase tracking-wider text-[10px]">Total Gross Weight:</span>
            <span className="text-lg font-black text-[#7a9800]">{data.totalGrossWeight?.toLocaleString() || 0} kg</span>
          </div>
        </div>
      </div>

      {/* Signatures Section */}
      <div className="mt-16 grid grid-cols-2 gap-8 text-center text-xs border-t border-slate-100 pt-8 printable-only">
        <div>
          <p className="font-bold text-slate-400 uppercase tracking-widest text-[9px] mb-12">Dispatched By</p>
          <div className="w-48 mx-auto border-b border-slate-200"></div>
        </div>
        <div>
          <p className="font-bold text-slate-400 uppercase tracking-widest text-[9px] mb-12">Carrier Signature</p>
          <div className="w-48 mx-auto border-b border-slate-200"></div>
        </div>
      </div>
    </Card>
  );
}
