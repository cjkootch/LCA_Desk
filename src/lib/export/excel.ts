import * as XLSX from "xlsx";
import type { ReportExportData } from "@/types/reporting.types";

/**
 * Generates the official Local Content Half-Yearly Expenditure, Employment,
 * and Capacity Development Report — Version 4.0 template format.
 *
 * 6 tabs: Background, General Information, Expenditure, Employment,
 * Capacity Development, Related Sector
 */

// ─── RELATED SECTOR (dropdown values) ───────────────────────────────
const RELATED_SECTORS = [
  "Rental of Office Space",
  "Accommodation Services (Apartments & Houses)",
  "Equipment Rental",
  "Surveying",
  "Pipe Welding (Onshore)",
  "Pipe Sand Blasting and Coating (Onshore)",
  "Construction Work for Buildings (Onshore)",
  "Structural Fabrication",
  "Waste Management (Non-Hazardous)",
  "Waste Management (Hazardous)",
  "Storage Services",
  "Janitorial and Laundry Services",
  "Catering Services",
  "Food Supply",
  "Admin Support & Facilities Management Services",
  "Immigration Support Services",
  "Work Permit, Visas Applications, Visas on arrival and In-water Activity Permit",
  "Laydown Yard Facilities",
  "Customs Brokerage Services",
  "Export Packaging",
  "Pest Control Extermination Services",
  "Cargo Management/ Monitoring",
  "Ship & Rig Chandlery Services",
  "Borehole Testing Services",
  "Environment Services & Studies",
  "Transportation Services: Trucking",
  "Transportation Services: Ground Transportation",
  "Metrology Services",
  "Ventilation (private, commercial, industrial)",
  "Industrial Cleaning Services (Onshore)",
  "Security Services",
  "ICT-Network Installation, Support Services",
  "Manpower and Crewing Services",
  "Dredging Services",
  "Local Insurance Services",
  "Accounting Services",
  "Local Legal Services",
  "Medical Services",
  "Aviation Support Services",
  "Engineering and Machining",
  "Local Marketing & Advertising Services (PR)",
  "Other",
  "NDE and NDT",
  "Scaffolding and/or Rope Access Services",
  "Geographical Information and Data Services",
  "Offshore Paint",
  "Training",
  "CCU",
  "HSSE Supplies",
  "Offshore Pipe Coating and Insulation",
  "ROV Services",
  "Subsea Services",
  "MPSV services",
  "Freight Forwarding",
  "Inspection/Certification Services",
  "Marine Lubricants",
  "Commodity Chemicals",
  "Fuel Supply",
  "Industrial Supplies",
  "Lab Supplies",
  "Lab Testing Services",
  "Tank and/or Cleaning Services",
  "Valve Supplies",
  "Architectural and Engineering",
  "Project Management and Supervision",
  "ISO Consultancy and Certification Services.",
  "Supply Vessels",
  "Rigging",
  "Business and Management Consultancy",
];

