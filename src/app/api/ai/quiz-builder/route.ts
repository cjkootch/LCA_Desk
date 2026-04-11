import { getAnthropicClient } from "@/lib/ai/anthropic";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert quiz creator for a local content compliance training platform called LCA Desk. You create engaging quiz questions based on module content for professionals in the petroleum sector.

QUIZ QUESTION RULES:
- Create clear, unambiguous multiple-choice questions (4 options each)
- Include exactly 1 drag_drop question per set
- Questions should test comprehension, not just recall
- Vary difficulty: some factual, some application-based
- correctIndex is 0-based (0=first option, 1=second, etc.)

Return ONLY valid JSON, no markdown fences, no explanation text.`;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { content, moduleTitle, questionCount = 6 } = body as {
      content: string;
      moduleTitle: string;
      questionCount?: number;
    };

    if (!content || !moduleTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userPrompt = `Generate ${questionCount} quiz questions for the module titled "${moduleTitle}".

Module content:
${content.slice(0, 4000)}

Return JSON in exactly this format:
{
  "questions": [
    {"question":"...","options":["A","B","C","D"],"correctIndex":0},
    {"question":"...","options":["A","B","C","D"],"correctIndex":2},
    {"type":"drag_drop","question":"Match each item...","items":["Item A","Item B","Item C"],"correctPairs":[{"item":"Item A","target":"Target 1"},{"item":"Item B","target":"Target 2"},{"item":"Item C","target":"Target 3"}],"correctIndex":1,"options":[]}
  ]
}
Include exactly 1 drag_drop question. Total questions: ${questionCount}.`;

    const anthropic = getAnthropicClient();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText = (response.content[0] as { type: string; text: string }).text;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          parsed = JSON.parse(match[0]);
        } else {
          throw new Error("Could not parse JSON from AI response");
        }
      }
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Quiz builder error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate quiz" },
      { status: 500 }
    );
  }
}
