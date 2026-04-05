"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ReportingPeriod, ExpenditureRecord, EmploymentRecord, CapacityDevelopmentRecord, NarrativeDraft } from "@/types/database.types";

export function useReportingPeriod(periodId?: string) {
  const [period, setPeriod] = useState<ReportingPeriod | null>(null);
  const [expenditures, setExpenditures] = useState<ExpenditureRecord[]>([]);
  const [employment, setEmployment] = useState<EmploymentRecord[]>([]);
  const [capacity, setCapacity] = useState<CapacityDevelopmentRecord[]>([]);
  const [narratives, setNarratives] = useState<NarrativeDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchAll = useCallback(async (id: string) => {
    const [periodRes, expRes, empRes, capRes, narRes] = await Promise.all([
      supabase.from("reporting_periods").select("*").eq("id", id).single(),
      supabase.from("expenditure_records").select("*").eq("reporting_period_id", id).order("created_at"),
      supabase.from("employment_records").select("*").eq("reporting_period_id", id).order("created_at"),
      supabase.from("capacity_development_records").select("*").eq("reporting_period_id", id).order("created_at"),
      supabase.from("narrative_drafts").select("*").eq("reporting_period_id", id).order("created_at"),
    ]);

    setPeriod(periodRes.data);
    setExpenditures(expRes.data || []);
    setEmployment(empRes.data || []);
    setCapacity(capRes.data || []);
    setNarratives(narRes.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (periodId) {
      fetchAll(periodId);
    }
  }, [periodId, fetchAll]);

  return {
    period,
    expenditures,
    employment,
    capacity,
    narratives,
    loading,
    refetch: periodId ? () => fetchAll(periodId) : () => Promise.resolve(),
  };
}
