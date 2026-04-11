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

### Submission state machine
Valid transitions: `not_started → in_progress → in_review → approved → submitted → acknowledged`. There is **no shortcut** from `in_progress` directly to `approved` — the in-review step is mandatory. `reopenPeriod` can only be called by account owners or super admins, and only when the period is in `submitted` or `acknowledged` state.

### Platform submission is hidden (secretariat integration pending)
`src/app/dashboard/entities/[entityId]/periods/[periodId]/export/page.tsx` defaults `submitMethod` to `"email"` and the method-selection grid (platform vs email cards) is commented out. When the secretariat API integration is live: restore the grid, set the default back to `null`, and re-enable the `"platform"` branch in `handleSubmit`.

### Data snapshot at submission
Both `attestAndSubmit` and `submitWithUpload` (in `src/server/actions.ts`) fetch all records for the period immediately before writing the `submitted` status, then store the full JSON in `reportingPeriods.snapshotData`. This snapshot includes `recordCounts`, `expenditures`, `employment`, `capacity`, and `narratives`. Both functions also auto-create the next reporting period on success (H1→H2 or H2→next-year H1) and call `trackEvent` with `"report_submitted"`.

### Billing guard on submission
Both `attestAndSubmit` and `submitWithUpload` call `getBillingAccess(...)` and throw if `canAccess` is false. This prevents locked/past-due accounts from submitting without going through billing first.

### Free 14-day no-CC trial
New filer registrations get `trialEndsAt = now + 14 days` set directly on the tenant (no Stripe required). `getBillingAccess` in `src/lib/plans.ts` handles this case: `trialEndsAt && !stripeSubscriptionId` → `state: "trial"` when days > 0, `state: "trial_expired"` after. Users can extend to 30 days by adding a payment method via `/dashboard/activate`. The register route now redirects to `/dashboard` instead of `/auth/login`, and the signup page no longer routes through `/dashboard/activate`.

### /try — public demo route
`src/app/try/page.tsx` auto-logs in as the demo filer user (first `isDemo=true` user in the DB) and redirects to `/dashboard`. Only works when `NEXT_PUBLIC_DEMO_PASSWORD` env var is set. The credentials are vended by `src/app/api/demo/public-login/route.ts`. A "Try the live demo →" link appears on the signup page when the env var is set.

### HubSpot behavioral event sync
`trackEvent()` in `src/lib/analytics.ts` now syncs key lifecycle events (`entity_created`, `first_expenditure_added`, `report_submitted`, `trial_started`) to HubSpot via `syncBehavioralEvent()` in `src/lib/hubspot-sync.ts`. This sets custom date properties on the HubSpot contact to trigger enrollment workflows. HubSpot sync is always fire-and-forget — never blocks the main flow.

### Upgrade prompt snooze
`useUpgradePrompt` checks `localStorage` for a per-reason snooze key (`upgrade_snooze_{reason}`) before showing the modal. The "Remind me in 3 days" button sets the snooze expiry. `UpgradeModal` fires `upgrade_prompt_viewed` and `upgrade_prompt_dismissed` events to `/api/analytics/event`.

### Onboarding tour server-side completion
`markOnboardingComplete()` in `src/server/actions.ts` sets `users.onboardingCompletedAt` and fires an analytics event. Called on tour skip and final step. Requires a migration for the new `onboarding_completed_at` column — run `npx drizzle-kit generate` interactively and commit the generated SQL.
