export type PlanCode = "lite" | "pro" | "enterprise";

export interface PlanConfig {
  code: PlanCode;
  name: string;
  displayName: string;
  price: number;
  annualPrice: number;
  annualMonthlyEquivalent: number;
  perReportFee: number;
  bundledReportsPerYear: number;
  entityLimit: number;
  teamMemberLimit: number;
  aiDraftsPerMonth: number;
  aiChatMessagesPerMonth: number;
  features: {
    dataEntry: boolean;
    excelExport: boolean;
    pdfExport: boolean;
    deadlineAlerts: boolean;
    complianceHealthScore: boolean;
    fileUploadSubmit: boolean;
    platformSubmit: boolean;
    aiNarrativeDrafting: boolean;
    complianceScan: boolean;
    auditTrail: boolean;
    qboIntegration: boolean;
    jobBoard: boolean;
    supplierSearch: boolean;
    saveOpportunities: boolean;
    companyContacts: boolean;
    marketIntelligence: boolean;
    firstConsiderationPdf: boolean;
    smartMatching: boolean;
    talentPoolAccess: boolean;
    dataExtraction: boolean;
    prioritySupport: boolean;
    apiAccess: boolean;
  };
  bestFor: string;
  tagline: string;
}

export const PLANS: Record<PlanCode, PlanConfig> = {
  lite: {
    code: "lite",
    name: "Essentials",
    displayName: "Essentials",
    price: 199,
    annualPrice: 1908,
    annualMonthlyEquivalent: 159,
    perReportFee: 25,
    bundledReportsPerYear: 2,
    entityLimit: 1,
    teamMemberLimit: 3,
    aiDraftsPerMonth: 0,
    aiChatMessagesPerMonth: 0,
    bestFor: "Small vendors / 1\u201315 employees",
    tagline: "Everything you need to meet your LCA filing obligation.",
    features: {
      dataEntry: true,
      excelExport: true,
      pdfExport: true,
      deadlineAlerts: true,
      complianceHealthScore: true,
      fileUploadSubmit: true,
      platformSubmit: true,
      aiNarrativeDrafting: false,
      complianceScan: false,
      auditTrail: false,
      qboIntegration: false,
      jobBoard: false,
      supplierSearch: false,
      saveOpportunities: false,
      companyContacts: false,
      marketIntelligence: false,
      firstConsiderationPdf: false,
      smartMatching: false,
      talentPoolAccess: false,
      dataExtraction: false,
      prioritySupport: false,
      apiAccess: false,
    },
  },
  pro: {
    code: "pro",
    name: "Professional",
    displayName: "Professional",
    price: 399,
    annualPrice: 3828,
    annualMonthlyEquivalent: 319,
    perReportFee: 0,
    bundledReportsPerYear: -1,
    entityLimit: 5,
    teamMemberLimit: 15,
    aiDraftsPerMonth: -1,
    aiChatMessagesPerMonth: -1,
    bestFor: "Growing contractors / 15\u2013150 employees",
    tagline: "AI-powered compliance with the full marketplace layer.",
    features: {
      dataEntry: true,
      excelExport: true,
      pdfExport: true,
      deadlineAlerts: true,
      complianceHealthScore: true,
      fileUploadSubmit: true,
      platformSubmit: true,
      aiNarrativeDrafting: true,
      complianceScan: true,
      auditTrail: true,
      qboIntegration: true,
      jobBoard: true,
      supplierSearch: true,
      saveOpportunities: true,
      companyContacts: true,
      marketIntelligence: true,
      firstConsiderationPdf: true,
      smartMatching: true,
      talentPoolAccess: true,
      dataExtraction: false,
      prioritySupport: false,
      apiAccess: false,
    },
  },
  enterprise: {
    code: "enterprise",
    name: "Enterprise",
    displayName: "Enterprise",
    price: 0,
    annualPrice: 0,
    annualMonthlyEquivalent: 0,
    perReportFee: 0,
    bundledReportsPerYear: -1,
    entityLimit: -1,
    teamMemberLimit: -1,
    aiDraftsPerMonth: -1,
    aiChatMessagesPerMonth: -1,
    bestFor: "Large contractors / multi-entity operations",
    tagline: "Unlimited scale, white-glove onboarding, SLA support.",
    features: {
      dataEntry: true,
      excelExport: true,
      pdfExport: true,
      deadlineAlerts: true,
      complianceHealthScore: true,
      fileUploadSubmit: true,
      platformSubmit: true,
      aiNarrativeDrafting: true,
      complianceScan: true,
      auditTrail: true,
      qboIntegration: true,
      jobBoard: true,
      supplierSearch: true,
      saveOpportunities: true,
      companyContacts: true,
      marketIntelligence: true,
      firstConsiderationPdf: true,
      smartMatching: true,
      talentPoolAccess: true,
      dataExtraction: true,
      prioritySupport: true,
      apiAccess: true,
    },
  },
};

