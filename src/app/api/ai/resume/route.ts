import { getAnthropicClient } from "@/lib/ai/anthropic";
import { auth } from "@/auth";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  try {
    const { action, content, profile } = await req.json();
    const anthropic = getAnthropicClient();

    if (action === "enhance") {
      // Enhance existing resume text
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: `You are a professional resume writer specializing in Guyana's petroleum sector. Enhance this resume for someone seeking employment in the oil and gas industry.

Current resume text:
${content}

${profile ? `Profile info: ${profile.jobTitle || ""}, ${profile.category || ""}, ${profile.yearsExperience ? profile.yearsExperience + " years experience" : ""}, ${profile.isGuyanese ? "Guyanese national" : ""}` : ""}

Requirements:
1. Maintain factual accuracy — don't fabricate experience
2. Use petroleum sector terminology (upstream, downstream, FPSO, drilling, subsea, etc.)
3. Highlight any Local Content Act relevance (Guyanese national status, LCS registration)
4. Use strong action verbs and quantify achievements where possible
5. Format with clear sections: Summary, Experience, Education, Skills, Certifications
6. Keep professional and concise

Return the enhanced resume text in clean markdown format. Do NOT add any commentary — just the resume content.`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      return Response.json({ enhanced: text });

    } else if (action === "extract_skills") {
      // Extract skills and metadata from resume text
      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{
          role: "user",
          content: `Extract structured data from this resume for a petroleum sector job profile.

Resume:
${content}

Return JSON only:
{
  "headline": "One-line professional headline (e.g. 'Senior Mechanical Engineer with 8 years offshore experience')",
  "current_job_title": "Most recent job title",
  "employment_category": "Management | Technical | Administrative | Skilled Labour | Semi-Skilled Labour | Unskilled Labour",
  "years_experience": number or null,
  "skills": ["list of specific skills mentioned"],
  "education": "Highest education level and field",
  "certifications": ["Any certifications mentioned"],
  "summary": "2-3 sentence professional summary"
}`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return Response.json({ extracted: JSON.parse(match[0]) });
      }
      return Response.json({ error: "Failed to extract" }, { status: 500 });

    } else if (action === "generate") {
      // Generate resume from profile data
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: `Generate a professional resume for someone in Guyana's petroleum sector based on this profile data:

Name: ${profile.name || ""}
Job Title: ${profile.jobTitle || ""}
Category: ${profile.category || ""}
Years of Experience: ${profile.yearsExperience || "Not specified"}
Skills: ${profile.skills?.join(", ") || "Not specified"}
Location: ${profile.location || "Georgetown, Guyana"}
Nationality: ${profile.isGuyanese ? "Guyanese" : profile.nationality || ""}
Education: ${profile.education || "Not specified"}

Generate a complete, professional resume in markdown format. Include:
1. Professional Summary (2-3 sentences)
2. Skills section
3. Experience section (create realistic section headers but mark as "[Add your experience details]")
4. Education section
5. Certifications section (if applicable)

Use petroleum sector terminology. Highlight Guyanese national status if applicable (relevant for Local Content Act compliance).
Return ONLY the resume markdown, no commentary.`,
        }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      return Response.json({ generated: text });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Resume AI error:", error);
    return Response.json({ error: "AI processing failed" }, { status: 500 });
  }
}
