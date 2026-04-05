import type { Entity } from "@/types/database.types";

// Maps Drizzle entity row to our Entity type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDrizzleEntity(e: any): Entity {
  return {
    id: e.id,
    tenant_id: e.tenantId,
    jurisdiction_id: e.jurisdictionId || "",
    legal_name: e.legalName,
    trading_name: e.tradingName,
    registration_number: e.registrationNumber,
    lcs_certificate_id: e.lcsCertificateId,
    lcs_certificate_expiry: e.lcsCertificateExpiry,
    petroleum_agreement_ref: e.petroleumAgreementRef,
    company_type: e.companyType,
    guyanese_ownership_pct: e.guyanaeseOwnershipPct ? Number(e.guyanaeseOwnershipPct) : null,
    registered_address: e.registeredAddress,
    tin_number: e.tinNumber || null,
    date_of_incorporation: e.dateOfIncorporation || null,
    industry_sector: e.industrySector || null,
    number_of_employees: e.numberOfEmployees || null,
    annual_revenue_range: e.annualRevenueRange || null,
    operational_address: e.operationalAddress || null,
    parent_company_name: e.parentCompanyName || null,
    country_of_incorporation: e.countryOfIncorporation || null,
    website: e.website || null,
    contact_name: e.contactName,
    contact_email: e.contactEmail,
    contact_phone: e.contactPhone,
    authorized_rep_name: e.authorizedRepName,
    authorized_rep_designation: e.authorizedRepDesignation,
    active: e.active ?? true,
    created_at: e.createdAt?.toISOString?.() || e.createdAt || "",
    updated_at: e.updatedAt?.toISOString?.() || e.updatedAt || "",
  };
}
