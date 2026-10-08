import jsPDF from 'jspdf';
import { format } from 'date-fns';

export interface LotInfoData {
  lotNumber: string;
  dateTime: string;
  locationName: string;
  driverName: string;
  plateNumber: string;
  productFamily: string;
  supplierName: string;
  boxesIn: number;
  emptyBoxes: number;
  blNetWeight: number;
  blGrossWeight: number;
  totalNetWeight: number;
  weightDifference?: number;
  calibreDominant?: string;
  petitCalibre?: number;
  dechet?: number;
  status?: string;
  remarks?: string;
  pallets?: any[];
}

export async function generateLotInfoPDF(data: LotInfoData) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // -- 1. HEADER (Logo & Title) --
  try {
    const response = await fetch('/FFI_main.png');
    if (response.ok) {
      const blob = await response.blob();
      const logoDataUrl: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', 14, 10, 34, 16, '', 'FAST');
      }
    }
  } catch (e) {
    console.error("Failed to load logo", e);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text('Lot Info', pageWidth / 2, 20, { align: 'center' });

  // Divider Line
  doc.setLineWidth(0.5);
  doc.line(14, 32, pageWidth - 14, 32);

  // -- 2. GENERAL INFORMATION --
  doc.setFontSize(10);
  let currentY = 40;
  const lineSpacing = 8;
  const col1X = 14;
  const col1ValX = 65;
  const col2X = 110;
  const col2ValX = 155;

  const fmtDate = (d: string) => {
    try {
      if (!d) return '-';
      if (d.includes('T')) return d.replace('T', ' ');
      return format(new Date(d), 'yyyy-MM-dd HH:mm:ss');
    } catch {
      return d;
    }
  };

  const safeNum = (val: any) => Number(val) || 0;
  const formatKg = (val: any) => `${safeNum(val).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KG`;

  const weightDiff = data.weightDifference !== undefined ? safeNum(data.weightDifference) : (safeNum(data.totalNetWeight) - safeNum(data.blNetWeight));

  // Left Column
  doc.setFont('helvetica', 'bold');
  doc.text('Lot number:', col1X, currentY);
  doc.text('Date & Time:', col1X, currentY + lineSpacing);
  doc.text('Location:', col1X, currentY + lineSpacing * 2);
  doc.text('Driver Name:', col1X, currentY + lineSpacing * 3);
  doc.text('Plate Number:', col1X, currentY + lineSpacing * 4);
  doc.text('BL Net Weight:', col1X, currentY + lineSpacing * 5);
  doc.text('BL Gross Weight:', col1X, currentY + lineSpacing * 6);
  doc.text('Nombre de caisse:', col1X, currentY + lineSpacing * 7);

  doc.setFont('helvetica', 'normal');
  doc.text(data.lotNumber || '-', col1ValX, currentY);
  doc.text(fmtDate(data.dateTime), col1ValX, currentY + lineSpacing);
  doc.text(data.locationName || '-', col1ValX, currentY + lineSpacing * 2);
  doc.text(data.driverName || '-', col1ValX, currentY + lineSpacing * 3);
  doc.text(data.plateNumber || '-', col1ValX, currentY + lineSpacing * 4);
  doc.text(formatKg(data.blNetWeight), col1ValX, currentY + lineSpacing * 5);
  doc.text(formatKg(data.blGrossWeight), col1ValX, currentY + lineSpacing * 6);
  
  // Total boxes from all palletizations
  const totalBoxes = (data.pallets || []).reduce((sum, p) => sum + safeNum(p.boxes), 0);
  doc.text(totalBoxes.toString(), col1ValX, currentY + lineSpacing * 7);

  // Right Column
  doc.setFont('helvetica', 'bold');
  doc.text('Product Name:', col2X, currentY);
  doc.text('Supplier Name:', col2X, currentY + lineSpacing);
  doc.text('Caisses vides:', col2X, currentY + lineSpacing * 2);
  doc.text('Total Net Weight:', col2X, currentY + lineSpacing * 3);
  doc.text('Weight difference:', col2X, currentY + lineSpacing * 4);

  doc.setFont('helvetica', 'normal');
  doc.text(data.productFamily || 'Avocado', col2ValX, currentY);
  doc.text(data.supplierName || '-', col2ValX, currentY + lineSpacing);
  doc.text(data.emptyBoxes?.toString() || '0', col2ValX, currentY + lineSpacing * 2);
  doc.text(formatKg(data.totalNetWeight), col2ValX, currentY + lineSpacing * 3);
  doc.text(formatKg(weightDiff), col2ValX, currentY + lineSpacing * 4);

  currentY += lineSpacing * 8 + 10;
  doc.setLineWidth(0.5);
  doc.line(14, currentY - 5, pageWidth - 14, currentY - 5);

  // -- 3. QUALITY CHECK --
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Quality Check', 14, currentY);
  currentY += 8;

  doc.setFontSize(10);
  const qcCol1X = 14;
  const qcCol1ValX = 65;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Calibre dominant:', qcCol1X, currentY);
  doc.text('Petit calibre %:', qcCol1X, currentY + lineSpacing);
  doc.text('% Dechet:', qcCol1X, currentY + lineSpacing * 2);
  doc.text('Statut:', qcCol1X, currentY + lineSpacing * 3);
  doc.text('Remarque:', qcCol1X, currentY + lineSpacing * 4);

  doc.setFont('helvetica', 'normal');
  doc.text(data.calibreDominant ? String(data.calibreDominant) : '-', qcCol1ValX, currentY);
  doc.text(data.petitCalibre ? `${data.petitCalibre}%` : '-', qcCol1ValX, currentY + lineSpacing);
  doc.text(data.dechet ? `${data.dechet}%` : '-', qcCol1ValX, currentY + lineSpacing * 2);
  doc.text(data.status ? String(data.status) : '-', qcCol1ValX, currentY + lineSpacing * 3);
  
  // Wrap remarks text
  const remarksText = data.remarks ? doc.splitTextToSize(data.remarks, 120) : '-';
  doc.text(remarksText, qcCol1ValX, currentY + lineSpacing * 4);

  // -- SAVE AND DOWNLOAD --
  doc.save(`${data.lotNumber || 'lot_info'}_LotInfo.pdf`);
}
