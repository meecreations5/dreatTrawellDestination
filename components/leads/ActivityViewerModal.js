// components/leads/ActivityViewerModal.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  GitBranch,
  Loader2,
  Paperclip,
  ShieldCheck,
  UserCheck,
  Building2,
  MapPin,
  Sparkles,
  X
} from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { markQuotationFinal } from "@/lib/markQuotationFinal";

const STAGE_LABELS = {
  new: "New",
  assigned: "Assigned",
  follow_up: "Follow Up",
  vendor_pricing_requested: "Sent to Vendor for Pricing",
  awaiting_vendor_revert: "Awaiting Vendor Revert",
  quoted: "Quoted",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost"
};

function toDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}


function resolveActivityDate(...values) {
  for (const value of values) {
    if (!value) continue;

    if (value?.toDate) return value;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }

    if (typeof value === "string") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  return null;
}



function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—";

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "—";

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `${number.toFixed(1)}%`;
}

function normalizeFollowUpValue(value = "") {
  return String(value || "")
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_")
    .trim();
}

function parseFollowUpChannelFromTitle(title = "") {
  const value = String(title || "");

  const match = value.match(/follow-?up\s+via\s+([a-zA-Z_ -]+)/i);

  return normalizeFollowUpValue(match?.[1] || "");
}

