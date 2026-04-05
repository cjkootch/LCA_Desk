import { db } from "@/server/db";
import { employmentRecords } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function getEmploymentForPeriod(
  periodId: string,
  tenantId: string
) {
  return db
    .select()
    .from(employmentRecords)
    .where(
      and(
        eq(employmentRecords.reportingPeriodId, periodId),
        eq(employmentRecords.tenantId, tenantId)
      )
    )
    .orderBy(employmentRecords.createdAt);
}

export async function createEmployment(
  data: typeof employmentRecords.$inferInsert
) {
  const [record] = await db
    .insert(employmentRecords)
    .values(data)
    .returning();
  return record;
}

export async function deleteEmployment(id: string, tenantId: string) {
  await db
    .delete(employmentRecords)
    .where(
      and(
        eq(employmentRecords.id, id),
        eq(employmentRecords.tenantId, tenantId)
      )
    );
}