// ─── BACKGROUND TAB ─────────────────────────────────────────────────
function buildBackgroundSheet(): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    // Row 1 (A2 in original — 0-indexed here, will be row 2 in sheet)
    [],
    ["Local Content Half-Yearly Report"],
    ["Local Content Half-Yearly Expenditure, Employment, and Capacity Development Report"],
    ["Background"],
    [],
    [
      "The Local Content Act No. 18 of 2021 obligates Contractors, Sub-Contractors, or Licensees to submit a local content report to the Secretariat, within thirty days after the end of each half calendar year. This report, referred to as the Local Content Half-Yearly Report, is intended to outline to the Minister and the Secretariat, inter alia:",
    ],
    [
      "(a)",
      "the Contractor\u2019s, Sub-Contractor\u2019s, or Licensee\u2019s compliance with the approved minimum local content levels identified in the First Schedule of the Act;",
    ],
    [
      "(b)",
      "employment and training activities for the reporting period including the number and percentages of managerial, technical and non-technical staff;",
    ],
    [
      "(c)",
      "a comparative analysis of the Employment Sub-Plan included in the approved Local Content Annual Plan, and the employment and training activities to monitor compliance;",
    ],
    [
      "(d)",
      "the number of Guyanese Nationals employed during the reporting period, their job descriptions and salary scales;",
    ],
    ["(e)", "procurement activities for the reporting period;"],
    [
      "(f)",
      "a comparative analysis of the Procurement Sub-Plan included in the approved Local Content Annual Plan, and the procurement activities to monitor compliance;",
    ],
    [
      "(g)",
      "the number of Guyanese nationals or Guyanese companies which supplied goods and provided services to the Contractor, Sub-Contractor or Licensee during the reporting period.",
    ],
    [
      "(h)",
      "local capacity development activities for the reporting period; and",
    ],
    [
      "(i)",
      "a comparative analysis of the Capacity Development Sub-Plan and the capacity development activities to monitor compliance.",
    ],
    [],
    [
      "The Local Content Half-Yearly Report shall be constituted of two (2) parts, that is, i) a Local Content Half-Yearly Comparative Analysis Report, and ii) a Local Content Half-Yearly Expenditure, Employment and Capacity Development Report. Note that the information required to be presented in the Local Content Half-Yearly Comparative Analysis Report is outlined in the Local Content Half-Yearly Reporting Guideline.",
    ],
    [],
    [
      "This document is the template for the Half-Yearly Expenditure, Employment and Capacity Development Report and has been published by the Local Content Secretariat to facilitate submission of the Local Content Half-Yearly Report by Contractors and Sub-Contractors operating in Guyana\u2019s petroleum sector.",
    ],
    [],
    [
      "Contractors, Sub-Contractors or Licensees submitting the Local Content Half-Yearly Report to the Local Content Secretariat are required to submit the information requested in this template along with the Comparative Analysis Report. In this template, reporting information is being requested under five (5) tabs, that is, General Information, Expenditure, Employment, Capacity Development, and New Revised Projected Expenditure. Below is a description of each tab.",
    ],
    [],
    [
      "General Information:",
      "",
      "",
      "This tab captures information regarding the Contractor, Sub-Contractor or Licensee submitting the report to the Secretariat.",
    ],
    [
      "Expenditure:",
      "",
      "",
      "Contractors, Sub-Contractors, and Licensees are required to enter in this tab, information relating to all expenditures on the procurement of goods and services to support petroleum operations in Guyana, during the reporting period.",
    ],
    [
      "Employment:",
      "",
      "",
      "Contractors, Sub-Contractors, and Licensees are required to enter in this tab, information relating to the employment of persons to support petroleum operations in Guyana, during the reporting period.",
    ],
    [
      "Capacity Development:",
      "",
      "",
      "Contractors, Sub-Contractors and Licensees are required to enter in this tab, information relating to the training of Guyanese nationals and Guyanese companies, aimed at building capacity within the local petroleum sector, during the reporting period. Information relating to all training of individuals employed by the Contractor, individuals seeking employment within the petroleum sector, and employees of suppliers within the local petroleum sector, during the reporting period, are required to be submitted.",
    ],
    [],
    [
      "This report is required to be submitted along with the Local Content Comparative Analysis Report accompanied by a Notice of Submission of Local Content Half-Yearly Report, to the Secretariat. This report is required to be submitted in Microsoft Excel format subject to subsection 4.2(e) of the Local Content Half-Yearly Report Submission Guideline.",
    ],
    [],
    [
      "The information submitted herein shall be treated as secret and confidential in accordance with section 22 of the Act. As such, Contractors, Sub-Contractors and Licensees are required to submit herein, true and accurate information. Contractors, Sub-Contractors and Licensees are reminded that subject to section 23(1) of the Act, a person who submits or causes to be submitted a local content report pursuant to the Act knowing, or ought reasonably to have known, that the submission is false or misleading, commits an offence under the Act.",
    ],
    [],
    [
      "All capitalized terms not otherwise defined in this document or the relevant Guideline published by the Secretariat, shall have the meanings ascribed to them in the Laws of Guyana. In this document, unless the context otherwise requires, words in the singular shall include the plural, and words in the plural shall include the singular.",
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Merges matching template
  ws["!merges"] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } }, // Row 2: title
    { s: { r: 2, c: 0 }, e: { r: 2, c: 13 } }, // Row 3: subtitle
    { s: { r: 3, c: 0 }, e: { r: 3, c: 13 } }, // Row 4: "Background"
    { s: { r: 5, c: 0 }, e: { r: 5, c: 13 } }, // Row 6: intro paragraph
    { s: { r: 16, c: 0 }, e: { r: 16, c: 13 } }, // Row 17: two parts
    { s: { r: 18, c: 0 }, e: { r: 18, c: 13 } }, // Row 19: template intro
    { s: { r: 20, c: 0 }, e: { r: 20, c: 13 } }, // Row 21: five tabs
    { s: { r: 27, c: 0 }, e: { r: 27, c: 13 } }, // Row 28: submit
    { s: { r: 29, c: 0 }, e: { r: 29, c: 13 } }, // Row 30: confidential
    { s: { r: 31, c: 0 }, e: { r: 31, c: 13 } }, // Row 32: definitions
  ];

  return ws;
}

