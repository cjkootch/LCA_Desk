import { getAnthropicClient } from "@/lib/ai/anthropic";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert course content creator for a local content compliance training platform called LCA Desk. You create educational slideshow content for professionals in the petroleum sector.

CRITICAL FORMATTING RULES:
- Each module's content is split into slides by ## headings
- Each ## section becomes ONE slide in a slideshow presentation
- Keep each slide to 3-5 bullet points or 2-3 short paragraphs MAX (under 500 characters per slide)
- Use ### for sub-headings within a slide
- Use - for bullet points
- Use **bold** for key terms
- Include \`\`\`mermaid code blocks for diagrams where appropriate:
  - Use "graph TD" or "graph LR" for flowcharts
  - Style nodes: style NodeName fill:#19544c,color:#fff
- Do NOT include quiz questions in the content field — quizzes are in the quiz field

JURISDICTION CONTEXT:
- GY (Guyana): Local Content Act 2021, LCS Register, employment minimums 75%/60%/80%
- NG (Nigeria): NOGICD Act 2010, NCDMB
- NA (Namibia): NAMCOR oversight

AUDIENCE: filer=compliance professionals, seeker=job seekers, supplier=LCS certification, all=general

TEMPLATES: compliance_overview=regulation deep-dive, practical_guide=step-by-step, industry_orientation=sector overview, skills_training=skill development

Return ONLY valid JSON, no markdown fences, no explanation text.`;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, topics, audience, jurisdictionCode, moduleCount, template } = body as {
      title: string;
      topics: string[];
      audience: string;
      jurisdictionCode?: string;
      moduleCount: number;
      template?: string;
    };

    if (!title || !topics || !moduleCount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const userPrompt = `Create a ${moduleCount}-module training course titled "${title}".
Topics: ${topics.join(", ")}
Audience: ${audience}
Jurisdiction: ${jurisdictionCode || "GY"}
Template: ${template || "compliance_overview"}

Return JSON in exactly this format:
{
  "modules": [
    {
      "title": "Module Title",
      "content": "## Slide 1\\n\\nContent...\\n\\n## Slide 2\\n\\nContent...",
      "quiz": [
        {"question":"...","options":["A","B","C","D"],"correctIndex":0},
        {"question":"...","options":["A","B","C","D"],"correctIndex":2},
        {"type":"drag_drop","question":"Match each item...","items":["Item A","Item B","Item C"],"correctPairs":[{"item":"Item A","target":"Target 1"},{"item":"Item B","target":"Target 2"},{"item":"Item C","target":"Target 3"}],"correctIndex":1,"options":[]}
      ]
    }
  ]
}
Include 8-10 slides per module (each ## heading = one slide) and 5-7 quiz questions per module (include 1 drag_drop per module).`;

    const anthropic = getAnthropicClient();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText = (response.content[0] as { type: string; text: string }).text;

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // Strip markdown fences and retry
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Try to find the JSON object in the text
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
    console.error("Course builder error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate course" },
      { status: 500 }
    );
  }
}
