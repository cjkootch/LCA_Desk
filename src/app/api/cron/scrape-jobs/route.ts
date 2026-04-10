import { NextRequest, NextResponse } from "next/server";
import { startCronRun, completeCronRun, isAlreadyRunning } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";

const JOB_NAME = "scrape-jobs";

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
  let error: string | undefined;

  try {
    console.log("LCS jobs scrape triggered at", new Date().toISOString());
    // TODO: implement jobs scrape logic
    return NextResponse.json({
      ok: true,
      message: "Jobs scrape triggered",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error("scrape-jobs cron error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  } finally {
    await completeCronRun(runId, error ? "failed" : "success", recordsProcessed, error);
  }
}
