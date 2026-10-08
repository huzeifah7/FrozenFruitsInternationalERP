import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { getBase64ImageFromUrl } from './utils';

export const generateCabraneSituationPDF = async ({
  cabraneName,
  startDate,
  endDate,
  station,
  totalTransportCost,
  totalPayment,
  openAmount,
  soldeRows,
  paymentRows
}: {
  cabraneName: string;
  startDate: string;
  endDate: string;
  station: string;
  totalTransportCost: number;
  totalPayment: number;
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

  const primaryColor = [46, 29, 82]; // #2e1d52
  const accentColor = [122, 152, 0]; // #7a9800

  // Header Section
  if (logoData) {
    doc.addImage(logoData, 'PNG', 15, 15, 34, 16);
  }
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Cabrane Situation', pageWidth / 2, 25, { align: 'center' });

  // Info Details
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Du: ${startDate || '—'}`, pageWidth - 15, 20, { align: 'right' });
  doc.text(`Au: ${endDate || '—'}`, pageWidth - 15, 26, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Station: ${station}`, 15, 40);
  doc.text(`Cabrane Name: ${cabraneName}`, 15, 46);

  let currentY = 55;

  // --- SOLDE SECTION ---
  doc.setFillColor(255, 252, 230); // Light yellow
  doc.rect(15, currentY, pageWidth - 30, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Solde: ${formatCurrency(totalTransportCost)}DH`, 17, currentY + 7);
  
  currentY += 12;

  const soldeTableBody = soldeRows.map(row => [
    row.date,
    row.lotNumber,
    row.cabraneName,
    `${formatCurrency(row.workerCost)} DH`,
    row.origin,
    row.supplierName
  ]);

  (doc as any).autoTable({
    startY: currentY,
    head: [['Date', 'Lot Number', 'Cabrane name', 'Worker Cost', 'Origin', 'Supplier Name']],
    body: soldeTableBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
    columnStyles: {
      3: { halign: 'right' }
    },
    didDrawPage: (data: any) => {
      currentY = data.cursor.y;
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // --- PAYMENTS SECTION ---
  // Check if we need a new page for the header
  if (currentY > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFillColor(255, 252, 230);
  doc.rect(15, currentY, pageWidth - 30, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Avances et Paiements: ${formatCurrency(totalPayment)}DH`, 17, currentY + 7);

  currentY += 12;

  const paymentTableBody = paymentRows.map(row => [
    row.date,
    row.paymentType,
    cabraneName,
    `${formatCurrency(row.amount)} DH`,
    row.note
  ]);

  (doc as any).autoTable({
    startY: currentY,
    head: [['Date', 'Operation', 'Cabrane Name', 'Operation Amount', 'Note']],
    body: paymentTableBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
    columnStyles: {
      3: { halign: 'right' }
    },
    didDrawPage: (data: any) => {
      currentY = data.cursor.y;
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  if (currentY > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    currentY = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(`Situation: ${formatCurrency(openAmount)}DH`, pageWidth - 15, currentY, { align: 'right' });

  // Save the PDF
  doc.save(`Cabrane_Situation_${cabraneName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
