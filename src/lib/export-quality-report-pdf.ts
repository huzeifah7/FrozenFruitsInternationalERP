import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  return new Promise(async (resolve) => {
    if (url.startsWith('data:')) {
      return resolve(url);
    }

    const fallbackLoad = () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    };

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return fallbackLoad();
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          } else {
            resolve(null);
          }
        } catch (e) {
          resolve(null);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        fallbackLoad();
      };
      img.src = objectUrl;
    } catch (e) {
      fallbackLoad();
    }
  });
}

export function getPalletImages(pallet: any): string[] {
  const imagesField = pallet.images || pallet.imageUrls || pallet.photos || pallet.files || pallet.attachments || [];
  if (!Array.isArray(imagesField)) return [];
  
  return imagesField.map((img: any) => {
    if (typeof img === 'string') return img;
    if (img && typeof img === 'object') {
      return img.url || img.downloadURL || img.fileUrl || img.src || img.previewUrl || '';
    }
    return '';
  }).filter((url: string) => url !== '');
}

export function getPalletBarcode(pallet: any): string {
  return (
    pallet.palletBarcodeNumber ||
    pallet.barcodeNumber ||
    pallet.palletBarcode ||
    pallet.productionOutputBarcode ||
    pallet.productionOutputNumber ||
    pallet.productionOutput?.barcodeNumber ||
    '—'
  );
}

