// PDF libraries are dynamically imported inside the function to reduce bundle size
// Helper to load image
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

export async function generateInvoicePDF(
  invoiceNumber: string,
  invoiceDate: string,
  packingList: any,
  orderData: any,
  customerData: any,
  mainFarmGgn: string,
  rows: any[],
  invoiceData?: any
): Promise<void> {
  const jsPDFModule = await import('jspdf');
  // Handle different CJS/ESM interop shapes
  const JsPDFClass = (jsPDFModule.jsPDF || jsPDFModule.default || jsPDFModule) as any;
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = (autoTableModule.default || autoTableModule) as any;

  const doc = new JsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  let currentY = 15;

  const headerFill: [number, number, number] = [240, 238, 220]; // Warm beige / white-green

  // Determine Type
  const rawType = invoiceData?.invoice_type_display || invoiceData?.invoice_type || 'Invoice';
  let title = 'Invoice';
  if (rawType.toLowerCase().includes('proforma')) title = 'Proforma Invoice';
  else if (rawType.toLowerCase().includes('credit')) title = 'Credit Note';
  else title = 'Invoice';

  // --- 1. HEADER (Logo & Company Info) ---
  const logoDataUrl = await loadImageAsDataUrl('/FFI_main.png');
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 14, currentY, 24, 14, '', 'FAST');
    } catch (e) {
      // ignore
    }
  }

  // Company details next to logo (starting at X = 40, close to logo without stretching, ending cleanly before Invoice No box at X = 90)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(118, 147, 60); // Brand green
  doc.text('EXPORT OPTIMUM', 40, currentY + 3.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('DOUAR MOUARAA TEYARA', 40, currentY + 8);
  doc.text('LAAOUAMRA KSAR EL KEBIR', 40, currentY + 12.5);
  doc.text('Phone: 00212678732391', 40, currentY + 17);

  // Invoice Title
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(26);
  doc.setTextColor(118, 147, 60); // Green accent
  doc.text(title, pageW - 14, currentY + 6, { align: 'right' });
  doc.setTextColor(0, 0, 0); // Reset

  let displayInvoiceNumber = invoiceNumber || '-';
  if (title === 'Credit Note' && displayInvoiceNumber !== '-' && !displayInvoiceNumber.startsWith('CN')) {
    displayInvoiceNumber = `CN${displayInvoiceNumber}`;
  }

  // Invoice No and Date Table
  autoTable(doc, {
    startY: currentY + 12,
    margin: { left: pageW / 2 - 15, right: 14 },
    head: [[`${title === 'Invoice' ? 'Invoice' : title} No`, 'DATE']],
    body: [[displayInvoiceNumber, invoiceDate || '-']],
    theme: 'grid',
    headStyles: { fillColor: headerFill, textColor: [0,0,0], fontStyle: 'bold', halign: 'center', lineColor: [0,0,0], lineWidth: 0.3 },
    bodyStyles: { halign: 'center', fontStyle: 'bold', textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.3 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Helper: returns the value only if it's a meaningful non-placeholder string.
  // This is CRITICAL because "—" and "-" are truthy in JS and would short-circuit || chains.
  const val = (v: any): string | undefined => {
    if (!v || typeof v !== 'string') return undefined;
    const t = v.trim();
    return (t === '' || t === '—' || t === '-' || t === 'undefined' || t === 'null') ? undefined : t;
  };

  // Pick the first valid (non-placeholder) value from a list of candidates
  const pick = (...candidates: any[]): string => {
    for (const c of candidates) {
      const v = val(c);
      if (v) return v;
    }
    return '—';
  };

  // --- 2. BILL TO (Customer Info) ---
  const billingAddr = customerData?.addresses?.find((a: any) => a.type === 'Billing') || customerData?.addresses?.[0] || customerData?.registeredAddresses?.[0];

  const cName = pick(
    invoiceData?.customer_detail?.companyName, invoiceData?.customer_detail?.company_name,
    invoiceData?.customer, customerData?.companyName, customerData?.name,
    orderData?.customerName, orderData?.customer, packingList?.customer
  );
  
  let cAddress = pick(
    billingAddr?.street, customerData?.street,
    invoiceData?.customer_detail?.street_address,
    invoiceData?.customer_detail?.invoicing_address, invoiceData?.invoicing_address,
    customerData?.address, packingList?.customerAddress
  );
  
  let rawCity = val(billingAddr?.city) || val(customerData?.city) || val(invoiceData?.customer_detail?.city) || '';
  let rawZip = val(billingAddr?.zipCode) || val(billingAddr?.zip) || val(customerData?.zipCode) || val(invoiceData?.customer_detail?.zip_code) || val(invoiceData?.customer_detail?.zipCode) || '';
  let cCountry = val(billingAddr?.country) || val(customerData?.country) || val(invoiceData?.customer_detail?.country) || '';

  // Smart splitting: If cAddress contains a full comma-separated address
  // and city was not found from structured fields, try to parse it out.
  if (!rawCity && cAddress && cAddress !== '—' && cAddress.includes(',')) {
    const parts = cAddress.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      if (!cCountry) cCountry = parts[parts.length - 1];
      const zipOrCityPart = parts[parts.length - 2];
      const cityPart = parts[parts.length - 3];
      const matchDigits = zipOrCityPart.match(/\b\d{4,5}\b/);
      if (matchDigits) {
        rawZip = matchDigits[0];
        rawCity = zipOrCityPart.replace(/\b\d{4,5}\b/, '').trim() || cityPart;
      } else {
        rawCity = zipOrCityPart;
      }
      cAddress = parts.slice(0, parts.length - 2).join(', ');
    } else if (parts.length === 2) {
      if (!cCountry) cCountry = parts[1];
      cAddress = parts[0];
    }
  }

  let cCity = rawCity || '—';
  if (rawZip) {
    cCity = rawCity ? `${rawCity} ${rawZip}` : rawZip;
  }
  if (!cCountry) cCountry = '—';

  const cVat = pick(
    invoiceData?.customer_detail?.vat_number, invoiceData?.customer_detail?.vatNumber,
    invoiceData?.vat_number, customerData?.vatNumber, customerData?.vat_number
  );
  if (cVat === '—') {} // keep as-is for VAT

  autoTable(doc, {
    startY: currentY,
    margin: { left: 14, right: 14 },
    head: [[{ content: title === 'Invoice' ? 'BILL TO' : `${title} To`, colSpan: 2, styles: { halign: 'center' } }]],
    body: [
      ['Company Name', cName],
      ['Street Address', cAddress],
      ['City State Zip', cCity],
      ['Country', cCountry],
      ['VAT-number', cVat === '—' ? '-' : cVat]
    ],
    theme: 'grid',
    headStyles: { fillColor: headerFill, textColor: [0,0,0], fontStyle: 'bold', lineColor: [0,0,0], lineWidth: 0.3 },
    columnStyles: { 
      0: { cellWidth: 35, fillColor: headerFill, fontStyle: 'bold', lineColor: [0,0,0], lineWidth: 0.3, halign: 'center' },
      1: { halign: 'center', lineColor: [0,0,0], lineWidth: 0.3 }
    },
    styles: { textColor: [0,0,0], fontSize: 8, cellPadding: 2 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // --- 3. SHIPMENT & ORDER INFO ---
  const incoterms = pick(
    invoiceData?.incoterm, invoiceData?.incoterms,
    invoiceData?.customer_detail?.incoterms, invoiceData?.customer_detail?.incoterm,
    orderData?.incoterm, orderData?.incoterms,
    customerData?.incoterm, customerData?.incoterms,
    'DAP'
  );

  const paymentTerms = pick(
    invoiceData?.payment_terms, invoiceData?.paymentTerms, invoiceData?.payment_term,
    invoiceData?.customer_detail?.payment_terms, invoiceData?.customer_detail?.paymentTerms,
    invoiceData?.customer_detail?.payment_term_name,
    orderData?.paymentTerms, orderData?.payment_terms, orderData?.payment_term, orderData?.paymentTerm,
    packingList?.paymentTerms, packingList?.payment_terms,
    customerData?.payment_term_name, customerData?.paymentTerms,
    customerData?.payment_terms, customerData?.paymentTerm
  );
  const origin = pick(invoiceData?.country_of_origin, 'Morocco');
  const truck = pick(
    invoiceData?.truck_number, invoiceData?.truckNumber, invoiceData?.truck,
    packingList?.truckNumber, packingList?.truck_number, packingList?.truck,
    orderData?.truckNumber, orderData?.truck_number, orderData?.truck
  );
  const poNum = pick(invoiceData?.po_order_number, invoiceData?.poNumber, orderData?.poNumber, packingList?.poNumber);
  const lotNum = pick(packingList?.lotNumber, invoiceData?.lotNumber);

  const totalGross = invoiceData?.total_gross_weight ?? rows?.reduce((sum, r) => sum + (Number(r.grossWeight) || 0), 0) ?? 0;
  let totalBoxes = invoiceData?.total_number_of_boxes ?? rows?.reduce((sum, r) => sum + (Number(r.boxes || r.numberOfBoxes) || 0), 0) ?? 0;
  let totalNet = 0;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  
  // Left column
  doc.text('incoterms :', 14, currentY + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(incoterms, 45, currentY + 4);
  
  doc.setFont('helvetica', 'bold');
  doc.text('payment terms :', 14, currentY + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(paymentTerms, 45, currentY + 8);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Country of Origin:', 14, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(origin, 45, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Truck N° :', 14, currentY + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(truck, 45, currentY + 16);
  
  // Right column
  const rX = pageW / 2 + 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Gross weight in KG :', rX, currentY + 4);
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalGross} (KG)`, pageW - 14, currentY + 4, { align: 'right' });

  if (lotNum !== '—') {
    doc.setFont('helvetica', 'bold');
    doc.text('LOT Number', rX, currentY + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(lotNum, pageW - 14, currentY + 8, { align: 'right' });
  }

  doc.setFont('helvetica', 'bold');
  doc.text('N of 4 KG carton:', rX, currentY + 12); 
  doc.setFont('helvetica', 'normal');
  doc.text(`${totalBoxes}`, pageW - 14, currentY + 12, { align: 'right' });

  if (poNum !== '—') {
    doc.setFont('helvetica', 'bold');
    doc.text('PO :', rX, currentY + 16);
    doc.setFont('helvetica', 'normal');
    doc.text(poNum, pageW - 14, currentY + 16, { align: 'right' });
  }

  currentY += 20;

  // --- 4. ITEM LINES ---
  let totalAmount = 0;
  let itemRows: any[] = [];
  
  if (invoiceData && invoiceData.items) {
    // Finance Invoice Items
    invoiceData.items.forEach((item: any) => {
      const unitPrice = Number(item.price || 0);
      const qty = Number(item.quantity || 0);
      totalNet += qty;
      const amount = unitPrice * qty;
      totalAmount += amount;

      const desc = item.description || item.product || item.product_id || '—';
      const itemCode = item.item_code || item.itemCode || item.code || 'A2';
      
      itemRows.push([
        itemCode, 
        desc,
        unitPrice.toFixed(3),
        qty,
        amount.toFixed(3) 
      ]);
    });
  } else {
    // Supply Chain Packing List Rows Grouping
    const groupedMap: Record<string, any> = {};
    (rows || []).forEach(r => {
      const prod = r.product || '—';
      const cat = r.category || '';
      const type = r.type || '';
      const cal = r.caliber || '—';
      const key = `${prod} | ${cat} | ${type} | ${cal}`;
      
      const qty = Number(r.netWeight || r.quantity || 0);
      const unitPrice = Number(r.unitPrice || orderData?.price || 3.625);

      if (groupedMap[key]) {
        groupedMap[key].netWeight += qty;
      } else {
        groupedMap[key] = {
          itemCode: r.itemCode || 'A4',
          product: prod,
          category: cat,
          type: type,
          caliber: cal,
          netWeight: qty,
          unitPrice: unitPrice
        };
      }
    });

    const groupedRows = Object.values(groupedMap);
    itemRows = groupedRows.map(r => {
      const unitPrice = r.unitPrice;
      const qty = r.netWeight;
      totalNet += qty;
      const amount = unitPrice * qty;
      totalAmount += amount;

      const partProduct = r.product || '—';
      const partCaliber = r.caliber && r.caliber !== '—' ? ` - ${r.caliber}` : '';
      const desc = `${partProduct}${partCaliber}`;

      return [
        r.itemCode || 'A4', 
        desc,
        unitPrice.toFixed(3),
        qty,
        amount.toFixed(3) 
      ];
    });
  }

  const currencyStr = invoiceData?.currency || customerData?.currency || 'EUR';
  const currencySymbol = currencyStr === 'EUR' ? '€' : currencyStr;
  const taxAmount = Number(invoiceData?.tax || 0);
  const discountAmount = Number(invoiceData?.discount || 0);
  const finalAmount = invoiceData?.final_amount != null ? Number(invoiceData.final_amount) : (totalAmount + taxAmount - discountAmount);

  // Add the totals rows exactly as in the reference
  itemRows.push([
    { content: 'Total Amount', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold', fillColor: headerFill } },
    { content: `${totalNet.toLocaleString()} (KG)`, styles: { fontStyle: 'bold', fillColor: headerFill, halign: 'center' } },
    { content: `${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currencySymbol}`, styles: { fontStyle: 'bold', fillColor: headerFill, halign: 'right' } }
  ]);
  itemRows.push([
    { content: 'TAX', colSpan: 4, styles: { halign: 'left', fontStyle: 'bold', fillColor: headerFill } },
    { content: taxAmount > 0 ? `${taxAmount.toFixed(2)}${currencySymbol}` : '', styles: { fontStyle: 'bold', fillColor: headerFill, halign: 'right' } }
  ]);
  itemRows.push([
    { content: 'Discount', colSpan: 4, styles: { halign: 'left', fontStyle: 'bold', fillColor: headerFill } },
    { content: discountAmount > 0 ? `${discountAmount.toFixed(2)}${currencySymbol}` : '', styles: { fontStyle: 'bold', fillColor: headerFill, halign: 'right' } }
  ]);
  itemRows.push([
    { content: 'Final Amount', colSpan: 4, styles: { halign: 'left', fontStyle: 'bold', fillColor: headerFill } },
    { content: `${finalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currencySymbol}`, styles: { fontStyle: 'bold', fillColor: headerFill, halign: 'right' } }
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Item code', 'Product Description', 'Unit price EUR', 'Quantity (kg)', 'Amount in EUR']],
    body: itemRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: headerFill, textColor: [0,0,0], fontStyle: 'bold', lineColor: [0,0,0], lineWidth: 0.3, halign: 'center' },
    bodyStyles: { textColor: [0,0,0], lineColor: [0,0,0], lineWidth: 0.3, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { halign: 'left' },
      2: { cellWidth: 30 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  const remark = invoiceData?.remarks || packingList?.remarks || orderData?.remarks || packingList?.remark || orderData?.remark || '';
  if (remark) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const splitRemark = doc.splitTextToSize(remark, pageW - 28);
    doc.text(splitRemark, 14, currentY);
    currentY += (splitRemark.length * 4.5) + 4;
  } else {
    currentY += 2;
  }

  // Page break protection for footer
  const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
  if (currentY > pageHeight - 85) {
     doc.addPage();
     currentY = 15;
  }

  // --- 5. FOOTER (Certifications, Stamp, Declarations) ---
  
  // Left Column
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Certified COC 4063651455366', 14, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('GLOBALG.A.P. certified product', 14, currentY + 4);
  doc.text(`with GGN : ${invoiceData?.ggn || mainFarmGgn || '4063061946720'}`, 14, currentY + 8);
  doc.text('L\'exportateur des produits couverts par le présent document', 14, currentY + 12);
  doc.text('[autorisation douanière n° MA5848/21déclare que, sauf', 14, currentY + 16);
  doc.text('indication claire du contraire, ces produits ont l\'origine', 14, currentY + 20);
  doc.text('préférentielle MAROC (2).', 14, currentY + 24);
  doc.setFont('helvetica', 'bold');
  doc.text(`Lieu et date LARACHE, Le ${invoiceDate}`, 14, currentY + 30);

  // Middle Column (Stamp)
  const stampDataUrl = await loadImageAsDataUrl('/cache.png');
  if (stampDataUrl) {
    try {
      doc.addImage(stampDataUrl, 'PNG', pageW / 2 - 25, currentY + 5, 40, 30, '', 'FAST');
    } catch (e) {
      console.warn("Failed to add cache.png stamp to PDF", e);
    }
  }

  // Right Column
  const rightX = pageW / 2 + 25;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('DECLARA,', rightX, currentY + 4);
  doc.setFont('helvetica', 'normal');
  doc.text('Que según lo establecido en la ley 7/2022, de 8 de abril,', rightX, currentY + 8);
  doc.text('de residuos y suelos contaminados para una economía', rightX, currentY + 12);
  doc.text(`circular la mercancía amparada en la factura número ${invoiceNumber || '—'}`, rightX, currentY + 16);
  doc.text(`con fecha ${invoiceDate || '—'}, en lo referente a artículos que`, rightX, currentY + 20);
  doc.text('contengan plástico', rightX, currentY + 24);
  doc.text('diseñados para contener, proteger, manipular,', rightX, currentY + 28);
  doc.text('mercancía:', rightX, currentY + 32);
  doc.text('Contiene plásticos no reciclados o reutilizables, kilos netos', rightX, currentY + 36);
  doc.text('6,5KG', rightX, currentY + 40);

  // --- 6. BOTTOM FOOTER (Bank & Legal) ---
  let footerY = currentY + 50;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('EXPORT OPTIMUM SARL, Capital Social 100.000DH, DOUAR MOUARAA TEYARA LAAOUAMRA KSAR EL KEBIR', 14, footerY);
  
  footerY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('RC: 52747 IF: 37614300', 14, footerY);
  doc.text('patente: 20102348', 65, footerY);
  doc.text('ICE: 002306448000001', 130, footerY);
  
  footerY += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Bank Account:', 14, footerY);

  footerY += 4;
  doc.setFont('helvetica', 'normal');
  doc.text('BMCE', 14, footerY);
  doc.text('MA64 0117 3500 0003 2100 0176 9346', 65, footerY);
  doc.text('SWIFT: BMCEMAMC', 130, footerY);

  footerY += 4;
  doc.text('BMCE (compte en devises)', 14, footerY);
  doc.text('MA64 0117 3500 0503 6650 0027 2518', 65, footerY);
  doc.text('SWIFT: BMCEMAMC', 130, footerY);

  footerY += 4;
  doc.text('Caixabank', 14, footerY);
  doc.text('MA64 003 010 0100000000192189 60', 65, footerY);
  doc.text('SWIFT: CAIXMAMCXX', 130, footerY);

  // Output
  const cNameSafe = cName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30);
  const safeFilename = `Invoice-${invoiceNumber}-${cNameSafe}.pdf`;
  
  doc.save(safeFilename);
}
