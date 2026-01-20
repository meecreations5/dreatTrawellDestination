import { sendEmailViaBrevo } from "./sendEmailViaBrevo";
import { sendWhatsAppWeb } from "./whatsapp";

/**
 * Send Email + WhatsApp notification on Lead Creation
 */
export async function sendLeadNotifications({
  spoc,
  leadCode,
  destinationName
}) {
  if (!spoc) return;

  /* =========================
     EMAIL (BREVO)
  ========================== */
  if (spoc.email) {
    await sendEmailViaBrevo({
      toEmail: spoc.email,
      toName: spoc.name,
      subject: `New Travel Lead Created – ${leadCode}`,
      html: `
        Hi ${spoc.name},<br/><br/>
        A new travel lead has been created for you.<br/><br/>
        <b>Lead ID:</b> ${leadCode}<br/>
        <b>Destination:</b> ${destinationName}<br/><br/>
        Our team will connect with you shortly.<br/><br/>
        Regards,<br/>
        DreamTravel Destination
      `
    });
  }

  /* =========================
     WHATSAPP (WEB)
  ========================== */
  if (spoc.mobile) {
    await sendWhatsAppWeb({
      mobile: spoc.mobile,
      message: `Hi ${spoc.name},

Your new travel lead has been created.

Lead ID: ${leadCode}
Destination: ${destinationName}

Our team will connect with you shortly.

– DreamTravel Destination`
    });
  }
}
