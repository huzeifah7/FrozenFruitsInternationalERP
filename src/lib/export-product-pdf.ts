import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ProductPDFData {
  id?: string;
  name?: string;
  productName?: string;
  type?: string;
  productType?: string;
  description?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: any;
  specsFile?: {
    fileName?: string;
    dataUrl?: string;
  };
  images?: string[];
}

export async function generateProductPDF(product: ProductPDFData) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  const name = product.name || product.productName || 'Product';
  const type = product.type || product.productType || '-';
  const description = product.description || 'No description provided.';
  const createdBy = product.createdBy || 'N/A';
  const updatedBy = product.updatedBy || '-';

  // Header Logo
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
        doc.addImage(logoDataUrl, 'PNG', 14, 10, 36, 17, '', 'FAST');
      }
    }
  } catch (e) {
    console.error('Failed to load logo in product PDF', e);
  }

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(24, 43, 73); // Dark primary color
  doc.text('PRODUCT SPECIFICATION SHEET', pageWidth - 14, 20, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - 14, 26, { align: 'right' });

  // Divider Line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 32, pageWidth - 14, 32);

  // General Information Table
  let currentY = 40;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(name.toUpperCase(), 14, currentY);

  currentY += 6;

  autoTable(doc, {
    startY: currentY,
    head: [['Field', 'Details']],
    body: [
      ['Product Name', name],
      ['Product Type / Grade', type],
      ['Created By', createdBy],
      ['Updated By', updatedBy],
      ['Specification File Attached', product.specsFile?.fileName || 'None'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [24, 43, 73], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 'auto' },
    },
    styles: { fontSize: 10, cellPadding: 3.5 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Description Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(24, 43, 73);
  doc.text('Description & Specifications', 14, currentY);
  currentY += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  const splitDescription = doc.splitTextToSize(description, pageWidth - 28);
  doc.text(splitDescription, 14, currentY);

  currentY += splitDescription.length * 5 + 10;

  // Images Section
  if (product.images && product.images.length > 0) {
    if (currentY > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(24, 43, 73);
    doc.text('Product Images', 14, currentY);
    currentY += 8;

    let xPos = 14;
    const imgWidth = 40;
    const imgHeight = 40;

    for (const imgUrl of product.images) {
      if (xPos + imgWidth > pageWidth - 14) {
        xPos = 14;
        currentY += imgHeight + 5;
        if (currentY + imgHeight > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          currentY = 20;
        }
      }

      try {
        doc.addImage(imgUrl, 'JPEG', xPos, currentY, imgWidth, imgHeight);
        doc.setDrawColor(203, 213, 225);
        doc.rect(xPos, currentY, imgWidth, imgHeight);
        xPos += imgWidth + 5;
      } catch (err) {
        console.error('Failed to add image to PDF', err);
      }
    }
  }

  // Footer
  const totalPages = (doc as any).internal.getNumberOfPages ? (doc as any).internal.getNumberOfPages() : 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${totalPages} - Confidential - FFI ERP System`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`${name.replace(/\s+/g, '_')}_Spec_Sheet.pdf`);
}
