"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const entitySchema = z.object({
  legal_name: z.string().min(1, "Legal name is required"),
  trading_name: z.string().optional(),
  registration_number: z.string().optional(),
  lcs_certificate_id: z.string().optional(),
  lcs_certificate_expiry: z.string().optional(),
  petroleum_agreement_ref: z.string().optional(),
  company_type: z.enum(["contractor", "subcontractor", "licensee"]),
  guyanese_ownership_pct: z.coerce.number().min(0).max(100).optional(),
  registered_address: z.string().optional(),
  tin_number: z.string().optional(),
  date_of_incorporation: z.string().optional(),
  industry_sector: z.string().optional(),
  number_of_employees: z.coerce.number().int().min(0).optional(),
  annual_revenue_range: z.string().optional(),
  operational_address: z.string().optional(),
  parent_company_name: z.string().optional(),
  country_of_incorporation: z.string().optional(),
  website: z.string().optional(),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal("")),
  contact_phone: z.string().optional(),
  authorized_rep_name: z.string().optional(),
  authorized_rep_designation: z.string().optional(),
});

type EntityFormData = z.infer<typeof entitySchema>;

interface EntityFormProps {
  defaultValues?: Partial<EntityFormData>;
  onSubmit: (data: EntityFormData) => Promise<void>;
  loading?: boolean;
}

export function EntityForm({ defaultValues, onSubmit, loading }: EntityFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EntityFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(entitySchema) as any,
    defaultValues: {
      company_type: "contractor",
      country_of_incorporation: "GY",
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Company Identity */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Company Identity
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Legal Name *" id="legal_name" {...register("legal_name")} error={errors.legal_name?.message} />
          <Input label="Trading Name" id="trading_name" {...register("trading_name")} />
          <Input label="Registration Number" id="registration_number" {...register("registration_number")} />
          <Input label="TIN (Tax ID)" id="tin_number" {...register("tin_number")} />
          <Select label="Company Type *" id="company_type" {...register("company_type")}
            options={[
              { value: "contractor", label: "Contractor" },
              { value: "subcontractor", label: "Subcontractor" },
              { value: "licensee", label: "Licensee" },
            ]}
            error={errors.company_type?.message}
          />
          <Input label="Industry / Sector" id="industry_sector" {...register("industry_sector")} placeholder="e.g. Oil & Gas Services" />
          <Input label="Date of Incorporation" id="date_of_incorporation" type="date" {...register("date_of_incorporation")} />
          <Select label="Country of Incorporation" id="country_of_incorporation" {...register("country_of_incorporation")}
            options={[
              { value: "GY", label: "Guyana" },
              { value: "NG", label: "Nigeria" },
              { value: "US", label: "United States" },
              { value: "GB", label: "United Kingdom" },
              { value: "TT", label: "Trinidad & Tobago" },
              { value: "SR", label: "Suriname" },
              { value: "CA", label: "Canada" },
              { value: "NL", label: "Netherlands" },
              { value: "CN", label: "China" },
              { value: "IN", label: "India" },
              { value: "BR", label: "Brazil" },
              { value: "NA", label: "Namibia" },
              { value: "OTHER", label: "Other" },
            ]}
          />
          <Input label="Parent Company" id="parent_company_name" {...register("parent_company_name")} placeholder="If subsidiary" />
          <Input label="Website" id="website" {...register("website")} placeholder="https://..." />
        </div>
      </div>

      {/* LCA Compliance */}
      <div className="pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          LCA Compliance
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="LCS Certificate ID" id="lcs_certificate_id" {...register("lcs_certificate_id")} />
          <Input label="LCS Certificate Expiry" id="lcs_certificate_expiry" type="date" {...register("lcs_certificate_expiry")} />
          <Input label="Petroleum Agreement Ref" id="petroleum_agreement_ref" {...register("petroleum_agreement_ref")} />
          <Input label="Guyanese Ownership %" id="guyanese_ownership_pct" type="number" min="0" max="100" {...register("guyanese_ownership_pct")} />
        </div>
      </div>

      {/* Company Size */}
      <div className="pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Company Size
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Number of Employees" id="number_of_employees" type="number" min="0" {...register("number_of_employees")} />
          <Select label="Annual Revenue Range" id="annual_revenue_range" {...register("annual_revenue_range")}
            options={[
              { value: "", label: "Select..." },
              { value: "under_1m", label: "Under $1M" },
              { value: "1m_5m", label: "$1M – $5M" },
              { value: "5m_25m", label: "$5M – $25M" },
              { value: "25m_100m", label: "$25M – $100M" },
              { value: "100m_500m", label: "$100M – $500M" },
              { value: "over_500m", label: "Over $500M" },
            ]}
          />
        </div>
      </div>

      {/* Addresses */}
      <div className="pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Addresses
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Registered Office Address" id="registered_address" {...register("registered_address")} />
          <Input label="Operational Address" id="operational_address" {...register("operational_address")} placeholder="If different from registered" />
        </div>
      </div>

      {/* Contact & Authorized Representative */}
      <div className="pt-4 border-t border-border">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Contact & Authorized Representative
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Contact Name" id="contact_name" {...register("contact_name")} />
          <Input label="Contact Email" id="contact_email" type="email" {...register("contact_email")} error={errors.contact_email?.message} />
          <Input label="Contact Phone" id="contact_phone" {...register("contact_phone")} />
          <div />
          <Input label="Authorized Rep Name" id="authorized_rep_name" {...register("authorized_rep_name")} hint="For Secretariat submissions" />
          <Input label="Authorized Rep Designation" id="authorized_rep_designation" {...register("authorized_rep_designation")} placeholder="e.g. Managing Director" />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" loading={loading}>
          Save Entity
        </Button>
      </div>
    </form>
  );
}
