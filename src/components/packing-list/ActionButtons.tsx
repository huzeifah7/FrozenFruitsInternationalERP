"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Edit, Trash2 } from 'lucide-react';

interface ActionButtonsProps {
  packingListId: string;
  productionType: string;
  invoiceId?: string; // undefined if not generated
  status: string;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  onGenerateInvoice?: () => Promise<void>;
  onDownloadPDF?: () => void;
  onDownloadExcel?: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  packingListId,
  productionType,
  invoiceId,
  status,
  onEdit,
  onDelete,
  onGenerateInvoice,
  onDownloadPDF,
  onDownloadExcel,
}) => {
  const router = useRouter();

  const showGenerateInvoice =
    productionType === 'Internal Production' && !invoiceId && status === 'Completed';

  const handleViewInvoice = () => {
    if (invoiceId) {
      router.push(`/invoices/${invoiceId}`);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {onEdit && (
        <Button
          variant="outline"
          onClick={onEdit}
          className="border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
        >
          <Edit size={14} /> Edit
        </Button>
      )}
      {onDelete && (
        <Button
          variant="destructive"
          onClick={onDelete}
          className="flex items-center gap-2"
        >
          <Trash2 size={14} /> Delete
        </Button>
      )}
      {showGenerateInvoice && onGenerateInvoice && (
        <Button
          variant="default"
          onClick={onGenerateInvoice}
          className="bg-[#193A7B] hover:bg-[#0F2552] text-white"
        >
          Generate Invoice
        </Button>
      )}
      {invoiceId && (
        <Button variant="outline" onClick={handleViewInvoice}>
          View Invoice
        </Button>
      )}
    </div>
  );
};
