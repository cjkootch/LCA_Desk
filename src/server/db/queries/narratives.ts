import { db } from "@/server/db";
import { narrativeDrafts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";

export async function getNarrativesForPeriod(
  periodId: string,
  tenantId: string
) {
  return db
    .select()
    .from(narrativeDrafts)
    .where(
      and(
        eq(narrativeDrafts.reportingPeriodId, periodId),
        eq(narrativeDrafts.tenantId, tenantId)
      )
    )
    .orderBy(narrativeDrafts.createdAt);
}

export async function upsertNarrative(
  periodId: string,
  entityId: string,
  tenantId: string,
  section: string,
  content: string,
  model: string = "claude-sonnet-4-6"
) {
  // Check for existing
  const [existing] = await db
    .select()
    .from(narrativeDrafts)
    .where(
      and(
        eq(narrativeDrafts.reportingPeriodId, periodId),
        eq(narrativeDrafts.tenantId, tenantId),
        eq(narrativeDrafts.section, section)
      )
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(narrativeDrafts)
      .set({ draftContent: content, modelUsed: model })
      .where(eq(narrativeDrafts.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(narrativeDrafts)
    .values({
      reportingPeriodId: periodId,
      entityId,
      tenantId,
      section,
      draftContent: content,
      modelUsed: model,
      promptVersion: "1.0",
    })
    .returning();
  return created;
}
