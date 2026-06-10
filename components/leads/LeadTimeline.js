// components/leads/LeadTimeline.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from "firebase/firestore";

import { db } from "@/lib/firebase";

/* =========================
   BASE UI MAP
========================= */
const UI = {
  follow_up: {
    icon: "📞",
    dot: "bg-blue-500",
    label: "Follow-up"
  },
  quotation: {
    icon: "💰",
    dot: "bg-purple-500",
    label: "Quotation"
  },
  stage: {
    icon: "🔄",
    dot: "bg-orange-500",
    label: "Stage"
  },
  assigned: {
    icon: "👤",
    dot: "bg-green-500",
    label: "Assigned"
  },
  remark: {
    icon: "📝",
    dot: "bg-gray-400",
    label: "Remark"
  },
  created: {
    icon: "🚀",
    dot: "bg-indigo-500",
    label: "Created"
  }
};

/* =========================
   QUOTATION ACTION UI
========================= */
const QUOTATION_UI = {
  draft_saved: {
    icon: "📝",
    dot: "bg-gray-400",
    label: "Draft Saved"
  },
  draft_updated: {
    icon: "✏️",
    dot: "bg-gray-500",
    label: "Draft Updated"
  },
  quotation_created: {
    icon: "💰",
    dot: "bg-purple-500",
    label: "Quotation Created"
  },
  quotation_sent_email: {
    icon: "📧",
    dot: "bg-blue-500",
    label: "Sent via Email"
  },
  quotation_sent_whatsapp: {
    icon: "🟢",
    dot: "bg-green-500",
    label: "Sent via WhatsApp"
  },
  quotation_sent_email_whatsapp: {
    icon: "📨",
    dot: "bg-cyan-500",
    label: "Sent via Email & WhatsApp"
  },
  final_quotation_marked: {
    icon: "✅",
    dot: "bg-emerald-600",
    label: "Final Quotation"
  },
  quotation_revised: {
    icon: "🔁",
    dot: "bg-violet-500",
    label: "Revised"
  },
  quotation_cost_updated: {
    icon: "🔒",
    dot: "bg-orange-500",
    label: "Internal Cost Updated"
  },
  quotation_send_failed: {
    icon: "⚠️",
    dot: "bg-red-500",
    label: "Send Failed"
  }
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "quotation", label: "Quotation" },
  { key: "follow_up", label: "Follow-up" },
  { key: "stage", label: "Stage" },
  { key: "assigned", label: "Assigned" },
  { key: "remark", label: "Remark" }
];

/* =========================
   DATE HELPERS
========================= */
const isSameDay = (a, b) =>
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear();

function toJsDate(value) {
  return value?.toDate?.() || new Date(value || Date.now());
}

