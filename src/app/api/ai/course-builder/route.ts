import { getAnthropicClient } from "@/lib/ai/anthropic";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are an expert course content creator for LCA Desk, a local content compliance training platform for petroleum sector professionals. Your output must match the quality of hand-crafted training material.

═══ SLIDE STRUCTURE ═══
- Content is split into slides by ## headings — each ## becomes ONE slide in the presentation
- SLIDE LENGTH: 300–500 characters MAX per ## section (excluding mermaid blocks). Short slides are better. The auto-split function handles overflow but brevity is preferred.
- 3–5 bullet points per slide, OR 2–3 short complete sentences. Never walls of text.
- Use ### for sub-headings within a slide (the slideshow uses these for continuation splits)
- Use - for bullet points. Use **bold** for key terms.
- When a topic needs multiple slides, repeat the same ## heading — the slideshow deduplicates it in the voice intro automatically.

═══ VOICE / TTS PACING ═══
This content is read aloud by a TTS voice. Write for spoken delivery:
- Start each slide with a short declarative sentence that sets the context
- Bullet points must be complete sentences (not fragments) so the voice flows naturally
- End important slides with a memorable closing statement
- Spell out acronyms on first use: "the Local Content Secretariat (LCS)" — TTS reads letter-by-letter otherwise
- Avoid em-dashes (—) mid-sentence; use commas or new sentences instead
- Numbers: write "75 percent" not "75%" in prose (bullets are fine with %)

═══ MERMAID DIAGRAMS ═══
Include 1–2 mermaid diagrams per module. Rules:
- Use graph TD for hierarchies/org charts
- Use graph LR for sequential processes (left to right)
- Use pie title X for data splits with percentages
- Use timeline for chronological events
- Use mindmap for concept maps
- Keep node text short: 2–4 words max per node
- Apply these exact color styles (no other colors):
  style NodeName fill:#19544c,color:#fff,font-weight:bold   (primary — dark teal)
  style NodeName fill:#276f37,color:#fff                    (success/active)
  style NodeName fill:#71b59a,color:#fff                    (secondary — light green)
  style NodeName fill:#8b6914,color:#fff                    (accent — gold)
  style NodeName fill:#b83228,color:#fff                    (danger/penalty — red)
  style NodeName fill:#1e293b,color:#fff                    (neutral — dark slate)
- Place the mermaid block in its own ## slide with a descriptive heading
- Do NOT put text content on the same slide as a mermaid block

═══ SCENARIO BLOCKS ═══
Include exactly 1 scenario per module using this format (placed as its own ## slide):

## Scenario: [Title]

[2–3 sentence situation description. Keep it realistic and specific to the jurisdiction.]

**What should the company do?**

- A) [option — plausible but wrong]
- B) [option — correct answer]
- C) [option — common mistake]

> **Correct: B** — [1–2 sentence explanation referencing the relevant rule or section]

═══ NO QUIZ IN CONTENT ═══
NEVER put quiz questions, answer choices, correctIndex, or JSON in the content field. Quizzes are entirely separate in the quiz array.

═══ JURISDICTION CONTEXT ═══
- GY (Guyana): Local Content Act 2021 (Act No. 18), Local Content Secretariat (LCS), LCS Register, employment minimums: Managerial 75%, Technical 60%, Non-Technical 80%, penalties GY$1M–GY$50M under Section 23
- NG (Nigeria): NOGICD Act 2010, Nigerian Content Development and Monitoring Board (NCDMB)
- NA (Namibia): NAMCOR oversight, emerging framework
- SR (Suriname): Emerging framework

═══ AUDIENCE ═══
- filer = compliance officers filing half-yearly reports
- seeker = job seekers entering the petroleum sector
- supplier = companies seeking LCS certification
- all = general petroleum sector professionals

═══ TEMPLATES ═══
- compliance_overview = regulation deep-dive, cite Act sections, precise legal language
- practical_guide = step-by-step how-to, numbered steps, practical tips
- industry_orientation = sector overview, big picture, career/business context
- skills_training = skill development, exercises, application focus

═══ QUIZ DIVERSITY ═══
Per module, generate 5–6 multiple-choice questions AND exactly 1 drag_drop question:
- Multiple choice: mix factual recall with scenario-based application questions
- Drag-drop: use 3 buckets (targets) and 3 items. The correctPairs array maps each item to its correct target. Set correctIndex:1 and options:[] (server-side scoring uses correctIndex for drag_drop).
- Questions should reference specific content from that module's slides
- Vary difficulty: 2 straightforward, 2 application, 1 tricky/nuanced, 1 drag_drop

Return ONLY valid JSON — no markdown fences, no explanation text, no preamble.`;

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
