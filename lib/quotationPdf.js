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

export function buildQuotationPdfHtml({ quotation, lead, branding }) {
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
    .document { padding: 0 !important; max-width: none !important; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @media (max-width: 700px) {
    .header { align-items: flex-start; flex-direction: column; }
    .quote-title { text-align: left; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#ffffff;color:#172033;font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.5;">
  <div class="toolbar" style="position:sticky;top:0;z-index:10;display:flex;justify-content:flex-end;gap:8px;padding:10px 14px;background:#0f172a;"><button style="border:0;border-radius:8px;padding:9px 14px;background:#2563eb;color:#ffffff;font-weight:700;cursor:pointer;" onclick="window.print()">Save as PDF / Print</button></div>
  <div class="page" style="width:100%;background:#ffffff;">
    <main class="document" style="width:100%;max-width:182mm;margin:0 auto;padding:10mm 0 6mm;background:#ffffff;">
      <header class="header" style="display:flex;align-items:center;justify-content:space-between;gap:18px;border-bottom:2px solid #2563eb;padding:0 0 12px 0;background:#ffffff;break-inside:avoid;page-break-inside:avoid;">
        <div class="brand" style="display:flex;align-items:center;gap:12px;min-width:0;flex:1 1 auto;">
          <img src="${escapeHtml(logo)}" alt="${escapeHtml(companyName)}" style="display:block;width:54px;height:54px;min-width:54px;max-width:54px;object-fit:contain;" onerror="this.onerror=null;this.src='${escapeHtml(`${window.location.origin}/logo.png`)}'" />
          <div style="min-width:0;">
            <div class="brand-name" style="font-size:19pt;line-height:1.15;font-weight:800;color:#0f172a;">${escapeHtml(companyName)}</div>
            <div class="brand-meta" style="margin-top:4px;color:#64748b;font-size:9pt;line-height:1.4;overflow-wrap:anywhere;">${[website, supportEmail, supportMobile].filter(Boolean).map(escapeHtml).join(" &nbsp; | &nbsp; ")}</div>
          </div>
        </div>
        <div class="quote-title" style="flex:0 0 auto;text-align:right;min-width:150px;">
          <h1 style="margin:0;font-size:20pt;line-height:1.15;color:#1d4ed8;font-weight:800;">Quotation</h1>
          <p style="margin:4px 0 0;color:#64748b;font-size:9.5pt;line-height:1.4;">${leadCode ? `Lead: ${escapeHtml(leadCode)}` : ""}${revision ? ` &nbsp; | &nbsp; Rev ${escapeHtml(revision)}` : ""}</p>
          <p style="margin:3px 0 0;color:#64748b;font-size:9.5pt;line-height:1.4;">${formatDate(createdAt) ? `Prepared: ${escapeHtml(formatDate(createdAt))}` : ""}</p>
        </div>
      </header>

      ${(recipient.agency || recipient.name || recipient.email || recipient.mobile) ? `
      <section class="recipient" style="margin-top:14px;padding:11px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;break-inside:avoid;page-break-inside:avoid;">
        <div class="section-label" style="font-size:8.5pt;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-weight:700;">Prepared For</div>
        <div class="recipient-main" style="margin-top:4px;font-size:12pt;line-height:1.35;font-weight:700;color:#172033;">${escapeHtml(recipient.agency || recipient.name)}</div>
        <div class="recipient-sub" style="margin-top:3px;color:#475569;font-size:9.5pt;line-height:1.45;overflow-wrap:anywhere;">${[recipient.agency && recipient.name ? recipient.name : "", recipient.email, recipient.mobile].filter(Boolean).map(escapeHtml).join(" &nbsp; | &nbsp; ")}</div>
      </section>` : ""}


      <section class="quotation-body" style="margin-top:18px;font-size:10.5pt;line-height:1.5;">${customerHtml}</section>

      ${(signatureHtml || signature.name || closingLine) ? `
      <section class="signature" style="margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;break-inside:avoid;page-break-inside:avoid;">
        ${closingLine ? `<p style="margin:0 0 10px;color:#334155;">${escapeHtml(closingLine)}</p>` : ""}
        ${signatureHtml || `
          <div class="signature-name" style="font-weight:800;color:#0f172a;">${escapeHtml(first(signature.name, quotation.createdByName, quotation.sentByName))}</div>
          <div class="signature-meta" style="margin-top:3px;color:#475569;font-size:9.5pt;line-height:1.45;">${[signature.role, signature.email, signature.mobile].filter(Boolean).map(escapeHtml).join(" &nbsp; | &nbsp; ")}</div>
        `}
      </section>` : ""}

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

  const html = buildQuotationPdfHtml({ quotation, lead, branding });
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


function getPdfFileName({ quotation = {}, lead = {} } = {}) {
  const leadCode = first(quotation.leadCode, lead.leadCode, lead.id, lead.leadId, "quotation");
  const revision = clean(quotation.revision);
  const safe = `${leadCode}${revision ? `-Rev-${revision}` : ""}`
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `DreamTrawell-Quotation-${safe || "quotation"}.pdf`;
}

/**
 * Generates an actual PDF Blob in the browser from the same customer-visible
 * quotation layout used by Generate PDF. The blob can then be uploaded and
 * shared through Email / WhatsApp.
 */
export async function generateQuotationPdfBlob({ quotation = {}, lead = {} } = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { ok: false, reason: "browser_required", blob: null, fileName: "" };
  }

  let branding = DEFAULT_BRANDING;
  try {
    branding = await getBrandingSettings();
  } catch (error) {
    console.warn("Quotation PDF branding load skipped:", error);
  }

  let html2pdf;
  try {
    const module = await import("html2pdf.js");
    html2pdf = module?.default || module;
  } catch (error) {
    console.error("Quotation PDF library could not be loaded:", error);
    return { ok: false, reason: "pdf_library_missing", blob: null, fileName: "" };
  }

  const fileName = getPdfFileName({ quotation, lead });
  const fullHtml = buildQuotationPdfHtml({ quotation, lead, branding });
  let renderFrame = null;

  try {
    // Render the quotation in an isolated same-origin frame at normal page
    // coordinates. The previous implementation positioned the source element
    // thousands of pixels off-screen, which can cause html2canvas to create a
    // valid-but-blank PDF in Chromium/Turbopack environments.
    renderFrame = document.createElement("iframe");
    renderFrame.setAttribute("aria-hidden", "true");
    renderFrame.setAttribute("tabindex", "-1");
    renderFrame.style.position = "fixed";
    renderFrame.style.left = "0";
    renderFrame.style.top = "0";
    renderFrame.style.width = "794px";
    renderFrame.style.height = "1123px";
    renderFrame.style.border = "0";
    renderFrame.style.pointerEvents = "none";
    renderFrame.style.zIndex = "-2147483647";
    renderFrame.style.background = "#ffffff";
    document.body.appendChild(renderFrame);

    const frameDocument = renderFrame.contentDocument;
    if (!frameDocument) {
      return { ok: false, reason: "pdf_render_frame_unavailable", blob: null, fileName };
    }

    frameDocument.open();
    frameDocument.write(fullHtml);
    frameDocument.close();

    await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));

    const documentNode = frameDocument.querySelector(".document");
    if (!documentNode) {
      return { ok: false, reason: "pdf_layout_missing", blob: null, fileName };
    }

    const toolbar = frameDocument.querySelector(".toolbar");
    if (toolbar) toolbar.style.display = "none";

    // Give remote/hosted images a short moment to resolve before html2canvas.
    await Promise.all(
      Array.from(documentNode.querySelectorAll("img")).map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(resolve => {
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          window.setTimeout(done, 2500);
        });
      })
    );

    if (frameDocument.fonts?.ready) {
      try {
        await Promise.race([
          frameDocument.fonts.ready,
          new Promise(resolve => window.setTimeout(resolve, 1500))
        ]);
      } catch {
        // Font readiness is best-effort only; system fonts still render.
      }
    }

    const contentHeight = Math.max(
      1123,
      Math.ceil(documentNode.scrollHeight || documentNode.getBoundingClientRect().height || 0) + 40
    );
    renderFrame.style.height = `${contentHeight}px`;

    const contentWidth = Math.max(
      794,
      Math.ceil(documentNode.scrollWidth || documentNode.getBoundingClientRect().width || 0) + 20
    );

    const worker = html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: fileName,
        image: { type: "jpeg", quality: 0.96 },
        html2canvas: {
          scale: 1.5,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          windowWidth: contentWidth,
          windowHeight: contentHeight
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
      })
      .from(documentNode);

    const blob = await worker.outputPdf("blob");
    if (!blob || !blob.size) {
      return { ok: false, reason: "empty_pdf", blob: null, fileName };
    }

    // A completely blank A4 PDF generated by jsPDF/html2canvas is normally
    // only a few KB. Treat suspiciously small output as a generation failure
    // instead of uploading a link that opens to a blank document.
    if (blob.size < 8000) {
      return {
        ok: false,
        reason: "blank_pdf_detected",
        error: "Quotation PDF rendered without visible content. Please retry.",
        blob: null,
        fileName
      };
    }

    return { ok: true, blob, fileName };
  } catch (error) {
    console.error("Quotation PDF blob generation failed:", error);
    return {
      ok: false,
      reason: "pdf_generation_failed",
      error: String(error?.message || error || "PDF generation failed"),
      blob: null,
      fileName
    };
  } finally {
    renderFrame?.remove();
  }
}
