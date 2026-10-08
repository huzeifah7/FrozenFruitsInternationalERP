import ExcelJS from 'exceljs';

async function fetchImageBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export async function generateInvoiceExcel(
  invoiceNumber: string,
  invoiceDate: string,
  packingList: any,
  orderData: any,
  customerData: any,
  mainFarmGgn: string,
  rows: any[],
  invoiceData?: any
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Invoice');

  // Page setup
  worksheet.pageSetup = {
    margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0
  };

  // Define Column Widths
  worksheet.columns = [
    { width: 18 }, // A: Item code / Section labels
    { width: 45 }, // B: Product Description / Address
    { width: 12 }, // C: Empty / Spacing
    { width: 22 }, // D: Unit price EUR / Grid Labels
    { width: 20 }, // E: Quantity (kg) / Grid Values
    { width: 22 }, // F: Amount in EUR
  ];

  const headerFillBg = 'F0EEE0'; // Warm beige fill matching PDF
  const beigeFillStyle: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: `FF${headerFillBg}` }
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };

  // 1. Logo
  const logoBuffer = await fetchImageBuffer('/FFI_main.png');
  if (logoBuffer) {
    try {
      const logoId = workbook.addImage({
        buffer: logoBuffer,
        extension: 'png'
      });
      worksheet.addImage(logoId, {
        tl: { col: 0, row: 0 },
        ext: { width: 100, height: 50 },
        editAs: 'oneCell'
      });
    } catch (e) {
      console.warn('Could not embed logo in Excel', e);
    }
  }

  // Row 1-3 Heights & Company Header
  worksheet.getRow(1).height = 18;
  worksheet.getRow(2).height = 18;
  worksheet.getRow(3).height = 18;

  worksheet.mergeCells('B1:C1');
  worksheet.mergeCells('B2:C2');
  worksheet.mergeCells('B3:C3');
  worksheet.mergeCells('B4:C4');

  const cellB1 = worksheet.getCell('B1');
  cellB1.value = 'EXPORT OPTIMUM';
  cellB1.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF76933C' } };

  worksheet.getCell('B2').value = 'DOUAR MOUARAA TEYARA';
  worksheet.getCell('B3').value = 'LAAOUAMRA KSAR EL KEBIR';
  worksheet.getCell('B4').value = 'Phone: 00212678732391';

  ['B2', 'B3', 'B4'].forEach(ref => {
    worksheet.getCell(ref).font = { name: 'Calibri', size: 9 };
  });

  // Invoice Title
  const rawType = invoiceData?.invoice_type_display || invoiceData?.invoice_type || 'Invoice';
  let title = 'Invoice';
  if (rawType.toLowerCase().includes('proforma')) title = 'Proforma';
  else if (rawType.toLowerCase().includes('credit')) title = 'Credit Note';

  worksheet.mergeCells('E1:F2');
  const titleCell = worksheet.getCell('E1');
  titleCell.value = title;
  titleCell.font = { name: 'Calibri', size: 22, bold: true, italic: true };
  titleCell.alignment = { horizontal: 'right', vertical: 'middle' };

  // Invoice No & Date Table Box (Rows 4-5, Cols E-F)
  worksheet.getCell('E4').value = `${title} No`;
  worksheet.getCell('F4').value = 'DATE';
  ['E4', 'F4'].forEach(ref => {
    const c = worksheet.getCell(ref);
    c.fill = beigeFillStyle;
    c.font = { name: 'Calibri', size: 10, bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = thinBorder;
  });

  let displayInvoiceNumber = invoiceNumber || '—';
  if (title === 'Credit Note' && displayInvoiceNumber !== '—' && !displayInvoiceNumber.startsWith('CN')) {
    displayInvoiceNumber = `CN${displayInvoiceNumber}`;
  }

  worksheet.getCell('E5').value = displayInvoiceNumber;
  worksheet.getCell('F5').value = invoiceDate || '—';
  ['E5', 'F5'].forEach(ref => {
    const c = worksheet.getCell(ref);
    c.font = { name: 'Calibri', size: 10, bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = thinBorder;
  });

  // 2. Invoice To Header Bar (Row 6)
  worksheet.getRow(6).height = 20;
  worksheet.mergeCells('A6:F6');
  const headerBar = worksheet.getCell('A6');
  headerBar.value = `${title} To`;
  headerBar.fill = beigeFillStyle;
  headerBar.font = { name: 'Calibri', size: 11, bold: true };
  headerBar.alignment = { horizontal: 'center', vertical: 'middle' };
  headerBar.border = thinBorder;

  // 3. Customer Info (Rows 7-11)
  const cName = invoiceData?.customer_detail?.companyName || invoiceData?.customer_detail?.company_name || invoiceData?.customer || customerData?.name || orderData?.customerName || orderData?.customer || packingList?.customer || '—';
  const cAddress = invoiceData?.customer_detail?.invoicing_address || invoiceData?.invoicing_address || customerData?.address || packingList?.customerAddress || '—';
  const cCity = invoiceData?.customer_detail?.city || customerData?.city || '—';
  const cCountry = invoiceData?.customer_detail?.country || customerData?.country || '—';
  const cVat = invoiceData?.customer_detail?.vat_number || invoiceData?.customer_detail?.vatNumber || invoiceData?.vat_number || customerData?.vatNumber || '-';

  const custFields = [
    { label: 'Company Name', val: cName },
    { label: 'Street Address', val: cAddress },
    { label: 'City State Zip', val: cCity },
    { label: 'Country', val: cCountry },
    { label: 'VAT-number', val: cVat },
  ];

  custFields.forEach((item, idx) => {
    const rowNum = 7 + idx;
    worksheet.getRow(rowNum).height = 18;

    const lblCell = worksheet.getCell(`A${rowNum}`);
    lblCell.value = item.label;
    lblCell.fill = beigeFillStyle;
    lblCell.font = { name: 'Calibri', size: 9, bold: true };
    lblCell.alignment = { horizontal: 'left', vertical: 'middle' };
    lblCell.border = thinBorder;

    worksheet.mergeCells(`B${rowNum}:F${rowNum}`);
    const valCell = worksheet.getCell(`B${rowNum}`);
    valCell.value = item.val;
    valCell.font = { name: 'Calibri', size: 9 };
    valCell.alignment = { horizontal: 'center', vertical: 'middle' };
    valCell.border = thinBorder;
  });

  // 4. Shipment Grid (Rows 12-15)
  const getValidString = (...candidates: any[]) => {
    for (const c of candidates) {
      if (c && typeof c === 'string') {
        const trimmed = c.trim();
        if (trimmed !== '' && trimmed !== '—' && trimmed !== '-' && trimmed !== 'undefined' && trimmed !== 'null') {
          return trimmed;
        }
      }
    }
    return '—';
  };

  const incoterms = getValidString(
    invoiceData?.incoterm,
    invoiceData?.incoterms,
    invoiceData?.customer_detail?.incoterms,
    invoiceData?.customer_detail?.incoterm,
    orderData?.incoterm,
    orderData?.incoterms,
    customerData?.incoterm,
    customerData?.incoterms,
    'DAP'
  );

  const paymentTerms = getValidString(
    invoiceData?.payment_terms,
    invoiceData?.paymentTerms,
    invoiceData?.customer_detail?.payment_terms,
    invoiceData?.customer_detail?.paymentTerms,
    orderData?.paymentTerms,
    orderData?.payment_terms,
    customerData?.payment_term_name,
    customerData?.paymentTerms,
    customerData?.payment_terms,
    customerData?.paymentTerm
  );
  const origin = invoiceData?.country_of_origin || 'Morocco';
  const truck = invoiceData?.truck_number || packingList?.truckNumber || '—';
  
  const totalGross = invoiceData?.total_gross_weight ?? rows?.reduce((sum, r) => sum + (Number(r.grossWeight) || 0), 0) ?? 0;
  const totalBoxes = invoiceData?.total_number_of_boxes ?? rows?.reduce((sum, r) => sum + (Number(r.boxes || r.numberOfBoxes) || 0), 0) ?? 0;
  const poNum = invoiceData?.po_order_number || invoiceData?.poNumber || orderData?.poNumber || packingList?.poNumber || '—';
  const lotNum = packingList?.lotNumber || invoiceData?.lotNumber || '—';

  const gridRows = [
    { l1: 'Incoterms:', v1: incoterms, l2: 'Gross weight in KG:', v2: `${totalGross}(KG)` },
    { l1: 'Payment terms:', v1: paymentTerms, l2: 'N of 4 KG carton:', v2: totalBoxes || '—' },
    { l1: 'Country of Origin:', v1: origin, l2: 'LOT Number', v2: lotNum },
    { l1: 'Truck N°:', v1: truck, l2: 'PO Number', v2: poNum },
  ];

  gridRows.forEach((item, idx) => {
    const rowNum = 12 + idx;
    worksheet.getRow(rowNum).height = 18;

    // Col A
    const cellA = worksheet.getCell(`A${rowNum}`);
    cellA.value = item.l1;
    cellA.font = { name: 'Calibri', size: 9, bold: true };
    cellA.border = thinBorder;

    // Col B-C
    worksheet.mergeCells(`B${rowNum}:C${rowNum}`);
    const cellB = worksheet.getCell(`B${rowNum}`);
    cellB.value = item.v1;
    cellB.font = { name: 'Calibri', size: 9 };
    cellB.border = thinBorder;

    // Col D
    const cellD = worksheet.getCell(`D${rowNum}`);
    cellD.value = item.l2;
    cellD.font = { name: 'Calibri', size: 9, bold: true };
    cellD.border = thinBorder;

    // Col E-F
    worksheet.mergeCells(`E${rowNum}:F${rowNum}`);
    const cellE = worksheet.getCell(`E${rowNum}`);
    cellE.value = item.v2;
    cellE.font = { name: 'Calibri', size: 9 };
    cellE.alignment = { horizontal: 'center' };
    cellE.border = thinBorder;
  });

  // 5. Items Table (Starting Row 16)
  let currentRow = 16;
  worksheet.getRow(currentRow).height = 22;

  const headers = ['Item code', 'Product Description', 'Unit price (EUR)', 'Quantity (kg)', 'Amount in EUR'];
  const colRefs = ['A', 'B', 'D', 'E', 'F'];

  worksheet.mergeCells(`B${currentRow}:C${currentRow}`);

  colRefs.forEach((col, i) => {
    const cell = worksheet.getCell(`${col}${currentRow}`);
    cell.value = headers[i];
    cell.fill = beigeFillStyle;
    cell.font = { name: 'Calibri', size: 10, bold: true };
    cell.alignment = { horizontal: i === 1 ? 'left' : 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });

  currentRow++;

  let totalAmount = 0;
  let totalNet = 0;

  let itemDataRows: any[] = [];
  if (invoiceData && invoiceData.items) {
    invoiceData.items.forEach((item: any) => {
      const unitPrice = Number(item.price || 0);
      const qty = Number(item.quantity || 0);
      totalNet += qty;
      const amt = unitPrice * qty;
      totalAmount += amt;

      const desc = item.description || item.product || item.product_id || '—';
      const itemCode = item.item_code || item.itemCode || item.code || 'A2';
      itemDataRows.push({ code: itemCode, desc, price: unitPrice, qty, amt });
    });
  } else {
    const groupedMap: Record<string, any> = {};
    (rows || []).forEach(r => {
      const prod = r.product || '—';
      const cal = r.caliber || '—';
      const key = `${prod} | ${cal}`;
      const qty = Number(r.netWeight || r.quantity || 0);
      const unitPrice = Number(r.unitPrice || orderData?.price || 3.5);

      if (groupedMap[key]) {
        groupedMap[key].netWeight += qty;
      } else {
        groupedMap[key] = {
          itemCode: r.itemCode || r.item_code || 'A2',
          product: prod,
          caliber: cal,
          netWeight: qty,
          unitPrice: unitPrice
        };
      }
    });

    Object.values(groupedMap).forEach((r: any) => {
      const unitPrice = r.unitPrice;
      const qty = r.netWeight;
      totalNet += qty;
      const amt = unitPrice * qty;
      totalAmount += amt;

      const desc = `${r.product}${r.caliber && r.caliber !== '—' ? ` - ${r.caliber}` : ''}`;
      itemDataRows.push({ code: r.itemCode || 'A2', desc, price: unitPrice, qty, amt });
    });
  }

  itemDataRows.forEach(item => {
    worksheet.getRow(currentRow).height = 18;

    worksheet.getCell(`A${currentRow}`).value = item.code;
    worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells(`B${currentRow}:C${currentRow}`);
    worksheet.getCell(`B${currentRow}`).value = item.desc;
    worksheet.getCell(`B${currentRow}`).alignment = { horizontal: 'left', vertical: 'middle' };

    worksheet.getCell(`D${currentRow}`).value = item.price;
    worksheet.getCell(`D${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getCell(`E${currentRow}`).value = item.qty;
    worksheet.getCell(`E${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getCell(`F${currentRow}`).value = item.amt;
    worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right', vertical: 'middle' };

    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(c => {
      worksheet.getCell(`${c}${currentRow}`).border = thinBorder;
      worksheet.getCell(`${c}${currentRow}`).font = { name: 'Calibri', size: 9 };
    });

    currentRow++;
  });

  // Totals Rows
  const taxAmount = Number(invoiceData?.tax || 0);
  const discountAmount = Number(invoiceData?.discount || 0);
  const finalAmount = invoiceData?.final_amount != null ? Number(invoiceData.final_amount) : (totalAmount + taxAmount - discountAmount);

  // Subtotal Row
  worksheet.getRow(currentRow).height = 20;
  worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
  const totLbl = worksheet.getCell(`A${currentRow}`);
  totLbl.value = 'Total Amount';
  totLbl.font = { name: 'Calibri', size: 10, bold: true };
  totLbl.alignment = { horizontal: 'right', vertical: 'middle' };
  totLbl.fill = beigeFillStyle;
  totLbl.border = thinBorder;

  const totQtyCell = worksheet.getCell(`E${currentRow}`);
  totQtyCell.value = totalNet;
  totQtyCell.font = { name: 'Calibri', size: 10, bold: true };
  totQtyCell.alignment = { horizontal: 'center', vertical: 'middle' };
  totQtyCell.fill = beigeFillStyle;
  totQtyCell.border = thinBorder;

  const totAmtCell = worksheet.getCell(`F${currentRow}`);
  totAmtCell.value = `${totalAmount}€`;
  totAmtCell.font = { name: 'Calibri', size: 10, bold: true };
  totAmtCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totAmtCell.fill = beigeFillStyle;
  totAmtCell.border = thinBorder;

  currentRow++;

  // TAX Row
  worksheet.getRow(currentRow).height = 18;
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const taxLbl = worksheet.getCell(`A${currentRow}`);
  taxLbl.value = 'TAX';
  taxLbl.font = { name: 'Calibri', size: 9, bold: true };
  taxLbl.alignment = { horizontal: 'right', vertical: 'middle' };
  taxLbl.fill = beigeFillStyle;
  taxLbl.border = thinBorder;

  const taxVal = worksheet.getCell(`F${currentRow}`);
  taxVal.value = taxAmount > 0 ? `${taxAmount}€` : '';
  taxVal.font = { name: 'Calibri', size: 9, bold: true };
  taxVal.fill = beigeFillStyle;
  taxVal.border = thinBorder;

  currentRow++;

  // Discount Row
  worksheet.getRow(currentRow).height = 18;
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const discLbl = worksheet.getCell(`A${currentRow}`);
  discLbl.value = 'Discount';
  discLbl.font = { name: 'Calibri', size: 9, bold: true };
  discLbl.alignment = { horizontal: 'right', vertical: 'middle' };
  discLbl.fill = beigeFillStyle;
  discLbl.border = thinBorder;

  const discVal = worksheet.getCell(`F${currentRow}`);
  discVal.value = discountAmount > 0 ? `${discountAmount}€` : '';
  discVal.font = { name: 'Calibri', size: 9, bold: true };
  discVal.fill = beigeFillStyle;
  discVal.border = thinBorder;

  currentRow++;

  // Final Amount Row
  worksheet.getRow(currentRow).height = 20;
  worksheet.mergeCells(`A${currentRow}:E${currentRow}`);
  const finalLbl = worksheet.getCell(`A${currentRow}`);
  finalLbl.value = 'Final Amount';
  finalLbl.font = { name: 'Calibri', size: 10, bold: true };
  finalLbl.alignment = { horizontal: 'right', vertical: 'middle' };
  finalLbl.fill = beigeFillStyle;
  finalLbl.border = thinBorder;

  const finalVal = worksheet.getCell(`F${currentRow}`);
  finalVal.value = `${finalAmount.toFixed(2)}€`;
  finalVal.font = { name: 'Calibri', size: 10, bold: true };
  finalVal.alignment = { horizontal: 'right', vertical: 'middle' };
  finalVal.fill = beigeFillStyle;
  finalVal.border = thinBorder;

  currentRow += 2;

  // 6. Footer Section
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = 'Certified COC 4063651455366';
  worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 9, bold: true };

  currentRow++;
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = `GLOBALG.A.P. certified product with GGN : ${invoiceData?.ggn || mainFarmGgn || '4063061946720'}`;
  worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 8 };

  currentRow++;
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = 'L\'exportateur des produits couverts par le présent document';
  worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 8 };

  currentRow++;
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = '[autorisation douanière n° MA5848/21déclare que, sauf indication claire du contraire, ces produits ont l\'origine préférentielle MAROC (2).';
  worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 8 };

  currentRow++;
  worksheet.mergeCells(`A${currentRow}:C${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = `Lieu et date LARACHE, Le ${invoiceDate}`;
  worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 8, bold: true };

  // Stamp image
  const stampBuffer = await fetchImageBuffer('/cache.png');
  if (stampBuffer) {
    try {
      const stampId = workbook.addImage({ buffer: stampBuffer, extension: 'png' });
      worksheet.addImage(stampId, {
        tl: { col: 3, row: currentRow - 4 },
        ext: { width: 120, height: 70 },
        editAs: 'oneCell'
      });
    } catch {
      // ignore
    }
  }

  currentRow += 2;
  worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = 'EXPORT OPTIMUM SARL, Capital Social 100.000DH, DOUAR MOUARAA TEYARA LAAOUAMRA KSAR EL KEBIR';
  worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 9, bold: true };

  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = 'RC: 52747 IF: 37614300';
  worksheet.getCell(`C${currentRow}`).value = 'patente: 20102348';
  worksheet.getCell(`E${currentRow}`).value = 'ICE: 002306448000001';
  ['A', 'C', 'E'].forEach(c => {
    worksheet.getCell(`${c}${currentRow}`).font = { name: 'Calibri', size: 8 };
  });

  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = 'Bank Account:';
  worksheet.getCell(`A${currentRow}`).font = { name: 'Calibri', size: 8, bold: true };

  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = 'BMCE';
  worksheet.getCell(`C${currentRow}`).value = 'MA64 0117 3500 0003 2100 0176 9346';
  worksheet.getCell(`E${currentRow}`).value = 'SWIFT: BMCEMAMC';
  ['A', 'C', 'E'].forEach(c => {
    worksheet.getCell(`${c}${currentRow}`).font = { name: 'Calibri', size: 8 };
  });

  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = 'BMCE (compte en devises)';
  worksheet.getCell(`C${currentRow}`).value = 'MA64 0117 3500 0503 6650 0027 2518';
  worksheet.getCell(`E${currentRow}`).value = 'SWIFT: BMCEMAMC';
  ['A', 'C', 'E'].forEach(c => {
    worksheet.getCell(`${c}${currentRow}`).font = { name: 'Calibri', size: 8 };
  });

  currentRow++;
  worksheet.getCell(`A${currentRow}`).value = 'Caixabank';
  worksheet.getCell(`C${currentRow}`).value = 'MA64 003 010 0100000000192189 60';
  worksheet.getCell(`E${currentRow}`).value = 'SWIFT: CAIXMAMCXX';
  ['A', 'C', 'E'].forEach(c => {
    worksheet.getCell(`${c}${currentRow}`).font = { name: 'Calibri', size: 8 };
  });

  // Write file to browser
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Invoice-${invoiceNumber}.xlsx`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}
