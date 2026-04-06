export type PlanCode = "lite" | "pro" | "enterprise";

export interface PlanConfig {
  code: PlanCode;
  name: string;
  displayName: string;
  price: number;
  annualPrice: number;
  perReportFee: number;
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
    jobBoard: boolean;
    supplierSearch: boolean;
    saveOpportunities: boolean;
    companyContacts: boolean;
    marketIntelligence: boolean;
    firstConsiderationPdf: boolean;
    auditTrail: boolean;
    smartMatching: boolean;
  };
}

export const PLANS: Record<PlanCode, PlanConfig> = {
  lite: {
    code: "lite",
    name: "Lite",
    displayName: "Lite",
    price: 149,
    annualPrice: 1428,
    perReportFee: 25,
    entityLimit: 1,
    teamMemberLimit: 2,
    aiDraftsPerMonth: 0,
    aiChatMessagesPerMonth: 0,
    features: {
      excelExport: true,  // included at $25/report fee
      pdfExport: true,    // included at $25/report fee
      complianceScan: false,
      deadlineAlerts: true,
      qboIntegration: false,
      dataExtraction: false,
      prioritySupport: false,
      jobBoard: false,
      supplierSearch: false,
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
    displayName: "Pro",
    price: 299,
    annualPrice: 2868,
    perReportFee: 0,
    entityLimit: 5,
    teamMemberLimit: 10,
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
      jobBoard: true,
      supplierSearch: true,
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
    displayName: "Enterprise",
    price: 0,       // custom pricing
    annualPrice: 0, // custom pricing
    perReportFee: 0,
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
      jobBoard: true,
      supplierSearch: true,
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
  // Handle legacy "starter" code from existing tenant records
  if (code === "starter") return PLANS.lite;
  return PLANS[(code as PlanCode)] ?? PLANS.lite;
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

export function hasPerReportFee(planCode: string | null | undefined): boolean {
  return getPlan(planCode).perReportFee > 0;
}

export function getPerReportFee(planCode: string | null | undefined): number {
  return getPlan(planCode).perReportFee;
}

export function getEffectivePlan(
  planCode: string | null | undefined,
  trialEndsAt: Date | string | null | undefined
): PlanConfig {
  if (trialEndsAt && new Date(trialEndsAt) > new Date()) {
    return PLANS.pro;
  }
  return getPlan(planCode);
}

export function isInTrial(
  trialEndsAt: Date | string | null | undefined
): boolean {
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt) > new Date();
}

export function getTrialDaysRemaining(
  trialEndsAt: Date | string | null | undefined
): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}
