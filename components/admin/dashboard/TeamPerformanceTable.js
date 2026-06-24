"use client";

import {
  AlertTriangle,
  BadgeIndianRupee,
  CheckCircle2,
  Clock3,
  Send,
  Trophy,
  UserCheck,
  UserCircle2,
  UserPlus,
  Users,
  XCircle
} from "lucide-react";

/* =========================
   VALUE HELPERS
========================= */

function toDate(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getNumber(value) {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const cleaned = value.replace(/[₹,\s]/g, "");
    const parsed = Number(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function getFirstValue(...values) {
  return (
    values.find(
      value => typeof value === "string" && value.trim().length > 0
    )?.trim() || ""
  );
}

function normalizeValue(value = "") {
  return String(value).trim().toLowerCase();
}

function isEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

/* =========================
   LEAD HELPERS
========================= */

function getLeadAmount(lead) {
  return (
    getNumber(lead.finalQuotedAmount) ||
    getNumber(lead.lastQuotedAmount) ||
    getNumber(lead.totalQuotedAmount) ||
    getNumber(lead.quotationAmount) ||
    getNumber(lead.packageAmount) ||
    0
  );
}

function getGrossProfit(lead) {
  return (
    getNumber(lead.actualGrossProfit) ||
    getNumber(lead.grossProfit) ||
    getNumber(lead.expectedGrossProfit) ||
    0
  );
}

function getNextActionDate(lead) {
  return toDate(
    lead.nextActionAt ||
      lead.nextActionDueAt ||
      lead.followUpAt ||
      lead.nextFollowUpAt
  );
}

function isLeadClosed(lead) {
  return lead.stage === "closed_won" || lead.stage === "closed_lost";
}

function isLeadOverdue(lead) {
  const nextActionDate = getNextActionDate(lead);
  if (!nextActionDate) return false;

  return nextActionDate < new Date() && !isLeadClosed(lead);
}

/* =========================
   PERSON HELPERS
========================= */

function getPersonFromLead(lead, type) {
  if (type === "createdBy") {
    const email = getFirstValue(
      lead.createdByEmail,
      lead.createdBy,
      lead.creatorEmail
    );

    const name = getFirstValue(
      lead.createdByName,
      lead.creatorName,
      email
    );

    const uid = getFirstValue(
      lead.createdByUid,
      lead.creatorUid,
      lead.createdByUserId
    );

    return buildPerson({ uid, email, name });
  }

  if (type === "assignedTo") {
    const email = getFirstValue(
      lead.assignedToEmail,
      lead.assignedTo,
      lead.assigneeEmail,
      lead.teamMemberEmail
    );

    const name = getFirstValue(
      lead.assignedToName,
      lead.assigneeName,
      email
    );

    const uid = getFirstValue(
      lead.assignedToUid,
      lead.assigneeUid,
      lead.assignedUserId,
      lead.assignedToUserId
    );

    return buildPerson({ uid, email, name });
  }

  if (type === "assignedBy") {
    const email = getFirstValue(
      lead.assignedByEmail,
      lead.assignedBy,
      lead.assignedByUserEmail
    );

    const name = getFirstValue(
      lead.assignedByName,
      lead.assignedByUserName,
      email
    );

    const uid = getFirstValue(
      lead.assignedByUid,
      lead.assignedByUserId
    );

    return buildPerson({ uid, email, name });
  }

  return null;
}

function buildPerson({ uid = "", email = "", name = "" }) {
  const cleanEmail = isEmail(email) ? normalizeValue(email) : "";
  const cleanUid = normalizeValue(uid);
  const cleanName = getFirstValue(name, cleanEmail, "Unassigned");

  let key = "";

  if (cleanEmail) {
    key = `email:${cleanEmail}`;
  } else if (cleanUid) {
    key = `uid:${cleanUid}`;
  } else if (cleanName && cleanName !== "Unassigned") {
    key = `name:${normalizeValue(cleanName)}`;
  } else {
    key = "unassigned";
  }

  return {
    key,
    uid: cleanUid,
    email: cleanEmail,
    name: cleanName
  };
}

function getInitials(name = "") {
  const words = String(name).trim().split(" ").filter(Boolean);

  if (!words.length) return "U";

  return words
    .slice(0, 2)
    .map(word => word[0])
    .join("")
    .toUpperCase();
}

function createEmptyRow(person) {
  return {
    key: person.key,
    name: person.name,
    email: person.email,

    involvedLeadIds: new Set(),

    createdLeads: 0,
    assignedLeads: 0,
    assignedByMe: 0,

    openLeads: 0,
    wonLeads: 0,
    lostLeads: 0,
    overdueLeads: 0,

    quotedValue: 0,
    wonValue: 0,
    grossProfit: 0
  };
}

/* =========================
   MAIN COMPONENT
========================= */

export default function TeamPerformanceTable({ leads = [] }) {
  const rows = Object.values(
    leads.reduce((acc, lead) => {
      const leadId = lead.id || lead.leadCode || lead.code || Math.random();

      const createdBy = getPersonFromLead(lead, "createdBy");
      const assignedTo = getPersonFromLead(lead, "assignedTo");
      const assignedBy = getPersonFromLead(lead, "assignedBy");

      const people = [
        {
          person: createdBy,
          role: "created"
        },
        {
          person: assignedTo,
          role: "assigned"
        },
        {
          person: assignedBy,
          role: "assignedBy"
        }
      ].filter(item => item.person?.key);

      people.forEach(({ person, role }) => {
        if (!acc[person.key]) {
          acc[person.key] = createEmptyRow(person);
        }

        acc[person.key].involvedLeadIds.add(leadId);

        if (!acc[person.key].email && person.email) {
          acc[person.key].email = person.email;
        }

        if (
          (!acc[person.key].name ||
            acc[person.key].name === acc[person.key].email) &&
          person.name
        ) {
          acc[person.key].name = person.name;
        }

        if (role === "created") {
          acc[person.key].createdLeads += 1;
        }

        if (role === "assigned") {
          const amount = getLeadAmount(lead);
          const grossProfit = getGrossProfit(lead);

          acc[person.key].assignedLeads += 1;

          if (!isLeadClosed(lead)) {
            acc[person.key].openLeads += 1;
          }

          if (lead.stage === "closed_won") {
            acc[person.key].wonLeads += 1;
            acc[person.key].wonValue += amount;
            acc[person.key].grossProfit += grossProfit;
          }

          if (lead.stage === "closed_lost") {
            acc[person.key].lostLeads += 1;
          }

          if (isLeadOverdue(lead)) {
            acc[person.key].overdueLeads += 1;
          }

          if (amount > 0) {
            acc[person.key].quotedValue += amount;
          }
        }

        if (role === "assignedBy") {
          acc[person.key].assignedByMe += 1;
        }
      });

      return acc;
    }, {})
  )
    .map(row => {
      const involvedLeads = row.involvedLeadIds.size;

      return {
        ...row,
        involvedLeads,
        winRate:
          row.assignedLeads > 0
            ? Math.round((row.wonLeads / row.assignedLeads) * 100)
            : 0
      };
    })
    .sort((a, b) => {
      if (b.assignedLeads !== a.assignedLeads) {
        return b.assignedLeads - a.assignedLeads;
      }

      if (b.createdLeads !== a.createdLeads) {
        return b.createdLeads - a.createdLeads;
      }

      return a.name.localeCompare(b.name);
    });

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-500">
          <Users size={22} />
        </div>

        <h3 className="mt-4 text-sm font-semibold text-slate-900">
          No team performance data available
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          Team performance will appear once leads are created, assigned, or
          handled by your team.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <TableHead>Team Member</TableHead>
              <TableHead align="center">Involved</TableHead>
              <TableHead align="center">Created</TableHead>
              <TableHead align="center">Assigned</TableHead>
              <TableHead align="center">Assigned By</TableHead>
              <TableHead align="center">Open</TableHead>
              <TableHead align="center">Won</TableHead>
              <TableHead align="center">Lost</TableHead>
              <TableHead align="center">Overdue</TableHead>
              <TableHead align="right">Quoted Value</TableHead>
              <TableHead align="right">Won Value</TableHead>
              <TableHead align="right">Gross Profit</TableHead>
              <TableHead align="center">Win Rate</TableHead>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map(row => (
              <tr
                key={`team-performance-${row.key}`}
                className="transition hover:bg-slate-50"
              >
                <td className="min-w-[240px] px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-700">
                      {row.key === "unassigned" ? (
                        <UserCircle2 size={20} />
                      ) : (
                        getInitials(row.name)
                      )}
                    </div>

                    <div>
                      <p className="font-semibold text-slate-900">
                        {row.name}
                      </p>

                      {row.email ? (
                        <p className="mt-0.5 text-xs text-slate-500">
                          {row.email}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-rose-500">
                          Email not available
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                <td className="px-4 py-4 text-center">
                  <MetricPill
                    icon={Users}
                    value={row.involvedLeads}
                    tone="slate"
                  />
                </td>

                <td className="px-4 py-4 text-center">
                  <MetricPill
                    icon={UserPlus}
                    value={row.createdLeads}
                    tone="blue"
                  />
                </td>

                <td className="px-4 py-4 text-center">
                  <MetricPill
                    icon={UserCheck}
                    value={row.assignedLeads}
                    tone="green"
                  />
                </td>

                <td className="px-4 py-4 text-center">
                  <MetricPill
                    icon={Send}
                    value={row.assignedByMe}
                    tone="purple"
                  />
                </td>

                <td className="px-4 py-4 text-center">
                  <MetricPill
                    icon={Clock3}
                    value={row.openLeads}
                    tone="blue"
                  />
                </td>

                <td className="px-4 py-4 text-center">
                  <MetricPill
                    icon={CheckCircle2}
                    value={row.wonLeads}
                    tone="green"
                  />
                </td>

                <td className="px-4 py-4 text-center">
                  <MetricPill
                    icon={XCircle}
                    value={row.lostLeads}
                    tone="red"
                  />
                </td>

                <td className="px-4 py-4 text-center">
                  <MetricPill
                    icon={AlertTriangle}
                    value={row.overdueLeads}
                    tone={row.overdueLeads > 0 ? "amber" : "slate"}
                  />
                </td>

                <td className="px-4 py-4 text-right font-medium text-slate-700">
                  {formatCurrency(row.quotedValue)}
                </td>

                <td className="px-4 py-4 text-right font-semibold text-emerald-700">
                  {formatCurrency(row.wonValue)}
                </td>

                <td className="px-4 py-4 text-right font-semibold text-slate-900">
                  {formatCurrency(row.grossProfit)}
                </td>

                <td className="px-4 py-4 text-center">
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                    <Trophy size={13} />
                    {row.winRate}%
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================
   SMALL UI
========================= */

function TableHead({ children, align = "left" }) {
  const alignMap = {
    left: "text-left",
    center: "text-center",
    right: "text-right"
  };

  return (
    <th
      className={`whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        alignMap[align] || alignMap.left
      }`}
    >
      {children}
    </th>
  );
}

function MetricPill({ icon: Icon, value, tone = "slate" }) {
  const toneMap = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-700",
    purple: "bg-violet-50 text-violet-700"
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
        toneMap[tone] || toneMap.slate
      }`}
    >
      <Icon size={13} />
      {value}
    </span>
  );
}