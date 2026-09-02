"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Activity, BarChart3, CheckCircle2, Clock3, Phone, Sparkles, Users } from "lucide-react";

import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { resolveUserRole } from "@/lib/rolePermissions";
import { subscribeProductivitySettings } from "@/lib/engagementProductivitySettings";
import {
  isCallEngagementRecord,
  isMeaningfulEngagement,
  isSuccessfulEngagementConnection
} from "@/lib/engagementProductivity";
import { getLatestPulseSlot } from "@/lib/workSchedule";

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

export default function ProductivityPulse() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [pulse, setPulse] = useState(null);
  const [rating, setRating] = useState(0);
  const [focus, setFocus] = useState("");
  const [saving, setSaving] = useState(false);
  const snoozedUntil = useRef(0);

  useEffect(() => {
    if (!user) return;
    return subscribeProductivitySettings(
      value => setSettings(value),
      error => console.error("Unable to load productivity settings:", error)
    );
  }, [user]);

  const enabledForUser = useMemo(() => {
    if (!user || !settings?.enabled) return false;
    const role = resolveUserRole(user);
    return (settings.enabledRoles || []).includes(role);
  }, [settings, user]);

  const loadPulse = useCallback(async slot => {
    if (!user?.uid || !settings) return;

    const intervalMs = settings.pulseIntervalMinutes * 60 * 1000;
    const intervalStart = new Date(slot.getTime() - intervalMs);
    const dayStart = new Date(slot);
    dayStart.setHours(0, 0, 0, 0);

    const snap = await getDocs(
      query(collection(db, "engagements"), where("createdByUid", "==", user.uid))
    );

    const rows = snap.docs
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

    setRating(0);
    setFocus("");
    setPulse({
      slot,
      intervalStart,
      intervalMetrics: calculateMetrics(intervalRows),
      todayMetrics: calculateMetrics(todayRows)
    });
  }, [settings, user?.uid]);

  useEffect(() => {
    if (!enabledForUser || !settings) return;

    const check = () => {
      const now = new Date();
      if (Date.now() < snoozedUntil.current) return;

      const slot = getLatestPulseSlot(now, settings.pulseIntervalMinutes, settings.workSchedule);
      if (!slot) return;

      // If the tab was sleeping or the user returned after the exact boundary,
      // surface the latest unsubmitted slot instead of silently missing it.
      const key = `dreamtrawell_productivity_pulse_${user.uid}_${slotKey(slot)}`;
      if (window.localStorage.getItem(key) || pulse?.slot?.getTime() === slot.getTime()) return;

      loadPulse(slot).catch(error => console.error("Unable to prepare productivity pulse:", error));
    };

    check();
    const timer = window.setInterval(check, 30000);
    return () => window.clearInterval(timer);
  }, [enabledForUser, loadPulse, pulse?.slot, settings, user?.uid]);

  if (!pulse || !settings || !enabledForUser) return null;

  const save = async () => {
    if (settings.requireSelfRating && !rating) {
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
        role: resolveUserRole(user),
        pulseSlotAt: pulse.slot,
        intervalMinutes: settings.pulseIntervalMinutes,
        intervalStartAt: pulse.intervalStart,
        rating: rating || null,
        nextFocus: focus || "",
        intervalMetrics: pulse.intervalMetrics,
        todayMetrics: pulse.todayMetrics,
        workScheduleSnapshot: settings.workSchedule,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      window.localStorage.setItem(key, "submitted");
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
    setPulse(null);
    window.setTimeout(() => {
      loadPulse(slot).catch(error =>
        console.error("Unable to restore snoozed productivity pulse:", error)
      );
    }, 2 * 60 * 1000);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-600 px-5 py-5 text-white">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Productivity Pulse</p>
              <h2 className="mt-1 text-xl font-bold">{formatTime(pulse.intervalStart)} - {formatTime(pulse.slot)}</h2>
              <p className="mt-1 text-sm text-blue-50/90">Review what moved, rate the interval and choose your next focus.</p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric icon={Activity} label="Engagements" value={pulse.intervalMetrics.engagements} />
            <Metric icon={Phone} label="Calls" value={pulse.intervalMetrics.calls} />
            <Metric icon={CheckCircle2} label="Connected" value={pulse.intervalMetrics.connected} />
            <Metric icon={Users} label="Unique Agents" value={pulse.intervalMetrics.uniqueAgents} />
            <Metric icon={Sparkles} label="Meaningful" value={pulse.intervalMetrics.meaningful} />
            <Metric icon={BarChart3} label="Requirements" value={pulse.intervalMetrics.requirements} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Connection Rate</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{pulse.intervalMetrics.connectionRate}%</p>
              </div>
              <Clock3 className="h-6 w-6 text-slate-400" />
            </div>
          </div>

          {settings.showTodaySummary && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Today so far</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <MiniMetric label="Engagements" value={pulse.todayMetrics.engagements} />
                <MiniMetric label="Connected" value={pulse.todayMetrics.connected} />
                <MiniMetric label="Unique Agents" value={pulse.todayMetrics.uniqueAgents} />
                <MiniMetric label="Meaningful" value={pulse.todayMetrics.meaningful} />
                <MiniMetric label="Requirements" value={pulse.todayMetrics.requirements} />
              </div>
            </div>
          )}

          {settings.requireSelfRating && (
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

          {settings.showNextFocus && (
            <div>
              <label className="text-sm font-semibold text-slate-900">Next focus</label>
              <select value={focus} onChange={e => setFocus(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <option value="">Select focus (optional)</option>
                <option value="new_agents">New Agents</option>
                <option value="existing_agents">Existing Agents</option>
                <option value="lead_followups">Lead Follow-ups</option>
                <option value="quotation_followups">Quotation Follow-ups</option>
                <option value="payments">Payment Follow-ups</option>
                <option value="meetings">Meetings</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={snooze} disabled={saving} className="text-xs font-semibold text-slate-500 hover:text-slate-800">
            Remind me in 2 minutes
          </button>
          <button type="button" onClick={save} disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving..." : "Submit Pulse"}
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
