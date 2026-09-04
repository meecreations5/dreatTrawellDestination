"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BadgeIndianRupee,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FilePenLine,
  FileText,
  Loader2,
  MessageSquareText,
  PhoneCall,
  RefreshCcw,
  TicketCheck,
  Users,
  Workflow,
  X
} from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { alignToWorkSchedule, DEFAULT_WORK_SCHEDULE } from "@/lib/workSchedule";
import { subscribeProductivitySettings } from "@/lib/engagementProductivitySettings";
import {
  WORK_TASK_PRIORITIES,
  WORK_TASK_STATUS,
  createWorkTask,
  updateWorkTaskStatus
} from "@/lib/workTaskService";
import { logLeadAction, LEAD_TIMELINE_TYPES } from "@/lib/logLeadAction";
import {
  classifyOperationalActivity,
  getOperationalWorkUnitKey,
  isOperationalCompletionEvent
} from "@/lib/workActivityClassifier";
import WorkTaskUpdateModal from "@/components/action-center/WorkTaskUpdateModal";

const ACTIVITY_TYPES = [
  {
    value: "quote_creation",
    label: "Quote Creation",
    helper: "Captured automatically from the quotation workflow.",
    Icon: FileText,
    capture: "automatic",
    actionLabel: "Open Quote"
  },
  {
    value: "requote_follow_up",
    label: "Re-Quote",
    helper: "Rev 2+ is captured automatically when revision work starts.",
    Icon: RefreshCcw,
    capture: "automatic",
    actionLabel: "Quote History"
  },
  {
    value: "lead_follow_up",
    label: "Lead Follow-up",
    helper: "Use the existing follow-up form for call result, outcome and next date.",
    Icon: PhoneCall,
    capture: "follow_up",
    actionLabel: "Do Follow-up"
  },
  {
    value: "vendor_coordination",
    label: "Vendor Coordination",
    helper: "Rates, availability, confirmation or revision coordination.",
    Icon: Workflow,
    capture: "manual"
  },
  {
    value: "supplier_coordination",
    label: "Supplier Coordination",
    helper: "Supplier execution, confirmation and service coordination.",
    Icon: Users,
    capture: "manual"
  },
  {
    value: "group_coordination",
    label: "Group Coordination",
    helper: "Group movement, passenger or on-ground coordination.",
    Icon: Users,
    capture: "manual"
  },
  {
    value: "ticket_editing",
    label: "Ticket Editing",
    helper: "Ticket correction, amendment or editing work.",
    Icon: TicketCheck,
    capture: "manual"
  },
  {
    value: "payment_follow_up",
    label: "Payment Follow-up",
    helper: "Agent/vendor-side payment follow-up linked to this Lead.",
    Icon: BadgeIndianRupee,
    capture: "manual"
  },
  {
    value: "other_operations",
    label: "Other Operations Activity",
    helper: "Any Lead/Operations work not covered by the standard activities.",
    Icon: Activity,
    capture: "manual"
  }
];

