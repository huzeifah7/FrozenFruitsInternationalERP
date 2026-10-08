import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { getBase64ImageFromUrl } from './utils';

export const generateTransportSituationPDF = async ({
  driverName,
  plateNumber,
  startDate,
  endDate,
  station,
  totalTransportCost,
  totalPayment,
  openAmount,
  soldeRows,
  paymentRows
}: {
  driverName: string;
  plateNumber: string;
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
  doc.text('Driver Situation', pageWidth / 2, 25, { align: 'center' });

  // Info Details
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Du: ${startDate || '—'}`, pageWidth - 15, 20, { align: 'right' });
  doc.text(`Au: ${endDate || '—'}`, pageWidth - 15, 26, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Station: ${station}`, 15, 40);
  doc.text(`Driver Name: ${driverName}`, 15, 46);
  doc.text(`Plate Number: ${plateNumber}`, 15, 52);

  let currentY = 60;

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
    row.driverName,
    row.plateNumber,
    `${formatCurrency(row.transportCost)} DH`,
    row.origin,
    row.supplierName
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Lot Number', 'Driver Name', 'Plate Number', 'Transport Cost', 'Origin', 'Supplier Name']],
    body: soldeTableBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
    columnStyles: {
      4: { halign: 'right' }
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
    driverName,
    plateNumber,
    `${formatCurrency(row.amount)} DH`,
    row.note
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Operation', 'Driver Name', 'Plate Number', 'Operation Amount', 'Note']],
    body: paymentTableBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [241, 245, 249], textColor: [71, 85, 105], fontStyle: 'bold' },
    columnStyles: {
      4: { halign: 'right' }
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
  doc.save(`Driver_Situation_${driverName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
