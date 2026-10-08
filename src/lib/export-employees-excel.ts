import ExcelJS from 'exceljs';
import { format } from 'date-fns';

export interface EmployeeExportRow {
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  dateOfBirth: string;
  joinDate: string;
  employmentDate: string;
  familySituation: string;
  employeeStatus: string;
  location: string;
  shift: string;
  contractEndDate: string;
  salaryNetto: number;
  salaryBrutto: number;
  rib: string;
  cin: string;
  cnssStatus: string;
  cnss: string;
  matricule: string;
  position: string;
  address: string;
  numberOfChildren: number;
  paymentStatus: string;
  seniority: string;
  incomeTaxDeduction: number;
  status: string;
}

async function populateEmployeeSheet(
  ws: ExcelJS.Worksheet,
  rows: EmployeeExportRow[],
  title: string,
  logoBuffer: ArrayBuffer | null,
  wb: ExcelJS.Workbook
) {
  // Setup page layout
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0
  };

  // 1. Logo Insertion
  if (logoBuffer) {
    try {
      const imageId = wb.addImage({
        buffer: logoBuffer,
        extension: 'png',
      });
      ws.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 168, height: 70 }
      });
    } catch (err) {
      console.error('Failed to embed logo to sheet ' + title, err);
    }
  }

  // 2. Title Row (Row 1)
  const titleRow = ws.getRow(1);
  titleRow.height = 46;
  ws.mergeCells('A1:Z1');
  const titleCell = ws.getCell('A1');
  titleCell.value = title;
  titleCell.font = { bold: true, size: 22, color: { argb: 'FF1B5E20' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // Spacer Row (Row 2)
  ws.getRow(2).height = 10;

  // 3. Define Columns & Headers (Row 3)
  ws.columns = [
    { key: 'firstName', width: 16 },
    { key: 'lastName', width: 16 },
    { key: 'gender', width: 10 },
    { key: 'phone', width: 16 },
    { key: 'dateOfBirth', width: 14 },
    { key: 'joinDate', width: 14 },
    { key: 'employmentDate', width: 18 },
    { key: 'familySituation', width: 18 },
    { key: 'employeeStatus', width: 16 },
    { key: 'location', width: 18 },
    { key: 'shift', width: 12 },
    { key: 'contractEndDate', width: 18 },
    { key: 'salaryNetto', width: 16 },
    { key: 'salaryBrutto', width: 16 },
    { key: 'rib', width: 26 },
    { key: 'cin', width: 14 },
    { key: 'cnssStatus', width: 16 },
    { key: 'cnss', width: 16 },
    { key: 'matricule', width: 14 },
    { key: 'position', width: 18 },
    { key: 'address', width: 32 },
    { key: 'numberOfChildren', width: 18 },
    { key: 'paymentStatus', width: 16 },
    { key: 'seniority', width: 12 },
    { key: 'incomeTaxDeduction', width: 22 },
    { key: 'status', width: 14 }
  ];

  const headerRow = ws.getRow(3);
  headerRow.height = 38;
  headerRow.values = [
    'First Name',
    'Last Name',
    'Gender',
    'Phone Number',
    'Date Of Birth',
    'Join Date',
    'Employment Date',
    'Family Situation',
    'Employee Status',
    'Location',
    'Shift',
    'Contract End Date',
    'Salary Netto',
    'Salary Brutto',
    'RIB',
    'CIN',
    'CNSS Status',
    'CNSS',
    'Matricule',
    'Position',
    'Address',
    'Number of Children',
    'Payment Status',
    'Seniority',
    'Income Tax Deduction',
    'Status'
  ];

  // Style Headers
  for (let i = 1; i <= 26; i++) {
    const cell = headerRow.getCell(i);
    cell.font = { bold: true, size: 10, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA5D6A7' } }; // Light green background
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    };
  }

  // 4. Freeze Pane & Auto-Filter
  ws.views = [{ state: 'frozen', ySplit: 3 }];
  ws.autoFilter = { from: 'A3', to: 'Z3' };

  // 5. Add Data Rows
  rows.forEach((r, idx) => {
    const isAlt = idx % 2 === 1;
    const row = ws.addRow({
      firstName: r.firstName || '',
      lastName: r.lastName || '',
      gender: r.gender || '',
      phone: r.phone || '',
      dateOfBirth: r.dateOfBirth || '',
      joinDate: r.joinDate || '',
      employmentDate: r.employmentDate || '',
      familySituation: r.familySituation || '',
      employeeStatus: r.employeeStatus || '',
      location: r.location || '',
      shift: r.shift || '',
      contractEndDate: r.contractEndDate || '',
      salaryNetto: r.salaryNetto != null ? Number(r.salaryNetto) : 0,
      salaryBrutto: r.salaryBrutto != null ? Number(r.salaryBrutto) : 0,
      rib: r.rib || '',
      cin: r.cin || '',
      cnssStatus: r.cnssStatus || '',
      cnss: r.cnss || '',
      matricule: r.matricule || '',
      position: r.position || '',
      address: r.address || '',
      numberOfChildren: r.numberOfChildren != null ? Number(r.numberOfChildren) : 0,
      paymentStatus: r.paymentStatus || '',
      seniority: r.seniority || '',
      incomeTaxDeduction: r.incomeTaxDeduction != null ? Number(r.incomeTaxDeduction) : 0,
      status: (r.status || '').toUpperCase()
    });

    // Auto-adjust row height based on address text length
    const addressLines = (r.address || '').split('\n').length;
    row.height = Math.max(22, 16 + addressLines * 12);

    for (let i = 1; i <= 26; i++) {
      const cell = row.getCell(i);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? 'FFE8F5E9' : 'FFFFFFFF' } }; // Striped green/white rows
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };

      const key = ws.columns[i - 1].key;
      cell.font = { size: 9 };

      // Center-align code-like, status and date columns
      if (
        key === 'gender' ||
        key === 'phone' ||
        key === 'dateOfBirth' ||
        key === 'joinDate' ||
        key === 'employmentDate' ||
        key === 'employeeStatus' ||
        key === 'shift' ||
        key === 'contractEndDate' ||
        key === 'cin' ||
        key === 'cnssStatus' ||
        key === 'cnss' ||
        key === 'matricule' ||
        key === 'paymentStatus' ||
        key === 'seniority' ||
        key === 'status'
      ) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (key === 'address') {
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      } else if (key === 'salaryNetto' || key === 'salaryBrutto' || key === 'incomeTaxDeduction') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0.00" DH"';
      } else if (key === 'numberOfChildren') {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.numFmt = '#,##0';
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }

      // Status Formatting
      if (key === 'status') {
        const val = String(cell.value || '').toUpperCase();
        if (val === 'ACTIVE') {
          cell.font = { size: 9, bold: true, color: { argb: 'FF2E7D32' } }; // green text
        } else if (val === 'INACTIVE') {
          cell.font = { size: 9, bold: true, color: { argb: 'FFC62828' } }; // red text
        }
      }
    }
  });

  // 6. Auto-fit column widths
  ws.columns.forEach(col => {
    let maxLen = col.header ? String(col.header).length : 12;
    if (col.key === 'address') {
      col.width = 35; // Nice cap for address
      return;
    }
    if (col.eachCell) {
      col.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
        // Skip title row and spacer row for length check
        if (rowNumber <= 2) return;
        if (cell.value) {
          let str = String(cell.value);
          if (typeof cell.value === 'number') {
            str = cell.value.toLocaleString();
          }
          if (str.length > maxLen) {
            maxLen = str.length;
          }
        }
      });
    }
    col.width = Math.min(Math.max(maxLen + 4, 10), 30);
  });
}

export async function exportEmployeesExcel(rows: EmployeeExportRow[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const seasonalSheet = wb.addWorksheet('Seasonal Employees');
  const fixedSheet = wb.addWorksheet('Fixed Employees');

  // Set default active tab
  wb.views = [
    {
      x: 0, y: 0, width: 10000, height: 20000,
      firstSheet: 0, activeTab: 0,
      visibility: 'visible'
    }
  ];

  // Fetch logo once
  let logoBuffer: ArrayBuffer | null = null;
  try {
    const response = await fetch('/FFI_main.png');
    const blob = await response.blob();
    logoBuffer = await blob.arrayBuffer();
  } catch (err) {
    console.error('Failed to load logo for Excel export', err);
  }

  // Filter rows
  const fixedRows = rows.filter(r => (r.employeeStatus || '').startsWith('Fixed'));
  const seasonalRows = rows.filter(r => (r.employeeStatus || '') === 'Seasonal');

  // Populate sheets
  await populateEmployeeSheet(seasonalSheet, seasonalRows, 'Seasonal Employees', logoBuffer, wb);
  await populateEmployeeSheet(fixedSheet, fixedRows, 'Fixed Employees', logoBuffer, wb);

  // Write file
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `HR-Employees-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
