# NYAMWERU SCHOOL website prototype

A responsive React/Vite prototype for a school portal covering primary, junior and senior school.

## Current prototype features
- Responsive login screen and school portal layout
- Dashboard summary cards and quick actions
- Learner enrolment form and learner directory
- Teacher directory and add-teacher form
- Learning-material catalogue and add-resource form
- Examination calendar and scheduling form
- Results table, grade filter, score percentages and result-entry form
- Role-based navigation preview for Administrator, Teacher and Learner
- Demo data is held in browser memory only and resets on refresh
- Optional Supabase client integration for authentication

## Important limitations
This is a front-end prototype, not a production school information system. The role selector on the login screen is only a UI preview and is not authentication. Do not use it to protect real learner information. The sample records are fictitious. Data entered in forms is not saved permanently. File uploads, report cards, password recovery, verified role assignment and real database access rules need to be configured before launch.

## Run locally
Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build for deployment
```bash
npm run build
npm run preview
```

## Enable Supabase authentication
1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project's public URL and anon/publishable key.
4. Create approved user accounts in Supabase Auth.
5. Create the `profiles` table and apply the SQL in `supabase/schema.sql`.
6. In the live version, remove the preview role selector and read the role only from the authenticated profile after validating it server-side with database RLS.
7. Add Row Level Security policies for every table and storage bucket before storing learner data.

Never place a Supabase service-role key in frontend environment variables or client-side code.

## Step 3: online admission application
- Public application form route: `/admissions`
- Form submits through a Supabase Edge Function; it does not directly write to the private applications table.
- Edge Function source: `supabase/functions/submit-admission/index.ts`
- Apply the updated `supabase/schema.sql`, then follow Step 6 in `DEPLOYMENT.md` to deploy the function and configure the allowed origin.
- Until deployed/configured, the form displays a setup message and cannot accept applications.

## Step 4: authentication session handling
- Restores an existing Supabase session after refresh.
- Reads the role from the authenticated user's `profiles` row rather than allowing a role choice on the login form.
- Signs out accounts that have no valid school profile.
- This is an authentication improvement, not a completed production launch; dashboard data still includes demo records until each section is connected to database queries and writes.

## Step 5: connect school records to Supabase

The portal now loads learners, teachers, learning materials, exams and results from Supabase after a verified sign-in. The create forms write to the database and report policy/connection errors instead of claiming that a save succeeded. With Supabase environment variables absent, the site remains a clearly labelled temporary preview.

1. Copy `.env.example` to `.env.local` and fill in the **project URL** and **public anon/publishable key** only.
2. In Supabase SQL Editor, run `supabase/schema.sql` if you have not already created the tables.
3. Run `supabase/connect_records.sql` to limit teacher access to assigned grades and subjects. This migration is safe to re-run.
4. Create your first administrator in Supabase Authentication, then assign `profiles.role = 'Administrator'` from the trusted SQL Editor. Do not let public signup choose roles.
5. Add a teacher profile and directory entry. Set the teacher profile role to `Teacher`, link `teachers.profile_id` to that user's profile UUID, and set exact `subjects` and `assigned_grades` arrays. Access checks require the teacher record to be linked correctly.
6. Link each learner login to the correct learner row by setting `learners.profile_id` to that learner's `profiles.id`. Only published results are shown to learner accounts.
7. Test with separate admin, teacher and learner accounts before using real learner data.

The teacher directory form creates a directory record only; it does not create or invite a login account. Results are initially unpublished; an administrator can publish saved results from the Results page. Learning-material entries currently store metadata only; secure file storage/upload is not yet implemented.

**Important:** This package has not been deployed or connected to your specific Supabase project from this chat. Never put the Supabase service-role key in `.env.local` or browser code. Do not use real learner records until the schema, account links and Row Level Security policies have been tested.
