import { db } from "@/server/db";
import { userEvents, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const HUBSPOT_SYNC_EVENTS = new Set([
  "entity_created",
  "first_expenditure_added",
  "report_submitted",
  "trial_started",
]);

/**
 * Tracks a user event to the user_events table.
 * For key lifecycle events, also syncs to HubSpot (fire-and-forget).
 * Never throws — all failures are swallowed so tracking can never break the app.
 */
export async function trackEvent(
  userId: string,
  tenantId: string,
  eventName: string,
  properties?: Record<string, unknown>,
  sessionId?: string
): Promise<void> {
  try {
    await db.insert(userEvents).values({
      userId,
      tenantId,
      eventName,
      properties: properties ?? {},
      sessionId: sessionId ?? null,
    });
  } catch (err) {
    console.error("[analytics] trackEvent failed:", eventName, err instanceof Error ? err.message : err);
  }

  // Sync key lifecycle events to HubSpot
  if (HUBSPOT_SYNC_EVENTS.has(eventName)) {
    try {
      const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
      if (user?.email) {
        const { syncBehavioralEvent } = await import("@/lib/hubspot-sync");
        const strProps: Record<string, string> = {};
        for (const [k, v] of Object.entries(properties ?? {})) {
          if (typeof v === "string") strProps[k] = v;
        }
        await syncBehavioralEvent(
          user.email,
          eventName as "entity_created" | "first_expenditure_added" | "report_submitted" | "trial_started",
          strProps
        );
      }
    } catch {
      // HubSpot sync is non-critical — never block the main flow
    }
  }
}
