-- ============================================================
--  Crewcast v2 — allocation schema migration
--  Run in Supabase SQL Editor AFTER migration.sql
--
--  Changes crewcast_allocations from:
--    month text + pct numeric
--  to:
--    start_date date + end_date date + allocation_percentage integer
-- ============================================================

-- Step 1: add new columns (nullable initially so we can populate)
alter table crewcast_allocations add column if not exists start_date date;
alter table crewcast_allocations add column if not exists end_date   date;
alter table crewcast_allocations add column if not exists allocation_percentage integer;

-- Step 2: populate from existing month + pct data
update crewcast_allocations
set
  start_date            = (month || '-01')::date,
  end_date              = (date_trunc('month', (month || '-01')::date) + interval '1 month - 1 day')::date,
  allocation_percentage = round(pct)::integer
where start_date is null;

-- Step 3: enforce not-null
alter table crewcast_allocations alter column start_date            set not null;
alter table crewcast_allocations alter column end_date              set not null;
alter table crewcast_allocations alter column allocation_percentage set not null;
alter table crewcast_allocations alter column allocation_percentage set default 100;

-- Step 4: drop the old columns
alter table crewcast_allocations drop column if exists month;
alter table crewcast_allocations drop column if exists pct;

-- Verify:
-- select id, start_date, end_date, allocation_percentage from crewcast_allocations limit 5;
