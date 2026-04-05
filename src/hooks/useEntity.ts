"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Entity } from "@/types/database.types";

export function useEntity(entityId?: string) {
  const [entity, setEntity] = useState<Entity | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchEntities = useCallback(async () => {
    const { data } = await supabase
      .from("entities")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });
    setEntities(data || []);
    setLoading(false);
  }, [supabase]);

  const fetchEntity = useCallback(async (id: string) => {
    const { data } = await supabase
      .from("entities")
      .select("*")
      .eq("id", id)
      .single();
    setEntity(data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (entityId) {
      fetchEntity(entityId);
    } else {
      fetchEntities();
    }
  }, [entityId, fetchEntity, fetchEntities]);

  return { entity, entities, loading, refetch: entityId ? () => fetchEntity(entityId) : fetchEntities };
}
