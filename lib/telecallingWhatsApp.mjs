// Pure WhatsApp handover helpers.  Message is prepared after assignment;
// the CRM does not claim that a manual WhatsApp chat was actually sent.
const clean = value => String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, 120);

export function normalizeHandoverPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`; // Existing CRM default for Indian mobiles.
  return digits.length >= 11 && digits.length <= 15 ? digits : "";
}

export function canPrepareHandoverWhatsApp(agent) {
  if (!agent || !agent.telecallerHandoffAt || !agent.telecallerHandoffByUid) return false;
  if (!clean(agent.assignedToName) || clean(agent.assignedToName).includes("@")) return false;
  if (agent.preferredCommunication?.whatsapp === false) return false;
  if (agent.whatsappOptOut === true || agent.doNotContact === true) return false;
  const blocked = ["do_not_contact", "blacklisted", "not_interested", "invalid_number"];
  return !blocked.includes(clean(agent.status || agent.agentStatus).toLowerCase().replace(/[\s-]+/g, "_"));
}

export function buildTelecallerHandoverMessage({ contactName, managerName }) {
  const manager = clean(managerName);
  if (!manager || manager.includes("@")) throw new Error("A valid Relationship Manager name is required.");
  const contact = clean(contactName) || "Travel Partner";
  return `Hi ${contact},

Greetings from DreamTrawell Destination DMC!

Thank you for connecting with us.

Your dedicated Relationship Manager, ${manager}, will get in touch with you shortly to understand your upcoming travel requirements and assist you with destination information, quotations and itinerary planning.

We look forward to supporting your business.

Team DreamTrawell
Travel expertise, thoughtfully delivered.`;
}

export function buildTelecallerHandoverWhatsAppUrl({ mobile, message }) {
  const number = normalizeHandoverPhone(mobile);
  return number && String(message || "").trim()
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : "";
}
