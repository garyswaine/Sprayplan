-- ================================================================
-- SprayPlan – Add Labels table
-- Paste this into Supabase SQL Editor → New Query → Run
-- This only adds new things, nothing existing is changed
-- ================================================================

create table if not exists labels (
  id uuid primary key default gen_random_uuid(),
  chemical_name text not null,
  file_name text not null,
  storage_path text not null,
  uploaded_at timestamptz default now()
);

alter table labels enable row level security;

create policy "allow all labels"
  on labels for all
  using (true)
  with check (true);
