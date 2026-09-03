"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, Clock3, ListChecks, Phone, Plus, RefreshCcw, Sparkles, Target, Users } from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { resolveUserRole } from "@/lib/rolePermissions";
import { WORKSTREAMS, roleWorkstream, workstreamShortLabel } from "@/lib/workstream";
import {
  DEFAULT_PRODUCTIVITY_SETTINGS,
  subscribeProductivitySettings
} from "@/lib/engagementProductivitySettings";
import {
  isCallEngagementRecord,
  isMeaningfulEngagement,
  isSuccessfulEngagementConnection
} from "@/lib/engagementProductivity";
import { getLatestPulseSlot, getNextPulseSlot, isScheduledBreak } from "@/lib/workSchedule";
import { calculateOperationalActivityMetrics } from "@/lib/workActivityClassifier";

export const PRODUCTIVITY_PULSE_TEST_EVENT = "dreamtrawell:test-productivity-pulse";

const EMPTY_METRICS = {
  engagements: 0,
  calls: 0,
  connected: 0,
  meaningful: 0,
  requirements: 0,
  uniqueAgents: 0,
  connectionRate: 0,
  workActions: 0,
  completedWork: 0,
  leadWork: 0,
  onGroundWork: 0,
  quoteWork: 0,
  requoteWork: 0,
  leadFollowUps: 0,
  vendorCoordination: 0,
  supplierCoordination: 0,
  groupCoordination: 0,
  ticketEditing: 0,
  paymentWork: 0,
  leadsGenerated: 0
};

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value?.seconds === "number") return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getEngagementDate(item = {}) {
  return toDate(item.createdAt) || toDate(item.completedAt) || toDate(item.updatedAt);
}

function getWorkEventDate(item = {}) {
  return toDate(item.activityAt) || toDate(item.activityAtClient) || toDate(item.updatedAt);
}

function getLeadCreatedDate(item = {}) {
  return toDate(item.createdAt) || toDate(item.createdOn) || toDate(item.createdDate);
}

function getAgentKey(item = {}) {
  return String(item.agentId || item.travelAgentId || item.agentName || item.travelAgentName || "").trim();
}

