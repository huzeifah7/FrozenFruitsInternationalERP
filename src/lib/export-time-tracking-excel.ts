// Export utility for Employee Work Time Tracking
// Generates a single .xlsx file with two worksheets: Working Hours and Total Working Hours
// Uses the same ERP calculation logic for shift hours (including cross-midnight handling).

import ExcelJS from 'exceljs';

// Shape of a work-time record stored in Firestore
export interface WorkTimeRecord {
  employeeId: string;
  employeeName: string; // Full name "First Last"
  date: string; // YYYY-MM-DD
  startTime1?: string; // "HH:mm"
  endTime1?: string;
  startTime2?: string;
  endTime2?: string;
  shift: string; // e.g. "Shift 1" or "Shift 2"
  isAbsent: boolean;
  isHoliday: boolean;
  advanceSalary: number;
}

/**
 * Calculate the hours for a single session, handling cross-midnight and rounding to two decimals.
 */
function calcSessionHours(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  let diff = eH * 60 + eM - (sH * 60 + sM);
  if (diff < 0) diff += 24 * 60; // cross-midnight
  const hrs = diff / 60;
  return Math.round(hrs * 100) / 100;
}

/**
 * Return the total shift hours for a record using the ERP logic.
 */
function calculateShiftHours(rec: WorkTimeRecord): number {
  if (rec.isAbsent) return 0;
  const h1 = calcSessionHours(rec.startTime1, rec.endTime1);
  const h2 = calcSessionHours(rec.startTime2, rec.endTime2);
  let total = h1 + h2;
  return Math.round(total * 100) / 100;
}

// Shared thin black border definition
const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

/**
 * Build a title/header section on the given worksheet.
 * - Logo in top-left (rows 1-4, col A)
 * - Title text merged across the full width, centered in rows 1-4
 * - Spacing rows 5-6
 * - Returns the row number where table headers should be placed (row 7).
 */
