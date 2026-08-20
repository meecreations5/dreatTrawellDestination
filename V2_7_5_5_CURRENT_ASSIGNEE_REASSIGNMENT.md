# V2.7.5.5 - Current Assignee Lead Reassignment

## Change

The Team/User Lead assignment rule is now:

- Permanent Lead Owner/creator may assign or reassign the Lead.
- Current Assignee may also reassign the Lead to another team member, even when the Lead belongs to a different owner.
- Unrelated Team users cannot reassign arbitrary Leads.
- Manager/Admin/Super Admin keep their broader role-based assignment access.
- Reassignment never changes the permanent Lead Owner.

This change is record-based and does not grant normal Team/User roles broad `leads.assign` permission for unrelated Leads or Lead creation.
