import type { ExpenditureNarrativeInput } from "@/types/ai.types";
import { getJurisdictionTemplate } from "@/lib/compliance/jurisdiction-config";

export function buildExpenditureNarrativePrompt(data: ExpenditureNarrativeInput, jurisdictionCode = "GY"): string {
  const t = getJurisdictionTemplate(jurisdictionCode);
  return `You are an expert in ${t.name}'s local content compliance (${t.actShort}). Draft the Expenditure section of the Comparative Analysis Report for the following company's half-yearly submission to the ${t.regulatoryBodyShort}.

COMPANY: ${data.companyName}
REPORTING PERIOD: ${data.periodLabel} (${data.periodStart} to ${data.periodEnd})
REPORT TYPE: ${data.reportType}

EXPENDITURE SUMMARY:
- Total Expenditure: ${t.localCurrencyCode} ${data.totalExpenditure.toLocaleString()} (${t.currencyCode} ${data.totalUsd.toLocaleString()})
- ${t.nationalityTerm} Company Expenditure: ${t.localCurrencyCode} ${data.guyaneseExpenditure.toLocaleString()} (${data.localContentRate.toFixed(1)}%)
- Non-${t.nationalityTerm} Company Expenditure: ${t.localCurrencyCode} ${data.nonGuyaneseExpenditure.toLocaleString()} (${(100 - data.localContentRate).toFixed(1)}%)
- Number of ${t.nationalityTerm} Companies: ${data.guyaneseSupplierCount} (includes ${t.regulatoryBodyShort}-certified and self-declared ${t.nationalityTerm} suppliers)
- Number of Non-${t.nationalityTerm} Companies: ${data.nonGuyaneseSupplierCount}
- Sole-Sourced Contracts: ${data.soleSourcingCount}${data.soleSourcingCount > 0 ? " (with Ministerial approval where required)" : ""}

TOP SECTOR CATEGORIES BY SPEND:
${data.topCategories.map((c) => `- ${c.name}: ${t.localCurrencyCode} ${c.amount.toLocaleString()} (${c.isGuyanese ? t.nationalityTerm : `Non-${t.nationalityTerm}`})`).join("\n")}

ANNUAL PLAN COMMITMENT (if available): ${data.annualPlanCommitment || "Not provided"}

Write a professional narrative in the style required by the ${t.regulatoryBodyShort} (${t.actShort}). The narrative must:
1. Explain how first consideration was given to ${t.nationalityTerm} companies for the procurement of goods and services
2. Distinguish between ${t.regulatoryBodyShort}-certified ${t.nationalityTerm} companies and self-declared ${t.nationalityTerm} companies
3. Justify any non-${t.nationalityTerm} procurement where local suppliers were unavailable or unable to meet requirements
4. Where Sole Source Codes are present, note that Ministerial approval was obtained for non-competitive procurement
5. Reference specific sector categories from the First Schedule of the Act where relevant
6. Compare performance against the Annual Local Content Plan if provided
7. State the local content rate using both certified and self-declared ${t.nationalityTerm} supplier payments
8. Use formal, professional language appropriate for a government regulatory submission
9. Be between 200-400 words

Do not use headers. Write as a single, flowing narrative paragraph or two. Use the exact terminology from the ${t.actShort}: "first consideration", "${t.nationalityTerm} company", "${t.regulatoryBodyShort}", "reporting period".`;
}
