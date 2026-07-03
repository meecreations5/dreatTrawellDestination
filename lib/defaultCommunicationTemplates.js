// lib/defaultCommunicationTemplates.js

/* =========================
   DREAMTRAWELL DEFAULT COMMUNICATION TEMPLATES

   Purpose:
   - Seed Firestore communicationTemplates
   - Keep default backup in code
   - Firestore communicationTemplates remains live editable source

   Important:
   - Email HTML uses {{companyLogoUrl}}, {{companyName}}, {{tagline}},
     {{assetLinksHtml}}, {{signature}}.
   - WhatsApp text uses {{assetLinks}} and {{signature}}.
========================= */

export const DEFAULT_COMMUNICATION_TEMPLATE_VERSION = 1;
export const DEFAULT_TEMPLATE_SOURCE = "default_seed";

export const DREAMTRAWELL_DEFAULT_DESTINATIONS =
  "Thailand, Dubai, Singapore, Malaysia, Bali and Vietnam";

/* =========================
   EMAIL DESIGN TOKENS
========================= */

const EMAIL_BRAND = {
  blue: "#1d4e89",
  red: "#9b0112",
  bg: "#dbe5ea",
  card: "#ffffff",
  soft: "#f8fafc",
  text: "#111827",
  muted: "#475569",
  border: "#dbe4ef",
  redSoft: "#fff5f6",
  redBorder: "#f2c8cf"
};

/* =========================
   EMAIL SHELL
   Logo comes from Branding Settings:
   {{companyLogoUrl}}
========================= */

function emailShell({
  title = "",
  preheader = "",
  subtitle = "",
  introLine = "",
  bodyHtml = "",
  actionTitle = "Next Step",
  actionHtml = "",
  closingLine = "",
  showAssetBlock = true
}) {
  return `
<div style="margin:0;padding:0;background:${EMAIL_BRAND.bg};font-family:Arial,Helvetica,sans-serif;color:${EMAIL_BRAND.text};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${preheader}
  </div>

  <div style="max-width:760px;margin:0 auto;padding:34px 14px;">
    <div style="background:${EMAIL_BRAND.card};border-radius:24px;overflow:hidden;border:1px solid ${EMAIL_BRAND.border};box-shadow:0 18px 46px rgba(15,23,42,0.16);">

      <!-- WHITE LOGO HEADER -->
      <div style="background:#ffffff;padding:28px 28px;text-align:center;border-bottom:1px solid #e5e7eb;">
        <img
          src="{{companyLogoUrl}}"
          alt="{{companyName}}"
          style="display:block;margin:0 auto;max-width:230px;max-height:86px;object-fit:contain;border:0;outline:none;text-decoration:none;"
        />
      </div>

      <!-- HERO -->
      <div style="background:${EMAIL_BRAND.blue};padding:34px 28px;text-align:center;">
        <div style="display:inline-block;width:52px;height:4px;background:${EMAIL_BRAND.red};border-radius:999px;margin-bottom:14px;"></div>

        <h1 style="margin:0;color:#ffffff;font-size:27px;line-height:1.3;font-weight:800;">
          ${title}
        </h1>

        <p style="margin:10px 0 0;color:#dbeafe;font-size:14px;line-height:1.6;">
          {{tagline}}
        </p>
      </div>

      ${introLine
      ? `
            <!-- INTRO STRIP -->
            <div style="background:linear-gradient(135deg, ${EMAIL_BRAND.blue}, ${EMAIL_BRAND.red});padding:18px 28px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:15px;line-height:1.6;font-weight:700;">
                ${introLine}
              </p>
            </div>
          `
      : ""
    }

      <!-- BODY -->
      <div style="padding:32px 30px;">
        ${subtitle
      ? `
              <div style="text-align:center;margin-bottom:24px;">
                <h2 style="margin:0;color:${EMAIL_BRAND.blue};font-size:22px;line-height:1.4;font-weight:800;">
                  ${subtitle}
                </h2>
              </div>
            `
      : ""
    }

        <p style="margin:0 0 16px;color:#111827;font-size:15px;line-height:1.7;">
          Dear {{spocName}},
        </p>

        <div style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.8;">
          ${bodyHtml}
        </div>

        ${actionHtml
      ? `
              <div style="background:${EMAIL_BRAND.redSoft};border:1px solid ${EMAIL_BRAND.redBorder};border-radius:18px;padding:18px;margin:20px 0 24px;">
                <p style="margin:0 0 8px;color:${EMAIL_BRAND.red};font-size:14px;font-weight:800;line-height:1.6;">
                  ${actionTitle}
                </p>

                <div style="margin:0;color:#374151;font-size:14px;line-height:1.8;">
                  ${actionHtml}
                </div>
              </div>
            `
      : ""
    }

        ${showAssetBlock ? "{{assetLinksHtml}}" : ""}

        ${closingLine
      ? `
              <p style="margin:22px 0 20px;color:#374151;font-size:14px;line-height:1.8;">
                ${closingLine}
              </p>
            `
      : ""
    }

        {{signature}}
      </div>
    </div>

    <p style="margin:14px 0 0;text-align:center;color:#64748b;font-size:11px;line-height:1.5;">
      This is an automated communication from {{companyName}}.
    </p>

    <p style="margin:4px 0 0;text-align:center;color:#64748b;font-size:11px;line-height:1.5;">
      <a href="{{websiteUrl}}" target="_blank" style="color:${EMAIL_BRAND.blue};text-decoration:none;font-weight:700;">
        {{websiteUrl}}
      </a>
    </p>
  </div>
</div>
`;
}

/* =========================
   COMMON HTML HELPERS
========================= */

function p(html = "") {
  return `<p style="margin:0 0 14px;font-size:14px;line-height:1.8;color:#374151;">${html}</p>`;
}

function ul(items = []) {
  return `
<ul style="margin:8px 0 16px;padding-left:18px;font-size:14px;line-height:1.8;color:#374151;">
  ${items.map(item => `<li>${item}</li>`).join("")}
</ul>
`;
}

function template({
  slug,
  name,
  templateType = "message",
  categoryCode = "general",
  categoryName = "",
  intentCodes = [],
  outcomeCodes = [],
  whatsappText = "",
  emailSubject = "",
  emailHtml = "",
  showEmail = true,
  showWhatsapp = true,
  defaultAssets = []
}) {
  return {
    slug,
    name,
    templateType,
    categoryCode,
    categoryName: categoryName || categoryCode,
    intentCodes,
    outcomeCodes,

    channels: {
      whatsapp: Boolean(showWhatsapp),
      email: Boolean(showEmail)
    },

    whatsappText,
    emailSubject,
    emailHtml,

    defaultAssets,
    defaultAssetIds: [],
    defaultAssetTitles: [],

    destinationIds: [],
    destinationNames: [],
    primaryDestination: "",

    active: true,
    status: "active",

    systemTemplate: true,
    editable: true,
    source: DEFAULT_TEMPLATE_SOURCE,
    version: DEFAULT_COMMUNICATION_TEMPLATE_VERSION,

    deleted: false,
    isDeleted: false,
    archived: false
  };
}

