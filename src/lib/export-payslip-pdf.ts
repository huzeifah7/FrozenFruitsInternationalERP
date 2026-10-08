// Libraries are dynamically imported inside the export functions to reduce bundle size
const containsArabic = (text: string): boolean => {
  return /[\u0600-\u06FF]/.test(text);
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PayslipEmployee {
  id: string;
  employeeName: string;
  firstName: string;
  lastName: string;
  matricule: string;
  position: string;
  dateBirth: string;
  employmentDate: string;
  familySituation: string;
  childrenCount: number;
  paymentMethod: string;
  cnssNumber: string;
  nationality: string;
  cin: string;
  seniority: string;
}

export interface PayslipData {
  employee: PayslipEmployee;
  period: {
    startDate: string;
    endDate: string;
    quinzaine: string; // e.g. "1ère Quinzaine" or "2ème Quinzaine"
    month: string;     // e.g. "Novembre 2025"
  };
  hours: {
    normalHours: number;
    holidayHours: number;
    sbrHours?: number;
  };
  rates: {
    grossHourlyWage: number;
    netHourlyWage: number;
    cnssRate: number;      // e.g. 4.48
    amoRate: number;       // e.g. 2.26
    plafondCNSS: number;   // e.g. 6000
    seniorityRate: number; // e.g. 5 for 5%
  };
  earnings: {
    normalHoursAmount: number;
    seniorityBonus: number;
    holidayHoursAmount: number;
    grossSalary: number;
    basketAllowance: number;
    transportAllowance: number;
  };
  deductions: {
    cnssContribution: number;
    amoContribution: number;
    incomeTax: number;
  };
  totals: {
    totalGains: number;
    totalDeductions: number;
    salaryAdvance: number;
    netToPay: number;
  };
}

// ─── Company Info ────────────────────────────────────────────────────────────

const COMPANY = {
  nameFr: 'EXPORT OPTIMUM SARL',
  nameAr: 'شركة اكسبور اوبتيموم',
  addressLine1: 'DOUAR MOUARAA TEYARA',
  addressLine2: 'LAAOUAMRA KSAR EL KEBIR',
};

// ─── PDF Generator ──────────────────────────────────────────────────────────

export async function generatePayslipPDF(
  data: PayslipData,
  logoDataUrl: string | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const jsPDFModule = await import('jspdf');
        const JsPDFClass = (jsPDFModule.jsPDF || jsPDFModule.default || jsPDFModule) as any;
        const reshaperModule = await import('arabic-persian-reshaper');
        const reshaper = reshaperModule.default || reshaperModule;
        
        const formatArabic = (text: string): string => {
          return reshaper.ArabicShaper.convertArabic(text);
        };

        const doc = new JsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // Load Amiri font for Arabic text
        try {
          const fontRes = await fetch('/fonts/Amiri-Regular.ttf');
          const fontBlob = await fontRes.blob();
          const fontBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1]);
            };
            reader.readAsDataURL(fontBlob);
          });
          doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
          doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        } catch (e) {
          console.error("Failed to load Arabic font", e);
        }

        const pageW = 210;
        const marginL = 12;
        const marginR = 12;
        const contentW = pageW - marginL - marginR;
        let y = 10;

        // Colors
        const BLACK: [number, number, number] = [0, 0, 0];
        const GRAY: [number, number, number] = [100, 100, 100];
        const LIGHT_GRAY: [number, number, number] = [230, 230, 230];
        const WHITE: [number, number, number] = [255, 255, 255];
        const HEADER_BG: [number, number, number] = [240, 240, 240];

        // ──── Helper functions ────

        function setFont(style: 'normal' | 'bold' = 'normal', size = 9) {
          doc.setFont('helvetica', style);
          doc.setFontSize(size);
          doc.setTextColor(...BLACK);
        }

        function drawRect(x: number, yPos: number, w: number, h: number, fill?: [number, number, number]) {
          if (fill) {
            doc.setFillColor(...fill);
            doc.rect(x, yPos, w, h, 'FD');
          } else {
            doc.rect(x, yPos, w, h, 'S');
          }
        }

        function drawLine(x1: number, y1: number, x2: number, y2: number) {
          doc.setDrawColor(...BLACK);
          doc.setLineWidth(0.3);
          doc.line(x1, y1, x2, y2);
        }

        function textLeft(text: string, x: number, yPos: number) {
          if (containsArabic(text)) {
            const currentFont = doc.getFont();
            doc.setFont('Amiri', 'normal');
            doc.text(formatArabic(text), x, yPos);
            doc.setFont(currentFont.fontName, currentFont.fontStyle);
          } else {
            doc.text(text, x, yPos);
          }
        }

        function textRight(text: string, x: number, yPos: number) {
          if (containsArabic(text)) {
            const currentFont = doc.getFont();
            doc.setFont('Amiri', 'normal');
            doc.text(formatArabic(text), x, yPos, { align: 'right' });
            doc.setFont(currentFont.fontName, currentFont.fontStyle);
          } else {
            doc.text(text, x, yPos, { align: 'right' });
          }
        }

        function textCenter(text: string, x: number, yPos: number) {
          if (containsArabic(text)) {
            const currentFont = doc.getFont();
            doc.setFont('Amiri', 'normal');
            doc.text(formatArabic(text), x, yPos, { align: 'center' });
            doc.setFont(currentFont.fontName, currentFont.fontStyle);
          } else {
            doc.text(text, x, yPos, { align: 'center' });
          }
        }

        // Set default drawing state
        doc.setDrawColor(...BLACK);
        doc.setLineWidth(0.4);

        // ════════════════════════════════════════════════════════════════════════════
        // SECTION 1: HEADER — Logo + Company + Title
        // ════════════════════════════════════════════════════════════════════════════

        const headerH = 38;
        drawRect(marginL, y, contentW, headerH);

        if (logoDataUrl) {
          try {
            const props = doc.getImageProperties(logoDataUrl);
            const ratio = props.width / props.height;
            const logoH = 22;
            const logoW = logoH * ratio;
            doc.addImage(logoDataUrl, 'PNG', marginL + 3, y + 2, logoW, logoH);
          } catch (e) {
            // Logo load failed, skip
          }
        }

        // Company info (right side)
        setFont('bold', 10);
        textRight(COMPANY.nameFr, marginL + contentW - 4, y + 7);
        setFont('normal', 7);
        textRight(COMPANY.addressLine1, marginL + contentW - 4, y + 17);
        textRight(COMPANY.addressLine2, marginL + contentW - 4, y + 27);

        // Title centered
        setFont('bold', 16);
        textCenter('BULLETIN DE PAIE', pageW / 2, y + 34);

        y += headerH + 2;

        // ════════════════════════════════════════════════════════════════════════════
        // SECTION 2: PAY PERIOD
        // ════════════════════════════════════════════════════════════════════════════

        const periodH = 14;
        drawRect(marginL, y, contentW, periodH, HEADER_BG);

        setFont('bold', 8);
        const periodColW = contentW / 4;

        // Period labels
        textLeft('Période de Paie / فترة الأداء', marginL + 3, y + 5);
        textLeft(`Du / من: ${data.period.startDate}`, marginL + 3, y + 11);

        textLeft(`Au / إلى: ${data.period.endDate}`, marginL + periodColW + 3, y + 11);

        textCenter(data.period.quinzaine, marginL + periodColW * 2.5, y + 5);
        textCenter(data.period.month, marginL + periodColW * 2.5, y + 11);

        // Vertical separators
        drawLine(marginL + periodColW, y, marginL + periodColW, y + periodH);
        drawLine(marginL + periodColW * 2, y, marginL + periodColW * 2, y + periodH);
        drawLine(marginL + periodColW * 3, y, marginL + periodColW * 3, y + periodH);

        y += periodH + 2;

        // ════════════════════════════════════════════════════════════════════════════
        // SECTION 3: EMPLOYEE INFORMATION
        // ════════════════════════════════════════════════════════════════════════════

        const empH = 52;
        drawRect(marginL, y, contentW, empH);

        // Section header
        drawRect(marginL, y, contentW, 7, HEADER_BG);
        setFont('bold', 8);
        textCenter('INFORMATIONS EMPLOYÉ / معلومات الموظف', pageW / 2, y + 5);

        y += 8;

        const emp = data.employee;
        const leftCol = marginL + 4;
        const rightCol = marginL + contentW / 2 + 4;
        const valOffset = 42;
        const lineH = 5;

        setFont('normal', 7.5);

        // Left column
        const leftFields = [
          { label: 'Matricule / رقم التسجيل', value: emp.matricule || emp.id.substring(0, 8).toUpperCase() },
          { label: 'Nom & Prénom / الاسم و اللقب', value: emp.employeeName },
          { label: 'Date de Naissance / تاريخ الازدياد', value: emp.dateBirth || '—' },
          { label: "Date d'Embauche / تاريخ التوظيف", value: emp.employmentDate || '—' },
          { label: 'Fonction / الوظيفة', value: emp.position },
        ];

        // Right column
        const rightFields = [
          { label: 'Nationalité / الجنسية', value: emp.nationality || 'Marocaine' },
          { label: 'Situation Familiale / الحالة العائلية', value: emp.familySituation || '—' },
          { label: "Nombre d'Enfants / عدد الأطفال", value: String(emp.childrenCount || 0) },
          { label: 'Mode de Paiement / طريقة الأداء', value: emp.paymentMethod || 'Virement' },
          { label: 'CNSS / رقم الضمان الاجتماعي', value: emp.cnssNumber || '—' },
        ];

        for (let i = 0; i < Math.max(leftFields.length, rightFields.length); i++) {
          const rowY = y + i * lineH + 4;

          if (leftFields[i]) {
            setFont('bold', 7);
            textLeft(leftFields[i].label + ':', leftCol, rowY);
            setFont('normal', 7.5);
            textLeft(leftFields[i].value, leftCol + valOffset, rowY);
          }

          if (rightFields[i]) {
            setFont('bold', 7);
            textLeft(rightFields[i].label + ':', rightCol, rowY);
            setFont('normal', 7.5);
            textLeft(rightFields[i].value, rightCol + valOffset, rowY);
          }
        }

        // Vertical separator
        drawLine(marginL + contentW / 2, y - 1, marginL + contentW / 2, y + empH - 8);

        y += empH - 6;

        // ════════════════════════════════════════════════════════════════════════════
        // SECTION 4: SALARY DETAILS TABLE
        // ════════════════════════════════════════════════════════════════════════════

        const tableStartY = y;

        // Column widths
        const col = {
          rub: 62,
          h: 16,
          base: 26,
          taux: 22,
          gains: 28,
          retenues: 32,
        };

        const tableColPositions = [
          marginL,
          marginL + col.rub,
          marginL + col.rub + col.h,
          marginL + col.rub + col.h + col.base,
          marginL + col.rub + col.h + col.base + col.taux,
          marginL + col.rub + col.h + col.base + col.taux + col.gains,
        ];

        const tableEndX = marginL + contentW;
        const rowH = 7;

        // Table header
        drawRect(marginL, y, contentW, rowH + 1, HEADER_BG);

        setFont('bold', 7.5);
        textLeft('RUB / العناصر', tableColPositions[0] + 2, y + 5);
        textCenter('H / ساعات العمل', tableColPositions[1] + col.h / 2, y + 5);
        textCenter('Base / الأساس', tableColPositions[2] + col.base / 2, y + 5);
        textCenter('Taux / النسبة', tableColPositions[3] + col.taux / 2, y + 5);
        textCenter('Gains / المستحقات', tableColPositions[4] + col.gains / 2, y + 5);
        textCenter('Retenues / الاقتطاعات', tableColPositions[5] + col.retenues / 2, y + 5);

        // Draw vertical column lines for header
        for (const xp of tableColPositions.slice(1)) {
          drawLine(xp, y, xp, y + rowH + 1);
        }
        drawLine(tableEndX, y, tableEndX, y + rowH + 1);

        y += rowH + 1;

        // ──── Table rows ────

        interface SalaryRow {
          label: string;
          labelAr: string;
          h?: string;
          base?: string;
          taux?: string;
          gain?: string;
          retenue?: string;
          isBold?: boolean;
        }

        const fmt = (n: number) => n > 0 ? n.toFixed(2) : '';
        const fmtAlways = (n: number) => n.toFixed(2);

        const rows: SalaryRow[] = [
          {
            label: 'N.H.T',
            labelAr: 'عدد ساعات العمل',
            h: String(data.hours.normalHours),
            base: fmtAlways(data.rates.grossHourlyWage),
            taux: '',
            gain: fmt(data.earnings.normalHoursAmount),
            retenue: '',
          },
          {
            label: 'PR AN',
            labelAr: 'منحة الأقدمية',
            h: '',
            base: '',
            taux: '0%',
            gain: '',
            retenue: '',
          },
          {
            label: 'JOUR FÉRIÉ',
            labelAr: 'أيام العطل',
            h: String(data.hours.holidayHours || 0),
            base: fmtAlways(data.rates.grossHourlyWage),
            taux: '',
            gain: fmt(data.earnings.holidayHoursAmount),
            retenue: '',
          },
          {
            label: 'S.BR',
            labelAr: 'الأجر الإجمالي',
            h: data.hours.sbrHours !== undefined ? String(data.hours.sbrHours) : String(data.hours.normalHours + (data.hours.holidayHours * 8)),
            base: '',
            taux: '',
            gain: fmtAlways(data.earnings.grossSalary),
            retenue: '',
            isBold: true,
          },
          {
            label: 'P.PANIER',
            labelAr: 'منحة السلة',
            h: '',
            base: '',
            taux: '',
            gain: fmt(data.earnings.basketAllowance),
            retenue: '',
          },
          {
            label: 'P.TRANSP',
            labelAr: 'منحة النقل',
            h: '',
            base: '',
            taux: '',
            gain: fmt(data.earnings.transportAllowance),
            retenue: '',
          },
          {
            label: '',
            labelAr: '',
            h: '', base: '', taux: '', gain: '', retenue: '',
          },
          {
            label: 'C.N.S.S',
            labelAr: 'مساهمة الضمان الاجتماعي',
            h: '',
            base: fmt(Math.min(data.earnings.grossSalary, data.rates.plafondCNSS)),
            taux: `${data.rates.cnssRate}%`,
            gain: '',
            retenue: fmt(data.deductions.cnssContribution),
          },
          {
            label: 'A.M.O',
            labelAr: 'التأمين الإجباري عن المرض',
            h: '',
            base: fmt(data.earnings.grossSalary),
            taux: `${data.rates.amoRate}%`,
            gain: '',
            retenue: fmt(data.deductions.amoContribution),
          },
          {
            label: 'Retenue I.R',
            labelAr: 'الضريبة على الدخل',
            h: '',
            base: fmtAlways(0),
            taux: fmtAlways(0),
            gain: '',
            retenue: fmtAlways(data.deductions.incomeTax),
          },
        ];

        // Draw rows
        const dataStartY = y;

        for (const row of rows) {
          if (row.isBold) {
            setFont('bold', 7);
          } else {
            setFont('normal', 7);
          }

          // RUB column (label + Arabic)
          if (row.label) {
            textLeft(row.label, tableColPositions[0] + 2, y + 3.5);
            setFont('normal', 5.5);
            doc.setTextColor(...GRAY);
            textLeft(row.labelAr, tableColPositions[0] + 2, y + 6);
            doc.setTextColor(...BLACK);
          }

          setFont(row.isBold ? 'bold' : 'normal', 7);

          // H column
          if (row.h) textCenter(row.h, tableColPositions[1] + col.h / 2, y + 4.5);

          // Base column
          if (row.base) textCenter(row.base, tableColPositions[2] + col.base / 2, y + 4.5);

          // Taux column
          if (row.taux) textCenter(row.taux, tableColPositions[3] + col.taux / 2, y + 4.5);

          // Gains column
          if (row.gain) textCenter(row.gain, tableColPositions[4] + col.gains / 2, y + 4.5);

          // Retenues column
          if (row.retenue) textCenter(row.retenue, tableColPositions[5] + col.retenues / 2, y + 4.5);

          y += rowH;
        }

        // Add a few empty rows to fill the table space
        for (let i = 0; i < 3; i++) {
          y += rowH;
        }

        // Draw the outer rectangle and vertical lines for the whole data section
        const totalDataH = y - dataStartY;
        drawRect(marginL, dataStartY, contentW, totalDataH);
        for (const xp of tableColPositions.slice(1)) {
          drawLine(xp, dataStartY, xp, dataStartY + totalDataH);
        }
        drawLine(tableEndX, dataStartY, tableEndX, dataStartY + totalDataH);

        // ════════════════════════════════════════════════════════════════════════════
        // SECTION 5: TOTALS ROW
        // ════════════════════════════════════════════════════════════════════════════

        const totalRowH = 8;
        drawRect(marginL, y, contentW, totalRowH, HEADER_BG);

        setFont('bold', 8);
        textLeft('TOTAUX / المجموع', marginL + 4, y + 5.5);

        // Draw column separators for totals
        for (const xp of tableColPositions.slice(1)) {
          drawLine(xp, y, xp, y + totalRowH);
        }
        drawLine(tableEndX, y, tableEndX, y + totalRowH);

        // Total Gains
        setFont('bold', 8);
        textCenter(fmtAlways(data.totals.totalGains), tableColPositions[4] + col.gains / 2, y + 5.5);

        // Total Retenues
        textCenter(fmtAlways(data.totals.totalDeductions), tableColPositions[5] + col.retenues / 2, y + 5.5);

        y += totalRowH + 3;

        // ════════════════════════════════════════════════════════════════════════════
        // SECTION 6: SUMMARY / NET TO PAY
        // ════════════════════════════════════════════════════════════════════════════

        const summaryH = 44;
        drawRect(marginL, y, contentW, summaryH);

        // Left side: Signature area
        const leftSummaryW = contentW * 0.5;
        setFont('normal', 8);
        textLeft('Visa pour quittance', marginL + 4, y + 8);
        textLeft('توقيع الاستلام', marginL + 4, y + 13);

        // Signature box
        drawRect(marginL + 4, y + 17, leftSummaryW - 12, 22);

        // Vertical separator
        drawLine(marginL + leftSummaryW, y, marginL + leftSummaryW, y + summaryH);

        // Right side: Totals breakdown
        const rightX = marginL + leftSummaryW + 4;
        const rightValX = marginL + contentW - 6;
        const summaryLineH = 7;

        let sy = y + 3;

        setFont('normal', 7.5);
        textLeft('Total des Gains / مجموع المستحقات:', rightX, sy + 4);
        textRight(fmtAlways(data.totals.totalGains) + ' DH', rightValX, sy + 4);
        sy += summaryLineH;

        textLeft('Total des Retenues / مجموع الاقتطاعات:', rightX, sy + 4);
        textRight(fmtAlways(data.totals.totalDeductions) + ' DH', rightValX, sy + 4);
        sy += summaryLineH;

        textLeft('Avance sur Salaire / سلفة الأجر:', rightX, sy + 4);
        textRight(fmtAlways(data.totals.salaryAdvance) + ' DH', rightValX, sy + 4);
        sy += summaryLineH;

        // Separator line before Net
        drawLine(rightX, sy + 1, rightValX, sy + 1);
        sy += 3;

        // NET TO PAY — Highlighted
        drawRect(marginL + leftSummaryW + 2, sy, contentW - leftSummaryW - 4, 12, [245, 245, 220]);

        setFont('bold', 10);
        textLeft('Net à Payer / صافي الأجر:', rightX + 2, sy + 8);

        setFont('bold', 14);
        doc.setTextColor(0, 100, 0);
        textRight(fmtAlways(data.totals.netToPay) + ' DH', rightValX - 2, sy + 8);
        doc.setTextColor(...BLACK);

        y += summaryH + 3;

        // Save
        const safeName = data.employee.employeeName.replace(/\s+/g, '_').toUpperCase();
        const fileName = `${safeName}_${data.period.endDate}.pdf`;
        doc.save(fileName);
        resolve();
      } catch (err) {
        reject(err);
      }
    }, 50);
  });
}

