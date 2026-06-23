// lib/quotationEmailBlocks.js

import { EMAIL_BRAND } from "./emailTemplates";
import { escapeHtml, getFirstValue } from "./signatureUtils";

import {
  QUOTATION_AUTO_SECTION_KEYS,
  QUOTATION_SECTION_LABELS,
  getDefaultSelectedAutoSections,
  buildDestinationTemplateSnapshot
} from "./quotationTemplateService";

/* =========================
   BASIC HELPERS
========================= */

function cleanString(value = "") {
  return String(value || "").trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeAdminHtml(html = "") {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function formatDisplayDate(value = "") {
  const clean = cleanString(value);

  if (!clean) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [year, month, day] = clean.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  return clean;
}

function formatDisplayMonth(value = "") {
  const clean = cleanString(value);

  if (!clean) return "";

  if (/^\d{4}-\d{2}$/.test(clean)) {
    const [year, month] = clean.split("-").map(Number);
    const date = new Date(year, month - 1, 1);

    return date.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric"
    });
  }

  return clean;
}

function formatMoneyText({
  currency = "USD",
  amount = "",
  unit = "",
  basis = ""
}) {
  const cleanAmount = cleanString(amount);
  const cleanCurrency = cleanString(currency) || "USD";

  if (!cleanAmount) return "—";

  return [cleanCurrency, cleanAmount, unit, basis]
    .map(cleanString)
    .filter(Boolean)
    .join(" ");
}

function getLeadTravelDetails(lead = {}, quotationData = {}) {
  const travelDetails = quotationData?.travelDetails || {};

  return {
    leadCode: getFirstValue(
      quotationData?.leadCode,
      lead?.leadCode
    ),

    destinationName: getFirstValue(
      travelDetails?.destinationName,
      quotationData?.destinationName,
      lead?.destinationName,
      lead?.destination,
      lead?.destinationTitle,
      "Selected Destination"
    ),

    checkIn: getFirstValue(
      travelDetails?.checkIn,
      lead?.checkIn,
      lead?.checkInDate,
      lead?.travelStartDate,
      lead?.startDate
    ),

    checkOut: getFirstValue(
      travelDetails?.checkOut,
      lead?.checkOut,
      lead?.checkOutDate,
      lead?.travelEndDate,
      lead?.endDate
    ),

    travelMonth: getFirstValue(
      travelDetails?.travelMonth,
      lead?.travelMonth,
      lead?.month
    ),

    paxText: getFirstValue(
      travelDetails?.paxText,
      travelDetails?.noOfPax,
      lead?.paxText,
      lead?.noOfPax,
      lead?.pax,
      lead?.totalPax
    )
  };
}

/* =========================
   EMAIL UI BLOCKS
========================= */

function buildSectionHeader(title = "", tone = "orange") {
  const bg = tone === "blue" ? EMAIL_BRAND.blue : "#f4b183";
  const color = tone === "blue" ? "#ffffff" : "#111827";

  return `
    <tr>
      <td style="background:${bg};padding:11px 14px;text-align:center;color:${color};font-size:14px;font-weight:900;">
        ${escapeHtml(title)}
      </td>
    </tr>
  `;
}

