import * as ExcelJS from 'exceljs';
import { PayslipData } from './export-payslip-pdf';

export interface AuditRecord {
  employee: any;
  payslip: PayslipData;
  locationName: string;
  workEntries?: any[];
}

const parseTime = (t: string): number => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return 0;
  return h * 60 + (m || 0);
};

const generateTimesForHours = (hours: number) => {
  let startTime1 = '';
  let endTime1 = '';
  let startTime2 = '';
  let endTime2 = '';

  if (hours <= 0) {
    return { startTime1, endTime1, startTime2, endTime2 };
  }

  const formatTimeFromMins = (totalMins: number) => {
    const h = Math.floor(totalMins / 60);
    const m = Math.round(totalMins % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const totalMins = Math.round(hours * 60);

  if (hours <= 4) {
    startTime1 = '08:00';
    endTime1 = formatTimeFromMins(8 * 60 + totalMins);
  } else {
    startTime1 = '08:00';
    endTime1 = '12:00';
    startTime2 = '13:00';
    endTime2 = formatTimeFromMins(13 * 60 + (totalMins - 4 * 60));
  }

  return { startTime1, endTime1, startTime2, endTime2 };
};

export async function exportAuditExcel(
  records: AuditRecord[],
  startDate: string,
  endDate: string,
  logoUrl: string = '/FFI_main.png'
): Promise<void> {

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Working Hours', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 5, showGridLines: true }]
  });

  // Load Logo
  let logoBuffer: ArrayBuffer | null = null;
  try {
    const resp = await fetch(logoUrl);
    const blob = await resp.blob();
    logoBuffer = await blob.arrayBuffer();
  } catch (e) {
    console.warn('Logo could not be loaded for Working Hours Excel export', e);
  }

  // Insert Logo
  if (logoBuffer) {
    const imgId = wb.addImage({ buffer: logoBuffer, extension: 'png' });
    ws.addImage(imgId, {
      tl: { col: 0, row: 0 },
      ext: { width: 168, height: 70 },
    });
  }

  // Title Row
  ws.mergeCells('D2:G2');
  const titleCell = ws.getCell('D2');
  titleCell.value = `WORKING HOURS`;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF047857' } }; // Dark Green
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells('D3:G3');
  const subtitleCell = ws.getCell('D3');
  subtitleCell.value = `${startDate} To ${endDate}`;
  subtitleCell.font = { bold: true, size: 12, color: { argb: 'FF064E3B' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.getRow(1).height = 15;
  ws.getRow(2).height = 25;
  ws.getRow(3).height = 20;
  ws.getRow(4).height = 10; // spacer

  // Columns Config
  ws.columns = [
    { key: 'fullName', width: 25 },
    { key: 'date', width: 15 },
    { key: 'startTime1', width: 15 },
    { key: 'endTime1', width: 15 },
    { key: 'startTime2', width: 15 },
    { key: 'endTime2', width: 15 },
    { key: 'shift', width: 15 },
    { key: 'shiftHours', width: 15 },
    { key: 'advancedOnSalary', width: 20 },
    { key: 'holidayShift', width: 15 },
  ];

  // Header Row
  const headerRowNumber = 5;
  const headerRow = ws.getRow(headerRowNumber);
  headerRow.height = 30;
  headerRow.values = [
    'Full Name',
    'Date',
    'Start Time 1',
    'End Time 1',
    'Start Time 2',
    'End Time 2',
    'Shift',
    'Shift Hours',
    'Advanced On Salary',
    'Holiday Shift'
  ];

  // Styling green borders
  const thinGreenBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF10B981' } },
    left: { style: 'thin', color: { argb: 'FF10B981' } },
    bottom: { style: 'thin', color: { argb: 'FF10B981' } },
    right: { style: 'thin', color: { argb: 'FF10B981' } },
  };

  // Header style
  for (let i = 1; i <= 10; i++) {
    const cell = headerRow.getCell(i);
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; // Very Dark Green
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinGreenBorder;
  }

  let rowIdx = 0;

  // Helper to generate date range strings
  const getDatesBetween = (startStr: string, endStr: string) => {
    const dates: string[] = [];
    const currentDate = new Date(startStr);
    const end = new Date(endStr);
    // Reset times to avoid timezone drift
    currentDate.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    while (currentDate <= end) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  const periodDates = getDatesBetween(startDate, endDate);

  // Data Rows
  records.forEach((record) => {
    const { employee: emp, workEntries = [] } = record;
    const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    const employeeShift = emp.shift || '-';

    // Map by date for O(1) lookup
    const entryMap = new Map();
    workEntries.forEach((entry) => {
      if (entry.date) {
        entryMap.set(entry.date, entry);
      }
    });

    const dailyData: any[] = [];

    periodDates.forEach((dateStr) => {
      const entry = entryMap.get(dateStr);

      let startTime1 = '';
      let endTime1 = '';
      let startTime2 = '';
      let endTime2 = '';
      let advancedOnSalary: number | string = '';

      if (entry) {
        startTime1 = entry.startTime1 || '';
        endTime1 = entry.endTime1 || '';
        startTime2 = entry.startTime2 || '';
        endTime2 = entry.endTime2 || '';
        
        const adv = Number(entry.advanceSalary || 0);
        if (adv > 0) advancedOnSalary = adv;
      }

      const isHoliday = entry && (entry.isHoliday === true || entry.holidayShift === true || entry.holidayShift === 'Yes');
      const hasTime = !!((startTime1 && endTime1) || (startTime2 && endTime2));
      
      const inferredShift = (entry?.shift || entry?.shiftName || emp.shift || '').trim();
      const finalShift = inferredShift && inferredShift !== '-' ? inferredShift : employeeShift;

      if (hasTime) {
        const t1 = parseTime(startTime1);
        const t2 = parseTime(endTime1);
        const d1 = (t2 >= t1 && startTime1 && endTime1) ? t2 - t1 : 0;

        const t3 = parseTime(startTime2);
        const t4 = parseTime(endTime2);
        const d2 = (t4 >= t3 && startTime2 && endTime2) ? t4 - t3 : 0;

        const rawHours = (d1 + d2) / 60;

        let normalizedHours = rawHours;
        if (rawHours > 0 && rawHours < 2) {
          normalizedHours = 2.00;
        } else if (rawHours > 8) {
          normalizedHours = 8.00;
        } else {
          normalizedHours = Number(rawHours.toFixed(2));
        }

        dailyData.push({
          dateStr,
          isWorked: true,
          hours: normalizedHours,
          startTime1,
          endTime1,
          startTime2,
          endTime2,
          shift: finalShift,
          advancedOnSalary,
          isHoliday: !!isHoliday
        });
      } else {
        dailyData.push({
          dateStr,
          isWorked: false,
          hours: 'R',
          startTime1: '',
          endTime1: '',
          startTime2: '',
          endTime2: '',
          shift: '',
          advancedOnSalary,
          isHoliday: !!isHoliday
        });
      }
    });

    // Balance to 95.5 hours per period
    const workedDays = dailyData.filter(d => d.isWorked);
    let currentTotal = Number(workedDays.reduce((sum, d) => sum + d.hours, 0).toFixed(2));

    if (workedDays.length > 0 && currentTotal !== 95.5) {
      if (currentTotal < 95.5) {
        for (let i = 0; i < workedDays.length; i++) {
          const diff = Number((95.5 - currentTotal).toFixed(2));
          if (diff <= 0.0001) break;

          const currentHours = workedDays[i].hours;
          if (currentHours < 8.00) {
            const add = Math.min(diff, 8.00 - currentHours);
            workedDays[i].hours = Number((currentHours + add).toFixed(2));
            currentTotal = Number((currentTotal + add).toFixed(2));
          }
        }
      } else if (currentTotal > 95.5) {
        for (let i = workedDays.length - 1; i >= 0; i--) {
          const diff = Number((currentTotal - 95.5).toFixed(2));
          if (diff <= 0.0001) break;

          const currentHours = workedDays[i].hours;
          if (currentHours > 2.00) {
            const sub = Math.min(diff, currentHours - 2.00);
            workedDays[i].hours = Number((currentHours - sub).toFixed(2));
            currentTotal = Number((currentTotal - sub).toFixed(2));
          }
        }
      }
      
      if (Math.abs(currentTotal - 95.5) > 0.0001) {
        console.warn(`Could not balance to 95.5 hours for ${fullName}. Total is ${currentTotal}.`);
      }
    }

    // Write final daily data to Excel
    dailyData.forEach((day) => {
      const isAlt = rowIdx % 2 === 0;
      rowIdx++;

      const [y, m, d] = day.dateStr.split('-');
      const displayDate = `${d}-${m}-${y}`;

      let finalStartTime1 = '';
      let finalEndTime1 = '';
      let finalStartTime2 = '';
      let finalEndTime2 = '';
      let shiftHours: number | string = 'R';

      if (day.isWorked) {
        const times = generateTimesForHours(day.hours);
        finalStartTime1 = times.startTime1;
        finalEndTime1 = times.endTime1;
        finalStartTime2 = times.startTime2;
        finalEndTime2 = times.endTime2;
        shiftHours = Number(day.hours.toFixed(2));
      }

      const row = ws.addRow({
        fullName: fullName,
        date: displayDate,
        startTime1: finalStartTime1,
        endTime1: finalEndTime1,
        startTime2: finalStartTime2,
        endTime2: finalEndTime2,
        shift: day.shift,
        shiftHours,
        advancedOnSalary: day.advancedOnSalary || '',
        holidayShift: day.isHoliday ? 1 : '',
      });

      row.height = 20;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isAlt ? 'FFECFDF5' : 'FFFFFFFF' },
        };
        cell.border = thinGreenBorder;
        cell.font = { size: 9 };

        if ([1, 2, 7, 10].includes(colNumber)) { // Full Name, Date, Shift, Holiday Shift
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if ([3, 4, 5, 6].includes(colNumber)) { // Times
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if ([8, 9].includes(colNumber)) { // Shift Hours, Advanced On Salary
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          if (typeof cell.value === 'number') {
            cell.numFmt = '#,##0.00';
          }
        }
      });
    });
  });
  // Auto-fit columns
  ws.columns.forEach((col) => {
    if (!col) return;
    let maxLen = 12;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      if (cell.value) {
        const len = String(cell.value).length;
        if (len > maxLen) maxLen = len;
      }
    });
    col.width = Math.min(Math.max(maxLen + 4, (col.width as number) || 12), 32);
  });

  // Generate and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Working_Hours_${startDate}_to_${endDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

