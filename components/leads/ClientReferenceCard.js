"use client";

import {
  ExternalLink,
  FileText,
  ImageIcon,
  Paperclip
} from "lucide-react";

function cleanHtml(html = "") {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .trim();
}

function formatSource(source = "") {
  if (!source) return "Not specified";

  return String(source)
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function formatFileSize(size = 0) {
  if (!size) return "";

  const kb = size / 1024;
  const mb = kb / 1024;

  if (mb >= 1) return `${mb.toFixed(1)} MB`;

  return `${kb.toFixed(0)} KB`;
}

export default function ClientReferenceCard({ lead }) {
  const reference = lead?.clientReference || {};

  const source =
    reference.source ||
    lead?.clientReferenceSource ||
    "";

  const notesHtml =
    reference.notesHtml ||
    lead?.clientReferenceNotesHtml ||
    "";

  const notes =
    reference.notes ||
    lead?.clientReferenceNotes ||
    "";

  const attachments = Array.isArray(reference.attachments)
    ? reference.attachments
    : [];

  const hasReference =
    source ||
    notesHtml ||
    notes ||
    attachments.length > 0;

  if (!hasReference) {
    return (
      <div className="bg-white rounded-xl p-4 border border-gray-100">
        <div className="flex items-center gap-2">
          <Paperclip size={16} className="text-gray-400" />
          <p className="text-xs font-medium text-gray-500">
            Client Reference
          </p>
        </div>

        <p className="text-sm text-gray-400 mt-3">
          No client reference added.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-4 border border-blue-100 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Paperclip size={16} className="text-blue-600" />
          <div>
            <p className="text-xs font-medium text-gray-500">
              Client Reference
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {formatSource(source)}
            </p>
          </div>
        </div>

        {attachments.length > 0 && (
          <span className="text-[11px] px-2 py-1 rounded-full bg-blue-50 text-blue-700">
            {attachments.length} file{attachments.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {(notesHtml || notes) && (
        <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
          {notesHtml ? (
            <div
              className="
                text-sm text-gray-700 leading-relaxed
                [&_ul]:list-disc [&_ul]:pl-5
                [&_ol]:list-decimal [&_ol]:pl-5
                [&_blockquote]:border-l-4
                [&_blockquote]:border-blue-200
                [&_blockquote]:pl-3
                [&_blockquote]:text-gray-600
                [&_a]:text-blue-600
                [&_a]:underline
              "
              dangerouslySetInnerHTML={{
                __html: cleanHtml(notesHtml)
              }}
            />
          ) : (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {notes}
            </p>
          )}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">
            Attachments
          </p>

          <div className="grid grid-cols-1 gap-2">
            {attachments.map((file, index) => {
              const isImage =
                file.type === "image" ||
                String(file.mimeType || "").startsWith("image/");

              return (
                <a
                  key={file.path || file.url || `${file.name}-${index}`}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="
                    flex items-center justify-between gap-3
                    border border-gray-100 rounded-lg p-2
                    hover:bg-blue-50 hover:border-blue-100
                    transition
                  "
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isImage ? (
                      file.url ? (
                        <img
                          src={file.url}
                          alt={file.name || "Reference"}
                          className="h-10 w-10 rounded-md object-cover border border-gray-100"
                        />
                      ) : (
                        <ImageIcon size={18} className="text-blue-600" />
                      )
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-orange-50 flex items-center justify-center">
                        <FileText size={18} className="text-orange-600" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {file.name || "Reference file"}
                      </p>

                      <p className="text-xs text-gray-400">
                        {file.type || "file"}
                        {file.size ? ` · ${formatFileSize(file.size)}` : ""}
                      </p>
                    </div>
                  </div>

                  <ExternalLink size={15} className="text-gray-400 shrink-0" />
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}