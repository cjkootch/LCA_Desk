import { sendEmail } from "./client";
import {
  applicationReceivedEmail,
  applicationStatusEmail,
  reportSubmittedEmail,
  welcomeEmail,
} from "./templates";

// Fire-and-forget email sends — never block the main action

export async function notifyApplicationReceived(params: {
  employerEmail: string;
  employerName: string;
  applicantName: string;
  jobTitle: string;
  isGuyanese: boolean;
  postingId: string;
}) {
  sendEmail({
    to: params.employerEmail,
    subject: `New application for ${params.jobTitle} — ${params.applicantName}`,
    html: applicationReceivedEmail({
      employerName: params.employerName,
      applicantName: params.applicantName,
      jobTitle: params.jobTitle,
      isGuyanese: params.isGuyanese,
      viewUrl: `https://app.lcadesk.com/dashboard/jobs/${params.postingId}/applications`,
    }),
  }).catch(() => {});
}

export async function notifyApplicationStatusChange(params: {
  applicantEmail: string;
  applicantName: string;
  jobTitle: string;
  companyName: string;
  newStatus: string;
}) {
  // Only send for meaningful status changes
  const notifyStatuses = ["reviewing", "shortlisted", "interviewed", "selected", "rejected"];
  if (!notifyStatuses.includes(params.newStatus)) return;

  sendEmail({
    to: params.applicantEmail,
    subject: `Application update: ${params.jobTitle} — ${params.newStatus === "selected" ? "Congratulations!" : "Status update"}`,
    html: applicationStatusEmail({
      applicantName: params.applicantName,
      jobTitle: params.jobTitle,
      companyName: params.companyName,
      newStatus: params.newStatus,
    }),
  }).catch(() => {});
}

export async function notifyReportSubmitted(params: {
  userEmail: string;
  userName: string;
  entityName: string;
  reportType: string;
  periodLabel: string;
  recordCounts: { expenditures: number; employment: number; capacity: number };
}) {
  sendEmail({
    to: params.userEmail,
    subject: `Report submitted: ${params.reportType} for ${params.entityName}`,
    html: reportSubmittedEmail({
      userName: params.userName,
      entityName: params.entityName,
      reportType: params.reportType,
      periodLabel: params.periodLabel,
      submittedAt: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      recordCounts: params.recordCounts,
    }),
  }).catch(() => {});
}

export async function notifyWelcome(params: {
  email: string;
  name: string;
  role: string;
}) {
  sendEmail({
    to: params.email,
    subject: "Welcome to LCA Desk",
    html: welcomeEmail({
      userName: params.name,
      role: params.role,
      loginUrl: `https://app.lcadesk.com/auth/login?role=${params.role}`,
    }),
  }).catch(() => {});
}
