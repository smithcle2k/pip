# Pip: External Production Setup Guide

This guide explains the production tasks that cannot be completed only by editing the Pip code. It is written for someone who is comfortable using a web dashboard but is not a database or DevOps specialist.

Do these steps in order. Keep a copy of every value, screenshot, test result, and date in the school’s launch record. Never put passwords, service-role keys, child information, or reset links in that record.

## What you need before starting

Ask the project owner for:

- The final production website name, such as `checkin.example.org`.
- The Supabase project owner or administrator.
- The hosting account owner, such as Vercel or Netlify.
- An email provider that supports SMTP.
- The person responsible for student privacy and data retention.
- The person responsible for responding when the app is unavailable.
- One disposable test teacher account and a second disposable test teacher account.

Do not use real children or real student information during testing.

## 1. Create or confirm the production Supabase project

1. Open the Supabase dashboard.
2. Create a new project for production, or select the project already approved for Pip.
3. Choose a strong database password and store it in the organization’s password manager.
4. Wait until the project finishes provisioning.
5. Open **Project Settings → General** and copy the project URL.
6. Open **Project Settings → API** and copy the public `anon` key or publishable key.
7. Do not copy the `service_role` key into Pip, the browser, GitHub, Vercel, or a `.env` file that will be shipped to users.

The two safe browser values will eventually be named:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

## 2. Apply the database schema and migrations

This step creates the classrooms, students, check-ins, teacher accounts, permissions, and security rules.

1. Install the Supabase CLI if the project owner has not already done so.
2. Log in with the Supabase CLI.
3. Link the CLI to the production project.
4. From the Pip project folder, review `supabase/schema.sql` and the files in `supabase/migrations/`.
5. For a completely empty project, apply the base schema first, then apply every migration in filename order.
6. For an existing project, do not reapply `supabase/schema.sql`. Apply only migrations that are genuinely missing.
7. In the Supabase dashboard, check the migration history and confirm these eight migrations are present:

```text
20260914000000_teacher_followups.sql
20260914000001_scope_teacher_reads.sql
20260914000002_teacher_classroom_reads.sql
20260915000000_phase3_student_management.sql
20260916000000_teacher_onboarding.sql
20260916000001_classroom_security.sql
20260917000000_student_last_name.sql
20260917000001_scope_checkin_response_writes.sql
```

8. Record the migration names, date, operator, and release commit in the launch record.

Never run the optional demo seed against a production project.

## 3. Configure Supabase authentication

1. In Supabase, open **Authentication → URL Configuration**.
2. Set the production site URL to the exact HTTPS website address, for example:

```text
https://checkin.example.org
```

3. Add these exact redirect URLs, replacing the domain:

```text
https://checkin.example.org/teacher/auth/callback
https://checkin.example.org/teacher/reset-password
```

4. Do not use `*` wildcards.
5. Confirm email confirmation is enabled for teacher signup.
6. Confirm password recovery is enabled.
7. Review the password policy and record it. Pip currently expects at least six characters, but a longer policy is preferable if the school’s account process supports it.

## 4. Configure production email delivery

Supabase’s default email service is not intended for dependable school-wide production use. Use an approved SMTP provider.

1. Create or select the organization’s SMTP account.
2. Verify the sending domain with the provider.
3. Add every DNS record the provider requests, usually SPF, DKIM, and sometimes DMARC.
4. Wait for the provider to confirm the domain.
5. In Supabase, open **Authentication → SMTP Settings**.
6. Enter the provider’s SMTP host, port, username, and password.
7. Choose a recognizable sender name, such as `Pip`, and an approved sender address.
8. Save the settings.
9. Send a signup confirmation to a disposable test email account.
10. Send a password-reset email to the same test account.
11. Confirm both messages arrive, links open the production website, and the links cannot be reused after completion.
12. Check the provider dashboard for delivery, bounce, and complaint events.

Never put the SMTP password in the Pip repository or a `VITE_` variable.

## 5. Configure the production hosting service

These instructions apply conceptually to Vercel, Netlify, or another static Vite host. The button names may differ slightly.

1. Create a production site connected to the Pip repository.
2. Set the build command to:

```text
npm run build
```

3. Set the output directory to:

```text
dist
```

