"use server";

import { db } from "@/server/db";
import { notifications, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "./client";
import {
  deadlineReminderEmail,
  applicationReceivedEmail,
  applicationStatusEmail,
  reportSubmittedEmail,
  welcomeEmail,
} from "./templates";

// ─── NOTIFICATION PREFERENCES ────────────────────────────────────

export interface NotificationPreferences {
  deadline_reminders: boolean;
  filing_completion: boolean;
  application_updates: boolean;
  opportunity_alerts: boolean;
  weekly_digest: boolean;
  certificate_expiry: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  deadline_reminders: true,
  filing_completion: true,
  application_updates: true,
  opportunity_alerts: true,
  weekly_digest: false,
  certificate_expiry: true,
};

async function getUserPrefs(userId: string): Promise<NotificationPreferences> {
  const [user] = await db
    .select({ prefs: users.notificationPreferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.prefs) return DEFAULT_PREFS;
  try { return { ...DEFAULT_PREFS, ...JSON.parse(user.prefs) }; }
  catch { return DEFAULT_PREFS; }
}

export async function fetchNotificationPreferences(userId: string) {
  return getUserPrefs(userId);
}

export async function updateNotificationPreferences(userId: string, prefs: Partial<NotificationPreferences>) {
  const current = await getUserPrefs(userId);
  const updated = { ...current, ...prefs };
  await db.update(users).set({
    notificationPreferences: JSON.stringify(updated),
    updatedAt: new Date(),
  }).where(eq(users.id, userId));
  return updated;
}

// ─── UNIFIED DISPATCHER ─────────────────────────────────────────
// Creates in-app notification + sends email (if preference allows)

interface NotifyParams {
  userId: string;
  tenantId?: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  // Email
  emailHtml?: string;
  emailSubject?: string;
  // Preference category to check
  preferenceKey?: keyof NotificationPreferences;
}

async function dispatch(params: NotifyParams) {
  try {
    // Check user preference
    if (params.preferenceKey) {
      const prefs = await getUserPrefs(params.userId);
      if (!prefs[params.preferenceKey]) {
        // User has this notification type disabled — skip both in-app and email
        return;
      }
    }

    // Create in-app notification
    await db.insert(notifications).values({
      userId: params.userId,
      tenantId: params.tenantId || null,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link || null,
      emailSent: false,
    });

    // Send email if template provided
    if (params.emailHtml && params.emailSubject) {
      const [user] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, params.userId))
        .limit(1);

      if (user?.email) {
        const result = await sendEmail({
          to: user.email,
          subject: params.emailSubject,
          html: params.emailHtml,
        });

        if (result.success) {
          // Mark the notification as email sent
          // (update the most recent notification for this user+type)
          await db.update(notifications).set({
            emailSent: true,
            emailSentAt: new Date(),
          }).where(eq(notifications.userId, params.userId));
        }
      }
    }
  } catch (err) {
    console.error("Unified notify failed:", params.type, err);
  }
}

// ─── PUBLIC NOTIFICATION FUNCTIONS ───────────────────────────────
// Each creates both in-app notification AND sends email

export async function notifyDeadlineReminder(params: {
  userId: string;
  tenantId: string;
  userName: string;
  entityName: string;
  reportType: string;
  periodLabel: string;
  dueDate: string;
  daysRemaining: number;
  missingItems: string[];
  aiSuggestion?: string;
  link: string;
}) {
  const isOverdue = params.daysRemaining <= 0;
  await dispatch({
    userId: params.userId,
    tenantId: params.tenantId,
    type: isOverdue ? "deadline_overdue" : "deadline_warning",
    title: isOverdue
      ? `OVERDUE: ${params.reportType} for ${params.entityName}`
      : `${params.daysRemaining} days until ${params.reportType} deadline`,
    message: `${params.entityName} — ${params.periodLabel}. Due: ${params.dueDate}.${params.missingItems.length > 0 ? ` Missing: ${params.missingItems.join(", ")}` : ""}`,
    link: params.link,
    preferenceKey: "deadline_reminders",
    emailSubject: `${isOverdue ? "OVERDUE: " : ""}Filing deadline${isOverdue ? " passed" : ` in ${params.daysRemaining} days`} — ${params.entityName}`,
    emailHtml: deadlineReminderEmail(params),
  });
}

