import ExcelJS from 'exceljs';
import { format } from 'date-fns';

export interface LoadingExportRow {
  date: string;
  poNumber: string;
  invoiceNumber: string;
  etaDate: string;
  station: string;
  customer: string;
  containerNumber: string;
  quantity: number | string;
  valueInCurrency: number | string;
  valueInMad: number | string;
  packaging: string;
  exchangeRate: number | string;
  sousDum: string;
  dum: string;
  montantTransport: number | string;
  factureTrans: string;
  factureTransitaire: string;
  numExpeditionDhl: string;
  factureDhl: string;
  produit: string;
  t1Phyto: string;
  numeroChauffeur: string;
}

export async function exportLoadingsExcel(rows: LoadingExportRow[], season: string): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Loadings', {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  });

  // Enable gridlines
  ws.views = [{ showGridLines: true }];

  // 1. Fetch & Insert Logo (Row 2, Column A)
  try {
    const response = await fetch('/FFI_main.png');
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const imageId = wb.addImage({
      buffer: arrayBuffer,
      extension: 'png',
    });
    ws.addImage(imageId, {
      tl: { col: 0, row: 1 },
      ext: { width: 100, height: 45 }
    });
  } catch (err) {
    console.error('Failed to load logo for Excel export', err);
  }

  // Row heights for spacing
  ws.getRow(1).height = 15;
  ws.getRow(2).height = 40;
  ws.getRow(3).height = 15;

  // Title
  ws.mergeCells('C2:J2');
  const titleCell = ws.getCell('C2');
  titleCell.value = `Loading Season ${season} Export Optimum`;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF000000' } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // 2. Define Columns
  ws.columns = [
    { key: 'date', width: 14 },
    { key: 'poNumber', width: 16 },
    { key: 'invoiceNumber', width: 16 },
    { key: 'etaDate', width: 14 },
    { key: 'station', width: 22 },
    { key: 'customer', width: 22 },
    { key: 'containerNumber', width: 20 },
    { key: 'quantity', width: 12 },
    { key: 'valueInCurrency', width: 16 },
    { key: 'valueInMad', width: 16 },
    { key: 'packaging', width: 16 },
    { key: 'exchangeRate', width: 14 },
    { key: 'sousDum', width: 14 },
    { key: 'dum', width: 12 },
    { key: 'montantTransport', width: 18 },
    { key: 'factureTrans', width: 16 },
    { key: 'factureTransitaire', width: 18 },
    { key: 'numExpeditionDhl', width: 18 },
    { key: 'factureDhl', width: 14 },
    { key: 'produit', width: 16 },
    { key: 't1Phyto', width: 14 },
    { key: 'numeroChauffeur', width: 18 },
  ];

  // Header Row at Row 4
  const headerRow = ws.getRow(4);
  headerRow.height = 28;
  headerRow.values = [
    'Date',
    'PO Number',
    'Invoice Number',
    'ETA Date',
    'Station',
    'Customer',
    'Container / Number',
    'Quantity',
    'Value in Currency',
    'Value in MAD',
    'Packaging',
    'Exchange Rate',
    'Sous Dum',
    'Dum',
    'Montant de Transport',
    'Facture Trans',
    'Facture Transitaire',
    'Num Expédition DHL',
    'Facture DHL',
    'Produit',
    'T1 and Phyto',
    'Numero de Chauffeur'
  ];

  // Format Header Row
  for (let i = 1; i <= 22; i++) {
    const cell = headerRow.getCell(i);
    cell.font = { bold: true, size: 9, color: { argb: 'FF000000' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFFFF' } // White background like standard grid
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'medium', color: { argb: 'FF999999' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };
  }

  // 3. Populate Rows
  rows.forEach((r, idx) => {
    const rowNum = 5 + idx;
    const row = ws.getRow(rowNum);
    row.height = 22;

    row.values = [
      r.date,
      r.poNumber,
      r.invoiceNumber,
      r.etaDate,
      r.station,
      r.customer,
      r.containerNumber,
      r.quantity !== '' ? Number(r.quantity) : '',
      r.valueInCurrency !== '' ? Number(r.valueInCurrency) : '',
      r.valueInMad !== '' ? Number(r.valueInMad) : '',
      r.packaging,
      r.exchangeRate !== '' ? Number(r.exchangeRate) : '',
      r.sousDum,
      r.dum,
      r.montantTransport !== '' ? Number(r.montantTransport) : '',
      r.factureTrans,
      r.factureTransitaire,
      r.numExpeditionDhl,
      r.factureDhl,
      r.produit,
      r.t1Phyto,
      r.numeroChauffeur
    ];

    // Alternating soft green background styling
    const useSoftGreen = idx % 2 === 1;
    const bgColor = useSoftGreen ? 'FFE2EFDA' : 'FFFFFFFF'; // E2EFDA is the soft green in the screenshot

    for (let i = 1; i <= 22; i++) {
      const cell = row.getCell(i);
      cell.font = { size: 9, color: { argb: 'FF000000' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };
      
      // Set alignment and number formats
      if ([8, 9, 10, 12, 15].includes(i)) {
        // Numeric columns
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (i === 8) {
          cell.numFmt = '#,##0';
        } else {
          cell.numFmt = '#,##0.00';
        }
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
      };
    }
  });

  // 4. Generate buffer & trigger download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Loading_Season_${season.replace(/\s+/g, '_')}_Export_Optimum.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
