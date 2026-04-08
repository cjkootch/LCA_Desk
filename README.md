# LCA Desk

AI-powered local content compliance platform for Guyana's petroleum sector. Built on the Local Content Act No. 18 of 2021.

## What It Does

LCA Desk replaces spreadsheet-based compliance filing with a full platform:

- **Filers** (Contractors/Sub-Contractors/Licensees) enter expenditure, employment, and capacity data, generate official reports with AI narratives, and submit to the Secretariat
- **Suppliers** (LCS-registered companies) get discovered by contractors, respond to procurement opportunities, track their bid pipeline
- **Job Seekers** search petroleum sector jobs, build AI-powered resumes, earn compliance certifications
- **Secretariat** (regulatory office) reviews submissions, tracks sector compliance, monitors filing deadlines, runs AI-powered analysis
- **Admins** manage the platform, view analytics, handle support tickets

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database**: Neon Postgres (serverless) + Drizzle ORM
- **Auth**: NextAuth v5 (JWT strategy, credentials provider)
- **AI**: Anthropic Claude (Sonnet for quality, Haiku for bulk)
- **Payments**: Stripe (subscriptions + one-time)
- **Email**: Resend (transactional + notifications)
- **Scraping**: Playwright (LCS register) + fetch (opportunities/jobs)
- **CRM**: HubSpot (contact sync)
- **Deployment**: Vercel

## User Roles

| Role | Portal | Description |
|------|--------|-------------|
| `filer` | `/dashboard` | Compliance officers filing LCA reports |
| `supplier` | `/supplier-portal` | LCS-registered companies |
| `job_seeker` | `/seeker` | Petroleum sector job seekers |
| `secretariat` | `/secretariat` | Regulatory office staff |
| `super_admin` | `/dashboard/admin` | Platform administrators |

## Plans & Pricing

| Plan | Price | Audience |
|------|-------|----------|
| Essentials | $199/mo | Small vendors, 1 entity, 3 users |
| Professional | $399/mo | Growing contractors, 5 entities, 15 users, AI |
| Enterprise | Custom | Unlimited everything |
| Supplier Pro | $99/mo | Unlimited responses, analytics, priority |

New filer signups get a 30-day Professional trial.

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Auth
AUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_LITE_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_SUPPLIER_PRO_PRICE_ID=price_...

# Email
RESEND_API_KEY=re_...

# CRM
HUBSPOT_ACCESS_TOKEN=pat-...

# Cron
CRON_SECRET=your-cron-secret

# Demo
NEXT_PUBLIC_DEMO_PASSWORD=your-demo-password
DEMO_SEED_SECRET=your-seed-secret

# App
NEXT_PUBLIC_APP_URL=https://app.lcadesk.com
```

## Getting Started

```bash
npm install
cp .env.local.example .env.local  # Edit with your credentials
npx drizzle-kit push              # Push schema to database
npm run dev                       # Start dev server
```

## Database

```bash
npx drizzle-kit push              # Push schema changes
npm run db:generate               # Generate migration files
npm run db:studio                 # Open Drizzle Studio
npx tsx src/scripts/apply-migrations.ts  # Apply column additions
```

## Scrapers

```bash
npm run scrape:lcs                # 796+ companies from LCS register
npm run scrape:opportunities      # 190+ procurement notices
npm run scrape:jobs               # Employment notices
```

## Demo

9 personas at `/demo`. Seed with:

```bash
curl -X POST https://app.lcadesk.com/api/demo/seed \
  -H "Content-Type: application/json" \
  -d '{"secret":"your-seed-secret"}'
```

All use password `demo-password-2026`.

## Project Structure

```
src/
├── app/
│   ├── dashboard/       # Filer portal
│   ├── seeker/          # Job seeker portal
│   ├── supplier-portal/ # Supplier portal
│   ├── secretariat/     # Regulatory portal
│   ├── register-lcs/    # LCS certificate service
│   └── api/             # API routes
├── components/
│   ├── ai/              # Floating chat widget
│   ├── billing/         # Feature gates, usage banner
│   ├── dashboard/       # Shared dashboard components
│   ├── onboarding/      # Tour components
│   └── reporting/       # Data entry, inline editing
├── lib/
│   ├── compliance/      # Calculators, jurisdiction config
│   ├── export/          # Excel, PDF generation
│   ├── import/          # Excel parser
│   └── plans.ts         # Plan definitions
└── server/
    ├── actions.ts       # Server actions
    └── db/schema.ts     # 43+ table schema
```

## LMS

11 courses, 44 modules, 220 quiz questions, 11 badges. Auto-seeds on first visit.

## Multi-Jurisdiction

Guyana (GY) fully configured. Nigeria (NG), Suriname (SR), Namibia (NA) at jurisdiction level. New jurisdiction needs: config, deadlines, course seeds.
