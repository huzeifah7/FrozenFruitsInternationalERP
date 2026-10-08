import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBase64ImageFromUrl } from './utils';

export const generateDecayCustomerSituationPDF = async ({
  customerName,
  startDate,
  endDate,
  station,
  totalSales,
  totalPayments,
  openAmount,
  soldeRows,
  paymentRows
}: {
  customerName: string;
  startDate: string;
  endDate: string;
  station: string;
  totalSales: number;
  totalPayments: number;
  openAmount: number;
  soldeRows: any[];
  paymentRows: any[];
}) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Base64 Logo
  let logoData = '';
  try {
    logoData = await getBase64ImageFromUrl('/FFI_main.png');
  } catch (err) {
    console.warn('Could not load logo for PDF', err);
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const primaryColor = [0, 0, 0]; // Black as requested
  const headerGreen = [122, 152, 0]; // #7a9800

  // Header Section
  if (logoData) {
    doc.addImage(logoData, 'PNG', 15, 15, 34, 16);
  }
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('SITUATION CLIENT', pageWidth / 2, 25, { align: 'center' });

  // Info Details
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`De: ${startDate || '—'}`, pageWidth - 15, 20, { align: 'right' });
  doc.text(`Au: ${endDate || '—'}`, pageWidth - 15, 26, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Station: ${station}`, 15, 40);
  doc.text(`Client: ${customerName}`, 15, 46);

  let currentY = 55;

  // --- SOLDE SECTION ---
  doc.setFillColor(242, 247, 230); // Light faded green
  doc.rect(15, currentY, pageWidth - 30, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Solde: ${formatCurrency(totalSales)}dh`, pageWidth / 2, currentY + 7, { align: 'center' });
  
  currentY += 12;

  const soldeTableBody = soldeRows.map(row => [
    row.invoiceNumber,
    row.date,
    row.customerName,
    row.totalQuantity,
    row.price,
    `${formatCurrency(row.totalAmount)}dh`,
    row.paymentStatus || 'PENDING',
    row.paymentMethod || ''
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Numéro de Facture', 'Heure et Date', 'Client', 'Quantité', 'Prix', 'Montant Totale', 'Statut de paiement', 'Mode de paiement']],
    body: soldeTableBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.1 },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' }
    },
    didDrawPage: (data: any) => {
      currentY = data.cursor.y;
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // --- PAYMENTS SECTION ---
  if (currentY > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(242, 247, 230);
  doc.rect(15, currentY, pageWidth - 30, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Total des Paiements: ${formatCurrency(totalPayments)}dh`, pageWidth / 2, currentY + 7, { align: 'center' });

  currentY += 12;

  const paymentTableBody = paymentRows.map(row => [
    row.date,
    row.customerName,
    `${formatCurrency(row.amount)}dh`,
    row.paymentMethod,
    row.note || ''
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Heure et Date', 'Client', 'Montant Totale', 'Mode de paiement', 'Note']],
    body: paymentTableBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.1 },
    columnStyles: {
      2: { halign: 'right' }
    },
    didDrawPage: (data: any) => {
      currentY = data.cursor.y;
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  if (currentY > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(242, 247, 230); // Light faded green
  doc.setDrawColor(0, 0, 0); // Black border
  doc.setLineWidth(0.1);
  doc.rect(15, currentY, pageWidth - 30, 10, 'FD'); // Fill and border
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  let situationText = openAmount < 0 ? `Situation: ${openAmount.toFixed(2)}dh` : `Situation: ${formatCurrency(openAmount)}dh`;
  doc.text(situationText, pageWidth / 2, currentY + 7, { align: 'center' });

  // Save the PDF
  let fileNameDateStart = startDate || 'All';
  let fileNameDateEnd = endDate || 'All';
  doc.save(`Customer Situation - ${customerName} - ${fileNameDateStart} - ${fileNameDateEnd}.pdf`);
};