// ─── Build PayslipData from ERP data ────────────────────────────────────────

export async function generateBatchPayslipsPDF(
  dataArray: PayslipData[],
  
  logoDataUrl: string | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const jsPDFModule = await import('jspdf');
        const JsPDFClass = (jsPDFModule.jsPDF || jsPDFModule.default || jsPDFModule) as any;
        const reshaperModule = await import('arabic-persian-reshaper');
        const reshaper = reshaperModule.default || reshaperModule;
        
        const formatArabic = (text: string): string => {
          return reshaper.ArabicShaper.convertArabic(text);
        };

        const doc = new JsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // Load Amiri font for Arabic text
        try {
          const fontRes = await fetch('/fonts/Amiri-Regular.ttf');
          const fontBlob = await fontRes.blob();
          const fontBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1]);
            };
            reader.readAsDataURL(fontBlob);
          });
          doc.addFileToVFS('Amiri-Regular.ttf', fontBase64);
          doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        } catch (e) {
          console.error("Failed to load Arabic font", e);
        }

        for (let i = 0; i < dataArray.length; i++) {
          const data = dataArray[i];
          if (i > 0) doc.addPage();

        const pageW = 210;
        const marginL = 12;
        const marginR = 12;
        const contentW = pageW - marginL - marginR;
        let y = 10;

        // Colors
        const BLACK: [number, number, number] = [0, 0, 0];
        const GRAY: [number, number, number] = [100, 100, 100];
        const LIGHT_GRAY: [number, number, number] = [230, 230, 230];
        const WHITE: [number, number, number] = [255, 255, 255];
        const HEADER_BG: [number, number, number] = [240, 240, 240];

        // ──── Helper functions ────

        function setFont(style: 'normal' | 'bold' = 'normal', size = 9) {
          doc.setFont('helvetica', style);
          doc.setFontSize(size);
          doc.setTextColor(...BLACK);
        }

        function drawRect(x: number, yPos: number, w: number, h: number, fill?: [number, number, number]) {
          if (fill) {
            doc.setFillColor(...fill);
            doc.rect(x, yPos, w, h, 'FD');
          } else {
            doc.rect(x, yPos, w, h, 'S');
          }
        }

        function drawLine(x1: number, y1: number, x2: number, y2: number) {
          doc.setDrawColor(...BLACK);
          doc.setLineWidth(0.3);
          doc.line(x1, y1, x2, y2);
        }

        function textLeft(text: string, x: number, yPos: number) {
          if (containsArabic(text)) {
            const currentFont = doc.getFont();
            doc.setFont('Amiri', 'normal');
            doc.text(formatArabic(text), x, yPos);
            doc.setFont(currentFont.fontName, currentFont.fontStyle);
          } else {
            doc.text(text, x, yPos);
          }
        }

        function textRight(text: string, x: number, yPos: number) {
          if (containsArabic(text)) {
            const currentFont = doc.getFont();
            doc.setFont('Amiri', 'normal');
            doc.text(formatArabic(text), x, yPos, { align: 'right' });
            doc.setFont(currentFont.fontName, currentFont.fontStyle);
          } else {
            doc.text(text, x, yPos, { align: 'right' });
          }
        }

        function textCenter(text: string, x: number, yPos: number) {
          if (containsArabic(text)) {
            const currentFont = doc.getFont();
            doc.setFont('Amiri', 'normal');
            doc.text(formatArabic(text), x, yPos, { align: 'center' });
            doc.setFont(currentFont.fontName, currentFont.fontStyle);
          } else {
            doc.text(text, x, yPos, { align: 'center' });
          }
        }

        // Set default drawing state
        doc.setDrawColor(...BLACK);
        doc.setLineWidth(0.4);

        // ════════════════════════════════════════════════════════════════════════════
        // SECTION 1: HEADER — Logo + Company + Title
        // ════════════════════════════════════════════════════════════════════════════

        const headerH = 38;
        drawRect(marginL, y, contentW, headerH);

        if (logoDataUrl) {
          try {
            const props = doc.getImageProperties(logoDataUrl);
            const ratio = props.width / props.height;
            const logoH = 22;
            const logoW = logoH * ratio;
            doc.addImage(logoDataUrl, 'PNG', marginL + 3, y + 2, logoW, logoH);
          } catch (e) {
            // Logo load failed, skip
          }
        }

        // Company info (right side)
        setFont('bold', 10);
        textRight(COMPANY.nameFr, marginL + contentW - 4, y + 7);
        setFont('normal', 7);
        textRight(COMPANY.addressLine1, marginL + contentW - 4, y + 17);
        textRight(COMPANY.addressLine2, marginL + contentW - 4, y + 27);

        // Title centered
        setFont('bold', 16);
        textCenter('BULLETIN DE PAIE', pageW / 2, y + 34);

        y += headerH + 2;

        // ════════════════════════════════════════════════════════════════════════════
        // SECTION 2: PAY PERIOD
        // ════════════════════════════════════════════════════════════════════════════

        const periodH = 14;
        drawRect(marginL, y, contentW, periodH, HEADER_BG);

        setFont('bold', 8);
        const periodColW = contentW / 4;

        // Period labels
        textLeft('Période de Paie / فترة الأداء', marginL + 3, y + 5);
        textLeft(`Du / من: ${data.period.startDate}`, marginL + 3, y + 11);

        textLeft(`Au / إلى: ${data.period.endDate}`, marginL + periodColW + 3, y + 11);

        textCenter(data.period.quinzaine, marginL + periodColW * 2.5, y + 5);
        textCenter(data.period.month, marginL + periodColW * 2.5, y + 11);

        // Vertical separators
        drawLine(marginL + periodColW, y, marginL + periodColW, y + periodH);
        drawLine(marginL + periodColW * 2, y, marginL + periodColW * 2, y + periodH);
        drawLine(marginL + periodColW * 3, y, marginL + periodColW * 3, y + periodH);

        y += periodH + 2;

        // ════════════════════════════════════════════════════════════════════════════
        // SECTION 3: EMPLOYEE INFORMATION
        // ════════════════════════════════════════════════════════════════════════════

        const empH = 52;
        drawRect(marginL, y, contentW, empH);

        // Section header
        drawRect(marginL, y, contentW, 7, HEADER_BG);
        setFont('bold', 8);
        textCenter('INFORMATIONS EMPLOYÉ / معلومات الموظف', pageW / 2, y + 5);

        y += 8;

        const emp = data.employee;
        const leftCol = marginL + 4;
        const rightCol = marginL + contentW / 2 + 4;
        const valOffset = 42;
        const lineH = 5;

        setFont('normal', 7.5);

        // Left column
        const leftFields = [
          { label: 'Matricule / رقم التسجيل', value: emp.matricule || emp.id.substring(0, 8).toUpperCase() },
          { label: 'Nom & Prénom / الاسم و اللقب', value: emp.employeeName },
          { label: 'Date de Naissance / تاريخ الازدياد', value: emp.dateBirth || '—' },
          { label: "Date d'Embauche / تاريخ التوظيف", value: emp.employmentDate || '—' },
          { label: 'Fonction / الوظيفة', value: emp.position },
        ];

        // Right column
        const rightFields = [
          { label: 'Nationalité / الجنسية', value: emp.nationality || 'Marocaine' },
          { label: 'Situation Familiale / الحالة العائلية', value: emp.familySituation || '—' },
          { label: "Nombre d'Enfants / عدد الأطفال", value: String(emp.childrenCount || 0) },
          { label: 'Mode de Paiement / طريقة الأداء', value: emp.paymentMethod || 'Virement' },
          { label: 'CNSS / رقم الضمان الاجتماعي', value: emp.cnssNumber || '—' },
        ];

        for (let i = 0; i < Math.max(leftFields.length, rightFields.length); i++) {
          const rowY = y + i * lineH + 4;

          if (leftFields[i]) {
            setFont('bold', 7);
            textLeft(leftFields[i].label + ':', leftCol, rowY);
            setFont('normal', 7.5);
            textLeft(leftFields[i].value, leftCol + valOffset, rowY);
          }

          if (rightFields[i]) {
            setFont('bold', 7);
            textLeft(rightFields[i].label + ':', rightCol, rowY);
            setFont('normal', 7.5);
            textLeft(rightFields[i].value, rightCol + valOffset, rowY);
          }
        }

        // Vertical separator
        drawLine(marginL + contentW / 2, y - 1, marginL + contentW / 2, y + empH - 8);

        y += empH - 6;

        // ════════════════════════════════════════════════════════════════════════════
        // SECTION 4: SALARY DETAILS TABLE
        // ════════════════════════════════════════════════════════════════════════════

        const tableStartY = y;

        // Column widths
        const col = {
          rub: 62,
          h: 16,
          base: 26,
          taux: 22,
          gains: 28,
          retenues: 32,
        };

        const tableColPositions = [
          marginL,
          marginL + col.rub,
          marginL + col.rub + col.h,
          marginL + col.rub + col.h + col.base,
          marginL + col.rub + col.h + col.base + col.taux,
          marginL + col.rub + col.h + col.base + col.taux + col.gains,
        ];

        const tableEndX = marginL + contentW;
        const rowH = 7;

        // Table header
        drawRect(marginL, y, contentW, rowH + 1, HEADER_BG);

        setFont('bold', 7.5);
        textLeft('RUB / العناصر', tableColPositions[0] + 2, y + 5);
        textCenter('H / ساعات العمل', tableColPositions[1] + col.h / 2, y + 5);
        textCenter('Base / الأساس', tableColPositions[2] + col.base / 2, y + 5);
        textCenter('Taux / النسبة', tableColPositions[3] + col.taux / 2, y + 5);
        textCenter('Gains / المستحقات', tableColPositions[4] + col.gains / 2, y + 5);
        textCenter('Retenues / الاقتطاعات', tableColPositions[5] + col.retenues / 2, y + 5);

        // Draw vertical column lines for header
        for (const xp of tableColPositions.slice(1)) {
          drawLine(xp, y, xp, y + rowH + 1);
        }
        drawLine(tableEndX, y, tableEndX, y + rowH + 1);

        y += rowH + 1;

        // ──── Table rows ────

        interface SalaryRow {
          label: string;
          labelAr: string;
          h?: string;
          base?: string;
          taux?: string;
          gain?: string;
          retenue?: string;
          isBold?: boolean;
        }

        const fmt = (n: number) => n > 0 ? n.toFixed(2) : '';
        const fmtAlways = (n: number) => n.toFixed(2);

        const rows: SalaryRow[] = [
          {
            label: 'N.H.T',
            labelAr: 'عدد ساعات العمل',
            h: String(data.hours.normalHours),
            base: fmtAlways(data.rates.grossHourlyWage),
            taux: '',
            gain: fmt(data.earnings.normalHoursAmount),
            retenue: '',
          },
          {
            label: 'PR AN',
            labelAr: 'منحة الأقدمية',
            h: '',
            base: '',
            taux: '0%',
            gain: '',
            retenue: '',
          },
          {
            label: 'JOUR FÉRIÉ',
            labelAr: 'أيام العطل',
            h: String(data.hours.holidayHours || 0),
            base: fmtAlways(data.rates.grossHourlyWage),
            taux: '',
            gain: fmt(data.earnings.holidayHoursAmount),
            retenue: '',
          },
          {
            label: 'S.BR',
            labelAr: 'الأجر الإجمالي',
            h: data.hours.sbrHours !== undefined ? String(data.hours.sbrHours) : String(data.hours.normalHours + (data.hours.holidayHours * 8)),
            base: '',
            taux: '',
            gain: fmtAlways(data.earnings.grossSalary),
            retenue: '',
            isBold: true,
          },
          {
            label: 'P.PANIER',
            labelAr: 'منحة السلة',
            h: '',
            base: '',
            taux: '',
            gain: fmt(data.earnings.basketAllowance),
            retenue: '',
          },
          {
            label: 'P.TRANSP',
            labelAr: 'منحة النقل',
            h: '',
            base: '',
            taux: '',
            gain: fmt(data.earnings.transportAllowance),
            retenue: '',
          },
          {
            label: '',
            labelAr: '',
            h: '', base: '', taux: '', gain: '', retenue: '',
          },
          {
            label: 'C.N.S.S',
            labelAr: 'مساهمة الضمان الاجتماعي',
            h: '',
            base: fmt(Math.min(data.earnings.grossSalary, data.rates.plafondCNSS)),
            taux: `${data.rates.cnssRate}%`,
            gain: '',
            retenue: fmt(data.deductions.cnssContribution),
          },
          {
            label: 'A.M.O',
            labelAr: 'التأمين الإجباري عن المرض',
            h: '',
            base: fmt(data.earnings.grossSalary),
            taux: `${data.rates.amoRate}%`,
            gain: '',
            retenue: fmt(data.deductions.amoContribution),
          },
          {
            label: 'Retenue I.R',
            labelAr: 'الضريبة على الدخل',
            h: '',
            base: fmtAlways(0),
            taux: fmtAlways(0),
            gain: '',
            retenue: fmtAlways(data.deductions.incomeTax),
          },
        ];

        // Draw rows
        const dataStartY = y;

        for (const row of rows) {
          if (row.isBold) {
            setFont('bold', 7);
          } else {
            setFont('normal', 7);
          }

          // RUB column (label + Arabic)
          if (row.label) {
            textLeft(row.label, tableColPositions[0] + 2, y + 3.5);
            setFont('normal', 5.5);
            doc.setTextColor(...GRAY);
            textLeft(row.labelAr, tableColPositions[0] + 2, y + 6);
            doc.setTextColor(...BLACK);
          }

          setFont(row.isBold ? 'bold' : 'normal', 7);

          // H column
          if (row.h) textCenter(row.h, tableColPositions[1] + col.h / 2, y + 4.5);

          // Base column
          if (row.base) textCenter(row.base, tableColPositions[2] + col.base / 2, y + 4.5);

          // Taux column
          if (row.taux) textCenter(row.taux, tableColPositions[3] + col.taux / 2, y + 4.5);

          // Gains column
          if (row.gain) textCenter(row.gain, tableColPositions[4] + col.gains / 2, y + 4.5);

          // Retenues column
          if (row.retenue) textCenter(row.retenue, tableColPositions[5] + col.retenues / 2, y + 4.5);

          y += rowH;
        }

        // Add a few empty rows to fill the table space
        for (let i = 0; i < 3; i++) {
          y += rowH;
        }

        // Draw the outer rectangle and vertical lines for the whole data section
        const totalDataH = y - dataStartY;
        drawRect(marginL, dataStartY, contentW, totalDataH);
        for (const xp of tableColPositions.slice(1)) {
          drawLine(xp, dataStartY, xp, dataStartY + totalDataH);
        }
        drawLine(tableEndX, dataStartY, tableEndX, dataStartY + totalDataH);

        // ════════════════════════════════════════════════════════════════════════════
        // SECTION 5: TOTALS ROW
        // ════════════════════════════════════════════════════════════════════════════

        const totalRowH = 8;
        drawRect(marginL, y, contentW, totalRowH, HEADER_BG);

        setFont('bold', 8);
        textLeft('TOTAUX / المجموع', marginL + 4, y + 5.5);

        // Draw column separators for totals
        for (const xp of tableColPositions.slice(1)) {
          drawLine(xp, y, xp, y + totalRowH);
        }
        drawLine(tableEndX, y, tableEndX, y + totalRowH);

        // Total Gains
        setFont('bold', 8);
        textCenter(fmtAlways(data.totals.totalGains), tableColPositions[4] + col.gains / 2, y + 5.5);

        // Total Retenues
        textCenter(fmtAlways(data.totals.totalDeductions), tableColPositions[5] + col.retenues / 2, y + 5.5);

        y += totalRowH + 3;

        // ════════════════════════════════════════════════════════════════════════════
        // SECTION 6: SUMMARY / NET TO PAY
        // ════════════════════════════════════════════════════════════════════════════

        const summaryH = 44;
        drawRect(marginL, y, contentW, summaryH);

        // Left side: Signature area
        const leftSummaryW = contentW * 0.5;
        setFont('normal', 8);
        textLeft('Visa pour quittance', marginL + 4, y + 8);
        textLeft('توقيع الاستلام', marginL + 4, y + 13);

        // Signature box
        drawRect(marginL + 4, y + 17, leftSummaryW - 12, 22);

        // Vertical separator
        drawLine(marginL + leftSummaryW, y, marginL + leftSummaryW, y + summaryH);

        // Right side: Totals breakdown
        const rightX = marginL + leftSummaryW + 4;
        const rightValX = marginL + contentW - 6;
        const summaryLineH = 7;

        let sy = y + 3;

        setFont('normal', 7.5);
        textLeft('Total des Gains / مجموع المستحقات:', rightX, sy + 4);
        textRight(fmtAlways(data.totals.totalGains) + ' DH', rightValX, sy + 4);
        sy += summaryLineH;

        textLeft('Total des Retenues / مجموع الاقتطاعات:', rightX, sy + 4);
        textRight(fmtAlways(data.totals.totalDeductions) + ' DH', rightValX, sy + 4);
        sy += summaryLineH;

        textLeft('Avance sur Salaire / سلفة الأجر:', rightX, sy + 4);
        textRight(fmtAlways(data.totals.salaryAdvance) + ' DH', rightValX, sy + 4);
        sy += summaryLineH;

        // Separator line before Net
        drawLine(rightX, sy + 1, rightValX, sy + 1);
        sy += 3;

        // NET TO PAY — Highlighted
        drawRect(marginL + leftSummaryW + 2, sy, contentW - leftSummaryW - 4, 12, [245, 245, 220]);

        setFont('bold', 10);
        textLeft('Net à Payer / صافي الأجر:', rightX + 2, sy + 8);

        setFont('bold', 14);
        doc.setTextColor(0, 100, 0);
        textRight(fmtAlways(data.totals.netToPay) + ' DH', rightValX - 2, sy + 8);
        doc.setTextColor(...BLACK);

        y += summaryH + 3;

        // Save
        }
        doc.save('Batch_Payslips.pdf');
        resolve();
      } catch (err) {
        reject(err);
      }
    }, 50);
  });
}

