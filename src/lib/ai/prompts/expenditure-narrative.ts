import type { ExpenditureNarrativeInput } from "@/types/ai.types";

export function buildExpenditureNarrativePrompt(data: ExpenditureNarrativeInput): string {
  return `You are an expert in Guyana's Local Content Act compliance. Draft the Expenditure section of the Comparative Analysis Report for the following company's half-yearly submission to the Local Content Secretariat.

COMPANY: ${data.companyName}
REPORTING PERIOD: ${data.periodLabel} (${data.periodStart} to ${data.periodEnd})
REPORT TYPE: ${data.reportType}

EXPENDITURE SUMMARY:
- Total Expenditure: GYD ${data.totalExpenditure.toLocaleString()} (USD ${data.totalUsd.toLocaleString()})
- Guyanese Supplier Expenditure: GYD ${data.guyaneseExpenditure.toLocaleString()} (${data.localContentRate.toFixed(1)}%)
- Non-Guyanese Supplier Expenditure: GYD ${data.nonGuyaneseExpenditure.toLocaleString()} (${(100 - data.localContentRate).toFixed(1)}%)
- Number of Guyanese Suppliers: ${data.guyaneseSupplierCount}
- Number of Non-Guyanese Suppliers: ${data.nonGuyaneseSupplierCount}
- Sole-Sourced Contracts: ${data.soleSourcingCount}

TOP SECTOR CATEGORIES BY SPEND:
${data.topCategories.map((c) => `- ${c.name}: GYD ${c.amount.toLocaleString()} (${c.isGuyanese ? "Guyanese" : "Non-Guyanese"})`).join("\n")}

ANNUAL PLAN COMMITMENT (if available): ${data.annualPlanCommitment || "Not provided"}

Write a professional narrative in the style required by the Local Content Secretariat. The narrative must:
1. Explain how first consideration was given to Guyanese suppliers
2. Justify any non-Guyanese procurement where local suppliers were unavailable or unable to meet requirements
3. Reference specific sector categories and suppliers where relevant
4. Compare performance against the Annual Local Content Plan if provided
5. Use formal, professional language appropriate for a government regulatory submission
6. Be between 200-400 words

Do not use headers. Write as a single, flowing narrative paragraph or two. Use the exact terminology from the Local Content Act: "first consideration", "Guyanese company", "Local Content Secretariat", "reporting period".`;
}
