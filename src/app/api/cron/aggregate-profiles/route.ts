import { NextRequest, NextResponse } from "next/server";
import { aggregateCompanyProfiles } from "@/server/actions";
import { startCronRun, completeCronRun, isAlreadyRunning } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";

const JOB_NAME = "aggregate-profiles";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (await isAlreadyRunning(JOB_NAME)) {
    return NextResponse.json({ skipped: "already running" }, { status: 200 });
  }

  const runId = await startCronRun(JOB_NAME);
  let recordsProcessed = 0;
  let cronError: string | undefined;

  try {
    const result = await aggregateCompanyProfiles();
    recordsProcessed = (result as { count?: number }).count ?? 0;
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    cronError = error instanceof Error ? error.message : String(error);
    console.error("Profile aggregation failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  } finally {
    await completeCronRun(runId, cronError ? "failed" : "success", recordsProcessed, cronError);
  }
}
