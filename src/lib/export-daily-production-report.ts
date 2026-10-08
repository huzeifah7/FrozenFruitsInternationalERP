import ExcelJS from 'exceljs';

interface DailyProductionReportData {
  date: string;
  shift: string;
  locationName: string;
  currentUser: { email: string; displayName?: string };
  productionFeeds: any[];
  productionOutputs: any[];
  orders: any[];
  products: any[];
  consumables: any[];
  previousShiftRestePallets: any[];
  rawMaterials?: any[];
}

export function getShiftDateAndShift(dateTimeStr: string): { shiftDate: string; shift: string } {
  // Handles parsing local time string (e.g. 2026-07-07T14:22 or ISO string)
  const dt = new Date(dateTimeStr);
  const hours = dt.getHours();
  const minutes = dt.getMinutes();
  const time = hours + minutes / 60;

  let shift = '';
  let shiftDateObj = new Date(dt);

  if (time >= 8 && time <= 19) {
    shift = '1';
  } else if (time >= 21 && time < 24) {
    shift = '2';
  } else if (time >= 0 && time <= 7) {
    shift = '2';
    shiftDateObj.setDate(shiftDateObj.getDate() - 1);
  }

  const y = shiftDateObj.getFullYear();
  const m = String(shiftDateObj.getMonth() + 1).padStart(2, '0');
  const d = String(shiftDateObj.getDate()).padStart(2, '0');
  const shiftDate = `${y}-${m}-${d}`;

  return { shiftDate, shift };
}

