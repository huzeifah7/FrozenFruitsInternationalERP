import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface RawMaterialDetailData {
  lotNumber: string;
  dateTime: string;
  locationName: string;
  driverName: string;
  plateNumber: string;
  productFamily: string;
  supplierName: string;
  boxesIn: number;
  boxesOut?: number; // Might not be available, fallback to 0
  emptyBoxes: number;
  blNetWeight: number;
  blGrossWeight: number;
  totalNetWeight: number;
  status: string;
  calibreDominant: string;
  petitCalibre: number;
  dechet: number;
  remarks: string;
  pallets: any[]; // Array of pallets
  products: any[]; // Array of reference products
  weightDifference?: number;
}

export async function generateRawMaterialDetailPDF(data: RawMaterialDetailData) {
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
  doc.text('Fiche de reception - Matière première', pageWidth / 2, 20, { align: 'center' });

  // Divider Line
  doc.setLineWidth(0.5);
  doc.line(14, 32, pageWidth - 14, 32);

  // -- 2. GENERAL INFORMATION (Left & Right columns) --
  doc.setFontSize(10);
  const startY = 40;
  const lineSpacing = 6;
  const col1X = 14;
  const col1ValX = 55;
  const col2X = 110;
  const col2ValX = 145;

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
  doc.text('Numero de Lot:', col1X, startY);
  doc.text('Heure et Date:', col1X, startY + lineSpacing);
  doc.text('Station:', col1X, startY + lineSpacing * 2);
  doc.text('Nom du Chauffeur:', col1X, startY + lineSpacing * 3);
  doc.text('Matricule:', col1X, startY + lineSpacing * 4);
  doc.text('Poids net BL:', col1X, startY + lineSpacing * 5);
  doc.text('Poids Brut BL:', col1X, startY + lineSpacing * 6);

  doc.setFont('helvetica', 'normal');
  doc.text(data.lotNumber || '-', col1ValX, startY);
  doc.text(fmtDate(data.dateTime), col1ValX, startY + lineSpacing);
  doc.text(data.locationName || '-', col1ValX, startY + lineSpacing * 2);
  doc.text(data.driverName || '-', col1ValX, startY + lineSpacing * 3);
  doc.text(data.plateNumber || '-', col1ValX, startY + lineSpacing * 4);
  doc.text(formatKg(data.blNetWeight), col1ValX, startY + lineSpacing * 5);
  doc.text(formatKg(data.blGrossWeight), col1ValX, startY + lineSpacing * 6);

  // Right Column
  doc.setFont('helvetica', 'bold');
  doc.text('Produit:', col2X, startY);
  doc.text('Fournisseur:', col2X, startY + lineSpacing);
  doc.text('Nombre de caisse:', col2X, startY + lineSpacing * 2);
  doc.text('Caisses vides:', col2X, startY + lineSpacing * 3);
  doc.text('Poids Net Total:', col2X, startY + lineSpacing * 4);
  doc.text('Ecart de poids:', col2X, startY + lineSpacing * 5);

  doc.setFont('helvetica', 'normal');
  doc.text(data.productFamily || 'Avocado', col2ValX, startY);
  doc.text(data.supplierName || '-', col2ValX, startY + lineSpacing);
  
  // Total boxes from all palletizations
  const totalBoxes = (data.pallets || []).reduce((sum, p) => sum + safeNum(p.boxes), 0);
  doc.text(totalBoxes.toString(), col2ValX, startY + lineSpacing * 2);
  
  doc.text(data.emptyBoxes?.toString() || '0', col2ValX, startY + lineSpacing * 3);
  doc.text(formatKg(data.totalNetWeight), col2ValX, startY + lineSpacing * 4);
  doc.text(formatKg(weightDiff), col2ValX, startY + lineSpacing * 5);

  let currentY = startY + lineSpacing * 7 + 5;

  // -- 3. GROUP PALLETIZATIONS --
  // Group by: 1) Farm Decay, 2) Variety
  const farmDecayPallets: any[] = [];
  const varietyGroups: Record<string, {
    name: string;
    items: any[];
    totalNet: number;
    totalGross: number;
    totalBoxes: number;
  }> = {};

  (data.pallets || []).forEach(p => {
    const isDecay = p.type === 'Farm Decay' || p.type === 'Dechet' || p.type === 'decay';
    
    // Find variety info
    const prod = (data.products || []).find(prodRef => prodRef.id === p.productId);
    const cat = prod?.category || 'Unknown Product';
    const pType = prod?.type || '';
    const varietyName = pType ? `${cat} - ${pType}` : cat;

    if (isDecay) {
      farmDecayPallets.push({ ...p, varietyName });
    } else {
      if (!varietyGroups[varietyName]) {
        varietyGroups[varietyName] = {
          name: varietyName,
          items: [],
          totalNet: 0,
          totalGross: 0,
          totalBoxes: 0
        };
      }
      varietyGroups[varietyName].items.push({ ...p, varietyName });
      varietyGroups[varietyName].totalNet += safeNum(p.netWeight);
      varietyGroups[varietyName].totalGross += safeNum(p.grossWeight);
      varietyGroups[varietyName].totalBoxes += safeNum(p.boxes);
    }
  });

  const renderTableGroup = (title: string, items: any[], groupTotalNet: number) => {
    if (items.length === 0) return;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${title} ${formatKg(groupTotalNet)}`, 14, currentY);
    currentY += 4;

    const tableData = items.map(p => [
      p.barcode || '-',
      p.varietyName || '-',
      formatKg(p.grossWeight),
      formatKg(p.netWeight),
      p.boxes || '0'
    ]);

    // Add Total Row
    const groupTotalGross = items.reduce((sum, p) => sum + safeNum(p.grossWeight), 0);
    const groupTotalBoxes = items.reduce((sum, p) => sum + safeNum(p.boxes), 0);
    tableData.push([
      'TOTAL',
      '',
      formatKg(groupTotalGross),
      formatKg(groupTotalNet),
      groupTotalBoxes.toString()
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Code-Barre', 'Variété', 'Poids Brut', 'Poids Net', 'Nombre de caisse']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 9, cellPadding: 2, textColor: [0, 0, 0] },
      columnStyles: {
        0: { halign: 'center' },
        1: { halign: 'left' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'center' }
      },
      willDrawCell: function(data: any) {
        if (data.row.index === tableData.length - 1 && data.section === 'body') {
          doc.setFillColor(230, 230, 230);
          doc.setFont('helvetica', 'bold');
        }
      },
      didDrawPage: function(data: any) {
        // If we overflow to a new page, update currentY so next elements start correctly
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
  };

  // Group 1: Farm Decay
  if (farmDecayPallets.length > 0) {
    const totalDecayNet = farmDecayPallets.reduce((sum, p) => sum + safeNum(p.netWeight), 0);
    renderTableGroup('Dechet de Ferme', farmDecayPallets, totalDecayNet);
  }

  // Group 2+: Varieties
  Object.values(varietyGroups).forEach(group => {
    renderTableGroup(group.name, group.items, group.totalNet);
  });

  // Ensure enough space for QC and Crates
  if (currentY > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    currentY = 20;
  }

  // -- 4. QUALITY CONTROL --
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Controle de Qualite', 14, currentY);
  currentY += 6;

  doc.setFontSize(10);
  const qcCol1X = 14;
  const qcCol1ValX = 55;
  
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
  const remarksText = data.remarks ? doc.splitTextToSize(data.remarks, 130) : '-';
  doc.text(remarksText, qcCol1ValX, currentY + lineSpacing * 4);

  currentY += lineSpacing * 4 + (Array.isArray(remarksText) ? remarksText.length * 5 : 5);

  // -- 5. CRATES FOLLOW UP --
  if (currentY > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    currentY = 20;
  }

  currentY += 5;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Crates Follow Up', 14, currentY);
  currentY += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Boxes IN:', qcCol1X, currentY);
  doc.text('Boxes OUT:', qcCol1X, currentY + lineSpacing);
  doc.text('Difference:', qcCol1X, currentY + lineSpacing * 2);

  const bIn = safeNum(data.boxesIn);
  const bOut = safeNum(data.boxesOut);
  const bDiff = bIn - bOut;

  doc.setFont('helvetica', 'normal');
  doc.text(bIn.toString(), qcCol1ValX, currentY);
  doc.text(bOut.toString(), qcCol1ValX, currentY + lineSpacing);
  doc.text(bDiff.toString(), qcCol1ValX, currentY + lineSpacing * 2);

  // -- SAVE AND DOWNLOAD --
  doc.save(`${data.lotNumber || 'raw_material_ticket'}.pdf`);
}
