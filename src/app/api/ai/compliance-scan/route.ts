import { getAnthropicClient } from "@/lib/ai/anthropic";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

const SYSTEM_PROMPT = `You are the LCA Desk Compliance Scanner. You analyze submission data for Local Content Half-Yearly Reports and identify issues the Secretariat is likely to scrutinize.

You receive a JSON summary of a company's filing data. Analyze it and return a JSON array of issues found.

Each issue must have:
- "level": "error" | "warning" | "info"
- "category": "employment" | "expenditure" | "capacity" | "narrative" | "general"
- "title": short title (under 60 chars)
- "detail": specific explanation with numbers and percentages
- "recommendation": what to do about it

Focus on:
1. Guyanese employment rates below LCA minimums (Managerial 75%, Technical 60%, Non-Technical 80%)
2. Missing Supplier Certificate IDs (suppliers without valid LCS certificates may not count toward local content)
3. Sole-sourced items without Sole Source Codes
4. Zero or missing capacity development spend (Secretariat will query this)
5. Missing or incomplete narratives (each section must have substantive content)
6. Low overall local content rate (suppliers with Certificate IDs vs without)
7. Missing reporting fields that the Secretariat requires

Return ONLY valid JSON — an array of issue objects. No markdown, no explanation outside the JSON.
If no issues found, return an empty array: []`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  try {
    const { data } = await req.json();

    if (!data) {
      return new Response("Missing data", { status: 400 });
    }

    const anthropic = getAnthropicClient();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze this filing data and return issues as JSON:\n\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "[]";

    return new Response(text, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Compliance scan error:", error);
    return new Response("[]", { status: 500 });
  }
}
