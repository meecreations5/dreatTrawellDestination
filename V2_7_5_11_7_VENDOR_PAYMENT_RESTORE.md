# V2.7.5.11.7 - Vendor Payment Restore

## Fix
The Vendor Payment section in the Team Lead > Payments tab was still present in code but hidden for normal Team/User roles because `payments.view_vendor_cost` was not included in the simplified role defaults.

## Restored behaviour
For leads the logged-in user owns or is currently assigned to:
- Vendor Cost is visible in the Payment tab.
- Add Vendor Paid / Add Vendor Payment is visible.
- Vendor Payment Sent summary is visible.
- Vendor payment ledger/history is visible.
- Vendor payment modal remains protected by the existing `payments.create` record access check.

Revenue / GP visibility remains restricted to Manager, Finance, Admin and Super Admin according to the existing role model.

No quotation, email, PDF, WhatsApp, login or Firebase Function code was changed.
