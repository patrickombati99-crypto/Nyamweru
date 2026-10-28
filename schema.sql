-- NYAMWERU SCHOOL starter schema. Review and test policies before using real learner data.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 role text not null default 'learner' check (lower(role) in ('headteacher','teacher','learner')),
 created_at timestamptz not null default now()
);
create table if not exists public.learners (
 id uuid primary key default gen_random_uuid(), profile_id uuid unique references public.profiles(id) on delete set null,
 admission_number text unique not null, first_name text not null, last_name text not null,
 grade text not null, gender text, date_of_birth date, guardian_name text, guardian_phone text,
 created_at timestamptz not null default now()
);
create table if not exists public.teachers (
 id uuid primary key default gen_random_uuid(), profile_id uuid unique references public.profiles(id) on delete set null,
 full_name text not null, email text, subjects text[] not null default '{}', assigned_grades text[] not null default '{}',
 created_at timestamptz not null default now()
);
create table if not exists public.learning_materials (
 id uuid primary key default gen_random_uuid(), title text not null, subject text, grade text, description text, file_url text,
 created_at timestamptz not null default now()
);
create table if not exists public.exams (
 id uuid primary key default gen_random_uuid(), title text not null, subject text, grade text, exam_date date, max_score numeric not null default 100,
 created_at timestamptz not null default now()
);
create table if not exists public.results (
 id uuid primary key default gen_random_uuid(), learner_id uuid not null references public.learners(id) on delete cascade,
 exam_id uuid references public.exams(id) on delete set null, subject text, score numeric not null, max_score numeric not null default 100,
 published boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.assignments (
 id uuid primary key default gen_random_uuid(), title text not null, subject text, grade text, due_date date, description text,
 created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.learners enable row level security;
alter table public.teachers enable row level security;
alter table public.learning_materials enable row level security;
alter table public.exams enable row level security;
alter table public.results enable row level security;
alter table public.assignments enable row level security;
create or replace function public.current_school_role() returns text language sql stable security definer set search_path=public as $$
 select lower(role) from public.profiles where id=auth.uid()
$$;
drop policy if exists "profiles read own or headteacher" on public.profiles;
create policy "profiles read own or headteacher" on public.profiles for select to authenticated using (id=auth.uid() or public.current_school_role()='headteacher');
drop policy if exists "headteacher manages profiles" on public.profiles;
create policy "headteacher manages profiles" on public.profiles for all to authenticated using (public.current_school_role()='headteacher') with check (public.current_school_role()='headteacher');
drop policy if exists "staff read learners" on public.learners;
create policy "staff read learners" on public.learners for select to authenticated using (public.current_school_role() in ('headteacher','teacher') or profile_id=auth.uid());
drop policy if exists "headteacher manages learners" on public.learners;
create policy "headteacher manages learners" on public.learners for all to authenticated using (public.current_school_role()='headteacher') with check (public.current_school_role()='headteacher');
drop policy if exists "staff read teachers" on public.teachers;
create policy "staff read teachers" on public.teachers for select to authenticated using (public.current_school_role() in ('headteacher','teacher') and (public.current_school_role()='headteacher' or profile_id=auth.uid()));
drop policy if exists "headteacher manages teachers" on public.teachers;
create policy "headteacher manages teachers" on public.teachers for all to authenticated using (public.current_school_role()='headteacher') with check (public.current_school_role()='headteacher');
drop policy if exists "signed in reads materials" on public.learning_materials;
create policy "signed in reads materials" on public.learning_materials for select to authenticated using (true);
drop policy if exists "headteacher manages materials" on public.learning_materials;
create policy "headteacher manages materials" on public.learning_materials for all to authenticated using (public.current_school_role()='headteacher') with check (public.current_school_role()='headteacher');
drop policy if exists "signed in reads exams" on public.exams;
create policy "signed in reads exams" on public.exams for select to authenticated using (true);
drop policy if exists "headteacher manages exams" on public.exams;
create policy "headteacher manages exams" on public.exams for all to authenticated using (public.current_school_role()='headteacher') with check (public.current_school_role()='headteacher');
drop policy if exists "learner sees own results and staff sees results" on public.results;
create policy "learner sees own results and staff sees results" on public.results for select to authenticated using (
 public.current_school_role() in ('headteacher','teacher') or (published=true and learner_id in (select id from public.learners where profile_id=auth.uid()))
);
drop policy if exists "staff inserts results" on public.results;
create policy "staff inserts results" on public.results for insert to authenticated with check (public.current_school_role() in ('headteacher','teacher'));
drop policy if exists "headteacher updates results" on public.results;
create policy "headteacher updates results" on public.results for update to authenticated using (public.current_school_role()='headteacher') with check (public.current_school_role()='headteacher');
drop policy if exists "signed in reads assignments" on public.assignments;
create policy "signed in reads assignments" on public.assignments for select to authenticated using (true);
drop policy if exists "staff manages assignments" on public.assignments;
create policy "staff manages assignments" on public.assignments for all to authenticated using (public.current_school_role() in ('headteacher','teacher')) with check (public.current_school_role() in ('headteacher','teacher'));
-- Important: the starter teacher policies are broad for some records. Tighten by class/subject before using real student data.
