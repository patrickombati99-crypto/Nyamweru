-- NYAMWERU SCHOOL database foundation (Supabase/Postgres)
-- Run only in a new Supabase project after reviewing the deployment checklist.
-- Do not store real learner data until policies have been tested.

create extension if not exists pgcrypto;

do $$ begin
  create type public.school_role as enum ('Administrator', 'Teacher', 'Learner');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.school_level as enum ('Primary School', 'Junior School', 'Senior School');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.application_status as enum ('Pending', 'Under Review', 'Accepted', 'Rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.school_role not null default 'Learner',
  admission_number text unique,
  staff_number text unique,
  school_level public.school_level,
  grade text,
  created_at timestamptz not null default now()
);

create table if not exists public.admission_applications (
  id uuid primary key default gen_random_uuid(),
  application_number text unique,
  learner_first_name text not null,
  learner_last_name text not null,
  date_of_birth date not null,
  gender text,
  requested_grade text not null check (requested_grade in ('PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12')),
  previous_school text,
  guardian_name text not null,
  guardian_relationship text not null,
  guardian_phone text not null,
  guardian_email text,
  home_area text,
  status public.application_status not null default 'Pending',
  reviewed_by uuid references public.profiles(id),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  admission_number text not null unique,
  full_name text not null,
  school_level public.school_level not null,
  grade text not null check (grade in ('PP1','PP2','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12')),
  date_of_birth date,
  guardian_name text,
  guardian_relationship text,
  guardian_phone text,
  guardian_email text,
  home_area text,
  status text not null default 'Pending' check (status in ('Pending','Active','Inactive')),
  created_at timestamptz not null default now()
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  staff_number text not null unique,
  full_name text not null,
  subjects text[] not null default '{}',
  assigned_grades text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.learning_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  school_level public.school_level not null,
  grade text not null,
  description text,
  storage_path text,
  resource_type text not null default 'PDF notes',
  uploaded_by uuid references public.profiles(id),
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  school_level public.school_level not null,
  grade text not null,
  exam_date date not null,
  max_score numeric(7,2) not null default 100 check (max_score > 0),
  status text not null default 'Scheduled' check (status in ('Draft','Scheduled','Completed','Published')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  score numeric(7,2) not null check (score >= 0),
  teacher_comment text,
  published_at timestamptz,
  entered_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (exam_id, learner_id)
);

create or replace function public.current_school_role()
returns public.school_role
language sql stable security definer set search_path = public, auth
as $$ select role from public.profiles where id = auth.uid() $$;

-- A new Auth account gets a learner profile by default. Never accept a role from signup metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'New user'), 'Learner')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.admission_applications enable row level security;
alter table public.learners enable row level security;
alter table public.teachers enable row level security;
alter table public.learning_materials enable row level security;
alter table public.exams enable row level security;
alter table public.results enable row level security;

-- Profiles: users see their own profile; admin manages profiles and role assignments.
drop policy if exists "Read own profile or admin" on public.profiles;
create policy "Read own profile or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.current_school_role() = 'Administrator');
drop policy if exists "Admin manages profiles" on public.profiles;
create policy "Admin manages profiles" on public.profiles for all to authenticated
using (public.current_school_role() = 'Administrator')
with check (public.current_school_role() = 'Administrator');

-- Admission applications contain children's and guardian's personal information.
-- Only authorised staff can read or change them. Public online submissions must go through
-- a rate-limited server/Edge Function that validates inputs; do not add an anon INSERT policy.
drop policy if exists "Admin reads admission applications" on public.admission_applications;
create policy "Admin reads admission applications" on public.admission_applications
for select to authenticated using (public.current_school_role() = 'Administrator');
drop policy if exists "Admin manages admission applications" on public.admission_applications;
create policy "Admin manages admission applications" on public.admission_applications
for all to authenticated using (public.current_school_role() = 'Administrator')
with check (public.current_school_role() = 'Administrator');

-- Learners: staff can read the directory; learners only see their own linked record.
drop policy if exists "Read learner records by role" on public.learners;
create policy "Read learner records by role" on public.learners for select to authenticated
using (
  public.current_school_role() = 'Administrator'
  or profile_id = auth.uid()
  or (public.current_school_role() = 'Teacher' and exists (
    select 1 from public.teachers t
    where t.profile_id = auth.uid() and t.assigned_grades @> array[learners.grade]
  ))
);
drop policy if exists "Admin manages learner records" on public.learners;
create policy "Admin manages learner records" on public.learners for all to authenticated
using (public.current_school_role() = 'Administrator')
with check (public.current_school_role() = 'Administrator');

-- Teacher directory is visible to signed-in users; only admin edits it.
drop policy if exists "Authenticated users read teacher directory" on public.teachers;
create policy "Authenticated users read teacher directory" on public.teachers
for select to authenticated using (true);
drop policy if exists "Admin manages teacher records" on public.teachers;
create policy "Admin manages teacher records" on public.teachers for all to authenticated
using (public.current_school_role() = 'Administrator')
with check (public.current_school_role() = 'Administrator');

