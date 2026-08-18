// lib/importDefaultCommunicationTemplates.js

import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";

import { db } from "@/lib/firebase";

import {
  DEFAULT_COMMUNICATION_TEMPLATES,
  DEFAULT_COMMUNICATION_TEMPLATE_VERSION,
  DEFAULT_TEMPLATE_SOURCE
} from "@/lib/defaultCommunicationTemplates";

/* =========================
   HELPERS
========================= */

function cleanSlug(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function removeUndefined(value) {
  if (Array.isArray(value)) {
    return value.map(removeUndefined);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc, [key, val]) => {
      if (val === undefined) return acc;
      acc[key] = removeUndefined(val);
      return acc;
    }, {});
  }

  return value;
}

function normalizeTemplate(template = {}) {
  const slug = cleanSlug(template.slug || template.name);

  return removeUndefined({
    ...template,

    slug,
    name: template.name || slug,
    templateType: template.templateType || "message",

    channels: {
      whatsapp: template.channels?.whatsapp !== false,
      email: template.channels?.email !== false
    },

    whatsappText: template.whatsappText || "",
    emailSubject: template.emailSubject || "",
    emailHtml: template.emailHtml || "",

    intentCodes: Array.isArray(template.intentCodes)
      ? template.intentCodes.filter(Boolean)
      : [],

    outcomeCodes: Array.isArray(template.outcomeCodes)
      ? template.outcomeCodes.filter(Boolean)
      : [],

    categoryCode: template.categoryCode || "general",
    categoryName: template.categoryName || template.categoryCode || "General",

    destinationIds: Array.isArray(template.destinationIds)
      ? template.destinationIds
      : [],

    destinationNames: Array.isArray(template.destinationNames)
      ? template.destinationNames
      : [],

    primaryDestination: template.primaryDestination || "",

    defaultAssets: Array.isArray(template.defaultAssets)
      ? template.defaultAssets
      : [],

    defaultAssetIds: Array.isArray(template.defaultAssetIds)
      ? template.defaultAssetIds
      : [],

    defaultAssetTitles: Array.isArray(template.defaultAssetTitles)
      ? template.defaultAssetTitles
      : [],

    active: template.active !== false,
    status: template.status || "active",

    systemTemplate: true,
    editable: template.editable !== false,
    source: template.source || DEFAULT_TEMPLATE_SOURCE,
    version: template.version || DEFAULT_COMMUNICATION_TEMPLATE_VERSION,

    deleted: false,
    isDeleted: false,
    archived: false
  });
}

async function getExistingTemplatesBySlug() {
  const snap = await getDocs(collection(db, "communicationTemplates"));

  const map = new Map();

  snap.docs.forEach(document => {
    const data = document.data();
    const slug = cleanSlug(data?.slug || "");

    if (!slug) return;

    if (!map.has(slug)) {
      map.set(slug, {
        id: document.id,
        ref: document.ref,
        data
      });
    }
  });

  return map;
}

/* =========================
   MAIN IMPORT FUNCTION
========================= */

/**
 * mode:
 * - "missing" = create only missing templates, do not overwrite admin edits
 * - "sync" = update existing default templates from code seed
 */
export async function importDefaultCommunicationTemplates({
  mode = "missing",
  importedByUid = "",
  importedByName = "",
  importedByEmail = ""
} = {}) {
  const templates = DEFAULT_COMMUNICATION_TEMPLATES.map(normalizeTemplate)
    .filter(template => template.slug);

  if (!templates.length) {
    return {
      ok: false,
      created: 0,
      updated: 0,
      skipped: 0,
      total: 0,
      message: "No default templates found."
    };
  }

  const existingBySlug = await getExistingTemplatesBySlug();

  const batch = writeBatch(db);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  templates.forEach(template => {
    const existing = existingBySlug.get(template.slug);

    if (existing && mode !== "sync") {
      skipped += 1;
      return;
    }

    if (existing && mode === "sync") {
      batch.set(
        existing.ref,
        {
          ...template,

          // keep original created metadata if already present
          createdAt: existing.data?.createdAt || serverTimestamp(),
          createdByUid: existing.data?.createdByUid || importedByUid || "",
          createdByName: existing.data?.createdByName || importedByName || "",
          createdByEmail: existing.data?.createdByEmail || importedByEmail || "",

          updatedAt: serverTimestamp(),
          syncedAt: serverTimestamp(),
          syncedByUid: importedByUid || "",
          syncedByName: importedByName || "",
          syncedByEmail: importedByEmail || ""
        },
        { merge: true }
      );

      updated += 1;
      return;
    }

    const ref = doc(db, "communicationTemplates", template.slug);

    batch.set(
      ref,
      {
        ...template,

        usageCount: 0,
        lastUsedAt: null,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        importedAt: serverTimestamp(),

        createdByUid: importedByUid || "",
        createdByName: importedByName || "",
        createdByEmail: importedByEmail || "",

        importedByUid: importedByUid || "",
        importedByName: importedByName || "",
        importedByEmail: importedByEmail || ""
      },
      { merge: true }
    );

    created += 1;
  });

  if (created || updated) {
    await batch.commit();
  }

  return {
    ok: true,
    created,
    updated,
    skipped,
    total: templates.length,
    mode,
    message:
      mode === "sync"
        ? `Synced ${updated} and created ${created} default template(s).`
        : `Imported ${created} missing default template(s). ${skipped} already existed.`
  };
}