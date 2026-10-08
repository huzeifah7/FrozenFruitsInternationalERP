import ExcelJS from 'exceljs';
import { getBase64ImageFromUrl } from './utils';

export const generateCabraneSituationExcel = async ({
  cabraneName,
  startDate,
  endDate,
  station,
  totalTransportCost,
  totalPayment,
  openAmount,
  soldeRows,
  paymentRows
}: {
  cabraneName: string;
  startDate: string;
  endDate: string;
  station: string;
  totalTransportCost: number;
  totalPayment: number;
  openAmount: number;
  soldeRows: any[];
  paymentRows: any[];
}) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Cabrane Situation', {
    pageSetup: { paperSize: 9, orientation: 'portrait' }
  });

  // 1. Header Section
  // Logo
  let logoId: number | null = null;
  try {
    const logoBase64 = await getBase64ImageFromUrl('/FFI_main.png');
    logoId = wb.addImage({
      base64: logoBase64,
      extension: 'png',
    });
  } catch (err) {
    console.warn('Could not load logo for Cabrane Situation Excel', err);
  }

  // Define Styles
  const primaryColor = 'FF2E1D52'; // #2e1d52
  const lightYellowColor = 'FFFFFCE6'; // rgb(255, 252, 230)
  const headerBgColor = 'FFF1F5F9'; // slate-50
  const headerTextColor = 'FF475569'; // slate-600
  const blackColor = 'FF000000';

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: blackColor } },
    left: { style: 'thin', color: { argb: blackColor } },
    bottom: { style: 'thin', color: { argb: blackColor } },
    right: { style: 'thin', color: { argb: blackColor } }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  ws.columns = [
    { width: 15 }, // A: Date
    { width: 20 }, // B: Lot / Operation
    { width: 25 }, // C: Cabrane Name
    { width: 20 }, // D: Amount
    { width: 20 }, // E: Origin / Note
    { width: 25 }, // F: Supplier
  ];

  if (logoId !== null) {
    ws.addImage(logoId, {
      tl: { col: 0, row: 0 },
      ext: { width: 136, height: 64 }
    });
  }

  // Center Title
  ws.mergeCells('C2:D3');
  const titleCell = ws.getCell('C2');
  titleCell.value = 'Cabrane Situation';
  titleCell.font = { name: 'Helvetica', size: 18, bold: true, color: { argb: primaryColor } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Date Range
  ws.getCell('F1').value = `DE: ${startDate || '—'}`;
  ws.getCell('F1').font = { size: 10, color: { argb: 'FF646464' } };
  ws.getCell('F1').alignment = { horizontal: 'right' };

  ws.getCell('F2').value = `AU: ${endDate || '—'}`;
  ws.getCell('F2').font = { size: 10, color: { argb: 'FF646464' } };
  ws.getCell('F2').alignment = { horizontal: 'right' };

  // Station & Cabrane Name rows
  ws.getCell('A6').value = `Station: ${station}`;
  ws.getCell('A6').font = { bold: true };

  ws.getCell('A7').value = `Cabrane Name: ${cabraneName}`;
  ws.getCell('A7').font = { bold: true };

  let currentRow = 9;

  // 2. First section title
  ws.mergeCells(`A${currentRow}:F${currentRow}`);
  const sec1Cell = ws.getCell(`A${currentRow}`);
  sec1Cell.value = `Matiere premiere: ${formatCurrency(totalTransportCost)} MAD`;
  sec1Cell.font = { bold: true };
  sec1Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightYellowColor } };
  sec1Cell.border = thinBorder;
  currentRow++;

  // 3. Matiere premiere table columns
  const mpHeaders = ['Date', 'Lot Number', 'Cabrane name', 'Worker Cost', 'Origin', 'Supplier'];
  mpHeaders.forEach((header, index) => {
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: headerTextColor } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBgColor } };
    cell.border = thinBorder;
  });
  currentRow++;

  soldeRows.forEach(row => {
    const rowValues = [
      row.date,
      row.lotNumber,
      cabraneName,
      `${formatCurrency(row.workerCost)} DH`,
      row.origin,
      row.supplierName
    ];
    rowValues.forEach((val, index) => {
      const cell = ws.getCell(currentRow, index + 1);
      cell.value = val;
      cell.border = thinBorder;
      if (index === 3) {
        cell.alignment = { horizontal: 'right' };
      }
    });
    currentRow++;
  });

  // 4. Blank spacing between sections
  currentRow += 2;

  // 5. Second section title
  ws.mergeCells(`A${currentRow}:F${currentRow}`);
  const sec2Cell = ws.getCell(`A${currentRow}`);
  sec2Cell.value = `Avances et Paiements: ${formatCurrency(totalPayment)} dh`;
  sec2Cell.font = { bold: true };
  sec2Cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightYellowColor } };
  sec2Cell.border = thinBorder;
  currentRow++;

  // 6. Payments table columns
  const payHeaders = ['Date', 'Operation', 'Cabrane name', 'Operation Amount', 'Note', ''];
  payHeaders.forEach((header, index) => {
    if (!header) return;
    const cell = ws.getCell(currentRow, index + 1);
    cell.value = header;
    cell.font = { bold: true, color: { argb: headerTextColor } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBgColor } };
    cell.border = thinBorder;
  });
  ws.mergeCells(`E${currentRow}:F${currentRow}`); // Merge the Note column to take the remaining space
  // We need to apply borders to the merged cells
  ws.getCell(`E${currentRow}`).border = thinBorder;
  ws.getCell(`F${currentRow}`).border = thinBorder;
  currentRow++;

  paymentRows.forEach(row => {
    ws.getCell(currentRow, 1).value = row.date;
    ws.getCell(currentRow, 1).border = thinBorder;

    ws.getCell(currentRow, 2).value = row.paymentType;
    ws.getCell(currentRow, 2).border = thinBorder;

    ws.getCell(currentRow, 3).value = cabraneName;
    ws.getCell(currentRow, 3).border = thinBorder;

    ws.getCell(currentRow, 4).value = `${formatCurrency(row.amount)} DH`;
    ws.getCell(currentRow, 4).border = thinBorder;
    ws.getCell(currentRow, 4).alignment = { horizontal: 'right' };

    ws.getCell(currentRow, 5).value = row.note;
    ws.getCell(currentRow, 5).border = thinBorder;
    ws.getCell(currentRow, 6).border = thinBorder;
    ws.mergeCells(`E${currentRow}:F${currentRow}`);
    
    currentRow++;
  });

  // 4. Blank spacing
  currentRow += 2;

  // 7. Final section
  ws.getCell(`E${currentRow}`).value = `Situation: ${formatCurrency(openAmount)} dh`;
  ws.getCell(`E${currentRow}`).font = { size: 14, bold: true };
  ws.getCell(`E${currentRow}`).alignment = { horizontal: 'right' };
  ws.mergeCells(`E${currentRow}:F${currentRow}`);

  // Download logic
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  // File Name: {CabraneName} {StartDate} {EndDate}.xlsx
  const sd = startDate || 'ALL';
  const ed = endDate || 'ALL';
  a.download = `${cabraneName} ${sd} ${ed}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};