// ─── GENERAL INFORMATION TAB ─────────────────────────────────────────
function buildGeneralInfoSheet(data: ReportExportData): XLSX.WorkSheet {
  const periodLabel =
    data.period.report_type === "half_yearly_h1" ? "H1" : "H2";
  const companyType = data.entity.company_type
    ? data.entity.company_type.charAt(0).toUpperCase() +
      data.entity.company_type.slice(1)
    : "";

  const rows: (string | number)[][] = [
    [],
    ["Local Content Half-Yearly Report"],
    [
      "Local Content Half-Yearly Expenditure, Employment, and Capacity Development Report",
    ],
    ["General Information"],
    [],
    [],
    [
      "Name of Company Submitting Report:",
      "",
      "",
      "",
      "",
      data.entity.legal_name,
    ],
    ["Company Type:", "", "", "", "", companyType],
    [
      "Reporting Period:",
      "",
      "",
      "",
      "",
      `${periodLabel} ${data.period.fiscal_year || ""}`,
    ],
    [
      "Reporting Year:",
      "",
      "",
      "",
      "",
      data.period.fiscal_year?.toString() || "",
    ],
    [
      "Date:",
      "",
      "",
      "",
      "",
      new Date().toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    ],
    ["Co-Venturers", "", "", "", "", ""],
    [
      "Name of Company Head or Duly Authorized Representative:",
      "",
      "",
      "",
      "",
      data.entity.contact_name || "",
    ],
    [
      "Designation of Company Head or Duly Authorized Representative:",
      "",
      "",
      "",
      "",
      "",
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Merges matching template: labels in A-E, values in F-J
  ws["!merges"] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }, // Title
    { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } }, // Subtitle
    { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } }, // "General Information"
    { s: { r: 6, c: 0 }, e: { r: 6, c: 4 } }, // Label
    { s: { r: 6, c: 5 }, e: { r: 6, c: 9 } }, // Value
    { s: { r: 7, c: 0 }, e: { r: 7, c: 4 } },
    { s: { r: 7, c: 5 }, e: { r: 7, c: 9 } },
    { s: { r: 8, c: 0 }, e: { r: 8, c: 4 } },
    { s: { r: 8, c: 5 }, e: { r: 8, c: 9 } },
    { s: { r: 9, c: 0 }, e: { r: 9, c: 4 } },
    { s: { r: 9, c: 5 }, e: { r: 9, c: 9 } },
    { s: { r: 10, c: 0 }, e: { r: 10, c: 4 } },
    { s: { r: 10, c: 5 }, e: { r: 10, c: 9 } },
    { s: { r: 11, c: 0 }, e: { r: 11, c: 4 } },
    { s: { r: 11, c: 5 }, e: { r: 11, c: 9 } },
    { s: { r: 12, c: 0 }, e: { r: 12, c: 4 } },
    { s: { r: 12, c: 5 }, e: { r: 12, c: 9 } },
    { s: { r: 13, c: 0 }, e: { r: 13, c: 4 } },
    { s: { r: 13, c: 5 }, e: { r: 13, c: 9 } },
  ];

  return ws;
}

