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
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal("")),
  contact_phone: z.string().optional(),
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
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Legal Name *"
          id="legal_name"
          {...register("legal_name")}
          error={errors.legal_name?.message}
        />
        <Input
          label="Trading Name"
          id="trading_name"
          {...register("trading_name")}
        />
        <Input
          label="Registration Number"
          id="registration_number"
          {...register("registration_number")}
        />
        <Select
          label="Company Type *"
          id="company_type"
          {...register("company_type")}
          options={[
            { value: "contractor", label: "Contractor" },
            { value: "subcontractor", label: "Subcontractor" },
            { value: "licensee", label: "Licensee" },
          ]}
          error={errors.company_type?.message}
        />
        <Input
          label="LCS Certificate ID"
          id="lcs_certificate_id"
          {...register("lcs_certificate_id")}
        />
        <Input
          label="LCS Certificate Expiry"
          id="lcs_certificate_expiry"
          type="date"
          {...register("lcs_certificate_expiry")}
        />
        <Input
          label="Petroleum Agreement Ref"
          id="petroleum_agreement_ref"
          {...register("petroleum_agreement_ref")}
        />
        <Input
          label="Guyanese Ownership %"
          id="guyanese_ownership_pct"
          type="number"
          min="0"
          max="100"
          {...register("guyanese_ownership_pct")}
        />
      </div>

      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider pt-4 border-t border-border">
        Contact Information
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Contact Name"
          id="contact_name"
          {...register("contact_name")}
        />
        <Input
          label="Contact Email"
          id="contact_email"
          type="email"
          {...register("contact_email")}
          error={errors.contact_email?.message}
        />
        <Input
          label="Contact Phone"
          id="contact_phone"
          {...register("contact_phone")}
        />
        <Input
          label="Registered Address"
          id="registered_address"
          {...register("registered_address")}
        />
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" loading={loading}>
          Save Entity
        </Button>
      </div>
    </form>
  );
}
