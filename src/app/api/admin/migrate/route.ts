import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json();
    const demoSecret = process.env.DEMO_SEED_SECRET;
    if (!demoSecret || secret !== demoSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const sql = neon(process.env.DATABASE_URL!);
    const results: string[] = [];

    const run = async (label: string, query: string) => {
      try {
        await sql.transaction((tx) => [tx(query)]);
        results.push(`✓ ${label}`);
      } catch (e) {
        // Try alternative approach
        try {
          // @ts-expect-error - neon tagged template workaround
          await sql([query] as unknown as TemplateStringsArray);
          results.push(`✓ ${label}`);
        } catch (e2) {
          results.push(`✗ ${label}: ${e2 instanceof Error ? e2.message : e2}`);
        }
      }
    };

    await run("users.is_demo", "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE");
    await run("tenants.is_demo", "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE");
    await run("announcements.category", "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general'");
    await run("offices.logo_url", "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS logo_url TEXT");
    await run("offices.phone", "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS phone TEXT");
    await run("offices.address", "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS address TEXT");
    await run("offices.website", "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS website TEXT");
    await run("offices.signatory_name", "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS signatory_name TEXT");
    await run("offices.signatory_title", "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS signatory_title TEXT");
    await run("offices.submission_email", "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS submission_email TEXT");

    await run("team_invites", `CREATE TABLE IF NOT EXISTS team_invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      secretariat_office_id UUID REFERENCES secretariat_offices(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      invited_by UUID NOT NULL REFERENCES users(id),
      inviter_name TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMP NOT NULL,
      accepted_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    return NextResponse.json({ success: true, results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
