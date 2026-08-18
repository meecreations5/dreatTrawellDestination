# Dream Trawell CRM V2.7.1 - Payment Receipt Upload Fix

## Problem
Vendor Payment proof uploads and Travel Agent / Customer Payment receipt uploads both used direct browser Firebase Storage writes under these paths:

- `lead-payments/vendor-proofs/{leadId}/...`
- `lead-payments/customer-receipts/{leadId}/...`

If the deployed Firebase Storage rules do not allow those newer paths, Firebase returns a permission/upload error and the payment cannot be saved with its document.

## Fix
A shared payment upload service was added at `lib/paymentFileUpload.js`.

Upload flow is now:

1. Validate the file (image/PDF, maximum 10 MB).
2. Try the existing direct Firebase Storage upload first for speed.
3. If direct Storage fails, automatically call the authenticated Firebase Function `uploadLeadPaymentReceipt`.
4. The function validates the signed-in CRM user and uploads through Firebase Admin Storage.
5. The permanent Firebase download URL and Storage path are returned to the payment form.
6. Payment is saved with both URL and storage path.

This avoids loosening global Firebase Storage rules just to support payment receipts.

## Affected payment flows
- Vendor Payment -> Payment Proof
- Travel Agent / Customer Payment -> Receipt

## Security
- User must be Firebase authenticated.
- User must resolve to a CRM `users` record.
- Explicitly inactive users are rejected.
- Only images and PDF files are accepted.
- Maximum file size is 10 MB.
- File name and Storage path are sanitized.

## Deployment requirement
The new callable function must be deployed once:

```bash
firebase deploy --only functions:uploadLeadPaymentReceipt
```

If you deploy all functions instead:

```bash
firebase deploy --only functions
```

After deployment, restart the Next.js application. No Firestore migration is required.

## Better error handling
The UI now distinguishes common cases such as:
- upload service not deployed
- authentication / permission denied
- unsupported file type
- file larger than 10 MB

## Validation performed
- `functions/index.js`: Node syntax check passed.
- Shared client upload helper: syntax check passed.
- 343 JS/JSX application files parsed with 0 syntax errors.
