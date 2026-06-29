-- ================================================================
-- SprayPlan – Supabase Database Setup
-- Run this in your Supabase project:
--   Dashboard → SQL Editor → New Query → paste & Run
-- ================================================================

-- CHEMICALS table
create table if not exists chemicals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  rate text default '',
  methods jsonb default '[]',
  respray_weeks integer default 0,
  auto_respray boolean default false,
  created_at timestamptz default now()
);

-- OPERATIVES table
create table if not exists operatives (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- TASKS table
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  location text not null,
  instruction text default '',
  comments text default '',
  operative text not null,
  date date not null,
  completed boolean default false,
  completed_date date,
  spot_spray boolean default false,
  frequency_weeks integer default 0,
  next_date date,
  chemicals jsonb default '[]',
  created_at timestamptz default now()
);

-- Enable Row Level Security but allow all access via anon key
alter table chemicals enable row level security;
alter table operatives enable row level security;
alter table tasks enable row level security;

create policy "allow all chemicals" on chemicals for all using (true) with check (true);
create policy "allow all operatives" on operatives for all using (true) with check (true);
create policy "allow all tasks" on tasks for all using (true) with check (true);

-- ── Seed data ──────────────────────────────────────────────────
insert into chemicals (name, type, rate, methods, respray_weeks, auto_respray) values
  ('Amistar (Fungicide)',   'Fungicide',        '1L/ha',  '["Big Sprayer","Knapsack"]', 3, true),
  ('Roundup (Herbicide)',   'Herbicide',        '3L/ha',  '["Big Sprayer","Knapsack"]', 0, false),
  ('Karate (Insecticide)',  'Insecticide',      '0.5L/ha','["Knapsack","Blower"]',      4, true),
  ('Serenade (Bio Control)','Bio Control',      '2L/ha',  '["Knapsack"]',               2, true),
  ('Solufeed (Feed)',       'Feed',             '5kg/ha', '["Big Sprayer","IBC"]',      2, false),
  ('Moddus (Growth Reg)',   'Growth Regulator', '0.5L/ha','["Big Sprayer"]',            0, false);

insert into operatives (name) values
  ('Tom Hadley'),
  ('Sarah Okafor'),
  ('Jake Brennan');
