import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

async function loadImageAsDataUrl(path: string): Promise<string | null> {
  try {
    const response = await fetch(path);
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

export async function generateDecaySalePDF(
  record: any,
  invoiceNumber: string
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  let currentY = 15;

  const headerFill: [number, number, number] = [122, 152, 0]; // #7a9800

  // --- 1. HEADER (Logo & Company Info) ---
  const logoDataUrl = await loadImageAsDataUrl('/FFI_main.png');
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 14, currentY, 34, 16, '', 'FAST');
    } catch (e) {
      // ignore
    }
  }

  // Company details next to logo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(118, 147, 60);
  doc.text('EXPORT OPTIMUM', 50, currentY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('DOUAR MOUARAA TEYARA', 50, currentY + 10);
  doc.text('LAAOUAMRA KSAR EL KEBIR', 50, currentY + 16);

  // Invoice Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(122, 152, 0); // Green
  doc.text('Facture vente dechet', pageW - 14, currentY + 6, { align: 'right' });
  doc.setTextColor(0, 0, 0); // Reset

  // Invoice No and Date Table
  autoTable(doc, {
    startY: currentY + 12,
    margin: { left: pageW / 2 + 10, right: 14 },
    head: [['N° Facture', 'DATE']],
    body: [[invoiceNumber, record.date || '—']],
    theme: 'grid',
    headStyles: { fillColor: headerFill, textColor: [0,0,0], fontStyle: 'bold', halign: 'center', lineColor: [0,0,0], lineWidth: 0.3 },
    bodyStyles: { halign: 'center', textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.3 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // --- 2. BILL TO (Customer Info) ---
  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    body: [
      ['Client', record.customerName || '—']
    ],
    theme: 'grid',
    columnStyles: { 
      0: { cellWidth: 50, fillColor: headerFill, fontStyle: 'bold', textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.3, halign: 'left' },
      1: { halign: 'left', textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.3 }
    },
    styles: { fontSize: 10, cellPadding: 3 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // --- 3. ITEMS TABLE ---
  let totalAmount = 0;
  
  const itemRows: any[] = (record.items || []).map((item: any, index: number) => {
    const qty = Number(item.netWeight || 0);
    const price = Number(item.price || 0);
    const amount = qty * price;
    totalAmount += amount;

    return [
      `A${index + 1}`,
      item.productName || '—',
      price.toFixed(3),
      qty.toString(),
      amount.toFixed(3)
    ];
  });

  // Fill up to minimum 5 rows for better visual
  while (itemRows.length < 5) {
    itemRows.push(['', '', '', '', '']);
  }

  // Totals Row
  itemRows.push([
    { content: 'Montant', colSpan: 4, styles: { halign: 'left', fontStyle: 'bold', fillColor: headerFill, textColor: [0,0,0] } },
    { content: totalAmount.toFixed(3), styles: { halign: 'right', fontStyle: 'bold', fillColor: headerFill, textColor: [0,0,0] } }
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Item code', 'Produit', 'Prix dh/kg', 'Quantite (kg)', 'Montant']],
    body: itemRows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [255,255,255], textColor: [0,0,0], fontStyle: 'bold', lineColor: [0,0,0], lineWidth: 0.3, halign: 'center' },
    bodyStyles: { textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.3, halign: 'center', minCellHeight: 8 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { halign: 'center' },
      2: { cellWidth: 30 },
      3: { cellWidth: 30 },
      4: { cellWidth: 30 }
    },
    margin: { left: 14, right: 14 }
  });

  // Save
  const safeCustomer = (record.customerName || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Facture_Dechet_${invoiceNumber}_${safeCustomer}.pdf`;
  doc.save(filename);
}
