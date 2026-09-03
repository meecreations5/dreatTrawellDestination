"use client";

import Link from "next/link";
import { ExternalLink, X } from "lucide-react";

import { classifyOperationalActivity } from "@/lib/workActivityClassifier";

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function activityDate(item = {}) {
  return toDate(item.activityAt) || toDate(item.activityAtClient) || toDate(item.updatedAt) || toDate(item.createdAt);
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatStatus(item = {}) {
  const value = String(item.toStatus || item.activityStatus || item.status || item.eventType || "logged")
    .trim()
    .replaceAll("_", " ");
  return value.replace(/\b\w/g, char => char.toUpperCase());
}

export default function OperationalActivityDrawer({
  open,
  title = "Activity Details",
  helper = "",
  rows = [],
  onClose,
  leadBasePath = "/leads",
  leads = [],
  travelAgents = []
}) {
  if (!open) return null;

  const sortedRows = [...rows].sort((a, b) => {
    return (activityDate(b)?.getTime() || 0) - (activityDate(a)?.getTime() || 0);
  });

  const leadLookup = new Map((leads || []).map(item => [String(item?.id || ""), item]));
  const agentLookup = new Map((travelAgents || []).map(item => [String(item?.id || ""), item]));

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-slate-950/35" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close activity details" className="absolute inset-0 cursor-default" onClick={onClose} />

      <aside className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-slate-950">{title}</h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {sortedRows.length} records
                </span>
              </div>
              {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-5">
          {sortedRows.length ? (
            <div className="space-y-3">
              {sortedRows.map(item => {
                const classification = classifyOperationalActivity(item);
                const leadId = String(item.leadId || item.metadata?.leadId || "").trim();
                const linkedLead = leadId ? leadLookup.get(leadId) : null;
                const agentId = String(item.travelAgentId || item.agentId || item.metadata?.travelAgentId || linkedLead?.travelAgentId || linkedLead?.agentId || "").trim();
                const linkedAgent = agentId ? agentLookup.get(agentId) : null;
                const performer = item.performedByName || item.assignedToName || item.createdByName || item.performedByEmail || item.assignedToEmail || "Team Member";
                const agent = item.travelAgentName || item.agentName || item.companyName || item.metadata?.travelAgentName || linkedLead?.travelAgentName || linkedLead?.agentName || linkedLead?.travelAgent?.name || linkedAgent?.companyName || linkedAgent?.agencyName || linkedAgent?.agentName || linkedAgent?.name || "";
                const leadCode = item.leadCode || item.metadata?.leadCode || linkedLead?.leadCode || linkedLead?.code || linkedLead?.referenceNo || "";
                const destination = item.destinationName || item.metadata?.destinationName || linkedLead?.destinationName || linkedLead?.destination || "";
                const counterparty = item.vendorName || item.supplierName || item.spocName || item.contactPersonName || item.counterpartyName || linkedLead?.spocName || linkedAgent?.primarySpocName || "";
                const directHref = String(item.href || "").trim();
                const directHrefLabel = item.hrefLabel || "Open Details";
                const displayTitle = agent || leadCode || counterparty || item.title || item.taskTypeLabel || classification.activityTypeLabel || "Activity";

                return (
                  <article key={item.id || `${classification.activityType}-${activityDate(item)?.getTime() || Math.random()}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            {classification.trackable ? classification.activityTypeLabel : item.taskTypeLabel || item.title || "Lead Activity"}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            {formatStatus(item)}
                          </span>
                        </div>
                        <p className="mt-2 text-base font-bold text-slate-950">{displayTitle}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-600">{performer}</p>
                        {item.performedByEmail || item.assignedToEmail ? <p className="mt-0.5 text-xs text-slate-400">{item.performedByEmail || item.assignedToEmail}</p> : null}
                      </div>

                      <p className="text-xs font-medium text-slate-500">{formatDateTime(activityDate(item))}</p>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                      {leadCode || leadId ? (
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <span className="text-slate-400">Lead</span>
                          <p className="mt-0.5 font-semibold text-slate-700">{leadCode || leadId}</p>
                        </div>
                      ) : null}
                      {agent ? (
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <span className="text-slate-400">Travel Agent</span>
                          <p className="mt-0.5 font-semibold text-slate-700">{agent}</p>
                        </div>
                      ) : null}
                      {destination ? (
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <span className="text-slate-400">Destination</span>
                          <p className="mt-0.5 font-semibold text-slate-700">{destination}</p>
                        </div>
                      ) : null}
                      {counterparty ? (
                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                          <span className="text-slate-400">Party / Contact</span>
                          <p className="mt-0.5 font-semibold text-slate-700">{counterparty}</p>
                        </div>
                      ) : null}
                    </div>

                    {item.note || item.description || item.title ? (
                      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm leading-5 text-slate-600">
                        {item.note || item.description || item.title}
                      </div>
                    ) : null}

                    {directHref || leadId ? (
                      <div className="mt-3 flex justify-end">
                        <Link
                          href={directHref || `${leadBasePath}/${leadId}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          {directHref ? directHrefLabel : "Open Lead"}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
              No activity records match this KPI and the selected dashboard filters.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
