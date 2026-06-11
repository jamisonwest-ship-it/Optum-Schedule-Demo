-- OptumRx Scheduling Platform — schema + RLS
-- Run this first, then 002_seed.sql (Supabase Dashboard → SQL Editor).

-- ============================================================
-- TABLES
-- ============================================================

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  code text unique not null check (code in ('SMRX', 'SMMS')),
  name text not null,
  opens_at time not null default '07:00',
  closes_at time not null default '19:30',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  code text unique not null,
  name text not null,
  color text not null default '#1d6fa4',
  ratio_isolated boolean not null default false,
  active boolean not null default true
);

-- Configurable ratio rules. The ratio engine reads from this table —
-- zero hard-coded counting logic in application code.
create table public.work_types (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  counts_for_rph boolean not null default false,
  counts_for_tech boolean not null default false,
  exclude_before time,        -- IV tech rule: no counting before 08:30
  exclude_after time,
  notes text,
  sort_order integer not null default 100
);

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id),
  email text unique not null,
  full_name text not null,
  preferred_name text,
  app_role text not null default 'tech'
    check (app_role in ('admin','pharmacist_scheduler','tech_supervisor','pharmacist','tech','read_only')),
  staff_type text not null default 'tech'
    check (staff_type in ('rph','tech','supervisor','admin')),
  employment_type text not null default 'ft'
    check (employment_type in ('ft','per_diem')),
  home_location_id uuid references public.locations(id),
  primary_department_id uuid references public.departments(id),
  supervised_department_id uuid references public.departments(id),
  annual_hours_cap integer,          -- 960 for per-diem, NULL for FT
  always_exclude_ratio boolean not null default false,
  constraints_notes text,
  waw_position text,
  active boolean not null default true
);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  month integer not null check (month between 1 and 12),
  year integer not null,
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  published_by uuid references public.staff(id),
  created_at timestamptz not null default now(),
  unique (location_id, month, year)
);

create table public.shift_records (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id),
  location_id uuid not null references public.locations(id),
  department_id uuid not null references public.departments(id),
  shift_date date not null,
  start_time time not null,
  end_time time not null,           -- end < start means overnight (graveyard)
  work_type_id uuid not null references public.work_types(id),
  shift_code text,                  -- raw code: 'Hs', 'GS', 'SPC', 'IV', ...
  status text not null default 'draft'
    check (status in ('draft','scheduled','published','cancelled')),
  schedule_id uuid references public.schedules(id),
  notes text,
  created_at timestamptz not null default now()
);
create index shift_records_date_idx on public.shift_records (shift_date);
create index shift_records_staff_idx on public.shift_records (staff_id, shift_date);

create table public.live_statuses (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id),
  status_date date not null default current_date,
  work_type_id uuid not null references public.work_types(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.staff(id),
  unique (staff_id, status_date)
);

create table public.time_off_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id),
  start_date date not null,
  end_date date not null,
  request_type text not null check (request_type in ('pto','sick','personal','unpaid')),
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  reviewed_by uuid references public.staff(id),
  reviewed_at timestamptz,
  reviewer_notes text,
  created_at timestamptz not null default now()
);

create table public.callouts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id),
  shift_id uuid references public.shift_records(id),
  callout_date date not null,
  reason text,
  logged_at timestamptz not null default now(),
  acknowledged_by uuid references public.staff(id),
  acknowledged_at timestamptz
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.staff(id),
  type text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  email_sent boolean not null default false,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Append-only audit trail
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references public.staff(id),
  action_type text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_created_idx on public.activity_log (created_at desc);

-- ============================================================
-- RLS HELPERS
-- ============================================================

create or replace function public.current_staff_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.staff where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_staff_role()
returns text language sql stable security definer set search_path = public as $$
  select app_role from public.staff where auth_user_id = auth.uid() limit 1;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

alter table public.locations enable row level security;
alter table public.departments enable row level security;
alter table public.work_types enable row level security;
alter table public.staff enable row level security;
alter table public.schedules enable row level security;
alter table public.shift_records enable row level security;
alter table public.live_statuses enable row level security;
alter table public.time_off_requests enable row level security;
alter table public.callouts enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;