// ─── PLAN HELPERS ─────────────────────────────────────────────────

export function getPlan(code: string | null | undefined): PlanConfig {
  if (code === "starter" || code === "free") return PLANS.lite;
  return PLANS[(code as PlanCode)] ?? PLANS.lite;
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

export function isTrialExpired(
  trialEndsAt: Date | string | null | undefined,
  stripeSubscriptionId: string | null | undefined
): boolean {
  if (!trialEndsAt) return false;
  if (stripeSubscriptionId) return false;
  return new Date(trialEndsAt) <= new Date();
}

export function getTrialDaysRemaining(
  trialEndsAt: Date | string | null | undefined
): number | null {
  if (!trialEndsAt) return null;
  const ms = new Date(trialEndsAt).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
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

export function getPlanDisplayName(planCode: string | null | undefined): string {
  return getPlan(planCode).displayName;
}

// ─── BILLING ACCESS HELPERS ────────────────────────────────────────

export type AccessState =
  | "active"
  | "trial"
  | "past_due"
  | "locked"
  | "trial_expired";

export interface BillingAccess {
  state: AccessState;
  canAccess: boolean;
  showWarning: boolean;
  warningUrgency: "low" | "high" | "critical";
  lockReason?: string;
}

export function getBillingAccess(
  plan: string | null | undefined,
  trialEndsAt: Date | string | null | undefined,
  stripeSubscriptionId: string | null | undefined,
  stripeSubscriptionStatus: string | null | undefined
): BillingAccess {
  // Active paid subscription
  if (stripeSubscriptionId && stripeSubscriptionStatus === "active") {
    return { state: "active", canAccess: true, showWarning: false, warningUrgency: "low" };
  }

  // Active trial
  if (isInTrial(trialEndsAt)) {
    const days = getTrialDaysRemaining(trialEndsAt) ?? 0;
    return {
      state: "trial",
      canAccess: true,
      showWarning: true,
      warningUrgency: days <= 3 ? "critical" : days <= 7 ? "high" : "low",
    };
  }

  // Past due — payment failed, Stripe retrying
  if (stripeSubscriptionId && stripeSubscriptionStatus === "past_due") {
    return {
      state: "past_due",
      canAccess: true,
      showWarning: true,
      warningUrgency: "critical",
    };
  }

  // Unpaid — all retries exhausted
  if (stripeSubscriptionId && stripeSubscriptionStatus === "unpaid") {
    return {
      state: "locked",
      canAccess: false,
      showWarning: true,
      warningUrgency: "critical",
      lockReason: "unpaid",
    };
  }

  // Canceled — subscription deleted
  if (stripeSubscriptionStatus === "canceled") {
    return {
      state: "locked",
      canAccess: false,
      showWarning: true,
      warningUrgency: "critical",
      lockReason: "canceled",
    };
  }

  // Trial expired — had a trial, it ended, never paid
  if (trialEndsAt && !stripeSubscriptionId) {
    return {
      state: "trial_expired",
      canAccess: false,
      showWarning: true,
      warningUrgency: "critical",
      lockReason: "trial_expired",
    };
  }

  // No trial, no subscription — default to active (new user or edge case)
  return { state: "active", canAccess: true, showWarning: false, warningUrgency: "low" };
}