// ─── EXPENDITURE TAB ─────────────────────────────────────────────────
function buildExpenditureSheet(
  expenditures: ReportExportData["expenditures"],
  sectorCategories: ReportExportData["sectorCategories"]
): XLSX.WorkSheet {
  const getCategoryName = (id: string) => {
    const cat = sectorCategories.find((c) => c.id === id);
    return cat ? cat.name : "";
  };

  const rows: (string | number)[][] = [
    [],
    ["Local Content Half-Yearly Report"],
    [
      "Local Content Half-Yearly Expenditure, Employment, and Capacity Development Report",
    ],
    ["Expenditure Sub-Report"],
    [],
    [
      "Contractors, Sub-Contractors and Licensees are required to enter in the table below, information relating to all expenditure on the procurement of goods and services to support petroleum operations in Guyana, during the reporting period. Kindly hover over each heading to reveal its description.",
    ],
    [],
    [],
    // Row 9: Column headers — exact match to template
    [
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
    ],
  ];

  // Data rows
  for (const e of expenditures) {
    rows.push([
      e.description || "",
      getCategoryName(e.sector_category_id),
      e.description || "",
      e.supplier_name,
      e.sole_source_code || "",
      e.supplier_lcs_cert_id || "",
      e.amount_local,
      "",
      "",
      e.payment_method || "",
      "",
      "",
      e.currency_code || "GYD",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Merges for header rows
  ws["!merges"] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } }, // Title
    { s: { r: 2, c: 0 }, e: { r: 2, c: 12 } }, // Subtitle
    { s: { r: 3, c: 0 }, e: { r: 3, c: 12 } }, // "Expenditure Sub-Report"
    { s: { r: 5, c: 0 }, e: { r: 5, c: 12 } }, // Instructions
  ];

  return ws;
}

// ─── EMPLOYMENT TAB ──────────────────────────────────────────────────
function buildEmploymentSheet(
  employment: ReportExportData["employment"]
): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    [],
    ["Local Content Half-Yearly Report"],
    [
      "Local Content Half-Yearly Expenditure, Employment, and Capacity Development Report",
    ],
    ["Employment Sub-Report"],
    [],
    [
      "Contractors, Sub-Contractors and Licensees are required to enter in the table below, information relating to the employment of persons to support petroleum operations in Guyana, during the reporting period. Importantly, subject to section (2) (i) under Employment Sub-Plan in the Second Schedule of the Act, Contractors, Sub-Contractor and Licensees are required to indicate the related Employment Category, that is, Managerial, Technical, or Non-Technical. Kindly hover over the each heading to reveal its description.",
    ],
    [
      "Additionally, Contractors, Sub-Contractors and Licensees are required to specify the Employment Classification related to each job title. The Employment Classification follows the International Standard Classification of Occupations, 2008 (ISCO-08) published by the International Labour Organization (ILO).",
    ],
    [],
    // Row 9: Column headers — exact match to template
    [
      "Job Title",
      "Employment Category",
      "Employment Classification",
      "Related Company",
      "Total Number of Employees",
      "Number of Guyanese Employed",
      "Total Remuneration Paid",
      "Total Remuneration Paid to Guyanese Only",
    ],
  ];

  const CATEGORY_MAP: Record<string, string> = {
    managerial: "Managerial",
    technical: "Technical",
    non_technical: "Non-Technical",
  };

  for (const e of employment) {
    rows.push([
      e.job_title,
      CATEGORY_MAP[e.position_type] || e.position_type,
      e.isco_08_code || "",
      "",
      e.headcount,
      e.is_guyanese ? e.headcount : 0,
      e.total_remuneration_local || "",
      e.is_guyanese ? (e.total_remuneration_local || "") : "",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws["!merges"] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, // Title
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } }, // Subtitle
    { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } }, // "Employment Sub-Report"
    { s: { r: 5, c: 0 }, e: { r: 5, c: 7 } }, // Instructions para 1
    { s: { r: 6, c: 0 }, e: { r: 6, c: 7 } }, // Instructions para 2
  ];

  return ws;
}

