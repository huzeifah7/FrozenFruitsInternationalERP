import ExcelJS from 'exceljs';
import { format } from 'date-fns';

export interface ProductionOrderExportRow {
  etaWeek: string | number;
  poNumber: string;
  customerName: string;
  packaging: string;
  status: string;
  productionLocationName: string;
  note: string;
  shippingMethod: string;
  caliber10: number;
  caliber12: number;
  caliber14: number;
  caliber16: number;
  caliber18: number;
  caliber20: number;
  caliber22: number;
  caliber24: number;
  caliber26: number;
  caliber28: number;
  caliber30: number;
  caliber32: number;
  producedCaliber10: number;
  producedCaliber12: number;
  producedCaliber14: number;
  producedCaliber16: number;
  producedCaliber18: number;
  producedCaliber20: number;
  producedCaliber22: number;
  producedCaliber24: number;
  producedCaliber26: number;
  producedCaliber28: number;
  producedCaliber30: number;
  producedCaliber32: number;
  totalPallets: number;
  productionDate: string;
  fromSalesOrder: string;
}

export async function exportProductionOrdersExcel(
  conventionalRows: ProductionOrderExportRow[],
  organicRows: ProductionOrderExportRow[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const wb = new ExcelJS.Workbook();

        // 1. Fetch Logo Buffer
        let imageId: any = null;
        try {
          const response = await fetch('/FFI_main.png');
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          imageId = wb.addImage({
            buffer: arrayBuffer,
            extension: 'png',
          });
        } catch (err) {
          console.error('Failed to load logo for Excel export', err);
        }

        const buildSheet = (sheetName: string, titleText: string, dataRows: ProductionOrderExportRow[]) => {
          const ws = wb.addWorksheet(sheetName, {
            pageSetup: {
              paperSize: 9, // A4
              orientation: 'landscape',
              fitToPage: true,
              fitToWidth: 1,
              fitToHeight: 0
            }
          });

          // Insert Logo if available
          if (imageId != null) {
            ws.addImage(imageId, {
              tl: { col: 0, row: 0 },
              ext: { width: 120, height: 60 }
            });
          }

          // Title Row (Row 1)
          const titleRow = ws.getRow(1);
          titleRow.height = 46;
          ws.mergeCells('A1:Z1');
          const titleCell = ws.getCell('A1');
          titleCell.value = titleText;
          titleCell.font = { bold: true, size: 20, color: { argb: 'FF1B5E20' } };
          titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
          titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
          
          for (let c = 1; c <= 26; c++) {
            titleRow.getCell(c).border = {
              top: { style: 'medium', color: { argb: 'FF1B5E20' } },
              left: { style: 'medium', color: { argb: 'FF1B5E20' } },
              bottom: { style: 'medium', color: { argb: 'FF1B5E20' } },
              right: { style: 'medium', color: { argb: 'FF1B5E20' } }
            };
          }

          // Define Columns & Headers
          ws.columns = [
            { key: 'etaWeek', width: 12 },
            { key: 'poNumber', width: 16 },
            { key: 'customerName', width: 24 },
            { key: 'packaging', width: 24 },
            { key: 'rank', width: 8 },
            { key: 'pallets', width: 18 },
            { key: 'caliber10', width: 10 },
            { key: 'caliber12', width: 10 },
            { key: 'caliber14', width: 10 },
            { key: 'caliber16', width: 10 },
            { key: 'caliber18', width: 10 },
            { key: 'caliber20', width: 10 },
            { key: 'caliber22', width: 10 },
            { key: 'caliber24', width: 10 },
            { key: 'caliber26', width: 10 },
            { key: 'caliber28', width: 10 },
            { key: 'caliber30', width: 10 },
            { key: 'caliber32', width: 10 },
            { key: 'totalPallets', width: 12 },
            { key: 'productionDate', width: 15 },
            { key: 'loadingDate', width: 15 },
            { key: 'fromSalesOrder', width: 18 },
            { key: 'status', width: 15 },
            { key: 'productionLocationName', width: 20 },
            { key: 'note', width: 35 },
            { key: 'shippingMethod', width: 18 }
          ];

          // Row 2 Headers
          const r2 = ws.getRow(2);
          r2.height = 20;
          r2.values = [
            'ETA Week', 'PO Number', 'Customer', 'Packaging', 'Rank', 'Pallets',
            'CALIBER', '', '', '', '', '', '', '', '', '', '', '',
            'Total', 'PROD DATE', 'LOADING DATE', 'S/F',
            'Status', 'Production Location', 'Note', 'Shipping Method'
          ];

          // Row 3 Headers
          const r3 = ws.getRow(3);
          r3.height = 24;
          r3.values = [
            '', '', '', '', '', '',
            'Cal 10', 'Cal 12', 'Cal 14', 'Cal 16', 'Cal 18', 'Cal 20', 'Cal 22', 'Cal 24', 'Cal 26', 'Cal 28', 'Cal 30', 'Cal 32',
            '', '', '', '',
            '', '', '', ''
          ];

          // Merges for Headers
          ws.mergeCells(`G2:R2`);
          ws.mergeCells(`A2:A3`);
          ws.mergeCells(`B2:B3`);
          ws.mergeCells(`C2:C3`);
          ws.mergeCells(`D2:D3`);
          ws.mergeCells(`E2:E3`);
          ws.mergeCells(`F2:F3`);
          ws.mergeCells(`S2:S3`);
          ws.mergeCells(`T2:T3`);
          ws.mergeCells(`U2:U3`);
          ws.mergeCells(`V2:V3`);
          ws.mergeCells(`W2:W3`);
          ws.mergeCells(`X2:X3`);
          ws.mergeCells(`Y2:Y3`);
          ws.mergeCells(`Z2:Z3`);

          // Header Styling
          for (let r = 2; r <= 3; r++) {
            const row = ws.getRow(r);
            for (let c = 1; c <= 26; c++) {
              const cell = row.getCell(c);
              cell.font = { bold: true, size: 9, color: { argb: 'FF000000' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA5D6A7' } }; // Light green
              cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
              cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
              };
            }
          }

          // Freeze Pane & Auto-Filter
          ws.views = [{ state: 'frozen', ySplit: 3 }];
          ws.autoFilter = { from: 'A3', to: 'Z3' };

          // Helper to output value if > 0, else empty string
          const valVal = (v: number) => v > 0 ? v : '';

          // Add Data Rows (3 Rows per Order)
          let currentRow = 4;
          const pendingRows: number[] = [];

          dataRows.forEach((r) => {
            const startRow = currentRow;
            pendingRows.push(startRow + 2); // Keep track of Pendings rows for totals

            const etaWeekVal = r.etaWeek ? (String(r.etaWeek).startsWith('W') ? String(r.etaWeek) : `W${r.etaWeek}`) : '';

            const row1Values = [
              etaWeekVal, r.poNumber || '', r.customerName || '', r.packaging || '', '', 'Size split',
              valVal(r.caliber10), valVal(r.caliber12), valVal(r.caliber14), valVal(r.caliber16), valVal(r.caliber18), valVal(r.caliber20), valVal(r.caliber22), valVal(r.caliber24), valVal(r.caliber26), valVal(r.caliber28), valVal(r.caliber30), valVal(r.caliber32),
              { formula: `SUM(G${startRow}:R${startRow})` },
              r.productionDate || '', '', r.fromSalesOrder || '',
              r.status || '', r.productionLocationName || '', r.note || '', r.shippingMethod || ''
            ];

            const row2Values = [
              '', '', '', '', '', 'Finished Pallets',
              valVal(r.producedCaliber10), valVal(r.producedCaliber12), valVal(r.producedCaliber14), valVal(r.producedCaliber16), valVal(r.producedCaliber18), valVal(r.producedCaliber20), valVal(r.producedCaliber22), valVal(r.producedCaliber24), valVal(r.producedCaliber26), valVal(r.producedCaliber28), valVal(r.producedCaliber30), valVal(r.producedCaliber32),
              { formula: `SUM(G${startRow + 1}:R${startRow + 1})` },
              '', '', '',
              '', '', '', ''
            ];

            const row3Values = [
              '', '', '', '', '', 'Pendings',
              { formula: `IF(N(G${startRow})-N(G${startRow + 1})=0,"",N(G${startRow})-N(G${startRow + 1}))` },
              { formula: `IF(N(H${startRow})-N(H${startRow + 1})=0,"",N(H${startRow})-N(H${startRow + 1}))` },
              { formula: `IF(N(I${startRow})-N(I${startRow + 1})=0,"",N(I${startRow})-N(I${startRow + 1}))` },
              { formula: `IF(N(J${startRow})-N(J${startRow + 1})=0,"",N(J${startRow})-N(J${startRow + 1}))` },
              { formula: `IF(N(K${startRow})-N(K${startRow + 1})=0,"",N(K${startRow})-N(K${startRow + 1}))` },
              { formula: `IF(N(L${startRow})-N(L${startRow + 1})=0,"",N(L${startRow})-N(L${startRow + 1}))` },
              { formula: `IF(N(M${startRow})-N(M${startRow + 1})=0,"",N(M${startRow})-N(M${startRow + 1}))` },
              { formula: `IF(N(N${startRow})-N(N${startRow + 1})=0,"",N(N${startRow})-N(N${startRow + 1}))` },
              { formula: `IF(N(O${startRow})-N(O${startRow + 1})=0,"",N(O${startRow})-N(O${startRow + 1}))` },
              { formula: `IF(N(P${startRow})-N(P${startRow + 1})=0,"",N(P${startRow})-N(P${startRow + 1}))` },
              { formula: `IF(N(Q${startRow})-N(Q${startRow + 1})=0,"",N(Q${startRow})-N(Q${startRow + 1}))` },
              { formula: `IF(N(R${startRow})-N(R${startRow + 1})=0,"",N(R${startRow})-N(R${startRow + 1}))` },
              { formula: `SUM(G${startRow + 2}:R${startRow + 2})` },
              '', '', '',
              '', '', '', ''
            ];

            ws.addRow(row1Values);
            ws.addRow(row2Values);
            ws.addRow(row3Values);

            // Vertical Merges for Order Metadata Columns
            ws.mergeCells(`A${startRow}:A${startRow + 2}`);
            ws.mergeCells(`B${startRow}:B${startRow + 2}`);
            ws.mergeCells(`C${startRow}:C${startRow + 2}`);
            ws.mergeCells(`D${startRow}:D${startRow + 2}`);
            ws.mergeCells(`E${startRow}:E${startRow + 2}`);
            ws.mergeCells(`T${startRow}:T${startRow + 2}`);
            ws.mergeCells(`U${startRow}:U${startRow + 2}`);
            ws.mergeCells(`V${startRow}:V${startRow + 2}`);
            ws.mergeCells(`W${startRow}:W${startRow + 2}`);
            ws.mergeCells(`X${startRow}:X${startRow + 2}`);
            ws.mergeCells(`Y${startRow}:Y${startRow + 2}`);
            ws.mergeCells(`Z${startRow}:Z${startRow + 2}`);

            // Styling Helper
            const styleRowGroup = (rowNum: number, bgColor: string, boldText: boolean) => {
              const row = ws.getRow(rowNum);
              row.height = 20;
              for (let c = 1; c <= 26; c++) {
                const cell = row.getCell(c);
                const finalBg = (c === 5) ? 'FFFFEB3B' : bgColor;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${finalBg}` } };
                cell.border = {
                  top: { style: 'thin', color: { argb: 'FF000000' } },
                  left: { style: 'thin', color: { argb: 'FF000000' } },
                  bottom: { style: 'thin', color: { argb: 'FF000000' } },
                  right: { style: 'thin', color: { argb: 'FF000000' } }
                };
                const isTotal = (c === 19);
                cell.font = { size: 9, bold: isTotal || boldText };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: c === 25 };
              }
            };

            // Apply styling
            styleRowGroup(startRow, 'E3F2FD', false);     // Size split (Light blue)
            styleRowGroup(startRow + 1, 'E8F5E9', false); // Finished Pallets (Light green)
            styleRowGroup(startRow + 2, 'FFFDE7', false); // Pendings (Light yellow)

            currentRow += 3;
          });

          // Summary row
          const totalsRowValues = Array(26).fill('');
          totalsRowValues[0] = 'Number of pallets';

          const cols = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'];
          cols.forEach((col, idx) => {
            const colIndex = 7 + idx;
            if (pendingRows.length > 0) {
              totalsRowValues[colIndex - 1] = { formula: `SUM(${pendingRows.map(r => `${col}${r}`).join(',')})` };
            } else {
              totalsRowValues[colIndex - 1] = '';
            }
          });

          const totalsRow = ws.addRow(totalsRowValues);
          totalsRow.height = 24;
          const totalsRowNum = totalsRow.number;
          ws.mergeCells(`A${totalsRowNum}:F${totalsRowNum}`);

          for (let c = 1; c <= 26; c++) {
            const cell = totalsRow.getCell(c);
            cell.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB3B' } }; // Yellow
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              left: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'thin', color: { argb: 'FF000000' } },
              right: { style: 'thin', color: { argb: 'FF000000' } }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }

          // Extra planning rows
          const extraLabels = ['Raw Material', 'Percentage', 'MP EN STOCK', 'MP NECESSAIRE'];
          extraLabels.forEach(label => {
            const rowValues = Array(26).fill('');
            rowValues[0] = label;
            const row = ws.addRow(rowValues);
            row.height = 20;
            ws.mergeCells(`A${row.number}:F${row.number}`);

            for (let c = 1; c <= 26; c++) {
              const cell = row.getCell(c);
              cell.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // White
              cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
              };
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            }
          });
        };

        // 2. Build Conventional & Organic sheets
        buildSheet('Conventional', 'Planning Conventional', conventionalRows);
        buildSheet('Organic', 'Planning Organic', organicRows);

        // 3. Generate File Buffer & Trigger Download
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Production-Orders-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        resolve();
      } catch (err) {
        reject(err);
      }
    }, 50);
  });
}

export interface SalesOrderExportRow {
  poNumber: string;
  status: string;
  customerName: string;
  etaWeek: string | number;
  productionDate: string;
  productionLocationName: string;
  note: string;
  shippingMethod: string;
  caliber10: number;
  caliber12: number;
  caliber14: number;
  caliber16: number;
  caliber18: number;
  caliber20: number;
  caliber22: number;
  caliber24: number;
  caliber26: number;
  caliber28: number;
  caliber30: number;
  caliber32: number;
  totalPallets: number;
}

export async function exportSalesOrdersExcel(rows: SalesOrderExportRow[], fileName?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Orders', {
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
        ws.mergeCells('A1:U1');
        const titleCell = ws.getCell('A1');
        titleCell.value = 'ORDERS';
        titleCell.font = { bold: true, size: 22, color: { argb: 'FF1B5E20' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        // Spacer Row (Row 2)
        ws.getRow(2).height = 10;

        // 3. Define Columns & Headers (Row 3)
        ws.columns = [
          { key: 'poNumber', width: 16 },
          { key: 'status', width: 16 },
          { key: 'customerName', width: 24 },
          { key: 'etaWeek', width: 12 },
          { key: 'productionDate', width: 18 },
          { key: 'productionLocationName', width: 22 },
          { key: 'note', width: 32 },
          { key: 'shippingMethod', width: 18 },
          { key: 'caliber10', width: 12 },
          { key: 'caliber12', width: 12 },
          { key: 'caliber14', width: 12 },
          { key: 'caliber16', width: 12 },
          { key: 'caliber18', width: 12 },
          { key: 'caliber20', width: 12 },
          { key: 'caliber22', width: 12 },
          { key: 'caliber24', width: 12 },
          { key: 'caliber26', width: 12 },
          { key: 'caliber28', width: 12 },
          { key: 'caliber30', width: 12 },
          { key: 'caliber32', width: 12 },
          { key: 'totalPallets', width: 16 },
        ];

        const headerRow = ws.getRow(3);
        headerRow.height = 38;
        headerRow.values = [
          'PO Number',
          'Status',
          'Customer',
          'ETA Week',
          'Production Date',
          'Production Location',
          'Note',
          'Shipping Method',
          'Caliber 10',
          'Caliber 12',
          'Caliber 14',
          'Caliber 16',
          'Caliber 18',
          'Caliber 20',
          'Caliber 22',
          'Caliber 24',
          'Caliber 26',
          'Caliber 28',
          'Caliber 30',
          'Caliber 32',
          'Total Pallets',
        ];

        // Style Headers
        for (let i = 1; i <= 21; i++) {
          const cell = headerRow.getCell(i);
          cell.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA5D6A7' } }; // Light green background
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
        ws.autoFilter = { from: 'A3', to: 'U3' };

        // 5. Add Data Rows
        rows.forEach((r, idx) => {
          const isAlt = idx % 2 === 1;
          const row = ws.addRow({
            poNumber: r.poNumber || '',
            status: r.status || '',
            customerName: r.customerName || '',
            etaWeek: r.etaWeek != null && r.etaWeek !== '' ? Number(r.etaWeek) : null,
            productionDate: r.productionDate || '',
            productionLocationName: r.productionLocationName || '',
            note: r.note || '',
            shippingMethod: r.shippingMethod || '',
            caliber10: r.caliber10 != null ? Number(r.caliber10) : 0,
            caliber12: r.caliber12 != null ? Number(r.caliber12) : 0,
            caliber14: r.caliber14 != null ? Number(r.caliber14) : 0,
            caliber16: r.caliber16 != null ? Number(r.caliber16) : 0,
            caliber18: r.caliber18 != null ? Number(r.caliber18) : 0,
            caliber20: r.caliber20 != null ? Number(r.caliber20) : 0,
            caliber22: r.caliber22 != null ? Number(r.caliber22) : 0,
            caliber24: r.caliber24 != null ? Number(r.caliber24) : 0,
            caliber26: r.caliber26 != null ? Number(r.caliber26) : 0,
            caliber28: r.caliber28 != null ? Number(r.caliber28) : 0,
            caliber30: r.caliber30 != null ? Number(r.caliber30) : 0,
            caliber32: r.caliber32 != null ? Number(r.caliber32) : 0,
            totalPallets: r.totalPallets != null ? Number(r.totalPallets) : 0,
          });

          // Auto-adjust row height based on note length
          const noteLines = (r.note || '').split('\n').length;
          row.height = Math.max(22, 16 + noteLines * 12);

          for (let i = 1; i <= 23; i++) {
            const cell = row.getCell(i);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? 'FFE8F5E9' : 'FFFFFFFF' } }; // Striped green/white rows
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              left: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'thin', color: { argb: 'FF000000' } },
              right: { style: 'thin', color: { argb: 'FF000000' } }
            };

            const key = ws.columns[i - 1].key;
            cell.font = { size: 9, bold: key === 'totalPallets' }; // Bold total pallets column

            if (
              key === 'poNumber' ||
              key === 'status' ||
              key === 'etaWeek' ||
              key === 'productionDate' ||
              key === 'shippingMethod' ||
              (key && key.startsWith('caliber')) ||
              key === 'totalPallets'
            ) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (key === 'note') {
              cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            } else {
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
            }
          }
        });

        // 6. Totals Row
        const totalC10 = rows.reduce((s, r) => s + Number(r.caliber10 || 0), 0);
        const totalC12 = rows.reduce((s, r) => s + Number(r.caliber12 || 0), 0);
        const totalC14 = rows.reduce((s, r) => s + Number(r.caliber14 || 0), 0);
        const totalC16 = rows.reduce((s, r) => s + Number(r.caliber16 || 0), 0);
        const totalC18 = rows.reduce((s, r) => s + Number(r.caliber18 || 0), 0);
        const totalC20 = rows.reduce((s, r) => s + Number(r.caliber20 || 0), 0);
        const totalC22 = rows.reduce((s, r) => s + Number(r.caliber22 || 0), 0);
        const totalC24 = rows.reduce((s, r) => s + Number(r.caliber24 || 0), 0);
        const totalC26 = rows.reduce((s, r) => s + Number(r.caliber26 || 0), 0);
        const totalC28 = rows.reduce((s, r) => s + Number(r.caliber28 || 0), 0);
        const totalC30 = rows.reduce((s, r) => s + Number(r.caliber30 || 0), 0);
        const totalC32 = rows.reduce((s, r) => s + Number(r.caliber32 || 0), 0);
        const grandTotal = rows.reduce((s, r) => s + Number(r.totalPallets || 0), 0);

        const totalsRowValues = Array(21).fill('');
        totalsRowValues[0] = 'TOTAL';
        totalsRowValues[8] = totalC10;
        totalsRowValues[9] = totalC12;
        totalsRowValues[10] = totalC14;
        totalsRowValues[11] = totalC16;
        totalsRowValues[12] = totalC18;
        totalsRowValues[13] = totalC20;
        totalsRowValues[14] = totalC22;
        totalsRowValues[15] = totalC24;
        totalsRowValues[16] = totalC26;
        totalsRowValues[17] = totalC28;
        totalsRowValues[18] = totalC30;
        totalsRowValues[19] = totalC32;
        totalsRowValues[20] = grandTotal;

        const totalRow = ws.addRow(totalsRowValues);
        totalRow.height = 28;
        ws.mergeCells(`A${totalRow.number}:H${totalRow.number}`);

        for (let i = 1; i <= 21; i++) {
          const cell = totalRow.getCell(i);
          cell.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF81C784' } }; // Highlighted green totals row
          cell.border = {
            top: { style: 'medium', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'medium', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // 7. Auto-fit column widths
        ws.columns.forEach(col => {
          let maxLen = col.header ? String(col.header).length : 12;
          if (col.key === 'note') {
            col.width = 35; // Cap note column size nicely since wrapText is active
            return;
          }
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
          col.width = Math.min(Math.max(maxLen + 4, 10), 30);
        });

        // 8. Generate File Buffer & Trigger Download
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || `Sales-Orders-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        resolve();
      } catch (err) {
        reject(err);
      }
    }, 50);
  });
}
