import type { CapacityNarrativeInput } from "@/types/ai.types";
import { getJurisdictionTemplate } from "@/lib/compliance/jurisdiction-config";

export function buildCapacityNarrativePrompt(data: CapacityNarrativeInput, jurisdictionCode = "GY"): string {
  const t = getJurisdictionTemplate(jurisdictionCode);
  return `You are an expert in ${t.name}'s local content compliance (${t.actShort}). Draft the Capacity Development section of the Comparative Analysis Report for the following company's half-yearly submission to the ${t.regulatoryBodyShort}.

COMPANY: ${data.companyName}
REPORTING PERIOD: ${data.periodLabel} (${data.periodStart} to ${data.periodEnd})
REPORT TYPE: ${data.reportType}

CAPACITY DEVELOPMENT SUMMARY:
- Total Activities: ${data.totalActivities}
- Total Participants: ${data.totalParticipants}
- Guyanese Participants: ${data.guyaneseParticipants}
- Total Training Hours: ${data.totalHours}
- Total Investment: ${t.localCurrencyCode} ${data.totalCost.toLocaleString()}

ACTIVITIES:
${data.activities.map((a) => `- ${a.name} (${a.type}): ${a.participantCount} participants, ${a.hours} hours, Provider: ${a.providerType}`).join("\n")}

Write a professional narrative in the style required by the ${t.regulatoryBodyShort}. The narrative must:
1. Summarize all capacity development activities undertaken during the reporting period
2. Highlight the investment made in developing ${t.nationalityTerm} nationals' skills
3. Reference specific training programmes, certifications, or scholarships
4. Detail the use of local vs. international training providers
5. Explain how these activities support long-term local capacity building goals
6. Use formal, professional language appropriate for a government regulatory submission
7. Be between 150-300 words

Do not use headers. Write as a flowing narrative. Use terminology consistent with the ${t.actShort}.`;
}
