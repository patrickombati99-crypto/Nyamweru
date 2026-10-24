# NYAMWERU SCHOOL — Step 5 connection checklist

## A. Apply the database SQL

In your Supabase dashboard, open **SQL Editor**.

- If the database tables do not exist yet, run `supabase/schema.sql` first.
- Then run `supabase/connect_records.sql` to restrict teacher access by assigned grades and subjects.

## B. Configure the website

Copy `.env.example` to `.env.local` in the project root and replace the placeholders:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

Use only the project URL and public key in the browser application. Never use the service-role key in a frontend environment variable.

## C. Set up accounts and roles

1. Create an administrator user in Supabase Authentication.
2. Use the SQL Editor as the trusted project owner to set that user's `profiles.role` to `Administrator`.
3. Create teacher accounts through the authorised process. Set their profile role to `Teacher` and link their profile UUID to the correct `teachers.profile_id` row. Set exact subject names and grade strings in the arrays.
4. When a learner account is created, link its profile UUID to the correct `learners.profile_id`. Keep the learner's role as `Learner`.

Use actual account emails and record identifiers in your own private SQL session; do not paste passwords, secret keys or real children's details into chat.

## D. What is connected in this release

- Reads learner, teacher, learning-material, exam and result records from Supabase after sign-in.
- Saves learner, teacher-directory, learning-material metadata, exam and result records to Supabase.
- Allows an administrator to publish saved results; learners should only see their own linked and published results.
- Restricts teacher record access through the supplied grade/subject policies, provided teacher profiles and assignments are linked correctly.

## E. Not yet complete

- The site has not been deployed or connected to your specific project by this package.
- Dependency installation timed out in this environment, so a production build could not be verified here.
- Learning-material file uploads/storage, account invitations, guardian portal access, report cards, and full profile detail screens remain to be implemented.
- Before collecting real learner data, test RLS with separate accounts, review Kenya's applicable data-protection obligations, and arrange backups and operational support.
