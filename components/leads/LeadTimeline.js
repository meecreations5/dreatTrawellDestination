// componenets/leads/LeadTimeline

"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* =========================
   UI MAP
========================= */
const UI = {
  follow_up: { icon: "📞", dot: "bg-blue-500" },
  quotation: { icon: "💰", dot: "bg-purple-500" },
  stage: { icon: "🔄", dot: "bg-orange-500" },
  assigned: { icon: "👤", dot: "bg-green-500" },
  remark: { icon: "📝", dot: "bg-gray-400" },
  created: { icon: "🚀", dot: "bg-indigo-500" }
};

/* =========================
   DATE HELPERS
========================= */
const isSameDay = (a, b) =>
  a.getDate() === b.getDate() &&
  a.getMonth() === b.getMonth() &&
  a.getFullYear() === b.getFullYear();

function formatDateLabel(date) {
  const d = new Date(date);
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

export default function LeadTimeline({
  leadId,
  onLoad,
  onSelect,
  eventsOverride
}) {
  const [events, setEvents] = useState([]);
  const todayRef = useRef(null);

  /* =========================
     REALTIME LOAD
  ========================== */
  useEffect(() => {
    if (!leadId) return;

    const q = query(
      collection(db, "leads", leadId, "timeline"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, snap => {
      const rows = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      setEvents(rows);
      onLoad?.(rows);
    });

    return () => unsub();
  }, [leadId, onLoad]);

  const source = eventsOverride ?? events;

  /* =========================
     GROUP BY DATE
  ========================== */
  const grouped = useMemo(() => {
    return source.reduce((acc, e) => {
      const date =
        e.createdAt?.toDate?.() || new Date();
      const label = formatDateLabel(date);

      if (!acc[label]) acc[label] = [];
      acc[label].push(e);

      return acc;
    }, {});
  }, [source]);

  if (!source.length) {
    return (
      <p className="text-sm text-gray-500">
        No activity yet
      </p>
    );
  }

  return (
    <div className="space-y-10">

      {/* JUMP TO TODAY */}
      <div className="flex justify-end">
        <button
          onClick={() =>
            todayRef.current?.scrollIntoView({
              behavior: "smooth"
            })
          }
          className="text-sm text-blue-600 hover:underline"
        >
          Jump to Today
        </button>
      </div>

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
            {/* VERTICAL LINE */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />

            <div className="space-y-6">
              {items.map(event => {
                const ui = UI[event.type] || UI.remark;

                return (
                  <div
                    key={event.id}
                    className="relative flex gap-6"
                  >
                    {/* DOT */}
                    <div
                      className={`
                      absolute left-[10px]
                      top-[0px]
                      h-3 w-3 rounded-full
                      ${ui.dot}
                    `}
                    />

                    {/* CARD */}
                    <div
                      onClick={() => onSelect?.(event)}
                      className="
                        ml-8 flex-1
                        bg-white p-4
                        rounded-md shadow-sm
                        cursor-pointer
                        hover:bg-gray-50
                        transition
                      "
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <span>{ui.icon}</span>
                          <p className="text-sm font-medium">
                            {event.title}
                          </p>
                        </div>

                        <p className="text-xs text-gray-500">
                          {event.createdAt?.toDate
                            ? event.createdAt
                              .toDate()
                              .toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                              })
                            : ""}
                        </p>
                      </div>

                      {event.description && (
                        <p className="text-sm text-gray-700 mt-1">
                          {event.description}
                        </p>
                      )}

                      {event.metadata?.nextFollowUpAt && (
                        <p className="text-xs text-blue-600 mt-1">
                          ⏭ Next follow-up:{" "}
                          {event.metadata.nextFollowUpAt
                            .toDate()
                            .toLocaleString()}
                        </p>
                      )}

                      <p className="text-xs text-gray-400 mt-2">
                        By{" "}
                        {event.createdByName ||
                          event.createdByEmail}
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
  );
}
