import ExcelJS from 'exceljs';
import { format } from 'date-fns';

export interface RawMaterialPricingExportRow {
  lotNumber: string;
  supplierName: string;
  price: number;
  decayPrice: number;
  driverName: string;
  plateNumber: string;
  transportCost: number;
  workerCost: number;
  shiftDate: string;
  farmName: string;
  totalNetWeight: number;
  dateTime: string;
  locationName: string;
  blGrossWeight: number;
  blNetWeight: number;
  decayNetWeight: number;
  rebate: number;
  amount: number | 'Pending';
}

export async function exportRawMaterialPricingExcel(rows: RawMaterialPricingExportRow[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Raw Material Pricing', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    }
  });

  // 1. Fetch & Insert Logo
  try {
    const response = await fetch('/FFI_main.png');
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const imageId = wb.addImage({
      buffer: arrayBuffer,
      extension: 'png',
    });
    ws.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 120, height: 60 }
    });
  } catch (err) {
    console.error('Failed to load logo for Excel export', err);
  }

  // 2. Title Row (Row 1)
  const titleRow = ws.getRow(1);
  titleRow.height = 46;
  ws.mergeCells('A1:R1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'Raw Material Pricing';
  titleCell.font = { bold: true, size: 20, color: { argb: 'FF2E1D52' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Spacer Row (Row 2)
  ws.getRow(2).height = 10;

  // 3. Define Columns & Headers (Row 3)
  ws.columns = [
    { key: 'lotNumber', width: 16 },
    { key: 'supplierName', width: 24 },
    { key: 'price', width: 16 },
    { key: 'decayPrice', width: 18 },
    { key: 'driverName', width: 20 },
    { key: 'plateNumber', width: 15 },
    { key: 'transportCost', width: 20 },
    { key: 'workerCost', width: 18 },
    { key: 'shiftDate', width: 15 },
    { key: 'farmName', width: 20 },
    { key: 'totalNetWeight', width: 22 },
    { key: 'dateTime', width: 22 },
    { key: 'locationName', width: 18 },
    { key: 'blGrossWeight', width: 22 },
    { key: 'blNetWeight', width: 22 },
    { key: 'decayNetWeight', width: 22 },
    { key: 'rebate', width: 14 },
    { key: 'amount', width: 22 },
  ];

  const headerRow = ws.getRow(3);
  headerRow.height = 38;
  headerRow.values = [
    'Lot Number',
    'Supplier',
    'Price (DH)',
    'Decay Price (DH)',
    'Driver Name',
    'Plate Number',
    'Transport Cost (DH)',
    'Worker Cost (DH)',
    'Shift Date',
    'Farm',
    'Total Net Weight (KG)',
    'Date and Time',
    'Location',
    'BL Gross Weight (KG)',
    'BL Net Weight (KG)',
    'Decay Net Weight (KG)',
    'Rebate (%)',
    'Amount (DH)',
  ];

  // Style Headers
  for (let i = 1; i <= 18; i++) {
    const cell = headerRow.getCell(i);
    cell.font = { bold: true, size: 10, color: { argb: 'FF1A3A00' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDFD9C2' } }; // Light olive/beige background
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  }

  // 4. Freeze Pane & Auto-Filter
  ws.views = [{ state: 'frozen', ySplit: 3 }];
  ws.autoFilter = { from: 'A3', to: 'R3' };

  // 5. Add Data Rows
  rows.forEach((r, idx) => {
    const isAlt = idx % 2 === 1;
    const row = ws.addRow({
      lotNumber: r.lotNumber || '',
      supplierName: r.supplierName || '',
      price: r.price != null ? Number(r.price) : null,
      decayPrice: r.decayPrice != null ? Number(r.decayPrice) : null,
      driverName: r.driverName || '',
      plateNumber: r.plateNumber || '',
      transportCost: r.transportCost != null ? Number(r.transportCost) : null,
      workerCost: r.workerCost != null ? Number(r.workerCost) : null,
      shiftDate: r.shiftDate || '',
      farmName: r.farmName || '',
      totalNetWeight: r.totalNetWeight != null ? Number(r.totalNetWeight) : null,
      dateTime: r.dateTime || '',
      locationName: r.locationName || '',
      blGrossWeight: r.blGrossWeight != null ? Number(r.blGrossWeight) : null,
      blNetWeight: r.blNetWeight != null ? Number(r.blNetWeight) : null,
      decayNetWeight: r.decayNetWeight != null ? Number(r.decayNetWeight) : null,
      rebate: r.rebate != null ? Number(r.rebate) : null,
      amount: r.amount === 'Pending' ? 'Pending' : (r.amount != null ? Number(r.amount) : null),
    });
    row.height = 22;

    for (let i = 1; i <= 18; i++) {
      const cell = row.getCell(i);
      cell.font = { size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? 'FFF9F8F5' : 'FFFFFFFF' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };

      const key = ws.columns[i - 1].key;
      if (key === 'lotNumber' || key === 'plateNumber' || key === 'shiftDate' || key === 'dateTime') {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (
        key === 'price' ||
        key === 'decayPrice' ||
        key === 'transportCost' ||
        key === 'workerCost' ||
        key === 'totalNetWeight' ||
        key === 'blGrossWeight' ||
        key === 'blNetWeight' ||
        key === 'decayNetWeight' ||
        key === 'rebate' ||
        key === 'amount'
      ) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        
        if (key === 'rebate') {
          cell.numFmt = '0.0" %"';
        } else if (
          key === 'totalNetWeight' ||
          key === 'blGrossWeight' ||
          key === 'blNetWeight' ||
          key === 'decayNetWeight'
        ) {
          cell.numFmt = '#,##0.00" KG"';
        } else {
          if (cell.value !== 'Pending') {
            cell.numFmt = '#,##0.00" DH"';
          }
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    }
  });

  // 6. Totals Row
  const totalTransport = rows.reduce((s, r) => s + Number(r.transportCost || 0), 0);
  const totalWorker = rows.reduce((s, r) => s + Number(r.workerCost || 0), 0);
  const totalGrossWeight = rows.reduce((s, r) => s + Number(r.blGrossWeight || 0), 0);
  const totalNetWeight = rows.reduce((s, r) => s + Number(r.blNetWeight || 0), 0);
  const totalDecay = rows.reduce((s, r) => s + Number(r.decayNetWeight || 0), 0);
  const totalAmount = rows.reduce((s, r) => s + (r.amount === 'Pending' ? 0 : Number(r.amount || 0)), 0);

  const totalsRowValues = Array(18).fill('');
  totalsRowValues[0] = 'TOTAL';
  totalsRowValues[6] = totalTransport;
  totalsRowValues[7] = totalWorker;
  totalsRowValues[13] = totalGrossWeight;
  totalsRowValues[14] = totalNetWeight;
  totalsRowValues[15] = totalDecay;
  totalsRowValues[17] = totalAmount;

  const totalRow = ws.addRow(totalsRowValues);
  totalRow.height = 28;
  ws.mergeCells(`A${totalRow.number}:F${totalRow.number}`);

  for (let i = 1; i <= 18; i++) {
    const cell = totalRow.getCell(i);
    cell.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDFD7C0' } }; // Darker beige background
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'medium', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };

    const key = ws.columns[i - 1].key;
    if (i <= 6) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else if (
      key === 'transportCost' ||
      key === 'workerCost' ||
      key === 'blGrossWeight' ||
      key === 'blNetWeight' ||
      key === 'decayNetWeight' ||
      key === 'amount'
    ) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      
      if (
        key === 'blGrossWeight' ||
        key === 'blNetWeight' ||
        key === 'decayNetWeight'
      ) {
        cell.numFmt = '#,##0.00" KG"';
      } else {
        cell.numFmt = '#,##0.00" DH"';
      }
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  // 7. Auto-fit column widths
  ws.columns.forEach(col => {
    let maxLen = col.header ? String(col.header).length : 12;
    if (col.eachCell) {
      col.eachCell({ includeEmpty: false }, cell => {
        if (cell.value) {
          let str = String(cell.value);
          if (typeof cell.value === 'number') {
            str = cell.value.toLocaleString();
          }
          if (str.length > maxLen) {
            maxLen = str.length;
          }
        }
      });
    }
    col.width = Math.min(Math.max(maxLen + 4, 12), 35);
  });

  // 8. Generate File Buffer & Trigger Download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Raw-Material-Pricing-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
