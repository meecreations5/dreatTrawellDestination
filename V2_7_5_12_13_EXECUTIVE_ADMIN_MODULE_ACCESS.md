# V2.7.5.12.13 - Executive Admin Module Access

## Purpose
Restore the explicitly approved Admin workspace modules for the two executive workstreams while keeping the full operational User Front available to all team users.

## Admin module access

### Engagement / Relationship Executive
- Travel Agents
- Engagements
- Meetings
- Vendors
- Destinations
- Communication Templates
- Documents

### Lead & Operations Executive
- Travel Agents
- Meetings
- Leads
- Vendors
- Destinations
- Communication Templates
- Documents

## Protected Admin areas
The two executive roles do not receive Admin Dashboard / Action Center, Team Management, Role Management, Settings, or Quotation Template administration.

## Safe submenu behavior
- Vendor master can be viewed, but Add Vendor is only shown when `vendors.create` is allowed.
- Communication Templates can be viewed/used; Template Category management is a separate Admin-only module and remains hidden/blocked for the executive roles.
- Documents are readable; upload/edit/delete remain controlled by existing document action permissions.
- Destination creation remains controlled by `destinations.create`.

## User Front
No change. All active team users retain the complete User Front introduced in V2.7.5.12.10.
