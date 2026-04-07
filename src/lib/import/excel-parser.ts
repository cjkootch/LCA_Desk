import * as XLSX from "xlsx";

/**
 * Parses an Excel file and extracts expenditure, employment, and capacity
 * development records. Auto-detects the LCS Secretariat v4.1 template by
 * checking for known sheet names and header positions.
 */

export interface ParsedImportData {
  format: "secretariat_v4" | "generic";
  generalInfo: {
    companyName?: string;
    companyType?: string;
    reportingPeriod?: string;
    reportingYear?: string;
  } | null;
  expenditures: Record<string, string>[];
  employment: Record<string, string>[];
  capacity: Record<string, string>[];
  warnings: string[];
}

// Column headers in the Secretariat v4.1 template (row 9, 0-indexed row 8)
const EXPENDITURE_HEADERS = [
  "Type of Item Procured",
  "Related Sector",
  "Description of Good/Service",
  "Supplier Name",
  "Sole Source Code",
  "Supplier Certificate ID",
  "Actual Payments made during reporting period",
  "Outstanding Payment",
  "Projection for Next Reporting Period",
  "Method of Payment",
  "Supplier\u2019s (Recipient\u2019s) Bank",
  "Location of Bank (Country)",
  "Currency of Payment",
];

const EMPLOYMENT_HEADERS = [
  "Job Title",
  "Employment Category",
  "Employment Classification",
  "Related Company",
  "Total Number of Employees",
  "Number of Guyanese Employed",
  "Total Remuneration Paid",
  "Total Remuneration Paid to Guyanese Only",
];

const CAPACITY_HEADERS = [
  "Activity",
  "Category",
  "Participant Type",
  "Number of Guyanese Participants Only",
  "Total Number of Participants",
  "Start Date",
  "Duration of Activity",
  "Cost to Participants",
  "Expenditure on Capacity Building",
];

// Map Secretariat template headers → our DB field names
const EXPENDITURE_FIELD_MAP: Record<string, string> = {
  "Type of Item Procured": "type_of_item_procured",
  "Related Sector": "related_sector",
  "Description of Good/Service": "description",
  "Supplier Name": "supplier_name",
  "Sole Source Code": "sole_source_code",
  "Supplier Certificate ID": "supplier_certificate_id",
  "Actual Payments made during reporting period": "actual_payment",
  "Outstanding Payment": "outstanding_payment",
  "Projection for Next Reporting Period": "projection",
  "Method of Payment": "payment_method",
  "Supplier\u2019s (Recipient\u2019s) Bank": "supplier_bank",
  "Location of Bank (Country)": "bank_location",
  "Currency of Payment": "currency",
};

const EMPLOYMENT_FIELD_MAP: Record<string, string> = {
  "Job Title": "job_title",
  "Employment Category": "employment_category",
  "Employment Classification": "classification",
  "Related Company": "related_company",
  "Total Number of Employees": "total_employees",
  "Number of Guyanese Employed": "guyanese_employed",
  "Total Remuneration Paid": "remuneration",
  "Total Remuneration Paid to Guyanese Only": "remuneration_guyanese",
};

const CAPACITY_FIELD_MAP: Record<string, string> = {
  "Activity": "activity",
  "Category": "category",
  "Participant Type": "participant_type",
  "Number of Guyanese Participants Only": "guyanese_participants",
  "Total Number of Participants": "total_participants",
  "Start Date": "start_date",
  "Duration of Activity": "duration_days",
  "Cost to Participants": "cost_to_participants",
  "Expenditure on Capacity Building": "expenditure_on_capacity",
};

function findSheetByKeyword(workbook: XLSX.WorkBook, keywords: string[]): XLSX.WorkSheet | null {
  for (const name of workbook.SheetNames) {
    const lower = name.toLowerCase();
    if (keywords.some(k => lower.includes(k))) {
      return workbook.Sheets[name];
    }
  }
  return null;
}

function findHeaderRow(sheet: XLSX.WorkSheet, expectedHeaders: string[]): number {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  // Search first 35 rows for the header row
  for (let r = 0; r <= Math.min(range.e.r, 35); r++) {
    const firstCell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    if (!firstCell) continue;
    const val = String(firstCell.v || "").trim();
    // Check if this row matches any expected header
    if (expectedHeaders.some(h => val.toLowerCase().startsWith(h.toLowerCase().slice(0, 10)))) {
      return r;
    }
  }
  return -1;
}

function extractRows(
  sheet: XLSX.WorkSheet,
  headerRow: number,
  fieldMap: Record<string, string>
): Record<string, string>[] {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const results: Record<string, string>[] = [];

  // Read header values
  const headers: string[] = [];
  for (let c = 0; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow, c })];
    headers.push(cell ? String(cell.v || "").trim() : "");
  }

  // Map headers to field names
  const fieldNames: (string | null)[] = headers.map(h => {
    // Exact match
    if (fieldMap[h]) return fieldMap[h];
    // Fuzzy match — check if header starts with a known key
    for (const [key, field] of Object.entries(fieldMap)) {
      if (h.toLowerCase().startsWith(key.toLowerCase().slice(0, 15))) return field;
    }
    return null;
  });

  // Extract data rows
  for (let r = headerRow + 1; r <= range.e.r; r++) {
    const row: Record<string, string> = {};
    let hasData = false;

    for (let c = 0; c <= range.e.c; c++) {
      const field = fieldNames[c];
      if (!field) continue;
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell) {
        const val = String(cell.v ?? "").trim();
        if (val) {
          row[field] = val;
          hasData = true;
        }
      }
    }

    if (hasData) results.push(row);
  }

  return results;
}

