"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BellRing } from "lucide-react";
import { resolveUserRole } from "@/lib/rolePermissions";
import { isHandoffUnread, isHandoffOverdue } from "@/lib/handoffCore.mjs";
import { subscribeMyHandoffs } from "@/lib/handoffService";

export default function HandoffBell({ user }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const active = user?.uid && user.active !== false && ["employee", "operation_executive"].includes(resolveUserRole(user));
  useEffect(() => {
    if (!active) { setRows([]); return; }
    return subscribeMyHandoffs(user, list => { setRows(list); setError(false); }, () => setError(true));
  }, [active, user?.uid, user?.role]);
  if (!active) return null;
  const unread = rows.filter(isHandoffUnread).length;
  const overdue = rows.filter(row => isHandoffOverdue(row, new Date(now))).length;
  return <Link href="/my-handoffs" aria-label={`My agent handovers: ${unread} new, ${overdue} overdue`}
    title={error ? "Could not load new handovers. Open My Handoffs to retry." : `${unread} new agent handovers${overdue ? `, ${overdue} overdue` : ""}`}
    className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-white text-blue-700 shadow-sm hover:bg-blue-50">
    <BellRing size={20}/>
    {unread > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
    {!unread && overdue > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white">!</span>}
    {error && <span className="sr-only">Notifications could not be loaded.</span>}
  </Link>;
}