function buildCardTable(innerHtml = "", margin = "0 0 16px") {
  if (!innerHtml) return "";

  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;margin:${margin};">
      ${innerHtml}
    </table>
  `;
}

/* =========================
   CUSTOMER DETAILS
========================= */

function buildCustomerDetailsHtml({ lead, quotationData }) {
  const details = getLeadTravelDetails(lead, quotationData);

  const checkInText =
    formatDisplayDate(details.checkIn) ||
    formatDisplayMonth(details.travelMonth) ||
    "—";

  const checkOutText =
    formatDisplayDate(details.checkOut) ||
    formatDisplayMonth(details.travelMonth) ||
    "—";

  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;margin:0 0 16px;">
      <tr>
        <td colspan="4" style="background:#f4b183;padding:11px 14px;text-align:center;color:#111827;font-size:14px;font-weight:900;">
          Customer Details
        </td>
      </tr>

      <tr>
        <td style="width:25%;padding:12px;border-right:1px solid ${EMAIL_BRAND.border};border-bottom:1px solid ${EMAIL_BRAND.border};background:#ffffff;text-align:center;vertical-align:top;">
          <p style="margin:0;color:#64748b;font-size:11px;line-height:1.4;font-weight:700;">Destination</p>
          <p style="margin:5px 0 0;color:#111827;font-size:13px;line-height:1.5;font-weight:800;">
            ${escapeHtml(details.destinationName)}
          </p>
        </td>

        <td style="width:25%;padding:12px;border-right:1px solid ${EMAIL_BRAND.border};border-bottom:1px solid ${EMAIL_BRAND.border};background:#ffffff;text-align:center;vertical-align:top;">
          <p style="margin:0;color:#64748b;font-size:11px;line-height:1.4;font-weight:700;">Check-in</p>
          <p style="margin:5px 0 0;color:#111827;font-size:13px;line-height:1.5;font-weight:800;">
            ${escapeHtml(checkInText)}
          </p>
        </td>

        <td style="width:25%;padding:12px;border-right:1px solid ${EMAIL_BRAND.border};border-bottom:1px solid ${EMAIL_BRAND.border};background:#ffffff;text-align:center;vertical-align:top;">
          <p style="margin:0;color:#64748b;font-size:11px;line-height:1.4;font-weight:700;">Check-out</p>
          <p style="margin:5px 0 0;color:#111827;font-size:13px;line-height:1.5;font-weight:800;">
            ${escapeHtml(checkOutText)}
          </p>
        </td>

        <td style="width:25%;padding:12px;border-bottom:1px solid ${EMAIL_BRAND.border};background:#ffffff;text-align:center;vertical-align:top;">
          <p style="margin:0;color:#64748b;font-size:11px;line-height:1.4;font-weight:700;">No. of Pax</p>
          <p style="margin:5px 0 0;color:#111827;font-size:13px;line-height:1.5;font-weight:800;">
            ${escapeHtml(details.paxText || "—")}
          </p>
        </td>
      </tr>
    </table>
  `;
}

/* =========================
   PACKAGE DETAILS
========================= */

function buildPackageDetailsHtml(packageDetails = {}) {
  const currency = cleanString(packageDetails?.currency) || "USD";
  const hotelPart = packageDetails?.hotelPart || {};
  const landPart = packageDetails?.landPart || {};

  const showHotel = Boolean(hotelPart?.enabled);
  const showLand = Boolean(landPart?.enabled);

  if (!showHotel && !showLand) return "";

  const cells = [];

  if (showHotel) {
    cells.push(`
      <td style="width:50%;background:#ffffff;border:1px solid ${EMAIL_BRAND.border};border-radius:0 0 0 14px;padding:18px;text-align:center;vertical-align:middle;">
        <p style="margin:0;color:#64748b;font-size:12px;font-weight:800;line-height:1.4;">Hotel Part</p>
        <p style="margin:8px 0 0;color:#111827;font-size:16px;font-weight:900;line-height:1.45;">
          ${escapeHtml(formatMoneyText({
            currency,
            amount: hotelPart?.amount,
            unit: hotelPart?.unit,
            basis: hotelPart?.basis
          }))}
        </p>
      </td>
    `);
  }

  if (showHotel && showLand) {
    cells.push(`
      <td style="width:12px;background:#ffffff;border-top:1px solid ${EMAIL_BRAND.border};border-bottom:1px solid ${EMAIL_BRAND.border};"></td>
    `);
  }

  if (showLand) {
    cells.push(`
      <td style="width:50%;background:#ffffff;border:1px solid ${EMAIL_BRAND.border};border-left:4px solid ${EMAIL_BRAND.red};border-radius:0 0 14px 0;padding:18px;text-align:center;vertical-align:middle;">
        <p style="margin:0;color:#64748b;font-size:12px;font-weight:800;line-height:1.4;">Land Part</p>
        <p style="margin:8px 0 0;color:#111827;font-size:16px;font-weight:900;line-height:1.45;">
          ${escapeHtml(formatMoneyText({
            currency,
            amount: landPart?.amount,
            unit: landPart?.unit,
            basis: landPart?.basis
          }))}
        </p>
      </td>
    `);
  }

  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 16px;">
      <tr>
        <td colspan="3" style="background:#f4b183;padding:11px 14px;text-align:center;color:#111827;font-size:14px;font-weight:900;border-radius:14px 14px 0 0;border:1px solid ${EMAIL_BRAND.border};border-bottom:0;">
          Package Details
        </td>
      </tr>
      <tr>${cells.join("")}</tr>
    </table>
  `;
}

/* =========================
   HOTEL INCLUSIONS
========================= */

function buildHotelInclusionsHtml(hotelInclusions = []) {
  const rows = safeArray(hotelInclusions).filter(
    row =>
      row?.nights ||
      row?.hotelName ||
      row?.roomCategory ||
      row?.location
  );

  if (!rows.length) return "";

  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;margin:0 0 16px;">
      <tr>
        <td colspan="4" style="background:#f4b183;padding:11px 14px;text-align:center;color:#111827;font-size:14px;font-weight:900;">
          Hotel Inclusions
        </td>
      </tr>

      <tr>
        <td style="width:18%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Nights</td>
        <td style="width:38%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Hotel</td>
        <td style="width:28%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Room</td>
        <td style="width:16%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Meal</td>
      </tr>

      ${rows
        .map((row, index) => {
          const isLast = index === rows.length - 1;
          const borderBottom = isLast
            ? ""
            : `border-bottom:1px solid ${EMAIL_BRAND.border};`;

          return `
            <tr>
              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#111827;font-size:13px;">
                ${escapeHtml(row?.nights || "—")}
              </td>

              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#111827;font-size:13px;font-weight:700;">
                ${escapeHtml(row?.hotelName || "—")}
                ${
                  row?.location
                    ? `<br><span style="color:#64748b;font-size:12px;font-weight:400;">${escapeHtml(row.location)}</span>`
                    : ""
                }
              </td>

              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#111827;font-size:13px;">
                ${escapeHtml(row?.roomCategory || "—")}
              </td>

              <td style="padding:10px;${borderBottom}color:#111827;font-size:13px;">
                ${escapeHtml(row?.mealPlan || "—")}
              </td>
            </tr>
          `;
        })
        .join("")}
    </table>
  `;
}

