import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface ERPExportButtonsProps {
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  excelData?: any[];
  excelFileName?: string;
  className?: string;
  hidePDF?: boolean;
}

export function ERPExportButtons({
  onExportPDF,
  onExportExcel,
  excelData,
  excelFileName = 'export-data',
  className,
  hidePDF = false
}: ERPExportButtonsProps) {

  const handleExportExcelDefault = () => {
    if (onExportExcel) {
      onExportExcel();
      return;
    }

    if (!excelData || excelData.length === 0) return;

    // Convert keys to uppercase or clean formatting
    const cleanedData = excelData.map(row => {
      const newRow: any = {};
      Object.keys(row).forEach(key => {
        // Camel case to separate title
        const titleKey = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        newRow[titleKey] = row[key];
      });
      return newRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(cleanedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, `${excelFileName}.xlsx`);
  };

  const handleExportPDFDefault = () => {
    if (onExportPDF) {
      onExportPDF();
      return;
    }
    // Default fallback: Trigger browser print
    window.print();
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {!hidePDF && (
        <Button
          type="button"
          onClick={handleExportPDFDefault}
          className="h-12 w-12 bg-[#193A7B] hover:bg-[#0F2552] text-white shadow-lg shadow-[#193A7B]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 p-0"
          title="Export PDF"
        >
          <FileText size={20} className="stroke-[2.5]" />
        </Button>
      )}
      <Button
        type="button"
        onClick={handleExportExcelDefault}
        disabled={!onExportExcel && (!excelData || excelData.length === 0)}
        className="h-12 w-12 bg-[#193A7B] hover:bg-[#0F2552] text-white shadow-lg shadow-[#193A7B]/20 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 p-0 disabled:opacity-50"
        title="Export Excel"
      >
        <Download size={20} className="stroke-[2.5]" />
      </Button>
    </div>
  );
}
