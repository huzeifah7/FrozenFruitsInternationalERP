import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to load logo
async function loadLogoAsDataUrl(): Promise<string | null> {
  try {
    const response = await fetch('/FFI_main.png');
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateProductionOutputPDF(data: any): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageW = 210;
  let currentY = 12;

  // --- 1. HEADER ---
  const logoDataUrl = await loadLogoAsDataUrl();
  const logoHeight = 28;
  if (logoDataUrl) {
    try {
      const imgProps = doc.getImageProperties(logoDataUrl);
      const ratio = imgProps.width / imgProps.height;
      const logoWidth = logoHeight * ratio;
      doc.addImage(logoDataUrl, 'PNG', 14, currentY, logoWidth, logoHeight, '', 'FAST');
    } catch (e) {
      // Fallback with intrinsic aspect ratio
      doc.addImage(logoDataUrl, 'PNG', 14, currentY, 30.5, 28, '', 'FAST');
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('PRODUCTION OUTPUT', pageW / 2, currentY + 15, { align: 'center' });

  currentY += 34;

  // --- 2. DETAILS TABLE ---
  const infoRows = [
    ['Barcode', data.barcode || '—'],
    ['Date', data.dateTime ? data.dateTime.replace('T', ' ') : '—'],
    ['Shift', String(data.shift || '—')],
    ['Shift Date', data.shiftDate || '—'],
    ['Location', data.locationName || '—'],
    ['Palletisation Type', data.palletisationType || '—'],
    ['Order', data.orderPoNumber || '—'],
    ['Packaging Type', data.packagingTypeName || '—'],
    ['Remark', data.remark || '']
  ];

  autoTable(doc, {
    startY: currentY,
    body: infoRows,
    theme: 'plain',
    styles: {
      fontSize: 10,
      textColor: [0, 0, 0],
      cellPadding: 3
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { fontStyle: 'normal' }
    },
    margin: { left: 14, right: 14 },
    showHead: 'never',
    willDrawCell: function(data) {
      // Draw horizontal lines and outer border
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      
      // Top line for first row
      if (data.row.index === 0) {
        doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
      }
      
      // Bottom line for all rows
      doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      
      // Left outer border
      if (data.column.index === 0) {
        doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
      }
      
      // Right outer border
      if (data.column.index === 1) {
        doc.line(data.cell.x + data.cell.width, data.cell.y, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // --- 3. PRODUCTION'S ITEM ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text("Production's Item", 14, currentY);
  currentY += 5;

  const items = data.items || [];
  const itemRows = items.map((item: any) => [
    item.caliber || '—',
    [item.productName, item.category || item.variety, item.type].filter(Boolean).join(' - ') || item.productName || '—',
    item.lotNumber || '—',
    String(item.numberOfBoxes || 0),
    `${item.grossWeight || 0}KG`,
    `${item.netWeight || 0}KG`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Caliber', 'Product', 'Lot Number', 'Number Of Boxes', 'Gross Weight', 'Net Weight']],
    body: itemRows,
    theme: 'grid',
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.2
    },
    styles: {
      fontSize: 9,
      textColor: [0, 0, 0],
      cellPadding: 3,
      lineColor: [0, 0, 0],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 50 },
      2: { cellWidth: 35 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
      5: { cellWidth: 25 }
    },
    margin: { left: 14, right: 14 }
  });

  const fileName = `ProductionOutput-${data.barcode || 'Generated'}.pdf`;
  doc.save(fileName);
}
