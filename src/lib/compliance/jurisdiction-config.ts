import type { JurisdictionConfig, EmploymentMinimums } from "@/types/jurisdiction.types";

export interface JurisdictionTemplate {
  // Identity
  code: string;
  name: string;
  regulatoryBody: string;
  regulatoryBodyShort: string;
  actName: string; // "Local Content Act 2021" or "Nigerian Oil and Gas Industry Content Development Act"
  actShort: string; // "LCA 2021" or "NOGICD Act"
  // Submission
  submissionEmail: string;
  subjectFormat: string;
  // Currency
  currencyCode: string;
  localCurrencyCode: string;
  // Employment
  employmentMinimums: EmploymentMinimums;
  employmentCategories: string[]; // ["Managerial", "Technical", "Non-Technical"]
  nationalityTerm: string; // "Guyanese" or "Nigerian"
  nationalityDefinition: string; // legal definition for attestation
  // Supplier
  supplierCertName: string; // "LCS Certificate" or "NOGIC Certificate"
  supplierCertFormat: string; // "LCSR-XXXXXXXX" or "NOGIC-XXXXXXXX"
  supplierRegistryName: string; // "Local Content Secretariat Register" or "NCDMB Registry"
  // Penalties
  penaltyRange: string; // "GY$1,000,000 to GY$50,000,000"
  falseSubmissionPenalty: string; // "criminal offense under Section 23"
  // Attestation
  attestationText: string;
  // Reporting
  reportTypes: string[]; // ["half_yearly_h1", "half_yearly_h2", "annual_plan", "performance_report"]
  // AI prompts
  expertRole: string; // "expert in Guyana's Local Content Act compliance"
  complianceContext: string; // detailed context for AI prompts
}

