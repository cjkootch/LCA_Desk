import type { JurisdictionConfig, EmploymentMinimums } from "@/types/jurisdiction.types";

const JURISDICTION_CONFIGS: Record<string, JurisdictionConfig> = {
  GY: {
    code: "GY",
    name: "Guyana",
    regulatoryBody: "Local Content Secretariat, Ministry of Natural Resources",
    submissionEmail: "localcontent@nre.gov.gy",
    subjectFormat: "Local Content Half-Yearly Report – {period} – {company_name}",
    currencyCode: "USD",
    localCurrencyCode: "GYD",
    employmentMinimums: {
      managerial: 75,
      technical: 60,
      non_technical: 80,
    },
  },
  SR: {
    code: "SR",
    name: "Suriname",
    regulatoryBody: "Staatsolie Maatschappij Suriname N.V.",
    submissionEmail: "",
    subjectFormat: "",
    currencyCode: "USD",
    localCurrencyCode: "SRD",
    employmentMinimums: {
      managerial: 0,
      technical: 0,
      non_technical: 0,
    },
  },
  NA: {
    code: "NA",
    name: "Namibia",
    regulatoryBody: "NAMCOR",
    submissionEmail: "",
    subjectFormat: "",
    currencyCode: "USD",
    localCurrencyCode: "NAD",
    employmentMinimums: {
      managerial: 0,
      technical: 0,
      non_technical: 0,
    },
  },
};

export function getJurisdictionConfig(code: string): JurisdictionConfig {
  const config = JURISDICTION_CONFIGS[code];
  if (!config) {
    throw new Error(`Unknown jurisdiction code: ${code}`);
  }
  return config;
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
