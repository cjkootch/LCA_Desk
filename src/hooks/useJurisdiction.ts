"use client";

import { useEffect, useState } from "react";
import { getEntityJurisdictionCode } from "@/server/actions";

export function useJurisdiction(entityId: string) {
  const [code, setCode] = useState("GY");

  useEffect(() => {
    if (entityId) {
      getEntityJurisdictionCode(entityId).then(setCode).catch(() => {});
    }
  }, [entityId]);

  return code;
}