function formatFollowUpLabel(value = "") {
  if (!value) return "—";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function getFirstValue(...values) {
  return values.find(
    value => value !== undefined && value !== null && value !== ""
  );
}

function getStageLabel(stage = "") {
  return STAGE_LABELS[stage] || String(stage || "—").replaceAll("_", " ");
}

function formatSource(source = "") {
  if (!source) return "—";

  return String(source)
    .replaceAll("_", " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function parseAssignedToFromText(text = "") {
  const value = String(text || "");
  const match = value.match(/Lead assigned to\s+(.+?)(?:\.|,|Remark:|$)/i);

  return match?.[1]?.trim() || "";
}

function cleanAssignmentRemark(text = "") {
  const value = String(text || "").trim();

  const remarkMatch = value.match(/Remark:\s*([\s\S]*)/i);

  if (remarkMatch?.[1]) {
    return remarkMatch[1].trim();
  }

  return value
    .replace(/^Lead assigned to\s+(.+?)(?:\.|,|$)\s*/i, "")
    .trim();
}

function getQuotationId(activity) {
  return getFirstValue(
    activity?.metadata?.quotationId,
    activity?.quotationId
  );
}

function getLeadId(activity) {
  return getFirstValue(
    activity?.leadId,
    activity?.metadata?.leadId
  );
}

function getSentVia(activity, quotation) {
  const metadata = activity?.metadata || {};

  const value = getFirstValue(
    metadata.sentVia,
    quotation?.sentVia,
    quotation?.sendVia,
    metadata.channel
  );

  if (Array.isArray(value)) return value.join(", ");
  return value || "—";
}

function getRevision(activity, quotation) {
  return getFirstValue(
    activity?.metadata?.revision,
    quotation?.revision,
    activity?.metadata?.rev,
    activity?.metadata?.version
  );
}

function getStatus(activity, quotation) {
  return getFirstValue(
    quotation?.status,
    activity?.metadata?.status,
    activity?.metadata?.isFinalQuotation ? "final" : "",
    activity?.metadata?.isDraft ? "draft" : ""
  );
}

function getCommercials(activity, quotation) {
  const metadata = activity?.metadata || {};

  const totalAmount = getFirstValue(
    metadata.totalAmount,
    metadata.customerQuotedAmount,
    metadata.totalPrice,
    quotation?.customerQuotedAmount,
    quotation?.totalPrice,
    quotation?.totalAmount
  );

  const vendorCost = getFirstValue(
    metadata.vendorCost,
    quotation?.vendorCost
  );

  const grossProfit = getFirstValue(
    metadata.grossProfit,
    quotation?.grossProfit,
    totalAmount !== undefined &&
      vendorCost !== undefined &&
      vendorCost !== null
      ? Number(totalAmount) - Number(vendorCost)
      : null
  );

  const marginPercent = getFirstValue(
    metadata.marginPercent,
    quotation?.marginPercent,
    totalAmount &&
      grossProfit !== undefined &&
      grossProfit !== null
      ? (Number(grossProfit) / Number(totalAmount)) * 100
      : null
  );

  return {
    totalAmount,
    vendorCost,
    grossProfit,
    marginPercent
  };
}

function isStageActivity(activity) {
  const metadata = activity?.metadata || {};
  const action = String(metadata?.action || "").toLowerCase();
  const type = String(activity?.type || "").toLowerCase();

  return (
    type === "stage" ||
    type === "stage_change" ||
    type === "stage_changed" ||
    type === "stage_update" ||
    action === "stage_changed" ||
    action === "lead_closed" ||
    Boolean(metadata?.newStage) ||
    Boolean(metadata?.toStage) ||
    Boolean(metadata?.fromStage) ||
    Boolean(metadata?.oldStage)
  );
}

function isLeadCreatedActivity(activity) {
  const metadata = activity?.metadata || {};
  const title = String(activity?.title || "").toLowerCase();
  const type = String(activity?.type || "").toLowerCase();
  const action = String(metadata?.action || "").toLowerCase();

  return (
    type === "created" ||
    type === "lead_created" ||
    action === "lead_created" ||
    title.includes("lead created")
  );
}

function isFollowUpActivity(activity) {
  return (
    activity?.type === "follow_up" ||
    activity?.type === "followup" ||
    activity?.metadata?.action === "follow_up_logged"
  );
}

function isAssignmentActivity(activity) {
  return (
    activity?.type === "assigned" ||
    activity?.type === "assignment" ||
    activity?.metadata?.action === "lead_assigned"
  );
}

function isClientReferenceActivity(activity) {
  const metadata = activity?.metadata || {};
  const title = String(activity?.title || "").toLowerCase();
  const type = String(activity?.type || "").toLowerCase();
  const action = String(metadata?.action || "").toLowerCase();

  return (
    action === "client_reference_added" ||
    type === "client_reference" ||
    title.includes("client reference") ||
    (
      type === "remark" &&
      (
        metadata.source ||
        metadata.notes ||
        metadata.notesHtml ||
        metadata.attachmentCount ||
        Array.isArray(metadata.attachments)
      )
    )
  );
}

function getActivityRemark(activity) {
  return getFirstValue(
    activity?.metadata?.remark,
    activity?.metadata?.closingRemark,
    activity?.metadata?.closeRemark,
    activity?.metadata?.closedReason,
    activity?.metadata?.reason,
    activity?.remark,
    activity?.description
  );
}

function cleanHtml(html = "") {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .trim();
}

function DetailRow({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900 break-all">
        {value || "—"}
      </p>
    </div>
  );
}

function CommercialCard({ commercials }) {
  return (
    <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-orange-800">
            🔒 Internal Commercials
          </p>
          <p className="text-xs text-orange-700">
            Internal only. Not visible to customer.
          </p>
        </div>

        <span className="text-[11px] bg-orange-100 text-orange-700 rounded-full px-2 py-1">
          Internal
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DetailRow
          label="Quotation Amount"
          value={formatMoney(commercials.totalAmount)}
        />

        <DetailRow
          label="Vendor Cost"
          value={formatMoney(commercials.vendorCost)}
        />

        <DetailRow
          label="Gross Profit"
          value={formatMoney(commercials.grossProfit)}
        />

        <DetailRow
          label="Margin"
          value={formatPercent(commercials.marginPercent)}
        />
      </div>
    </div>
  );
}

function EmptyQuotationPreview() {
  return (
    <div className="border border-dashed border-gray-200 rounded-lg p-6 text-sm text-gray-500 text-center">
      Quotation content not found for this timeline record.
    </div>
  );
}

function StageActivityCard({ activity }) {
  const metadata = activity?.metadata || {};

  const oldStage = getFirstValue(
    metadata.oldStage,
    metadata.fromStage,
    metadata.previousStage
  );

  const newStage = getFirstValue(
    metadata.newStage,
    metadata.toStage,
    metadata.stage
  );

  const oldStageLabel = getFirstValue(
    metadata.oldStageLabel,
    metadata.fromStageLabel,
    metadata.previousStageLabel,
    oldStage ? getStageLabel(oldStage) : ""
  );

  const newStageLabel = getFirstValue(
    metadata.newStageLabel,
    metadata.toStageLabel,
    metadata.stageLabel,
    newStage ? getStageLabel(newStage) : ""
  );

  const remark = getActivityRemark(activity);

  const isClosed =
    metadata.action === "lead_closed" ||
    ["closed_won", "closed_lost"].includes(newStage);

  const isWon = newStage === "closed_won";

  const isVendorStage = [
    "vendor_pricing_requested",
    "awaiting_vendor_revert"
  ].includes(newStage);

  let wrapperClass = "bg-blue-50 border-blue-100";
  let titleClass = "text-blue-800";
  let badgeClass = "bg-blue-100 text-blue-700";

  if (isClosed && isWon) {
    wrapperClass = "bg-green-50 border-green-100";
    titleClass = "text-green-800";
    badgeClass = "bg-green-100 text-green-700";
  } else if (isClosed) {
    wrapperClass = "bg-red-50 border-red-100";
    titleClass = "text-red-800";
    badgeClass = "bg-red-100 text-red-700";
  } else if (isVendorStage) {
    wrapperClass = "bg-amber-50 border-amber-100";
    titleClass = "text-amber-800";
    badgeClass = "bg-amber-100 text-amber-700";
  }

  return (
    <div className={`rounded-lg border p-4 ${wrapperClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`h-9 w-9 rounded-lg flex items-center justify-center ${badgeClass}`}
          >
            <GitBranch size={18} />
          </div>

          <div>
            <p className={`text-sm font-semibold ${titleClass}`}>
              {isClosed
                ? "Closing Statement"
                : isVendorStage
                  ? "Vendor Pricing Stage"
                  : "Stage Change Remark"}
            </p>

            {(oldStageLabel || newStageLabel) && (
              <p className="text-xs text-gray-600 mt-1">
                {oldStageLabel || "—"} → {newStageLabel || "—"}
              </p>
            )}
          </div>
        </div>

        {newStageLabel && (
          <span className={`text-[11px] rounded-full px-2 py-1 ${badgeClass}`}>
            {newStageLabel}
          </span>
        )}
      </div>

      {remark ? (
        <div className="mt-4 bg-white/70 border border-white rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">
            {isClosed ? "Close / Lost Remark" : "Remark"}
          </p>

          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {remark}
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mt-4">
          No remark saved for this stage change.
        </p>
      )}
    </div>
  );
}

function FollowUpActivityCard({ activity }) {
  const metadata = activity?.metadata || {};

  const channel = getFirstValue(
    metadata.channel,
    metadata.followUpChannel,
    metadata.communicationChannel,
    activity?.channel,
    parseFollowUpChannelFromTitle(activity?.title)
  );

  const outcome = getFirstValue(
    metadata.outcome,
    metadata.outcomeCode,
    metadata.followUpOutcome,
    activity?.outcome,
    "connected"
  );

  const summary = getFirstValue(
    metadata.summary,
    metadata.followUpSummary,
    metadata.description,
    activity?.summary,
    activity?.description
  );

  const nextFollowUpAt = resolveActivityDate(
    metadata.nextActionDueAt,
    metadata.nextFollowUpAt,
    metadata.nextActionAt,
    metadata.followUpAt,

    metadata.nextActionDueAtIso,
    metadata.nextFollowUpAtIso,

    metadata.nextActionDueAtMs,
    metadata.nextFollowUpAtMs,

    activity?.nextActionDueAt,
    activity?.nextFollowUpAt,
    activity?.nextActionDueAtIso,
    activity?.nextFollowUpAtIso,
    activity?.nextActionDueAtMs,
    activity?.nextFollowUpAtMs
  );

  const nextActionType = getFirstValue(
    metadata.nextActionType,
    metadata.nextFollowUpType,
    metadata.actionType,
    activity?.nextActionType,
    "follow_up"
  );

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Clock3 size={19} />
          </div>

          <div>
            <p className="text-sm font-semibold text-blue-900">
              Follow-up Details
            </p>

            <p className="text-xs text-blue-700 mt-0.5">
              Latest interaction recorded for this lead.
            </p>
          </div>
        </div>

        <span className="text-[11px] bg-blue-100 text-blue-700 rounded-full px-2 py-1">
          Follow-up
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailRow
          label="Channel"
          value={formatFollowUpLabel(channel)}
        />

        <DetailRow
          label="Outcome"
          value={formatFollowUpLabel(outcome)}
        />

        <DetailRow
          label="Next Action Type"
          value={formatFollowUpLabel(nextActionType)}
        />

        <DetailRow
          label="Next Action Due"
          value={
            nextFollowUpAt
              ? formatDateTime(nextFollowUpAt)
              : "Not scheduled"
          }
        />
      </div>

      {summary && (
        <div className="bg-white/80 border border-white rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">
            Conversation Summary
          </p>

          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {summary}
          </p>
        </div>
      )}

      {nextFollowUpAt && (
        <div className="rounded-lg bg-white/80 border border-blue-100 p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">
            Scheduled Next Action
          </p>

          <p className="text-sm font-medium text-blue-800">
            {formatFollowUpLabel(nextActionType)} ·{" "}
            {formatDateTime(nextFollowUpAt)}
          </p>
        </div>
      )}
    </div>
  );
}

function AssignmentActivityCard({ activity }) {
  const metadata = activity?.metadata || {};

  const descriptionAssignedTo = parseAssignedToFromText(
    activity?.description ||
    metadata.description ||
    metadata.remark ||
    metadata.assignmentRemark ||
    ""
  );

  const assignedTo = getFirstValue(
    metadata.assignedToName,
    metadata.assignedUserName,
    metadata.assigneeName,
    metadata.toUserName,
    metadata.toName,
    metadata.userName,
    metadata.assignedToEmail,
    metadata.assignedToUid,
    metadata.toUserEmail,
    activity?.assignedToName,
    activity?.assignedUserName,
    descriptionAssignedTo
  );

  const assignedBy = getFirstValue(
    metadata.assignedByName,
    metadata.assignedByEmail,
    metadata.changedByName,
    metadata.changedByEmail,
    metadata.createdByName,
    activity?.createdByName,
    activity?.createdByEmail
  );

  const assignedRole = getFirstValue(
    metadata.assignedToRole,
    metadata.assignedUserRole,
    metadata.toUserRole,
    activity?.assignedToRole
  );

  const rawRemark = getFirstValue(
    metadata.assignmentRemark,
    metadata.remark,
    metadata.note,
    metadata.reason,
    activity?.remark,
    activity?.description
  );

  const remark = cleanAssignmentRemark(rawRemark);

  const clientReference = metadata.clientReference || null;
  const clientReferenceCaptured =
    metadata.clientReferenceCaptured === true &&
    clientReference;

  return (
    <div className="rounded-lg border border-orange-100 bg-orange-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
            <UserCheck size={18} />
          </div>

          <div>
            <p className="text-sm font-semibold text-orange-800">
              Assignment Details
            </p>

            <p className="text-xs text-orange-700 mt-1">
              Lead ownership was assigned or changed.
            </p>
          </div>
        </div>

        <span className="text-[11px] bg-orange-100 text-orange-700 rounded-full px-2 py-1">
          Assignment
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <DetailRow label="Assigned To" value={assignedTo} />
        <DetailRow label="Assigned By" value={assignedBy} />

        {assignedRole && (
          <DetailRow label="Role" value={assignedRole} />
        )}
      </div>

      {remark ? (
        <div className="mt-4 bg-white/80 border border-white rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">
            Assignment Remark
          </p>

          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {remark}
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mt-4">
          No assignment remark added.
        </p>
      )}

      {clientReferenceCaptured && (
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Paperclip size={16} className="text-blue-600 mt-0.5" />

            <div>
              <p className="text-xs font-semibold text-blue-800">
                Client Reference Shared With Assignee
              </p>

              <p className="text-xs text-blue-700 mt-0.5">
                Snapshot captured during assignment.
              </p>
            </div>
          </div>

          {clientReference.source && (
            <p className="text-xs text-gray-600 mt-3">
              Source:{" "}
              <span className="font-medium">
                {formatSource(clientReference.source)}
              </span>
            </p>
          )}

          {clientReference.notes && (
            <p className="text-sm text-gray-800 whitespace-pre-wrap mt-2">
              {clientReference.notes}
            </p>
          )}

          {clientReference.attachmentCount > 0 && (
            <p className="text-xs text-blue-700 mt-2">
              {clientReference.attachmentCount} reference file
              {clientReference.attachmentCount === 1 ? "" : "s"} available on lead.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ClientReferenceActivityCard({ activity }) {
  const metadata = activity?.metadata || {};

  const source = getFirstValue(
    metadata.source,
    metadata.clientReferenceSource
  );

  const notesHtml = getFirstValue(
    metadata.notesHtml,
    metadata.clientReferenceNotesHtml
  );

  const notes = getFirstValue(
    metadata.notes,
    metadata.clientReferenceNotes,
    activity?.description
  );

  const attachments = Array.isArray(metadata.attachments)
    ? metadata.attachments
    : [];

  const attachmentCount =
    metadata.attachmentCount ||
    metadata.clientReferenceAttachmentCount ||
    attachments.length ||
    0;

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Paperclip size={19} />
          </div>

          <div>
            <p className="text-sm font-semibold text-blue-900">
              Client Reference Captured
            </p>

            <p className="text-xs text-blue-700 mt-0.5">
              Requirement or reference shared by client.
            </p>
          </div>
        </div>

        <span className="text-[11px] bg-blue-100 text-blue-700 rounded-full px-2 py-1">
          Reference
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailRow
          label="Reference Source"
          value={formatSource(source)}
        />

        <DetailRow
          label="Files Attached"
          value={
            attachmentCount
              ? `${attachmentCount} file${attachmentCount === 1 ? "" : "s"}`
              : "—"
          }
        />
      </div>

      {(notesHtml || notes) && (
        <div className="bg-white/80 border border-white rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">
            Client Requirement
          </p>

          {notesHtml ? (
            <div
              className="
                text-sm text-gray-800 leading-relaxed
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
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
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
                    bg-white border border-blue-100 rounded-lg px-3 py-2
                    hover:bg-blue-50 transition
                  "
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isImage && file.url ? (
                      <img
                        src={file.url}
                        alt={file.name || "Reference"}
                        className="h-10 w-10 rounded-md object-cover border border-gray-100"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-blue-50 flex items-center justify-center">
                        <FileText size={18} className="text-blue-600" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {file.name || "Reference file"}
                      </p>

                      <p className="text-xs text-gray-400">
                        {file.type || "file"}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs text-blue-700">
                    View
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadCreatedActivityCard({ activity, lead }) {
  const metadata = activity?.metadata || {};

  const descriptionLeadCode =
    String(activity?.description || "").match(/Lead\s+([A-Z0-9-]+)/i)?.[1] ||
    "";

  const leadCode = getFirstValue(
    metadata.leadCode,
    activity?.leadCode,
    lead?.leadCode,
    descriptionLeadCode
  );

  const source = getFirstValue(
    metadata.source,
    activity?.source,
    lead?.source
  );

  const destinationName = getFirstValue(
    metadata.destinationName,
    activity?.destinationName,
    lead?.destinationName,
    lead?.destination
  );

  const destinationCode = getFirstValue(
    metadata.destinationCode,
    activity?.destinationCode,
    lead?.destinationCode
  );

  const agentName = getFirstValue(
    metadata.agentName,
    metadata.travelAgentName,
    activity?.agentName,
    lead?.agentName,
    lead?.travelAgentName,
    lead?.agencyName
  );

  const assignedTo = getFirstValue(
    metadata.assignedToName,
    metadata.assignedToEmail,
    metadata.assignedToUid,
    lead?.assignedToName,
    lead?.assignedToEmail,
    lead?.assignedToUid,
    lead?.assignedTo
  );

  const clientReferenceSource = getFirstValue(
    metadata.clientReferenceSource,
    lead?.clientReference?.source,
    lead?.clientReferenceSource
  );

  const clientReferenceAttachmentCount =
    metadata.clientReferenceAttachmentCount ||
    lead?.clientReference?.attachments?.length ||
    lead?.clientReferenceAttachmentCount ||
    0;

  const hasClientReference =
    metadata.hasClientReference === true ||
    lead?.hasClientReference === true ||
    Boolean(clientReferenceSource) ||
    Boolean(lead?.clientReference?.notes) ||
    Boolean(lead?.clientReference?.notesHtml) ||
    Number(clientReferenceAttachmentCount || 0) > 0;

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Sparkles size={19} />
          </div>

          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Lead Created Successfully
            </p>

            <p className="text-xs text-emerald-700 mt-0.5">
              New lead record was generated and added to pipeline.
            </p>
          </div>
        </div>

        <span className="text-[11px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-1">
          Created
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailRow label="Lead Code" value={leadCode} />

        <DetailRow
          label="Source"
          value={formatSource(source)}
        />

        <DetailRow
          label="Destination"
          value={
            destinationName
              ? `${destinationName}${destinationCode ? ` (${destinationCode})` : ""}`
              : destinationCode
          }
        />

        <DetailRow
          label="Travel Agent"
          value={agentName}
        />

        <DetailRow
          label="Assigned To"
          value={assignedTo}
        />

        <DetailRow
          label="Client Reference"
          value={
            hasClientReference
              ? `Captured${clientReferenceSource ? ` · ${formatSource(clientReferenceSource)}` : ""}`
              : "Not captured"
          }
        />
      </div>

      {clientReferenceAttachmentCount > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 flex items-start gap-2">
          <Paperclip size={16} className="text-blue-600 mt-0.5" />

          <p className="text-sm text-blue-800">
            {clientReferenceAttachmentCount} reference file
            {clientReferenceAttachmentCount === 1 ? "" : "s"} attached with this lead.
          </p>
        </div>
      )}

      {activity?.description && (
        <div className="bg-white/80 border border-white rounded-lg p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">
            Description
          </p>

          <p className="text-sm text-gray-800 whitespace-pre-wrap">
            {activity.description}
          </p>
        </div>
      )}
    </div>
  );
}

function GenericActivityCard({ activity }) {
  const description = getFirstValue(
    activity?.description,
    activity?.metadata?.remark,
    activity?.metadata?.summary,
    activity?.metadata?.notes
  );

  if (!description) return null;

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">
        Description
      </p>

      <p className="text-sm text-gray-800 whitespace-pre-wrap">
        {description}
      </p>
    </div>
  );
}

export default function ActivityViewerModal({
  activity,
  onClose,
  onEditDraft
}) {
  const { user } = useAuth();

  const [quotation, setQuotation] = useState(null);
  const [loadingQuotation, setLoadingQuotation] = useState(false);
  const [markingFinal, setMarkingFinal] = useState(false);
  const [activeTab, setActiveTab] = useState("details");

  const [confirmFinalOpen, setConfirmFinalOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const leadId = getLeadId(activity);
  const quotationId = getQuotationId(activity);
  const isQuotation = activity?.type === "quotation";
  const [leadDetails, setLeadDetails] = useState(null);
  const [loadingLeadDetails, setLoadingLeadDetails] = useState(false);

  const isStageChangeActivity = isStageActivity(activity);
  const isFollowUp = isFollowUpActivity(activity);
  const isAssignment = isAssignmentActivity(activity);
  const isClientReference = isClientReferenceActivity(activity);
  const isLeadCreated = isLeadCreatedActivity(activity);

  useEffect(() => {
    let mounted = true;

    async function loadQuotation() {
      if (!isQuotation || !leadId || !quotationId) {
        setQuotation(null);
        return;
      }

      setLoadingQuotation(true);

      try {
        const snap = await getDoc(
          doc(db, "leads", leadId, "quotations", quotationId)
        );

        if (mounted) {
          setQuotation(
            snap.exists()
              ? {
                id: snap.id,
                ...snap.data()
              }
              : null
          );
        }
      } catch (error) {
        console.error("Failed to load quotation:", error);
        if (mounted) setQuotation(null);
      } finally {
        if (mounted) setLoadingQuotation(false);
      }
    }

    loadQuotation();

    return () => {
      mounted = false;
    };
  }, [isQuotation, leadId, quotationId]);

  useEffect(() => {
    let mounted = true;

    async function loadLeadDetails() {
      if (!leadId) {
        setLeadDetails(null);
        return;
      }

      setLoadingLeadDetails(true);

      try {
        const snap = await getDoc(doc(db, "leads", leadId));

        if (mounted) {
          setLeadDetails(
            snap.exists()
              ? {
                id: snap.id,
                ...snap.data()
              }
              : null
          );
        }
      } catch (error) {
        console.error("Failed to load lead details for activity:", error);

        if (mounted) {
          setLeadDetails(null);
        }
      } finally {
        if (mounted) {
          setLoadingLeadDetails(false);
        }
      }
    }

    loadLeadDetails();

    return () => {
      mounted = false;
    };
  }, [leadId]);

  const revision = useMemo(
    () => getRevision(activity, quotation),
    [activity, quotation]
  );

  const status = useMemo(
    () => getStatus(activity, quotation),
    [activity, quotation]
  );

  const sentVia = useMemo(
    () => getSentVia(activity, quotation),
    [activity, quotation]
  );

  const commercials = useMemo(
    () => getCommercials(activity, quotation),
    [activity, quotation]
  );

  const isFinal =
    status === "final" ||
    quotation?.isFinalQuotation === true ||
    activity?.metadata?.isFinalQuotation === true;

  const canMarkFinal =
    isQuotation &&
    leadId &&
    quotationId &&
    !isFinal &&
    !loadingQuotation;

  if (!activity) return null;

  const confirmMarkAsFinal = async () => {
    if (!canMarkFinal || markingFinal) return;

    setActionError("");
    setActionSuccess("");
    setMarkingFinal(true);

    try {
      await markQuotationFinal({
        leadId,
        quotationId,
        user
      });

      const snap = await getDoc(
        doc(db, "leads", leadId, "quotations", quotationId)
      );

      if (snap.exists()) {
        setQuotation({
          id: snap.id,
          ...snap.data()
        });
      }

      setConfirmFinalOpen(false);
      setActionSuccess("Quotation marked as final.");
    } catch (error) {
      console.error("Mark final failed:", error);
      setActionError(error?.message || "Failed to mark quotation as final.");
    } finally {
      setMarkingFinal(false);
    }
  };

  const itineraryHtml =
    quotation?.itineraryHtml ||
    activity?.metadata?.itineraryHtml ||
    "";

  const resolvedQuotationId = quotation?.id || quotationId;

  const isDraftQuotation =
    isQuotation &&
    (
      quotation?.isDraft === true ||
      quotation?.status === "draft" ||
      activity?.metadata?.isDraft === true ||
      activity?.metadata?.status === "draft"
    );

  const canEditDraft =
    isDraftQuotation &&
    leadId &&
    resolvedQuotationId;

  const draftPayload = quotation
    ? {
      ...quotation,
      id: quotation.id || resolvedQuotationId,
      quotationId: quotation.quotationId || resolvedQuotationId,
      leadId
    }
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl">
        {/* HEADER */}
        <div className="p-5 border-b flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {activity.title || "Activity Details"}
            </h2>

            <p className="text-xs text-gray-500 mt-1">
              {isQuotation ? "Quotation" : activity.type || "Activity"}
              {revision ? ` · Rev ${revision}` : ""}
              {status ? ` · ${status}` : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
          >
            <X size={22} />
          </button>
        </div>

        {/* TABS */}
        {isQuotation && (
          <div className="px-5 pt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`px-3 py-1.5 rounded-full text-xs border ${activeTab === "details"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200"
                }`}
            >
              Details
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("quotation")}
              className={`px-3 py-1.5 rounded-full text-xs border ${activeTab === "quotation"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-200"
                }`}
            >
              View Quotation
            </button>
          </div>
        )}

        {/* BODY */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {actionError && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-lg px-3 py-2 text-sm flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {actionSuccess && (
            <div className="bg-green-50 border border-green-100 text-green-700 rounded-lg px-3 py-2 text-sm flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {isQuotation && loadingQuotation && (
            <div className="text-sm text-gray-500">
              Loading quotation details...
            </div>
          )}

          {(!isQuotation || activeTab === "details") && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isQuotation && (
                  <DetailRow
                    label="Total Amount"
                    value={formatMoney(commercials.totalAmount)}
                  />
                )}

                {isQuotation && (
                  <DetailRow
                    label="Sent Via"
                    value={sentVia}
                  />
                )}

                <DetailRow
                  label="Date"
                  value={formatDateTime(activity.createdAt)}
                />

                {isQuotation && (
                  <DetailRow
                    label="Revision"
                    value={revision ? `v${revision}` : "—"}
                  />
                )}

                {status && (
                  <DetailRow
                    label="Status"
                    value={status}
                  />
                )}

                {quotationId && (
                  <DetailRow
                    label="Quotation ID"
                    value={quotationId}
                  />
                )}
              </div>

              {isQuotation && (
                <CommercialCard commercials={commercials} />
              )}

              {isStageChangeActivity && (
                <StageActivityCard activity={activity} />
              )}

              {!isStageChangeActivity && isFollowUp && (
                <FollowUpActivityCard activity={activity} />
              )}

              {!isStageChangeActivity && isAssignment && (
                <AssignmentActivityCard activity={activity} />
              )}

              {!isStageChangeActivity && isClientReference && (
                <ClientReferenceActivityCard activity={activity} />
              )}

              {!isQuotation &&
                !isStageChangeActivity &&
                !isFollowUp &&
                !isAssignment &&
                !isClientReference &&
                isLeadCreated && (
                  <LeadCreatedActivityCard
                    activity={activity}
                    lead={leadDetails}
                  />
                )}

              {!isQuotation &&
                !isStageChangeActivity &&
                !isFollowUp &&
                !isAssignment &&
                !isClientReference &&
                !isLeadCreated && (
                  <GenericActivityCard activity={activity} />
                )}

              {activity.metadata?.signatureUser?.name && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    Signature Used
                  </p>

                  <p className="text-sm text-gray-800">
                    {activity.metadata.signatureUser.name}
                    {activity.metadata.signatureUser.role
                      ? ` · ${activity.metadata.signatureUser.role}`
                      : ""}
                  </p>
                </div>
              )}
            </>
          )}

          {isQuotation && activeTab === "quotation" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Quotation Preview
                  </p>

                  <p className="text-xs text-gray-500">
                    Customer-facing quotation content.
                  </p>
                </div>

                {isFinal ? (
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-1 rounded-full">
                    Final Quotation
                  </span>
                ) : (
                  <span className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1 rounded-full">
                    Not Final
                  </span>
                )}
              </div>

              {itineraryHtml ? (
                <div className="border border-gray-200 rounded-lg bg-white p-4 overflow-x-auto">
                  <div
                    className="text-sm quotation-preview"
                    dangerouslySetInnerHTML={{
                      __html: itineraryHtml
                    }}
                  />
                </div>
              ) : (
                <EmptyQuotationPreview />
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t flex flex-col md:flex-row md:items-center gap-3">
          <p className="text-xs text-gray-500 flex-1">
            Created by{" "}
            <span className="font-medium">
              {activity.createdByName ||
                activity.createdByEmail ||
                "System"}
            </span>
          </p>

          <div className="flex flex-wrap gap-2">
            {isQuotation && (
              <button
                type="button"
                onClick={() => setActiveTab("quotation")}
                className="border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                View Quotation
              </button>
            )}

            {canMarkFinal && (
              <button
                type="button"
                onClick={() => {
                  setActionError("");
                  setActionSuccess("");
                  setConfirmFinalOpen(true);
                }}
                disabled={markingFinal}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
              >
                Mark as Final
              </button>
            )}

            {canEditDraft && (
              <button
                type="button"
                onClick={() => onEditDraft?.(draftPayload)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"
              >
                Edit / Send Draft
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="border border-gray-200 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>

        {confirmFinalOpen && (
          <div className="border-t border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <ShieldCheck size={18} />
              </div>

              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800">
                  Mark quotation as final?
                </p>

                <p className="text-xs text-emerald-700 mt-1">
                  This will mark Rev {revision || "—"} as the final quotation
                  for this lead.
                </p>

                <div className="flex gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setConfirmFinalOpen(false)}
                    disabled={markingFinal}
                    className="border border-emerald-200 bg-white text-emerald-700 px-3 py-1.5 rounded-lg text-xs disabled:opacity-60"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={confirmMarkAsFinal}
                    disabled={markingFinal}
                    className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    {markingFinal && (
                      <Loader2 size={13} className="animate-spin" />
                    )}
                    {markingFinal ? "Marking..." : "Confirm Final"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .quotation-preview table {
          border-collapse: collapse;
          width: 100%;
        }

        .quotation-preview td,
        .quotation-preview th {
          border: 1px solid #d1d5db;
          padding: 6px 8px;
          vertical-align: top;
        }

        .quotation-preview p {
          margin: 6px 0;
        }
      `}</style>
    </div>
  );
}