import { db } from "@/server/db";
import { tenantMembers, tenants } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function getUserTenantIds(userId: string): Promise<string[]> {
  const memberships = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId));
  return memberships.map((m) => m.tenantId);
}

export async function getUserPrimaryTenant(userId: string) {
  const result = await db.query.tenantMembers.findFirst({
    where: eq(tenantMembers.userId, userId),
    with: { tenant: true },
  });
  return result
    ? { tenant: result.tenant, role: result.role, tenantId: result.tenantId }
    : null;
}

export async function getTenantById(tenantId: string) {
  return db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    with: { jurisdiction: true },
  });
}