/* =========================
   DEFAULT TEMPLATES
========================= */

export const DEFAULT_COMMUNICATION_TEMPLATES = [
  template({
    slug: "company-profile-introduction",
    name: "Company Profile Introduction",
    templateType: "message",
    categoryCode: "travel_agent_intro",
    categoryName: "Travel Agent Introduction",
    intentCodes: ["new_agent_intro", "thank_you_relationship"],
    outcomeCodes: ["intro_done", "profile_shared", "followup_required"],

    whatsappText: `Hi {{spocName}},

Greetings from {{companyName}}.

We are pleased to introduce {{companyName}} as your trusted B2B travel partner for Travel Agents and Tour Operators.

At DreamTrawell, we believe every travel agent has the power to turn a client’s dream into a meaningful journey. Our role is to support you with destination knowledge, creative planning, competitive B2B rates, quick response, and dependable on-ground coordination.

We support travel agents with:
• Hotel bookings
• Transfers
• Tours and activities
• Tailor-made itineraries
• FIT, families, honeymooners, groups and MICE
• Special experiences and surprise arrangements
• Destination package planning
• On-ground coordination and backend support

Destinations we cover:
Dubai | Singapore | Thailand | Malaysia | Bali | Vietnam

Why partner with us:
• Local destination expertise
• Competitive B2B pricing
• Quick response time
• Customized travel solutions
• Reliable operations
• Experience-focused planning

To assist you better, you may share:
• Destination
• Travel dates
• Number of pax
• Hotel preference
• Budget
• Travel type
• Any special request

Once received, our team will assist you with suitable options, routing guidance, itinerary planning, and a well-structured quotation for your client.

We look forward to working with you and supporting your upcoming travel requirements.

{{signature}}`,

    emailSubject: "Welcome to {{companyName}} - B2B Travel Partner Support",

    emailHtml: emailShell({
      title: "Realize the Experience",
      subtitle: "Trusted DMC for Travel Agents",
      introLine:
        "Complete B2B travel solutions for hotels, transfers, tours, activities, groups, MICE, and memorable travel experiences.",
      preheader:
        "{{companyName}} - Trusted B2B travel partner for travel agents and tour operators.",
      bodyHtml: `
      ${p("I hope you are doing well.")}
      ${p("We are pleased to introduce <strong>{{companyName}}</strong> as a trusted B2B travel partner for <strong>Travel Agents and Tour Operators</strong>.")}
      ${p("At DreamTrawell, we believe every travel agent has the power to turn a client’s dream into a meaningful journey. Our role is to support you with the right destination knowledge, creative planning, competitive B2B rates, quick response, smooth operations, and dependable on-ground coordination.")}

      <div style="background:#f8fbff;border:1px solid #dbeafe;border-radius:18px;padding:20px;margin:20px 0;">
        <h3 style="margin:0 0 14px;color:${EMAIL_BRAND.blue};font-size:18px;line-height:1.4;font-weight:800;">
          Company Overview
        </h3>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <tr>
            <td style="padding:9px 8px 9px 0;font-size:13px;line-height:1.6;color:#111827;border-bottom:1px solid #e5eef8;font-weight:800;width:34%;">
              Company Name
            </td>
            <td style="padding:9px 0;font-size:13px;line-height:1.6;color:#374151;border-bottom:1px solid #e5eef8;">
              {{companyName}}
            </td>
          </tr>

          <tr>
            <td style="padding:9px 8px 9px 0;font-size:13px;line-height:1.6;color:#111827;border-bottom:1px solid #e5eef8;font-weight:800;">
              Business Type
            </td>
            <td style="padding:9px 0;font-size:13px;line-height:1.6;color:#374151;border-bottom:1px solid #e5eef8;">
              B2B Travel Partner for Travel Agents and Tour Operators
            </td>
          </tr>

          <tr>
            <td style="padding:9px 8px 9px 0;font-size:13px;line-height:1.6;color:#111827;border-bottom:1px solid #e5eef8;font-weight:800;">
              Specialization
            </td>
            <td style="padding:9px 0;font-size:13px;line-height:1.6;color:#374151;border-bottom:1px solid #e5eef8;">
              Hotels, Transfers, Tours, Activities, Itineraries, Groups, MICE, and Travel Experiences
            </td>
          </tr>

          <tr>
            <td style="padding:9px 8px 0 0;font-size:13px;line-height:1.6;color:#111827;font-weight:800;">
              Brand Promise
            </td>
            <td style="padding:9px 0 0;font-size:13px;line-height:1.6;color:#374151;">
              {{tagline}}
            </td>
          </tr>
        </table>
      </div>

      ${p("<strong>{{companyName}}</strong> is a dedicated B2B travel company offering end-to-end travel services exclusively for travel agents and tour operators. With our destination knowledge, on-ground support, and experienced team, we help our partners manage travel requirements smoothly and confidently.")}

      <div style="margin:24px 0 8px;text-align:center;">
        <h3 style="margin:0 0 8px;color:${EMAIL_BRAND.blue};font-size:20px;line-height:1.4;font-weight:800;">
          Destinations We Cover
        </h3>
        <p style="margin:0;color:#475569;font-size:13px;line-height:1.7;">
          Popular destinations with reliable B2B support, smooth operations, and competitive rates.
        </p>
      </div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 20px;">
        <tr>
          <td width="50%" valign="top" style="padding:6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbeafe;background:#ffffff;border-radius:14px;overflow:hidden;">
              <tr>
                <td>
                  <a href="{{websiteUrl}}" target="_blank">
                    <img src="https://dreamtrawelldestination.com/images/01-dubai.jpg" alt="Dubai" width="300" style="width:100%;max-width:300px;height:auto;display:block;border:0;">
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center" style="background:${EMAIL_BRAND.blue};padding:12px 8px;color:#ffffff;font-size:14px;line-height:20px;font-weight:800;">
                  Dubai
                </td>
              </tr>
            </table>
          </td>

          <td width="50%" valign="top" style="padding:6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbeafe;background:#ffffff;border-radius:14px;overflow:hidden;">
              <tr>
                <td>
                  <a href="{{websiteUrl}}" target="_blank">
                    <img src="https://dreamtrawelldestination.com/images/02-singapore.jpg" alt="Singapore" width="300" style="width:100%;max-width:300px;height:auto;display:block;border:0;">
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center" style="background:${EMAIL_BRAND.blue};padding:12px 8px;color:#ffffff;font-size:14px;line-height:20px;font-weight:800;">
                  Singapore
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td width="50%" valign="top" style="padding:6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbeafe;background:#ffffff;border-radius:14px;overflow:hidden;">
              <tr>
                <td>
                  <a href="{{websiteUrl}}" target="_blank">
                    <img src="https://dreamtrawelldestination.com/images/03-thailand.jpg" alt="Thailand" width="300" style="width:100%;max-width:300px;height:auto;display:block;border:0;">
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center" style="background:${EMAIL_BRAND.blue};padding:12px 8px;color:#ffffff;font-size:14px;line-height:20px;font-weight:800;">
                  Thailand
                </td>
              </tr>
            </table>
          </td>

          <td width="50%" valign="top" style="padding:6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbeafe;background:#ffffff;border-radius:14px;overflow:hidden;">
              <tr>
                <td>
                  <a href="{{websiteUrl}}" target="_blank">
                    <img src="https://dreamtrawelldestination.com/images/04-bali.jpg" alt="Bali" width="300" style="width:100%;max-width:300px;height:auto;display:block;border:0;">
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center" style="background:${EMAIL_BRAND.blue};padding:12px 8px;color:#ffffff;font-size:14px;line-height:20px;font-weight:800;">
                  Bali
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
        <tr>
          <td width="50%" style="padding:6px;">
            <div style="background:#eaf4ff;color:${EMAIL_BRAND.blue};padding:13px 8px;text-align:center;font-size:13px;line-height:18px;font-weight:800;border-radius:12px;">
              Malaysia
            </div>
          </td>

          <td width="50%" style="padding:6px;">
            <div style="background:#eaf4ff;color:${EMAIL_BRAND.blue};padding:13px 8px;text-align:center;font-size:13px;line-height:18px;font-weight:800;border-radius:12px;">
              Vietnam
            </div>
          </td>
        </tr>
      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
        <tr>
          <td width="50%" valign="top" style="padding:6px;">
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:16px;padding:18px;">
              <h3 style="margin:0 0 8px;font-size:17px;line-height:24px;color:#c2410c;">
                Our Mission
              </h3>
              <p style="margin:0;font-size:13px;line-height:1.7;color:#334155;">
                To empower travel agents with reliable, high-quality travel services and strong operational support.
              </p>
            </div>
          </td>

          <td width="50%" valign="top" style="padding:6px;">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:16px;padding:18px;">
              <h3 style="margin:0 0 8px;font-size:17px;line-height:24px;color:${EMAIL_BRAND.blue};">
                Our Vision
              </h3>
              <p style="margin:0;font-size:13px;line-height:1.7;color:#334155;">
                To become a preferred B2B travel partner known for integrity, innovation, destination expertise, and service excellence.
              </p>
            </div>
          </td>
        </tr>
      </table>

      <div style="background:#f8fbff;border:1px solid #e5eef8;border-radius:18px;padding:20px;margin:22px 0;">
        <h3 style="margin:0 0 14px;color:${EMAIL_BRAND.blue};font-size:20px;line-height:1.4;font-weight:800;text-align:center;">
          Our Services
        </h3>

        ${ul([
        "<strong>Hotel Bookings:</strong> Wide hotel network with competitive B2B rates.",
        "<strong>Transfers:</strong> Airport, intercity, private and chauffeur services.",
        "<strong>Tailor-Made Itineraries:</strong> Customized packages for FITs, families, couples, and groups.",
        "<strong>Groups & MICE:</strong> Support for groups, corporate travel, meetings, and events.",
        "<strong>Excursions & Activities:</strong> Guided tours, adventure activities, and local experiences.",
        "<strong>24/7 Agent Support:</strong> Dedicated support for bookings, changes, and urgent needs."
      ])}
      </div>

      <div style="background:${EMAIL_BRAND.blue};border-radius:18px;padding:22px;margin:22px 0;color:#ffffff;">
        <h3 style="margin:0 0 14px;color:#ffffff;font-size:20px;line-height:1.4;font-weight:800;text-align:center;">
          Why Partner With Us?
        </h3>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="50%" style="padding:6px;color:#ffffff;font-size:13px;line-height:1.7;">&#10003; Local Destination Expertise</td>
            <td width="50%" style="padding:6px;color:#ffffff;font-size:13px;line-height:1.7;">&#10003; Competitive B2B Pricing</td>
          </tr>
          <tr>
            <td width="50%" style="padding:6px;color:#ffffff;font-size:13px;line-height:1.7;">&#10003; Quick Response Time</td>
            <td width="50%" style="padding:6px;color:#ffffff;font-size:13px;line-height:1.7;">&#10003; Customized Solutions</td>
          </tr>
          <tr>
            <td width="50%" style="padding:6px;color:#ffffff;font-size:13px;line-height:1.7;">&#10003; Reliable Operations</td>
            <td width="50%" style="padding:6px;color:#ffffff;font-size:13px;line-height:1.7;">&#10003; Experience-Focused Planning</td>
          </tr>
        </table>
      </div>

      <div style="border:1px solid #dbeafe;border-radius:18px;overflow:hidden;margin:22px 0;">
        <div style="background:#f8fbff;padding:18px;text-align:center;">
          <h3 style="margin:0;color:${EMAIL_BRAND.blue};font-size:20px;line-height:1.4;font-weight:800;">
            To Assist You Better
          </h3>
          <p style="margin:8px 0 0;font-size:13px;line-height:1.7;color:#475569;">
            You may share the below details with us for any travel requirement.
          </p>
        </div>

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:#ffffff;padding:10px 14px;font-size:13px;line-height:1.6;color:#111827;font-weight:800;width:36%;border-top:1px solid #e5eef8;">Destination</td>
            <td style="background:#ffffff;padding:10px 14px;font-size:13px;line-height:1.6;color:#374151;border-top:1px solid #e5eef8;">Preferred travel destination</td>
          </tr>
          <tr>
            <td style="background:#f8fbff;padding:10px 14px;font-size:13px;line-height:1.6;color:#111827;font-weight:800;border-top:1px solid #e5eef8;">Travel Dates</td>
            <td style="background:#f8fbff;padding:10px 14px;font-size:13px;line-height:1.6;color:#374151;border-top:1px solid #e5eef8;">Check-in and check-out dates</td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:10px 14px;font-size:13px;line-height:1.6;color:#111827;font-weight:800;border-top:1px solid #e5eef8;">Number of Pax</td>
            <td style="background:#ffffff;padding:10px 14px;font-size:13px;line-height:1.6;color:#374151;border-top:1px solid #e5eef8;">Adults, children, and room requirement</td>
          </tr>
          <tr>
            <td style="background:#f8fbff;padding:10px 14px;font-size:13px;line-height:1.6;color:#111827;font-weight:800;border-top:1px solid #e5eef8;">Hotel Preference</td>
            <td style="background:#f8fbff;padding:10px 14px;font-size:13px;line-height:1.6;color:#374151;border-top:1px solid #e5eef8;">Category, location, or specific hotel name</td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:10px 14px;font-size:13px;line-height:1.6;color:#111827;font-weight:800;border-top:1px solid #e5eef8;">Budget</td>
            <td style="background:#ffffff;padding:10px 14px;font-size:13px;line-height:1.6;color:#374151;border-top:1px solid #e5eef8;">Approximate budget per person or total budget</td>
          </tr>
          <tr>
            <td style="background:#f8fbff;padding:10px 14px;font-size:13px;line-height:1.6;color:#111827;font-weight:800;border-top:1px solid #e5eef8;">Travel Type</td>
            <td style="background:#f8fbff;padding:10px 14px;font-size:13px;line-height:1.6;color:#374151;border-top:1px solid #e5eef8;">FIT, family, honeymoon, group, corporate, or MICE</td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:10px 14px;font-size:13px;line-height:1.6;color:#111827;font-weight:800;border-top:1px solid #e5eef8;">Special Request</td>
            <td style="background:#ffffff;padding:10px 14px;font-size:13px;line-height:1.6;color:#374151;border-top:1px solid #e5eef8;">Birthday, anniversary, honeymoon setup, adventure activity, or surprise arrangement</td>
          </tr>
        </table>
      </div>

      ${p("At <strong>{{companyName}}</strong>, we believe every journey should be more than just a booking. It should help your clients <strong>{{tagline}}</strong> through smooth, meaningful, and memorable travel.")}
      ${p("Please feel free to connect with us for any travel inquiry, quotation, or collaboration.")}
      ${p("We look forward to working with you and supporting your upcoming travel requirements.")}
    `,
      actionTitle: "Ready to Plan Your Next Travel Requirement?",
      actionHtml:
        "Share your destination, dates, pax, hotel preference, and budget. Our team will assist you with suitable options, competitive B2B rates, and a well-planned itinerary.",
      closingLine:
        "Whenever you have an upcoming travel requirement, please share it with us. We will be happy to support you with clarity and confidence."
    })
  }),

  template({
    slug: "after-call-profile-shared",
    name: "After Call Connected - Profile Shared",
    categoryCode: "travel_agent_intro",
    intentCodes: ["new_agent_intro"],
    outcomeCodes: ["intro_done", "profile_shared"],
    whatsappText: `Hi {{spocName}},

It was a pleasure speaking with you.

As discussed, sharing {{companyName}} details for your reference.

We support travel agents with thoughtfully planned land packages, hotel options, transfers, sightseeing, activities, and reliable on-ground coordination for destinations like Thailand, Dubai, Singapore, Malaysia, Bali and Vietnam.

Whenever you receive a client requirement for these destinations, you can share the basic details with us. We will help you create a smooth, confident and memorable travel proposal.

{{signature}}`,
    emailSubject: "{{companyName}} details for your reference",
    emailHtml: emailShell({
      title: "Thank You for Connecting",
      subtitle: "DreamTrawell Details for Your Reference",
      introLine:
        "We are happy to support your upcoming travel requirements with clarity and confidence.",
      preheader: "Sharing {{companyName}} details for your reference",
      bodyHtml: `
        ${p("It was a pleasure speaking with you.")}
        ${p("As discussed, sharing <strong>{{companyName}}</strong> details for your reference.")}
        ${p("We support travel agents with thoughtfully planned land packages, hotel options, transfers, sightseeing, activities, and reliable on-ground coordination for destinations like Thailand, Dubai, Singapore, Malaysia, Bali and Vietnam.")}
      `,
      actionHtml:
        "Whenever you receive a client requirement for these destinations, please share the basic details with us. We will help you create a smooth and confident proposal."
    })
  }),

  template({
    slug: "call-not-answered",
    name: "Call Not Answered",
    categoryCode: "follow_up",
    intentCodes: ["no_response_follow_up"],
    outcomeCodes: ["call_not_picked", "no_response"],
    whatsappText: `Hi {{spocName}},

I tried reaching you regarding {{companyName}}.

We work with travel agents and tour operators as a B2B destination support partner for Thailand, Dubai, Singapore, Malaysia, Bali and Vietnam.

Our aim is to empower your travel business with competitive land packages, quick response, creative itinerary planning and strong on-ground handling.

Sharing our details here for your reference. Whenever convenient, we can connect briefly and explore how we can support your upcoming destination requirements.

{{signature}}`,
    emailSubject: "Tried reaching you - {{companyName}}",
    emailHtml: emailShell({
      title: "Tried Reaching You",
      subtitle: "Let’s Stay Connected",
      introLine:
        "We are ready to support your upcoming destination requirements.",
      preheader: "A quick introduction from {{companyName}}",
      bodyHtml: `
        ${p("I tried reaching you regarding <strong>{{companyName}}</strong>.")}
        ${p("We work with travel agents and tour operators as a B2B destination support partner for Thailand, Dubai, Singapore, Malaysia, Bali and Vietnam.")}
        ${p("Our aim is to empower your travel business with competitive land packages, quick response, creative itinerary planning and strong on-ground handling.")}
      `,
      actionHtml:
        "Whenever convenient, we can connect briefly and explore how we can support your upcoming destination requirements."
    })
  }),

  template({
    slug: "agent-busy-call-later",
    name: "Agent Busy / Asked to Call Later",
    categoryCode: "follow_up",
    intentCodes: ["no_response_follow_up"],
    outcomeCodes: ["followup_required", "future_follow_up"],
    whatsappText: `Hi {{spocName}},

No worries, I understand you were occupied.

Sharing {{companyName}} details here for your reference.

We support agents with hotel options, land packages, transfers, sightseeing, activities and on-ground coordination for Thailand, Dubai, Singapore, Malaysia, Bali and Vietnam.

Whenever we connect, we would be happy to understand your destination focus and support you with the right travel solutions for your clients.

{{signature}}`,
    emailSubject: "{{companyName}} details for your reference",
    emailHtml: emailShell({
      title: "Sharing Our Details for Your Reference",
      subtitle: "We Can Connect When Convenient",
      introLine:
        "We are here to support your destination requirements whenever you are ready.",
      preheader: "{{companyName}} B2B destination support",
      bodyHtml: `
        ${p("No worries, I understand you were occupied.")}
        ${p("Sharing <strong>{{companyName}}</strong> details here for your reference.")}
        ${p("We support agents with hotel options, land packages, transfers, sightseeing, activities and on-ground coordination for Thailand, Dubai, Singapore, Malaysia, Bali and Vietnam.")}
      `,
      actionHtml:
        "Whenever we connect, we would be happy to understand your destination focus and support you with the right travel solutions for your clients."
    })
  }),

  template({
    slug: "number-not-reachable",
    name: "Number Not Reachable",
    categoryCode: "follow_up",
    intentCodes: ["no_response_follow_up"],
    outcomeCodes: ["call_not_picked", "no_response"],
    whatsappText: `Hi {{spocName}},

I tried reaching you, but the call could not connect.

This is {{teamMemberName}} from {{companyName}}.

We support travel agents with B2B land package planning, destination guidance and on-ground coordination for Thailand, Dubai, Singapore, Malaysia, Bali and Vietnam.

Whenever you have a client requirement, you can message us here. We will be happy to assist you with suitable options and help you create a smooth travel experience.

{{signature}}`,
    emailSubject: "Unable to connect - {{companyName}}",
    emailHtml: emailShell({
      title: "Unable to Connect",
      subtitle: "Sharing Our Destination Support Details",
      introLine:
        "You can reach us anytime for destination guidance and land package support.",
      preheader: "Message from {{companyName}}",
      bodyHtml: `
        ${p("I tried reaching you, but the call could not connect.")}
        ${p("This is {{teamMemberName}} from <strong>{{companyName}}</strong>.")}
        ${p("We support travel agents with B2B land package planning, destination guidance and on-ground coordination for Thailand, Dubai, Singapore, Malaysia, Bali and Vietnam.")}
      `,
      actionHtml:
        "Whenever you have a client requirement, please share it with us. We will be happy to assist you with suitable options."
    })
  }),

  template({
    slug: "reconnect-old-inactive-agent",
    name: "Reconnect with Old / Inactive Agent",
    categoryCode: "reconnect",
    intentCodes: ["lost_lead_reconnect"],
    outcomeCodes: ["not_interested", "future_follow_up"],
    whatsappText: `Hi {{spocName}},

Hope you are doing well.

This is {{teamMemberName}} from {{companyName}}.

We are reconnecting with our valued travel partners and strengthening our B2B destination support for Thailand, Dubai, Singapore, Malaysia, Bali and Vietnam.

We truly believe good partnerships grow through trust, consistency and shared success. It would be wonderful to stay connected again and support you with your upcoming land package requirements.

Whenever you have a suitable query, please feel free to share it with us.

{{signature}}`,
    emailSubject: "Reconnecting for upcoming destination requirements",
    emailHtml: emailShell({
      title: "Reconnecting with Our Travel Partners",
      subtitle: "Let’s Build Stronger Travel Opportunities",
      introLine:
        "Good partnerships grow through trust, consistency and shared success.",
      preheader: "B2B destination support from {{companyName}}",
      bodyHtml: `
        ${p("Hope you are doing well.")}
        ${p("This is {{teamMemberName}} from <strong>{{companyName}}</strong>.")}
        ${p("We are reconnecting with our valued travel partners and strengthening our B2B destination support for Thailand, Dubai, Singapore, Malaysia, Bali and Vietnam.")}
        ${p("We truly believe good partnerships grow through trust, consistency and shared success. It would be wonderful to stay connected again and support you with your upcoming land package requirements.")}
      `,
      actionHtml:
        "Whenever you have a suitable query, please feel free to share it with us."
    })
  }),

  template({
    slug: "agent-will-get-in-touch",
    name: "Agent Says Will Get in Touch",
    categoryCode: "relationship",
    intentCodes: ["thank_you_relationship"],
    outcomeCodes: ["future_follow_up", "general_update"],
    whatsappText: `Sure {{spocName}}, noted.

We will stay connected.

Whenever you have any requirement for Thailand, Dubai, Singapore, Malaysia, Bali or Vietnam, please feel free to share the details.

We will be happy to support you with suitable land package options, routing guidance, itinerary planning and on-ground coordination, so you can serve your client with complete confidence.

{{signature}}`,
    emailSubject: "Staying connected for upcoming travel requirements",
    emailHtml: emailShell({
      title: "We Will Stay Connected",
      subtitle: "Ready Whenever You Have a Requirement",
      introLine:
        "We look forward to supporting your upcoming client requirements.",
      preheader: "Support for your upcoming travel requirements",
      bodyHtml: `
        ${p("Sure {{spocName}}, noted.")}
        ${p("We will stay connected.")}
        ${p("Whenever you have any requirement for Thailand, Dubai, Singapore, Malaysia, Bali or Vietnam, please feel free to share the details.")}
      `,
      actionHtml:
        "We will be happy to support you with suitable land package options, routing guidance, itinerary planning and on-ground coordination."
    })
  }),

  template({
    slug: "company-name-correction",
    name: "Agent Corrects Company Name / Details",
    categoryCode: "relationship",
    intentCodes: ["thank_you_relationship"],
    outcomeCodes: ["general_update"],
    whatsappText: `Thank you {{spocName}}, noted.

We have updated the company name as {{agencyName}}.

It was nice connecting with you. We value accurate communication and strong partner relationships, and we look forward to supporting you whenever there is a suitable destination requirement.

{{signature}}`,
    emailSubject: "Company details updated",
    emailHtml: emailShell({
      title: "Company Details Updated",
      subtitle: "Thank You for the Correction",
      introLine:
        "Accurate communication helps us build stronger partner relationships.",
      preheader: "Thank you for sharing the correction",
      bodyHtml: `
        ${p("Thank you {{spocName}}, noted.")}
        ${p("We have updated the company name as <strong>{{agencyName}}</strong>.")}
        ${p("It was nice connecting with you. We value accurate communication and strong partner relationships, and we look forward to supporting you whenever there is a suitable destination requirement.")}
      `,
      actionHtml: "",
      showAssetBlock: false
    })
  }),

  template({
    slug: "query-not-received-after-positive-call",
    name: "Query Not Received After Positive Call",
    categoryCode: "requirement",
    intentCodes: ["ask_requirement"],
    outcomeCodes: ["requirement_pending", "followup_required"],
    whatsappText: `Hi {{spocName}},

Hope you are doing well.

Just staying connected as discussed.

Whenever you have any client requirement for Thailand, Dubai, Singapore, Malaysia, Bali or Vietnam, you can share the basic details with us.

Our team will guide you with suitable hotel options, itinerary flow, transfers and sightseeing, helping you create a confident and well-structured proposal for your client.

{{signature}}`,
    emailSubject: "Awaiting your upcoming travel requirement",
    emailHtml: emailShell({
      title: "Staying Connected for Your Travel Requirements",
      subtitle: "Share Your Client Requirement Anytime",
      introLine:
        "We are ready to help you create a confident travel proposal.",
      preheader: "Share your client requirement with {{companyName}}",
      bodyHtml: `
        ${p("Hope you are doing well.")}
        ${p("Just staying connected as discussed.")}
        ${p("Whenever you have any client requirement for Thailand, Dubai, Singapore, Malaysia, Bali or Vietnam, you can share the basic details with us.")}
        ${p("Our team will guide you with suitable hotel options, itinerary flow, transfers and sightseeing, helping you create a confident and well-structured proposal for your client.")}
      `,
      actionHtml:
        "Please share the destination, travel dates, pax count, hotel preference and approximate budget whenever available."
    })
  }),

  template({
    slug: "vague-query-checklist",
    name: "Agent Sends Vague Query - Requirement Checklist",
    categoryCode: "requirement",
    intentCodes: ["ask_requirement"],
    outcomeCodes: ["requirement_pending", "quote_needed"],
    whatsappText: `Sure {{spocName}}, we will be happy to work on this requirement.

To design the package properly and suggest the most suitable options, please share a few basic details:

Travel dates:
Number of nights:
Adults and children with age:
Hotel category:
Number of rooms:
Transfer preference: SIC / Private
Any must-include sightseeing:
Approx budget, if any:

Once received, we will structure the itinerary and share a suitable land package quotation that matches your client’s travel expectation.

{{signature}}`,
    emailSubject: "Details required to plan {{destination}} package",
    emailHtml: emailShell({
      title: "Requirement Details Needed",
      subtitle: "Let’s Plan the Package Properly",
      introLine:
        "A clear requirement helps us suggest the most suitable travel options.",
      preheader: "Please share details to plan the package properly",
      bodyHtml: `
        ${p("Sure {{spocName}}, we will be happy to work on this requirement.")}
        ${p("To design the package properly and suggest the most suitable options, please share a few basic details:")}
        ${ul([
        "Travel dates",
        "Number of nights",
        "Adults and children with age",
        "Hotel category",
        "Number of rooms",
        "Transfer preference: SIC / Private",
        "Any must-include sightseeing",
        "Approx budget, if any"
      ])}
      `,
      actionHtml:
        "Once received, we will structure the itinerary and share a suitable land package quotation that matches your client’s travel expectation."
    })
  }),

  template({
    slug: "query-details-received",
    name: "Query Details Received",
    categoryCode: "requirement",
    intentCodes: ["ask_requirement"],
    outcomeCodes: ["requirement_received", "quote_needed"],
    whatsappText: `Noted {{spocName}}.

We have received the travel details.

Our team will now check the suitable hotel options, routing, transfers and sightseeing flow carefully, so we can share a well-planned quotation for your client.

{{signature}}`,
    emailSubject: "Travel details received",
    emailHtml: emailShell({
      title: "Travel Details Received",
      subtitle: "Our Team Will Review the Requirement",
      introLine:
        "We will now check suitable options and prepare the next step.",
      preheader: "We will now prepare suitable options",
      bodyHtml: `
        ${p("Noted {{spocName}}.")}
        ${p("We have received the travel details.")}
        ${p("Our team will now check the suitable hotel options, routing, transfers and sightseeing flow carefully, so we can share a well-planned quotation for your client.")}
      `,
      actionHtml:
        "We will share the quotation or suitable options after checking the requirement carefully."
    })
  }),

  template({
    slug: "quotation-shared-on-email",
    name: "Quotation Shared on Email",
    categoryCode: "quotation",
    intentCodes: ["quote_follow_up"],
    outcomeCodes: ["quote_shared"],
    whatsappText: `Hi {{spocName}},

We have shared the quotation on email as per the discussed requirement.

Kindly check the hotel options, inclusions and package details. If your client needs any change in hotel category, itinerary flow, sightseeing or budget, please let us know.

We will revise it thoughtfully and help you move forward with a stronger proposal.

{{signature}}`,
    emailSubject: "{{destination}} quotation shared",
    emailHtml: emailShell({
      title: "Quotation Shared",
      subtitle: "Please Review the Package Details",
      introLine:
        "The quotation has been planned thoughtfully for your client’s requirement.",
      preheader: "{{destination}} quotation has been shared",
      bodyHtml: `
        ${p("We have shared the quotation as per the discussed requirement.")}
        ${p("Kindly check the hotel options, inclusions and package details. If your client needs any change in hotel category, itinerary flow, sightseeing or budget, please let us know.")}
        ${p("We will revise it thoughtfully and help you move forward with a stronger proposal.")}
      `,
      actionHtml:
        "Please review the quotation and share your client’s feedback or changes required."
    })
  }),

  template({
    slug: "quotation-follow-up",
    name: "Quotation Follow-Up",
    categoryCode: "quotation",
    intentCodes: ["quote_follow_up"],
    outcomeCodes: ["quote_shared", "followup_required"],
    whatsappText: `Hi {{spocName}},

Just checking if you had a chance to review the quotation shared for {{destination}}.

Please let us know if your client would like any changes in hotel option, inclusions, sightseeing or budget.

We will be happy to refine the package and support you in converting the requirement smoothly.

{{signature}}`,
    emailSubject: "Follow-up on {{destination}} quotation",
    emailHtml: emailShell({
      title: "Quotation Follow-Up",
      subtitle: "Checking for Client Feedback",
      introLine:
        "We are ready to refine the package and support conversion.",
      preheader: "Checking for feedback on {{destination}} quotation",
      bodyHtml: `
        ${p("Just checking if you had a chance to review the quotation shared for <strong>{{destination}}</strong>.")}
        ${p("Please let us know if your client would like any changes in hotel option, inclusions, sightseeing or budget.")}
        ${p("We will be happy to refine the package and support you in converting the requirement smoothly.")}
      `,
      actionHtml:
        "Please share client feedback, required changes or confirmation so we can proceed further."
    })
  }),

  template({
    slug: "revised-quotation-shared",
    name: "Revised Quotation Shared",
    categoryCode: "quotation",
    intentCodes: ["revision_confirmation"],
    outcomeCodes: ["revision_needed", "quote_shared"],
    whatsappText: `Hi {{spocName}},

We have revised the quotation as per the requested changes and shared the updated version on email.

Kindly review the revised hotel options, inclusions and package cost.

We have aligned the changes to make the package more suitable for your client’s expectation. Please let us know if this is fine to proceed further.

{{signature}}`,
    emailSubject: "Revised {{destination}} quotation shared",
    emailHtml: emailShell({
      title: "Revised Quotation Shared",
      subtitle: "Updated as per Requested Changes",
      introLine:
        "The package has been refined to better match your client’s expectation.",
      preheader: "Updated quotation as per requested changes",
      bodyHtml: `
        ${p("We have revised the quotation as per the requested changes and shared the updated version.")}
        ${p("Kindly review the revised hotel options, inclusions and package cost.")}
        ${p("We have aligned the changes to make the package more suitable for your client’s expectation.")}
      `,
      actionHtml:
        "Please confirm if this is fine to proceed further or if any additional revision is required."
    })
  }),

  template({
    slug: "confirmation-follow-up",
    name: "Confirmation Follow-Up",
    categoryCode: "quotation",
    intentCodes: ["hot_lead_follow_up", "quote_follow_up"],
    outcomeCodes: ["quote_shared", "followup_required"],
    whatsappText: `Hi {{spocName}},

Just checking if we can proceed further with the shared package.

The package has been planned as per the discussed requirement, and we would be happy to move ahead once your client is comfortable.

Rooms and rates are subject to availability at the time of confirmation, so once the client gives the final go-ahead, please share the required details and documents.

{{signature}}`,
    emailSubject: "Confirmation follow-up for {{destination}} package",
    emailHtml: emailShell({
      title: "Confirmation Follow-Up",
      subtitle: "Ready to Proceed Further",
      introLine:
        "Early confirmation helps us check availability and move ahead smoothly.",
      preheader: "Checking if we can proceed with the shared package",
      bodyHtml: `
        ${p("Just checking if we can proceed further with the shared package.")}
        ${p("The package has been planned as per the discussed requirement, and we would be happy to move ahead once your client is comfortable.")}
        ${p("Rooms and rates are subject to availability at the time of confirmation.")}
      `,
      actionHtml:
        "Once the client gives the final go-ahead, please share the required details and documents."
    })
  }),

  template({
    slug: "documents-required-after-confirmation",
    name: "Documents Required After Confirmation",
    categoryCode: "booking",
    intentCodes: ["ask_requirement"],
    outcomeCodes: ["requirement_pending", "general_update"],
    whatsappText: `Noted {{spocName}}.

Thank you for the confirmation.

To move ahead with the booking process smoothly, please share the below details:

Guest full names as per passport:
Passport copies:
Final travel dates:
Arrival and departure flight details:
Rooming list:
Meal preference, if any:
Any special request:

Once received, we will proceed with the file and coordinate the next steps carefully from our side.

{{signature}}`,
    emailSubject: "Documents required for booking process",
    emailHtml: emailShell({
      title: "Documents Required",
      subtitle: "Details Needed for Booking Process",
      introLine:
        "Complete guest details help us move the booking forward smoothly.",
      preheader: "Details needed to move ahead with booking",
      bodyHtml: `
        ${p("Noted {{spocName}}. Thank you for the confirmation.")}
        ${p("To move ahead with the booking process smoothly, please share the below details:")}
        ${ul([
        "Guest full names as per passport",
        "Passport copies",
        "Final travel dates",
        "Arrival and departure flight details",
        "Rooming list",
        "Meal preference, if any",
        "Any special request"
      ])}
      `,
      actionHtml:
        "Once received, we will proceed with the file and coordinate the next steps carefully from our side."
    })
  }),

  template({
    slug: "payment-invoice-shared",
    name: "Payment / Invoice Shared",
    categoryCode: "payment",
    intentCodes: ["payment_reminder"],
    outcomeCodes: ["payment_pending"],
    whatsappText: `Hi {{spocName}},

The invoice has been shared on email for the confirmed package.

Kindly arrange the payment as per the invoice details so that we can move ahead with the booking and operations process.

Once the payment is completed, our team will take the file forward with the required coordination.

{{signature}}`,
    emailSubject: "Invoice shared for confirmed package",
    emailHtml: emailShell({
      title: "Invoice Shared",
      subtitle: "Payment Request for Confirmed Package",
      introLine:
        "Once payment is completed, our team can take the file forward smoothly.",
      preheader: "Payment request for confirmed package",
      bodyHtml: `
        ${p("The invoice has been shared for the confirmed package.")}
        ${p("Kindly arrange the payment as per the invoice details so that we can move ahead with the booking and operations process.")}
        ${p("Once the payment is completed, our team will take the file forward with the required coordination.")}
      `,
      actionHtml:
        "Please share the payment update once completed so our team can proceed smoothly."
    })
  }),

  template({
    slug: "payment-received",
    name: "Payment Received",
    categoryCode: "payment",
    intentCodes: ["thank_you_relationship"],
    outcomeCodes: ["general_update"],
    whatsappText: `Hi {{spocName}},

Payment received. Thank you.

The file will now move forward to our operations team for booking and coordination.

We will keep you updated on the next steps and ensure the arrangements are handled smoothly from our side.

{{signature}}`,
    emailSubject: "Payment received - thank you",
    emailHtml: emailShell({
      title: "Payment Received",
      subtitle: "File Moving to Operations",
      introLine:
        "Thank you. The booking and coordination process will now move ahead.",
      preheader: "The file will now move to operations",
      bodyHtml: `
        ${p("Payment received. Thank you.")}
        ${p("The file will now move forward to our operations team for booking and coordination.")}
        ${p("We will keep you updated on the next steps and ensure the arrangements are handled smoothly from our side.")}
      `,
      actionHtml:
        "Our team will coordinate the booking and operations process from here.",
      showAssetBlock: false
    })
  }),

  template({
    slug: "vouchers-final-documents-shared",
    name: "Vouchers / Final Documents Shared",
    categoryCode: "documents",
    intentCodes: ["thank_you_relationship"],
    outcomeCodes: ["general_update"],
    whatsappText: `Hi {{spocName}},

Final travel documents have been shared on email for your reference.

Kindly check the vouchers, transfer details and service confirmations once.

These documents are important for a smooth travel experience, so please let us know if anything needs to be reviewed.

{{signature}}`,
    emailSubject: "Final travel documents shared",
    emailHtml: emailShell({
      title: "Final Travel Documents Shared",
      subtitle: "Please Review the Travel Documents",
      introLine:
        "Final documents are important for a smooth travel experience.",
      preheader: "Please check vouchers and service confirmations",
      bodyHtml: `
        ${p("Final travel documents have been shared for your reference.")}
        ${p("Kindly check the vouchers, transfer details and service confirmations once.")}
        ${p("These documents are important for a smooth travel experience, so please let us know if anything needs to be reviewed.")}
      `,
      actionHtml:
        "Please review the vouchers, transfer details and service confirmations once."
    })
  }),

  template({
    slug: "pre-travel-reminder",
    name: "Pre-Travel Reminder",
    categoryCode: "operations",
    intentCodes: ["thank_you_relationship"],
    outcomeCodes: ["future_follow_up", "general_update"],
    whatsappText: `Hi {{spocName}},

This is a pre-travel reminder for your client’s upcoming {{destination}} trip.

Request you to kindly ensure the guests are carrying all required travel documents, hotel vouchers and service confirmations.

Our operations team will coordinate the on-ground services as per the confirmed itinerary, helping your clients travel with comfort and confidence.

{{signature}}`,
    emailSubject: "Pre-travel reminder for {{destination}} trip",
    emailHtml: emailShell({
      title: "Pre-Travel Reminder",
      subtitle: "Before the Journey Begins",
      introLine:
        "A small check before travel helps create a smoother experience.",
      preheader: "Important reminder for upcoming {{destination}} trip",
      bodyHtml: `
        ${p("This is a pre-travel reminder for your client’s upcoming <strong>{{destination}}</strong> trip.")}
        ${p("Request you to kindly ensure the guests are carrying all required travel documents, hotel vouchers and service confirmations.")}
        ${p("Our operations team will coordinate the on-ground services as per the confirmed itinerary, helping your clients travel with comfort and confidence.")}
      `,
      actionHtml:
        "Please ensure the guests have all required documents and confirmations before travel.",
      showAssetBlock: false
    })
  }),

  template({
    slug: "on-trip-service-check",
    name: "On-Trip Service Check",
    categoryCode: "operations",
    intentCodes: ["thank_you_relationship"],
    outcomeCodes: ["general_update"],
    whatsappText: `Hi {{spocName}},

Hope the guests are comfortable and enjoying their journey.

Just checking if everything is going smoothly as per the planned services.

Please let us know if any support is required from our side. We are here to assist and ensure the experience remains smooth for your clients.

{{signature}}`,
    emailSubject: "On-trip service check",
    emailHtml: emailShell({
      title: "On-Trip Service Check",
      subtitle: "Checking the Travel Experience",
      introLine:
        "We are here to support if any on-ground assistance is required.",
      preheader: "Checking if the journey is going smoothly",
      bodyHtml: `
        ${p("Hope the guests are comfortable and enjoying their journey.")}
        ${p("Just checking if everything is going smoothly as per the planned services.")}
        ${p("Please let us know if any support is required from our side. We are here to assist and ensure the experience remains smooth for your clients.")}
      `,
      actionHtml:
        "Please let us know if any support is required from our side.",
      showAssetBlock: false
    })
  }),

  template({
    slug: "trip-completed-feedback",
    name: "Trip Completed / Feedback",
    categoryCode: "feedback",
    intentCodes: ["thank_you_relationship"],
    outcomeCodes: ["general_update"],
    whatsappText: `Hi {{spocName}},

Hope your clients had a smooth, memorable and joyful trip.

It was a pleasure handling this file from our side.

Please do share your feedback whenever convenient. Your feedback helps us improve, create better travel experiences and support you even more strongly in future requirements.

We look forward to working with you again.

{{signature}}`,
    emailSubject: "Feedback request for completed trip",
    emailHtml: emailShell({
      title: "Trip Completed",
      subtitle: "Feedback Request",
      introLine:
        "Your feedback helps us improve and create better travel experiences.",
      preheader: "We hope your clients had a memorable trip",
      bodyHtml: `
        ${p("Hope your clients had a smooth, memorable and joyful trip.")}
        ${p("It was a pleasure handling this file from our side.")}
        ${p("Please do share your feedback whenever convenient. Your feedback helps us improve, create better travel experiences and support you even more strongly in future requirements.")}
        ${p("We look forward to working with you again.")}
      `,
      actionHtml:
        "Please share your feedback whenever convenient.",
      showAssetBlock: false
    })
  }),

  template({
    slug: "not-interested-no-current-movement",
    name: "Not Interested / No Current Movement",
    categoryCode: "reconnect",
    intentCodes: ["lost_lead_reconnect"],
    outcomeCodes: ["not_interested"],
    whatsappText: `Sure {{spocName}}, understood.

We will stay connected.

Whenever you have any requirement for Thailand, Dubai, Singapore, Malaysia, Bali or Vietnam in the future, please feel free to reach out.

We will be happy to support you with destination guidance, creative package planning and reliable on-ground coordination whenever the right opportunity comes.

{{signature}}`,
    emailSubject: "Staying connected for future requirements",
    emailHtml: emailShell({
      title: "Staying Connected",
      subtitle: "For Future Travel Requirements",
      introLine:
        "We will be happy to support whenever the right opportunity comes.",
      preheader: "We will be happy to support future requirements",
      bodyHtml: `
        ${p("Sure {{spocName}}, understood.")}
        ${p("We will stay connected.")}
        ${p("Whenever you have any requirement for Thailand, Dubai, Singapore, Malaysia, Bali or Vietnam in the future, please feel free to reach out.")}
        ${p("We will be happy to support you with destination guidance, creative package planning and reliable on-ground coordination whenever the right opportunity comes.")}
      `,
      actionHtml:
        "Please feel free to reach out whenever there is a suitable destination requirement.",
      showAssetBlock: false
    })
  }),

  template({
    slug: "director-meeting-request",
    name: "Director Meeting Request",
    categoryCode: "meeting",
    intentCodes: ["meeting_follow_up"],
    outcomeCodes: ["meeting_scheduled", "followup_required"],
    whatsappText: `Hi {{spocName}},

It was good connecting with you.

Our directors are meeting selected travel partners personally to understand their destination focus, working style and future business opportunities.

At DreamTrawell, we believe strong partnerships are built through meaningful conversations, shared vision and long-term growth.

Please let us know if you would be comfortable for a short meeting at your convenience.

{{signature}}`,
    emailSubject: "Meeting request from {{companyName}}",
    emailHtml: emailShell({
      title: "Meeting Request",
      subtitle: "Let’s Understand Your Destination Focus",
      introLine:
        "Strong partnerships are built through meaningful conversations.",
      preheader: "A short meeting to understand your destination focus",
      bodyHtml: `
        ${p("It was good connecting with you.")}
        ${p("Our directors are meeting selected travel partners personally to understand their destination focus, working style and future business opportunities.")}
        ${p("At DreamTrawell, we believe strong partnerships are built through meaningful conversations, shared vision and long-term growth.")}
      `,
      actionHtml:
        "Please let us know if you would be comfortable for a short meeting at your convenience.",
      showAssetBlock: false
    })
  })
];

/* =========================
   HELPERS
========================= */

export function getDefaultCommunicationTemplates() {
  return DEFAULT_COMMUNICATION_TEMPLATES.map(template => ({
    ...template,
    createdAt: null,
    updatedAt: null
  }));
}

export function getDefaultTemplateBySlug(slug = "") {
  return DEFAULT_COMMUNICATION_TEMPLATES.find(
    template => template.slug === slug
  );
}

export function getDefaultTemplatesByIntent(intentCode = "") {
  return DEFAULT_COMMUNICATION_TEMPLATES.filter(template =>
    Array.isArray(template.intentCodes)
      ? template.intentCodes.includes(intentCode)
      : false
  );
}

export function getDefaultTemplatesByOutcome(outcomeCode = "") {
  return DEFAULT_COMMUNICATION_TEMPLATES.filter(template =>
    Array.isArray(template.outcomeCodes)
      ? template.outcomeCodes.includes(outcomeCode)
      : false
  );
}

export function getDefaultTemplatesByChannel(channel = "") {
  return DEFAULT_COMMUNICATION_TEMPLATES.filter(template =>
    template.channels?.[channel] === true
  );
}