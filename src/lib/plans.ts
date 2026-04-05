export type PlanCode = "starter" | "pro" | "enterprise";

export interface PlanConfig {
  code: PlanCode;
  name: string;
  price: number; // monthly USD, 0 = free
  entityLimit: number;
  teamMemberLimit: number;
  aiDraftsPerMonth: number;
  aiChatMessagesPerMonth: number;
  features: {
    excelExport: boolean;
    pdfExport: boolean;
    complianceScan: boolean;
    deadlineAlerts: boolean;
    dataExtraction: boolean;
    prioritySupport: boolean;
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
      deadlineAlerts: false,
      dataExtraction: false,
      prioritySupport: false,
    },
  },
  pro: {
    code: "pro",
    name: "Pro",
    price: 99,
    entityLimit: 5,
    teamMemberLimit: 5,
    aiDraftsPerMonth: -1, // unlimited
    aiChatMessagesPerMonth: -1,
    features: {
      excelExport: true,
      pdfExport: true,
      complianceScan: true,
      deadlineAlerts: true,
      dataExtraction: false,
      prioritySupport: false,
    },
  },
  enterprise: {
    code: "enterprise",
    name: "Enterprise",
    price: 299,
    entityLimit: -1, // unlimited
    teamMemberLimit: -1,
    aiDraftsPerMonth: -1,
    aiChatMessagesPerMonth: -1,
    features: {
      excelExport: true,
      pdfExport: true,
      complianceScan: true,
      deadlineAlerts: true,
      dataExtraction: true,
      prioritySupport: true,
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
  if (limit === -1) return true; // unlimited
  return currentCount < limit;
}
