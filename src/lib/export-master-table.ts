import ExcelJS from 'exceljs';

const safeNumber = (value: any) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export async function exportMasterTableExcel(inventories: any[]) {
  // Sort inventories by date ascending
  const sorted = [...inventories].sort((a, b) => a.startDate.localeCompare(b.startDate));
  
  if (sorted.length === 0) return;

  const fromDate = sorted[0].startDate;
  const toDate = sorted[sorted.length - 1].endDate;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('INVENTAIRE TOT 2025-2026', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: false }]
  });

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: '000000' } },
    left: { style: 'thin', color: { argb: '000000' } },
    bottom: { style: 'thin', color: { argb: '000000' } },
    right: { style: 'thin', color: { argb: '000000' } }
  };

  const styleCell = (cell: ExcelJS.Cell, options: Partial<ExcelJS.Style>) => {
    Object.assign(cell, options);
  };

  // Row 1: INVENTAIRE 2025/2026
  worksheet.mergeCells('A1:AG1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'INVENTAIRE 2025/2026';
  styleCell(titleCell, {
    font: { name: 'Arial', size: 14, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2EFDA' } },
    border: thinBorder
  });
  worksheet.getRow(1).height = 30;

  // Row 2: Grouped Headers
  const groupHeaders = [
    { range: 'A2:D2', title: '', color: 'FFFFFF' },
    { range: 'E2:H2', title: 'RECEPTION', color: 'BDD7EE' },
    { range: 'I2:I2', title: '', color: 'FFFFFF' },
    { range: 'J2:P2', title: 'TOTAL PRODUIT FINI', color: 'BDD7EE' },
    { range: 'Q2:AA2', title: 'DECHET', color: 'E2EFDA' },
    { range: 'AB2:AG2', title: '', color: 'FFFFFF' }
  ];

  groupHeaders.forEach(gh => {
    worksheet.mergeCells(gh.range);
    const cell = worksheet.getCell(gh.range.split(':')[0]);
    cell.value = gh.title;
    styleCell(cell, {
      font: { name: 'Arial', size: 10, bold: true },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: gh.color } },
      border: thinBorder
    });
    // Ensure all cells in range have borders
    const [start, end] = gh.range.split(':');
    const startCol = worksheet.getColumn(start.replace(/[0-9]/g, '')).number;
    const endCol = worksheet.getColumn(end.replace(/[0-9]/g, '')).number;
    for (let i = startCol; i <= endCol; i++) {
       styleCell(worksheet.getCell(2, i), { border: thinBorder });
    }
  });
  worksheet.getRow(2).height = 25;

  // Row 3: Sub Headers
  const subHeaders = [
    'Week', 'DU', 'AU', 'VARIETE', 
    'MP BON CAMION', 'DIFFERENCE', 'MP PESEE', 'DECHET DE FERME', 
    'RETOUR', 
    'PRODUITS FINI CHARGES', 'PRODUIT FINI', 'PRODUIT FINI D\'INVENTAIRE', 'PF EN STOCK (POs NON COMPLETS)', 'DIFFERENCE ENTRE PFC ET PF', 'HORS PROGRAMMES', 'RESTES', 
    'DECHET DE PRODUCTION', '% DECHET DE PRODUCTION', 'DECHET EXPORTE', '(P.F; RESTES; RETOUR...ETC) VENDU AU MARCHE LOCAL', 'dechet vendu', 'dechet TOT', 'DECHET A VENDRE AU MARCHE LOCAL', 'dechet en stock', 'dechets emballes en stock', 'pertes dechet', '% PERTES DECHET',
    'MP en stock', 'perte réel', '%', 'perte global', '%', 'REMARQUES'
  ];

  const row3 = worksheet.getRow(3);
  subHeaders.forEach((sh, idx) => {
    const cell = row3.getCell(idx + 1);
    cell.value = sh;
    styleCell(cell, {
      font: { name: 'Arial', size: 9, bold: true },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F2F2F2' } },
      border: thinBorder
    });
  });
  row3.height = 40;

  // Set column widths
  const colWidths = [
    12, 12, 12, 12, // A-D
    15, 15, 15, 15, // E-H
    12, // I
    15, 15, 15, 15, 15, 15, 15, // J-P
    15, 12, 15, 20, 15, 15, 20, 15, 18, 15, 12, // Q-AA
    15, 15, 10, 15, 10, 30 // AB-AG
  ];
  colWidths.forEach((w, i) => {
    worksheet.getColumn(i + 1).width = w;
  });

  let prevRetour = 0;
  let prevMpStock = 0;
  let prevPfStock = 0;
  let prevHp = 0;
  let prevRestes = 0;
  let prevDechetStock = 0;
  let prevDechetsEmballesStock = 0;

  // Track totals for the last row
  let tMpBonCamion = 0;
  let tMpPesee = 0;
  let tDechetMp = 0;
  let tProduitCharge = 0;
  let tProduitsFinis = 0;
  let tProduitFiniInventaire = 0;
  let tDechetProduction = 0;
  let tDechetTot = 0;
  let tLocalMarket = 0;
  let tDechetExporte = 0;
  let tDechetAVendre = 0;
  let tDechetUsine = 0; // Vendu
  let tPerteDechet = 0;
  let tPerteReelle = 0;
  let tPerteGlobale = 0;
  let tDifference = 0;
  
  let lastM = 0;
  let lastO = 0;
  let lastP = 0;
  let lastAB = 0;
  let lastX = 0;
  let lastY = 0;
  
  let sumProdBase = 0;
  let sumDechetLossBase = 0;

  let rowIndex = 4;

  for (const inv of sorted) {
    const t = inv.totals || inv || {};
    
    // Live data fields
    const mpBonCamion = safeNumber(t.mpBonCamion);
    const mpPesee = safeNumber(t.mpPesee);
    const dechetFerme = safeNumber(t.dechetMp);
    const retour = safeNumber(t.retour);
    const produitsFiniCharges = safeNumber(t.produitCharge);
    const produitFini = safeNumber(t.produitsFinis);
    const pfStock = safeNumber(t.pfEnStock);
    const horsProgrammes = safeNumber(t.outOfProgram);
    const restes = safeNumber(t.restes);
    const dechetProduction = safeNumber(t.dechetProduction);
    const dechetExporte = safeNumber(t.dechetExporte);
    const venduMarcheLocal = safeNumber(t.localMarket);
    const dechetVendu = safeNumber(t.dechetUsine); // Vendu
    const dechetStock = safeNumber(t.dechetEnStock);
    const dechetsEmballesStock = safeNumber(t.dechetsEmballesStock);
    const mpEnStock = safeNumber(t.mpEnStock);
    const adjustments = 0; // As per discussion, defaulting to 0

    // Calculations
    const difference = mpBonCamion - mpPesee;
    
    const produitFiniInventaire = produitFini + prevPfStock + prevHp + prevRestes - pfStock - horsProgrammes - restes - venduMarcheLocal;
    const differencePfcPf = produitFiniInventaire - produitsFiniCharges;
    
    const dechetTot = dechetFerme + dechetProduction;
    
    const productionBase = mpPesee + prevRetour + prevMpStock - dechetFerme - retour - mpEnStock;
    const dechetProductionPercent = productionBase > 0 ? (dechetProduction / productionBase) : 0;
    
    const dechetAVendre = dechetTot + prevDechetStock + prevDechetsEmballesStock + venduMarcheLocal - dechetExporte - dechetStock - dechetsEmballesStock - adjustments;
    const pertesDechet = dechetAVendre - dechetVendu;
    
    const dechetLossBase = dechetTot + venduMarcheLocal;
    const pertesDechetPercent = dechetLossBase > 0 ? (pertesDechet / dechetLossBase) : 0;
    
    const perteReel = mpPesee + prevRetour + prevMpStock - dechetFerme - retour - produitFini - dechetProduction - mpEnStock + adjustments;
    const perteReelPercent = mpPesee > 0 ? (perteReel / mpPesee) : 0;
    
    const perteGlobal = mpBonCamion + prevRetour + prevMpStock + prevPfStock + prevHp + prevRestes - retour - produitsFiniCharges - pfStock - horsProgrammes - restes - dechetTot - mpEnStock - venduMarcheLocal - dechetStock + adjustments;
    const perteGlobalPercent = mpBonCamion > 0 ? (perteGlobal / mpBonCamion) : 0;

    // Build row
    const rowValues = [
      inv.period || `W${rowIndex - 3}`, // A
      inv.startDate, // B
      inv.endDate, // C
      '', // D: VARIETE (default blank)
      mpBonCamion, // E
      difference, // F
      mpPesee, // G
      dechetFerme, // H
      retour, // I
      produitsFiniCharges, // J
      produitFini, // K
      produitFiniInventaire, // L
      pfStock, // M
      differencePfcPf, // N
      horsProgrammes, // O
      restes, // P
      dechetProduction, // Q
      dechetProductionPercent, // R
      dechetExporte, // S
      venduMarcheLocal, // T
      dechetVendu, // U
      dechetTot, // V
      dechetAVendre, // W
      dechetStock, // X
      dechetsEmballesStock, // Y
      pertesDechet, // Z
      pertesDechetPercent, // AA
      mpEnStock, // AB
      perteReel, // AC
      perteReelPercent, // AD
      perteGlobal, // AE
      perteGlobalPercent, // AF
      inv.remarks || '' // AG
    ];

    const dataRow = worksheet.addRow(rowValues);
    dataRow.height = 20;

    // Number formats and styling
    dataRow.eachCell((cell, colNumber) => {
      styleCell(cell, { border: thinBorder, alignment: { horizontal: 'center', vertical: 'middle' }, font: { name: 'Arial', size: 9 } });
      
      const pctCols = [18, 27, 30, 32]; // R, AA, AD, AF
      if (colNumber >= 5 && colNumber <= 32) { // E to AF
        if (pctCols.includes(colNumber)) {
          cell.numFmt = '0.00%';
        } else {
          cell.numFmt = '#,##0';
        }
      }
    });

    // Update previous state
    prevRetour = retour;
    prevMpStock = mpEnStock;
    prevPfStock = pfStock;
    prevHp = horsProgrammes;
    prevRestes = restes;
    prevDechetStock = dechetStock;
    prevDechetsEmballesStock = dechetsEmballesStock;

    // Track totals
    tMpBonCamion += mpBonCamion;
    tMpPesee += mpPesee;
    tDechetMp += dechetFerme;
    tProduitCharge += produitsFiniCharges;
    tProduitsFinis += produitFini;
    tProduitFiniInventaire += produitFiniInventaire;
    tDechetProduction += dechetProduction;
    tDechetTot += dechetTot;
    tLocalMarket += venduMarcheLocal;
    tDechetExporte += dechetExporte;
    tDechetAVendre += dechetAVendre;
    tDechetUsine += dechetVendu;
    tPerteDechet += pertesDechet;
    tPerteReelle += perteReel;
    tPerteGlobale += perteGlobal;
    tDifference += difference;
    
    sumProdBase += productionBase;
    sumDechetLossBase += dechetLossBase;

    lastM = pfStock;
    lastO = horsProgrammes;
    lastP = restes;
    lastAB = mpEnStock;
    lastX = dechetStock;
    lastY = dechetsEmballesStock;

    rowIndex++;
  }

  // TOTAL Row
  const totalDifferencePfcPf = tProduitFiniInventaire - tProduitCharge;
  const tDechetProductionPercent = sumProdBase > 0 ? (tDechetProduction / sumProdBase) : 0;
  const tPertesDechetPercent = sumDechetLossBase > 0 ? (tPerteDechet / sumDechetLossBase) : 0;
  const tPerteReellePercent = tMpPesee > 0 ? (tPerteReelle / tMpPesee) : 0;
  const tPerteGlobalePercent = tMpBonCamion > 0 ? (tPerteGlobale / tMpBonCamion) : 0;

  const totalValues = [
    'TOTAL', '', '', '', // A-D
    tMpBonCamion, // E
    tDifference, // F
    tMpPesee, // G
    tDechetMp, // H
    '', // I (not summed)
    tProduitCharge, // J
    tProduitsFinis, // K
    tProduitFiniInventaire, // L
    lastM, // M
    totalDifferencePfcPf, // N
    lastO, // O
    lastP, // P
    tDechetProduction, // Q
    tDechetProductionPercent, // R
    tDechetExporte, // S
    tLocalMarket, // T
    tDechetUsine, // U
    tDechetTot, // V
    tDechetAVendre, // W
    lastX, // X
    lastY, // Y
    tPerteDechet, // Z
    tPertesDechetPercent, // AA
    lastAB, // AB
    tPerteReelle, // AC
    tPerteReellePercent, // AD
    tPerteGlobale, // AE
    tPerteGlobalePercent, // AF
    '' // AG
  ];

  const totalRow = worksheet.addRow(totalValues);
  totalRow.height = 25;
  worksheet.mergeCells(`A${rowIndex}:D${rowIndex}`);

  totalRow.eachCell((cell, colNumber) => {
    styleCell(cell, { 
      border: thinBorder, 
      alignment: { horizontal: 'center', vertical: 'middle' }, 
      font: { name: 'Arial', size: 10, bold: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF00' } } // Yellow fill
    });
    
    const pctCols = [18, 27, 30, 32]; // R, AA, AD, AF
    if (colNumber >= 5 && colNumber <= 32) { // E to AF
      if (pctCols.includes(colNumber)) {
        cell.numFmt = '0.00%';
      } else {
        cell.numFmt = '#,##0';
      }
    }
  });

  // Generate File
  const buffer = await workbook.xlsx.writeBuffer();
  const fileBlob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(fileBlob);
  const link = document.createElement('a');
  link.href = url;
  
  const fromClean = fromDate.replace(/\//g, '-');
  const toClean = toDate.replace(/\//g, '-');
  link.download = `INVENTAIRE_TOT_2025_2026_${fromClean}_to_${toClean}.xlsx`;
  
  link.click();
  window.URL.revokeObjectURL(url);
}
