import { db } from "@/server/db";
import { expenditureRecords } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function getExpendituresForPeriod(
  periodId: string,
  tenantId: string
) {
  return db
    .select()
    .from(expenditureRecords)
    .where(
      and(
        eq(expenditureRecords.reportingPeriodId, periodId),
        eq(expenditureRecords.tenantId, tenantId)
      )
    )
    .orderBy(expenditureRecords.createdAt);
}

export async function createExpenditure(
  data: typeof expenditureRecords.$inferInsert
) {
  const [record] = await db
    .insert(expenditureRecords)
    .values(data)
    .returning();
  return record;
}

export async function deleteExpenditure(id: string, tenantId: string) {
  await db
    .delete(expenditureRecords)
    .where(
      and(
        eq(expenditureRecords.id, id),
        eq(expenditureRecords.tenantId, tenantId)
      )
    );
}
