"use client";

import { useEffect, useState } from "react";
import { fetchStepCompletion } from "@/server/actions";

export function useStepCompletion(periodId: string) {
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  useEffect(() => {
    fetchStepCompletion(periodId)
      .then(setCompletedSteps)
      .catch(() => {});
  }, [periodId]);

  return completedSteps;
}
