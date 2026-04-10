import { getAnthropicClient } from "@/lib/ai/anthropic";
import { buildNarrativePrompt } from "@/lib/ai/prompts";
import { auth } from "@/auth";
import { NextRequest } from "next/server";
import { incrementUsage } from "@/server/actions";
import { db } from "@/server/db";
import { tenantMembers } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { trackEvent } from "@/lib/analytics";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  try {
    const { section, data, jurisdiction_code } = await req.json();

    if (!section || !data) {
      return new Response("Missing required fields: section, data", { status: 400 });
    }

    // Resolve tenantId for analytics (fire-and-forget if unavailable)
    const [membership] = await db
      .select({ tenantId: tenantMembers.tenantId })
      .from(tenantMembers)
      .where(eq(tenantMembers.userId, session.user.id))
      .limit(1);
    const tenantId = membership?.tenantId;

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