const RESULT_OPTIONS = [
  { value: "contacted", label: "Contacted" },
  { value: "requested", label: "Requested / Sent" },
  { value: "received", label: "Received" },
  { value: "confirmed", label: "Confirmed" },
  { value: "no_response", label: "No Response" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
  { value: "other", label: "Other" }
];

const PARTY_OPTIONS = [
  { value: "travel_agent", label: "Travel Agent / SPOC" },
  { value: "vendor", label: "Vendor" },
  { value: "supplier", label: "Supplier" },
  { value: "hotel", label: "Hotel" },
  { value: "airline", label: "Airline" },
  { value: "customer", label: "Customer / Traveller" },
  { value: "internal_team", label: "Internal Team" },
  { value: "other", label: "Other" }
];

function clean(value) {
  return String(value || "").trim();
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toLocalInput(value) {
  const date = toDate(value) || new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function defaultDueAt(schedule = DEFAULT_WORK_SCHEDULE) {
  const date = new Date(Date.now() + 60 * 60000);
  return toLocalInput(alignToWorkSchedule(date, schedule) || date);
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusLabel(value) {
  if (value === WORK_TASK_STATUS.IN_PROGRESS) return "In Progress";
  if (value === WORK_TASK_STATUS.WAITING) return "Waiting";
  if (value === WORK_TASK_STATUS.COMPLETED) return "Completed";
  if (value === WORK_TASK_STATUS.SKIPPED) return "Skipped";
  if (value === WORK_TASK_STATUS.CANCELLED) return "Cancelled";
  if (["logged", "recorded"].includes(value)) return "Captured";
  return "Pending";
}

function statusClass(value) {
  if (value === WORK_TASK_STATUS.COMPLETED) return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (value === WORK_TASK_STATUS.WAITING) return "border-amber-100 bg-amber-50 text-amber-700";
  if (value === WORK_TASK_STATUS.IN_PROGRESS) return "border-blue-100 bg-blue-50 text-blue-700";
  if ([WORK_TASK_STATUS.SKIPPED, WORK_TASK_STATUS.CANCELLED].includes(value)) return "border-slate-200 bg-slate-50 text-slate-500";
  if (["logged", "recorded"].includes(value)) return "border-sky-100 bg-sky-50 text-sky-700";
  return "border-violet-100 bg-violet-50 text-violet-700";
}

function defaultPartyType(activityType) {
  if (activityType === "vendor_coordination") return "vendor";
  if (activityType === "supplier_coordination") return "supplier";
  if (activityType === "payment_follow_up") return "travel_agent";
  return "other";
}

function manualTypeMeta(value) {
  return ACTIVITY_TYPES.find(item => item.value === value) || ACTIVITY_TYPES[3];
}

function ManualActivityModal({ open, activityType, lead, user, onClose, onSaved }) {
  const meta = manualTypeMeta(activityType);
  const [status, setStatus] = useState(WORK_TASK_STATUS.IN_PROGRESS);
  const [partyType, setPartyType] = useState(defaultPartyType(activityType));
  const [partyName, setPartyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [purpose, setPurpose] = useState("");
  const [result, setResult] = useState("contacted");
  const [waitingReason, setWaitingReason] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState("normal");
  const [note, setNote] = useState("");
  const [paymentDirection, setPaymentDirection] = useState("agent_receivable");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [ticketDetails, setTicketDetails] = useState("");
  const [otherActivityTitle, setOtherActivityTitle] = useState("");
  const [workSchedule, setWorkSchedule] = useState(DEFAULT_WORK_SCHEDULE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => subscribeProductivitySettings(
    settings => setWorkSchedule(settings.workSchedule || DEFAULT_WORK_SCHEDULE),
    () => setWorkSchedule(DEFAULT_WORK_SCHEDULE)
  ), []);

  useEffect(() => {
    if (!open) return;
    setStatus(WORK_TASK_STATUS.IN_PROGRESS);
    setPartyType(defaultPartyType(activityType));
    setPartyName(
      activityType === "payment_follow_up"
        ? clean(lead?.travelAgentName || lead?.agentName || lead?.agencyName)
        : ""
    );
    setContactPerson("");
    setPurpose("");
    setResult("contacted");
    setWaitingReason("");
    setNextAction("");
    setDueAt(defaultDueAt(workSchedule));
    setPriority("normal");
    setNote("");
    setPaymentDirection("agent_receivable");
    setPaymentAmount("");
    setTicketDetails("");
    setOtherActivityTitle("");
    setError("");
  }, [activityType, lead, open, workSchedule]);

  if (!open) return null;

  const save = async () => {
    setError("");

    const dueDate = new Date(dueAt);
    if (!dueAt || Number.isNaN(dueDate.getTime())) {
      setError("Please select a valid next action / due date and time.");
      return;
    }
    if (status === WORK_TASK_STATUS.WAITING && !waitingReason.trim()) {
      setError("Waiting reason is required when the activity is waiting.");
      return;
    }
    if (activityType === "other_operations" && !otherActivityTitle.trim()) {
      setError("Please enter the operations activity title.");
      return;
    }
    if (["vendor_coordination", "supplier_coordination", "group_coordination", "payment_follow_up"].includes(activityType) && !partyName.trim()) {
      setError("Please enter the party / company name so Admin can see whom this activity relates to.");
      return;
    }
    if (!purpose.trim() && activityType !== "ticket_editing") {
      setError("Please enter the purpose of this activity.");
      return;
    }
    if (activityType === "ticket_editing" && !ticketDetails.trim()) {
      setError("Please mention what needs to be edited or corrected.");
      return;
    }

    const alignedDue = alignToWorkSchedule(dueDate, workSchedule) || dueDate;
    const resultLabel = RESULT_OPTIONS.find(item => item.value === result)?.label || result;
    const title = activityType === "other_operations" ? otherActivityTitle.trim() : meta.label;
    const summaryParts = [
      partyName ? `${PARTY_OPTIONS.find(item => item.value === partyType)?.label || "Party"}: ${partyName}` : "",
      contactPerson ? `Contact: ${contactPerson}` : "",
      purpose ? `Purpose: ${purpose}` : "",
      ticketDetails ? `Ticket work: ${ticketDetails}` : "",
      result ? `Result: ${resultLabel}` : "",
      waitingReason ? `Waiting: ${waitingReason}` : "",
      activityType === "payment_follow_up" ? `Payment side: ${paymentDirection === "agent_receivable" ? "Travel Agent Payment" : paymentDirection === "vendor_payable" ? "Vendor Payment" : paymentDirection === "supplier_payable" ? "Supplier Payment" : "Other"}` : "",
      activityType === "payment_follow_up" && paymentAmount ? `Amount: INR ${paymentAmount}` : "",
      nextAction ? `Next: ${nextAction}` : "",
      note ? `Note: ${note}` : ""
    ].filter(Boolean);
    const summary = summaryParts.join(" | ");

    setSaving(true);
    try {
      const task = await createWorkTask({
        activityType,
        lead,
        dueAt: alignedDue,
        priority,
        note: summary || title,
        user,
        source: "lead_operations_panel",
        details: {
          counterpartyType: partyType,
          counterpartyName: partyName,
          contactPerson,
          purpose,
          result,
          waitingReason,
          nextAction,
          paymentDirection: activityType === "payment_follow_up" ? paymentDirection : "",
          paymentAmount: activityType === "payment_follow_up" ? paymentAmount : "",
          ticketDetails,
          otherActivityTitle
        }
      });

      if (status !== WORK_TASK_STATUS.PENDING) {
        await updateWorkTaskStatus({
          task,
          status,
          note: status === WORK_TASK_STATUS.WAITING ? waitingReason : summary || title,
          user
        });
      }

      await logLeadAction({
        leadId: lead.id || lead.leadId,
        type: LEAD_TIMELINE_TYPES.REMARK,
        title,
        description: summary || title,
        metadata: {
          action: "operations_activity_logged",
          operationalActivityType: activityType,
          taskId: task.id,
          status,
          leadCode: lead.leadCode || lead.code || "",
          travelAgentId: lead.travelAgentId || lead.agentId || "",
          travelAgentName: lead.travelAgentName || lead.agentName || lead.agencyName || "",
          destinationName: lead.destinationName || lead.destination || "",
          counterpartyType: partyType,
          counterpartyName: partyName,
          contactPerson,
          purpose,
          result,
          waitingReason,
          nextAction,
          paymentDirection: activityType === "payment_follow_up" ? paymentDirection : "",
          paymentAmount: activityType === "payment_follow_up" ? Number(paymentAmount || 0) : null,
          ticketDetails,
          otherActivityTitle
        },
        user,
        skipDailyActivity: true
      });

      onSaved?.(task);
      onClose?.();
    } catch (err) {
      console.error("Lead operations activity save failed:", err);
      setError(err?.message || "Unable to save this activity.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Lead Executive Activity</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{meta.label}</h2>
            <p className="mt-1 text-sm text-slate-500">{lead?.leadCode || "Lead"} - {lead?.travelAgentName || lead?.agentName || lead?.agencyName || "Travel Agent"}</p>
          </div>
          <button type="button" onClick={() => onClose?.()} disabled={saving} className="text-slate-400 hover:text-slate-700 disabled:opacity-50"><X size={18} /></button>
        </div>

        <div className="space-y-4 p-5">
          {error ? <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
              <select value={status} onChange={event => setStatus(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                <option value={WORK_TASK_STATUS.PENDING}>Pending</option>
                <option value={WORK_TASK_STATUS.IN_PROGRESS}>In Progress</option>
                <option value={WORK_TASK_STATUS.WAITING}>Waiting</option>
                <option value={WORK_TASK_STATUS.COMPLETED}>Completed</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority</label>
              <select value={priority} onChange={event => setPriority(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                {WORK_TASK_PRIORITIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>

          {activityType === "other_operations" ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity Title *</label>
              <input value={otherActivityTitle} onChange={event => setOtherActivityTitle(event.target.value)} placeholder="Example: Voucher preparation" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Party Type</label>
              <select value={partyType} onChange={event => setPartyType(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                {PARTY_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Party / Company Name</label>
              <input value={partyName} onChange={event => setPartyName(event.target.value)} placeholder="Who are you coordinating with?" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact Person</label>
              <input value={contactPerson} onChange={event => setContactPerson(event.target.value)} placeholder="Name of person contacted" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Result</label>
              <select value={result} onChange={event => setResult(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                {RESULT_OPTIONS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
          </div>

          {activityType === "ticket_editing" ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">What needs editing / correction? *</label>
              <textarea rows={3} value={ticketDetails} onChange={event => setTicketDetails(event.target.value)} placeholder="PNR/passenger/date/sector/correction details" className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Purpose *</label>
              <textarea rows={2} value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="What are you trying to complete or confirm?" className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            </div>
          )}

          {activityType === "payment_follow_up" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Side</label>
                <select value={paymentDirection} onChange={event => setPaymentDirection(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                  <option value="agent_receivable">Travel Agent Payment</option>
                  <option value="vendor_payable">Vendor Payment</option>
                  <option value="supplier_payable">Supplier Payment</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount (optional)</label>
                <input type="number" min="0" step="0.01" value={paymentAmount} onChange={event => setPaymentAmount(event.target.value)} placeholder="0" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
              </div>
            </div>
          ) : null}

          {status === WORK_TASK_STATUS.WAITING ? (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-amber-700">Waiting For / Reason *</label>
              <textarea rows={2} value={waitingReason} onChange={event => setWaitingReason(event.target.value)} placeholder="Example: Waiting for supplier to confirm revised hotel rate." className="mt-1.5 w-full resize-none rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-sm" />
            </div>
          ) : null}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next Action</label>
            <input value={nextAction} onChange={event => setNextAction(event.target.value)} placeholder="Example: Call agent after rate confirmation" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next Action / Due Date *</label>
              <div className="relative mt-1.5">
                <CalendarClock size={16} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
                <input type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Additional Note</label>
              <input value={note} onChange={event => setNote(event.target.value)} placeholder="Optional note" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button type="button" disabled={saving} onClick={() => onClose?.()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={saving} onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Save Activity
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeadOperationsActivityPanel({
  lead,
  disabled = false,
  onFollowUp,
  onQuote,
  onReQuote,
  onPaymentWorkspace
}) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [manualType, setManualType] = useState("");
  const [updateState, setUpdateState] = useState({ open: false, task: null, action: "" });

  useEffect(() => {
    const leadId = clean(lead?.id || lead?.leadId);
    if (!leadId) {
      setTasks([]);
      setEvents([]);
      return undefined;
    }

    const unsubTasks = onSnapshot(
      query(collection(db, "workTasks"), where("leadId", "==", leadId)),
      snap => {
        const rows = snap.docs
          .map(item => ({ id: item.id, ...item.data() }))
          .filter(item => ACTIVITY_TYPES.some(type => type.value === item.activityType) || item.activityType === "payment_management" || item.activityType === "quote_follow_up")
          .sort((a, b) => {
            const aDate = toDate(a.updatedAt) || toDate(a.createdAt) || toDate(a.dueAt);
            const bDate = toDate(b.updatedAt) || toDate(b.createdAt) || toDate(b.dueAt);
            return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
          });
        setTasks(rows);
      },
      error => {
        console.warn("Unable to load Lead operations tasks:", error);
        setTasks([]);
      }
    );

    const unsubEvents = onSnapshot(
      query(collection(db, "workActivityEvents"), where("leadId", "==", leadId)),
      snap => {
        const rows = snap.docs
          .map(item => ({ id: item.id, ...item.data() }))
          .filter(item => classifyOperationalActivity(item).trackable);
        setEvents(rows);
      },
      error => {
        console.warn("Unable to load Lead operations activity events:", error);
        setEvents([]);
      }
    );

    return () => {
      unsubTasks();
      unsubEvents();
    };
  }, [lead?.id, lead?.leadId]);

  const recentRows = useMemo(() => {
    const taskIds = new Set(tasks.map(item => clean(item.id || item.taskId)).filter(Boolean));
    const automaticByKey = new Map();

    events.forEach(event => {
      if (clean(event.taskId) && taskIds.has(clean(event.taskId))) return;
      const info = classifyOperationalActivity(event);
      if (!info.trackable) return;
      const key = getOperationalWorkUnitKey(event, info) || event.id;
      const current = automaticByKey.get(key);
      const currentDate = toDate(current?.activityAt) || toDate(current?.activityAtClient);
      const nextDate = toDate(event.activityAt) || toDate(event.activityAtClient);
      if (!current || (nextDate?.getTime() || 0) >= (currentDate?.getTime() || 0)) {
        automaticByKey.set(key, {
          ...event,
          id: `event_${event.id}`,
          rowKind: "event",
          activityType: info.activityType,
          activityTypeLabel: info.activityTypeLabel,
          status: isOperationalCompletionEvent(event, info) ? WORK_TASK_STATUS.COMPLETED : clean(event.toStatus || event.status || "logged"),
          dueAt: event.activityAt || event.activityAtClient
        });
      }
    });

    return [
      ...tasks.map(item => ({ ...item, rowKind: "task" })),
      ...automaticByKey.values()
    ]
      .sort((a, b) => {
        const aDate = toDate(a.updatedAt) || toDate(a.activityAt) || toDate(a.activityAtClient) || toDate(a.createdAt) || toDate(a.dueAt);
        const bDate = toDate(b.updatedAt) || toDate(b.activityAt) || toDate(b.activityAtClient) || toDate(b.createdAt) || toDate(b.dueAt);
        return (bDate?.getTime() || 0) - (aDate?.getTime() || 0);
      })
      .slice(0, 10);
  }, [events, tasks]);

  const openCount = useMemo(
    () => tasks.filter(item => [WORK_TASK_STATUS.PENDING, WORK_TASK_STATUS.IN_PROGRESS, WORK_TASK_STATUS.WAITING].includes(item.status)).length,
    [tasks]
  );

  const handleType = item => {
    if (disabled) return;
    if (item.value === "quote_creation") {
      onQuote?.();
      return;
    }
    if (item.value === "requote_follow_up") {
      onReQuote?.();
      return;
    }
    if (item.value === "lead_follow_up") {
      onFollowUp?.();
      return;
    }
    setManualType(item.value);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/50 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Lead Executive Activities</p>
            <h3 className="mt-1 text-base font-semibold text-slate-950">Record work from inside this Lead</h3>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">Quote Creation and Re-Quote are captured automatically from quotation work. Use the other activity buttons only when the CRM cannot detect the coordination itself.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{openCount} open</span>
            {onPaymentWorkspace ? <button type="button" onClick={onPaymentWorkspace} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100">Open Payments</button> : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ACTIVITY_TYPES.map(item => {
            const Icon = item.Icon;
            const automatic = item.capture === "automatic";
            return (
              <button
                key={item.value}
                type="button"
                disabled={disabled}
                onClick={() => handleType(item)}
                className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${automatic ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      {automatic ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Auto</span> : null}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.helper}</p>
                    <p className="mt-2 text-xs font-semibold text-blue-600">{item.actionLabel || "Add Activity"}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Recent Operational Work</h3>
            <p className="mt-1 text-xs text-slate-500">These tasks also feed Action Center, productivity pulse and Admin activity drill-downs.</p>
          </div>
          <span className="text-xs font-semibold text-slate-400">{tasks.length} manual task{tasks.length === 1 ? "" : "s"}</span>
        </div>

        {recentRows.length ? (
          <div className="mt-4 space-y-2">
            {recentRows.map(task => (
              <div key={task.id} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{task.otherActivityTitle || task.activityTypeLabel || task.taskTypeLabel || task.title || "Work Activity"}</p>
                      {task.rowKind === "event" ? <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Auto Captured</span> : null}
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(task.status)}`}>{statusLabel(task.status)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {task.counterpartyName ? `${task.counterpartyName} - ` : ""}{task.purpose || task.ticketDetails || task.note || "Operational activity"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1"><Clock3 size={12} /> Due {formatDateTime(task.dueAt)}</span>
                      {task.contactPerson ? <span>Contact: {task.contactPerson}</span> : null}
                      {task.waitingReason || task.lastStatusNote ? <span className="text-amber-600">{task.status === WORK_TASK_STATUS.WAITING ? `Waiting: ${task.waitingReason || task.lastStatusNote}` : task.waitingReason || ""}</span> : null}
                    </div>
                  </div>

                  {task.rowKind === "task" && [WORK_TASK_STATUS.PENDING, WORK_TASK_STATUS.IN_PROGRESS, WORK_TASK_STATUS.WAITING].includes(task.status) ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {task.rowKind === "task" && task.status !== WORK_TASK_STATUS.IN_PROGRESS ? <button type="button" onClick={() => setUpdateState({ open: true, task, action: WORK_TASK_STATUS.IN_PROGRESS })} className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700">Start</button> : null}
                      <button type="button" onClick={() => setUpdateState({ open: true, task, action: WORK_TASK_STATUS.WAITING })} className="rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700">Waiting</button>
                      <button type="button" onClick={() => setUpdateState({ open: true, task, action: WORK_TASK_STATUS.COMPLETED })} className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">Complete</button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <MessageSquareText className="mx-auto h-5 w-5 text-slate-300" />
            <p className="mt-2 text-sm font-medium text-slate-600">No manual operational activity logged yet.</p>
            <p className="mt-1 text-xs text-slate-400">Quotation activity will continue to be captured automatically.</p>
          </div>
        )}
      </div>

      <ManualActivityModal
        open={Boolean(manualType)}
        activityType={manualType}
        lead={lead}
        user={user}
        onClose={() => setManualType("")}
      />

      <WorkTaskUpdateModal
        open={updateState.open}
        task={updateState.task}
        action={updateState.action}
        user={user}
        onClose={() => setUpdateState({ open: false, task: null, action: "" })}
      />
    </div>
  );
}
