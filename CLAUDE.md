@AGENTS.md

## Architectural Decisions & Known Limitations

### Cron observability
All cron jobs log start/completion to the `cron_runs` table via `src/lib/cron-logger.ts` (`startCronRun`, `completeCronRun`, `isAlreadyRunning`). Each job guards against concurrent duplicate runs — if a run with `status="running"` started less than 10 minutes ago, the new invocation returns `{ skipped: "already running" }`.

### Jurisdiction expansion
Add new markets in `src/lib/compliance/jurisdiction-config.ts` only — define a new `JurisdictionTemplate` entry including the `employmentCategoryMap`. Activate by setting `active=true` in the `jurisdictions` DB table. No code changes needed elsewhere; calculators and validators resolve jurisdiction-specific strings via `getJurisdictionTemplate(code)`.

### Employment calculators are jurisdiction-aware
`calculateEmploymentMetrics(records, jurisdictionCode)` uses `employmentCategoryMap` from `JurisdictionTemplate` to filter records by category. Default jurisdiction is `"GY"` for backward compatibility. Pass `jurisdictionCode` at all call sites where the entity's jurisdiction is known.

### Role changes require re-login (known limitation)
Updating `users.userRole` (e.g. granting secretariat or filer access) takes effect only after the affected user logs out and back in. The NextAuth JWT is **not auto-invalidated** on role change. Full fix requires `unstable_update` from NextAuth which is experimental and not currently used. All role-change code paths log to `audit_logs` with `entityType: "user_role"`.

### Stripe webhook idempotency
Incoming Stripe webhook events are deduplicated via the `stripe_events` table. The webhook handler checks for `event.id` before processing and inserts it atomically — duplicate deliveries return `{ received: true, duplicate: true }` without re-processing.

### Schema migrations
All schema changes must go through `npx drizzle-kit generate` (generates SQL migration files in `drizzle/migrations/`) followed by committing the generated `.sql` file. Never modify migration files manually. Apply with `npx drizzle-kit migrate` against the target database.
