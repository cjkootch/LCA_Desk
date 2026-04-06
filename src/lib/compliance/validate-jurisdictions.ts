import { getJurisdictionTemplate, getAllJurisdictions, type JurisdictionTemplate } from "./jurisdiction-config";
import { calculateDeadlines } from "./deadlines";

/**
 * Validates all jurisdiction configurations are complete and consistent.
 * Call this at build time or in tests to catch missing configs before production.
 */
export function validateAllJurisdictions(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const jurisdictions = getAllJurisdictions();

  for (const j of jurisdictions) {
    const prefix = `[${j.code}] ${j.name}`;

    // Required string fields
    const requiredStrings: (keyof JurisdictionTemplate)[] = [
      "code", "name", "regulatoryBody", "regulatoryBodyShort",
      "actName", "actShort", "nationalityTerm", "nationalityDefinition",
      "supplierCertName", "supplierCertFormat", "supplierRegistryName",
      "penaltyRange", "falseSubmissionPenalty", "attestationText",
      "expertRole", "complianceContext",
    ];

    for (const field of requiredStrings) {
      if (!j[field] || (typeof j[field] === "string" && (j[field] as string).length < 2)) {
        errors.push(`${prefix}: Missing or empty field "${field}"`);
      }
    }

    // Employment minimums
    if (!j.employmentMinimums) {
      errors.push(`${prefix}: Missing employmentMinimums`);
    } else {
      for (const key of ["managerial", "technical", "non_technical"] as const) {
        if (typeof j.employmentMinimums[key] !== "number") {
          errors.push(`${prefix}: employmentMinimums.${key} must be a number`);
        }
      }
    }

    // Employment categories
    if (!j.employmentCategories || j.employmentCategories.length === 0) {
      errors.push(`${prefix}: employmentCategories must have at least one category`);
    }

    // Report types
    if (!j.reportTypes || j.reportTypes.length === 0) {
      errors.push(`${prefix}: reportTypes must have at least one report type`);
    }

    // Deadlines match report types
    const currentYear = new Date().getFullYear();
    const deadlines = calculateDeadlines(j.code, currentYear);
    if (deadlines.length === 0) {
      errors.push(`${prefix}: calculateDeadlines returns empty array — add deadline config for this jurisdiction`);
    } else {
      // Verify each report type has a matching deadline
      for (const rt of j.reportTypes) {
        if (!deadlines.some(d => d.type === rt)) {
          errors.push(`${prefix}: Report type "${rt}" has no matching deadline in calculateDeadlines()`);
        }
      }
    }

    // Attestation mentions the act
    if (j.attestationText && !j.attestationText.toLowerCase().includes(j.actShort.toLowerCase().split(" ")[0])) {
      errors.push(`${prefix}: Attestation text should reference the act (${j.actShort})`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Quick check that a single jurisdiction code is fully configured.
 * Use before processing a filing to fail fast with a clear error.
 */
export function assertJurisdictionReady(code: string): void {
  try {
    const template = getJurisdictionTemplate(code);
    if (!template.attestationText) throw new Error("Missing attestation text");
    if (!template.employmentMinimums) throw new Error("Missing employment minimums");
    if (template.reportTypes.length === 0) throw new Error("No report types configured");
    const deadlines = calculateDeadlines(code, new Date().getFullYear());
    if (deadlines.length === 0) throw new Error("No deadlines configured");
  } catch (err) {
    throw new Error(`Jurisdiction ${code} is not fully configured: ${err instanceof Error ? err.message : String(err)}`);
  }
}