function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function slotKey(date) {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${dateKey(date)}_${hh}${mm}`;
}

function formatTime(date) {
  return date?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "";
}

function calculateMetrics(rows = []) {
  const calls = rows.filter(isCallEngagementRecord);
  const connected = calls.filter(isSuccessfulEngagementConnection);
  const uniqueAgents = new Set(rows.map(getAgentKey).filter(Boolean));
  const requirements = rows.filter(item =>
    ["requirement_received", "quote_needed"].includes(
      String(item?.outcomeCode || "").trim().toLowerCase()
    )
  );
  return {
    engagements: rows.length,
    calls: calls.length,
    connected: connected.length,
    meaningful: rows.filter(isMeaningfulEngagement).length,
    requirements: requirements.length,
    uniqueAgents: uniqueAgents.size,
    connectionRate: calls.length ? Math.round((connected.length / calls.length) * 100) : 0
  };
}

function calculateWorkMetrics(events = []) {
  return calculateOperationalActivityMetrics(events);
}

function calculateLeadGenerationMetrics(rows = []) {
  return { leadsGenerated: rows.length };
}

export default function ProductivityPulse() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [settingsResolved, setSettingsResolved] = useState(false);
  const [settingsWarning, setSettingsWarning] = useState(false);
  const [pulse, setPulse] = useState(null);
  const [rating, setRating] = useState(0);
  const [focus, setFocus] = useState("");
  const [saving, setSaving] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const snoozedUntil = useRef(0);
  const activeSlotRef = useRef("");

  useEffect(() => {
    if (!user) return;
    return subscribeProductivitySettings(
      value => {
        setSettings(value);
        setSettingsResolved(true);
      },
      error => {
        console.error("Unable to load productivity settings. Using defaults:", error);
        setSettingsWarning(true);
        setSettingsResolved(true);
      }
    );
  }, [user]);

  const effectiveSettings = settings || DEFAULT_PRODUCTIVITY_SETTINGS;
  const currentRole = resolveUserRole(user || {});
  const currentWorkstream = roleWorkstream(currentRole);

  const enabledForUser = useMemo(() => {
    if (!user || !settingsResolved || !effectiveSettings?.enabled) return false;
    const role = resolveUserRole(user);
    return (effectiveSettings.enabledRoles || []).includes(role);
  }, [effectiveSettings, settingsResolved, user]);

  const loadPulse = useCallback(async (slot, options = {}) => {
    if (!user?.uid) return;

    const activeSettings = settings || DEFAULT_PRODUCTIVITY_SETTINGS;
    const intervalMs = activeSettings.pulseIntervalMinutes * 60 * 1000;
    const intervalStart = new Date(slot.getTime() - intervalMs);
    const dayStart = new Date(slot);
    dayStart.setHours(0, 0, 0, 0);
    const activeKey = `${slotKey(slot)}${options.testMode ? "_test" : ""}`;

    activeSlotRef.current = activeKey;
    setRating(0);
    setFocus("");

    // Open the pulse immediately. Metrics are loaded after the modal is already
    // visible so a slow Firestore read cannot make the pulse look missing.
    setPulse({
      slot,
      intervalStart,
      intervalMetrics: EMPTY_METRICS,
      todayMetrics: EMPTY_METRICS,
      metricsLoading: true,
      metricsError: false,
      testMode: Boolean(options.testMode),
      activeKey
    });

    try {
      const engagementSnap = await getDocs(
        query(collection(db, "engagements"), where("createdByUid", "==", user.uid))
      );

      let leadRows = [];
      try {
        const [ownerSnap, creatorSnap] = await Promise.all([
          getDocs(query(collection(db, "leads"), where("ownerUid", "==", user.uid))),
          getDocs(query(collection(db, "leads"), where("createdByUid", "==", user.uid)))
        ]);
        const leadMap = new Map();
        [...ownerSnap.docs, ...creatorSnap.docs].forEach(item => {
          if (!leadMap.has(item.id)) leadMap.set(item.id, { id: item.id, ...item.data() });
        });
        leadRows = Array.from(leadMap.values()).filter(item => item.deleted !== true && item.isDeleted !== true);
      } catch (leadError) {
        console.warn("Unable to load Lead generation metrics for pulse:", leadError);
      }

      let workEventRows = [];
      try {
        const workEventSnap = await getDocs(
          query(collection(db, "workActivityEvents"), where("performedByUid", "==", user.uid))
        );
        workEventRows = workEventSnap.docs
          .map(item => ({ id: item.id, ...item.data() }))
          .filter(item => item.deleted !== true && item.isDeleted !== true);
      } catch (workEventError) {
        console.warn("Unable to load work activity metrics for pulse:", workEventError);
      }

      const rows = engagementSnap.docs
        .map(item => ({ id: item.id, ...item.data() }))
        .filter(item => item.deleted !== true && item.isDeleted !== true);

      const intervalRows = rows.filter(item => {
        const date = getEngagementDate(item);
        return date && date > intervalStart && date <= slot;
      });

      const todayRows = rows.filter(item => {
        const date = getEngagementDate(item);
        return date && date >= dayStart && date <= slot;
      });

      const intervalWorkEvents = workEventRows.filter(item => {
        const date = getWorkEventDate(item);
        return date && date > intervalStart && date <= slot;
      });
      const todayWorkEvents = workEventRows.filter(item => {
        const date = getWorkEventDate(item);
        return date && date >= dayStart && date <= slot;
      });
      const intervalLeadRows = leadRows.filter(item => {
        const date = getLeadCreatedDate(item);
        return date && date > intervalStart && date <= slot;
      });
      const todayLeadRows = leadRows.filter(item => {
        const date = getLeadCreatedDate(item);
        return date && date >= dayStart && date <= slot;
      });

      setPulse(current =>
        current?.activeKey === activeKey
          ? {
              ...current,
              intervalMetrics: { ...calculateMetrics(intervalRows), ...calculateWorkMetrics(intervalWorkEvents), ...calculateLeadGenerationMetrics(intervalLeadRows) },
              todayMetrics: { ...calculateMetrics(todayRows), ...calculateWorkMetrics(todayWorkEvents), ...calculateLeadGenerationMetrics(todayLeadRows) },
              metricsLoading: false,
              metricsError: false
            }
          : current
      );
    } catch (error) {
      console.error("Unable to load productivity pulse metrics:", error);
      setPulse(current =>
        current?.activeKey === activeKey
          ? { ...current, metricsLoading: false, metricsError: true }
          : current
      );
    }
  }, [settings, user?.uid]);

  useEffect(() => {
    if (!enabledForUser || !settingsResolved) return;

    const check = () => {
      setClock(new Date());
      if (Date.now() < snoozedUntil.current) return;

      const now = new Date();
      const slot = getLatestPulseSlot(
        now,
        effectiveSettings.pulseIntervalMinutes,
        effectiveSettings.workSchedule
      );
      if (!slot) return;

      const slotId = slotKey(slot);
      const key = `dreamtrawell_productivity_pulse_${user.uid}_${slotId}`;
      if (window.localStorage.getItem(key) || activeSlotRef.current === slotId) return;

      loadPulse(slot).catch(error =>
        console.error("Unable to prepare productivity pulse:", error)
      );
    };

    check();
    const timer = window.setInterval(check, 15000);
    const onFocus = () => check();
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [effectiveSettings, enabledForUser, loadPulse, settingsResolved, user?.uid]);

  useEffect(() => {
    const onTestPulse = () => {
      if (!user?.uid) return;
      const slot = new Date();
      slot.setSeconds(0, 0);
      loadPulse(slot, { testMode: true }).catch(error =>
        console.error("Unable to prepare test productivity pulse:", error)
      );
    };

    window.addEventListener(PRODUCTIVITY_PULSE_TEST_EVENT, onTestPulse);
    return () => window.removeEventListener(PRODUCTIVITY_PULSE_TEST_EVENT, onTestPulse);
  }, [loadPulse, user?.uid]);

  const nextSlot = useMemo(() => {
    if (!enabledForUser) return null;
    return getNextPulseSlot(
      clock,
      effectiveSettings.pulseIntervalMinutes,
      effectiveSettings.workSchedule
    );
  }, [clock, effectiveSettings, enabledForUser]);

  if (!settingsResolved && !pulse) return null;

  if (!pulse) {
    if (!enabledForUser || !nextSlot) return null;
    const onBreak = isScheduledBreak(clock, effectiveSettings.workSchedule);

    return (
      <div className="fixed bottom-4 right-4 z-[1200] hidden rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-600 shadow-lg backdrop-blur sm:flex sm:items-center sm:gap-2">
        <Clock3 className="h-3.5 w-3.5 text-blue-600" />
        {onBreak ? "Pulse paused for break" : "Next productivity pulse"}: {formatTime(nextSlot)}
      </div>
    );
  }

  const canRenderPulse = pulse.testMode || enabledForUser;
  if (!canRenderPulse) return null;

  const save = async () => {
    if (pulse.testMode) {
      activeSlotRef.current = "";
      setPulse(null);
      return;
    }

    if (effectiveSettings.requireSelfRating && !rating) {
      alert("Please rate your last work interval from 1 to 5.");
      return;
    }

    setSaving(true);
    const key = `dreamtrawell_productivity_pulse_${user.uid}_${slotKey(pulse.slot)}`;
    const id = `${user.uid}_${slotKey(pulse.slot)}`;

    try {
      await setDoc(doc(db, "productivityPulses", id), {
        userUid: user.uid,
        userName: user.displayName || user.name || user.email || "Team Member",
        userEmail: user.email || "",
        role: currentRole,
        workstream: currentWorkstream,
        pulseSlotAt: pulse.slot,
        intervalMinutes: effectiveSettings.pulseIntervalMinutes,
        intervalStartAt: pulse.intervalStart,
        rating: rating || null,
        nextFocus: focus || "",
        intervalMetrics: pulse.intervalMetrics,
        todayMetrics: pulse.todayMetrics,
        workScheduleSnapshot: effectiveSettings.workSchedule,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      window.localStorage.setItem(key, "submitted");
      activeSlotRef.current = "";
      setPulse(null);
    } catch (error) {
      console.error("Unable to save productivity pulse:", error);
      alert("Could not save your productivity rating. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const snooze = () => {
    const slot = pulse.slot;
    snoozedUntil.current = Date.now() + 2 * 60 * 1000;
    activeSlotRef.current = "";
    setPulse(null);
    window.setTimeout(() => {
      loadPulse(slot).catch(error =>
        console.error("Unable to restore snoozed productivity pulse:", error)
      );
    }, 2 * 60 * 1000);
  };

  const metricValue = value => pulse.metricsLoading ? "..." : value;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-600 px-5 py-5 text-white">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
                {pulse.testMode ? "Test Productivity Pulse" : `${workstreamShortLabel(currentWorkstream)} Productivity Pulse`}
              </p>
              <h2 className="mt-1 text-xl font-bold">{formatTime(pulse.intervalStart)} - {formatTime(pulse.slot)}</h2>
              <p className="mt-1 text-sm text-blue-50/90">
                {pulse.testMode
                  ? "Preview only. This test will not create a productivity record."
                  : currentWorkstream === WORKSTREAMS.ENGAGEMENT
                    ? "Review relationship activity, requirements and Lead generation, then choose your next focus."
                    : currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS
                      ? "Review Lead and Operations execution, then choose your next focus."
                      : "Review what moved, rate the interval and choose your next focus."}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {(settingsWarning || pulse.metricsError) && (
            <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {pulse.metricsError
                  ? "The pulse timer is working, but CRM productivity metrics could not be loaded. Check Firestore permissions/connectivity."
                  : "Using the default pulse schedule because productivity settings could not be synced."}
              </span>
            </div>
          )}

          {currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Metric icon={ListChecks} label="Work Actions" value={metricValue(pulse.intervalMetrics.workActions)} />
                <Metric icon={CheckCircle2} label="Completed" value={metricValue(pulse.intervalMetrics.completedWork)} />
                <Metric icon={Target} label="Quote Work" value={metricValue(pulse.intervalMetrics.quoteWork)} />
                <Metric icon={RefreshCcw} label="Re-Quote" value={metricValue(pulse.intervalMetrics.requoteWork)} />
                <Metric icon={Phone} label="Lead Follow-ups" value={metricValue(pulse.intervalMetrics.leadFollowUps)} />
                <Metric icon={Users} label="On-ground" value={metricValue(pulse.intervalMetrics.onGroundWork)} />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Execution Mix</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{metricValue(pulse.intervalMetrics.vendorCoordination)} vendor · {metricValue(pulse.intervalMetrics.paymentWork)} payment · {metricValue(pulse.intervalMetrics.leadWork)} Lead actions</p>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Metric icon={Activity} label="Engagements" value={metricValue(pulse.intervalMetrics.engagements)} />
                <Metric icon={Phone} label="Calls" value={metricValue(pulse.intervalMetrics.calls)} />
                <Metric icon={CheckCircle2} label="Connected" value={metricValue(pulse.intervalMetrics.connected)} />
                <Metric icon={Users} label="Unique Agents" value={metricValue(pulse.intervalMetrics.uniqueAgents)} />
                <Metric icon={Sparkles} label="Meaningful" value={metricValue(pulse.intervalMetrics.meaningful)} />
                <Metric icon={BarChart3} label="Requirements" value={metricValue(pulse.intervalMetrics.requirements)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Metric icon={Plus} label="Leads Generated" value={metricValue(pulse.intervalMetrics.leadsGenerated)} />
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Connection Rate</p>
                  <p className="mt-1 text-2xl font-bold text-slate-950">{metricValue(`${pulse.intervalMetrics.connectionRate}%`)}</p>
                </div>
              </div>
            </>
          )}

          {effectiveSettings.showTodaySummary && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Today so far</p>
              {currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <MiniMetric label="Work Actions" value={metricValue(pulse.todayMetrics.workActions)} />
                  <MiniMetric label="Completed" value={metricValue(pulse.todayMetrics.completedWork)} />
                  <MiniMetric label="Quote Work" value={metricValue(pulse.todayMetrics.quoteWork)} />
                  <MiniMetric label="Re-Quote" value={metricValue(pulse.todayMetrics.requoteWork)} />
                  <MiniMetric label="Lead Follow-ups" value={metricValue(pulse.todayMetrics.leadFollowUps)} />
                  <MiniMetric label="On-ground" value={metricValue(pulse.todayMetrics.onGroundWork)} />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <MiniMetric label="Engagements" value={metricValue(pulse.todayMetrics.engagements)} />
                  <MiniMetric label="Connected" value={metricValue(pulse.todayMetrics.connected)} />
                  <MiniMetric label="Unique Agents" value={metricValue(pulse.todayMetrics.uniqueAgents)} />
                  <MiniMetric label="Meaningful" value={metricValue(pulse.todayMetrics.meaningful)} />
                  <MiniMetric label="Requirements" value={metricValue(pulse.todayMetrics.requirements)} />
                  <MiniMetric label="Leads Generated" value={metricValue(pulse.todayMetrics.leadsGenerated)} />
                </div>
              )}
            </div>
          )}

          {effectiveSettings.requireSelfRating && !pulse.testMode && (
            <div>
              <p className="text-sm font-semibold text-slate-900">How would you rate your last work interval?</p>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map(value => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRating(value)}
                    className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${rating === value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {effectiveSettings.showNextFocus && !pulse.testMode && (
            <div>
              <label className="text-sm font-semibold text-slate-900">Next focus</label>
              <select value={focus} onChange={e => setFocus(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <option value="">Select focus (optional)</option>
                {currentWorkstream === WORKSTREAMS.LEAD_OPERATIONS ? (
                  <>
                    <option value="new_leads">New Leads</option>
                    <option value="quote_creation">Quote Creation</option>
                    <option value="requote">Re-Quote</option>
                    <option value="lead_followups">Lead Follow-ups</option>
                    <option value="vendor_coordination">Vendor Coordination</option>
                    <option value="supplier_coordination">Supplier Coordination</option>
                    <option value="on_ground">On-ground Operations</option>
                  </>
                ) : (
                  <>
                    <option value="new_agents">New Agents</option>
                    <option value="existing_agents">Existing Agents</option>
                    <option value="engagement_followups">Engagement Follow-ups</option>
                    <option value="requirements">Requirement Discovery</option>
                    <option value="lead_creation">Lead Creation</option>
                    <option value="meetings">Meetings</option>
                  </>
                )}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          {pulse.testMode ? (
            <span className="text-xs font-medium text-slate-400">Admin test preview</span>
          ) : (
            <button type="button" onClick={snooze} disabled={saving} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
              Remind me in 2 minutes
            </button>
          )}
          <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {pulse.testMode ? "Close Test" : saving ? "Saving..." : "Submit Pulse"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-blue-600" />
      <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}
