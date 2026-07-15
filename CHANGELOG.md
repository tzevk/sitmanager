# SIT Manager — Software Changelog

All notable changes to this project are documented here.
Format: `[Date] Module — Description`

---

## 2026-07-15

### Annual Batch — WhatsApp Group Link
- Added a **WhatsApp Group Link** field to the Annual Batch Add and Edit forms so each batch can store its invite link.
- The field is saved to the `batch_mst` table (`WhatsApp_Group_Link` column, added automatically on first use).
- Displayed and editable on both the Add and Edit pages under the Batch Details section.

### Batch Communication — New Daily Activity
- Added a **Batch Communication** page under Daily Activities (`/dashboard/daily-activities/batch-communication`).
- Follows the same Course → Batch → student list pattern as Allot Roll Number.
- Displays the batch's WhatsApp group link (clickable) at the top of the student list.
- Includes a **Send Email to All** utility: compose a subject and message body, preview the recipient count, and send email to every student in the batch who has an email address on record.
- Per-student send results (sent/failed) are shown after dispatch.

### Annual Batch — All Inputs 16 px Font Fix
- Extended the `font-size: 16px` fix from date inputs to **all** form inputs, selects, and textareas on the Add and Edit pages, preventing iOS Safari from auto-zooming on any field focus.

### Annual Batch — SectionCard Remount Fix
- `SectionCard` was previously defined as a `const` arrow function **inside** the page component, causing React to see a new component type on every render.
- This unmounted and remounted the entire card subtree on each state change, which closed the native date picker mid-selection on mobile.
- Fix: moved `SectionCard` and all CSS class constants to **module level** (outside the component function) so their identities are stable across renders.

---

## 2026-07-13

### Annual Batch — Description & Date Fixes
- **Description field** changed from a single-line text input to a multi-line textarea spanning the full row width, so longer descriptions can be entered without overflow.
- **Date inputs** on both the Add and Edit pages updated to use `font-size: 16px` to prevent iOS Safari from auto-zooming the viewport on focus (sub-16px inputs triggered a zoom that disrupted the native date picker, making it appear unresponsive).

### Online Admission — Discussion Column
- Added a **Discussion** column to the Online Admissions list page.
- Each row shows the total number of discussion notes logged against that inquiry (purple badge when notes exist, dash when none).
- Clicking the badge opens an inline modal showing the full discussion thread, with the ability to add a new note immediately.
- Discussion data is sourced from `awt_inquirydiscussion` (same table used by Inquiry Management).

### Online Admission Form — Educational Consent Fix
- Mechanical **diploma** and **postgraduate** specialisation holders were incorrectly shown the Educational Consent Form because the eligibility check only inspected graduation degree, graduation specialisation, and HSC stream.
- Fix: `diploma_specialization` and `postgrad_specialization` are now included in the eligibility matching logic — students with a Mechanical background at any education level are correctly recognised as eligible.

### Student Capture — Mobile Gallery Fix
- Removed `capture="user"` and `capture="environment"` HTML attributes from file inputs on the student capture page.
- Mobile browsers now present the standard Camera / Gallery picker instead of opening the camera directly.

---

## 2026-07-12

### Fee Details — Student Search
- Removed the `LIMIT 500` restriction on the `mode=students` endpoint so all students are returned when searching.
- Changed sort order to `ORDER BY Student_Name ASC` for easier lookup.
- Bumped main search result limit from 50 to 300.

### Fee Details — Page Scrolling
- Added `min-h-0` to the dashboard `<main>` element to fix a WebKit/Safari flexbox bug where the fee details page content was cut off instead of scrolling.
- Added bottom padding (`pb-6`) to the fee details page content wrapper for visual breathing room.
