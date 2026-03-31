-- Supabase schema for CTC Deliberations
-- Creates tables + enables row-level security for anonymous (auth_no) usage.
-- Paste into Supabase SQL Editor and run.

create extension if not exists "pgcrypto";

-- Base dataset (each CSV upload becomes a new dataset; one is marked current)
create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  is_current boolean not null default false
);

create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (dataset_id, name)
);

create table if not exists public.applicant_responses (
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  question_key text not null,
  question_order int,
  response text,
  primary key (applicant_id, question_key)
);

create table if not exists public.roles (
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  role_name text not null,
  created_at timestamptz not null default now(),
  unique (dataset_id, role_name)
);

-- Derived mapping of applicants -> roles they are candidates for
create table if not exists public.applicant_role_candidates (
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  role_name text not null,
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (dataset_id, role_name, applicant_id)
);

-- Global published selections (what we subscribe to via realtime)
create table if not exists public.published_selections (
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  role_name text not null,
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (dataset_id, role_name, applicant_id)
);

-- Realtime + DELETE events require a replica identity.
alter table public.published_selections replica identity full;

-- Indexes for realtime filtering
create index if not exists applicants_dataset_id_idx on public.applicants(dataset_id);
create index if not exists applicant_responses_applicant_id_idx on public.applicant_responses(applicant_id);
create index if not exists roles_dataset_role_idx on public.roles(dataset_id, role_name);
create index if not exists applicant_role_candidates_dataset_role_idx on public.applicant_role_candidates(dataset_id, role_name);
create index if not exists published_selections_dataset_role_idx on public.published_selections(dataset_id, role_name);

-- Enable RLS
alter table public.datasets enable row level security;
alter table public.applicants enable row level security;
alter table public.applicant_responses enable row level security;
alter table public.roles enable row level security;
alter table public.applicant_role_candidates enable row level security;
alter table public.published_selections enable row level security;

-- Ensure question ordering column exists (for modal display)
alter table public.applicant_responses
add column if not exists question_order int;

-- Anonymous select policies (auth_no)
create policy "public_datasets_select" on public.datasets
for select
using (true);

create policy "public_applicants_select" on public.applicants
for select
using (true);

create policy "public_applicant_responses_select" on public.applicant_responses
for select
using (true);

create policy "public_roles_select" on public.roles
for select
using (true);

create policy "public_applicant_role_candidates_select" on public.applicant_role_candidates
for select
using (true);

create policy "public_published_selections_select" on public.published_selections
for select
using (true);

-- Allow anonymous inserts/updates used by CSV import from the frontend
create policy "public_datasets_insert" on public.datasets
for insert
with check (true);

create policy "public_datasets_update_current" on public.datasets
for update
using (true)
with check (true);

create policy "public_applicants_insert" on public.applicants
for insert
with check (true);

create policy "public_applicant_responses_insert" on public.applicant_responses
for insert
with check (true);

create policy "public_roles_insert" on public.roles
for insert
with check (true);

create policy "public_applicant_role_candidates_insert" on public.applicant_role_candidates
for insert
with check (true);

-- Allow anonymous publishes (insert/delete) for realtime updates
create policy "public_published_selections_insert" on public.published_selections
for insert
with check (true);

create policy "public_published_selections_delete" on public.published_selections
for delete
using (true);

-- Realtime
-- In Supabase dashboard:
--   Database -> Replication -> Realtime
--   Enable realtime for `published_selections`

