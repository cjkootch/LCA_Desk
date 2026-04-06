"use client";

import { Badge } from "@/components/ui/badge";
import {
  Building2, MapPin, CalendarDays, DollarSign, Mail, Phone,
  User, CheckCircle, Clock, FileText,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function AiSummaryPanel({ summary }: { summary: any }) {
  if (!summary) return null;

  // Extract all emails from various fields
  const allEmails: string[] = [];
  if (summary.contact_emails?.length) allEmails.push(...summary.contact_emails);
  if (summary.contact_email) {
    const raw = String(summary.contact_email);
    const found = raw.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
    if (found) allEmails.push(...found);
  }
  const uniqueEmails = [...new Set(allEmails)];

  return (
    <div className="space-y-4">
      {/* Scope */}
      {summary.scope_of_work && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Scope of Work</h4>
          <p className="text-sm text-text-secondary">{summary.scope_of_work}</p>
        </div>
      )}

      {/* Key Details Grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          {summary.issuing_company && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Building2 className="h-3.5 w-3.5 text-text-muted shrink-0" />
              <div>
                <span className="font-medium">{summary.issuing_company}</span>
                {summary.parent_company && summary.parent_company !== summary.issuing_company && (
                  <span className="text-text-muted"> ({summary.parent_company})</span>
                )}
              </div>
            </div>
          )}
          {summary.reference_number && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <FileText className="h-3.5 w-3.5 text-text-muted shrink-0" />
              Ref: <span className="font-mono">{summary.reference_number}</span>
            </div>
          )}
          {summary.location && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <MapPin className="h-3.5 w-3.5 text-text-muted shrink-0" />
              {summary.location}
            </div>
          )}
          {summary.industry_sector && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Building2 className="h-3.5 w-3.5 text-text-muted shrink-0" />
              {summary.industry_sector}
            </div>
          )}
        </div>
        <div className="space-y-2">
          {summary.estimated_value && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <DollarSign className="h-3.5 w-3.5 text-text-muted shrink-0" />
              {summary.estimated_value}
            </div>
          )}
          {summary.contract_duration && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Clock className="h-3.5 w-3.5 text-text-muted shrink-0" />
              {summary.contract_duration}
            </div>
          )}
          {summary.submission_deadline && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <CalendarDays className="h-3.5 w-3.5 text-text-muted shrink-0" />
              Deadline: {summary.submission_deadline}
            </div>
          )}
          {summary.submission_method && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Mail className="h-3.5 w-3.5 text-text-muted shrink-0" />
              Submit via: {summary.submission_method}
            </div>
          )}
          {summary.lcs_registration_required && (
            <div className="flex items-center gap-2 text-xs text-accent font-medium">
              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
              LCS Registration Required
            </div>
          )}
        </div>
      </div>

      {/* Requirements */}
      {summary.requirements?.length > 0 && (
        <div className="border-t border-border-light pt-3">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Requirements</h4>
          <ul className="grid sm:grid-cols-2 gap-1">
            {summary.requirements.map((r: string, i: number) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary">
                <CheckCircle className="h-3 w-3 text-accent mt-0.5 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Eligibility */}
      {summary.eligibility && (
        <div className="border-t border-border-light pt-3">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Eligibility</h4>
          <p className="text-xs text-text-secondary">{summary.eligibility}</p>
        </div>
      )}

      {/* Key Dates */}
      {summary.key_dates?.length > 0 && (
        <div className="border-t border-border-light pt-3">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Key Dates</h4>
          <div className="flex flex-wrap gap-2">
            {summary.key_dates.map((d: string, i: number) => (
              <Badge key={i} variant="default" className="text-[10px]">
                <CalendarDays className="h-2.5 w-2.5 mr-1" />{d}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Evaluation Criteria */}
      {summary.evaluation_criteria?.length > 0 && (
        <div className="border-t border-border-light pt-3">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Evaluation Criteria</h4>
          <ul className="space-y-1">
            {summary.evaluation_criteria.map((c: string, i: number) => (
              <li key={i} className="text-xs text-text-secondary">&bull; {c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Submission Instructions */}
      {summary.submission_instructions && (
        <div className="border-t border-border-light pt-3">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Submission Instructions</h4>
          <p className="text-xs text-text-secondary">{summary.submission_instructions}</p>
        </div>
      )}

      {/* Contact */}
      {(summary.contact_name || uniqueEmails.length > 0 || summary.contact_phone) && (
        <div className="border-t border-border-light pt-3">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Contact</h4>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {summary.contact_name && (
              <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                <User className="h-3.5 w-3.5 text-text-muted" />
                {summary.contact_name}
                {summary.contact_title && <span className="text-text-muted">— {summary.contact_title}</span>}
              </span>
            )}
            {uniqueEmails.map((email: string) => (
              <a key={email} href={`mailto:${email}`} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover">
                <Mail className="h-3.5 w-3.5" /> {email}
              </a>
            ))}
            {summary.contact_phone && (
              <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Phone className="h-3.5 w-3.5 text-text-muted" /> {summary.contact_phone}
              </span>
            )}
          </div>
        </div>
      )}

      {/* LCA Categories */}
      {summary.lca_categories?.length > 0 && (
        <div className="border-t border-border-light pt-3">
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">LCA Categories</h4>
          <div className="flex flex-wrap gap-1">
            {summary.lca_categories.map((cat: string, i: number) => (
              <Badge key={i} variant="default" className="text-[10px]">{cat}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