// ─── CAPACITY DEVELOPMENT TAB ────────────────────────────────────────
function buildCapacitySheet(
  capacity: ReportExportData["capacity"]
): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    [],
    ["Local Content Half-Yearly Report"],
    [
      "Local Content Half-Yearly Expenditure, Employment, and Capacity Development Report",
    ],
    ["Capacity Development Sub-Report"],
    [],
    [
      "Contractors, Sub-Contractors, and Licensees are required to enter in the table below, information relating to all capacity development activities undertaken during the reporting period. These activities shall include but not be limited to all:",
    ],
    [
      "1. Training and mentoring activities undertaken to build capacity within the sector;",
    ],
    ["2. Scholarships awarded;"],
    [
      "3. Technical or other financial support given to local educational institutions aimed at building capacity within the local petroleum sector;",
    ],
    [
      "4. Training and other capacity development of individuals employed by the Contractor, Sub-Contractor or Licensee;",
    ],
    [
      "5. Training and other capacity development of individuals seeking employment within the petroleum sector;",
    ],
    [
      "6. Capacity development of employees of suppliers within the local petroleum sector; and",
    ],
    [
      "7. Capacity development feedback or stakeholder dialogue opportunities provided to suppliers engaged for the procurement of goods and services.",
    ],
    [],
    [],
    [
      "Within the table, Contractors, Sub-Contractors and Licensees are required to select from a drop-down menu, the Participant Type for each capacity development activity undertaken during the reporting period. The following is a description of each Participant Type:",
    ],
    [
      "Guyanese (Internal):",
      "Select this option if ONLY Guyanese nationals employed by the Contractor, Sub-Contractor or Licensee were part of the capacity development activity.",
    ],
    [
      "Guyanese (External):",
      "Select this option if ONLY Guyanese nationals NOT employed by the Contractor, Sub-Contractor or Licensee at the time the activity was undertaken, were part of the said activity.",
    ],
    [
      "Non-Guyanese (Internal):",
      "Select this option if ONLY Non-Guyanese nationals employed by the Contractor, Sub-Contractor or Licensee were part of the capacity development activity.",
    ],
    [
      "Non-Guyanese (External):",
      "Select this option if ONLY Non-Guyanese nationals NOT employed by the Contractor, Sub-Contractor or Licensee at the time the activity was undertaken, were part of the said activity.",
    ],
    [
      "Mixed (Internal):",
      "Select this option if BOTH Guyanese nationals and Non-Guyanese nationals employed by the Contractor, Sub-Contractor or Licensee at the time activity was undertaken, were part of the said activity.",
    ],
    [
      "Mixed (External):",
      "Select this option if BOTH Guyanese nationals and Non-Guyanese nationals NOT employed by the Contractor, Sub-Contractor or Licensee at the time the capacity development activity was undertaken, were part of the said activity.",
    ],
    [
      "Mixed:",
      "Select this option if a mixture of Guyanese nationals and Non-Guyanese nationals, whether employed by the Contractor, Sub-Contractor or Licensee at the time the capacity development activity was undertaken or not (that is, the general public), were part of the said activity.",
    ],
    [
      "Guyanese Supplier:",
      "Select this option if ONLY employees of Guyanese-owned businesses were part of the capacity development activity.",
    ],
    [
      "Non-Guyanese Supplier:",
      "Select this option if ONLY employees of Non-Guyanese (foreign-owned) businesses were part of the capacity development activity.",
    ],
    [
      "Mixed Supplier:",
      "Select this option if BOTH employees of Guyanese-owned businesses and employees of Non-Guyanese (foreign-owned) businesses were part of the capacity development activity.",
    ],
    [],
    ["Kindly hover over each heading to reveal its description."],
    [],
    // Row 30: Column headers — exact match to template
    [
      "Activity",
      "Category",
      "Participant Type",
      "Number of Guyanese Participants Only",
      "Total Number of Participants",
      "Start Date",
      "Duration of Activity\n(# of Days)",
      "Cost to Participants",
      "Expenditure on Capacity Building",
    ],
  ];

  for (const c of capacity) {
    const participantType =
      c.provider_type === "local"
        ? "Guyanese (Internal)"
        : "Non-Guyanese (Internal)";

    let durationDays = "";
    if (c.total_hours) {
      durationDays = Math.ceil(c.total_hours / 8).toString();
    }

    rows.push([
      c.activity_name,
      c.activity_type.charAt(0).toUpperCase() + c.activity_type.slice(1),
      participantType,
      c.guyanese_participant_count,
      c.participant_count,
      c.start_date || "",
      durationDays,
      "",
      c.cost_local || "",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws["!merges"] = [
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }, // Title
    { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } }, // Subtitle
    { s: { r: 3, c: 0 }, e: { r: 3, c: 8 } }, // "Capacity Development Sub-Report"
    { s: { r: 5, c: 0 }, e: { r: 5, c: 8 } }, // Instructions
    { s: { r: 6, c: 0 }, e: { r: 6, c: 8 } }, // Item 1
    { s: { r: 7, c: 0 }, e: { r: 7, c: 8 } }, // Item 2
    { s: { r: 8, c: 0 }, e: { r: 8, c: 8 } }, // Item 3
    { s: { r: 9, c: 0 }, e: { r: 9, c: 8 } }, // Item 4
    { s: { r: 10, c: 0 }, e: { r: 10, c: 8 } }, // Item 5
    { s: { r: 11, c: 0 }, e: { r: 11, c: 8 } }, // Item 6
    { s: { r: 12, c: 0 }, e: { r: 12, c: 8 } }, // Item 7
    { s: { r: 15, c: 0 }, e: { r: 15, c: 8 } }, // Participant type intro
    { s: { r: 27, c: 0 }, e: { r: 27, c: 8 } }, // "Kindly hover..."
  ];

  return ws;
}

