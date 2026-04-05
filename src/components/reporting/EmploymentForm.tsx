"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const employmentSchema = z.object({
  job_title: z.string().min(1, "Job title is required"),
  isco_08_code: z.string().optional(),
  position_type: z.enum(["managerial", "technical", "non_technical"]),
  is_guyanese: z.coerce.boolean(),
  nationality: z.string().optional(),
  headcount: z.coerce.number().int().positive(),
  remuneration_band: z.string().optional(),
  total_remuneration_local: z.coerce.number().optional(),
  total_remuneration_usd: z.coerce.number().optional(),
  contract_type: z.enum(["permanent", "contract", "temporary"]).optional(),
});

type EmploymentFormData = z.infer<typeof employmentSchema>;

interface EmploymentFormProps {
  defaultValues?: Partial<EmploymentFormData>;
  onSubmit: (data: EmploymentFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function EmploymentForm({ defaultValues, onSubmit, onCancel, loading }: EmploymentFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EmploymentFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(employmentSchema) as any,
    defaultValues: {
      position_type: "non_technical",
      is_guyanese: true,
      headcount: 1,
      ...defaultValues,
    },
  });

  const isGuyanese = watch("is_guyanese");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Job Title *"
        id="job_title"
        {...register("job_title")}
        error={errors.job_title?.message}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input label="ISCO-08 Code" id="isco_08_code" {...register("isco_08_code")} />
        <Select
          label="Position Type *"
          id="position_type"
          {...register("position_type")}
          options={[
            { value: "managerial", label: "Managerial" },
            { value: "technical", label: "Technical" },
            { value: "non_technical", label: "Non-Technical" },
          ]}
          error={errors.position_type?.message}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Guyanese?"
          id="is_guyanese"
          {...register("is_guyanese")}
          options={[
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]}
        />
        {!isGuyanese && (
          <Input label="Nationality (ISO)" id="nationality" {...register("nationality")} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Headcount *"
          id="headcount"
          type="number"
          min="1"
          {...register("headcount")}
          error={errors.headcount?.message}
        />
        <Select
          label="Contract Type"
          id="contract_type"
          {...register("contract_type")}
          options={[
            { value: "", label: "Select..." },
            { value: "permanent", label: "Permanent" },
            { value: "contract", label: "Contract" },
            { value: "temporary", label: "Temporary" },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Remuneration Band"
          id="remuneration_band"
          {...register("remuneration_band")}
          options={[
            { value: "", label: "Select..." },
            { value: "band_1", label: "Band 1" },
            { value: "band_2", label: "Band 2" },
            { value: "band_3", label: "Band 3" },
            { value: "band_4", label: "Band 4" },
          ]}
        />
        <Input
          label="Total Remuneration (GYD)"
          id="total_remuneration_local"
          type="number"
          step="0.01"
          {...register("total_remuneration_local")}
        />
      </div>
      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Save
        </Button>
      </div>
    </form>
  );
}
