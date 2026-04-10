import { NextRequest, NextResponse } from "next/server";
import { startCronRun, completeCronRun, isAlreadyRunning } from "@/lib/cron-logger";

export const dynamic = "force-dynamic";

const JOB_NAME = "scrape-lcs";

export async function GET(req: NextRequest) {
  // Verify this is called by Vercel Cron, not a random user
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
    console.log("LCS scrape cron triggered at", new Date().toISOString());
    // TODO: implement LCS register scrape logic
    return NextResponse.json({
      ok: true,
      message: "Scrape triggered — run npm run scrape:lcs on a dedicated machine for full scrape",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error("scrape-lcs cron error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  } finally {
    await completeCronRun(runId, error ? "failed" : "success", recordsProcessed, error);
  }
}
