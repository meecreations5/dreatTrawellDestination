# V2.7.5.2 - Team Lead Detail Access Fix

## Problem
A lead could appear in the Team/User Leads list but open with **Access Restricted** on the Lead Detail page.

## Root cause
The Team Leads list includes leads that the current user created, is assigned to, or assigned to another teammate. The shared record-access helper did not recognize all of the same legacy identity fields and did not recognize the "assigned by me" relationship for `leads.view`.

## Fix
- Added legacy lead owner field `createdByUserId` to record ownership matching.
- Added additional assignee compatibility fields: `assignedUserEmail`, `accountManagerUid`, `teamMemberUid`, and `teamMemberEmail`.
- For **view only**, a lead assigned by the current user is now considered viewable using current and legacy `assignedBy*` fields.
- This extra relationship is limited to `leads.view`; it does not grant edit, close, reopen, quotation, payment, or other mutation permissions.
- Admin access rules and Login pages are unchanged.

## Result
If a lead is legitimately visible in the Team/User Lead list because the user created it, is assigned to it, or assigned it to another team member, the Team/User Lead Detail page can open it instead of showing an inconsistent Access Restricted screen.
