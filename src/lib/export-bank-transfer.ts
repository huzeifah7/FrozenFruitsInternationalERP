import * as ExcelJS from 'exceljs';
import { buildPayslipData } from './export-payslip-pdf';

const MONTH_NAMES = [
  'JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE'
];

export async function exportBankTransferExcel(
  slips: any[],
  employees: any[],
  workEntries: any[],
  hrSettings: any,
  startDate: string,
  endDate: string,
  logoUrl: string = '/FFI_main.png'
): Promise<void> {
  // 1. Create workbook
  const wb = new ExcelJS.Workbook();

  // 2. Load Logo
  let logoBuffer: ArrayBuffer | null = null;
  let logoRatio = 2.4; // fallback ratio
  try {
    const resp = await fetch(logoUrl);
    const blob = await resp.blob();
    logoBuffer = await blob.arrayBuffer();
    
    // Calculate aspect ratio dynamically
    if (typeof window !== 'undefined') {
      const img = new Image();
      img.src = window.URL.createObjectURL(blob);
      await new Promise(r => { img.onload = r; img.onerror = r; });
      if (img.width && img.height) {
        logoRatio = img.width / img.height;
      }
    }
  } catch (e) {
    console.warn('Logo could not be loaded for Bank Transfer Excel export', e);
  }

  // 3. Split slips
  const declaredSlips: any[] = [];
  const notDeclaredSlips: any[] = [];

  slips.forEach(slip => {
    const rawEmp = employees.find(e => e.id === slip.employeeId);
    if (!rawEmp) return;
    const empType = (rawEmp.employeeType || '').toLowerCase();
    if (empType === 'fixed' || empType === 'fixe') return; // skip fixed

    const cnss = (rawEmp.cnssStatus || '').toLowerCase();
    const isDeclared = cnss === 'declared' || cnss === 'déclaré(e)' || cnss === 'déclaré' || cnss === 'déclarée';
    if (isDeclared) declaredSlips.push({ slip, rawEmp });
    else notDeclaredSlips.push({ slip, rawEmp });
  });

  const createSheet = (sheetName: string, items: any[], isDeclared: boolean) => {
    const ws = wb.addWorksheet(sheetName, {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 5, showGridLines: true }]
    });

    if (logoBuffer) {
      const imgId = wb.addImage({ buffer: logoBuffer, extension: 'png' });
      const logoHeight = 70;
      const logoWidth = logoHeight * logoRatio;
      ws.addImage(imgId, {
        tl: { col: 0, row: 0 },
        ext: { width: logoWidth, height: logoHeight },
      });
    }

    ws.mergeCells('D2:J2');
    const titleCell = ws.getCell('D2');
    titleCell.value = 'BANK TRANSFER';
    titleCell.font = { bold: true, size: 18, color: { argb: 'FF047857' } }; // Dark Green
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    ws.getRow(1).height = 15;
    ws.getRow(2).height = 30;
    ws.getRow(3).height = 15;
    ws.getRow(4).height = 10;

    const columns: any[] = [
      { key: 'name', width: 25 },
      { key: 'rib', width: 28 },
      { key: 'cnssStatus', width: 15 },
      { key: 'shift', width: 15 },
      { key: 'reference', width: 28 },
      { key: 'totalHours', width: 14 },
      { key: 'netHourlyWage', width: 18 },
      { key: 'grossHourlyWage', width: 18 },
      { key: 'grossEarning', width: 18 },
      { key: 'netEarning', width: 18 },
      { key: 'advance', width: 15 },
      { key: 'primes', width: 15 },
      { key: 'bankTransferAmount', width: 22 },
    ];

    if (isDeclared) {
      columns.push({ key: 'reliquat', width: 18 });
    }
    
    ws.columns = columns;

    const headerRow = ws.getRow(5);
    headerRow.height = 28;
    
    const headers = [
      'Name',
      'RIB',
      'CNSS Status',
      'Shift',
      'Reference',
      'Total Hours',
      'Net Hourly Wage',
      'Gross Hourly Wage',
      'Gross Earning',
      'Net Earning',
      'Advance',
      'Les Primes',
      isDeclared ? 'Bank Transfer Amount' : 'Total Payment',
    ];

    if (isDeclared) {
      headers.push('Reliquat');
    }

    headerRow.values = headers;

    const thinGreenBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FF10B981' } },
      left: { style: 'thin', color: { argb: 'FF10B981' } },
      bottom: { style: 'thin', color: { argb: 'FF10B981' } },
      right: { style: 'thin', color: { argb: 'FF10B981' } },
    };

    for (let i = 1; i <= headers.length; i++) {
      const cell = headerRow.getCell(i);
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinGreenBorder;
    }

    let dataRowsCount = 0;
    const parts = startDate.split('-');
    const startDay = parseInt(parts[2], 10);
    const startMonth = parseInt(parts[1], 10) - 1;
    const monthName = MONTH_NAMES[startMonth] || 'JANVIER';
    const reference = startDay <= 15 ? `1 ERE QUINZAINE ${monthName}` : `2 EME QUINZAINE ${monthName}`;

    items.forEach(({ slip, rawEmp }) => {
      const empEntries = workEntries.filter(entry => entry.employeeId === slip.employeeId);
      const payslip = buildPayslipData({
        employee: rawEmp,
        workEntries: empEntries,
        hrSettings,
        startDate,
        endDate,
      });

      // Use raw total hours from work entries (includes all: rest days, holidays, etc.)
      const realTotalHours = empEntries.reduce((sum: number, entry: any) => sum + Number(entry.totalHours || 0), 0);

      // ── Wage sources: ALWAYS from HR Settings ──
      const grossHourlyWage = Number(hrSettings?.grossHourlyWage || 0);
      const netHourlyWage = Number(hrSettings?.netHourlyWage || 0);

      // Debug: log to verify correct wages are being read
      console.log(`[BankTransfer] Employee: ${payslip.employee.employeeName}, hrSettings.grossHourlyWage=${hrSettings?.grossHourlyWage}, hrSettings.netHourlyWage=${hrSettings?.netHourlyWage}, grossHourlyWage=${grossHourlyWage}, netHourlyWage=${netHourlyWage}`);

      const advance = payslip.totals.salaryAdvance || 0;

      // ── Direct calculations: Net Earning = (Total Hours * Net Wage) - Advance ──
      const grossEarning = Math.round(realTotalHours * grossHourlyWage * 100) / 100;
      const rawNetEarning = Math.round(realTotalHours * netHourlyWage * 100) / 100;
      const netEarning = Math.round((rawNetEarning - advance) * 100) / 100;

      // ── Bank Transfer & Reliquat: Cap at 95.5 hours * netHourlyWage ──
      const maxBankTransferCap = Math.round(95.5 * netHourlyWage * 100) / 100;
      
      let bankTransferAmount = 0;
      let reliquat = 0;

      if (netEarning <= maxBankTransferCap) {
        bankTransferAmount = Math.max(0, netEarning);
        reliquat = 0;
      } else {
        bankTransferAmount = maxBankTransferCap;
        reliquat = Math.round((netEarning - maxBankTransferCap) * 100) / 100;
      }

      const rowData: any = {
        name: payslip.employee.employeeName || '-',
        rib: rawEmp.rib || '-',
        cnssStatus: rawEmp.cnssStatus || '-',
        shift: rawEmp.shift || '-',
        reference: reference,
        totalHours: realTotalHours,
        netHourlyWage: netHourlyWage,
        grossHourlyWage: grossHourlyWage,
        grossEarning: Math.round(grossEarning * 100) / 100,
        netEarning: Math.round(netEarning * 100) / 100,
        advance: payslip.totals.salaryAdvance,
        primes: payslip.earnings.basketAllowance + payslip.earnings.transportAllowance,
        bankTransferAmount: Math.round(bankTransferAmount * 100) / 100,
      };

      if (isDeclared) {
        rowData.reliquat = Math.round(reliquat * 100) / 100;
      }

      const row = ws.addRow(rowData);

      row.height = 20;
      dataRowsCount++;
      const isAlt = dataRowsCount % 2 === 0;

      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isAlt ? 'FFECFDF5' : 'FFFFFFFF' },
        };
        cell.border = thinGreenBorder;
        cell.font = { size: 9 };

        const colLetter = cell.address.replace(/\d+$/, '');
        if (['A', 'B', 'C', 'D', 'E'].includes(colLetter)) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (colLetter === 'F') {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.00';
        } else if (['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].includes(colLetter)) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = '#,##0.00" DH"';
        }
      });
    });

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
  };

  if (declaredSlips.length > 0) createSheet('Declared', declaredSlips, true);
  if (notDeclaredSlips.length > 0) createSheet('Not Declared', notDeclaredSlips, false);
  
  if (declaredSlips.length === 0 && notDeclaredSlips.length === 0) {
     const ws = wb.addWorksheet('No Data');
     ws.getCell('A1').value = 'No seasonal employees found for this period.';
  }

  // 9. Generate and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Bank_Transfer_${startDate}_to_${endDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