function extractGeneralInfo(sheet: XLSX.WorkSheet): ParsedImportData["generalInfo"] {
  const info: ParsedImportData["generalInfo"] = {};
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

  for (let r = 0; r <= Math.min(range.e.r, 20); r++) {
    const labelCell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
    const valueCell = sheet[XLSX.utils.encode_cell({ r, c: 5 })]; // Values in column F
    if (!labelCell) continue;
    const label = String(labelCell.v || "").toLowerCase();
    const value = valueCell ? String(valueCell.v || "").trim() : "";

    if (label.includes("name of company") && value) info.companyName = value;
    if (label.includes("company type") && value) info.companyType = value;
    if (label.includes("reporting period") && value) info.reportingPeriod = value;
    if (label.includes("reporting year") && value) info.reportingYear = value;
  }

  return Object.keys(info).length > 0 ? info : null;
}

export function parseExcelImport(buffer: ArrayBuffer): ParsedImportData {
  const workbook = XLSX.read(buffer, { type: "array" });
  const warnings: string[] = [];

  // Detect if this is the Secretariat v4.1 template
  const sheetNames = workbook.SheetNames.map(s => s.toLowerCase());
  const hasExpenditure = sheetNames.some(s => s.includes("expenditure"));
  const hasEmployment = sheetNames.some(s => s.includes("employment"));
  const hasBackground = sheetNames.some(s => s.includes("background"));
  const hasGeneralInfo = sheetNames.some(s => s.includes("general"));
  const isSecretariatTemplate = (hasExpenditure && hasEmployment) || hasBackground;

  if (isSecretariatTemplate) {
    // ── Parse Secretariat v4.1 template ──
    let generalInfo: ParsedImportData["generalInfo"] = null;
    const expenditures: Record<string, string>[] = [];
    const employment: Record<string, string>[] = [];
    const capacity: Record<string, string>[] = [];

    // General Info
    if (hasGeneralInfo) {
      const sheet = findSheetByKeyword(workbook, ["general"]);
      if (sheet) generalInfo = extractGeneralInfo(sheet);
    }

    // Expenditure
    const expSheet = findSheetByKeyword(workbook, ["expenditure"]);
    if (expSheet) {
      const headerRow = findHeaderRow(expSheet, EXPENDITURE_HEADERS);
      if (headerRow >= 0) {
        expenditures.push(...extractRows(expSheet, headerRow, EXPENDITURE_FIELD_MAP));
      } else {
        warnings.push("Expenditure sheet found but header row not detected");
      }
    }

    // Employment
    const empSheet = findSheetByKeyword(workbook, ["employment"]);
    if (empSheet) {
      const headerRow = findHeaderRow(empSheet, EMPLOYMENT_HEADERS);
      if (headerRow >= 0) {
        employment.push(...extractRows(empSheet, headerRow, EMPLOYMENT_FIELD_MAP));
      } else {
        warnings.push("Employment sheet found but header row not detected");
      }
    }

    // Capacity Development
    const capSheet = findSheetByKeyword(workbook, ["capacity"]);
    if (capSheet) {
      const headerRow = findHeaderRow(capSheet, CAPACITY_HEADERS);
      if (headerRow >= 0) {
        capacity.push(...extractRows(capSheet, headerRow, CAPACITY_FIELD_MAP));
      } else {
        warnings.push("Capacity Development sheet found but header row not detected");
      }
    }

    return {
      format: "secretariat_v4",
      generalInfo,
      expenditures,
      employment,
      capacity,
      warnings,
    };
  }

  // ── Generic Excel: try first sheet ──
  warnings.push("File does not match Secretariat v4.1 template — attempting generic import");
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { defval: "" });

  // Guess the type based on column names
  const firstRow = json[0] || {};
  const cols = Object.keys(firstRow).map(c => c.toLowerCase());

  if (cols.some(c => c.includes("supplier") || c.includes("payment") || c.includes("expenditure"))) {
    return { format: "generic", generalInfo: null, expenditures: json, employment: [], capacity: [], warnings };
  }
  if (cols.some(c => c.includes("job") || c.includes("employee") || c.includes("guyanese"))) {
    return { format: "generic", generalInfo: null, expenditures: [], employment: json, capacity: [], warnings };
  }
  if (cols.some(c => c.includes("activity") || c.includes("training") || c.includes("capacity"))) {
    return { format: "generic", generalInfo: null, expenditures: [], employment: [], capacity: json, warnings };
  }

  // Can't determine — return as expenditure by default
  return { format: "generic", generalInfo: null, expenditures: json, employment: [], capacity: [], warnings };
}
