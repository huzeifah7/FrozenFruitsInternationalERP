import React from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface InvoiceItem {
  description?: string;
  product?: string;
  calibre?: string;
  quantity: number;
  price: number;
}

export interface LinkedCreditNoteItem {
  id?: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  remarks?: string;
}

export interface InvoicePreviewData {
  invoiceNumber: string;
  poOrderNumber?: string;
  date: string;
  dueDate?: string;
  invoiceType: 'invoice' | 'produce' | 'credit_note' | 'proforma' | string;
  customerName?: string;
  shippingAddress?: string;
  invoicingAddress?: string;
  ice?: string;
  iff?: string;
  remarks?: string;
  taxRate?: number;
  discount?: number;
  items: InvoiceItem[];
  countryOfOrigin?: string;
  totalGrossWeight?: number;
  totalBoxes?: number;
  createdBy?: string;
  totalAmount?: number;
  linkedCreditNotes?: LinkedCreditNoteItem[];
  creditNotesTotal?: number;
  remainingTotal?: number;
  currency?: string;
}

interface ERPInvoicePreviewProps {
  data: InvoicePreviewData;
  className?: string;
}

export function ERPInvoicePreview({ data, className }: ERPInvoicePreviewProps) {
  // Calculations
  const amount = data.items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.price || 0)), 0);
  const tax = Number(data.taxRate || 0);
  const discount = Number(data.discount || 0);
  
  const rawInvoiceTotal = data.totalAmount !== undefined && data.totalAmount !== null 
    ? Number(data.totalAmount) 
    : (amount + tax - discount);

  const hasCreditNotes = data.linkedCreditNotes && data.linkedCreditNotes.length > 0;
  const cnTotal = Number(data.creditNotesTotal || 0);
  const finalRemainingAmount = data.remainingTotal !== undefined ? data.remainingTotal : (rawInvoiceTotal - cnTotal);

  const currencySymbol = data.currency === 'EUR' ? '€' : (data.currency || '€');
  const currencyName = data.currency === 'EUR' ? 'Euro' : (data.currency || 'Euro');

  const getInvoiceTypeLabel = () => {
    const typeStr = String(data.invoiceType || '').toLowerCase();
    if (typeStr.includes('produce')) return 'Produce';
    if (typeStr.includes('credit')) return 'Credit Note';
    if (typeStr.includes('proforma')) return 'Proforma';
    return 'Invoice';
  };

  const labelFrom = `${getInvoiceTypeLabel()} From`;
  const labelTo = `${getInvoiceTypeLabel()} To`;

  return (
    <div className={cn("bg-white p-10 max-w-[1100px] mx-auto overflow-hidden printable-area text-gray-700 shadow-sm border border-gray-100 rounded-lg", className)}>
      <div className="flex justify-between items-start mb-8">
        {/* Left Side: Logo & From */}
        <div className="space-y-4">
          <Image 
            src="/FFI_main.png" 
            alt="Export Optimum Logo" 
            width={80}
            height={80}
            className="object-contain"
          />
          <div className="space-y-1 text-sm">
            <h3 className="font-bold text-black text-base">{labelFrom}</h3>
            <p className="text-gray-600 uppercase">EXPORT OPTIMUM</p>
            <p className="text-gray-500 uppercase">DOUAR MOUARAA TEYARA</p>
            <p className="text-gray-500 uppercase">LAAOUAMRA KSAR EL KEBIR</p>
            <p className="text-gray-500">Phone: 00212678732391</p>
          </div>
        </div>

        {/* Right Side: Meta & To */}
        <div className="flex flex-col items-end space-y-6">
          <div className="text-right space-y-1 text-sm text-gray-500">
            <div><span className="font-medium">{getInvoiceTypeLabel()} N°:</span> {data.invoiceNumber}</div>
            <div><span className="font-medium">Date:</span> {data.date}</div>
            {data.poOrderNumber && data.poOrderNumber !== '-' && (
              <div><span className="font-medium">PO Order N°:</span> {data.poOrderNumber}</div>
            )}
          </div>

          <div className="text-left w-72 space-y-1 text-sm">
            <h3 className="font-bold text-black text-base mb-2">{labelTo}</h3>
            {data.customerName && (
              <p className="text-gray-600">{data.customerName}</p>
            )}
            {data.invoicingAddress && (
              <p className="text-gray-500">{data.invoicingAddress}</p>
            )}
            <p className="text-gray-500">Incoterms: {(data as any).incoterms || (data as any).incoterm || 'DAP'} , Payment Terms: {(data as any).paymentTerms || (data as any).payment_terms || '—'}</p>
            
            {(data.ice || data.iff) && (
              <>
                {data.ice && <p className="text-gray-500">ICE: {data.ice}</p>}
                {data.iff && <p className="text-gray-500">IF: {data.iff}</p>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-8">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-[#f4f6fb] text-gray-700 font-semibold border-b border-gray-200">
              <th className="py-3 px-4 w-24">Code</th>
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-4 text-center">Quantity (kg)</th>
              <th className="py-3 px-4 text-center">Price ({currencyName}/Kg)</th>
              <th className="py-3 px-4 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.items.map((item, idx) => {
              const displayDesc = item.description || 
                [item.product, item.calibre ? `- Cal. ${item.calibre}` : ''].filter(Boolean).join(' ') || 
                'Unnamed Item';
              const lineTotal = Number(item.quantity || 0) * Number(item.price || 0);
              const code = (item as any).itemCode || (item as any).item_code || (item as any).code || 'A2';

              return (
                <tr key={idx} className="hover:bg-gray-50/50">
                  <td className="py-3 px-4 text-gray-600">{code}</td>
                  <td className="py-3 px-4 text-gray-600">{displayDesc}</td>
                  <td className="py-3 px-4 text-center text-gray-600">{Number(item.quantity || 0)}</td>
                  <td className="py-3 px-4 text-center text-gray-600">{Number(item.price || 0).toFixed(4)}{currencySymbol}</td>
                  <td className="py-3 px-4 text-right text-gray-600">{lineTotal}{currencySymbol}</td>
                </tr>
              );
            })}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">No items available</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer / Totals */}
      <div className="mt-8 flex justify-end">
        <div className="w-72 space-y-4 text-sm font-bold text-black pt-2">
          <div className="flex justify-between items-center text-black">
            <span>Amount:</span>
            <span>{rawInvoiceTotal}{currencySymbol}</span>
          </div>
          <div className="flex justify-between items-center text-black">
            <span>Tax:</span>
            <span>{tax}{currencySymbol}</span>
          </div>
          <div className="flex justify-between items-center text-black">
            <span>Discount:</span>
            <span>{discount}{currencySymbol}</span>
          </div>
          <div className="flex justify-between items-center text-black pt-2 border-t border-gray-200">
            <span>Final Amount:</span>
            <span>{rawInvoiceTotal}{currencySymbol}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
