# NYAMWERU SCHOOL portal rebuild

This is a rebuilt React/Vite starter package based on the available NYAMWERU SCHOOL files and requirements.

## Features in this rebuild
- Responsive school portal layout
- Email/password Supabase sign-in and profile-based role check
- Learners, teachers, learning materials, exams/dates, results and assignments sections
- Forms for adding records when the database is configured and role policies permit it
- Starter Supabase schema and Row Level Security policies

## Important limitations
This package is a rebuild starter, **not a verified production school system**. It has not been connected to your Supabase project or deployed from this chat. Do not enter real learner data until the policies are reviewed and tested. Admission-number login needs a trusted server-side function and is not implemented by a client-side password lookup. Report cards, secure file uploads, invitations, password reset and detailed teacher class/subject restrictions still need implementation and testing.

## Setup
1. Install Node.js 18 or later on a computer.
2. Copy `.env.example` to `.env.local`.
3. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the Supabase project URL and public anon/publishable key only.
4. In Supabase SQL Editor, review and run `supabase/schema.sql`.
5. Create approved users in Supabase Authentication and create matching `profiles` rows using their Auth user IDs. Set roles to `headteacher`, `teacher`, or `learner`.
6. Run `npm install`, then `npm run dev` to test. Run `npm run build` before deployment.

Never use a Supabase service-role key in browser code or frontend environment variables. Review all Row Level Security policies with separate headteacher, teacher, and learner accounts before production use.
