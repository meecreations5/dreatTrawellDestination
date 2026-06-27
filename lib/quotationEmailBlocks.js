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

const PACKAGE_SCOPE_LABELS = {
  hotel: "Hotel",
  land: "Land Part",
  visa: "Visa",
  flight: "Flight",
  insurance: "Insurance",
  activity: "Activity / Sightseeing",
  other: "Other"
};

function getSelectedPackageScopeLabels(scope = {}) {
  return Object.entries(PACKAGE_SCOPE_LABELS)
    .filter(([key]) => Boolean(scope?.[key]))
    .map(([, label]) => label);
}

function hasPriceValue(value) {
  return Boolean(cleanString(value));
}

function hasAdultChildOrAmount(row = {}) {
  return Boolean(
    hasPriceValue(row?.adultCost) ||
    hasPriceValue(row?.childCost) ||
    hasPriceValue(row?.amount)
  );
}

function hasLandModePricing(mode = {}) {
  return Boolean(
    hasPriceValue(mode?.adultCost) ||
    hasPriceValue(mode?.childCost)
  );
}

function hasAnyLandPricing(landPricing = {}) {
  return Boolean(
    hasLandModePricing(landPricing?.pvt) ||
    hasLandModePricing(landPricing?.sic)
  );
}

function hasServicePricingContent(item = {}) {
  return Boolean(
    cleanString(item?.amount) ||
    cleanString(item?.description) ||
    cleanString(item?.remarks)
  );
}

function hasHotelListingContent(row = {}) {
  return Boolean(
    cleanString(row?.nights) ||
    cleanString(row?.hotelName) ||
    cleanString(row?.roomCategory) ||
    cleanString(row?.mealPlan) ||
    cleanString(row?.location) ||
    cleanString(row?.remarks)
  );
}