export async function exportDailyProductionReport(data: DailyProductionReportData) {
  const {
    date,
    shift,
    locationName,
    currentUser,
    productionFeeds,
    productionOutputs,
    orders,
    products,
    consumables,
    previousShiftRestePallets,
    rawMaterials = [],
  } = data;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Production report', {
    views: [{ showGridLines: true }]
  });

  // Color Palette Definitions
  const darkGreen = '375623';
  const lightGreen = 'E2F0D9';
  const softYellow = 'FFF2CC';
  const softOrange = 'F4B084'; // Premium soft orange for final net weight total
  const borderGray = 'A6A6A6';
  const softRedBackground = 'FCE4D6';
  const redText = 'C00000';

  // Fonts
  const fontTitle = { name: 'Arial', size: 22, bold: true, color: { argb: 'FFFFFFFF' } };
  const fontHeader = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
  const fontBold = { name: 'Arial', size: 10, bold: true };
  const fontNormal = { name: 'Arial', size: 10 };
  const fontVertical = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF333333' } };
  const fontLargePO = { name: 'Arial', size: 12, bold: true };

  // Borders
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: borderGray } },
    left: { style: 'thin', color: { argb: borderGray } },
    bottom: { style: 'thin', color: { argb: borderGray } },
    right: { style: 'thin', color: { argb: borderGray } }
  };

  // Helper to style cells
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

  // Setup 16 Columns (A to P)
  worksheet.columns = [
    { width: 5 },   // A: Section label
    { width: 18 },  // B
    { width: 26 },  // C (Variety / PO label)
    { width: 24 },  // D (Lot number / Pallet number)
    { width: 11 },  // E
    { width: 11 },  // F
    { width: 11 },  // G
    { width: 18 },  // H (Lamb Hass space)
    { width: 18 },  // I (Filled by)
    { width: 25 },  // J (Filled by Username)
    { width: 18 },  // K (Lamb Hass)
    { width: 24 },  // L (Durée de Travail)
    { width: 18 },  // M (Heure d'entrée)
    { width: 18 },  // N (Heure de sortie)
    { width: 18 },  // O
    { width: 18 }   // P: Totals
  ];

  const returnVarieties = ['Zutano', 'Bacon', 'Fuerte', 'Hass conv', 'Hass bio', 'Lamb Hass'];

  // Helper to fill hatched pattern
  const fillHatched = (r: number, c: number) => {
    const cell = worksheet.getCell(r, c);
    styleCell(cell, {
      fill: {
        type: 'pattern',
        pattern: 'darkTrellis',
        fgColor: { argb: 'FFA6A6A6' },
        bgColor: { argb: 'FFFFFFFF' }
      },
      border: thinBorder
    });
  };

  const fillHatchedRange = (startRow: number, endRow: number, startCol: string, endCol: string) => {
    const startColIdx = startCol.charCodeAt(0) - 64;
    const endColIdx = endCol.charCodeAt(0) - 64;
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startColIdx; c <= endColIdx; c++) {
        fillHatched(r, c);
      }
    }
  };

  // ----------------------------------------------------
  // HEADER SECTION (Rows 1-10)
  // ----------------------------------------------------
  // Logo placeholder in A1:B3
  worksheet.mergeCells('A1:B3');
  const logoCell = worksheet.getCell('A1');
  styleCell(logoCell, { border: thinBorder });

  // Load Logo
  let imageId: number | null = null;
  try {
    const response = await fetch('/FFI_main.png');
    const arrayBuffer = await response.arrayBuffer();
    imageId = workbook.addImage({
      buffer: arrayBuffer,
      extension: 'png'
    });
  } catch (err) {
    console.error('Failed to load logo image:', err);
  }

  if (imageId !== null) {
    worksheet.addImage(imageId, {
      tl: { col: 0, row: 0 } as any,
      br: { col: 2, row: 3 } as any,
      editAs: 'oneCell'
    });
  }

  // Company name bar C1:P1
  worksheet.mergeCells('C1:P1');
  const companyCell = worksheet.getCell('C1');
  companyCell.value = 'EXPORT OPTIMUM';
  styleCell(companyCell, {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: darkGreen } },
    font: { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle' }
  });

  // Big Title C2:P3
  worksheet.mergeCells('C2:P3');
  const titleCell = worksheet.getCell('C2');
  titleCell.value = 'Daily Production Report';
  styleCell(titleCell, {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: darkGreen } },
    font: fontTitle,
    alignment: { horizontal: 'center', vertical: 'middle' }
  });

  // Metadata Row 3, 4, 5
  const userNameVal = currentUser.displayName || currentUser.email.split('@')[0];
  
  // Row 4
  worksheet.getCell('C4').value = 'Date';
  worksheet.mergeCells('D4:G4');
  worksheet.getCell('D4').value = date;
  worksheet.getCell('I4').value = 'Filled by';
  worksheet.mergeCells('J4:K4');
  worksheet.getCell('J4').value = userNameVal;

  // Row 5
  worksheet.getCell('C5').value = 'Product';
  worksheet.mergeCells('D5:G5');
  worksheet.getCell('D5').value = 'Avocado';
  worksheet.getCell('I5').value = 'Shift';
  worksheet.mergeCells('J5:K5');
  worksheet.getCell('J5').value = Number(shift);

  // Style metadata cells
  ['C4', 'C5', 'I4', 'I5'].forEach(cellRef => {
    styleCell(worksheet.getCell(cellRef), {
      font: fontHeader,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
      alignment: { horizontal: 'left', vertical: 'middle' },
      border: thinBorder
    });
  });
  
  ['D4', 'D5', 'J4', 'J5'].forEach(cellRef => {
    styleCell(worksheet.getCell(cellRef), {
      font: fontNormal,
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });
  });

  // Ensure all merged cells in D4:G4 and D5:G5 have borders
  for (let r of [4, 5]) {
    for (let c of ['E', 'F', 'G']) {
      worksheet.getCell(`${c}${r}`).border = thinBorder;
    }
    worksheet.getCell(`K${r}`).border = thinBorder;
  }

  // Hatching for empty top metadata sections
  fillHatchedRange(4, 5, 'A', 'B');
  fillHatchedRange(4, 5, 'H', 'H');
  fillHatchedRange(4, 5, 'L', 'P');
  fillHatchedRange(6, 6, 'A', 'P');
  worksheet.getRow(6).height = 15;

  let currentRow = 7;

  // ----------------------------------------------------
  // SECTION 1: CONSUMPTION & DISPONIBILITÉ (SIDE-BY-SIDE)
  // ----------------------------------------------------
  const consumptionStartRow = 7;

  // Render Disponibilité Block (J7:P25)
  // Row 7: Header
  worksheet.mergeCells('J7:P7');
  const dispTitle = worksheet.getCell('J7');
  dispTitle.value = 'Disponibilité';
  styleCell(dispTitle, {
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: darkGreen } },
    font: { ...fontHeader, color: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder
  });
  for (let c = 10; c <= 16; c++) { worksheet.getCell(7, c).border = thinBorder; }

  // Row 8-9: Durée / Entry / Exit Headers
  worksheet.mergeCells('J8:J11');
  const dureeLabel = worksheet.getCell('J8');
  dureeLabel.value = 'Durée de Travail (min)';
  styleCell(dureeLabel, {
    font: fontHeader,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: thinBorder
  });

  worksheet.mergeCells('K8:L9');
  const entreeLabel = worksheet.getCell('K8');
  entreeLabel.value = "Heure d'entrée";
  styleCell(entreeLabel, {
    font: fontHeader,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: thinBorder
  });

  worksheet.mergeCells('M8:N9');
  const sortieLabel = worksheet.getCell('M8');
  sortieLabel.value = "Heure de sortie";
  styleCell(sortieLabel, {
    font: fontHeader,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: thinBorder
  });

  // Hatch O8:P9
  worksheet.mergeCells('O8:P9');
  fillHatchedRange(8, 9, 'O', 'P');

  // Set borders for Durée / Entry / Exit Headers
  for (let r = 8; r <= 9; r++) {
    for (let c = 10; c <= 16; c++) {
      worksheet.getCell(r, c).border = thinBorder;
    }
  }

  // Row 10-11: Values
  worksheet.mergeCells('K10:L11');
  const entreeVal = worksheet.getCell('K10');
  entreeVal.value = '12:00:00 AM';
  styleCell(entreeVal, {
    font: fontNormal,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder
  });

  worksheet.mergeCells('M10:N11');
  const sortieVal = worksheet.getCell('M10');
  sortieVal.value = '12:00:00 AM';
  styleCell(sortieVal, {
    font: fontNormal,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder
  });

  worksheet.mergeCells('O10:P11');
  const dureeVal = worksheet.getCell('O10');
  dureeVal.value = 0;
  styleCell(dureeVal, {
    font: fontNormal,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder,
    numFmt: '#,##0'
  });

  for (let r = 10; r <= 11; r++) {
    for (let c = 10; c <= 16; c++) {
      worksheet.getCell(r, c).border = thinBorder;
    }
  }

  // Row 12-13: Pause
  worksheet.mergeCells('J12:J13');
  const pauseLabel = worksheet.getCell('J12');
  pauseLabel.value = 'Pause';
  styleCell(pauseLabel, {
    font: fontHeader,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder
  });

  worksheet.mergeCells('K12:N13');
  fillHatchedRange(12, 13, 'K', 'N');

  worksheet.mergeCells('O12:P13');
  const pauseVal = worksheet.getCell('O12');
  pauseVal.value = 0;
  styleCell(pauseVal, {
    font: fontNormal,
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder,
    numFmt: '#,##0'
  });

  for (let r = 12; r <= 13; r++) {
    for (let c = 10; c <= 16; c++) {
      worksheet.getCell(r, c).border = thinBorder;
    }
  }

  // Row 14: Temps d'arrêt Title
  worksheet.mergeCells('J14:P14');
  const stopTimeTitle = worksheet.getCell('J14');
  stopTimeTitle.value = "Temps d'arrêt (min)";
  styleCell(stopTimeTitle, {
    font: fontHeader,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder
  });
  for (let c = 10; c <= 16; c++) { worksheet.getCell(14, c).border = thinBorder; }

  // Row 15: Stop Time headers
  worksheet.mergeCells('J15:J25');
  const stopLabelVertical = worksheet.getCell('J15');
  stopLabelVertical.value = "Temps d'arrêt\n(min)";
  styleCell(stopLabelVertical, {
    font: fontVertical,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { textRotation: 90, vertical: 'middle', horizontal: 'center' },
    border: thinBorder
  });

  worksheet.mergeCells('K15:N15');
  const stopTypeHeader = worksheet.getCell('K15');
  stopTypeHeader.value = "Type d'arrêt";
  styleCell(stopTypeHeader, {
    font: fontHeader,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder
  });

  worksheet.mergeCells('O15:P15');
  const stopTimeHeader = worksheet.getCell('O15');
  stopTimeHeader.value = "Temps";
  styleCell(stopTimeHeader, {
    font: fontHeader,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder
  });
  for (let c = 10; c <= 16; c++) { worksheet.getCell(15, c).border = thinBorder; }

  // Row 16 to 24: Stop times rows
  // Row 16: dummy first values
  worksheet.mergeCells('K16:N16');
  worksheet.getCell('K16').value = '-';
  worksheet.mergeCells('O16:P16');
  worksheet.getCell('O16').value = 0;
  
  [worksheet.getCell('K16'), worksheet.getCell('O16')].forEach(c => {
    styleCell(c, {
      font: fontNormal,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });
  });
  for (let c = 10; c <= 16; c++) { worksheet.getCell(16, c).border = thinBorder; }

  // Rows 17 to 24 (empty rows)
  for (let r = 17; r <= 24; r++) {
    worksheet.mergeCells(`K${r}:N${r}`);
    worksheet.getCell(`K${r}`).value = '';
    worksheet.mergeCells(`O${r}:P${r}`);
    worksheet.getCell(`O${r}`).value = '';

    [worksheet.getCell(`K${r}`), worksheet.getCell(`O${r}`)].forEach(c => {
      styleCell(c, {
        font: fontNormal,
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder
      });
    });
    for (let c = 10; c <= 16; c++) { worksheet.getCell(r, c).border = thinBorder; }
  }

  // Row 25: Total
  worksheet.mergeCells('K25:N25');
  worksheet.getCell('K25').value = 'Total';
  worksheet.mergeCells('O25:P25');
  worksheet.getCell('O25').value = { formula: 'SUM(O16:O24)' };

  [worksheet.getCell('K25'), worksheet.getCell('O25')].forEach(c => {
    styleCell(c, {
      font: fontBold,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder,
      numFmt: '#,##0'
    });
  });
  for (let c = 10; c <= 16; c++) { worksheet.getCell(25, c).border = thinBorder; }

  // Raw Material Headers (Row 7, Columns C-H)
  worksheet.getCell(`C${currentRow}`).value = 'Variety';
  worksheet.getCell(`D${currentRow}`).value = 'Lot number';
  worksheet.getCell(`E${currentRow}`).value = 'Nbr of pallets';
  worksheet.getCell(`F${currentRow}`).value = 'Net weight kg';
  worksheet.getCell(`G${currentRow}`).value = 'Loss kg';
  worksheet.getCell(`H${currentRow}`).value = 'Total\nconsumption kg';

  ['C', 'D', 'E', 'F', 'G', 'H'].forEach(col => {
    styleCell(worksheet.getCell(`${col}${currentRow}`), {
      font: fontHeader,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: thinBorder
    });
  });
  worksheet.getRow(currentRow).height = 30;
  currentRow++;

  const rawMaterialFeeds = productionFeeds.filter(f => f.sourceType === 'RAW_MATERIAL' || f.sourceType === 'RAW_MATERIALS' || f.type === 'RAW_MATERIAL' || (!f.sourceType && (f.rawMaterialId || f.sourceRawMaterialId)));
  const rawMatStartRow = currentRow;

  const getProductVariety = (productId: string, feedItem?: any) => {
    if (feedItem?.variety) return feedItem.variety;
    if (feedItem?.varietyName) return feedItem.varietyName;
    if (feedItem?.category) return feedItem.category;
    if (feedItem?.productName) return feedItem.productName;

    if (feedItem?.rawMaterial?.variety) return feedItem.rawMaterial.variety;
    if (feedItem?.rawMaterial?.varietyName) return feedItem.rawMaterial.varietyName;
    if (feedItem?.product?.variety) return feedItem.product.variety;

    const p = products.find(prod => prod.id === productId || prod.id === feedItem?.sourceRawMaterialId || prod.id === feedItem?.rawMaterialId);
    if (p) return p.variety || p.category || p.name || 'Avocado';

    if (rawMaterials && rawMaterials.length > 0) {
      const rm = rawMaterials.find(r => r.id === productId || r.id === feedItem?.sourceRawMaterialId || r.id === feedItem?.rawMaterialId);
      if (rm) return rm.variety || rm.varietyName || rm.category || rm.productName || 'Avocado';
    }

    return 'Avocado';
  };

  const groupedRM: Record<string, { variety: string; lotNumber: string; pallets: number; weight: number }> = {};
  if (rawMaterialFeeds.length > 0) {
    rawMaterialFeeds.forEach(f => {
      const variety = getProductVariety(f.sourceRawMaterialId || f.rawMaterialId || f.productId, f);
      const lot = f.lotNumber || f.rawMaterialLotNumber || f.barcode || 'Unknown';
      const key = `${variety}_${lot}`;
      if (!groupedRM[key]) {
        groupedRM[key] = { variety, lotNumber: lot, pallets: 0, weight: 0 };
      }
      groupedRM[key].pallets += 1;
      groupedRM[key].weight += Number(f.netWeight || f.totalNetWeight || f.weight || f.quantity) || 0;
    });
  }

  const rmValues = Object.values(groupedRM);
  const minRmRows = Math.max(rmValues.length, 10); // Keep empty rows styled (10 rows total)

  for (let i = 0; i < minRmRows; i++) {
    const rm = rmValues[i];
    worksheet.getCell(`C${currentRow}`).value = rm ? rm.variety : '';
    worksheet.getCell(`D${currentRow}`).value = rm ? rm.lotNumber : '';
    worksheet.getCell(`E${currentRow}`).value = rm ? rm.pallets : '';
    worksheet.getCell(`F${currentRow}`).value = rm ? rm.weight : '';
    worksheet.getCell(`G${currentRow}`).value = rm ? 0 : '';
    
    // Style with solid white fill to ensure no hatching
    ['C', 'D', 'E', 'F', 'G'].forEach(col => {
      styleCell(worksheet.getCell(`${col}${currentRow}`), {
        font: fontNormal,
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
        border: thinBorder,
        alignment: { horizontal: 'center', vertical: 'middle' }
      });
    });
    
    currentRow++;
  }
  const rawMatEndRow = currentRow - 1;

  // Vertical Raw Materials title in B
  worksheet.mergeCells(`B${rawMatStartRow - 1}:B${rawMatEndRow}`);
  const verticalRawMatCell = worksheet.getCell(`B${rawMatStartRow - 1}`);
  verticalRawMatCell.value = 'Raw Materials';
  styleCell(verticalRawMatCell, {
    font: fontVertical,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { textRotation: 90, vertical: 'middle', horizontal: 'center' },
    border: thinBorder
  });

  // Final Product inner block (Caliber, Pallet number, Nbr of pallets, Real Net weight kg, EPR Net weight kg)
  const fpStartRow = currentRow;
  worksheet.getCell(`C${currentRow}`).value = 'Caliber';
  worksheet.getCell(`D${currentRow}`).value = 'Pallet number';
  worksheet.getCell(`E${currentRow}`).value = 'Nbr of pallets';
  worksheet.getCell(`F${currentRow}`).value = 'Real Net weight kg';
  worksheet.getCell(`G${currentRow}`).value = 'EPR Net weight kg';

  ['C', 'D', 'E', 'F', 'G'].forEach(col => {
    styleCell(worksheet.getCell(`${col}${currentRow}`), {
      font: fontHeader,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: thinBorder
    });
  });
  worksheet.getRow(currentRow).height = 30;
  currentRow++;

  // 3 empty rows for final product inner
  const fpDataStartRow = currentRow;
  for(let i=0; i<3; i++) {
    ['C', 'D', 'E', 'F', 'G'].forEach(col => { 
      worksheet.getCell(`${col}${currentRow}`).value = '';
      styleCell(worksheet.getCell(`${col}${currentRow}`), {
        font: fontNormal,
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder
      });
    });
    currentRow++;
  }
  const fpDataEndRow = currentRow - 1;

  // Total Net Weight KG row
  worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
  worksheet.getCell(`C${currentRow}`).value = 'Total Net Weight KG';
  worksheet.getCell(`G${currentRow}`).value = { formula: `SUM(F${fpDataStartRow}:F${fpDataEndRow})` };

  styleCell(worksheet.getCell(`C${currentRow}`), { font: fontBold, alignment: { horizontal: 'center' }, border: thinBorder });
  ['D','E','F'].forEach(col => { worksheet.getCell(`${col}${currentRow}`).border = thinBorder; });
  styleCell(worksheet.getCell(`G${currentRow}`), { font: fontBold, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } }, alignment: { horizontal: 'center' }, border: thinBorder, numFmt: '#,##0' });
  
  currentRow++;
  const fpEndRow = currentRow - 1;

  // Vertical Final Product label in B
  worksheet.mergeCells(`B${fpStartRow}:B${fpEndRow}`);
  const verticalFPLabel = worksheet.getCell(`B${fpStartRow}`);
  verticalFPLabel.value = 'Final product';
  styleCell(verticalFPLabel, {
    font: fontVertical,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { textRotation: 90, vertical: 'middle', horizontal: 'center' },
    border: thinBorder
  });

  // Return of Shift Section
  const prevShift = shift === '1' ? '2' : '1';
  const returnFeeds = productionFeeds.filter(f => f.sourceType === 'RETURN' || f.sourceType === 'RESTE' || f.palletisationType === 'Return' || f.type === 'Return');
  
  const innerReturnStartRow = currentRow;
  worksheet.getCell(`C${currentRow}`).value = 'Zutano';
  worksheet.getCell(`D${currentRow}`).value = 'Bacon';
  worksheet.getCell(`E${currentRow}`).value = 'Fuerte';
  worksheet.getCell(`F${currentRow}`).value = 'Hass conv';
  worksheet.getCell(`G${currentRow}`).value = 'Hass bio';

  const returnVarietiesInner = ['Zutano', 'Bacon', 'Fuerte', 'Hass conv', 'Hass bio'];
  const returnColsInner = ['C', 'D', 'E', 'F', 'G'];

  returnVarietiesInner.forEach((v, index) => {
    const colName = returnColsInner[index];
    worksheet.getCell(`${colName}${currentRow}`).value = v;
    styleCell(worksheet.getCell(`${colName}${currentRow}`), {
      font: fontHeader,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: thinBorder
    });
  });
  worksheet.getRow(currentRow).height = 30;
  currentRow++;

  const returnValRow = currentRow;
  returnVarietiesInner.forEach((v, index) => {
    const colName = returnColsInner[index];
    worksheet.getCell(`${colName}${currentRow}`).value = 0;
    styleCell(worksheet.getCell(`${colName}${currentRow}`), {
      font: fontNormal,
      alignment: { horizontal: 'center' },
      border: thinBorder,
      numFmt: '#,##0'
    });
  });

  // Map Return values
  const getReturnVarietyIndex = (varietyName: string) => {
    const vn = varietyName.toLowerCase();
    if (vn.includes('zutano')) return 0;
    if (vn.includes('bacon')) return 1;
    if (vn.includes('fuerte')) return 2;
    if (vn.includes('hass')) {
      if (vn.includes('bio') || vn.includes('organic') || vn.includes('org')) return 4;
      return 3;
    }
    return -1;
  };

  returnFeeds.forEach(f => {
    const variety = getProductVariety(f.sourceRawMaterialId || f.rawMaterialId || f.productId, f);
    const matchedIndex = getReturnVarietyIndex(variety);
    if (matchedIndex !== -1) {
      const colName = returnColsInner[matchedIndex];
      const cell = worksheet.getCell(`${colName}${currentRow}`);
      cell.value = (Number(cell.value) || 0) + (Number(f.netWeight || f.totalNetWeight || f.weight || f.quantity) || 0);
    }
  });
  currentRow++;

  // Total Return Row below it
  const innerReturnTotalRow = currentRow;
  worksheet.mergeCells(`C${currentRow}:F${currentRow}`);
  worksheet.getCell(`C${currentRow}`).value = 'Total';
  worksheet.getCell(`G${currentRow}`).value = { formula: `SUM(C${returnValRow}:G${returnValRow})` };

  styleCell(worksheet.getCell(`C${currentRow}`), {
    font: fontBold,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } },
    alignment: { horizontal: 'center' },
    border: thinBorder
  });
  ['D','E','F'].forEach(col => { worksheet.getCell(`${col}${currentRow}`).border = thinBorder; });
  styleCell(worksheet.getCell(`G${currentRow}`), {
    font: fontBold,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } },
    alignment: { horizontal: 'center' },
    border: thinBorder,
    numFmt: '#,##0'
  });
  
  currentRow++;
  const innerReturnEndRow = currentRow - 1;

  // Vertical Return of shift label in B
  worksheet.mergeCells(`B${innerReturnStartRow}:B${innerReturnEndRow}`);
  const verticalReturnLabel = worksheet.getCell(`B${innerReturnStartRow}`);
  verticalReturnLabel.value = `Return of shift-${prevShift}`;
  styleCell(verticalReturnLabel, {
    font: fontVertical,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { textRotation: 90, vertical: 'middle', horizontal: 'center' },
    border: thinBorder
  });

  const consumptionEndRow = currentRow - 1;

  // Merge Total Consumption kg vertically (H8:H24)
  worksheet.mergeCells(`H${rawMatStartRow}:H${consumptionEndRow}`);
  const totalRawConsCell = worksheet.getCell(`H${rawMatStartRow}`);
  totalRawConsCell.value = { formula: `SUM(F${rawMatStartRow}:F${rawMatEndRow})-SUM(G${rawMatStartRow}:G${rawMatEndRow})` };
  styleCell(totalRawConsCell, {
    font: fontBold,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder,
    numFmt: '#,##0'
  });

  // Ensure border on H column cells is present
  for(let r=rawMatStartRow; r<=consumptionEndRow; r++) {
      worksheet.getCell(`H${r}`).border = thinBorder;
  }

  // Vertical consumption title in A (A7:A24)
  worksheet.mergeCells(`A${consumptionStartRow}:A${consumptionEndRow}`);
  const verticalConsCell = worksheet.getCell(`A${consumptionStartRow}`);
  verticalConsCell.value = 'Consumption';
  styleCell(verticalConsCell, {
    font: fontVertical,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { textRotation: 90, vertical: 'middle', horizontal: 'center' },
    border: thinBorder
  });

  // Hatch spacer column I
  fillHatchedRange(7, consumptionEndRow, 'I', 'I');

  // Spacers
  currentRow += 2;
  fillHatchedRange(consumptionEndRow + 1, consumptionEndRow + 2, 'A', 'P');
  worksheet.getRow(consumptionEndRow + 1).height = 15;
  worksheet.getRow(consumptionEndRow + 2).height = 15;

  // ----------------------------------------------------
  // SECTION 2: FINAL PRODUCTS
  // ----------------------------------------------------
  const finalProductsStartRow = currentRow;

  const finalPallets = productionOutputs.filter(o => o.palletisationType === 'Final product');
  const outOfProgramPallets = productionOutputs.filter(o => 
    o.palletisationType === 'Out Of Program' || o.palletisationType === 'HP' || o.palletisationType === 'H-P'
  );

  const palletsByPO: Record<string, any[]> = {};
  finalPallets.forEach(p => {
    const poNum = p.orderPoNumber || p.orderId || 'Unknown PO';
    if (!palletsByPO[poNum]) palletsByPO[poNum] = [];
    palletsByPO[poNum].push(p);
  });

  const calibers = ['10', '12', '14', '16', '18', '20', '22', '24', '26', '28', '30', '32'];
  let programIdx = 1;

  const renderPOBlock = (poNumber: string, poPallets: any[], isHP = false) => {
    // Header row
    worksheet.mergeCells(`B${currentRow}:P${currentRow}`);
    const poHeader = worksheet.getCell(`B${currentRow}`);
    poHeader.value = isHP ? `Program ${programIdx} - Out Of Program` : `Program ${programIdx}`;
    styleCell(poHeader, {
      font: fontHeader,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
      border: thinBorder
    });
    currentRow++;

    // Subheader row (Caliber columns D-O)
    worksheet.getCell(`C${currentRow}`).value = 'Caliber';
    styleCell(worksheet.getCell(`C${currentRow}`), { font: fontHeader, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } }, border: thinBorder });
    
    calibers.forEach((cal, index) => {
      const colName = String.fromCharCode(68 + index); // D-O
      worksheet.getCell(`${colName}${currentRow}`).value = `Caliber ${cal}`;
      styleCell(worksheet.getCell(`${colName}${currentRow}`), {
        font: fontHeader,
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
        alignment: { horizontal: 'center' },
        border: thinBorder
      });
    });
    // Hatch column P in header row
    fillHatched(currentRow, 16);
    currentRow++;

    // Vertically merged PO cell in B (Packaging, Count, Total weight rows)
    const packRow = currentRow;
    const countRow = currentRow + 1;
    const totalWeightRow = currentRow + 2;
    const totalRow = currentRow + 3;

    worksheet.mergeCells(`B${packRow}:B${totalWeightRow}`);
    const poLabelCell = worksheet.getCell(`B${packRow}`);
    poLabelCell.value = isHP ? `H-P\n${poNumber}` : poNumber;
    styleCell(poLabelCell, {
      font: fontLargePO,
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: thinBorder
    });

    // Row label header names in C
    worksheet.getCell(`C${packRow}`).value = 'Packaging';
    worksheet.getCell(`C${countRow}`).value = 'Nbr of finalized pallets';
    worksheet.getCell(`C${totalWeightRow}`).value = 'Weight of finalized pallets';

    [packRow, countRow, totalWeightRow].forEach(rNum => {
      styleCell(worksheet.getCell(`C${rNum}`), {
        font: fontHeader,
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
        alignment: { horizontal: 'left', vertical: 'middle' },
        border: thinBorder
      });
    });

    // Initialize columns D-O
    calibers.forEach((_, idx) => {
      const colName = String.fromCharCode(68 + idx);
      worksheet.getCell(`${colName}${packRow}`).value = '';
      worksheet.getCell(`${colName}${countRow}`).value = 0;
      worksheet.getCell(`${colName}${totalWeightRow}`).value = 0;

      styleCell(worksheet.getCell(`${colName}${packRow}`), {
        font: fontNormal,
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: thinBorder
      });
      [countRow, totalWeightRow].forEach(rNum => {
        styleCell(worksheet.getCell(`${colName}${rNum}`), {
          font: fontNormal,
          alignment: { horizontal: 'center', vertical: 'middle' },
          border: thinBorder
        });
      });
    });

    // Set row heights for PO metrics
    worksheet.getRow(packRow).height = 28;
    worksheet.getRow(countRow).height = 20;
    worksheet.getRow(totalWeightRow).height = 20;

    // Hatch column P for inner PO rows
    [packRow, countRow, totalWeightRow].forEach(rNum => fillHatched(rNum, 16));

    // Populate actual pallet metrics
    poPallets.forEach(pallet => {
      const packId = pallet.packagingTypeId;
      const cons = consumables.find(c => c.id === packId);
      const rawPackName = pallet.packagingTypeName || cons?.name || cons?.consumableName || 'Box';
      const cleanPackName = rawPackName.split(' - ')[0];

      pallet.items?.forEach((item: any) => {
        const itemCal = String(item.caliber || '').trim();
        const matchedIdx = calibers.findIndex(c => c === itemCal);

        if (matchedIdx !== -1) {
          const colName = String.fromCharCode(68 + matchedIdx);

          // Packaging
          const packCell = worksheet.getCell(`${colName}${packRow}`);
          const currentPack = String(packCell.value || '');
          if (currentPack) {
            if (!currentPack.includes(cleanPackName)) {
              packCell.value = `${currentPack} + ${cleanPackName}`;
            }
          } else {
            packCell.value = cleanPackName;
          }

          // Count
          const countCell = worksheet.getCell(`${colName}${countRow}`);
          countCell.value = (Number(countCell.value) || 0) + 1;

          // Weight of pallets
          const weight = Number(item.netWeight) || 0;
          const weightCell = worksheet.getCell(`${colName}${totalWeightRow}`);
          weightCell.value = (Number(weightCell.value) || 0) + weight;
          weightCell.numFmt = '#,##0';
        }
      });
    });

    // Bottom PO Total weight row
    worksheet.mergeCells(`B${totalRow}:O${totalRow}`);
    const poTotalLabel = worksheet.getCell(`B${totalRow}`);
    poTotalLabel.value = 'Total weight kg';
    styleCell(poTotalLabel, {
      font: fontHeader,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder
    });

    const poTotalVal = worksheet.getCell(`P${totalRow}`);
    poTotalVal.value = { formula: `SUM(D${totalWeightRow}:O${totalWeightRow})` };
    styleCell(poTotalVal, {
      font: fontBold,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: thinBorder,
      numFmt: '#,##0'
    });

    currentRow += 4;
    programIdx++;
  };

  // Render normal POs
  Object.keys(palletsByPO).forEach(poNum => {
    renderPOBlock(poNum, palletsByPO[poNum], false);
  });

  // Render HP Out Of Program POs
  if (outOfProgramPallets.length > 0) {
    const oopPoGroup: Record<string, any[]> = {};
    outOfProgramPallets.forEach(p => {
      const poNum = p.orderPoNumber || p.orderId || 'HP-PO';
      if (!oopPoGroup[poNum]) oopPoGroup[poNum] = [];
      oopPoGroup[poNum].push(p);
    });

    Object.keys(oopPoGroup).forEach(poNum => {
      renderPOBlock(poNum, oopPoGroup[poNum], true);
    });
  }

  // ----------------------------------------------------
  // FINAL PALLETS AND WEIGHT TOTALS
  // ----------------------------------------------------
  const finalPalletsTotalRow = currentRow;

  // Row: Total of finalized pallets
  worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
  worksheet.getCell(`B${currentRow}`).value = 'Total of finalized pallets';
  worksheet.getCell(`D${currentRow}`).value = finalPallets.length + outOfProgramPallets.length;

  worksheet.mergeCells(`E${currentRow}:H${currentRow}`);
  worksheet.getCell(`E${currentRow}`).value = 'Total weight kg';
  
  const finalWeightsSum = finalPallets.concat(outOfProgramPallets).reduce((sum, p) => {
    const w = p.items?.reduce((s: number, i: any) => s + (Number(i.netWeight) || 0), 0) || 0;
    return sum + w;
  }, 0);
  worksheet.getCell(`I${currentRow}`).value = finalWeightsSum;

  [worksheet.getCell(`B${currentRow}`), worksheet.getCell(`E${currentRow}`)].forEach(c => {
    styleCell(c, { font: fontHeader, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } }, border: thinBorder });
  });
  styleCell(worksheet.getCell(`D${currentRow}`), { font: fontBold, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } }, alignment: { horizontal: 'center' }, border: thinBorder });
  styleCell(worksheet.getCell(`I${currentRow}`), { font: fontBold, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } }, alignment: { horizontal: 'center' }, border: thinBorder, numFmt: '#,##0' });
  
  fillHatchedRange(currentRow, currentRow, 'J', 'P');
  currentRow++;

  // Row: Total pending pallets Net weight & Total Final Products Net weight
  const finalNetWeightRow = currentRow;
  worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
  worksheet.getCell(`B${currentRow}`).value = `Total pending pallets Net weight of shift-${prevShift}`;
  
  const prevPendingWeight = previousShiftRestePallets.reduce((sum, p) => {
    const w = p.items?.reduce((s: number, i: any) => s + (Number(i.netWeight) || 0), 0) || 0;
    return sum + w;
  }, 0);
  worksheet.getCell(`D${currentRow}`).value = prevPendingWeight;

  worksheet.mergeCells(`E${currentRow}:H${currentRow}`);
  worksheet.getCell(`E${currentRow}`).value = 'Total Final Products Net weight kg';
  worksheet.getCell(`I${currentRow}`).value = { formula: `I${finalPalletsTotalRow}-D${finalNetWeightRow}` }; // Total Weight - Previous Pending

  [worksheet.getCell(`B${currentRow}`), worksheet.getCell(`E${currentRow}`)].forEach(c => {
    styleCell(c, { font: fontHeader, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } }, border: thinBorder });
  });
  styleCell(worksheet.getCell(`D${currentRow}`), { font: fontBold, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } }, alignment: { horizontal: 'center' }, border: thinBorder, numFmt: '#,##0' });
  styleCell(worksheet.getCell(`I${currentRow}`), {
    font: fontBold,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softOrange } }, // Premium highlight
    alignment: { horizontal: 'center' },
    border: thinBorder,
    numFmt: '#,##0'
  });

  fillHatchedRange(currentRow, currentRow, 'J', 'P');
  currentRow++;

  const finalProductsEndRow = currentRow - 1;

  // Vertical Final Products label in A
  worksheet.mergeCells(`A${finalProductsStartRow}:A${finalProductsEndRow}`);
  const verticalFinalCell = worksheet.getCell(`A${finalProductsStartRow}`);
  verticalFinalCell.value = 'Final products';
  styleCell(verticalFinalCell, {
    font: fontVertical,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { textRotation: 90, vertical: 'middle', horizontal: 'center' },
    border: thinBorder
  });

  // Spacers
  currentRow += 2;
  fillHatchedRange(finalProductsEndRow + 1, finalProductsEndRow + 2, 'A', 'P');
  worksheet.getRow(finalProductsEndRow + 1).height = 15;
  worksheet.getRow(finalProductsEndRow + 2).height = 15;

  // ----------------------------------------------------
  // SECTION 3: PENDING PALLETS
  // ----------------------------------------------------
  const pendingStartRow = currentRow;

  // Header row
  worksheet.getCell(`B${currentRow}`).value = 'Variety';
  styleCell(worksheet.getCell(`B${currentRow}`), { font: fontHeader, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } }, border: thinBorder });
  
  calibers.forEach((cal, index) => {
    const colName = String.fromCharCode(67 + index); // C-N
    worksheet.getCell(`${colName}${currentRow}`).value = `Caliber ${cal}`;
    styleCell(worksheet.getCell(`${colName}${currentRow}`), {
      font: fontHeader,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
      alignment: { horizontal: 'center' },
      border: thinBorder
    });
  });
  worksheet.getCell(`O${currentRow}`).value = 'Total';
  styleCell(worksheet.getCell(`O${currentRow}`), {
    font: fontHeader,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { horizontal: 'center' },
    border: thinBorder
  });
  fillHatched(currentRow, 16); // Hatch P
  currentRow++;

  const pendingPallets = productionOutputs.filter(o => o.palletisationType === 'Reste' || o.palletisationType === 'Pending');
  const pendingVarieties = ['Zutano', 'Bacon', 'Fuerte', 'Hass conv', 'Hass bio', 'Lamb Hass'];
  const pendingStartDataRow = currentRow;

  pendingVarieties.forEach(variety => {
    worksheet.getCell(`B${currentRow}`).value = variety;
    styleCell(worksheet.getCell(`B${currentRow}`), { font: fontNormal, border: thinBorder });

    calibers.forEach((cal, index) => {
      const colName = String.fromCharCode(67 + index);
      worksheet.getCell(`${colName}${currentRow}`).value = 0;
      styleCell(worksheet.getCell(`${colName}${currentRow}`), {
        font: fontNormal,
        alignment: { horizontal: 'center' },
        border: thinBorder
      });
    });

    // Row total formula
    worksheet.getCell(`O${currentRow}`).value = { formula: `SUM(C${currentRow}:N${currentRow})` };
    styleCell(worksheet.getCell(`O${currentRow}`), {
      font: fontBold,
      alignment: { horizontal: 'right' },
      border: thinBorder,
      numFmt: '#,##0'
    });

    fillHatched(currentRow, 16); // Hatch P

    // Populate pending weights
    pendingPallets.forEach(pallet => {
      pallet.items?.forEach((item: any) => {
        const itemVariety = getProductVariety(item.productId);
        let match = itemVariety.toLowerCase() === variety.toLowerCase();
        if (!match && variety.toLowerCase().includes('hass')) {
          const isBio = itemVariety.toLowerCase().includes('bio') || itemVariety.toLowerCase().includes('organic');
          match = isBio ? variety.toLowerCase().includes('bio') : variety.toLowerCase().includes('conv');
        }

        if (match) {
          const itemCal = String(item.caliber || '').trim();
          const matchedIdx = calibers.findIndex(c => c === itemCal);
          if (matchedIdx !== -1) {
            const colName = String.fromCharCode(67 + matchedIdx);
            const cell = worksheet.getCell(`${colName}${currentRow}`);
            cell.value = (Number(cell.value) || 0) + (Number(item.netWeight) || 0);
            cell.numFmt = '#,##0';
          }
        }
      });
    });

    currentRow++;
  });
  const pendingEndDataRow = currentRow - 1;

  // Pending pallets bottom total row
  worksheet.mergeCells(`B${currentRow}:N${currentRow}`);
  worksheet.getCell(`B${currentRow}`).value = 'Pending pallets Net weight kg';
  worksheet.getCell(`O${currentRow}`).value = { formula: `SUM(O${pendingStartDataRow}:O${pendingEndDataRow})` };

  styleCell(worksheet.getCell(`B${currentRow}`), {
    font: fontBold,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } },
    alignment: { horizontal: 'left' },
    border: thinBorder
  });
  styleCell(worksheet.getCell(`O${currentRow}`), {
    font: fontBold,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } },
    alignment: { horizontal: 'right' },
    border: thinBorder,
    numFmt: '#,##0'
  });
  fillHatched(currentRow, 16); // Hatch P

  const pendingEndRow = currentRow;

  // Vertical Pending pallets label in A
  worksheet.mergeCells(`A${pendingStartRow}:A${pendingEndRow}`);
  const verticalPendingCell = worksheet.getCell(`A${pendingStartRow}`);
  verticalPendingCell.value = 'Pending pallets';
  styleCell(verticalPendingCell, {
    font: fontVertical,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { textRotation: 90, vertical: 'middle', horizontal: 'center' },
    border: thinBorder
  });

  // Spacers
  currentRow += 2;
  fillHatchedRange(pendingEndRow + 1, pendingEndRow + 2, 'A', 'P');
  worksheet.getRow(pendingEndRow + 1).height = 15;
  worksheet.getRow(pendingEndRow + 2).height = 15;

  // ----------------------------------------------------
  // SECTION 4: CALIBERS STATISTICS
  // ----------------------------------------------------
  const statsStartRow = currentRow;

  worksheet.getCell(`B${currentRow}`).value = 'Program';
  styleCell(worksheet.getCell(`B${currentRow}`), { font: fontHeader, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } }, border: thinBorder });
  
  calibers.forEach((cal, index) => {
    const colName = String.fromCharCode(67 + index);
    worksheet.getCell(`${colName}${currentRow}`).value = `Caliber ${cal}`;
    styleCell(worksheet.getCell(`${colName}${currentRow}`), {
      font: fontHeader,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
      alignment: { horizontal: 'center' },
      border: thinBorder
    });
  });
  fillHatchedRange(currentRow, currentRow, 'O', 'P'); // Hatch O-P
  currentRow++;

  // Number of pallets
  worksheet.getCell(`B${currentRow}`).value = 'Number of pallets';
  styleCell(worksheet.getCell(`B${currentRow}`), { font: fontHeader, border: thinBorder });
  calibers.forEach((cal, index) => {
    const colName = String.fromCharCode(67 + index);
    worksheet.getCell(`${colName}${currentRow}`).value = 0;
    styleCell(worksheet.getCell(`${colName}${currentRow}`), { font: fontNormal, alignment: { horizontal: 'center' }, border: thinBorder });
  });
  fillHatchedRange(currentRow, currentRow, 'O', 'P');
  currentRow++;

  // Total Net weight
  const statsWeightRow = currentRow;
  worksheet.getCell(`B${currentRow}`).value = 'Total Net weight';
  styleCell(worksheet.getCell(`B${currentRow}`), { font: fontHeader, border: thinBorder });
  calibers.forEach((cal, index) => {
    const colName = String.fromCharCode(67 + index);
    worksheet.getCell(`${colName}${currentRow}`).value = 0;
    styleCell(worksheet.getCell(`${colName}${currentRow}`), { font: fontNormal, alignment: { horizontal: 'center' }, border: thinBorder, numFmt: '#,##0' });
  });
  fillHatchedRange(currentRow, currentRow, 'O', 'P');
  currentRow++;

  // Percentage
  const statsPctRow = currentRow;
  worksheet.getCell(`B${currentRow}`).value = 'Percentage';
  styleCell(worksheet.getCell(`B${currentRow}`), { font: fontHeader, border: thinBorder });
  
  // Populate statistics values
  const allFinalPallets = finalPallets.concat(outOfProgramPallets);
  allFinalPallets.forEach(pallet => {
    pallet.items?.forEach((item: any) => {
      const itemCal = String(item.caliber || '').trim();
      const matchedIdx = calibers.findIndex(c => c === itemCal);
      if (matchedIdx !== -1) {
        const colName = String.fromCharCode(67 + matchedIdx);
        
        // Count
        const countCell = worksheet.getCell(`${colName}${statsWeightRow - 1}`);
        countCell.value = (Number(countCell.value) || 0) + 1;

        // Weight
        const weightCell = worksheet.getCell(`${colName}${statsWeightRow}`);
        weightCell.value = (Number(weightCell.value) || 0) + (Number(item.netWeight) || 0);
      }
    });
  });

  // Safe division for percentage formula
  calibers.forEach((cal, index) => {
    const colName = String.fromCharCode(67 + index);
    const pctCell = worksheet.getCell(`${colName}${statsPctRow}`);
    pctCell.value = { formula: `IF(I${finalPalletsTotalRow}=0,0,${colName}${statsWeightRow}/I${finalPalletsTotalRow})` };
    styleCell(pctCell, { font: fontNormal, alignment: { horizontal: 'center' }, border: thinBorder, numFmt: '0.0%' });
  });
  fillHatchedRange(currentRow, currentRow, 'O', 'P');
  currentRow++;

  const statsEndRow = currentRow - 1;

  // Vertical Calibers Statistics label in A
  worksheet.mergeCells(`A${statsStartRow}:A${statsEndRow}`);
  const verticalStatsCell = worksheet.getCell(`A${statsStartRow}`);
  verticalStatsCell.value = 'Calibers Statistics';
  styleCell(verticalStatsCell, {
    font: fontVertical,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { textRotation: 90, vertical: 'middle', horizontal: 'center' },
    border: thinBorder
  });

  // Spacers
  currentRow += 2;
  fillHatchedRange(statsEndRow + 1, statsEndRow + 2, 'A', 'P');
  worksheet.getRow(statsEndRow + 1).height = 15;
  worksheet.getRow(statsEndRow + 2).height = 15;

  // ----------------------------------------------------
  // SECTION 5: DECAY
  // ----------------------------------------------------
  const decayStartRow = currentRow;

  // Headers for left and right tables
  worksheet.getCell(`B${currentRow}`).value = 'variety';
  worksheet.getCell(`C${currentRow}`).value = 'Pallet number';
  worksheet.getCell(`D${currentRow}`).value = 'Tare';
  worksheet.getCell(`E${currentRow}`).value = 'Boxes';
  worksheet.getCell(`F${currentRow}`).value = 'Gross Weight';
  worksheet.getCell(`G${currentRow}`).value = 'Net Weight';

  worksheet.getCell(`I${currentRow}`).value = 'variety';
  worksheet.getCell(`J${currentRow}`).value = 'Pallet number';
  worksheet.getCell(`K${currentRow}`).value = 'Tare';
  worksheet.getCell(`L${currentRow}`).value = 'Boxes';
  worksheet.getCell(`M${currentRow}`).value = 'Gross Weight';
  worksheet.getCell(`N${currentRow}`).value = 'Net Weight';

  const decayHeaders = ['B', 'C', 'D', 'E', 'F', 'G', 'I', 'J', 'K', 'L', 'M', 'N'];
  decayHeaders.forEach(col => {
    styleCell(worksheet.getCell(`${col}${currentRow}`), {
      font: fontHeader,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
      alignment: { horizontal: 'center' },
      border: thinBorder
    });
  });

  // Hatch separator column H and right margins O-P
  fillHatched(currentRow, 8);
  fillHatchedRange(currentRow, currentRow, 'O', 'P');
  currentRow++;

  const decayPallets = productionOutputs.filter(o => o.palletisationType === 'decay' || o.palletisationType === 'Decay');
  
  decayPallets.sort((a, b) => {
    const varA = getProductVariety(a.items?.[0]?.productId || '');
    const varB = getProductVariety(b.items?.[0]?.productId || '');
    return varA.localeCompare(varB);
  });

  // Fill left table first (up to 21), then right table (up to 21)
  const leftTable = decayPallets.slice(0, 21);
  const rightTable = decayPallets.slice(21, 42);
  const decayDataStartRow = currentRow;

  const maxRows = 21; // fixed 21 rows of capacity

  for (let i = 0; i < maxRows; i++) {
    // Left Table
    const lp = leftTable[i];
    if (lp) {
      const variety = getProductVariety(lp.items?.[0]?.productId || '');
      worksheet.getCell(`B${currentRow}`).value = variety;
      worksheet.getCell(`C${currentRow}`).value = lp.barcode || 'Unknown';
      worksheet.getCell(`D${currentRow}`).value = 22;
      worksheet.getCell(`E${currentRow}`).value = lp.items?.[0]?.numberOfBoxes || 0;
      worksheet.getCell(`F${currentRow}`).value = lp.items?.[0]?.grossWeight || 0;
      worksheet.getCell(`G${currentRow}`).value = lp.items?.[0]?.netWeight || 0;
    } else {
      ['B', 'C', 'D', 'E', 'F', 'G'].forEach(col => { worksheet.getCell(`${col}${currentRow}`).value = ''; });
    }

    // Right Table
    const rp = rightTable[i];
    if (rp) {
      const variety = getProductVariety(rp.items?.[0]?.productId || '');
      worksheet.getCell(`I${currentRow}`).value = variety;
      worksheet.getCell(`J${currentRow}`).value = rp.barcode || 'Unknown';
      worksheet.getCell(`K${currentRow}`).value = 22;
      worksheet.getCell(`L${currentRow}`).value = rp.items?.[0]?.numberOfBoxes || 0;
      worksheet.getCell(`M${currentRow}`).value = rp.items?.[0]?.grossWeight || 0;
      worksheet.getCell(`N${currentRow}`).value = rp.items?.[0]?.netWeight || 0;
    } else {
      ['I', 'J', 'K', 'L', 'M', 'N'].forEach(col => { worksheet.getCell(`${col}${currentRow}`).value = ''; });
    }

    // Style decay cells
    ['B', 'C', 'D', 'E', 'F', 'G', 'I', 'J', 'K', 'L', 'M', 'N'].forEach(col => {
      styleCell(worksheet.getCell(`${col}${currentRow}`), {
        font: fontNormal,
        alignment: { horizontal: 'center' },
        border: thinBorder
      });
    });

    fillHatched(currentRow, 8); // Separator column H
    fillHatchedRange(currentRow, currentRow, 'O', 'P'); // Column O-P
    currentRow++;
  }
  const decayDataEndRow = currentRow - 1;

  // Decay Summary Total Row
  worksheet.mergeCells(`B${currentRow}:L${currentRow}`);
  worksheet.getCell(`B${currentRow}`).value = 'Total Decay Net weight kg';
  
  worksheet.getCell(`M${currentRow}`).value = { formula: `SUM(G${decayDataStartRow}:G${decayDataEndRow})+SUM(N${decayDataStartRow}:N${decayDataEndRow})` };
  
  // Safe formula for percentage
  worksheet.getCell(`N${currentRow}`).value = { formula: `IF(H${rawMatStartRow}=0,0,M${currentRow}/H${rawMatStartRow})` };

  styleCell(worksheet.getCell(`B${currentRow}`), {
    font: fontBold,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } },
    alignment: { horizontal: 'left' },
    border: thinBorder
  });
  styleCell(worksheet.getCell(`M${currentRow}`), {
    font: fontBold,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } },
    alignment: { horizontal: 'center' },
    border: thinBorder,
    numFmt: '#,##0'
  });
  styleCell(worksheet.getCell(`N${currentRow}`), {
    font: fontBold,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } },
    alignment: { horizontal: 'center' },
    border: thinBorder,
    numFmt: '0.0%'
  });
  fillHatchedRange(currentRow, currentRow, 'O', 'P');
  currentRow++;

  const decayEndRow = currentRow - 1;

  // Vertical Decay label in A
  worksheet.mergeCells(`A${decayStartRow}:A${decayEndRow}`);
  const verticalDecayCell = worksheet.getCell(`A${decayStartRow}`);
  verticalDecayCell.value = 'Decay';
  styleCell(verticalDecayCell, {
    font: fontVertical,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { textRotation: 90, vertical: 'middle', horizontal: 'center' },
    border: thinBorder
  });

  // Spacers
  currentRow += 2;
  fillHatchedRange(decayEndRow + 1, decayEndRow + 2, 'A', 'P');
  worksheet.getRow(decayEndRow + 1).height = 15;
  worksheet.getRow(decayEndRow + 2).height = 15;

  // ----------------------------------------------------
  // SECTION 6: RETURNS & SUMMARY (SIDE-BY-SIDE)
  // ----------------------------------------------------
  const returnStartRow = currentRow;
  const returnsNetWeightRow = returnStartRow + 4;
  const returnsEndRow = returnStartRow + 5;
  const summaryEndRow = returnStartRow + 6;

  // Row 1: Header Returns (B-H) & Summary title/header (J-P)
  worksheet.getCell(`B${currentRow}`).value = 'Variety';
  styleCell(worksheet.getCell(`B${currentRow}`), { font: fontHeader, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } }, border: thinBorder });
  
  returnVarieties.forEach((v, index) => {
    const colName = String.fromCharCode(67 + index); // C-H
    worksheet.getCell(`${colName}${currentRow}`).value = v;
    styleCell(worksheet.getCell(`${colName}${currentRow}`), {
      font: fontHeader,
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
      alignment: { horizontal: 'center' },
      border: thinBorder
    });
  });
  fillHatched(currentRow, 9); // Hatch I

  // Summary header in J-P
  worksheet.mergeCells(`K${currentRow}:O${currentRow}`);
  worksheet.getCell(`K${currentRow}`).value = 'Consumption kg';
  worksheet.getCell(`P${currentRow}`).value = { formula: `H${rawMatStartRow}+G${consumptionEndRow}` }; // RM + Return of shift

  styleCell(worksheet.getCell(`K${currentRow}`), { font: fontHeader, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } }, border: thinBorder });
  styleCell(worksheet.getCell(`P${currentRow}`), { font: fontNormal, border: thinBorder, alignment: { horizontal: 'right' }, numFmt: '#,##0' });
  currentRow++;

  // Row 2: Pallet number Returns (B-H) & Summary Final Products
  worksheet.getCell(`B${currentRow}`).value = 'Pallet Number';
  styleCell(worksheet.getCell(`B${currentRow}`), { font: fontHeader, border: thinBorder });
  returnVarieties.forEach((v, index) => {
    const colName = String.fromCharCode(67 + index);
    worksheet.getCell(`${colName}${currentRow}`).value = '-';
    styleCell(worksheet.getCell(`${colName}${currentRow}`), { font: fontNormal, alignment: { horizontal: 'center' }, border: thinBorder });
  });
  fillHatched(currentRow, 9); // Hatch I

  // Summary Final products kg
  worksheet.mergeCells(`K${currentRow}:O${currentRow}`);
  worksheet.getCell(`K${currentRow}`).value = 'Final products kg';
  worksheet.getCell(`P${currentRow}`).value = { formula: `I${finalNetWeightRow}` };

  styleCell(worksheet.getCell(`K${currentRow}`), { font: fontHeader, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } }, border: thinBorder });
  styleCell(worksheet.getCell(`P${currentRow}`), { font: fontNormal, border: thinBorder, alignment: { horizontal: 'right' }, numFmt: '#,##0' });
  currentRow++;

  // Row 3: Boxes Returns (B-H) & Summary Pending
  worksheet.getCell(`B${currentRow}`).value = 'Boxes';
  styleCell(worksheet.getCell(`B${currentRow}`), { font: fontHeader, border: thinBorder });
  returnVarieties.forEach((v, index) => {
    const colName = String.fromCharCode(67 + index);
    worksheet.getCell(`${colName}${currentRow}`).value = 0;
    styleCell(worksheet.getCell(`${colName}${currentRow}`), { font: fontNormal, alignment: { horizontal: 'center' }, border: thinBorder });
  });
  fillHatched(currentRow, 9); // Hatch I

  // Summary Pending
  worksheet.mergeCells(`K${currentRow}:O${currentRow}`);
  worksheet.getCell(`K${currentRow}`).value = 'Pending pallets kg';
  worksheet.getCell(`P${currentRow}`).value = { formula: `O${pendingEndRow}` };

  styleCell(worksheet.getCell(`K${currentRow}`), { font: fontHeader, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } }, border: thinBorder });
  styleCell(worksheet.getCell(`P${currentRow}`), { font: fontNormal, border: thinBorder, alignment: { horizontal: 'right' }, numFmt: '#,##0' });
  currentRow++;

  // Row 4: Gross weight Returns (B-H) & Summary Decay
  worksheet.getCell(`B${currentRow}`).value = 'Gross weight';
  styleCell(worksheet.getCell(`B${currentRow}`), { font: fontHeader, border: thinBorder });
  returnVarieties.forEach((v, index) => {
    const colName = String.fromCharCode(67 + index);
    worksheet.getCell(`${colName}${currentRow}`).value = 0;
    styleCell(worksheet.getCell(`${colName}${currentRow}`), { font: fontNormal, alignment: { horizontal: 'center' }, border: thinBorder });
  });
  fillHatched(currentRow, 9); // Hatch I

  // Summary Decay
  worksheet.mergeCells(`K${currentRow}:O${currentRow}`);
  worksheet.getCell(`K${currentRow}`).value = 'Decay kg';
  worksheet.getCell(`P${currentRow}`).value = { formula: `M${decayEndRow}` };

  styleCell(worksheet.getCell(`K${currentRow}`), { font: fontHeader, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } }, border: thinBorder });
  styleCell(worksheet.getCell(`P${currentRow}`), { font: fontNormal, border: thinBorder, alignment: { horizontal: 'right' }, numFmt: '#,##0' });
  currentRow++;

  // Row 5: Net weight Returns (B-H) & Summary Returns
  worksheet.getCell(`B${currentRow}`).value = 'Net weight';
  styleCell(worksheet.getCell(`B${currentRow}`), { font: fontHeader, border: thinBorder });
  returnVarieties.forEach((v, index) => {
    const colName = String.fromCharCode(67 + index);
    worksheet.getCell(`${colName}${currentRow}`).value = 0;
    styleCell(worksheet.getCell(`${colName}${currentRow}`), { font: fontNormal, alignment: { horizontal: 'center' }, border: thinBorder, numFmt: '#,##0' });
  });
  fillHatched(currentRow, 9); // Hatch I

  // Summary Returns
  worksheet.mergeCells(`K${currentRow}:O${currentRow}`);
  worksheet.getCell(`K${currentRow}`).value = 'Return kg';
  worksheet.getCell(`P${currentRow}`).value = { formula: `I${returnsEndRow}` };

  styleCell(worksheet.getCell(`K${currentRow}`), { font: fontHeader, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } }, border: thinBorder });
  styleCell(worksheet.getCell(`P${currentRow}`), { font: fontNormal, border: thinBorder, alignment: { horizontal: 'right' }, numFmt: '#,##0' });
  currentRow++;

  // Populate Returns data
  const returnPallets = productionOutputs.filter(o => o.palletisationType === 'Return');
  returnPallets.forEach(pallet => {
    pallet.items?.forEach((item: any) => {
      const itemVariety = getProductVariety(item.productId);
      const matchedIdx = getReturnVarietyIndex(itemVariety);

      if (matchedIdx !== -1) {
        const colName = String.fromCharCode(67 + matchedIdx);
        
        // Pallet number
        const palCell = worksheet.getCell(`${colName}${returnsNetWeightRow - 3}`);
        const currentPal = String(palCell.value || '');
        if (currentPal && currentPal !== '-') {
          palCell.value = `${currentPal}, ${pallet.barcode}`;
        } else {
          palCell.value = pallet.barcode;
        }

        // Boxes
        const boxCell = worksheet.getCell(`${colName}${returnsNetWeightRow - 2}`);
        boxCell.value = (Number(boxCell.value) || 0) + (Number(item.numberOfBoxes) || 0);

        // Gross Weight
        const grossCell = worksheet.getCell(`${colName}${returnsNetWeightRow - 1}`);
        grossCell.value = (Number(grossCell.value) || 0) + (Number(item.grossWeight) || 0);

        // Net Weight
        const netCell = worksheet.getCell(`${colName}${returnsNetWeightRow}`);
        netCell.value = (Number(netCell.value) || 0) + (Number(item.netWeight) || 0);
      }
    });
  });

  // Row 6: Returns Total (B-H, value in I) & Summary Total Loss kg
  worksheet.mergeCells(`B${currentRow}:H${currentRow}`);
  worksheet.getCell(`B${currentRow}`).value = 'Total Net weight kg';
  worksheet.getCell(`I${currentRow}`).value = { formula: `SUM(C${returnsNetWeightRow}:H${returnsNetWeightRow})` };

  styleCell(worksheet.getCell(`B${currentRow}`), {
    font: fontBold,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } },
    alignment: { horizontal: 'left' },
    border: thinBorder
  });
  styleCell(worksheet.getCell(`I${currentRow}`), {
    font: fontBold,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softYellow } },
    alignment: { horizontal: 'center' },
    border: thinBorder,
    numFmt: '#,##0'
  });

  // Summary Total Loss kg
  worksheet.mergeCells(`K${currentRow}:O${currentRow}`);
  worksheet.getCell(`K${currentRow}`).value = 'Total Loss kg';
  worksheet.getCell(`P${currentRow}`).value = { formula: `P${returnStartRow}-P${returnStartRow+1}-P${returnStartRow+2}-P${returnStartRow+3}-P${returnStartRow+4}` };

  styleCell(worksheet.getCell(`K${currentRow}`), {
    font: { ...fontBold, color: { argb: redText } },
    border: thinBorder
  });
  styleCell(worksheet.getCell(`P${currentRow}`), {
    font: { ...fontBold, color: { argb: redText } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softRedBackground } },
    border: thinBorder,
    alignment: { horizontal: 'right' },
    numFmt: '#,##0'
  });
  currentRow++;

  // Row 7: Returns Hatch & Summary Total Loss %
  fillHatchedRange(currentRow, currentRow, 'A', 'I');

  // Summary Total Loss %
  worksheet.mergeCells(`K${currentRow}:O${currentRow}`);
  worksheet.getCell(`K${currentRow}`).value = 'Total Loss %';
  worksheet.getCell(`P${currentRow}`).value = { formula: `IF(P${returnStartRow}=0,0,P${currentRow-1}/P${returnStartRow})` };

  styleCell(worksheet.getCell(`K${currentRow}`), {
    font: { ...fontBold, color: { argb: redText } },
    border: thinBorder
  });
  styleCell(worksheet.getCell(`P${currentRow}`), {
    font: { ...fontBold, color: { argb: redText } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: softRedBackground } },
    border: thinBorder,
    alignment: { horizontal: 'right' },
    numFmt: '0.00%'
  });

  // Vertical Returns label in A
  worksheet.mergeCells(`A${returnStartRow}:A${returnsEndRow}`);
  const verticalReturnCell = worksheet.getCell(`A${returnStartRow}`);
  verticalReturnCell.value = 'Returns';
  styleCell(verticalReturnCell, {
    font: fontVertical,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { textRotation: 90, vertical: 'middle', horizontal: 'center' },
    border: thinBorder
  });

  // Vertical Summary label in J
  worksheet.mergeCells(`J${returnStartRow}:J${summaryEndRow}`);
  const verticalSummaryCell = worksheet.getCell(`J${returnStartRow}`);
  verticalSummaryCell.value = 'Summary';
  styleCell(verticalSummaryCell, {
    font: fontVertical,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: lightGreen } },
    alignment: { textRotation: 90, vertical: 'middle', horizontal: 'center' },
    border: thinBorder
  });

  // Apply Thick borders around the main modules for professional appearance
  // 1. Consumption Block outline
  for (let r = consumptionStartRow; r <= consumptionEndRow; r++) {
    worksheet.getCell(`A${r}`).border = { ...worksheet.getCell(`A${r}`).border, left: { style: 'medium', color: { argb: '333333' } } };
    worksheet.getCell(`G${r}`).border = { ...worksheet.getCell(`G${r}`).border, right: { style: 'medium', color: { argb: '333333' } } };
  }
  for (let c = 1; c <= 7; c++) {
    const colName = String.fromCharCode(64 + c);
    worksheet.getCell(`${colName}${consumptionStartRow}`).border = { ...worksheet.getCell(`${colName}${consumptionStartRow}`).border, top: { style: 'medium', color: { argb: '333333' } } };
    worksheet.getCell(`${colName}${consumptionEndRow}`).border = { ...worksheet.getCell(`${colName}${consumptionEndRow}`).border, bottom: { style: 'medium', color: { argb: '333333' } } };
  }

  // 2. Final Products Block outline
  for (let r = finalProductsStartRow; r <= finalProductsEndRow; r++) {
    worksheet.getCell(`A${r}`).border = { ...worksheet.getCell(`A${r}`).border, left: { style: 'medium', color: { argb: '333333' } } };
    worksheet.getCell(`P${r}`).border = { ...worksheet.getCell(`P${r}`).border, right: { style: 'medium', color: { argb: '333333' } } };
  }
  for (let c = 1; c <= 16; c++) {
    const colName = String.fromCharCode(64 + c);
    worksheet.getCell(`${colName}${finalProductsStartRow}`).border = { ...worksheet.getCell(`${colName}${finalProductsStartRow}`).border, top: { style: 'medium', color: { argb: '333333' } } };
    worksheet.getCell(`${colName}${finalProductsEndRow}`).border = { ...worksheet.getCell(`${colName}${finalProductsEndRow}`).border, bottom: { style: 'medium', color: { argb: '333333' } } };
  }

  // 3. Pending Pallets Block outline
  for (let r = pendingStartRow; r <= pendingEndRow; r++) {
    worksheet.getCell(`A${r}`).border = { ...worksheet.getCell(`A${r}`).border, left: { style: 'medium', color: { argb: '333333' } } };
    worksheet.getCell(`O${r}`).border = { ...worksheet.getCell(`O${r}`).border, right: { style: 'medium', color: { argb: '333333' } } };
  }
  for (let c = 1; c <= 15; c++) {
    const colName = String.fromCharCode(64 + c);
    worksheet.getCell(`${colName}${pendingStartRow}`).border = { ...worksheet.getCell(`${colName}${pendingStartRow}`).border, top: { style: 'medium', color: { argb: '333333' } } };
    worksheet.getCell(`${colName}${pendingEndRow}`).border = { ...worksheet.getCell(`${colName}${pendingEndRow}`).border, bottom: { style: 'medium', color: { argb: '333333' } } };
  }

  // Save Workbook
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Daily_Production_Report_${date}_Shift_${shift}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
}
