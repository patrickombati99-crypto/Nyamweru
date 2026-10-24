# NYAMWERU SCHOOL — secure setup checklist

This project is currently a **prototype**. It is not deployed, and its forms are not yet connected to persistent school records. Do not enter real children's data until the steps below are completed and tested.

## 1. Create the database

1. Create a new project at Supabase.
2. Open **SQL Editor** in the Supabase dashboard.
3. Review `supabase/schema.sql`, then run it in the new project.
4. In Project Settings → API, copy the project URL and public anon/publishable key.
5. In the project root, copy `.env.example` to `.env.local` and fill in:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Never put a `service_role` key in `.env.local`, browser code, or source control.

## 2. Create the first administrator safely

The signup trigger intentionally creates new accounts as `Learner`; it does not trust a role supplied by a user. Create the first administrator account, then assign its `profiles.role` to `Administrator` using the Supabase dashboard/SQL Editor as the trusted project owner. Do not expose administrator role changes in a public signup form. Create teacher accounts and assign roles only through an authorised admin workflow.

## 3. Before collecting online admissions

The `admission_applications` table is protected so only administrators can read or modify applications. The public website must **not** write directly to that table with an unrestricted anonymous insert policy. Implement a Supabase Edge Function or trusted server endpoint that validates fields, rate-limits submissions, adds spam protection, and inserts only approved fields. Provide a privacy notice and collect only necessary information.

## 4. Required before launch

- Replace the role-picker/demo login UI with real Supabase session handling and server-verified roles.
- Connect enrolment, staff, materials, exams and results screens to database operations; remove demo data.
- Restrict teachers to their assigned classes/subjects (the starter policies currently permit teachers broader access to learner records and results).
- Validate result scores against each exam's `max_score` in a trusted database function or server-side workflow.
- Configure private file storage and access policies for learning materials; do not use public buckets for confidential files.
- Add password reset, account invitation, session expiry, audit logs, backup/restore checks and error handling.
- Test all policies with separate administrator, teacher and learner accounts, including attempts to read other learners' records.
- Review Kenya's applicable data-protection requirements and obtain appropriate parent/guardian notices and consent before processing children's personal data.
- Deploy to a hosting provider and test on phones, tablets and computers.

## 5. Run the current front-end prototype

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Build check:

```bash
npm run build
```

A successful local build does not mean the backend is configured or the site is production-ready.

## 6. Online admissions (Step 3)

The public application form is available at `/admissions`. It calls the `submit-admission` Edge Function rather than inserting directly into the private applications table.

1. Apply the updated full `supabase/schema.sql` in the Supabase SQL Editor.
2. Deploy the function from the project root using the Supabase CLI:

   ```bash
   supabase functions deploy submit-admission --no-verify-jwt
   ```

3. The function needs the project's standard `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server secrets. Supabase supplies these to deployed Edge Functions by default; verify them in your project settings and never place the service-role key in frontend `.env` files.
4. Set the `ALLOWED_ORIGIN` Edge Function secret to the exact deployed website origin (for example `https://your-school-domain.example`) to restrict browser CORS.
5. Add a clear privacy notice and school contact details to the form before publishing it. Test valid submissions, invalid dates, honeypot submissions, rate limiting, and the admin-only review permissions with test data.
6. The current rate limiter allows up to five submissions per hashed source IP in a rolling hourly window. This is a basic anti-abuse measure, not a replacement for monitoring, stronger bot protection, or privacy review.

The admission form and Edge Function are source code only until the database migration and function are deployed to your own Supabase project. Do not collect real children's data until those steps and access-control tests are complete.

## 7. Authentication session hardening (Step 4)

The front-end now restores an existing Supabase session on page load, fetches the signed-in user's `profiles.role`, and signs out when the profile is missing or has an unexpected role. The role is not chosen on the login form. This improves the sign-in flow, but it does not by itself make the whole portal production-ready: every table and storage bucket still needs tested Row Level Security policies, and the current dashboard lists still contain demo records until their data operations are connected to the database.

After setting `.env.local`, test these cases using separate test accounts: valid administrator, valid teacher, valid learner, account without a profile, invalid password, and sign-out followed by refresh. Confirm that role restrictions are enforced by database policies and not only by hiding navigation items.
