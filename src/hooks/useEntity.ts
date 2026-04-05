"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchEntities, fetchEntity } from "@/server/actions";

type EntityRow = Awaited<ReturnType<typeof fetchEntities>>[number];

export function useEntity(entityId?: string) {
  const [entity, setEntity] = useState<EntityRow | null>(null);
  const [entitiesList, setEntitiesList] = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEntities = useCallback(async () => {
    const data = await fetchEntities();
    setEntitiesList(data);
    setLoading(false);
  }, []);

  const loadEntity = useCallback(async (id: string) => {
    const data = await fetchEntity(id);
    setEntity(data ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (entityId) {
      loadEntity(entityId);
    } else {
      loadEntities();
    }
  }, [entityId, loadEntity, loadEntities]);

  return {
    entity,
    entities: entitiesList,
    loading,
    refetch: entityId ? () => loadEntity(entityId) : loadEntities,
  };
}