const JURISDICTION_TEMPLATES: Record<string, JurisdictionTemplate> = {
  GY: {
    code: "GY",
    name: "Guyana",
    regulatoryBody: "Local Content Secretariat, Ministry of Natural Resources",
    regulatoryBodyShort: "LCS",
    actName: "Local Content Act No. 18 of 2021",
    actShort: "LCA 2021",
    submissionEmail: "localcontent@nre.gov.gy",
    subjectFormat: "Local Content Half-Yearly Report – {period} – {company_name}",
    currencyCode: "USD",
    localCurrencyCode: "GYD",
    employmentMinimums: { managerial: 75, technical: 60, non_technical: 80 },
    employmentCategories: ["Managerial", "Technical", "Non-Technical"],
    nationalityTerm: "Guyanese",
    nationalityDefinition: "A citizen or permanent resident of Guyana as defined in Section 2 of the Local Content Act 2021",
    supplierCertName: "LCS Certificate",
    supplierCertFormat: "LCSR-XXXXXXXX",
    supplierRegistryName: "Local Content Register",
    penaltyRange: "GY$1,000,000 to GY$50,000,000",
    falseSubmissionPenalty: "criminal offense under Section 23(1) of the Local Content Act 2021",
    attestationText: "I certify that the information contained in this report is true, accurate, and complete to the best of my knowledge. I understand that submitting false or misleading information is an offence under the Local Content Act 2021 and may result in penalties of up to GY$50,000,000.",
    reportTypes: ["half_yearly_h1", "half_yearly_h2", "annual_plan", "performance_report"],
    expertRole: "expert in Guyana's Local Content Act compliance",
    complianceContext: "The Local Content Act No. 18 of 2021 governs petroleum sector procurement and employment in Guyana. The Secretariat oversees compliance. Reports are half-yearly (H1: Jan-Jun due Jul 30, H2: Jul-Dec due Jan 30). Employment minimums: Managerial 75%, Technical 60%, Non-Technical 80% Guyanese. Suppliers need LCS Certificate to count as Guyanese. Penalties: GY$1M-50M fines, criminal offense for false submissions.",
  },
  NG: {
    code: "NG",
    name: "Nigeria",
    regulatoryBody: "Nigerian Content Development and Monitoring Board",
    regulatoryBodyShort: "NCDMB",
    actName: "Nigerian Oil and Gas Industry Content Development Act 2010",
    actShort: "NOGICD Act",
    submissionEmail: "",
    subjectFormat: "Nigerian Content Compliance Report – {period} – {company_name}",
    currencyCode: "USD",
    localCurrencyCode: "NGN",
    employmentMinimums: { managerial: 50, technical: 50, non_technical: 80 },
    employmentCategories: ["Management", "Technical/Supervisory", "Non-Technical/Skilled", "Semi-Skilled", "Unskilled"],
    nationalityTerm: "Nigerian",
    nationalityDefinition: "A citizen of Nigeria as defined in Chapter III of the Constitution of the Federal Republic of Nigeria",
    supplierCertName: "NOGIC Certificate",
    supplierCertFormat: "NOGIC-XXXXXXXX",
    supplierRegistryName: "NCDMB Nigerian Content Registry",
    penaltyRange: "Up to 5% of project value",
    falseSubmissionPenalty: "offense under Section 68 of the NOGICD Act",
    attestationText: "I certify that the information contained in this report is true, accurate, and complete. I understand that providing false information is an offense under the Nigerian Oil and Gas Industry Content Development Act 2010.",
    reportTypes: ["quarterly_q1", "quarterly_q2", "quarterly_q3", "quarterly_q4", "annual_nigerian_content"],
    expertRole: "expert in Nigeria's NOGICD Act compliance",
    complianceContext: "The Nigerian Oil and Gas Industry Content Development Act 2010 mandates local content requirements for oil and gas operations. NCDMB oversees compliance. Reports are quarterly with annual submissions. Nigerian content minimums vary by category. Operators must have NOGIC Certificates for suppliers to count as Nigerian. Penalties up to 5% of project value.",
  },
  SR: {
    code: "SR",
    name: "Suriname",
    regulatoryBody: "Staatsolie Maatschappij Suriname N.V.",
    regulatoryBodyShort: "Staatsolie",
    actName: "Petroleum Act (Suriname)",
    actShort: "Petroleum Act",
    submissionEmail: "",
    subjectFormat: "Local Content Report – {period} – {company_name}",
    currencyCode: "USD",
    localCurrencyCode: "SRD",
    employmentMinimums: { managerial: 0, technical: 0, non_technical: 0 },
    employmentCategories: ["Management", "Technical", "Non-Technical"],
    nationalityTerm: "Surinamese",
    nationalityDefinition: "A citizen of Suriname",
    supplierCertName: "Local Supplier Certificate",
    supplierCertFormat: "SUR-XXXXXXXX",
    supplierRegistryName: "Staatsolie Supplier Registry",
    penaltyRange: "As per PSC terms",
    falseSubmissionPenalty: "breach of Production Sharing Contract",
    attestationText: "I certify that the information in this report is true and accurate to the best of my knowledge.",
    reportTypes: ["annual_plan", "performance_report"],
    expertRole: "expert in Suriname petroleum local content requirements",
    complianceContext: "Suriname's petroleum local content requirements are governed by individual Production Sharing Contracts and the Petroleum Act. Staatsolie oversees national content requirements.",
  },
  NA: {
    code: "NA",
    name: "Namibia",
    regulatoryBody: "NAMCOR",
    regulatoryBodyShort: "NAMCOR",
    actName: "Petroleum (Exploration and Production) Act 1991",
    actShort: "Petroleum Act",
    submissionEmail: "",
    subjectFormat: "Local Content Report – {period} – {company_name}",
    currencyCode: "USD",
    localCurrencyCode: "NAD",
    employmentMinimums: { managerial: 0, technical: 0, non_technical: 0 },
    employmentCategories: ["Management", "Technical", "Non-Technical"],
    nationalityTerm: "Namibian",
    nationalityDefinition: "A citizen of Namibia",
    supplierCertName: "NAMCOR Certificate",
    supplierCertFormat: "NAM-XXXXXXXX",
    supplierRegistryName: "NAMCOR Supplier Registry",
    penaltyRange: "As per license terms",
    falseSubmissionPenalty: "breach of exploration license",
    attestationText: "I certify that the information in this report is true and accurate to the best of my knowledge.",
    reportTypes: ["annual_plan"],
    expertRole: "expert in Namibia petroleum local content requirements",
    complianceContext: "Namibia's local content framework is developing. NAMCOR oversees petroleum operations.",
  },
};

// ── Backward-compatible exports ──

const JURISDICTION_CONFIGS: Record<string, JurisdictionConfig> = {};
for (const [code, template] of Object.entries(JURISDICTION_TEMPLATES)) {
  JURISDICTION_CONFIGS[code] = {
    code: template.code,
    name: template.name,
    regulatoryBody: template.regulatoryBody,
    submissionEmail: template.submissionEmail,
    subjectFormat: template.subjectFormat,
    currencyCode: template.currencyCode,
    localCurrencyCode: template.localCurrencyCode,
    employmentMinimums: template.employmentMinimums,
  };
}

export function getJurisdictionConfig(code: string): JurisdictionConfig {
  const config = JURISDICTION_CONFIGS[code];
  if (!config) throw new Error(`Unknown jurisdiction code: ${code}`);
  return config;
}

export function getJurisdictionTemplate(code: string): JurisdictionTemplate {
  const template = JURISDICTION_TEMPLATES[code];
  if (!template) return JURISDICTION_TEMPLATES.GY; // fallback
  return template;
}

export function getEmploymentMinimums(jurisdictionCode: string): EmploymentMinimums {
  return getJurisdictionConfig(jurisdictionCode).employmentMinimums;
}

export function formatSubmissionSubject(
  jurisdictionCode: string,
  period: string,
  companyName: string
): string {
  const config = getJurisdictionConfig(jurisdictionCode);
  return config.subjectFormat
    .replace("{period}", period)
    .replace("{company_name}", companyName);
}

export function getAllJurisdictions(): JurisdictionTemplate[] {
  return Object.values(JURISDICTION_TEMPLATES);
}
