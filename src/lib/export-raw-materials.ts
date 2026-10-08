/**
 * Raw Materials Stock Export Utility
 * Supports: Excel (.xlsx) and HTML Print/PDF
 *
 * Uses SheetJS (xlsx) — client-side only.
 */

import ExcelJS from 'exceljs';
import { format } from 'date-fns';

export interface RawMaterialExportRow {
  lotNumber: string;
  locationName: string;
  dateTime: string;
  supplierName: string;
  plateNumber: string;
  blNetWeight: number;
  netWeight: number;
  decayNetWeight: number;
  weightDifference: number;
  boxesIn: number;
}

// ─────────────────────────────────────────────
// EXCEL EXPORT (ExcelJS)
// ─────────────────────────────────────────────
export async function exportRawMaterialsExcel(rows: RawMaterialExportRow[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Raw Materials', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  // ── 1. Fetch & Insert Logo ──────────────────
  try {
    const response = await fetch('/FFI_main.png');
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const imageId = wb.addImage({
      buffer: arrayBuffer,
      extension: 'png',
    });
    // Insert logo at A1
    ws.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 120, height: 60 }
    });
  } catch (err) {
    console.error('Failed to load logo for Excel export', err);
  }

  // ── 2. Build Title Row ──────────────────────
  const titleRow = ws.getRow(1);
  titleRow.height = 46;
  ws.mergeCells('A1:J1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'RAW MATERIAL';
  titleCell.font = { bold: true, size: 20, color: { argb: 'FF3D5A00' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  
  // Spacer Row
  ws.getRow(2).height = 8;

  // ── 3. Configure Columns & Header ───────────
  ws.columns = [
    { key: 'lotNumber', width: 16 },
    { key: 'locationName', width: 16 },
    { key: 'dateTime', width: 22 },
    { key: 'supplierName', width: 24 },
    { key: 'plateNumber', width: 14 },
    { key: 'blNetWeight', width: 20 },
    { key: 'netWeight', width: 18 },
    { key: 'decayNetWeight', width: 22 },
    { key: 'weightDifference', width: 22 },
    { key: 'boxesIn', width: 12 },
  ];

  const headerRow = ws.getRow(3);
  headerRow.height = 38;
  headerRow.values = [
    'Lot Number',
    'Location',
    'Date and Time',
    'Supplier',
    'Plate Number',
    'BL Net Weight (KG)',
    'Net Weight (KG)',
    'Decay Net Weight (KG)',
    'Weight Difference (KG)',
    'Boxes IN',
  ];

  for (let i = 1; i <= 10; i++) {
    const cell = headerRow.getCell(i);
    cell.font = { bold: true, size: 10, color: { argb: 'FF1A3A00' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D6B0' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  }

  // ── 4. Freeze Pane & Auto-Filter ────────────
  ws.views = [{ state: 'frozen', ySplit: 3 }];
  ws.autoFilter = { from: 'A3', to: 'J3' };

  // ── 5. Add Data Rows ────────────────────────
  rows.forEach((r, idx) => {
    const isAlt = idx % 2 === 1;
    const row = ws.addRow({
      lotNumber: r.lotNumber || '',
      locationName: r.locationName || '',
      dateTime: r.dateTime || '',
      supplierName: r.supplierName || '',
      plateNumber: r.plateNumber || '',
      blNetWeight: Number(r.blNetWeight) || 0,
      netWeight: Number(r.netWeight) || 0,
      decayNetWeight: Number(r.decayNetWeight) || 0,
      weightDifference: Number(r.weightDifference) || 0,
      boxesIn: Number(r.boxesIn) || 0,
    });
    row.height = 22;

    for (let i = 1; i <= 10; i++) {
      const cell = row.getCell(i);
      cell.font = { size: 9 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? 'FFF5F3EC' : 'FFFFFFFF' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFBBBBBB' } },
        left: { style: 'thin', color: { argb: 'FFBBBBBB' } },
        bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } },
        right: { style: 'thin', color: { argb: 'FFBBBBBB' } }
      };
      
      // Numbers alignment and format
      if (i >= 6) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (i < 10) {
            cell.numFmt = '#,##0.00';
        } else {
            cell.numFmt = '#,##0'; // Boxes IN
        }
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    }
  });

  // ── 6. Add Totals Row ───────────────────────
  const totalBL = rows.reduce((s, r) => s + Number(r.blNetWeight || 0), 0);
  const totalNet = rows.reduce((s, r) => s + Number(r.netWeight || 0), 0);
  const totalDecay = rows.reduce((s, r) => s + Number(r.decayNetWeight || 0), 0);
  const totalDiff = rows.reduce((s, r) => s + Number(r.weightDifference || 0), 0);
  const totalBoxes = rows.reduce((s, r) => s + Number(r.boxesIn || 0), 0);

  const totalRow = ws.addRow([
    'TOTAL', '', '', '', '',
    totalBL, totalNet, totalDecay, totalDiff, totalBoxes
  ]);
  totalRow.height = 28;
  ws.mergeCells(`A${totalRow.number}:E${totalRow.number}`);

  for (let i = 1; i <= 10; i++) {
    const cell = totalRow.getCell(i);
    cell.font = { bold: true, size: 11, color: { argb: 'FF1A3A00' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8D9A0' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF333333' } },
      left: { style: 'thin', color: { argb: 'FF333333' } },
      bottom: { style: 'thin', color: { argb: 'FF333333' } },
      right: { style: 'thin', color: { argb: 'FF333333' } }
    };
    
    if (i >= 6) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (i < 10) {
          cell.numFmt = '#,##0.00';
      } else {
          cell.numFmt = '#,##0';
      }
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  // ── 7. Generate & Download ──────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Raw_Materials_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// PDF / PRINT EXPORT  (HTML popup → window.print)
// ─────────────────────────────────────────────
export function printRawMaterialsPDF(
  rows: RawMaterialExportRow[],
  logoPath: string = '/FFI_main.png'
): void {
  const totalBL    = rows.reduce((s, r) => s + Number(r.blNetWeight    || 0), 0);
  const totalNet   = rows.reduce((s, r) => s + Number(r.netWeight      || 0), 0);
  const totalDecay = rows.reduce((s, r) => s + Number(r.decayNetWeight || 0), 0);
  const totalDiff  = rows.reduce((s, r) => s + Number(r.weightDifference || 0), 0);
  const totalBoxes = rows.reduce((s, r) => s + Number(r.boxesIn        || 0), 0);

  const fmt = (n: number) =>
    n.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const diffClass = (v: number) => (v >= 0 ? 'pos' : 'neg');

  const tableRows = rows
    .map(
      (r, i) => `
    <tr class="${i % 2 === 0 ? 'row-even' : 'row-odd'}">
      <td>${r.lotNumber   || '-'}</td>
      <td>${r.locationName|| '-'}</td>
      <td>${r.dateTime    || '-'}</td>
      <td>${r.supplierName|| '-'}</td>
      <td>${r.plateNumber || '-'}</td>
      <td class="num">${fmt(Number(r.blNetWeight    || 0))}</td>
      <td class="num">${fmt(Number(r.netWeight      || 0))}</td>
      <td class="num">${fmt(Number(r.decayNetWeight || 0))}</td>
      <td class="num ${diffClass(Number(r.weightDifference))}">${fmt(Number(r.weightDifference || 0))}</td>
      <td class="num">${fmt(Number(r.boxesIn        || 0))}</td>
    </tr>`
    )
    .join('\n');

  const now = new Date();
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Raw Material Stock Report</title>
  <style>
    /* ── Page layout ───────────────────────────── */
    @page {
      size: A4 landscape;
      margin: 12mm 10mm 10mm 10mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Calibri, Arial, sans-serif;
      font-size: 9.5px;
      color: #1a1a1a;
      background: #fff;
    }

    /* ── Header section ────────────────────────── */
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 8px;
      margin-bottom: 10px;
      border-bottom: 2.5px solid #7a9800;
    }
    .logo-wrap img {
      max-height: 58px;
      max-width: 150px;
      object-fit: contain;
    }
    .report-title-block {
      flex: 1;
      text-align: center;
      padding: 0 20px;
    }
    .report-title-block h1 {
      font-size: 21px;
      font-weight: 900;
      color: #3d5a00;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .report-title-block .sub {
      font-size: 8.5px;
      color: #666;
      margin-top: 3px;
    }
    .meta-block {
      font-size: 8px;
      color: #555;
      text-align: right;
      white-space: nowrap;
    }
    .meta-block span {
      display: block;
    }

    /* ── Table ─────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    colgroup col.c-lot   { width: 9%; }
    colgroup col.c-loc   { width: 9%; }
    colgroup col.c-date  { width: 13%; }
    colgroup col.c-sup   { width: 13.5%; }
    colgroup col.c-plate { width: 7.5%; }
    colgroup col.c-bl    { width: 9.5%; }
    colgroup col.c-net   { width: 9%; }
    colgroup col.c-dec   { width: 9.5%; }
    colgroup col.c-diff  { width: 10%; }
    colgroup col.c-box   { width: 5%; }

    thead tr th {
      background: #d4c9a0;
      color: #1a3a00;
      font-weight: 700;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 6px 4px;
      border: 1px solid #999;
      text-align: center;
      vertical-align: middle;
    }

    tbody tr td {
      padding: 4px 4px;
      border: 1px solid #ccc;
      font-size: 9px;
      vertical-align: middle;
    }
    tbody tr.row-even td { background: #ffffff; }
    tbody tr.row-odd  td { background: #f5f3ec; }

    td.num  { text-align: right; font-variant-numeric: tabular-nums; }
    td.pos  { color: #166534; font-weight: 700; }
    td.neg  { color: #991b1b; font-weight: 700; }

    /* ── Totals row ─────────────────────────────── */
    tfoot tr td {
      background: #c8d9a0;
      font-weight: 800;
      font-size: 10px;
      color: #1a3a00;
      padding: 6px 5px;
      border: 1px solid #888;
    }
    tfoot tr td:first-child {
      border-top: 2.5px solid #333;
      text-align: center;
      letter-spacing: 0.12em;
    }
    tfoot td.num {
      text-align: right;
      border-top: 2.5px solid #333;
    }

    /* ── Footer note ────────────────────────────── */
    .page-footer {
      margin-top: 8px;
      font-size: 7.5px;
      color: #999;
      display: flex;
      justify-content: space-between;
    }

    /* ── Print ───────────────────────────────────── */
    @media print {
      html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="page-header">
    <div class="logo-wrap">
      <img src="${logoPath}" alt="Company Logo" onerror="this.style.display='none'" />
    </div>
    <div class="report-title-block">
      <h1>RAW MATERIAL</h1>
      <div class="sub">Stock Report &mdash; ${format(now, 'MMMM dd, yyyy')}</div>
    </div>
    <div class="meta-block">
      <span><strong>Records:</strong> ${rows.length.toLocaleString()}</span>
      <span><strong>Generated:</strong> ${format(now, 'yyyy-MM-dd HH:mm')}</span>
    </div>
  </div>

  <!-- Data table -->
  <table>
    <colgroup>
      <col class="c-lot" /><col class="c-loc" /><col class="c-date" />
      <col class="c-sup" /><col class="c-plate" /><col class="c-bl" />
      <col class="c-net" /><col class="c-dec" /><col class="c-diff" />
      <col class="c-box" />
    </colgroup>
    <thead>
      <tr>
        <th>Lot Number</th>
        <th>Location</th>
        <th>Date and Time</th>
        <th>Supplier</th>
        <th>Plate Number</th>
        <th>BL Net Weight (KG)</th>
        <th>Net Weight (KG)</th>
        <th>Decay Net Weight (KG)</th>
        <th>Weight Difference (KG)</th>
        <th>Boxes IN</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || '<tr><td colspan="10" style="text-align:center;padding:20px;color:#999">No records found.</td></tr>'}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="5">TOTAL</td>
        <td class="num">${fmt(totalBL)}</td>
        <td class="num">${fmt(totalNet)}</td>
        <td class="num">${fmt(totalDecay)}</td>
        <td class="num ${diffClass(totalDiff)}">${fmt(totalDiff)}</td>
        <td class="num">${fmt(totalBoxes)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- Footer -->
  <div class="page-footer">
    <span>Raw Material Stock Report &mdash; Confidential</span>
    <span>Page 1</span>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 600);
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=1260,height=870');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
