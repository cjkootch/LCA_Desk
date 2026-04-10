import type { FullAnalysisInput } from "@/types/ai.types";
import { getJurisdictionTemplate } from "@/lib/compliance/jurisdiction-config";

export function buildFullComparativeAnalysisPrompt(data: FullAnalysisInput, jurisdictionCode = "GY"): string {
  const t = getJurisdictionTemplate(jurisdictionCode);
  return `You are an expert in ${t.name}'s local content compliance (${t.actShort}). Draft a complete Comparative Analysis Report for the company's half-yearly submission to the ${t.regulatoryBodyShort}.

COMPANY: ${data.expenditure.companyName}
REPORTING PERIOD: ${data.expenditure.periodLabel} (${data.expenditure.periodStart} to ${data.expenditure.periodEnd})

=== EXPENDITURE ===
- Total: ${t.localCurrencyCode} ${data.expenditure.totalExpenditure.toLocaleString()} (${t.currencyCode} ${data.expenditure.totalUsd.toLocaleString()})
- Local Content Rate: ${data.expenditure.localContentRate.toFixed(1)}%
- ${t.nationalityTerm} Suppliers: ${data.expenditure.guyaneseSupplierCount}
- Non-${t.nationalityTerm} Suppliers: ${data.expenditure.nonGuyaneseSupplierCount}
- Sole-Sourced: ${data.expenditure.soleSourcingCount}

=== EMPLOYMENT ===
- Total Headcount: ${data.employment.totalHeadcount}
- ${t.nationalityTerm}: ${data.employment.guyaneseHeadcount} (${data.employment.guyanesePercentage.toFixed(1)}%)
- Managerial ${t.nationalityTerm}: ${data.employment.managerialGuyanesePercent.toFixed(1)}% (min ${t.employmentMinimums.managerial}%)
- Technical ${t.nationalityTerm}: ${data.employment.technicalGuyanesePercent.toFixed(1)}% (min ${t.employmentMinimums.technical}%)
- Non-Technical ${t.nationalityTerm}: ${data.employment.nonTechnicalGuyanesePercent.toFixed(1)}% (min ${t.employmentMinimums.non_technical}%)

=== CAPACITY DEVELOPMENT ===
- Activities: ${data.capacity.totalActivities}
- Participants: ${data.capacity.totalParticipants} (${data.capacity.guyaneseParticipants} ${t.nationalityTerm})
- Training Hours: ${data.capacity.totalHours}
- Investment: ${t.localCurrencyCode} ${data.capacity.totalCost.toLocaleString()}

Write the full Comparative Analysis narrative covering all three sections (Expenditure, Employment, and Capacity Development) in a single document. This should be a professional, submission-ready narrative of 500-800 words. Use the exact structure and terminology expected by the ${t.regulatoryBodyShort} (${t.actShort}). Do not use headers — write as flowing paragraphs that naturally transition between sections.`;
}
