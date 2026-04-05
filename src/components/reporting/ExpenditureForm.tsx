"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CertVerification } from "@/components/reporting/CertVerification";

const expenditureSchema = z.object({
  type_of_item_procured: z.string().min(1, "Type of item is required"),
  related_sector: z.string().optional(),
  description_of_good_service: z.string().optional(),
  supplier_name: z.string().min(1, "Supplier name is required"),
  sole_source_code: z.string().optional(),
  supplier_certificate_id: z.string().optional(),
  actual_payment: z.coerce.number().positive("Actual payment must be positive"),
  outstanding_payment: z.coerce.number().optional(),
  projection_next_period: z.coerce.number().optional(),
  payment_method: z.string().optional(),
  supplier_bank: z.string().optional(),
  bank_location_country: z.string().optional(),
  currency_of_payment: z.string().optional(),
});

type ExpenditureFormData = z.infer<typeof expenditureSchema>;

interface ExpenditureFormProps {
  sectorOptions: string[];
  defaultValues?: Partial<ExpenditureFormData>;
  onSubmit: (data: ExpenditureFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function ExpenditureForm({
  sectorOptions,
  defaultValues,
  onSubmit,
  onCancel,
  loading,
}: ExpenditureFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExpenditureFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(expenditureSchema) as any,
    defaultValues: {
      currency_of_payment: "GYD",
      ...defaultValues,
    },
  });

  const watchCertId = watch("supplier_certificate_id") || "";

  const sectorSelectOptions = sectorOptions.map((s) => ({
    value: s,
    label: s,
  }));

  const paymentMethodOptions = [
    { value: "", label: "Select..." },
    { value: "Cash", label: "Cash" },
    { value: "Cheque", label: "Cheque" },
    { value: "Bank Transfer", label: "Bank Transfer" },
    { value: "Wire Transfer", label: "Wire Transfer" },
    { value: "Credit", label: "Credit" },
  ];

  const currencyOptions = [
    { value: "GYD", label: "GYD" },
    { value: "USD", label: "USD" },
    { value: "TTD", label: "TTD" },
    { value: "Other", label: "Other" },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Type of Item Procured *"
        id="type_of_item_procured"
        {...register("type_of_item_procured")}
        error={errors.type_of_item_procured?.message}
      />

      <Select
        label="Related Sector"
        id="related_sector"
        {...register("related_sector")}
        options={sectorSelectOptions}
        placeholder="Select a sector"
        error={errors.related_sector?.message}
      />

      <Input
        label="Description of Good/Service"
        id="description_of_good_service"
        {...register("description_of_good_service")}
        error={errors.description_of_good_service?.message}
      />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Supplier Name *"
          id="supplier_name"
          {...register("supplier_name")}
          error={errors.supplier_name?.message}
        />
        <Input
          label="Sole Source Code"
          id="sole_source_code"
          {...register("sole_source_code")}
        />
      </div>

      <div>
        <Input
          label="Supplier Certificate ID"
          id="supplier_certificate_id"
          placeholder="LCSR-XXXXXXXX"
          {...register("supplier_certificate_id")}
        />
        <CertVerification
          certId={watchCertId}
          onCompanyFound={(company) => {
            if (company) {
              setValue("supplier_name", company.legalName);
            }
          }}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Input
          label="Actual Payment *"
          id="actual_payment"
          type="number"
          step="0.01"
          {...register("actual_payment")}
          error={errors.actual_payment?.message}
        />
        <Input
          label="Outstanding Payment"
          id="outstanding_payment"
          type="number"
          step="0.01"
          {...register("outstanding_payment")}
        />
        <Input
          label="Projection for Next Period"
          id="projection_next_period"
          type="number"
          step="0.01"
          {...register("projection_next_period")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Method of Payment"
          id="payment_method"
          {...register("payment_method")}
          options={paymentMethodOptions}
        />
        <Select
          label="Currency of Payment"
          id="currency_of_payment"
          {...register("currency_of_payment")}
          options={currencyOptions}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Supplier's (Recipient's) Bank"
          id="supplier_bank"
          {...register("supplier_bank")}
        />
        <Input
          label="Location of Bank (Country)"
          id="bank_location_country"
          {...register("bank_location_country")}
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
