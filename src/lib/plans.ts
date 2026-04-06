export type PlanCode = "starter" | "pro" | "enterprise";

export interface PlanConfig {
  code: PlanCode;
  name: string;
  price: number;
  entityLimit: number;
  teamMemberLimit: number;
  aiDraftsPerMonth: number;
  aiChatMessagesPerMonth: number;
  features: {
    excelExport: boolean;
    pdfExport: boolean;
    complianceScan: boolean;
    deadlineAlerts: boolean;
    qboIntegration: boolean;
    dataExtraction: boolean;
    prioritySupport: boolean;
    // New gated features
    saveOpportunities: boolean;
    companyContacts: boolean;
    marketIntelligence: boolean;
    firstConsiderationPdf: boolean;
    auditTrail: boolean;
    smartMatching: boolean;
  };
}

export const PLANS: Record<PlanCode, PlanConfig> = {
  starter: {
    code: "starter",
    name: "Starter",
    price: 0,
    entityLimit: 1,
    teamMemberLimit: 1,
    aiDraftsPerMonth: 3,
    aiChatMessagesPerMonth: 10,
    features: {
      excelExport: false,
      pdfExport: false,
      complianceScan: false,
      deadlineAlerts: true, // basic email reminders are free (drives engagement)
      qboIntegration: false,
      dataExtraction: false,
      prioritySupport: false,
      saveOpportunities: false,
      companyContacts: false,
      marketIntelligence: false,
      firstConsiderationPdf: false,
      auditTrail: false,
      smartMatching: false,
    },
  },
  pro: {
    code: "pro",
    name: "Pro",
    price: 99,
    entityLimit: 5,
    teamMemberLimit: 5,
    aiDraftsPerMonth: -1,
    aiChatMessagesPerMonth: -1,
    features: {
      excelExport: true,
      pdfExport: true,
      complianceScan: true,
      deadlineAlerts: true,
      qboIntegration: true,
      dataExtraction: false,
      prioritySupport: false,
      saveOpportunities: true,
      companyContacts: true,
      marketIntelligence: true,
      firstConsiderationPdf: true,
      auditTrail: true,
      smartMatching: true,
    },
  },
  enterprise: {
    code: "enterprise",
    name: "Enterprise",
    price: 299,
    entityLimit: -1,
    teamMemberLimit: -1,
    aiDraftsPerMonth: -1,
    aiChatMessagesPerMonth: -1,
    features: {
      excelExport: true,
      pdfExport: true,
      complianceScan: true,
      deadlineAlerts: true,
      qboIntegration: true,
      dataExtraction: true,
      prioritySupport: true,
      saveOpportunities: true,
      companyContacts: true,
      marketIntelligence: true,
      firstConsiderationPdf: true,
      auditTrail: true,
      smartMatching: true,
    },
  },
};

export function getPlan(code: string | null | undefined): PlanConfig {
  return PLANS[(code as PlanCode) || "starter"] || PLANS.starter;
}

export function isFeatureAvailable(
  planCode: string | null | undefined,
  feature: keyof PlanConfig["features"]
): boolean {
  return getPlan(planCode).features[feature];
}

export function isWithinLimit(
  planCode: string | null | undefined,
  limitKey: "entityLimit" | "teamMemberLimit" | "aiDraftsPerMonth" | "aiChatMessagesPerMonth",
  currentCount: number
): boolean {
  const limit = getPlan(planCode)[limitKey];
  if (limit === -1) return true;
  return currentCount < limit;
}