4. Set the Node.js version to 22 or newer.
5. Add these environment variables to the production environment only:

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
```

6. Deploy a preview first.
7. Open the preview and confirm it loads without a blank screen.
8. Verify that the browser network tools do not show a service-role key.
9. Connect the final production domain.
10. Enable HTTPS and redirect HTTP to HTTPS.
11. Confirm the host is using the repository’s SPA fallback and security-header configuration.
12. Promote the tested preview to production.

## 6. Create a first teacher and classroom

1. Open the production website.
2. Select teacher signup.
3. Use a disposable staff test email first.
4. Confirm the email.
5. Sign in.
6. Complete the classroom setup wizard.
7. Add two or three synthetic students, such as `Test One` and `Test Two`.
8. Confirm the dashboard shows the classroom.
9. Confirm the student-management page can add, rename, and deactivate a synthetic student.
10. Delete or deactivate the synthetic data before real rollout, according to the school’s data policy.

Do not manually attach a teacher to a classroom by guessing a UUID. Use the supported onboarding flow or an administrator-approved SQL procedure.

## 7. Test classroom isolation and permissions

Use two disposable teacher accounts, Teacher A and Teacher B.

1. Give Teacher A only Classroom A.
2. Give Teacher B only Classroom B.
3. Add synthetic students to each classroom.
4. Run the anonymous security test:

```sh
npm run test:live:anon
```

5. Put the two disposable account values in an untracked `.env.test.local` file.
6. Run the full live security test:

```sh
npm run test:live:rls
```

7. Confirm all checks pass.
8. In the browser, confirm Teacher A cannot see Classroom B, its students, its check-ins, or its teacher notes.
9. Confirm anonymous visitors cannot load the classroom roster or create a check-in.
10. Remove the disposable accounts and synthetic data after testing.

The live test output is evidence for the launch record. It is not a substitute for reviewing the Supabase policies.

## 8. Enable backups and test a restore

1. In Supabase, open the project’s database backup or disaster-recovery settings.
2. Enable Point-in-Time Recovery if the plan supports it.
3. Confirm daily backups are enabled.
4. Record the backup schedule and retention period.
5. Before the first real-data launch, create a separate temporary Supabase project for restore testing.
6. Restore a backup into that separate project. Never make the first restore test directly over production.
7. Check that the restored project contains:
   - classrooms
   - teacher memberships
   - students
   - check-ins
   - teacher responses
   - RLS policies
   - authentication configuration
8. Run the live anonymous and RLS tests against the restored project.
9. Record what worked, what failed, the restore duration, and who approved the result.
10. Repeat this restore test at least quarterly.

## 9. Decide and implement data retention

This is a school/privacy decision, not a technical guess.

1. Ask the school or district privacy owner how long student names, check-ins, and teacher notes may be retained.
2. Ask whether inactive-student history must be deleted, anonymized, or retained for a defined instructional period.
3. Record the approved period, data categories, deletion owner, and approval date.
4. Do not collect real data until this decision is documented.
5. Have a developer implement the deletion or anonymization job as a reviewed database migration or scheduled Supabase Edge Function.
6. Test the job in a restored non-production project.
7. Confirm it deletes both check-ins and teacher responses in the approved scope.
8. Confirm it does not delete current active students or data required by law or school policy.
9. Schedule the job and record its last successful run.

## 10. Configure monitoring and alerts

Ask the Supabase and email-provider administrators to configure alerts for:

- repeated teacher sign-in failures
- unusual sign-in volume
- password-reset failures
- database or API errors
- slow API/database requests
- failed check-in writes
- RLS permission-denied spikes
- email bounces and complaints
- SMTP authentication failures

Then:

1. Send a test alert.
2. Confirm the responsible person receives it.
3. Write down who is on call.
4. Write down where incidents are reported.
5. Review logs daily during the first launch week.
6. Review logs weekly after the launch stabilizes.

Do not send child names, teacher notes, access tokens, or password-reset links to alert channels.

## 11. Set up the classroom device

1. Use a school-managed device, not a personal device.
2. Install current operating-system and browser security updates.
3. Create a restricted device account.
4. Open the production Pip URL in the browser.
5. Enable the browser’s managed kiosk or single-app mode.
6. Prevent access to browser settings, saved passwords, downloads, and unrelated websites.
7. Sign in as the classroom teacher.
8. Test the 15-minute inactivity timeout.
9. Confirm the teacher knows how to sign out at the end of the day.
10. Keep a backup device or documented manual check-in process for outages.

The Pip timeout reduces risk but does not replace device management.

## 12. Perform the final launch test

Use synthetic data for the final test.

1. Open the production site over HTTPS.
2. Sign up or sign in as a test teacher.
3. Complete classroom setup.
4. Add two synthetic students.
5. Run a child check-in for each student.
6. Confirm the dashboard totals update.
7. Confirm the teacher can record a private follow-up response.
8. Confirm the student history displays correctly.
9. Sign out and confirm the roster is no longer available.
10. Test password recovery.
11. Test the device timeout.
12. Check the browser console for unexpected errors.
13. Check that the production site has HTTPS, security headers, and no exposed secret keys.
14. Remove all synthetic data.
15. Record the test date, tester, release commit, migration list, and results.

## Launch approval checklist

The app is ready for real classroom data only when every item below is checked:

- [ ] Production domain and HTTPS work.
- [ ] Supabase migrations are applied in the correct order.
- [ ] Auth callback and password-reset URLs use the production domain.
- [ ] SMTP signup and password-reset delivery work.
- [ ] Anonymous and full live RLS tests pass.
- [ ] Teacher A/B classroom isolation is manually confirmed.
- [ ] Backups/PITR are enabled.
- [ ] A restore has been tested in a separate project.
- [ ] Retention and deletion policy is approved and implemented.
- [ ] Monitoring alerts have been tested.
- [ ] An incident owner and rollback owner are assigned.
- [ ] The classroom device is managed kiosk hardware.
- [ ] Final synthetic-data test passes.
- [ ] Synthetic test data is removed.

If any item is unchecked, pause the rollout and document the reason and owner.