// ─── RELATED SECTOR TAB ─────────────────────────────────────────────
function buildRelatedSectorSheet(): XLSX.WorkSheet {
  const currentYear = new Date().getFullYear();
  const rows = RELATED_SECTORS.map((sector, i) => {
    const year = i < 29 ? currentYear + i : "";
    return [sector, year];
  });

  return XLSX.utils.aoa_to_sheet(rows);
}

// ─── MAIN EXPORT FUNCTION ────────────────────────────────────────────
export async function generateHalfYearlyReport(
  data: ReportExportData
): Promise<Uint8Array> {
  const wb = XLSX.utils.book_new();

  // Tab 1: Background
  const backgroundSheet = buildBackgroundSheet();
  XLSX.utils.book_append_sheet(wb, backgroundSheet, "Background");

  // Tab 2: General Information
  const generalSheet = buildGeneralInfoSheet(data);
  XLSX.utils.book_append_sheet(wb, generalSheet, "General Information");

  // Tab 3: Expenditure
  const expenditureSheet = buildExpenditureSheet(
    data.expenditures,
    data.sectorCategories
  );
  XLSX.utils.book_append_sheet(wb, expenditureSheet, "Expenditure");

  // Tab 4: Employment
  const employmentSheet = buildEmploymentSheet(data.employment);
  XLSX.utils.book_append_sheet(wb, employmentSheet, "Employment");

  // Tab 5: Capacity Development
  const capacitySheet = buildCapacitySheet(data.capacity);
  XLSX.utils.book_append_sheet(wb, capacitySheet, "Capacity Development");

  // Tab 6: Related Sector (reference data for dropdowns)
  const relatedSectorSheet = buildRelatedSectorSheet();
  XLSX.utils.book_append_sheet(wb, relatedSectorSheet, "Related Sector");

  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
}
