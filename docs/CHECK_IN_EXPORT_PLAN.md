# Teacher check-in export implementation plan

Status: proposed; no feature implementation authorized or performed.

## Goal

Allow a signed-in teacher to download their classroom’s check-in records as a CSV file from the teacher dashboard, with an explicit date range and student selection.

CSV is the first release format because Excel and Google Sheets can open it. PDF reports, charts, scheduled emails, and native Excel workbooks are outside this feature’s initial scope.

## Proposed teacher experience

1. Select **Download check-ins** on the dashboard.
2. Choose a date preset or enter start and end dates.
3. Choose all active students or selected students. An **Include inactive students** option makes historical records available without silently adding them to the default selection.
4. Review the exact dates, time zone, and student selection. Show a short notice: “Contains student information. Store and share according to your school’s policy.”
5. Select **Download CSV**. Show progress, prevent duplicate requests, and provide a retry action on failure.
6. If no records match, show an empty-state message instead of downloading an empty file.

Use an accessible dialog with labeled controls, keyboard navigation, focus restoration, and announced progress/errors. Disable exports when the classroom cannot be resolved or the session is invalid. Demo mode should explain that downloads require a connected classroom.

## Date ranges

| Option | Proposed behavior |
| --- | --- |
| Last 7 days | Today and the preceding 6 calendar days |
| Last 30 days — default | Today and the preceding 29 calendar days |
| Current term | Configured term start through today, capped at term end |
| Current school year | Configured school-year start through today, capped at year end |
| Custom dates | Explicit inclusive start and end dates |

- Display the resolved dates for every preset.
- Reject reversed dates, invalid dates, and future end dates.
- Limit a request to 366 inclusive calendar days; this is a proposed product limit, not a legal retention requirement. School-year presets use actual configured dates.
- Use the browser’s local time zone initially, matching the existing dashboard. Display that zone clearly and freeze it for the export request.
- Convert inclusive dates into a start-inclusive, next-day-exclusive timestamp interval. Use calendar arithmetic so daylight-saving transitions do not drop or duplicate hours.
- Export limits do not change the database retention policy or delete any records.

The app currently has no term or school-year calendar settings. Ship Last 7 days, Last 30 days, and Custom dates first. Enable term/year presets only after school-provided dates have a defined configuration source; do not guess an August or September start date. A persistent school time zone can be added with that calendar configuration.

## CSV contents

One row per saved check-in, including multiple check-ins by the same student on the same day. Do not export only the latest check-in per student as the dashboard does.

Proposed columns:

- Check-in ID
- Student ID
- Student first name
- Student last name
- Current student status: active/inactive
- Classroom name
- Check-in date and time in the displayed export time zone
- Time zone
- Check-in timestamp in UTC
- Emotion

Names and active status reflect the current student record; the existing schema does not preserve the name/status at the time of each check-in. State this in the export documentation.

Exclude teacher notes and response details from the first release. They are a separate data category and are not needed for the requested check-in download.

Use a filename such as `pip-checkins_2026-09-01_to_2026-09-30.csv`, without student names. Encode as UTF-8 with an Excel-compatible BOM, escape commas/quotes/newlines, and neutralize spreadsheet formula injection in text fields.

## Data retrieval and authorization

The current dashboard calls `loadTodayCheckIns()`, while `loadStudentHistory()` limits results to seven records. Neither is suitable for exports.

1. Add a dedicated export loader in `src/lib/data.ts` with typed date bounds, classroom scope, selected student IDs, and inactive-student inclusion.
2. Resolve the authenticated teacher’s single classroom and verify selected students belong to it. Keep database row-level security as the authority; browser filters alone are insufficient.
3. Query historical check-ins joined to the permitted student records, including inactive students only when selected.
4. Page through the complete result set, using stable timestamp-plus-ID ordering and a request-start cutoff to avoid new check-ins shifting page boundaries. Never silently stop at the API’s row limit.
5. Cancel or discard work when the teacher signs out, switches account, closes the dialog, or loses classroom access. Release any generated object URL afterward.
6. If any page fails, do not offer a partial CSV as a complete export.
7. Generate the file in browser memory on demand; do not store generated CSV files on the server or in browser persistent storage.

The download is a bounded read of the data available during the request, not a transactionally consistent archival snapshot. If that stronger guarantee becomes necessary, use a server-side snapshot design.

## Export activity record

Include a small forward migration and authenticated database function for export activity if this proposed auditing scope is accepted with the plan.

- Record teacher identity from the authenticated session, classroom ID, requested dates, time zone, selected student IDs or an all-students marker, inactive-student option, row count, and timestamp.
- Validate membership and request bounds in the database function. Teachers must not be able to forge another teacher’s identity or edit/delete activity records.
- Do not copy names, feelings, notes, or CSV contents into the activity record.
- Record that a file was prepared for download; a browser cannot prove the user saved or opened it. Counts submitted by the browser are operational metadata, not independently verified evidence.
- If recording the event fails, retain the dialog and offer retry before initiating download.
- Apply an owner-approved retention policy to activity records as well as check-in data.

## Implementation sequence

1. Define export types, date validation, time-zone behavior, and CSV serialization helpers.
2. Add the classroom-scoped historical loader and complete pagination.
3. Add the activity migration/function and corresponding authorization checks.
4. Add `src/components/teacher/CheckInExportDialog.tsx` and connect its trigger to `src/pages/TeacherDashboardPage.tsx`.
5. Add meaningful automated checks and browser coverage.
6. Update the README, project completion report, and operations documentation with usage, deployment requirements, and limitations.
7. Add configured term/year presets as a follow-up once calendar dates and their configuration source are settled.

Likely new helper files: `src/lib/checkInExport.ts` and `src/lib/exportDates.ts`. No child-facing routing or kiosk changes are needed.

## Verification and acceptance criteria

- Default range is exactly 30 inclusive local dates; seven-day, custom, leap-year, midnight, and daylight-saving boundaries behave correctly.
- Invalid/future/oversized ranges are rejected before data retrieval, with matching validation for audited requests.
- CSV contains every matching check-in once, including datasets beyond the API page limit and records sharing timestamps.
- Selected students and inactive-student filters work, with no unexpected inclusion or omission.
- Teacher A cannot export Teacher B’s data; anonymous access is denied. Test tampered classroom/student IDs and activity-record ownership.
- Unicode names, commas, quotes, newlines, and formula-like values open safely in spreadsheet applications.
- Empty results, failed pages, audit failures, duplicate clicks, cancellation, and account changes do not produce misleading downloads.
- Browser checks cover dialog accessibility, selection, downloaded filename, headers, and actual CSV contents.
- Run `npm test`, dedicated export tests, and database security tests for the new migration. Verify live permissions separately using disposable accounts in an approved target environment.

## Decisions to settle before implementation

The proposed defaults above make the initial feature concrete. Review these choices when approving the plan:

- CSV only, check-in records only, with teacher notes excluded.
- Last 30 days by default, a 366-day request limit, and inactive history available by explicit selection.
- Browser time zone initially; term/year presets deferred until the school calendar is configured.
- Export activity recorded in the database, requiring a migration and an approved retention policy.

No application code, schema, or deployment changes are part of this planning task.
