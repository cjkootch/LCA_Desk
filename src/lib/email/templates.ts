// HTML email templates for LCA Desk
// Each returns a full HTML email string with inline styles

const BRAND_COLOR = "#047857";
const BG_COLOR = "#FAFBFC";
const CARD_BG = "#FFFFFF";

function layout(content: string, preheader?: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
${preheader ? `<span style="display:none;font-size:1px;color:#fafbfc;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</span>` : ""}
</head>
<body style="margin:0;padding:0;background-color:${BG_COLOR};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_COLOR};padding:32px 16px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${CARD_BG};border-radius:12px;border:1px solid #E2E8F0;overflow:hidden;">
<!-- Header -->
<tr><td style="background-color:${BRAND_COLOR};padding:24px 32px;">
  <img src="https://app.lcadesk.com/logo-white-lca.png" alt="LCA Desk" width="120" style="display:block;" />
</td></tr>
<!-- Content -->
<tr><td style="padding:32px;">
${content}
</td></tr>
<!-- Footer -->
<tr><td style="padding:16px 32px;border-top:1px solid #E2E8F0;text-align:center;">
  <p style="margin:0;font-size:11px;color:#94A3B8;">LCA Desk — Local Content Compliance Platform</p>
  <p style="margin:4px 0 0;font-size:11px;color:#94A3B8;">
    <a href="https://app.lcadesk.com/dashboard/settings" style="color:#047857;text-decoration:none;">Manage notification preferences</a>
  </p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function btn(text: string, url: string) {
  return `<a href="${url}" style="display:inline-block;background-color:${BRAND_COLOR};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin:16px 0;">${text}</a>`;
}

function heading(text: string) {
  return `<h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#0F172A;">${text}</h2>`;
}

function paragraph(text: string) {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">${text}</p>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0;" />`;
}

function badge(text: string, color: string = BRAND_COLOR) {
  return `<span style="display:inline-block;background-color:${color}15;color:${color};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">${text}</span>`;
}

// ─── TEMPLATES ───────────────────────────────────────────────────

export function deadlineReminderEmail(params: {
  userName: string;
  entityName: string;
  reportType: string;
  periodLabel: string;
  dueDate: string;
  daysRemaining: number;
  missingItems: string[];
  aiSuggestion?: string;
}) {
  const urgency = params.daysRemaining <= 7 ? "#DC2626" : params.daysRemaining <= 14 ? "#D97706" : BRAND_COLOR;
  const urgencyLabel = params.daysRemaining <= 7 ? "URGENT" : params.daysRemaining <= 14 ? "Due Soon" : "Reminder";

  return layout(`
    ${heading(`Filing Deadline: ${params.daysRemaining} days remaining`)}
    ${paragraph(`Hi ${params.userName},`)}
    ${paragraph(`Your <strong>${params.reportType}</strong> report for <strong>${params.entityName}</strong> (${params.periodLabel}) is due on <strong>${params.dueDate}</strong>.`)}
    ${params.missingItems.length > 0 ? `
      <div style="background-color:#FEF2F2;border:1px solid #FCA5A520;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#DC2626;">Incomplete Items:</p>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#475569;">
          ${params.missingItems.map(item => `<li style="margin:4px 0;">${item}</li>`).join("")}
        </ul>
      </div>
    ` : ""}
    ${params.aiSuggestion ? `
      <div style="background-color:#ECFDF5;border:1px solid ${BRAND_COLOR}20;border-radius:8px;padding:16px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${BRAND_COLOR};">AI Recommendation:</p>
        <p style="margin:0;font-size:13px;color:#475569;">${params.aiSuggestion}</p>
      </div>
    ` : ""}
    ${btn("Open Report", `https://app.lcadesk.com/dashboard/entities/${params.entityName}`)}
    ${divider()}
    <p style="margin:0;font-size:11px;color:#94A3B8;">Non-compliance may result in penalties under the Local Content Act 2021.</p>
  `, `${urgencyLabel}: ${params.reportType} due in ${params.daysRemaining} days`);
}

export function applicationReceivedEmail(params: {
  employerName: string;
  applicantName: string;
  jobTitle: string;
  isGuyanese: boolean;
  viewUrl: string;
}) {
  return layout(`
    ${heading("New Job Application")}
    ${paragraph(`A new application has been submitted for <strong>${params.jobTitle}</strong>.`)}
    <div style="background-color:${BG_COLOR};border-radius:8px;padding:16px;margin:16px 0;">
      <table style="width:100%;font-size:13px;color:#475569;">
        <tr><td style="padding:4px 0;color:#94A3B8;width:100px;">Applicant</td><td style="font-weight:600;">${params.applicantName}</td></tr>
        <tr><td style="padding:4px 0;color:#94A3B8;">Nationality</td><td>${params.isGuyanese ? `${badge("Guyanese", "#047857")}` : "International"}</td></tr>
        <tr><td style="padding:4px 0;color:#94A3B8;">Position</td><td>${params.jobTitle}</td></tr>
      </table>
    </div>
    ${btn("Review Application", params.viewUrl)}
  `, `New application for ${params.jobTitle} from ${params.applicantName}`);
}

export function applicationStatusEmail(params: {
  applicantName: string;
  jobTitle: string;
  companyName: string;
  newStatus: string;
  statusMessage?: string;
}) {
  const statusColors: Record<string, string> = {
    reviewing: "#2563EB", shortlisted: "#D97706", interviewed: "#D97706",
    selected: "#047857", rejected: "#DC2626",
  };
  const color = statusColors[params.newStatus] || BRAND_COLOR;

  const statusLabels: Record<string, string> = {
    received: "Received", reviewing: "Under Review", shortlisted: "Shortlisted",
    interviewed: "Interview Completed", selected: "Selected", rejected: "Not Selected",
  };

  return layout(`
    ${heading("Application Update")}
    ${paragraph(`Hi ${params.applicantName},`)}
    ${paragraph(`Your application for <strong>${params.jobTitle}</strong> at <strong>${params.companyName}</strong> has been updated.`)}
    <div style="text-align:center;margin:24px 0;">
      <span style="display:inline-block;background-color:${color}15;color:${color};padding:8px 20px;border-radius:20px;font-size:16px;font-weight:700;">
        ${statusLabels[params.newStatus] || params.newStatus}
      </span>
    </div>
    ${params.statusMessage ? paragraph(params.statusMessage) : ""}
    ${params.newStatus === "selected" ? paragraph("Congratulations! The employer will be in touch with next steps.") : ""}
    ${btn("View My Applications", "https://app.lcadesk.com/seeker/applications")}
  `, `Application update: ${statusLabels[params.newStatus] || params.newStatus} — ${params.jobTitle}`);
}

export function reportSubmittedEmail(params: {
  userName: string;
  entityName: string;
  reportType: string;
  periodLabel: string;
  submittedAt: string;
  recordCounts: { expenditures: number; employment: number; capacity: number };
}) {
  return layout(`
    ${heading("Report Submitted Successfully")}
    ${paragraph(`Hi ${params.userName},`)}
    ${paragraph(`Your <strong>${params.reportType}</strong> report for <strong>${params.entityName}</strong> (${params.periodLabel}) has been submitted and locked.`)}
    <div style="background-color:${BG_COLOR};border-radius:8px;padding:16px;margin:16px 0;">
      <table style="width:100%;font-size:13px;color:#475569;">
        <tr><td style="padding:4px 0;color:#94A3B8;width:140px;">Submitted</td><td>${params.submittedAt}</td></tr>
        <tr><td style="padding:4px 0;color:#94A3B8;">Expenditure Records</td><td>${params.recordCounts.expenditures}</td></tr>
        <tr><td style="padding:4px 0;color:#94A3B8;">Employment Records</td><td>${params.recordCounts.employment}</td></tr>
        <tr><td style="padding:4px 0;color:#94A3B8;">Capacity Records</td><td>${params.recordCounts.capacity}</td></tr>
      </table>
    </div>
    ${paragraph("A snapshot of all data has been saved. This report is now read-only.")}
    ${divider()}
    <p style="margin:0;font-size:11px;color:#94A3B8;">Remember to email the Excel report and PDF narrative to localcontent@nre.gov.gy</p>
  `, `Report submitted: ${params.reportType} for ${params.entityName}`);
}

export function newOpportunityAlertEmail(params: {
  userName: string;
  opportunities: Array<{ title: string; company: string; type: string; deadline?: string; url: string }>;
}) {
  const oppRows = params.opportunities.map(o => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;">
        <p style="margin:0;font-size:13px;font-weight:600;color:#0F172A;">${o.title}</p>
        <p style="margin:2px 0 0;font-size:12px;color:#475569;">${o.company} · ${badge(o.type)}</p>
        ${o.deadline ? `<p style="margin:2px 0 0;font-size:11px;color:#D97706;">Deadline: ${o.deadline}</p>` : ""}
      </td>
    </tr>
  `).join("");

  return layout(`
    ${heading("New Opportunities")}
    ${paragraph(`Hi ${params.userName}, ${params.opportunities.length} new opportunit${params.opportunities.length !== 1 ? "ies" : "y"} matching your profile:`)}
    <table style="width:100%;font-size:13px;">${oppRows}</table>
    ${btn("Browse All Opportunities", "https://app.lcadesk.com/seeker/opportunities")}
  `, `${params.opportunities.length} new opportunities on LCA Desk`);
}

export function welcomeEmail(params: {
  userName: string;
  role: string;
  loginUrl: string;
}) {
  const roleMessages: Record<string, string> = {
    filer: "You can now start filing Local Content Act compliance reports, track expenditures, manage employment records, and generate official reports for the Secretariat.",
    job_seeker: "You can now browse job openings in Guyana's petroleum sector, apply directly, and track your applications.",
    supplier: "You can now manage your supplier profile, verify your LCS certification, and explore filing opportunities.",
  };

  return layout(`
    ${heading("Welcome to LCA Desk")}
    ${paragraph(`Hi ${params.userName},`)}
    ${paragraph("Your account has been created successfully.")}
    ${paragraph(roleMessages[params.role] || roleMessages.filer)}
    ${btn("Get Started", params.loginUrl)}
    ${divider()}
    ${paragraph("If you have any questions, reply to this email and we'll help you get set up.")}
  `, `Welcome to LCA Desk, ${params.userName}`);
}
