# Pip

A simple preschool emotional check-in app for children ages 3–5.

## Current status: teacher onboarding Milestone 10 handoff complete

Teacher signup, email confirmation, resumable classroom setup, student management (first and last names, no photos), password recovery, and the forward security migrations are implemented. See the [Milestone 10 completion report](docs/TEACHER_ONBOARDING_MILESTONE_10.md) for the authoritative verification and deployment handoff. Signup uses a shared readiness check; new teachers go through `/teacher/setup` (welcome, classroom name, students, Finish Setup). The confirmation email journey, local callback redirect, and live password recovery/reset journey are verified; the observed password policy is a 6-character minimum. Production SMTP readiness and a fresh full post-Milestone-8 regression run remain unverified.

For step-by-step live Supabase checks, use the [Live Verification Guide](docs/LIVE_VERIFICATION_GUIDE.md).

Local regression verification: the Docker-backed database suite, signup browser checks (12/12), and setup browser checks (13/13). The current production build also passes. A new post-Milestone-8 regression run remains pending. Live anonymous checks and the live Teacher A / Teacher B / anonymous authorization suite were recorded as passing on September 16 after `20260916000001_classroom_security.sql` was applied; live password recovery was subsequently verified. `tests/live-rls.mjs` uses only the browser key and disposable test accounts.

## Phase 3 student management

Phase 3 uses the teacher-authenticated classroom kiosk model selected by the owner. When Supabase is configured, a teacher must sign in on the classroom device before `/checkin` can load students; children do not enter credentials. The protected `/teacher/students` page supports classroom-scoped active-student add, rename, and deactivation. The Phase 3 migration adds private `student-avatars` storage setup, scoped student write policies, inactive-history reads, and active-only kiosk check-in enforcement. The later security migration and live authorization suite cover the effective classroom and photo boundaries; see the [Milestone 10 completion report](docs/TEACHER_ONBOARDING_MILESTONE_10.md). Student photo upload was removed from the MVP UI: teachers enter a first and last name, and the kiosk shows the first name plus last initial ("Thomas E."), extending the initial to two or more letters when classmates would otherwise collide (migration `20260917000000_student_last_name.sql`). The `student-avatars` bucket and avatar columns remain in the database but are unused. Kiosk polling is implemented.

The React, Vite, TypeScript, and Tailwind CSS app is complete through Milestone 10 and the Phase 2 teacher follow-up workflow (`/teacher/student/:studentId`), with responsive child screens, Lucide icons, and locally bundled Nunito fonts. The reference image is preserved in `workflow.jpeg`.

Student selection is ready at `/checkin`: six alphabetically ordered demo students have distinct animal avatars and large picture buttons. The grid uses three columns on tablets and desktops, and two on narrow phones. Opening `/` redirects to `/checkin`.

Tapping a student opens `/checkin/:studentId` with their name, avatar, and exactly six feelings: Happy, Tired, Mad, Sad, Silly, and Sick. Tapping a feeling selects it with a border and checkmark and shows a short acknowledgment. The speaker button reads the question; emotion taps speak the label when on-device English speech is available. Audio is optional and doesn't block selection.

After a feeling is chosen, the app saves the check-in to Supabase before opening a simple confirmation with a green checkmark, the child’s name, and their feeling. It returns to the student picture screen after about two seconds; the `Done` button returns immediately. Development without Supabase uses demo data; production without configuration shows an unavailable message. Database failures keep the child-facing message simple: “Let’s try again.”

## Optional emotion pictures and recordings

