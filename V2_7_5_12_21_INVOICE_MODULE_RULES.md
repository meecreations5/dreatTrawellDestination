# Invoice Module v2.7.5.12.21 - Firestore and Storage rules ADDENDUM

This is **not a replacement** for your current Firestore / Storage security rules. Carefully merge it into your existing `service cloud.firestore { match /databases/{database}/documents { ... } }` / Storage `match /b/{bucket}/o` blocks. Test in the Firebase Emulator before deploying. Existing broad `allow` clauses can override restrictions below.

## Firestore rule helper functions

```javascript
function invoiceSignedIn() { return request.auth != null; }
function invoiceUser() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid));
}
function invoiceRole() {
  return invoiceSignedIn() &&
    invoiceUser().data.get('active', false) == true &&
    invoiceUser().data.get('role', '') in ['admin', 'super_admin', 'finance', 'manager', 'operation_executive'];
}
function invoiceFinance() {
  return invoiceSignedIn() &&
    invoiceUser().data.get('active', false) == true &&
    invoiceUser().data.get('role', '') in ['admin', 'super_admin', 'finance'];
}
function invoiceManager() {
  return invoiceSignedIn() &&
    invoiceUser().data.get('active', false) == true &&
    invoiceUser().data.get('role', '') in ['admin', 'super_admin', 'finance', 'manager'];
}
```

The app currently resolves some canonical roles from `users/{uid}` via email. If your user records do not use Firebase UID document IDs, adapt these helpers to your authoritative user claims and verify access before deployment. Never grant anonymous access to invoices.

## Add the following document matches

```javascript
match /travelAgentInvoices/{invoiceId} {
  allow read: if invoiceRole();
  allow create: if invoiceFinance() &&
    request.resource.data.type == 'outgoing' &&
    request.resource.data.status == 'draft';
  allow update: if invoiceFinance() && (
    (resource.data.status == 'draft' &&
      request.resource.data.status in ['draft', 'issued']) ||
    (resource.data.status == 'issued' &&
      request.resource.data.status == 'issued' &&
      request.resource.data.diff(resource.data).affectedKeys().hasOnly([
        'pdfUrl', 'pdfStoragePath', 'pdfGeneratedAt',
        'lastEmailAcceptedAt', 'lastEmailTo', 'lastEmailMessageId', 'lastEmailBy',
        'allocatedTotal', 'allocationUpdatedAt'
      ])) ||
    (resource.data.status == 'issued' &&
      request.resource.data.status == 'void' &&
      request.resource.data.diff(resource.data).affectedKeys().hasOnly([
        'status', 'voidReason', 'voidedAt', 'voidedBy'
      ]))
  );
  allow delete: if false;
}
match /vendorInvoices/{invoiceId} {
  allow read: if invoiceManager();
  allow create: if invoiceFinance() &&
    request.resource.data.type == 'incoming' &&
    request.resource.data.status == 'received';
  allow update: if invoiceFinance() &&
    request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'status', 'reviewReason', 'reviewedAt', 'reviewedBy',
      'updatedAt', 'allocatedTotal', 'allocationUpdatedAt'
    ]);
  allow delete: if false;
}
match /invoiceSequences/{financialYear} {
  allow read: if invoiceFinance();
  allow create: if invoiceFinance() && request.resource.data.lastNumber == 1;
  allow update: if invoiceFinance() &&
    request.resource.data.lastNumber == resource.data.lastNumber + 1;
  allow delete: if false;
}
match /settings/invoicing {
  allow read: if invoiceRole();
  allow write: if invoiceFinance();
}
```

### Existing payment subcollection rule adaptation

Allow only finance roles to append allocation metadata (do **not** replace your existing customer/vendor payment rules for normal payment posting):

```javascript
match /leads/{leadId}/customerPayments/{paymentId} {
  allow update: if invoiceFinance() &&
    request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'invoiceId', 'invoiceNumber', 'allocatedAt', 'allocatedBy'
    ]) && (
      // Initial allocation: finance sets a previously empty invoice link.
      (resource.data.get('invoiceId', '') == '' &&
        request.resource.data.get('invoiceId', '') != '') ||
      // Finance may unlink an allocated payment by deleting the four metadata keys.
      (resource.data.get('invoiceId', '') != '' &&
        !request.resource.data.keys().hasAny([
          'invoiceId', 'invoiceNumber', 'allocatedAt', 'allocatedBy'
        ]))
    );
}
match /leads/{leadId}/vendorPayments/{paymentId} {
  allow update: if invoiceFinance() &&
    request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'invoiceId', 'invoiceNumber', 'allocatedAt', 'allocatedBy'
    ]) && (
      // Initial allocation: finance sets a previously empty invoice link.
      (resource.data.get('invoiceId', '') == '' &&
        request.resource.data.get('invoiceId', '') != '') ||
      // Finance may unlink an allocated payment by deleting the four metadata keys.
      (resource.data.get('invoiceId', '') != '' &&
        !request.resource.data.keys().hasAny([
          'invoiceId', 'invoiceNumber', 'allocatedAt', 'allocatedBy'
        ]))
    );
}
```

The core invoice code also updates `allocatedTotal` in the same transaction and rejects over-allocation. No new receipts or bank payments are created.

## Firebase Storage rules addendum

Within `service firebase.storage { match /b/{bucket}/o { ... } }`:

```javascript
match /invoices/{kind}/{leadId}/{partnerId}/{fileName} {
  allow read, write: if request.auth != null &&
    firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.role in
      ['admin', 'super_admin', 'finance'];
}
```

This code uses Firebase Storage `getDownloadURL` for invoice attachments. These URLs contain access tokens and may be opened by anyone with the exact URL. Share outgoing PDFs only with the intended travel agent; do not expose received vendor invoice links in public pages. For stronger controls later, use authenticated short-lived signed downloads.

## Mandatory deployment checks
- Confirm your active Firestore security rules allow the `finance` role to read `leads`, `vendors`, and `travelAgents` master records. Existing rules may currently limit those to Admin only.
- Confirm user role document keys and active fields before copying the above helpers.
- Firestore transaction writing `/invoiceSequences/{fy}` and `/travelAgentInvoices/{id}` must pass together.
- Test Finance, Admin, Operations, and Engagement role access separately in Emulator.
- Confirm Storage rules permit Finance user uploads and the project Storage bucket is correct.
- The addendum does not configure or certify GST e-invoicing (IRN/QR), signatures, tax classification or statutory filings.
