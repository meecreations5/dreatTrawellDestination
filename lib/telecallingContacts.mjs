// Contact lookup for authorised Telecalling and assigned-executive views.
// Read existing Travel Agent fields (including legacy imports); do not alter Firestore data.
const clean = value => (typeof value === "string" || typeof value === "number") ? String(value).trim() : "";
const first = (...values) => values.map(clean).find(Boolean) || "";
const object = value => value && typeof value === "object" && !Array.isArray(value) ? value : {};

// Deliberately check only fields that describe a contact number. Never treat account,
// GST, PAN, postal, registration or other numeric fields as phone numbers.
const PHONE_FIELDS = [
  "mobile", "phone", "mobileNumber", "phoneNumber", "contactNumber", "contactPhone",
  "whatsapp", "whatsappNumber", "whatsAppNumber", "spocMobile", "spocPhone",
  "primaryPhone", "primaryMobile", "primaryWhatsapp", "officePhone", "officeMobile",
  "alternatePhone", "alternateMobile", "secondaryPhone", "secondaryMobile",
  "phone1", "phone2", "mobile1", "mobile2", "telephone", "telephoneNumber",
  "landline", "landlineNumber", "mobileNo", "phoneNo", "contactNo", "businessPhone",
  "phone_number", "mobile_number", "contact_phone", "contact_mobile",
  "phoneNumbers", "mobileNumbers", "whatsappNumbers", "phones", "mobiles"
];

export function telephoneHref(value) {
  const raw = clean(value);
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15 || /^(\d)\1+$/.test(digits)) return "";
  return `tel:${raw.startsWith("+") ? "+" : ""}${digits}`;
}

export function emailHref(value) {
  const email = clean(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? `mailto:${encodeURIComponent(email)}` : "";
}

function phoneCandidates(value) {
  // An old import may have saved "9876543210 / 9123456780" in one field.
  // This is only applied to known phone fields, not arbitrary text or notes.
  if (Array.isArray(value)) return value.flatMap(phoneCandidates);
  return clean(value).split(/\s*[,;|/]\s*/).map(part => part.trim()).filter(Boolean);
}

function phonesFrom(...sources) {
  const seen = new Set();
  const results = [];
  for (const source of sources) {
    const row = object(source);
    for (const field of PHONE_FIELDS) {
      for (const candidate of phoneCandidates(row[field])) {
        if (!telephoneHref(candidate)) continue;
        const digits = candidate.replace(/\D/g, "");
        if (!seen.has(digits)) { seen.add(digits); results.push(candidate); }
      }
    }
  }
  return results;
}

function contactFor(value, { key, index = -1, kind, defaultName = "", primary = false } = {}) {
  const row = object(value);
  const phones = phonesFrom(row);
  return {
    key, index, kind,
    name: first(row.name, row.contactName, row.fullName, row.personName) || defaultName,
    phone: phones[0] || "", phones,
    email: first(row.email, row.emailId, row.contactEmail, row.workEmail),
    designation: first(row.designation, row.department),
    isPrimary: primary || row.isPrimary === true
  };
}

export function getTelecallingContacts(agent) {
  const row = object(agent);
  const spocRecords = Array.isArray(row.spocs) ? row.spocs : (row.spocs && typeof row.spocs === "object" ? [row.spocs] : []);
  const people = spocRecords
    .map((entry, index) => contactFor(entry, { key: `spoc-${index}`, index, kind: "person" }))
    .filter(c => c.name || c.phones.length || c.email)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.index - b.index);

  // Some older records use a contact object/list rather than the new spocs array.
  const legacyContainers = ["contacts", "additionalContacts", "alternateContacts", "contactPersons", "contactDetails", "primaryContact", "alternateContact", "contact"];
  const extra = [];
  for (const container of legacyContainers) {
    const value = row[container];
    const entries = Array.isArray(value) ? value : (value && typeof value === "object" ? [value] : []);
    entries.forEach((entry, index) => {
      const candidate = contactFor(entry, { key: `${container}-${index}`, index: -1, kind: "extra", defaultName: "Additional contact" });
      if (!candidate.phones.length && !candidate.email) return;
      // A legacy record may repeat the same SPOC as an extra contact.
      if (candidate.phones.length &&
          candidate.phones.every(phone => people.some(p => p.phones.includes(phone))) &&
          (!candidate.email || people.some(p => p.email.toLowerCase() === candidate.email.toLowerCase()))) return;
      extra.push(candidate);
    });
  }

  const generic = object(row.genericContact);
  const agencyPhones = phonesFrom(generic, row);
  const agency = {
    key: "agency", index: -1, kind: "agency",
    name: first(row.contactPerson, row.contactName, row.spocName, row.primaryContactName) || "Agency / office",
    phone: agencyPhones[0] || "", phones: agencyPhones,
    email: first(generic.email, row.email, row.contactEmail, row.primaryEmail),
    designation: "General contact", isPrimary: false
  };
  const others = [...people, ...extra];
  const hasUniqueAgencyPhone = agency.phones.some(phone => !others.some(c => c.phones.includes(phone)));
  const hasUniqueAgencyEmail = agency.email && !others.some(c => c.email.toLowerCase() === agency.email.toLowerCase());
  if (hasUniqueAgencyPhone || hasUniqueAgencyEmail || (!others.length && (agency.phones.length || agency.email || clean(row.contactPerson)))) {
    others.push(agency);
  }
  return others;
}

export function hasTelecallingPhone(agent) {
  return getTelecallingContacts(agent).some(contact => contact.phones.length > 0);
}

export function getPreferredTelecallingContact(agent) {
  const contacts = getTelecallingContacts(agent);
  // Never attach a phone from one named SPOC to a different SPOC's name.
  return contacts.find(c => c.isPrimary && c.phone) ||
    contacts.find(c => c.kind === "person" && c.phone) ||
    contacts.find(c => c.phone) ||
    contacts.find(c => c.isPrimary) ||
    contacts[0] || { name: "", phone: "", phones: [], email: "", designation: "", index: -1, kind: "missing" };
}

export function getTelecallingContactSearchText(agent) {
  const row = object(agent);
  const contacts = getTelecallingContacts(row);
  return [
    row.agencyName, row.name, row.agentName, row.agentCode,
    row.city, object(row.address).city, object(row.address).state,
    ...contacts.flatMap(c => [c.name, ...c.phones, c.email, c.designation])
  ].map(clean).filter(Boolean).join(" ").toLowerCase();
}
