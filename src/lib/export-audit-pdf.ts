import jsPDF from 'jspdf';
import { AuditRecord } from './export-audit-excel';

export async function exportAuditPDF(
  records: AuditRecord[],
  startDate: string,
  endDate: string,
  logoDataUrl: string | null = null
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Page Dimensions
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12.5;
  const contentWidth = pageWidth - (margin * 2);

  // Compute Aggregates
  let totalEmployees = records.length;
  let totalHours = 0;
  let totalGross = 0;
  let totalDeductions = 0;
  let totalAdvances = 0;
  let totalNet = 0;

  records.forEach(rec => {
    totalHours += rec.payslip.hours.normalHours + (rec.payslip.hours.holidayHours * 8);
    totalGross += rec.payslip.earnings.grossSalary;
    totalDeductions += rec.payslip.totals.totalDeductions;
    totalAdvances += rec.payslip.totals.salaryAdvance;
    totalNet += rec.payslip.totals.netToPay;
  });

  // Table Column definition
  const columns = [
    { header: 'Matricule', width: 20 },
    { header: 'Nom & Prénom', width: 40 },
    { header: 'Contrat', width: 20 },
    { header: 'Affectation', width: 30 },
    { header: 'H. NHT', width: 15 },
    { header: 'J. Férié', width: 15 },
    { header: 'H. Tot.', width: 15 },
    { header: 'S. Brut', width: 25 },
    { header: 'CNSS', width: 16 },
    { header: 'AMO', width: 16 },
    { header: 'IR', width: 14 },
    { header: 'Avance', width: 20 },
    { header: 'Net Payé', width: 26 },
  ]; // Total width = 272mm (fits perfectly inside 272mm printable area)

  let y = margin;

  const drawHeader = (pageNum: number) => {
    doc.setFillColor(6, 78, 59); // Dark Green #064e3b
    doc.rect(margin, margin, contentWidth, 3, 'F');

    // Draw Logo if available
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', margin, margin + 5, 34, 16);
      } catch (err) {
        console.warn('Failed to add logo to PDF', err);
      }
    }

    doc.setTextColor(31, 41, 55); // Gray 800
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text("RAPPORT DE PAIE", margin + 35, margin + 10);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Période: Du ${startDate} au ${endDate}`, margin + 35, margin + 15);

    // Page Number
    doc.setFontSize(8);
    doc.text(`Page ${pageNum}`, pageWidth - margin - 15, margin + 10);

    y = margin + 22;
  };

  const drawSummaryCards = () => {
    // 6 Columns of mini cards
    const cardCount = 6;
    const cardWidth = (contentWidth - (cardCount - 1) * 3) / cardCount;
    const cardHeight = 15;

    const cardsData = [
      { label: 'Employés', val: `${totalEmployees}` },
      { label: 'Heures Tot.', val: `${totalHours.toFixed(2)} H` },
      { label: 'Brut Tot. (SBR)', val: `${totalGross.toFixed(2)} DH` },
      { label: 'Déduc. Tot.', val: `${totalDeductions.toFixed(2)} DH` },
      { label: 'Avances Tot.', val: `${totalAdvances.toFixed(2)} DH` },
      { label: 'Net Tot. (A Payé)', val: `${totalNet.toFixed(2)} DH` },
    ];

    cardsData.forEach((card, index) => {
      const cardX = margin + index * (cardWidth + 3);
      // Border box
      doc.setFillColor(243, 244, 246); // gray-100
      doc.rect(cardX, y, cardWidth, cardHeight, 'F');
      doc.setDrawColor(209, 213, 219); // gray-300
      doc.rect(cardX, y, cardWidth, cardHeight, 'S');

      // Green Accent indicator on the left
      doc.setFillColor(16, 185, 129); // emerald-500
      doc.rect(cardX, y, 1.5, cardHeight, 'F');

      // Write Label
      doc.setTextColor(107, 114, 128); // gray-500
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(card.label, cardX + 3, y + 5);

      // Write Value
      doc.setTextColor(6, 78, 59); // Dark Green
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(card.val, cardX + 3, y + 11);
    });

    y += cardHeight + 8;
  };

  const drawTableHeader = () => {
    doc.setFillColor(6, 78, 59); // Dark green background
    doc.rect(margin, y, contentWidth, 7, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255); // White text

    let currentX = margin;
    columns.forEach(col => {
      // center align headers
      const textWidth = doc.getTextWidth(col.header);
      const textX = currentX + (col.width - textWidth) / 2;
      doc.text(col.header, textX, y + 4.5);
      currentX += col.width;
    });

    y += 7;
  };

  // Start generation
  let currentPageNum = 1;
  drawHeader(currentPageNum);
  drawSummaryCards();
  drawTableHeader();

  // Print Rows
  records.forEach((record, index) => {
    // If we exceed page boundary, create a new page
    if (y + 12 > pageHeight - margin) {
      doc.addPage();
      currentPageNum++;
      drawHeader(currentPageNum);
      drawTableHeader();
    }

    const isAlt = index % 2 === 1;
    if (isAlt) {
      doc.setFillColor(244, 252, 248); // very light green zebra
      doc.rect(margin, y, contentWidth, 6, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(55, 65, 81); // Gray 700

    const { employee: emp, payslip: slip, locationName } = record;
    const nht = slip.hours.normalHours;
    const holDays = slip.hours.holidayHours;
    const holHours = holDays * 8;
    const totH = nht + holHours;

    const rowData = [
      slip.employee.matricule,
      slip.employee.employeeName,
      emp.employeeStatus || 'Seasonal',
      locationName || 'N/A',
      nht.toFixed(2),
      holDays.toString(),
      totH.toFixed(2),
      slip.earnings.grossSalary.toFixed(2),
      slip.deductions.cnssContribution.toFixed(2),
      slip.deductions.amoContribution.toFixed(2),
      slip.deductions.incomeTax.toFixed(2),
      slip.totals.salaryAdvance.toFixed(2),
      slip.totals.netToPay.toFixed(2),
    ];

    let currentX = margin;
    columns.forEach((col, colIndex) => {
      const val = rowData[colIndex] || '';
      
      // Alignment
      let textX = currentX + 1.5; // default left padding
      if ([0, 2, 3].includes(colIndex)) {
        // center texts
        const textWidth = doc.getTextWidth(val);
        textX = currentX + (col.width - textWidth) / 2;
      } else if (colIndex >= 4) {
        // right numbers
        const textWidth = doc.getTextWidth(val);
        textX = currentX + col.width - textWidth - 1.5;
      }

      // If the library supports string truncation
      let displayStr = val;
      if (doc.getTextWidth(val) > col.width - 2) {
        // manually truncate if necessary
        let truncated = val;
        while (doc.getTextWidth(truncated + '...') > col.width - 2 && truncated.length > 0) {
          truncated = truncated.slice(0, -1);
        }
        displayStr = truncated + '...';
      }

      doc.text(displayStr, textX, y + 4);
      currentX += col.width;
    });

    // Draw horizontal separator line
    doc.setDrawColor(229, 231, 235); // gray-200
    doc.setLineWidth(0.15);
    doc.line(margin, y + 6, margin + contentWidth, y + 6);

    y += 6;
  });

  // Total Summary Row
  if (y + 12 > pageHeight - margin) {
    doc.addPage();
    currentPageNum++;
    drawHeader(currentPageNum);
    drawTableHeader();
  }

  // Draw double line before summary row
  doc.setDrawColor(6, 78, 59); // Dark green double lines
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);
  doc.setFillColor(236, 253, 245); // light green bg
  doc.rect(margin, y, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(6, 78, 59);

  const totalRowData = [
    '',
    'TOTAL GÉNÉRAL',
    '',
    '',
    records.reduce((sum, r) => sum + r.payslip.hours.normalHours, 0).toFixed(2),
    records.reduce((sum, r) => sum + r.payslip.hours.holidayHours, 0).toString(),
    totalHours.toFixed(2),
    totalGross.toFixed(2),
    records.reduce((sum, r) => sum + r.payslip.deductions.cnssContribution, 0).toFixed(2),
    records.reduce((sum, r) => sum + r.payslip.deductions.amoContribution, 0).toFixed(2),
    records.reduce((sum, r) => sum + r.payslip.deductions.incomeTax, 0).toFixed(2),
    totalAdvances.toFixed(2),
    totalNet.toFixed(2),
  ];

  let currentX = margin;
  columns.forEach((col, colIndex) => {
    const val = totalRowData[colIndex] || '';
    let textX = currentX + 1.5;
    if (colIndex === 1) {
      const textWidth = doc.getTextWidth(val);
      textX = currentX + (col.width - textWidth) / 2;
    } else if (colIndex >= 4) {
      const textWidth = doc.getTextWidth(val);
      textX = currentX + col.width - textWidth - 1.5;
    }
    doc.text(val, textX, y + 4.5);
    currentX += col.width;
  });

  doc.setLineWidth(0.3);
  doc.line(margin, y + 7, margin + contentWidth, y + 7);

  // Generate and download
  doc.save(`Payroll_Report_${startDate}_to_${endDate}.pdf`);
}
