import ExcelJS from 'exceljs';

export const generatePackingListExcel = async (
  packingList: any,
  orderData: any,
  customerData: any,
  mainFarmGgn: string,
  rows: any[],
  totals: any
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Packing List');

  // Page setup for printing
  worksheet.pageSetup.margins = {
    left: 0.5, right: 0.5,
    top: 0.5, bottom: 0.5,
    header: 0.3, footer: 0.3
  };
  worksheet.pageSetup.fitToPage = true;
  worksheet.pageSetup.fitToWidth = 1;
  worksheet.pageSetup.fitToHeight = 0;

  // Set column widths (7 columns: A to G)
  worksheet.columns = [
    { width: 15 }, // A: Pallet Number
    { width: 20 }, // B: Lot Number
    { width: 32 }, // C: Product
    { width: 20 }, // D: GGN Number
    { width: 12 }, // E: Caliber
    { width: 12 }, // F: Boxes
    { width: 18 }, // G: Net Weight (KG)
  ];

  try {
    // Attempt to fetch and embed the logo from public folder
    const response = await fetch('/FFI_main.png');
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    
    const imageId = workbook.addImage({
      buffer: arrayBuffer,
      extension: 'png',
    });

    // Add image to top-left (A1:B3 area roughly)
    worksheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 120, height: 60 },
      editAs: 'oneCell'
    });
  } catch (error) {
    console.warn('Could not load logo for Excel export', error);
  }

  // Row heights for logo spacing
  worksheet.getRow(1).height = 20;
  worksheet.getRow(2).height = 20;
  worksheet.getRow(3).height = 20;

  // Company details under logo (Left Column)
  worksheet.mergeCells('A4:C4');
  worksheet.mergeCells('A5:C5');
  worksheet.mergeCells('A6:C6');

  worksheet.getCell('A4').value = 'Export Optimum Sarl';
  worksheet.getCell('A5').value = 'Douar Mouaraa Teyara Laouamra - Morocco';
  worksheet.getCell('A6').value = 'RC 52747';

  worksheet.getCell('A4').font = { name: 'Arial', size: 10, bold: true };
  worksheet.getCell('A5').font = { name: 'Arial', size: 9 };
  worksheet.getCell('A6').font = { name: 'Arial', size: 9 };

  // Centered Title
  worksheet.mergeCells('D4:E6');
  const titleCell = worksheet.getCell('D4');
  titleCell.value = 'Packing list';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF2E1D52' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  // Top Right: Expedition date
  worksheet.mergeCells('F4:G5');
  const dateCell = worksheet.getCell('F4');
  dateCell.value = `Expedition date:\n${packingList.expeditionDate || '—'}`;
  dateCell.font = { name: 'Arial', size: 10, bold: true };
  dateCell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true };

  // Spacer
  worksheet.getRow(7).height = 15;

  let currentRow = 8;

  // Function to create a section key-value pair spanning A:B (label) and C:G (value)
  const createSectionRow = (label: string, value: string, rowIdx: number) => {
    worksheet.mergeCells(`A${rowIdx}:B${rowIdx}`);
    worksheet.mergeCells(`C${rowIdx}:G${rowIdx}`);
    const labelCell = worksheet.getCell(`A${rowIdx}`);
    const valueCell = worksheet.getCell(`C${rowIdx}`);
    
    labelCell.value = label;
    labelCell.font = { name: 'Arial', size: 10, bold: true };
    labelCell.alignment = { vertical: 'middle', horizontal: 'left' };
    
    valueCell.value = value;
    valueCell.font = { name: 'Arial', size: 10 };
    valueCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Apply borders and styling to all cells in the range for the merge to look perfect
    for (let c = 1; c <= 7; c++) {
      const colLetter = String.fromCharCode(64 + c);
      const cell = worksheet.getCell(`${colLetter}${rowIdx}`);
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      if (c <= 2) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
      }
    }
    worksheet.getRow(rowIdx).height = 20;
  };

  // Populate data fields
  // Customer info must come directly from the selected Order
  const customerName = orderData?.Customer || orderData?.customer || orderData?.customerName || packingList.customer || '—';
  
  const formatOrderAddr = (order: any, type: 'Customer' | 'Delivery') => {
    if (!order) return '';
    const val = type === 'Customer' ? (order.CustomerAddress || order.customerAddress) : (order.DeliveryAddress || order.deliveryAddress);
    if (val) return val;
    if (order.shippingAddress) {
      const sa = order.shippingAddress;
      return `${sa.street || sa.address || ''}, ${sa.city || ''} ${sa.zipCode || ''}, ${sa.country || ''}`.replace(/^[,\s]+|[,\s]+$/g, '').replace(/, ,/g, ',');
    }
    return '';
  };

  const customerAddress = formatOrderAddr(orderData, 'Customer') || packingList.customerAddress || '—';
  const deliveryAddress = formatOrderAddr(orderData, 'Delivery') || packingList.deliveryAddress || '—';
  
  const transporter = packingList.transportCompany || '—';
  const truckNumber = packingList.truckNumber || '—';
  const poNumber = orderData?.poNumber || packingList.poNumber || packingList.orderNumber || '—';
  const totalNetVal = packingList.totalNetWeight || totals.totalNetWeight || 0;
  const totalBrutVal = packingList.totalGrossWeight || totals.totalGrossWeight || 0;

  createSectionRow('Customer', customerName, currentRow++);
  createSectionRow('Address', customerAddress, currentRow++);
  createSectionRow('Delivery Address', deliveryAddress, currentRow++);
  createSectionRow('Transporter', transporter, currentRow++);
  createSectionRow('Truck Number', truckNumber, currentRow++);
  createSectionRow('PO Number', poNumber, currentRow++);
  createSectionRow('COC', '4063651455366', currentRow++);
  createSectionRow('Total Net Weight', `${totalNetVal} KG`, currentRow++);
  createSectionRow('Total Brut Weight', `${totalBrutVal} KG`, currentRow++);

  // Spacer
  worksheet.getRow(currentRow).height = 15;
  currentRow++;

  // DETAIL TABLE HEADER
  const headers = ['Pallet Number', 'Lot Number', 'Product', 'GGN Number', 'Caliber', 'Boxes', 'Net Weight (KG)'];
  const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  
  headers.forEach((header, index) => {
    const cell = worksheet.getCell(`${cols[index]}${currentRow}`);
    cell.value = header;
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E6C8' } }; // Light Beige
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  worksheet.getRow(currentRow).height = 25;
  currentRow++;

  // DETAIL TABLE ROWS
  rows.forEach((row) => {
    const rowValues = [
      row.palletNumber,
      row.lotNumber,
      row.product,
      row.ggnNumber,
      row.caliber,
      row.boxes,
      row.netWeight
    ];
    
    rowValues.forEach((val, index) => {
      const cell = worksheet.getCell(`${cols[index]}${currentRow}`);
      cell.value = val;
      cell.font = { name: 'Arial', size: 9 };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: index === 2 ? 'left' : (index >= 5 ? 'right' : 'center')
      };
    });
    worksheet.getRow(currentRow).height = 20;
    currentRow++;
  });

  // Footer Spacing
  worksheet.getRow(currentRow).height = 15;
  currentRow++;

  // FOOTER LINES
  worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
  const footerCell1 = worksheet.getCell(`A${currentRow}`);
  footerCell1.value = 'Certified COC 4063651455366';
  footerCell1.font = { name: 'Arial', size: 10, bold: true, italic: true };
  footerCell1.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(currentRow).height = 20;
  currentRow++;

  worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
  const footerCell2 = worksheet.getCell(`A${currentRow}`);
  footerCell2.value = `GLOBALG.A.P. certified product with GGN : ${mainFarmGgn}`;
  footerCell2.font = { name: 'Arial', size: 10, bold: true, italic: true };
  footerCell2.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(currentRow).height = 20;

  // Trigger Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `PackingList_${poNumber || 'Export'}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
