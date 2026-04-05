"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const capacitySchema = z.object({
  activity_type: z.enum(["training", "scholarship", "apprenticeship", "on_the_job", "certification"]),
  activity_name: z.string().min(1, "Activity name is required"),
  provider_name: z.string().optional(),
  provider_type: z.enum(["local", "international"]).optional(),
  participant_count: z.coerce.number().int().min(0),
  guyanese_participant_count: z.coerce.number().int().min(0),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  total_hours: z.coerce.number().min(0).optional(),
  cost_local: z.coerce.number().min(0).optional(),
  cost_usd: z.coerce.number().min(0).optional(),
  description: z.string().optional(),
});

type CapacityFormData = z.infer<typeof capacitySchema>;

interface CapacityFormProps {
  defaultValues?: Partial<CapacityFormData>;
  onSubmit: (data: CapacityFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function CapacityForm({ defaultValues, onSubmit, onCancel, loading }: CapacityFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CapacityFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(capacitySchema) as any,
    defaultValues: {
      activity_type: "training",
      participant_count: 0,
      guyanese_participant_count: 0,
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select
        label="Activity Type *"
        id="activity_type"
        {...register("activity_type")}
        options={[
          { value: "training", label: "Training" },
          { value: "scholarship", label: "Scholarship" },
          { value: "apprenticeship", label: "Apprenticeship" },
          { value: "on_the_job", label: "On-the-Job" },
          { value: "certification", label: "Certification" },
        ]}
        error={errors.activity_type?.message}
      />
      <Input
        label="Activity Name *"
        id="activity_name"
        {...register("activity_name")}
        error={errors.activity_name?.message}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Provider Name" id="provider_name" {...register("provider_name")} />
        <Select
          label="Provider Type"
          id="provider_type"
          {...register("provider_type")}
          options={[
            { value: "", label: "Select..." },
            { value: "local", label: "Local" },
            { value: "international", label: "International" },
          ]}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Total Participants"
          id="participant_count"
          type="number"
          min="0"
          {...register("participant_count")}
        />
        <Input
          label="Guyanese Participants"
          id="guyanese_participant_count"
          type="number"
          min="0"
          {...register("guyanese_participant_count")}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Start Date" id="start_date" type="date" {...register("start_date")} />
        <Input label="End Date" id="end_date" type="date" {...register("end_date")} />
        <Input label="Total Hours" id="total_hours" type="number" step="0.5" {...register("total_hours")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Cost (GYD)" id="cost_local" type="number" step="0.01" {...register("cost_local")} />
        <Input label="Cost (USD)" id="cost_usd" type="number" step="0.01" {...register("cost_usd")} />
      </div>
      <Input label="Description" id="description" {...register("description")} />
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
