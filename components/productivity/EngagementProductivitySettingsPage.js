"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, TimerReset } from "lucide-react";

import Card from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_PRODUCTIVITY_SETTINGS,
  getProductivitySettings,
  saveProductivitySettings
} from "@/lib/engagementProductivitySettings";

const ROLE_OPTIONS = [
  ["employee", "Employee / Sales"],
  ["operation_executive", "Operation Executive"],
  ["manager", "Manager"],
  ["associate", "Associate"],
  ["partner", "Partner"]
];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export default function EngagementProductivitySettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const [form, setForm] = useState(DEFAULT_PRODUCTIVITY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!user) return;
      setLoading(true);
      try {
        const settings = await getProductivitySettings();
        if (mounted) setForm(settings);
      } catch (error) {
        console.error("Failed to load engagement productivity settings:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [user]);

  const update = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateSchedule = (key, value) => {
    setForm(prev => ({
      ...prev,
      workSchedule: {
        ...prev.workSchedule,
        [key]: value
      }
    }));
  };

  const toggleRole = role => {
    setForm(prev => {
      const current = new Set(prev.enabledRoles || []);
      if (current.has(role)) current.delete(role);
      else current.add(role);
      return { ...prev, enabledRoles: Array.from(current) };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveProductivitySettings(form, user);
      setForm(saved);
      alert("Engagement productivity settings saved.");
    } catch (error) {
      console.error("Failed to save engagement productivity settings:", error);
      alert(error?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <div className="h-56 animate-pulse rounded-3xl border border-slate-200 bg-white" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <section className="rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-600 p-6 text-white">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <TimerReset className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Admin Settings</p>
            <h1 className="mt-1 text-2xl font-bold">Engagement & Productivity</h1>
            <p className="mt-2 max-w-2xl text-sm text-blue-50/90">
              Configure the team productivity pulse and active work windows. Scheduled breaks are excluded from pulse activity.
            </p>
          </div>
        </div>
      </section>

      <Card className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Productivity Pulse</h2>
            <p className="mt-1 text-xs text-slate-500">Default is every 15 minutes. Change it without code deployment.</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(form.enabled)}
              onChange={e => update("enabled", e.target.checked)}
            />
            Enabled
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-600">Pulse interval (minutes)</label>
            <input
              type="number"
              min="5"
              max="120"
              step="5"
              className={`${inputClass} mt-1`}
              value={form.pulseIntervalMinutes}
              onChange={e => update("pulseIntervalMinutes", e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-400">Recommended: 15, 30, 45 or 60 minutes.</p>
          </div>

          <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
            <CheckSetting label="Require self-rating" checked={form.requireSelfRating} onChange={value => update("requireSelfRating", value)} />
            <CheckSetting label="Show today summary" checked={form.showTodaySummary} onChange={value => update("showTodaySummary", value)} />
            <CheckSetting label="Ask next focus" checked={form.showNextFocus} onChange={value => update("showNextFocus", value)} />
          </div>
        </div>
      </Card>

      <Card className="space-y-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Working Schedule</h2>
          <p className="mt-1 text-xs text-slate-500">
            Current DreamTrawell defaults are 10:30 start, 2:00-3:00 lunch and 5:30-6:15 evening break.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TimeField label="Work starts" value={form.workSchedule?.workStart} onChange={value => updateSchedule("workStart", value)} />
          <TimeField label="Lunch starts" value={form.workSchedule?.lunchStart} onChange={value => updateSchedule("lunchStart", value)} />
          <TimeField label="Lunch ends" value={form.workSchedule?.lunchEnd} onChange={value => updateSchedule("lunchEnd", value)} />
          <TimeField label="Evening break starts" value={form.workSchedule?.eveningBreakStart} onChange={value => updateSchedule("eveningBreakStart", value)} />
          <TimeField label="Evening break ends" value={form.workSchedule?.eveningBreakEnd} onChange={value => updateSchedule("eveningBreakEnd", value)} />
          <TimeField label="Work ends (optional)" value={form.workSchedule?.workEnd} onChange={value => updateSchedule("workEnd", value)} />
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Roles receiving the pulse</h2>
          <p className="mt-1 text-xs text-slate-500">Admins are excluded by default so the popup stays focused on execution roles.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ROLE_OPTIONS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={(form.enabledRoles || []).includes(value)}
                onChange={() => toggleRole(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Productivity Settings"}
        </button>
      </div>
    </main>
  );
}

function CheckSetting({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-700">
      <input type="checkbox" checked={Boolean(checked)} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function TimeField({ label, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      <input type="time" className={`${inputClass} mt-1`} value={value || ""} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
