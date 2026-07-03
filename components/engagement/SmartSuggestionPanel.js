"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  FileText,
  Mail,
  MessageCircle,
  Package,
  Sparkles,
  Target
} from "lucide-react";

import {
  getIntentOptions
} from "@/lib/suggestCommunicationReply";

/* =========================
   HELPERS
========================= */

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function formatDateTime(value) {
  if (!value) return "—";

  const date =
    value instanceof Date
      ? value
      : typeof value?.toDate === "function"
        ? value.toDate()
        : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function getToneClass(tone = "") {
  const value = String(tone || "").toLowerCase();

  if (value.includes("closing")) {
    return "bg-orange-50 text-orange-700 border-orange-100";
  }

  if (value.includes("soft")) {
    return "bg-green-50 text-green-700 border-green-100";
  }

  if (value.includes("sales")) {
    return "bg-purple-50 text-purple-700 border-purple-100";
  }

  if (value.includes("relationship")) {
    return "bg-pink-50 text-pink-700 border-pink-100";
  }

  return "bg-blue-50 text-blue-700 border-blue-100";
}

function getTemplateTypeClass(type = "") {
  const value = String(type || "").toLowerCase();

  if (value === "package" || value === "itinerary") {
    return "bg-purple-50 text-purple-700 border-purple-100";
  }

  if (value === "promotion") {
    return "bg-orange-50 text-orange-700 border-orange-100";
  }

  if (value === "document") {
    return "bg-cyan-50 text-cyan-700 border-cyan-100";
  }

  return "bg-gray-50 text-gray-700 border-gray-100";
}

function getAssetIcon(asset = {}) {
  const type = String(asset.assetType || "").toLowerCase();

  if (type === "image") return "🖼️";
  if (type === "video") return "🎥";
  if (type === "pdf") return "📄";
  if (type === "link") return "🔗";

  return "📎";
}

function normalizeSuggestionText(suggestion = {}) {
  return getFirstValue(
    suggestion.bodyText,
    suggestion.whatsappText,
    suggestion.emailHtml
  );
}

/* =========================
   COMPONENT
========================= */

export default function SmartSuggestionPanel({
  suggestionData = null,

  intentCode = "",
  onIntentChange,

  channel = "whatsapp",

  onUseSuggestion,
  onUseTemplate,
  onAddAssets,
  onUseNextAction,

  compact = false,
  className = ""
}) {
  const [copiedId, setCopiedId] = useState("");
  const [expandedSuggestionId, setExpandedSuggestionId] = useState("");

  const intentOptions = useMemo(() => {
    return getIntentOptions();
  }, []);

  const intent = suggestionData?.intent || null;
  const context = suggestionData?.context || {};
  const suggestions = Array.isArray(suggestionData?.suggestions)
    ? suggestionData.suggestions
    : [];

  const recommendedTemplates = Array.isArray(
    suggestionData?.recommendedTemplates
  )
    ? suggestionData.recommendedTemplates
    : [];

  const recommendedAssets = Array.isArray(suggestionData?.recommendedAssets)
    ? suggestionData.recommendedAssets
    : [];

  const nextAction = suggestionData?.nextAction || null;

  const copyText = async (text, id) => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);

      window.setTimeout(() => {
        setCopiedId("");
      }, 1600);
    } catch (error) {
      console.error("Copy failed:", error);
      alert("Unable to copy. Please copy manually.");
    }
  };

  if (!suggestionData) {
    return (
      <section
        className={`rounded-2xl border border-gray-100 bg-white p-4 ${className}`}
      >
        <div className="flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Smart Suggestions
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Select agent, destination and channel to generate suggestions.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rounded-2xl border border-gray-100 bg-white overflow-hidden ${className}`}
    >
      {/* HEADER */}
      <div className="border-b border-gray-100 px-4 py-3 bg-gradient-to-r from-blue-50 to-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Smart Suggestions
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Auto-suggested reply, template, assets and next action.
              </p>
            </div>
          </div>

          {channel && (
            <span className="rounded-full border border-blue-100 bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-700 capitalize">
              {channel}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* INTENT */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            <p className="text-xs font-semibold text-gray-800">
              Communication Intent
            </p>
          </div>

          <select
            value={intentCode || intent?.code || ""}
            onChange={e => onIntentChange?.(e.target.value)}
            className="
              w-full rounded-lg border border-gray-200 bg-white px-3 py-2
              text-sm focus:outline-none focus:ring-2 focus:ring-blue-100
            "
          >
            <option value="">Auto Detect</option>

            {intentOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {intent && (
            <div className="rounded-lg border border-blue-100 bg-white px-3 py-2">
              <p className="text-sm font-semibold text-gray-900">
                {intent.name}
              </p>

              {intent.reason && (
                <p className="text-xs text-blue-700 mt-0.5">
                  Reason: {intent.reason}
                </p>
              )}
            </div>
          )}
        </div>

        {/* CONTEXT */}
        {!compact && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ContextItem
              label="Agent"
              value={context.agentName || "—"}
            />

            <ContextItem
              label="Destination"
              value={context.destinationName || "—"}
            />

            <ContextItem
              label="Lead Stage"
              value={context.leadStage || "—"}
            />

            <ContextItem
              label="Last Contact"
              value={
                context.latestEngagementAgeDays === null ||
                context.latestEngagementAgeDays === undefined
                  ? "No previous contact"
                  : `${context.latestEngagementAgeDays} day(s) ago`
              }
            />
          </div>
        )}

        {/* SUGGESTED REPLIES */}
        <div className="space-y-2">
          <SectionHeading
            icon={<MessageCircle className="h-4 w-4" />}
            title="Suggested Replies"
            count={suggestions.length}
          />

          {suggestions.length === 0 ? (
            <EmptyState text="No reply suggestions available." />
          ) : (
            <div className="space-y-2">
              {suggestions.map((suggestion, index) => {
                const text = normalizeSuggestionText(suggestion);
                const expanded = expandedSuggestionId === suggestion.id;
                const previewText =
                  !expanded && text.length > 260
                    ? `${text.slice(0, 260)}...`
                    : text;

                const copyId = `suggestion-${suggestion.id}`;

                return (
                  <div
                    key={suggestion.id || index}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-semibold text-gray-900">
                            {suggestion.title || `Suggestion ${index + 1}`}
                          </p>

                          {suggestion.tone && (
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getToneClass(
                                suggestion.tone
                              )}`}
                            >
                              {suggestion.tone}
                            </span>
                          )}
                        </div>

                        {suggestion.subject && (
                          <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1.5">
                            <div className="flex items-start gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
                              <p className="text-xs text-gray-800 break-words">
                                {suggestion.subject}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-gray-700 bg-white border border-gray-100 rounded-lg px-3 py-2">
                      {previewText}
                    </pre>

                    {text.length > 260 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSuggestionId(expanded ? "" : suggestion.id)
                        }
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        {expanded ? "View less" : "View full reply"}
                      </button>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(text, copyId)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        {copiedId === copyId ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onUseSuggestion?.(suggestion)}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Use This
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RECOMMENDED TEMPLATES */}
        <div className="space-y-2">
          <SectionHeading
            icon={<FileText className="h-4 w-4" />}
            title="Recommended Templates"
            count={recommendedTemplates.length}
          />

          {recommendedTemplates.length === 0 ? (
            <EmptyState text="No matching active template found." />
          ) : (
            <div className="space-y-2">
              {recommendedTemplates.map(template => (
                <div
                  key={template.templateId || template.id}
                  className="rounded-xl border border-gray-100 bg-white px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {template.name}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getTemplateTypeClass(
                            template.templateType
                          )}`}
                        >
                          {template.templateType || "message"}
                        </span>

                        {template.categoryName && (
                          <span className="rounded-full border border-gray-100 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-600">
                            {template.categoryName}
                          </span>
                        )}

                        {template.score ? (
                          <span className="rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-[10px] text-green-700">
                            Score {template.score}
                          </span>
                        ) : null}
                      </div>

                      {Array.isArray(template.reasons) &&
                        template.reasons.length > 0 && (
                          <p className="text-[11px] text-gray-500 mt-1.5">
                            {template.reasons.slice(0, 2).join(" · ")}
                          </p>
                        )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onUseTemplate?.(template.raw || template)
                      }
                      className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      Use
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RECOMMENDED ASSETS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading
              icon={<Package className="h-4 w-4" />}
              title="Recommended Assets"
              count={recommendedAssets.length}
            />

            {recommendedAssets.length > 0 && (
              <button
                type="button"
                onClick={() => onAddAssets?.(recommendedAssets)}
                className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                Add All
              </button>
            )}
          </div>

          {recommendedAssets.length === 0 ? (
            <EmptyState text="No matching asset found." />
          ) : (
            <div className="space-y-2">
              {recommendedAssets.slice(0, 5).map(asset => (
                <div
                  key={asset.assetId || asset.url}
                  className="rounded-xl border border-gray-100 bg-white px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        <span className="mr-1">{getAssetIcon(asset)}</span>
                        {asset.title}
                      </p>

                      <p className="truncate text-[11px] text-gray-500 mt-1">
                        {asset.categoryName || asset.assetType || "Asset"}
                        {asset.destinationName
                          ? ` · ${asset.destinationName}`
                          : " · General"}
                      </p>

                      {Array.isArray(asset.reasons) &&
                        asset.reasons.length > 0 && (
                          <p className="text-[11px] text-green-700 mt-1">
                            {asset.reasons.slice(0, 2).join(" · ")}
                          </p>
                        )}
                    </div>

                    {asset.url && (
                      <a
                        href={asset.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        View
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NEXT ACTION */}
        {nextAction && (
          <div className="rounded-xl border border-green-100 bg-green-50 p-3">
            <SectionHeading
              icon={<CalendarClock className="h-4 w-4" />}
              title="Recommended Next Action"
            />

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ContextItem
                label="Action"
                value={nextAction.nextActionLabel || nextAction.nextAction}
              />

              <ContextItem
                label="Follow-up"
                value={formatDateTime(nextAction.nextFollowUpAtIso)}
              />

              <ContextItem
                label="Waiting On"
                value={nextAction.waitingOn || "—"}
              />

              <ContextItem
                label="Status"
                value={nextAction.communicationStatus || "—"}
              />
            </div>

            {onUseNextAction && (
              <button
                type="button"
                onClick={() => onUseNextAction(nextAction)}
                className="mt-3 inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
              >
                Use Next Action
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* DIAGNOSTICS */}
        {!compact && suggestionData?.diagnostics && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-gray-400 mt-0.5" />
              <p className="text-[11px] text-gray-500">
                Checked {suggestionData.diagnostics.templateCount || 0} templates,{" "}
                {suggestionData.diagnostics.assetCount || 0} assets and{" "}
                {suggestionData.diagnostics.engagementCount || 0} engagements.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* =========================
   SMALL COMPONENTS
========================= */

function SectionHeading({ icon, title, count }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-gray-500">{icon}</div>

      <p className="text-xs font-semibold text-gray-900">
        {title}
      </p>

      {typeof count === "number" && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
          {count}
        </span>
      )}
    </div>
  );
}

function ContextItem({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-xs font-semibold text-gray-900 mt-0.5 break-words capitalize">
        {value || "—"}
      </p>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center">
      <CheckCircle2 className="mx-auto h-5 w-5 text-gray-300" />
      <p className="text-xs text-gray-500 mt-1">{text}</p>
    </div>
  );
}