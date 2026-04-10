import { db } from "@/server/db";
import { cronRuns } from "@/server/db/schema";
import { eq, and, gt } from "drizzle-orm";

/**
 * Inserts a new cron_runs row and returns its id.
 * Call at the very start of a cron handler (after auth check, before work).
 */
export async function startCronRun(jobName: string): Promise<string> {
  const [row] = await db
    .insert(cronRuns)
    .values({ jobName, status: "running" })
    .returning({ id: cronRuns.id });
  return row.id;
}

/**
 * Marks a cron run as complete. Call in the finally block of the handler.
 */
export async function completeCronRun(
  id: string,
  status: "success" | "failed" | "partial",
  recordsProcessed = 0,
  errorMessage?: string
): Promise<void> {
  const now = new Date();

  // Fetch startedAt so we can compute durationMs
  const [run] = await db
    .select({ startedAt: cronRuns.startedAt })
    .from(cronRuns)
    .where(eq(cronRuns.id, id))
    .limit(1);

  const durationMs = run?.startedAt ? now.getTime() - new Date(run.startedAt).getTime() : null;

  await db
    .update(cronRuns)
    .set({
      completedAt: now,
      status,
      recordsProcessed,
      errorMessage: errorMessage ?? null,
      durationMs,
    })
    .where(eq(cronRuns.id, id));
}

/**
 * Returns true if a run for this jobName is already in "running" state
 * and started less than 10 minutes ago — use to skip duplicate invocations.
 */
export async function isAlreadyRunning(jobName: string): Promise<boolean> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const [existing] = await db
    .select({ id: cronRuns.id })
    .from(cronRuns)
    .where(
      and(
        eq(cronRuns.jobName, jobName),
        eq(cronRuns.status, "running"),
        gt(cronRuns.startedAt, tenMinutesAgo)
      )
    )
    .limit(1);
  return !!existing;
}