// ─── Build PayslipData from ERP data ────────────────────────────────────────


export interface BuildPayslipParams {
  employee: any;          // Raw employee object from Firestore
  workEntries: any[];     // Work entries for this employee in the period
  hrSettings: any;        // Latest HR settings (grossHourlyWage, netHourlyWage, cnss, amoRate, plafondCNSS)
  startDate: string;
  endDate: string;
  applyCap?: boolean;     // Whether to apply the 95.5 hours cap (defaults to false)
}

export function buildPayslipData(params: BuildPayslipParams): PayslipData {
  const { employee: emp, workEntries, hrSettings, startDate, endDate } = params;

  const grossHourlyWage = Number(hrSettings.grossHourlyWage || 0);
  const netHourlyWage = Number(hrSettings.netHourlyWage || 0);
  const cnssRate = Number(hrSettings.cnss || 4.48);
  const amoRate = Number(hrSettings.amoRate || 2.26);
  const plafondCNSS = Number(hrSettings.plafondCNSS || 6000);

  // Parse seniority percentage
  const seniorityStr = emp.seniority || '0%';
  const seniorityRate = parseFloat(seniorityStr.replace('%', '')) || 0;

  // Aggregate hours from work entries
  let totalWorkingHours = 0;
  let totalAdvance = 0;
  let holidayCount = 0;
  let workedHoursExcludingHolidays = 0;
  let allowedHolidayHours = 0;
  let accumulatedHours = 0;

  // Sort work entries chronologically by date to apply capping consistently
  const sortedEntries = [...workEntries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  sortedEntries.forEach((entry: any) => {
    totalAdvance += Number(entry.advanceSalary || 0);

    const isHoliday = entry.isHoliday === true || entry.holidayShift === true || entry.holidayShift === 'Yes';
    const rawValue = Number(entry.totalHours || 0);
    // If rawValue is days (e.g. <= 5), convert to hours by multiplying by 8 (8h per day). If already hours (e.g. 8), keep as is.
    const rawHours = isHoliday ? (rawValue > 0 && rawValue <= 5 ? rawValue * 8 : (rawValue > 0 ? rawValue : 8)) : rawValue;

    totalWorkingHours += rawHours;

    if (isHoliday) {
      holidayCount += (rawValue > 0 && rawValue <= 5 ? rawValue : 1);
    }

    let allowedHours = 0;
    if (params.applyCap && accumulatedHours + rawHours > 95.5) {
      allowedHours = Math.max(0, 95.5 - accumulatedHours);
    } else {
      allowedHours = rawHours;
    }
    accumulatedHours += allowedHours;

    if (isHoliday) {
      const holidayPortion = Math.min(8, allowedHours);
      const normalPortion = allowedHours - holidayPortion;
      allowedHolidayHours += holidayPortion;
      workedHoursExcludingHolidays += normalPortion;
    } else {
      workedHoursExcludingHolidays += allowedHours;
    }
  });

  let sbrHours = workedHoursExcludingHolidays + allowedHolidayHours;

  // Apply new calculation flow when there are holidays and total working hours reach cap (> 95.5 or capped at 95.5/94.5)
  if (params.applyCap !== false && (totalWorkingHours > 95.5 || (holidayCount > 0 && (accumulatedHours >= 94.5 || workedHoursExcludingHolidays + allowedHolidayHours >= 94.5)))) {
    const cappedSBR = 95.5;
    // STEP 1: HolidayCount (calculated above)
    // STEP 2: HolidaysHours = HolidayCount * 8
    const holidaysHours = holidayCount * 8;
    // STEP 3: NHT = SBR - HolidaysHours
    const newNHT = cappedSBR - holidaysHours;

    // STEP 4: Replace NHT value for all downstream calculations
    workedHoursExcludingHolidays = newNHT;
    allowedHolidayHours = holidaysHours;
    sbrHours = cappedSBR;
  }

  const holidayEquivalentHours = allowedHolidayHours;
  const holidayDays = allowedHolidayHours / 8;

  // ── Earnings calculations (using ERP logic) ──
  
  // NHT excludes holidays because holidays are paid separately.
  const nhtGains = workedHoursExcludingHolidays * grossHourlyWage;
  // Jour Férié displays days but calculates gains as 8 hours per day.
  const holidayGains = holidayEquivalentHours * grossHourlyWage;
  
  const seniorityBonus = 0;
  // SBR combines normal worked hours and holiday equivalent hours.
  const grossSalary = nhtGains + holidayGains; // Equivalent to: sbrHours * grossHourlyWage

  // Allowances (from employee record if available)
  const basketAllowance = Number(emp.basketAllowance || 0);
  const transportAllowance = Number(emp.transportAllowance || 0);

  // ── Deductions calculations ──

  const cnssBase = Math.min(grossSalary, plafondCNSS);
  const cnssContribution = cnssBase * (cnssRate / 100);
  const amoContribution = grossSalary * (amoRate / 100);
  const incomeTax = Number(emp.taxReduction || 0);

  // ── Totals ──

  const totalGains = grossSalary + basketAllowance + transportAllowance;
  const totalDeductions = cnssContribution + amoContribution + incomeTax;
  const netToPay = totalGains - totalDeductions - totalAdvance;

  // ── Period info ──

  const start = new Date(startDate);
  const day = start.getDate();
  const quinzaine = day <= 15 ? '1ère Quinzaine / النصف الأول' : '2ème Quinzaine / النصف الثاني';

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  const monthLabel = `${monthNames[start.getMonth()]} ${start.getFullYear()}`;

  return {
    employee: {
      id: emp.id,
      employeeName: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      matricule: emp.id || emp.matricule || '—',
      position: emp.position || 'Employé',
      dateBirth: emp.birthday || emp.dateBirth || '—',
      employmentDate: emp.employmentDate || '—',
      familySituation: emp.familySituation || '—',
      childrenCount: Number(emp.childrenCount || 0),
      paymentMethod: emp.paymentStatus || emp.paymentMethod || 'Virement',
      cnssNumber: emp.cnssNumber || '—',
      nationality: emp.nationality || 'Marocaine',
      cin: emp.cin || '—',
      seniority: seniorityStr,
    },
    period: {
      startDate,
      endDate,
      quinzaine,
      month: monthLabel,
    },
    hours: {
      normalHours: workedHoursExcludingHolidays,
      holidayHours: allowedHolidayHours,
      sbrHours: sbrHours,
    },
    rates: {
      grossHourlyWage,
      netHourlyWage,
      cnssRate,
      amoRate,
      plafondCNSS,
      seniorityRate,
    },
    earnings: {
      normalHoursAmount: nhtGains,
      seniorityBonus,
      holidayHoursAmount: holidayGains,
      grossSalary,
      basketAllowance,
      transportAllowance,
    },
    deductions: {
      cnssContribution,
      amoContribution,
      incomeTax,
    },
    totals: {
      totalGains,
      totalDeductions,
      salaryAdvance: totalAdvance,
      netToPay,
    },
  };
}

// ─── Logo Loader ────────────────────────────────────────────────────────────

export async function loadLogoAsDataUrl(): Promise<string | null> {
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
