-- ============================================================
--  Crewcast — full schema + RLS
--  Run once in Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
--  Tables use TEXT primary keys so the app can supply its own
--  IDs — crypto.randomUUID() for new records, short strings for
--  the initial seed data ('c1', 'r1', 'p1', …).
--
--  Schema columns exactly match the TypeScript interfaces in
--  src/types.ts — do NOT rename columns without updating types.ts.
-- ============================================================

-- ── Drop & recreate (idempotent re-run) ─────────────────────
drop table if exists crewcast_allocations;
drop table if exists crewcast_phases;
drop table if exists crewcast_projects;
drop table if exists crewcast_people;
drop table if exists crewcast_roles;
drop table if exists crewcast_customers;

-- ── Customers ────────────────────────────────────────────────
create table crewcast_customers (
  id    text primary key,
  name  text not null,
  color text not null default '#6366f1'
);

-- ── Roles ────────────────────────────────────────────────────
create table crewcast_roles (
  id           text    primary key,
  name         text    not null,
  hourly_rate  numeric not null default 0
);

-- ── People ───────────────────────────────────────────────────
-- department is stored as a text value matching the DEPARTMENTS
-- constant in types.ts — no separate departments table needed.
create table crewcast_people (
  id            text primary key,
  name          text not null,
  role_id       text not null default '',
  avatar_color  text not null default '#C8F041',
  department    text not null default ''
);

-- ── Projects ─────────────────────────────────────────────────
create table crewcast_projects (
  id              text     primary key,
  name            text     not null,
  customer_id     text     not null default '',
  start_month     text     not null default '',
  end_month       text     not null default '',
  budget_dollars  numeric  not null default 0,
  status          text     not null default 'active',
  billable        boolean  not null default true
);

-- ── Phases ───────────────────────────────────────────────────
create table crewcast_phases (
  id          text primary key,
  project_id  text not null default '',
  name        text not null,
  start_month text not null default '',
  end_month   text not null default ''
);

-- ── Allocations ──────────────────────────────────────────────
-- month  = 'YYYY-MM' string  (not a date — timeline uses month buckets)
-- pct    = 0–100 integer     (percentage of 160 h/month capacity)
create table crewcast_allocations (
  id          text     primary key,
  person_id   text     not null default '',
  project_id  text     not null default '',
  month       text     not null default '',
  pct         numeric  not null default 0,
  confirmed   boolean  not null default true
);

-- ── Row Level Security ───────────────────────────────────────
-- Open policies — Crewcast is a single-tenant internal tool
-- with no user authentication. Enable RLS so PostgREST can
-- access the tables via the anon key, but allow all operations.

alter table crewcast_customers   enable row level security;
alter table crewcast_roles        enable row level security;
alter table crewcast_people       enable row level security;
alter table crewcast_projects     enable row level security;
alter table crewcast_phases       enable row level security;
alter table crewcast_allocations  enable row level security;

create policy "Allow all" on crewcast_customers   for all using (true) with check (true);
create policy "Allow all" on crewcast_roles        for all using (true) with check (true);
create policy "Allow all" on crewcast_people       for all using (true) with check (true);
create policy "Allow all" on crewcast_projects     for all using (true) with check (true);
create policy "Allow all" on crewcast_phases       for all using (true) with check (true);
create policy "Allow all" on crewcast_allocations  for all using (true) with check (true);

-- ── Verify ───────────────────────────────────────────────────
-- After running, confirm these return rows:
-- select * from crewcast_customers;
-- select * from crewcast_people;
-- select * from crewcast_allocations;
