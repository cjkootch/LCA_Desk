import { getAnthropicClient } from "@/lib/ai/anthropic";
import { buildNarrativePrompt } from "@/lib/ai/prompts";
import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { incrementUsage } from "@/server/actions";
import { db } from "@/server/db";
import { tenantMembers, tenants, usageTracking } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { trackEvent } from "@/lib/analytics";
import { getEffectivePlan } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  try {
    const { section, data, jurisdiction_code } = await req.json();

    if (!section || !data) {
      return new Response("Missing required fields: section, data", { status: 400 });
    }

    // Resolve tenantId and enforce plan limits before calling Anthropic
    const [membership] = await db
      .select({ tenantId: tenantMembers.tenantId })
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, session.user.id))
      .limit(1);
    const tenantId = membership?.tenantId;

    if (!tenantId) {
      return new Response("Tenant not found", { status: 403 });
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const [[tenant], [usage]] = await Promise.all([
      db.select({ plan: tenants.plan, trialEndsAt: tenants.trialEndsAt })
        .from(tenants).where(eq(tenants.id, tenantId)).limit(1),
      db.select({ aiDraftsUsed: usageTracking.aiDraftsUsed })
        .from(usageTracking)
        .where(and(eq(usageTracking.tenantId, tenantId), eq(usageTracking.periodMonth, currentMonth)))
        .limit(1),
    ]);

    const effectivePlan = getEffectivePlan(tenant?.plan, tenant?.trialEndsAt ?? null);
    const aiDraftsUsed = usage?.aiDraftsUsed ?? 0;

    if (!effectivePlan.features.aiNarrativeDrafting) {
      return new Response("AI narrative drafting requires the Professional plan.", { status: 403 });
    }
    if (effectivePlan.aiDraftsPerMonth !== -1 && aiDraftsUsed >= effectivePlan.aiDraftsPerMonth) {
      return new Response(`AI draft limit reached (${effectivePlan.aiDraftsPerMonth}/month). Upgrade to continue.`, { status: 429 });
    }

    // Track AI draft usage
    await incrementUsage("aiDraftsUsed");

    const prompt = buildNarrativePrompt(section, data, jurisdiction_code || "GY");
    const anthropic = getAnthropicClient();

    let fullText = "";
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        stream.on("text", (text) => {
          fullText += text;
          controller.enqueue(encoder.encode(text));
        });
        stream.on("end", () => {
          // Fire-and-forget analytics after stream completes
          if (tenantId) {
            const wordsInOutput = fullText.trim().split(/\s+/).filter(Boolean).length;
            trackEvent(session.user!.id!, tenantId, "narrative_generated", {
              section,
              jurisdictionCode: jurisdiction_code || "GY",
              wordsInOutput,
            }).catch(() => {});
          }
          controller.close();
        });
        stream.on("error", (err) => {
          controller.error(err);
        });
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Narrative generation error:", error);
    return new Response("Failed to generate narrative", { status: 500 });
  }
}
