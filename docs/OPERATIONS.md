# Production operations

## Backups and restore

- Keep Supabase Point-in-Time Recovery and daily backups enabled for the production project.
- Before every schema migration, record the migration name, git commit, timestamp, and a verified backup/PITR restore point.
- Test a restore quarterly into a separate Supabase project. Verify classrooms, students, check-ins, teacher responses, RLS policies, and auth configuration before declaring the restore usable.
- Never restore over production as the first test. Use a separate project, then document the cutover decision.

## Database migrations

- Apply migrations in filename order with `supabase db push` or the approved Supabase migration workflow.
- Treat migrations as forward-only. Do not reapply `supabase/schema.sql` to an existing project.
- Run `npm run test:db` locally when Docker is available, then run `npm run test:live:anon` and `npm run test:live:rls` against disposable live accounts.
- Record the applied migration list and test output in the release ticket.

## Retention and privacy

- Retain check-ins and teacher responses only for the school-approved instructional period. The application does not define a deletion job; the owner must choose and implement the school retention period before collecting real data.
- Review inactive students and remove records according to the school’s documented policy and applicable student-privacy requirements.
- Do not place child names, notes, tokens, or credentials in logs, monitoring payloads, screenshots, or support tickets.

Before production data collection, the school/privacy owner must record the approved retention period and deletion owner. This repository intentionally does not ship an automatic deletion job with a guessed period: choosing one is a policy decision. Once approved, implement it as a reviewed, forward-only Supabase migration or scheduled Edge Function, dry-run it against a restore, and verify that it removes both check-ins and teacher responses while preserving records explicitly required by policy.

## Monitoring and alerts

Configure alerts in Supabase and the selected email provider for:

- Auth failures, unusual sign-in volume, password-reset failures, and repeated expired sessions.
- Database/API errors, elevated latency, failed check-in inserts, and RLS denials.
- Check-in export audit writes and repeated export failures; an audit failure intentionally prevents the CSV download.
- Email bounces, complaints, delivery failures, and SMTP authentication failures.

Review Supabase Auth, Postgres, and API logs daily during launch week and weekly thereafter. Page the on-call owner for sustained check-in failures, suspected cross-classroom access, or unavailable classroom data.

## Check-in exports

Apply the migration `20260921000000_checkin_export_activity.sql` before enabling the dashboard download. The browser creates CSVs in memory only; it does not upload or persist generated files. Audit rows contain teacher/classroom identity, requested dates, time zone, selected student IDs, inactive selection, and row count, but not names, emotions, notes, or CSV contents. Set and document one school-approved retention policy covering both check-ins and export activity before production use.

## Incident response

1. Disable classroom access or sign out affected devices if unauthorized access is suspected.
2. Preserve timestamps, Supabase request/log identifiers, and the affected classroom IDs without copying child data into the incident channel.
3. Rotate compromised SMTP or Supabase credentials immediately; browser keys are not secrets but must still be restricted by RLS.
4. Inspect audit logs, identify affected records, and notify the school/privacy owner according to the organization’s incident policy.
5. Patch and verify with the local and live RLS suites before restoring access.
6. Record the root cause, impact, remediation, and follow-up prevention work.

## Deployment

`public/_redirects` and `public/_headers` support Netlify-style static hosting. `vercel.json` provides the equivalent SPA fallback, HTTPS HSTS, security headers, CSP, and cache policy for Vercel. Configure the real production domain and HTTPS certificate in the hosting provider before launch.

The child kiosk signs out automatically after 15 minutes without activity. This reduces the shared-device risk, but it does not replace device management or a dedicated kiosk enrollment/lock-down solution.

## Release gate

Do not promote a release until the release ticket contains the commit SHA, applied migration list, verified backup/PITR point, `npm test` output, local database-test output, live anonymous/RLS output using disposable accounts, production-domain auth callback test, signup and password-reset email test, and rollback owner. CI runs the typecheck/build gate and Docker-backed database gate on every push and pull request.
