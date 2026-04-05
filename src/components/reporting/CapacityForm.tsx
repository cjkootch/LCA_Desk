"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const PARTICIPANT_TYPE_OPTIONS = [
  { value: "Guyanese (Internal)", label: "Guyanese (Internal)" },
  { value: "Guyanese (External)", label: "Guyanese (External)" },
  { value: "Non-Guyanese (Internal)", label: "Non-Guyanese (Internal)" },
  { value: "Non-Guyanese (External)", label: "Non-Guyanese (External)" },
  { value: "Mixed (Internal)", label: "Mixed (Internal)" },
  { value: "Mixed (External)", label: "Mixed (External)" },
  { value: "Mixed", label: "Mixed" },
  { value: "Guyanese Supplier", label: "Guyanese Supplier" },
  { value: "Non-Guyanese Supplier", label: "Non-Guyanese Supplier" },
  { value: "Mixed Supplier", label: "Mixed Supplier" },
] as const;

const capacitySchema = z.object({
  activity: z.string().min(1, "Activity is required"),
  category: z.string().optional(),
  participant_type: z.string().optional(),
  guyanese_participants_only: z.coerce.number().int().min(0).optional(),
  total_participants: z.coerce.number().int().min(0).optional(),
  start_date: z.string().optional(),
  duration_days: z.coerce.number().min(0).optional(),
  cost_to_participants: z.coerce.number().optional(),
  expenditure_on_capacity: z.coerce.number().optional(),
  notes: z.string().optional(),
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
      activity: "",
      category: "",
      participant_type: "",
      guyanese_participants_only: 0,
      total_participants: 0,
      duration_days: 0,
      cost_to_participants: 0,
      expenditure_on_capacity: 0,
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Activity *"
        id="activity"
        {...register("activity")}
        error={errors.activity?.message}
      />
      <Input
        label="Category"
        id="category"
        {...register("category")}
        error={errors.category?.message}
      />
      <Select
        label="Participant Type"
        id="participant_type"
        {...register("participant_type")}
        placeholder="Select participant type..."
        options={PARTICIPANT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        error={errors.participant_type?.message}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Number of Guyanese Participants Only"
          id="guyanese_participants_only"
          type="number"
          min="0"
          {...register("guyanese_participants_only")}
          error={errors.guyanese_participants_only?.message}
        />
        <Input
          label="Total Number of Participants"
          id="total_participants"
          type="number"
          min="0"
          {...register("total_participants")}
          error={errors.total_participants?.message}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Start Date"
          id="start_date"
          type="date"
          {...register("start_date")}
          error={errors.start_date?.message}
        />
        <Input
          label="Duration of Activity (# of Days)"
          id="duration_days"
          type="number"
          min="0"
          {...register("duration_days")}
          error={errors.duration_days?.message}
        />
        <Input
          label="Cost to Participants"
          id="cost_to_participants"
          type="number"
          step="0.01"
          {...register("cost_to_participants")}
          error={errors.cost_to_participants?.message}
        />
      </div>
      <Input
        label="Expenditure on Capacity Building"
        id="expenditure_on_capacity"
        type="number"
        step="0.01"
        {...register("expenditure_on_capacity")}
        error={errors.expenditure_on_capacity?.message}
      />
      <Input label="Notes" id="notes" {...register("notes")} placeholder="Optional notes" />
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
