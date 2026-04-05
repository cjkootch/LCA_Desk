import type { NarrativeSection } from "@/types/ai.types";
import type { ExpenditureNarrativeInput, EmploymentNarrativeInput, CapacityNarrativeInput, FullAnalysisInput } from "@/types/ai.types";
import { buildExpenditureNarrativePrompt } from "./expenditure-narrative";
import { buildEmploymentNarrativePrompt } from "./employment-narrative";
import { buildCapacityNarrativePrompt } from "./capacity-narrative";
import { buildFullComparativeAnalysisPrompt } from "./full-comparative-analysis";

export function buildNarrativePrompt(
  section: NarrativeSection,
  data: ExpenditureNarrativeInput | EmploymentNarrativeInput | CapacityNarrativeInput | FullAnalysisInput,
  _jurisdictionCode: string
): string {
  switch (section) {
    case "expenditure_narrative":
      return buildExpenditureNarrativePrompt(data as ExpenditureNarrativeInput);
    case "employment_narrative":
      return buildEmploymentNarrativePrompt(data as EmploymentNarrativeInput);
    case "capacity_narrative":
      return buildCapacityNarrativePrompt(data as CapacityNarrativeInput);
    case "full_comparative_analysis":
      return buildFullComparativeAnalysisPrompt(data as FullAnalysisInput);
    default:
      throw new Error(`Unknown narrative section: ${section}`);
  }
}
