import { db } from "@/server/db";
import { sectorCategories } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function getCategoriesForJurisdiction(jurisdictionId: string) {
  return db
    .select()
    .from(sectorCategories)
    .where(eq(sectorCategories.jurisdictionId, jurisdictionId))
    .orderBy(sectorCategories.sortOrder);
}

export async function getAllActiveCategories() {
  return db
    .select()
    .from(sectorCategories)
    .where(eq(sectorCategories.active, true))
    .orderBy(sectorCategories.sortOrder);
}
