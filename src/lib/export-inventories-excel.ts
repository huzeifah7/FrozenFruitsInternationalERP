import ExcelJS from 'exceljs';

interface InventoryExportRow {
  date: string;
  endDate: string;
  week: string;
  variety: string;
  mpBonCamion: number;
  mpPesee: number;
  difference: number;
  dechetMp: number;
  retour: number;
  produitsFinis: number;
  produitCharge: number;
  diffPfcPf: number;
  outOfProgram: number;
  reste: number;
  dechetProduction: number;
  perteReelle: number;
  perteReellePercent: number;
  mpEnStock: number;
  pfEnStock: number;
  localMarket: number;
  resteACharger: number;
  perteGlobale: number;
  perteGlobalePercent: number;
  remarks: string;
}

export async function exportInventoriesExcel(
  rows: InventoryExportRow[],
  totals: any,
  startDate: string,
  endDate: string
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Inventories Situation', {
    views: [{ showGridLines: true }]
  });

  const darkGreen = '375623';
  const lightGreen = 'E2F0D9';
  const softYellow = 'FFF2CC';
  const borderGray = 'A6A6A6';

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: borderGray } },
    left: { style: 'thin', color: { argb: borderGray } },
    bottom: { style: 'thin', color: { argb: borderGray } },
    right: { style: 'thin', color: { argb: borderGray } }
  };

  const styleCell = (
    cell: ExcelJS.Cell,
    options: {
      fill?: ExcelJS.Fill;
      font?: Partial<ExcelJS.Font>;
      alignment?: Partial<ExcelJS.Alignment>;
      border?: Partial<ExcelJS.Borders>;
      numFmt?: string;
    }
  ) => {
    if (options.fill) cell.fill = options.fill;
    if (options.font) cell.font = options.font as ExcelJS.Font;
    if (options.alignment) cell.alignment = options.alignment as ExcelJS.Alignment;
    if (options.border) cell.border = options.border as ExcelJS.Borders;
    if (options.numFmt) cell.numFmt = options.numFmt;
  };

  // Define Columns A to X (24 Columns)
  worksheet.columns = [
    { width: 14 }, // A (DU - From Date)
    { width: 14 }, // B (AU - To Date)
    { width: 10 }, // C (WEEK)
    { width: 12 }, // D (VARIETE)
    { width: 16 }, // E (MP BON CAMION)
    { width: 14 }, // F (DIFFERENCE)
    { width: 16 }, // G (MP PESEE)
    { width: 14 }, // H (DECHET MP)
    { width: 12 }, // I (RETOUR)
    { width: 16 }, // J (PRODUITS FINIS)
    { width: 16 }, // K (PRODUIT FINI CHARGE)
    { width: 16 }, // L (DIFF ENTRE PFC ET PF)
    { width: 12 }, // M (H.P)
    { width: 12 }, // N (RESTE)
    { width: 16 }, // O (DECHET DE PRODUCTION)
    { width: 16 }, // P (PERTE REELLE)
    { width: 12 }, // Q (% Perte Reelle)
    { width: 14 }, // R (MP EN STOCK)
    { width: 14 }, // S (PF EN STOCK)
    { width: 14 }, // T (LOCAL MARKET)
    { width: 16 }, // U (RESTE A CHARGER)
    { width: 16 }, // V (pertes - Perte Globale)
    { width: 12 }, // W (% Perte Globale)
    { width: 35 }  // X (REMARQUES)
  ];

  // Merge Headers
  worksheet.mergeCells('A1:A2');
  worksheet.getCell('A1').value = 'DU';
  worksheet.mergeCells('B1:B2');
  worksheet.getCell('B1').value = 'AU';
  worksheet.mergeCells('C1:C2');
  worksheet.getCell('C1').value = 'WEEK';
  worksheet.mergeCells('D1:D2');
  worksheet.getCell('D1').value = 'VARIETE';

  // RECEPTION / MP (E1:I1)
  worksheet.mergeCells('E1:I1');
  worksheet.getCell('E1').value = 'RECEPTION / MP';

  // TOTAL PRODUCTION (J1:Q1)
  worksheet.mergeCells('J1:Q1');
  worksheet.getCell('J1').value = 'PRODUCTION';

  // STOCK (R1:U1)
  worksheet.mergeCells('R1:U1');
  worksheet.getCell('R1').value = 'STOCK';

  // LOSS / PERTES (V1:W1)
  worksheet.mergeCells('V1:W1');
  worksheet.getCell('V1').value = 'PERTES';

  // REMARQUES (X1:X2)
  worksheet.mergeCells('X1:X2');
  worksheet.getCell('X1').value = 'REMARQUES';

  // Row 2 subheaders
  worksheet.getCell('E2').value = 'MP BON CAMION';
  worksheet.getCell('F2').value = 'DIFFERENCE';
  worksheet.getCell('G2').value = 'MP PESEE';
  worksheet.getCell('H2').value = 'DECHET MP';
  worksheet.getCell('I2').value = 'RETOUR';

  worksheet.getCell('J2').value = 'PRODUITS FINIS';
  worksheet.getCell('K2').value = 'PRODUIT FINI CHARGE';
  worksheet.getCell('L2').value = 'DIFF ENTRE PFC ET PF';
  worksheet.getCell('M2').value = 'H.P';
  worksheet.getCell('N2').value = 'RESTE';
  worksheet.getCell('O2').value = 'DECHET DE PRODUCTION';
  worksheet.getCell('P2').value = 'PERTE REELLE';
  worksheet.getCell('Q2').value = '%';

  worksheet.getCell('R2').value = 'MP EN STOCK';
  worksheet.getCell('S2').value = 'PF EN STOCK';
  worksheet.getCell('T2').value = 'LOCAL MARKET';
  worksheet.getCell('U2').value = 'RESTE A CHARGER';

  worksheet.getCell('V2').value = 'pertes';
  worksheet.getCell('W2').value = '%';

  const header1Cells = ['A1', 'B1', 'C1', 'D1', 'E1', 'J1', 'R1', 'V1', 'X1'];
  header1Cells.forEach(ref => {
    styleCell(worksheet.getCell(ref), {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: darkGreen } },
      font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: thinBorder
    });
  });

  const header2Cols = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'];
  header2Cols.forEach(col => {
    styleCell(worksheet.getCell(`${col}2`), {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
      font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FF000000' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: thinBorder
    });
  });

  // Borders for merged cells in headers
  for (let r = 1; r <= 2; r++) {
    for (let c = 1; c <= 24; c++) {
      worksheet.getCell(r, c).border = thinBorder;
    }
  }

  worksheet.getRow(1).height = 25;
  worksheet.getRow(2).height = 22;

  // Add Data Rows
  let currentExcelRow = 3;
  rows.forEach(r => {
    worksheet.getCell(`A${currentExcelRow}`).value = r.date;
    worksheet.getCell(`B${currentExcelRow}`).value = r.endDate;
    worksheet.getCell(`C${currentExcelRow}`).value = r.week;
    worksheet.getCell(`D${currentExcelRow}`).value = r.variety;
    worksheet.getCell(`E${currentExcelRow}`).value = r.mpBonCamion;
    worksheet.getCell(`F${currentExcelRow}`).value = r.difference;
    worksheet.getCell(`G${currentExcelRow}`).value = r.mpPesee;
    worksheet.getCell(`H${currentExcelRow}`).value = r.dechetMp;
    worksheet.getCell(`I${currentExcelRow}`).value = r.retour;
    worksheet.getCell(`J${currentExcelRow}`).value = r.produitsFinis;
    worksheet.getCell(`K${currentExcelRow}`).value = r.produitCharge;
    worksheet.getCell(`L${currentExcelRow}`).value = r.diffPfcPf;
    worksheet.getCell(`M${currentExcelRow}`).value = r.outOfProgram;
    worksheet.getCell(`N${currentExcelRow}`).value = r.reste;
    worksheet.getCell(`O${currentExcelRow}`).value = r.dechetProduction;
    worksheet.getCell(`P${currentExcelRow}`).value = r.perteReelle;
    worksheet.getCell(`Q${currentExcelRow}`).value = r.perteReellePercent / 100;
    worksheet.getCell(`R${currentExcelRow}`).value = r.mpEnStock;
    worksheet.getCell(`S${currentExcelRow}`).value = r.pfEnStock;
    worksheet.getCell(`T${currentExcelRow}`).value = r.localMarket;
    worksheet.getCell(`U${currentExcelRow}`).value = r.resteACharger;
    worksheet.getCell(`V${currentExcelRow}`).value = r.perteGlobale;
    worksheet.getCell(`W${currentExcelRow}`).value = r.perteGlobalePercent / 100;
    worksheet.getCell(`X${currentExcelRow}`).value = r.remarks;

    // Apply alignment & borders
    for (let c = 1; c <= 24; c++) {
      const cell = worksheet.getCell(currentExcelRow, c);
      cell.border = thinBorder;
      cell.font = { name: 'Arial', size: 9 };
      
      if (c <= 4) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (c === 24) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    }

    // Number formats
    const numberCols = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V'];
    numberCols.forEach(col => {
      worksheet.getCell(`${col}${currentExcelRow}`).numFmt = '#,##0';
    });

    const percentCols = ['Q', 'W'];
    percentCols.forEach(col => {
      worksheet.getCell(`${col}${currentExcelRow}`).numFmt = '0.0%';
    });

    worksheet.getRow(currentExcelRow).height = 20;
    currentExcelRow++;
  });

  // Add Totals Row
  worksheet.getCell(`A${currentExcelRow}`).value = 'TOTAL';
  worksheet.mergeCells(`A${currentExcelRow}:D${currentExcelRow}`);

  worksheet.getCell(`E${currentExcelRow}`).value = totals.mpBonCamion;
  worksheet.getCell(`F${currentExcelRow}`).value = totals.difference;
  worksheet.getCell(`G${currentExcelRow}`).value = totals.mpPesee;
  worksheet.getCell(`H${currentExcelRow}`).value = totals.dechetMp;
  worksheet.getCell(`I${currentExcelRow}`).value = totals.retour;
  worksheet.getCell(`J${currentExcelRow}`).value = totals.produitsFinis;
  worksheet.getCell(`K${currentExcelRow}`).value = totals.produitCharge;
  worksheet.getCell(`L${currentExcelRow}`).value = totals.diffPfcPf;
  worksheet.getCell(`M${currentExcelRow}`).value = totals.outOfProgram;
  worksheet.getCell(`N${currentExcelRow}`).value = totals.reste;
  worksheet.getCell(`O${currentExcelRow}`).value = totals.dechetProduction;
  worksheet.getCell(`P${currentExcelRow}`).value = totals.perteReelle;
  worksheet.getCell(`Q${currentExcelRow}`).value = totals.perteReellePercent / 100;
  worksheet.getCell(`R${currentExcelRow}`).value = totals.mpEnStock;
  worksheet.getCell(`S${currentExcelRow}`).value = totals.pfEnStock;
  worksheet.getCell(`T${currentExcelRow}`).value = totals.localMarket;
  worksheet.getCell(`U${currentExcelRow}`).value = totals.resteACharger;
  worksheet.getCell(`V${currentExcelRow}`).value = totals.perteGlobale;
  worksheet.getCell(`W${currentExcelRow}`).value = totals.perteGlobalePercent / 100;
  worksheet.getCell(`X${currentExcelRow}`).value = '';

  for (let c = 1; c <= 24; c++) {
    const cell = worksheet.getCell(currentExcelRow, c);
    styleCell(cell, {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } },
      font: { name: 'Arial', size: 9, bold: true },
      border: thinBorder
    });
    if (c > 4) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  // Totals number formats
  const numberCols = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V'];
  numberCols.forEach(col => {
    worksheet.getCell(`${col}${currentExcelRow}`).numFmt = '#,##0';
  });

  const percentCols = ['Q', 'W'];
  percentCols.forEach(col => {
    worksheet.getCell(`${col}${currentExcelRow}`).numFmt = '0.0%';
  });

  worksheet.getRow(currentExcelRow).height = 22;

  // Generate Excel File
  const buffer = await workbook.xlsx.writeBuffer();
  const fileBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(fileBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Inventories_${startDate}_to_${endDate}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
}
