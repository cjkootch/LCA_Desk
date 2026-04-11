import { getAnthropicClient } from "@/lib/ai/anthropic";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { title, description, audience, jurisdictionCode, template, moduleCount } = await req.json() as {
      title: string; description?: string; audience: string;
      jurisdictionCode?: string; template: string; moduleCount?: number;
    };

    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `Suggest ${moduleCount || 5} module topics for a training course titled "${title}".

Context:
- Description: ${description || "Not provided"}
- Audience: ${audience} (filer=compliance professionals, seeker=job seekers, supplier=LCS companies, all=general petroleum sector)
- Jurisdiction: ${jurisdictionCode || "GY"} (GY=Guyana Local Content Act 2021, NG=Nigeria NOGICD Act, NA=Namibia, SR=Suriname)
- Template style: ${template} (compliance_overview=regulation deep-dive, practical_guide=step-by-step how-to, industry_orientation=sector overview, skills_training=skill development)

Return ONLY a JSON array of strings. Each string is a concise, specific module topic (3-8 words). Make topics progressive — they should build on each other logically.

Example format: ["Introduction to the Legal Framework", "Employment Minimum Requirements", "Filing Your Half-Yearly Report"]

No explanation, just the JSON array.`,
      }],
    });

    const text = (response.content[0] as { type: string; text: string }).text.trim();

    let topics: string[];
    try {
      topics = JSON.parse(text);
    } catch {
      // Strip markdown fences if present
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
      try {
        topics = JSON.parse(cleaned);
      } catch {
        const match = cleaned.match(/\[[\s\S]*\]/);
        topics = match ? JSON.parse(match[0]) : [];
      }
    }

    return NextResponse.json({ topics: Array.isArray(topics) ? topics : [] });
  } catch (err) {
    console.error("suggest-topics error:", err);
    return NextResponse.json({ topics: [] });
  }
}
