# Optum Pharmacy Ratio Tracker

A single-page demo app that tracks pharmacist-to-technician ratios across pharmacy departments. Built as a demo to show what Claude Code can build for Optum pharmacy operations.

**Live:** Hosted via GitHub Pages on the `claude/pharmacy-ratio-tracker-ATufY` branch.

---

## What It Does

Pharmacies must maintain a legal ratio of technicians to pharmacists (max 3 techs per 1 pharmacist). This app lets pharmacy managers:

1. **See ratio health across the day** — a schedule grid shows when people are working and whether the pharmacy is in/out of ratio at each 30-minute time slot
2. **Track real-time status** — click a person's name to mark them as Working, Lunch, Meeting, Out, or Non-Tech
3. **Manage schedules** — assign shift templates (Early/Standard/Late/Off) per person per day
4. **View ratio trends** — Week and Month views show ratio health over time

## Architecture

**Single file:** Everything lives in `index.html` — HTML, CSS, and JavaScript. No build step, no dependencies, no framework. Just open it in a browser.

**State:** All data persists in `localStorage` under the key `pharmacyRatioTracker`. Clearing localStorage resets to demo defaults.

---

## Key Concepts

### Departments
Three pharmacy departments, each with pharmacists and technicians:
- **Home Infusion** — 5 pharmacists, 15 techs
- **Hospice** — 5 pharmacists, 15 techs
- **Specialty Pharmacy** — 5 pharmacists, 15 techs

### Ratio Rules
- `techs > pharmacists x 3` → **RED** (over ratio)
- `techs = pharmacists x 3` → **YELLOW** (at limit)
- `techs < pharmacists x 3 - 1` → **GREEN** (within ratio)
- `0 pharmacists + any techs` → **RED** (no supervision)

### Shift Templates
Each person has a `defaultShift` and can be assigned a shift per day:

| Shift    | Short | Hours         |
|----------|-------|---------------|
| Early    | E     | 7:00 AM – 3:00 PM |
| Standard | S     | 8:00 AM – 5:00 PM |
| Late     | L     | 10:00 AM – 6:00 PM |
| Off      | –     | Not working    |

### Time Slots
The day is divided into **20 half-hour blocks** from 7:00 AM to 5:00 PM (last slot starts at 4:30 PM). Each slot's ratio status is calculated based on who is on shift at that time.

---

## Page Structure

### Top Bar
- Optum branding (blue bar with orange logo)
- "Your Name" dropdown — select yourself to restrict which staff you can edit (techs can only edit their own status; pharmacists can edit anyone)
- Admin gear icon — opens admin panel

### Overall Ratio Banner
Real-time ratio across all departments. Shows green/yellow/red status with RPh:Tech counts.

### View Tabs (Day / Week / Month)
Tabbed navigation with date prev/next/today controls.

#### Day View (default)
- Rows = staff members, grouped by department (pharmacists on top, techs below)
- Columns = 30-minute time blocks (7:00 AM – 4:30 PM)
- **Column headers are colored** by ratio status at that time slot (green/yellow/red)
- Each cell shows a blue block if the person is on shift, empty if not
- Click a person's name → opens status change modal

#### Week View
- Monday–Friday columns
- One row per department
- Each cell colored by the **worst ratio status** across all time slots that day

#### Month View
- All weekdays in the month as columns
- One row per department
- Each cell colored by worst ratio status for that day

### Activity Log
- Desktop: sidebar on the right
- Mobile: slide-out panel from bottom nav
- Records every status change with timestamp

### Admin Panel (modal)
Two tabs:

#### Staff Tab
- Table of all staff with Name, Role, Department, Default Shift, Remove button
- Add-staff form at bottom (name, role, department, default shift)
- Changing default shift persists immediately

#### Schedule Tab
- Month navigator (prev/next)
- Per-person, per-day shift dropdowns: E (Early), S (Standard), L (Late), – (Off)
- Color-coded by shift type (blue=early, green=standard, purple=late, gray=off)
- "Apply Today" button — sets everyone's real-time status based on today's schedule (shift assigned → Working, off → Out)
- Auto-populates new months using each person's `defaultShift` for weekdays, Off for weekends

---

## Data Model (in `state`)

```
state = {
  staff: [
    { id, name, role, dept, defaultShift }
  ],
  statuses: {
    [personId]: 'working' | 'lunch' | 'meeting' | 'out' | 'nontech'
  },
  schedule: {
    '2026-02': {           // year-month key
      [personId]: {
        1: 'standard',     // day number → shift key
        2: 'early',
        3: 'off',
        ...
      }
    }
  },
  log: [
    { time, name, dept, from, to }
  ],
  nextId: 100
}
```

## Key Functions

| Function | Purpose |
|----------|---------|
| `renderGrid()` | Main dispatcher — calls Day/Week/Month view based on `currentView` |
| `renderDayView()` | Builds the 30-min slot grid with ratio-colored headers |
| `renderWeekView()` | Mon–Fri grid with worst-ratio colored cells per dept |
| `renderMonthView()` | All weekdays grid with worst-ratio colored cells per dept |
| `calcSlotRatio(deptId, date, slotHour)` | Returns ratio status for one dept at one time slot |
| `getWorstDayStatus(deptId, date)` | Checks all 20 slots, returns worst status |
| `isPersonOnShiftAtSlot(personId, date, slotHour)` | Whether a person's shift covers a given time |
| `ensureMonthSchedule(date)` | Auto-populates missing month data from defaultShift |
| `migrateState(s)` | Converts old boolean schedule → shift strings |
| `renderSchedule()` | Admin schedule tab with shift dropdowns |
| `renderStaffTable()` | Admin staff tab with default shift column |
| `openStatusModal(personId)` | Status change bottom sheet |
| `calcDeptRatio(deptId)` | Real-time ratio for overall banner |
| `calcOverall()` | Aggregate ratio across all departments |

## CSS Organization

All styles are in the `<style>` block, organized by section:
- Reset & Base / CSS Variables
- Top Bar / Overall Banner
- Main Layout / Log Panel
- Status Modal / Admin Panel
- Mobile Bottom Nav / Mobile Log Overlay
- View Tabs / Date Navigation / Grid Legend
- Day Grid / Week-Month Grid
- Shift Select (admin dropdowns)
- Toast / Footer
- Responsive breakpoints (900px, 480px)

## Mobile Support

- Responsive at 900px breakpoint (stacked layout, bottom nav appears)
- Horizontal scroll on grids with sticky name columns
- Touch-optimized targets (min 44px)
- Mobile log overlay (slide from right)
- Safe area insets for notched phones

---

## How to Run

Just open `index.html` in any browser. No server needed.

To reset all data: open browser console and run:
```js
localStorage.removeItem('pharmacyRatioTracker');
location.reload();
```

## Tech

- Zero dependencies — vanilla HTML/CSS/JS
- Inter font from Google Fonts
- localStorage for persistence
- No build step, no bundler, no framework
