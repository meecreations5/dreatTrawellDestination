# V2.7.5.12.4 - Role Module Access Alignment

## Role access

### Engagement / Relationship Executive (`employee`)
- Travel Agents
- Engagements
- Meetings
- Destinations

The Engagement role does not have the Leads workspace, Lead detail, quotation operations or Lead payment operations. It retains `leads.create` only so a qualified requirement can be converted into a Lead from an Engagement or completed Meeting and handed over to Lead & Operations.

### Lead & Operations Executive (`operation_executive`)
- Travel Agents
- Engagements
- Meetings
- Leads
- Destinations

Existing compatibility users stored as `role: employee` plus `accessRole: operation_executive` are resolved as Lead & Operations Executives for both Admin module access and action permissions.

## Handover behaviour
- Engagement-created Leads must be assigned to a Lead & Operations Executive, Manager or Admin.
- Engagement users no longer default new Leads to themselves.
- After creation, Engagement users see a successful handover message instead of being redirected into a Lead page they cannot access.
- Existing Engagement cards show `Lead Handed Over` instead of a `View Lead` action for Engagement users.

## Destination safety
- Engagement Executive: Destination view access.
- Lead & Operations Executive: Destination view/edit access.
- Destination create/delete remain Admin/Super Admin controlled.
- The Admin sidebar no longer shows `Add Destination` unless `destinations.create` is allowed.

## Compatibility
No Firestore migration or new collection is required. Existing Engagement, Meetings, Leads, quotations, payments, Travel Agent/SPOC sync, Action Center and Productivity Pulse data remain intact.
