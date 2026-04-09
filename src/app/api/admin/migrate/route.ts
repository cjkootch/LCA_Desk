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

    const migrations = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE",
      "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE",
      "ALTER TABLE announcements ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general'",
      "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS logo_url TEXT",
      "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS phone TEXT",
      "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS address TEXT",
      "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS website TEXT",
      "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS signatory_name TEXT",
      "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS signatory_title TEXT",
      "ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS submission_email TEXT",
    ];

    for (const m of migrations) {
      try {
        await sql(m);
        results.push(`✓ ${m.substring(0, 60)}...`);
      } catch (e) {
        results.push(`✗ ${m.substring(0, 40)}: ${e instanceof Error ? e.message : e}`);
      }
    }

    // team_invites table
    try {
      await sql(`CREATE TABLE IF NOT EXISTS team_invites (
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
      results.push("✓ team_invites table");
    } catch (e) {
      results.push(`✗ team_invites: ${e instanceof Error ? e.message : e}`);
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
