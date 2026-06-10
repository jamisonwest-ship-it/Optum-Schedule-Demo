# Optum Pharmacy Scheduling — Spec for Claude Cowork (Excel Workbook)

## Context

Jamison is consolidating three separate Optum pharmacy systems into a single Microsoft Excel workbook that lives in a Teams channel — Optum's IT environment will not allow a hosted app, but Teams + M365 Excel co-authoring is already approved and accessible from staff phones and laptops on the Optum network. Susie's team will own the workbook.

The three use cases to merge:

1. **Pre-scheduling of pharmacists by managers** — currently Susie's separate spreadsheet. *Not yet built in the demo app.* Cowork will design this from Susie's source spreadsheet.
2. **Live daily schedule** — pharmacists and techs update their own status from phones/laptops in real time. *Built in the demo app.*
3. **Ratio management, warnings, notifications** — pharmacist:tech ratios computed continuously, color-coded, with an activity log. *Built in the demo app.*

This document captures everything we built in `C:\dev\Optum-Schedule-Demo\index.html` so Cowork can re-implement the logic in Excel without re-deriving it. Susie's pharmacist spreadsheet and her notes for tech pre-scheduling will be supplied separately to Cowork.

---

## Functional Specification (built in the demo)

### 1. Departments

Three core departments — confirmed:

- Home Infusion
- Hospice
- Specialty Pharmacy

(Retail and Compounding are real pharmacy types but **not** what these Optum sites do.) There may be a fourth department; Susie's spreadsheet will tell us. Build the workbook so adding a department is a config change, not a structural one.

Each department's ratio is calculated independently. A cross-department total is also displayed.

### 2. Roles

