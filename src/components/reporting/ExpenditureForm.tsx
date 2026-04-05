"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SectorCategory } from "@/types/database.types";

const expenditureSchema = z.object({
  sector_category_id: z.string().min(1, "Sector category is required"),
  supplier_name: z.string().min(1, "Supplier name is required"),
  supplier_lcs_cert_id: z.string().optional(),
  is_guyanese_supplier: z.coerce.boolean(),
  is_sole_sourced: z.coerce.boolean(),
  sole_source_code: z.string().optional(),
  amount_local: z.coerce.number().positive("Amount must be positive"),
  amount_usd: z.coerce.number().optional(),
  payment_method: z.string().optional(),
  payment_date: z.string().optional(),
  description: z.string().optional(),
});

type ExpenditureFormData = z.infer<typeof expenditureSchema>;

interface ExpenditureFormProps {
  categories: SectorCategory[];
  defaultValues?: Partial<ExpenditureFormData>;
  onSubmit: (data: ExpenditureFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function ExpenditureForm({
  categories,
  defaultValues,
  onSubmit,
  onCancel,
  loading,
}: ExpenditureFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ExpenditureFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(expenditureSchema) as any,
    defaultValues: {
      is_guyanese_supplier: false,
      is_sole_sourced: false,
      ...defaultValues,
    },
  });

  const isGuyanese = watch("is_guyanese_supplier");
  const isSoleSourced = watch("is_sole_sourced");

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: `${c.code} - ${c.name}`,
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select
        label="Sector Category *"
        id="sector_category_id"
        {...register("sector_category_id")}
        options={categoryOptions}
        placeholder="Select a category"
        error={errors.sector_category_id?.message}
      />
      <Input
        label="Supplier Name *"
        id="supplier_name"
        {...register("supplier_name")}
        error={errors.supplier_name?.message}
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Guyanese Supplier?"
          id="is_guyanese_supplier"
          {...register("is_guyanese_supplier")}
          options={[
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]}
        />
        <Input
          label="LCS Certificate ID"
          id="supplier_lcs_cert_id"
          {...register("supplier_lcs_cert_id")}
          hint={isGuyanese ? "Required for Guyanese suppliers" : undefined}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Sole Sourced?"
          id="is_sole_sourced"
          {...register("is_sole_sourced")}
          options={[
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ]}
        />
        {isSoleSourced && (
          <Input
            label="Sole Source Code"
            id="sole_source_code"
            {...register("sole_source_code")}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Amount (GYD) *"
          id="amount_local"
          type="number"
          step="0.01"
          {...register("amount_local")}
          error={errors.amount_local?.message}
        />
        <Input
          label="Amount (USD)"
          id="amount_usd"
          type="number"
          step="0.01"
          {...register("amount_usd")}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Payment Method"
          id="payment_method"
          {...register("payment_method")}
          options={[
            { value: "", label: "Select..." },
            { value: "cash", label: "Cash" },
            { value: "cheque", label: "Cheque" },
            { value: "bank_transfer", label: "Bank Transfer" },
            { value: "credit", label: "Credit" },
          ]}
        />
        <Input
          label="Payment/Invoice Date"
          id="payment_date"
          type="date"
          {...register("payment_date")}
        />
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