export async function notifyApplicationReceived(params: {
  userId: string;
  tenantId: string;
  employerName: string;
  applicantName: string;
  jobTitle: string;
  isGuyanese: boolean;
  postingId: string;
}) {
  await dispatch({
    userId: params.userId,
    tenantId: params.tenantId,
    type: "application_received",
    title: `New application for ${params.jobTitle}`,
    message: `${params.applicantName} (${params.isGuyanese ? "Guyanese" : "International"}) applied for ${params.jobTitle}.`,
    link: `/dashboard/jobs/${params.postingId}/applications`,
    preferenceKey: "application_updates",
    emailSubject: `New application for ${params.jobTitle} — ${params.applicantName}`,
    emailHtml: applicationReceivedEmail({
      employerName: params.employerName,
      applicantName: params.applicantName,
      jobTitle: params.jobTitle,
      isGuyanese: params.isGuyanese,
      viewUrl: `https://app.lcadesk.com/dashboard/jobs/${params.postingId}/applications`,
    }),
  });
}

export async function notifyApplicationStatus(params: {
  userId: string;
  applicantName: string;
  jobTitle: string;
  companyName: string;
  newStatus: string;
}) {
  const notifyStatuses = ["reviewing", "shortlisted", "interviewed", "selected", "rejected"];
  if (!notifyStatuses.includes(params.newStatus)) return;

  const statusLabels: Record<string, string> = {
    reviewing: "Under Review", shortlisted: "Shortlisted",
    interviewed: "Interview Completed", selected: "Selected!", rejected: "Not Selected",
  };

  await dispatch({
    userId: params.userId,
    type: "application_status",
    title: `Application ${statusLabels[params.newStatus] || params.newStatus}`,
    message: `Your application for ${params.jobTitle} at ${params.companyName} status: ${statusLabels[params.newStatus] || params.newStatus}.`,
    link: "/seeker/applications",
    preferenceKey: "application_updates",
    emailSubject: `Application update: ${params.jobTitle} — ${params.newStatus === "selected" ? "Congratulations!" : "Status update"}`,
    emailHtml: applicationStatusEmail(params),
  });
}

export async function notifyReportSubmitted(params: {
  userId: string;
  tenantId: string;
  userName: string;
  entityName: string;
  reportType: string;
  periodLabel: string;
  recordCounts: { expenditures: number; employment: number; capacity: number };
}) {
  await dispatch({
    userId: params.userId,
    tenantId: params.tenantId,
    type: "report_submitted",
    title: `Report submitted: ${params.reportType}`,
    message: `${params.entityName} — ${params.periodLabel}. ${params.recordCounts.expenditures} expenditure, ${params.recordCounts.employment} employment, ${params.recordCounts.capacity} capacity records.`,
    link: "/dashboard",
    preferenceKey: "filing_completion",
    emailSubject: `Report submitted: ${params.reportType} for ${params.entityName}`,
    emailHtml: reportSubmittedEmail({
      userName: params.userName,
      entityName: params.entityName,
      reportType: params.reportType,
      periodLabel: params.periodLabel,
      recordCounts: params.recordCounts,
      submittedAt: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    }),
  });
}

export async function notifyWelcome(params: {
  userId: string;
  name: string;
  email: string;
  role: string;
}) {
  await dispatch({
    userId: params.userId,
    type: "welcome",
    title: "Welcome to LCA Desk!",
    message: `Your ${params.role === "filer" ? "compliance filing" : params.role === "job_seeker" ? "job seeker" : "supplier"} account is ready.`,
    link: params.role === "filer" ? "/dashboard" : params.role === "job_seeker" ? "/seeker/dashboard" : "/supplier-portal/dashboard",
    emailSubject: "Welcome to LCA Desk",
    emailHtml: welcomeEmail({
      userName: params.name,
      role: params.role,
      loginUrl: `https://app.lcadesk.com/auth/login?role=${params.role}`,
    }),
  });
}

export async function notifyTeamInvite(params: {
  userId: string;
  tenantId: string;
  inviterName: string;
  companyName: string;
}) {
  await dispatch({
    userId: params.userId,
    tenantId: params.tenantId,
    type: "team_invite",
    title: `You've been added to ${params.companyName}`,
    message: `${params.inviterName} added you to the ${params.companyName} team on LCA Desk.`,
    link: "/dashboard",
    emailSubject: `You've been added to ${params.companyName} on LCA Desk`,
    emailHtml: welcomeEmail({
      userName: "Team Member",
      role: "filer",
      loginUrl: "https://app.lcadesk.com/auth/login",
    }),
  });
}
