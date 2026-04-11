import { auth } from "@/auth";
import { trackEvent } from "@/lib/analytics";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { eventName, properties, tenantId } = body as {
      eventName: string;
      properties?: Record<string, unknown>;
      tenantId?: string;
    };

    if (!eventName || typeof eventName !== "string") {
      return NextResponse.json({ error: "eventName required" }, { status: 400 });
    }

    // tenantId is optional for events fired from contexts without tenant (e.g. modal dismissal)
    await trackEvent(session.user.id, tenantId ?? "unknown", eventName, properties);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
