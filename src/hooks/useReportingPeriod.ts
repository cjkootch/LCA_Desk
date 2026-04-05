"use client";

import { useEffect, useState, useCallback } from "react";
import {
  fetchPeriod,
  fetchExpenditures,
  fetchEmployment,
  fetchCapacity,
  fetchNarratives,
} from "@/server/actions";

export function useReportingPeriod(periodId?: string) {
  const [period, setPeriod] = useState<Awaited<ReturnType<typeof fetchPeriod>> | null>(null);
  const [expenditures, setExpenditures] = useState<Awaited<ReturnType<typeof fetchExpenditures>>>([]);
  const [employment, setEmployment] = useState<Awaited<ReturnType<typeof fetchEmployment>>>([]);
  const [capacity, setCapacity] = useState<Awaited<ReturnType<typeof fetchCapacity>>>([]);
  const [narratives, setNarratives] = useState<Awaited<ReturnType<typeof fetchNarratives>>>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async (id: string) => {
    const [p, exp, emp, cap, nar] = await Promise.all([
      fetchPeriod(id),
      fetchExpenditures(id),
      fetchEmployment(id),
      fetchCapacity(id),
      fetchNarratives(id),
    ]);
    setPeriod(p);
    setExpenditures(exp);
    setEmployment(emp);
    setCapacity(cap);
    setNarratives(nar);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (periodId) fetchAll(periodId);
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
