# Pip project overview

## Current status

Pip is a production-ready preschool social-emotional check-in app for children ages 3–5. Children use a teacher-authenticated classroom kiosk to choose one of six feelings. Teachers sign in to manage the roster, review check-ins, and record private follow-up responses.

Current verification:

- `npm run test:live:anon`: 10/10 checks passed.
- `npm run test:live:rls`: 52/52 checks passed, including Teacher A/B classroom isolation, check-in and response ownership, onboarding, student management, and inactive-student history.
- Custom SMTP, signup confirmation, password recovery, and the end-to-end teacher journey passed with disposable accounts.
- `npm test` and `npm run build` pass.
- Local Docker database tests remain available but were not run in the latest workstation verification because Docker was unavailable.

Operational launch work is documented in [docs/OPERATIONS.md](docs/OPERATIONS.md): confirm hosting configuration, enable Supabase/email alerts, and establish backup/restore ownership.

## Product flows

### Child kiosk

1. A teacher signs in on the shared classroom device.
2. `/checkin` loads the active classroom roster.
3. A child taps their colored name circle.
4. The child chooses Happy, Tired, Mad, Sad, Silly, or Sick.
5. Pip saves the check-in before showing confirmation, then returns to the roster after approximately two seconds.

Students are identified by first and last name. The kiosk shows first name plus enough of the last-name prefix to distinguish classmates; teacher views show full names. Student photos are not used by the MVP.

The kiosk refreshes on mount, navigation return, focus/visibility changes, and approximately every 15 seconds. It prevents overlapping refreshes, discards stale results, clears data when the signed-in account changes, and signs the teacher out after 15 minutes without kiosk activity.

### Teacher experience

- `/teacher/signup`: email/password account creation with required confirmation.
- `/teacher/login`: authenticated sign-in.
- `/teacher/setup`: resumable classroom and first-student setup.
- `/teacher`: dashboard with today’s totals, latest student status, attention notices, and follow-up counts.
- `/teacher/students`: add, rename, and deactivate students.
- `/teacher/student/:studentId`: student history and one private response per check-in.
- `/teacher/forgot-password` and `/teacher/reset-password`: password recovery.

Teacher routes require a valid Supabase session and a single assigned classroom. The database, not the browser, enforces classroom membership and write authorization.

## Technology and structure

- React 19, TypeScript, Vite, Tailwind CSS, React Router, and Supabase.
- Nunito is bundled locally; there are no remote fonts, analytics, advertising, or tracking SDKs.
- `src/App.tsx` owns routing and route-level lazy loading.
- `src/lib/auth.tsx` owns session restoration, recovery, readiness, and sign-out.
- `src/lib/KioskRoster.tsx` owns the child roster, refresh lifecycle, stale-request handling, and kiosk timeout.
- `src/lib/data.ts` is the shared Supabase/mock data layer.
- `src/components/child/` contains child-facing controls.
- `src/components/teacher/` contains dashboard, roster, history, and response components.
- `supabase/migrations/` contains forward-only database changes.

## Database and security

Apply migrations in this order:

1. `20260914000000_teacher_followups.sql`
2. `20260914000001_scope_teacher_reads.sql`
3. `20260914000002_teacher_classroom_reads.sql`
4. `20260915000000_phase3_student_management.sql`
5. `20260916000000_teacher_onboarding.sql`
6. `20260916000001_classroom_security.sql`
7. `20260917000000_student_last_name.sql`
8. `20260917000001_scope_checkin_response_writes.sql`

The final security migration scopes check-in and teacher-response reads and writes through `teacher_has_classroom(...)`, preventing an authenticated teacher from accessing another classroom’s records. The browser uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; service-role keys must never be exposed.

Students are soft-deactivated. Historical check-ins remain readable to the assigned teacher, while new check-ins and follow-up responses require an active student and classroom membership. Teacher responses are immutable after creation and notes are limited to 250 characters.

The old private `student-avatars` bucket and avatar columns remain for migration compatibility, but the application does not upload, display, or persist child photos.

## Deployment

The repository includes:

- `public/_redirects` for SPA fallback on Netlify-style hosts.
- `public/_headers` for HSTS, CSP, clickjacking protection, MIME sniffing protection, referrer policy, permissions policy, and cache policy.
- `vercel.json` with equivalent SPA fallback and security headers.
- Immutable long-term caching for hashed assets and no-cache behavior for `index.html`.

Configure a real HTTPS production domain and add its exact auth callback URL in Supabase Authentication URL Configuration. Do not use wildcard callback URLs.

Route-level lazy loading and manual vendor chunks keep the main JavaScript chunk below the previous 500 KB warning threshold. The build produces separate React, Supabase, icon, and page chunks.

## Operations

[docs/OPERATIONS.md](docs/OPERATIONS.md) defines:

- Supabase backup/PITR and restore testing.
- Forward-only migration and release verification.
- School-approved student-data retention requirements.
- Auth, API/Postgres, failed-check-in, and SMTP/email-delivery monitoring.
- Incident response, credential rotation, evidence handling, and recovery.
- Shared-device timeout limitations and the path toward managed kiosk enrollment.

Monitoring is provider-neutral. Supabase Auth/API/Postgres logs and the configured SMTP provider must be connected to the school’s alerting process before broad rollout.

## Verification commands

```sh
npm run typecheck
npm run build
npm test
npm run test:db                 # requires Docker
npm run test:live:anon
npm run test:live:rls           # disposable Teacher A/B accounts required
```

The live suite must use disposable accounts and synthetic classroom data. Never use real child names or real classroom records for security testing.

## Privacy and scope boundaries

Pip does not provide child accounts, persistent child photos, diagnosis, medical records, parent access, SIS/Clever integration, gameplay, AI features, billing, advertising, or marketing tracking. Children cannot navigate teacher routes through the intended UI, but the shared browser session remains teacher-authenticated until timeout or explicit sign-out. Managed-device kiosk policy or separate device enrollment should be considered before deployment across many classrooms.

## Project rules

See [AGENTS.md](AGENTS.md). Bug fixes must identify the root cause, implement the fix, and verify it with relevant checks.