- **Pharmacist (RPh)** — supervises techs. Available statuses: Working, Lunch, Meeting, Out.
- **Pharmacy Technician (Tech)** — must be supervised. Available statuses: Working, Lunch, Meeting, Out, Non-Tech (e.g. cleaning, admin task that doesn't count toward tech coverage).

### 3. Staff record

Each staff member has: `id`, `name`, `role` (`pharmacist` | `tech`), `dept`, `defaultShift`. Demo seeds 60 staff (5 RPh + 15 Tech × 3 depts) — the real headcount is unconfirmed, probably somewhat lower. Don't pin design choices to "60 people."

**Additional fields Cowork should add** (these are real-world attributes the demo didn't model — Lucy's spreadsheet may already capture some of them):

- **Employment type** — `salary` or `per-diem` (per-diem = hourly contractor; that's what the team calls them).
- **On-call status** — flag for who's available outside their scheduled shift.
- **PTO tracking** — capture PTO days off (no approval workflow needed yet; just visibility so it shows up on the schedule and excludes them from ratio).
- **Weekly hours running total + overtime flag** — Nevada overtime threshold (assume 40 hrs/week unless Susie's notes say otherwise). Flag anyone projected to cross 40 in the current week. This matters most for per-diem staff.

### 4. Shift templates (pre-scheduling building blocks)

| Shift | Letter | Hours | Label |
|-------|--------|-------|-------|
| Early | E | 7:00 AM – 3:00 PM | Early (7a–3p) |
| Standard | S | 8:00 AM – 5:00 PM | Standard (8a–5p) |
| Late | L | 10:00 AM – 6:00 PM | Late (10a–6p) |
| Off | – | — | Off |

**These are illustrative — Jamison made them up for the demo.** The real shift patterns live in Lucy's pharmacist pre-scheduling spreadsheet (which Susie will hand over). Lucy schedules with significant flexibility, likely down to **30-minute increments**, not pure templates. Cowork should derive the actual shift granularity and any standard patterns from Lucy's sheet, and treat the E/S/L set above only as proof that the *concept* of named shift templates worked in the demo.

### 5. Time slots

The day grid uses **22 half-hour slots** from 7:00 AM to 5:30 PM (covers earliest start through latest end). A person is "on shift" at slot `t` if `shift.start ≤ t < shift.end`.

### 6. Three views

- **Day view** — staff (rows, grouped by dept, RPh first then Tech) × 22 half-hour columns. Each cell shows whether the person is available, unavailable (overridden out), off-shift, or covering (overridden in). Per-slot ratio summary row per dept. Column headers colored by worst department status at that slot.
- **Month view** — departments (rows) × weekdays of the month (columns). Each cell shows the worst ratio status that day with the peak `RPh:Tech` count (e.g., `3:8` red). Clicking a cell opens the shift picker.
- **(Week view is in CLAUDE.md but is implemented as a slice of month view in practice — month is the master.)**

### 7. Schedule data model

```
schedule[YYYY-MM][personId][day] = 'early' | 'standard' | 'late' | 'off'
slotOverrides[YYYY-MM][personId][day][slotHour] = true   # flips availability
```

When a month is first opened, missing days auto-populate from `defaultShift` (weekdays) or `'off'` (weekends).

### 8. Ratio calculation (the heart of it)

**Constants:** `MAX_RATIO = 3` (legal max techs per pharmacist).

**Per slot, per department:**
1. Count pharmacists on shift at slot `t`.
2. Count techs on shift at slot `t`.
3. Status:
   - **Red** — techs > pharmacists × 3, OR techs present with zero pharmacists.
   - **Yellow** — techs ≥ pharmacists × 3 − 1 (at or one below the limit).
   - **Green** — techs < pharmacists × 3 − 1.
   - **None** — no one on shift.

**Per day, per department:** worst status across all 22 slots. Display the `RPh:Tech` count from the worst slot.

**Real-time (live status, ignoring schedule):**
- Same red/yellow/green logic, but counts use *current status* not schedule:
  - Working: counts toward role.
  - Lunch / Meeting / Out / Non-Tech: does **not** count.
- Cross-department total banner: `"OVER RATIO — N tech(s) must be reassigned"` when red.

### 9. Status management

Five statuses. Counting rules:

| Status | Counts as RPh? | Counts as Tech? | Notes |
|--------|----------------|-----------------|-------|
| Working | yes (if RPh) | yes (if Tech) | The only counting status |
| Lunch | no | no | |
| Meeting | no | no | |
| Out | no | no | Left early |
| Non-Tech | n/a | no | Tech-only — admin/cleaning task |

Status is changed by clicking a name → modal → pick new status. Each change writes one log entry.

### 10. Permissions

- **No user selected** (manager override mode): can edit anyone.
- **Pharmacist selected**: can edit anyone's status and schedule.
- **Tech selected**: can edit own status and own slot overrides only — cannot change schedule or other people's status.

(In Excel, this maps imperfectly — see Section 12 below.)

### 11. Activity log

Append-only, newest first, capped at 500 entries. Each entry: timestamp, name, dept, from-status, to-status. Displayed as a sidebar on desktop, slide-in panel on mobile, with relative time ("5m ago"), colored icon by destination status, manual Clear button (with confirmation).

### 12. Admin panel

- Staff table (add/remove staff; change name, role, dept, default shift).
- Add staff form (name, role, dept, default shift).
- Demo data generator (seeds 60 staff with realistic schedule including a few forced ratio violations for visibility).

### 13. Color scheme

- Green `#118C4F` / bg `#edf8f2`
- Yellow `#c77700` / bg `#fef6e8`
- Red `#c42b1c` / bg `#fdf0ee`
- Shift badges: Early blue, Standard green, Late purple, Off gray.

---

## Excel-specific design notes for Cowork

These are the gotchas of moving this from a web app to a Teams-hosted workbook. Cowork should weigh these against Susie's real-world workflow before locking in a design.

1. **Co-authoring is the platform.** M365 Excel supports simultaneous editing in Teams. This is what makes "everyone updates their status from their phone" work. Design for co-authoring — avoid VBA, prefer Office Scripts (cloud-native, runs in Teams mobile too).
2. **No real RBAC.** Sheet protection is binary (locked or not) and per-sheet, not per-cell-per-user. The demo's "techs can only edit themselves" rule probably becomes a soft convention enforced by:
   - Naming each row clearly so people know which row is theirs.
   - A simple "Who am I?" cell at the top that filters the view.
   - Office Script that timestamps every change and writes to the activity log sheet (so violations are visible after the fact).
3. **Mobile vs. desktop split — be deliberate, don't over-engineer mobile.**
   - **On a phone**, a person should only need to: identify themselves ("this is me"), update their own status / availability, and (if they're a pharmacist) glance at whether their department is approaching or over ratio. That's it.
   - **On a desktop or laptop**, the heavy work happens: Lucy and Susie pre-scheduling pharmacists and techs, the half-hour Day Grid, the month view, admin tasks.
   - Don't try to make every sheet usable on a phone. Pick a small "Mobile" sheet (or a filtered view) that's optimized for one-tap status updates and a ratio glance. Let the rest stay desktop-friendly.
   - Conditional formatting for ratio coloring (no scripts needed for the visual).
4. **Real-time ratios = formulas.** All the ratio math is `COUNTIFS`/`SUMPRODUCT` territory and recalculates instantly when anyone changes status. No scripts required for the calculation itself.
5. **Activity log = append-only sheet.** Office Script triggered on status change writes a row: `now() | name | dept | from | to`. Manual "Clear" is just a sheet wipe gated by a button.
6. **Pre-scheduling (use case #1)** is the unsolved piece. Susie's spreadsheet is the source of truth for that workflow — Cowork should read it and design the pharmacist pre-scheduling sheet from her actual format, then mirror the same structure for techs. The shift-template/`defaultShift` model from the demo is a starting framework, not a constraint.
7. **One workbook, multiple sheets.** Likely structure:
   - `Setup` — staff list (name, role, dept, employment type, on-call flag, default shift), shift templates, max ratio config, overtime threshold.
   - `Pre-Schedule` — Lucy/Susie's manager view, desktop-only: month grid of staff × days, shift assignments at 30-min granularity, PTO marks, on-call assignments, overtime warnings.
   - `Today` — live view, desktop: who's working right now, status dropdowns, live ratio gauges per dept and overall, half-hour Day Grid.
   - `Mobile` — phone-optimized filtered view: "this is me" picker, my status dropdown, my schedule for today/this week, plus a glance-able ratio indicator (especially for pharmacists).
   - `Activity Log` — append-only, written by Office Script on status changes.
   - `Admin` — config, ratio thresholds, color rules, user list, overtime threshold (default 40 hrs/wk, Nevada).

---

## Pasteable prompt for Cowork

> I'm building an Excel workbook to consolidate three Optum pharmacy systems (manager pre-scheduling, live daily schedule, ratio management) into one file that lives in a Teams channel. Below is the functional spec from a working demo app we built, plus notes on Excel-specific design constraints. I'll separately share Susie's pharmacist pre-scheduling spreadsheet and her notes — please use those as the source of truth for the manager pre-scheduling workflow, and use this spec as the source of truth for the live status and ratio logic. Goal: a single workbook that runs on M365 Excel (desktop + mobile via Teams), uses co-authoring for real-time updates, formulas for ratio math, and Office Scripts for the activity log. Propose a sheet structure, then we'll iterate.
>
> [Paste the whole "Functional Specification" and "Excel-specific design notes" sections above.]

---

## What's confirmed vs. what Cowork will figure out

**Confirmed:**
- Three departments (Home Infusion, Hospice, Specialty Pharmacy). A fourth may exist; build for extensibility.
- Half-hour Day Grid stays on desktop. Mobile is a stripped-down "this is me / what's my status / are we over ratio" view.
- Employment types: salary and per-diem (hourly contractor).
- Overtime flag at 40 hrs/wk (Nevada), assumed unless Susie's notes contradict.
- On-call and PTO tracking in scope. PTO approval workflow is **not** in scope yet.

**For Cowork to derive from Lucy's and Susie's spreadsheets:**
- Real shift patterns (likely 30-min granular with flexibility, not strict templates).
- Real headcount per department.
- Whether there's a fourth department.
- Float pool / cross-coverage rules.
- Anything else operationally specific that didn't come up in the demo.

This document is a handoff, not a final spec — Cowork will have richer source material (Lucy's pharmacist sheet, Susie's notes, tech-side data) and should treat the demo logic as the *minimum* of what to preserve.
