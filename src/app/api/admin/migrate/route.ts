import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { secret } = await req.json();
    const demoSecret = process.env.DEMO_SEED_SECRET;
    if (!demoSecret || secret !== demoSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const results: string[] = [];

    const run = async (label: string, query: ReturnType<typeof sql>) => {
      try {
        await db.execute(query);
        results.push(`✓ ${label}`);
      } catch (e) {
        results.push(`✗ ${label}: ${e instanceof Error ? e.message : e}`);
      }
    };

    await run("users.is_demo", sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE`);
    await run("tenants.is_demo", sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE`);
    await run("announcements.category", sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general'`);
    await run("offices.logo_url", sql`ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS logo_url TEXT`);
    await run("offices.phone", sql`ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS phone TEXT`);
    await run("offices.address", sql`ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS address TEXT`);
    await run("offices.website", sql`ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS website TEXT`);
    await run("offices.signatory_name", sql`ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS signatory_name TEXT`);
    await run("offices.signatory_title", sql`ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS signatory_title TEXT`);
    await run("offices.submission_email", sql`ALTER TABLE secretariat_offices ADD COLUMN IF NOT EXISTS submission_email TEXT`);
    await run("team_invites", sql`CREATE TABLE IF NOT EXISTS team_invites (
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

    // Referrals
    await run("users.referral_code", sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE`);
    await run("referrals", sql`CREATE TABLE IF NOT EXISTS referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referrer_user_id UUID NOT NULL REFERENCES users(id),
      referred_user_id UUID REFERENCES users(id),
      referred_email TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      qualified_at TIMESTAMP,
      rewarded_at TIMESTAMP,
      reward_type TEXT,
      reward_amount TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`);

    return NextResponse.json({ success: true, results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
