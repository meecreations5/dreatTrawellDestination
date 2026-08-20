"use client";

import { getBrandingSettings, DEFAULT_BRANDING } from "@/lib/brandingSettings";

function clean(value = "") {
  return String(value ?? "").trim();
}

function escapeHtml(value = "") {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeUrl(value = "") {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const parsed = new URL(raw, window.location.origin);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch {
    return "";
  }
}

function sanitizeCustomerHtml(html = "") {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<(iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript\s*:/gi, "");
}

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "object" && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function first(...values) {
  return values.map(clean).find(Boolean) || "";
}

function getRecipient(lead = {}) {
  return {
    agency: first(
      lead.travelAgentName,
      lead.agencyName,
      lead.agentName,
      lead.travelAgent?.agencyName,
      lead.travelAgent?.name
    ),
    name: first(
      lead.spoc?.name,
      lead.spocName,
      lead.customerName,
      lead.travellerName,
      lead.guestName,
      lead.contactName
    ),
    email: first(
      lead.spoc?.email,
      lead.spocEmail,
      lead.email,
      lead.customerEmail
    ),
    mobile: first(
      lead.spoc?.mobile,
      lead.spocMobile,
      lead.mobile,
      lead.phone,
      lead.contactNumber,
      lead.customerMobile
    )
  };
}

function buildPrintHtml({ quotation, lead, branding }) {
  const recipient = getRecipient(lead);
  const signature = quotation.signatureUser || quotation.metadata?.signatureUser || {};
  const companyName = first(signature.companyName, branding.companyName, DEFAULT_BRANDING.companyName);
  const logo = safeUrl(first(signature.companyLogoUrl, branding.companyLogoUrl)) || `${window.location.origin}/logo.png`;
  const website = first(signature.websiteUrl, branding.websiteUrl);
  const supportEmail = first(signature.supportEmail, branding.supportEmail);
  const supportMobile = first(signature.supportMobile, branding.supportMobile);
  const leadCode = first(quotation.leadCode, lead.leadCode, lead.id, lead.leadId);
  const revision = quotation.revision || "";
  const createdAt = quotation.sentAt || quotation.draftSavedAt || quotation.createdAt || quotation.updatedAt;
  const title = `Quotation${leadCode ? ` - ${leadCode}` : ""}${revision ? ` - Rev ${revision}` : ""}`;
  const customerHtml = sanitizeCustomerHtml(quotation.itineraryHtml || "<p>No quotation content saved.</p>");
  const signatureHtml = sanitizeCustomerHtml(signature.signatureHtml || "");
  const closingLine = first(signature.quotationClosingLine, signature.emailFooterLine);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #172033; font-family: Arial, Helvetica, sans-serif; }
  body { font-size: 11pt; line-height: 1.5; }
  .page { width: 100%; }
  .toolbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: flex-end; gap: 8px; padding: 10px 14px; background: #0f172a; }
  .toolbar button { border: 0; border-radius: 8px; padding: 9px 14px; background: #2563eb; color: white; font-weight: 700; cursor: pointer; }
  .document { max-width: 182mm; margin: 0 auto; padding: 10mm 0 6mm; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 12px; }
  .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .brand img { width: 54px; height: 54px; object-fit: contain; }
  .brand-name { font-size: 19pt; font-weight: 800; color: #0f172a; }
  .brand-meta { margin-top: 2px; color: #64748b; font-size: 9pt; }
  .quote-title { text-align: right; }
  .quote-title h1 { margin: 0; font-size: 20pt; color: #1d4ed8; }
  .quote-title p { margin: 3px 0 0; color: #64748b; font-size: 9.5pt; }
  .recipient { margin-top: 16px; padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; }
  .section-label { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .06em; color: #64748b; font-weight: 700; }
  .recipient-main { margin-top: 4px; font-size: 12pt; font-weight: 700; }
  .recipient-sub { margin-top: 2px; color: #475569; font-size: 9.5pt; }
  .quotation-body { margin-top: 18px; font-size: 10.5pt; }
  .quotation-body h1, .quotation-body h2, .quotation-body h3, .quotation-body h4 { color: #0f172a; page-break-after: avoid; break-after: avoid-page; }
  .quotation-body table { width: 100% !important; max-width: 100% !important; border-collapse: collapse; margin: 10px 0; font-size: 9.5pt; break-inside: auto; }
  .quotation-body tr { break-inside: avoid; page-break-inside: avoid; }
  .quotation-body th, .quotation-body td { border: 1px solid #cbd5e1; padding: 7px 8px; vertical-align: top; }
  .quotation-body th { background: #f1f5f9; font-weight: 700; }
  .quotation-body img { max-width: 100% !important; height: auto !important; }
  .quotation-body ul, .quotation-body ol { padding-left: 22px; }
  .signature { margin-top: 20px; padding-top: 14px; border-top: 1px solid #e2e8f0; break-inside: avoid; }
  .signature-name { font-weight: 800; color: #0f172a; }
  .signature-meta { color: #475569; font-size: 9.5pt; }
  .footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 8.5pt; text-align: center; }
  a { color: #1d4ed8; text-decoration: none; }
  @media print {
    .toolbar { display: none !important; }
    .document { padding: 0; max-width: none; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @media (max-width: 700px) {
    .header { align-items: flex-start; flex-direction: column; }
    .quote-title { text-align: left; }
  }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Save as PDF / Print</button></div>
  <div class="page">
    <main class="document">
      <header class="header">
        <div class="brand">
          <img src="${escapeHtml(logo)}" alt="${escapeHtml(companyName)}" onerror="this.style.display='none'" />
          <div>
            <div class="brand-name">${escapeHtml(companyName)}</div>
            <div class="brand-meta">${[website, supportEmail, supportMobile].filter(Boolean).map(escapeHtml).join(" &nbsp; | &nbsp; ")}</div>
          </div>
        </div>
        <div class="quote-title">
          <h1>Quotation</h1>
          <p>${leadCode ? `Lead: ${escapeHtml(leadCode)}` : ""}${revision ? ` &nbsp; | &nbsp; Rev ${escapeHtml(revision)}` : ""}</p>
          <p>${formatDate(createdAt) ? `Prepared: ${escapeHtml(formatDate(createdAt))}` : ""}</p>
        </div>
      </header>

      ${(recipient.agency || recipient.name || recipient.email || recipient.mobile) ? `
      <section class="recipient">
        <div class="section-label">Prepared For</div>
        <div class="recipient-main">${escapeHtml(recipient.agency || recipient.name)}</div>
        <div class="recipient-sub">${[recipient.agency && recipient.name ? recipient.name : "", recipient.email, recipient.mobile].filter(Boolean).map(escapeHtml).join(" &nbsp; | &nbsp; ")}</div>
      </section>` : ""}


      <section class="quotation-body">${customerHtml}</section>

      ${(signatureHtml || signature.name || closingLine) ? `
      <section class="signature">
        ${closingLine ? `<p>${escapeHtml(closingLine)}</p>` : ""}
        ${signatureHtml || `
          <div class="signature-name">${escapeHtml(first(signature.name, quotation.createdByName, quotation.sentByName))}</div>
          <div class="signature-meta">${[signature.role, signature.email, signature.mobile].filter(Boolean).map(escapeHtml).join(" &nbsp; | &nbsp; ")}</div>
        `}
      </section>` : ""}

      <footer class="footer">This PDF contains customer-visible quotation details only. Internal vendor cost, GP and margin are excluded.</footer>
    </main>
  </div>
</body>
</html>`;
}

export async function generateQuotationPdf({ quotation = {}, lead = {} } = {}) {
  if (typeof window === "undefined") return { ok: false, reason: "browser_required" };

  const popup = window.open("", "_blank", "width=1000,height=900,scrollbars=yes");
  if (!popup) return { ok: false, reason: "popup_blocked" };

  popup.document.open();
  popup.document.write("<!doctype html><title>Preparing quotation PDF...</title><body style='font-family:Arial;padding:24px'>Preparing quotation PDF...</body>");
  popup.document.close();

  let branding = DEFAULT_BRANDING;
  try {
    branding = await getBrandingSettings();
  } catch (error) {
    console.warn("Quotation PDF branding load skipped:", error);
  }

  const html = buildPrintHtml({ quotation, lead, branding });
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();

  const triggerPrint = () => {
    try {
      popup.focus();
      popup.print();
    } catch (error) {
      console.warn("Quotation PDF print dialog could not open automatically:", error);
    }
  };

  if (popup.document.readyState === "complete") {
    window.setTimeout(triggerPrint, 450);
  } else {
    popup.addEventListener("load", () => window.setTimeout(triggerPrint, 450), { once: true });
  }

  return { ok: true };
}
