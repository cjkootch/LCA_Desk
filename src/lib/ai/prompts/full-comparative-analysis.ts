import type { FullAnalysisInput } from "@/types/ai.types";

export function buildFullComparativeAnalysisPrompt(data: FullAnalysisInput): string {
  return `You are an expert in Guyana's Local Content Act compliance. Draft a complete Comparative Analysis Report for the company's half-yearly submission to the Local Content Secretariat.

COMPANY: ${data.expenditure.companyName}
REPORTING PERIOD: ${data.expenditure.periodLabel} (${data.expenditure.periodStart} to ${data.expenditure.periodEnd})

=== EXPENDITURE ===
- Total: GYD ${data.expenditure.totalExpenditure.toLocaleString()} (USD ${data.expenditure.totalUsd.toLocaleString()})
- Local Content Rate: ${data.expenditure.localContentRate.toFixed(1)}%
- Guyanese Suppliers: ${data.expenditure.guyaneseSupplierCount}
- Non-Guyanese Suppliers: ${data.expenditure.nonGuyaneseSupplierCount}
- Sole-Sourced: ${data.expenditure.soleSourcingCount}

=== EMPLOYMENT ===
- Total Headcount: ${data.employment.totalHeadcount}
- Guyanese: ${data.employment.guyaneseHeadcount} (${data.employment.guyanesePercentage.toFixed(1)}%)
- Managerial Guyanese: ${data.employment.managerialGuyanesePercent.toFixed(1)}% (min 75%)
- Technical Guyanese: ${data.employment.technicalGuyanesePercent.toFixed(1)}% (min 60%)
- Non-Technical Guyanese: ${data.employment.nonTechnicalGuyanesePercent.toFixed(1)}% (min 80%)

=== CAPACITY DEVELOPMENT ===
- Activities: ${data.capacity.totalActivities}
- Participants: ${data.capacity.totalParticipants} (${data.capacity.guyaneseParticipants} Guyanese)
- Training Hours: ${data.capacity.totalHours}
- Investment: GYD ${data.capacity.totalCost.toLocaleString()}

Write the full Comparative Analysis narrative covering all three sections (Expenditure, Employment, and Capacity Development) in a single document. This should be a professional, submission-ready narrative of 500-800 words. Use the exact structure and terminology expected by the Local Content Secretariat. Do not use headers — write as flowing paragraphs that naturally transition between sections.`;
}
