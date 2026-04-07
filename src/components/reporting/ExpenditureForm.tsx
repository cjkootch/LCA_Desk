"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CertVerification } from "@/components/reporting/CertVerification";
import { Badge } from "@/components/ui/badge";
import { searchLcsRegister } from "@/server/actions";

const expenditureSchema = z.object({
  type_of_item_procured: z.string().min(1, "Type of item is required"),
  related_sector: z.string().optional(),
  description_of_good_service: z.string().optional(),
  supplier_name: z.string().min(1, "Supplier name is required"),
  supplier_type: z.enum(["Guyanese", "Non-Guyanese"]).optional(),
  sole_source_code: z.string().optional(),
  supplier_certificate_id: z.string().optional(),
  actual_payment: z.coerce.number().positive("Actual payment must be positive"),
  outstanding_payment: z.coerce.number().optional(),
  projection_next_period: z.coerce.number().optional(),
  payment_method: z.string().optional(),
  supplier_bank: z.string().optional(),
  bank_location_country: z.string().optional(),
  currency_of_payment: z.string().optional(),
  notes: z.string().optional(),
});

type ExpenditureFormData = z.infer<typeof expenditureSchema>;

function SupplierAutoSuggest({ value, onChange, onTypeChange, error }: {
  value: string;
  onChange: (name: string, certId?: string) => void;
  onTypeChange?: (type: string) => void;
  error?: string;
}) {
  const [query, setQuery] = useState(value || "");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    onChange(val);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    if (val.length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchLcsRegister(val).then(results => {
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
        }).catch(() => {});
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-text-primary mb-1.5">Supplier Name *</label>
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
        placeholder="Start typing to search LCS register..."
        className="w-full h-10 px-3 rounded-lg bg-white border border-border text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
      />
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
      {showSuggestions && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.certId || s.legalName}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-bg-primary transition-colors border-b border-border-light last:border-0"
              onClick={() => {
                onChange(s.legalName, s.certId || undefined);
                if (onTypeChange) onTypeChange("Guyanese");
                setQuery(s.legalName);
                setShowSuggestions(false);
              }}
            >
              <p className="text-sm font-medium text-text-primary">{s.legalName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {s.certId && <span className="text-[10px] font-mono text-accent">{s.certId}</span>}
                {s.status && <Badge variant={s.status.toLowerCase() === "active" ? "success" : "default"} className="text-[9px]">{s.status}</Badge>}
                {s.serviceCategories?.slice(0, 2).map((c: string) => (
                  <span key={c} className="text-[10px] text-text-muted">{c}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ExpenditureFormProps {
  sectorOptions: string[];
  defaultValues?: Partial<ExpenditureFormData>;
  onSubmit: (data: ExpenditureFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  batchMode?: boolean;
  onSaveAndNext?: (data: ExpenditureFormData) => Promise<void>;
}

export function ExpenditureForm({
  sectorOptions,
  defaultValues,
  onSubmit,
  onCancel,
  loading,
  batchMode,
  onSaveAndNext,
}: ExpenditureFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
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
        <SupplierAutoSuggest
          value={watch("supplier_name")}
          onChange={(name, certId) => {
            setValue("supplier_name", name);
            if (certId) setValue("supplier_certificate_id", certId);
          }}
          onTypeChange={(type) => setValue("supplier_type", type as "Guyanese" | "Non-Guyanese")}
          error={errors.supplier_name?.message}
        />
        <Select
          label="Supplier Type"
          id="supplier_type"
          {...register("supplier_type")}
          options={[
            { value: "", label: "Select..." },
            { value: "Guyanese", label: "Guyanese Company" },
            { value: "Non-Guyanese", label: "Non-Guyanese Company" },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
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
              setValue("supplier_type", "Guyanese");
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

      <Input label="Notes" id="notes" {...register("notes")} placeholder="Optional notes or context" />

      <div className="flex items-center justify-between pt-4">
        <p className="text-[10px] text-text-muted">Enter to save · Escape to cancel</p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          {batchMode && onSaveAndNext && (
            <Button type="button" variant="outline" loading={loading}
              onClick={handleSubmit(async (data) => { await onSaveAndNext(data); reset({ currency_of_payment: "GYD" }); })}>
              Save &amp; Add Another
            </Button>
          )}
          <Button type="submit" loading={loading}>Save</Button>
        </div>
      </div>
    </form>
  );
}
