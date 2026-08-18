# DreamTrawell CRM - Agent Acquisition & Engagement Rethink V2.3

## Why the old table was confusing

The previous Team Member Agent Engagement table mixed two different credits:

- **New Agents** = travel-agent records created by that team member.
- **New Agent Calls** = every call made by that team member to any agent created in the selected period, including agents created by other team members and repeated calls to the same agent.

Because of that, a row could show 4 New Agents and 838 New Agent Calls. Those numbers were answering different questions and repeated calls could inflate the second number.

## New reporting model

### 1. New Agent Acquisition
Acquisition credit follows the creator of the travel-agent master record.

Metrics:
- New Agents
- Called
- Pending First Call
- Contact Rate
- Invalid Number
- Business Shut Down

`Called` means that the new agent received at least one call in the selected period. It does not matter who made the call; this is acquisition coverage for the creator's records.

### 2. Team Calling & Engagement
Activity credit follows the team member who logged the engagement.

Metrics:
- First Calls
- Other / Follow-up Calls
- Total Calls
- Unique Agents Called
- WhatsApp
- Meetings
- Total Touches
- Last Activity

A **First Call** is counted only once per new travel agent and is credited to the person who made the earliest call to that new agent. Repeated calls never increase First Calls.

## Identity cleanup

The Travel Agent dashboard now loads the Users master and resolves creator/activity UIDs to real team-member names and emails.

If an old record has no resolvable user, it is grouped under **Legacy / Unmapped**. Raw Firebase UIDs are no longer displayed as team-member names, and unmapped legacy data should not be used for individual performance scoring.

## Team dashboard

The personal Team Dashboard metric is now **New Agents Called** and counts unique newly-added agents rather than repeated call records.

## Backward compatibility

- No legacy travel-agent or engagement record is rewritten.
- Existing Firestore collections remain unchanged.
- Login pages remain unchanged.
- The new reporting is calculated from existing data at read time.
