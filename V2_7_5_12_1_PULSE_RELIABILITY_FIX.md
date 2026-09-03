# V2.7.5.12.1 - Productivity Pulse Reliability Fix

## Issue
The 15-minute productivity pulse could appear to be missing when the current user was Admin/Super Admin, when the current time fell inside a configured break, when Firestore settings could not be read, or when engagement metrics were slow to load. Browser tab sleep could also delay the next check.

## Changes
- Pulse modal now opens immediately when a slot is due; metrics load after the modal is visible.
- Settings listener falls back to DreamTrawell defaults if the productivity settings document cannot be read.
- Scheduler re-checks every 15 seconds and immediately on browser focus, pageshow and visibility restore.
- Added a small team status indicator showing the next productivity pulse time (and break-paused status).
- Added Admin Settings > Engagement & Productivity > **Test Pulse Now**. This preview works for Admin even though Admin/Super Admin remain excluded from live team pulses by default.
- Added explicit warning in the pulse if metrics/settings are blocked by Firestore permissions instead of failing silently.
- Added `getNextPulseSlot()` helper for reliable next-slot display.

## Schedule reminder
Default DreamTrawell schedule remains:
- Work start: 10:30 AM
- Lunch: 2:00 PM - 3:00 PM
- Evening break: 5:30 PM - 6:15 PM
- 15-minute interval by default

With the default schedule, no live pulse appears during 5:30 PM - 6:15 PM. The first normal pulse after that break is 6:30 PM.

No quotation, payment, lead ownership, role persistence, Travel Agent SPOC sync, or other CRM business logic was changed in this patch.