/* =========================
   TRANSFER INCLUSIONS
========================= */

function buildTransferInclusionsHtml(transferInclusions = []) {
  const items = safeArray(transferInclusions)
    .map(item => cleanString(item))
    .filter(Boolean);

  if (!items.length) return "";

  return buildCardTable(`
    ${buildSectionHeader("Transfer & Service Inclusions")}
    <tr>
      <td style="padding:14px 16px;background:#ffffff;">
        <ul style="margin:0;padding-left:18px;color:#374151;font-size:13px;line-height:1.75;">
          ${items
            .map(item => `<li style="margin:0 0 6px;">${escapeHtml(item)}</li>`)
            .join("")}
        </ul>
      </td>
    </tr>
  `);
}

/* =========================
   ITINERARY
========================= */

function buildItineraryHtml(itineraryDays = []) {
  const rows = safeArray(itineraryDays).filter(
    row => row?.title || row?.description
  );

  if (!rows.length) return "";

  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;margin:0 0 16px;">
      <tr>
        <td colspan="2" style="background:#f4b183;padding:11px 14px;text-align:center;color:#111827;font-size:14px;font-weight:900;">
          Itinerary
        </td>
      </tr>

      ${rows
        .map((row, index) => {
          const isLast = index === rows.length - 1;
          const borderBottom = isLast
            ? ""
            : `border-bottom:1px solid ${EMAIL_BRAND.border};`;

          const dayLabel = row?.day
            ? `Day ${row.day}`
            : row?.label || `Day ${index + 1}`;

          const extraLines = [
            row?.meals ? `<strong>Meals:</strong> ${escapeHtml(row.meals)}` : "",
            row?.meetingPoint ? `<strong>Meeting Point:</strong> ${escapeHtml(row.meetingPoint)}` : "",
            row?.timing ? `<strong>Timing:</strong> ${escapeHtml(row.timing)}` : "",
            row?.includes ? `<strong>Includes:</strong> ${escapeHtml(row.includes)}` : ""
          ].filter(Boolean);

          return `
            <tr>
              <td style="width:82px;padding:12px;background:#f8fafc;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:${EMAIL_BRAND.blue};font-size:13px;font-weight:900;vertical-align:top;">
                ${escapeHtml(dayLabel)}
              </td>

              <td style="padding:12px;background:#ffffff;${borderBottom}color:#374151;font-size:13px;line-height:1.7;">
                ${row?.title ? `<strong style="color:#111827;">${escapeHtml(row.title)}</strong><br>` : ""}
                ${escapeHtml(row?.description || "")}
                ${
                  extraLines.length
                    ? `<br><br>${extraLines.join("<br>")}`
                    : ""
                }
              </td>
            </tr>
          `;
        })
        .join("")}
    </table>
  `;
}

/* =========================
   SERVICE DETAILS
========================= */

function buildServiceItemsHtml(serviceItems = []) {
  const rows = safeArray(serviceItems).filter(
    row => row?.title || row?.description || row?.amount
  );

  if (!rows.length) return "";

  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;margin:0 0 16px;">
      <tr>
        <td colspan="4" style="background:#f4b183;padding:11px 14px;text-align:center;color:#111827;font-size:14px;font-weight:900;">
          Service Details
        </td>
      </tr>

      <tr>
        <td style="width:22%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Service</td>
        <td style="width:38%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Description</td>
        <td style="width:18%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Amount</td>
        <td style="width:22%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Remarks</td>
      </tr>

      ${rows
        .map((row, index) => {
          const isLast = index === rows.length - 1;
          const borderBottom = isLast
            ? ""
            : `border-bottom:1px solid ${EMAIL_BRAND.border};`;

          return `
            <tr>
              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#111827;font-size:13px;font-weight:700;">
                ${escapeHtml(row?.title || row?.serviceType || "Service")}
              </td>

              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#374151;font-size:13px;line-height:1.6;">
                ${escapeHtml(row?.description || "—")}
              </td>

              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#111827;font-size:13px;font-weight:800;">
                ${escapeHtml(
                  row?.amount
                    ? `${row?.currency || ""} ${row.amount}`.trim()
                    : "—"
                )}
              </td>

              <td style="padding:10px;${borderBottom}color:#374151;font-size:13px;line-height:1.6;">
                ${escapeHtml(row?.remarks || "—")}
              </td>
            </tr>
          `;
        })
        .join("")}
    </table>
  `;
}

