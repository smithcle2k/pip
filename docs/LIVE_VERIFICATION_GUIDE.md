# Pip live verification guide

This guide is for checking Pip against the real Supabase project. You do not need to send passwords, API keys, email links, or screenshots containing private information to anyone.

## Before you begin

You need:

- Access to the correct Supabase project.
- The Pip project open locally.
- A real mailbox you can use for one disposable test teacher.
- Docker running for the local database test.

Never use a service-role key in the browser or in `.env.local`. The browser key is the anon/publishable key only.

## 1. Check the local build and database tests

Open Terminal and run:

```sh
cd /Users/csmith/pip
npm run build
python3 supabase/tests/test_onboarding.py
```

The database test should end with:

```text
All local database tests passed
```

These tests use disposable local data. They do not test email delivery or the live Supabase project.

## 2. Check Supabase Auth settings

In Supabase, open the correct project and go to:

**Authentication → URL Configuration**

Confirm that the redirect URL for local testing is present:

```text
http://127.0.0.1:5173/teacher/auth/callback
```

If the app will be published, add the matching HTTPS URL for that real domain, for example:

```text
https://your-real-domain.example/teacher/auth/callback
```

Do not add wildcard URLs.

Then open **Authentication → Providers → Email** and confirm:

- Email/password signups are enabled.
- Email confirmation remains required.
- The password minimum matches the app’s current six-character setting.

For real classroom use, configure a custom SMTP provider under the project’s Auth email settings. Supabase’s built-in sender is rate-limited and intended mainly for development.

## 3. Make local environment settings

Copy the example file if needed:

```sh
cp .env.example .env.local
```

Put only these two values in `.env.local`:

```text
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Do not commit `.env.local`. Do not paste its contents into chat.

## 4. Test signup and confirmation

Start Pip:

```sh
npm run dev
```

Open the printed local address, then visit `/teacher/signup`.

Use a new disposable email address and complete this journey:

1. Enter first name, email, password, and matching confirmation.
2. Select **Create Account** once.
3. Confirm that Pip displays **Check your email**.
4. Open the confirmation email.
5. Select its confirmation link.
6. Confirm that Pip opens the welcome/setup page.
7. Confirm that the browser address does not retain credential or error parameters.

If the email does not arrive, check the email provider’s spam folder and Supabase Auth logs. Do not weaken email confirmation just to make the test pass.

## 5. Test resumable classroom setup

Using the confirmed test teacher:

1. Select **Get Started**.
2. Enter a test classroom name.
3. Select **Create Classroom** twice quickly.
4. Confirm only one classroom is created.
5. Add at least one student.
6. Refresh the browser and confirm the saved classroom and student remain.
7. Add a student with a first and last name and confirm the kiosk shows the first name and last initial (e.g. “Thomas E.”).
8. Select **Finish Setup**.
9. Confirm the dashboard opens and says **Your classroom is ready!**.
10. Open `/teacher/setup` again and confirm it redirects to the dashboard.

Do not use real children’s names or photos for testing.

## 6. Run the live authorization test

Create two disposable, confirmed email/password users in:

**Authentication → Users → Add user**

Use names such as `pip-test-a` and `pip-test-b`. Never use real classroom data.

Create an untracked test environment file. The live authorization suite must be rerun after applying the classroom-scope security migration:

```sh
cd /Users/csmith/pip
touch .env.test.local
```

Put these four values in it, using the two disposable accounts:

```text
PIP_TEST_A_EMAIL=disposable-teacher-a@example.com
PIP_TEST_A_PASSWORD=use-the-test-password-here
PIP_TEST_B_EMAIL=disposable-teacher-b@example.com
PIP_TEST_B_PASSWORD=use-the-test-password-here
```

Run the anonymous checks first:

```sh
node tests/live-rls.mjs --anon
```

Then run the complete ordinary-client security test:

```sh
node tests/live-rls.mjs
```

Before calling the authorization checks complete, confirm that
`20260917000001_scope_checkin_response_writes.sql` is applied in the target
Supabase project. This migration prevents an authenticated teacher from
reading or writing check-ins and follow-up responses belonging to another
classroom.

The final line should report all checks passed. The test creates synthetic classrooms, students, check-ins, and responses, then removes the data it can remove through the browser API.

## 7. Clean up test accounts

After testing, run:

```sh
node tests/live-rls.mjs
```

The script cleans up its synthetic rows. Then, in Supabase, go to **Authentication → Users**, find the `pip-test-` users, and delete only those disposable accounts.

Do not run cleanup SQL against real teachers or real classrooms. The cleanup SQL file is:

```text
supabase/inspection/cleanup_synthetic_teachers.sql
```

Use it only when you have confirmed the account email prefix is `pip-test-`.

## 8. Test password recovery

Use a disposable confirmed test teacher:

1. Sign out of Pip.
2. Open `/teacher/login`.
3. Select **Forgot password?**.
4. Enter the disposable teacher’s email.
5. Select **Send Reset Link**.
6. Confirm the neutral success message appears.
7. Open the reset email.
8. Set a new password with matching password fields.
9. Confirm Pip accepts the new password and returns to the login/dashboard flow.
10. Sign out and sign back in with the new password.

Also test an unknown email. It should show the same neutral message and must not reveal whether an account exists.

## 9. Configure production email delivery

Supabase’s built-in email sender is useful for testing, but it is rate-limited and is not intended for production. For real classroom use, configure a custom SMTP provider such as Resend, Postmark, SendGrid, Brevo, or AWS SES.

### Create an SMTP provider account

Choose one email provider and create an account. Verify a domain or sender address with that provider. The provider should give you:

- SMTP host
- SMTP port, usually `587`
- SMTP username
- SMTP password
- Verified sender email, such as `no-reply@yourdomain.com`

Do not paste the SMTP password into chat, commit it to the repository, or put it in `.env.local`. SMTP credentials belong only in Supabase’s protected settings.

### Enter the SMTP settings in Supabase

1. Open the correct Pip project in Supabase.
2. Select **Authentication**.
3. Open **Emails → SMTP Settings**.
4. Enable custom SMTP.
5. Enter the SMTP host, port, username, and password from your provider.
6. Set the sender name to `Pip`.
7. Set the sender email to the verified sender address from your provider.
8. Save the settings.

Leave email confirmation enabled. Do not turn it off to make testing easier.

### Test the new sender

Using a disposable confirmed teacher account:

1. Open Pip’s `/teacher/login` page.
2. Select **Forgot password?**.
3. Request a reset link.
4. Check that the email arrives from your configured sender address.
5. Follow the link and set a new password.
6. Sign out and sign back in with the new password.

If the message does not arrive, check the provider’s delivery log, the spam folder, and the SMTP host/port settings. Do not test with real teacher or child data until delivery works.

Supabase’s current guidance is available in its [custom SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

## What to record

Record each item as `PASS`, `FAIL`, or `NOT RUN`:

- Build and local database tests
- Auth redirect URL
- Signup and confirmation email
- Classroom setup and refresh resume
- Student/photo setup
- Anonymous authorization test
- Teacher A/Teacher B authorization test
- Password recovery email and reset
- Cleanup of disposable accounts and data

A passing build does not prove that RLS, email delivery, SMTP, or the complete live journey work. Do not call the app production-ready until the failed or untested items have been resolved and recorded.
