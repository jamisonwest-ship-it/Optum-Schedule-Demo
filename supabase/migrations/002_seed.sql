-- OptumRx Scheduling Platform — seed data
-- Roster source: "Older Excel Attempt/CLAUDE.md" (authoritative, May 2026 WIW exports).
-- Staff without a known email get firstname.lastname@example.com placeholders —
-- update those rows before that person can log in (magic-link auth matches on email).
-- Run AFTER 001_schema.sql.

-- ============================================================
-- LOCATIONS
-- ============================================================
insert into public.locations (code, name, opens_at, closes_at, active) values
  ('SMRX', 'Southwest Medical Pharmacy', '07:00', '19:30', true),
  ('SMMS', 'Southwest Medical Medication Services', '07:00', '19:30', false); -- opens July 1, 2026

-- ============================================================
-- DEPARTMENTS
-- ============================================================
insert into public.departments (location_id, code, name, color, ratio_isolated) values
  ((select id from public.locations where code='SMRX'), 'HI',        'Home Infusion (Homeside)', '#1d6fa4', false),
  ((select id from public.locations where code='SMRX'), 'HOSPICE',   'Hospice',                  '#7b4fa6', false),
  ((select id from public.locations where code='SMRX'), 'SPC',       'SPC Compounding',          '#c75b21', true),
  ((select id from public.locations where code='SMMS'), 'SPECIALTY', 'Specialty Pharmacy',       '#2e7d32', false),
  ((select id from public.locations where code='SMMS'), 'TC',        'Treatment Center',         '#00838f', false);

-- ============================================================
-- WORK TYPES (configurable ratio rules — the engine reads these)
-- ============================================================
insert into public.work_types (code, name, counts_for_rph, counts_for_tech, exclude_before, notes, sort_order) values
  ('WORKING',       'Working (on floor)',        true,  true,  null,    'Default active status',                          10),
  ('TRAINING',      'Training',                  true,  true,  null,    'Counts same as working',                         20),
  ('LUNCH',         'Lunch',                     false, false, null,    'Off floor',                                      30),
  ('MEETING',       'Meeting',                   false, false, null,    'Off floor',                                      40),
  ('OUT',           'Out / Left early',          false, false, null,    null,                                             50),
  ('NON_TECH',      'Non-Tech (admin/cleaning)', false, false, null,    'Tech-only status',                               60),
  ('REMOTE',        'Remote',                    false, false, null,    'Juliana only',                                   70),
  ('UTILITY',       'Utility / Project',         false, false, null,    null,                                             80),
  ('CCC',           'CCC',                       false, false, null,    'One required M-F, prefer available by 8:30am',   90),
  ('IV',            'IV duties',                 true,  true,  '08:30', 'No ratio counting before 8:30am; must wear scrubs', 100),
  ('SPC',           'SPC room',                  false, false, null,    'SPC-isolated',                                   110),
  ('IJMD',          'IJMD',                      false, false, null,    null,                                             120),
  ('TICKET',        'Ticket overflow',           false, false, null,    'Fariba uses often',                              130),
  ('GS',            'Graveyard',                 true,  true,  null,    'Ashley — counts during grid overlap hours',      140),
  ('INVENTORY',     'Inventory',                 false, false, null,    'Alyssa always; Karen some days',                 150),
  ('BILLING',       'Billing',                   false, false, null,    'Debra Fernandez',                                160),
  ('HOSPICE_AUDIT', 'Hospice Audit',             false, false, null,    null,                                             170),
  ('PROJECT',       'Project',                   false, false, null,    'Sharon usually; sometimes pharmacists',          180),
  ('SUPERVISOR',    'Supervisor',                false, false, null,    'Dustin, Amanda, Ida',                            190),
  ('RUNNER',        'Runner (Homeside)',         false, true,  null,    'Part of ratio',                                  200),
  ('HOSPICE_SHIFT', 'Hospice shift',             true,  true,  null,    'Hs code',                                        210),
  ('CHARTS',        'Charts / Clinical',         true,  false, null,    'C code — Bruce/Fariba',                          220);