-- Reference tables: everyone authenticated can read; only admin writes.
create policy "read locations" on public.locations for select to authenticated using (true);
create policy "admin writes locations" on public.locations for all to authenticated
  using (public.current_staff_role() = 'admin');

create policy "read departments" on public.departments for select to authenticated using (true);
create policy "admin writes departments" on public.departments for all to authenticated
  using (public.current_staff_role() = 'admin');

create policy "read work_types" on public.work_types for select to authenticated using (true);
create policy "admin writes work_types" on public.work_types for all to authenticated
  using (public.current_staff_role() = 'admin');

-- Staff: read all; update own row; admin manages everyone.
create policy "read staff" on public.staff for select to authenticated using (true);
create policy "update own staff row" on public.staff for update to authenticated
  using (auth_user_id = auth.uid());
create policy "admin manages staff" on public.staff for all to authenticated
  using (public.current_staff_role() = 'admin');

-- Schedules: read all; schedulers/admin write.
create policy "read schedules" on public.schedules for select to authenticated using (true);
create policy "schedulers write schedules" on public.schedules for all to authenticated
  using (public.current_staff_role() in ('admin','pharmacist_scheduler','tech_supervisor'));

-- Shifts: managers see everything; staff only see published (drafts invisible pre-publish).
create policy "managers read all shifts" on public.shift_records for select to authenticated
  using (
    public.current_staff_role() in ('admin','pharmacist_scheduler','tech_supervisor','read_only')
    or status = 'published'
  );
create policy "schedulers write shifts" on public.shift_records for all to authenticated
  using (public.current_staff_role() in ('admin','pharmacist_scheduler','tech_supervisor'));

-- Live statuses: everyone reads; techs update only their own; RPh/managers update anyone.
create policy "read live statuses" on public.live_statuses for select to authenticated using (true);
create policy "write own live status" on public.live_statuses
  for insert to authenticated
  with check (
    staff_id = public.current_staff_id()
    or public.current_staff_role() in ('admin','pharmacist_scheduler','tech_supervisor','pharmacist')
  );
create policy "update live status" on public.live_statuses
  for update to authenticated
  using (
    staff_id = public.current_staff_id()
    or public.current_staff_role() in ('admin','pharmacist_scheduler','tech_supervisor','pharmacist')
  );

-- Time-off requests: staff see/submit their own; managers see and decide all.
create policy "read own or managed requests" on public.time_off_requests for select to authenticated
  using (
    staff_id = public.current_staff_id()
    or public.current_staff_role() in ('admin','pharmacist_scheduler','tech_supervisor','read_only')
  );
create policy "submit own request" on public.time_off_requests for insert to authenticated
  with check (staff_id = public.current_staff_id());
create policy "managers decide requests" on public.time_off_requests for update to authenticated
  using (public.current_staff_role() in ('admin','pharmacist_scheduler','tech_supervisor'));

-- Callouts: log own; managers see all.
create policy "read callouts" on public.callouts for select to authenticated
  using (
    staff_id = public.current_staff_id()
    or public.current_staff_role() in ('admin','pharmacist_scheduler','tech_supervisor','read_only')
  );
create policy "log own callout" on public.callouts for insert to authenticated
  with check (
    staff_id = public.current_staff_id()
    or public.current_staff_role() in ('admin','pharmacist_scheduler','tech_supervisor')
  );
create policy "managers ack callouts" on public.callouts for update to authenticated
  using (public.current_staff_role() in ('admin','pharmacist_scheduler','tech_supervisor'));

-- Notifications: users only see their own.
create policy "read own notifications" on public.notifications for select to authenticated
  using (recipient_id = public.current_staff_id());
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (recipient_id = public.current_staff_id());

-- Activity log: append-only; managers read.
create policy "append activity" on public.activity_log for insert to authenticated
  with check (true);
create policy "managers read activity" on public.activity_log for select to authenticated
  using (public.current_staff_role() in ('admin','pharmacist_scheduler','tech_supervisor','read_only'));