export async function generateQualityReportPDF(report: any): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  
  const logoDataUrl = await loadLogoAsDataUrl();

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1: OUTBOUND QUALITY REPORT (Cover Page - matching Image 2)
  // ═══════════════════════════════════════════════════════════════════════════
  let currentY = 15;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 14, currentY, 38, 18, '', 'FAST');
    } catch (e) {}
  }

  // Header Title on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(100, 100, 100);
  doc.text('OUTBOUND QUALITY REPORT', 65, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text('Export Optimum', 65, currentY + 14);

  currentY += 45;

  // Green Section Heading: Details:
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(127, 160, 40); // Green color #7fa028
  doc.text('Details:', 14, currentY);

  currentY += 6;

  // 4-Column Details Table
  const detailsRows = [
    ['Sender', report.sender || 'Export Optimum SARL', 'Customer', report.customerName || '—'],
    ['Ref', report.ref || '—', 'PO', report.poNumber || '—'],
    ['Product', report.product || '—', 'Transport', report.transport || '—'],
    ['Date', report.date || '—', 'Transport number', report.transportNumber || '—']
  ];

  autoTable(doc, {
    startY: currentY,
    body: detailsRows,
    theme: 'plain',
    styles: {
      fontSize: 10,
      textColor: [0, 0, 0],
      cellPadding: 4,
      lineColor: [180, 180, 180],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { fontStyle: 'normal', cellWidth: 35, textColor: [80, 80, 80] },
      1: { fontStyle: 'bold', cellWidth: 55, textColor: [0, 0, 0] },
      2: { fontStyle: 'normal', cellWidth: 35, textColor: [80, 80, 80] },
      3: { fontStyle: 'bold', cellWidth: 57, textColor: [0, 0, 0] }
    },
    margin: { left: 14, right: 14 },
    showHead: 'never',
    didDrawPage: (data) => {
      // Draw top and bottom border lines for details block
      const finalY = data.cursor?.y || currentY + 40;
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.3);
      doc.line(14, currentY, pageW - 14, currentY);
      doc.line(14, finalY, pageW - 14, finalY);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGES 2 ONWARD: PALLETS (matching Images 3 & 4)
  // ═══════════════════════════════════════════════════════════════════════════
  const pallets = report.pallets || [];
  
  for (let i = 0; i < pallets.length; i++) {
    const pallet = pallets[i];
    doc.addPage();
    let py = 15;

    // Top Header: "Quality Control Report" on Left
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor(150, 150, 150);
    doc.text('Quality Control Report', 14, py);

    // Top Right Logo
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', pageW - 52, py - 4, 38, 18, '', 'FAST');
      } catch (e) {}
    }

    py += 10;

    // PO Header metadata row
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'bold');
    doc.text('PO', 14, py);
    doc.text('Ref', 55, py);
    doc.text('Customer', 95, py);
    doc.text('Loading date', 135, py);

    py += 4;

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(report.poNumber || '—', 14, py);
    doc.text(report.ref || '—', 55, py);
    doc.text(report.customerName || '—', 95, py);
    doc.text(report.date || '—', 135, py);

    py += 10;

    // Green Pallet Heading e.g. Pallet# 1
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(127, 160, 40); // Green color #7fa028
    doc.text(`Pallet# ${i + 1}`, 14, py);

    py += 5;

    // 4-Column Pallet Specs Table
    const specRows = [
      ['Product/Variety', pallet.productVariety || 'Hass', 'Temperature *', pallet.temperature ? `${pallet.temperature}°` : '—'],
      ['Size', pallet.size?.toString() || '—', 'Sample weight (g)', pallet.sampleWeight ? (pallet.sampleWeight.toString().toUpperCase().endsWith('G') ? pallet.sampleWeight : `${pallet.sampleWeight}G`) : '—'],
      ['Class', pallet.class?.toString() || '—', 'Box net weight (g)', pallet.boxNetWeight ? (pallet.boxNetWeight.toString().toUpperCase().endsWith('G') ? pallet.boxNetWeight : `${pallet.boxNetWeight}G`) : '—'],
      ['Packaging', pallet.packaging || '—', 'Lot number', pallet.lotNumber || '—'],
      ['Number of boxes', pallet.numberOfBoxes?.toString() || '—', 'Palletesation', pallet.palletisation || 'CONFORM'],
      ['Pallet barcode Number', getPalletBarcode(pallet), '', ''],
      ['Country of origin', pallet.countryOfOrigin || 'Morocco', 'Label conformity', pallet.labelConformity || 'CONFORM']
    ];

    autoTable(doc, {
      startY: py,
      body: specRows,
      theme: 'plain',
      styles: {
        fontSize: 8.5,
        cellPadding: 2.5,
        textColor: [0, 0, 0]
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 42, textColor: [130, 130, 130] },
        1: { fontStyle: 'bold', cellWidth: 49, textColor: [0, 0, 0] },
        2: { fontStyle: 'bold', cellWidth: 42, textColor: [130, 130, 130] },
        3: { fontStyle: 'bold', cellWidth: 49, textColor: [0, 0, 0] }
      },
      margin: { left: 14, right: 14 },
      showHead: 'never'
    });

    py = (doc as any).lastAutoTable.finalY + 8;

    // Green Pictures Heading
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(127, 160, 40); // Green color #7fa028
    doc.text('Pictures', 14, py);
    py += 4;

    // 5-Picture Grid (3 top, 2 bottom)
    const imgWidth = 58;
    const imgHeight = 44;
    const gapX = 4;
    const gapY = 4;

    const images = getPalletImages(pallet);
    
    // Fetch images up to 6
    const validImages = images.slice(0, 6);
    const b64Images = await Promise.all(
      validImages.map((imgUrl: string) => loadImageAsDataUrl(imgUrl))
    );

    for (let imgIdx = 0; imgIdx < validImages.length; imgIdx++) {
      const row = Math.floor(imgIdx / 3);
      const col = imgIdx % 3;
      const imgX = 14 + (col * (imgWidth + gapX));
      const imgY = py + (row * (imgHeight + gapY));

      if (b64Images[imgIdx]) {
        try {
          doc.addImage(b64Images[imgIdx]!, 'JPEG', imgX, imgY, imgWidth, imgHeight, '', 'FAST');
        } catch (e) {
          console.error('jsPDF addImage Error:', e);
        }
      }
    }
  }

  const fileName = `${report.poNumber || 'Report'} Quality Report ${report.customerName || ''} - ${report.transportNumber || ''}.pdf`.trim();
  doc.save(fileName);
}