function formatDateLabel(dateValue) {
  const d = toJsDate(dateValue);
  const today = new Date();
  const yesterday = new Date(today);

  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, yesterday)) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatTime(dateValue) {
  if (!dateValue) return "";

  return toJsDate(dateValue).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function resolveTimelineDate(...values) {
  for (const value of values) {
    if (!value) continue;

    // Firestore Timestamp
    if (value?.toDate) {
      const date = value.toDate();
      if (!Number.isNaN(date.getTime())) return date;
    }

    // JS Date
    if (value instanceof Date) {
      if (!Number.isNaN(value.getTime())) return value;
    }

    // Milliseconds
    if (typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }

    // ISO string / datetime string
    if (typeof value === "string") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }

    // Firestore-like object
    if (
      typeof value === "object" &&
      typeof value.seconds === "number"
    ) {
      const date = new Date(value.seconds * 1000);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  return null;
}
/* =========================
   VALUE HELPERS
========================= */
function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function formatMoney(value) {
  if (!hasValue(value)) return "—";

  const amount = Number(value);

  if (!Number.isFinite(amount)) return "—";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatPercent(value) {
  if (!hasValue(value)) return "—";

  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `${number.toFixed(1)}%`;
}

function getQuotationAction(event) {
  if (event.type !== "quotation") return "";

  const metadata = event.metadata || {};
  const action = metadata.action;

  if (action) return action;

  const title = String(event.title || "").toLowerCase();
  const channel = String(
    metadata.channel || metadata.sentVia || ""
  ).toLowerCase();
  const status = String(metadata.status || "").toLowerCase();

  if (title.includes("draft updated")) return "draft_updated";
  if (title.includes("draft saved")) return "draft_saved";
  if (title.includes("final")) return "final_quotation_marked";
  if (title.includes("whatsapp")) return "quotation_sent_whatsapp";
  if (title.includes("email")) return "quotation_sent_email";

  if (channel.includes("whatsapp")) return "quotation_sent_whatsapp";
  if (channel.includes("email")) return "quotation_sent_email";

  if (status === "draft") return "draft_saved";
  if (status === "final") return "final_quotation_marked";

  return "quotation_created";
}

function getEventUi(event) {
  if (event.type === "quotation") {
    const action = getQuotationAction(event);
    return QUOTATION_UI[action] || UI.quotation;
  }

  return UI[event.type] || UI.remark;
}

function getActionStatus(event) {
  const metadata = event.metadata || {};
  const action = getQuotationAction(event);

  if (metadata.status) return metadata.status;

  if (action === "draft_saved" || action === "draft_updated") {
    return "draft";
  }

  if (action === "final_quotation_marked") {
    return "final";
  }

  if (
    action === "quotation_sent_email" ||
    action === "quotation_sent_whatsapp" ||
    action === "quotation_sent_email_whatsapp"
  ) {
    return "sent";
  }

  return "";
}

function getSentViaValue(event) {
  const metadata = event.metadata || {};

  if (Array.isArray(metadata.sentVia)) {
    return metadata.sentVia.join(", ");
  }

  if (metadata.sentVia) return metadata.sentVia;
  if (metadata.channel) return metadata.channel;

  const action = getQuotationAction(event);

  if (action === "quotation_sent_email") return "email";
  if (action === "quotation_sent_whatsapp") return "whatsapp";
  if (action === "quotation_sent_email_whatsapp") {
    return "email, whatsapp";
  }

  return "";
}

function getTotalAmountValue(event) {
  const metadata = event.metadata || {};

  return (
    metadata.totalAmount ??
    metadata.customerQuotedAmount ??
    metadata.totalPrice ??
    metadata.amount ??
    ""
  );
}

function getQuotationKeys(event) {
  if (!event || event.type !== "quotation") return [];

  const metadata = event.metadata || {};

  const quotationId =
    metadata.quotationId ||
    event.quotationId ||
    "";

  const revision =
    metadata.revision ??
    metadata.rev ??
    metadata.version ??
    "";

  return [
    quotationId ? `qid:${quotationId}` : "",
    revision ? `rev:${revision}` : ""
  ].filter(Boolean);
}

function getCommercialSnapshot(event) {
  const metadata = event?.metadata || {};

  const totalAmount =
    metadata.totalAmount ??
    metadata.customerQuotedAmount ??
    metadata.totalPrice ??
    metadata.amount;

  const customerQuotedAmount =
    metadata.customerQuotedAmount ??
    metadata.totalAmount ??
    metadata.totalPrice ??
    metadata.amount;

  return {
    totalAmount,
    customerQuotedAmount,
    vendorCost: metadata.vendorCost,
    grossProfit: metadata.grossProfit,
    marginPercent: metadata.marginPercent,
    itineraryHtml: metadata.itineraryHtml,
    quotationId: metadata.quotationId,
    revision:
      metadata.revision ??
      metadata.rev ??
      metadata.version,
    pricingVisibleToCustomer: metadata.pricingVisibleToCustomer
  };
}

function mergeIfMissing(currentValue, fallbackValue) {
  return hasValue(currentValue) ? currentValue : fallbackValue;
}

function enrichEventsWithCommercials(visibleEvents = [], allEvents = []) {
  const commercialMap = new Map();

  [...allEvents, ...visibleEvents].forEach(event => {
    if (event?.type !== "quotation") return;

    const keys = getQuotationKeys(event);
    if (!keys.length) return;

    const snapshot = getCommercialSnapshot(event);

    const hasCommercial =
      hasValue(snapshot.totalAmount) ||
      hasValue(snapshot.customerQuotedAmount) ||
      hasValue(snapshot.vendorCost) ||
      hasValue(snapshot.grossProfit) ||
      hasValue(snapshot.marginPercent) ||
      hasValue(snapshot.itineraryHtml);

    if (!hasCommercial) return;

    const cleanedSnapshot = Object.fromEntries(
      Object.entries(snapshot).filter(([, value]) => hasValue(value))
    );

    keys.forEach(key => {
      const existing = commercialMap.get(key) || {};

      commercialMap.set(key, {
        ...existing,
        ...cleanedSnapshot
      });
    });
  });

  return visibleEvents.map(event => {
    if (event?.type !== "quotation") return event;

    const keys = getQuotationKeys(event);
    const fallback =
      keys.map(key => commercialMap.get(key)).find(Boolean) || {};

    if (!Object.keys(fallback).length) return event;

    const metadata = event.metadata || {};

    return {
      ...event,
      metadata: {
        ...metadata,

        quotationId: mergeIfMissing(
          metadata.quotationId,
          fallback.quotationId
        ),
        revision: mergeIfMissing(metadata.revision, fallback.revision),

        totalAmount: mergeIfMissing(
          metadata.totalAmount,
          fallback.totalAmount
        ),
        customerQuotedAmount: mergeIfMissing(
          metadata.customerQuotedAmount,
          fallback.customerQuotedAmount
        ),
        vendorCost: mergeIfMissing(metadata.vendorCost, fallback.vendorCost),
        grossProfit: mergeIfMissing(
          metadata.grossProfit,
          fallback.grossProfit
        ),
        marginPercent: mergeIfMissing(
          metadata.marginPercent,
          fallback.marginPercent
        ),
        itineraryHtml: mergeIfMissing(
          metadata.itineraryHtml,
          fallback.itineraryHtml
        ),
        pricingVisibleToCustomer:
          metadata.pricingVisibleToCustomer === undefined
            ? fallback.pricingVisibleToCustomer
            : metadata.pricingVisibleToCustomer
      }
    };
  });
}

function normalizeFollowUpEventForModal(event) {
  const metadata = event.metadata || {};

  const nextActionDate = resolveTimelineDate(
    metadata.nextActionDueAt,
    metadata.nextFollowUpAt,
    metadata.nextActionAt,
    metadata.followUpAt,

    metadata.nextActionDueAtIso,
    metadata.nextFollowUpAtIso,

    metadata.nextActionDueAtMs,
    metadata.nextFollowUpAtMs,

    event.nextActionDueAt,
    event.nextFollowUpAt,
    event.nextActionDueAtIso,
    event.nextFollowUpAtIso,
    event.nextActionDueAtMs,
    event.nextFollowUpAtMs
  );

  const nextActionIso = nextActionDate
    ? nextActionDate.toISOString()
    : "";

  const nextActionMs = nextActionDate
    ? nextActionDate.getTime()
    : null;

  return {
    ...event,

    nextFollowUpAt: nextActionDate,
    nextActionDueAt: nextActionDate,
    nextFollowUpAtIso: nextActionIso,
    nextActionDueAtIso: nextActionIso,
    nextFollowUpAtMs: nextActionMs,
    nextActionDueAtMs: nextActionMs,

    metadata: {
      ...metadata,

      action: metadata.action || "follow_up_logged",

      channel:
        metadata.channel ||
        metadata.followUpChannel ||
        event.channel ||
        "",

      followUpChannel:
        metadata.followUpChannel ||
        metadata.channel ||
        event.channel ||
        "",

      outcome:
        metadata.outcome ||
        metadata.outcomeCode ||
        event.outcome ||
        "",

      summary:
        metadata.summary ||
        metadata.followUpSummary ||
        event.summary ||
        event.description ||
        "",

      followUpSummary:
        metadata.followUpSummary ||
        metadata.summary ||
        event.summary ||
        event.description ||
        "",

      nextActionType:
        metadata.nextActionType ||
        event.nextActionType ||
        "follow_up",

      nextFollowUpAt: nextActionDate,
      nextActionDueAt: nextActionDate,

      nextFollowUpAtIso: nextActionIso,
      nextActionDueAtIso: nextActionIso,
      nextFollowUpAtMs: nextActionMs,
      nextActionDueAtMs: nextActionMs
    }
  };
}
function normalizeEventForModal(event) {
  if (!event) return event;

  if (
    event.type === "follow_up" ||
    event.type === "followup" ||
    event.metadata?.action === "follow_up_logged"
  ) {
    return normalizeFollowUpEventForModal(event);
  }

  if (event.type !== "quotation") return event;

  const metadata = event.metadata || {};
  const action = getQuotationAction(event);
  const ui = QUOTATION_UI[action] || UI.quotation;

  const revision =
    metadata.revision ??
    metadata.rev ??
    metadata.version ??
    "";

  const totalAmount = getTotalAmountValue(event);
  const sentVia = getSentViaValue(event);
  const status = getActionStatus(event);

  const leadId =
    event.leadId ||
    metadata.leadId ||
    "";

  const customerQuotedAmount =
    metadata.customerQuotedAmount ??
    metadata.totalAmount ??
    metadata.totalPrice ??
    metadata.amount;

  return {
    ...event,
    leadId,
    actionLabel: ui.label,
    metadata: {
      ...metadata,

      leadId,
      action,
      status,

      sentVia,
      revision,

      ...(hasValue(totalAmount)
        ? { totalAmount }
        : {}),

      ...(hasValue(customerQuotedAmount)
        ? { customerQuotedAmount }
        : {}),

      channel: metadata.channel || sentVia,

      displayRevision: revision ? `v${revision}` : "",

      pricingVisibleToCustomer:
        metadata.pricingVisibleToCustomer === undefined
          ? false
          : metadata.pricingVisibleToCustomer
    }
  };
}

function hasCommercialMetadata(event) {
  const metadata = event.metadata || {};

  return (
    hasValue(metadata.customerQuotedAmount) ||
    hasValue(metadata.totalAmount) ||
    hasValue(metadata.vendorCost) ||
    hasValue(metadata.grossProfit) ||
    hasValue(metadata.marginPercent)
  );
}

/* =========================
   SMALL UI COMPONENTS
========================= */
function TimelineChip({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    orange: "bg-orange-50 text-orange-700",
    purple: "bg-purple-50 text-purple-700",
    red: "bg-red-50 text-red-700",
    cyan: "bg-cyan-50 text-cyan-700",
    emerald: "bg-emerald-50 text-emerald-700"
  };

  return (
    <span
      className={`
        text-[11px] px-2 py-0.5 rounded-full
        ${tones[tone] || tones.gray}
      `}
    >
      {children}
    </span>
  );
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        text-xs px-3 py-1.5 rounded-full border transition
        ${active
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
        }
      `}
    >
      {children}
    </button>
  );
}

function QuotationChips({ event }) {
  if (event.type !== "quotation") return null;

  const normalizedEvent = normalizeEventForModal(event);
  const metadata = normalizedEvent.metadata || {};
  const action = getQuotationAction(normalizedEvent);

  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {metadata.revision && (
        <TimelineChip tone="purple">
          Rev {metadata.revision}
        </TimelineChip>
      )}

      {metadata.channel && (
        <TimelineChip
          tone={
            String(metadata.channel).includes("whatsapp")
              ? "green"
              : "blue"
          }
        >
          {metadata.channel}
        </TimelineChip>
      )}

      {metadata.status && (
        <TimelineChip
          tone={
            metadata.status === "draft"
              ? "gray"
              : metadata.status === "final"
                ? "emerald"
                : "green"
          }
        >
          {metadata.status}
        </TimelineChip>
      )}

      {metadata.isDraft && (
        <TimelineChip tone="gray">
          Draft
        </TimelineChip>
      )}

      {metadata.isFinalQuotation && (
        <TimelineChip tone="emerald">
          Final
        </TimelineChip>
      )}

      {metadata.pricingVisibleToCustomer === false && (
        <TimelineChip tone="orange">
          Internal pricing hidden
        </TimelineChip>
      )}

      {metadata.marginPercent !== undefined &&
        metadata.marginPercent !== null && (
          <TimelineChip tone="gray">
            Margin {formatPercent(metadata.marginPercent)}
          </TimelineChip>
        )}

      {action === "quotation_send_failed" && (
        <TimelineChip tone="red">
          Failed
        </TimelineChip>
      )}
    </div>
  );
}

function InternalCommercials({ event }) {
  if (event.type !== "quotation") return null;

  const normalizedEvent = normalizeEventForModal(event);

  if (!hasCommercialMetadata(normalizedEvent)) return null;

  const metadata = normalizedEvent.metadata || {};

  return (
    <div className="mt-3 bg-orange-50 border border-orange-100 rounded-md p-3 text-xs text-gray-700">
      <p className="font-semibold text-orange-700 mb-2">
        🔒 Internal Commercials
      </p>

      <div className="grid grid-cols-2 gap-2">
        <p>
          Quote:{" "}
          <b>
            {formatMoney(
              metadata.customerQuotedAmount ?? metadata.totalAmount
            )}
          </b>
        </p>

        <p>
          Vendor Cost:{" "}
          <b>{formatMoney(metadata.vendorCost)}</b>
        </p>

        <p>
          Gross Profit:{" "}
          <b>{formatMoney(metadata.grossProfit)}</b>
        </p>

        <p>
          Margin:{" "}
          <b>{formatPercent(metadata.marginPercent)}</b>
        </p>
      </div>
    </div>
  );
}

function SignatureUsed({ event }) {
  const signatureUser = event.metadata?.signatureUser;

  if (!signatureUser?.name) return null;

  return (
    <p className="text-xs text-gray-500 mt-2">
      Signature used:{" "}
      <span className="font-medium text-gray-700">
        {signatureUser.name}
      </span>
      {signatureUser.role ? (
        <span> · {signatureUser.role}</span>
      ) : null}
    </p>
  );
}

function NextFollowUp({ event }) {
  const metadata = event.metadata || {};

  const nextFollowUpAt = resolveTimelineDate(
    metadata.nextActionDueAt,
    metadata.nextFollowUpAt,
    metadata.nextActionAt,
    metadata.followUpAt,

    metadata.nextActionDueAtIso,
    metadata.nextFollowUpAtIso,

    metadata.nextActionDueAtMs,
    metadata.nextFollowUpAtMs,

    event.nextActionDueAt,
    event.nextFollowUpAt,
    event.nextActionDueAtIso,
    event.nextFollowUpAtIso,
    event.nextActionDueAtMs,
    event.nextFollowUpAtMs
  );

  if (!nextFollowUpAt) return null;

  return (
    <p className="text-xs text-blue-600 mt-2">
      ⏭ Next follow-up:{" "}
      {nextFollowUpAt.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })}
    </p>
  );
}

/* =========================
   MAIN COMPONENT
========================= */
export default function LeadTimeline({
  leadId,
  onLoad,
  onSelect,
  eventsOverride,

  // Keep false because parent Lead Detail already has filters.
  showFilters = false
}) {
  const [events, setEvents] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const todayRef = useRef(null);

  useEffect(() => {
    if (!leadId) return;

    const q = query(
      collection(db, "leads", leadId, "timeline"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, snap => {
      const rows = snap.docs.map(d => {
        const data = d.data();

        return {
          id: d.id,
          leadId,
          ...data,
          metadata: {
            ...(data.metadata || {}),
            leadId
          }
        };
      });

      setEvents(rows);
      onLoad?.(rows);
    });

    return () => unsub();
  }, [leadId, onLoad]);

  const rawSource = eventsOverride ?? events;

  const source = useMemo(() => {
    return enrichEventsWithCommercials(rawSource, events);
  }, [rawSource, events]);

  const filteredEvents = useMemo(() => {
    if (!showFilters) return source;
    if (activeFilter === "all") return source;

    return source.filter(event => {
      if (activeFilter === "remark") {
        return event.type === "remark" || !event.type;
      }

      return event.type === activeFilter;
    });
  }, [source, activeFilter, showFilters]);

  const grouped = useMemo(() => {
    return filteredEvents.reduce((acc, event) => {
      const date = event.createdAt?.toDate?.() || new Date();
      const label = formatDateLabel(date);

      if (!acc[label]) acc[label] = [];
      acc[label].push(event);

      return acc;
    }, {});
  }, [filteredEvents]);

  if (!source.length) {
    return (
      <p className="text-sm text-gray-500">
        No activity yet
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* TOP BAR */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {showFilters ? (
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(filter => (
              <FilterButton
                key={filter.key}
                active={activeFilter === filter.key}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
              </FilterButton>
            ))}
          </div>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={() =>
            todayRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "start"
            })
          }
          className="text-sm text-blue-600 hover:underline self-start md:self-auto"
        >
          Jump to Today
        </button>
      </div>

      {!filteredEvents.length ? (
        <p className="text-sm text-gray-500">
          No activity found for selected filter.
        </p>
      ) : (
        <div className="space-y-10">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div
              key={dateLabel}
              ref={dateLabel === "Today" ? todayRef : null}
            >
              {/* DATE HEADER */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase pl-12">
                  {dateLabel}
                </p>
              </div>

              {/* TIMELINE */}
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

                <div className="space-y-6">
                  {items.map(event => {
                    const normalizedEvent = normalizeEventForModal(event);
                    const ui = getEventUi(normalizedEvent);
                    const actionLabel =
                      normalizedEvent.type === "quotation"
                        ? QUOTATION_UI[
                          getQuotationAction(normalizedEvent)
                        ]?.label
                        : ui.label;

                    return (
                      <div
                        key={normalizedEvent.id}
                        className="relative flex gap-6"
                      >
                        <div
                          className={`
                            absolute left-[10px]
                            top-[3px]
                            h-3 w-3 rounded-full
                            ${ui.dot}
                          `}
                        />

                        <div
                          onClick={() => onSelect?.(normalizedEvent)}
                          className="
                            ml-8 flex-1
                            bg-white p-4
                            rounded-lg border border-gray-100 shadow-sm
                            cursor-pointer
                            hover:bg-gray-50
                            transition
                          "
                        >
                          <div className="flex justify-between items-start gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span>{ui.icon}</span>

                                <p className="text-sm font-semibold text-gray-900">
                                  {normalizedEvent.title || actionLabel}
                                </p>
                              </div>

                              {actionLabel && (
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                  {actionLabel}
                                </p>
                              )}
                            </div>

                            <p className="text-xs text-gray-500 shrink-0">
                              {formatTime(normalizedEvent.createdAt)}
                            </p>
                          </div>

                          {normalizedEvent.description && (
                            <p className="text-sm text-gray-700 mt-2">
                              {normalizedEvent.description}
                            </p>
                          )}

                          <QuotationChips event={normalizedEvent} />

                          <InternalCommercials event={normalizedEvent} />

                          <SignatureUsed event={normalizedEvent} />

                          <NextFollowUp event={normalizedEvent} />

                          <p className="text-xs text-gray-400 mt-3">
                            By{" "}
                            {normalizedEvent.createdByName ||
                              normalizedEvent.createdByEmail ||
                              "System"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}