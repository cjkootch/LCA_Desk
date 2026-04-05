import type { EmploymentNarrativeInput } from "@/types/ai.types";

export function buildEmploymentNarrativePrompt(data: EmploymentNarrativeInput): string {
  return `You are an expert in Guyana's Local Content Act compliance. Draft the Employment section of the Comparative Analysis Report for the following company's half-yearly submission to the Local Content Secretariat.

COMPANY: ${data.companyName}
REPORTING PERIOD: ${data.periodLabel} (${data.periodStart} to ${data.periodEnd})
REPORT TYPE: ${data.reportType}

EMPLOYMENT SUMMARY:
- Total Headcount: ${data.totalHeadcount}
- Guyanese Employees: ${data.guyaneseHeadcount} (${data.guyanesePercentage.toFixed(1)}%)
- Non-Guyanese Employees: ${data.nonGuyaneseHeadcount} (${(100 - data.guyanesePercentage).toFixed(1)}%)

BREAKDOWN BY POSITION TYPE:
- Managerial: ${data.managerialGuyanese}/${data.managerialTotal} Guyanese (${data.managerialGuyanesePercent.toFixed(1)}%) — LCA minimum: 75%
- Technical: ${data.technicalGuyanese}/${data.technicalTotal} Guyanese (${data.technicalGuyanesePercent.toFixed(1)}%) — LCA minimum: 60%
- Non-Technical: ${data.nonTechnicalGuyanese}/${data.nonTechnicalTotal} Guyanese (${data.nonTechnicalGuyanesePercent.toFixed(1)}%) — LCA minimum: 80%

TOTAL REMUNERATION: GYD ${data.totalRemuneration.toLocaleString()}

TOP JOB TITLES:
${data.topJobTitles.map((j) => `- ${j.title}: ${j.headcount} (${j.isGuyanese ? "Guyanese" : "Non-Guyanese"})`).join("\n")}

Write a professional narrative in the style required by the Local Content Secretariat. The narrative must:
1. State the overall Guyanese employment percentage and how it compares to LCA requirements
2. Address each position type category and whether minimums are met
3. Explain succession planning and capacity building for any non-Guyanese positions
4. Detail efforts to recruit and retain Guyanese nationals
5. Use formal, professional language appropriate for a government regulatory submission
6. Be between 200-400 words

Do not use headers. Write as a single, flowing narrative. Use the exact terminology from the Local Content Act: "Guyanese national", "first consideration", "succession plan", "position type".`;
}