function buildSheetHeader(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  title: string,
  lastColLetter: string,
  logoBuffer: ArrayBuffer | null,
): number {
  // Merge rows 1-4 across the full width for the title area
  ws.mergeCells(`A1:${lastColLetter}4`);
  const titleCell = ws.getCell('A1');
  titleCell.value = title;
  titleCell.font = { bold: true, size: 26, color: { argb: 'FF000000' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Set row heights for the title area
  for (let r = 1; r <= 4; r++) {
    ws.getRow(r).height = 22;
  }
  // Make the title area taller overall
  ws.getRow(1).height = 30;
  ws.getRow(4).height = 30;

  // Insert logo as a floating image (does not overwrite merged cells)
  if (logoBuffer) {
    const imgId = wb.addImage({ buffer: logoBuffer, extension: 'png' });
    ws.addImage(imgId, {
      tl: { col: 0, row: 0 },
      ext: { width: 140, height: 70 },
    });
  }

  // Spacing rows 5-6
  ws.getRow(5).height = 8;
  ws.getRow(6).height = 8;

  // Table header starts at row 7
  return 7;
}

/**
 * Style a header row with light-green background, bold font, centered text, and borders.
 */
function styleTableHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.height = 36;
  for (let i = 1; i <= colCount; i++) {
    const cell = row.getCell(i);
    cell.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA5D6A7' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  }
}

/**
 * Main export function.
 * @param records Already filtered work-time records for the selected date range.
 * @param startDate ISO string (YYYY-MM-DD)
 * @param endDate   ISO string (YYYY-MM-DD)
 * @param logoUrl   Path to the company logo – defaults to '/FFI_main.png'.
 */
export async function exportTimeTrackingExcel(
  records: WorkTimeRecord[],
  startDate: string,
  endDate: string,
  logoUrl: string = '/FFI_main.png'
): Promise<void> {
  const wb = new ExcelJS.Workbook();

  // Page layout – same for both sheets
  const pageSetup: Partial<ExcelJS.PageSetup> = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };

  // Load logo once
  let logoBuffer: ArrayBuffer | null = null;
  try {
    const resp = await fetch(logoUrl);
    const blob = await resp.blob();
    logoBuffer = await blob.arrayBuffer();
  } catch (e) {
    console.warn('Logo could not be loaded for Excel export', e);
  }

  // ═══════════════════════════════════════════════════
  // Sheet 1 – Working Hours
  // ═══════════════════════════════════════════════════
  const WH_COLS = 10; // A through J
  const whSheet = wb.addWorksheet('Working Hours', { pageSetup });

  // Define column widths (NO header property – avoids auto-header at row 1)
  whSheet.columns = [
    { key: 'fullName', width: 22 },
    { key: 'date', width: 14 },
    { key: 'startTime1', width: 13 },
    { key: 'endTime1', width: 13 },
    { key: 'startTime2', width: 13 },
    { key: 'endTime2', width: 13 },
    { key: 'shift', width: 12 },
    { key: 'shiftHours', width: 14 },
    { key: 'advanceSalary', width: 18 },
    { key: 'holidayShift', width: 14 },
  ];

  // Build title section (rows 1-6), returns header row number (7)
  const whHeaderRow = buildSheetHeader(wb, whSheet, 'WORKING HOURS', 'J', logoBuffer);

  // Write column headers at row 7
  const whHeader = whSheet.getRow(whHeaderRow);
  whHeader.values = [
    'Full Name',
    'Date',
    'Start Time 1',
    'End Time 1',
    'Start Time 2',
    'End Time 2',
    'Shift',
    'Shift Hours',
    'Advanced On Salary',
    'Holiday Shift',
  ];
  styleTableHeaderRow(whHeader, WH_COLS);

  // Populate data rows starting at row 8
  records.forEach((rec, idx) => {
    const shiftHours = calculateShiftHours(rec);
    const shiftLabel = rec.shift === 'Morning' ? 'Shift 1' : rec.shift === 'Night' ? 'Shift 2' : rec.shift;
    const row = whSheet.addRow({
      fullName: rec.employeeName,
      date: rec.date,
      startTime1: rec.startTime1 ?? '-',
      endTime1: rec.endTime1 ?? '-',
      startTime2: rec.startTime2 ?? '-',
      endTime2: rec.endTime2 ?? '-',
      shift: shiftLabel,
      shiftHours,
      advanceSalary: rec.advanceSalary ?? 0,
      holidayShift: rec.isHoliday ? 'Yes' : 'No',
    });

    const isAlt = idx % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isAlt ? 'FFE8F5E9' : 'FFFFFFFF' },
      };
      cell.border = thinBorder;
      // Align by column letter
      const colLetter = cell.address.replace(/\d+$/, '');
      if (['C', 'D', 'E', 'F', 'G', 'J'].includes(colLetter)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (colLetter === 'H') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00" HRS"';
      } else if (colLetter === 'I') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00" DH"';
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  // Freeze panes below header row and enable auto-filter
  whSheet.views = [{ state: 'frozen', ySplit: whHeaderRow }];
  whSheet.autoFilter = { from: `A${whHeaderRow}`, to: `J${whHeaderRow}` };

  // ═══════════════════════════════════════════════════
  // Sheet 2 – Total Working Hours (aggregated per employee)
  // ═══════════════════════════════════════════════════
  const TH_COLS = 5; // A through E
  const totalSheet = wb.addWorksheet('Total Working Hours', { pageSetup });

  totalSheet.columns = [
    { key: 'fullName', width: 22 },
    { key: 'startDate', width: 14 },
    { key: 'endDate', width: 14 },
    { key: 'totalHours', width: 22 },
    { key: 'totalDays', width: 22 },
  ];

  // Build title section
  const thHeaderRow = buildSheetHeader(wb, totalSheet, 'TOTAL WORKING HOURS', 'E', logoBuffer);

  // Write column headers at row 7
  const totalHeader = totalSheet.getRow(thHeaderRow);
  totalHeader.values = [
    'Full Name',
    'Start Date',
    'End Date',
    'Total Working Hours',
    'Total Working Days',
  ];
  styleTableHeaderRow(totalHeader, TH_COLS);

  // Aggregate per employee
  const agg = new Map<string, { fullName: string; totalHours: number; days: Set<string> }>();
  records.forEach((rec) => {
    const h = calculateShiftHours(rec);
    if (!agg.has(rec.employeeId)) {
      agg.set(rec.employeeId, { fullName: rec.employeeName, totalHours: 0, days: new Set() });
    }
    const entry = agg.get(rec.employeeId)!;
    entry.totalHours += h;
    // Only count as a working day if shift hours > 0
    if (h > 0) {
      entry.days.add(rec.date);
    }
  });

  let rowIdx = 0;
  agg.forEach((data) => {
    const row = totalSheet.addRow({
      fullName: data.fullName,
      startDate,
      endDate,
      totalHours: Math.round(data.totalHours * 100) / 100,
      totalDays: data.days.size,
    });
    const isAlt = rowIdx % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isAlt ? 'FFE8F5E9' : 'FFFFFFFF' },
      };
      cell.border = thinBorder;
      const colLetter = cell.address.replace(/\d+$/, '');
      if (colLetter === 'D') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00" HRS"';
      } else if (colLetter === 'E') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
    rowIdx++;
  });

  // Freeze panes below header row and enable auto-filter
  totalSheet.views = [{ state: 'frozen', ySplit: thHeaderRow }];
  totalSheet.autoFilter = { from: `A${thHeaderRow}`, to: `E${thHeaderRow}` };

  // ═══════════════════════════════════════════════════
  // Auto-fit columns (simple heuristic)
  // ═══════════════════════════════════════════════════
  [whSheet, totalSheet].forEach((ws) => {
    ws.columns.forEach((col) => {
      if (!col) return;
      let maxLen = 10;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        if (cell.value) {
          const len = String(cell.value).length;
          if (len > maxLen) maxLen = len;
        }
      });
      col.width = Math.min(Math.max(maxLen + 4, (col.width as number) || 10), 30);
    });
  });

  // ═══════════════════════════════════════════════════
  // Write workbook and trigger download
  // ═══════════════════════════════════════════════════
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Employee_Working_Hours_${startDate}_${endDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
