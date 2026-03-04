-- ============================================================
--  Crewcast schema — paste into Supabase SQL Editor and Run
--  Tables use text primary keys so the app can supply its own
--  IDs (crypto.randomUUID() for new records, short strings for
--  the initial seed data).
--
--  RLS is disabled on all tables — Crewcast is a single-tenant
--  internal tool with no user authentication.
--  Add RLS policies here if you add auth in future.
-- ============================================================

-- ── Customers ────────────────────────────────────────────────
create table if not exists crewcast_customers (
  id    text    primary key,
  name  text    not null,
  color text    not null default '#6366f1'
);

-- ── Roles ────────────────────────────────────────────────────
create table if not exists crewcast_roles (
  id           text    primary key,
  name         text    not null,
  hourly_rate  numeric not null default 0
);

-- ── People ───────────────────────────────────────────────────
create table if not exists crewcast_people (
  id            text    primary key,
  name          text    not null,
  role_id       text    not null default '',
  avatar_color  text    not null default '#C8F041',
  department    text    not null default ''
);

-- ── Projects ─────────────────────────────────────────────────
create table if not exists crewcast_projects (
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
create table if not exists crewcast_phases (
  id          text primary key,
  project_id  text not null default '',
  name        text not null,
  start_month text not null default '',
  end_month   text not null default ''
);

-- ── Allocations ──────────────────────────────────────────────
create table if not exists crewcast_allocations (
  id          text     primary key,
  person_id   text     not null default '',
  project_id  text     not null default '',
  month       text     not null default '',
  pct         numeric  not null default 0,
  confirmed   boolean  not null default true
);

-- ── Grant anon access (no RLS enforced) ──────────────────────
grant all on crewcast_customers   to anon, authenticated;
grant all on crewcast_roles        to anon, authenticated;
grant all on crewcast_people       to anon, authenticated;
grant all on crewcast_projects     to anon, authenticated;
grant all on crewcast_phases       to anon, authenticated;
grant all on crewcast_allocations  to anon, authenticated;