-- ============================================================
-- STAFF (44 active)
-- ============================================================
-- Convenience: department + location ids
with d as (
  select
    (select id from public.departments where code='HI')        as hi,
    (select id from public.departments where code='HOSPICE')   as hospice,
    (select id from public.departments where code='SPC')       as spc,
    (select id from public.departments where code='SPECIALTY') as specialty,
    (select id from public.locations  where code='SMRX')       as smrx,
    (select id from public.locations  where code='SMMS')       as smms
)
insert into public.staff
  (email, full_name, preferred_name, app_role, staff_type, employment_type,
   home_location_id, primary_department_id, supervised_department_id,
   annual_hours_cap, always_exclude_ratio, constraints_notes, waw_position)
select * from (
  select v.email, v.full_name, v.preferred_name, v.app_role, v.staff_type, v.employment_type,
         case v.loc when 'SMMS' then d.smms else d.smrx end,
         case v.dept when 'HI' then d.hi when 'HOSPICE' then d.hospice when 'SPC' then d.spc
                     when 'SPECIALTY' then d.specialty else null end,
         case v.sup_dept when 'HI' then d.hi when 'HOSPICE' then d.hospice else null end,
         v.cap, v.excl, v.notes, v.waw
  from d, (values
  -- ---- Admins / managers ----
  ('dr.monahan@yahoo.com',               'Susan West',            'Susie',   'admin',                'rph',        'ft', 'SMMS', 'SPECIALTY', null, null, false, 'SMMS PIC. At SMRX until July 1 launch. May split days across locations.', 'Pharmacist - Lead Specialty'),
  ('brandy.depoorter@optum.com',         'Brandy Depoorter',      null,      'read_only',            'admin',      'ft', 'SMRX', null,        null, null, false, 'Pharmacy Director / VP. SMRX PIC. No scheduled shifts.', 'VP-Brandy'),
  ('lucy.kim@optum.com',                 'Lucy Kim',              null,      'pharmacist_scheduler', 'rph',        'ft', 'SMRX', 'HI',        null, null, false, 'Builds the SMRX pharmacist schedule.', 'Project'),
  ('vo.jennifer.2285@gmail.com',         'Jennifer Vo',           null,      'pharmacist',           'rph',        'ft', 'SMRX', 'HI',        null, null, false, 'Manager-RPh; manages own schedule. Evening lead shifts.', 'Pharmacist - Lead'),
  ('jeremy_garcia@optum.com',            'Jeremy Garcia',         null,      'read_only',            'admin',      'ft', 'SMRX', null,        null, null, false, 'Former manual ratio updater — role eliminated by this app. Kept for reference.', 'z Jeremy (Admin)'),
  -- ---- Tech supervisors (do not count for ratio) ----
  ('amanda.jeffords@optum.com',          'Amanda Jeffords',       null,      'tech_supervisor',      'supervisor', 'ft', 'SMRX', 'HOSPICE',   'HOSPICE', null, false, 'Hospice tech scheduler.', 'Supervisor Sourcing & Procurement'),
  ('maria.bernardo@optum.com',           'Ida Bernardo',          'Ida',     'tech_supervisor',      'supervisor', 'ft', 'SMRX', 'HOSPICE',   'HOSPICE', null, false, 'Hospice tech scheduler. Email shows "maria" — confirm. Also IV/TPN shifts.', 'SPC Infusion Manager'),
  ('dustin.harwood@optum.com',           'Dustin Harwood',        null,      'tech_supervisor',      'supervisor', 'ft', 'SMRX', 'HI',        'HI', null, false, 'Homeside tech scheduler.', 'Pharmacy Supervisor'),
  -- ---- Full-time pharmacists (placeholder emails marked @example.com) ----
  ('james.edwards@example.com',          'James Edwards',         null,      'pharmacist',           'rph',        'ft', 'SMRX', 'HI',        null, null, false, 'M-F 8:30-5. No early Tue/Wed/Thu. CCC Thursdays. Every other Mon: Hospice 7:30-4.', null),
  ('juliana.murdasanu@example.com',      'Juliana Murdasanu',     null,      'pharmacist',           'rph',        'ft', 'SMRX', 'HI',        null, null, false, 'M-Th 8:30-7 (4x10). Monthly remote + consulting day. ON MATERNITY LEAVE ~May 23 - ~Jun 20 2026.', null),
  ('fariba.borashan@example.com',        'Fariba Borashan',       null,      'pharmacist',           'rph',        'ft', 'SMRX', 'HI',        null, null, false, 'Tue-Fri 7:30-6 (4x10). OK weekends. Lives near SMMS — likely reassignment July 1.', null),
  ('hiep.tran@example.com',              'Hiep Tran',             null,      'pharmacist',           'rph',        'ft', 'SMRX', 'HI',        null, null, false, 'Tue-Fri 7:30-3:30 (hard stop 4). Sat 8-5 Homeside + Hospice 5-7. Preferred for IJ/Hospice.', null),
  ('sherley.tsang@example.com',          'Sherley Tsang',         null,      'pharmacist',           'rph',        'ft', 'SMRX', 'HI',        null, null, false, 'Sun-Thu, usually closes. Sun 8-5 extendable. Mon 7:30-6.', null),
  ('bruce.dang@example.com',             'Bruce Dang',            null,      'pharmacist',           'rph',        'ft', 'SMRX', 'HI',        null, null, false, 'Sun-Wed (never Friday). Any shift; prefers 4x10.', null),
  ('victor.nguyen@example.com',          'Victor Nguyen',         null,      'pharmacist',           'rph',        'ft', 'SMRX', 'HI',        null, null, false, 'Wed-Sat 4x10. SPC room Wednesdays. Sat Hospice 8-5. Long vacation Oct/Nov 2026 (unconfirmed).', null),
  ('ashdinh@yahoo.com',                  'Ashley Dinh',           null,      'pharmacist',           'rph',        'ft', 'SMRX', 'HI',        null, null, false, 'Graveyard. June 2026 pattern: Tue/Wed/Thu 8pm-7:30am, Fri 8pm-5:30am. Off Sat/Sun/Mon.', 'P-Graveyard Pharmacist'),
  -- ---- Per-diem pharmacists (960hr cap) ----
  ('maria.cruz@example.com',             'Maria Cruz',            null,      'pharmacist',           'rph',        'per_diem', 'SMRX', 'HI',  null, 960, false, 'Ask what days she CANNOT work. Often Hospice + closing.', null),
  ('matt.daly@example.com',              'Matthew Daly',          'Matt',    'pharmacist',           'rph',        'per_diem', 'SMRX', 'HI',  null, 960, false, 'Hospital job 7-on/7-off. ~3 days/month. Hard out by 6pm. Ask what days he CAN work.', null),
  ('mai.trasmano@example.com',           'Mai Trasmano',          null,      'pharmacist',           'rph',        'per_diem', 'SMRX', 'HI',  null, 960, false, 'Float RPh? Counts in old ratio sheet some days but not in WIW. CONFIRM STATUS WITH SUSIE.', null),
  -- ---- Home Infusion / Homeside techs ----
  ('edwin_fierros@optum.com',            'Edwin Fierros',         null,      'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, 'Hospice OE, Homeside IJ-MD Tech.', null),
  ('cheyenne.cacal@optum.com',           'Cheyenne Cacal',        null,      'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, 'Multi-role Homeside tech.', null),
  ('lynarose_aquino@optum.com',          'Lynarose Aquino',       null,      'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, null, null),
  ('akahippiegirl@gmail.com',            'Sharon Silva',          null,      'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, 'IV/TXTC/Project — often utility/project shifts.', null),
  ('shantel.izumigawa@optum.com',        'Shantel Izumigawa',     null,      'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, 'Homeside + Hospice Technician.', null),
  ('cassidy_patacsil@optum.com',         'Cassidy Patacsil',      null,      'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, null, null),
  ('maryrose_wells@optum.com',           'Mary Rose Wells',       null,      'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, 'IV-TPN, IV tech.', null),
  ('julie_m_ramirez@optum.com',          'Julie Ramirez',         null,      'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, null, null),
  ('lonelee.stack@gmail.com',            'Lonelee Stack',         null,      'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, null, null),
  ('ivan_alcaraz-ariza@optum.com',       'Ivan Alcaraz-Ariza',    'Ivan',    'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, null, null),
  ('ambermoliver@yahoo.com',             'Amber Oliver',          null,      'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, 'Homeside IJ-MD Tech.', null),
  ('crystal_ponce-carrasco@optum.com',   'Crystal Ponce-Carrasco','Crystal', 'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, 'Homeside Counter/TXTC Tech.', null),
  ('donna.johnson1@optum.com',           'Donna Johnson',         null,      'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, 'Homeside Counter, IV-Compound/TPN.', null),
  ('melissa.morse@optum.com',            'Melissa Morse',         null,      'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, 'Was listed as per-diem in older docs — confirm status.', null),
  ('ginanelson66@gmail.com',             'Gina Nelson',           null,      'tech', 'tech', 'ft', 'SMRX', 'HI', null, null, false, 'Homeside IJ-MD Tech, Training.', null),
  -- ---- Hospice techs ----
  ('kevghart@cox.net',                   'Genea Hart',            null,      'tech', 'tech', 'ft', 'SMRX', 'HOSPICE', null, null, false, 'Hospice OE/Expeditor, Hospice Auditor.', null),
  ('gergana_aleksieva@optum.com',        'Gergana Aleksieva',     null,      'tech', 'tech', 'ft', 'SMRX', 'HOSPICE', null, null, false, null, null),
  ('calilungkyla@gmail.com',             'Kyla Calilung',         null,      'tech', 'tech', 'ft', 'SMRX', 'HOSPICE', null, null, false, null, null),
  ('augustina.heath@optum.com',          'Agustina Heath',        'Tina',    'tech', 'tech', 'ft', 'SMRX', 'HOSPICE', null, null, false, null, null),
  ('gelina747@yahoo.com',                'Angelica Fridy',        null,      'tech', 'tech', 'ft', 'SMRX', 'HOSPICE', null, null, false, 'IV Runner, IV-TPN/Compound, Narcs/OE/Expeditor.', null),
  -- ---- Special-function techs ----
  ('alyssa.young2@optum.com',            'Alyssa Young',          null,      'tech', 'tech', 'ft', 'SMRX', 'HI',      null, null, true,  'Inventory only — NEVER counts for ratio.', 'Inventory Technician'),
  ('karen_ayalagutierrez@optum.com',     'Karen Ayala Gutierrez', 'Karen',   'tech', 'tech', 'ft', 'SMRX', 'HOSPICE', null, null, false, 'Inventory some days (no count); Hospice OE other days (counts).', null),
  ('angie.mcleod@optum.com',             'Angie McLeod',          null,      'tech', 'tech', 'ft', 'SMRX', 'SPC',     null, null, false, 'IV Runner, SPC Infusion Manager. Manages SPC cleaning schedule.', 'SPC Infusion Manager'),
  ('rodessalim@gmail.com',               'Maria Lim',             null,      'tech', 'tech', 'ft', 'SMRX', 'HOSPICE', null, null, false, 'Multi-dept: Hospice, Billing, Treatment Center Returns, Homeside IJ-MD. Distinct from Maria Cruz.', null),
  ('debra_fernandez@optum.com',          'Debra Fernandez',       null,      'tech', 'tech', 'ft', 'SMRX', 'HI',      null, null, true,  'Billing only — NEVER counts for ratio.', 'Billing Specialist')
  ) as v(email, full_name, preferred_name, app_role, staff_type, employment_type, loc, dept, sup_dept, cap, excl, notes, waw)
) as rows;

-- ============================================================
-- SCHEDULES (June 2026)
-- ============================================================
insert into public.schedules (location_id, month, year, status, published_at, published_by) values
  ((select id from public.locations where code='SMRX'), 6, 2026, 'published', '2026-05-28T17:00:00Z',
   (select id from public.staff where email='lucy.kim@optum.com')),
  ((select id from public.locations where code='SMMS'), 6, 2026, 'draft', null, null);

-- ============================================================
-- DEMO-WEEK SHIFTS (Mon June 8 – Sat June 13, 2026)
-- Published, realistic patterns per pharmacist constraints.
-- Includes deliberate ratio pressure so the grid shows yellow/red.
-- ============================================================

create or replace function public._seed_shift(
  p_email text, p_date date, p_start time, p_end time,
  p_wt text, p_dept text, p_code text default null
) returns void language sql as $$
  insert into public.shift_records
    (staff_id, location_id, department_id, shift_date, start_time, end_time,
     work_type_id, shift_code, status, schedule_id)
  select s.id, d.location_id, d.id, p_date, p_start, p_end, w.id, p_code, 'published', sc.id
  from public.staff s, public.departments d, public.work_types w
  left join public.schedules sc
    on sc.month = extract(month from p_date) and sc.year = extract(year from p_date)
   and sc.location_id = (select location_id from public.departments where code = p_dept)
  where s.email = p_email and d.code = p_dept and w.code = p_wt;
$$;

-- ---- Pharmacists ----
-- Lucy Kim: M-F 8:00-4:30
select public._seed_shift('lucy.kim@optum.com', d, '08:00', '16:30', 'WORKING', 'HI')
  from unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
-- Susie: M-F 8:00-4:30 (at SMRX until SMMS opens)
select public._seed_shift('dr.monahan@yahoo.com', d, '08:00', '16:30', 'WORKING', 'HI')
  from unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
-- Jennifer Vo: Mon/Wed/Fri 9:00-5:30
select public._seed_shift('vo.jennifer.2285@gmail.com', d, '09:00', '17:30', 'WORKING', 'HI')
  from unnest(array['2026-06-08','2026-06-10','2026-06-12']::date[]) d;
-- James Edwards: M-F 8:30-5, Thursday = CCC (does not count toward ratio)
select public._seed_shift('james.edwards@example.com', d, '08:30', '17:00', 'WORKING', 'HI')
  from unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-12']::date[]) d;
select public._seed_shift('james.edwards@example.com', '2026-06-11', '08:30', '17:00', 'CCC', 'HI', 'CCC');
-- Juliana: maternity leave — no shifts this week
-- Fariba: Tue-Fri 7:30-6
select public._seed_shift('fariba.borashan@example.com', d, '07:30', '18:00', 'WORKING', 'HI')
  from unnest(array['2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
-- Hiep: Tue-Fri 7:30-3:30; Sat 8-5 Homeside + Hospice 5-7
select public._seed_shift('hiep.tran@example.com', d, '07:30', '15:30', 'WORKING', 'HI')
  from unnest(array['2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
select public._seed_shift('hiep.tran@example.com', '2026-06-13', '08:00', '17:00', 'WORKING', 'HI');
select public._seed_shift('hiep.tran@example.com', '2026-06-13', '17:00', '19:00', 'HOSPICE_SHIFT', 'HOSPICE', 'Hs');
-- Sherley: Mon 7:30-6; Tue-Thu 9:30-7 (closer)
select public._seed_shift('sherley.tsang@example.com', '2026-06-08', '07:30', '18:00', 'WORKING', 'HI');
select public._seed_shift('sherley.tsang@example.com', d, '09:30', '19:00', 'WORKING', 'HI')
  from unnest(array['2026-06-09','2026-06-10','2026-06-11']::date[]) d;
-- Bruce: Mon-Wed 7:30-6 (4x10, Sun not seeded)
select public._seed_shift('bruce.dang@example.com', d, '07:30', '18:00', 'WORKING', 'HI')
  from unnest(array['2026-06-08','2026-06-09','2026-06-10']::date[]) d;
-- Victor: Wed = SPC room (isolated); Thu/Fri 8:30-7; Sat Hospice 8-5
select public._seed_shift('victor.nguyen@example.com', '2026-06-10', '08:00', '18:30', 'SPC', 'SPC', 'SPC');
select public._seed_shift('victor.nguyen@example.com', d, '08:30', '19:00', 'WORKING', 'HI')
  from unnest(array['2026-06-11','2026-06-12']::date[]) d;
select public._seed_shift('victor.nguyen@example.com', '2026-06-13', '08:00', '17:00', 'HOSPICE_SHIFT', 'HOSPICE', 'Hs');
-- Ashley: graveyard — Tue/Wed/Thu 8pm-7:30am, Fri 8pm-5:30am (overnight: end < start)
select public._seed_shift('ashdinh@yahoo.com', d, '20:00', '07:30', 'GS', 'HI', 'GS')
  from unnest(array['2026-06-09','2026-06-10','2026-06-11']::date[]) d;
select public._seed_shift('ashdinh@yahoo.com', '2026-06-12', '20:00', '05:30', 'GS', 'HI', 'GS');
-- Maria Cruz (per-diem): Thu/Fri close
select public._seed_shift('maria.cruz@example.com', d, '10:00', '19:00', 'WORKING', 'HI')
  from unnest(array['2026-06-11','2026-06-12']::date[]) d;
-- Matt Daly (per-diem): Wed only
select public._seed_shift('matt.daly@example.com', '2026-06-10', '08:00', '18:00', 'WORKING', 'HI');

-- ---- Tech supervisors (SUPERVISOR work type — never counts) ----
select public._seed_shift(e, d, '08:00', '16:30', 'SUPERVISOR', dept)
  from unnest(array['amanda.jeffords@optum.com','maria.bernardo@optum.com','dustin.harwood@optum.com']) e,
       unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d,
       lateral (select case when e = 'dustin.harwood@optum.com' then 'HI' else 'HOSPICE' end as dept) x;

-- ---- Home Infusion techs ----
-- Early block 7:30-4:00
select public._seed_shift(e, d, '07:30', '16:00', 'WORKING', 'HI')
  from unnest(array['edwin_fierros@optum.com','cheyenne.cacal@optum.com','lynarose_aquino@optum.com',
                    'shantel.izumigawa@optum.com','cassidy_patacsil@optum.com']) e,
       unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
-- Standard block 8:00-4:30
select public._seed_shift(e, d, '08:00', '16:30', 'WORKING', 'HI')
  from unnest(array['julie_m_ramirez@optum.com','lonelee.stack@gmail.com','ivan_alcaraz-ariza@optum.com',
                    'ambermoliver@yahoo.com','crystal_ponce-carrasco@optum.com']) e,
       unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
-- Late block 10:30-7:00 — creates evening ratio pressure when pharmacists thin out
select public._seed_shift(e, d, '10:30', '19:00', 'WORKING', 'HI')
  from unnest(array['melissa.morse@optum.com','ginanelson66@gmail.com']) e,
       unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
-- IV techs (excluded before 8:30am by work-type rule)
select public._seed_shift('maryrose_wells@optum.com', d, '07:30', '16:00', 'IV', 'HI', 'IV')
  from unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
select public._seed_shift('donna.johnson1@optum.com', d, '08:00', '16:30', 'IV', 'HI', 'IV')
  from unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
-- Sharon: project Tue, working otherwise
select public._seed_shift('akahippiegirl@gmail.com', '2026-06-09', '08:00', '16:30', 'PROJECT', 'HI', 'P');
select public._seed_shift('akahippiegirl@gmail.com', d, '08:00', '16:30', 'WORKING', 'HI')
  from unnest(array['2026-06-08','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
-- Saturday skeleton crew: 1 RPh on Homeside (Hiep, above) + 5 techs = RED demo
select public._seed_shift(e, '2026-06-13'::date, '08:00', '17:00', 'WORKING', 'HI')
  from unnest(array['edwin_fierros@optum.com','cheyenne.cacal@optum.com','julie_m_ramirez@optum.com',
                    'lonelee.stack@gmail.com','melissa.morse@optum.com']) e;

-- ---- Hospice techs ----
select public._seed_shift(e, d, '07:30', '16:00', 'WORKING', 'HOSPICE')
  from unnest(array['kevghart@cox.net','gergana_aleksieva@optum.com','calilungkyla@gmail.com']) e,
       unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
select public._seed_shift(e, d, '09:30', '18:00', 'WORKING', 'HOSPICE')
  from unnest(array['augustina.heath@optum.com','gelina747@yahoo.com']) e,
       unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;

-- ---- Special-function techs ----
-- Alyssa: inventory daily (always_exclude_ratio = true anyway)
select public._seed_shift('alyssa.young2@optum.com', d, '08:00', '16:30', 'INVENTORY', 'HI', 'INV')
  from unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
-- Karen: inventory Mon/Wed (no count), Hospice OE Tue/Thu/Fri (counts)
select public._seed_shift('karen_ayalagutierrez@optum.com', d, '08:00', '16:30', 'INVENTORY', 'HOSPICE', 'INV')
  from unnest(array['2026-06-08','2026-06-10']::date[]) d;
select public._seed_shift('karen_ayalagutierrez@optum.com', d, '08:00', '16:30', 'WORKING', 'HOSPICE')
  from unnest(array['2026-06-09','2026-06-11','2026-06-12']::date[]) d;
-- Angie: SPC room daily
select public._seed_shift('angie.mcleod@optum.com', d, '08:00', '16:30', 'SPC', 'SPC', 'SPC')
  from unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
-- Maria Lim: Hospice
select public._seed_shift('rodessalim@gmail.com', d, '08:00', '16:30', 'WORKING', 'HOSPICE')
  from unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;
-- Debra: billing daily (always excluded)
select public._seed_shift('debra_fernandez@optum.com', d, '08:00', '16:30', 'BILLING', 'HI', 'BILL')
  from unnest(array['2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12']::date[]) d;

drop function public._seed_shift(text, date, time, time, text, text, text);

-- ============================================================
-- SAMPLE TIME-OFF REQUESTS (so the request queue demos well)
-- ============================================================
insert into public.time_off_requests (staff_id, start_date, end_date, request_type, notes, status) values
  ((select id from public.staff where email='cheyenne.cacal@optum.com'),
   '2026-06-22', '2026-06-24', 'pto', 'Family trip — booked flights, flexible by a day if needed.', 'pending'),
  ((select id from public.staff where email='kevghart@cox.net'),
   '2026-06-19', '2026-06-19', 'personal', 'Appointment in the morning, could do a half day.', 'pending');

insert into public.time_off_requests
  (staff_id, start_date, end_date, request_type, notes, status, reviewed_by, reviewed_at, reviewer_notes)
values
  ((select id from public.staff where email='ginanelson66@gmail.com'),
   '2026-06-05', '2026-06-05', 'sick', null, 'approved',
   (select id from public.staff where email='lucy.kim@optum.com'),
   '2026-06-04T15:00:00Z', 'Feel better!');