-- Materials: signed-in users read published items; staff may see drafts and manage content.
drop policy if exists "Read published materials or staff drafts" on public.learning_materials;
create policy "Read published materials or staff drafts" on public.learning_materials
for select to authenticated using (
  published = true
  or public.current_school_role() = 'Administrator'
  or (public.current_school_role() = 'Teacher' and exists (
    select 1 from public.teachers t where t.profile_id = auth.uid()
      and t.assigned_grades @> array[learning_materials.grade]
      and t.subjects @> array[learning_materials.subject]
  ))
);
drop policy if exists "Staff manage materials" on public.learning_materials;
create policy "Staff manage materials" on public.learning_materials for all to authenticated
using (
  public.current_school_role() = 'Administrator'
  or (public.current_school_role() = 'Teacher' and exists (
    select 1 from public.teachers t where t.profile_id = auth.uid()
      and t.assigned_grades @> array[learning_materials.grade]
      and t.subjects @> array[learning_materials.subject]
  ))
)
with check (
  public.current_school_role() = 'Administrator'
  or (public.current_school_role() = 'Teacher' and exists (
    select 1 from public.teachers t where t.profile_id = auth.uid()
      and t.assigned_grades @> array[learning_materials.grade]
      and t.subjects @> array[learning_materials.subject]
  ))
);

-- Learners see scheduled/published exams; staff see all exams.
drop policy if exists "Read exams by role" on public.exams;
create policy "Read exams by role" on public.exams for select to authenticated
using (
  public.current_school_role() = 'Administrator'
  or (public.current_school_role() = 'Teacher' and exists (
    select 1 from public.teachers t where t.profile_id = auth.uid()
      and t.assigned_grades @> array[exams.grade] and t.subjects @> array[exams.subject]
  ))
  or (public.current_school_role() = 'Learner' and status in ('Scheduled','Published'))
);
drop policy if exists "Staff manage exams" on public.exams;
create policy "Staff manage exams" on public.exams for all to authenticated
using (
  public.current_school_role() = 'Administrator'
  or (public.current_school_role() = 'Teacher' and exists (
    select 1 from public.teachers t where t.profile_id = auth.uid()
      and t.assigned_grades @> array[exams.grade]
      and t.subjects @> array[exams.subject]
  ))
)
with check (
  public.current_school_role() = 'Administrator'
  or (public.current_school_role() = 'Teacher' and exists (
    select 1 from public.teachers t where t.profile_id = auth.uid()
      and t.assigned_grades @> array[exams.grade]
      and t.subjects @> array[exams.subject]
  ))
);

-- Learners only see their own published results. Staff access must be narrowed to assigned
-- grades/subjects before real production use (see DEPLOYMENT.md).
drop policy if exists "Read results by role" on public.results;
create policy "Read results by role" on public.results for select to authenticated
using (
  public.current_school_role() = 'Administrator'
  or (public.current_school_role() = 'Teacher' and exists (
    select 1 from public.teachers t
    join public.learners l on l.grade = any(t.assigned_grades)
    join public.exams e on e.id = results.exam_id and e.grade = l.grade
    where t.profile_id = auth.uid() and l.id = results.learner_id
      and t.subjects @> array[e.subject]
  ))
  or (published_at is not null and exists (
    select 1 from public.learners l where l.id = results.learner_id and l.profile_id = auth.uid()
  ))
);
drop policy if exists "Staff enter results" on public.results;
create policy "Staff enter results" on public.results for insert to authenticated
with check (
  public.current_school_role() = 'Administrator'
  or (entered_by = auth.uid() and public.current_school_role() = 'Teacher' and exists (
    select 1 from public.teachers t
    join public.learners l on l.grade = any(t.assigned_grades)
    join public.exams e on e.id = results.exam_id and e.grade = l.grade
    where t.profile_id = auth.uid() and l.id = results.learner_id
      and t.subjects @> array[e.subject]
  ))
);
drop policy if exists "Admin or entering teacher updates results" on public.results;
create policy "Admin or entering teacher updates results" on public.results for update to authenticated
using (
  public.current_school_role() = 'Administrator'
  or (entered_by = auth.uid() and exists (
    select 1 from public.teachers t
    join public.learners l on l.grade = any(t.assigned_grades)
    join public.exams e on e.id = results.exam_id and e.grade = l.grade
    where t.profile_id = auth.uid() and l.id = results.learner_id
      and t.subjects @> array[e.subject]
  ))
)
with check (
  public.current_school_role() = 'Administrator'
  or (entered_by = auth.uid() and exists (
    select 1 from public.teachers t
    join public.learners l on l.grade = any(t.assigned_grades)
    join public.exams e on e.id = results.exam_id and e.grade = l.grade
    where t.profile_id = auth.uid() and l.id = results.learner_id
      and t.subjects @> array[e.subject]
  ))
);

-- Production checklist remains mandatory: see DEPLOYMENT.md before using real records.

-- Rate-limit state used only by the trusted submit-admission Edge Function.
-- Client roles receive no access; the function uses the service role server-side.
create table if not exists public.admission_rate_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null default now(),
  submission_count integer not null default 0
);
alter table public.admission_rate_limits enable row level security;
revoke all on public.admission_rate_limits from anon, authenticated;
grant all on public.admission_rate_limits to service_role;

create or replace function public.check_admission_rate_limit(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare allowed boolean;
begin
  insert into public.admission_rate_limits(ip_hash, window_started_at, submission_count)
  values (p_ip_hash, now(), 1)
  on conflict (ip_hash) do update
  set window_started_at = case
        when public.admission_rate_limits.window_started_at < now() - interval '1 hour' then now()
        else public.admission_rate_limits.window_started_at end,
      submission_count = case
        when public.admission_rate_limits.window_started_at < now() - interval '1 hour' then 1
        else public.admission_rate_limits.submission_count + 1 end;
  select submission_count <= 5 into allowed from public.admission_rate_limits where ip_hash = p_ip_hash;
  return coalesce(allowed, false);
end;
$$;
revoke all on function public.check_admission_rate_limit(text) from public, anon, authenticated;
grant execute on function public.check_admission_rate_limit(text) to service_role;
