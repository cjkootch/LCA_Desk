import type { EmploymentNarrativeInput } from "@/types/ai.types";
import { getJurisdictionTemplate } from "@/lib/compliance/jurisdiction-config";

export function buildEmploymentNarrativePrompt(data: EmploymentNarrativeInput, jurisdictionCode = "GY"): string {
  const t = getJurisdictionTemplate(jurisdictionCode);
  return `You are an expert in ${t.name}'s local content compliance (${t.actShort}). Draft the Employment section of the Comparative Analysis Report for the following company's half-yearly submission to the ${t.regulatoryBodyShort}.

COMPANY: ${data.companyName}
REPORTING PERIOD: ${data.periodLabel} (${data.periodStart} to ${data.periodEnd})
REPORT TYPE: ${data.reportType}

EMPLOYMENT SUMMARY:
- Total Headcount: ${data.totalHeadcount}
- ${t.nationalityTerm} Employees: ${data.guyaneseHeadcount} (${data.guyanesePercentage.toFixed(1)}%)
- Non-${t.nationalityTerm} Employees: ${data.nonGuyaneseHeadcount} (${(100 - data.guyanesePercentage).toFixed(1)}%)

BREAKDOWN BY POSITION TYPE:
- Managerial: ${data.managerialGuyanese}/${data.managerialTotal} ${t.nationalityTerm} (${data.managerialGuyanesePercent.toFixed(1)}%) — ${t.actShort} minimum: ${t.employmentMinimums.managerial}%
- Technical: ${data.technicalGuyanese}/${data.technicalTotal} ${t.nationalityTerm} (${data.technicalGuyanesePercent.toFixed(1)}%) — ${t.actShort} minimum: ${t.employmentMinimums.technical}%
- Non-Technical: ${data.nonTechnicalGuyanese}/${data.nonTechnicalTotal} ${t.nationalityTerm} (${data.nonTechnicalGuyanesePercent.toFixed(1)}%) — ${t.actShort} minimum: ${t.employmentMinimums.non_technical}%

TOTAL REMUNERATION: ${t.localCurrencyCode} ${data.totalRemuneration.toLocaleString()}

TOP JOB TITLES:
${data.topJobTitles.map((j) => `- ${j.title}: ${j.headcount} (${j.isGuyanese ? t.nationalityTerm : `Non-${t.nationalityTerm}`})`).join("\n")}

Write a professional narrative in the style required by the ${t.regulatoryBodyShort}. The narrative must:
1. State the overall ${t.nationalityTerm} employment percentage and how it compares to ${t.actShort} requirements
2. Address each position type category and whether minimums are met
3. Explain succession planning and capacity building for any non-${t.nationalityTerm} positions
4. Detail efforts to recruit and retain ${t.nationalityTerm} nationals
5. Use formal, professional language appropriate for a government regulatory submission
6. Be between 200-400 words

Do not use headers. Write as a single, flowing narrative. Use the exact terminology from the ${t.actShort}: "${t.nationalityTerm} national", "first consideration", "succession plan", "position type".`;
}