function hasFlightContent(row = {}) {
  return Boolean(
    cleanString(row?.airline) ||
    cleanString(row?.route) ||
    cleanString(row?.departureDate) ||
    cleanString(row?.returnDate) ||
    cleanString(row?.baggage) ||
    cleanString(row?.fare) ||
    cleanString(row?.remarks)
  );
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

function buildPackageDetailsHtml(
  packageDetails = {},
  quotationType = "package",
  serviceItems = []
) {
  const currency = cleanString(packageDetails?.currency) || "USD";
  const packageScope = packageDetails?.packageScope || {};
  const selectedComponents = getSelectedPackageScopeLabels(packageScope);

  const hotelPart = packageDetails?.hotelPart || {};
  const landPart = packageDetails?.landPart || {};
  const landPricing = packageDetails?.landPricing || {};
  const packagePricing = packageDetails?.packagePricing || {};

  const pricingDisplayMode =
    packageDetails?.pricingDisplayMode ||
    (packageDetails?.showAllPricing ? "component_wise" : "final_only");

  const isPackageQuotation = quotationType === "package";
  const isComponentWisePackage =
    isPackageQuotation && pricingDisplayMode === "component_wise";
  const isFinalOnlyPackage =
    isPackageQuotation && pricingDisplayMode !== "component_wise";

  const cleanServiceItems = safeArray(serviceItems).filter(
    hasServicePricingContent
  );

  const hasHotelPartPrice = hasAdultChildOrAmount(hotelPart);
  const hasLandPartPrice = hasAdultChildOrAmount(landPart);

  const pvt = landPricing?.pvt || {};
  const sic = landPricing?.sic || {};

  const hasPvtPrice = hasLandModePricing(pvt);
  const hasSicPrice = hasLandModePricing(sic);

  const hasFinalPackagePrice = Boolean(
    cleanString(packagePricing?.adultCost) ||
    cleanString(packagePricing?.childCost)
  );

  const showPackageIncludes =
    isComponentWisePackage && selectedComponents.length > 0;

  const showFinalPackagePrice =
    isFinalOnlyPackage && hasFinalPackagePrice;

  const showHotelPricing =
    (
      isComponentWisePackage &&
      packageScope?.hotel &&
      hasHotelPartPrice
    ) ||
    (
      quotationType === "hotel_only" &&
      hasHotelPartPrice
    ) ||
    (
      quotationType === "custom" &&
      hotelPart?.enabled &&
      hasHotelPartPrice
    );

  const showLandPricing =
    isComponentWisePackage &&
    packageScope?.land &&
    (
      hasPvtPrice ||
      hasSicPrice ||
      hasLandPartPrice
    );

  const showServicePricing =
    isComponentWisePackage && cleanServiceItems.length > 0;

  if (
    !showPackageIncludes &&
    !showFinalPackagePrice &&
    !showHotelPricing &&
    !showLandPricing &&
    !showServicePricing
  ) {
    return "";
  }

  const buildPriceText = ({
    amount = "",
    unit = "",
    basis = "",
    fallbackCurrency = currency
  }) => {
    return formatMoneyText({
      currency: fallbackCurrency,
      amount,
      unit,
      basis
    });
  };

  const buildPricingCard = ({
    title = "",
    adultCost = "",
    childCost = "",
    amount = "",
    unit = "",
    basis = "",
    remarks = "",
    cardTone = "blue",
    fallbackCurrency = currency
  }) => {
    const borderColor =
      cardTone === "green"
        ? "#bbf7d0"
        : cardTone === "red"
          ? "#fecdd3"
          : cardTone === "purple"
            ? "#ddd6fe"
            : "#bfdbfe";

    const bgColor =
      cardTone === "green"
        ? "#f0fdf4"
        : cardTone === "red"
          ? "#fff5f6"
          : cardTone === "purple"
            ? "#f5f3ff"
            : "#eff6ff";

    const titleColor =
      cardTone === "green"
        ? "#166534"
        : cardTone === "red"
          ? EMAIL_BRAND.red
          : cardTone === "purple"
            ? "#6d28d9"
            : EMAIL_BRAND.blue;

    return `
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${borderColor};border-radius:14px;overflow:hidden;margin:0 0 12px;background:${bgColor};">
        <tr>
          <td style="padding:12px 14px;background:${bgColor};">
            <p style="margin:0 0 8px;color:${titleColor};font-size:13px;font-weight:900;line-height:1.5;">
              ${escapeHtml(title)}
            </p>

            ${amount
        ? `
                <p style="margin:0;color:#111827;font-size:15px;font-weight:900;line-height:1.6;">
                  ${escapeHtml(
          buildPriceText({
            amount,
            unit,
            basis,
            fallbackCurrency
          })
        )}
                </p>
              `
        : `
                <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;">
                  <tr>
                    <td style="width:50%;padding:10px;background:#ffffff;border:1px solid ${EMAIL_BRAND.border};border-radius:12px 0 0 12px;vertical-align:top;">
                      <p style="margin:0;color:#64748b;font-size:11px;font-weight:800;line-height:1.4;">
                        Adult Price
                      </p>
                      <p style="margin:5px 0 0;color:#111827;font-size:14px;font-weight:900;line-height:1.5;">
                        ${escapeHtml(
          adultCost
            ? buildPriceText({
              amount: adultCost,
              fallbackCurrency
            })
            : "—"
        )}
                      </p>
                    </td>

                    <td style="width:50%;padding:10px;background:#ffffff;border-top:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};border-bottom:1px solid ${EMAIL_BRAND.border};border-radius:0 12px 12px 0;vertical-align:top;">
                      <p style="margin:0;color:#64748b;font-size:11px;font-weight:800;line-height:1.4;">
                        Child Price
                      </p>
                      <p style="margin:5px 0 0;color:#111827;font-size:14px;font-weight:900;line-height:1.5;">
                        ${escapeHtml(
          childCost
            ? buildPriceText({
              amount: childCost,
              fallbackCurrency
            })
            : "—"
        )}
                      </p>
                    </td>
                  </tr>
                </table>

                ${unit || basis
          ? `
                    <p style="margin:8px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
                      ${escapeHtml(
            [unit, basis]
              .map(cleanString)
              .filter(Boolean)
              .join(" · ")
          )}
                    </p>
                  `
          : ""
        }
              `
      }

            ${remarks
        ? `
                <p style="margin:8px 0 0;color:#374151;font-size:12px;line-height:1.6;">
                  ${escapeHtml(remarks)}
                </p>
              `
        : ""
      }
          </td>
        </tr>
      </table>
    `;
  };

  const buildLandPricingCards = () => {
    if (!showLandPricing) return "";

    const pvtHtml = hasPvtPrice
      ? buildPricingCard({
        title: "Land Pricing - PVT Basis",
        adultCost: pvt?.adultCost,
        childCost: pvt?.childCost,
        unit: pvt?.unit || "Per Person",
        basis: pvt?.basis || "Private Basis",
        remarks: pvt?.remarks,
        cardTone: "red",
        fallbackCurrency: cleanString(pvt?.currency) || currency
      })
      : "";

    const sicHtml = hasSicPrice
      ? buildPricingCard({
        title: "Land Pricing - SIC Basis",
        adultCost: sic?.adultCost,
        childCost: sic?.childCost,
        unit: sic?.unit || "Per Person",
        basis: sic?.basis || "Seat-in-Coach Basis",
        remarks: sic?.remarks,
        cardTone: "blue",
        fallbackCurrency: cleanString(sic?.currency) || currency
      })
      : "";

    if (pvtHtml || sicHtml) {
      return `${pvtHtml}${sicHtml}`;
    }

    return hasLandPartPrice
      ? buildPricingCard({
        title: "Land Part Pricing",
        adultCost: landPart?.adultCost,
        childCost: landPart?.childCost,
        amount: landPart?.amount,
        unit: landPart?.unit,
        basis: landPart?.basis,
        cardTone: "red",
        fallbackCurrency: currency
      })
      : "";
  };

  const buildServicePricingCards = () => {
    if (!showServicePricing) return "";

    return cleanServiceItems
      .map((item, index) => {
        const title = cleanString(
          item?.title ||
          item?.serviceType ||
          `Service ${index + 1}`
        );

        const amount = cleanString(item?.amount);
        const description = cleanString(item?.description);
        const remarks = cleanString(item?.remarks);
        const itemCurrency = cleanString(item?.currency) || currency;

        return `
          <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #ddd6fe;border-radius:14px;overflow:hidden;margin:0 0 12px;background:#f5f3ff;">
            <tr>
              <td style="padding:12px 14px;background:#f5f3ff;">
                <p style="margin:0 0 8px;color:#6d28d9;font-size:13px;font-weight:900;line-height:1.5;">
                  ${escapeHtml(title)}
                </p>

                ${amount
            ? `
                    <p style="margin:0;color:#111827;font-size:15px;font-weight:900;line-height:1.6;">
                      ${escapeHtml(
              formatMoneyText({
                currency: itemCurrency,
                amount
              })
            )}
                    </p>
                  `
            : ""
          }

                ${description
            ? `
                    <p style="margin:8px 0 0;color:#374151;font-size:13px;line-height:1.6;">
                      ${escapeHtml(description)}
                    </p>
                  `
            : ""
          }

                ${remarks
            ? `
                    <p style="margin:8px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
                      ${escapeHtml(remarks)}
                    </p>
                  `
            : ""
          }
              </td>
            </tr>
          </table>
        `;
      })
      .join("");
  };

  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;margin:0 0 16px;">
      <tr>
        <td style="background:#f4b183;padding:11px 14px;text-align:center;color:#111827;font-size:14px;font-weight:900;">
          Package Details
        </td>
      </tr>

      <tr>
        <td style="padding:14px 16px;background:#ffffff;">
          ${showPackageIncludes
      ? `
              <p style="margin:0 0 8px;color:#64748b;font-size:12px;font-weight:800;line-height:1.5;">
                Package Includes
              </p>

              <p style="margin:0 0 12px;color:#111827;font-size:13px;line-height:1.8;font-weight:800;">
                ${selectedComponents
        .map(
          label => `
                      <span style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;border-radius:999px;padding:5px 10px;margin:0 6px 6px 0;color:${EMAIL_BRAND.blue};font-size:12px;font-weight:900;">
                        ${escapeHtml(label)}
                      </span>
                    `
        )
        .join("")}
              </p>
            `
      : ""
    }

          ${showFinalPackagePrice
      ? buildPricingCard({
        title: "Final Package Price",
        adultCost: packagePricing?.adultCost,
        childCost: packagePricing?.childCost,
        unit: packagePricing?.unit,
        basis: packagePricing?.basis,
        cardTone: "green",
        fallbackCurrency: cleanString(packagePricing?.currency) || currency
      })
      : ""
    }

          ${showHotelPricing
      ? buildPricingCard({
        title: "Hotel Pricing",
        adultCost: hotelPart?.adultCost,
        childCost: hotelPart?.childCost,
        amount: hotelPart?.amount,
        unit: hotelPart?.unit,
        basis: hotelPart?.basis,
        cardTone: "blue",
        fallbackCurrency: currency
      })
      : ""
    }

          ${buildLandPricingCards()}

          ${buildServicePricingCards()}
        </td>
      </tr>
    </table>
  `;
}
/* =========================
   HOTEL INCLUSIONS
========================= */

function buildHotelInclusionsHtml(hotelInclusions = []) {
  const rows = safeArray(hotelInclusions).filter(
    row =>
      !row?.optionalForClient &&
      (
        cleanString(row?.nights) ||
        cleanString(row?.hotelName) ||
        cleanString(row?.roomCategory) ||
        cleanString(row?.location) ||
        cleanString(row?.mealPlan) ||
        cleanString(row?.remarks)
      )
  );

  if (!rows.length) return "";

  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;margin:0 0 16px;">
      <tr>
        <td colspan="3" style="background:#f4b183;padding:11px 14px;text-align:center;color:#111827;font-size:14px;font-weight:900;">
          Hotel Options
        </td>
      </tr>

      <tr>
        <td style="width:45%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">
          Hotel / Location
        </td>

        <td style="width:37%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">
          Room / Meal
        </td>

        <td style="width:18%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">
          Nights
        </td>
      </tr>

      ${rows
      .map((row, index) => {
        const isLast = index === rows.length - 1;
        const borderBottom = isLast
          ? ""
          : `border-bottom:1px solid ${EMAIL_BRAND.border};`;

        return `
            <tr>
              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#111827;font-size:13px;font-weight:700;vertical-align:top;">
                ${escapeHtml(row?.hotelName || "—")}

                ${row?.recommended
            ? `<br><span style="display:inline-block;margin-top:5px;background:#dcfce7;border:1px solid #bbf7d0;border-radius:999px;padding:3px 7px;color:#166534;font-size:10px;font-weight:900;">Recommended</span>`
            : ""
          }

                ${row?.location
            ? `<br><span style="display:inline-block;margin-top:5px;color:#64748b;font-size:12px;font-weight:400;">${escapeHtml(row.location)}</span>`
            : ""
          }
              </td>

              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#374151;font-size:13px;line-height:1.6;vertical-align:top;">
                ${escapeHtml(row?.roomCategory || "—")}

                ${row?.mealPlan
            ? `<br><span style="color:#64748b;font-size:12px;">${escapeHtml(row.mealPlan)}</span>`
            : ""
          }
              </td>

              <td style="padding:10px;${borderBottom}color:#374151;font-size:13px;vertical-align:top;">
                ${escapeHtml(row?.nights || "—")}
              </td>
            </tr>

            ${row?.remarks
            ? `
                  <tr>
                    <td colspan="3" style="padding:10px;background:#fff7ed;${borderBottom}color:#374151;font-size:13px;line-height:1.6;">
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


function buildOptionalHotelOptionsHtml(hotelInclusions = []) {
  const rows = safeArray(hotelInclusions).filter(
    row =>
      row?.optionalForClient &&
      (
        cleanString(row?.hotelName) ||
        cleanString(row?.roomCategory) ||
        cleanString(row?.location) ||
        cleanString(row?.nights) ||
        cleanString(row?.mealPlan) ||
        cleanString(row?.adultCost) ||
        cleanString(row?.childCost) ||
        cleanString(row?.remarks)
      )
  );

  if (!rows.length) return "";

  return `
    <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${EMAIL_BRAND.border};border-radius:16px;overflow:hidden;margin:0 0 16px;">
      <tr>
        <td colspan="6" style="background:#f4b183;padding:11px 14px;text-align:center;color:#111827;font-size:14px;font-weight:900;">
          Optional Hotel Options
        </td>
      </tr>

      <tr>
        <td style="width:13%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">
          Option
        </td>

        <td style="width:27%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">
          Hotel / Location
        </td>

        <td style="width:22%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">
          Room / Meal
        </td>

        <td style="width:10%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">
          Nights
        </td>

        <td style="width:14%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">
          Adult Price
        </td>

        <td style="width:14%;padding:10px;background:#f8fafc;border-bottom:1px solid ${EMAIL_BRAND.border};color:#475569;font-size:12px;font-weight:800;">
          Child Price
        </td>
      </tr>

      ${rows
      .map((row, index) => {
        const isLast = index === rows.length - 1;
        const borderBottom = isLast
          ? ""
          : `border-bottom:1px solid ${EMAIL_BRAND.border};`;

        const currency = cleanString(row?.currency) || "USD";

        const priceMeta = [row?.unit, row?.basis]
          .map(cleanString)
          .filter(Boolean)
          .join(" · ");

        return `
            <tr>
              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#111827;font-size:13px;font-weight:800;vertical-align:top;">
                ${escapeHtml(row?.optionLabel || `Option ${index + 1}`)}

                ${row?.recommended
            ? `<br><span style="display:inline-block;margin-top:5px;background:#dcfce7;border:1px solid #bbf7d0;border-radius:999px;padding:3px 7px;color:#166534;font-size:10px;font-weight:900;">Recommended</span>`
            : ""
          }
              </td>

              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#111827;font-size:13px;font-weight:700;vertical-align:top;">
                ${escapeHtml(row?.hotelName || "—")}

                ${row?.location
            ? `<br><span style="color:#64748b;font-size:12px;font-weight:400;">${escapeHtml(row.location)}</span>`
            : ""
          }
              </td>

              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#374151;font-size:13px;line-height:1.6;vertical-align:top;">
                ${escapeHtml(row?.roomCategory || "—")}

                ${row?.mealPlan
            ? `<br><span style="color:#64748b;font-size:12px;">${escapeHtml(row.mealPlan)}</span>`
            : ""
          }

                ${priceMeta
            ? `<br><span style="color:#64748b;font-size:12px;">${escapeHtml(priceMeta)}</span>`
            : ""
          }
              </td>

              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#374151;font-size:13px;vertical-align:top;">
                ${escapeHtml(row?.nights || "—")}
              </td>

              <td style="padding:10px;${borderBottom}border-right:1px solid ${EMAIL_BRAND.border};color:#111827;font-size:13px;font-weight:900;vertical-align:top;">
                ${escapeHtml(
            row?.adultCost
              ? formatMoneyText({
                currency,
                amount: row.adultCost
              })
              : "—"
          )}
              </td>

              <td style="padding:10px;${borderBottom}color:#111827;font-size:13px;font-weight:900;vertical-align:top;">
                ${escapeHtml(
            row?.childCost
              ? formatMoneyText({
                currency,
                amount: row.childCost
              })
              : "—"
          )}
              </td>
            </tr>

            ${row?.remarks
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


function buildLandPricingHtml(landPricing = {}) {
  if (!hasAnyLandPricing(landPricing)) return "";

  const buildLandPriceCard = ({
    title = "",
    adultCost = "",
    childCost = "",
    currency = "USD",
    unit = "Per Person",
    basis = "",
    remarks = "",
    tone = "red"
  }) => {
    const borderColor = tone === "blue" ? "#bfdbfe" : "#fecdd3";
    const bgColor = tone === "blue" ? "#eff6ff" : "#fff5f6";
    const titleColor = tone === "blue" ? EMAIL_BRAND.blue : EMAIL_BRAND.red;

    return `
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid ${borderColor};border-radius:14px;overflow:hidden;margin:0 0 12px;background:${bgColor};">
        <tr>
          <td style="padding:12px 14px;background:${bgColor};">
            <p style="margin:0 0 8px;color:${titleColor};font-size:13px;font-weight:900;line-height:1.5;">
              ${escapeHtml(title)}
            </p>

            ${basis
        ? `
                <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.5;font-weight:700;">
                  ${escapeHtml(basis)}
                </p>
              `
        : ""
      }

            <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;">
              <tr>
                <td style="width:50%;padding:10px;background:#ffffff;border:1px solid ${EMAIL_BRAND.border};border-radius:12px 0 0 12px;vertical-align:top;">
                  <p style="margin:0;color:#64748b;font-size:11px;font-weight:800;line-height:1.4;">
                    Adult Price
                  </p>
                  <p style="margin:5px 0 0;color:#111827;font-size:14px;font-weight:900;line-height:1.5;">
                    ${escapeHtml(
        adultCost
          ? formatMoneyText({
            currency,
            amount: adultCost
          })
          : "—"
      )}
                  </p>
                </td>

                <td style="width:50%;padding:10px;background:#ffffff;border-top:1px solid ${EMAIL_BRAND.border};border-right:1px solid ${EMAIL_BRAND.border};border-bottom:1px solid ${EMAIL_BRAND.border};border-radius:0 12px 12px 0;vertical-align:top;">
                  <p style="margin:0;color:#64748b;font-size:11px;font-weight:800;line-height:1.4;">
                    Child Price
                  </p>
                  <p style="margin:5px 0 0;color:#111827;font-size:14px;font-weight:900;line-height:1.5;">
                    ${escapeHtml(
        childCost
          ? formatMoneyText({
            currency,
            amount: childCost
          })
          : "—"
      )}
                  </p>
                </td>
              </tr>
            </table>

            ${unit
        ? `
                <p style="margin:8px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
                  ${escapeHtml(unit)}
                </p>
              `
        : ""
      }

            ${remarks
        ? `
                <p style="margin:8px 0 0;color:#374151;font-size:12px;line-height:1.6;">
                  ${escapeHtml(remarks)}
                </p>
              `
        : ""
      }
          </td>
        </tr>
      </table>
    `;
  };

  const pvt = landPricing?.pvt || {};
  const sic = landPricing?.sic || {};

  const pvtHtml = hasLandModePricing(pvt)
    ? buildLandPriceCard({
      title: "PVT Basis",
      adultCost: pvt?.adultCost,
      childCost: pvt?.childCost,
      currency: cleanString(pvt?.currency) || "USD",
      unit: pvt?.unit || "Per Person",
      basis: pvt?.basis || "Private Basis",
      remarks: pvt?.remarks,
      tone: "red"
    })
    : "";

  const sicHtml = hasLandModePricing(sic)
    ? buildLandPriceCard({
      title: "SIC Basis",
      adultCost: sic?.adultCost,
      childCost: sic?.childCost,
      currency: cleanString(sic?.currency) || "USD",
      unit: sic?.unit || "Per Person",
      basis: sic?.basis || "Seat-in-Coach Basis",
      remarks: sic?.remarks,
      tone: "blue"
    })
    : "";

  if (!pvtHtml && !sicHtml) return "";

  return buildCardTable(`
    ${buildSectionHeader("Land Part Pricing")}
    <tr>
      <td style="padding:14px 16px;background:#ffffff;">
        ${pvtHtml}
        ${sicHtml}
      </td>
    </tr>
  `);
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
                ${extraLines.length
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
  const rows = safeArray(serviceItems).filter(hasServicePricingContent);

  if (!rows.length) return "";

  return buildCardTable(`
    ${buildSectionHeader("Service / Visa Details")}
    <tr>
      <td style="padding:14px 16px;background:#ffffff;">
        ${rows
      .map((row, index) => {
        const title = cleanString(
          row?.title ||
          row?.serviceType ||
          `Service ${index + 1}`
        );

        const amount = cleanString(row?.amount);
        const description = cleanString(row?.description);
        const remarks = cleanString(row?.remarks);

        return `
              <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:separate;border-spacing:0;border:1px solid #ddd6fe;border-radius:14px;overflow:hidden;margin:0 0 12px;background:#f5f3ff;">
                <tr>
                  <td style="padding:12px 14px;background:#f5f3ff;">
                    <p style="margin:0 0 8px;color:#6d28d9;font-size:13px;font-weight:900;line-height:1.5;">
                      ${escapeHtml(title)}
                    </p>

                    ${amount
            ? `
                        <p style="margin:0;color:#111827;font-size:15px;font-weight:900;line-height:1.6;">
                          ${escapeHtml(
              formatMoneyText({
                currency: row?.currency || "INR",
                amount
              })
            )}
                        </p>
                      `
            : ""
          }

                    ${description
            ? `
                        <p style="margin:8px 0 0;color:#374151;font-size:13px;line-height:1.6;">
                          ${escapeHtml(description)}
                        </p>
                      `
            : ""
          }

                    ${remarks
            ? `
                        <p style="margin:8px 0 0;color:#64748b;font-size:12px;line-height:1.6;">
                          ${escapeHtml(remarks)}
                        </p>
                      `
            : ""
          }
                  </td>
                </tr>
              </table>
            `;
      })
      .join("")}
      </td>
    </tr>
  `);
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

            ${row?.remarks
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
  const packageDetails = quotationData?.packageDetails || {};
  const packageScope = packageDetails?.packageScope || {};

  const hotelPart = packageDetails?.hotelPart || {};
  const landPart = packageDetails?.landPart || {};
  const landPricing = packageDetails?.landPricing || {};

  const pricingDisplayMode =
    packageDetails?.pricingDisplayMode ||
    (packageDetails?.showAllPricing ? "component_wise" : "final_only");

  const isPackageQuotation = quotationType === "package";

  const quotationTitleMap = {
    package: "Package Quotation",
    hotel_only: "Hotel Quotation",
    land_only: "Land Quotation",
    visa_only: "Visa / Service Quotation",
    flight_only: "Flight Quotation",
    custom: "Custom Quotation"
  };

  const quotationTitle =
    quotationTitleMap[quotationType] || "Travel Quotation";

  const hotelRows = Array.isArray(quotationData?.hotelInclusions)
    ? quotationData.hotelInclusions
    : [];

  const normalHotelRows = hotelRows.filter(
    row =>
      !row?.optionalForClient &&
      hasHotelListingContent(row)
  );

  const optionalHotelRows = hotelRows.filter(
    row =>
      row?.optionalForClient &&
      (
        hasHotelListingContent(row) ||
        cleanString(row?.adultCost) ||
        cleanString(row?.childCost)
      )
  );

  const hasNormalHotelRows = normalHotelRows.length > 0;
  const hasOptionalHotelRows = optionalHotelRows.length > 0;

  const canShowHotelSections =
    isPackageQuotation ||
    quotationType === "hotel_only" ||
    (
      quotationType === "custom" &&
      Boolean(hotelPart?.enabled)
    );

  const showNormalHotelOptions =
    canShowHotelSections && hasNormalHotelRows;

  const showOptionalHotelOptions =
    canShowHotelSections && hasOptionalHotelRows;

  const hasLandPricing = hasAnyLandPricing(landPricing);

  const hasTransferRows =
    Array.isArray(quotationData?.transferInclusions) &&
    quotationData.transferInclusions.some(item => cleanString(item));

  const hasServiceRows =
    Array.isArray(quotationData?.serviceItems) &&
    quotationData.serviceItems.some(hasServicePricingContent);

  const hasFlightRows =
    Array.isArray(quotationData?.flightDetails) &&
    quotationData.flightDetails.some(hasFlightContent);

  const showPackageDetails = [
    "package",
    "hotel_only",
    "custom"
  ].includes(quotationType);

  const showLandPricing =
    hasLandPricing &&
    (
      quotationType === "land_only" ||
      (
        quotationType === "custom" &&
        Boolean(landPart?.enabled)
      )
    );

  const showTransfers =
    hasTransferRows &&
    (
      isPackageQuotation ||
      quotationType === "land_only" ||
      (
        quotationType === "custom" &&
        Boolean(landPart?.enabled)
      )
    );

  const showItinerary =
    isPackageQuotation ||
    quotationType === "land_only" ||
    quotationType === "custom";

  const showServices =
    hasServiceRows &&
    (
      quotationType === "visa_only" ||
      quotationType === "custom"
    );

  const showFlights =
    hasFlightRows &&
    (
      quotationType === "flight_only" ||
      quotationType === "custom" ||
      (
        isPackageQuotation &&
        pricingDisplayMode === "component_wise" &&
        packageScope?.flight
      )
    );

  const showDestinationAutoSections = [
    "package",
    "land_only",
    "custom"
  ].includes(quotationType);

  return `
    <div style="width:100%;margin:0;padding:0;">
      <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:16px;padding:16px;text-align:center;margin:0 0 14px;">
        <p style="margin:0;color:${EMAIL_BRAND.red};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">
          Destination Quotation
        </p>

        <h2 style="margin:6px 0 0;color:${EMAIL_BRAND.blue};font-size:22px;line-height:1.35;font-weight:900;">
          ${escapeHtml(details.destinationName)} ${escapeHtml(quotationTitle)}
        </h2>

        ${details.leadCode
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

      ${showPackageDetails
      ? buildPackageDetailsHtml(
        quotationData?.packageDetails || {},
        quotationType,
        quotationData?.serviceItems || []
      )
      : ""
    }

      

      ${showLandPricing
      ? buildLandPricingHtml(
        quotationData?.packageDetails?.landPricing || {}
      )
      : ""
    }

      ${showServices
      ? buildServiceItemsHtml(quotationData?.serviceItems || [])
      : ""
    }

      ${showFlights
      ? buildFlightDetailsHtml(quotationData?.flightDetails || [])
      : ""
    }

      ${showItinerary
      ? buildItineraryHtml(quotationData?.itineraryDays || [])
      : ""
    }

      ${showTransfers
      ? buildTransferInclusionsHtml(
        quotationData?.transferInclusions || []
      )
      : ""
    }

      ${showDestinationAutoSections
      ? buildDestinationAutoSectionsHtml({
        destinationTemplate: templateSnapshot || {},
        selectedAutoSections
      })
      : ""
    }
    </div>
  `;
}