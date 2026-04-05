import { db } from "@/server/db";
import { reportingPeriods } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function getPeriodsForEntity(
  entityId: string,
  tenantId: string
) {
  return db.query.reportingPeriods.findMany({
    where: and(
      eq(reportingPeriods.entityId, entityId),
      eq(reportingPeriods.tenantId, tenantId)
    ),
    orderBy: (p, { desc }) => [desc(p.periodStart)],
  });
}

export async function getPeriodById(periodId: string, tenantId: string) {
  return db.query.reportingPeriods.findFirst({
    where: and(
      eq(reportingPeriods.id, periodId),
      eq(reportingPeriods.tenantId, tenantId)
    ),
  });
}

export async function createPeriod(
  data: typeof reportingPeriods.$inferInsert
) {
  const [period] = await db
    .insert(reportingPeriods)
    .values(data)
    .returning();
  return period;
}

export async function updatePeriodStatus(
  periodId: string,
  tenantId: string,
  status: string,
  submittedAt?: Date
) {
  const [updated] = await db
    .update(reportingPeriods)
    .set({ status, submittedAt, updatedAt: new Date() })
    .where(
      and(
        eq(reportingPeriods.id, periodId),
        eq(reportingPeriods.tenantId, tenantId)
      )
    )
    .returning();
  return updated;
}