/* =========================
   FLIGHT DETAILS
========================= */

function buildFlightDetailsHtml(flightDetails = []) {
  const rows = safeArray(flightDetails).filter(
    row => row?.airline || row?.route || row?.fare
  );

  if (!rows.length) return "";

  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;margin:0 0 16px;">
      <tr>
        <td colspan="6" style="background:#f4b183;padding:11px 14px;text-align:center;color:#111827;font-size:14px;font-weight:900;">
          Flight / Air Ticket Details
        </td>
      </tr>

      <tr>
        <td style="padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Airline</td>
        <td style="padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Route</td>
        <td style="padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Departure</td>
        <td style="padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Return</td>
        <td style="padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Baggage</td>
        <td style="padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">Fare</td>
      </tr>

      ${rows
        .map((row, index) => {
          const isLast = index === rows.length - 1;
          const borderBottom = isLast
            ? ""
            : `border-bottom:1px solid ${EMAIL_BRAND.border};`;

          return `
            <tr>
              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#111827;font-size:13px;font-weight:700;">
                ${escapeHtml(row?.airline || "—")}
              </td>

              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#374151;font-size:13px;line-height:1.6;">
                ${escapeHtml(row?.route || "—")}
              </td>

              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#374151;font-size:13px;">
                ${escapeHtml(formatDisplayDate(row?.departureDate) || "—")}
              </td>

              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#374151;font-size:13px;">
                ${escapeHtml(formatDisplayDate(row?.returnDate) || "—")}
              </td>

              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#374151;font-size:13px;">
                ${escapeHtml(row?.baggage || "—")}
              </td>

              <td style="padding:10px;${borderBottom}color:#111827;font-size:13px;font-weight:800;">
                ${escapeHtml(
                  row?.fare
                    ? `${row?.currency || ""} ${row.fare}`.trim()
                    : "—"
                )}
              </td>
            </tr>

            ${
              row?.remarks
                ? `
                  <tr>
                    <td colspan="6" style="padding:10px;background:#fff7ed;${borderBottom}color:#374151;font-size:13px;line-height:1.6;">
                      <strong>Remarks:</strong> ${escapeHtml(row.remarks)}
                    </td>
                  </tr>
                `
                : ""
            }
          `;
        })
        .join("")}
    </table>
  `;
}

/* =========================
   AUTO SECTION RENDERERS
========================= */

function buildBulletSectionHtml(section = {}) {
  const items = safeArray(section?.items)
    .map(item => cleanString(item))
    .filter(Boolean);

  if (!items.length) return "";

  return `
    <tr>
      <td style="padding:14px 16px;background:#ffffff;">
        <ul style="margin:0;padding-left:18px;color:#374151;font-size:13px;line-height:1.75;">
          ${items
            .map(item => `<li style="margin:0 0 6px;">${escapeHtml(item)}</li>`)
            .join("")}
        </ul>
      </td>
    </tr>
  `;
}

function buildTextSectionHtml(section = {}) {
  const text = cleanString(section?.text);

  if (!text) return "";

  return `
    <tr>
      <td style="padding:14px 16px;background:#ffffff;">
        <p style="margin:0;color:#374151;font-size:13px;line-height:1.75;">
          ${escapeHtml(text)}
        </p>
      </td>
    </tr>
  `;
}

function buildHtmlSectionHtml(section = {}) {
  const html = sanitizeAdminHtml(section?.html);

  if (!cleanString(html)) return "";

  return `
    <tr>
      <td style="padding:14px 16px;background:#ffffff;color:#374151;font-size:13px;line-height:1.75;">
        ${html}
      </td>
    </tr>
  `;
}

function buildTableSectionHtml(section = {}) {
  const columns = safeArray(section?.columns)
    .map(item => cleanString(item))
    .filter(Boolean);

  const rows = safeArray(section?.rows).filter(row => Array.isArray(row));

  if (!columns.length || !rows.length) return "";

  return `
    <tr>
      <td style="padding:0;background:#ffffff;">
        <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;">
          <tr>
            ${columns
              .map(
                column => `
                  <td style="padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">
                    ${escapeHtml(column)}
                  </td>
                `
              )
              .join("")}
          </tr>

          ${rows
            .map((row, rowIndex) => {
              const isLast = rowIndex === rows.length - 1;
              const borderBottom = isLast
                ? ""
                : `border-bottom:1px solid ${EMAIL_BRAND.border};`;

              return `
                <tr>
                  ${columns
                    .map((_, cellIndex) => {
                      const cell = row[cellIndex] || "";

                      return `
                        <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#111827;font-size:13px;line-height:1.6;">
                          ${escapeHtml(cell)}
                        </td>
                      `;
                    })
                    .join("")}
                </tr>
              `;
            })
            .join("")}
        </table>
      </td>
    </tr>
  `;
}

function buildNoticeSectionHtml(section = {}, key = "") {
  if (!section?.enabled) return "";

  const title = section?.title || QUOTATION_SECTION_LABELS[key] || "Note";

  let contentHtml = "";

  if (section.type === "html") {
    const html = sanitizeAdminHtml(section.html);
    if (!cleanString(html)) return "";
    contentHtml = html;
  } else if (section.type === "bullets") {
    const items = safeArray(section.items)
      .map(item => cleanString(item))
      .filter(Boolean);

    if (!items.length) return "";

    contentHtml = `
      <ul style="margin:0;padding-left:18px;color:#374151;font-size:13px;line-height:1.75;">
        ${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    `;
  } else {
    const text = cleanString(section.text);
    if (!text) return "";

    contentHtml = `
      <p style="margin:0;color:#374151;font-size:13px;line-height:1.75;font-weight:700;">
        ${escapeHtml(text)}
      </p>
    `;
  }

  if (key === "customerVisibleNote") {
    return `
      <div style="background:#fff200;border:1px solid #eab308;border-radius:14px;padding:12px 14px;margin:0 0 16px;">
        <p style="margin:0 0 6px;color:#111827;font-size:13px;line-height:1.6;font-weight:900;">
          ${escapeHtml(title)}
        </p>
        ${contentHtml}
      </div>
    `;
  }

  if (key === "localOperationalNotes") {
    return `
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:12px 14px;margin:0 0 16px;">
        <p style="margin:0 0 6px;color:#111827;font-size:13px;line-height:1.6;font-weight:900;">
          ${escapeHtml(title)}
        </p>
        ${contentHtml}
      </div>
    `;
  }

  if (key === "regulationDisclaimer") {
    return `
      <div style="background:#fff5f6;border:1px solid #f2c8cf;border-radius:16px;padding:15px;margin:0 0 16px;">
        ${contentHtml}
      </div>
    `;
  }

  return "";
}

function buildAutoSectionHtml(section = {}, key = "") {
  if (!section?.enabled) return "";

  if (
    key === "customerVisibleNote" ||
    key === "localOperationalNotes" ||
    key === "regulationDisclaimer"
  ) {
    return buildNoticeSectionHtml(section, key);
  }

  let contentHtml = "";

  if (section.type === "table") {
    contentHtml = buildTableSectionHtml(section);
  } else if (section.type === "html") {
    contentHtml = buildHtmlSectionHtml(section);
  } else if (section.type === "text") {
    contentHtml = buildTextSectionHtml(section);
  } else {
    contentHtml = buildBulletSectionHtml(section);
  }

  if (!contentHtml) return "";

  return buildCardTable(`
    ${buildSectionHeader(
      section?.title || QUOTATION_SECTION_LABELS[key] || "Information",
      key === "costExcludes" ||
        key === "importantTerms" ||
        key === "vehicleRules" ||
        key === "arrivalRequirements" ||
        key === "tourismLevy" ||
        key === "visaNotes" ||
        key === "beachClubTerms"
        ? "blue"
        : "orange"
    )}
    ${contentHtml}
  `);
}

export function buildDestinationAutoSectionsHtml({
  destinationTemplate = {},
  selectedAutoSections = {}
}) {
  const templateSnapshot = destinationTemplate?.sections
    ? destinationTemplate
    : buildDestinationTemplateSnapshot(destinationTemplate);

  const sections = templateSnapshot?.sections || {};

  return QUOTATION_AUTO_SECTION_KEYS
    .map(key => {
      if (!selectedAutoSections?.[key]) return "";
      return buildAutoSectionHtml(sections[key], key);
    })
    .filter(Boolean)
    .join("");
}

/* =========================
   MAIN BUILDER
========================= */

export function buildStructuredQuotationHtml({
  lead = {},
  quotationData = {},
  destinationTemplate = null
}) {
  const templateSnapshot =
    quotationData?.destinationTemplateSnapshot ||
    (destinationTemplate
      ? buildDestinationTemplateSnapshot(destinationTemplate)
      : null);

  const selectedAutoSections =
    quotationData?.selectedAutoSections ||
    getDefaultSelectedAutoSections(templateSnapshot || {});

  const details = getLeadTravelDetails(lead, quotationData);

  const quotationType = quotationData?.quotationType || "package";

  const showPackageDetails =
    ["package", "hotel_only", "land_only", "custom"].includes(quotationType);

  const showHotelInclusions =
    ["package", "hotel_only", "custom"].includes(quotationType) &&
    quotationData?.packageDetails?.hotelPart?.enabled;

  const showTransfers =
    ["package", "land_only", "custom"].includes(quotationType) &&
    quotationData?.packageDetails?.landPart?.enabled;

  const showItinerary =
    ["package", "land_only", "custom"].includes(quotationType);

  const showServices =
    ["visa_only", "custom"].includes(quotationType);

  const showFlights =
    ["flight_only", "custom"].includes(quotationType);

  return `
    <div style="width:100%;margin:0;padding:0;">
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:16px;padding:16px;text-align:center;margin:0 0 14px;">
        <p style="margin:0;color:${EMAIL_BRAND.red};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">
          Destination Quotation
        </p>

        <h2 style="margin:6px 0 0;color:${EMAIL_BRAND.blue};font-size:22px;line-height:1.35;font-weight:900;">
          ${escapeHtml(details.destinationName)} Package Quotation
        </h2>

        ${
          details.leadCode
            ? `
              <p style="margin:6px 0 0;color:#475569;font-size:13px;line-height:1.6;">
                Lead Reference:
                <strong style="color:#111827;">${escapeHtml(details.leadCode)}</strong>
              </p>
            `
            : ""
        }
      </div>

      ${buildCustomerDetailsHtml({ lead, quotationData })}

      ${
        showPackageDetails
          ? buildPackageDetailsHtml(quotationData?.packageDetails || {})
          : ""
      }

      ${
        showHotelInclusions
          ? buildHotelInclusionsHtml(quotationData?.hotelInclusions || [])
          : ""
      }

      ${
        showTransfers
          ? buildTransferInclusionsHtml(quotationData?.transferInclusions || [])
          : ""
      }

      ${
        showItinerary
          ? buildItineraryHtml(quotationData?.itineraryDays || [])
          : ""
      }

      ${
        showServices
          ? buildServiceItemsHtml(quotationData?.serviceItems || [])
          : ""
      }

      ${
        showFlights
          ? buildFlightDetailsHtml(quotationData?.flightDetails || [])
          : ""
      }

      ${buildDestinationAutoSectionsHtml({
        destinationTemplate: templateSnapshot || {},
        selectedAutoSections
      })}
    </div>
  `;
}