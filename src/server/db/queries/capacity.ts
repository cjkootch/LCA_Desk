import { db } from "@/server/db";
import { capacityDevelopmentRecords } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function getCapacityForPeriod(
  periodId: string,
  tenantId: string
) {
  return db
    .select()
    .from(capacityDevelopmentRecords)
    .where(
      and(
        eq(capacityDevelopmentRecords.reportingPeriodId, periodId),
        eq(capacityDevelopmentRecords.tenantId, tenantId)
      )
    )
    .orderBy(capacityDevelopmentRecords.createdAt);
}

export async function createCapacity(
  data: typeof capacityDevelopmentRecords.$inferInsert
) {
  const [record] = await db
    .insert(capacityDevelopmentRecords)
    .values(data)
    .returning();
  return record;
}

export async function deleteCapacity(id: string, tenantId: string) {
  await db
    .delete(capacityDevelopmentRecords)
    .where(
      and(
        eq(capacityDevelopmentRecords.id, id),
        eq(capacityDevelopmentRecords.tenantId, tenantId)
      )
    );
}
