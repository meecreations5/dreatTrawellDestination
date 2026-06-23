// lib/quotationTemplateService.js

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "firebase/firestore";

import { db } from "@/lib/firebase";

/* =========================
   COLLECTION
========================= */

export const DESTINATION_QUOTATION_TEMPLATES_COLLECTION =
  "destination_quotation_templates";

/* =========================
   AUTO SECTION KEYS
========================= */

export const QUOTATION_AUTO_SECTION_KEYS = [
  "customerVisibleNote",
  "costExcludes",
  "importantTerms",
  "localOperationalNotes",
  "holidayList",
  "beachClubNotes",
  "beachClubTerms",
  "vehicleRules",
  "arrivalRequirements",
  "tourismLevy",
  "visaNotes",
  "regulationDisclaimer"
];

export const QUOTATION_SECTION_LABELS = {
  customerVisibleNote: "Customer Visible Note",
  costExcludes: "Cost Excludes",
  importantTerms: "Important Notes & Terms",
  localOperationalNotes: "Local Operational Notes",
  holidayList: "Holiday List",
  beachClubNotes: "Beach Club Notes",
  beachClubTerms: "Beach Club Terms & Conditions",
  vehicleRules: "Vehicle Rules",
  arrivalRequirements: "Arrival Requirements",
  tourismLevy: "Tourism Levy",
  visaNotes: "Destination Visa Notes",
  regulationDisclaimer: "Regulation Disclaimer"
};

export const QUOTATION_SECTION_TYPES = [
  {
    value: "bullets",
    label: "Bullet List"
  },
  {
    value: "table",
    label: "Table"
  },
  {
    value: "html",
    label: "Rich Text / HTML"
  },
  {
    value: "text",
    label: "Plain Text"
  }
];

/* =========================
   HELPERS
========================= */

export function cleanString(value = "") {
  return String(value || "").trim();
}

