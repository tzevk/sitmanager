---
name: ui-polish
description: Fix UI bugs and redesign weak-looking screens in SIT Manager (staff dashboard, student portal, trainer portal) — keeping the SIT colours and the exact content, improving only the design. Use whenever a UI bug is reported or noticed, when a page looks amateur/cluttered/childish or has repeated widgets, when the user runs /ui-polish [page], or after building/editing any page in this app.
---

# /ui-polish — fix UI bugs, raise the design bar

Standing approval from the user: UI bug fixes and visual redesigns can be made **without asking**,
as long as the rules below hold. Anything that changes data, APIs, permissions or behaviour is
out of scope here — raise it with the user instead.

## When this applies

- A UI bug: broken layout, overflow/horizontal scroll, overlapping or clipped text, misaligned
  columns, wrong spacing, controls that don't respond, unreadable contrast, broken mobile view,
  loading/empty/error states missing or ugly, console errors from a component.
- A screen that looks "made by a 5-year-old": clashing or random colours, too many gradients/
  shadows/emoji/icons, inconsistent font sizes, cramped or uneven spacing, everything in a
  different style of card, walls of borders.
- **Repeated widgets**: the same number/list/chart shown twice on one page, two cards doing the
  same job, a section duplicated in a modal and the page. Merge into one, keep the better one.
- `/ui-polish <page or path>` — review that page; with no argument, the page(s) touched in this session.

## Hard rules

1. **Colours — SIT palette only.** Primary `#2E3093` (indigo; headings, primary buttons, active
   states; hover `#23257A`), secondary `#2A6BB5` (blue; labels, links, focus rings), accent
   `#FAE452` (yellow; sparingly — highlights, the brand gradient divider), text `#1a1f3c`,
   muted `#64748b`, surfaces white / `#f7f8fc` / slate-50, borders gray-200/300.
   Status colours only for meaning (emerald = success/paid, red = error/overdue, amber = warning/
   pending). No new hues, no rainbow charts, no decorative gradients beyond the existing
   `#2E3093 → #2A6BB5 (→ #FAE452)` brand gradient. Reuse the classes in `app/globals.css`.
2. **Content — untouched.** Same fields, labels, wording, columns, numbers, buttons, menu paths,
   order of information that users rely on, and the same data/API calls. Don't add or remove
   features. Exception: an exact duplicate widget is removed (keep one), and obviously broken
   text (typos in UI copy) may be corrected.
3. **Behaviour — untouched.** No changes to API routes, SQL, permissions (`useResourcePermissions`,
   `requirePermission`), form submission payloads, validation, or state logic beyond what a pure
   UI bug fix needs. Keep component props/exports stable.
4. **Design only gets better.** Each pass should leave the page calmer and more consistent than
   before — never a sideways restyle for its own sake.

## What "good" looks like here

- One card style per page (white, `rounded-xl`, `border-gray-200`, `shadow-sm`), consistent
  padding (p-4/p-5) and gaps (gap-4/gap-6); align to a grid.
- Clear hierarchy: one page title (`text-2xl font-bold text-gray-800` or the `#2E3093` heading
  style), section titles small and consistent, body `text-sm`, meta `text-xs text-slate-500`.
- Fewer borders and shadows, more whitespace. Tables: light header (`bg-gray-50`), row hover,
  right-aligned numbers, `whitespace-nowrap` for dates/codes, sticky header in scroll areas.
- Real loading skeletons, friendly empty states, inline errors — not blank areas.
- Works at phone width (student/trainer portals especially): no horizontal page scroll, tap
  targets ≥ 40px, grids collapse to one column.
- Icons only where they aid scanning; no emoji in staff UI.

## Workflow

1. Read the page component(s) fully, and the shared components they use (`components/ui/*`,
   `app/dashboard/components/*`) — fix shared components when the bug lives there.
2. List the problems (bugs first, then duplicates, then visual noise). Keep a before/after note.
3. Make the edits. Prefer small, contained changes; extract a repeated card into one local
   component rather than copy-pasting styles.
4. Verify: `npx tsc --noEmit -p .` (filter to touched files) and `npx eslint <files>`.
   If the dev server is available, open the page (use the `run` skill) and check desktop + phone width.
5. Log it: `node scripts/log-change.mjs --title "UI: <page> — <what improved>" --category Improvement`
   (every change must be on the Software Updates page).
6. Report briefly: page, bugs fixed, duplicates removed, design changes — and anything spotted
   that's out of scope (data/behaviour) for the user to decide.