The app works with emoji immediately. To replace them, put PNG files into `public/assets/emotions/`, named exactly `happy.png`, `tired.png`, `mad.png`, `sad.png`, `silly.png`, and `sick.png`. You can add them one at a time. Refresh the browser during development; rebuild before publishing. Missing or unreadable images fall back to emoji. Existing files are discovered with [Vite's glob imports](https://vite.dev/guide/features.html#glob-import), avoiding requests for missing assets.

Recorded audio can be added later with `questionAudioSrc` on `CheckInHeader` and `audioSrc` on each entry in `src/data/emotions.ts`. Use local files under `public/assets/audio/`, referenced as `/assets/audio/your-file.mp3`. A recording for the question must match the child's name. If a recording fails, playback falls back to optional browser speech. Playback stops when leaving the child screen. The [browser speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) uses an available local English voice; devices without one remain silent.

## Open the app locally

Dependencies are already installed in this workspace. From a terminal in the `pip` folder:

```sh
npm run dev
```

Open the local URL printed in the terminal (normally http://127.0.0.1:5173). Keep that terminal running while using the app. Press Ctrl+C to stop it.

On a fresh copy, use Node.js 22.15 or newer and run `npm ci` first to install the exact versions in `package-lock.json`.

## Check the code

```sh
npm run build
```

This checks TypeScript and creates the production app in `dist/`. A successful build ends with “built in …”. To check TypeScript alone, run `npm run typecheck`.

## Where things live

- `src/App.tsx`: shared shell and React Router routes.
- `src/pages/StudentSelectPage.tsx`: student selection screen.
- `src/pages/EmotionCheckInPage.tsx`: emotion selection with mock state.
- `src/components/child/CheckInHeader.tsx`: personalized question, avatar, and speaker.
- `src/components/child/EmotionCard.tsx`: emotion picture, fallback, and selected state.
- `src/data/emotions.ts`: six emotions, colors, and optional image discovery.
- `src/lib/audio.ts`: optional recording/browser speech playback.
- `src/components/child/StudentCard.tsx`: large picture button.
- `src/data/students.ts`: six demo students and placeholder avatars.
- `src/types/index.ts`: student, check-in, classroom, and teacher response shapes.
- `src/lib/supabase.ts`: browser database client (anonymous key only).
- `src/lib/auth.tsx`: teacher sign-in session.
- `src/lib/data.ts`: every database read and write, shared by child and teacher screens.
- `src/lib/useRefreshOnReturn.ts`: re-loads teacher screens when you come back to the tab.
- `src/pages/TeacherLoginPage.tsx`, `src/pages/TeacherDashboardPage.tsx`, `src/pages/StudentSupportPage.tsx`: teacher screens.
- `src/components/teacher/`: dashboard cards, status badge, check-in history, response form, the shared roster editor, and the sign-in guard.
- `src/pages/TeacherSignupPage.tsx`, `src/pages/TeacherSetupPage.tsx`: account creation and the resumable first-time setup wizard.
- `supabase/schema.sql`, `supabase/migrations/`: base database and forward migrations; `supabase/seed.sql` is optional legacy demo data with the ordering restriction below.
- `src/index.css`: shared colors, typography, focus styles, and reduced-motion support.
- `src/main.tsx`: starts React and loads local fonts.
- `vite.config.ts`: connects React and Tailwind to Vite.
- `public/assets/emotions/`: future optional emotion PNGs.
- `public/assets/avatars/`: future placeholder avatars.

## Supabase setup and deployment

Copy `.env.example` to `.env.local` and fill in the project URL and public/anon or publishable browser key. Never place a service-role or secret key in a `VITE_` variable: those variables are visible to the browser. Real environment files are excluded by `.gitignore`.

For a fresh empty Supabase project, apply `supabase/schema.sql` followed by all six files in `supabase/migrations/`, oldest first. `supabase db push` alone does not create the base tables. Never reapply `schema.sql` after migrations: it restores historical broad policies. The optional legacy demo seed must run only on disposable fresh projects, after the base schema and before migrations; it is incompatible with the removed display-name uniqueness constraint afterward.

For an upgrade, inspect live definitions/history and apply only missing forward migrations. All six migrations were recorded as applied to the linked project on September 16 (see the [Milestone 10 completion report](docs/TEACHER_ONBOARDING_MILESTONE_10.md)); verify any other target project independently. Local database tests: `python3 supabase/tests/test_onboarding.py` (Docker). Live authorization tests: `node tests/live-rls.mjs --anon`, or the full suite with two disposable `pip-test-` teacher accounts in an untracked `.env.test.local`.

No analytics, advertising, remote font requests, or tracking SDKs are included.

Production operations, backups, migration discipline, retention, monitoring, incident response, deployment headers, and kiosk timeout guidance are documented in [docs/OPERATIONS.md](docs/OPERATIONS.md). The novice-friendly external launch walkthrough is in [docs/EXTERNAL_PRODUCTION_SETUP.md](docs/EXTERNAL_PRODUCTION_SETUP.md).

### Phase 2 setup

Historical Phase 2 setup used these three migrations. For current installation or upgrade, follow the six-migration instructions above; do not rerun these on an existing project:

1. `20260914000000_teacher_followups.sql` — classroom membership and private teacher responses.
2. `20260914000001_scope_teacher_reads.sql` — scopes teacher roster/check-in reads to assigned classrooms.
3. `20260914000002_teacher_classroom_reads.sql` — lets a teacher read the name of their assigned classroom (the dashboard heading). Then create a teacher in Authentication and, using that user’s actual ID, run:

```sql
insert into public.classroom_teachers (classroom_id, teacher_id)
select id, 'REPLACE_WITH_AUTH_USER_UUID'::uuid
from public.classrooms
where name = 'Room 4' and teacher_name = 'Ms. Rivera';
```

Replace the placeholder with the authenticated teacher’s UUID; do not guess it or allow teachers to self-enroll. A teacher without membership sees a classroom-access message instead of a dashboard, and a teacher assigned to more than one classroom sees a setup message rather than a merged view. The Phase 3 migration replaces the historical anonymous kiosk permissions with teacher-authenticated access. Verify its effective live policies before using real classroom records.

The app defines “today” using the browser’s local calendar day. Phase 2 is a preview without Supabase: it does not simulate or store teacher responses.

### Check-in CSV exports

The teacher dashboard’s **Download check-ins** action exports every matching check-in (including multiple check-ins for one student on the same day) as a UTF-8 CSV. It defaults to the last 30 local calendar days and also supports the last 7 days and custom inclusive dates up to 366 days. The browser time zone is shown in the dialog and used for the displayed timestamp; UTC is included in every row. Active students are selected by default, while inactive students require the explicit “Include inactive students” option. Names and status are the current roster values because the check-in schema does not preserve historical roster snapshots. The export records a small audit event through `record_check_in_export`; apply the school-approved retention policy to those records as well.

**Shared devices:** opening the child check-in from the teacher dashboard does not sign the teacher out. There is no kiosk lock. A teacher must remain signed in for the live `/checkin` roster. The shared session still carries teacher privileges; child navigation is not isolated from teacher pages. Sign out when the classroom device is no longer in use. Already-issued photo links remain usable until their expiration.

Teacher access is available at `/teacher/login` when Supabase is configured. Create a teacher in Supabase Dashboard → Authentication → Users using email/password, then sign in with that account. The `/teacher` dashboard is protected by the active Supabase session and includes Sign out. Without Supabase environment variables, local development continues to show the demo dashboard.

## Feature status

1. App shell — complete.
2. Student Select with six demo students — complete.
3. Six-emotion check-in and optional audio — complete.
4. Confirmation and automatic return — complete.
5. Teacher dashboard — complete. `/teacher` requires sign-in when Supabase is configured. It shows today’s check-in count, emotion totals, a “May need a check-in” section for Sad/Mad/Sick, follow-up counts, and every student’s status and time. Without Supabase it shows a labeled demo snapshot.
6. Supabase schema and connection — complete.
7. Database-backed check-ins — complete.
8. Teacher email/password authentication — complete.
9. Responsive and accessibility polish — complete.
10. Teacher signup/onboarding handoff — complete locally. Documentation, migration order, private bucket settings, redirect requirements, password policy, email prerequisites, and live-check limitations are recorded in the [Milestone 10 completion report](docs/TEACHER_ONBOARDING_MILESTONE_10.md).

Tailwind uses the [official Vite integration](https://tailwindcss.com/docs/installation/using-vite). Vite 6 is used for compatibility with this workspace's Node.js 22.15 installation.