export function slugifyDestination(value = "") {
  return cleanString(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function createEmptyQuotationSection(key = "") {
  return {
    enabled: false,
    defaultIncluded: false,
    title: QUOTATION_SECTION_LABELS[key] || "Section",
    type: "bullets",
    items: [],
    columns: [],
    rows: [],
    html: "",
    text: ""
  };
}

export function normalizeQuotationSection(section = {}, key = "") {
  const fallback = createEmptyQuotationSection(key);

  const type = cleanString(section?.type || fallback.type);

  return {
    enabled:
      typeof section?.enabled === "boolean"
        ? section.enabled
        : fallback.enabled,

    defaultIncluded:
      typeof section?.defaultIncluded === "boolean"
        ? section.defaultIncluded
        : fallback.defaultIncluded,

    title: cleanString(section?.title) || fallback.title,

    type: ["bullets", "table", "html", "text"].includes(type)
      ? type
      : fallback.type,

    items: Array.isArray(section?.items)
      ? section.items.map(item => cleanString(item)).filter(Boolean)
      : [],

    columns: Array.isArray(section?.columns)
      ? section.columns.map(item => cleanString(item)).filter(Boolean)
      : [],

    rows: Array.isArray(section?.rows)
      ? section.rows
        .filter(row => Array.isArray(row))
        .map(row => row.map(cell => cleanString(cell)))
      : [],

    html: cleanString(section?.html),
    text: cleanString(section?.text)
  };
}

export function normalizeDestinationQuotationTemplate(raw = {}, id = "") {
  const sections = {};

  QUOTATION_AUTO_SECTION_KEYS.forEach(key => {
    sections[key] = normalizeQuotationSection(raw?.sections?.[key], key);
  });

  return {
    id: id || raw?.id || "",
    templateId: id || raw?.templateId || raw?.id || "",

    destinationId:
      cleanString(raw?.destinationId) ||
      cleanString(raw?.templateId) ||
      id,

    destinationName: cleanString(raw?.destinationName),
    country: cleanString(raw?.country),
    active: raw?.active !== false,

    aliases: Array.isArray(raw?.aliases)
      ? raw.aliases.map(item => cleanString(item)).filter(Boolean)
      : [],

    sections,

    createdAt: raw?.createdAt || null,
    updatedAt: raw?.updatedAt || null
  };
}

export function getDefaultSelectedAutoSections(template = {}) {
  const selected = {};
  const sections = template?.sections || {};

  QUOTATION_AUTO_SECTION_KEYS.forEach(key => {
    const section = sections[key];

    selected[key] = Boolean(
      section?.enabled &&
      section?.defaultIncluded
    );
  });

  return selected;
}

export function buildDestinationTemplateSnapshot(template = {}) {
  const normalized = normalizeDestinationQuotationTemplate(
    template,
    template?.id || template?.templateId || template?.destinationId || ""
  );

  return JSON.parse(
    JSON.stringify({
      templateId:
        normalized.templateId ||
        normalized.destinationId ||
        normalized.id,
      destinationId: normalized.destinationId,
      destinationName: normalized.destinationName,
      country: normalized.country,
      sections: normalized.sections
    })
  );
}

/* =========================
   READ SERVICES
========================= */

export async function getDestinationQuotationTemplate(destinationValue = "") {
  const cleanValue = cleanString(destinationValue);

  if (!cleanValue) return null;

  const slug = slugifyDestination(cleanValue);

  const possibleIds = Array.from(
    new Set([
      cleanValue,
      slug
    ].filter(Boolean))
  );

  for (const id of possibleIds) {
    try {
      const snap = await getDoc(
        doc(db, DESTINATION_QUOTATION_TEMPLATES_COLLECTION, id)
      );

      if (snap.exists()) {
        return normalizeDestinationQuotationTemplate(
          snap.data(),
          snap.id
        );
      }
    } catch {
      // Continue fallback search.
    }
  }

  try {
    const nameQuery = query(
      collection(db, DESTINATION_QUOTATION_TEMPLATES_COLLECTION),
      where("destinationName", "==", cleanValue)
    );

    const nameSnap = await getDocs(nameQuery);

    if (!nameSnap.empty) {
      const firstDoc = nameSnap.docs[0];

      return normalizeDestinationQuotationTemplate(
        firstDoc.data(),
        firstDoc.id
      );
    }
  } catch {
    // Continue fallback search.
  }

  try {
    const aliasQuery = query(
      collection(db, DESTINATION_QUOTATION_TEMPLATES_COLLECTION),
      where("aliases", "array-contains", cleanValue)
    );

    const aliasSnap = await getDocs(aliasQuery);

    if (!aliasSnap.empty) {
      const firstDoc = aliasSnap.docs[0];

      return normalizeDestinationQuotationTemplate(
        firstDoc.data(),
        firstDoc.id
      );
    }
  } catch {
    // Ignore.
  }

  return null;
}

export async function getActiveDestinationQuotationTemplates() {
  const snap = await getDocs(
    query(
      collection(db, DESTINATION_QUOTATION_TEMPLATES_COLLECTION),
      where("active", "==", true)
    )
  );

  return snap.docs
    .map(docSnap =>
      normalizeDestinationQuotationTemplate(
        docSnap.data(),
        docSnap.id
      )
    )
    .sort((a, b) =>
      a.destinationName.localeCompare(b.destinationName)
    );
}

/* =========================
   WRITE SERVICE FOR ADMIN PAGE
========================= */

export async function upsertDestinationQuotationTemplate({
  templateId = "",
  destinationId = "",
  sourceDestinationId = "",
  linkedDestinationId = "",
  destinationCode = "",
  destinationSlug = "",

  destinationName = "",
  country = "",
  aliases = [],
  active = true,
  sections = {},
  user = null
}) {
  const cleanDestinationName = cleanString(destinationName);

  if (!cleanDestinationName) {
    throw new Error("Destination name is required");
  }

  const cleanSourceDestinationId = cleanString(
    sourceDestinationId ||
      linkedDestinationId ||
      destinationId
  );

  const cleanDestinationCode = cleanString(destinationCode);

  const cleanDestinationSlug =
    cleanString(destinationSlug) ||
    slugifyDestination(cleanDestinationName);

  const cleanTemplateId =
    cleanString(templateId) ||
    cleanSourceDestinationId ||
    cleanDestinationCode ||
    cleanDestinationSlug;

  const normalizedSections = {};

  QUOTATION_AUTO_SECTION_KEYS.forEach(key => {
    normalizedSections[key] = normalizeQuotationSection(
      sections?.[key],
      key
    );
  });

  const normalizedAliases = Array.from(
    new Set(
      [
        ...(Array.isArray(aliases)
          ? aliases.map(item => cleanString(item))
          : []),

        cleanDestinationName,
        country ? `${cleanDestinationName}, ${cleanString(country)}` : "",
        cleanDestinationCode,
        cleanDestinationSlug,
        cleanSourceDestinationId
      ].filter(Boolean)
    )
  );

  const payload = {
    templateId: cleanTemplateId,

    destinationId: cleanTemplateId,

    sourceDestinationId: cleanSourceDestinationId,
    linkedDestinationId: cleanSourceDestinationId,

    destinationCode: cleanDestinationCode,
    destinationSlug: cleanDestinationSlug,

    destinationName: cleanDestinationName,
    country: cleanString(country),

    aliases: normalizedAliases,

    active: Boolean(active),
    sections: normalizedSections,

    updatedAt: serverTimestamp(),
    updatedByUid: user?.uid || user?.id || user?.email || "",
    updatedByName:
      user?.displayName ||
      user?.name ||
      user?.fullName ||
      user?.email ||
      ""
  };

  await setDoc(
    doc(
      db,
      DESTINATION_QUOTATION_TEMPLATES_COLLECTION,
      cleanTemplateId
    ),
    {
      ...payload,
      createdAt: serverTimestamp()
    },
    {
      merge: true
    }
  );

  return {
    id: cleanTemplateId,
    ...payload
  };
}