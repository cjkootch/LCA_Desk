import { getAnthropicClient } from "@/lib/ai/anthropic";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert quiz creator for LCA Desk, a local content compliance training platform. You generate quiz questions directly from module content for petroleum sector professionals.

═══ QUESTION QUALITY ═══
- Write clear, unambiguous questions — no trick wording
- Test comprehension and application, not just literal recall
- Plausible distractors: wrong options should be believable, not obviously silly
- Reference specific facts, percentages, section numbers, or procedures from the content
- 4 options per multiple-choice question (A/B/C/D), correctIndex is 0-based

═══ DIFFICULTY MIX ═══
For a set of 6 questions:
- 2 straightforward factual questions (correct answer stated directly in content)
- 2 application questions (requires understanding a rule and applying it to a scenario)
- 1 nuanced question (tests a common misconception or a detail easily confused)
- 1 drag_drop question (matching/categorization)

═══ DRAG_DROP FORMAT ═══
Exactly 1 drag_drop per question set. Use exactly 3 buckets (targets) and 3 items:
{
  "type": "drag_drop",
  "question": "Match each [category] to its correct [target]...",
  "items": ["Item A", "Item B", "Item C"],
  "correctPairs": [
    {"item": "Item A", "target": "Target 1"},
    {"item": "Item B", "target": "Target 2"},
    {"item": "Item C", "target": "Target 3"}
  ],
  "correctIndex": 1,
  "options": []
}
The drag_drop question should test matching/categorization content from the module (e.g. match employment categories to percentages, match Act sections to their requirements, match roles to their responsibilities).

═══ JURISDICTION CONTEXT ═══
- GY (Guyana): Local Content Act 2021 (Act No. 18), employment minimums: Managerial 75%, Technical 60%, Non-Technical 80%, LCS Register, penalties GY$1M–GY$50M, H1 due July 30, H2 due January 30
- NG (Nigeria): NOGICD Act 2010, NCDMB
- NA (Namibia): NAMCOR

Return ONLY valid JSON — no markdown fences, no preamble, no explanation.`;

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
