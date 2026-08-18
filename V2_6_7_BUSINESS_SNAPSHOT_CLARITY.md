# V2.6.7 Business Snapshot & Team Activity Clarity

This update refines the Admin Engagement dashboard reporting shown in the supplied screenshots.

## Business Snapshot
The primary business flow now uses consistent terminology:

- New Agents Added
- New Agents Contacted
- Existing Agents Contacted
- Total Unique Contacted
- Leads Generated
- Quotes Sent
- Meetings
- Converted

The old ambiguous labels such as `Existing Follow-ups`, `Queries Received`, and `Quotes Shared` were removed from this snapshot.

## Activity & Invalid Outcomes
A separate activity row keeps repeat activity volume separate from unique business outcomes:

- Calls Made
- WhatsApp
- Completed Tasks
- Invalid Number
- Business Shut Down
- Wrong Details

Invalid outcome metrics are deduplicated by Travel Agent within the selected engagement scope.

## Team Agent Activity
The team table is performer-based and now shows:

- New Contacted
- Existing Contacted
- Unique Contacted
- Calls
- Meetings
- Invalid No.
- Business Shut

Company-wide unique contacted agents are deduplicated across all team members, while each team-member row independently counts the unique agents that person actually contacted.

## Connection Logic Correction
Operational outcomes such as Invalid Number, Business Shut Down, Wrong Details, Do Not Contact, Blacklisted, No Answer and Not Reachable are no longer treated as successful connections.

New-agent matching now uses the Travel Agent master document ID when available, improving matching between engagement `travelAgentId` and the Travel Agent master record.

## Current Invalid Status Visibility
The Agent Data Quality section also shows current Travel Agent master status counts for:

- Invalid Number (Current)
- Business Shut (Current)

This deliberately separates current master status from period activity outcomes.

## Compatibility
- No Firestore migration is required.
- No login/authentication files were changed.
- No meeting, quotation, lead ownership or notification logic was changed.
