"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const employmentSchema = z.object({
  job_title: z.string().min(1, "Job title is required"),
  employment_category: z.enum(["Managerial", "Technical", "Non-Technical"]),
  employment_classification: z.string().optional(),
  related_company: z.string().optional(),
  total_employees: z.coerce.number().int().min(1, "Must be at least 1"),
  guyanese_employed: z.coerce.number().int().min(0, "Must be 0 or more"),
  total_remuneration_paid: z.coerce.number().optional(),
  remuneration_guyanese_only: z.coerce.number().optional(),
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
    formState: { errors },
  } = useForm<EmploymentFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(employmentSchema) as any,
    defaultValues: {
      employment_category: "Non-Technical",
      total_employees: 1,
      guyanese_employed: 0,
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Job Title *"
        id="job_title"
        {...register("job_title")}
        error={errors.job_title?.message}
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Employment Category *"
          id="employment_category"
          {...register("employment_category")}
          options={[
            { value: "Managerial", label: "Managerial" },
            { value: "Technical", label: "Technical" },
            { value: "Non-Technical", label: "Non-Technical" },
          ]}
          error={errors.employment_category?.message}
        />
        <Input
          label="Employment Classification (ISCO-08)"
          id="employment_classification"
          {...register("employment_classification")}
          error={errors.employment_classification?.message}
        />
      </div>
      <Input
        label="Related Company"
        id="related_company"
        {...register("related_company")}
        error={errors.related_company?.message}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Total Number of Employees *"
          id="total_employees"
          type="number"
          min="1"
          {...register("total_employees")}
          error={errors.total_employees?.message}
        />
        <Input
          label="Number of Guyanese Employed *"
          id="guyanese_employed"
          type="number"
          min="0"
          {...register("guyanese_employed")}
          error={errors.guyanese_employed?.message}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Total Remuneration Paid"
          id="total_remuneration_paid"
          type="number"
          step="0.01"
          {...register("total_remuneration_paid")}
          error={errors.total_remuneration_paid?.message}
        />
        <Input
          label="Remuneration Paid to Guyanese Only"
          id="remuneration_guyanese_only"
          type="number"
          step="0.01"
          {...register("remuneration_guyanese_only")}
          error={errors.remuneration_guyanese_only?.message}
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
