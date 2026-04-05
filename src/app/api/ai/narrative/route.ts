import { getAnthropicClient } from "@/lib/ai/anthropic";
import { buildNarrativePrompt } from "@/lib/ai/prompts";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { section, data, jurisdiction_code } = await req.json();

    if (!section || !data) {
      return new Response("Missing required fields: section, data", { status: 400 });
    }

    const prompt = buildNarrativePrompt(section, data, jurisdiction_code || "GY");
    const anthropic = getAnthropicClient();

    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    return new Response(stream.toReadableStream(), {
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
