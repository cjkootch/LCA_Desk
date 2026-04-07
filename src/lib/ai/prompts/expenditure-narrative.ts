import type { ExpenditureNarrativeInput } from "@/types/ai.types";

export function buildExpenditureNarrativePrompt(data: ExpenditureNarrativeInput): string {
  return `You are an expert in Guyana's Local Content Act compliance. Draft the Expenditure section of the Comparative Analysis Report for the following company's half-yearly submission to the Local Content Secretariat.

COMPANY: ${data.companyName}
REPORTING PERIOD: ${data.periodLabel} (${data.periodStart} to ${data.periodEnd})
REPORT TYPE: ${data.reportType}

EXPENDITURE SUMMARY:
- Total Expenditure: GYD ${data.totalExpenditure.toLocaleString()} (USD ${data.totalUsd.toLocaleString()})
- Guyanese Company Expenditure: GYD ${data.guyaneseExpenditure.toLocaleString()} (${data.localContentRate.toFixed(1)}%)
- Non-Guyanese Company Expenditure: GYD ${data.nonGuyaneseExpenditure.toLocaleString()} (${(100 - data.localContentRate).toFixed(1)}%)
- Number of Guyanese Companies: ${data.guyaneseSupplierCount} (includes LCS-certified and self-declared Guyanese suppliers)
- Number of Non-Guyanese Companies: ${data.nonGuyaneseSupplierCount}
- Sole-Sourced Contracts: ${data.soleSourcingCount}${data.soleSourcingCount > 0 ? " (with Ministerial approval where required)" : ""}

TOP SECTOR CATEGORIES BY SPEND:
${data.topCategories.map((c) => `- ${c.name}: GYD ${c.amount.toLocaleString()} (${c.isGuyanese ? "Guyanese" : "Non-Guyanese"})`).join("\n")}

ANNUAL PLAN COMMITMENT (if available): ${data.annualPlanCommitment || "Not provided"}

Write a professional narrative in the style required by the Local Content Secretariat (Version 4.1 Guideline). The narrative must:
1. Explain how first consideration was given to Guyanese companies for the procurement of goods and services
2. Distinguish between LCS-certified Guyanese companies and self-declared Guyanese companies
3. Justify any non-Guyanese procurement where local suppliers were unavailable or unable to meet requirements
4. Where Sole Source Codes are present, note that Ministerial approval was obtained for non-competitive procurement
5. Reference specific sector categories from the First Schedule of the Act where relevant
6. Compare performance against the Annual Local Content Plan if provided
7. State the local content rate using both certified and self-declared Guyanese supplier payments
8. Use formal, professional language appropriate for a government regulatory submission
9. Be between 200-400 words

Do not use headers. Write as a single, flowing narrative paragraph or two. Use the exact terminology from the Local Content Act: "first consideration", "Guyanese company", "Local Content Secretariat", "reporting period".`;
}
