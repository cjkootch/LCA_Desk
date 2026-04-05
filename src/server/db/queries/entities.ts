import { db } from "@/server/db";
import { entities } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function getEntitiesForTenant(tenantId: string) {
  return db.query.entities.findMany({
    where: and(eq(entities.tenantId, tenantId), eq(entities.active, true)),
    orderBy: (e, { desc }) => [desc(e.createdAt)],
    with: {
      jurisdiction: true,
    },
  });
}

export async function getEntityById(entityId: string, tenantId: string) {
  return db.query.entities.findFirst({
    where: and(eq(entities.id, entityId), eq(entities.tenantId, tenantId)),
    with: {
      jurisdiction: true,
      coventurers: true,
    },
  });
}

export async function createEntity(
  data: typeof entities.$inferInsert
) {
  const [entity] = await db.insert(entities).values(data).returning();
  return entity;
}

export async function updateEntity(
  entityId: string,
  tenantId: string,
  data: Partial<typeof entities.$inferInsert>
) {
  const [updated] = await db
    .update(entities)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(entities.id, entityId), eq(entities.tenantId, tenantId)))
    .returning();
  return updated;
}
