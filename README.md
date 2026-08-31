This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## V2.7.5.11
Quotation email now follows the Lead email visual template. Quotation sending generates a shareable customer PDF and places the same PDF link in Email and WhatsApp. Email + WhatsApp default ON when both contact details are available. Requires the `uploadQuotationPdf` Firebase Function and the new `html2pdf.js` frontend dependency.

## V2.7.5.11.1
Restores the earlier quotation emailer layout and full Branding Settings signature, keeps quotation PDF links in Email/WhatsApp, and removes Microsoft Word/Outlook clipboard metadata such as `Normal 0 false false false EN-IN X-NONE X-NONE` from Client Reference, Activity Log and WhatsApp notifications.


## V2.7.5.11.2
Quotation PDF Storage bucket resolution fix for generic `internal` failures. See `V2_7_5_11_2_QUOTATION_PDF_STORAGE_FIX.md`.
