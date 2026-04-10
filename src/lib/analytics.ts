import { db } from "@/server/db";
import { userEvents } from "@/server/db/schema";

/**
 * Tracks a user event to the user_events table.
 * Never throws — all failures are swallowed so tracking can never break the app.
 * Fire-and-forget: callers may omit `await` for non-blocking paths.
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
}
