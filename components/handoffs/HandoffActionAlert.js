"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { resolveUserRole } from "@/lib/rolePermissions";
import { isHandoffOverdue, handoffStatus } from "@/lib/handoffCore.mjs";
import { subscribeMyHandoffs } from "@/lib/handoffService";

export default function HandoffActionAlert({ user }) {
  const [rows, setRows] = useState([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const eligible = user?.active !== false && ["employee", "operation_executive"].includes(resolveUserRole(user));
  useEffect(() => {
    if (!eligible || !user?.uid) { setRows([]); return; }
    return subscribeMyHandoffs(user, setRows, err => console.warn("My Handoffs in Action Center:", err?.message));
  }, [eligible, user?.uid, user?.role]);
  if (!eligible) return null;
  const pending = rows.filter(row => handoffStatus(row) !== "contacted");
  if (!pending.length) return null;
  const overdue = pending.filter(isHandoffOverdue).length;
  return <Link href="/my-handoffs" className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm hover:shadow-md ${overdue ? "border-rose-200 bg-rose-50" : "border-blue-200 bg-blue-50"}`}>
    <div className="flex items-center gap-3"><BellRing size={22} className={overdue ? "text-rose-700" : "text-blue-700"}/><div><p className="text-sm font-bold text-slate-900">{pending.length} agent handover{pending.length === 1 ? "" : "s"} awaiting first contact</p><p className="text-xs text-slate-600">Accept your new assignments and record a connected introduction call.</p></div></div>
    <span className={`rounded-lg px-3 py-2 text-xs font-semibold ${overdue ? "bg-rose-100 text-rose-800" : "bg-white text-blue-700"}`}>{overdue ? `${overdue} overdue · Open My Handoffs` : "Open My Handoffs"}</span>
  </Link>;
}
