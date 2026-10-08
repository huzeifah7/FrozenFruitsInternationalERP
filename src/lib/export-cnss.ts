import * as ExcelJS from 'exceljs';
import { buildPayslipData } from './export-payslip-pdf';

const MONTH_NAMES = [
  'JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE'
];

export async function exportCNSSExcel(
  calculatedRows: any[],
  startDate: string,
  endDate: string,
  logoUrl: string = '/FFI_main.png'
): Promise<void> {
  // 1. Create workbook and sheet
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('CNSS Follow Up', {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 5, showGridLines: true }]
  });

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
    console.warn('Logo could not be loaded for CNSS Excel export', e);
  }

  // 3. Insert Logo
  if (logoBuffer) {
    const imgId = wb.addImage({ buffer: logoBuffer, extension: 'png' });
    const logoHeight = 70;
    const logoWidth = logoHeight * logoRatio;
    ws.addImage(imgId, {
      tl: { col: 0, row: 0 },
      ext: { width: logoWidth, height: logoHeight },
    });
  }

  // Extract month and year from startDate
  const parts = startDate.split('-');
  const startYear = parts[0];
  const startMonth = parseInt(parts[1], 10) - 1;
  const monthName = MONTH_NAMES[startMonth] || 'MOIS';

  // 4. Title Row
  ws.mergeCells('D2:J2');
  const titleCell = ws.getCell('D2');
  titleCell.value = `SUIVI CNSS MOIS ${monthName} ${startYear} Export Optimum`;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF047857' } }; // Dark Green
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.getRow(1).height = 15;
  ws.getRow(2).height = 30;
  ws.getRow(3).height = 15;
  ws.getRow(4).height = 10; // spacer

  // 5. Columns Config
  ws.columns = [
    { key: 'matricule', width: 15 },
    { key: 'cnss', width: 15 },
    { key: 'nom', width: 18 },
    { key: 'prenom', width: 18 },
    { key: 'cin', width: 12 },
    { key: 'nh', width: 10 },
    { key: 'nb', width: 10 },
    { key: 'quinz1', width: 15 },
    { key: 'quinz2', width: 15 },
    { key: 'salaireBase', width: 18 },
    { key: 'salaireDeclare', width: 18 },
    { key: 'plafond', width: 15 },
    { key: 'situation', width: 15 },
  ];

  // 6. Header Row
  const headerRowNumber = 5;
  const headerRow = ws.getRow(headerRowNumber);
  headerRow.height = 30;
  headerRow.values = [
    'MATRICULE',
    'IMM CNSS',
    'NOM',
    'PRENOM',
    'CIN',
    'NH',
    'NB',
    'QUINZ 1',
    'QUINZ 2',
    'SALAIRE DE BASE',
    'SALAIRE DECLARÉ',
    'PLAFOND',
    'SITUATION'
  ];

  // Styling thin green border
  const thinGreenBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF10B981' } },
    left: { style: 'thin', color: { argb: 'FF10B981' } },
    bottom: { style: 'thin', color: { argb: 'FF10B981' } },
    right: { style: 'thin', color: { argb: 'FF10B981' } },
  };

  for (let i = 1; i <= 13; i++) {
    const cell = headerRow.getCell(i);
    cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }; // Very Dark Green
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinGreenBorder;
  }

  // 7. Add Data Rows
  let dataRowsCount = 0;

  calculatedRows.forEach((row) => {
    const wsRow = ws.addRow({
      matricule: row.matricule,
      cnss: row.cnss,
      nom: row.nom,
      prenom: row.prenom,
      cin: row.cin,
      nh: row.nh,
      nb: row.nb,
      quinz1: row.quinz1,
      quinz2: row.quinz2,
      salaireBase: row.salaireBase,
      salaireDeclare: row.salaireDeclare,
      plafond: row.plafond,
      situation: row.situation,
    });

    wsRow.height = 20;
    dataRowsCount++;

    const isAlt = dataRowsCount % 2 === 0;

    wsRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isAlt ? 'FFECFDF5' : 'FFFFFFFF' }, // Light Green alternating
      };
      cell.border = thinGreenBorder;
      cell.font = { size: 9 };

      const colLetter = cell.address.replace(/\d+$/, '');
      
      // Text columns alignment
      if (['A', 'B', 'C', 'D', 'E', 'M'].includes(colLetter)) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
      // Number format columns (Hours/Days)
      else if (['F', 'G'].includes(colLetter)) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00';
        if (colLetter === 'G') cell.numFmt = '0'; // Days without decimals
      }
      // Currency format columns
      else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00" DH"';
      }
    });
  });

  // 8. Auto-fit columns
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

  // 9. Generate and download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CNSS_Follow_Up_${startDate}_to_${endDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
