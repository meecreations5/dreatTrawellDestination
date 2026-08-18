// lib/resolveTemplateAttachments.js

import { getLatestDocumentVersion } from "./getLatestDocumentVersion";

export async function resolveTemplateAttachments(template) {
  if (!template.attachments?.length) return [];

  const attachment = template.attachments[0];
  const latest = await getLatestDocumentVersion(
    attachment.documentId
  );

  if (!latest) {
    throw new Error("Attachment missing or deleted");
  }

  return [
    {
      name: attachment.name,
      url: latest.url
    }
  ];
}
